/**
 * Test helper equivalent to PyxformTestCase.
 * Provides assertPyxformXform() for testing XLSForm → XForm conversion.
 */

import { DOMParser, type Document as XmlDocument } from "@xmldom/xmldom";
import * as xpathModule from "xpath";
import { NSMAP } from "../../src/constants.js";
import { type ConvertResult, convert } from "../../src/conversion/xls2xform.js";

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

// The xpath library declares DOM Node parameters, but xmldom's Document
// is structurally compatible at runtime. We re-type the selector once here
// so call sites don't need individual casts.
type XpathNsSelect = (
	expr: string,
	node: XmlDocument,
) => xpathModule.SelectedValue;
const xpathSelectNs: XpathNsSelect = xpathModule.useNamespaces(
	NSMAP_XPATH,
) as never;

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
}

/**
 * Preprocess XML for XPath assertions to match Python pyxform test conventions:
 * 1. Replace default element name/id ("data") with the test's formName
 * 2. Strip auto-generated instanceID (unless test references it)
 */
function preprocessXpathXml(
	xml: string,
	name: string,
	xpathAssertionStrings: string,
	xpathReferencesInstanceID: boolean,
): XmlDocument {
	let xpathXml = xml;

	if (name !== "data" && xpathAssertionStrings.includes(`id="${name}"`)) {
		xpathXml = xpathXml.replace(
			new RegExp(`(<${name}\\s[^>]*?)id="data"`, "g"),
			`$1id="${name}"`,
		);
	}

	if (!xpathReferencesInstanceID) {
		xpathXml = xpathXml.replace(/<instanceID\/>/g, "");
		xpathXml = xpathXml.replace(
			/<bind[^>]*nodeset="[^"]*\/meta\/instanceID"[^>]*\/>/g,
			"",
		);
		xpathXml = xpathXml.replace(/<meta>\s*<\/meta>/g, "<meta/>");
	}

	return domParser.parseFromString(xpathXml, "text/xml");
}

/** Run string-based assertions (contains/excludes) against XML sections. */
function runStringAssertions(
	opts: PyxformXformOpts,
	xml: string,
	doc: XmlDocument,
): void {
	const stringTests: [
		string[] | undefined,
		string,
		(content: string, text: string) => void,
	][] = [
		[opts.xml__contains, "xml", assertContains],
		[opts.xml__excludes, "xml", assertNotContains],
		[opts.model__contains, "model", assertContains],
		[opts.model__excludes, "model", assertNotContains],
		[opts.itext__contains, "itext", assertContains],
		[opts.itext__excludes, "itext", assertNotContains],
		[opts.instance__contains, "instance", assertContains],
	];

	for (const [specs, section, assertFn] of stringTests) {
		if (!specs) {
			continue;
		}
		const content = getSectionXml(xml, doc, section);
		for (const text of specs) {
			assertFn(content, text);
		}
	}
}

/** Run error-related assertions against collected errors. */
function runErrorAssertions(
	error__contains: string[] | undefined,
	error__not_contains: string[] | undefined,
	errors: string[],
): void {
	const errorStr = errors.join("\n");

	if (error__contains) {
		for (const text of error__contains) {
			if (!errorStr.includes(text)) {
				throw new Error(
					`error__contains: Expected error to contain '${text}', got: ${errorStr}`,
				);
			}
		}
	}

	if (error__not_contains) {
		for (const text of error__not_contains) {
			if (errorStr.includes(text)) {
				throw new Error(
					`error__not_contains: Expected error NOT to contain '${text}', got: ${errorStr}`,
				);
			}
		}
	}
}

/** Run warning-related assertions against collected warnings. */
function runWarningAssertions(
	warnings__contains: string[] | undefined,
	warnings__not_contains: string[] | undefined,
	warnings_count: number | undefined,
	warnings: string[],
): void {
	const warningStr = warnings.join("\n");

	if (warnings__contains) {
		for (const text of warnings__contains) {
			if (!warningStr.includes(text)) {
				throw new Error(
					`warnings__contains: Expected warnings to contain '${text}', got: ${warningStr}`,
				);
			}
		}
	}

	if (warnings__not_contains) {
		for (const text of warnings__not_contains) {
			if (warningStr.includes(text)) {
				throw new Error(
					`warnings__not_contains: Expected warnings NOT to contain '${text}'`,
				);
			}
		}
	}

	if (warnings_count != null && warnings.length !== warnings_count) {
		throw new Error(
			`Expected ${warnings_count} warnings, got ${warnings.length}: ${JSON.stringify(warnings)}`,
		);
	}
}

/** Build the combined XPath assertion string for instanceID detection. */
function buildXpathAssertionStrings(opts: PyxformXformOpts): string {
	return [
		...(opts.xml__xpath_match ?? []),
		...(opts.xml__xpath_count ?? []).map(([x]) => x),
		...(opts.xml__xpath_exact ?? []).map(([x]) => x),
		...(opts.xml__xpath_exact ?? []).flatMap(([, s]) => [...s]),
	].join(" ");
}

interface ConversionState {
	result: ConvertResult | null;
	errors: string[];
	warnings: string[];
	surveyValid: boolean;
	xml: string;
	doc: XmlDocument | null;
	xpathDoc: XmlDocument | null;
}

/** Attempt form conversion and prepare documents for assertions. */
function runConversion(opts: PyxformXformOpts): ConversionState {
	const {
		md,
		ss_structure,
		name = "test_name",
		errored = false,
		error__contains,
	} = opts;
	const state: ConversionState = {
		result: null,
		errors: [],
		warnings: [],
		surveyValid: true,
		xml: "",
		doc: null,
		xpathDoc: null,
	};

	const xpathStr = buildXpathAssertionStrings(opts);
	const refsInstanceID = xpathStr.includes("instanceID");

	try {
		state.result = convert({
			xlsform: md ?? ss_structure ?? "",
			prettyPrint: true,
			formName: name,
			warnings: state.warnings,
			fileType: md ? "md" : undefined,
		});
		state.xml = state.result.xform;
		state.warnings = state.result.warnings;
		state.doc = domParser.parseFromString(state.xml, "text/xml");

		if (
			opts.xml__xpath_match ||
			opts.xml__xpath_count ||
			opts.xml__xpath_exact
		) {
			state.xpathDoc = preprocessXpathXml(
				state.xml,
				name,
				xpathStr,
				refsInstanceID,
			);
		} else {
			state.xpathDoc = state.doc;
		}
	} catch (e: unknown) {
		state.surveyValid = false;
		state.errors = [String((e instanceof Error ? e.message : null) || e)];
		if (!(errored || (error__contains && error__contains.length > 0))) {
			throw new Error(
				`Expected valid survey but compilation failed. Error(s): ${state.errors.join("\n")}`,
			);
		}
	}

	return state;
}

/** Run XPath match, count, and exact assertions. */
function runXpathAssertions(
	opts: PyxformXformOpts,
	xpathDoc: XmlDocument,
	xml: string,
): void {
	if (opts.xml__xpath_match) {
		for (const xpath of opts.xml__xpath_match) {
			assertXpathCount(xpathDoc, xpath, 1, xml);
		}
	}
	if (opts.xml__xpath_count) {
		for (const [xpath, count] of opts.xml__xpath_count) {
			assertXpathCount(xpathDoc, xpath, count, xml);
		}
	}
	if (opts.xml__xpath_exact) {
		for (const [xpath, expected] of opts.xml__xpath_exact) {
			assertXpathExact(xpathDoc, xpath, expected, xml);
		}
	}
}

/**
 * Main test assertion function matching PyxformTestCase.assertPyxformXform
 */
export function assertPyxformXform(
	opts: PyxformXformOpts,
): ConvertResult | null {
	const cs = runConversion(opts);

	if (cs.surveyValid) {
		if (opts.errored) {
			throw new Error("Expected survey to be invalid.");
		}
		runStringAssertions(opts, cs.xml, cs.doc as XmlDocument);
		if (cs.xpathDoc) {
			runXpathAssertions(opts, cs.xpathDoc, cs.xml);
		}
	}

	runErrorAssertions(opts.error__contains, opts.error__not_contains, cs.errors);
	runWarningAssertions(
		opts.warnings__contains,
		opts.warnings__not_contains,
		opts.warnings_count,
		cs.warnings,
	);

	return cs.result;
}

function getSectionXml(
	fullXml: string,
	_doc: XmlDocument,
	section: string,
): string {
	if (section === "xml") {
		return fullXml;
	}

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

function assertXpathCount(
	doc: XmlDocument,
	xpath: string,
	expectedCount: number,
	xml: string,
): void {
	try {
		const results = xpathSelectNs(xpath, doc);
		const count = Array.isArray(results) ? results.length : results ? 1 : 0;
		if (count !== expectedCount) {
			throw new Error(
				`XPath '${xpath}' found ${count} matches, expected ${expectedCount}.\n\nXML:\n${xml.substring(0, 3000)}`,
			);
		}
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		if (msg?.startsWith("XPath")) {
			throw e;
		}
		throw new Error(
			`Error evaluating XPath '${xpath}': ${msg}\n\nXML:\n${xml.substring(0, 3000)}`,
		);
	}
}

/** Serialize a single XPath result node into a string for comparison. */
function serializeXpathResult(
	r: unknown,
	expectedHasAttrFormat: boolean,
	expectedHasXmlns: boolean,
): string | null {
	if (typeof r === "string") {
		return r;
	}

	if (
		r &&
		typeof r === "object" &&
		"nodeValue" in r &&
		(r as { nodeValue: unknown }).nodeValue != null &&
		"nodeName" in r
	) {
		return expectedHasAttrFormat
			? (r as { toString(): string }).toString()
			: ((r as { nodeValue: string }).nodeValue as string);
	}

	if (r && typeof r === "object" && "toString" in r) {
		let serialized = (r as { toString(): string }).toString();
		if (!expectedHasXmlns) {
			serialized = serialized.replace(/ xmlns="[^"]*"/g, "");
		}
		return serialized;
	}

	return null;
}

/** Collect XPath results into a Set of strings for comparison. */
function collectXpathResults(
	results: ReturnType<ReturnType<typeof xpathModule.useNamespaces>>,
	expectedHasAttrFormat: boolean,
	expectedHasXmlns: boolean,
): Set<string> {
	const resultSet = new Set<string>();
	if (!Array.isArray(results)) {
		return resultSet;
	}

	for (const r of results) {
		const serialized = serializeXpathResult(
			r,
			expectedHasAttrFormat,
			expectedHasXmlns,
		);
		if (serialized != null) {
			resultSet.add(serialized);
		}
	}

	return resultSet;
}

function assertXpathExact(
	doc: XmlDocument,
	xpath: string,
	expected: Set<string>,
	_xml: string,
): void {
	const results = xpathSelectNs(xpath, doc);

	const expectedHasXmlns = [...expected].some((v) => /\bxmlns[:=]/.test(v));
	const expectedHasAttrFormat = [...expected].some((v) => /^\s+\w+="/.test(v));

	const resultSet = collectXpathResults(
		results,
		expectedHasAttrFormat,
		expectedHasXmlns,
	);

	const expectedArr = [...expected].sort();
	const resultArr = [...resultSet].sort();

	if (JSON.stringify(expectedArr) !== JSON.stringify(resultArr)) {
		throw new Error(
			`XPath exact match failed for '${xpath}'. Expected: ${JSON.stringify(expectedArr)}, Got: ${JSON.stringify(resultArr)}`,
		);
	}
}
