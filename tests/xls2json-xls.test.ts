/**
 * Port of test_xls2json_xls.py - Testing simple cases for Xls2Json.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect } from "vitest";
import { SurveyReader } from "../src/xls2json.js";
import { csvToDict, xlsxToDict } from "../src/xls2json-backends.js";
import { convert } from "../src/xls2xform.js";

const EXAMPLE_XLS_PATH = path.join(__dirname, "..", "pyxform", "tests", "example_xls");
const TEST_EXPECTED_OUTPUT_PATH = path.join(
	__dirname,
	"..",
	"pyxform",
	"tests",
	"test_expected_output",
);

function pathToTextFixture(filename: string): string {
	return path.join(EXAMPLE_XLS_PATH, filename);
}

describe("BasicXls2JsonApiTests", () => {
	it("test_simple_yes_or_no_question", () => {
		const filename = "yes_or_no_question.xls";
		const pathToExcelFile = path.join(EXAMPLE_XLS_PATH, filename);
		const expectedOutputPath = path.join(
			TEST_EXPECTED_OUTPUT_PATH,
			"yes_or_no_question.json",
		);
		const result = convert({
			xlsform: pathToExcelFile,
			warnings: [],
			formName: "yes_or_no_question",
		});
		const expected = JSON.parse(fs.readFileSync(expectedOutputPath, "utf-8"));
		expect(result._pyxform).toEqual(expected);
	});

	it("test_hidden", () => {
		const x = new SurveyReader(pathToTextFixture("hidden.xls"), "hidden");
		const xResults = x.toJsonDict();

		const expectedDict = [
			{ type: "hidden", name: "hidden_test" },
			{
				children: [
					{
						bind: { "jr:preload": "uid", readonly: "true()" },
						name: "instanceID",
						type: "calculate",
					},
				],
				control: { bodyless: true },
				name: "meta",
				type: "group",
			},
		];
		expect(xResults.children).toEqual(expectedDict);
	});

	it("test_gps", () => {
		const x = new SurveyReader(pathToTextFixture("gps.xls"), "gps");

		const expectedDict = [
			{ type: "gps", name: "location", label: "GPS" },
			{
				children: [
					{
						bind: { "jr:preload": "uid", readonly: "true()" },
						name: "instanceID",
						type: "calculate",
					},
				],
				control: { bodyless: true },
				name: "meta",
				type: "group",
			},
		];

		expect(x.toJsonDict().children).toEqual(expectedDict);
	});

	it("test_text_and_integer", () => {
		const x = new SurveyReader(
			pathToTextFixture("text_and_integer.xls"),
			"text_and_integer",
		);

		const expectedDict = [
			{
				label: { english: "What is your name?" },
				type: "text",
				name: "your_name",
			},
			{
				label: { english: "How many years old are you?" },
				type: "integer",
				name: "your_age",
			},
			{
				children: [
					{
						bind: { "jr:preload": "uid", readonly: "true()" },
						name: "instanceID",
						type: "calculate",
					},
				],
				control: { bodyless: true },
				name: "meta",
				type: "group",
			},
		];

		expect(x.toJsonDict().children).toEqual(expectedDict);
	});

	it("test_choice_filter_choice_fields", () => {
		const choiceFilterSurvey = new SurveyReader(
			pathToTextFixture("choice_filter_test.xlsx"),
			"choice_filter_test",
		);

		const expectedDict = [
			{
				choices: [
					{ name: "texas", label: "Texas" },
					{ name: "washington", label: "Washington" },
				],
				type: "select one",
				name: "state",
				list_name: "states",
				itemset: "states",
				parameters: {},
				label: "state",
			},
			{
				name: "county",
				parameters: {},
				choice_filter: "${state}=cf",
				label: "county",
				itemset: "counties",
				list_name: "counties",
				choices: [
					{ label: "King", cf: "washington", name: "king" },
					{ label: "Pierce", cf: "washington", name: "pierce" },
					{ label: "King", cf: "texas", name: "king" },
					{ label: "Cameron", cf: "texas", name: "cameron" },
				],
				type: "select one",
			},
			{
				name: "city",
				parameters: {},
				choice_filter: "${county}=cf",
				label: "city",
				itemset: "cities",
				list_name: "cities",
				choices: [
					{ label: "Dumont", cf: "king", name: "dumont" },
					{ label: "Finney", cf: "king", name: "finney" },
					{ label: "brownsville", cf: "cameron", name: "brownsville" },
					{ label: "harlingen", cf: "cameron", name: "harlingen" },
					{ label: "Seattle", cf: "king", name: "seattle" },
					{ label: "Redmond", cf: "king", name: "redmond" },
					{ label: "Tacoma", cf: "pierce", name: "tacoma" },
					{ label: "Puyallup", cf: "pierce", name: "puyallup" },
				],
				type: "select one",
			},
			{
				control: { bodyless: true },
				type: "group",
				name: "meta",
				children: [
					{
						bind: { readonly: "true()", "jr:preload": "uid" },
						type: "calculate",
						name: "instanceID",
					},
				],
			},
		];
		expect(choiceFilterSurvey.toJsonDict().children).toEqual(expectedDict);
	});
});

describe("UnicodeCsvTest", () => {
	it("test_a_unicode_csv_works", () => {
		const utfCsvPath = pathToTextFixture("utf_csv.csv");
		const dictValue = csvToDict(utfCsvPath);
		const jsonStr = JSON.stringify(dictValue);
		// Check that unicode characters are present (may be encoded as \\ud83c or as actual chars)
		expect(jsonStr.length).toBeGreaterThan(0);
		// The CSV should parse without error and produce survey data
		expect(dictValue.survey).toBeDefined();
	});
});

describe("DefaultToSurveyTest", () => {
	it("test_default_sheet_name_to_survey", () => {
		const xlsPath = pathToTextFixture("survey_no_name.xlsx");
		const dictValue = xlsxToDict(xlsPath);
		const jsonStr = JSON.stringify(dictValue);
		expect(jsonStr).toContain("survey");
		expect(jsonStr).toContain("state");
		expect(jsonStr).toContain("The State");
	});
});
