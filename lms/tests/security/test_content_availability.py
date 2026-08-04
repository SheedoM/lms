import frappe
from frappe.tests.test_api import FrappeAPITestCase
from frappe.utils import add_to_date, now_datetime

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_lesson, get_quiz_with_questions


class TestLessonAvailabilityWindow(BaseTestUtils, FrappeAPITestCase):
	"""Course Lesson.available_from / available_till must gate student access, not instructors."""

	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"lainstr-{hash}@example.com", "Ivy", "Instr", ["Course Creator", "Moderator"]
		)
		self.student = self._create_user(f"lastud-{hash}@example.com", "Sam", "Student", ["LMS Student"])

		self.course = self._create_course(title=f"Availability Course {hash}", instructor=self.instructor.email)
		self.chapter = self._create_chapter(f"AChapter {hash}", self.course.name)
		self.lesson = self._create_lesson(f"ALesson {hash}", self.chapter.name, self.course.name)
		self._create_chapter_reference(self.course.name, self.chapter.name, idx=1)
		self._create_lesson_reference(self.chapter.name, self.lesson.name)
		self._create_enrollment(self.student.email, self.course.name)

	def _get(self, user):
		frappe.session.user = user
		try:
			return get_lesson(self.course.name, 1, 1)
		finally:
			frappe.session.user = "Administrator"

	def test_enrolled_student_locked_before_available_from(self):
		self.lesson.available_from = add_to_date(now_datetime(), days=1)
		self.lesson.save()
		result = self._get(self.student.email)
		self.assertEqual(result.get("no_preview"), 1)
		self.assertEqual(result.get("lock_reason"), "not_yet_available")

	def test_enrolled_student_can_access_within_window(self):
		self.lesson.available_from = add_to_date(now_datetime(), days=-1)
		self.lesson.available_till = add_to_date(now_datetime(), days=1)
		self.lesson.save()
		result = self._get(self.student.email)
		self.assertIsNone(result.get("no_preview"))
		self.assertEqual(result.get("title"), self.lesson.title)

	def test_enrolled_student_locked_after_available_till(self):
		self.lesson.available_till = add_to_date(now_datetime(), days=-1)
		self.lesson.save()
		result = self._get(self.student.email)
		self.assertEqual(result.get("no_preview"), 1)
		self.assertEqual(result.get("lock_reason"), "closed")

	def test_instructor_bypasses_schedule(self):
		self.lesson.available_from = add_to_date(now_datetime(), days=1)
		self.lesson.available_till = add_to_date(now_datetime(), days=2)
		self.lesson.save()
		result = self._get(self.instructor.email)
		self.assertIsNone(result.get("no_preview"))
		self.assertEqual(result.get("title"), self.lesson.title)

	def test_unset_bounds_mean_always_available(self):
		result = self._get(self.student.email)
		self.assertIsNone(result.get("no_preview"))


class TestQuizAvailabilityWindow(BaseTestUtils, FrappeAPITestCase):
	"""LMS Quiz.available_from / available_till must gate student access, not instructors."""

	def setUp(self):
		super().setUp()
		hash = frappe.generate_hash(length=6)
		self.instructor = self._create_user(
			f"qainstr-{hash}@example.com", "Ivy", "Instr", ["Course Creator", "Moderator"]
		)
		self.student = self._create_user(f"qastud-{hash}@example.com", "Sam", "Student", ["LMS Student"])

		self.questions = self._create_quiz_questions()
		self.quiz = self._create_quiz(title=f"Availability Quiz {hash}")
		self.course = self._create_course(title=f"Quiz Avail Course {hash}", instructor=self.instructor.email)
		self.chapter = self._create_chapter(f"QAChapter {hash}", self.course.name)
		self.lesson = self._create_lesson(
			f"QALesson {hash}",
			self.chapter.name,
			self.course.name,
		)
		self.lesson.quiz_id = self.quiz.name
		self.lesson.save()
		self._create_enrollment(self.student.email, self.course.name)

	def _get(self, user):
		frappe.session.user = user
		try:
			return get_quiz_with_questions(self.quiz.name)
		finally:
			frappe.session.user = "Administrator"

	def test_enrolled_student_locked_before_available_from(self):
		self.quiz.available_from = add_to_date(now_datetime(), days=1)
		self.quiz.save()
		with self.assertRaises(frappe.PermissionError):
			self._get(self.student.email)

	def test_enrolled_student_can_access_within_window(self):
		self.quiz.available_from = add_to_date(now_datetime(), days=-1)
		self.quiz.available_till = add_to_date(now_datetime(), days=1)
		self.quiz.save()
		result = self._get(self.student.email)
		self.assertEqual(result["quiz"]["title"], self.quiz.title)

	def test_enrolled_student_locked_after_available_till(self):
		self.quiz.available_till = add_to_date(now_datetime(), days=-1)
		self.quiz.save()
		with self.assertRaises(frappe.PermissionError):
			self._get(self.student.email)

	def test_instructor_bypasses_schedule(self):
		self.quiz.available_from = add_to_date(now_datetime(), days=1)
		self.quiz.available_till = add_to_date(now_datetime(), days=2)
		self.quiz.save()
		result = self._get(self.instructor.email)
		self.assertEqual(result["quiz"]["title"], self.quiz.title)
