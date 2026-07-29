"""Pure helpers for migrating legacy Coding Lab references into lesson blocks."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable, Mapping
from typing import Any

CODING_LAB_BLOCK_TYPES = {"codingLab", "coding_lab"}
WEB_FILES = ("html", "css", "javascript")


def parse_editor_content(content: Any) -> dict[str, Any] | None:
	if content in (None, ""):
		return {"blocks": []}
	if isinstance(content, str):
		try:
			content = json.loads(content)
		except (TypeError, ValueError):
			return None
	if not isinstance(content, dict) or not isinstance(content.get("blocks"), list):
		return None
	return content


def legacy_block_id(lab_name: str) -> str:
	digest = hashlib.sha256(str(lab_name).encode("utf-8")).hexdigest()[:16]
	return f"coding-lab-{digest}"


def legacy_doc_to_snapshot(
	doc: Mapping[str, Any] | Any, lab_name: str
) -> dict[str, Any]:
	get = doc.get if isinstance(doc, Mapping) else lambda key, default=None: getattr(
		doc, key, default
	)
	legacy_type = get("lab_type") or get("default_mode") or "full_web"
	lab_kind = "python" if legacy_type == "python" else "web"
	if lab_kind == "python":
		enabled_files: list[str] = []
	elif legacy_type == "javascript":
		enabled_files = ["javascript"]
	else:
		enabled_files = list(WEB_FILES)

	return {
		"schema_version": 3,
		"block_id": legacy_block_id(lab_name),
		"title": get("title") or "Untitled Coding Lab",
		"instructions": get("instructions") or "",
		"lab_kind": lab_kind,
		"enabled_web_files": enabled_files,
		"starter_files": {
			"html": get("html_starter_code") or "",
			"css": get("css_starter_code") or "",
			"javascript": get("js_starter_code") or "",
			"python": get("python_starter_code") or "",
		},
		"test_code": (
			get("python_test_code")
			if lab_kind == "python"
			else get("web_test_code")
		)
		or "",
		"ui": {
			"default_file": (
				"python" if lab_kind == "python" else enabled_files[0]
			),
			"console_open": True,
			"console_height": 180,
		},
	}


def migrate_link_blocks(
	content: Any,
	lookup: Callable[[str], Mapping[str, Any] | Any | None],
) -> tuple[str | Any, bool]:
	document = parse_editor_content(content)
	if document is None:
		return content, False
	changed = False
	for block in document["blocks"]:
		if not isinstance(block, dict) or block.get("type") not in CODING_LAB_BLOCK_TYPES:
			continue
		data = block.get("data")
		if not isinstance(data, dict) or set(data) != {"coding_lab"}:
			continue
		lab_name = data.get("coding_lab")
		if not lab_name:
			continue
		legacy_doc = lookup(str(lab_name))
		if not legacy_doc:
			continue
		snapshot = legacy_doc_to_snapshot(legacy_doc, str(lab_name))
		block["id"] = snapshot["block_id"]
		block["type"] = "codingLab"
		block["data"] = snapshot
		changed = True
	return (json.dumps(document, ensure_ascii=False) if changed else content), changed


def append_linked_lab(
	content: Any,
	lab_name: str,
	legacy_doc: Mapping[str, Any] | Any | None,
) -> tuple[str | Any, bool]:
	if not lab_name or not legacy_doc:
		return content, False
	document = parse_editor_content(content)
	if document is None:
		return content, False
	expected_id = legacy_block_id(lab_name)
	has_other_lab = False
	for block in document["blocks"]:
		if not isinstance(block, dict) or block.get("type") not in CODING_LAB_BLOCK_TYPES:
			continue
		has_other_lab = True
		data = block.get("data") if isinstance(block.get("data"), dict) else {}
		if data.get("coding_lab") == lab_name or data.get("block_id") == expected_id:
			return content, False
	# A custom field only represented one lab, but an existing inline lab may
	# already be its migrated replacement with a non-derivable EditorJS id.
	# Treat that ambiguity as unsafe rather than append a possible duplicate.
	if has_other_lab:
		return content, False

	snapshot = legacy_doc_to_snapshot(legacy_doc, lab_name)
	document["blocks"].append(
		{"id": snapshot["block_id"], "type": "codingLab", "data": snapshot}
	)
	return json.dumps(document, ensure_ascii=False), True
