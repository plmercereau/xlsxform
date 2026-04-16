/**
 * Port of test_xls2json_backends.py - Test xls2json_backends module functionality.
 */

import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { createSurveyElementFromDict } from "../src/builder.js";
import { xlsValueToUnicode, xlsxValueToStr } from "../src/xls2json-backends.js";
import { workbookToJson } from "../src/xls2json.js";
import { assertPyxformXform } from "./helpers/test-case.js";
import {
	csvToDict,
	getXlsformFromFile,
	mdToDictFromFile,
	xlsToDict,
	xlsxToDict,
} from "./helpers/xls2json-backends-node.js";

const EXAMPLE_XLS_PATH = path.join(
	__dirname,
	"..",
	"..",
	"pyxform",
	"tests",
	"example_xls",
);
const BUG_EXAMPLE_XLS_PATH = path.join(
	__dirname,
	"..",
	"..",
	"pyxform",
	"tests",
	"bug_example_xls",
);

function pathToTextFixture(filename: string): string {
	return path.join(EXAMPLE_XLS_PATH, filename);
}

describe("TestXLS2JSONBackends", () => {
	it("test_xls_value_to_unicode", () => {
		// Test that integer float values are displayed as integers
		const XL_CELL_NUMBER = 2;
		let csvData = xlsValueToUnicode(32.0, XL_CELL_NUMBER, 1);
		expect(csvData).toBe("32");

		// Test that the decimal value is not changed during conversion
		csvData = xlsValueToUnicode(46.9, XL_CELL_NUMBER, 1);
		expect(csvData).toBe("46.9");
	});

	it("test_xlsx_value_to_str", () => {
		let csvData = xlsxValueToStr(32.0);
		expect(csvData).toBe("32");

		// Test that the decimal value is not changed during conversion
		csvData = xlsxValueToStr(46.9);
		expect(csvData).toBe("46.9");
	});

	it("test_defusedxml_enabled", () => {
		// This test is Python-specific (openpyxl.DEFUSEDXML).
		// In the TS port, we use SheetJS which doesn't have this concept.
		// We just verify that the xlsx library is available and working.
		const xlsxLib = require("xlsx");
		expect(xlsxLib.readFile).toBeDefined();
	});

	it("test_case_insensitivity", () => {
		// Test that all input types are case-insensitive for sheet names and headers
		const fileTypes = [".xlsx", ".xls", ".csv", ".md"];

		for (const fileType of fileTypes) {
			const data = getXlsformFromFile(
				pathToTextFixture(`case_insensitivity${fileType}`),
			);

			// All sheets should be recognised - check that important fields are not empty
			expect(data.survey).toBeDefined();
			expect(data.choices).toBeDefined();
			expect(data.settings).toBeDefined();
			expect(data.external_choices).toBeDefined();
			expect(data.entities).toBeDefined();
			expect(data.osm).toBeDefined();
			expect(data.sheet_names).toBeDefined();
			expect(data.survey_header).toBeDefined();
			expect(data.choices_header).toBeDefined();
			expect(data.settings_header).toBeDefined();
			expect(data.external_choices_header).toBeDefined();
			expect(data.entities_header).toBeDefined();
			expect(data.osm_header).toBeDefined();

			// Expected original sheet_names - needed for spellchecks
			expect(data.sheet_names).toEqual([
				"SURVEY",
				"CHOICES",
				"SETTINGS",
				"EXTERNAL_CHOICES",
				"ENTITIES",
				"OSM",
			]);

			// Headers stripped, but not split or lower-cased yet
			expect(Object.keys(data.survey_header?.[0] ?? {})).toEqual([
				"TYPE",
				"NAME",
				"LABEL::EN",
				"CHOICE_FILTER",
			]);
			expect(Object.keys(data.choices_header?.[0] ?? {})).toEqual([
				"LIST_NAME",
				"NAME",
				"LABEL::EN",
			]);
			expect(Object.keys(data.settings_header?.[0] ?? {})).toEqual([
				"FORM_TITLE",
				"FORM_ID",
				"DEFAULT_LANGUAGE",
			]);
			expect(Object.keys(data.external_choices_header?.[0] ?? {})).toEqual([
				"LIST_NAME",
				"NAME",
				"LABEL",
				"YES_NO",
			]);
			expect(Object.keys(data.entities_header?.[0] ?? {})).toEqual([
				"DATASET",
				"LABEL",
			]);
			expect(Object.keys(data.osm_header?.[0] ?? {})).toEqual([
				"LIST_NAME",
				"NAME",
				"LABEL",
			]);

			// Survey data has expected rows (case-preserved in values)
			expect(data.survey?.length).toBeGreaterThan(0);
			expect(data.choices?.length).toBeGreaterThan(0);
			expect(data.settings?.length).toBeGreaterThan(0);
		}
	});

	it("test_case_insensitivity_conversion", () => {
		// Full conversion test: uppercase headers like NAME, LABEL must be
		// normalized so that select_one choices have proper <name> values
		// and OSM tags have proper key attributes.
		const fileTypes = [".xlsx", ".xls"];
		for (const fileType of fileTypes) {
			const workbookDict = getXlsformFromFile(
				pathToTextFixture(`case_insensitivity${fileType}`),
			);
			const warnings: string[] = [];
			const result = workbookToJson({
				workbookDict,
				fallbackFormName: "case_insensitivity",
				warnings,
			});
			const survey = createSurveyElementFromDict(result);
			const xml = survey.toXml();

			// Choice items must have <name> with actual values (not empty)
			expect(xml).toContain("<name>n1-c</name>");
			expect(xml).toContain("<name>n2-c</name>");
			// Must NOT have uppercase <NAME> elements (indicates failed normalization)
			expect(xml).not.toContain("<NAME>");

			// OSM tags must have key attributes from the name column
			expect(xml).toContain('key="n1-o"');
			expect(xml).toContain('key="n2-o"');
			// Must NOT have undefined keys
			expect(xml).not.toContain('key="undefined"');

			// select_one must use <select1> (not <select>)
			expect(xml).toContain("<select1");
		}
	});

	it("test_equivalency", () => {
		// Test that all file type readers produce the same data from equivalent files
		const equivalentFixtures = [
			"group",
			"include",
			"include_json",
			"loop",
			"specify_other",
			"text_and_integer",
			"yes_or_no_question",
		];

		for (const fixture of equivalentFixtures) {
			const xlsxInp = xlsxToDict(pathToTextFixture(`${fixture}.xlsx`));
			const xlsInp = xlsToDict(pathToTextFixture(`${fixture}.xls`));
			const csvInp = csvToDict(pathToTextFixture(`${fixture}.csv`));
			const mdInp = mdToDictFromFile(pathToTextFixture(`${fixture}.md`));

			expect(xlsxInp).toEqual(xlsInp);
			expect(xlsxInp).toEqual(csvInp);
			expect(xlsxInp).toEqual(mdInp);
		}
	});

	it("test_xls_with_many_empty_cells", () => {
		// Test xls_to_dict performance with large sheets
		const xlsPath = path.join(BUG_EXAMPLE_XLS_PATH, "extra_columns.xls");
		const before = Date.now();
		const xlsData = xlsToDict(xlsPath);
		const after = Date.now();
		expect((after - before) / 1000).toBeLessThan(5);

		const surveyHeaders = ["type", "name", "label"];
		expect(Object.keys(xlsData.survey_header[0])).toEqual(surveyHeaders);
		expect(xlsData.survey.length).toBe(3);
		expect(xlsData.survey[2].name).toBe("b");
	});

	it("test_xlsx_with_many_empty_cells", () => {
		// Test xlsx_to_dict performance with large sheets
		const xlsxPath = path.join(
			BUG_EXAMPLE_XLS_PATH,
			"UCL_Biomass_Plot_Form.xlsx",
		);
		const before = Date.now();
		const xlsxData = xlsxToDict(xlsxPath);
		const after = Date.now();
		expect((after - before) / 1000).toBeLessThan(5);

		const surveyHeaders = [
			"type",
			"name",
			"label::Swahili (sw)",
			"label::English (en)",
			"hint::Swahili (sw)",
			"hint::English (en)",
			"required",
			"relevant",
			"constraint",
			"constraint_message::Swahili (sw)",
			"constraint_message::English (en)",
			"choice_filter",
			"appearance",
			"calculation",
			"repeat_count",
			"parameters",
		];
		expect(Object.keys(xlsxData.survey_header[0])).toEqual(surveyHeaders);
		expect(xlsxData.survey.length).toBe(90);
		expect(xlsxData.survey[89].type).toBe("deviceid");

		const choicesHeaders = [
			"list_name",
			"name",
			"label::Swahili (sw)",
			"label::English (en)",
		];
		expect(Object.keys(xlsxData.choices_header[0])).toEqual(choicesHeaders);
		expect(xlsxData.choices.length).toBe(27);
		expect(xlsxData.choices[26]["label::Swahili (sw)"]).toBe("Mwingine");

		const settingsHeaders = ["default_language", "version"];
		expect(Object.keys(xlsxData.settings_header[0])).toEqual(settingsHeaders);
		expect(xlsxData.settings.length).toBe(1);
		expect(xlsxData.settings[0].default_language).toBe("Swahili (sw)");
	});
});
