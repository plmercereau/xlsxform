/**
 * Port of test_form_name.py - Form name handling tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestFormName", () => {
	it("test_default_to_data_when_no_name", () => {
		assertPyxformXform({
			md: `
			| survey   |           |      |           |
			|          | type      | name | label     |
			|          | text      | city | City Name |
			`,
			instance__contains: ['<test_name id="data">'],
			model__contains: ['<bind nodeset="/test_name/city" type="string"/>'],
			xml__contains: [
				'<input ref="/test_name/city">',
				"<label>City Name</label>",
				"</input>",
			],
		});
	});

	it("test_default_to_data", () => {
		assertPyxformXform({
			md: `
			| survey |      |      |           |
			|        | type | name | label     |
			|        | text | city | City Name |
			`,
			name: "data",
			instance__contains: ['<data id="data">'],
			model__contains: ['<bind nodeset="/data/city" type="string"/>'],
			xml__contains: [
				'<input ref="/data/city">',
				"<label>City Name</label>",
				"</input>",
			],
		});
	});

	it("test_default_form_name_to_superclass_definition", () => {
		assertPyxformXform({
			md: `
			| survey |      |      |           |
			|        | type | name | label     |
			|        | text | city | City Name |
			`,
			name: "some-name",
			instance__contains: ['<some-name id="data">'],
			model__contains: ['<bind nodeset="/some-name/city" type="string"/>'],
			xml__contains: [
				'<input ref="/some-name/city">',
				"<label>City Name</label>",
				"</input>",
			],
		});
	});
});
