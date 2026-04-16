/**
 * Port of xform_test_case/test_bugs.py - Some tests for the new (v0.9) spec.
 */

import { describe, it } from "vitest";
// import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestXFormConversion", () => {
	// TODO: requires internal API - needs file-based XLS input
	// The original test converts XLS files and checks for specific PyXFormError messages.
	// convert() in TS uses md/ss_structure input, not file paths.
	it.todo("test_conversion_raises_group_name_test - requires internal API (convert with file path)");
	it.todo("test_conversion_raises_duplicate_columns - requires internal API (convert with file path)");
	it.todo("test_conversion_raises_calculate_without_calculation - requires internal API (convert with file path)");
});

describe("ValidateWrapper", () => {
	// TODO: requires internal API - test_conversion
	// Tests parse_file_to_json, create_survey_element_from_dict, print_xform_to_file.
	// These are all internal Python APIs.
	it.todo("test_conversion - requires internal API (parse_file_to_json, print_xform_to_file)");
});

describe("EmptyStringOnRelevantColumnTest", () => {
	// TODO: requires internal API - test_conversion
	// Tests get_xlsform with file path and checks workbook_dict internal structure.
	it.todo("test_conversion - requires internal API (get_xlsform with file path)");
});

describe("BadChoicesSheetHeaders", () => {
	// TODO: requires internal API - test_conversion
	// Tests parse_file_to_json and checks for specific warning ErrorCode values.
	it.todo("test_conversion - requires internal API (parse_file_to_json, ErrorCode)");

	// TODO: requires internal API - test_values_with_spaces_are_cleaned
	// Tests SurveyReader.to_json_dict() for spaces in choices header.
	it.todo("test_values_with_spaces_are_cleaned - requires internal API (SurveyReader)");
});

describe("TestChoiceNameAsType", () => {
	// TODO: requires internal API - test_choice_name_as_type
	// Tests SurveyReader and has_external_choices. These are internal Python APIs.
	it.todo("test_choice_name_as_type - requires internal API (SurveyReader, has_external_choices)");
});

describe("TestBlankSecondRow", () => {
	// TODO: requires internal API - test_blank_second_row
	// Tests SurveyReader with file path input.
	it.todo("test_blank_second_row - requires internal API (SurveyReader)");
});

describe("TestXLDateAmbiguous", () => {
	// TODO: requires internal API - test_xl_date_ambiguous
	// Tests SurveyReader with file path input for date handling.
	it.todo("test_xl_date_ambiguous - requires internal API (SurveyReader)");
});

describe("TestXLDateAmbiguousNoException", () => {
	// TODO: requires internal API - test_xl_date_ambiguous_no_exception
	// Tests xlsx_to_dict with file path for date values.
	it.todo("test_xl_date_ambiguous_no_exception - requires internal API (xlsx_to_dict)");
});

describe("TestSpreadSheetFilesWithMacrosAreAllowed", () => {
	// TODO: requires internal API - test_xlsm_files_are_allowed
	// Tests get_xlsform with .xlsm file. Python-specific backend.
	it.todo("test_xlsm_files_are_allowed - requires internal API (get_xlsform)");
});

describe("TestBadCalculation", () => {
	// TODO: requires internal API - test_bad_calculate_javarosa_error
	// Tests ODKValidateError and check_xform. These are Python/Java-specific validators.
	it.todo("test_bad_calculate_javarosa_error - requires internal API (ODKValidateError, check_xform)");
});
