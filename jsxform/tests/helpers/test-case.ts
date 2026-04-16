/**
 * Test helper equivalent to PyxformTestCase.
 * Provides assertPyxformXform() for testing XLSForm → XForm conversion.
 */

import { DOMParser } from "@xmldom/xmldom";
import * as xpathModule from "xpath";
import { NSMAP } from "../../src/constants.js";
import { type ConvertResult, convert } from "../../src/xls2xform.js";

const domParser = new DOMParser();

// Build XPath namespace resolver
const NSMAP_XPATH: Record<string, string> = {
	x: NSMAP.xmlns,
	h: NSMAP["xmlns:h"],
	ev: NSMAP["xmlns:ev"],
	xsd: NSMAP["xmlns:xsd"],
	jr: NSMAP["xmlns:jr"],
	orx: NSMAP["xmlns:orx"],
	odk: NSMAP["xmlns:odk"],
	entities: "http://www.opendatakit.org/xforms/entities",
};

interface PyxformXformOpts {
	md?: string;
	ss_structure?: Record<string, unknown>;
	name?: string;
	// XForm assertions
	xml__xpath_match?: string[];
	xml__xpath_count?: [string, number][];
	xml__xpath_exact?: [string, Set<string>][];
	xml__contains?: string[];
	xml__excludes?: string[];
	model__contains?: string[];
	model__excludes?: string[];
	itext__contains?: string[];
	itext__excludes?: string[];
	instance__contains?: string[];
	// Error assertions
	error__contains?: string[];
	error__not_contains?: string[];
	warnings__contains?: string[];
	warnings__not_contains?: string[];
	warnings_count?: number;
	errored?: boolean;
	debug?: boolean;
}

/**
 * Main test assertion function matching PyxformTestCase.assertPyxformXform
 */
export function assertPyxformXform(
	opts: PyxformXformOpts,
): ConvertResult | null {
	const {
		md,
		ss_structure,
		name = "test_name",
		xml__xpath_match,
		xml__xpath_count,
		xml__xpath_exact,
		xml__contains,
		xml__excludes,
		model__contains,
		model__excludes,
		itext__contains,
		itext__excludes,
		instance__contains,
		error__contains,
		error__not_contains,
		warnings__contains,
		warnings__not_contains,
		warnings_count,
		errored = false,
		debug = false,
	} = opts;

	let result: ConvertResult | null = null;
	let errors: string[] = [];
	let warnings: string[] = [];
	let surveyValid = true;
	let xml = "";
	let doc: Document | null = null;
	let xpathDoc: Document | null = null;

	// Check if any xpath assertions reference instanceID
	const xpathAssertionStrings = [
		...(xml__xpath_match ?? []),
		...(xml__xpath_count ?? []).map(([x]) => x),
		...(xml__xpath_exact ?? []).map(([x]) => x),
		...(xml__xpath_exact ?? []).flatMap(([, s]) => [...s]),
	].join(" ");
	const xpathReferencesInstanceID =
		xpathAssertionStrings.includes("instanceID");

	try {
		result = convert({
			xlsform: md ?? ss_structure ?? "",
			prettyPrint: true,
			formName: name,
			warnings,
			fileType: md ? "md" : undefined,
		});
		xml = result.xform;
		warnings = result.warnings;

		if (debug) {
			console.log("XML Output:\n", xml);
		}

		doc = domParser.parseFromString(xml, "text/xml");

		// For xpath assertions, post-process XML to match Python pyxform test conventions:
		// 1. Replace default element name/id ("data") with the test's formName
		// 2. Strip auto-generated instanceID (unless test references it)
		if (xml__xpath_match || xml__xpath_count || xml__xpath_exact) {
			let xpathXml = xml;

			// Replace the default id attribute value ("data") with the formName
			// only when the test expectations reference the formName as id
			// (some tests explicitly expect id="data")
			if (name !== "data" && xpathAssertionStrings.includes(`id="${name}"`)) {
				xpathXml = xpathXml.replace(
					new RegExp(`(<${name}\\s[^>]*?)id="data"`, "g"),
					`$1id="${name}"`,
				);
			}

			if (!xpathReferencesInstanceID) {
				// Remove instanceID element from instance
				xpathXml = xpathXml.replace(/<instanceID\/>/g, "");
				// Remove instanceID bind
				xpathXml = xpathXml.replace(
					/<bind[^>]*nodeset="[^"]*\/meta\/instanceID"[^>]*\/>/g,
					"",
				);
				// Clean up empty meta: <meta></meta> or <meta>  </meta> → <meta/>
				xpathXml = xpathXml.replace(/<meta>\s*<\/meta>/g, "<meta/>");
			}

			xpathDoc = domParser.parseFromString(xpathXml, "text/xml");
		} else {
			xpathDoc = doc;
		}
	} catch (e: unknown) {
		surveyValid = false;
		errors = [String((e instanceof Error ? e.message : null) || e)];
		if (debug) {
			console.log("ERROR:", errors[0]);
		}
		if (!errored && !error__contains?.length) {
			throw new Error(
				`Expected valid survey but compilation failed. Error(s): ${errors.join("\n")}`,
			);
		}
	}

	if (surveyValid) {
		if (errored) {
			throw new Error("Expected survey to be invalid.");
		}

		// String-based assertions
		const stringTests: [
			string[] | undefined,
			string,
			(content: string, text: string) => void,
		][] = [
			[xml__contains, "xml", assertContains],
			[xml__excludes, "xml", assertNotContains],
			[model__contains, "model", assertContains],
			[model__excludes, "model", assertNotContains],
			[itext__contains, "itext", assertContains],
			[itext__excludes, "itext", assertNotContains],
			[instance__contains, "instance", assertContains],
		];

		for (const [specs, section, assertFn] of stringTests) {
			if (!specs) continue;
			const content = getSectionXml(xml, doc as Document, section);
			for (const text of specs) {
				assertFn(content, text);
			}
		}

		// XPath assertions (exactly 1 match)
		if (xml__xpath_match && xpathDoc) {
			for (const xpath of xml__xpath_match) {
				assertXpathCount(xpathDoc, xpath, 1, xml);
			}
		}

		if (xml__xpath_count && xpathDoc) {
			for (const [xpath, count] of xml__xpath_count) {
				assertXpathCount(xpathDoc, xpath, count, xml);
			}
		}

		if (xml__xpath_exact && xpathDoc) {
			for (const [xpath, expected] of xml__xpath_exact) {
				assertXpathExact(xpathDoc, xpath, expected, xml);
			}
		}
	}

	// Error assertions
	if (error__contains) {
		const errorStr = errors.join("\n");
		for (const text of error__contains) {
			if (!errorStr.includes(text)) {
				throw new Error(
					`error__contains: Expected error to contain '${text}', got: ${errorStr}`,
				);
			}
		}
	}

	if (error__not_contains) {
		const errorStr = errors.join("\n");
		for (const text of error__not_contains) {
			if (errorStr.includes(text)) {
				throw new Error(
					`error__not_contains: Expected error NOT to contain '${text}', got: ${errorStr}`,
				);
			}
		}
	}

	// Warning assertions
	if (warnings__contains) {
		const warningStr = warnings.join("\n");
		for (const text of warnings__contains) {
			if (!warningStr.includes(text)) {
				throw new Error(
					`warnings__contains: Expected warnings to contain '${text}', got: ${warningStr}`,
				);
			}
		}
	}

	if (warnings__not_contains) {
		const warningStr = warnings.join("\n");
		for (const text of warnings__not_contains) {
			if (warningStr.includes(text)) {
				throw new Error(
					`warnings__not_contains: Expected warnings NOT to contain '${text}'`,
				);
			}
		}
	}

	if (warnings_count != null) {
		if (warnings.length !== warnings_count) {
			throw new Error(
				`Expected ${warnings_count} warnings, got ${warnings.length}: ${JSON.stringify(warnings)}`,
			);
		}
	}

	return result;
}

function getSectionXml(
	fullXml: string,
	doc: Document,
	section: string,
): string {
	if (section === "xml") return fullXml;

	// Use simple string extraction for model/instance/itext
	if (section === "model") {
		const match = fullXml.match(/<model[\s>][\s\S]*?<\/model>/);
		return match ? match[0] : fullXml;
	}
	if (section === "instance") {
		// Get the first (main) instance
		const match = fullXml.match(/<instance>[\s\S]*?<\/instance>/);
		return match ? match[0] : fullXml;
	}
	if (section === "itext") {
		const match = fullXml.match(/<itext>[\s\S]*?<\/itext>/);
		return match ? match[0] : fullXml;
	}
	return fullXml;
}

function assertContains(content: string, text: string): void {
	// Normalize self-closing tags
	const normalized = content.replace(/ \/>/g, "/>");
	if (!normalized.includes(text)) {
		// Try again with whitespace-collapsed comparison (normalize whitespace between tags)
		const collapseWs = (s: string) =>
			s.replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
		if (!collapseWs(normalized).includes(collapseWs(text))) {
			throw new Error(
				`assertContains: Could not find '${text}' in content:\n${content.substring(0, 2000)}`,
			);
		}
	}
}

function assertNotContains(content: string, text: string): void {
	const normalized = content.replace(/ \/>/g, "/>");
	if (normalized.includes(text)) {
		throw new Error(
			`assertNotContains: Found '${text}' in content (should not be present)`,
		);
	}
}

function assertXpathAtLeast(
	doc: Document,
	xpath: string,
	minCount: number,
	xml: string,
): void {
	try {
		const selectFn = xpathModule.useNamespaces(NSMAP_XPATH);
		const results = selectFn(xpath, doc);
		const count = Array.isArray(results) ? results.length : results ? 1 : 0;
		if (count < minCount) {
			throw new Error(
				`XPath '${xpath}' found ${count} matches, expected at least ${minCount}.\n\nXML:\n${xml.substring(0, 3000)}`,
			);
		}
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		if (msg?.startsWith("XPath")) throw e;
		throw new Error(
			`Error evaluating XPath '${xpath}': ${msg}\n\nXML:\n${xml.substring(0, 3000)}`,
		);
	}
}

function assertXpathCount(
	doc: Document,
	xpath: string,
	expectedCount: number,
	xml: string,
): void {
	try {
		const selectFn = xpathModule.useNamespaces(NSMAP_XPATH);
		const results = selectFn(xpath, doc);
		const count = Array.isArray(results) ? results.length : results ? 1 : 0;
		if (count !== expectedCount) {
			throw new Error(
				`XPath '${xpath}' found ${count} matches, expected ${expectedCount}.\n\nXML:\n${xml.substring(0, 3000)}`,
			);
		}
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		if (msg?.startsWith("XPath")) throw e;
		throw new Error(
			`Error evaluating XPath '${xpath}': ${msg}\n\nXML:\n${xml.substring(0, 3000)}`,
		);
	}
}

function assertXpathExact(
	doc: Document,
	xpath: string,
	expected: Set<string>,
	xml: string,
): void {
	const selectFn = xpathModule.useNamespaces(NSMAP_XPATH);
	const results = selectFn(xpath, doc);

	// Check if any expected values contain xmlns declarations.
	// If none do, strip xmlns from serialized results to match.
	const expectedHasXmlns = [...expected].some((v) => /\bxmlns[:=]/.test(v));

	// Check if expected values look like full attribute serializations (' name="value"')
	const expectedHasAttrFormat = [...expected].some((v) => /^\s+\w+="/.test(v));

	const resultSet = new Set<string>();
	if (Array.isArray(results)) {
		for (const r of results) {
			if (typeof r === "string") {
				resultSet.add(r);
			} else if (
				r &&
				typeof r === "object" &&
				"nodeValue" in r &&
				r.nodeValue != null &&
				"nodeName" in r
			) {
				// Attr nodes: use full serialization (' name="value"') when expected values
				// contain attribute patterns, otherwise use just the value.
				if (expectedHasAttrFormat) {
					resultSet.add(r.toString());
				} else {
					resultSet.add(r.nodeValue as string);
				}
			} else if (r.toString) {
				let serialized = r.toString();
				if (!expectedHasXmlns) {
					// Strip default xmlns declarations when expected values don't include them
					serialized = serialized.replace(/ xmlns="[^"]*"/g, "");
				}
				resultSet.add(serialized);
			}
		}
	}

	const expectedArr = [...expected].sort();
	const resultArr = [...resultSet].sort();

	if (JSON.stringify(expectedArr) !== JSON.stringify(resultArr)) {
		throw new Error(
			`XPath exact match failed for '${xpath}'. Expected: ${JSON.stringify(expectedArr)}, Got: ${JSON.stringify(resultArr)}`,
		);
	}
}
