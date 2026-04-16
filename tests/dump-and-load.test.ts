/**
 * Port of test_dump_and_load.py - Test multiple XLSForm can be generated successfully.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createSurveyFromPath } from "../src/builder.js";

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

describe("DumpAndLoadTests", () => {
	const excelFiles = [
		"gps.xls",
		"specify_other.xls",
		"group.xls",
		"loop.xls",
		"text_and_integer.xls",
		"simple_loop.xls",
		"yes_or_no_question.xls",
	];

	const jsonPaths: string[] = [];

	it("test_load_from_dump", () => {
		const surveys: Record<string, any> = {};

		for (const filename of excelFiles) {
			const filePath = pathToTextFixture(filename);
			surveys[filename] = createSurveyFromPath(filePath);
		}

		for (const survey of Object.values(surveys)) {
			survey.jsonDump();
			const jsonPath = `${survey.name}.json`;
			jsonPaths.push(jsonPath);
			const surveyFromDump = createSurveyFromPath(jsonPath);
			expect(survey.toJsonDict()).toEqual(surveyFromDump.toJsonDict());
		}
	});

	afterAll(() => {
		for (const jsonPath of jsonPaths) {
			try {
				fs.unlinkSync(jsonPath);
			} catch {
				// Ignore cleanup errors
			}
		}
	});
});
