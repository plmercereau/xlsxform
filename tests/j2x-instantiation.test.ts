/**
 * Port of test_j2x_instantiation.py - Testing the instance object for pyxform.
 */

import { describe, it } from "vitest";

describe("Json2XformExportingPrepTests", () => {
	// TODO: requires internal API - test_simple_survey_instantiation
	// Tests Survey, create_survey_element_from_dict, survey.instantiate(),
	// instance.keys(), instance.xpaths(). These are all internal Python APIs
	// (Survey instantiation, SurveyInstance).
	it.todo("test_simple_survey_instantiation - requires internal API (Survey, instantiate, SurveyInstance)");

	// TODO: requires internal API - test_simple_survey_answering
	// Tests Survey, SurveyInstance, instance.answer(), instance.answers().
	// These are Python-specific survey instance APIs.
	it.todo("test_simple_survey_answering - requires internal API (Survey, SurveyInstance, answer/answers)");

	// TODO: requires internal API - test_answers_can_be_imported_from_xml
	// Tests Survey, instantiate(), instance.import_from_xml().
	// Uses prep_class_config and config file reading. All Python-specific.
	it.todo("test_answers_can_be_imported_from_xml - requires internal API (Survey, instantiate, import_from_xml)");

	// TODO: requires internal API - test_simple_registration_xml
	// Tests Survey, instantiate(), instance.answer(), instance.to_xml().
	// Uses prep_class_config and config file reading. All Python-specific.
	it.todo("test_simple_registration_xml - requires internal API (Survey, instantiate, to_xml)");
});
