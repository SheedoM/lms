import frappe

from lms.public_website import get_subscription_context


def get_context(context):
	return get_subscription_context(context, frappe.form_dict.slug)
