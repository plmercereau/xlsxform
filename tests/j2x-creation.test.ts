/**
 * Port of test_j2x_creation.py - Testing creation of Surveys using verbose methods.
 */

import { describe, it, expect } from "vitest";
import { Survey } from "../src/survey.js";
import { MultipleChoiceQuestion } from "../src/question.js";

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

	// Requires create_survey_from_xls with file path.
	it.todo("test_allow_surveys_with_comment_rows - requires internal API (create_survey_from_xls, to_json_dict)");
});
