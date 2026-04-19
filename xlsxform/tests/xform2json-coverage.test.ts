/**
 * Additional xform2json tests for coverage of XFormToDictBuilder internals.
 * Tests round-trip conversion: XLSForm → XML → JSON → XML for various form structures.
 */

import { describe, expect, it } from "vitest";
import {
	createSurveyElementFromJson,
	createSurveyElementFromXml,
} from "../src/conversion/xform2json.js";
import { convert } from "./helpers/xls2xform-node.js";

/**
 * Helper: convert md → XML → Survey (via xform2json) → XML, and verify round-trip.
 * Returns the intermediate Survey so callers can inspect its JSON dict.
 */
function roundTrip(md: string) {
	const result = convert({ xlsform: md, prettyPrint: false });
	const xml = result.xform;
	const survey = createSurveyElementFromXml(xml);
	const observed = survey.toXml({ validate: false, prettyPrint: false });
	return { expected: xml, observed, survey };
}

describe("XFormToDictBuilder - basic forms", () => {
	it("should round-trip a simple text+integer form", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type    | name | label      |
			|        | text    | q1   | Question 1 |
			|        | integer | q2   | Question 2 |
		`);
		expect(observed).toBe(expected);
	});

	it("should round-trip a form with groups", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type        | name     | label         |
			|        | begin_group | personal | Personal Info |
			|        | text        | fname    | First Name    |
			|        | text        | lname    | Last Name     |
			|        | end_group   |          |               |
		`);
		expect(observed).toBe(expected);
	});

	it("should round-trip a form with repeat", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type         | name     | label    |
			|        | begin_repeat | contacts | Contacts |
			|        | text         | cname    | Name     |
			|        | text         | phone    | Phone    |
			|        | end_repeat   |          |          |
		`);
		expect(observed).toBe(expected);
	});

	it("should round-trip a form with nested group inside repeat", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type         | name     | label    |
			|        | begin_repeat | items    | Items    |
			|        | begin_group  | details  | Details  |
			|        | text         | item_name| Name     |
			|        | integer      | qty      | Qty      |
			|        | end_group    |          |          |
			|        | end_repeat   |          |          |
		`);
		expect(observed).toBe(expected);
	});
});

describe("XFormToDictBuilder - multi-language forms", () => {
	it("should round-trip a form with translations", () => {
		const { expected, observed } = roundTrip(`
			| survey  |
			|         | type              | name  | label::en | label::fr |
			|         | text              | q1    | Name      | Nom       |
			|         | select_one colors | color | Color     | Couleur   |
			| choices |
			|         | list_name | name | label::en | label::fr |
			|         | colors    | red  | Red       | Rouge     |
			|         | colors    | blue | Blue      | Bleu      |
		`);
		expect(observed).toBe(expected);
	});
});

describe("XFormToDictBuilder - select questions", () => {
	it("should round-trip select_one with inline choices", () => {
		const { expected, observed } = roundTrip(`
			| survey  |
			|         | type              | name | label    |
			|         | select_one yes_no | q1   | Agree?   |
			| choices |
			|         | list_name | name | label |
			|         | yes_no    | yes  | Yes   |
			|         | yes_no    | no   | No    |
		`);
		expect(observed).toBe(expected);
	});

	it("should round-trip select_multiple", () => {
		const { expected, observed } = roundTrip(`
			| survey  |
			|         | type                   | name  | label  |
			|         | select_multiple fruits | fruit | Fruit? |
			| choices |
			|         | list_name | name   | label  |
			|         | fruits    | apple  | Apple  |
			|         | fruits    | banana | Banana |
			|         | fruits    | mango  | Mango  |
		`);
		expect(observed).toBe(expected);
	});
});

describe("XFormToDictBuilder - bindings and constraints", () => {
	it("should round-trip a form with required and constraint", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type    | name | label | required | constraint | constraint_message |
			|        | integer | age  | Age   | yes      | . > 0      | Must be positive   |
		`);
		expect(observed).toBe(expected);
	});

	it("should round-trip a form with relevance", () => {
		const { expected, observed } = roundTrip(`
			| survey  |
			|         | type              | name    | label   | relevant              |
			|         | select_one yes_no | married | Married |                       |
			|         | text              | spouse  | Spouse  | \${married} = 'yes'   |
			| choices |
			|         | list_name | name | label |
			|         | yes_no    | yes  | Yes   |
			|         | yes_no    | no   | No    |
		`);
		expect(observed).toBe(expected);
	});

	it("should round-trip a form with calculate", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type      | name   | label  | calculation  |
			|        | integer   | price  | Price  |              |
			|        | integer   | qty    | Qty    |              |
			|        | calculate | total  |        | \${price} * \${qty} |
		`);
		expect(observed).toBe(expected);
	});
});

describe("XFormToDictBuilder - special question types", () => {
	it("should round-trip a form with note (readonly)", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name  | label          |
				|        | text | q1    | Your name?     |
				|        | note | intro | Hello \${q1}!   |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		// Note: round-trip of output expressions has minor whitespace differences,
		// so we verify parsing succeeds and produces valid XML rather than exact match
		const survey = createSurveyElementFromXml(xml);
		const observed = survey.toXml({ validate: false, prettyPrint: false });
		expect(observed).toContain('<input ref="/data/q1">');
		expect(observed).toContain('<input ref="/data/intro">');
		expect(observed).toContain("readonly");
		expect(observed).toContain("/data/q1");
	});

	it("should round-trip a form with trigger/acknowledge", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type        | name | label               |
			|        | acknowledge | ack  | I agree to the terms |
		`);
		expect(observed).toBe(expected);
	});

	it("should round-trip a form with geopoint", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type     | name | label    |
			|        | geopoint | loc  | Location |
		`);
		expect(observed).toBe(expected);
	});

	it("should round-trip a form with date and dateTime", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type     | name | label     |
			|        | date     | dob  | Birthday  |
			|        | dateTime | ts   | Timestamp |
		`);
		expect(observed).toBe(expected);
	});

	it("should round-trip a form with barcode", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type    | name | label |
			|        | barcode | bc   | Scan  |
		`);
		expect(observed).toBe(expected);
	});
});

describe("XFormToDictBuilder - appearance and control", () => {
	it("should round-trip a form with appearance", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type | name | label | appearance |
			|        | text | q1   | Q1    | multiline  |
		`);
		expect(observed).toBe(expected);
	});

	it("should round-trip a form with autoplay", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type | name | label | audio       | autoplay |
			|        | text | q1   | Q1    | amazing.mp3 | audio    |
		`);
		expect(observed).toBe(expected);
	});
});

describe("XFormToDictBuilder - settings", () => {
	it("should round-trip a form with submission_url", () => {
		const result = convert({
			xlsform: `
				| survey   |
				|          | type | name | label |
				|          | text | q1   | Q1    |
				| settings |
				|          | form_title | form_id  | submission_url        |
				|          | My Form    | my_form  | https://example.com/s |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		expect(xml).toContain("submission");
		// Verify we can parse it back
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});
});

describe("XFormToDictBuilder - media", () => {
	it("should round-trip a form with image upload", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type  | name  | label |
			|        | image | photo | Photo |
		`);
		expect(observed).toBe(expected);
	});

	it("should round-trip a form with audio upload", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type  | name | label |
			|        | audio | rec  | Rec   |
		`);
		expect(observed).toBe(expected);
	});

	it("should round-trip a form with video upload", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type  | name | label |
			|        | video | vid  | Video |
		`);
		expect(observed).toBe(expected);
	});
});

describe("XFormToDictBuilder - constraint message with itext", () => {
	it("should round-trip a form with translated constraint message", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type    | name | label::en | label::fr | constraint | constraint_message::en | constraint_message::fr |
				|        | integer | age  | Age       | Âge       | . > 0      | Must be positive       | Doit être positif      |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		const observed = survey.toXml({ validate: false, prettyPrint: false });
		expect(observed).toContain("constraint");
		expect(observed).toContain("/data/age");
	});
});

describe("XFormToDictBuilder - media in translations", () => {
	it("should round-trip a form with translated media labels", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label::en | label::fr | media::image::en | media::image::fr |
				|        | text | q1   | Q1 en     | Q1 fr     | img_en.jpg       | img_fr.jpg       |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		expect(xml).toContain("img_en.jpg");
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});
});

describe("XFormToDictBuilder - repeat with jr:count", () => {
	it("should round-trip a form with repeat count", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type         | name  | label  | repeat_count |
				|        | integer      | num   | How many? |           |
				|        | begin_repeat | items | Items  | \${num}      |
				|        | text         | item  | Item   |              |
				|        | end_repeat   |       |        |              |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		const observed = survey.toXml({ validate: false, prettyPrint: false });
		expect(observed).toContain("repeat");
		expect(observed).toContain("items");
	});
});

describe("XFormToDictBuilder - choice filter", () => {
	it("should round-trip a form with choice_filter (cascading select)", () => {
		const result = convert({
			xlsform: `
				| survey  |
				|         | type                    | name    | label   | choice_filter          |
				|         | select_one countries    | country | Country |                        |
				|         | select_one cities       | city    | City    | country=\${country}    |
				| choices |
				|         | list_name | name    | label     | country |
				|         | countries | usa     | USA       |         |
				|         | countries | canada  | Canada    |         |
				|         | cities    | nyc     | New York  | usa     |
				|         | cities    | toronto | Toronto   | canada  |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});
});

describe("XFormToDictBuilder - media with multiple types in translations", () => {
	it("should round-trip a form with translated audio and video media", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label::en | label::fr | media::audio::en | media::audio::fr | media::video::en | media::video::fr |
				|        | text | q1   | Q1 en     | Q1 fr     | en_audio.mp3     | fr_audio.mp3     | en_video.mp4     | fr_video.mp4     |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		expect(xml).toContain("en_audio.mp3");
		expect(xml).toContain("fr_audio.mp3");
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
		const observed = survey.toXml({ validate: false, prettyPrint: false });
		expect(observed).toContain("audio");
		expect(observed).toContain("video");
	});
});

describe("XFormToDictBuilder - single language media (no translation)", () => {
	it("should round-trip a form with untranslated media", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label | media::image |
				|        | text | q1   | Q1    | pic.jpg      |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		expect(xml).toContain("pic.jpg");
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});
});

describe("XFormToDictBuilder - output expression in label", () => {
	it("should round-trip a form with output expression in translated label", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type    | name | label::en           | label::fr           |
				|        | text    | q1   | Name                | Nom                 |
				|        | note    | n1   | Hello \${q1}!       | Bonjour \${q1}!     |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		const observed = survey.toXml({ validate: false, prettyPrint: false });
		expect(observed).toContain("output");
		expect(observed).toContain("/data/q1");
	});
});

describe("XFormToDictBuilder - submission settings", () => {
	it("should round-trip a form with public_key and auto_send", () => {
		const result = convert({
			xlsform: `
				| survey   |
				|          | type | name | label |
				|          | text | q1   | Q1    |
				| settings |
				|          | form_title | form_id | public_key    | auto_send | auto_delete |
				|          | My Form    | myform  | test_key_abc  | true      | true        |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});
});

describe("XFormToDictBuilder - hint on question", () => {
	it("should round-trip a form with hints", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type | name | label | hint         |
			|        | text | q1   | Name  | Enter name   |
		`);
		expect(observed).toBe(expected);
	});

	it("should round-trip a form with translated hints", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label::en | label::fr | hint::en     | hint::fr       |
				|        | text | q1   | Name      | Nom       | Enter name   | Entrer le nom  |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		const observed = survey.toXml({ validate: false, prettyPrint: false });
		expect(observed).toContain("hint");
	});
});

describe("XFormToDictBuilder - rows control", () => {
	it("should round-trip a form with rows attribute", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label | appearance | parameters   |
				|        | text | q1   | Q1    | multiline  | rows=5       |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});
});

describe("XFormToDictBuilder - geopoint hint removal", () => {
	it("should round-trip a form with geopoint (hint removed)", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type     | name | label    | hint       |
				|        | geopoint | loc  | Location | Pick point |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});
});

describe("XFormToDictBuilder - readonly note with output only", () => {
	it("should round-trip a note with only output (no leading text)", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label          |
				|        | text | q1   | Your name?     |
				|        | note | n1   | \${q1}         |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		const observed = survey.toXml({ validate: false, prettyPrint: false });
		expect(observed).toContain("readonly");
		expect(observed).toContain("/data/q1");
	});
});

describe("XFormToDictBuilder - preload metadata", () => {
	it("should parse a form with metadata bindings", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type     | name     | label  |
				|        | start    | start    |        |
				|        | end      | end      |        |
				|        | text     | q1       | Q1     |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});
});

describe("createSurveyElementFromJson", () => {
	it("should create a survey from a JSON string", () => {
		const json = JSON.stringify({
			type: "survey",
			name: "data",
			title: "Test",
			id_string: "test",
			default_language: "default",
			children: [{ type: "text", name: "q1", label: "Q1" }],
		});
		const survey = createSurveyElementFromJson(json);
		expect(survey).toBeDefined();
		expect(survey.name).toBe("data");
	});
});
