/**
 * Port of test_secondary_instance_translations.py
 * Testing inlining translation when no translation is specified.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestSecondaryInstanceTest", () => {
	it("test_inline_translations", () => {
		assertPyxformXform({
			md: `
			| survey  |                   |          |            |               |
			|         | type              | name     | label      | choice_filter |
			|         | select_one states | state    | State Name | state != ''   |
			| choices |                   |          |            |
			|         | list name         | name     | label      |
			|         | states            | option a | a          |
			|         | states            | option b | b          |
			|         | states            | option c | c          |
			`,
			model__contains: [
				"<label>a</label>",
				"<label>b</label>",
				"<label>c</label>",
			],
			model__excludes: [
				'<text id="states-0">',
				'<text id="states-1">',
				'<text id="states-2">',
				"<itextId>states-0</itextId>",
				"<itextId>states-1</itextId>",
				"<itextId>states-2</itextId>",
			],
			xml__contains: ['<label ref="label"/>'],
			xml__excludes: ['<label ref="jr:itext(itextId)"/>'],
		});
	});

	it("test_multiple_translations", () => {
		assertPyxformXform({
			md: `
			| survey  |                   |          |            |               |
			|         | type              | name     | label      | choice_filter |
			|         | select_one states | state    | State Name | state != ''   |
			| choices |                   |          |            |
			|         | list name         | name     | label::English(en)|
			|         | states            | option a | a                 |
			|         | states            | option b | b                 |
			|         | states            | option c | c                 |
			`,
			model__contains: [
				'<text id="states-0">',
				'<text id="states-1">',
				'<text id="states-2">',
				"<itextId>states-0</itextId>",
				"<itextId>states-1</itextId>",
				"<itextId>states-2</itextId>",
			],
			model__excludes: [
				"<label>a</label>",
				"<label>b</label>",
				"<label>c</label>",
			],
			xml__contains: ['<label ref="jr:itext(itextId)"/>'],
			xml__excludes: ['<label ref="label"/>'],
		});
	});

	it("test_select_with_media_and_choice_filter_and_no_translations_generates_media", () => {
		assertPyxformXform({
			md: `
			| survey |                    |                 |                                 |                           |
			|        | type               | name            | label                           | choice_filter             |
			|        | select_one consent | consent         | Would you like to participate ? |                           |
			|        | select_one mood    | enumerator_mood | How are you feeling today ?     | selected(\${consent}, 'y') |
			| choices |
			|         | list_name | name | label | media::image |
			|         | mood      | h    | Happy | happy.jpg    |
			|         | mood      | s    | Sad   | sad.jpg      |
			|         | consent   | y    | Yes   |              |
			|         | consent   | n    | No    |              |
			`,
			xml__xpath_match: [
				// Consent
				`/h:html/h:body/x:select1[
				  @ref = '/test_name/consent'
				  and ./x:itemset
				  and not(./x:item)
				]`,
				`/h:html/h:head/x:model/x:instance[@id='consent']/x:root[
				  ./x:item/x:name/text() = 'y' and ./x:item/x:label/text() = 'Yes'
				  and ./x:item/x:name/text() = 'n' and ./x:item/x:label/text() = 'No'
				]`,
				`/h:html/h:head/x:model/x:itext/x:translation[
				  @lang='default'
				  and not(descendant::x:text[@id='/test_name/consent/y:label'])
				]`,
				`/h:html/h:head/x:model/x:itext/x:translation[
				  @lang='default'
				  and not(descendant::x:text[@id='/test_name/consent/n:label'])
				]`,
				// Mood
				`/h:html/h:body/x:select1[
				  @ref = '/test_name/enumerator_mood'
				  and ./x:itemset
				  and not(./x:item)
				]`,
				`/h:html/h:head/x:model/x:instance[@id='mood']/x:root[
				  ./x:item[
				    ./x:name/text() = 'h'
				      and not(./x:label)
				      and ./x:itextId = 'mood-0'
				  ]
				  and ./x:item[
				    ./x:name/text() = 's'
				      and not(./x:label)
				      and ./x:itextId = 'mood-1'
				  ]
				]`,
				`/h:html/h:head/x:model/x:itext/x:translation[
				  @lang='default'
				  and not(descendant::x:text[@id='/test_name/mood/h:label'])
				]`,
				`/h:html/h:head/x:model/x:itext/x:translation[
				  @lang='default'
				  and not(descendant::x:text[@id='/test_name/mood/s:label'])
				]`,
				`/h:html/h:head/x:model/x:itext/x:translation[
				  @lang='default' and
				  ./x:text[
				    @id='mood-0'
				    and ./x:value[not(@form) and text()='Happy']
				  ]
				  and ./x:text[
				    @id='mood-1'
				    and ./x:value[not(@form) and text()='Sad']
				  ]
				]`,
				`/h:html/h:head/x:model/x:itext/x:translation[
				  @lang='default' and
				  ./x:text[
				    @id='mood-0'
				    and ./x:value[@form='image' and text()='jr://images/happy.jpg']
				  ]
				  and ./x:text[
				    @id='mood-1'
				    and ./x:value[@form='image' and text()='jr://images/sad.jpg']
				  ]
				]`,
			],
		});
	});

	it("test_select_with_choice_filter_and_translations_generates_single_translation", () => {
		assertPyxformXform({
			md: `
			| survey |                    |      |       |               |
			|        | type               | name | label | choice_filter |
			|        | select_one list    | foo  | Foo   | name != ''    |
			| choices |
			|         | list_name | name | label | image | label::French |
			|         | list      | a    | A     | a.jpg | Ah            |
			|         | list      | b    | B     | b.jpg | Bé            |
			|         | list      | c    | C     | c.jpg | Cé            |
			`,
			itext__contains: [
				'<text id="list-0">',
				'<text id="list-1">',
				'<text id="list-2">',
			],
			itext__excludes: [
				'<text id="/test_name/foo/a:label">',
				'<text id="/test_name/foo/b:label">',
				'<text id="/test_name/foo/c:label">',
			],
		});
	});

	it("test_select_with_dynamic_option_label__and_choice_filter__and_no_translations__generates_itext", () => {
		assertPyxformXform({
			md: `
			| survey |                    |      |            |               |         |
			|        | type               | name | label      | choice_filter | default |
			|        | text               | txt  | Enter text |               | default |
			|        | select_one choices | one  | Select one | 1 < 2         |         |
			| choices |
			|         | list_name | name | label        |
			|         | choices   | one  | One - \${txt} |
			`,
			itext__contains: [
				'<text id="choices-0">',
				'<value> One - <output value=" /test_name/txt "/>',
			],
			model__contains: ["<itextId>choices-0</itextId>", "<name>one</name>"],
			xml__contains: ['<label ref="jr:itext(itextId)"/>'],
			xml__excludes: ['<label ref="label"/>', "<label>One - ${txt}</label>"],
		});
	});

	it("test_select_with_dynamic_option_label_for_second_choice__and_choice_filter__and_no_translations__generates_itext", () => {
		assertPyxformXform({
			md: `
			| survey |                    |      |            |               |         |
			|        | type               | name | label      | choice_filter | default |
			|        | text               | txt  | Enter text |               | default |
			|        | select_one choices | one  | Select one | 1 < 2         |         |
			| choices |
			|         | list_name | name | label        |
			|         | choices   | one  | One          |
			|         | choices   | two  | Two - \${txt} |
			`,
			itext__contains: [
				'<text id="choices-0">',
				"<value>One</value>",
				'<text id="choices-1">',
				'<value> Two - <output value=" /test_name/txt "/>',
			],
			model__contains: [
				"<itextId>choices-0</itextId>",
				"<name>one</name>",
				"<itextId>choices-1</itextId>",
				"<name>two</name>",
			],
			xml__contains: ['<label ref="jr:itext(itextId)"/>'],
			xml__excludes: ['<label ref="label"/>', "<label>One</label>"],
		});
	});

	it("test_select_with_dynamic_option_label__and_choice_filter__and_no_translations__maintains_additional_columns", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |                    |      |            |               |         |
			|        | type               | name | label      | choice_filter | default |
			|        | text               | txt  | Enter text |               | default |
			|        | select_one choices | one  | Select one | 1 < 2         |         |
			| choices |
			|         | list_name | name | label        | foo |
			|         | choices   | one  | One - \${txt} | baz |
			`,
			model__contains: ["<foo>baz</foo>"],
		});
	});

	it("test_select_with_dynamic_option_label__and_no_choice_filter__and_no_translations__inlines_output", () => {
		assertPyxformXform({
			md: `
			| survey |                    |      |            |
			|        | type               | name | label      |
			|        | text               | txt  | Text       |
			|        | select_one choices | one  | Select one |
			| choices |
			|         | list_name | name | label        |
			|         | choices   | one  | One - \${txt} |
			`,
			xml__xpath_match: [
				`/h:html/h:body/x:select1[
				  @ref = '/test_name/one'
				  and ./x:itemset
				  and not(./x:item)
				]`,
				`/h:html/h:head/x:model/x:instance[@id='choices']/x:root[
				  ./x:item[
				    ./x:name/text() = 'one'
				      and not(./x:label)
				      and ./x:itextId = 'choices-0'
				  ]
				]`,
				`
				/h:html/h:head/x:model/x:itext/x:translation[@lang='default']
				  /x:text[@id='choices-0']
				  /x:value[not(@form)
				    and node()[position() = 1] = ' One - '
				    and node()[position() = 2] = ./x:output[@value=' /test_name/txt ']
				  ]
				`,
			],
		});
	});
});
