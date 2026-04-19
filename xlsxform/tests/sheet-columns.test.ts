/**
 * Port of test_sheet_columns.py - XLSForm sheet column tests.
 */

import { describe, expect, it } from "vitest";
import { convert } from "../src/conversion/xls2xform.js";
import {
	dealiasAndGroupSheet,
	processHeaderFull,
	processRow,
	toSnakeCase,
} from "../src/parsing/sheet-headers.js";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestSettingsColumns", () => {
	it("should find that settings column headers are case insensitive", () => {
		assertPyxformXform({
			md: `
				| settings |
				|          | Form_ID | Form_Title |
				|          | My Form | Welcome!   |
				| survey |
				|        | type  | name | label |
				|        | text  | q1   | hello |
			`,
			xml__xpath_match: [
				"/h:html/h:head/h:title[text()='Welcome!']",
				"/h:html/h:head/x:model/x:instance/x:test_name/@id[.='My Form']",
			],
		});
	});

	it("should handle form_id variant with id_string and form_id", () => {
		assertPyxformXform({
			md: `
				| survey   |      |             |       |
				|          | type | name        | label |
				|          | text | member_name | name  |
				| settings |                                   |                        |             |
				|          | id_string                         | version                | form_id     |
				|          | get_option_from_two_repeat_answer | vWvvk3GYzjXcJQyvTWELej | AUTO-v2-jef |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:instance/x:test_name[
				  @id='AUTO-v2-jef'
				  and @version='vWvvk3GYzjXcJQyvTWELej'
				]
				`,
			],
		});
	});
});

describe("TestSurveyColumns", () => {
	it("should require every question to have a name", () => {
		assertPyxformXform({
			name: "invalidcols",
			ss_structure: { survey: [{ type: "text", label: "label" }] },
			errored: true,
			error__contains: ["no name"],
		});
	});

	it("should accept alias of name (value)", () => {
		assertPyxformXform({
			name: "invalidcols",
			ss_structure: { survey: [{ value: "q1", type: "text", label: "label" }] },
		});
	});

	it("should require label or hint to be provided", () => {
		assertPyxformXform({
			name: "invalidcols",
			ss_structure: { survey: [{ type: "text", name: "q1" }] },
			errored: true,
			error__contains: ["no label or hint"],
		});
	});

	it("should output a label node even if no label is specified when hint given", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |      |      |       |              |      |
				|        | type | name | label | media::image | hint |
				|        | text | a    |       |              | h    |
				|        | text | b    | l     |              |      |
				|        | text | c    |       | m.png        |      |
			`,
			xml__contains: [
				'<input ref="/data/a">',
				"<label/>",
				"<hint>h</hint>",
				'<input ref="/data/b">',
				"<label>l</label>",
				'<input ref="/data/c">',
				`<label ref="jr:itext('/data/c:label')"/>`,
			],
		});
	});

	it("should error if big-image is specified without image", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |      |      |                  |
				|        | type | name | media::big-image |
				|        | text | c    | m.png            |
			`,
			errored: true,
			error__contains: ["must also specify an image"],
		});
	});

	it("should ignore media column", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |      |      |       |
				|        | type | name | media |
				|        | text | c    | m.png |
			`,
			xml__excludes: ["m.png"],
		});
	});

	it("should ensure column name is case insensitive", () => {
		assertPyxformXform({
			md: `
				| Survey |         |         |               |
				|        | Type    | name    | Label         |
				|        | text    | Name    | the name      |
				|        | integer | age     | the age       |
				|        | text    | gender  | the gender    |
			`,
		});
	});

	it("should handle label capitalization alternatives", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |       |
				|        | type | name | label |
				|        | note | q    | Q     |
			`,
			xml__xpath_match: ["/h:html/h:body/x:input[./x:label='Q']"],
		});
		assertPyxformXform({
			md: `
				| survey |      |      |       |
				|        | type | name | Label |
				|        | note | q    | Q     |
			`,
			xml__xpath_match: ["/h:html/h:body/x:input[./x:label='Q']"],
		});
	});

	it("should handle calculate alias", () => {
		assertPyxformXform({
			name: "calculatealias",
			md: `
				| survey |           |         |         |               |
				|        | type      | name    | label   | calculate     |
				|        | decimal   | amount  | Counter |               |
				|        | calculate | doubled | Doubled | \${amount} * 2 |
			`,
		});
	});

	it("should error on missing survey headers", () => {
		assertPyxformXform({
			md: `
				| survey |                 |    |
				|        | select_one list | S1 |
			`,
			errored: true,
			error__contains: ["'type'"],
		});
	});
});

describe("TestChoicesColumns", () => {
	function simpleChoiceSs(choiceSheet: Record<string, unknown>[] = []) {
		return {
			survey: [
				{
					type: "select_one l1",
					name: "l1choice",
					label: "select one from list l1",
				},
			],
			choices: choiceSheet,
		};
	}

	it("should pass with valid choices sheet", () => {
		assertPyxformXform({
			name: "valid_choices",
			ss_structure: simpleChoiceSs([
				{ list_name: "l1", name: "c1", label: "choice 1" },
				{ list_name: "l1", name: "c2", label: "choice 2" },
			]),
		});
	});

	it("should fail with invalid choices sheet missing name", () => {
		assertPyxformXform({
			name: "missing_name",
			ss_structure: simpleChoiceSs([
				{ list_name: "l1", label: "choice 1" },
				{ list_name: "l1", label: "choice 2" },
			]),
			errored: true,
			error__contains: ["'name'"],
		});
	});

	it("should fail with missing list_name", () => {
		assertPyxformXform({
			name: "missing_list_name",
			ss_structure: simpleChoiceSs([
				{ bad_column: "l1", name: "l1c1", label: "choice 1" },
				{ bad_column: "l1", name: "l1c1", label: "choice 2" },
			]),
			errored: true,
			error__contains: ["choices", "name", "list_name"],
		});
	});

	it("should fail with missing choice headers", () => {
		assertPyxformXform({
			md: `
				| survey  |                 |          |      |
				|         | type            | label    | name |
				|         | select_one list | S1       | s1   |
				| choices |                 |          |      |
				|         | list            | option a | a    |
				|         | list            | option b | b    |
			`,
			errored: true,
			error__contains: ["'name'"],
		});
	});
});

describe("TestColumnAliases", () => {
	it("should accept both name and value columns for choice list", () => {
		const md = `
			| survey  |               |                |            |
			|         | type          | name           | label      |
			|         | select_one yn | q1             | Question 1 |
			| choices |               |                |            |
			|         | list name     | {name_alias}   | label      |
			|         | yn            | yes            | Yes        |
			|         | yn            | no             | No         |
		`;
		for (const nameAlias of ["name", "value"]) {
			assertPyxformXform({
				md: md.replace("{name_alias}", nameAlias),
				xml__xpath_match: [
					"/h:html/h:head/x:model/x:instance/x:test_name/x:q1",
					`/h:html/h:head/x:model/x:bind[
					  @nodeset='/test_name/q1'
					  and @type='string'
					]`,
					`/h:html/h:body/x:select1[
					  @ref = '/test_name/q1'
					  and ./x:itemset
					  and not(./x:item)
					]`,
					`/h:html/h:head/x:model/x:instance[@id='yn']/x:root[
					  ./x:item/x:name/text() = 'yes' and ./x:item/x:label/text() = 'Yes'
					  and ./x:item/x:name/text() = 'no' and ./x:item/x:label/text() = 'No'
					]`,
				],
			});
		}
	});

	it("should error when specifying a column and its alias", () => {
		assertPyxformXform({
			md: `
				| survey |      |        |         |            |
				|        | type | name   | value   | label      |
				|        | text | q_name | q_value | Question 1 |
			`,
			errored: true,
			error__contains: ["name", "value"],
		});
	});

	// Skipped: should warn about duplicate headers but requires xls2json_backends refactoring.
	it.skip("should error when specifying a column more than once", () => {
		assertPyxformXform({
			md: `
				| survey |      |        |         |            |
				|        | type | name   | name    | label      |
				|        | text | q_name | q_value | Question 1 |
			`,
			errored: true,
			error__contains: ["name"],
		});
	});

	it("should recognize the old jr: alias for repeat_count", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name    | label | jr:count |
				|        | begin repeat | a       | 1     | 3        |
				|        | text         | b       | 2     |          |
				|        | end repeat   | a       |       |          |
			`,
			xml__xpath_match: [
				`/h:html/h:head/x:model/x:bind[
				  @nodeset='/test_name/a_count' and @calculate='3'
				]`,
			],
		});
	});
});

describe("TestHeaderProcessing", () => {
	it("should find input strings are snake_cased", () => {
		const cases: [string, string][] = [
			// Lowercased
			["name", "name"],
			["NAME", "name"],
			["Name", "name"],
			// Snaked
			["constraint_message", "constraint_message"],
			["constraint message", "constraint_message"],
			// Collapse/strip spaces
			["constraint  message", "constraint_message"],
			[" constraint message ", "constraint_message"],
			// Edge cases
			["", ""],
			[" ", ""],
			["@", "@"],
		];
		for (const [input, expected] of cases) {
			expect(toSnakeCase(input)).toBe(expected);
		}
	});

	it("should find the header input is processed per each case expectation", () => {
		interface Case {
			header: string;
			useDoubleColon: boolean;
			headerAliases: Record<string, string | string[]>;
			headerColumns: Set<string> | string[];
		}

		// key is [expected_new_header, expected_tokens], values are inputs
		const caseGroups: [[string | string[], string[]], Case[]][] = [
			// No delimiter.
			[
				["my_col", ["my_col"]],
				[
					{
						header: "my_col",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["my_col"]),
					},
					{
						header: "my col",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["my_col"]),
					},
					{
						header: "my_Col",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["my_col"]),
					},
					{
						header: "MY Col",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["my_col"]),
					},
					{
						header: "my_col",
						useDoubleColon: false,
						headerAliases: { my_col: "my_col" },
						headerColumns: [],
					},
					{
						header: "my col",
						useDoubleColon: false,
						headerAliases: { my_col: "my_col" },
						headerColumns: [],
					},
					{
						header: "my_Col",
						useDoubleColon: false,
						headerAliases: { my_col: "my_col" },
						headerColumns: [],
					},
					{
						header: "MY Col",
						useDoubleColon: false,
						headerAliases: { my_col: "my_col" },
						headerColumns: [],
					},
					// has jr: prefix is an alias.
					{
						header: "jr:my_col",
						useDoubleColon: false,
						headerAliases: { "jr:my_col": "my_col" },
						headerColumns: [],
					},
					{
						header: "jr:my_Col",
						useDoubleColon: false,
						headerAliases: { "jr:my_col": "my_col" },
						headerColumns: [],
					},
					{
						header: "jr:my col",
						useDoubleColon: false,
						headerAliases: { "jr:my_col": "my_col" },
						headerColumns: [],
					},
					{
						header: "jr:MY Col",
						useDoubleColon: false,
						headerAliases: { "jr:my_col": "my_col" },
						headerColumns: [],
					},
				],
			],
			// header_aliases is a tuple.
			[
				[
					["bind", "my_col"],
					["bind", "my_col"],
				],
				[
					{
						header: "my_col",
						useDoubleColon: false,
						headerAliases: { my_col: ["bind", "my_col"] },
						headerColumns: [],
					},
					{
						header: "my_Col",
						useDoubleColon: false,
						headerAliases: { my_col: ["bind", "my_col"] },
						headerColumns: [],
					},
					{
						header: "my col",
						useDoubleColon: false,
						headerAliases: { my_col: ["bind", "my_col"] },
						headerColumns: [],
					},
					{
						header: "MY Col",
						useDoubleColon: false,
						headerAliases: { my_col: ["bind", "my_col"] },
						headerColumns: [],
					},
				],
			],
			// jr: prefix is an expected column.
			[
				["jr:my_col", ["jr:my_col"]],
				[
					{
						header: "jr:my_col",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["jr:my_col"]),
					},
					{
						header: "jr:my_Col",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["jr:my_col"]),
					},
					{
						header: "jr:my col",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["jr:my_col"]),
					},
					{
						header: "jr:MY Col",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["jr:my_col"]),
					},
				],
			],
			// Has delimiter - :: delimiter
			[
				["my_col", ["my_col", "English (en)"]],
				[
					{
						header: "my_col::English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["my_col"]),
					},
					{
						header: "my col::English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["my_col"]),
					},
					{
						header: "my_Col::English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["my_col"]),
					},
					{
						header: "MY Col::English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["my_col"]),
					},
					{
						header: "my_col::English (en)",
						useDoubleColon: false,
						headerAliases: { my_col: "my_col" },
						headerColumns: [],
					},
					{
						header: "my col::English (en)",
						useDoubleColon: false,
						headerAliases: { my_col: "my_col" },
						headerColumns: [],
					},
					{
						header: "my_Col::English (en)",
						useDoubleColon: false,
						headerAliases: { my_col: "my_col" },
						headerColumns: [],
					},
					{
						header: "MY Col::English (en)",
						useDoubleColon: false,
						headerAliases: { my_col: "my_col" },
						headerColumns: [],
					},
					// + has jr: prefix is an alias.
					{
						header: "jr:my_col::English (en)",
						useDoubleColon: false,
						headerAliases: { "jr:my_col": "my_col" },
						headerColumns: [],
					},
					{
						header: "jr:my_Col::English (en)",
						useDoubleColon: false,
						headerAliases: { "jr:my_col": "my_col" },
						headerColumns: [],
					},
					{
						header: "jr:my col::English (en)",
						useDoubleColon: false,
						headerAliases: { "jr:my_col": "my_col" },
						headerColumns: [],
					},
					{
						header: "jr:MY Col::English (en)",
						useDoubleColon: false,
						headerAliases: { "jr:my_col": "my_col" },
						headerColumns: [],
					},
					// Has : delimiter
					{
						header: "my_col:English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["my_col"]),
					},
					{
						header: "my col:English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["my_col"]),
					},
					{
						header: "my_Col:English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["my_col"]),
					},
					{
						header: "MY Col:English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["my_col"]),
					},
					{
						header: "my_col:English (en)",
						useDoubleColon: false,
						headerAliases: { my_col: "my_col" },
						headerColumns: [],
					},
					{
						header: "my col:English (en)",
						useDoubleColon: false,
						headerAliases: { my_col: "my_col" },
						headerColumns: [],
					},
					{
						header: "my_Col:English (en)",
						useDoubleColon: false,
						headerAliases: { my_col: "my_col" },
						headerColumns: [],
					},
					{
						header: "MY Col:English (en)",
						useDoubleColon: false,
						headerAliases: { my_col: "my_col" },
						headerColumns: [],
					},
					// + has jr: prefix is an alias.
					{
						header: "jr:my_col:English (en)",
						useDoubleColon: false,
						headerAliases: { "jr:my_col": "my_col" },
						headerColumns: [],
					},
					{
						header: "jr:my_Col:English (en)",
						useDoubleColon: false,
						headerAliases: { "jr:my_col": "my_col" },
						headerColumns: [],
					},
					{
						header: "jr:my col:English (en)",
						useDoubleColon: false,
						headerAliases: { "jr:my_col": "my_col" },
						headerColumns: [],
					},
					{
						header: "jr:MY Col:English (en)",
						useDoubleColon: false,
						headerAliases: { "jr:my_col": "my_col" },
						headerColumns: [],
					},
				],
			],
			// header_aliases is a tuple, with delimiter.
			[
				[
					["bind", "my_col"],
					["bind", "my_col", "English (en)"],
				],
				[
					// Has :: delimiter
					{
						header: "my_col::English (en)",
						useDoubleColon: false,
						headerAliases: { my_col: ["bind", "my_col"] },
						headerColumns: [],
					},
					{
						header: "my_Col::English (en)",
						useDoubleColon: false,
						headerAliases: { my_col: ["bind", "my_col"] },
						headerColumns: [],
					},
					{
						header: "my col::English (en)",
						useDoubleColon: false,
						headerAliases: { my_col: ["bind", "my_col"] },
						headerColumns: [],
					},
					{
						header: "MY Col::English (en)",
						useDoubleColon: false,
						headerAliases: { my_col: ["bind", "my_col"] },
						headerColumns: [],
					},
					// Has : delimiter
					{
						header: "my_col:English (en)",
						useDoubleColon: false,
						headerAliases: { my_col: ["bind", "my_col"] },
						headerColumns: [],
					},
					{
						header: "my_Col:English (en)",
						useDoubleColon: false,
						headerAliases: { my_col: ["bind", "my_col"] },
						headerColumns: [],
					},
					{
						header: "my col:English (en)",
						useDoubleColon: false,
						headerAliases: { my_col: ["bind", "my_col"] },
						headerColumns: [],
					},
					{
						header: "MY Col:English (en)",
						useDoubleColon: false,
						headerAliases: { my_col: ["bind", "my_col"] },
						headerColumns: [],
					},
				],
			],
			// jr: prefix is an expected column, with delimiter.
			[
				["jr:my_col", ["jr:my_col", "English (en)"]],
				[
					// Has :: delimiter
					{
						header: "jr:my_col::English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["jr:my_col"]),
					},
					{
						header: "jr:my_Col::English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["jr:my_col"]),
					},
					{
						header: "jr:my col::English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["jr:my_col"]),
					},
					{
						header: "jr:MY Col::English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["jr:my_col"]),
					},
					// Has : delimiter
					{
						header: "jr:my_col:English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["jr:my_col"]),
					},
					{
						header: "jr:my_Col:English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["jr:my_col"]),
					},
					{
						header: "jr:my col:English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["jr:my_col"]),
					},
					{
						header: "jr:MY Col:English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: new Set(["jr:my_col"]),
					},
				],
			],
			// Unknown columns - no delimiter.
			[
				["NAME", ["NAME"]],
				[
					{
						header: "NAME",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: [],
					},
				],
			],
			[
				["NA_ME", ["NA_ME"]],
				[
					{
						header: "NA_ME",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: [],
					},
				],
			],
			[
				["NA Me", ["NA Me"]],
				[
					{
						header: "NA Me",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: [],
					},
				],
			],
			// Unknown columns - has :: delimiter.
			[
				["name::English (en)", ["name", "English (en)"]],
				[
					{
						header: "name::English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: [],
					},
				],
			],
			[
				["NA_ME::English (en)", ["NA_ME", "English (en)"]],
				[
					{
						header: "NA_ME::English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: [],
					},
				],
			],
			[
				["NA Me::English (en)", ["NA Me", "English (en)"]],
				[
					{
						header: "NA Me::English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: [],
					},
				],
			],
			// Unknown columns - has : delimiter.
			[
				["name:English (en)", ["name", "English (en)"]],
				[
					{
						header: "name:English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: [],
					},
				],
			],
			[
				["NA_ME:English (en)", ["NA_ME", "English (en)"]],
				[
					{
						header: "NA_ME:English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: [],
					},
				],
			],
			[
				["NA Me:English (en)", ["NA Me", "English (en)"]],
				[
					{
						header: "NA Me:English (en)",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: [],
					},
				],
			],
			// Unknown columns - has jr: prefix.
			[
				["jr:NAME", ["jr:NAME"]],
				[
					{
						header: "jr:NAME",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: [],
					},
				],
			],
			[
				["jr:NA_ME", ["jr:NA_ME"]],
				[
					{
						header: "jr:NA_ME",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: [],
					},
				],
			],
			[
				["jr:NA Me", ["jr:NA Me"]],
				[
					{
						header: "jr:NA Me",
						useDoubleColon: false,
						headerAliases: {},
						headerColumns: [],
					},
				],
			],
		];

		for (const [expected, cases] of caseGroups) {
			for (const c of cases) {
				const result = processHeaderFull(
					c.header,
					c.useDoubleColon,
					c.headerAliases,
					c.headerColumns,
				);
				expect(result[0], `newHeader for ${c.header}`).toEqual(expected[0]);
				expect(result[1], `tokens for ${c.header}`).toEqual(expected[1]);
			}
		}
	});

	it("should find headers are split based on whether a double colon is found", () => {
		const cases: [
			Record<string, string>[], // sheet data
			string[][], // expected headers
			Record<string, unknown>[], // expected data
		][] = [
			// No delimiter
			[
				[{ col1: "val1", col2: "val2" }],
				[["col1"], ["col2"]],
				[{ col1: "val1", col2: "val2" }],
			],
			// Double colon before/after no delimiter
			[
				[{ "col1::sep1": "val1", col2: "val2" }],
				[["col1", "sep1"], ["col2"]],
				[{ col1: { sep1: "val1" }, col2: "val2" }],
			],
			[
				[{ col1: "val1", "col2::sep2": "val2" }],
				[["col1"], ["col2", "sep2"]],
				[{ col1: "val1", col2: { sep2: "val2" } }],
			],
			// Single colon before/after no delimiter
			[
				[{ "col1:sep1": "val1", col2: "val2" }],
				[["col1", "sep1"], ["col2"]],
				[{ col1: { sep1: "val1" }, col2: "val2" }],
			],
			[
				[{ col1: "val1", "col2:sep2": "val2" }],
				[["col1"], ["col2", "sep2"]],
				[{ col1: "val1", col2: { sep2: "val2" } }],
			],
			// Single colon before/after double
			[
				[{ "col1:sep1": "val1", "col2::sep2": "val2" }],
				[["col1:sep1"], ["col2", "sep2"]],
				[{ "col1:sep1": "val1", col2: { sep2: "val2" } }],
			],
			[
				[{ "col1::sep1": "val1", "col2:sep2": "val2" }],
				[["col1", "sep1"], ["col2:sep2"]],
				[{ col1: { sep1: "val1" }, "col2:sep2": "val2" }],
			],
			// No delimiter, jr: prefix with single/double colon
			[
				[{ col1: "val1", "jr:col2:sep2": "val2" }],
				[["col1"], ["jr:col2", "sep2"]],
				[{ col1: "val1", "jr:col2": { sep2: "val2" } }],
			],
			[
				[{ "jr:col2:sep2": "val2", col1: "val1" }],
				[["jr:col2", "sep2"], ["col1"]],
				[{ "jr:col2": { sep2: "val2" }, col1: "val1" }],
			],
			[
				[{ col1: "val1", "jr:col2::sep2": "val2" }],
				[["col1"], ["jr:col2", "sep2"]],
				[{ col1: "val1", "jr:col2": { sep2: "val2" } }],
			],
			[
				[{ "jr:col2::sep2": "val2", col1: "val1" }],
				[["jr:col2", "sep2"], ["col1"]],
				[{ "jr:col2": { sep2: "val2" }, col1: "val1" }],
			],
			// Single colon, jr: prefix with single/double colon
			[
				[{ "col1:sep1": "val1", "jr:col2:sep2": "val2" }],
				[
					["col1", "sep1"],
					["jr:col2", "sep2"],
				],
				[{ col1: { sep1: "val1" }, "jr:col2": { sep2: "val2" } }],
			],
			[
				[{ "jr:col2:sep2": "val2", "col1:sep1": "val1" }],
				[
					["jr:col2", "sep2"],
					["col1", "sep1"],
				],
				[{ "jr:col2": { sep2: "val2" }, col1: { sep1: "val1" } }],
			],
			[
				[{ "col1:sep1": "val1", "jr:col2::sep2": "val2" }],
				[["col1:sep1"], ["jr:col2", "sep2"]],
				[{ "col1:sep1": "val1", "jr:col2": { sep2: "val2" } }],
			],
			[
				[{ "jr:col2::sep2": "val2", "col1:sep1": "val1" }],
				[["jr:col2", "sep2"], ["col1:sep1"]],
				[{ "jr:col2": { sep2: "val2" }, "col1:sep1": "val1" }],
			],
			// Double colon, jr: prefix with single/double colon
			[
				[{ "col1::sep1": "val1", "jr:col2:sep2": "val2" }],
				[["col1", "sep1"], ["jr:col2:sep2"]],
				[{ col1: { sep1: "val1" }, "jr:col2:sep2": "val2" }],
			],
			[
				[{ "jr:col2:sep2": "val2", "col1::sep1": "val1" }],
				[["jr:col2:sep2"], ["col1", "sep1"]],
				[{ "jr:col2:sep2": "val2", col1: { sep1: "val1" } }],
			],
			[
				[{ "col1::sep1": "val1", "jr:col2::sep2": "val2" }],
				[
					["col1", "sep1"],
					["jr:col2", "sep2"],
				],
				[{ col1: { sep1: "val1" }, "jr:col2": { sep2: "val2" } }],
			],
			[
				[{ "jr:col2::sep2": "val2", "col1::sep1": "val1" }],
				[
					["jr:col2", "sep2"],
					["col1", "sep1"],
				],
				[{ "jr:col2": { sep2: "val2" }, col1: { sep1: "val1" } }],
			],
		];

		for (let i = 0; i < cases.length; i++) {
			const [sheetData, expectedHeaders, expectedData] = cases[i];
			const sheetHeader = [
				Object.fromEntries(Object.keys(sheetData[0]).map((k) => [k, null])),
			];
			const observed = dealiasAndGroupSheet(
				"test",
				sheetData,
				sheetHeader,
				{},
				new Set(),
			);
			expect(observed.headers, `case ${i} headers`).toEqual(expectedHeaders);
			expect(observed.data, `case ${i} data`).toEqual(expectedData);
		}
	});

	it("should raise an error if incomplete header info is provided (unit)", () => {
		expect(() => {
			processRow(
				"survey",
				{ a: "b", c: "d", e: "f" },
				{ a: ["a"], c: ["b", "z"] },
				2,
			);
		}).toThrow(
			"Invalid headers provided for sheet: 'survey'. For XLSForms, this may be due " +
				"a missing header row, in which case add a header row as per the reference template " +
				"https://xlsform.org/en/ref-table/. For internal API usage, may be due to a missing " +
				"mapping for 'e', in which case ensure that the full set of headers appear " +
				"within the first 100 rows, or specify the header row in 'survey_header'.",
		);
	});

	it("should find that non-XLSForm choices columns are not changed", () => {
		assertPyxformXform({
			md: `
				| survey  |
				|         | type          | name | label | choice_filter |
				|         | text          | q0   | Q0    |               |
				|         | select_one c1 | q1   | Q1    | \${q0} = CF or \${q0} = A_B or \${q0} = Cd or \${q0} = h-I or \${q0} = J.k |
				| choices |
				|         | list name | name | label | CF | A_B | Cd | e f | h-I | J.k |
				|         | c1        | na   | la    | a1 | a2  | a3 | a4  | a5  | a6  |
				|         | c1        | nb   | lb    | b1 | b2  | b3 | b4  | b5  | b6  |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:instance[@id = 'c1']/x:root/x:item[
				  ./x:name = 'na'
				  and not(*[not(
				    local-name()='name'
				    or local-name()='label'
				    or local-name()='CF'
				    or local-name()='A_B'
				    or local-name()='Cd'
				    or local-name()='h-I'
				    or local-name()='J.k'
				  )])
				]
				`,
			],
			warnings__contains: ["e f"],
		});
	});

	it("should raise an error if incomplete header info is provided via markdown", () => {
		const header = `
			| survey |
		`;
		const question = (i: number, e: string) =>
			`|        | text | q${i} | Q${i}  | ${e} |`;
		const questions = Array.from({ length: 100 }, (_, i) =>
			question(i, ""),
		).join("\n");
		const md = `${header}\n${questions}\n${question(101, "?")}`;
		assertPyxformXform({
			md,
			errored: true,
			error__contains: ["unknown"],
		});
	});

	it("should not raise an error if complete header info is provided", () => {
		const header = `
			| survey |
			|        | type | name | label | e   |
		`;
		const question = (i: number, e: string) =>
			`|        | text | q${i} | Q${i}  | ${e} |`;
		const questions = Array.from({ length: 100 }, (_, i) =>
			question(i, ""),
		).join("\n");
		const md = `${header}\n${questions}\n${question(101, "?")}`;
		assertPyxformXform({ md });
	});

	it("should raise an error if incomplete header info is provided via dict", () => {
		const surveyData: Record<string, unknown>[] = Array.from(
			{ length: 100 },
			(_, i) => ({
				type: "text",
				name: `q${i}`,
				label: `Q${i}`,
			}),
		);
		surveyData.push({
			type: "text",
			name: "q101",
			label: "Q101",
			e: "?",
		});
		expect(() =>
			convert({
				xlsform: { survey: surveyData },
			}),
		).toThrow("e");
	});
});
