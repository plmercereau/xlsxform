/**
 * Additional tests for expression.ts and parsing coverage.
 */

import { describe, expect, it } from "vitest";
import {
	hasPyxformReference,
	isPyxformReference,
	isXmlTag,
	parseExpression,
} from "../src/parsing/expression.js";

describe("isXmlTag", () => {
	it("should return true for valid NCName", () => {
		expect(isXmlTag("myElement")).toBe(true);
		expect(isXmlTag("_private")).toBe(true);
		expect(isXmlTag("h:html")).toBe(true);
	});

	it("should return false for invalid names", () => {
		expect(isXmlTag("")).toBe(false);
		expect(isXmlTag("123")).toBe(false);
	});
});

describe("hasPyxformReference", () => {
	it("should detect references", () => {
		expect(hasPyxformReference("${q1}")).toBe(true);
		expect(hasPyxformReference("hello ${name} world")).toBe(true);
	});

	it("should return false for non-references", () => {
		expect(hasPyxformReference("no references")).toBe(false);
		expect(hasPyxformReference("")).toBe(false);
		expect(hasPyxformReference(null as unknown as string)).toBe(false);
	});
});

describe("isPyxformReference", () => {
	it("should identify complete references", () => {
		expect(isPyxformReference("${q1}")).toBe(true);
		expect(isPyxformReference("  ${q1}  ")).toBe(true);
	});

	it("should reject partial references", () => {
		expect(isPyxformReference("text ${q1} more")).toBe(false);
		expect(isPyxformReference("")).toBe(false);
		expect(isPyxformReference(null as unknown as string)).toBe(false);
	});
});

describe("parseExpression - token types", () => {
	it("should parse numbers", () => {
		const tokens = parseExpression("42");
		expect(tokens[0].type).toBe("NUMBER");
		expect(tokens[0].value).toBe("42");
	});

	it("should parse decimal numbers", () => {
		const tokens = parseExpression("3.14");
		expect(tokens[0].type).toBe("NUMBER");
	});

	it("should parse negative numbers", () => {
		const tokens = parseExpression("-5");
		expect(tokens[0].type).toBe("NUMBER");
	});

	it("should parse date literals", () => {
		const tokens = parseExpression("2026-04-16");
		expect(tokens[0].type).toBe("DATE");
	});

	it("should parse datetime literals", () => {
		const tokens = parseExpression("2026-04-16T10:30:00");
		expect(tokens[0].type).toBe("DATETIME");
	});

	it("should parse math operators", () => {
		const tokens = parseExpression("1 + 2");
		const types = tokens.map((t) => t.type);
		expect(types).toContain("OPS_MATH");
	});

	it("should parse comparison operators", () => {
		const tokens = parseExpression(". > 0");
		const types = tokens.map((t) => t.type);
		expect(types).toContain("OPS_COMP");
	});

	it("should parse boolean operators", () => {
		const tokens = parseExpression("a and b or c");
		const types = tokens.map((t) => t.type);
		expect(types).toContain("OPS_BOOL");
	});

	it("should parse function calls", () => {
		const tokens = parseExpression("concat(a, b)");
		expect(tokens[0].type).toBe("FUNC_CALL");
		expect(tokens[0].value).toBe("concat(");
	});

	it("should parse pyxform references", () => {
		const tokens = parseExpression("${q1}");
		expect(tokens[0].type).toBe("PYXFORM_REF");
	});

	it("should parse last-saved references", () => {
		const tokens = parseExpression("${last-saved#field}");
		expect(tokens[0].type).toBe("PYXFORM_REF");
	});

	it("should parse system literals (strings)", () => {
		const tokens = parseExpression("'hello'");
		expect(tokens[0].type).toBe("SYSTEM_LITERAL");
	});

	it("should parse parentheses", () => {
		const tokens = parseExpression("(1)");
		expect(tokens[0].type).toBe("OPEN_PAREN");
		expect(tokens[2].type).toBe("CLOSE_PAREN");
	});

	it("should parse path separators", () => {
		const tokens = parseExpression("/data/q1");
		expect(tokens[0].type).toBe("PATH_SEP");
	});

	it("should parse parent refs", () => {
		const tokens = parseExpression("../q1");
		expect(tokens[0].type).toBe("PARENT_REF");
	});

	it("should parse self refs", () => {
		const tokens = parseExpression(". = 'yes'");
		expect(tokens[0].type).toBe("SELF_REF");
	});

	it("should parse brackets", () => {
		const tokens = parseExpression("[1]");
		expect(tokens[0].type).toBe("BRACKET");
	});

	it("should parse xpath predicates", () => {
		const tokens = parseExpression("item[position() = 1]");
		expect(tokens[0].type).toBe("XPATH_PRED_START");
	});

	it("should parse URI schemes", () => {
		const tokens = parseExpression("jr://images/photo.jpg");
		expect(tokens[0].type).toBe("URI_SCHEME");
	});

	it("should parse complex expressions", () => {
		const tokens = parseExpression("${q1} = 'yes' and count(${items}) > 0");
		expect(tokens.length).toBeGreaterThan(0);
		const types = tokens.map((t) => t.type);
		expect(types).toContain("PYXFORM_REF");
		expect(types).toContain("OPS_BOOL");
		expect(types).toContain("FUNC_CALL");
	});

	it("should parse whitespace tokens", () => {
		const tokens = parseExpression("  ");
		expect(tokens[0].type).toBe("WHITESPACE");
	});

	it("should parse NAME tokens", () => {
		const tokens = parseExpression("myvar");
		expect(tokens[0].type).toBe("NAME");
	});

	it("should handle union operator", () => {
		const tokens = parseExpression("a|b");
		const types = tokens.map((t) => t.type);
		expect(types).toContain("OPS_UNION");
	});

	it("should handle comma", () => {
		const tokens = parseExpression(",");
		expect(tokens[0].type).toBe("COMMA");
	});
});

describe("parseExpression - cache behavior", () => {
	it("should return cached result for same input", () => {
		const result1 = parseExpression("cache_test_expr_1");
		const result2 = parseExpression("cache_test_expr_1");
		expect(result1).toBe(result2); // Same reference = cached
	});

	it("should handle many unique expressions (cache eviction)", () => {
		// Fill cache beyond 128 entries to trigger eviction
		for (let i = 0; i < 135; i++) {
			parseExpression(`unique_expr_coverage_${i}`);
		}
		// Should still work after eviction
		const result = parseExpression("unique_expr_coverage_200");
		expect(result.length).toBeGreaterThan(0);
	});
});
