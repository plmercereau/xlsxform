/**
 * Port of test_file_utils.py - Test xls2json_backends util functions.
 */

import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { convertFileToCsvString } from "../src/xls2json-backends.js";

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

describe("BackendUtilsTests", () => {
	it("test_xls_to_csv", () => {
		const specifyOtherXls = pathToTextFixture("specify_other.xls");
		const convertedXls = convertFileToCsvString(specifyOtherXls);
		const specifyOtherCsv = pathToTextFixture("specify_other.csv");
		const convertedCsv = convertFileToCsvString(specifyOtherCsv);
		expect(convertedCsv).toBe(convertedXls);
	});
});
