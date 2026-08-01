import frappe

from lms.public_website import enroll_in_free_offering


def get_context(context):
	return enroll_in_free_offering(frappe.form_dict.slug)
