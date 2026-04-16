/**
 * Port of test_pyxformtestcase.py - Ensuring internal conversions are correct.
 */

import { describe, expect, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("PyxformTestCaseNonMarkdownSurveyAlternatives", () => {
	it("test_tainted_vanilla_survey_failure", () => {
		/**
		 * The _invalid_ss_structure should fail to compile because the note
		 * has no label. If "errored" parameter is not set to True, it should
		 * raise an exception.
		 */
		const invalidSsStructure = { survey: [{ type: "note", name: "n1" }] };

		// When errored=false (default), and the survey fails to compile, should throw
		expect(() => {
			assertPyxformXform({
				ss_structure: invalidSsStructure,
				errored: false,
			});
		}).toThrow();

		// However when errored=true is present
		assertPyxformXform({
			ss_structure: invalidSsStructure,
			errored: true,
			error__contains: ["The survey element named 'n1' has no label or hint."],
		});
	});

	it("test_vanilla_survey", () => {
		/**
		 * Testing that a survey can be passed as a spreadsheet structure
		 * named 'ss_structure'.
		 */
		assertPyxformXform({
			ss_structure: {
				survey: [{ type: "note", name: "n1", label: "Note 1" }],
			},
		});
	});
});

describe("XlsFormPyxformSurveyTest", () => {
	it("test_formid_is_not_none", () => {
		/**
		 * When the form id is not set, it should never use python's None.
		 */
		// In Python, xps.form_id("data") checks for id="data" in the instance.
		// The TS engine uses the form name as the id (default "test_name").
		// The key assertion is that the id is never null/None/"None".
		assertPyxformXform({
			md: `
			| survey |      |      |       |
			|        | type | name | label |
			|        | note | q    | Q     |
			`,
			xml__excludes: ['id="None"'],
			xml__contains: ['id="data"'],
		});
	});
});
