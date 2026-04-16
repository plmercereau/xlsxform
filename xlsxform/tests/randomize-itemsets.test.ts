/**
 * Test randomize itemsets.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("RandomizeItemsetsTest", () => {
	it("test_randomized_select_one", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |                    |         |       |                |
			|        | type               | name    | label | parameters     |
			|        | select_one choices | select  | Select| randomize=true |
			| choices|                    |         |       |                |
			|        | list_name          | name    | label |                |
			|        | choices            | a       | opt_a |                |
			|        | choices            | b       | opt_b |                |
			`,
			xml__contains: [
				"<itemset nodeset=\"randomize(instance('choices')/root/item)\">",
			],
		});
	});

	it("test_randomized_seeded_select_one", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |                    |         |       |                         |
			|        | type               | name    | label | parameters              |
			|        | select_one choices | select  | Select| randomize=true, seed=42 |
			| choices|                    |         |       |                         |
			|        | list_name          | name    | label |                         |
			|        | choices            | a       | opt_a |                         |
			|        | choices            | b       | opt_b |                         |
			`,
			xml__contains: [
				"<itemset nodeset=\"randomize(instance('choices')/root/item, 42)\">",
			],
		});
	});

	it("test_randomized_seeded_select_one_nameset_seed", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |                    |         |       |                              |                                |
			|        | type               | name    | label | parameters                   | calculation                    |
			|        | calculate          | seed    |       |                              | once(decimal-date-time(now())) |
			|        | select_one choices | select  | Select| randomize=true,seed=\${seed}  |                                |
			| choices|                    |         |       |                              |                                |
			|        | list_name          | name    | label |                              |                                |
			|        | choices            | a       | opt_a |                              |                                |
			|        | choices            | b       | opt_b |                              |                                |
			`,
			xml__contains: [
				"<itemset nodeset=\"randomize(instance('choices')/root/item, /data/seed)\">",
			],
		});
	});

	it("test_randomized_seeded_select_one_nameset_seed_expression__error", () => {
		const md = `
		| survey |
		| | type               | name   | label  | parameters                       | calculation                    |
		| | calculate          | seed   |        |                                  | once(decimal-date-time(now())) |
		| | select_one choices | select | Select | randomize=true,seed=int(\${seed}) |                                |

		| choices |
		| | list_name | name | label |
		| | choices   | a    | opt_a |
		| | choices   | b    | opt_b |
		`;
		assertPyxformXform({
			md,
			errored: true,
			error__contains: [
				"seed value must be a number or a reference to another field.",
			],
		});
	});

	it("test_randomized_seeded_filtered_select_one", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |                    |         |       |                         |               |
			|        | type               | name    | label | parameters              | choice_filter |
			|        | select_one choices | select  | Select| randomize=true, seed=42 | name='a'      |
			| choices|                    |         |       |                         |               |
			|        | list_name          | name    | label |                         |               |
			|        | choices            | a       | opt_a |                         |               |
			|        | choices            | b       | opt_b |                         |               |
			`,
			xml__contains: [
				"<itemset nodeset=\"randomize(instance('choices')/root/item[name='a'], 42)\">",
			],
		});
	});

	it("test_randomized_select_multiple", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |                         |         |       |                |
			|        | type                    | name    | label | parameters     |
			|        | select_multiple choices | select  | Select| randomize=true |
			| choices|                         |         |       |                |
			|        | list_name               | name    | label |                |
			|        | choices                 | a       | opt_a |                |
			|        | choices                 | b       | opt_b |                |
			`,
			xml__contains: [
				"<itemset nodeset=\"randomize(instance('choices')/root/item)\">",
			],
		});
	});

	it("test_randomized_seeded_select_multiple", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |                         |         |       |                         |
			|        | type                    | name    | label | parameters              |
			|        | select_multiple choices | select  | Select| randomize=true, seed=42 |
			| choices|                         |         |       |                         |
			|        | list_name               | name    | label |                         |
			|        | choices                 | a       | opt_a |                         |
			|        | choices                 | b       | opt_b |                         |
			`,
			xml__contains: [
				"<itemset nodeset=\"randomize(instance('choices')/root/item, 42)\">",
			],
		});
	});

	it("test_randomized_external_xml_instance", () => {
		assertPyxformXform({
			name: "ecsv",
			md: `
			| survey |                                              |                |                |                |
			|        | type                                         | name           | label          | parameters     |
			|        | select_one_from_file cities.xml              | city           | City           | randomize=true |
			`,
			xml__contains: [
				"<itemset nodeset=\"randomize(instance('cities')/root/item)\">",
			],
		});
	});

	it("test_randomized_select_one_bad_param", () => {
		assertPyxformXform({
			name: "data",
			errored: true,
			md: `
			| survey |                    |         |       |                |
			|        | type               | name    | label | parameters     |
			|        | select_one choices | select  | Select| step=10        |
			| choices|                    |         |       |                |
			|        | list_name          | name    | label |                |
			|        | choices            | a       | opt_a |                |
			|        | choices            | b       | opt_b |                |
			`,
			error__contains: [
				"Accepted parameters are 'randomize, seed'. The following are invalid parameter(s): 'step'.",
			],
		});
	});

	it("test_randomized_select_one_bad_randomize", () => {
		assertPyxformXform({
			name: "data",
			errored: true,
			md: `
			| survey |                    |         |       |                  |
			|        | type               | name    | label | parameters       |
			|        | select_one choices | select  | Select| randomize=ukanga |
			| choices|                    |         |       |                  |
			|        | list_name          | name    | label |                  |
			|        | choices            | a       | opt_a |                  |
			|        | choices            | b       | opt_b |                  |
			`,
			error__contains: [
				"randomize must be set to true or false: 'ukanga' is an invalid value",
			],
		});
	});

	it("test_randomized_select_one_bad_seed", () => {
		assertPyxformXform({
			name: "data",
			errored: true,
			md: `
			| survey |                    |         |       |                             |
			|        | type               | name    | label | parameters                  |
			|        | select_one choices | select  | Select| randomize=true, seed=ukanga |
			| choices|                    |         |       |                             |
			|        | list_name          | name    | label |                             |
			|        | choices            | a       | opt_a |                             |
			|        | choices            | b       | opt_b |                             |
			`,
			error__contains: [
				"seed value must be a number or a reference to another field.",
			],
		});
	});

	it("test_randomized_select_one_seed_without_randomize", () => {
		assertPyxformXform({
			name: "data",
			errored: true,
			md: `
			| survey |                    |         |       |                  |
			|        | type               | name    | label | parameters       |
			|        | select_one choices | select  | Select| seed=42          |
			| choices|                    |         |       |                  |
			|        | list_name          | name    | label |                  |
			|        | choices            | a       | opt_a |                  |
			|        | choices            | b       | opt_b |                  |
			`,
			error__contains: [
				"Parameters must include randomize=true to use a seed.",
			],
		});
	});

	it("test_randomized_select_one_translated", () => {
		const md = `
		| survey  |
		|         | type          | name | label::English (en) | parameters     |
		|         | select_one c1 | q1   | Q1 en               | randomize=True |
		| choices |
		|         | list_name | name | label::English (en) |
		|         | c1        | a    | A                   |
		|         | c1        | b    | B                   |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				// body_select1_itemset("q1")
				`
				/h:html/h:body/x:select1[
				  @ref = '/test_name/q1'
				  and ./x:itemset
				  and not(./x:item)
				]
				`,
				// model_itext_choice_text_label_by_pos("English (en)", "c1", ("A", "B"))
				`
				/h:html/h:head/x:model/x:itext/x:translation[
				  @lang='English (en)' and
				  ./x:text[
				    @id='c1-0'
				    and ./x:value[not(@form) and text()='A']
				  ]
				  and ./x:text[
				    @id='c1-1'
				    and ./x:value[not(@form) and text()='B']
				  ]
				]
				`,
				// Nodeset ref to choices instance wrapped in randomize().
				`
				/h:html/h:body/x:select1[@ref='/test_name/q1']
				  /x:itemset[
				    @nodeset="randomize(instance('c1')/root/item)"
				      and child::x:label[@ref='jr:itext(itextId)']
				      and child::x:value[@ref='name']
				  ]
				`,
			],
		});
	});

	it("test_randomized_select_one_translated_filtered", () => {
		const md = `
		| survey  |
		|         | type          | name | label::English (en) | parameters     | choice_filter |
		|         | text          | q0   | Question 0          |                |               |
		|         | select_one c1 | q1   | Question 1          | randomize=True | \${q0} = cf    |
		| choices |           |      |       |
		|         | list_name | name | label::English (en) | cf |
		|         | c1        | a    | A                   | 1  |
		|         | c1        | b    | B                   | 2  |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				// body_select1_itemset("q1")
				`
				/h:html/h:body/x:select1[
				  @ref = '/test_name/q1'
				  and ./x:itemset
				  and not(./x:item)
				]
				`,
				// model_itext_choice_text_label_by_pos("English (en)", "c1", ("A", "B"))
				`
				/h:html/h:head/x:model/x:itext/x:translation[
				  @lang='English (en)' and
				  ./x:text[
				    @id='c1-0'
				    and ./x:value[not(@form) and text()='A']
				  ]
				  and ./x:text[
				    @id='c1-1'
				    and ./x:value[not(@form) and text()='B']
				  ]
				]
				`,
				// Nodeset ref to choices instance + filter predicate wrapped in randomize().
				`
				/h:html/h:body/x:select1[@ref='/test_name/q1']
				  /x:itemset[
				    @nodeset="randomize(instance('c1')/root/item[ /test_name/q0  = cf])"
				      and child::x:label[@ref='jr:itext(itextId)']
				      and child::x:value[@ref='name']
				  ]
				`,
			],
		});
	});
});
