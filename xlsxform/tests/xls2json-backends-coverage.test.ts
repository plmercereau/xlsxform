/**
 * Additional xls2json-backends tests for coverage of edge cases.
 */

import { describe, expect, it } from "vitest";
import { PyXFormError } from "../src/errors.js";
import {
	csvToDict,
	getXlsform,
	isWorkBook,
	mdToDict,
	workbookToDict,
	xlsxValueToStr,
} from "../src/xls2json-backends.js";

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

describe("isWorkBook", () => {
	it("should detect a valid WorkBook", () => {
		expect(isWorkBook({ SheetNames: ["survey"], Sheets: { survey: {} } })).toBe(
			true,
		);
	});

	it("should reject plain objects", () => {
		expect(isWorkBook({ survey: [] })).toBe(false);
	});

	it("should reject non-objects", () => {
		expect(isWorkBook("hello")).toBe(false);
		expect(isWorkBook(null)).toBe(false);
	});
});

describe("workbookToDict", () => {
	it("should convert a mock WorkBook to DefinitionData", () => {
		const wb = {
			SheetNames: ["survey", "choices"],
			Sheets: {
				survey: {
					"!ref": "A1:C2",
					A1: { v: "type" },
					B1: { v: "name" },
					C1: { v: "label" },
					A2: { v: "text" },
					B2: { v: "q1" },
					C2: { v: "Question 1" },
				},
				choices: {
					"!ref": "A1:C3",
					A1: { v: "list_name" },
					B1: { v: "name" },
					C1: { v: "label" },
					A2: { v: "yn" },
					B2: { v: "yes" },
					C2: { v: "Yes" },
					A3: { v: "yn" },
					B3: { v: "no" },
					C3: { v: "No" },
				},
			},
		};
		const result = workbookToDict(wb);
		expect(result.survey).toEqual([
			{ type: "text", name: "q1", label: "Question 1" },
		]);
		expect(result.choices).toEqual([
			{ list_name: "yn", name: "yes", label: "Yes" },
			{ list_name: "yn", name: "no", label: "No" },
		]);
		expect(result.sheet_names).toEqual(["survey", "choices"]);
	});

	it("should set fallback_form_name", () => {
		const wb = {
			SheetNames: ["survey"],
			Sheets: {
				survey: {
					"!ref": "A1:A2",
					A1: { v: "type" },
					A2: { v: "text" },
				},
			},
		};
		const result = workbookToDict(wb, "my_form");
		expect(result.fallback_form_name).toBe("my_form");
	});

	it("should treat single unknown sheet as survey", () => {
		const wb = {
			SheetNames: ["Sheet1"],
			Sheets: {
				Sheet1: {
					"!ref": "A1:B2",
					A1: { v: "type" },
					B1: { v: "name" },
					A2: { v: "text" },
					B2: { v: "q1" },
				},
			},
		};
		const result = workbookToDict(wb);
		expect(result.survey).toEqual([{ type: "text", name: "q1" }]);
	});
});

describe("csvToDict - edge cases", () => {
	it("should handle quoted fields with escaped quotes", () => {
		const csv = [
			"survey,type,name,label",
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

describe("getXlsform - edge cases", () => {
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
		const md =
			"| survey |\n|        | type | name | label |\n|        | text | q1   | Q1    |";
		const result = getXlsform(md);
		expect(result.survey.length).toBe(1);
	});

	it("should throw for non-markdown string without fileType", () => {
		expect(() => getXlsform("not markdown")).toThrow(PyXFormError);
	});

	it("should throw for unsupported input type", () => {
		expect(() => getXlsform(123 as unknown as string)).toThrow(PyXFormError);
	});

	it("should handle WorkBook input", () => {
		const wb = {
			SheetNames: ["survey"],
			Sheets: {
				survey: {
					"!ref": "A1:C2",
					A1: { v: "type" },
					B1: { v: "name" },
					C1: { v: "label" },
					A2: { v: "note" },
					B2: { v: "n1" },
					C2: { v: "Hello" },
				},
			},
		};
		const result = getXlsform(wb);
		expect(result.survey).toEqual([
			{ type: "note", name: "n1", label: "Hello" },
		]);
	});
});
