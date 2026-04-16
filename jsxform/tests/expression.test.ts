/**
 * Port of parsing/test_expression.py - Tests for expression parsing.
 */

import { describe, expect, it } from "vitest";
import { isXmlTag, parseExpression } from "../src/parsing/expression.js";

const tagPositive: [string, string][] = [
	["A", "Single uppercase letter"],
	["ab", "Lowercase letters"],
	["_u", "Leading underscore"],
	["A12", "Leading uppercase letter with digit"],
	["A-1.23", "Leading uppercase letter with hyphen, period, and digit"],
	["Name123-456", "Mixed case, digits, hyphen"],
	// ["𐐀n", "Leading unicode"], // Unicode beyond BMP not supported by JS regex
	["Αλ", "Following unicode"],
	["name:name", "NCName, colon, NCName"],
	[
		"name_with_colon:_and_extras",
		"NCName, colon, NCName (non-letter characters)",
	],
	["nameor", "Contains another parser token (or)"],
	["nameand", "Contains another parser token (and)"],
	["namemod", "Contains another parser token (mod)"],
	["namediv", "Contains another parser token (div)"],
];

const tagNegative: [string, string][] = [
	["", "Empty string"],
	[" ", "Space"],
	["123name", "Leading digit"],
	["-name", "Leading hyphen"],
	[".name", "Leading period"],
	[":name", "Leading colon"],
	["name$", "Invalid character ($)"],
	["name with space", "Invalid character (space)"],
	["na@me", "Invalid character (@)"],
	["na#me", "Invalid character (#)"],
	["name:.name", "Invalid character (in local name)"],
	["-name:name", "Invalid character (in namespace)"],
	["$name:@name", "Invalid character (in both names)"],
	["name:name:name", "Invalid structure (multiple colons)"],
];

/**
 * Lexer test cases - port of tests/fixtures/lexer_cases.py (LexerCases enum).
 * Each entry: [description, expression]
 */
const lexerCases = {
	TEXT01: ["Literal with just alpha characters.", "foo"],
	TEXT02: ["Literal with numeric characters.", "123"],
	TEXT03: ["Literal with alphanumeric characters.", "bar123"],
	TEXT04: [
		"Literal text containing URI; https://github.com/XLSForm/pyxform/issues/533",
		"https://my-site.com",
	],
	TEXT05: ["Literal text containing brackets.", "(https://mysite.com)"],
	TEXT06: ["Literal text containing URI.", "go to https://mysite.com"],
	TEXT07: [
		"Literal text containing various non-operator symbols.",
		"Repeat after me: '~!@#$%^&()_",
	],
	TEXT08: [
		"Literal text containing various non-operator symbols.",
		"not_func$",
	],
	TEXT09: ["Names that look like a math expression.", "f-g"],
	TEXT10: ["Names that look like a math expression.", "f-4"],
	TEXT11: ["Name that looks like a math expression, in a node ref.", "./f-4"],

	DATETIME01: ["Literal date.", "2022-03-14"],
	DATETIME02: ["Literal date, BCE.", "-2022-03-14"],
	DATETIME03: ["Literal time.", "01:02:55"],
	DATETIME04: ["Literal time, UTC.", "01:02:55Z"],
	DATETIME05: ["Literal time, UTC + 0.", "01:02:55+00:00"],
	DATETIME06: ["Literal time, UTC + 10.", "01:02:55+10:00"],
	DATETIME07: ["Literal time, UTC - 7.", "01:02:55-07:00"],
	DATETIME08: ["Literal datetime.", "2022-03-14T01:02:55"],
	DATETIME09: ["Literal datetime, UTC.", "2022-03-14T01:02:55Z"],
	DATETIME10: ["Literal datetime, UTC + 0.", "2022-03-14T01:02:55+00:00"],
	DATETIME11: ["Literal datetime, UTC + 10.", "2022-03-14T01:02:55+10:00"],
	DATETIME12: ["Literal datetime, UTC - 7.", "2022-03-14T01:02:55-07:00"],

	GEO01: ["Literal geopoint.", "32.7377112 -117.1288399 14 5.01"],
	GEO02: [
		"Literal geotrace.",
		"32.7377112 -117.1288399 14 5.01;32.7897897 -117.9876543 14 5.01",
	],
	GEO03: [
		"Literal geoshape.",
		"32.7377112 -117.1288399 14 5.01;32.7897897 -117.9876543 14 5.01;32.1231231 -117.1145877 14 5.01",
	],

	DYNAMIC01: ["Function call with no args.", "random()"],
	DYNAMIC02: ["Function with mixture of quotes.", `ends-with('mystr', "str")`],
	DYNAMIC03: ["Function with node paths.", "ends-with(../t2, ./t4)"],
	DYNAMIC04: [
		"Namespaced function. Although jr:itext probably does nothing?",
		"jr:itext('/test/ref_text:label')",
	],
	DYNAMIC05: [
		"Compound expression with functions, operators, numeric/string literals.",
		"if(../t2 = 'test', 1, 2) + 15 - int(1.2)",
	],
	DYNAMIC06: [
		"Compound expression with a literal first.",
		"1 + decimal-date-time(now())",
	],
	DYNAMIC07: [
		"Nested function calls.",
		`concat(if(../t1 = "this", 'go', "to"), "https://mysite.com")`,
	],
	DYNAMIC08: ["Two constants in a math expression.", "7 - 4"],
	DYNAMIC09: ["Two constants in a math expression (mod).", "3 mod 3"],
	DYNAMIC10: ["Two constants in a math expression (div).", "5 div 5"],
	DYNAMIC11: ["3 or more constants in a math expression.", "2 + 3 * 4"],
	DYNAMIC12: ["3 or more constants in a math expression.", "5 div 5 - 5"],
	DYNAMIC13: ["Two constants, with a function call.", "random() + 2 * 5"],
	DYNAMIC14: ["Node path with operator and constant.", "./f - 4"],
	DYNAMIC15: ["Two node paths with operator.", "../t2 - ./t4"],
	DYNAMIC16: ["Complex math expression.", "1 + 2 - 3 * 4 div 5 mod 6"],
	DYNAMIC17: ["Function with date type result.", "concat('2022-03', '-14')"],
	DYNAMIC18: ["Pyxform reference.", "${ref_text}"],
	DYNAMIC19: ["Pyxform reference.", "${ref_int}"],
	DYNAMIC20: ["Pyxform reference, with last-saved.", "${last-saved#ref_text}"],
	DYNAMIC21: [
		"Pyxform reference, with last-saved, inside a function.",
		"if(${last-saved#ref_int} = '', 0, ${last-saved#ref_int} + 1)",
	],
} as const;

type LexerCaseKey = keyof typeof lexerCases;

/**
 * Expected token type sequences - port of ExpectedTokens enum from test_expression.py.
 * Maps LexerCases key -> expected token types tuple.
 */
const expectedTokens: Record<string, [LexerCaseKey, string[]]> = {
	TEXT01: ["TEXT01", ["NAME"]],
	TEXT02: ["TEXT02", ["NUMBER"]],
	TEXT03: ["TEXT03", ["NAME"]],
	TEXT04: ["TEXT04", ["URI_SCHEME", "NAME"]],
	TEXT05: ["TEXT05", ["OPEN_PAREN", "URI_SCHEME", "NAME", "CLOSE_PAREN"]],
	TEXT06: [
		"TEXT06",
		["NAME", "WHITESPACE", "NAME", "WHITESPACE", "URI_SCHEME", "NAME"],
	],
	TEXT07: [
		"TEXT07",
		[
			"NAME",
			"WHITESPACE",
			"NAME",
			"WHITESPACE",
			"NAME",
			"OTHER",
			"WHITESPACE",
			"OTHER",
			"OTHER",
			"OTHER",
			"OTHER",
			"OTHER",
			"OTHER",
			"OTHER",
			"OTHER",
			"OTHER",
			"OPEN_PAREN",
			"CLOSE_PAREN",
			"NAME",
		],
	],
	TEXT08: ["TEXT08", ["NAME", "OTHER"]],
	TEXT09: ["TEXT09", ["NAME"]],
	TEXT10: ["TEXT10", ["NAME"]],
	TEXT11: ["TEXT11", ["SELF_REF", "PATH_SEP", "NAME"]],

	DATETIME01: ["DATETIME01", ["DATE"]],
	DATETIME02: ["DATETIME02", ["DATE"]],
	DATETIME03: ["DATETIME03", ["TIME"]],
	DATETIME04: ["DATETIME04", ["TIME"]],
	DATETIME05: ["DATETIME05", ["TIME"]],
	DATETIME06: ["DATETIME06", ["TIME"]],
	DATETIME07: ["DATETIME07", ["TIME"]],
	DATETIME08: ["DATETIME08", ["DATETIME"]],
	DATETIME09: ["DATETIME09", ["DATETIME"]],
	DATETIME10: ["DATETIME10", ["DATETIME"]],
	DATETIME11: ["DATETIME11", ["DATETIME"]],
	DATETIME12: ["DATETIME12", ["DATETIME"]],

	GEO01: [
		"GEO01",
		[
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
		],
	],
	GEO02: [
		"GEO02",
		[
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
			"OTHER",
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
		],
	],
	GEO03: [
		"GEO03",
		[
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
			"OTHER",
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
			"OTHER",
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
			"WHITESPACE",
			"NUMBER",
		],
	],

	DYNAMIC01: ["DYNAMIC01", ["FUNC_CALL", "CLOSE_PAREN"]],
	DYNAMIC02: [
		"DYNAMIC02",
		[
			"FUNC_CALL",
			"SYSTEM_LITERAL",
			"COMMA",
			"WHITESPACE",
			"SYSTEM_LITERAL",
			"CLOSE_PAREN",
		],
	],
	DYNAMIC03: [
		"DYNAMIC03",
		[
			"FUNC_CALL",
			"PARENT_REF",
			"PATH_SEP",
			"NAME",
			"COMMA",
			"WHITESPACE",
			"SELF_REF",
			"PATH_SEP",
			"NAME",
			"CLOSE_PAREN",
		],
	],
	DYNAMIC04: ["DYNAMIC04", ["FUNC_CALL", "SYSTEM_LITERAL", "CLOSE_PAREN"]],
	DYNAMIC05: [
		"DYNAMIC05",
		[
			"FUNC_CALL",
			"PARENT_REF",
			"PATH_SEP",
			"NAME",
			"WHITESPACE",
			"OPS_COMP",
			"WHITESPACE",
			"SYSTEM_LITERAL",
			"COMMA",
			"WHITESPACE",
			"NUMBER",
			"COMMA",
			"WHITESPACE",
			"NUMBER",
			"CLOSE_PAREN",
			"WHITESPACE",
			"OPS_MATH",
			"WHITESPACE",
			"NUMBER",
			"WHITESPACE",
			"OPS_MATH",
			"WHITESPACE",
			"FUNC_CALL",
			"NUMBER",
			"CLOSE_PAREN",
		],
	],
	DYNAMIC06: [
		"DYNAMIC06",
		[
			"NUMBER",
			"WHITESPACE",
			"OPS_MATH",
			"WHITESPACE",
			"FUNC_CALL",
			"FUNC_CALL",
			"CLOSE_PAREN",
			"CLOSE_PAREN",
		],
	],
	DYNAMIC07: [
		"DYNAMIC07",
		[
			"FUNC_CALL",
			"FUNC_CALL",
			"PARENT_REF",
			"PATH_SEP",
			"NAME",
			"WHITESPACE",
			"OPS_COMP",
			"WHITESPACE",
			"SYSTEM_LITERAL",
			"COMMA",
			"WHITESPACE",
			"SYSTEM_LITERAL",
			"COMMA",
			"WHITESPACE",
			"SYSTEM_LITERAL",
			"CLOSE_PAREN",
			"COMMA",
			"WHITESPACE",
			"SYSTEM_LITERAL",
			"CLOSE_PAREN",
		],
	],
	DYNAMIC08: [
		"DYNAMIC08",
		["NUMBER", "WHITESPACE", "OPS_MATH", "WHITESPACE", "NUMBER"],
	],
	DYNAMIC09: ["DYNAMIC09", ["NUMBER", "OPS_MATH", "NUMBER"]],
	DYNAMIC10: ["DYNAMIC10", ["NUMBER", "OPS_MATH", "NUMBER"]],
	DYNAMIC11: [
		"DYNAMIC11",
		[
			"NUMBER",
			"WHITESPACE",
			"OPS_MATH",
			"WHITESPACE",
			"NUMBER",
			"WHITESPACE",
			"OPS_MATH",
			"WHITESPACE",
			"NUMBER",
		],
	],
	DYNAMIC12: [
		"DYNAMIC12",
		[
			"NUMBER",
			"OPS_MATH",
			"NUMBER",
			"WHITESPACE",
			"OPS_MATH",
			"WHITESPACE",
			"NUMBER",
		],
	],
	DYNAMIC13: [
		"DYNAMIC13",
		[
			"FUNC_CALL",
			"CLOSE_PAREN",
			"WHITESPACE",
			"OPS_MATH",
			"WHITESPACE",
			"NUMBER",
			"WHITESPACE",
			"OPS_MATH",
			"WHITESPACE",
			"NUMBER",
		],
	],
	DYNAMIC14: [
		"DYNAMIC14",
		[
			"SELF_REF",
			"PATH_SEP",
			"NAME",
			"WHITESPACE",
			"OPS_MATH",
			"WHITESPACE",
			"NUMBER",
		],
	],
	DYNAMIC15: [
		"DYNAMIC15",
		[
			"PARENT_REF",
			"PATH_SEP",
			"NAME",
			"WHITESPACE",
			"OPS_MATH",
			"WHITESPACE",
			"SELF_REF",
			"PATH_SEP",
			"NAME",
		],
	],
	DYNAMIC16: [
		"DYNAMIC16",
		[
			"NUMBER",
			"WHITESPACE",
			"OPS_MATH",
			"WHITESPACE",
			"NUMBER",
			"WHITESPACE",
			"OPS_MATH",
			"WHITESPACE",
			"NUMBER",
			"WHITESPACE",
			"OPS_MATH",
			"WHITESPACE",
			"NUMBER",
			"OPS_MATH",
			"NUMBER",
			"OPS_MATH",
			"NUMBER",
		],
	],
	DYNAMIC17: [
		"DYNAMIC17",
		[
			"FUNC_CALL",
			"SYSTEM_LITERAL",
			"COMMA",
			"WHITESPACE",
			"SYSTEM_LITERAL",
			"CLOSE_PAREN",
		],
	],
	DYNAMIC18: ["DYNAMIC18", ["PYXFORM_REF"]],
	DYNAMIC19: ["DYNAMIC19", ["PYXFORM_REF"]],
	DYNAMIC20: ["DYNAMIC20", ["PYXFORM_REF"]],
	DYNAMIC21: [
		"DYNAMIC21",
		[
			"FUNC_CALL",
			"PYXFORM_REF",
			"WHITESPACE",
			"OPS_COMP",
			"WHITESPACE",
			"SYSTEM_LITERAL",
			"COMMA",
			"WHITESPACE",
			"NUMBER",
			"COMMA",
			"WHITESPACE",
			"PYXFORM_REF",
			"WHITESPACE",
			"OPS_MATH",
			"WHITESPACE",
			"NUMBER",
			"CLOSE_PAREN",
		],
	],
};

describe("TestExpression", () => {
	it("test_is_xml_tag__positive", () => {
		for (const [tag, description] of tagPositive) {
			expect(isXmlTag(tag), `Expected true for: ${description} (${tag})`).toBe(
				true,
			);
		}
	});

	it("test_is_xml_tag__negative", () => {
		for (const [tag, description] of tagNegative) {
			expect(isXmlTag(tag), `Expected false for: ${description} (${tag})`).toBe(
				false,
			);
		}
	});

	it("test_parse_expression", () => {
		for (const [caseKey, tokenTypes] of Object.values(expectedTokens)) {
			const [description, expression] = lexerCases[caseKey];
			const result = parseExpression(expression);
			const resultTypes = result.map((t) => t.type);
			expect(resultTypes, `${description} (${expression})`).toEqual(tokenTypes);
		}
	});
});
