/**
 * Port of test_bind_conversions.py - Bind attribute conversion tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("BindConversionsTest", () => {
	it("should convert bind readonly", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |       |      |       |          |
				|        | type  | name | label | readonly |
				|        | text  | text | text  | yes      |
			`,
			xml__contains: ['<bind nodeset="/data/text" readonly="true()"'],
		});
	});

	it("should convert bind required", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |       |      |       |          |
				|        | type  | name | label | required |
				|        | text  | text | text  | FALSE    |
			`,
			xml__contains: ['<bind nodeset="/data/text" required="false()"'],
		});
	});

	it("should convert bind required message with reference", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |       |      |       |            |                    |
				|        | type  | name | label | required   | required_message   |
				|        | int   | foo  | foo   |            |                    |
				|        | text  | text | text  | true()     | required, \${foo}   |
			`,
			xml__contains: [
				"<bind nodeset=\"/data/text\" required=\"true()\" type=\"string\" jr:requiredMsg=\"jr:itext('/data/text:jr:requiredMsg')\"",
				'<value> required, <output value=" /data/foo "/> </value>',
			],
		});
	});

	it("should convert bind constraint", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |       |      |       |                    |
				|        | type  | name | label | constraint_message |
				|        | text  | text | text  | yes                |
			`,
			xml__contains: [
				'<bind nodeset="/data/text" type="string" jr:constraintMsg="yes"',
			],
		});
	});

	it("should convert bind constraint message with reference", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |       |      |       |                      |                    |
				|        | type  | name | label | constraint           | constraint_message |
				|        | int   | foo  | foo   |                      |                    |
				|        | text  | text | text  | string-length(.) > 1 | too short \${foo}   |
			`,
			xml__contains: [
				'<bind constraint="string-length(.) &gt; 1" nodeset="/data/text" type="string" jr:constraintMsg="jr:itext(\'/data/text:jr:constraintMsg\')"',
				'<value> too short <output value=" /data/foo "/> </value>',
			],
		});
	});

	it("should convert bind custom", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |       |      |       |           |
				|        | type  | name | label | bind::foo |
				|        | text  | text | text  | bar       |
			`,
			xml__contains: ['<bind foo="bar" nodeset="/data/text" type="string"'],
		});
	});
});
