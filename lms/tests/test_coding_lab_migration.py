import json
import unittest

from lms.lms.coding_lab import (
	append_linked_lab,
	legacy_doc_to_snapshot,
	migrate_link_blocks,
	parse_editor_content,
)


LEGACY_PYTHON = {
	"title": "Loops",
	"instructions": "Print three numbers",
	"lab_type": "python",
	"python_starter_code": "for i in range(3):\n    print(i)",
	"python_test_code": "test('three', lambda: assert_equal(total, 3))",
}


class CodingLabMigrationTest(unittest.TestCase):
	def test_normalizes_legacy_doc_without_importing_legacy_app(self):
		snapshot = legacy_doc_to_snapshot(LEGACY_PYTHON, "loops")
		self.assertEqual(snapshot["schema_version"], 3)
		self.assertEqual(snapshot["lab_kind"], "python")
		self.assertEqual(snapshot["enabled_web_files"], [])
		self.assertIn("range(3)", snapshot["starter_files"]["python"])

	def test_replaces_only_link_only_blocks(self):
		content = json.dumps(
			{
				"blocks": [
					{
						"id": "editor-block-id",
						"type": "coding_lab",
						"data": {"coding_lab": "loops"},
					},
					{
						"type": "codingLab",
						"data": {
							"coding_lab": "keep",
							"title": "Already snapshotted",
						},
					},
				]
			}
		)
		migrated, changed = migrate_link_blocks(
			content, lambda name: LEGACY_PYTHON if name == "loops" else None
		)
		blocks = json.loads(migrated)["blocks"]
		self.assertTrue(changed)
		self.assertEqual(blocks[0]["type"], "codingLab")
		self.assertEqual(blocks[0]["data"]["block_id"], blocks[0]["id"])
		self.assertNotEqual(blocks[0]["id"], "editor-block-id")
		self.assertEqual(blocks[1]["data"]["coding_lab"], "keep")

	def test_appends_custom_field_reference_once(self):
		content, changed = append_linked_lab("", "loops", LEGACY_PYTHON)
		self.assertTrue(changed)
		self.assertEqual(len(json.loads(content)["blocks"]), 1)
		second, changed_again = append_linked_lab(
			content, "loops", LEGACY_PYTHON
		)
		self.assertFalse(changed_again)
		self.assertEqual(second, content)

	def test_does_not_append_when_an_inline_lab_makes_link_ambiguous(self):
		content = json.dumps(
			{
				"blocks": [
					{
						"id": "existing",
						"type": "codingLab",
						"data": {"block_id": "existing", "lab_kind": "web"},
					}
				]
			}
		)
		unchanged, changed = append_linked_lab(
			content, "loops", LEGACY_PYTHON
		)
		self.assertFalse(changed)
		self.assertEqual(unchanged, content)

	def test_malformed_content_fails_safely(self):
		self.assertIsNone(parse_editor_content("{broken"))
		content, changed = append_linked_lab("{broken", "loops", LEGACY_PYTHON)
		self.assertEqual(content, "{broken")
		self.assertFalse(changed)


if __name__ == "__main__":
	unittest.main()
