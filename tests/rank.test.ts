/**
 * Port of test_rank.py - Rank widget tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

/**
 * XPath helper functions ported from xpath_helpers/choices.py and questions.py.
 */
function modelInstanceChoicesLabel(
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

function modelInstanceChoicesItext(
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

function bodyOdkRankItemset(qName: string): string {
	return `
        /h:html/h:body/odk:rank[
          @ref = '/test_name/${qName}'
          and ./x:itemset
          and not(./x:item)
        ]
        `;
}

function modelItextChoiceTextLabelByPos(
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

function modelItextNoTextById(lang: string, idStr: string): string {
	return `
        /h:html/h:head/x:model/x:itext/x:translation[
          @lang='${lang}'
          and not(descendant::x:text[@id='${idStr}'])
        ]
        `;
}

describe("RangeWidgetTest", () => {
	it("test_rank", () => {
		assertPyxformXform({
			md: `
				| survey |              |          |       |
				|        | type         | name     | label |
				|        | rank mylist  | order    | Rank  |
				| choices|              |          |       |
				|        | list_name    | name     | label |
				|        | mylist       | a        | A     |
				|        | mylist       | b        | B     |
			`,
			xml__xpath_match: [
				modelInstanceChoicesLabel("mylist", [["a", "A"], ["b", "B"]]),
				bodyOdkRankItemset("order"),
				"/h:html/h:head/x:model/x:bind[@nodeset='/test_name/order' and @type='odk:rank']",
			],
		});
	});

	it("test_rank_filter", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |              |          |       |               |
				|        | type         | name     | label | choice_filter |
				|        | rank mylist  | order    | Rank  | color='blue'  |
				| choices|              |          |       |
				|        | list_name    | name     | label | color |
				|        | mylist       | a        | A     | red   |
				|        | mylist       | b        | B     | blue  |
			`,
			xml__contains: [
				'xmlns:odk="http://www.opendatakit.org/xforms"',
				'<bind nodeset="/data/order" type="odk:rank"/>',
				'<instance id="mylist">',
				"<color>red</color>",
				"<name>a</name>",
				"<color>blue</color>",
				"<name>b</name>",
				`<odk:rank ref="/data/order">
      <label>Rank</label>
      <itemset nodeset="instance('mylist')/root/item[color='blue']">
        <value ref="name"/>
        <label ref="label"/>
      </itemset>
    </odk:rank>`,
			],
		});
	});

	it("test_rank_translations", () => {
		assertPyxformXform({
			md: `
				| survey |              |          |       |                    |
				|        | type         | name     | label | label::French (fr) |
				|        | rank mylist  | order    | Rank  | Ranger             |
				| choices|              |          |       |
				|        | list_name    | name     | label | label::French (fr) |
				|        | mylist       | a        | A     |  AA                |
				|        | mylist       | b        | B     |  BB                |
			`,
			xml__xpath_match: [
				modelInstanceChoicesItext("mylist", ["a", "b"]),
				bodyOdkRankItemset("order"),
				"/h:html/h:head/x:model/x:bind[@nodeset='/test_name/order' and @type='odk:rank']",
				modelItextChoiceTextLabelByPos("default", "mylist", ["A", "B"]),
				modelItextChoiceTextLabelByPos("French (fr)", "mylist", ["AA", "BB"]),
				modelItextNoTextById("default", "/test_name/order/a:label"),
				modelItextNoTextById("default", "/test_name/order/b:label"),
				modelItextNoTextById("French (fr)", "/test_name/order/a:label"),
				modelItextNoTextById("French (fr)", "/test_name/order/b:label"),
			],
		});
	});
});
