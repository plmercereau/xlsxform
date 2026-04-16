/**
 * Port of test_search_function.py
 * Tests about the 'search()' function, which pulls data from CSV, optionally filtering it.
 *
 * Although both go in the 'appearance' column, 'search()' is not the same as 'search'. The
 * latter is a style which enables a choice filtering UI.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

// --- XPath helper functions (ported from Python) ---

function xpModelInstanceWithCsvSrcNoItems(iid: string): string {
	return `
      /h:html/h:head/x:model/x:instance[
        @id='${iid}' and @src='jr://file-csv/${iid}.csv' and not(./x:root/x:item)
      ]
    `;
}

function xpBodySelectSearchAppearance(
	qname: string,
	appearance = "search('my_file')",
): string {
	return `
          /h:html/h:body/x:select1[
            @ref='/test_name/${qname}'
            and @appearance="${appearance}"
          ]
        `;
}

function xpBodySelectConfigChoiceInline(
	qname: string,
	cvname: string,
	clname: string,
): string {
	return `
          /h:html/h:body/x:select1[@ref='/test_name/${qname}']/x:item[
            ./x:value/text()='${cvname}'
            and ./x:label/text()='${clname}'
          ]
        `;
}

function xpBodySelectConfigChoiceItext(
	qname: string,
	cname: string,
	cvname: string,
): string {
	return `
          /h:html/h:body/x:select1[@ref='/test_name/${qname}']/x:item[
            ./x:value/text()='${cvname}'
            and ./x:label[@ref="jr:itext('${cname}-0')"]
          ]
        `;
}

// xpc helpers

function xpcModelItextChoiceTextLabelByPos(
	lang: string,
	cname: string,
	choices: string[],
): string {
	const choicesXp = choices
		.map(
			(cl, idx) => `
                ./x:text[
                  @id='${cname}-${idx}'
                  and ./x:value[not(@form) and text()='${cl}']
                ]
                `,
		)
		.join("\n              and ");
	return `
        /h:html/h:head/x:model/x:itext/x:translation[
          @lang='${lang}' and
          ${choicesXp}
        ]
        `;
}

function xpcModelInstanceChoicesItext(
	cname: string,
	choices: string[],
): string {
	const choicesXp = choices
		.map(
			(cv, idx) => `
                ./x:item[
                  ./x:name/text() = '${cv}'
                    and not(./x:label)
                    and ./x:itextId = '${cname}-${idx}'
                ]
                `,
		)
		.join("\n              and ");
	return `
        /h:html/h:head/x:model/x:instance[@id='${cname}']/x:root[
          ${choicesXp}
        ]
        `;
}

// xpq helpers

function xpqModelInstanceExists(iId: string): string {
	return `
          /h:html/h:head/x:model[./x:instance[@id='${iId}']]
        `;
}

function xpqModelInstanceBind(qName: string, type: string): string {
	return `
          /h:html/h:head/x:model/x:bind[
            @nodeset='/test_name/${qName}'
            and @type='${type}'
          ]
        `;
}

function xpqModelInstanceBindAttr(
	qname: string,
	key: string,
	value: string,
): string {
	return `
          /h:html/h:head/x:model/x:bind[
            @nodeset='/test_name/${qname}'
            and @${key}="${value}"
          ]
        `;
}

function xpqBodySelect1Itemset(qName: string): string {
	return `
        /h:html/h:body/x:select1[
          @ref = '/test_name/${qName}'
          and ./x:itemset
          and not(./x:item)
        ]
        `;
}

// --- Tests ---

describe("TestTranslations", () => {
	/**
	 * Translations behaviour with the search() appearance.
	 *
	 * The search() appearance is a Collect-only feature, so ODK Validate is run for these
	 * tests to try and ensure that the output will be accepted by Collect. In particular,
	 * the search() appearance requires in-line (body) items for choices.
	 */

	it("test_shared_choice_list", () => {
		assertPyxformXform({
			md: `
				| survey  |               |       |            |           |                   |
				|         | type          | name  | label::en  | label::fr | appearance        |
				|         | select_one c1 | q1    | Question 1 | Chose 1   | search('my_file') |
				|         | select_one c1 | q2    | Question 2 | Chose 2   | search('my_file', 'matches', 'filtercol', 'x1') |
				| choices |               |       |           |           |
				|         | list_name     | name  | label::en | label::fr |
				|         | c1            | id    | label_en  | label_fr  |
			`,
			xml__xpath_match: [
				xpBodySelectSearchAppearance("q1"),
				xpBodySelectConfigChoiceItext("q1", "c1", "id"),
				xpBodySelectSearchAppearance(
					"q2",
					"search('my_file', 'matches', 'filtercol', 'x1')",
				),
				xpBodySelectConfigChoiceItext("q2", "c1", "id"),
				xpcModelItextChoiceTextLabelByPos("en", "c1", ["label_en"]),
				xpcModelItextChoiceTextLabelByPos("fr", "c1", ["label_fr"]),
			],
			xml__xpath_count: [[xpqModelInstanceExists("c1"), 0]],
		});
	});

	it("test_usage_with_other_selects", () => {
		assertPyxformXform({
			md: `
				| survey  |               |       |            |           |                   |
				|         | type          | name  | label::en  | label::fr | appearance        |
				|         | select_one c1 | q1    | Question 1 | Chose 1   | search('my_file') |
				|         | select_one c2 | q2    | Question 2 | Chose 2   |                   |
				| choices |               |       |            |           |
				|         | list_name     | name  | label::en | label::fr |
				|         | c1            | id    | label_en  | label_fr  |
				|         | c2            | na    | la-e      | la-f      |
				|         | c2            | nb    | lb-e      | lb-f      |
			`,
			xml__xpath_match: [
				xpBodySelectSearchAppearance("q1"),
				xpBodySelectConfigChoiceItext("q1", "c1", "id"),
				xpcModelItextChoiceTextLabelByPos("en", "c1", ["label_en"]),
				xpcModelItextChoiceTextLabelByPos("fr", "c1", ["label_fr"]),
				xpcModelInstanceChoicesItext("c2", ["na", "nb"]),
				xpcModelItextChoiceTextLabelByPos("en", "c2", ["la-e", "lb-e"]),
				xpcModelItextChoiceTextLabelByPos("fr", "c2", ["la-f", "lb-f"]),
			],
			xml__xpath_count: [[xpqModelInstanceExists("c1"), 0]],
		});
	});

	it("test_usage_with_other_selects__invalid_list_reuse_by_non_search_question", () => {
		assertPyxformXform({
			md: `
				| survey  |               |       |            |           |                   |
				|         | type          | name  | label::en  | label::fr | appearance        |
				|         | select_one c1 | q1    | Question 1 | Chose 1   | search('my_file') |
				|         | select_one c1 | q2    | Question 2 | Chose 2   |                   |
				| choices |               |       |           |
				|         | list_name     | name  | label     |
				|         | c1            | id    | label     |
			`,
			errored: true,
			error__contains: ["Question 'q1' uses 'search()',"],
		});
	});

	it("test_single_question_usage", () => {
		assertPyxformXform({
			md: `
				| survey  |               |       |            |           |                   |
				|         | type          | name  | label::en  | label::fr | appearance        |
				|         | select_one c1 | q1    | Question 1 | Chose 1   | search('my_file') |
				| choices |               |       |           |           |
				|         | list_name     | name  | label::en | label::fr |
				|         | c1            | id    | label_en  | label_fr  |
			`,
			xml__xpath_match: [
				xpBodySelectSearchAppearance("q1"),
				xpBodySelectConfigChoiceItext("q1", "c1", "id"),
				xpcModelItextChoiceTextLabelByPos("en", "c1", ["label_en"]),
				xpcModelItextChoiceTextLabelByPos("fr", "c1", ["label_fr"]),
			],
			xml__xpath_count: [[xpqModelInstanceExists("c1"), 0]],
		});
	});

	it("test_additional_static_choices", () => {
		assertPyxformXform({
			md: `
				| survey  |               |       |            |           |                   |
				|         | type          | name  | label::en  | label::fr | appearance        |
				|         | select_one c1 | q1    | Question 1 | Chose 1   | search('my_file') |
				| choices |               |       |           |           |
				|         | list_name     | name  | label::en | label::fr |
				|         | c1            | id    | label_en  | label_fr  |
				|         | c1            | 0     | l0-e      | l0-f      |
				|         | c1            | 1     | l1-e      | l1-f      |
			`,
			xml__xpath_match: [
				xpBodySelectSearchAppearance("q1"),
				xpBodySelectConfigChoiceItext("q1", "c1", "id"),
				xpcModelItextChoiceTextLabelByPos("en", "c1", [
					"label_en",
					"l0-e",
					"l1-e",
				]),
				xpcModelItextChoiceTextLabelByPos("fr", "c1", [
					"label_fr",
					"l0-f",
					"l1-f",
				]),
			],
			xml__xpath_count: [[xpqModelInstanceExists("c1"), 0]],
		});
	});

	it("test_name_clashes", () => {
		assertPyxformXform({
			md: `
				| survey  |                 |       |            |           |                   |
				|         | type            | name  | label::en  | label::fr | appearance        |
				|         | select_one c1-0 | c1-0  | Question 1 | Chose 1   | search('my_file') |
				| choices |               |       |            |           |
				|         | list_name     | name  | label::en  | label::fr |
				|         | c1-0          | id    | label_en   | label_fr  |
			`,
			xml__xpath_match: [
				xpBodySelectSearchAppearance("c1-0"),
				xpBodySelectConfigChoiceItext("c1-0", "c1-0", "id"),
				xpcModelItextChoiceTextLabelByPos("en", "c1-0", ["label_en"]),
				xpcModelItextChoiceTextLabelByPos("fr", "c1-0", ["label_fr"]),
			],
			xml__xpath_count: [[xpqModelInstanceExists("c1"), 0]],
		});
	});

	it("test_search_and_select_xlsx", () => {
		assertPyxformXform({
			md: `
				| survey  |                   |            |                |                  |
				|         | type              | name       | label          | appearance       |
				|         | select_one fruits | fruit      | Choose a fruit | search('fruits') |
				|         | note              | note_fruit | The fruit \${fruit} pulled from csv | |
				| choices |               |          |       |
				|         | list_name     | name     | label |
				|         | fruits        | name_key | name  |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model[not(descendant::x:itext)]",
				`
				/h:html/h:body/x:select1[
				  @ref='/test_name/fruit'
				  and @appearance="search('fruits')"
				]/x:item[
				  ./x:value/text()='name_key'
				  and ./x:label/text()='name'
				]
				`,
				xpqModelInstanceBind("fruit", "string"),
				xpqModelInstanceBind("note_fruit", "string"),
				"/h:html/h:body/x:input[@ref='/test_name/note_fruit']",
			],
			xml__xpath_count: [[xpqModelInstanceExists("c1"), 0]],
		});
	});
});

describe("TestSecondaryInstances", () => {
	/**
	 * Test behaviour of the search() appearance with other sources of secondary instances.
	 */

	it("test_pulldata_same_file", () => {
		assertPyxformXform({
			md: `
				| survey  |               |      |       |                   |             |
				|         | type          | name | label | appearance        | calculation |
				|         | select_one s1 | q1   | Q1    | search('my_file') |             |
				|         | calculate     | p1   |       |                   | pulldata('my_file', 'this', 'that', \${q1}) |
				| choices |           |      |       |
				|         | list_name | name | label |
				|         | s1        | na   | la    |
			`,
			xml__xpath_match: [
				xpModelInstanceWithCsvSrcNoItems("my_file"),
				xpqModelInstanceBindAttr(
					"p1",
					"calculate",
					"pulldata('my_file', 'this', 'that',  /test_name/q1 )",
				),
				xpBodySelectSearchAppearance("q1"),
				xpBodySelectConfigChoiceInline("q1", "na", "la"),
			],
			xml__xpath_count: [[xpqModelInstanceExists("s1"), 0]],
		});
	});

	it("test_pulldata_same_file__multiple_search", () => {
		assertPyxformXform({
			md: `
				| survey  |               |      |       |                   |             |
				|         | type          | name | label | appearance        | calculation |
				|         | select_one s1 | q1   | Q1    | search('my_file') |             |
				|         | calculate     | p1   |       |                   | pulldata('my_file', 'this', 'that', \${q1}) |
				|         | select_one s1 | q2   | Q2    | search('my_file') |             |
				| choices |           |      |       |
				|         | list_name | name | label |
				|         | s1        | na   | la    |
			`,
			xml__xpath_match: [
				xpModelInstanceWithCsvSrcNoItems("my_file"),
				xpqModelInstanceBindAttr(
					"p1",
					"calculate",
					"pulldata('my_file', 'this', 'that',  /test_name/q1 )",
				),
				xpBodySelectSearchAppearance("q1"),
				xpBodySelectConfigChoiceInline("q1", "na", "la"),
				xpBodySelectSearchAppearance("q2"),
				xpBodySelectConfigChoiceInline("q2", "na", "la"),
			],
			xml__xpath_count: [[xpqModelInstanceExists("s1"), 0]],
		});
	});

	it("test_pulldata_same_file__multiple_search__translation", () => {
		assertPyxformXform({
			md: `
				| survey  |               |      |       |                   |             |
				|         | type          | name | label | appearance        | calculation |
				|         | select_one s1 | q1   | Q1    | search('my_file') |             |
				|         | calculate     | p1   |       |                   | pulldata('my_file', 'this', 'that', \${q1}) |
				|         | select_one s1 | q2   | Q2    | search('my_file') |             |
				| choices |           |      |           |
				|         | list_name | name | label::en |
				|         | s1        | na   | la        |
			`,
			xml__xpath_match: [
				xpModelInstanceWithCsvSrcNoItems("my_file"),
				xpqModelInstanceBindAttr(
					"p1",
					"calculate",
					"pulldata('my_file', 'this', 'that',  /test_name/q1 )",
				),
				xpBodySelectSearchAppearance("q1"),
				xpcModelItextChoiceTextLabelByPos("en", "s1", ["la"]),
				xpBodySelectConfigChoiceItext("q1", "s1", "na"),
				xpBodySelectSearchAppearance("q2"),
				xpBodySelectConfigChoiceItext("q2", "s1", "na"),
			],
			xml__xpath_count: [[xpqModelInstanceExists("s1"), 0]],
		});
	});

	it("test_pulldata_same_file__multiple_search_and_pulldata", () => {
		assertPyxformXform({
			md: `
				| survey  |               |      |       |                   |             |
				|         | type          | name | label | appearance        | calculation |
				|         | select_one s1 | q1   | Q1    | search('my_file') |             |
				|         | calculate     | p1   |       |                   | pulldata('my_file', 'this', 'that', \${q1}) |
				|         | select_one s1 | q2   | Q2    | search('my_file') |             |
				|         | calculate     | p2   |       |                   | pulldata('my_file', 'this', 'that', \${q2}) |
				| choices |           |      |       |
				|         | list_name | name | label |
				|         | s1        | na   | la    |
			`,
			xml__xpath_match: [
				xpModelInstanceWithCsvSrcNoItems("my_file"),
				xpqModelInstanceBindAttr(
					"p1",
					"calculate",
					"pulldata('my_file', 'this', 'that',  /test_name/q1 )",
				),
				xpqModelInstanceBindAttr(
					"p2",
					"calculate",
					"pulldata('my_file', 'this', 'that',  /test_name/q2 )",
				),
				xpBodySelectSearchAppearance("q1"),
				xpBodySelectConfigChoiceInline("q1", "na", "la"),
				xpBodySelectSearchAppearance("q2"),
				xpBodySelectConfigChoiceInline("q2", "na", "la"),
			],
			xml__xpath_count: [[xpqModelInstanceExists("s1"), 0]],
		});
	});

	it("test_pulldata_same_file__multiple_search__different_config", () => {
		assertPyxformXform({
			md: `
				| survey  |               |      |       |                   |             |
				|         | type          | name | label | appearance        | calculation |
				|         | select_one s1 | q1   | Q1    | search('my_file') |             |
				|         | calculate     | p1   |       |                   | pulldata('my_file', 'this', 'that', \${q1}) |
				|         | select_one s2 | q2   | Q2    | search('my_file') |             |
				| choices |           |      |       |
				|         | list_name | name | label |
				|         | s1        | na   | la    |
				|         | s2        | nb   | lb    |
			`,
			xml__xpath_match: [
				xpModelInstanceWithCsvSrcNoItems("my_file"),
				xpqModelInstanceBindAttr(
					"p1",
					"calculate",
					"pulldata('my_file', 'this', 'that',  /test_name/q1 )",
				),
				xpBodySelectSearchAppearance("q1"),
				xpBodySelectConfigChoiceInline("q1", "na", "la"),
				xpBodySelectSearchAppearance("q2"),
				xpBodySelectConfigChoiceInline("q2", "nb", "lb"),
			],
			xml__xpath_count: [
				[xpqModelInstanceExists("s1"), 0],
				[xpqModelInstanceExists("s2"), 0],
			],
		});
	});

	it("test_pulldata_same_file__multiple_search__static_choice", () => {
		assertPyxformXform({
			md: `
				| survey  |               |      |       |                   |             |
				|         | type          | name | label | appearance        | calculation |
				|         | select_one s1 | q1   | Q1    | search('my_file') |             |
				|         | calculate     | p1   |       |                   | pulldata('my_file', 'this', 'that', \${q1}) |
				|         | select_one s1 | q2   | Q2    | search('my_file') |             |
				| choices |           |      |       |
				|         | list_name | name | label |
				|         | s1        | na   | la    |
				|         | s1        | 0    | lb    |
			`,
			xml__xpath_match: [
				xpModelInstanceWithCsvSrcNoItems("my_file"),
				xpqModelInstanceBindAttr(
					"p1",
					"calculate",
					"pulldata('my_file', 'this', 'that',  /test_name/q1 )",
				),
				xpBodySelectSearchAppearance("q1"),
				xpBodySelectConfigChoiceInline("q1", "na", "la"),
				xpBodySelectConfigChoiceInline("q1", "0", "lb"),
				xpBodySelectSearchAppearance("q2"),
				xpBodySelectConfigChoiceInline("q2", "na", "la"),
				xpBodySelectConfigChoiceInline("q2", "0", "lb"),
			],
			xml__xpath_count: [[xpqModelInstanceExists("s1"), 0]],
		});
	});

	it("test_pulldata_same_file__constraint", () => {
		assertPyxformXform({
			md: `
				| survey  |               |      |       |                   |             |
				|         | type          | name | label | appearance        | constraint  |
				|         | select_one s1 | q1   | Q1    | search('my_file') | pulldata('my_file', 'this', 'that', \${q1}) |
				| choices |           |      |       |
				|         | list_name | name | label |
				|         | s1        | na   | la    |
			`,
			xml__xpath_match: [
				xpModelInstanceWithCsvSrcNoItems("my_file"),
				xpqModelInstanceBindAttr(
					"q1",
					"constraint",
					"pulldata('my_file', 'this', 'that',  /test_name/q1 )",
				),
				xpBodySelectSearchAppearance("q1"),
				xpBodySelectConfigChoiceInline("q1", "na", "la"),
			],
			xml__xpath_count: [[xpqModelInstanceExists("s1"), 0]],
		});
	});

	it("test_xmlexternal_same_file", () => {
		assertPyxformXform({
			md: `
				| survey  |               |         |       |                   |
				|         | type          | name    | label | appearance        |
				|         | select_one s1 | q1      | Q1    | search('my_file') |
				|         | xml-external  | my_file |       |                   |
				| choices |           |      |       |
				|         | list_name | name | label |
				|         | s1        | na   | la    |
			`,
			xml__xpath_match: [
				`
				  /h:html/h:head/x:model/x:instance[
				    @id='my_file' and @src='jr://file/my_file.xml' and not(./x:root/x:item)
				  ]
				`,
				xpBodySelectSearchAppearance("q1"),
				xpBodySelectConfigChoiceInline("q1", "na", "la"),
			],
			xml__xpath_count: [[xpqModelInstanceExists("s1"), 0]],
		});
	});

	it("test_csvexternal_same_file", () => {
		assertPyxformXform({
			md: `
				| survey  |               |         |       |                   |
				|         | type          | name    | label | appearance        |
				|         | select_one s1 | q1      | Q1    | search('my_file') |
				|         | csv-external  | my_file |       |                   |
				| choices |           |      |       |
				|         | list_name | name | label |
				|         | s1        | na   | la    |
			`,
			xml__xpath_match: [
				xpModelInstanceWithCsvSrcNoItems("my_file"),
				xpBodySelectSearchAppearance("q1"),
				xpBodySelectConfigChoiceInline("q1", "na", "la"),
			],
			xml__xpath_count: [[xpqModelInstanceExists("s1"), 0]],
		});
	});

	it("test_select_from_file__search_on_different_question", () => {
		assertPyxformXform({
			md: `
				| survey  |                                  |      |       |                   |
				|         | type                             | name | label | appearance        |
				|         | select_one s1                    | q1   | Q1    | search('my_file') |
				|         | select_one_from_file my_file.csv | q2   | Q2    |                   |
				| choices |           |       |       |
				|         | list_name | name  | label |
				|         | s1        | na    | la    |
			`,
			xml__xpath_match: [
				xpModelInstanceWithCsvSrcNoItems("my_file"),
				xpBodySelectSearchAppearance("q1"),
				xpBodySelectConfigChoiceInline("q1", "na", "la"),
				xpqBodySelect1Itemset("q2"),
			],
			xml__xpath_count: [[xpqModelInstanceExists("s1"), 0]],
		});
	});

	it("test_select_from_file__search_on_same_question", () => {
		assertPyxformXform({
			md: `
				| survey  |                                  |      |       |                   |
				|         | type                             | name | label | appearance        |
				|         | select_one_from_file my_file.csv | q1   | Q1    | search('my_file') |
				| choices |           |       |       |
				|         | list_name | name  | label |
				|         | my_file   | na    | la    |
			`,
			errored: true,
			error__contains: [
				"Question 'q1' is a select from file type, using 'search()'.",
			],
		});
	});
});
