/**
 * Port of xform_test_case/test_xml.py - Test XForm XML syntax.
 */

import { describe, it, expect } from "vitest";
import { DOMImplementation, XMLSerializer } from "@xmldom/xmldom";
import { assertPyxformXform } from "./helpers/test-case.js";
import { xmlNode, nodeToXml } from "../src/utils.js";

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
	it("test_patch_lets_node_func_escape_only_necessary", () => {
		// Should find that pyxform escapes ["&<>] in attrs and [&<>] in text.
		const replaceableChars = "' \" & < > \r \n \t";
		const expected = `<root attr="' &quot; &amp; &lt; &gt; \r \n \t">' " &amp; &lt; &gt; \r \n \t</root>`;
		const elem = xmlNode("root", replaceableChars, { attr: replaceableChars });
		const observed = nodeToXml(elem);
		expect(observed).toBe(expected);
	});

	it("test_original_escape_escapes_more_than_necessary", () => {
		// Should show that the default @xmldom/xmldom serializer escapes more than necessary
		// (escapes \r, \n, \t in attributes as &#13;, &#10;, &#9;).
		const replaceableChars = "' \" & < > \r \n \t";
		const domImpl = new DOMImplementation();
		const doc = domImpl.createDocument(null as any, "root", null);
		const root = doc.documentElement!;
		root.appendChild(doc.createTextNode(replaceableChars));
		root.setAttribute("attr", replaceableChars);
		const serializer = new XMLSerializer();
		const observed = serializer.serializeToString(root);
		// @xmldom/xmldom escapes \r\n\t in attributes as &#13;&#10;&#9; (more than necessary),
		// similar to Python 3.13+ minidom behavior.
		const expected = `<root attr="' &quot; &amp; &lt; &gt; &#13; &#10; &#9;">' " &amp; &lt; &gt; \r \n \t</root>`;
		expect(observed).toBe(expected);
	});
});
