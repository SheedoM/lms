import frappe
from frappe.model.document import Document
from frappe.utils import cint


class CourseOfferingCategory(Document):
	def validate(self):
		self.slug = (self.slug or "").strip().lower().replace(" ", "-")
		self.is_default = cint(self.is_default)
		self.published = cint(self.published)

		if self.is_default:
			frappe.db.set_value(
				"Course Offering Category",
				{"name": ["!=", self.name], "is_default": 1},
				"is_default",
				0,
				update_modified=False,
			)
