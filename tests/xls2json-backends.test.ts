/**
 * Port of test_xls2json_backends.py - Test xls2json_backends module functionality.
 */

import { describe, it } from "vitest";

describe("TestXLS2JSONBackends", () => {
	// TODO: requires internal API - test_xls_value_to_unicode
	// Tests xls_value_to_unicode function which is a Python-specific xlrd backend function.
	it.todo("test_xls_value_to_unicode - requires internal API (xls_value_to_unicode, xlrd)");

	// TODO: requires internal API - test_xlsx_value_to_str
	// Tests xlsx_value_to_str function which is a Python-specific openpyxl backend function.
	it.todo("test_xlsx_value_to_str - requires internal API (xlsx_value_to_str)");

	// TODO: requires internal API - test_defusedxml_enabled
	// Tests openpyxl.DEFUSEDXML is enabled, Python-specific.
	it.todo("test_defusedxml_enabled - requires internal API (openpyxl.DEFUSEDXML)");

	// TODO: requires internal API - test_case_insensitivity
	// Tests that all input types (.xlsx, .xls, .csv, .md) are case-insensitive for
	// sheet names and headers. Uses get_xlsform, workbook_to_json, DefinitionData,
	// and xpath helpers that are Python-specific internal APIs.
	it.todo("test_case_insensitivity - requires internal API (get_xlsform, workbook_to_json, DefinitionData, xpath helpers)");

	// TODO: requires internal API - test_equivalency
	// Tests that xlsx_to_dict, xls_to_dict, csv_to_dict, md_to_dict all produce
	// the same data. These are Python-specific backend functions.
	it.todo("test_equivalency - requires internal API (xlsx_to_dict, xls_to_dict, csv_to_dict, md_to_dict)");

	// TODO: requires internal API - test_xls_with_many_empty_cells
	// Tests xls_to_dict performance with large sheets. Uses xlrd, Python-specific.
	it.todo("test_xls_with_many_empty_cells - requires internal API (xls_to_dict, xlrd)");

	// TODO: requires internal API - test_xlsx_with_many_empty_cells
	// Tests xlsx_to_dict performance with large sheets. Uses openpyxl, Python-specific.
	it.todo("test_xlsx_with_many_empty_cells - requires internal API (xlsx_to_dict, openpyxl)");
});
