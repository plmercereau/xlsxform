/**
 * Port of test_dump_and_load.py - Test multiple XLSForm can be generated successfully.
 */

import { describe, it } from "vitest";

describe("DumpAndLoadTests", () => {
	it.todo("test_load_from_dump - TODO: requires internal API (create_survey_from_path, json_dump, to_json_dict, test fixtures)", () => {
		// The Python test loads XLS files via create_survey_from_path, dumps to JSON,
		// reloads from JSON, and compares the resulting dict.
		// This requires:
		//   - create_survey_from_path (file-based survey loading)
		//   - survey.json_dump() / survey.to_json_dict()
		//   - Test fixture XLS files (gps.xls, specify_other.xls, group.xls, etc.)
	});
});
