/**
 * Port of test_xls2json_xls.py - Testing simple cases for Xls2Json.
 */

import { describe, it } from "vitest";

describe("BasicXls2JsonApiTests", () => {
	// TODO: requires internal API - test_simple_yes_or_no_question
	// Tests convert() then compares result._pyxform to expected JSON file.
	// Requires file-based XLS input and _pyxform internal property.
	it.todo("test_simple_yes_or_no_question - requires internal API (convert with file path, _pyxform)");

	// TODO: requires internal API - test_hidden
	// Tests SurveyReader.to_json_dict() for hidden fields. SurveyReader is an internal API.
	it.todo("test_hidden - requires internal API (SurveyReader)");

	// TODO: requires internal API - test_gps
	// Tests SurveyReader.to_json_dict() for gps fields. SurveyReader is an internal API.
	it.todo("test_gps - requires internal API (SurveyReader)");

	// TODO: requires internal API - test_text_and_integer
	// Tests SurveyReader.to_json_dict() for text and integer fields. SurveyReader is an internal API.
	it.todo("test_text_and_integer - requires internal API (SurveyReader)");

	// TODO: requires internal API - test_choice_filter_choice_fields
	// Tests SurveyReader.to_json_dict() for choice filter fields. SurveyReader is an internal API.
	it.todo("test_choice_filter_choice_fields - requires internal API (SurveyReader)");
});

describe("UnicodeCsvTest", () => {
	// TODO: requires internal API - test_a_unicode_csv_works
	// Tests csv_to_dict with unicode CSV. csv_to_dict is a Python-specific backend function.
	it.todo("test_a_unicode_csv_works - requires internal API (csv_to_dict)");
});

describe("DefaultToSurveyTest", () => {
	// TODO: requires internal API - test_default_sheet_name_to_survey
	// Tests xlsx_to_dict with a sheet named differently. xlsx_to_dict is a Python-specific backend function.
	it.todo("test_default_sheet_name_to_survey - requires internal API (xlsx_to_dict)");
});
