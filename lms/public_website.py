from __future__ import annotations

from urllib.parse import quote

import frappe
from frappe import _
from frappe.utils import flt, now_datetime


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
		"hero_heading": "تعلم البرمجة عمليًا من خلال مشاريع حقيقية وابدأ رحلتك في بناء المستقبل",
		"hero_description": "محتوى منظم، تطبيق مستمر، ومشاريع تساعدك تحوّل اللي اتعلمته لحاجة حقيقية.",
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
		"python_starter_code": "name = 'FaragallahTech'\nprint(f'أهلًا يا {name} 👋')",
		"javascript_starter_code": "const name = 'FaragallahTech';\nconsole.log(`أهلًا يا ${name} 👋`);",
		"about_heading": "عن المدرب",
		"instructor_name": "شادي فرج الله",
		"instructor_role": "مدرب برمجة ومطور مناهج",
		"about_text": "بساعد الطلاب يتعلموا البرمجة بالتطبيق والمشاريع، وبطوّر تجارب تعليمية تجمع بين الشرح الواضح والممارسة العملية.",
		"gallery_heading": "لقطات من جلسات أونلاين وأوفلاين",
		"partners_heading": "جهات وبرامج تشرفت بالتعاون معها",
		"faq_heading": "الأسئلة الشائعة",
		"footer_text": "تعلم البرمجة بشكل عملي من خلال محتوى منظم ومشاريع حقيقية.",
	}
)


def get_public_settings():
	"""Return editable landing settings, with safe defaults before the first migration."""
	settings = frappe._dict(DEFAULT_SETTINGS.copy())
	if not frappe.db.table_exists("Landing Page Settings"):
		settings.gallery_items = []
		settings.partners = []
		settings.faqs = []
		return settings

	try:
		doc = frappe.get_cached_doc("Landing Page Settings")
	except frappe.DoesNotExistError:
		settings.gallery_items = []
		settings.partners = []
		settings.faqs = []
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
	context.csrf_token = frappe.sessions.get_csrf_token()
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
	return {"name": doc.name, "already_exists": False}
