/**
 * Port of test_typed_calculates.py - Test that any row with a calculation
 * becomes a calculate of the row's type or of type string if the type is
 * "calculate". A hint or label error should only be thrown for a row without
 * a calculation.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TypedCalculatesTest", () => {
	it("should have type string for xls type calculate", () => {
		assertPyxformXform({
			name: "calculate-type",
			md: `
				| survey |          |      |             |             |
				|        | type     | name | label       | calculation |
				|        | calculate| a    |             | 2 * 2       |
			`,
			xml__contains: [
				'<bind calculate="2 * 2" nodeset="/calculate-type/a" type="string"/>',
			],
		});
	});

	it("should have no body for xls type calculate with label", () => {
		assertPyxformXform({
			name: "calculate-type",
			md: `
				| survey |          |      |             |             |
				|        | type     | name | label       | calculation |
				|        | calculate| a    | A           | 2 * 2       |
			`,
			xml__contains: [
				'<bind calculate="2 * 2" nodeset="/calculate-type/a" type="string"/>',
				"<h:body/>",
			],
		});
	});

	it("should use bind type for non-calculate type with calculation", () => {
		assertPyxformXform({
			name: "non-calculate-type",
			md: `
				| survey |          |      |             |             |
				|        | type     | name | label       | calculation |
				|        | integer  | a    |             | 2 * 2       |
			`,
			xml__contains: [
				'<bind calculate="2 * 2" nodeset="/non-calculate-type/a" type="int"/>',
			],
		});
	});

	it("should have no control for non-calculate type with calculation and no label", () => {
		assertPyxformXform({
			name: "no-label",
			md: `
				| survey |          |      |             |             |
				|        | type     | name | label       | calculation |
				|        | integer  | a    |             | 2 * 2       |
			`,
			instance__contains: ["<a/>"],
			xml__excludes: ["input"],
		});
	});

	it("should not warn for non-calculate type with calculation", () => {
		assertPyxformXform({
			md: `
				| survey |           |      |             |      |             |
				|        | type      | name | label       | hint | calculation |
				|        | dateTime  | a    |             |      | now()       |
				|        | integer   | b    |             |      | 1 div 1     |
				|        | note      | note | Hello World |      |             |
			`,
			warnings_count: 0,
		});
	});

	it("should not warn for non-calculate type with hint and no calculation", () => {
		assertPyxformXform({
			md: `
				| survey |           |      |             |           |             |
				|        | type      | name | label       | hint      | calculation |
				|        | dateTime  | a    |             |           | now()       |
				|        | integer   | b    |             | Some hint |             |
				|        | note      | note | Hello World |           |             |
			`,
			warnings_count: 0,
		});
	});

	it("should not warn for non-calculate type with calculation and dynamic default", () => {
		assertPyxformXform({
			md: `
				| survey |           |      |             |      |             |         |
				|        | type      | name | label       | hint | calculation | default |
				|        | dateTime  | a    |             |      | now()       |         |
				|        | integer   | b    |             |      | 1 div 1     | \${a}   |
				|        | note      | note | Hello World |      |             |         |
			`,
			warnings_count: 0,
		});
	});

	it("should not warn for non-calculate type with calculation and default", () => {
		assertPyxformXform({
			md: `
				| survey |           |      |             |      |             |         |
				|        | type      | name | label       | hint | calculation | default |
				|        | dateTime  | a    |             |      | now()       |         |
				|        | integer   | b    |             |      | 1 div 1     | 1       |
				|        | note      | note | Hello World |      |             |         |
			`,
			warnings_count: 0,
		});
	});

	it("should have no control for select type with calculation and no label", () => {
		assertPyxformXform({
			name: "calculate-select",
			md: `
				| survey  |                   |      |       |                  |
				|         | type              | name | label | calculation      |
				|         | select_one yes_no | a    |       | concat('a', 'b') |
				| choices |                   |      |       |                  |
				|         | list_name         | name | label |                  |
				|         | yes_no            | yes  | Yes   |                  |
				|         | yes_no            | no   | No    |                  |
			`,
			xml__contains: [
				'<bind calculate="concat(\'a\', \'b\')" nodeset="/calculate-select/a" type="string"/>',
			],
			instance__contains: ["<a/>"],
			xml__excludes: ["<select1>"],
		});
	});

	it("should throw error for row without label or calculation", () => {
		assertPyxformXform({
			name: "no-label",
			md: `
				| survey |          |      |             |
				|        | type     | name | label       |
				|        | integer  | a    |             |
			`,
			errored: true,
			error__contains: ["The survey element named 'a' has no label or hint."],
		});
	});

	it("should error for calculate without calculation without default", () => {
		assertPyxformXform({
			name: "calculate-without-calculation-without-default",
			md: `
				| survey |            |      |             |             |         |
				|        | type       | name | label       | calculation | default |
				|        | calculate  | a    |             |             |         |
			`,
			errored: true,
			error__contains: ["Missing calculation"],
		});
	});

	it("should error for calculate without calculation with default without dynamic default", () => {
		assertPyxformXform({
			name: "calculate-without-calculation-with-default-without-dynamic-default",
			md: `
				| survey |            |      |             |             |         |
				|        | type       | name | label       | calculation | default |
				|        | calculate  | a    |             |             | foo     |
			`,
			errored: true,
			error__contains: ["Missing calculation"],
		});
	});

	it("should accept calculate without calculation with dynamic default", () => {
		assertPyxformXform({
			name: "calculate-without-calculation-with-dynamic-default",
			md: `
				| survey |            |      |             |             |          |
				|        | type       | name | label       | calculation | default  |
				|        | calculate  | a    |             |             | random() |
			`,
			instance__contains: ["<a/>"],
		});
	});
});
