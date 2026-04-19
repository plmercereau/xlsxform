/**
 * Port of test_translations.py - Translation and multi-language tests.
 * Includes all tests from TestTranslations, TestTranslationsSurvey,
 * TestTranslationsChoices, and TestTranslationsOrOther classes,
 * plus the extended translations tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

// Constants matching Python's pyxform constants
const DEFAULT_LANG = "default";
const SURVEY = "survey";
const CHOICES = "choices";

const OR_OTHER_WARNING =
	"This form uses or_other and translations, which is not recommended. " +
	"An untranslated input question label and choice label is generated " +
	"for 'other'. Learn more: https://xlsform.org/en/#specify-other).";

// --- XPath Helper: replicates Python XPathHelper dataclass ---

interface XPathHelperOpts {
	question_type: string;
	question_name: string;
}

const JR_PREFIXES: Record<string, string> = {
	audio: "jr://audio/",
	image: "jr://images/",
	"big-image": "jr://images/",
	video: "jr://video/",
};

const FORM_PREFIXES: Record<string, [string, string]> = {
	audio: ["label", "jr://audio/"],
	image: ["label", "jr://images/"],
	"big-image": ["label", "jr://images/"],
	video: ["label", "jr://video/"],
	guidance: ["hint", ""],
};

function xpathHelper(opts: XPathHelperOpts) {
	const { question_type, question_name } = opts;

	return {
		question_label_in_body(label: string) {
			return `
			/h:html/h:body/x:${question_type}[@ref='/test_name/${question_name}']
			  /x:label[not(@ref) and text()='${label}']
			`;
		},
		question_hint_in_body(hint: string) {
			return `
			/h:html/h:body/x:${question_type}[@ref='/test_name/${question_name}']
			  /x:hint[not(@ref) and text()='${hint}']
			`;
		},
		question_label_references_itext() {
			return `
			/h:html/h:body/x:${question_type}[@ref='/test_name/${question_name}']
			  /x:label[@ref="jr:itext('/test_name/${question_name}:label')" and not(text())]
			`;
		},
		question_hint_references_itext() {
			return `
			/h:html/h:body/x:${question_type}[@ref='/test_name/${question_name}']
			  /x:hint[@ref="jr:itext('/test_name/${question_name}:hint')" and not(text())]
			`;
		},
		question_itext_label(lang: string, label: string) {
			return `
			/h:html/h:head/x:model/x:itext/x:translation[@lang='${lang}']
			  /x:text[@id='/test_name/${question_name}:label']
			  /x:value[not(@form) and text()='${label}']
			`;
		},
		question_itext_hint(lang: string, hint: string) {
			return `
			/h:html/h:head/x:model/x:itext/x:translation[@lang='${lang}']
			  /x:text[@id='/test_name/${question_name}:hint']
			  /x:value[not(@form) and text()='${hint}']
			`;
		},
		question_itext_form(lang: string, form: string, fname: string) {
			const prefix = FORM_PREFIXES[form];
			return `
			/h:html/h:head/x:model/x:itext/x:translation[@lang='${lang}']
			  /x:text[@id='/test_name/${question_name}:${prefix[0]}']
			  /x:value[@form='${form}' and text()='${prefix[1]}${fname}']
			`;
		},
		question_no_itext_label(lang: string, label: string) {
			return `
			/h:html/h:head/x:model[not(
			  x:itext/x:translation[@lang='${lang}']
			  /x:text[@id='/test_name/${question_name}:label']
			  /x:value[not(@form) and text()='${label}']
			)]
			`;
		},
		question_no_itext_hint(lang: string, hint: string) {
			return `
			/h:html/h:head/x:model[not(
			  x:itext/x:translation[@lang='${lang}']
			  /x:text[@id='/test_name/${question_name}:hint']
			  /x:value[not(@form) and text()='${hint}']
			)]
			`;
		},
		question_no_itext_form(lang: string, form: string, fname: string) {
			const prefix = FORM_PREFIXES[form];
			return `
			/h:html/h:head/x:model/x:itext/x:translation[@lang='${lang}']
			  /x:text[@id='/test_name/${question_name}:${prefix[0]}'
			    and not(descendant::x:value[@form='${form}' and text()='${prefix[1]}${fname}'])]
			`;
		},
		constraint_msg_in_bind(msg: string) {
			return `
			/h:html/h:head/x:model/x:bind[@nodeset='/test_name/${question_name}'
			  and @jr:constraintMsg='${msg}']
			`;
		},
		constraint_msg_references_itext() {
			return `
			/h:html/h:head/x:model/x:bind[@nodeset='/test_name/${question_name}'
			  and @jr:constraintMsg="jr:itext('/test_name/${question_name}:jr:constraintMsg')"]
			`;
		},
		constraint_msg_itext(lang: string, msg: string) {
			return `
			/h:html/h:head/x:model/x:itext/x:translation[@lang='${lang}']
			  /x:text[@id='/test_name/${question_name}:jr:constraintMsg']
			  /x:value[not(@form) and text()='${msg}']
			`;
		},
		required_msg_in_bind(msg: string) {
			return `
			/h:html/h:head/x:model/x:bind[@nodeset='/test_name/${question_name}'
			  and @jr:requiredMsg='${msg}']
			`;
		},
		required_msg_references_itext() {
			return `
			/h:html/h:head/x:model/x:bind[@nodeset='/test_name/${question_name}'
			  and @jr:requiredMsg="jr:itext('/test_name/${question_name}:jr:requiredMsg')"]
			`;
		},
		required_msg_itext(lang: string, msg: string) {
			return `
			/h:html/h:head/x:model/x:itext/x:translation[@lang='${lang}']
			  /x:text[@id='/test_name/${question_name}:jr:requiredMsg']
			  /x:value[not(@form) and text()='${msg}']
			`;
		},
	};
}

// --- Settings XPath helpers (xps) ---

const xps = {
	language_is_default(lang: string) {
		return `
		/h:html/h:head/x:model/x:itext/x:translation[@default='true()' and @lang='${lang}']
		`;
	},
	language_is_not_default(lang: string) {
		return `
		/h:html/h:head/x:model/x:itext/x:translation[not(@default='true()') and @lang='${lang}']
		`;
	},
	language_no_itext(lang: string) {
		return `
		/h:html/h:head/x:model/x:itext[not(descendant::x:translation[@lang='${lang}'])]
		`;
	},
};

// --- Questions XPath helpers (xpq) ---

const xpq = {
	body_select1_itemset(qname: string) {
		return `
		/h:html/h:body/x:select1[
		  @ref = '/test_name/${qname}'
		  and ./x:itemset
		  and not(./x:item)
		]
		`;
	},
	body_label_inline(qtype: string, qname: string, qlabel: string) {
		return `
		/h:html/h:body/x:${qtype}[@ref='/test_name/${qname}']
		  /x:label[not(@ref) and text()='${qlabel}']
		`;
	},
	body_label_itext(qtype: string, qname: string) {
		return `
		/h:html/h:body/x:${qtype}[@ref='/test_name/${qname}']
		  /x:label[@ref="jr:itext('/test_name/${qname}:label')" and not(text())]
		`;
	},
	model_itext_label(qname: string, lang: string, qlabel: string) {
		return `
		/h:html/h:head/x:model/x:itext/x:translation[@lang='${lang}']
		  /x:text[@id='/test_name/${qname}:label']
		  /x:value[not(@form) and text()='${qlabel}']
		`;
	},
	model_itext_form(qname: string, lang: string, form: string, fname: string) {
		const prefix = FORM_PREFIXES[form];
		return `
		/h:html/h:head/x:model/x:itext/x:translation[@lang='${lang}']
		  /x:text[@id='/test_name/${qname}:${prefix[0]}']
		  /x:value[@form='${form}' and text()='${prefix[1]}${fname}']
		`;
	},
	body_group_select1_itemset(gname: string, qname: string) {
		return `
		/h:html/h:body/x:group[@ref='/test_name/${gname}']/x:select1[
		  @ref = '/test_name/${gname}/${qname}'
		  and ./x:itemset
		  and not(./x:item)
		]
		`;
	},
	body_repeat_select1_itemset(rname: string, qname: string) {
		return `
		/h:html/h:body/x:group[@ref='/test_name/${rname}']
		  /x:repeat[@nodeset='/test_name/${rname}']
		    /x:select1[
		      @ref = '/test_name/${rname}/${qname}'
		      and ./x:itemset
		      and not(./x:item)
		    ]
		`;
	},
};

// --- Choices XPath helpers (xpc) ---

const xpc = {
	model_instance_choices_label(cname: string, choices: [string, string][]) {
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
	},
	model_instance_choices_itext(cname: string, choices: string[]) {
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
	},
	model_itext_choice_text_label_by_pos(
		lang: string,
		cname: string,
		choices: string[],
	) {
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
	},
	model_itext_choice_media_by_pos(
		lang: string,
		cname: string,
		choices: ([string, string] | [null, null])[][],
	) {
		const parts: string[] = [];
		choices.forEach((choice, idx) => {
			for (const [form, media] of choice) {
				if (form !== null) {
					parts.push(`
				./x:text[
				  @id='${cname}-${idx}'
				  and ./x:value[@form='${form}' and text()='${JR_PREFIXES[form]}${media}']
				]
				`);
				}
			}
		});
		const choicesXp = parts.join("\n              and ");
		return `
		/h:html/h:head/x:model/x:itext/x:translation[
		  @lang='${lang}' and
		  ${choicesXp}
		]
		`;
	},
	model_no_itext_choice_media_by_pos(
		lang: string,
		cname: string,
		choices: ([string, string] | [null, null])[][],
	) {
		const parts: string[] = [];
		choices.forEach((choice, idx) => {
			for (const [form, media] of choice) {
				if (form !== null) {
					parts.push(`
				./x:text[
				  @id='${cname}-${idx}'
				  and not(descendant::x:value[@form='${form}' and text()='${JR_PREFIXES[form]}${media}'])
				]
				`);
				}
			}
		});
		const choicesXp = parts.join("\n              and ");
		return `
		/h:html/h:head/x:model/x:itext/x:translation[
		  @lang='${lang}' and
		  ${choicesXp}
		]
		`;
	},
	body_itemset_references_itext(qtype: string, qname: string, cname: string) {
		return `
		/h:html/h:body/x:${qtype}[@ref='/test_name/${qname}']
		  /x:itemset[@nodeset="instance('${cname}')/root/item[${qname} != '']"
		    and child::x:label[@ref='jr:itext(itextId)'] and child::x:value[@ref='name']]
		`;
	},
};

// --- Warning message formatter (replicates Python format_missing_translations_msg) ---

function formatMissingTranslationsMsg(
	_in: Record<string, Record<string, string[]>>,
): string {
	function getSheetMsg(
		name: string,
		sheet?: Record<string, string[]>,
	): string | null {
		if (!sheet) {
			return null;
		}
		const langs = Object.keys(sheet).sort();
		if (langs.length === 0) {
			return null;
		}
		const langMsgs: string[] = [];
		for (const lang of langs) {
			const cols = sheet[lang];
			if (cols.length === 1) {
				langMsgs.push(
					`Language '${lang}' is missing the ${name} ${cols[0]} column.`,
				);
			}
			if (cols.length > 1) {
				const c = [...cols].sort().join(", ");
				langMsgs.push(
					`Language '${lang}' is missing the ${name} columns ${c}.`,
				);
			}
		}
		return langMsgs.join("\n");
	}

	const survey = getSheetMsg(SURVEY, _in[SURVEY]);
	const choices = getSheetMsg(CHOICES, _in[CHOICES]);
	const messages = [survey, choices].filter((m): m is string => m !== null);
	return messages.join("\n");
}

// --- Shared choice media tuples for TestTranslationsChoices ---

const FORMS_AB: [string, string][][] = [
	[
		["audio", "a.mp3"],
		["image", "a.jpg"],
		["big-image", "a.jpg"],
		["video", "a.mkv"],
	],
	[
		["audio", "b.mp3"],
		["image", "b.jpg"],
		["big-image", "b.jpg"],
		["video", "b.mkv"],
	],
];

const FORMS_L_AUDIO: [string, string][][] = [
	[["audio", "la-d.mp3"]],
	[["audio", "lb-d.mp3"]],
];

// ============================================================================
// TestTranslations - Miscellaneous translations behaviour or cases
// ============================================================================

describe("TestTranslations", () => {
	it("should find translations with double colon syntax", () => {
		const xp = xpathHelper({ question_type: "input", question_name: "n1" });
		assertPyxformXform({
			md: `
				| survey |      |      |                     |                    |
				|        | type | name | label::english (en) | label::french (fr) |
				|        | note | n1   | hello               | bonjour            |
			`,
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label("english (en)", "hello"),
				xp.question_itext_label("french (fr)", "bonjour"),
				xps.language_is_not_default("english (en)"),
				xps.language_is_not_default("french (fr)"),
				xps.language_no_itext(DEFAULT_LANG),
				// Expected model binding found.
				`/h:html/h:head/x:model
				     /x:bind[@nodeset='/test_name/n1' and @readonly='true()' and @type='string']
				`,
			],
			warnings_count: 0,
		});
	});

	it("should trim whitespace either side of double-colon delimiter", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label::French (fr) | constraint           | constraint_message::French (fr) | constraint_message :: English (en) |
				|        | text | q1   | Q1                 | string-length(.) > 5 | Trop court!                     | Too short!                         |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:itext/x:translation[@lang='French (fr)']
				  /x:text[@id='/test_name/q1:jr:constraintMsg']
				  /x:value[not(@form) and text()='Trop court!']
				`,
				`
				/h:html/h:head/x:model/x:itext/x:translation[@lang='English (en)']
				  /x:text[@id='/test_name/q1:jr:constraintMsg']
				  /x:value[not(@form) and text()='Too short!']
				`,
			],
		});
	});

	it("should handle missing media itext translation", () => {
		const q1_default =
			"A.01 Have you received informed consent from the respondent?";
		const q1_russian =
			"\u041F\u043E\u043B\u0443\u0447\u0438\u043B\u0438 \u043B\u0438 \u0432\u044B \u0444\u043E\u0440\u043C\u0443 \u0441\u043E\u0433\u043B\u0430\u0441\u0438\u044F \u043E\u0442 \u0440\u0435\u0441\u043F\u043E\u043D\u0434\u0435\u043D\u0442\u0430?";
		const xp = xpathHelper({ question_type: "select1", question_name: "q1" });
		assertPyxformXform({
			md: `
				| survey |       |               |              |                |                 |          |                      |                       |
				|        | name  | type          | label        | label::Russian | label::Kyrgyz   | required | media::audio::Kyrgyz | media::audio::Russian |
				|        | q1    | select_one yn | ${q1_default} | ${q1_russian}   | This is Kyrgyz. | true     | something.mp3        | test.mp3              |
				| choices |           |      |       |                |               |
				|         | list name | name | label | label::Russian | label::Kyrgyz |
				|         | yn        | 0    | No    | \u041D\u0435\u0442            | \u041D\u0435\u0442 (ky)      |
				|         | yn        | 1    | Yes   | \u0414\u0430             | \u0414\u0430 (ky)       |
			`,
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label(DEFAULT_LANG, q1_default),
				xp.question_itext_label("Russian", q1_russian),
				xp.question_itext_label("Kyrgyz", "This is Kyrgyz."),
				xp.question_no_itext_form(DEFAULT_LANG, "audio", "-"),
				xp.question_itext_form("Russian", "audio", "test.mp3"),
				xp.question_itext_form("Kyrgyz", "audio", "something.mp3"),
				xpq.body_select1_itemset("q1"),
				xpc.model_instance_choices_itext("yn", ["0", "1"]),
				xpc.model_itext_choice_text_label_by_pos("default", "yn", [
					"No",
					"Yes",
				]),
				xpc.model_itext_choice_text_label_by_pos("Russian", "yn", [
					"\u041D\u0435\u0442",
					"\u0414\u0430",
				]),
				xpc.model_itext_choice_text_label_by_pos("Kyrgyz", "yn", [
					"\u041D\u0435\u0442 (ky)",
					"\u0414\u0430 (ky)",
				]),
				xps.language_is_default(DEFAULT_LANG),
				xps.language_is_not_default("Russian"),
				xps.language_is_not_default("Kyrgyz"),
			],
		});
	});

	it("should warn if there are multiple missing translations with one lang all cols", () => {
		const settings = `
				| settings |                  |
				|          | default_language |
				|          | eng              |
		`;
		const md = `
				| survey |               |      |       |            |            |                    |                   |                   |                   |                         |                       |
				|        | type          | name | label | label::eng | hint::eng  | guidance_hint::eng | media::image::eng | media::video::eng | media::audio::eng | constraint_message::eng | required_message::eng |
				|        | select_one c1 | q1   | hello | hi there   | salutation | greeting           | greeting.jpg      | greeting.mkv      | greeting.mp3      | check me                | mandatory             |
				| choices |           |      |                 |
				|         | list name | name | label | label::eng | media::audio::eng | media::image::eng | media::video::eng |
				|         | c1        | na   | la-d  | la-e       | la-d.mp3          | la-d.jpg          | la-d.mkv          |
				|         | c1        | nb   | lb-d  | lb-e       | lb-d.mp3          | lb-d.jpg          | lb-d.mkv          |
		`;
		const cols: Record<string, Record<string, string[]>> = {
			[SURVEY]: {
				[DEFAULT_LANG]: [
					"hint",
					"guidance_hint",
					"image",
					"video",
					"audio",
					"constraint_message",
					"required_message",
				],
			},
			[CHOICES]: {
				[DEFAULT_LANG]: ["image", "video", "audio"],
			},
		};
		const warning = formatMissingTranslationsMsg(cols);
		const xp = xpathHelper({ question_type: "select1", question_name: "q1" });
		const commonXpaths = [
			xp.question_label_references_itext(),
			xp.question_itext_label("eng", "hi there"),
			xp.question_hint_references_itext(),
			xp.question_itext_hint("eng", "salutation"),
			xp.question_itext_form("eng", "guidance", "greeting"),
			xp.question_itext_form("eng", "image", "greeting.jpg"),
			xp.question_itext_form("eng", "video", "greeting.mkv"),
			xp.question_itext_form("eng", "audio", "greeting.mp3"),
			xp.constraint_msg_references_itext(),
			xp.constraint_msg_itext("eng", "check me"),
			xp.required_msg_references_itext(),
			xp.required_msg_itext("eng", "mandatory"),
			xpq.body_select1_itemset("q1"),
			xpc.model_instance_choices_itext("c1", ["na", "nb"]),
			xpc.model_itext_choice_text_label_by_pos("eng", "c1", ["la-e", "lb-e"]),
			xpc.model_itext_choice_media_by_pos("eng", "c1", [
				[
					["audio", "la-d.mp3"],
					["image", "la-d.jpg"],
					["video", "la-d.mkv"],
				],
				[
					["audio", "lb-d.mp3"],
					["image", "lb-d.jpg"],
					["video", "lb-d.mkv"],
				],
			]),
		];
		// Warning case
		assertPyxformXform({
			md,
			warnings__contains: [warning],
			xml__xpath_match: [
				...commonXpaths,
				xp.question_itext_label(DEFAULT_LANG, "hello"),
				xp.question_itext_hint(DEFAULT_LANG, "-"),
				xp.question_itext_form(DEFAULT_LANG, "guidance", "-"),
				xp.question_no_itext_form(DEFAULT_LANG, "image", "greeting.jpg"),
				xp.question_no_itext_form(DEFAULT_LANG, "video", "greeting.mkv"),
				xp.question_no_itext_form(DEFAULT_LANG, "audio", "greeting.mp3"),
				xp.constraint_msg_itext(DEFAULT_LANG, "-"),
				xp.required_msg_itext(DEFAULT_LANG, "-"),
				xpc.model_itext_choice_text_label_by_pos("default", "c1", [
					"la-d",
					"lb-d",
				]),
				xpc.model_no_itext_choice_media_by_pos(DEFAULT_LANG, "c1", [
					[
						["audio", "la-d.mp3"],
						["image", "la-d.jpg"],
						["video", "la-d.mkv"],
					],
					[
						["audio", "lb-d.mp3"],
						["image", "lb-d.jpg"],
						["video", "lb-d.mkv"],
					],
				]),
				xps.language_is_default(DEFAULT_LANG),
				xps.language_is_not_default("eng"),
			],
		});
		// default_language set case
		assertPyxformXform({
			md: settings + md,
			// TODO: bug - missing default lang translatable/itext values.
			// warnings__contains: [warning],
			xml__xpath_match: [
				...commonXpaths,
				xps.language_is_default("eng"),
				xps.language_no_itext(DEFAULT_LANG),
			],
		});
	});

	it("should identify multi-language when survey and choices columns present", () => {
		assertPyxformXform({
			md: `
				| survey  |                |       |            |            |
				|         | type           | name  | label      | label::en  |
				|         | select_one c0  | f     | f          |            |
				|         | select_one c1  | q1    | Question 1 | Question A |
				| choices |           |      |        |            |           |
				|         | list name | name | label  | label::en  | label::fr |
				|         | c0        | n    | l      |            |           |
				|         | c1        | na   | la     |            |           |
				|         | c1        | nb   | lb     | lb-e       | lb-f      |
			`,
			xml__xpath_match: [
				xpq.body_select1_itemset("f"),
				xpq.body_label_inline("select1", "f", "f"),
				xpq.body_select1_itemset("q1"),
				xpq.body_label_itext("select1", "q1"),
				xpq.model_itext_label("q1", DEFAULT_LANG, "Question 1"),
				xpq.model_itext_label("q1", "en", "Question A"),
				xpq.model_itext_label("q1", "fr", "-"),
				xpc.model_instance_choices_label("c0", [["n", "l"]]),
				xpc.model_instance_choices_itext("c1", ["na", "nb"]),
				xpc.model_itext_choice_text_label_by_pos(DEFAULT_LANG, "c1", [
					"la",
					"lb",
				]),
				xpc.model_itext_choice_text_label_by_pos("en", "c1", ["-", "lb-e"]),
				xpc.model_itext_choice_text_label_by_pos("fr", "c1", ["-", "lb-f"]),
			],
		});
	});

	it("should identify multi-language when only choices are translated", () => {
		assertPyxformXform({
			md: `
				| survey  |                |       |            |
				|         | type           | name  | label      |
				|         | select_one c0  | f     | f          |
				|         | select_one c1  | q1    | Question 1 |
				| choices |           |      |        |            |           |
				|         | list name | name | label  | label::en  | label::fr |
				|         | c0        | n    | l      |            |           |
				|         | c1        | na   | la     |            |           |
				|         | c1        | nb   | lb     | lb-e       | lb-f      |
			`,
			xml__xpath_match: [
				xpq.body_select1_itemset("f"),
				xpq.body_label_inline("select1", "f", "f"),
				xpq.body_select1_itemset("q1"),
				xpq.body_label_inline("select1", "q1", "Question 1"),
				xpc.model_instance_choices_label("c0", [["n", "l"]]),
				xpc.model_instance_choices_itext("c1", ["na", "nb"]),
				xpc.model_itext_choice_text_label_by_pos(DEFAULT_LANG, "c1", [
					"la",
					"lb",
				]),
				xpc.model_itext_choice_text_label_by_pos("en", "c1", ["-", "lb-e"]),
				xpc.model_itext_choice_text_label_by_pos("fr", "c1", ["-", "lb-f"]),
			],
		});
	});

	it("should identify multi-language when only survey columns present", () => {
		assertPyxformXform({
			md: `
				| survey  |                |       |            |            |
				|         | type           | name  | label      | label::en  |
				|         | select_one c0  | f     | f          |            |
				|         | select_one c1  | q1    | Question 1 | Question A |
				| choices |           |      |        |
				|         | list name | name | label  |
				|         | c0        | n    | l      |
				|         | c1        | na   | la     |
				|         | c1        | nb   | lb     |
			`,
			xml__xpath_match: [
				xpq.body_select1_itemset("f"),
				xpq.body_label_inline("select1", "f", "f"),
				xpq.body_select1_itemset("q1"),
				xpq.body_label_itext("select1", "q1"),
				xpq.model_itext_label("q1", DEFAULT_LANG, "Question 1"),
				xpq.model_itext_label("q1", "en", "Question A"),
				xpc.model_instance_choices_label("c0", [["n", "l"]]),
				xpc.model_instance_choices_label("c1", [
					["na", "la"],
					["nb", "lb"],
				]),
			],
		});
	});

	it("should identify multi-language when survey columns present with media", () => {
		assertPyxformXform({
			md: `
				| survey  |                |       |            |            |           |
				|         | type           | name  | label      | label::en  | image::en |
				|         | select_one c0  | f     | f          |            |           |
				|         | select_one c1  | q1    | Question 1 | Question A | c1.png    |
				| choices |           |      |        |            |           |           |
				|         | list name | name | label  | label::en  | label::fr | audio::de |
				|         | c0        | n    | l      |            |           |           |
				|         | c1        | na   | la     |            |           |           |
				|         | c1        | nb   | lb     | lb-e       |           | c1_nb.mp3 |
				|         | c1        | nc   | lc     | lc-e       | lc-f      | c1_nc.mp3 |
			`,
			xml__xpath_match: [
				xpq.body_select1_itemset("f"),
				xpq.body_label_inline("select1", "f", "f"),
				xpq.body_select1_itemset("q1"),
				xpq.body_label_itext("select1", "q1"),
				xpq.model_itext_label("q1", DEFAULT_LANG, "Question 1"),
				xpq.model_itext_label("q1", "en", "Question A"),
				xpq.model_itext_form("q1", "en", "image", "c1.png"),
				xpc.model_instance_choices_label("c0", [["n", "l"]]),
				xpc.model_itext_choice_text_label_by_pos(DEFAULT_LANG, "c1", [
					"la",
					"lb",
					"lc",
				]),
				xpc.model_itext_choice_text_label_by_pos("en", "c1", [
					"-",
					"lb-e",
					"lc-e",
				]),
				xpc.model_itext_choice_text_label_by_pos("fr", "c1", [
					"-",
					"-",
					"lc-f",
				]),
				xpc.model_itext_choice_text_label_by_pos("de", "c1", ["-", "-", "-"]),
				xpc.model_itext_choice_media_by_pos("de", "c1", [
					[[null, null]],
					[["audio", "c1_nb.mp3"]],
					[["audio", "c1_nc.mp3"]],
				]),
			],
		});
	});
});

// ============================================================================
// TestTranslationsSurvey - Translations behaviour of columns in the Survey sheet
// ============================================================================

describe("TestTranslationsSurvey", () => {
	const xp = xpathHelper({ question_type: "input", question_name: "n1" });

	it("should not find default language translations for only label/hint", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |       |            |
				|        | type | name | label | hint       |
				|        | note | n1   | hello | salutation |
			`,
			xml__xpath_match: [
				xp.question_label_in_body("hello"),
				xp.question_no_itext_label(DEFAULT_LANG, "hello"),
				xp.question_hint_in_body("salutation"),
				xp.question_no_itext_hint(DEFAULT_LANG, "salutation"),
				// No translations.
				"/h:html/h:head/x:model[not(descendant::x:itext)]",
			],
			warnings_count: 0,
		});
	});

	it("should find default language translations for label and image but not hint", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |       |            |              |
				|        | type | name | label | hint       | media::image |
				|        | note | n1   | hello | salutation | greeting.jpg |
			`,
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label(DEFAULT_LANG, "hello"),
				// TODO: is this a bug? Why itext for label/image but not hint?
				xp.question_hint_in_body("salutation"),
				xp.question_no_itext_hint(DEFAULT_LANG, "salutation"),
				xp.question_itext_form(DEFAULT_LANG, "image", "greeting.jpg"),
				xps.language_is_default(DEFAULT_LANG),
			],
			warnings_count: 0,
		});
	});

	it("should find default language translations for hint and guidance but not label", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |       |            |               |
				|        | type | name | label | hint       | guidance_hint |
				|        | note | n1   | hello | salutation | greeting      |
			`,
			xml__xpath_match: [
				// TODO: is this a bug? Why itext for hint/guidance but not label?
				xp.question_label_in_body("hello"),
				xp.question_no_itext_label(DEFAULT_LANG, "hello"),
				xp.question_hint_references_itext(),
				xp.question_itext_hint(DEFAULT_LANG, "salutation"),
				xp.question_itext_form(DEFAULT_LANG, "guidance", "greeting"),
				xps.language_is_default(DEFAULT_LANG),
			],
			warnings_count: 0,
		});
	});

	it("should find default language translations for all translatables", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |       |            |               |              |              |              |                    |                  |
				|        | type | name | label | hint       | guidance_hint | media::image | media::video | media::audio | constraint_message | required_message |
				|        | note | n1   | hello | salutation | greeting      | greeting.jpg | greeting.mkv | greeting.mp3 | check me           | mandatory        |
			`,
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label(DEFAULT_LANG, "hello"),
				xp.question_hint_references_itext(),
				xp.question_itext_hint(DEFAULT_LANG, "salutation"),
				xp.question_itext_form(DEFAULT_LANG, "guidance", "greeting"),
				xp.question_itext_form(DEFAULT_LANG, "image", "greeting.jpg"),
				xp.question_itext_form(DEFAULT_LANG, "video", "greeting.mkv"),
				xp.question_itext_form(DEFAULT_LANG, "audio", "greeting.mp3"),
				xp.constraint_msg_in_bind("check me"),
				xp.required_msg_in_bind("mandatory"),
				xps.language_is_default(DEFAULT_LANG),
			],
			warnings_count: 0,
		});
	});

	it("should find default language translations for image and big-image", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |              |                  |
				|        | type | name | media::image | media::big-image |
				|        | note | n1   | greeting.jpg | greeting.jpg     |
			`,
			xml__xpath_match: [
				xp.question_itext_form(DEFAULT_LANG, "image", "greeting.jpg"),
				xp.question_itext_form(DEFAULT_LANG, "big-image", "greeting.jpg"),
				xps.language_is_default(DEFAULT_LANG),
			],
			warnings_count: 0,
		});
	});

	it("should find language translations for label and hint with one translation", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |                |               |
				|        | type | name | label::eng(en) | hint::eng(en) |
				|        | note | n1   | hello          | salutation    |
			`,
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label("eng(en)", "hello"),
				xp.question_hint_references_itext(),
				xp.question_itext_hint("eng(en)", "salutation"),
				// TODO: is this a bug? Only one language but not marked default.
				xps.language_is_not_default("eng(en)"),
				xps.language_no_itext(DEFAULT_LANG),
			],
			warnings_count: 0,
		});
	});

	it("should find language translations for label, hint, and image with one translation", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |                |               |                       |
				|        | type | name | label::eng(en) | hint::eng(en) | media::image::eng(en) |
				|        | note | n1   | hello          | salutation    | greeting.jpg          |
			`,
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label("eng(en)", "hello"),
				xp.question_hint_references_itext(),
				xp.question_itext_hint("eng(en)", "salutation"),
				xp.question_itext_form("eng(en)", "image", "greeting.jpg"),
				xps.language_is_not_default("eng(en)"),
				xps.language_no_itext(DEFAULT_LANG),
			],
			warnings_count: 0,
		});
	});

	it("should find language translations for label, hint, and guidance with one translation", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |                |               |                        |
				|        | type | name | label::eng(en) | hint::eng(en) | guidance_hint::eng(en) |
				|        | note | n1   | hello          | salutation    | greeting               |
			`,
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label("eng(en)", "hello"),
				xp.question_hint_references_itext(),
				xp.question_itext_hint("eng(en)", "salutation"),
				xp.question_itext_form("eng(en)", "guidance", "greeting"),
				xps.language_is_not_default("eng(en)"),
				xps.language_no_itext(DEFAULT_LANG),
			],
			warnings_count: 0,
		});
	});

	it("should find language translations for all translatables with one translation", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |                |               |                        |                       |                           |                       |                       |                             |                           |
				|        | type | name | label::eng(en) | hint::eng(en) | guidance_hint::eng(en) | media::image::eng(en) | media::big-image::eng(en) | media::video::eng(en) | media::audio::eng(en) | constraint_message::eng(en) | required_message::eng(en) |
				|        | note | n1   | hello          | salutation    | greeting               | greeting.jpg          | greeting.jpg              | greeting.mkv          | greeting.mp3          | check me                    | mandatory                 |
			`,
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label("eng(en)", "hello"),
				xp.question_hint_references_itext(),
				xp.question_itext_hint("eng(en)", "salutation"),
				xp.question_itext_form("eng(en)", "guidance", "greeting"),
				xp.question_itext_form("eng(en)", "image", "greeting.jpg"),
				xp.question_itext_form("eng(en)", "big-image", "greeting.jpg"),
				xp.question_itext_form("eng(en)", "video", "greeting.mkv"),
				xp.question_itext_form("eng(en)", "audio", "greeting.mp3"),
				xp.constraint_msg_references_itext(),
				xp.constraint_msg_itext("eng(en)", "check me"),
				xp.required_msg_references_itext(),
				xp.required_msg_itext("eng(en)", "mandatory"),
				xps.language_is_not_default("eng(en)"),
				xps.language_no_itext(DEFAULT_LANG),
			],
			warnings_count: 0,
		});
	});

	it("should warn if missing translation one lang simple no default", () => {
		const warning = formatMissingTranslationsMsg({
			[SURVEY]: { "eng(en)": ["hint"] },
		});
		assertPyxformXform({
			md: `
				| survey |      |      |       |                |            |
				|        | type | name | label | label::eng(en) | hint       |
				|        | note | n1   | hello | hi there       | salutation |
			`,
			warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label(DEFAULT_LANG, "hello"),
				xp.question_itext_label("eng(en)", "hi there"),
				xp.question_hint_in_body("salutation"),
				xps.language_is_default(DEFAULT_LANG),
				xps.language_is_not_default("eng(en)"),
			],
		});
	});

	it("should warn if missing translation one lang simple with default", () => {
		const warning = formatMissingTranslationsMsg({
			[SURVEY]: { eng: ["hint"] },
		});
		assertPyxformXform({
			md: `
				| settings |                  |
				|          | default_language |
				|          | eng              |
				| survey |      |      |       |            |            |
				|        | type | name | label | label::eng | hint       |
				|        | note | n1   | hello | hi there   | salutation |
			`,
			warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label("eng", "hi there"),
				xp.question_hint_in_body("salutation"),
				xp.question_no_itext_hint("eng", "salutation"),
				xps.language_is_default("eng"),
				// TODO: bug - missing default lang translatable/itext values.
				xps.language_no_itext(DEFAULT_LANG),
			],
		});
	});

	it("should warn if missing translations one lang all cols no default", () => {
		const cols: Record<string, Record<string, string[]>> = {
			[SURVEY]: {
				[DEFAULT_LANG]: [
					"hint",
					"guidance_hint",
					"image",
					"big-image",
					"video",
					"audio",
					"constraint_message",
					"required_message",
				],
			},
		};
		const warning = formatMissingTranslationsMsg(cols);
		assertPyxformXform({
			md: `
				| survey |      |      |       |            |            |                    |                   |                       |                   |                   |                         |                       |
				|        | type | name | label | label::eng | hint::eng  | guidance_hint::eng | media::image::eng | media::big-image::eng | media::video::eng | media::audio::eng | constraint_message::eng | required_message::eng |
				|        | note | n1   | hello | hi there   | salutation | greeting           | greeting.jpg      | greeting.jpg          | greeting.mkv      | greeting.mp3      | check me                | mandatory             |
			`,
			warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label(DEFAULT_LANG, "hello"),
				xp.question_itext_label("eng", "hi there"),
				xp.question_hint_references_itext(),
				xp.question_itext_hint("eng", "salutation"),
				xp.question_itext_hint(DEFAULT_LANG, "-"),
				xp.question_itext_form("eng", "guidance", "greeting"),
				xp.question_itext_form(DEFAULT_LANG, "guidance", "-"),
				xp.question_itext_form("eng", "image", "greeting.jpg"),
				xp.question_no_itext_form(DEFAULT_LANG, "image", "greeting.jpg"),
				xp.question_itext_form("eng", "big-image", "greeting.jpg"),
				xp.question_no_itext_form(DEFAULT_LANG, "big-image", "greeting.jpg"),
				xp.question_itext_form("eng", "video", "greeting.mkv"),
				xp.question_no_itext_form(DEFAULT_LANG, "video", "greeting.mkv"),
				xp.question_itext_form("eng", "audio", "greeting.mp3"),
				xp.question_no_itext_form(DEFAULT_LANG, "audio", "greeting.mp3"),
				xp.constraint_msg_references_itext(),
				xp.constraint_msg_itext("eng", "check me"),
				xp.constraint_msg_itext(DEFAULT_LANG, "-"),
				xp.required_msg_references_itext(),
				xp.required_msg_itext("eng", "mandatory"),
				xp.required_msg_itext(DEFAULT_LANG, "-"),
				xps.language_is_default(DEFAULT_LANG),
				xps.language_is_not_default("eng"),
			],
		});
	});

	it("should warn if missing translations one lang all cols with default", () => {
		assertPyxformXform({
			md: `
				| settings |                  |
				|          | default_language |
				|          | eng              |
				| survey |      |      |       |            |            |                    |                   |                       |                   |                   |                         |                       |
				|        | type | name | label | label::eng | hint::eng  | guidance_hint::eng | media::image::eng | media::big-image::eng | media::video::eng | media::audio::eng | constraint_message::eng | required_message::eng |
				|        | note | n1   | hello | hi there   | salutation | greeting           | greeting.jpg      | greeting.jpg          | greeting.mkv      | greeting.mp3      | check me                | mandatory             |
			`,
			// TODO: bug - missing default lang translatable/itext values.
			// warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label("eng", "hi there"),
				xp.question_hint_references_itext(),
				xp.question_itext_hint("eng", "salutation"),
				xp.question_itext_form("eng", "guidance", "greeting"),
				xp.question_itext_form("eng", "image", "greeting.jpg"),
				xp.question_itext_form("eng", "video", "greeting.mkv"),
				xp.question_itext_form("eng", "audio", "greeting.mp3"),
				xps.language_is_default("eng"),
				xp.constraint_msg_references_itext(),
				xp.constraint_msg_itext("eng", "check me"),
				xp.required_msg_references_itext(),
				xp.required_msg_itext("eng", "mandatory"),
				xps.language_no_itext(DEFAULT_LANG),
			],
		});
	});

	it("should warn if missing translation one lang overlap no default", () => {
		const warning = formatMissingTranslationsMsg({
			[SURVEY]: { eng: ["hint"], default: ["label"] },
		});
		assertPyxformXform({
			md: `
				| survey |      |      |            |            |
				|        | type | name | label::eng | hint       |
				|        | note | n1   | hello      | salutation |
			`,
			warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label("eng", "hello"),
				xp.question_hint_in_body("salutation"),
				xp.question_no_itext_hint("eng", "salutation"),
				xp.question_no_itext_hint(DEFAULT_LANG, "salutation"),
				xps.language_is_not_default("eng"),
				xps.language_no_itext(DEFAULT_LANG),
			],
		});
	});

	it("should warn if missing translation one lang overlap with default", () => {
		const warning = formatMissingTranslationsMsg({
			[SURVEY]: { eng: ["hint"] },
		});
		assertPyxformXform({
			md: `
				| settings |                  |
				|          | default_language |
				|          | eng              |
				| survey |      |      |            |            |
				|        | type | name | label::eng | hint       |
				|        | note | n1   | hello      | salutation |
			`,
			warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label("eng", "hello"),
				// TODO: is this a bug? Default hint gets merged into eng hint.
				xp.question_hint_in_body("salutation"),
				xp.question_no_itext_hint(DEFAULT_LANG, "salutation"),
				xp.question_no_itext_hint("eng", "salutation"),
				xps.language_is_default("eng"),
				xps.language_no_itext(DEFAULT_LANG),
			],
		});
	});

	it("should warn if missing translation two lang no default", () => {
		const warning = formatMissingTranslationsMsg({
			[SURVEY]: { french: ["hint"] },
		});
		assertPyxformXform({
			md: `
				| survey |      |      |            |               |            |
				|        | type | name | label::eng | label::french | hint::eng  |
				|        | note | n1   | hello      | bonjour       | salutation |
			`,
			warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label("eng", "hello"),
				xp.question_itext_label("french", "bonjour"),
				xp.question_hint_references_itext(),
				xp.question_itext_hint("eng", "salutation"),
				// Output of a dash for empty translation is not a bug, it's a reminder /
				// placeholder since XForms spec requires a value for every translation.
				xp.question_itext_hint("french", "-"),
				xps.language_is_not_default("eng"),
				xps.language_is_not_default("french"),
				xps.language_no_itext(DEFAULT_LANG),
			],
		});
	});

	it("should warn if missing translation two lang with default", () => {
		const warning = formatMissingTranslationsMsg({
			[SURVEY]: { french: ["hint"] },
		});
		assertPyxformXform({
			md: `
				| settings |                  |
				|          | default_language |
				|          | eng              |
				| survey |      |      |            |               |            |
				|        | type | name | label::eng | label::french | hint::eng  |
				|        | note | n1   | hello      | bonjour       | salutation |
			`,
			warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label("eng", "hello"),
				xp.question_itext_label("french", "bonjour"),
				xp.question_hint_references_itext(),
				xp.question_itext_hint("eng", "salutation"),
				xp.question_itext_hint("french", "-"),
				xps.language_is_default("eng"),
				xps.language_is_not_default("french"),
				xps.language_no_itext(DEFAULT_LANG),
			],
		});
	});

	it("should warn if missing translation issue 157 no default", () => {
		const warning = formatMissingTranslationsMsg({
			[SURVEY]: {
				default: ["hint", "label"],
				french: ["image"],
			},
		});
		assertPyxformXform({
			md: `
				| survey |      |      |               |              |              |
				|        | type | name | label::french | hint::french | media::image |
				|        | note | n1   | bonjour       | salutation   | greeting.jpg |
			`,
			warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label("french", "bonjour"),
				xp.question_itext_label(DEFAULT_LANG, "-"),
				xp.question_hint_references_itext(),
				xp.question_itext_hint("french", "salutation"),
				xp.question_itext_hint(DEFAULT_LANG, "-"),
				xp.question_no_itext_form("french", "audio", "greeting.mp3"),
				xp.question_itext_form(DEFAULT_LANG, "image", "greeting.jpg"),
				xps.language_is_not_default("french"),
				xps.language_is_default(DEFAULT_LANG),
			],
		});
	});

	it("should warn if missing translation issue 157 with default", () => {
		const warning = formatMissingTranslationsMsg({
			[SURVEY]: { default: ["hint", "label"], french: ["image"] },
		});
		assertPyxformXform({
			md: `
				| settings |                  |
				|          | default_language |
				|          | french           |
				| survey |      |      |               |              |              |
				|        | type | name | label::french | hint::french | media::image |
				|        | note | n1   | bonjour       | salutation   | greeting.jpg |
			`,
			warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_references_itext(),
				xp.question_itext_label("french", "bonjour"),
				xp.question_hint_references_itext(),
				xp.question_itext_hint("french", "salutation"),
				xp.question_itext_form("french", "image", "greeting.jpg"),
				xps.language_is_default("french"),
				// TODO: bug - missing default lang translatable/itext values.
				xps.language_no_itext(DEFAULT_LANG),
			],
			warnings__not_contains: [OR_OTHER_WARNING],
		});
	});
});

// ============================================================================
// TestTranslationsChoices - Translations behaviour of columns in the Choices sheet
// ============================================================================

describe("TestTranslationsChoices", () => {
	const xp = xpathHelper({ question_type: "select1", question_name: "q1" });

	it("should find all translatable choices columns in itext with no lang", () => {
		assertPyxformXform({
			md: `
				| survey  |               |       |            |
				|         | type          | name  | label      |
				|         | select_one c1 | q1    | Question 1 |
				| choices |           |      |       |              |              |                  |              |
				|         | list name | name | label | media::audio | media::image | media::big-image | media::video |
				|         | c1        | na   | la    | a.mp3        | a.jpg        | a.jpg            | a.mkv        |
				|         | c1        | nb   | lb    | b.mp3        | b.jpg        | b.jpg            | b.mkv        |
			`,
			xml__xpath_match: [
				xp.question_label_in_body("Question 1"),
				xpq.body_select1_itemset("q1"),
				xpc.model_instance_choices_itext("c1", ["na", "nb"]),
				xpc.model_itext_choice_text_label_by_pos(DEFAULT_LANG, "c1", [
					"la",
					"lb",
				]),
				xpc.model_itext_choice_media_by_pos(DEFAULT_LANG, "c1", FORMS_AB),
			],
		});
	});

	it("should find all translatable choices columns in itext with one lang", () => {
		assertPyxformXform({
			md: `
				| survey  |               |       |            |
				|         | type          | name  | label      |
				|         | select_one c1 | q1    | Question 1 |
				| choices |           |      |                 |                        |                        |                            |                        |
				|         | list name | name | label::Eng (en) | media::audio::Eng (en) | media::image::Eng (en) | media::big-image::Eng (en) | media::video::Eng (en) |
				|         | c1        | na   | la              | a.mp3                  | a.jpg                  | a.jpg                      | a.mkv                  |
				|         | c1        | nb   | lb              | b.mp3                  | b.jpg                  | b.jpg                      | b.mkv                  |
			`,
			xml__xpath_match: [
				xp.question_label_in_body("Question 1"),
				xpq.body_select1_itemset("q1"),
				xpc.model_instance_choices_itext("c1", ["na", "nb"]),
				xpc.model_itext_choice_text_label_by_pos("Eng (en)", "c1", [
					"la",
					"lb",
				]),
				xpc.model_itext_choice_media_by_pos("Eng (en)", "c1", FORMS_AB),
			],
		});
	});

	it("should find all translatable choices columns in itext with dynamic choices no lang", () => {
		assertPyxformXform({
			md: `
				| survey  |               |       |            |               |
				|         | type          | name  | label      | choice_filter |
				|         | select_one c1 | q1    | Question 1 | q1 != ''      |
				| choices |           |      |       |              |              |                  |              |
				|         | list name | name | label | media::audio | media::image | media::big-image | media::video |
				|         | c1        | na   | la    | a.mp3        | a.jpg        | a.jpg            | a.mkv        |
				|         | c1        | nb   | lb    | b.mp3        | b.jpg        | b.jpg            | b.mkv        |
			`,
			xml__xpath_match: [
				xp.question_label_in_body("Question 1"),
				xpc.body_itemset_references_itext("select1", "q1", "c1"),
				xpc.model_instance_choices_itext("c1", ["na", "nb"]),
				xpc.model_itext_choice_text_label_by_pos(DEFAULT_LANG, "c1", [
					"la",
					"lb",
				]),
				xpc.model_itext_choice_media_by_pos(DEFAULT_LANG, "c1", FORMS_AB),
			],
		});
	});

	it("should find all translatable choices columns in itext with dynamic choices one lang", () => {
		assertPyxformXform({
			md: `
				| survey  |               |       |            |               |
				|         | type          | name  | label      | choice_filter |
				|         | select_one c1 | q1    | Question 1 | q1 != ''      |
				| choices |           |      |                 |                        |                        |                            |                        |
				|         | list name | name | label::Eng (en) | media::audio::Eng (en) | media::image::Eng (en) | media::big-image::Eng (en) | media::video::Eng (en) |
				|         | c1        | na   | la              | a.mp3                  | a.jpg                  | a.jpg                      | a.mkv                  |
				|         | c1        | nb   | lb              | b.mp3                  | b.jpg                  | b.jpg                      | b.mkv                  |
			`,
			xml__xpath_match: [
				xp.question_label_in_body("Question 1"),
				xpc.body_itemset_references_itext("select1", "q1", "c1"),
				xpc.model_instance_choices_itext("c1", ["na", "nb"]),
				xpc.model_itext_choice_text_label_by_pos("Eng (en)", "c1", [
					"la",
					"lb",
				]),
				xpc.model_itext_choice_media_by_pos("Eng (en)", "c1", FORMS_AB),
			],
		});
	});

	it("should warn if choices missing translation one lang simple no default", () => {
		const warning = formatMissingTranslationsMsg({
			[CHOICES]: { eng: ["audio"] },
		});
		assertPyxformXform({
			md: `
				| survey  |               |       |            |
				|         | type          | name  | label      |
				|         | select_one c1 | q1    | Question 1 |
				| choices |           |      |                 |
				|         | list name | name | label | label::eng | media::audio |
				|         | c1        | na   | la-d  | la-e       | la-d.mp3     |
				|         | c1        | nb   | lb-d  | lb-e       | lb-d.mp3     |
			`,
			warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_in_body("Question 1"),
				xpq.body_select1_itemset("q1"),
				xpc.model_instance_choices_itext("c1", ["na", "nb"]),
				xpc.model_itext_choice_text_label_by_pos(DEFAULT_LANG, "c1", [
					"la-d",
					"lb-d",
				]),
				xpc.model_itext_choice_text_label_by_pos("eng", "c1", ["la-e", "lb-e"]),
				xpc.model_itext_choice_media_by_pos(DEFAULT_LANG, "c1", FORMS_L_AUDIO),
				xpc.model_no_itext_choice_media_by_pos("eng", "c1", FORMS_L_AUDIO),
				xps.language_is_default(DEFAULT_LANG),
				xps.language_is_not_default("eng"),
			],
		});
	});

	it("should warn if choices missing translation one lang simple with default", () => {
		const cols: Record<string, Record<string, string[]>> = {
			[CHOICES]: { default: ["label"], eng: ["audio"] },
		};
		const warning = formatMissingTranslationsMsg(cols);
		assertPyxformXform({
			md: `
				| settings |                  |
				|          | default_language |
				|          | eng              |
				| survey  |               |       |            |
				|         | type          | name  | label      |
				|         | select_one c1 | q1    | Question 1 |
				| choices |           |      |                 |
				|         | list name | name | label::eng | media::audio |
				|         | c1        | na   | la-e       | la-d.mp3     |
				|         | c1        | nb   | lb-e       | lb-d.mp3     |
			`,
			warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_in_body("Question 1"),
				xpq.body_select1_itemset("q1"),
				xpc.model_instance_choices_itext("c1", ["na", "nb"]),
				xpc.model_itext_choice_text_label_by_pos("eng", "c1", ["la-e", "lb-e"]),
				xpc.model_itext_choice_media_by_pos("eng", "c1", FORMS_L_AUDIO),
				xps.language_is_default("eng"),
				// TODO: bug - missing default lang translatable/itext values.
				xps.language_no_itext(DEFAULT_LANG),
			],
		});
	});

	it("should warn if choices missing translations one lang all cols no default", () => {
		const cols: Record<string, Record<string, string[]>> = {
			[CHOICES]: { [DEFAULT_LANG]: ["image", "big-image", "video", "audio"] },
		};
		const warning = formatMissingTranslationsMsg(cols);
		assertPyxformXform({
			md: `
				| survey  |               |       |            |
				|         | type          | name  | label      |
				|         | select_one c1 | q1    | Question 1 |
				| choices |           |      |                 |
				|         | list name | name | label | label::eng | media::audio::eng | media::image::eng | media::big-image::eng | media::video::eng |
				|         | c1        | na   | la-d  | la-e       | la-d.mp3          | la-d.jpg          | la-d.jpg              | la-d.mkv          |
				|         | c1        | nb   | lb-d  | lb-e       | lb-d.mp3          | lb-d.jpg          | lb-d.jpg              | lb-d.mkv          |
			`,
			warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_in_body("Question 1"),
				xpq.body_select1_itemset("q1"),
				xpc.model_instance_choices_itext("c1", ["na", "nb"]),
				xpc.model_itext_choice_text_label_by_pos(DEFAULT_LANG, "c1", [
					"la-d",
					"lb-d",
				]),
				xpc.model_itext_choice_text_label_by_pos("eng", "c1", ["la-e", "lb-e"]),
				xpc.model_itext_choice_media_by_pos("eng", "c1", [
					[
						["audio", "la-d.mp3"],
						["image", "la-d.jpg"],
						["big-image", "la-d.jpg"],
						["video", "la-d.mkv"],
					],
					[
						["audio", "lb-d.mp3"],
						["image", "lb-d.jpg"],
						["big-image", "lb-d.jpg"],
						["video", "lb-d.mkv"],
					],
				]),
				xpc.model_no_itext_choice_media_by_pos(DEFAULT_LANG, "c1", [
					[
						["audio", "la-d.mp3"],
						["image", "la-d.jpg"],
						["big-image", "la-d.jpg"],
						["video", "la-d.mkv"],
					],
					[
						["audio", "lb-d.mp3"],
						["image", "lb-d.jpg"],
						["big-image", "la-d.jpg"],
						["video", "lb-d.mkv"],
					],
				]),
				xps.language_is_default(DEFAULT_LANG),
				xps.language_is_not_default("eng"),
			],
		});
	});

	it("should warn if choices missing translations one lang all cols with default", () => {
		assertPyxformXform({
			md: `
				| settings |                  |
				|          | default_language |
				|          | eng              |
				| survey  |               |       |            |
				|         | type          | name  | label      |
				|         | select_one c1 | q1    | Question 1 |
				| choices |           |      |                 |
				|         | list name | name | label | label::eng | media::audio::eng | media::image::eng | media::big-image::eng | media::video::eng |
				|         | c1        | na   | la-d  | la-e       | la-d.mp3          | la-d.jpg          | la-d.jpg              | la-d.mkv          |
				|         | c1        | nb   | lb-d  | lb-e       | lb-d.mp3          | lb-d.jpg          | lb-d.jpg              | lb-d.mkv          |
			`,
			// TODO: bug - missing default lang translatable/itext values.
			// warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_in_body("Question 1"),
				xpq.body_select1_itemset("q1"),
				xpc.model_instance_choices_itext("c1", ["na", "nb"]),
				xpc.model_itext_choice_text_label_by_pos("eng", "c1", ["la-e", "lb-e"]),
				xpc.model_itext_choice_media_by_pos("eng", "c1", [
					[
						["audio", "la-d.mp3"],
						["image", "la-d.jpg"],
						["big-image", "la-d.jpg"],
						["video", "la-d.mkv"],
					],
					[
						["audio", "lb-d.mp3"],
						["image", "lb-d.jpg"],
						["big-image", "lb-d.jpg"],
						["video", "lb-d.mkv"],
					],
				]),
				xps.language_is_default("eng"),
				xps.language_no_itext(DEFAULT_LANG),
			],
		});
	});

	it("should warn if choices missing translation one lang overlap no default", () => {
		const warning = formatMissingTranslationsMsg({
			[CHOICES]: { eng: ["audio"], default: ["label"] },
		});
		assertPyxformXform({
			md: `
				| survey  |               |       |            |
				|         | type          | name  | label      |
				|         | select_one c1 | q1    | Question 1 |
				| choices |           |      |                 |
				|         | list name | name | label::eng | media::audio |
				|         | c1        | na   | la-e       | la-d.mp3     |
				|         | c1        | nb   | lb-e       | lb-d.mp3     |
			`,
			warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_in_body("Question 1"),
				xpq.body_select1_itemset("q1"),
				xpc.model_instance_choices_itext("c1", ["na", "nb"]),
				// Output of a dash for empty translation is not a bug, it's a reminder /
				// placeholder since XForms spec requires a value for every translation.
				xpc.model_itext_choice_text_label_by_pos(DEFAULT_LANG, "c1", [
					"-",
					"-",
				]),
				xpc.model_itext_choice_text_label_by_pos("eng", "c1", ["la-e", "lb-e"]),
				xpc.model_itext_choice_media_by_pos(DEFAULT_LANG, "c1", FORMS_L_AUDIO),
				xpc.model_no_itext_choice_media_by_pos("eng", "c1", FORMS_L_AUDIO),
				xps.language_is_default(DEFAULT_LANG),
				xps.language_is_not_default("eng"),
			],
		});
	});

	it("should warn if choices missing translation one lang overlap with default", () => {
		const warning = formatMissingTranslationsMsg({
			[CHOICES]: { eng: ["audio"], default: ["label"] },
		});
		assertPyxformXform({
			md: `
				| settings |                  |
				|          | default_language |
				|          | eng              |
				| survey  |               |       |            |
				|         | type          | name  | label      |
				|         | select_one c1 | q1    | Question 1 |
				| choices |           |      |                 |
				|         | list name | name | label::eng | media::audio |
				|         | c1        | na   | la-e       | la-d.mp3     |
				|         | c1        | nb   | lb-e       | lb-d.mp3     |
			`,
			warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_in_body("Question 1"),
				xpq.body_select1_itemset("q1"),
				xpc.model_instance_choices_itext("c1", ["na", "nb"]),
				xpc.model_itext_choice_text_label_by_pos("eng", "c1", ["la-e", "lb-e"]),
				// TODO: is this a bug? Default audio gets merged into eng hint.
				xpc.model_itext_choice_media_by_pos("eng", "c1", FORMS_L_AUDIO),
				xps.language_is_default("eng"),
				xps.language_no_itext(DEFAULT_LANG),
			],
		});
	});

	it("should warn if choices missing translation two lang no default", () => {
		const warning = formatMissingTranslationsMsg({
			[CHOICES]: { french: ["audio"] },
		});
		assertPyxformXform({
			md: `
				| survey  |               |       |            |
				|         | type          | name  | label      |
				|         | select_one c1 | q1    | Question 1 |
				| choices |           |      |                 |
				|         | list name | name | label::eng | label::french | media::audio::eng |
				|         | c1        | na   | la-e       | la-f          | la-d.mp3          |
				|         | c1        | nb   | lb-e       | lb-f          | lb-d.mp3          |
			`,
			warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_in_body("Question 1"),
				xpq.body_select1_itemset("q1"),
				xpc.model_instance_choices_itext("c1", ["na", "nb"]),
				xpc.model_itext_choice_text_label_by_pos("eng", "c1", ["la-e", "lb-e"]),
				xpc.model_itext_choice_text_label_by_pos("french", "c1", [
					"la-f",
					"lb-f",
				]),
				xpc.model_itext_choice_media_by_pos("eng", "c1", FORMS_L_AUDIO),
				xpc.model_no_itext_choice_media_by_pos("french", "c1", FORMS_L_AUDIO),
				xps.language_is_not_default("eng"),
				xps.language_is_not_default("french"),
				xps.language_no_itext(DEFAULT_LANG),
			],
		});
	});

	it("should warn if choices missing translation two lang with default", () => {
		const warning = formatMissingTranslationsMsg({
			[CHOICES]: { french: ["audio"] },
		});
		assertPyxformXform({
			md: `
				| settings |                  |
				|          | default_language |
				|          | eng              |
				| survey  |               |       |            |
				|         | type          | name  | label      |
				|         | select_one c1 | q1    | Question 1 |
				| choices |           |      |                 |
				|         | list name | name | label::eng | label::french | media::audio::eng |
				|         | c1        | na   | la-e       | la-f          | la-d.mp3          |
				|         | c1        | nb   | lb-e       | lb-f          | lb-d.mp3          |
			`,
			warnings__contains: [warning],
			xml__xpath_match: [
				xp.question_label_in_body("Question 1"),
				xpq.body_select1_itemset("q1"),
				xpc.model_instance_choices_itext("c1", ["na", "nb"]),
				xpc.model_itext_choice_text_label_by_pos("eng", "c1", ["la-e", "lb-e"]),
				xpc.model_itext_choice_text_label_by_pos("french", "c1", [
					"la-f",
					"lb-f",
				]),
				xpc.model_itext_choice_media_by_pos("eng", "c1", FORMS_L_AUDIO),
				xpc.model_no_itext_choice_media_by_pos("french", "c1", FORMS_L_AUDIO),
				xps.language_is_default("eng"),
				xps.language_is_not_default("french"),
				xps.language_no_itext(DEFAULT_LANG),
			],
			warnings__not_contains: [OR_OTHER_WARNING],
		});
	});

	it("should output itext when list_name contains a dash", () => {
		assertPyxformXform({
			md: `
				| survey  |                      |       |            |
				|         | type                 | name  | label:en   | label:fr |
				|         | select_one with_us   | q0    | Q1 EN      | Q1 FR    |
				|         | select_one with-dash | q1    | Q2 EN      | Q2 FR    |
				| choices |           |      |          |
				|         | list name | name | label:en | label:fr |
				|         | with_us   | na   | l1a-en   | l1a-fr   |
				|         | with_us   | nb   | l1b-en   | l1b-fr   |
				|         | with-dash | na   | l2a-en   | l2a-fr   |
				|         | with-dash | nb   | l2b-en   | l2b-fr   |
			`,
			xml__xpath_match: [
				xpc.model_itext_choice_text_label_by_pos("en", "with_us", [
					"l1a-en",
					"l1b-en",
				]),
				xpc.model_itext_choice_text_label_by_pos("en", "with-dash", [
					"l2a-en",
					"l2b-en",
				]),
				xpc.model_itext_choice_text_label_by_pos("fr", "with_us", [
					"l1a-fr",
					"l1b-fr",
				]),
				xpc.model_itext_choice_text_label_by_pos("fr", "with-dash", [
					"l2a-fr",
					"l2b-fr",
				]),
			],
		});
	});
});

// ============================================================================
// TestTranslationsOrOther - Translations behaviour with or_other
// ============================================================================

describe("TestTranslationsOrOther", () => {
	it("should add other choice to itemset with translations", () => {
		assertPyxformXform({
			md: `
				| survey  |                        |       |            |            |
				|         | type                   | name  | label      | label::eng |
				|         | select_one c1 or_other | q1    | Question 1 | Question A |
				| choices |           |      |       |            |           |
				|         | list name | name | label | label::eng | label::fr | media::image::eng |
				|         | c1        | na   | la    | la-e       | la-f      | a.jpg             |
				|         | c1        | nb   | lb    | lb-e       |           | b.jpg             |
			`,
			xml__xpath_match: [
				xpc.model_itext_choice_text_label_by_pos("eng", "c1", [
					"la-e",
					"lb-e",
					"Other",
				]),
				xpc.model_itext_choice_text_label_by_pos("fr", "c1", [
					"la-f",
					"-",
					"Other",
				]),
				xpc.model_itext_choice_text_label_by_pos(DEFAULT_LANG, "c1", [
					"la",
					"lb",
					"Other",
				]),
				xpq.body_select1_itemset("q1"),
				`
				/h:html/h:body/x:input[@ref='/test_name/q1_other']/
				  x:label[text() = 'Specify other.']
				`,
			],
			warnings__contains: [OR_OTHER_WARNING],
		});
	});

	it("should add other choice to itemset with translations only", () => {
		assertPyxformXform({
			md: `
				| survey  |                        |       |            |            |
				|         | type                   | name  | label::en  | label::fr  |
				|         | select_one c1 or_other | q1    | Question 1 | Question A |
				| choices |           |      |            |           |
				|         | list name | name | label::en  | label::fr |
				|         | c1        | na   | la-e       | la-f      |
				|         | c1        | nb   | lb-e       |           |
			`,
			xml__xpath_match: [
				xpc.model_itext_choice_text_label_by_pos("en", "c1", [
					"la-e",
					"lb-e",
					"Other",
				]),
				xpc.model_itext_choice_text_label_by_pos("fr", "c1", [
					"la-f",
					"-",
					"Other",
				]),
				`
				/h:html/h:head/x:model/x:itext[
				  not(descendant::x:translation[@lang='default'])
				]
				`,
				xpq.body_select1_itemset("q1"),
				`
				/h:html/h:body/x:input[@ref='/test_name/q1_other']/
				  x:label[text() = 'Specify other.']
				`,
			],
			warnings__contains: [OR_OTHER_WARNING],
		});
	});

	it("should add other choice to itemset with media only", () => {
		assertPyxformXform({
			md: `
				| survey  |                        |       |            |
				|         | type                   | name  | label      |
				|         | select_one c1 or_other | q1    | Question 1 |
				| choices |           |      |       |              |
				|         | list name | name | label | media::image |
				|         | c1        | na   | la    | a.jpg        |
				|         | c1        | nb   | lb    | b.jpg        |
			`,
			xml__xpath_match: [
				xpc.model_itext_choice_text_label_by_pos(DEFAULT_LANG, "c1", [
					"la",
					"lb",
					"Other",
				]),
				xpq.body_select1_itemset("q1"),
				`
				/h:html/h:body/x:input[@ref='/test_name/q1_other']/
				  x:label[text() = 'Specify other.']
				`,
			],
		});
	});

	it("should not add extra other choice if already defined", () => {
		// Blank translations for existing "other" choices are not replaced with "Other".
		assertPyxformXform({
			md: `
				| survey  |                        |       |            |            |
				|         | type                   | name  | label::en  | label::fr  |
				|         | select_one c1 or_other | q1    | Question 1 | Question A |
				| choices |           |       |            |           |
				|         | list name | name  | label::en  | label::fr |
				|         | c1        | na    | la-e       | la-f      |
				|         | c1        | nb    | lb-e       |           |
				|         | c1        | other | Other      |           |
			`,
			xml__xpath_match: [
				xpc.model_itext_choice_text_label_by_pos("en", "c1", [
					"la-e",
					"lb-e",
					"Other",
				]),
				xpc.model_itext_choice_text_label_by_pos("fr", "c1", [
					"la-f",
					"-",
					"-",
				]),
				`
				/h:html/h:head/x:model/x:itext[
				  not(descendant::x:translation[@lang='default'])
				]
				`,
				xpq.body_select1_itemset("q1"),
				`
				/h:html/h:body/x:input[@ref='/test_name/q1_other']/
				  x:label[text() = 'Specify other.']
				`,
			],
			warnings__contains: [OR_OTHER_WARNING],
		});
	});

	it("should add other choice with missing first translation", () => {
		// xls2json validation would raise an error if a choice has no label at all.
		assertPyxformXform({
			md: `
				| survey  |                        |       |            |            |           |
				|         | type                   | name  | label      | label::eng | label::fr |
				|         | select_one c1 or_other | q1    | Question 1 | Question A | QA fr     |
				| choices |           |      |       |            |           |
				|         | list name | name | label | label::eng | label::fr |
				|         | c1        | na   | la    | la-e       | la-f      |
				|         | c1        | nb   | lb    | lb-e       |           |
			`,
			xml__xpath_match: [
				xpc.model_itext_choice_text_label_by_pos("eng", "c1", [
					"la-e",
					"lb-e",
					"Other",
				]),
				xpc.model_itext_choice_text_label_by_pos("fr", "c1", [
					"la-f",
					"-",
					"Other",
				]),
				xpc.model_itext_choice_text_label_by_pos(DEFAULT_LANG, "c1", [
					"la",
					"lb",
					"Other",
				]),
				xpq.body_select1_itemset("q1"),
				`
				/h:html/h:body/x:input[@ref='/test_name/q1_other']/
				  x:label[text() = 'Specify other.']
				`,
			],
			warnings__contains: [OR_OTHER_WARNING],
		});
	});

	it("should add other choice with translations and group", () => {
		assertPyxformXform({
			md: `
				| survey  |                        |       |            |            |
				|         | type                   | name  | label      | label::eng |
				|         | begin group            | g1    | Group 1    | Group 1    |
				|         | select_one c1 or_other | q1    | Question 1 | Question A |
				|         | end group              | g1    |            |            |
				| choices |           |      |       |            |           |
				|         | list name | name | label | label::eng | label::fr |
				|         | c1        | na   | la    |            |           |
				|         | c1        | nb   | lb    | lb-e       | lb-f      |
			`,
			xml__xpath_match: [
				xpc.model_itext_choice_text_label_by_pos("eng", "c1", [
					"-",
					"lb-e",
					"Other",
				]),
				xpc.model_itext_choice_text_label_by_pos("fr", "c1", [
					"-",
					"lb-f",
					"Other",
				]),
				xpc.model_itext_choice_text_label_by_pos(DEFAULT_LANG, "c1", [
					"la",
					"lb",
					"Other",
				]),
				xpq.body_group_select1_itemset("g1", "q1"),
				`
				/h:html/h:body/x:group[@ref='/test_name/g1']
				  /x:input[@ref='/test_name/g1/q1_other']
				  /x:label[text() = 'Specify other.']
				`,
			],
			warnings__contains: [OR_OTHER_WARNING],
		});
	});

	it("should add other choice with translations and repeat", () => {
		assertPyxformXform({
			md: `
				| survey  |                        |       |            |            |
				|         | type                   | name  | label      | label::eng |
				|         | begin repeat           | r1    | Repeat 1   | Repeat 1   |
				|         | select_one c1 or_other | q1    | Question 1 | Question A |
				|         | end repeat             | r1    |            |            |
				| choices |           |      |       |            |           |
				|         | list name | name | label | label::eng | label::fr |
				|         | c1        | na   | la    | la-e       | la-f      |
				|         | c1        | nb   | lb    | lb-e       |           |
			`,
			xml__xpath_match: [
				xpc.model_itext_choice_text_label_by_pos("eng", "c1", [
					"la-e",
					"lb-e",
					"Other",
				]),
				xpc.model_itext_choice_text_label_by_pos("fr", "c1", [
					"la-f",
					"-",
					"Other",
				]),
				xpc.model_itext_choice_text_label_by_pos(DEFAULT_LANG, "c1", [
					"la",
					"lb",
					"Other",
				]),
				xpq.body_repeat_select1_itemset("r1", "q1"),
				`
				/h:html/h:body/x:group[@ref='/test_name/r1']
				  /x:repeat[@nodeset='/test_name/r1']
				  /x:input[@ref='/test_name/r1/q1_other']
				  /x:label[text() = 'Specify other.']
				`,
			],
			warnings__contains: [OR_OTHER_WARNING],
		});
	});

	it("should add other choice with translations and nested group", () => {
		assertPyxformXform({
			md: `
				| survey  |                        |       |            |            |
				|         | type                   | name  | label      | label::eng |
				|         | begin group            | g1    | Group 1    | Group 1    |
				|         | begin group            | g2    | Group 2    | Group 2    |
				|         | select_one c1 or_other | q1    | Question 1 | Question A |
				|         | end group              | g2    |            |            |
				|         | end group              | g1    |            |            |
				| choices |           |      |       |            |           |
				|         | list name | name | label | label::eng | label::fr |
				|         | c1        | na   | la    | la-e       | la-f      |
				|         | c1        | nb   | lb    | lb-e       |           |
			`,
			xml__xpath_match: [
				xpc.model_itext_choice_text_label_by_pos("eng", "c1", [
					"la-e",
					"lb-e",
					"Other",
				]),
				xpc.model_itext_choice_text_label_by_pos("fr", "c1", [
					"la-f",
					"-",
					"Other",
				]),
				xpc.model_itext_choice_text_label_by_pos(DEFAULT_LANG, "c1", [
					"la",
					"lb",
					"Other",
				]),
				`
				/h:html/h:body/x:group[@ref='/test_name/g1']
				  /x:group[@ref='/test_name/g1/g2']/x:select1[
				    @ref = '/test_name/g1/g2/q1'
				    and ./x:itemset
				    and not(./x:item)
				  ]
				`,
				`
				/h:html/h:body/x:group[@ref='/test_name/g1']
				  /x:group[@ref='/test_name/g1/g2']
				  /x:input[@ref='/test_name/g1/g2/q1_other']
				  /x:label[text() = 'Specify other.']
				`,
			],
			warnings__contains: [OR_OTHER_WARNING],
		});
	});

	it("should add other choice with translations and nested repeat", () => {
		assertPyxformXform({
			md: `
				| survey  |                        |       |            |            |
				|         | type                   | name  | label      | label::eng |
				|         | begin group            | g1    | Group 1    | Group 1    |
				|         | begin repeat           | r1    | Repeat 1   | Repeat 1   |
				|         | select_one c1 or_other | q1    | Question 1 | Question A |
				|         | end repeat             | r1    |            |            |
				|         | end group              | g1    |            |            |
				| choices |           |      |       |            |           |
				|         | list name | name | label | label::eng | label::fr |
				|         | c1        | na   | la    | la-e       | la-f      |
				|         | c1        | nb   | lb    | lb-e       |           |
			`,
			xml__xpath_match: [
				xpc.model_itext_choice_text_label_by_pos("eng", "c1", [
					"la-e",
					"lb-e",
					"Other",
				]),
				xpc.model_itext_choice_text_label_by_pos("fr", "c1", [
					"la-f",
					"-",
					"Other",
				]),
				xpc.model_itext_choice_text_label_by_pos(DEFAULT_LANG, "c1", [
					"la",
					"lb",
					"Other",
				]),
				`
				/h:html/h:body/x:group[@ref='/test_name/g1']
				  /x:group[@ref='/test_name/g1/r1']
				  /x:repeat[@nodeset='/test_name/g1/r1']
				  /x:select1[
				    @ref = '/test_name/g1/r1/q1'
				    and ./x:itemset
				    and not(./x:item)
				  ]
				`,
				`
				/h:html/h:body/x:group[@ref='/test_name/g1']
				  /x:group[@ref='/test_name/g1/r1']
				  /x:repeat[@nodeset='/test_name/g1/r1']
				  /x:input[@ref='/test_name/g1/r1/q1_other']
				  /x:label[text() = 'Specify other.']
				`,
			],
			warnings__contains: [OR_OTHER_WARNING],
		});
	});

	it("should add other choice without translations and not use itext", () => {
		assertPyxformXform({
			md: `
				| survey  |                        |       |            |
				|         | type                   | name  | label      |
				|         | select_one c1 or_other | q1    | Question 1 |
				| choices |           |      |       |
				|         | list name | name | label |
				|         | c1        | na   | la    |
				|         | c1        | nb   | lb    |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model[not(descendant::x:itext)]
				`,
				xpc.model_instance_choices_label("c1", [
					["na", "la"],
					["nb", "lb"],
					["other", "Other"],
				]),
				xpq.body_select1_itemset("q1"),
				`
				/h:html/h:body/x:input[@ref='/test_name/q1_other']/
				  x:label[text() = 'Specify other.']
				`,
			],
			warnings__not_contains: [OR_OTHER_WARNING],
		});
	});

	it("should error with choice filter and or_other", () => {
		assertPyxformXform({
			md: `
				| survey  |                        |       |            |
				|         | type                   | name  | label      | choice_filter |
				|         | text                   | q0    | Question 0 |               |
				|         | select_one c1 or_other | q1    | Question 1 | \${q0} = cf    |
				| choices |           |      |       |
				|         | list name | name | label | cf |
				|         | c1        | na   | la    | 1  |
				|         | c1        | nb   | lb    | 2  |
			`,
			errored: true,
			error__contains: ["[row : 3] Choice filter not supported with or_other."],
		});
	});
});

// ============================================================================
// TranslationsExtendedTests - Additional coverage for multi-language forms
// ============================================================================

describe("TranslationsExtendedTests", () => {
	it("should generate itext for multi-language labels", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label              | label::French (fr)  |
				|        | text | q1   | What is your name? | Quel est votre nom? |
			`,
			xml__contains: [
				'<translation default="true()" lang="default">',
				'<translation lang="French (fr)">',
			],
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:itext/x:translation[@lang='default']/x:text[@id='/test_name/q1:label']/x:value[text()='What is your name?']",
				"/h:html/h:head/x:model/x:itext/x:translation[@lang='French (fr)']/x:text[@id='/test_name/q1:label']/x:value[text()='Quel est votre nom?']",
			],
		});
	});

	it("should generate itext for multi-language hints", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label | hint         | hint::French (fr) |
				|        | text | q1   | Name  | Enter name   | Entrez le nom     |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:itext/x:translation[@lang='default']/x:text[@id='/test_name/q1:hint']/x:value[text()='Enter name']",
				"/h:html/h:head/x:model/x:itext/x:translation[@lang='French (fr)']/x:text[@id='/test_name/q1:hint']/x:value[text()='Entrez le nom']",
			],
		});
	});

	it("should generate itext for choice translations", () => {
		assertPyxformXform({
			md: `
				| survey  |
				|         | type              | name | label   | label::French (fr) |
				|         | select_one yes_no | q1   | Agree?  | D'accord?          |
				| choices |
				|         | list_name | name | label | label::French (fr) |
				|         | yes_no    | yes  | Yes   | Oui                |
				|         | yes_no    | no   | No    | Non                |
			`,
			xml__contains: [
				'<translation default="true()" lang="default">',
				'<translation lang="French (fr)">',
			],
		});
	});

	it("should handle three languages", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label   | label::French (fr) | label::Spanish (es) |
				|        | text | q1   | Name    | Nom                | Nombre              |
			`,
			xml__contains: [
				'<translation default="true()" lang="default">',
				'<translation lang="French (fr)">',
				'<translation lang="Spanish (es)">',
			],
		});
	});
});
