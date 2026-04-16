/**
 * Port of test_j2x_creation.py - Testing creation of Surveys using verbose methods.
 */

import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { createSurveyFromXls } from "../src/builder.js";
import { MultipleChoiceQuestion } from "../src/question.js";
import { Survey } from "../src/survey.js";

const EXAMPLE_XLS_PATH = path.join(
	__dirname,
	"..",
	"pyxform",
	"tests",
	"example_xls",
);

function pathToTextFixture(filename: string): string {
	return path.join(EXAMPLE_XLS_PATH, filename);
}

describe("Json2XformVerboseSurveyCreationTests", () => {
	it("test_survey_can_be_created_in_a_slightly_less_verbose_manner", () => {
		const choices = {
			test: [
				{ name: "red", label: "Red" },
				{ name: "blue", label: "Blue" },
			],
		};
		const s = new Survey({ name: "Roses_are_Red", type: "survey", choices });
		const q = new MultipleChoiceQuestion({
			name: "Favorite_Color",
			type: "select one",
			list_name: "test",
		});
		s.addChild(q);

		const expected = {
			name: "Roses_are_Red",
			type: "survey",
			children: [
				{ name: "Favorite_Color", type: "select one", list_name: "test" },
			],
			choices,
		};

		expect(s.toJsonDict()).toEqual(expected);
	});

	it("test_allow_surveys_with_comment_rows", () => {
		const filePath = pathToTextFixture("allow_comment_rows_test.xls");
		const survey = createSurveyFromXls(filePath);
		const expectedDict = {
			children: [
				{
					label: { English: "First and last name of farmer" },
					name: "farmer_name",
					type: "text",
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
			],
			default_language: "default",
			id_string: "allow_comment_rows_test",
			name: "data",
			sms_keyword: "allow_comment_rows_test",
			title: "allow_comment_rows_test",
			type: "survey",
		};
		expect(survey.toJsonDict()).toEqual(expectedDict);
	});
});
