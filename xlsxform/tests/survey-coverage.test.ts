/**
 * Additional tests for survey.ts coverage.
 * Targets: toPrettyXml, xmlInstance_forSurvey, xmlBindings (lines 1704-1714).
 */

import { describe, expect, it } from "vitest";
import { convert } from "./helpers/xls2xform-node.js";

describe("Survey - toPrettyXml", () => {
	it("should produce pretty-printed XML output", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label |
				|        | text | q1   | Q1    |
			`,
			prettyPrint: false,
		});
		const survey = result._survey ?? expect.unreachable("_survey is null");
		const prettyXml = survey.toPrettyXml();
		// Pretty XML should contain newlines and indentation
		expect(prettyXml).toContain("\n");
		expect(prettyXml).toContain("  ");
		expect(prettyXml).toContain("<h:html");
	});
});

describe("Survey - xmlInstance_forSurvey and xmlBindings", () => {
	it("should return main instance from xmlInstance_forSurvey", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label |
				|        | text | q1   | Q1    |
			`,
			prettyPrint: false,
		});
		const survey = result._survey ?? expect.unreachable("_survey is null");
		const instance = survey.xmlInstance_forSurvey(survey);
		expect(instance).toBeDefined();
		expect(instance).toBeDefined();
	});

	it("should yield no bindings from xmlBindings", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label |
				|        | text | q1   | Q1    |
			`,
			prettyPrint: false,
		});
		const survey = result._survey ?? expect.unreachable("_survey is null");
		const bindings = [...survey.xmlBindings(survey)];
		expect(bindings.length).toBe(0);
	});
});
