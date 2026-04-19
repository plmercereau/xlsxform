/**
 * Port of test_json2xform.py - Basic JSON to XForm conversion tests.
 */

import { describe, expect, it } from "vitest";
import { createSurvey } from "../src/model/builder.js";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("Json2XformTest", () => {
	it("should create a simple survey", () => {
		const survey = createSurvey({
			nameOfMainSection: "simple_survey",
			sections: {
				simple_survey: {
					type: "survey",
					name: "simple_survey",
					id_string: "simple_survey",
					children: [
						{
							type: "text",
							name: "q1",
							label: "Question 1",
						},
					],
				},
			},
		});

		expect(survey).toBeDefined();
		expect(survey.name).toBe("simple_survey");
	});

	it("should convert a basic text question", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label |
				|        | text | q1   | Q1    |
			`,
			xml__contains: ["<input"],
		});
	});

	it("should call to_xml multiple times without error", () => {
		const survey = createSurvey({
			nameOfMainSection: "simple_survey",
			sections: {
				simple_survey: {
					type: "survey",
					name: "simple_survey",
					id_string: "simple_survey",
					children: [
						{
							type: "text",
							name: "q1",
							label: "Question 1",
						},
					],
				},
			},
		});

		const xml1 = survey.toXml();
		const xml2 = survey.toXml();
		expect(xml1).toBe(xml2);
	});
});
