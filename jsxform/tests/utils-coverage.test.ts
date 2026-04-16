/**
 * Additional tests for utils.ts coverage.
 */

import { describe, expect, it } from "vitest";
import { coalesce, nodeToXml, serializeXml } from "../src/utils.js";

describe("coalesce", () => {
	it("should return first non-null value", () => {
		expect(coalesce(null, "value", "other")).toBe("value");
		expect(coalesce(undefined, 42)).toBe(42);
	});

	it("should return undefined when all args are null/undefined", () => {
		expect(coalesce(null, undefined)).toBeUndefined();
		expect(coalesce(undefined, null, undefined)).toBeUndefined();
	});

	it("should treat 0 and empty string as non-null", () => {
		expect(coalesce(null, 0)).toBe(0);
		expect(coalesce(null, "")).toBe("");
		expect(coalesce(null, false)).toBe(false);
	});
});

describe("nodeToXml", () => {
	it("should render self-closing element with no children", () => {
		// Create a minimal element-like object with no child nodes
		const elem = {
			tagName: "empty",
			attributes: { length: 0, item: () => null },
			childNodes: { length: 0 },
		};
		const result = nodeToXml(elem as never, "", "  ", "\n");
		expect(result).toContain("/>");
		expect(result).not.toContain("</empty>");
	});

	it("should render element-only children with indentation", () => {
		// Element with only element children (no text nodes) → triggers lines 302-316
		const child = {
			tagName: "child",
			nodeType: 1,
			attributes: { length: 0, item: () => null },
			childNodes: { length: 0 },
		};
		const elem = {
			tagName: "parent",
			attributes: { length: 0, item: () => null },
			childNodes: { length: 1, 0: child, [Symbol.iterator]: function* () { yield child; } },
		};
		const result = nodeToXml(elem as never, "", "  ", "\n");
		expect(result).toContain("<parent>");
		expect(result).toContain("</parent>");
		expect(result).toContain("<child/>");
	});
});

describe("serializeXml / formatXml", () => {
	it("should format XML with processing instruction", () => {
		// Serialize full document (not just documentElement) to include <?xml...?> PI → triggers line 362-363
		const { DOMParser } = require("@xmldom/xmldom");
		const doc = new DOMParser().parseFromString(
			'<?xml version="1.0"?><root><child>text</child></root>',
			"text/xml",
		);
		// serializeXml on the document itself to include the PI
		const result = serializeXml(doc, true);
		expect(result).toContain("<?xml");
		expect(result).toContain("<root>");
	});

	it("should not format when prettyPrint is false", () => {
		const { DOMParser } = require("@xmldom/xmldom");
		const doc = new DOMParser().parseFromString("<a><b/></a>", "text/xml");
		const result = serializeXml(doc.documentElement, false);
		expect(result).toContain("<a>");
	});
});

describe("nodeToXml - mixed content", () => {
	it("should handle elements with text and element children (mixed content)", () => {
		// Element with both text nodes and element children → triggers lines 296-300
		const textNode = { nodeType: 3, data: "hello" };
		const elemChild = {
			tagName: "b",
			nodeType: 1,
			attributes: { length: 0, item: () => null },
			childNodes: { length: 0 },
		};
		const textNode2 = { nodeType: 3, data: "world" };
		const elem = {
			tagName: "p",
			attributes: { length: 0, item: () => null },
			childNodes: {
				length: 3,
				0: textNode,
				1: elemChild,
				2: textNode2,
			},
		};
		const result = nodeToXml(elem as never, "", "  ", "\n");
		expect(result).toContain("<p>");
		expect(result).toContain("hello");
		expect(result).toContain("<b/>");
		expect(result).toContain("world");
		expect(result).toContain("</p>");
	});
});
