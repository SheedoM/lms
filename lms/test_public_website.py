import base64

import frappe
from frappe.tests import UnitTestCase
from frappe.utils.file_manager import save_file

from lms.public_website import (
	DEFAULT_SETTINGS,
	get_course_context,
	get_default_action_label,
	get_primary_action_url,
	get_public_settings,
	public_signup,
	safe_local_redirect,
	serialize_offering,
	submit_subscription_request,
)
from lms.www._lms import get_context as lms_get_context
from lms.www.login import get_context as login_get_context
from lms.www.signup import get_context as signup_get_context

# 1x1 transparent PNG, used as real file bytes for upload-backed tests.
TEST_PNG_BYTES = base64.b64decode(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


class TestPublicLearningWebsite(UnitTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self.created = []
		self.category = self._create_category()

	def tearDown(self):
		for doctype, name in reversed(self.created):
			if frappe.db.exists(doctype, name):
				frappe.delete_doc(doctype, name, force=True)
		frappe.set_user("Administrator")

	def test_action_labels_and_urls_are_data_driven(self):
		settings = frappe._dict(DEFAULT_SETTINGS.copy())
		free = frappe._dict(
			{
				"slug": "free-course",
				"access_type": "Free",
				"primary_action_type": "Free Enrollment",
				"linked_lms_course": None,
				"external_url": None,
			}
		)
		paid = frappe._dict(
			{
				"slug": "paid-course",
				"access_type": "Paid",
				"primary_action_type": "Paid Subscription",
				"linked_lms_course": None,
				"external_url": None,
			}
		)
		coming_soon = frappe._dict(
			{
				"slug": "future-course",
				"access_type": "Coming Soon",
				"primary_action_type": "Coming Soon",
				"linked_lms_course": None,
				"external_url": None,
			}
		)

		self.assertEqual(get_default_action_label(free, settings), "ابدأ مجانًا")
		self.assertEqual(get_primary_action_url(free), "/enroll/free-course")
		self.assertEqual(get_default_action_label(paid, settings), "اشترك دلوقتي")
		self.assertEqual(get_primary_action_url(paid), "/subscribe/paid-course")
		self.assertEqual(get_default_action_label(coming_soon, settings), "قريبًا")
		self.assertEqual(get_primary_action_url(coming_soon), "#")

	def test_custom_button_labels_override_global_labels(self):
		settings = frappe._dict(DEFAULT_SETTINGS.copy())
		offering = frappe._dict(
			{
				"name": "custom-label-course",
				"title": "Custom Label Course",
				"slug": "custom-label-course",
				"category": self.category.name,
				"cover_image": None,
				"short_description": None,
				"access_type": "Paid",
				"currency": "EGP",
				"price": 100,
				"original_price": 0,
				"badge": None,
				"primary_action_type": "Paid Subscription",
				"primary_button_label": "سجّل في البرنامج",
				"details_button_label": "اعرف تفاصيل البرنامج",
				"external_url": None,
				"linked_lms_course": None,
				"linked_batch": None,
				"display_order": 1,
				"featured": 0,
			}
		)

		result = serialize_offering(offering, settings)
		self.assertEqual(result.action_label, "سجّل في البرنامج")
		self.assertEqual(result.details_label, "اعرف تفاصيل البرنامج")

	def test_paid_subscription_request_is_created_once(self):
		offering = self._create_offering("test-paid-offering", "Paid Subscription")
		file_doc = save_file(
			"test-payment-proof.png",
			TEST_PNG_BYTES,
			None,
			None,
			is_private=1,
		)
		self.created.append(("File", file_doc.name))

		first = submit_subscription_request(
			offering.slug,
			"InstaPay",
			"01000000000",
			"01100000000",
			file_doc.file_url,
			"Test request",
		)
		self.created.append(("Course Subscription Request", first["name"]))
		second = submit_subscription_request(
			offering.slug,
			"InstaPay",
			"01000000000",
			"01100000000",
			file_doc.file_url,
			"Test request",
		)

		self.assertFalse(first["already_exists"])
		self.assertTrue(second["already_exists"])
		self.assertEqual(first["name"], second["name"])

	def test_non_paid_offering_rejects_payment_request(self):
		offering = self._create_offering(
			"test-coming-soon-offering", "Coming Soon", access_type="Coming Soon"
		)
		with self.assertRaises(frappe.ValidationError):
			submit_subscription_request(
				offering.slug,
				"InstaPay",
				"01000000000",
				"01100000000",
				"/private/files/not-used.png",
			)

	def _create_category(self):
		slug = f"test-category-{frappe.generate_hash(length=6)}"
		doc = frappe.get_doc(
			{
				"doctype": "Course Offering Category",
				"category_name": "Test Category",
				"slug": slug,
				"display_order": 99,
				"published": 1,
			}
		).insert(ignore_permissions=True)
		self.created.append((doc.doctype, doc.name))
		return doc

	def _create_offering(self, slug, action_type, access_type="Paid"):
		doc = frappe.get_doc(
			{
				"doctype": "Course Offering",
				"title": slug.replace("-", " ").title(),
				"slug": f"{slug}-{frappe.generate_hash(length=6)}",
				"category": self.category.name,
				"access_type": access_type,
				"primary_action_type": action_type,
				"published": 1,
			}
		).insert(ignore_permissions=True)
		self.created.append((doc.doctype, doc.name))
		return doc


class TestLmsAccessAndSignup(UnitTestCase):
	"""Phase 1/2 coverage: the entire LMS app must be Guest-proof, and the
	direct signup flow must create a real, immediately-usable account
	without ever touching Desk/System Manager territory."""

	def setUp(self):
		frappe.set_user("Administrator")
		self.created = []
		self.category = frappe.get_doc(
			{
				"doctype": "Course Offering Category",
				"category_name": "Test Category",
				"slug": f"test-category-{frappe.generate_hash(length=6)}",
				"display_order": 99,
				"published": 1,
			}
		).insert(ignore_permissions=True)
		self.created.append((self.category.doctype, self.category.name))

	def tearDown(self):
		frappe.set_user("Administrator")
		for doctype, name in reversed(self.created):
			if frappe.db.exists(doctype, name):
				frappe.delete_doc(doctype, name, force=True, ignore_permissions=True)
		frappe.form_dict.pop("app_path", None)
		frappe.form_dict.pop("redirect-to", None)

	# -- Phase 1: the whole LMS app is private -----------------------------

	def test_guest_visiting_lms_root_is_redirected_to_login(self):
		frappe.set_user("Guest")
		with self.assertRaises(frappe.Redirect):
			lms_get_context()
		self.assertEqual(frappe.local.flags.redirect_location, "/login?redirect-to=%2Flms")

	def test_guest_visiting_lms_subpath_is_redirected_with_that_path_preserved(self):
		frappe.set_user("Guest")
		frappe.form_dict["app_path"] = "courses"
		with self.assertRaises(frappe.Redirect):
			lms_get_context()
		self.assertEqual(
			frappe.local.flags.redirect_location, "/login?redirect-to=%2Flms%2Fcourses"
		)

	def test_authenticated_user_can_access_lms(self):
		frappe.set_user("Administrator")
		# get_context() raises frappe.Redirect for a Guest (see the tests
		# above); reaching this line without one is the pass condition.
		context = lms_get_context()
		self.assertIsNotNone(context)
		self.assertIn("boot", context)

	def test_login_page_preserves_redirect_to_from_lms_guard(self):
		frappe.set_user("Guest")
		frappe.form_dict["redirect-to"] = "/lms/coding-lab"
		context = login_get_context(frappe._dict())
		self.assertEqual(context.redirect_to, "/lms/coding-lab")

	def test_login_and_signup_pages_redirect_already_authenticated_users_to_lms(self):
		frappe.set_user("Administrator")
		with self.assertRaises(frappe.Redirect):
			login_get_context(frappe._dict())
		self.assertEqual(frappe.local.flags.redirect_location, "/lms")

		with self.assertRaises(frappe.Redirect):
			signup_get_context(frappe._dict())
		self.assertEqual(frappe.local.flags.redirect_location, "/lms")

	def test_guest_can_still_view_public_course_details(self):
		offering = self._create_offering("test-guest-visible")
		frappe.set_user("Guest")
		context = get_course_context(frappe._dict(), offering.slug)
		self.assertEqual(context.offering.slug, offering.slug)

	def _create_offering(self, slug):
		doc = frappe.get_doc(
			{
				"doctype": "Course Offering",
				"title": slug.replace("-", " ").title(),
				"slug": f"{slug}-{frappe.generate_hash(length=6)}",
				"category": self.category.name,
				"access_type": "Paid",
				"primary_action_type": "Paid Subscription",
				"published": 1,
			}
		).insert(ignore_permissions=True)
		self.created.append((doc.doctype, doc.name))
		return doc

	def test_course_card_links_never_point_a_guest_straight_into_lms(self):
		settings = frappe._dict(DEFAULT_SETTINGS.copy())
		offering = frappe._dict(
			{
				"slug": "guest-safe-course",
				"access_type": "Paid",
				"primary_action_type": "Paid Subscription",
				"linked_lms_course": "some-lms-course",
				"external_url": None,
			}
		)
		result = serialize_offering(offering, settings)
		self.assertTrue(result.details_url.startswith("/courses/"))
		self.assertNotIn("/lms", result.details_url)

	# -- Phase 2: direct self-service signup --------------------------------

	def test_signup_creates_enabled_website_user_with_only_the_student_role(self):
		frappe.set_user("Guest")
		email = f"test-signup-{frappe.generate_hash(length=6)}@example.com"
		public_signup("Test Signup User", email, "Str0ng!Passw0rd", "Str0ng!Passw0rd", "01012345678")
		self.created.append(("User", email))

		frappe.set_user("Administrator")
		user = frappe.get_doc("User", email)
		self.assertEqual(user.enabled, 1)
		self.assertEqual(user.user_type, "Website User")
		roles = sorted(row.role for row in user.roles)
		self.assertEqual(roles, ["LMS Student"])

	def test_signup_logs_the_new_user_in_immediately(self):
		frappe.set_user("Guest")
		email = f"test-autologin-{frappe.generate_hash(length=6)}@example.com"
		public_signup("Auto Login", email, "Str0ng!Passw0rd", "Str0ng!Passw0rd", "01012345678")
		self.created.append(("User", email))
		self.assertEqual(frappe.session.user, email)

	def test_signup_rejects_duplicate_email(self):
		frappe.set_user("Guest")
		email = f"test-dup-{frappe.generate_hash(length=6)}@example.com"
		public_signup("First Signup", email, "Str0ng!Passw0rd", "Str0ng!Passw0rd", "01012345678")
		self.created.append(("User", email))

		frappe.set_user("Guest")
		with self.assertRaises(frappe.ValidationError):
			public_signup("Second Signup", email, "Str0ng!Passw0rd", "Str0ng!Passw0rd", "01012345678")

	def test_signup_rejects_mismatched_passwords(self):
		frappe.set_user("Guest")
		email = f"test-mismatch-{frappe.generate_hash(length=6)}@example.com"
		with self.assertRaises(frappe.ValidationError):
			public_signup("Mismatch", email, "Str0ng!Passw0rd", "SomethingElse!1", "01012345678")
		self.assertFalse(frappe.db.exists("User", email))

	def test_signup_honors_safe_redirect_to(self):
		frappe.set_user("Guest")
		email = f"test-saferedirect-{frappe.generate_hash(length=6)}@example.com"
		result = public_signup(
			"Safe Redirect",
			email,
			"Str0ng!Passw0rd",
			"Str0ng!Passw0rd",
			"01012345678",
			redirect_to="/subscribe/code-plus-plus",
		)
		self.created.append(("User", email))
		self.assertEqual(result["redirect_to"], "/subscribe/code-plus-plus")

	def test_signup_rejects_external_redirect_to(self):
		frappe.set_user("Guest")
		email = f"test-extredirect-{frappe.generate_hash(length=6)}@example.com"
		result = public_signup(
			"External Redirect",
			email,
			"Str0ng!Passw0rd",
			"Str0ng!Passw0rd",
			"01012345678",
			redirect_to="https://evil.example.com/phish",
		)
		self.created.append(("User", email))
		self.assertEqual(result["redirect_to"], "/lms")

	def test_safe_local_redirect_accepts_only_same_site_paths(self):
		self.assertEqual(safe_local_redirect("/subscribe/code-plus-plus"), "/subscribe/code-plus-plus")
		self.assertIsNone(safe_local_redirect("https://evil.example.com"))
		self.assertIsNone(safe_local_redirect("//evil.example.com"))
		self.assertIsNone(safe_local_redirect("evil.example.com"))
		self.assertIsNone(safe_local_redirect("/\\evil.example.com"))
		self.assertIsNone(safe_local_redirect(None))
		self.assertIsNone(safe_local_redirect(""))

	# -- Phase 6: settings stay data-driven ---------------------------------

	def test_public_settings_expose_social_links_and_new_editable_fields(self):
		settings = get_public_settings()
		for fieldname in (
			"facebook_url",
			"linkedin_url",
			"youtube_url",
			"instagram_url",
			"hero_terminal_lines",
			"social_heading",
		):
			self.assertIn(fieldname, settings)
