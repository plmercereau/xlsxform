/**
 * Port of test_warnings.py - Warning output tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestWarnings", () => {
	it("test_l1", () => {
		assertPyxformXform({
			name: "test_l1",
			md: `
				| survey |      |           |        |
				|        | type | name      | hint   |
				|        | text | some_text | a hint |
			`,
			instance__contains: ["<some_text/>"],
			model__contains: ['<bind nodeset="/test_l1/some_text" type="string"/>'],
			xml__contains: [
				'<input ref="/test_l1/some_text">',
				"<hint>a hint</hint>",
				"</input>",
			],
		});
	});

	it("test_l2", () => {
		assertPyxformXform({
			name: "img_test",
			md: `
				| survey |      |                  |              |
				|        | type | name             | image        |
				|        | note | display_img_test | img_test.jpg |
			`,
			model__contains: [
				'<bind nodeset="/img_test/display_img_test" readonly="true()" type="string"/>',
			],
			instance__contains: ["<display_img_test/>"],
			xml__contains: [
				'<translation default="true()" lang="default">',
				`<label ref="jr:itext('/img_test/display_img_test:label')"/>`,
			],
		});
	});
});
