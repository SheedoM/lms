import frappe

from lms.lms.utils import get_lms_route
from lms.public_website import get_public_settings, safe_local_redirect

no_cache = 1


def get_context(context):
	redirect_to = safe_local_redirect(frappe.form_dict.get("redirect-to"))

	if frappe.session.user != "Guest":
		frappe.local.flags.redirect_location = redirect_to or get_lms_route()
		raise frappe.Redirect

	context.no_cache = 1
	context.no_breadcrumbs = True
	context.hide_login = True
	context.settings = get_public_settings()
	context.redirect_to = redirect_to or ""
	context.csrf_token = frappe.session.csrf_token
	return context
