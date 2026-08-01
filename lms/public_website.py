from __future__ import annotations

import os
import re
from urllib.parse import quote

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import escape_html, flt, now_datetime

from lms.lms.utils import get_lms_route

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Plain files under lms/public/landing/ (landing.css, landing.js, auth.css,
# auth.js) aren't part of the esbuild bundle pipeline, so — unlike the
# content-hashed .bundle.*.js/css files — they never get a cache-busting
# filename. Browsers were caching them indefinitely across deploys, so every
# template that includes one appends ?v={{ landing_asset_version() }}.
_landing_asset_version = None


def landing_asset_version():
	global _landing_asset_version
	if _landing_asset_version is None:
		landing_dir = os.path.join(frappe.get_app_path("lms"), "public", "landing")
		try:
			mtimes = [
				os.path.getmtime(os.path.join(landing_dir, name))
				for name in os.listdir(landing_dir)
			]
			_landing_asset_version = str(int(max(mtimes))) if mtimes else "1"
		except OSError:
			_landing_asset_version = "1"
	return _landing_asset_version


DEFAULT_SETTINGS = frappe._dict(
	{
		"brand_name": "FaragallahTech",
		"site_title": "FaragallahTech | تعلم البرمجة عمليًا",
		"nav_home_label": "الرئيسية",
		"nav_courses_label": "الكورسات",
		"nav_lab_label": "جرب البرمجة",
		"nav_about_label": "عن المدرب",
		"nav_faq_label": "الأسئلة الشائعة",
		"login_button_label": "تسجيل الدخول",
		"signup_button_label": "حساب جديد",
		"hero_right_title": "تعلم عملي",
		"hero_right_text": "تطبيق من أول يوم ونتائج تقدر تشوفها",
		"hero_left_title": "مشاريع حقيقية",
		"hero_left_text": "مش كود وخلاص؛ مشاريع تضيفها لخبرتك",
		"hero_heading": "اتعلّم البرمجة عمليًا وابنِ مشاريع حقيقية",
		"hero_description": "محتوى منظم، تطبيق مستمر، ومشاريع تساعدك تحوّل اللي اتعلمته لحاجة حقيقية.",
		"hero_terminal_lines": "$ start_learning()\n> Learn\n> Practice\n> Build\n✓ Project ready",
		"hero_primary_label": "حساب جديد",
		"hero_secondary_label": "شوف الكورسات",
		"courses_heading": "الكورسات",
		"details_button_label": "تفاصيل الكورس",
		"free_button_label": "ابدأ مجانًا",
		"paid_button_label": "اشترك دلوقتي",
		"continue_button_label": "كمّل الكورس",
		"coming_soon_button_label": "قريبًا",
		"lab_heading": "جرب البرمجة",
		"lab_description": "اكتب الكود وشوف النتيجة مباشرة.",
		"python_starter_code": '# غيّر الاسم لاسمك وشوف النتيجة\nname = "Shady"\nprint(f"أهلًا يا {name} 👋")',
		"javascript_starter_code": "// غيّر الاسم لاسمك وشوف النتيجة\nconst name = \"Shady\";\nconsole.log(`أهلًا يا ${name} 👋`);",
		"about_heading": "مين المهندس",
		"instructor_name": "شادي فرج الله",
		"instructor_role": "مدرب برمجة و مهندس برمجيات",
		"about_text": "بساعد الطلاب يتعلموا البرمجة بالتطبيق والمشاريع، وبطوّر تجارب تعليمية تجمع بين الشرح الواضح والممارسة العملية.",
		"gallery_heading": "لقطات من جلسات أونلاين وأوفلاين",
		"partners_heading": "جهات وشركات تشرفت بالتعاون معها",
		"faq_heading": "الأسئلة الشائعة",
		"footer_text": "تعلم البرمجة بشكل عملي من خلال محتوى منظم ومشاريع حقيقية.",
		"social_heading": "تابعني",
	}
)


def get_public_settings():
	"""Return editable landing settings, with safe defaults before the first migration."""
	settings = frappe._dict(DEFAULT_SETTINGS.copy())
	if not frappe.db.exists("DocType", "Landing Page Settings"):
		settings.gallery_items = []
		settings.partners = []
		settings.faqs = []
		settings.payment_methods = []
		return settings

	try:
		doc = frappe.get_cached_doc("Landing Page Settings")
	except frappe.DoesNotExistError:
		settings.gallery_items = []
		settings.partners = []
		settings.faqs = []
		settings.payment_methods = []
		return settings

	for fieldname in DEFAULT_SETTINGS:
		value = doc.get(fieldname)
		if value not in (None, ""):
			settings[fieldname] = value

	for fieldname in (
		"logo",
		"hero_image",
		"instructor_image",
		"contact_email",
		"contact_phone",
		"facebook_url",
		"linkedin_url",
		"youtube_url",
		"instagram_url",
	):
		settings[fieldname] = doc.get(fieldname)

	settings.gallery_items = sorted(
		(doc.get("gallery_items") or []), key=lambda row: (row.display_order or 0, row.idx)
	)
	settings.partners = sorted(
		(doc.get("partners") or []), key=lambda row: (row.display_order or 0, row.idx)
	)
	settings.faqs = sorted((doc.get("faqs") or []), key=lambda row: (row.display_order or 0, row.idx))
	settings.payment_methods = sorted(
		(doc.get("payment_methods") or []), key=lambda row: (row.display_order or 0, row.idx)
	)
	return settings


def get_public_categories(settings=None):
	settings = settings or get_public_settings()
	if not frappe.db.table_exists("Course Offering Category"):
		return []

	categories = frappe.get_all(
		"Course Offering Category",
		filters={"published": 1},
		fields=[
			"name",
			"category_name",
			"slug",
			"display_order",
			"is_default",
			"empty_state_title",
			"empty_state_message",
		],
		order_by="display_order asc, creation asc",
	)

	for category in categories:
		category["offerings"] = get_public_offerings(category.name, settings)
	return categories


def get_public_offerings(category=None, settings=None):
	settings = settings or get_public_settings()
	if not frappe.db.table_exists("Course Offering"):
		return []

	filters = {"published": 1}
	if category:
		filters["category"] = category

	rows = frappe.get_all(
		"Course Offering",
		filters=filters,
		fields=[
			"name",
			"title",
			"slug",
			"category",
			"cover_image",
			"short_description",
			"access_type",
			"currency",
			"price",
			"original_price",
			"badge",
			"primary_action_type",
			"primary_button_label",
			"details_button_label",
			"external_url",
			"linked_lms_course",
			"linked_batch",
			"display_order",
			"featured",
		],
		order_by="featured desc, display_order asc, creation asc",
	)
	return [serialize_offering(row, settings) for row in rows]


def get_public_offering(slug, settings=None):
	if not slug or not frappe.db.table_exists("Course Offering"):
		return None
	name = frappe.db.get_value("Course Offering", {"slug": slug, "published": 1}, "name")
	if not name:
		return None
	settings = settings or get_public_settings()
	doc = frappe.get_doc("Course Offering", name)
	result = serialize_offering(doc.as_dict(), settings)
	result.category_label = (
		frappe.db.get_value("Course Offering Category", doc.category, "category_name") or doc.category
	)
	for fieldname in (
		"audience",
		"learning_outcomes",
		"course_content",
		"study_method",
		"included_items",
	):
		result[fieldname] = doc.get(fieldname)
	return result


def serialize_offering(offering, settings):
	offering = frappe._dict(offering)
	is_enrolled = _is_current_user_enrolled(offering.linked_lms_course)
	if is_enrolled:
		action_label = settings.continue_button_label
		action_url = f"/lms/courses/{quote(offering.linked_lms_course)}"
	else:
		action_label = offering.primary_button_label or get_default_action_label(offering, settings)
		action_url = get_primary_action_url(offering)

	return frappe._dict(
		{
			**offering,
			"price": flt(offering.price),
			"original_price": flt(offering.original_price),
			"details_label": offering.details_button_label or settings.details_button_label,
			"details_url": f"/courses/{quote(offering.slug)}",
			"action_label": action_label,
			"action_url": action_url,
			"action_disabled": offering.primary_action_type == "Coming Soon" and not is_enrolled,
			"is_enrolled": is_enrolled,
		}
	)


def get_default_action_label(offering, settings):
	if offering.primary_action_type == "Coming Soon" or offering.access_type == "Coming Soon":
		return settings.coming_soon_button_label
	if offering.access_type == "Free" or offering.primary_action_type == "Free Enrollment":
		return settings.free_button_label
	if offering.primary_action_type == "Open LMS Course":
		return settings.continue_button_label
	return settings.paid_button_label


def get_primary_action_url(offering):
	if offering.primary_action_type == "External Link":
		return offering.external_url or "#"
	if offering.primary_action_type == "Open LMS Course" and offering.linked_lms_course:
		return f"/lms/courses/{quote(offering.linked_lms_course)}"
	if offering.primary_action_type == "Coming Soon":
		return "#"
	if offering.primary_action_type == "Free Enrollment":
		return f"/enroll/{quote(offering.slug)}"
	return f"/subscribe/{quote(offering.slug)}"


def _is_current_user_enrolled(course_name):
	return bool(
		course_name
		and frappe.session.user != "Guest"
		and frappe.db.table_exists("LMS Enrollment")
		and frappe.db.exists(
			"LMS Enrollment", {"member": frappe.session.user, "course": course_name}
		)
	)


def apply_common_context(context):
	context.no_cache = 1
	context.no_breadcrumbs = True
	context.hide_login = True
	context.settings = get_public_settings()
	context.is_guest = frappe.session.user == "Guest"
	context.current_year = now_datetime().year
	context.csrf_token = frappe.session.csrf_token
	return context


def get_home_context(context):
	apply_common_context(context)
	context.categories = get_public_categories(context.settings)
	context.default_category = next(
		(category.slug for category in context.categories if category.is_default),
		context.categories[0].slug if context.categories else None,
	)
	return context


def get_course_context(context, slug):
	apply_common_context(context)
	context.offering = get_public_offering(slug, context.settings)
	if not context.offering:
		raise frappe.DoesNotExistError(_("Course not found"))
	context.page_title = context.offering.title
	return context


def get_subscription_context(context, slug):
	apply_common_context(context)
	context.offering = get_public_offering(slug, context.settings)
	if not context.offering:
		raise frappe.DoesNotExistError(_("Course not found"))
	if context.offering.primary_action_type != "Paid Subscription":
		frappe.throw(_("This course does not accept paid subscription requests."))

	if frappe.session.user == "Guest":
		_redirect_to_auth(f"/subscribe/{slug}")

	context.existing_request = None
	if frappe.db.table_exists("Course Subscription Request"):
		context.existing_request = frappe.db.get_value(
			"Course Subscription Request",
			{
				"offering": context.offering.name,
				"applicant": frappe.session.user,
				"status": "Pending Review",
			},
			["name", "status", "creation"],
			as_dict=True,
		)
	return context


def enroll_in_free_offering(slug):
	offering = get_public_offering(slug)
	if not offering:
		raise frappe.DoesNotExistError(_("Course not found"))
	if offering.primary_action_type != "Free Enrollment" or offering.access_type != "Free":
		frappe.throw(_("This course is not available for free enrollment."))
	if not offering.linked_lms_course:
		frappe.throw(_("This course has not been linked to LMS content yet."))
	if frappe.session.user == "Guest":
		_redirect_to_auth(f"/enroll/{slug}", signup=True)

	enrollment_name = frappe.db.get_value(
		"LMS Enrollment",
		{"member": frappe.session.user, "course": offering.linked_lms_course},
		"name",
	)
	if not enrollment_name:
		enrollment = frappe.new_doc("LMS Enrollment")
		enrollment.member = frappe.session.user
		enrollment.course = offering.linked_lms_course
		enrollment.member_type = "Student"
		enrollment.role = "Member"
		enrollment.insert(ignore_permissions=True)

	frappe.local.flags.redirect_location = f"/lms/courses/{quote(offering.linked_lms_course)}"
	raise frappe.Redirect


def _redirect_to_auth(destination, signup=False):
	redirect_to = quote(destination, safe="")
	path = "/signup" if signup else "/login"
	frappe.local.flags.redirect_location = f"{path}?redirect-to={redirect_to}"
	raise frappe.Redirect


@frappe.whitelist()
def submit_subscription_request(
	offering_slug: str,
	payment_method: str,
	sender_phone: str,
	payment_screenshot: str,
	notes: str | None = None,
):
	if frappe.session.user == "Guest":
		frappe.throw(_("Please log in first."), frappe.PermissionError)

	offering = frappe.db.get_value(
		"Course Offering",
		{"slug": offering_slug, "published": 1},
		["name", "primary_action_type"],
		as_dict=True,
	)
	if not offering:
		frappe.throw(_("Course not found."))
	if offering.primary_action_type != "Paid Subscription":
		frappe.throw(_("This course does not accept paid subscription requests."))

	payment_method = (payment_method or "").strip()
	sender_phone = (sender_phone or "").strip()
	payment_screenshot = (payment_screenshot or "").strip()
	if not payment_method or not sender_phone or not payment_screenshot:
		frappe.throw(_("Please complete the required payment details."))

	# Only enforce this once at least one method is configured, so a fresh
	# site with an empty list doesn't lock every request out.
	configured_methods = frappe.get_all(
		"Landing Payment Method",
		filters={"parenttype": "Landing Page Settings", "parent": "Landing Page Settings"},
		pluck="method_name",
	)
	if configured_methods and payment_method not in configured_methods:
		frappe.throw(_("Please choose a valid payment method."))
	if not payment_screenshot.startswith(("/files/", "/private/files/")):
		frappe.throw(_("Invalid payment screenshot."))
	if not frappe.db.exists(
		"File", {"file_url": payment_screenshot, "owner": frappe.session.user, "is_private": 1}
	):
		frappe.throw(_("The payment screenshot could not be verified."))

	existing = frappe.db.get_value(
		"Course Subscription Request",
		{
			"offering": offering.name,
			"applicant": frappe.session.user,
			"status": "Pending Review",
		},
		"name",
	)
	if existing:
		return {"name": existing, "already_exists": True}

	doc = frappe.new_doc("Course Subscription Request")
	doc.offering = offering.name
	doc.applicant = frappe.session.user
	doc.payment_method = payment_method
	doc.sender_phone = sender_phone
	doc.payment_screenshot = payment_screenshot
	doc.notes = (notes or "").strip()
	doc.insert(ignore_permissions=True)
	frappe.db.set_value(
		"File",
		{"file_url": payment_screenshot, "owner": frappe.session.user},
		{
			"attached_to_doctype": "Course Subscription Request",
			"attached_to_name": doc.name,
			"attached_to_field": "payment_screenshot",
		},
		update_modified=False,
	)
	return {"name": doc.name, "already_exists": False}


def safe_local_redirect(redirect_to: str | None) -> str | None:
	"""Only allow same-site, relative paths.

	Used for every post-auth redirect on the public site (signup, login) so a
	crafted ``redirect-to`` value can never send a visitor off-site.
	"""
	if not redirect_to:
		return None
	redirect_to = redirect_to.strip()
	if not redirect_to.startswith("/") or redirect_to.startswith("//"):
		return None
	if any(ch in redirect_to for ch in ("\\", "\n", "\r")):
		return None
	if "://" in redirect_to:
		return None
	return redirect_to


@frappe.whitelist(allow_guest=True, methods=["POST"])
@rate_limit(limit=10, seconds=60 * 60)
def public_signup(
	full_name: str,
	email: str,
	password: str,
	confirm_password: str,
	redirect_to: str | None = None,
):
	"""Direct, immediate self-service signup for the public site.

	Unlike the framework's default signup flow (``lms.lms.user.sign_up``),
	this sets the password the visitor chose (not a random one), needs no
	admin approval or outgoing email, and logs the visitor in right away.
	The "LMS Student" role is added automatically by the existing
	``add_lms_student_role`` hook on ``User.before_insert`` — nothing here
	grants Desk, Moderator, Instructor or System Manager access.
	"""
	if frappe.session.user != "Guest":
		frappe.throw(_("You are already logged in."))

	full_name = (full_name or "").strip()
	email = (email or "").strip().lower()
	password = password or ""
	confirm_password = confirm_password or ""

	if not full_name:
		frappe.throw(_("Please enter your full name."))
	if not email or not EMAIL_RE.match(email):
		frappe.throw(_("Please enter a valid email address."))
	if not password:
		frappe.throw(_("Please enter a password."))
	if password != confirm_password:
		frappe.throw(_("Passwords do not match."))

	if frappe.db.exists("User", email):
		frappe.throw(_("An account with this email already exists. Please log in instead."))

	try:
		user = frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": escape_html(full_name),
				"enabled": 1,
				"new_password": password,
				"user_type": "Website User",
				"send_welcome_email": 0,
			}
		)
		user.flags.ignore_permissions = True
		# Password strength is still enforced (System Settings policy) —
		# only the random-password + email-verification detour is skipped.
		user.insert()
	except frappe.DuplicateEntryError:
		frappe.throw(_("An account with this email already exists. Please log in instead."))

	frappe.db.commit()
	if hasattr(frappe.local, "login_manager"):
		# Real request: run the framework's full login lifecycle (session,
		# cookies, on_login hooks) so the browser ends up properly signed in.
		frappe.local.login_manager.login_as(user.name)
	else:
		# No request-bound LoginManager (e.g. called directly from a unit
		# test or the console) — just switch the session user.
		frappe.set_user(user.name)

	return {"redirect_to": safe_local_redirect(redirect_to) or get_lms_route()}
