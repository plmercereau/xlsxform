/**
 * Smoke test for index.ts re-exports.
 */

import { describe, expect, it } from "vitest";

describe("index.ts exports", () => {
	it("should export all public API items", async () => {
		const mod = await import("../src/index.js");
		expect(typeof mod.convert).toBe("function");
		expect(typeof mod.createSurveyElementFromDict).toBe("function");
		expect(typeof mod.createSurvey).toBe("function");
		expect(typeof mod.SurveyElementBuilder).toBe("function");
		expect(typeof mod.Survey).toBe("function");
		expect(typeof mod.SurveyElement).toBe("function");
		expect(typeof mod.Question).toBe("function");
		expect(typeof mod.InputQuestion).toBe("function");
		expect(typeof mod.MultipleChoiceQuestion).toBe("function");
		expect(typeof mod.Option).toBe("function");
		expect(typeof mod.Itemset).toBe("function");
		expect(typeof mod.Section).toBe("function");
		expect(typeof mod.GroupedSection).toBe("function");
		expect(typeof mod.RepeatingSection).toBe("function");
		expect(typeof mod.SurveyInstance).toBe("function");
		expect(typeof mod.PyXFormError).toBe("function");
		expect(typeof mod.ValidationError).toBe("function");
		expect(typeof mod.ODKValidateError).toBe("function");
		expect(mod.ErrorCode).toBeDefined();
		expect(typeof mod.workbookToJson).toBe("function");
		expect(typeof mod.mdToDict).toBe("function");
		expect(typeof mod.csvToDict).toBe("function");
		expect(typeof mod.getXlsform).toBe("function");
		expect(typeof mod.xlsxValueToStr).toBe("function");
		expect(typeof mod.workbookToDict).toBe("function");
		expect(typeof mod.isWorkBook).toBe("function");
		expect(mod.constants).toBeDefined();
		expect(typeof mod.createSurveyElementFromXml).toBe("function");
		expect(typeof mod.createSurveyElementFromJson).toBe("function");
		expect(typeof mod._tryParse).toBe("function");
		expect(typeof mod.IOError).toBe("function");
		expect(typeof mod.XMLParseError).toBe("function");
	});
});
