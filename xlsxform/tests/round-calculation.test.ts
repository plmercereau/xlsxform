/**
 * Port of test_bug_round_calculation.py - Round calculation tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("RoundCalculationTest", () => {
	it("test_non_existent_itext_reference", () => {
		assertPyxformXform({
			name: "ecsv",
			md: `
				| survey |             |                |         |                     |
				|        | type        | name           | label   | calculation         |
				|        | decimal     | amount         | Counter |                     |
				|        | calculate   | rounded        | Rounded | round(\${amount}, 0) |
			`,
			xml__contains: ["<instance>"],
		});
	});
});
