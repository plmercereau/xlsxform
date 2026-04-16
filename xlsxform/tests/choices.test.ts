/**
 * Port of test_choices_sheet.py - Choices sheet tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

/**
 * XPath helper: model instance has choices elements with name and label.
 * Equivalent to xpc.model_instance_choices_label()
 */
function xpcModelInstanceChoicesLabel(
	cname: string,
	choices: [string, string][],
): string {
	const choicesXp = choices
		.map(
			([cv, cl]) =>
				`./x:item/x:name/text() = '${cv}' and ./x:item/x:label/text() = '${cl}'`,
		)
		.join("\n              and ");
	return `
        /h:html/h:head/x:model/x:instance[@id='${cname}']/x:root[
          ${choicesXp}
        ]
        `;
}

/**
 * XPath helper: model instance has choices elements with name and itextId (no label).
 * Equivalent to xpc.model_instance_choices_itext()
 */
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

/**
 * XPath helper: model itext has text labels by position.
 * Equivalent to xpc.model_itext_choice_text_label_by_pos()
 */
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

/**
 * XPath helper: body has a select1 with an itemset and no inline items.
 * Equivalent to xpq.body_select1_itemset()
 */
function xpqBodySelect1Itemset(qName: string): string {
	return `
        /h:html/h:body/x:select1[
          @ref = '/test_name/${qName}'
          and ./x:itemset
          and not(./x:item)
        ]
        `;
}

// Pre-resolved error message strings from Python ErrorCode enum
const LABEL_001 = (row: number) =>
	`[row : ${row}] On the 'choices' sheet, the 'label' value is invalid. Choices should have a label. Learn more: https://xlsform.org/en/#setting-up-your-worksheets`;

const NAMES_006 = (row: number) =>
	`[row : ${row}] On the 'choices' sheet, the 'name' value is invalid. Choices must have a name. Learn more: https://xlsform.org/en/#setting-up-your-worksheets`;

const NAMES_007 = (row: number) =>
	`[row : ${row}] On the 'choices' sheet, the 'name' value is invalid. Choice names must be unique for each choice list. If this is intentional, use the setting 'allow_choice_duplicates'. Learn more: https://xlsform.org/#choice-names.`;

const PYREF_003 = ({
	sheet,
	column,
	row,
	q,
}: {
	sheet: string;
	column: string;
	row: number;
	q: string;
}) =>
	`[row : ${row}] On the '${sheet}' sheet, the '${column}' value is invalid. Reference variables must contain a name from the 'survey' sheet. Could not find the name '${q}'.`;

describe("TestChoicesSheet", () => {
	it("should allow numeric choice names for static selects", () => {
		assertPyxformXform({
			md: `
			| survey   |                    |      |       |
			|          | type               | name | label |
			|          | select_one choices | a    | A     |
			| choices  |                    |      |       |
			|          | list_name          | name | label |
			|          | choices            | 1    | One   |
			|          | choices            | 2    | Two   |
			`,
			xml__xpath_match: [
				xpcModelInstanceChoicesLabel("choices", [
					["1", "One"],
					["2", "Two"],
				]),
				xpqBodySelect1Itemset("a"),
			],
		});
	});

	it("should allow numeric choice names for dynamic selects", () => {
		assertPyxformXform({
			md: `
			| survey   |                    |      |       |               |
			|          | type               | name | label | choice_filter |
			|          | select_one choices | a    | A     | true()        |
			| choices  |                    |      |       |
			|          | list_name          | name | label |
			|          | choices            | 1    | One   |
			|          | choices            | 2    | Two   |
			`,
			xml__xpath_match: [
				xpcModelInstanceChoicesLabel("choices", [
					["1", "One"],
					["2", "Two"],
				]),
				xpqBodySelect1Itemset("a"),
			],
		});
	});

	it("should warn if a label is missing in the choices sheet for static selects", () => {
		assertPyxformXform({
			md: `
			| survey   |                    |      |       |
			|          | type               | name | label |
			|          | select_one choices | a    | A     |
			| choices  |                    |      |       |
			|          | list_name          | name | label |
			|          | choices            | 1    |       |
			|          | choices            | 2    |       |
			`,
			xml__xpath_match: [
				xpqBodySelect1Itemset("a"),
				`
				/h:html/h:head/x:model/x:instance[@id='choices']/x:root[
				  ./x:item/x:name/text() = '1'
				    and not(./x:item/x:label)
				    and not(./x:item/x:itextId)
				  and
				  ./x:item/x:name/text() = '2'
				    and not(./x:item/x:label)
				    and not(./x:item/x:itextId)
				]
				`,
			],
			warnings__contains: [LABEL_001(2), LABEL_001(3)],
		});
	});

	it("should warn if a label is missing in the choices sheet for dynamic selects", () => {
		assertPyxformXform({
			md: `
			| survey   |                    |      |       |               |
			|          | type               | name | label | choice_filter |
			|          | select_one choices | a    | A     | true()        |
			| choices  |                    |      |       |
			|          | list_name          | name | label |
			|          | choices            | 1    |       |
			|          | choices            | 2    |       |
			`,
			xml__xpath_match: [
				xpqBodySelect1Itemset("a"),
				`
				/h:html/h:head/x:model/x:instance[@id='choices']/x:root[
				  ./x:item/x:name/text() = '1'
				    and not(./x:item/x:label)
				    and not(./x:item/x:itextId)
				  and
				  ./x:item/x:name/text() = '2'
				    and not(./x:item/x:label)
				    and not(./x:item/x:itextId)
				]
				`,
			],
			warnings__contains: [LABEL_001(2), LABEL_001(3)],
		});
	});

	it("should find that element order matches column order for extra columns", () => {
		assertPyxformXform({
			md: `
			| survey   |                    |      |       |
			|          | type               | name | label |
			|          | select_one choices | a    | A     |
			| choices  |                    |      |       |
			|          | list_name          | name | label | geometry                 |
			|          | choices            | 1    | one   | 46.5841618 7.0801379 0 0 |
			|          | choices            | 2    | two   | 35.8805082 76.515057 0 0 |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:instance[@id='choices']/x:root/x:item[
				  ./x:name = ./x:*[text() = '1']
				  and ./x:geometry = ./x:*[text() = '46.5841618 7.0801379 0 0']
				]
				`,
				`
				/h:html/h:head/x:model/x:instance[@id='choices']/x:root/x:item[
				  ./x:name = ./x:*[text() = '2']
				  and ./x:geometry = ./x:*[text() = '35.8805082 76.515057 0 0']
				]
				`,
			],
		});
	});

	it("should include unreferenced choice lists in the output", () => {
		assertPyxformXform({
			md: `
			| survey  |
			|         | type               | name | label |
			|         | select_one choices | a    | A     |
			| choices |
			|         | list_name | name | label |
			|         | choices   | 1    | Y     |
			|         | choices   | 2    | N     |
			|         | choices2  | 1    | Y     |
			|         | choices2  | 2    | N     |
			`,
			xml__xpath_match: [
				xpcModelInstanceChoicesLabel("choices", [
					["1", "Y"],
					["2", "N"],
				]),
				xpcModelInstanceChoicesLabel("choices2", [
					["1", "Y"],
					["2", "N"],
				]),
			],
		});
	});

	it("should error on duplicate choices without setting", () => {
		assertPyxformXform({
			md: `
			| survey  |                 |          |          |
			|         | type            | name     | label    |
			|         | select_one list | S1       | s1       |
			| choices |                 |          |          |
			|         | list name       | name     | label    |
			|         | list            | a        | option a |
			|         | list            | b        | option b |
			|         | list            | b        | option c |
			`,
			errored: true,
			error__contains: [NAMES_007(4)],
		});
	});

	it("should error on multiple duplicate choices without setting", () => {
		assertPyxformXform({
			md: `
			| survey  |                 |          |          |
			|         | type            | name     | label    |
			|         | select_one list | S1       | s1       |
			| choices |                 |          |          |
			|         | list name       | name     | label    |
			|         | list            | a        | option a |
			|         | list            | a        | option b |
			|         | list            | b        | option c |
			|         | list            | b        | option d |
			`,
			errored: true,
			error__contains: [NAMES_007(3), NAMES_007(5)],
		});
	});

	it("should error on duplicate choices with setting not set to yes", () => {
		assertPyxformXform({
			md: `
			| survey  |                 |          |          |
			|         | type            | name     | label    |
			|         | select_one list | S1       | s1       |
			| choices |                 |          |          |
			|         | list name       | name     | label    |
			|         | list            | a        | option a |
			|         | list            | b        | option b |
			|         | list            | b        | option c |
			| settings |                |          |          |
			|          | id_string    | allow_choice_duplicates   |
			|          | Duplicates   | Bob                       |
			`,
			errored: true,
			error__contains: [NAMES_007(4)],
		});
	});

	it("should allow duplicate choices with allow_choice_duplicates setting", () => {
		assertPyxformXform({
			md: `
			| survey  |                 |      |       |
			|         | type            | name | label |
			|         | select_one list | S1   | s1    |
			| choices |                 |      |       |
			|         | list name       | name | label |
			|         | list            | a    | A     |
			|         | list            | b    | B     |
			|         | list            | b    | C     |
			| settings |                |                         |
			|          | id_string      | allow_choice_duplicates |
			|          | Duplicates     | Yes                     |
			`,
			xml__xpath_match: [
				xpcModelInstanceChoicesLabel("list", [
					["a", "A"],
					["b", "B"],
					["b", "C"],
				]),
				xpqBodySelect1Itemset("S1"),
			],
		});
	});

	it("should allow duplicate choices with allow_choice_duplicates setting and translations", () => {
		assertPyxformXform({
			md: `
			| survey  |                 |      |           |           |
			|         | type            | name | label::en | label::ko |
			|         | select_one list | S1   | s1        | 질문 1     |
			| choices |                 |      |                |
			|         | list name       | name | label::en      | label::ko |
			|         | list            | a    | Pass           | 패스       |
			|         | list            | b    | Fail           | 실패       |
			|         | list            | c    | Skipped        | 건너뛴     |
			|         | list            | c    | Not Applicable | 해당 없음  |
			| settings |                |                         |
			|          | id_string      | allow_choice_duplicates |
			|          | Duplicates     | Yes                     |
			`,
			xml__xpath_match: [
				xpcModelItextChoiceTextLabelByPos("en", "list", [
					"Pass",
					"Fail",
					"Skipped",
					"Not Applicable",
				]),
				xpcModelItextChoiceTextLabelByPos("ko", "list", [
					"패스",
					"실패",
					"건너뛴",
					"해당 없음",
				]),
			],
		});
	});

	it("should succeed for choice list without duplicates", () => {
		assertPyxformXform({
			md: `
			| survey  |                 |      |       |
			|         | type            | name | label |
			|         | select_one list | S1   | s1    |
			| choices |                 |      |       |
			|         | list name       | name | label |
			|         | list            | a    | A     |
			|         | list            | b    | B     |
			| settings |              |                         |
			|          | id_string    | allow_choice_duplicates |
			|          | Duplicates   | Yes                     |
			`,
			xml__xpath_match: [
				xpcModelInstanceChoicesLabel("list", [
					["a", "A"],
					["b", "B"],
				]),
				xpqBodySelect1Itemset("S1"),
			],
		});
	});

	it("should find the label is an output node using the reference", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type          | name | label |
			| | select_one c1 | q1   | Q1    |

			| choices |
			| | list_name | name | label |
			| | c1        | n1   | \${q1} |
			`,
			xml__xpath_match: [
				xpcModelInstanceChoicesItext("c1", ["n1"]),
				`
				/h:html/h:head/x:model/x:itext/x:translation[@lang='default']
				  /x:text[@id='c1-0']/x:value[
				    not(@form)
				    and normalize-space(./text())=''
				    and ./x:output[@value=' /test_name/q1 ']
				  ]
				`,
			],
		});
	});

	it("should find the label is an output node using the reference when translated", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type          | name | label |
			| | select_one c1 | q1   | Q1    |

			| choices |
			| | list_name | name | label::English (en) |
			| | c1        | n1   | \${q1}               |
			`,
			xml__xpath_match: [
				xpcModelInstanceChoicesItext("c1", ["n1"]),
				`
				/h:html/h:head/x:model/x:itext/x:translation[@lang='English (en)']
				  /x:text[@id='c1-0']/x:value[
				    not(@form)
				    and normalize-space(./text())=''
				    and ./x:output[@value=' /test_name/q1 ']
				  ]
				`,
			],
		});
	});

	it("should error if the referenced name in label is not found in the survey sheet", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type          | name | label |
			| | select_one c1 | q1   | Q1    |

			| choices |
			| | list_name | name | label  |
			| | c1        | n1   | \${q1x} |
			`,
			errored: true,
			error__contains: [
				PYREF_003({ sheet: "choices", column: "label", row: 2, q: "q1x" }),
			],
		});
	});

	it("should error if the referenced name in translated label is not found in the survey sheet", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type          | name | label |
			| | select_one c1 | q1   | Q1    |

			| choices |
			| | list_name | name | label::English (en) |
			| | c1        | n1   | \${q1x}              |
			`,
			errored: true,
			error__contains: [
				PYREF_003({
					sheet: "choices",
					column: "label::English (en)",
					row: 2,
					q: "q1x",
				}),
			],
		});
	});

	it("should find the media is an output node using the reference", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type          | name | label |
			| | select_one c1 | q1   | Q1    |

			| choices |
			| | list_name | name | audio |
			| | c1        | n1   | \${q1} |
			`,
			xml__xpath_match: [
				xpcModelInstanceChoicesItext("c1", ["n1"]),
				`
				/h:html/h:head/x:model/x:itext/x:translation[@lang='default']
				  /x:text[@id='c1-0']/x:value[
				    @form='audio'
				    and normalize-space(./text())='jr://audio/'
				    and ./x:output[@value=' /test_name/q1 ']
				  ]
				`,
			],
		});
	});

	it("should find the media is an output node using the reference when translated", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type          | name | label |
			| | select_one c1 | q1   | Q1    |

			| choices |
			| | list_name | name | audio::English (en) |
			| | c1        | n1   | \${q1}               |
			`,
			xml__xpath_match: [
				xpcModelInstanceChoicesItext("c1", ["n1"]),
				`
				/h:html/h:head/x:model/x:itext/x:translation[@lang='English (en)']
				  /x:text[@id='c1-0']/x:value[
				    @form='audio'
				    and normalize-space(./text())='jr://audio/'
				    and ./x:output[@value=' /test_name/q1 ']
				  ]
				`,
			],
		});
	});

	it("should error if the referenced name in media is not found in the survey sheet", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type          | name | label |
			| | select_one c1 | q1   | Q1    |

			| choices |
			| | list_name | name | audio  |
			| | c1        | n1   | \${q1x} |
			`,
			errored: true,
			error__contains: [
				PYREF_003({ sheet: "choices", column: "audio", row: 2, q: "q1x" }),
			],
		});
	});

	it("should error if the referenced name in translated media is not found in the survey sheet", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type          | name | label |
			| | select_one c1 | q1   | Q1    |

			| choices |
			| | list_name | name | audio::English (en) |
			| | c1        | n1   | \${q1x}              |
			`,
			errored: true,
			error__contains: [
				PYREF_003({
					sheet: "choices",
					column: "audio::English (en)",
					row: 2,
					q: "q1x",
				}),
			],
		});
	});

	it("should not resolve references in extra choices columns", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type          | name | label |
			| | select_one c1 | q1   | Q1    |

			| choices |
			| | list_name | name | label | extra |
			| | c1        | n1   | N1    | \${q1} |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:instance[@id='c1']/x:root/x:item[
				  ./x:name/text()='n1'
				  and ./x:label/text()='N1'
				  and ./x:extra/text()='\${q1}'
				]
				`,
			],
		});
	});

	it("should not validate references in extra choices columns", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type          | name | label |
			| | select_one c1 | q1   | Q1    |
			| | audio         | q2   | Q2    |

			| choices |
			| | list_name | name | label | unknown  | bad_syntax |
			| | c1        | n1   | N1    | \${q1x}   | \${}        |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:instance[@id='c1']/x:root/x:item[
				  ./x:name/text()='n1'
				  and ./x:label/text()='N1'
				  and ./x:unknown/text()='\${q1x}'
				  and ./x:bad_syntax/text()='\${}'
				]
				`,
			],
		});
	});

	it("should validate references even when extra columns are interspersed between columns of interest", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type          | name | label |
			| | select_one c1 | q1   | Q1    |

			| choices |
			| | list_name | extra | name | label |
			| | c1        | \${q1} | n1   | N1    |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:instance[@id='c1']/x:root/x:item[
				  ./x:name/text()='n1'
				  and ./x:label/text()='N1'
				  and ./x:extra/text()='\${q1}'
				]
				`,
			],
		});
	});

	it("should error if a name is missing in the choices sheet", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type          | name | label |
			| | select_one c1 | q1   | Q1    |

			| choices |
			| | list_name | name | label |
			| | c1        |      | N1    |
			`,
			errored: true,
			error__contains: [NAMES_006(2)],
		});
	});

	it("should not raise an error if a name has invalid XML name characters", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type          | name | label |
			| | select_one c1 | q1   | Q1    |

			| choices |
			| | list_name | name | label |
			| | c1        | .n   | N1    |
			`,
			xml__xpath_match: [xpcModelInstanceChoicesLabel("c1", [[".n", "N1"]])],
		});
	});
});
