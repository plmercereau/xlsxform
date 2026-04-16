/**
 * Additional xls2json-backends tests for coverage of edge cases.
 */

import { describe, expect, it } from "vitest";
import {
	csvToDict,
	dictToDefinitionData,
	getXlsform,
	mdToDict,
	xlsValueToUnicode,
	xlsxValueToStr,
} from "../src/xls2json-backends.js";
import { PyXFormError } from "../src/errors.js";

describe("xlsxValueToStr - edge cases", () => {
	it("should handle boolean true", () => {
		expect(xlsxValueToStr(true)).toBe("TRUE");
	});

	it("should handle boolean false", () => {
		expect(xlsxValueToStr(false)).toBe("FALSE");
	});

	it("should handle Date objects", () => {
		const d = new Date(Date.UTC(2026, 3, 16, 10, 30, 45));
		expect(xlsxValueToStr(d)).toBe("2026-04-16 10:30:45");
	});

	it("should replace non-breaking spaces", () => {
		expect(xlsxValueToStr("hello\u00a0world")).toBe("hello world");
	});

	it("should handle strings without nbsp", () => {
		expect(xlsxValueToStr("normal text")).toBe("normal text");
	});
});

describe("xlsValueToUnicode - edge cases", () => {
	const XL_CELL_BOOLEAN = 4;
	const XL_CELL_DATE = 3;
	const XL_CELL_TEXT = 1;

	it("should handle boolean true", () => {
		expect(xlsValueToUnicode(1, XL_CELL_BOOLEAN, 0)).toBe("TRUE");
	});

	it("should handle boolean false", () => {
		expect(xlsValueToUnicode(0, XL_CELL_BOOLEAN, 0)).toBe("FALSE");
	});

	it("should handle date type", () => {
		const result = xlsValueToUnicode(44000, XL_CELL_DATE, 0);
		expect(result).toBe("44000");
	});

	it("should replace nbsp in default text type", () => {
		expect(xlsValueToUnicode("hello\u00a0world", XL_CELL_TEXT, 0)).toBe(
			"hello world",
		);
	});
});

describe("csvToDict - edge cases", () => {
	it("should handle quoted fields with escaped quotes", () => {
		const csv = [
			'survey,type,name,label',
			',text,q1,"A ""quoted"" label"',
		].join("\n");
		const result = csvToDict(csv);
		expect(result.survey[0].label).toBe('A "quoted" label');
	});

	it("should handle empty CSV", () => {
		const result = csvToDict("");
		expect(result.survey).toEqual([]);
		expect(result.choices).toEqual([]);
	});

	it("should handle CSV with only whitespace lines", () => {
		const result = csvToDict("  \n  \n");
		expect(result.survey).toEqual([]);
	});
});

describe("mdToDict - edge cases", () => {
	it("should handle escaped pipes in cells", () => {
		const md = `
			| survey |      |      |                |
			|        | type | name | label          |
			|        | text | q1   | A \\| B choice |
		`;
		const result = mdToDict(md);
		expect(result.survey[0].label).toBe("A | B choice");
	});

	it("should handle unknown sheet names", () => {
		const md = `
			| my_custom_sheet |      |      |       |
			|                 | type | name | label |
			|                 | text | q1   | Q1    |
		`;
		const result = mdToDict(md);
		expect(result.survey).toEqual([]);
	});

	it("should handle settings with empty values", () => {
		const md = `
			| settings |            |         |
			|          | form_title | form_id |
			|          | My Form    |         |
		`;
		const result = mdToDict(md);
		expect(result.settings.length).toBe(1);
		expect(result.settings[0].form_title).toBe("My Form");
		expect(result.settings[0].form_id).toBe("");
	});
});

describe("dictToDefinitionData", () => {
	it("should handle empty dict", () => {
		const result = dictToDefinitionData({});
		expect(result.survey).toEqual([]);
		expect(result.choices).toEqual([]);
		expect(result.settings).toEqual([]);
	});

	it("should pass through all sheet data", () => {
		const input = {
			survey: [{ type: "text", name: "q1", label: "Q1" }],
			choices: [{ list_name: "yn", name: "yes", label: "Yes" }],
			settings: [{ form_title: "Test" }],
			external_choices: [],
			entities: [],
			osm: [],
			sheet_names: ["survey", "choices", "settings"],
			fallback_form_name: "test_form",
		};
		const result = dictToDefinitionData(input);
		expect(result.survey).toEqual(input.survey);
		expect(result.choices).toEqual(input.choices);
		expect(result.sheet_names).toEqual(input.sheet_names);
		expect(result.fallback_form_name).toBe("test_form");
	});
});

describe("getXlsform - edge cases", () => {
	it("should handle dict input", () => {
		const result = getXlsform({
			survey: [{ type: "text", name: "q1", label: "Q1" }],
		});
		expect(result.survey.length).toBe(1);
	});

	it("should handle CSV string input", () => {
		const csv = "survey,type,name,label\n,text,q1,Q1";
		const result = getXlsform(csv, "csv");
		expect(result.survey.length).toBe(1);
	});

	it("should handle markdown string input", () => {
		const md = `
			| survey |      |      |       |
			|        | type | name | label |
			|        | text | q1   | Q1    |
		`;
		const result = getXlsform(md, "md");
		expect(result.survey.length).toBe(1);
	});

	it("should auto-detect markdown from pipe character", () => {
		const md = "| survey |\n|        | type | name | label |\n|        | text | q1   | Q1    |";
		const result = getXlsform(md);
		expect(result.survey.length).toBe(1);
	});

	it("should throw for non-markdown string without fileType", () => {
		expect(() => getXlsform("not markdown")).toThrow(PyXFormError);
	});

	it("should throw for unsupported input type", () => {
		expect(() => getXlsform(123 as unknown as string)).toThrow(PyXFormError);
	});
});
