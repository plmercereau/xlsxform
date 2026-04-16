/**
 * Port of test_fields.py - Test duplicate survey question field name.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("FieldTests", () => {
	it("should output a geopoint question", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type     | name | label    |
				|        | geopoint | q1   | Location |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/test_name/q1' and @type='geopoint']",
			],
		});
	});

	it("should output a barcode question", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type    | name | label |
				|        | barcode | q1   | Scan  |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/test_name/q1' and @type='barcode']",
			],
		});
	});

	it("should output a time question", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label |
				|        | time | q1   | Time? |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/test_name/q1' and @type='time']",
			],
		});
	});

	it("should output a datetime question", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type     | name | label     |
				|        | dateTime | q1   | DateTime? |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/test_name/q1' and @type='dateTime']",
			],
		});
	});

	it("should output a photo upload question", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type  | name | label |
				|        | image | q1   | Photo |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/test_name/q1' and @type='binary']",
				"/h:html/h:body/x:upload[@ref='/test_name/q1' and @mediatype='image/*']",
			],
		});
	});

	it("should output an audio upload question", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type  | name | label |
				|        | audio | q1   | Audio |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:upload[@ref='/test_name/q1' and @mediatype='audio/*']",
			],
		});
	});

	it("should output a video upload question", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type  | name | label |
				|        | video | q1   | Video |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:upload[@ref='/test_name/q1' and @mediatype='video/*']",
			],
		});
	});

	it("should output a file upload question", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label |
				|        | file | q1   | File  |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:upload[@ref='/test_name/q1' and @mediatype='application/*']",
			],
		});
	});

	it("should output a geoshape question", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type     | name | label |
				|        | geoshape | q1   | Area  |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/test_name/q1' and @type='geoshape']",
			],
		});
	});

	it("should output a geotrace question", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type     | name | label |
				|        | geotrace | q1   | Path  |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/test_name/q1' and @type='geotrace']",
			],
		});
	});

	it("should output a hidden question", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type   | name | label | calculation |
				|        | hidden | q1   |       | 1           |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/test_name/q1' and @type='string']",
			],
		});
	});
});

describe("TestQuestionParsing", () => {
	it("should find that a single unique question name is ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label |
				|        | text | q1   | Q1    |
			`,
			warnings_count: 0,
		});
	});

	it("should find that questions with unique names in the same context is ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label |
				|        | text | q1   | Q1    |
				|        | text | q2   | Q2    |
			`,
			warnings_count: 0,
		});
	});

	it("should find that a question name can be the same as another question in a different group context", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label |
				|        | text        | q1   | Q1    |
				|        | begin group | g1   | G1    |
				|        | text        | q1   | Q1    |
				|        | end group   |      |       |
			`,
			warnings_count: 0,
		});
	});

	it("should find that a question name can be the same as another question in a different repeat context", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name | label |
				|        | text         | q1   | Q1    |
				|        | begin repeat | r1   | R1    |
				|        | text         | q1   | Q1    |
				|        | end repeat   |      |       |
			`,
			warnings_count: 0,
		});
	});

	it("should find that a question name can be the same a group in a different group context", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label |
				|        | text        | q1   | Q1    |
				|        | begin group | g1   | G1    |
				|        | begin group | q1   | G1    |
				|        | text        | q2   | Q1    |
				|        | end group   |      |       |
				|        | end group   |      |       |
			`,
			warnings_count: 0,
		});
	});

	it("should find that a question name can be the same a group in a different repeat context", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name | label |
				|        | text         | q1   | Q1    |
				|        | begin repeat | r1   | R1    |
				|        | begin group  | q1   | G1    |
				|        | text         | q2   | Q1    |
				|        | end group    |      |       |
				|        | end repeat   |      |       |
			`,
			warnings_count: 0,
		});
	});

	it("should find that a question name can be the same a repeat in a different group context", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name | label |
				|        | text         | q1   | Q1    |
				|        | begin group  | g1   | G1    |
				|        | begin repeat | q1   | G1    |
				|        | text         | q2   | Q1    |
				|        | end repeat   |      |       |
				|        | end group    |      |       |
			`,
			warnings_count: 0,
		});
	});

	it("should find that a question name can be the same a repeat in a different repeat context", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name | label |
				|        | text         | q1   | Q1    |
				|        | begin repeat | r1   | R1    |
				|        | begin repeat | q1   | G1    |
				|        | text         | q2   | Q1    |
				|        | end repeat   |      |       |
				|        | end repeat   |      |       |
			`,
			warnings_count: 0,
		});
	});

	it("should find that a question name can be the same as the survey root", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label |
				|        | text | data | Q1    |
			`,
			name: "data",
			warnings_count: 0,
		});
	});

	it("should find that a question name can be the same (CI) as the survey root", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label |
				|        | text | DATA | Q1    |
			`,
			name: "data",
			warnings_count: 0,
		});
	});

	it("should find that a duplicate question name in same context in survey raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label |
				|        | text | q1   | Q1    |
				|        | text | q1   | Q2    |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'name' value 'q1' is invalid.",
			],
		});
	});

	it("should find that a duplicate question name same as group in same context in survey raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label |
				|        | text        | q1   | Q1    |
				|        | begin group | q1   | G2    |
				|        | text        | q2   | Q2    |
				|        | end group   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'name' value 'q1' is invalid.",
			],
		});
	});

	it("should find that a duplicate question name same as repeat in same context in survey raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name | label |
				|        | text         | q1   | Q1    |
				|        | begin repeat | q1   | G2    |
				|        | text         | q2   | Q2    |
				|        | end repeat   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'name' value 'q1' is invalid.",
			],
		});
	});

	it("should find that a duplicate question name in same context in group raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label |
				|        | begin group | g1   | G1    |
				|        | text        | q1   | Q1    |
				|        | text        | q1   | Q2    |
				|        | end group   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 4] On the 'survey' sheet, the 'name' value 'q1' is invalid.",
			],
		});
	});

	it("should find that a duplicate question name same as group in same context in group raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label |
				|        | begin group | g1   | G1    |
				|        | text        | q1   | Q1    |
				|        | begin group | q1   | G2    |
				|        | text        | q2   | Q2    |
				|        | end group   |      |       |
				|        | end group   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 4] On the 'survey' sheet, the 'name' value 'q1' is invalid.",
			],
		});
	});

	it("should find that a duplicate question name same as repeat in same context in group raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name | label |
				|        | begin group  | g1   | G1    |
				|        | text         | q1   | Q1    |
				|        | begin repeat | q1   | G2    |
				|        | text         | q2   | Q2    |
				|        | end repeat   |      |       |
				|        | end group    |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 4] On the 'survey' sheet, the 'name' value 'q1' is invalid.",
			],
		});
	});

	it("should find that a duplicate question name in same context in repeat raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name | label |
				|        | begin repeat | r1   | R1    |
				|        | text         | q1   | Q1    |
				|        | text         | q1   | Q2    |
				|        | end repeat   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 4] On the 'survey' sheet, the 'name' value 'q1' is invalid.",
			],
		});
	});

	it("should find that a duplicate question name same as group in same context in repeat raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name | label |
				|        | begin repeat | r1   | R1    |
				|        | text         | q1   | Q1    |
				|        | begin group  | q1   | G2    |
				|        | text         | q2   | Q2    |
				|        | end group    |      |       |
				|        | end repeat   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 4] On the 'survey' sheet, the 'name' value 'q1' is invalid.",
			],
		});
	});

	it("should find that a duplicate question name same as repeat in same context in repeat raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name | label |
				|        | begin repeat | r1   | R1    |
				|        | text         | q1   | Q1    |
				|        | begin repeat | q1   | G2    |
				|        | text         | q2   | Q2    |
				|        | end repeat   |      |       |
				|        | end repeat   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 4] On the 'survey' sheet, the 'name' value 'q1' is invalid.",
			],
		});
	});

	it("should find that a case-insensitive duplicate question name in same context in survey raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label |
				|        | text | q1   | Q1    |
				|        | text | Q1   | Q2    |
			`,
			warnings__contains: [
				"[row : 3] On the 'survey' sheet, the 'name' value 'Q1' is problematic.",
			],
		});
	});

	it("should find that a case-insensitive duplicate question name same as group in same context in survey raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label |
				|        | text        | q1   | Q1    |
				|        | begin group | Q1   | G2    |
				|        | text        | q2   | Q2    |
				|        | end group   |      |       |
			`,
			warnings__contains: [
				"[row : 3] On the 'survey' sheet, the 'name' value 'Q1' is problematic.",
			],
		});
	});

	it("should find that a case-insensitive duplicate question name same as repeat in same context in survey raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name | label |
				|        | text         | q1   | Q1    |
				|        | begin repeat | Q1   | G2    |
				|        | text         | q2   | Q2    |
				|        | end repeat   |      |       |
			`,
			warnings__contains: [
				"[row : 3] On the 'survey' sheet, the 'name' value 'Q1' is problematic.",
			],
		});
	});

	it("should find that a case-insensitive duplicate question name in same context in group raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label |
				|        | begin group | g1   | G1    |
				|        | text        | q1   | Q1    |
				|        | text        | Q1   | Q2    |
				|        | end group   |      |       |
			`,
			warnings__contains: [
				"[row : 4] On the 'survey' sheet, the 'name' value 'Q1' is problematic.",
			],
		});
	});

	it("should find that a case-insensitive duplicate question name same as group in same context in group raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label |
				|        | begin group | g1   | G1    |
				|        | text        | q1   | Q1    |
				|        | begin group | Q1   | G2    |
				|        | text        | q2   | Q2    |
				|        | end group   |      |       |
				|        | end group   |      |       |
			`,
			warnings__contains: [
				"[row : 4] On the 'survey' sheet, the 'name' value 'Q1' is problematic.",
			],
		});
	});

	it("should find that a case-insensitive duplicate question name same as repeat in same context in group raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name | label |
				|        | begin group  | g1   | G1    |
				|        | text         | q1   | Q1    |
				|        | begin repeat | Q1   | G2    |
				|        | text         | q2   | Q2    |
				|        | end repeat   |      |       |
				|        | end group    |      |       |
			`,
			warnings__contains: [
				"[row : 4] On the 'survey' sheet, the 'name' value 'Q1' is problematic.",
			],
		});
	});

	it("should find that a case-insensitive duplicate question name in same context in repeat raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name | label |
				|        | begin repeat | r1   | R1    |
				|        | text         | q1   | Q1    |
				|        | text         | Q1   | Q2    |
				|        | end repeat   |      |       |
			`,
			warnings__contains: [
				"[row : 4] On the 'survey' sheet, the 'name' value 'Q1' is problematic.",
			],
		});
	});

	it("should find that a case-insensitive duplicate question name same as group in same context in repeat raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name | label |
				|        | begin repeat | r1   | R1    |
				|        | text         | q1   | Q1    |
				|        | begin group  | Q1   | G2    |
				|        | text         | q2   | Q2    |
				|        | end group    |      |       |
				|        | end repeat   |      |       |
			`,
			warnings__contains: [
				"[row : 4] On the 'survey' sheet, the 'name' value 'Q1' is problematic.",
			],
		});
	});

	it("should find that a case-insensitive duplicate question name same as repeat in same context in repeat raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name | label |
				|        | begin repeat | r1   | R1    |
				|        | text         | q1   | Q1    |
				|        | begin repeat | Q1   | G2    |
				|        | text         | q2   | Q2    |
				|        | end repeat   |      |       |
				|        | end repeat   |      |       |
			`,
			warnings__contains: [
				"[row : 4] On the 'survey' sheet, the 'name' value 'Q1' is problematic.",
			],
		});
	});

	it("should raise an error if the referenced name is not found (target after source)", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label      |
				|        | text | q1   | \${q2x}    |
				|        | text | q2   | Q2         |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'label' value is invalid.",
			],
		});
	});

	it("should raise an error if the referenced name is not found (target before source)", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label      |
				|        | text | q1   | Q1         |
				|        | text | q2   | \${q1x}    |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'label' value is invalid.",
			],
		});
	});

	it("should find that a referenced name needs to be unique in all contexts (question in different group)", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label     |
				|        | text        | q1   | Q1        |
				|        | begin group | g1   | G1        |
				|        | text        | q1   | \${q1}    |
				|        | end group   |      |           |
			`,
			errored: true,
			error__contains: [
				"[row : 4] On the 'survey' sheet, the 'label' value is invalid.",
			],
		});
	});

	it("should find that a referenced name needs to be unique in all contexts (group in different group)", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label     |
				|        | text        | q1   | Q1        |
				|        | begin group | g1   | G1        |
				|        | begin group | q1   | G1        |
				|        | text        | q2   | \${q1}    |
				|        | end group   |      |           |
				|        | end group   |      |           |
			`,
			errored: true,
			error__contains: [
				"[row : 5] On the 'survey' sheet, the 'label' value is invalid.",
			],
		});
	});

	it("should find that references in ignored columns are not resolved (type)", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type       | name | label |
				|        | text       | q1   | Q1    |
				|        | \${q1x}   | q2   | Q2    |
			`,
			errored: true,
			error__contains: ["Unknown question type"],
		});
	});

	it("should find that references in ignored columns are not resolved (name)", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name       | label |
				|        | text | q1         | Q1    |
				|        | text | \${q1x}   | Q2    |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'name' value is invalid.",
			],
		});
	});

	it("should find that references in ignored columns using a name alias are not resolved", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | tag        | label |
				|        | text | q1         | Q1    |
				|        | text | \${q1x}   | Q2    |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'name' value is invalid.",
			],
		});
	});

	it("should find that references in a column using an alias are resolved", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | caption    |
				|        | text | q1   | Q1         |
				|        | text | q2   | \${q1x}   |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'caption' value is invalid.",
			],
		});
	});

	it("should find that references in a translated column using an alias are resolved", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | caption::English (en) |
				|        | text | q1   | Q1                    |
				|        | text | q2   | \${q1x}              |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'caption::English (en)' value is invalid.",
			],
		});
	});
});
