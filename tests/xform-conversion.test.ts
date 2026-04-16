/**
 * Port of xform_test_case/test_xform_conversion.py - Test XForm conversion vs expected output.
 */

import { describe, it } from "vitest";

describe("TestXFormConversion", () => {
	it.todo("test_conversion_vs_expected - TODO: requires internal API (XFormTestCase.assertXFormEqual, example XLS fixtures, expected XML outputs)", () => {
		// The Python test converts multiple XLS/XLSX files and compares
		// the output against expected XML files using xml_compare.
		// This requires:
		//   - XFormTestCase.assertXFormEqual (XML comparison with model sorting)
		//   - Example XLS fixtures (attribute_columns_test.xlsx, flat_xlsform_test.xlsx, etc.)
		//   - Expected output XML files
		//   - File-based convert() API
		//
		// Cases tested in Python:
		//   attribute_columns_test.xlsx, flat_xlsform_test.xlsx, or_other.xlsx,
		//   pull_data.xlsx, repeat_date_test.xls, survey_no_name.xlsx,
		//   widgets.xls, xlsform_spec_test.xlsx, xml_escaping.xls,
		//   default_time_demo.xls
	});
});
