/**
 * Port of test_xform2json.py - Test xform2json module.
 */

import { describe, it } from "vitest";

describe("DumpAndLoadXForm2JsonTests", () => {
	// TODO: requires internal API - test_load_from_dump
	// The original test loads XLS files, creates surveys, dumps to JSON,
	// converts to XML, then parses back and compares XML output.
	// This requires create_survey_from_path, json_dump, create_survey_element_from_xml,
	// and assertXFormEqual, which are internal Python APIs.
	it.todo("test_load_from_dump - requires internal API (create_survey_from_path, create_survey_element_from_xml, assertXFormEqual)");
});

describe("TestXMLParse", () => {
	// TODO: requires internal API - _try_parse is a Python-specific internal function
	it.todo("test_try_parse_with_string - requires internal API (_try_parse)");
	it.todo("test_try_parse_with_path - requires internal API (_try_parse)");
	it.todo("test_try_parse_with_bad_path - requires internal API (_try_parse)");
	it.todo("test_try_parse_with_bad_string - requires internal API (_try_parse)");
	it.todo("test_try_parse_with_bad_file - requires internal API (_try_parse)");
});

describe("TestXForm2JSON", () => {
	// TODO: requires internal API - test_convert_toJSON_multi_language
	// The original test converts an XLSForm to XML, then converts to JSON,
	// rebuilds a survey from that JSON, and compares the XML output.
	// This requires create_survey_element_from_dict, json.loads, and direct
	// survey.to_xml comparison which are internal Python APIs.
	it.todo("test_convert_toJSON_multi_language - requires internal API (create_survey_element_from_dict, to_json, to_xml comparison)");
});
