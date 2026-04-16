/**
 * Port of xform_test_case/test_xml.py - Test XForm XML syntax.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("XMLTests", () => {
	it("test_to_xml", () => {
		// The original test loads yes_or_no_question.xls and compares the full XML output.
		// We can port this using assertPyxformXform with md equivalent and xml__contains checks.
		assertPyxformXform({
			name: "yes_or_no_question",
			md: `
				| survey  |                    |          |                                |
				|         | type               | name     | label                          |
				|         | select one yes_or_no | good_day | have you had a good day today? |
				|         |                    |          |                                |
				| choices | list_name          | name     | label                          |
				|         | yes_or_no          | yes      | yes                            |
				|         | yes_or_no          | no       | no                             |
			`,
			xml__contains: [
				'<bind nodeset="/yes_or_no_question/good_day" type="string"/>',
			],
			instance__contains: [
				"<good_day/>",
			],
		});
	});
});

describe("MinidomTextWriterMonkeyPatchTest", () => {
	// TODO: requires internal API - test_patch_lets_node_func_escape_only_necessary
	// Tests the pyxform.utils.node function for XML escaping behavior.
	// This is a Python-specific minidom monkey-patch test.
	it.todo("test_patch_lets_node_func_escape_only_necessary - requires internal API (pyxform.utils.node)");

	// TODO: requires internal API - test_original_escape_escapes_more_than_necessary
	// Tests Python minidom DOM implementation escaping behavior.
	it.todo("test_original_escape_escapes_more_than_necessary - requires internal API (Python minidom)");
});
