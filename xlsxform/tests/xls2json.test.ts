/**
 * Port of test_xls2json.py - XLS to JSON conversion tests.
 * Tests for sheet name heuristics (case insensitivity, misspelling detection, etc.)
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

// Common XLSForms used in below test cases
const CHOICES = (name: string) => `
| survey   |               |           |       |
|          | type          | name      | label |
|          | select_one l1 | q1        | Q1    |
| ${name}  |               |           |       |
|          | list_name     | name      | label |
|          | l1            | 1         | C1    |
`;

// Doubled braces \${} here because it's used with template literal references.
const EXTERNAL_CHOICES = (name: string) => `
| survey |                        |           |       |               |
|        | type                   | name      | label | choice_filter |
|        | text                   | q1        | Q1    |               |
|        | select_one_external l1 | q2        | Q2    | q1=\${q1}     |
| ${name} |                       |           |       |               |
|        | list_name              | name      | q1    |               |
|        | l1                     | 1         | 1     |               |
|        | l1                     | 2         | 2     |               |
`;

const SETTINGS = (name: string) => `
| survey   |           |           |       |
|          | type      | name      | label |
|          | text      | q1        | Q1    |
| ${name}  |           |           |       |
|          | id_string | title     |       |
|          | my_id     | My Survey |       |
`;

const SURVEY = (name: string) => `
| ${name}  |           |           |       |
|          | type      | name      | label |
|          | text      | q1        | Q1    |
| settings |
|          | form_title |
|          | My Form    |
`;

describe("TestXLS2JSONSheetNameHeuristics", () => {
	const errSimilarFound = "the following sheets with similar names were found";
	const errSurveyRequired = "You must have a sheet named 'survey'.";
	const errChoicesRequired = "There should be a choices sheet in this xlsform.";
	const errExtChoicesRequired =
		"There should be an external_choices sheet in this xlsform.";

	it("should not warn/error if optional choices sheet is not lowercase", () => {
		const testNames = ["choices", "Choices", "CHOICES"];
		for (const n of testNames) {
			assertPyxformXform({
				md: CHOICES(n),
				warnings_count: 0,
			});
		}
	});

	it("should not warn/error if optional external_choices sheet is not lowercase", () => {
		const testNames = [
			"external_choices",
			"External_Choices",
			"EXTERNAL_CHOICES",
		];
		for (const n of testNames) {
			assertPyxformXform({
				md: EXTERNAL_CHOICES(n),
				warnings_count: 0,
			});
		}
	});

	it("should not warn/error if optional settings sheet is not lowercase", () => {
		const testNames = ["settings", "Settings", "SETTINGS"];
		for (const n of testNames) {
			assertPyxformXform({
				md: SETTINGS(n),
				warnings_count: 0,
			});
		}
	});

	it("should not warn/error if the survey sheet is not lowercase", () => {
		const testNames = ["survey", "Survey", "SURVEY"];
		for (const n of testNames) {
			assertPyxformXform({
				md: SURVEY(n),
				warnings_count: 0,
			});
		}
	});

	it("should ignore prefixed sheet name for spelling - choices", () => {
		const testNames = ["_choice", "_chioces", "_choics"];
		for (const n of testNames) {
			assertPyxformXform({
				md: CHOICES(n),
				errored: true,
				error__contains: [errChoicesRequired],
				error__not_contains: [errSimilarFound, `'${n}'`],
			});
		}
	});

	it("should ignore prefixed sheet name for spelling - external_choices", () => {
		const testNames = [
			"_external_choice",
			"_extrenal_choices",
			"_externa_choics",
		];
		for (const n of testNames) {
			assertPyxformXform({
				md: EXTERNAL_CHOICES(n),
				errored: true,
				error__contains: [errExtChoicesRequired],
				error__not_contains: [errSimilarFound, `'${n}'`],
			});
		}
	});

	it("should ignore prefixed sheet name for spelling - settings", () => {
		const testNames = ["_setting", "_stetings", "_setings"];
		for (const n of testNames) {
			assertPyxformXform({
				md: SETTINGS(n),
				warnings_count: 0,
			});
		}
	});

	it("should ignore prefixed sheet name for spelling - survey", () => {
		const testNames = ["_surveys", "_surve", "_sruvey"];
		for (const n of testNames) {
			assertPyxformXform({
				md: SURVEY(n),
				errored: true,
				error__contains: [errSurveyRequired],
				error__not_contains: [errSimilarFound, `'${n}'`],
			});
		}
	});

	it("should mention misspellings if similar choices sheet names found", () => {
		const testNames = ["choice", "chioces", "choics"];
		for (const n of testNames) {
			assertPyxformXform({
				md: CHOICES(n),
				errored: true,
				error__contains: [errChoicesRequired, errSimilarFound, `'${n}'`],
			});
		}
	});

	it("should not mention misspellings if the choices sheet exists", () => {
		assertPyxformXform({
			md: `
| survey   |               |           |       |
|          | type          | name      | label |
|          | select_one l1 | q1        | Q1    |
| choices  |               |           |       |
|          | list_name     | name      | label |
|          | l1            | 1         | C1    |
| chioces  |               |           |       |
|          | list_name     | name      | label |
|          | l1            | 1         | C1    |
`,
			warnings_count: 0,
		});
	});

	it("should mention misspellings if multiple similar choices sheet names found", () => {
		assertPyxformXform({
			md: `
| survey   |               |           |       |
|          | type          | name      | label |
|          | select_one l1 | q1        | Q1    |
| choice   |               |           |       |
|          | list_name     | name      | label |
|          | l1            | 1         | C1    |
| chioces  |               |           |       |
|          | list_name     | name      | label |
|          | l1            | 1         | C1    |
`,
			errored: true,
			error__contains: [
				errChoicesRequired,
				errSimilarFound,
				"'choice'",
				"'chioces'",
			],
		});
	});

	it("should mention misspellings if similar external_choices sheet names found", () => {
		const testNames = ["external_choice", "extrenal_choices", "externa_choics"];
		for (const n of testNames) {
			assertPyxformXform({
				md: EXTERNAL_CHOICES(n),
				errored: true,
				error__contains: [errExtChoicesRequired, errSimilarFound, `'${n}'`],
			});
		}
	});

	it("should not mention misspellings if the external_choices sheet exists", () => {
		assertPyxformXform({
			md: `
| survey   |                        |           |       |               |
|          | type                   | name      | label | choice_filter |
|          | text                   | q1        | Q1    |               |
|          | select_one_external l1 | q2        | Q2    | q1=\${q1}     |
| external_choices |                |           |       |               |
|          | list_name              | name      | q1    |               |
|          | l1                     | 1         | 1     |               |
|          | l1                     | 2         | 2     |               |
| extrenal_choices |                |           |       |               |
|          | list_name              | name      | q1    |               |
|          | l1                     | 1         | 1     |               |
|          | l1                     | 2         | 2     |               |
`,
			warnings_count: 0,
		});
	});

	it("should mention misspellings if multiple similar external_choices sheet names found", () => {
		assertPyxformXform({
			md: `
| survey   |                        |           |       |               |
|          | type                   | name      | label | choice_filter |
|          | text                   | q1        | Q1    |               |
|          | select_one_external l1 | q2        | Q2    | q1=\${q1}     |
| external_choice |                 |           |       |               |
|          | list_name              | name      | q1    |               |
|          | l1                     | 1         | 1     |               |
|          | l1                     | 2         | 2     |               |
| extrenal_choices |                |           |       |               |
|          | list_name              | name      | q1    |               |
|          | l1                     | 1         | 1     |               |
|          | l1                     | 2         | 2     |               |
`,
			errored: true,
			error__contains: [
				errExtChoicesRequired,
				errSimilarFound,
				"'external_choice'",
				"'extrenal_choices'",
			],
		});
	});

	it("should mention misspellings if similar settings sheet names found", () => {
		const testNames = ["setting", "stetings", "setings"];
		for (const n of testNames) {
			assertPyxformXform({
				md: SETTINGS(n),
				warnings__contains: [errSimilarFound, `'${n}'`],
			});
		}
	});

	it("should not mention misspellings if the settings sheet exists", () => {
		assertPyxformXform({
			md: `
| survey   |           |           |       |
|          | type      | name      | label |
|          | text      | q1        | Q1    |
| settings |           |           |       |
|          | id_string | title     |       |
|          | my_id     | My Survey |       |
| stetings |           |           |       |
|          | id_string | title     |       |
|          | my_id     | My Survey |       |
`,
			warnings_count: 0,
		});
	});

	it("should mention misspellings if multiple similar settings sheet names found", () => {
		assertPyxformXform({
			md: `
| survey   |           |           |       |
|          | type      | name      | label |
|          | text      | q1        | Q1    |
| setting  |           |           |       |
|          | id_string | title     |       |
|          | my_id     | My Survey |       |
| stetings |           |           |       |
|          | id_string | title     |       |
|          | my_id     | My Survey |       |
`,
			warnings__contains: [errSimilarFound, "'setting'", "'stetings'"],
		});
	});

	it("should mention misspellings if similar survey sheet names found", () => {
		const testNames = ["surveys", "surve", "sruvey"];
		for (const n of testNames) {
			assertPyxformXform({
				md: SURVEY(n),
				errored: true,
				error__contains: [errSurveyRequired, errSimilarFound, `'${n}'`],
			});
		}
	});

	it("should not mention misspellings if the survey sheet exists", () => {
		assertPyxformXform({
			md: `
| survey  |           |           |       |
|         | type      | name      | label |
|         | text      | q1        | Q1    |
| surve   |           |           |       |
|         | type      | name      | label |
|         | text      | q1        | Q1    |
`,
			warnings_count: 0,
		});
	});

	it("should mention misspellings if multiple similar survey sheet names found", () => {
		assertPyxformXform({
			md: `
| surveys |           |           |       |
|         | type      | name      | label |
|         | text      | q1        | Q1    |
| Surve   |           |           |       |
|         | type      | name      | label |
|         | text      | q1        | Q1    |
`,
			errored: true,
			error__contains: [
				errSurveyRequired,
				errSimilarFound,
				"'surveys'",
				"'Surve'",
			],
		});
	});

	it("should not mention misspellings for dissimilar choices sheet names", () => {
		const testNames = ["cho", "ices", "choose"];
		for (const n of testNames) {
			assertPyxformXform({
				md: CHOICES(n),
				errored: true,
				error__not_contains: [errSimilarFound, `'${n}'`],
			});
		}
	});

	it("should not mention misspellings for dissimilar external_choices sheet names", () => {
		const testNames = ["external", "choices", "eternal_choosey"];
		for (const n of testNames) {
			assertPyxformXform({
				md: EXTERNAL_CHOICES(n),
				errored: true,
				error__not_contains: [errSimilarFound, `'${n}'`],
			});
		}
	});

	it("should not mention misspellings for dissimilar settings sheet names", () => {
		const testNames = ["hams", "spetltigs", "stetinsg"];
		for (const n of testNames) {
			assertPyxformXform({
				md: SETTINGS(n),
				warnings_count: 0,
			});
		}
	});

	it("should not mention misspellings for dissimilar survey sheet names", () => {
		const testNames = ["hams", "suVVve", "settings"];
		for (const n of testNames) {
			assertPyxformXform({
				md: SURVEY(n),
				errored: true,
				error__not_contains: [errSimilarFound],
			});
		}
	});

	it("should not mention misspellings for complete example with correct spelling", () => {
		assertPyxformXform({
			md: `
| survey   |                        |           |       |               |
|          | type                   | name      | label | choice_filter |
|          | select_one l1          | q1        | Q1    |               |
|          | select_one_external l2 | q2        | Q2    | q1=\${q1}     |
| choices  |               |           |       |
|          | list_name     | name      | label |
|          | l1            | 1         | C1    |
| external_choices |               |           |       |
|                  | list_name     | name      | q1    |
|                  | l2            | 1         | 1     |
|                  | l2            | 2         | 2     |
| settings |               |           |       |
|          | id_string     | title     |
|          | my_id         | My Survey |
`,
			warnings_count: 0,
		});
	});

	it("should mention misspellings in processing order - survey misspelled", () => {
		assertPyxformXform({
			md: `
| surveys  |                        |           |       |               |
|          | type                   | name      | label | choice_filter |
|          | select_one l1          | q1        | Q1    |               |
|          | select_one_external l2 | q2        | Q2    | q1=\${q1}     |
| chooses  |               |           |       |
|          | list_name     | name      | label |
|          | l1            | 1         | C1    |
| external_choyces |               |           |       |
|                  | list_name     | name      | q1    |
|                  | l2            | 1         | 1     |
|                  | l2            | 2         | 2     |
| settyngs |               |           |       |
|          | id_string     | title     |
|          | my_id         | My Survey |
`,
			errored: true,
			warnings__not_contains: [errSimilarFound, "'settyngs'"],
			error__contains: [errSurveyRequired, errSimilarFound, "'surveys'"],
			error__not_contains: [
				errChoicesRequired,
				"'chooses'",
				errExtChoicesRequired,
				"'external_choyces'",
			],
		});
	});

	it("should mention misspellings in processing order - choices misspelled", () => {
		assertPyxformXform({
			md: `
| survey   |                        |           |       |               |
|          | type                   | name      | label | choice_filter |
|          | select_one l1          | q1        | Q1    |               |
|          | select_one_external l2 | q2        | Q2    | q1=\${q1}     |
| chooses  |               |           |       |
|          | list_name     | name      | label |
|          | l1            | 1         | C1    |
| external_choyces |               |           |       |
|                  | list_name     | name      | q1    |
|                  | l2            | 1         | 1     |
|                  | l2            | 2         | 2     |
| settings |               |           |       |
|          | id_string     | title     |
|          | my_id         | My Survey |
`,
			errored: true,
			warnings__not_contains: [errSimilarFound, "'settyngs'"],
			error__contains: [errChoicesRequired, "'chooses'"],
			error__not_contains: [
				errSurveyRequired,
				"'survey'",
				// Not raised because the "select_one l1, q1" is checked first.
				errExtChoicesRequired,
				"'external_choyces'",
			],
		});
	});

	it("should mention misspellings in processing order - external_choices misspelled", () => {
		assertPyxformXform({
			md: `
| survey   |                        |           |       |               |
|          | type                   | name      | label | choice_filter |
|          | select_one l1          | q1        | Q1    |               |
|          | select_one_external l2 | q2        | Q2    | q1=\${q1}     |
| choices  |               |           |       |
|          | list_name     | name      | label |
|          | l1            | 1         | C1    |
| external_choyces |               |           |       |
|                  | list_name     | name      | q1    |
|                  | l2            | 1         | 1     |
|                  | l2            | 2         | 2     |
| settings |               |           |       |
|          | id_string     | title     |
|          | my_id         | My Survey |
`,
			errored: true,
			warnings__not_contains: [errSimilarFound, "'settyngs'"],
			error__contains: [errExtChoicesRequired, "'external_choyces'"],
			error__not_contains: [
				errSurveyRequired,
				"'survey'",
				errChoicesRequired,
				"'chooses'",
			],
		});
	});

	it("should mention misspellings in processing order - settings misspelled", () => {
		assertPyxformXform({
			md: `
| survey   |                        |           |       |               |
|          | type                   | name      | label | choice_filter |
|          | select_one l1          | q1        | Q1    |               |
|          | select_one_external l2 | q2        | Q2    | q1=\${q1}     |
| chooses  |               |           |       |
|          | list_name     | name      | label |
|          | l1            | 1         | C1    |
| external_choyces |               |           |       |
|                  | list_name     | name      | q1    |
|                  | l2            | 1         | 1     |
|                  | l2            | 2         | 2     |
| settyngs |               |           |       |
|          | id_string     | title     |
|          | my_id         | My Survey |
`,
			errored: true,
			warnings__contains: [errSimilarFound, "'settyngs'"],
			error__contains: [errChoicesRequired, "'chooses'"],
			error__not_contains: [
				errSurveyRequired,
				"'survey'",
				// Not raised because the "select_one l1, q1" is checked first.
				errExtChoicesRequired,
				"'external_choyces",
			],
		});
	});

	it("should not warn when valid optional sheet names are provided", () => {
		assertPyxformXform({
			md: `
| survey   |           |           |       |
|          | type      | name      | label |
|          | text      | q1        | Q1    |
| settings |           |           |       |
|          | id_string | title     |       |
|          | my_id     | My Survey |       |
| choices  |           |           |       |
|          | list_name | name      | label |
|          | l1        | c1        | One   |
`,
			warnings_count: 0,
		});
	});

	it("should handle row with empty cell (no column value)", () => {
		// Adapted from test_xls2xform_convert__e2e_row_with_no_column_value.
		// Original uses md_table_to_workbook + file I/O; adapted to assertPyxformXform.
		assertPyxformXform({
			md: `
				| survey |        |        |        |         |
				|        | type   | name   | label  | hint    |
				|        | text   | state  | State  |         |
				|        | text   | city   | City   | A hint  |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/test_name/state']",
				"/h:html/h:body/x:input[@ref='/test_name/city']",
			],
		});
	});

	// TODO: requires internal API - test_xls2xform_convert__e2e_with_settings_misspelling
	// This test uses xls2xform_convert directly with an example XLSX file (extra_sheet_names.xlsx)
	// and verifies that the warning about settings misspelling is present.

	// TODO: requires internal API - test_xls2xform_convert__e2e_with_extra_columns__does_not_use_excessive_memory
	// This test uses psutil to check memory usage with a degenerate form with many blank columns.

	// TODO: requires internal API - test_xlsx_to_dict__extra_sheet_names_are_returned_by_parser
	// This test uses get_xlsform directly to verify that extra sheet names are returned by the parser.
});
