# Copyright (c) 2026, Frappe and Contributors
# For license information, please see license.txt

"""Shared access-control helpers for LMS lesson media.

Centralizes the cross-doctype permission logic that the Course Lesson controller,
the serve_resource endpoint, the SCORM renderer, and the File has_permission hook
all rely on — mirroring the dedicated permissions module pattern used by frappe
core (frappe/permissions.py), CRM (crm.permissions.*), and Raven (raven.permissions).
"""

import frappe

from lms.lms.utils import (
	can_modify_batch,
	can_modify_course,
	get_membership,
	guest_access_allowed,
	has_moderator_role,
)

# File fields that hold instructor-only lesson media (never served to students).
INSTRUCTOR_FIELDS = {"instructor_content", "instructor_notes"}


def _lock_reason(available_from, available_till) -> str | None:
	"""Return why a scheduled resource is inaccessible right now, or ``None`` if it's open.

	``available_from`` / ``available_till`` are optional Datetime values; either or both
	may be unset, meaning no bound on that side. Shared by lessons and quizzes, which both
	carry their own independent ``available_from`` / ``available_till`` fields.
	"""
	now = frappe.utils.now_datetime()
	if available_from and now < frappe.utils.get_datetime(available_from):
		return "not_yet_available"
	if available_till and now > frappe.utils.get_datetime(available_till):
		return "closed"
	return None


def resolve_lesson_access(lesson: str, *, user: str | None = None) -> tuple[bool, bool, str | None]:
	"""Return ``(is_instructor, can_access, lock_reason)`` for a lesson, in a single pass.

	- ``is_instructor``: can author the lesson's course → all media, incl. instructor files.
	- ``can_access``: ``is_instructor`` OR (enrolled member OR (published course AND
	  include_in_preview AND guest access allowed)) AND the lesson's availability window.
	- ``lock_reason``: ``None`` when accessible, else ``"not_yet_available"`` / ``"closed"``
	  when membership/preview would otherwise grant access but the schedule doesn't.
	  Always ``None`` when the caller isn't otherwise entitled at all (no schedule info to
	  leak to someone who was never going to see the lesson anyway).

	Callers needing only one flag should use :func:`can_access_lesson`; this exists so a
	caller needing more (e.g. get_lesson, which decides instructor-field visibility and
	surfaces the lock reason on top of the access gate) resolves the instructor check once
	instead of twice.
	"""
	if not isinstance(lesson, str) or not lesson:
		return False, False, None

	lesson_row = frappe.db.get_value(
		"Course Lesson",
		lesson,
		["course", "include_in_preview", "available_from", "available_till"],
		as_dict=True,
	)
	if not lesson_row:
		return False, False, None

	original_user = frappe.session.user
	user = user or original_user
	try:
		# can_modify_course / get_membership / guest_access_allowed read session.user.
		frappe.session.user = user
		if can_modify_course(lesson_row.course):
			# Instructors/moderators always bypass the schedule — same as they already
			# bypass enrollment.
			return True, True, None
		if get_membership(lesson_row.course, user):
			reason = _lock_reason(lesson_row.available_from, lesson_row.available_till)
			return False, reason is None, reason
		# Preview is for prospective students of a LIVE course. Require the course to be
		# published so draft lessons don't leak via this gate (matches get_course_details,
		# which already hides unpublished courses from non-authors). Instructors/members
		# are handled above, so unpublishing never locks them out.
		if (
			lesson_row.include_in_preview
			and frappe.db.get_value("LMS Course", lesson_row.course, "published")
			and guest_access_allowed()
		):
			reason = _lock_reason(lesson_row.available_from, lesson_row.available_till)
			return False, reason is None, reason
		return False, False, None
	finally:
		frappe.session.user = original_user


def can_access_lesson(lesson: str, *, instructor_only: bool = False, user: str | None = None) -> bool:
	"""Single source of truth for who may read a lesson's resources.

	- instructors / moderators (can_modify_course) → all media (incl. instructor files)
	- instructor_only=True → only the above; enrolled students denied
	- else (student media): enrolled member OR (published course AND include_in_preview
	  AND guest access allowed), gated on the lesson's availability window
	"""
	is_instructor, can_access, _lock_reason = resolve_lesson_access(lesson, user=user)
	return is_instructor if instructor_only else can_access


def resolve_quiz_access(quiz: str, *, user: str | None = None) -> tuple[bool, bool, str | None]:
	"""Return ``(is_privileged, can_access, lock_reason)`` for a quiz, in a single pass.

	Mirrors :func:`resolve_lesson_access`. ``is_privileged`` covers global moderators, the
	quiz's own author, and course/batch authors — all of whom bypass the quiz's schedule
	the same way they already bypass enrollment. Everyone else (enrolled course members /
	batch members) is additionally gated on the quiz's own ``available_from`` /
	``available_till``.

	A quiz's owning course/lesson is read from LMS Quiz.course / LMS Quiz.lesson (set
	automatically by Course Lesson.save_lesson_details_in_quiz when the quiz is embedded
	in a lesson). Course Lesson.quiz_id is also honoured for lessons that set it manually.
	"""
	if not isinstance(quiz, str) or not quiz:
		return False, False, None

	quiz_row = frappe.db.get_value(
		"LMS Quiz", quiz, ["course", "owner", "available_from", "available_till"], as_dict=True
	)
	if not quiz_row:
		return False, False, None

	original_user = frappe.session.user
	user = user or original_user
	try:
		# The can_modify_* / get_membership helpers read session.user.
		frappe.session.user = user

		# Global admins and the quiz author may always reach it, even when unlinked.
		if has_moderator_role(user) or quiz_row.owner == user:
			return True, True, None

		# Courses the quiz belongs to: the authoritative LMS Quiz.course link plus any
		# lesson that references it via the manually-set quiz_id field. A privileged match
		# on any course short-circuits (author of one course doesn't need the schedule
		# even if only a plain member of another course sharing the same quiz).
		is_member = False
		courses = set()
		if quiz_row.course:
			courses.add(quiz_row.course)
		courses.update(frappe.get_all("Course Lesson", filters={"quiz_id": quiz}, pluck="course"))
		for course in courses:
			if not course:
				continue
			if can_modify_course(course):
				return True, True, None
			if get_membership(course, user):
				is_member = True

		assessment_batches = frappe.get_all(
			"LMS Assessment",
			filters={"assessment_type": "LMS Quiz", "assessment_name": quiz},
			pluck="parent",
		)
		for batch in assessment_batches:
			if not batch:
				continue
			if can_modify_batch(batch):
				return True, True, None
			if frappe.db.exists("LMS Batch Enrollment", {"batch": batch, "member": user}):
				is_member = True

		if not is_member:
			return False, False, None

		reason = _lock_reason(quiz_row.available_from, quiz_row.available_till)
		return False, reason is None, reason
	finally:
		frappe.session.user = original_user


def can_access_quiz(quiz: str, *, user: str | None = None) -> bool:
	"""Single source of truth for who may read a quiz's questions/answers.

	Access is granted to:
	- global moderators and the quiz's own author (so an unlinked/newly-created quiz
	  can still be edited before it is embedded anywhere),
	- course authors / moderators of any course the quiz belongs to, plus enrolled
	  members of that course (subject to the quiz's availability window),
	- batch instructors / enrolled members of any batch whose assessment references it
	  (instructors bypass the window, members are subject to it).
	"""
	_is_privileged, can_access, _lock_reason = resolve_quiz_access(quiz, user=user)
	return can_access


def file_has_permission(doc, ptype="read", user=None):
	"""File has_permission hook: deny-only tightening for instructor-only lesson files.

	For private Files attached to a Course Lesson via instructor_content /
	instructor_notes, deny ALL access (read and authoring) to anyone who cannot
	author the course. For every other File, return True (no opinion) so the
	student/native serving path is unaffected.

	Instructor-only access == can author the course == can_access_lesson with
	instructor_only=True, so delegate to it (the single source of truth) rather
	than re-implementing the course lookup / session swap. This is fail-closed: a
	missing/deleted owning lesson makes can_access_lesson return False, denying the
	orphaned instructor file.
	"""
	user = user or frappe.session.user

	if doc.attached_to_doctype != "Course Lesson":
		return True
	if doc.attached_to_field not in INSTRUCTOR_FIELDS:
		return True

	if can_access_lesson(doc.attached_to_name, instructor_only=True, user=user):
		return True

	frappe.logger("lms.security").warning(
		"Lesson resource access denied: user=%s file=%s field=%s lesson=%s",
		user,
		doc.name,
		doc.attached_to_field,
		doc.attached_to_name,
	)
	return False
