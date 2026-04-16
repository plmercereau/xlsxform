/**
 * Additional tests for question.ts coverage.
 * Targets: minus exempt types in dynamic default detection (lines 864-867, 878-879).
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("Question - minus exempt types in dynamic defaults", () => {
	it("should not treat minus in date default as dynamic", () => {
		// date type with a default containing minus (like "2024-01-15")
		// should NOT be treated as dynamic (minus is date separator, not math)
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label | default    |
				|        | date | d1   | Date  | 2024-01-15 |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:test_name/x:d1[text()='2024-01-15']",
			],
		});
	});

	it("should not treat minus in dateTime default as dynamic", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type     | name | label     | default             |
				|        | dateTime | dt1  | DateTime  | 2024-01-15T10:30:00 |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:test_name/x:dt1[text()='2024-01-15T10:30:00']",
			],
		});
	});

	it("should not treat minus in geopoint default as dynamic", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type     | name | label    | default                  |
				|        | geopoint | loc  | Location | -1.234 36.789 1500.0 5.0 |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:test_name/x:loc[text()='-1.234 36.789 1500.0 5.0']",
			],
		});
	});

	it("should treat minus with variable ref as dynamic in non-exempt type", () => {
		// integer with expression using minus → should be dynamic (setvalue)
		assertPyxformXform({
			md: `
				| survey |
				|        | type    | name | label | default          |
				|        | integer | a    | A     |                  |
				|        | integer | b    | B     | \${a} - 1        |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:setvalue[@ref='/test_name/b']",
			],
		});
	});
});
