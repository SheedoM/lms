"""Copy legacy code_lab authored data into native inline lesson snapshots.

This intentionally leaves the legacy DocTypes, attempts, submissions and rows
untouched. It never imports the optional ``code_lab`` app.
"""

from __future__ import annotations

import frappe

from lms.lms.coding_lab import append_linked_lab, migrate_link_blocks


def execute():
	if not frappe.db.exists("DocType", "Coding Lab"):
		return

	try:
		lesson_meta = frappe.get_meta("Course Lesson")
		if not lesson_meta.has_field("content"):
			return
		link_field = next(
			(
				field
				for field in ("coding_lab", "custom_coding_lab")
				if lesson_meta.has_field(field)
			),
			None,
		)
		fields = ["name", "content"] + ([link_field] if link_field else [])
		lessons = frappe.get_all("Course Lesson", fields=fields)
	except Exception:
		frappe.log_error(
			title="Coding Lab inline migration skipped",
			message=frappe.get_traceback(),
		)
		return

	cache = {}

	def lookup(lab_name):
		if lab_name not in cache:
			try:
				cache[lab_name] = frappe.get_doc("Coding Lab", lab_name).as_dict()
			except Exception:
				cache[lab_name] = None
		return cache[lab_name]

	for lesson in lessons:
		try:
			content, changed = migrate_link_blocks(lesson.get("content"), lookup)
			link_name = lesson.get(link_field) if link_field else None
			if link_name:
				content, appended = append_linked_lab(
					content, str(link_name), lookup(str(link_name))
				)
				changed = changed or appended
			if changed:
				frappe.db.set_value(
					"Course Lesson",
					lesson["name"],
					"content",
					content,
					update_modified=False,
				)
		except Exception:
			frappe.log_error(
				title=f"Coding Lab migration failed for {lesson.get('name')}",
				message=frappe.get_traceback(),
			)
