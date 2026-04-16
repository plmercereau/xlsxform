/**
 * Port of test_file.py - Test file question type.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("FileWidgetTest", () => {
	it("test_file_type", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |        |        |               |
			|        | type   | name   | label         |
			|        | file   | file   | Attach a file |
			`,
			xml__contains: ['<upload mediatype="application/*"'],
		});
	});
});
