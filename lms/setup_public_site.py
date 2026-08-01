from __future__ import annotations

from pathlib import Path

import frappe
from frappe.utils.file_manager import save_file


CATEGORY_DEFAULTS = [
	{
		"category_name": "تانية بكالوريا",
		"slug": "second-baccalaureate",
		"display_order": 1,
		"is_default": 0,
	},
	{
		"category_name": "أولى بكالوريا",
		"slug": "first-baccalaureate",
		"display_order": 2,
		"is_default": 0,
	},
	{
		"category_name": "كورسات",
		"slug": "courses",
		"display_order": 3,
		"is_default": 1,
	},
]

FAQ_DEFAULTS = [
	{
		"question": "هل الكورسات مناسبة للمبتدئين؟",
		"answer": "<p>كل كورس بيوضح المستوى المطلوب والمتطلبات السابقة في صفحة التفاصيل. الكورسات المناسبة للمبتدئين بتبدأ معاك خطوة بخطوة.</p>",
		"display_order": 1,
	},
	{
		"question": "هل المحتوى عملي؟",
		"answer": "<p>أيوه. الشرح مرتبط بتطبيقات وتمارين ومشاريع تساعدك تستخدم اللي اتعلمته بشكل فعلي، مش مجرد متابعة محتوى نظري.</p>",
		"display_order": 2,
	},
	{
		"question": "إيه الجهاز المطلوب للدراسة؟",
		"answer": "<p>متطلبات الجهاز بتختلف حسب الكورس، وهتلاقي التفاصيل واضحة قبل الاشتراك. أجزاء من المحتوى ممكن تتتابع من الموبايل، بينما التطبيق العملي بيكون أفضل على الكمبيوتر.</p>",
		"display_order": 3,
	},
	{
		"question": "إزاي أشترك في كورس؟",
		"answer": "<p>اختار الكورس واضغط «اشترك دلوقتي»، وبعد تسجيل الدخول ارفع بيانات التحويل وإثبات الدفع. هيتم تفعيل الكورس على حسابك بعد المراجعة.</p>",
		"display_order": 4,
	},
]


MEDIA_CANDIDATES = {
	"logo": ["FaragallahTech logo(3).png", "faragallahtech-logo.png", "logo.png"],
	"hero": ["My Image.png", "hero.png", "hero.webp"],
	"about": ["About me.jpg", "about.jpg", "about.webp"],
	"offline_1": ["Offline_Sessions (3).jpg", "session-offline-1.jpg", "session-offline-1.webp"],
	"offline_2": ["Offline_Sessions (2).jpg", "session-offline-2.jpg", "session-offline-2.webp"],
	"online_1": ["image(9).png", "session-online-1.png", "session-online-1.webp"],
	"online_2": ["image(10).png", "session-online-2.png", "session-online-2.webp"],
	"partner_isky": ["iskytech.png", "partner-isky.png", "partner-isky.webp"],
	"partner_ai_school": ["ai school.png", "partner-ai-school.png", "partner-ai-school.webp"],
	"partner_ischool": ["ischool.png", "partner-ischool.png", "partner-ischool.webp"],
	"partner_mcit": ["image(8).png", "partner-mcit.png", "partner-mcit.webp"],
	"code_plus_plus": ["Ad design with sky blue shirt.png", "course-code-plus-plus.png", "course-code-plus-plus.webp"],
}


def seed_public_site_defaults():
	"""Create editable starter records without overwriting later admin edits."""
	if not frappe.db.table_exists("Course Offering Category"):
		return

	for values in CATEGORY_DEFAULTS:
		if frappe.db.exists("Course Offering Category", values["slug"]):
			continue
		doc = frappe.new_doc("Course Offering Category")
		doc.update(
			{
				**values,
				"published": 1,
				"empty_state_title": "لا توجد كورسات متاحة في هذا القسم حاليًا",
				"empty_state_message": "سيتم نشر محتوى جديد قريبًا.",
			}
		)
		doc.insert(ignore_permissions=True)

	settings = frappe.get_single("Landing Page Settings")
	if not settings.faqs:
		for item in FAQ_DEFAULTS:
			settings.append("faqs", item)
		settings.save(ignore_permissions=True)

	if not frappe.db.exists("Course Offering", "code-plus-plus"):
		offering = frappe.new_doc("Course Offering")
		offering.update(
			{
				"title": "Code++",
				"slug": "code-plus-plus",
				"category": "courses",
				"short_description": "برنامج عملي متكامل لتعليم البرمجة والذكاء الاصطناعي من خلال تطبيقات ومشاريع.",
				"access_type": "Paid",
				"currency": "EGP",
				"price": 0,
				"badge": "برنامج عملي",
				"primary_action_type": "Paid Subscription",
				"display_order": 1,
				"featured": 1,
				"published": 1,
				"audience": "<ul><li>مناسب للطلاب من 9 إلى 18 سنة.</li><li>لا يحتاج خبرة برمجية سابقة.</li><li>مناسب للي عايز يتعلم بالتطبيق بدل الحفظ النظري.</li></ul>",
				"learning_outcomes": "<ul><li>فهم أساسيات التفكير البرمجي وكتابة خطوات الحل.</li><li>استخدام المتغيرات والقوائم والشروط والتكرار في تطبيقات عملية.</li><li>بناء مشاريع تجمع بين البرمجة وأدوات الذكاء الاصطناعي.</li><li>التدرب على اكتشاف الأخطاء وتحسين المشروع خطوة بخطوة.</li></ul>",
				"course_content": "<p>البرنامج بيتدرج من أساسيات الخوارزميات والتطبيق البرمجي، لحد بناء مشروع متكامل يستخدم الصوت والتفاعل وبعض تطبيقات الذكاء الاصطناعي.</p>",
				"study_method": "<ul><li>شرح منظم ومختصر.</li><li>تطبيق داخل كل جزء.</li><li>تدريبات ومشاريع مرتبطة بالمحتوى.</li><li>متابعة تدريجية لحد المشروع النهائي.</li></ul>",
				"included_items": "<ul><li>محتوى تعليمي منظم.</li><li>تدريبات وتطبيقات عملية.</li><li>مشروع نهائي متكامل.</li><li>متابعة للتقدم داخل المنصة.</li></ul>",
			}
		)
		offering.insert(ignore_permissions=True)

	frappe.db.commit()


def import_public_site_media(asset_directory: str):
	"""Attach the supplied brand/course/session media to editable Frappe records.

	Copy the original files into one directory on the server, then run:
	bench --site <site> execute lms.setup_public_site.import_public_site_media --kwargs '{"asset_directory":"/path"}'
	"""
	asset_path = Path(asset_directory).expanduser().resolve()
	if not asset_path.is_dir():
		frappe.throw(f"Asset directory does not exist: {asset_path}")

	seed_public_site_defaults()
	resolved = {key: _find_asset(asset_path, names) for key, names in MEDIA_CANDIDATES.items()}
	missing = [key for key, path in resolved.items() if not path]
	if missing:
		frappe.throw(f"Missing public-site media files: {', '.join(missing)}")

	settings = frappe.get_single("Landing Page Settings")
	settings.logo = _save_public_file(resolved["logo"], "Landing Page Settings", settings.name)
	settings.hero_image = _save_public_file(resolved["hero"], "Landing Page Settings", settings.name)
	settings.instructor_image = _save_public_file(resolved["about"], "Landing Page Settings", settings.name)

	settings.set("gallery_items", [])
	for idx, (key, caption, session_type) in enumerate(
		[
			("offline_1", "جلسة تطبيق عملي", "Offline"),
			("offline_2", "لقطة من جلسة أوفلاين", "Offline"),
			("online_1", "جلسة أونلاين", "Online"),
			("online_2", "متابعة الطلاب أونلاين", "Online"),
		],
		start=1,
	):
		settings.append(
			"gallery_items",
			{
				"image": _save_public_file(resolved[key], "Landing Page Settings", settings.name),
				"caption": caption,
				"session_type": session_type,
				"display_order": idx,
			},
		)

	settings.set("partners", [])
	for idx, (key, name) in enumerate(
		[
			("partner_isky", "ISKY Tech"),
			("partner_ai_school", "AI School"),
			("partner_ischool", "iSchool"),
			("partner_mcit", "وزارة الاتصالات وتكنولوجيا المعلومات"),
		],
		start=1,
	):
		settings.append(
			"partners",
			{
				"organization_name": name,
				"logo": _save_public_file(resolved[key], "Landing Page Settings", settings.name),
				"display_order": idx,
			},
		)
	settings.save(ignore_permissions=True)

	offering = frappe.get_doc("Course Offering", "code-plus-plus")
	offering.cover_image = _save_public_file(resolved["code_plus_plus"], "Course Offering", offering.name)
	offering.save(ignore_permissions=True)
	frappe.clear_cache()
	frappe.db.commit()

	return {
		"settings": settings.name,
		"offering": offering.name,
		"gallery_items": len(settings.gallery_items),
		"partners": len(settings.partners),
	}


def _find_asset(asset_path: Path, names: list[str]):
	for name in names:
		candidate = asset_path / name
		if candidate.is_file():
			return candidate
	return None


def _save_public_file(path: Path, doctype: str, docname: str):
	existing = frappe.db.get_value(
		"File",
		{
			"file_name": path.name,
			"attached_to_doctype": doctype,
			"attached_to_name": docname,
			"is_private": 0,
		},
		"file_url",
	)
	if existing:
		return existing
	file_doc = save_file(path.name, path.read_bytes(), doctype, docname, is_private=0)
	return file_doc.file_url
