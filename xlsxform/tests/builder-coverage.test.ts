/**
 * Additional tests for builder.ts coverage.
 * Targets: createSurvey with idString/title overrides (lines 384-389).
 */

import { describe, expect, it } from "vitest";
import { PyXFormError } from "../src/errors.js";
import { createSurvey } from "../src/model/builder.js";
import { convert } from "./helpers/xls2xform-node.js";

describe("createSurvey - idString and title overrides", () => {
	it("should override idString when provided", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label |
				|        | text | q1   | Q1    |
			`,
			prettyPrint: false,
		});
		const survey = result._survey ?? expect.unreachable("_survey is null");
		// Now create a new survey with idString override
		const newSurvey = createSurvey({
			mainSection: survey.toJsonDict(),
			idString: "custom_id",
		});
		expect(newSurvey.id_string).toBe("custom_id");
	});

	it("should override title when provided", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label |
				|        | text | q1   | Q1    |
			`,
			prettyPrint: false,
		});
		const survey = result._survey ?? expect.unreachable("_survey is null");
		const newSurvey = createSurvey({
			mainSection: survey.toJsonDict(),
			title: "Custom Title",
		});
		expect(newSurvey.title).toBe("Custom Title");
	});

	it("should throw when no main section is provided", () => {
		expect(() => createSurvey({})).toThrow(PyXFormError);
		expect(() => createSurvey({ nameOfMainSection: "missing" })).toThrow(
			"No main section provided",
		);
	});

	it("should lookup mainSection by nameOfMainSection from sections", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label |
				|        | text | q1   | Q1    |
			`,
			prettyPrint: false,
		});
		const survey = result._survey ?? expect.unreachable("_survey is null");
		const dict = survey.toJsonDict();
		const newSurvey = createSurvey({
			nameOfMainSection: "survey",
			sections: { survey: dict },
		});
		expect(newSurvey).toBeDefined();
	});

	it("should override both idString and title", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label |
				|        | text | q1   | Q1    |
			`,
			prettyPrint: false,
		});
		const survey = result._survey ?? expect.unreachable("_survey is null");
		const newSurvey = createSurvey({
			mainSection: survey.toJsonDict(),
			idString: "new_id",
			title: "New Title",
		});
		expect(newSurvey.id_string).toBe("new_id");
		expect(newSurvey.title).toBe("New Title");
	});
});
