/**
 * Port of test_builder.py - Builder class tests.
 */

import { describe, expect, it } from "vitest";
import { createSurvey, createSurveyElementFromDict, SurveyElementBuilder } from "../src/builder.js";
import { PyXFormError } from "../src/errors.js";

describe("BuilderTests", () => {
	it("should throw for unknown question type", () => {
		expect(() => {
			createSurveyElementFromDict({
				type: "survey",
				name: "test",
				children: [
					{
						type: "unknown_type",
						name: "q1",
						label: "Q1",
					},
				],
			});
		}).toThrow();
	});

	it("should create a survey with text question", () => {
		const survey = createSurvey({
			nameOfMainSection: "test",
			sections: {
				test: {
					type: "survey",
					name: "test",
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
		expect(survey.name).toBe("test");

		const xml = survey.toXml();
		expect(xml).toContain("<input");
		expect(xml).toContain('ref="/test/q1"');
	});

	it("should create a survey with multiple question types", () => {
		const survey = createSurvey({
			nameOfMainSection: "test",
			sections: {
				test: {
					type: "survey",
					name: "test",
					children: [
						{ type: "text", name: "q1", label: "Name" },
						{ type: "integer", name: "q2", label: "Age" },
						{ type: "decimal", name: "q3", label: "Height" },
						{ type: "date", name: "q4", label: "DOB" },
					],
				},
			},
		});

		const xml = survey.toXml();
		expect(xml).toContain('type="string"');
		expect(xml).toContain('type="int"');
		expect(xml).toContain('type="decimal"');
		expect(xml).toContain('type="date"');
	});

	it("should create a survey with a group", () => {
		const survey = createSurvey({
			nameOfMainSection: "test",
			sections: {
				test: {
					type: "survey",
					name: "test",
					children: [
						{
							type: "group",
							name: "grp",
							label: "My Group",
							children: [
								{ type: "text", name: "q1", label: "Q1" },
							],
						},
					],
				},
			},
		});

		const xml = survey.toXml();
		expect(xml).toContain("<group");
		expect(xml).toContain('ref="/test/grp"');
		expect(xml).toContain('ref="/test/grp/q1"');
	});

	it("should create a survey with a repeat", () => {
		const survey = createSurvey({
			nameOfMainSection: "test",
			sections: {
				test: {
					type: "survey",
					name: "test",
					children: [
						{
							type: "repeat",
							name: "rep",
							label: "My Repeat",
							children: [
								{ type: "text", name: "q1", label: "Q1" },
							],
						},
					],
				},
			},
		});

		const xml = survey.toXml();
		expect(xml).toContain("<repeat");
		expect(xml).toContain('nodeset="/test/rep"');
	});

	it("should create a survey with select_one", () => {
		const survey = createSurvey({
			nameOfMainSection: "test",
			sections: {
				test: {
					type: "survey",
					name: "test",
					children: [
						{
							type: "select one",
							name: "q1",
							label: "Pick one",
							itemset: "colors",
							list_name: "colors",
							choices: [
								{ name: "red", label: "Red" },
								{ name: "blue", label: "Blue" },
							],
						},
					],
					choices: {
						colors: [
							{ name: "red", label: "Red" },
							{ name: "blue", label: "Blue" },
						],
					},
				},
			},
		});

		const xml = survey.toXml();
		expect(xml).toContain("<select1");
	});
});
