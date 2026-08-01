import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime


class CourseSubscriptionRequest(Document):
	def before_insert(self):
		if not self.applicant:
			self.applicant = frappe.session.user
		if self.applicant and self.applicant != "Guest":
			user = frappe.db.get_value("User", self.applicant, ["full_name", "email"], as_dict=True)
			if user:
				self.applicant_name = self.applicant_name or user.full_name
				self.applicant_email = self.applicant_email or user.email

	def validate(self):
		if self.status == "Approved" and not self.reviewed_on:
			self.reviewed_on = now_datetime()
			self.reviewed_by = frappe.session.user
