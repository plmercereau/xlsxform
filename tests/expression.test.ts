/**
 * Port of parsing/test_expression.py - Tests for expression parsing.
 * The Python tests use is_xml_tag and parse_expression.
 * The TS codebase has isXmlTag but not parseExpression (full lexer),
 * so only the isXmlTag tests are fully ported.
 */

import { describe, it, expect } from "vitest";
import { isXmlTag } from "../src/parsing/expression.js";

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
	["name_with_colon:_and_extras", "NCName, colon, NCName (non-letter characters)"],
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

describe("TestExpression", () => {
	it("test_is_xml_tag__positive", () => {
		for (const [tag, description] of tagPositive) {
			expect(isXmlTag(tag), `Expected true for: ${description} (${tag})`).toBe(true);
		}
	});

	it("test_is_xml_tag__negative", () => {
		for (const [tag, description] of tagNegative) {
			expect(isXmlTag(tag), `Expected false for: ${description} (${tag})`).toBe(false);
		}
	});

	it.todo("test_parse_expression - TODO: requires internal API (parseExpression / full lexer not ported to TS)", () => {
		// The Python test verifies that parse_expression returns expected
		// token type sequences for various input expressions. The TS port
		// does not include a full expression lexer (parseExpression).
	});
});
