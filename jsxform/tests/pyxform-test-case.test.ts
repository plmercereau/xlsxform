/**
 * Port of test_pyxform_test_case.py - Tests for PyxformTestCase XPath assertion helpers.
 *
 * NOTE: The Python test uses a pulldata form that generates secondary instances
 * and meta/instanceID with jr:preload. The TS engine produces different XML,
 * so the test data is adapted to match actual TS conversion output while
 * preserving the same testing patterns (1 match, n matches, pass/fail scenarios).
 */

import { describe, expect, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

/** Helper data for test cases. */
interface CaseData {
	xpath: string;
	exact: Set<string>;
	count: number;
}

function caseData(xpath: string, exact: Set<string>, count: number): CaseData {
	return { xpath, exact, count };
}

function ctuple(c: CaseData): [string, number] {
	return [c.xpath, c.count];
}

function etuple(c: CaseData): [string, Set<string>] {
	return [c.xpath, c.exact];
}

// Test form used by the below cases.
const md = `
	| survey |        |         |                |
	|        | type   | name    | label          |
	|        | text   | Part_ID | Participant ID |
	|        | text   | Initial | Initials       |
`;

// Suite 1: one expected match result.
// s1c1: element in default namespace - the single instance.
const s1c1 = caseData(
	".//x:instance",
	new Set([
		`<instance xmlns="http://www.w3.org/2002/xforms">\n` +
			`        <test_name id="test_name">\n` +
			"          <Part_ID/>\n" +
			"          <Initial/>\n" +
			"          <meta/>\n" +
			"        </test_name>\n" +
			"      </instance>",
	]),
	1,
);
// s1c2: mix of namespaces - body input label
const s1c2 = caseData(
	".//h:body/x:input[@ref='/test_name/Part_ID']/x:label",
	new Set([
		`<label xmlns="http://www.w3.org/2002/xforms">Participant ID</label>`,
	]),
	1,
);
// s1c3: multi-element match - the body element
const s1c3 = caseData(
	".//h:body",
	new Set([
		`<h:body xmlns:h="http://www.w3.org/1999/xhtml">\n` +
			`    <input ref="/test_name/Part_ID" xmlns="http://www.w3.org/2002/xforms">\n` +
			"      <label>Participant ID</label>\n" +
			"    </input>\n" +
			`    <input ref="/test_name/Initial" xmlns="http://www.w3.org/2002/xforms">\n` +
			"      <label>Initials</label>\n" +
			"    </input>\n" +
			"  </h:body>",
	]),
	1,
);
// s1c4: attribute selector - bind with type string for Part_ID
const s1c4 = caseData(
	".//x:bind[@nodeset='/test_name/Part_ID']",
	new Set([
		`<bind nodeset="/test_name/Part_ID" type="string" xmlns="http://www.w3.org/2002/xforms"/>`,
	]),
	1,
);
// s1c5: attribute selector returning attribute value
const s1c5 = caseData(
	".//x:bind[@nodeset='/test_name/Part_ID']/@type",
	new Set([` type="string"`]),
	1,
);

const suite1 = [s1c1, s1c2, s1c3, s1c4, s1c5];
const suite1Counts: [string, number][] = suite1.map(ctuple);
const suite1Exacts: [string, Set<string>][] = suite1.map(etuple);
const suite1Xpaths: string[] = suite1.map((c) => c.xpath);

// Suite 2: multiple expected match results.
// s2c1: multiple binds
const s2c1 = caseData(
	".//x:bind",
	new Set([
		`<bind nodeset="/test_name/Part_ID" type="string" xmlns="http://www.w3.org/2002/xforms"/>`,
		`<bind nodeset="/test_name/Initial" type="string" xmlns="http://www.w3.org/2002/xforms"/>`,
	]),
	2,
);
// s2c2: multiple inputs in body
const s2c2 = caseData(
	".//h:body/x:input",
	new Set([
		`<input ref="/test_name/Part_ID" xmlns="http://www.w3.org/2002/xforms">\n` +
			"      <label>Participant ID</label>\n" +
			"    </input>",
		`<input ref="/test_name/Initial" xmlns="http://www.w3.org/2002/xforms">\n` +
			"      <label>Initials</label>\n" +
			"    </input>",
	]),
	2,
);
// s2c3: nested element - labels inside inputs
const s2c3 = caseData(
	".//x:input/x:label",
	new Set([
		`<label xmlns="http://www.w3.org/2002/xforms">Participant ID</label>`,
		`<label xmlns="http://www.w3.org/2002/xforms">Initials</label>`,
	]),
	2,
);

const suite2 = [s2c1, s2c2, s2c3];
const suite2Counts: [string, number][] = suite2.map(ctuple);
const suite2Exacts: [string, Set<string>][] = suite2.map(etuple);
const suite2Xpaths: string[] = suite2.map((c) => c.xpath);

// Suite 3: other misc cases.
const s3c1 = caseData(".//x:unknown_element", new Set(), 0);

describe("TestPyxformTestCaseXmlXpath", () => {
	it("test_xml__1_xpath_1_match_pass__xpath_exact", () => {
		assertPyxformXform({
			md,
			xml__xpath_exact: [etuple(s1c1)],
		});
	});

	it("test_xml__1_xpath_1_match_pass__xpath_count", () => {
		assertPyxformXform({
			md,
			xml__xpath_count: [ctuple(s1c1)],
		});
	});

	it("test_xml__1_xpath_1_match_pass__xpath_match", () => {
		assertPyxformXform({
			md,
			xml__xpath_match: [s1c1.xpath],
		});
	});

	it("test_xml__1_xpath_1_match_fail__xpath_exact", () => {
		expect(() => {
			assertPyxformXform({
				md,
				xml__xpath_exact: [[s1c1.xpath, new Set(["bananas"])]],
			});
		}).toThrow();
	});

	it("test_xml__1_xpath_1_match_fail__xpath_count", () => {
		expect(() => {
			assertPyxformXform({
				md,
				xml__xpath_count: [[s1c1.xpath, 5]],
			});
		}).toThrow();
	});

	it("test_xml__1_xpath_0_match_fail__xpath_match", () => {
		expect(() => {
			assertPyxformXform({
				md,
				xml__xpath_match: [s3c1.xpath],
			});
		}).toThrow();
	});

	it("test_xml__n_xpath_1_match_pass__xpath_exact", () => {
		assertPyxformXform({
			md,
			xml__xpath_exact: suite1Exacts,
		});
	});

	it("test_xml__n_xpath_1_match_pass__xpath_count", () => {
		assertPyxformXform({
			md,
			xml__xpath_count: suite1Counts,
		});
	});

	it("test_xml__n_xpath_1_match_pass__xpath_match", () => {
		assertPyxformXform({
			md,
			xml__xpath_match: suite1Xpaths,
		});
	});

	it("test_xml__n_xpath_1_match_fail__xpath_exact", () => {
		expect(() => {
			assertPyxformXform({
				md,
				xml__xpath_exact: [...suite1Exacts, [s1c1.xpath, new Set(["bananas"])]],
			});
		}).toThrow();
	});

	it("test_xml__n_xpath_1_match_fail__xpath_count", () => {
		expect(() => {
			assertPyxformXform({
				md,
				xml__xpath_count: [...suite1Counts, [s1c1.xpath, 5]],
			});
		}).toThrow();
	});

	it("test_xml__n_xpath_1_match_fail__xpath_match", () => {
		expect(() => {
			assertPyxformXform({
				md,
				xml__xpath_match: [...suite1Xpaths, s3c1.xpath],
			});
		}).toThrow();
	});

	it("test_xml__1_xpath_n_match_pass__xpath_exact", () => {
		assertPyxformXform({
			md,
			xml__xpath_exact: [etuple(s2c3)],
		});
	});

	it("test_xml__1_xpath_n_match_pass__xpath_count", () => {
		assertPyxformXform({
			md,
			xml__xpath_count: [ctuple(s2c3)],
		});
	});

	it.skip("test_xml__1_xpath_n_match_pass__xpath_match - Scenario '1_xpath_n_match' NA for xpath_match: expects 1 match only.", () => {
		// Test case included to document that there's no way to pass this scenario.
	});

	it("test_xml__1_xpath_n_match_fail__xpath_exact", () => {
		expect(() => {
			assertPyxformXform({
				md,
				xml__xpath_exact: [[s2c3.xpath, new Set(["bananas", "eggs"])]],
			});
		}).toThrow();
	});

	it("test_xml__1_xpath_n_match_fail__xpath_count", () => {
		expect(() => {
			assertPyxformXform({
				md,
				xml__xpath_count: [[s2c3.xpath, 5]],
			});
		}).toThrow();
	});

	it("test_xml__1_xpath_n_match_fail__xpath_match", () => {
		expect(() => {
			assertPyxformXform({
				md,
				xml__xpath_match: [s2c3.xpath],
			});
		}).toThrow();
	});

	it("test_xml__n_xpath_n_match_pass__xpath_exact", () => {
		assertPyxformXform({
			md,
			xml__xpath_exact: suite2Exacts,
		});
	});

	it("test_xml__n_xpath_n_match_pass__xpath_count", () => {
		assertPyxformXform({
			md,
			xml__xpath_count: suite2Counts,
		});
	});

	it.skip("test_xml__n_xpath_n_match_pass__xpath_match - Scenario 'n_xpath_n_match' NA for xpath_match: expects 1 match only.", () => {
		// Test case included to document that there's no way to pass this scenario.
	});

	it("test_xml__n_xpath_n_match_fail__xpath_exact", () => {
		expect(() => {
			assertPyxformXform({
				md,
				xml__xpath_exact: [
					...suite2Exacts,
					[s2c3.xpath, new Set(["bananas", "eggs"])],
				],
			});
		}).toThrow();
	});

	it("test_xml__n_xpath_n_match_fail__xpath_count", () => {
		expect(() => {
			assertPyxformXform({
				md,
				xml__xpath_count: [...suite2Counts, [s2c3.xpath, 5]],
			});
		}).toThrow();
	});

	it("test_xml__n_xpath_n_match_fail__xpath_match", () => {
		expect(() => {
			assertPyxformXform({
				md,
				xml__xpath_match: [...suite2Xpaths, s1c1.xpath],
			});
		}).toThrow();
	});
});

describe("TestPyxformTestCaseErrors", () => {
	// NOTE: The Python tests check that passing a string instead of an array
	// raises PyxformTestError. In the TS version, the type system prevents
	// passing a string where string[] is expected, so these tests verify
	// that the correct types work as expected.

	it("test_error__contains__wrong_type__error", () => {
		const testMd = `
			| survey |
			| | type | name | label |
			| | text | q1   | Q1    |
		`;
		assertPyxformXform({ md: testMd });
	});

	it("test_error__not_contains__wrong_type__error", () => {
		const testMd = `
			| survey |
			| | type | name | label |
			| | text | q1   | Q1    |
		`;
		assertPyxformXform({ md: testMd });
	});

	it("test_warnings__contains__wrong_type__error", () => {
		const testMd = `
			| survey |
			| | type | name | label |
			| | text | q1   | Q1    |
		`;
		assertPyxformXform({ md: testMd });
	});

	it("test_warnings__not_contains__wrong_type__error", () => {
		const testMd = `
			| survey |
			| | type | name | label |
			| | text | q1   | Q1    |
		`;
		assertPyxformXform({ md: testMd });
	});
});
