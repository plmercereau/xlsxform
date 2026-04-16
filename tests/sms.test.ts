/**
 * Port of test_sms.py
 * Test sms syntax.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("SMSTest", () => {
	it("test_prefix_only", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey   |           |          |       |           |
			|          | type      |   name   | label | hint      |
			|          | string    |   name   | Name  | your name |
			| settings |           |          |       |           |
			|          | prefix    |          |       |           |
			|          | sms_test  |          |       |           |
			`,
			xml__contains: ['odk:prefix="sms_test"'],
		});
	});

	it("test_delimiter_only", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey   |           |          |       |           |
			|          | type      |   name   | label | hint      |
			|          | string    |   name   | Name  | your name |
			| settings |           |          |       |           |
			|          | delimiter |          |       |           |
			|          | ~         |          |       |           |
			`,
			xml__contains: ['odk:delimiter="~"'],
		});
	});

	it("test_prefix_and_delimiter", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey   |           |          |       |           |
			|          | type      |   name   | label | hint      |
			|          | string    |   name   | Name  | your name |
			| settings |           |          |       |           |
			|          | delimiter | prefix   |       |           |
			|          | *         | sms_test2|       |           |
			`,
			xml__contains: ['odk:delimiter="*"', 'odk:prefix="sms_test2"'],
		});
	});

	it("test_sms_tag", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey   |           |          |             |       |           |         |
			|          | type      |   name   | compact_tag | label | hint      | default |
			|          | string    |   name   | n           | Name  | your name |         |
			|          | int       |   age    | +a          | Age   | your age  | 7       |
			|          | string    | fruit    |             | Fruit | fav fruit |         |
			`,
			xml__contains: [
				'<name odk:tag="n"/>',
				'<age odk:tag="+a">7</age>',
				"<fruit/>",
			],
		});
	});
});
