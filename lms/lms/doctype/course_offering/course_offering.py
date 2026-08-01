import frappe
from frappe.model.document import Document
from frappe.utils import cint


class CourseOffering(Document):
	def validate(self):
		self.slug = (self.slug or "").strip().lower().replace(" ", "-")
		self.published = cint(self.published)

		if self.access_type == "Free":
			self.price = 0

		if self.primary_action_type == "Free Enrollment":
			if self.access_type != "Free":
				frappe.throw("Free Enrollment requires Access Type to be Free.")
			if not self.linked_lms_course:
				frappe.throw("Linked LMS Course is required for Free Enrollment.")

		if self.primary_action_type == "Paid Subscription" and self.access_type != "Paid":
			frappe.throw("Paid Subscription requires Access Type to be Paid.")

		if self.primary_action_type == "Open LMS Course" and not self.linked_lms_course:
			frappe.throw("Linked LMS Course is required for the Open LMS Course action.")

		if self.primary_action_type == "External Link" and not self.external_url:
			frappe.throw("External URL is required for the External Link action.")

		if self.primary_action_type == "Coming Soon":
			self.access_type = "Coming Soon"
