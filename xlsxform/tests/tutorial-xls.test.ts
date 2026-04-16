/**
 * Port of test_tutorial_xls.py - Test tutorial XLSForm.
 */

import * as path from "node:path";
import { describe, it } from "vitest";
import { createSurveyFromPath } from "./helpers/builder-node.js";

const EXAMPLE_XLS_PATH = path.join(
	__dirname,
	"..",
	"..",
	"pyxform",
	"tests",
	"example_xls",
);

function pathToTextFixture(filename: string): string {
	return path.join(EXAMPLE_XLS_PATH, filename);
}

describe("TutorialTests", () => {
	it("test_create_from_path", () => {
		const filePath = pathToTextFixture("tutorial.xls");
		createSurveyFromPath(filePath);
	});
});
