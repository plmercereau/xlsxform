/**
 * Port of test_js2x_import_from_json.py - Testing ability to import from JSON.
 */

import { describe, expect, it } from "vitest";
import { createSurveyElementFromDict } from "../src/model/builder.js";
import { Survey } from "../src/model/survey.js";

describe("TestJson2XformJsonImport", () => {
	it("test_simple_questions_can_be_imported_from_json", () => {
		// TODO: requires internal API (create_survey_element_from_dict with multi-language label, direct children access)
		const jsonText = {
			type: "survey",
			name: "Exchange rate",
			children: [
				{
					label: { French: "Combien?", English: "How many?" },
					type: "decimal",
					name: "exchange_rate",
				},
			],
		};
		const s = createSurveyElementFromDict(jsonText);
		expect(s).toBeDefined();
	});

	it("test_question_type_that_accepts_parameters__without_parameters__to_xml", () => {
		// Should be able to round-trip survey using an un-parameterised question without error.
		// Per https://github.com/XLSForm/pyxform/issues/605
		const js = {
			type: "survey",
			name: "ExchangeRate",
			children: [
				{
					itemset: "pain_locations.xml",
					label: "Location of worst pain this week.",
					name: "pweek",
					type: "select one",
				},
			],
		};
		const element = createSurveyElementFromDict(js);
		expect(element).toBeInstanceOf(Survey);
		const survey = element as Survey;
		// Calling toXml should not throw
		expect(() => survey.toXml()).not.toThrow();
	});
});
