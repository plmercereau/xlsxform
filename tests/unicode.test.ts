/**
 * Port of test_unicode_rtl.py - Unicode string tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("UnicodeStrings", () => {
	it("test_unicode_snowman", () => {
		assertPyxformXform({
			md: `
				| survey |      |         |       |
				|        | type | name    | label |
				|        | text | snowman | \u2603     |
			`,
			xml__contains: ["<label>\u2603</label>"],
		});
	});

	it("test_smart_quotes", () => {
		assertPyxformXform({
			name: "quoth",
			ss_structure: {
				survey: [
					{
						type: "select_one xyz",
						name: "smart_single_quoted",
						label: "\u2018single-quoted\u2019",
					},
					{
						type: "text",
						name: "smart_double_quoted",
						relevant: "selected(\${smart_single_quoted}, 'xxx')",
						label: "\u201cdouble-quoted\u201d",
					},
					{
						type: "integer",
						name: "my_default_is_123",
						label: "my default is 123",
						default: "123",
					},
				],
				choices: [
					{ list_name: "xyz", name: "xxx", label: "\u2018Xxx\u2019" },
					{ list_name: "xyz", name: "yyy", label: "\u201cYyy\u201d" },
				],
				settings: [{ version: "q(\u2018-\u2019)p" }],
			},
			xml__contains: [
				"'single-quoted",
				'"double-quoted"',
				"selected( /quoth/smart_single_quoted , 'xxx')",
				"<my_default_is_123>123</my_default_is_123>",
				"<label>'Xxx'</label>",
				'<label>"Yyy"</label>',
				`version="q('-')p"`,
			],
		});
	});
});
