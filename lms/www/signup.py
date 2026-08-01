from urllib.parse import quote

import frappe


def get_context(context):
	redirect_to = (frappe.form_dict.get("redirect-to") or "").strip()
	if redirect_to and not redirect_to.startswith("/"):
		redirect_to = ""

	location = "/login"
	if redirect_to:
		location += f"?redirect-to={quote(redirect_to, safe='')}"
	location += "#signup"

	frappe.local.flags.redirect_location = location
	raise frappe.Redirect
