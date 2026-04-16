/**
 * Additional tests for instance.ts coverage.
 */

import { describe, expect, it } from "vitest";
import { PyXFormError } from "../src/errors.js";
import { SurveyInstance } from "../src/instance.js";
import { convert } from "./helpers/xls2xform-node.js";

function createTestInstance() {
	const result = convert({
		xlsform: `
			| survey |
			|        | type    | name | label      |
			|        | text    | q1   | Question 1 |
			|        | integer | q2   | Question 2 |
		`,
		prettyPrint: false,
	});
	const survey = result._survey!;
	return new SurveyInstance(survey);
}

describe("SurveyInstance - uncovered methods", () => {
	it("should throw when answer name is null", () => {
		const instance = createTestInstance();
		expect(() =>
			instance.answer({ name: null as unknown as string, value: "test" }),
		).toThrow(PyXFormError);
	});

	it("should return toJsonDict with answers", () => {
		const instance = createTestInstance();
		instance.answer({ name: "q1", value: "hello" });
		const dict = instance.toJsonDict();
		expect(dict.children).toEqual([{ node_name: "q1", value: "hello" }]);
	});

	it("should return toJsonDict with empty children when no answers", () => {
		const instance = createTestInstance();
		const dict = instance.toJsonDict();
		expect(dict.children).toEqual([]);
		expect(dict.node_name).toBeDefined();
		expect(dict.id).toBeDefined();
	});

	it("should return toString with answer counts", () => {
		const instance = createTestInstance();
		instance.answer({ name: "q1", value: "val" });
		const str = instance.toString();
		expect(str).toContain("1 answers");
		expect(str).toContain("1 placed");
		expect(str).toContain("0 orphans");
	});

	it("should count orphan answers in toString", () => {
		const instance = createTestInstance();
		instance.answer({ name: "nonexistent", value: "val" });
		const str = instance.toString();
		expect(str).toContain("1 orphans");
	});

	it("should return keys from survey children", () => {
		const instance = createTestInstance();
		const keys = instance.keys();
		expect(keys).toContain("q1");
		expect(keys).toContain("q2");
	});

	it("should return xpaths", () => {
		const instance = createTestInstance();
		const xpaths = instance.xpaths();
		expect(xpaths.length).toBeGreaterThan(0);
	});
});
