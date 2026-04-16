/**
 * Edge case tests for xls2json.ts — targeting uncovered validation paths.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("xls2json edge cases", () => {
	describe("choice validation", () => {
		it("should error on choice with empty name", () => {
			assertPyxformXform({
				errored: true,
				error__contains: ["Choices must have a name"],
				md: `
					| survey  |                   |      |       |
					|         | type              | name | label |
					|         | select_one colors | q1   | Q1    |
					| choices |           |      |       |
					|         | list_name | name | label |
					|         | colors    |      | Red   |
				`,
			});
		});

		it("should error on duplicate choice names within same list", () => {
			assertPyxformXform({
				errored: true,
				error__contains: ["Choice names must be unique"],
				md: `
					| survey  |                   |      |       |
					|         | type              | name | label |
					|         | select_one colors | q1   | Q1    |
					| choices |           |      |       |
					|         | list_name | name | label |
					|         | colors    | red  | Red   |
					|         | colors    | red  | Red2  |
				`,
			});
		});
	});

	describe("parameter validation", () => {
		it("should error on capture-accuracy for geoshape (not geopoint)", () => {
			assertPyxformXform({
				errored: true,
				error__contains: ["invalid parameter"],
				md: `
					| survey |          |      |       |                      |
					|        | type     | name | label | parameters           |
					|        | geoshape | q1   | Q1    | capture-accuracy=2.5 |
				`,
			});
		});

		it("should error on unknown parameter for geotrace", () => {
			assertPyxformXform({
				errored: true,
				error__contains: ["invalid parameter"],
				md: `
					| survey |           |      |       |                     |
					|        | type      | name | label | parameters          |
					|        | geotrace  | q1   | Q1    | totally-unknown=foo |
				`,
			});
		});

		it("should error on invalid separator characters in range parameters", () => {
			assertPyxformXform({
				errored: true,
				error__contains: ["parameter1=value"],
				md: `
					| survey |       |      |       |                               |
					|        | type  | name | label | parameters                    |
					|        | range | q1   | Q1    | start=1 end=10 step=1 @bad=2  |
				`,
			});
		});
	});

	describe("pyxform reference validation", () => {
		it("should error on malformed reference content", () => {
			assertPyxformXform({
				errored: true,
				error__contains: ["Malformed pyxform reference"],
				md: `
					| survey |      |      |       |                    |
					|        | type | name | label | relevant           |
					|        | text | q1   | Q1    |                    |
					|        | text | q2   | Q2    | \${q1 q1} = 'yes' |
				`,
			});
		});
	});

	describe("table-list appearance", () => {
		it("should error on choice filter with table-list", () => {
			assertPyxformXform({
				errored: true,
				error__contains: ["Choice filter not supported for table-list"],
				md: `
					| survey  |                   |      |       |            |               |
					|         | type              | name | label | appearance | choice_filter |
					|         | begin group       | grp  | Group | table-list |               |
					|         | select_one colors | q1   | Q1    |            | name != 'red' |
					|         | end group         |      |       |            |               |
					| choices |           |      |       |
					|         | list_name | name | label |
					|         | colors    | red  | Red   |
					|         | colors    | blue | Blue  |
				`,
			});
		});

		it("should error on mismatched table-list names", () => {
			assertPyxformXform({
				errored: true,
				error__contains: ["list names don't match"],
				md: `
					| survey  |                   |      |       |            |
					|         | type              | name | label | appearance |
					|         | begin group       | grp  | Group | table-list |
					|         | select_one colors | q1   | Q1    |            |
					|         | select_one sizes  | q2   | Q2    |            |
					|         | end group         |      |       |            |
					| choices |           |      |       |
					|         | list_name | name | label |
					|         | colors    | red  | Red   |
					|         | colors    | blue | Blue  |
					|         | sizes     | sm   | Small |
					|         | sizes     | lg   | Large |
				`,
			});
		});

		it("should pass hint from begin group to generated label element", () => {
			assertPyxformXform({
				md: `
					| survey  |                   |      |       |            |           |
					|         | type              | name | label | appearance | hint      |
					|         | begin group       | grp  | Group | table-list | Some hint |
					|         | select_one colors | q1   | Q1    |            |           |
					|         | end group         |      |       |            |           |
					| choices |           |      |       |
					|         | list_name | name | label |
					|         | colors    | red  | Red   |
					|         | colors    | blue | Blue  |
				`,
				xml__contains: ["Some hint"],
			});
		});
	});

	describe("choice media with translations", () => {
		it("should handle media::image::language in choices", () => {
			assertPyxformXform({
				md: `
					| survey  |                   |      |       |
					|         | type              | name | label |
					|         | select_one colors | q1   | Q1    |
					| choices |           |      |       |                         |
					|         | list_name | name | label | media::image::English   |
					|         | colors    | red  | Red   | red_en.jpg              |
					|         | colors    | blue | Blue  | blue_en.jpg             |
				`,
				xml__contains: ["red_en.jpg"],
			});
		});

		it("should handle untranslated media::image alongside translated media::image::lang", () => {
			assertPyxformXform({
				md: `
					| survey  |                   |      |       |
					|         | type              | name | label |
					|         | select_one colors | q1   | Q1    |
					| choices |           |      |       |              |                         |
					|         | list_name | name | label | media::image | media::image::French    |
					|         | colors    | red  | Red   | red.jpg      | red_fr.jpg              |
					|         | colors    | blue | Blue  | blue.jpg     | blue_fr.jpg             |
				`,
				xml__contains: ["red_fr.jpg"],
			});
		});
	});

	describe("select_one_from_file", () => {
		it("should handle select_one_from_file type alias", () => {
			assertPyxformXform({
				md: `
					| survey |                                |      |       |
					|        | type                           | name | label |
					|        | select_one_from_file cities.csv | q1  | Q1    |
				`,
				xml__xpath_match: ["/h:html/h:head/x:model/x:instance[@id='cities']"],
			});
		});
	});

	describe("choice label with translation then plain", () => {
		it("should handle translated label followed by plain label in choices", () => {
			assertPyxformXform({
				md: `
					| survey  |                   |      |                |                |
					|         | type              | name | label::English | label::French  |
					|         | select_one colors | q1   | Q1             | Q1fr           |
					| choices |           |      |                |                |
					|         | list_name | name | label::English | label::French  |
					|         | colors    | red  | Red            | Rouge          |
					|         | colors    | blue | Blue           | Bleu           |
				`,
				xml__contains: ["Rouge"],
			});
		});
	});

	describe("search appearance", () => {
		it("should handle search() appearance on select_one", () => {
			assertPyxformXform({
				md: `
					| survey  |                   |      |       |                        |
					|         | type              | name | label | appearance             |
					|         | select_one colors | q1   | Q1    | search('colors')       |
					| choices |           |      |       |
					|         | list_name | name | label |
					|         | colors    | red  | Red   |
					|         | colors    | blue | Blue  |
				`,
				xml__xpath_match: [
					"/h:html/h:body/x:select1[@appearance=\"search('colors')\"]",
				],
			});
		});
	});

	describe("select with itemset from repeat", () => {
		it("should handle select_one with itemset from repeat", () => {
			assertPyxformXform({
				md: `
					| survey |                          |        |             |
					|        | type                     | name   | label       |
					|        | begin repeat             | fruits | Fruits      |
					|        | text                     | fname  | Fruit name  |
					|        | end repeat               |        |             |
					|        | select_one \${fruits}    | pick   | Pick fruit  |
				`,
				xml__xpath_match: ["/h:html/h:body/x:select1[@ref='/test_name/pick']"],
			});
		});
	});

	describe("select with or_other", () => {
		it("should handle select_one or_other with q1_other field", () => {
			assertPyxformXform({
				md: `
					| survey  |                             |      |       |
					|         | type                        | name | label |
					|         | select_one colors or_other  | q1   | Q1    |
					| choices |           |      |       |
					|         | list_name | name | label |
					|         | colors    | red  | Red   |
					|         | colors    | blue | Blue  |
				`,
				xml__contains: ["q1_other"],
			});
		});
	});
});
