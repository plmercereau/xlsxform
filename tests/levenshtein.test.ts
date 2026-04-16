/**
 * Port of test_levenshtein.py - Test Levenshtein distance.
 */

import { describe, expect, it } from "vitest";
import { levenshteinDistance } from "../src/xls2json.js";

describe("TestLevenshteinDistance", () => {
	it("test_levenshtein_distance", () => {
		// Verified against Postgres v10 extension "fuzzystrmatch" levenshtein().
		const testData: [number, string, string][] = [
			[3, "sitting", "kitten"],
			[3, "Sunday", "Saturday"],
			[0, "settings", "settings"],
			[1, "setting", "settings"],
			[13, "abcdefghijklm", "nopqrstuvwxyz"],
			[11, "abc  klm", "** _rs /wxyz"],
			[4, "ABCD", "abcd"],
		];
		for (const [expected, a, b] of testData) {
			expect(levenshteinDistance(a, b)).toBe(expected);
		}
	});
});
