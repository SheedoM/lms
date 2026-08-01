#!/usr/bin/env python3
"""Static validation for the FaragallahTech public learning site.

This check does not require a running Frappe site. Run it from the repository root:

    python scripts/validate_public_learning_site.py
    node --check lms/public/landing/landing.js
    node --check lms/public/landing/subscription.js
"""

from __future__ import annotations

import json
import py_compile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

PYTHON_FILES = [
	"lms/public_website.py",
	"lms/setup_public_site.py",
	"lms/test_public_website.py",
	"lms/patches/v2_0/seed_public_learning_site.py",
	"lms/www/index.py",
	"lms/www/course.py",
	"lms/www/subscribe.py",
	"lms/www/enroll.py",
	"lms/www/signup.py",
	"lms/lms/doctype/course_offering/course_offering.py",
	"lms/lms/doctype/course_offering_category/course_offering_category.py",
	"lms/lms/doctype/course_subscription_request/course_subscription_request.py",
]

JSON_FILES = [
	"lms/lms/doctype/course_offering/course_offering.json",
	"lms/lms/doctype/course_offering_category/course_offering_category.json",
	"lms/lms/doctype/course_subscription_request/course_subscription_request.json",
	"lms/lms/doctype/landing_page_settings/landing_page_settings.json",
	"lms/lms/doctype/landing_gallery_item/landing_gallery_item.json",
	"lms/lms/doctype/landing_partner/landing_partner.json",
	"lms/lms/doctype/landing_faq/landing_faq.json",
]

REQUIRED_FILES = [
	"lms/www/index.html",
	"lms/www/course.html",
	"lms/www/subscribe.html",
	"lms/templates/public_site/header.html",
	"lms/templates/public_site/footer.html",
	"lms/templates/public_site/course_card.html",
	"lms/public/landing/landing.css",
	"lms/public/landing/detail.css",
	"lms/public/landing/landing.js",
	"lms/public/landing/subscription.js",
]


def main() -> None:
	errors: list[str] = []

	for relative in REQUIRED_FILES + PYTHON_FILES + JSON_FILES:
		path = ROOT / relative
		if not path.is_file():
			errors.append(f"Missing file: {relative}")

	for relative in PYTHON_FILES:
		path = ROOT / relative
		if not path.is_file():
			continue
		try:
			py_compile.compile(str(path), doraise=True)
		except py_compile.PyCompileError as exc:
			errors.append(f"Python syntax error in {relative}: {exc.msg}")

	for relative in JSON_FILES:
		path = ROOT / relative
		if not path.is_file():
			continue
		try:
			with path.open(encoding="utf-8") as handle:
				json.load(handle)
		except (OSError, json.JSONDecodeError) as exc:
			errors.append(f"Invalid JSON in {relative}: {exc}")

	patches = ROOT / "lms/patches.txt"
	if patches.is_file() and "lms.patches.v2_0.seed_public_learning_site" not in patches.read_text(
		encoding="utf-8"
	):
		errors.append("Public learning site seed patch is missing from lms/patches.txt")

	hooks = ROOT / "lms/hooks.py"
	if hooks.is_file():
		hooks_text = hooks.read_text(encoding="utf-8")
		for route in ('"/courses/<slug>"', '"/subscribe/<slug>"', '"/enroll/<slug>"'):
			if route not in hooks_text:
				errors.append(f"Missing website route in hooks.py: {route}")

	if errors:
		print("Public learning site validation failed:\n")
		for error in errors:
			print(f"- {error}")
		raise SystemExit(1)

	print("Public learning site static validation passed.")


if __name__ == "__main__":
	main()
