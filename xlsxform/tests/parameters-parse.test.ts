/**
 * Tests for the survey 'parameters' column parser.
 *
 * Ported from pyxform tests/parsing/test_parameters.py.
 */

import { describe, expect, it } from "vitest";
import { PyXFormError } from "../src/errors.js";
import { parseParameters } from "../src/parsing/parameters.js";

// ( <description>, <input string>, <expected output> )
const positive: [string, string, Record<string, string>][] = [
	["Single pair", "value=val", { value: "val" }],
	["Normalize keys to lowercase", "VALUE=val", { value: "val" }],
	["Preserve case for 'value' value", "value=VAL", { value: "VAL" }],
	["Preserve case for 'label' value", "label=Lb-L", { label: "Lb-L" }],
	[
		"Normalize values to lowercase for non-case-sensitive keys",
		"other_key=VAL",
		{ other_key: "val" },
	],
	[
		"Multiple pairs separated by space",
		"value=val label=lbl",
		{ value: "val", label: "lbl" },
	],
	[
		"Multiple pairs separated by comma",
		"value=val,label=lbl",
		{ value: "val", label: "lbl" },
	],
	[
		"Multiple pairs separated by semicolon",
		"value=val;label=lbl",
		{ value: "val", label: "lbl" },
	],
	[
		"Whitespace around delimiters and equals",
		"  value  =  val1  ,  label  =  lbl1  ",
		{ value: "val1", label: "lbl1" },
	],
	[
		"Whitespace around delimiters and equals - motivating case from pyxform/#812",
		"label = foo, value = bar",
		{ label: "foo", value: "bar" },
	],
	[
		"Special characters accepted in key or value",
		"value=*val3#",
		{ value: "*val3#" },
	],
	[
		"Duplicate keys have last-write-wins behavior",
		"value=first value=second",
		{ value: "second" },
	],
];

// ( <description>, <input string> )
const negative: [string, string][] = [
	["Missing equals sign and value", "value"],
	["Missing key before equals", "=val"],
	["Missing value after equals", "value="],
	["Whitespace only after equals", "value= "],
	["Duplicate equals", "value==val"],
	["Key with no value assignment", "value=val label"],
	["Spaces in values", "label=My Label"],
	["Invalid delimiter", "value=val&label=Label"],
	["No delimiter", "value=vallabel=Label"],
];

describe("parseParameters", () => {
	it("should parse structurally valid strings into matching maps", () => {
		for (const [description, input, expected] of positive) {
			expect(parseParameters(input, 1), description).toEqual(expected);
		}
	});

	it("should raise a PyXFormError for structurally invalid parameters", () => {
		for (const [description, input] of negative) {
			expect(() => parseParameters(input, 1), description).toThrow(
				PyXFormError,
			);
		}
	});

	it("should return an empty map on empty or blank inputs", () => {
		expect(parseParameters("", 1)).toEqual({});
		expect(parseParameters("    ", 1)).toEqual({});
		expect(parseParameters(null, 1)).toEqual({});
		expect(parseParameters(undefined, 1)).toEqual({});
	});
});
