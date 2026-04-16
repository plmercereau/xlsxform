/**
 * Port of pyxform/tests/test_j2x_question.py
 * Testing creation of Surveys using verbose methods.
 *
 * Tests that use internal Python APIs (Survey object, xml_control, xml_bindings,
 * config files) are marked with TODO. Tests using assertPyxformXform are ported directly.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

// XPath helper functions
function xpq_model_instance_item(q_name: string): string {
	return `/h:html/h:head/x:model/x:instance/x:test_name/x:${q_name}`;
}
function xpq_model_instance_bind(q_name: string, _type: string): string {
	return `/h:html/h:head/x:model/x:bind[@nodeset='/test_name/${q_name}' and @type='${_type}']`;
}
function xpq_body_label_inline(q_type: string, q_name: string, q_label: string): string {
	return `/h:html/h:body/x:${q_type}[@ref='/test_name/${q_name}']/x:label[not(@ref) and text()='${q_label}']`;
}
function xpq_body_label_itext(q_type: string, q_name: string): string {
	return `/h:html/h:body/x:${q_type}[@ref='/test_name/${q_name}']/x:label[@ref="jr:itext('/test_name/${q_name}:label')" and not(text())]`;
}
function xpq_model_instance_exists(i_id: string): string {
	return `/h:html/h:head/x:model[./x:instance[@id='${i_id}']]`;
}
function xpq_model_itext_label(q_name: string, lang: string, q_label: string): string {
	return `/h:html/h:head/x:model/x:itext/x:translation[@lang='${lang}']/x:text[@id='/test_name/${q_name}:label']/x:value[not(@form) and text()='${q_label}']`;
}

function xpc_model_instance_choices_itext(cname: string, choices: string[]): string {
	const choices_xp = choices.map((cv, idx) =>
		`./x:item[./x:name/text() = '${cv}' and not(./x:label) and ./x:itextId = '${cname}-${idx}']`
	).join("\n              and ");
	return `/h:html/h:head/x:model/x:instance[@id='${cname}']/x:root[${choices_xp}]`;
}
function xpc_model_itext_choice_text_label_by_pos(lang: string, cname: string, choices: string[]): string {
	const choices_xp = choices.map((cl, idx) =>
		`./x:text[@id='${cname}-${idx}' and ./x:value[not(@form) and text()='${cl}']]`
	).join("\n              and ");
	return `/h:html/h:head/x:model/x:itext/x:translation[@lang='${lang}' and ${choices_xp}]`;
}

describe("Json2XformQuestionValidationTests", () => {
	it("test_question_type_string", () => {
		// TODO: requires internal API (Survey, create_survey_element_from_dict, xml_control, xml_bindings, config)
		// Original test creates a Survey, adds a text question, and compares xml_control/xml_bindings
		// against expected XML from a config file.
	});

	it("test_select_one_question_multilingual", () => {
		assertPyxformXform({
			ss_structure: {
				survey: [
					{ type: "select_one c1", name: "q1", "label::f": "ftext", "label::e": "etext" },
				],
				choices: [
					{ list_name: "c1", name: "a", "label::f": "fa", "label::e": "ea" },
					{ list_name: "c1", name: "b", "label::f": "fb", "label::e": "eb" },
				],
			},
			xml__xpath_match: [
				xpq_model_instance_item("q1"),
				xpq_model_instance_bind("q1", "string"),
				xpq_body_label_itext("select1", "q1"),
				xpq_model_instance_exists("c1"),
				xpq_model_itext_label("q1", "f", "ftext"),
				xpq_model_itext_label("q1", "e", "etext"),
				xpc_model_instance_choices_itext("c1", ["a", "b"]),
				xpc_model_itext_choice_text_label_by_pos("f", "c1", ["fa", "fb"]),
				xpc_model_itext_choice_text_label_by_pos("e", "c1", ["ea", "eb"]),
			],
		});
	});

	it("test_select_one_question_multilingual__common_choices", () => {
		assertPyxformXform({
			ss_structure: {
				survey: [
					{ type: "select_one c1", name: "q1", label: "Q1" },
					{ type: "select_one c1", name: "q2", label: "Q2" },
				],
				choices: [
					{ list_name: "c1", name: "a", "label::f": "fa", "label::e": "ea" },
					{ list_name: "c1", name: "b", "label::f": "fb", "label::e": "eb" },
				],
			},
			xml__xpath_match: [
				xpq_model_instance_item("q1"),
				xpq_model_instance_bind("q1", "string"),
				xpq_body_label_inline("select1", "q1", "Q1"),
				xpq_model_instance_item("q2"),
				xpq_model_instance_bind("q2", "string"),
				xpq_body_label_inline("select1", "q2", "Q2"),
				xpq_model_instance_exists("c1"),
				xpc_model_instance_choices_itext("c1", ["a", "b"]),
				xpc_model_itext_choice_text_label_by_pos("f", "c1", ["fa", "fb"]),
				xpc_model_itext_choice_text_label_by_pos("e", "c1", ["ea", "eb"]),
			],
		});
	});

	it("test_simple_integer_question_type_multilingual", () => {
		// TODO: requires internal API (Survey, create_survey_element_from_dict, xml_control, xml_bindings, config)
		// Original test creates a Survey, adds an integer question with multilingual labels,
		// and compares xml_control/xml_bindings against expected XML from a config file.
	});

	it("test_simple_date_question_type_multilingual", () => {
		// TODO: requires internal API (Survey, create_survey_element_from_dict, xml_control, xml_bindings, config)
		// Original test creates a Survey, adds a date question with multilingual labels,
		// and compares xml_control/xml_bindings against expected XML from a config file.
	});

	it("test_simple_phone_number_question_type_multilingual", () => {
		// TODO: requires internal API (Survey, create_survey_element_from_dict, xml_control, xml_bindings, config)
		// Original test creates a Survey, adds a phone number question with multilingual labels,
		// inspects XML control node attributes and binding attributes directly.
	});

	it("test_simple_select_all_question_multilingual", () => {
		assertPyxformXform({
			ss_structure: {
				survey: [
					{ type: "select_multiple c1", name: "q1", "label::f": "ftext", "label::e": "etext" },
				],
				choices: [
					{ list_name: "c1", name: "a", "label::f": "fa", "label::e": "ea" },
					{ list_name: "c1", name: "b", "label::f": "fb", "label::e": "eb" },
				],
			},
			xml__xpath_match: [
				xpq_model_instance_item("q1"),
				xpq_model_instance_bind("q1", "string"),
				xpq_body_label_itext("select", "q1"),
				xpq_model_instance_exists("c1"),
				xpq_model_itext_label("q1", "f", "ftext"),
				xpq_model_itext_label("q1", "e", "etext"),
				xpc_model_instance_choices_itext("c1", ["a", "b"]),
				xpc_model_itext_choice_text_label_by_pos("f", "c1", ["fa", "fb"]),
				xpc_model_itext_choice_text_label_by_pos("e", "c1", ["ea", "eb"]),
			],
		});
	});

	it("test_simple_decimal_question_multilingual", () => {
		// TODO: requires internal API (Survey, create_survey_element_from_dict, xml_control, xml_bindings, config)
		// Original test creates a Survey, adds a decimal question with multilingual labels,
		// and compares xml_control/xml_bindings against expected XML from a config file.
	});
});
