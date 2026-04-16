/**
 * Additional tests for xform-instance-parser.ts coverage.
 */

import { describe, expect, it } from "vitest";
import { parseXformInstance } from "../src/xform-instance-parser.js";

describe("XFormInstanceParser", () => {
	it("should parse a simple instance", () => {
		const xml = `<?xml version="1.0"?><data id="test"><q1>answer1</q1><q2>answer2</q2></data>`;
		const result = parseXformInstance(xml);
		expect(result.q1).toBe("answer1");
		expect(result.q2).toBe("answer2");
	});

	it("should handle nested elements", () => {
		const xml = `<?xml version="1.0"?><data id="test"><group><q1>val</q1></group></data>`;
		const result = parseXformInstance(xml);
		expect(result["group/q1"]).toBe("val");
	});

	it("should handle empty elements as null", () => {
		const xml = `<?xml version="1.0"?><data id="test"><q1></q1></data>`;
		const result = parseXformInstance(xml);
		// Empty element → empty text or null
		expect(result.q1).toBeDefined();
	});

	it("should handle duplicate elements as arrays", () => {
		const xml = `<?xml version="1.0"?><data id="test"><item>a</item><item>b</item></data>`;
		const result = parseXformInstance(xml);
		expect(result["item[1]"]).toBe("a");
		expect(result["item[2]"]).toBe("b");
	});

	it("should handle deeply nested structures", () => {
		const xml = `<?xml version="1.0"?><data id="test"><l1><l2><l3>deep</l3></l2></l1></data>`;
		const result = parseXformInstance(xml);
		expect(result["l1/l2/l3"]).toBe("deep");
	});

	it("should provide _xform_id_string function", () => {
		const xml = `<?xml version="1.0"?><data id="my_form"><q1>val</q1></data>`;
		const result = parseXformInstance(xml);
		const idFn = result._xform_id_string as () => string;
		expect(typeof idFn).toBe("function");
		expect(idFn()).toBe("my_form");
	});

	it("should handle attributes on root element", () => {
		const xml = `<?xml version="1.0"?><data id="test123" version="1"><q1>val</q1></data>`;
		const result = parseXformInstance(xml);
		expect(result.q1).toBe("val");
		const idFn = result._xform_id_string as () => string;
		expect(idFn()).toBe("test123");
	});

	it("should handle whitespace between elements", () => {
		const xml = `<?xml version="1.0"?>
		<data id="test">
			<q1>val1</q1>
			<q2>val2</q2>
		</data>`;
		const result = parseXformInstance(xml);
		expect(result.q1).toBe("val1");
		expect(result.q2).toBe("val2");
	});

	it("should handle three or more duplicate elements (push to existing array)", () => {
		const xml = `<?xml version="1.0"?><data id="test"><item>a</item><item>b</item><item>c</item></data>`;
		const result = parseXformInstance(xml);
		expect(result["item[1]"]).toBe("a");
		expect(result["item[2]"]).toBe("b");
		expect(result["item[3]"]).toBe("c");
	});

	it("should handle arrays of objects in nested elements", () => {
		const xml = `<?xml version="1.0"?><data id="test"><repeat><item><name>a</name></item><item><name>b</name></item></repeat></data>`;
		const result = parseXformInstance(xml);
		expect(result["repeat/item[1]/name"]).toBe("a");
		expect(result["repeat/item[2]/name"]).toBe("b");
	});
});
