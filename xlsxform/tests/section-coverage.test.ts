/**
 * Additional tests for section.ts coverage.
 * Targets: repeating template append logic (lines 233-235, 241-243).
 */

import { describe, expect, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";
import { convert } from "./helpers/xls2xform-node.js";

describe("Section - repeating template generation", () => {
	it("should generate repeat template in instance for repeat groups", () => {
		// A repeat section should produce jr:template in the XML instance
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name   | label  |
				|        | begin_repeat | items  | Items  |
				|        | text         | item   | Item   |
				|        | end_repeat   |        |        |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:test_name/x:items[@jr:template='']",
			],
		});
	});

	it("should handle nested repeat inside group for template generation", () => {
		// Group containing a repeat - tests the appendTemplate flag propagation
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name     | label    |
				|        | begin_group  | wrapper  | Wrapper  |
				|        | begin_repeat | items    | Items    |
				|        | text         | item     | Item     |
				|        | end_repeat   |          |          |
				|        | end_group    |          |          |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:test_name/x:wrapper/x:items[@jr:template='']",
			],
		});
	});

	it("should handle repeat with multiple children for template", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type         | name   | label |
				|        | begin_repeat | grp    | Group |
				|        | text         | q1     | Q1    |
				|        | integer      | q2     | Q2    |
				|        | end_repeat   |        |       |
			`,
			prettyPrint: false,
		});
		// The XML should contain the repeat template
		expect(result.xform).toContain("jr:template");
	});
});
