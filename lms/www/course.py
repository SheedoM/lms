import frappe

from lms.public_website import get_course_context


def get_context(context):
	return get_course_context(context, frappe.form_dict.slug)
