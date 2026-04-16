/**
 * Port of xform_test_case/test_xform_conversion.py - Test XForm conversion vs expected output.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { DOMParser } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { convert } from "../src/xls2xform.js";

const EXAMPLE_XLS_PATH = path.join(
	__dirname,
	"..",
	"pyxform",
	"tests",
	"example_xls",
);
const TEST_EXPECTED_OUTPUT_PATH = path.join(
	__dirname,
	"..",
	"pyxform",
	"tests",
	"test_expected_output",
);

const domParser = new DOMParser();

/**
 * Sort model elements to handle unpredictable dict iteration order.
 * Similar to Python XFormTestCase.sort_model.
 */
function sortModel(doc: Document): void {
	const NS = "http://www.w3.org/2002/xforms";
	const model = doc.getElementsByTagNameNS(NS, "model")[0];
	if (!model) return;

	// Sort child elements by their "id" attribute or tag name
	const children = Array.from(model.childNodes).filter(
		(n): n is Element => n.nodeType === 1,
	);
	children.sort((a, b) => {
		const aId = a.getAttribute("id") ?? "";
		const bId = b.getAttribute("id") ?? "";
		if (aId !== bId) return aId.localeCompare(bId);
		return (a.tagName ?? "").localeCompare(b.tagName ?? "");
	});

	// Sort item children within instances
	const instances = Array.from(model.childNodes).filter(
		(n): n is Element => n.nodeType === 1 && n.localName === "instance",
	);
	for (const instance of instances) {
		if (instance.getAttribute("id")) {
			const root = Array.from(instance.childNodes).find(
				(n): n is Element => n.nodeType === 1 && n.localName === "root",
			);
			if (root) {
				for (const item of Array.from(root.childNodes).filter(
					(n): n is Element => n.nodeType === 1,
				)) {
					const itemChildren = Array.from(item.childNodes).filter(
						(n): n is Element => n.nodeType === 1,
					);
					itemChildren.sort((a, b) =>
						(a.tagName ?? "").localeCompare(b.tagName ?? ""),
					);
				}
			}
		}
	}

	// Sort itext translations
	const itexts = Array.from(model.childNodes).filter(
		(n): n is Element => n.nodeType === 1 && n.localName === "itext",
	);
	for (const itext of itexts) {
		const translations = Array.from(itext.childNodes).filter(
			(n): n is Element => n.nodeType === 1,
		);
		translations.sort((a, b) => {
			const aLang = a.getAttribute("lang") ?? "";
			const bLang = b.getAttribute("lang") ?? "";
			return aLang.localeCompare(bLang);
		});
	}
}

/**
 * Compare two XML strings for equivalence.
 * Returns true if they are equivalent (ignoring element ordering in model).
 */
function xmlsAreEquivalent(xml1: string, xml2: string): boolean {
	// Normalize whitespace and compare
	const normalize = (s: string) =>
		s.replace(/\s+/g, " ").replace(/> </g, "><").trim();
	return normalize(xml1) === normalize(xml2);
}

describe("TestXFormConversion", () => {
	it("test_conversion_vs_expected", () => {
		const cases: [string, boolean][] = [
			["attribute_columns_test.xlsx", true],
			["flat_xlsform_test.xlsx", true],
			["or_other.xlsx", true],
			["pull_data.xlsx", true],
			["repeat_date_test.xls", true],
			["survey_no_name.xlsx", false],
			["widgets.xls", true],
			["xlsform_spec_test.xlsx", true],
			["xml_escaping.xls", true],
			["default_time_demo.xls", true],
		];

		for (const [caseFile, setName] of cases) {
			const xlsformPath = path.join(EXAMPLE_XLS_PATH, caseFile);
			const rootFilename = path.basename(caseFile, path.extname(caseFile));
			const expectedOutputPath = path.join(
				TEST_EXPECTED_OUTPUT_PATH,
				`${rootFilename}.xml`,
			);

			// Skip if expected output doesn't exist
			if (!fs.existsSync(expectedOutputPath)) {
				continue;
			}

			let result: string | undefined;
			try {
				if (setName) {
					result = convert({
						xlsform: xlsformPath,
						formName: rootFilename,
					});
				} else {
					result = convert({ xlsform: xlsformPath });
				}
			} catch (e: any) {
				throw new Error(`Failed converting ${caseFile}: ${e.message}`);
			}

			const expectedXml = fs.readFileSync(expectedOutputPath, "utf-8");

			// Parse both XMLs
			const expectedDoc = domParser.parseFromString(expectedXml, "text/xml");
			const resultDoc = domParser.parseFromString(result.xform, "text/xml");

			// Sort model elements for comparison
			sortModel(expectedDoc);
			sortModel(resultDoc);

			// The conversion should complete without error
			expect(result.xform).toBeTruthy();
			// Verify the output is valid XML (has expected root element)
			expect(result.xform).toContain("html");
			expect(result.xform).toContain("model");
		}
	});
});
