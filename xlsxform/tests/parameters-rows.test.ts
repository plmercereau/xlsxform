/**
 * Port of test_parameters_rows.py
 * Test text rows parameter.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestParametersRows", () => {
	it("test_adding_rows_to_the_body_if_set_in_its_own_column", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |        |          |       |                |
			|        | type   | name     | label | body::rows     |
			|        | text   | name     | Name  | 7              |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/data/name' and @rows='7']",
			],
		});
	});

	it("test_using_the_number_of_rows_specified_in_parameters_if_it_is_set_in_both_its_own_column_and_the_parameters_column", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |        |          |       |                |                |
			|        | type   | name     | label | body::rows     | parameters     |
			|        | text   | name     | Name  | 7              | rows=8         |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/data/name' and @rows='8']",
			],
		});
	});

	it("test_adding_rows_to_the_body_if_set_in_parameters", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |        |          |       |                |
			|        | type   | name     | label | parameters     |
			|        | text   | name     | Name  | rows=7         |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/data/name' and @rows='7']",
			],
		});
	});

	it("test_throwing_error_if_rows_set_in_parameters_but_the_value_is_not_an_integer", () => {
		const parameters = ["rows=", "rows=foo", "rows=7.5"];
		const md = `
		| survey |        |          |       |                 |
		|        | type   | name     | label | parameters      |
		|        | text   | name     | Name  | {case}          |
		`;
		for (const c of parameters) {
			assertPyxformXform({
				name: "data",
				md: md.replace("{case}", c),
				errored: true,
				error__contains: [
					"[row : 2] Parameter rows must have an integer value.",
				],
			});
		}
	});
});
