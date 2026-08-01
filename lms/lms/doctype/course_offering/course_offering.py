import frappe
from frappe.model.document import Document
from frappe.utils import cint


class CourseOffering(Document):
	def validate(self):
		self.slug = (self.slug or "").strip().lower().replace(" ", "-")
		if self.access_type == "Free":
			self.price = 0

		if self.primary_action_type == "Open LMS Course" and not self.linked_lms_course:
			frappe.throw("Linked LMS Course is required for the Open LMS Course action.")

		if self.primary_action_type == "External Link" and not self.external_url:
			frappe.throw("External URL is required for the External Link action.")

		self.published = cint(self.published)
