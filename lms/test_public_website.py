import frappe
from frappe.tests import UnitTestCase

from lms.public_website import (
	DEFAULT_SETTINGS,
	get_default_action_label,
	get_primary_action_url,
	serialize_offering,
	submit_subscription_request,
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
		self.assertTrue(get_primary_action_url(free).startswith("/signup?redirect-to="))
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
		file_doc = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": "test-payment-proof.png",
				"file_url": f"/private/files/test-payment-{frappe.generate_hash()}.png",
				"is_private": 1,
			}
		).insert(ignore_permissions=True)
		self.created.append(("File", file_doc.name))

		first = submit_subscription_request(
			offering.slug,
			"InstaPay",
			"01000000000",
			file_doc.file_url,
			"Test request",
		)
		self.created.append(("Course Subscription Request", first["name"]))
		second = submit_subscription_request(
			offering.slug,
			"InstaPay",
			"01000000000",
			file_doc.file_url,
			"Test request",
		)

		self.assertFalse(first["already_exists"])
		self.assertTrue(second["already_exists"])
		self.assertEqual(first["name"], second["name"])

	def test_non_paid_offering_rejects_payment_request(self):
		offering = self._create_offering("test-free-offering", "Free Enrollment", access_type="Free")
		with self.assertRaises(frappe.ValidationError):
			submit_subscription_request(
				offering.slug,
				"InstaPay",
				"01000000000",
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
