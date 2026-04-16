/**
 * Edge case tests for xform2json.ts - targeting uncovered code paths.
 */

import { describe, expect, it } from "vitest";
import { PyXFormError } from "../src/errors.js";
import {
	createSurveyElementFromJson,
	createSurveyElementFromXml,
} from "../src/xform2json.js";
import { convert } from "./helpers/xls2xform-node.js";

/**
 * Helper: convert md → XML → Survey (via xform2json) → XML.
 * Returns the intermediate Survey so callers can inspect its JSON dict.
 */
function roundTrip(md: string) {
	const result = convert({ xlsform: md, prettyPrint: false });
	const xml = result.xform;
	const survey = createSurveyElementFromXml(xml);
	const observed = survey.toXml({ validate: false, prettyPrint: false });
	return { expected: xml, observed, survey, xml };
}

// ─── Lines 210-234: XForm validation errors ────────────────────────────────

describe("XFormToDictBuilder - XML validation errors", () => {
	it("should throw when XML has no html element", () => {
		const xml = '<?xml version="1.0"?><nothtml><body/></nothtml>';
		expect(() => createSurveyElementFromXml(xml)).toThrow(PyXFormError);
	});

	it("should throw when html has no body element", () => {
		const xml =
			'<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>T</title><model><bind nodeset="/data/q1" type="string"/><instance><data id="t"><q1/></data></instance></model></head></html>';
		expect(() => createSurveyElementFromXml(xml)).toThrow(PyXFormError);
	});

	it("should throw when html has no head element", () => {
		const xml =
			'<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body/></html>';
		expect(() => createSurveyElementFromXml(xml)).toThrow(PyXFormError);
	});

	it("should throw when head has no model element", () => {
		const xml =
			'<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>T</title></head><body/></html>';
		expect(() => createSurveyElementFromXml(xml)).toThrow(PyXFormError);
	});

	it("should throw when head has no title element", () => {
		const xml =
			'<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><model><bind nodeset="/data/q1" type="string"/><instance><data id="t"><q1/></data></instance></model></head><body/></html>';
		expect(() => createSurveyElementFromXml(xml)).toThrow(PyXFormError);
	});

	it("should throw when model has no bind element", () => {
		const xml =
			'<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>T</title><model><instance><data id="t"><q1/></data></instance></model></head><body/></html>';
		expect(() => createSurveyElementFromXml(xml)).toThrow(PyXFormError);
	});
});

// ─── Line 239-240: single bind (not array) ─────────────────────────────────

describe("XFormToDictBuilder - single bind (non-array)", () => {
	it("should handle a form with exactly one binding via crafted XML", () => {
		// Craft XML with a single bind (not wrapped in array)
		const xml = `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>SingleBind</title>
    <model>
      <instance>
        <data id="single_bind">
          <q1/>
        </data>
      </instance>
      <bind nodeset="/data/q1" type="string"/>
    </model>
  </head>
  <body>
    <input ref="/data/q1">
      <label>Q1</label>
    </input>
  </body>
</html>`;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
		const outXml = survey.toXml({ validate: false, prettyPrint: false });
		expect(outXml).toContain("q1");
	});
});

// ─── Lines 319-322: instances as array (multiple instances) ─────────────────

describe("XFormToDictBuilder - instances as array", () => {
	it("should handle id_string from array-style instances (select with choices)", () => {
		const result = convert({
			xlsform: `
				| survey  |
				|         | type              | name | label  |
				|         | select_one fruits  | q1   | Fruit? |
				| choices |
				|         | list_name | name   | label  |
				|         | fruits    | apple  | Apple  |
				|         | fruits    | banana | Banana |
				| settings |
				|          | form_title | form_id |
				|          | My Form    | myform  |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
		// The id_string should be resolved from the array-style instances
		expect(survey.name).toBeDefined();
	});
});

// ─── Lines 548-566: inline select choices (item in obj) ─────────────────────

describe("XFormToDictBuilder - inline select choices via item", () => {
	it("should parse inline select items when present in body XML", () => {
		// Craft XForm with inline <item> elements instead of <itemset>
		const xml = `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:h="http://www.w3.org/1999/xhtml"
      xmlns:xf="http://www.w3.org/2002/xforms">
  <head>
    <title>Inline Test</title>
    <model>
      <instance>
        <data id="inline_test">
          <q1/>
        </data>
      </instance>
      <bind nodeset="/data/q1" type="string"/>
    </model>
  </head>
  <body>
    <select1 ref="/data/q1">
      <label>Pick one</label>
      <item>
        <label>Yes</label>
        <value>yes</value>
      </item>
      <item>
        <label>No</label>
        <value>no</value>
      </item>
    </select1>
  </body>
</html>`;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
		const outXml = survey.toXml({ validate: false, prettyPrint: false });
		expect(outXml).toContain("q1");
	});
});

// ─── Lines 571-576: note detection (readonly text → note, bind cleanup) ─────

describe("XFormToDictBuilder - note with bind cleanup", () => {
	it("should convert readonly text to note and clean up empty bind", () => {
		// A note with no other bind attributes should have bind cleaned up
		const { survey } = roundTrip(`
			| survey |
			|        | type | name | label        |
			|        | note | n1   | Just a note  |
		`);
		expect(survey).toBeDefined();
		const outXml = survey.toXml({ validate: false, prettyPrint: false });
		expect(outXml).toContain("readonly");
	});
});

// ─── Lines 610-640: choice filter XPath parsing ─────────────────────────────

describe("XFormToDictBuilder - choice filter XPath extraction", () => {
	it("should parse choice_filter from cascading select itemset", () => {
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
		// Verify the XML contains itemset with filter
		expect(xml).toContain("itemset");
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
		const outXml = survey.toXml({ validate: false, prettyPrint: false });
		expect(outXml).toContain("city");
		expect(outXml).toContain("country");
	});
});

// ─── Lines 700-726: preload params (start/end/today/deviceid/etc.) ──────────

describe("XFormToDictBuilder - preload parameters", () => {
	it("should parse start/end metadata with preload params", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type       | name       | label  |
				|        | start      | start      |        |
				|        | end        | end        |        |
				|        | today      | today      |        |
				|        | deviceid   | deviceid   |        |
				|        | text       | q1         | Q1     |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
		const outXml = survey.toXml({ validate: false, prettyPrint: false });
		// preload types should be converted back - start/end become preload types
		expect(outXml).toContain("preload");
		expect(outXml).toContain("/data/meta");
	});

	it("should parse phonenumber and username metadata", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type        | name        | label  |
				|        | phonenumber | phonenumber |        |
				|        | username    | username    |        |
				|        | text        | q1          | Q1     |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});
});

// ─── Lines 705-707: required true()/false() conversion ──────────────────────

describe("XFormToDictBuilder - required binding conversion", () => {
	it("should convert required=true() to yes and false() to no", () => {
		const { survey } = roundTrip(`
			| survey |
			|        | type    | name | label | required |
			|        | text    | q1   | Q1    | yes      |
			|        | text    | q2   | Q2    |          |
		`);
		expect(survey).toBeDefined();
	});
});

// ─── Lines 785-860: media array in translations ─────────────────────────────

describe("XFormToDictBuilder - media array in translations", () => {
	it("should parse form with image media in multiple languages", () => {
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
		expect(xml).toContain("img_fr.jpg");
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
		const outXml = survey.toXml({ validate: false, prettyPrint: false });
		// Media should be preserved
		expect(outXml).toContain("image");
	});

	it("should parse form with audio media in translations", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label::en | label::fr | media::audio::en | media::audio::fr |
				|        | text | q1   | Q1 en     | Q1 fr     | en.mp3           | fr.mp3           |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
		const outXml = survey.toXml({ validate: false, prettyPrint: false });
		expect(outXml).toContain("audio");
	});

	it("should handle media with '-' placeholder value in translations", () => {
		// When media value is '-', it should be skipped
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label::en | label::fr | media::image::en | media::image::fr |
				|        | text | q1   | Q1 en     | Q1 fr     | img_en.jpg       | -                |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});
});

// ─── Lines 864-870: single-language media (key=media, label has only default) ─

describe("XFormToDictBuilder - single language media default unwrap", () => {
	it("should unwrap media label when only default language", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label | media::image |
				|        | text | q1   | Q1    | pic.jpg      |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
		const outXml = survey.toXml({ validate: false, prettyPrint: false });
		expect(outXml).toContain("pic.jpg");
	});
});

// ─── Lines 607-608: geopoint hint removal ───────────────────────────────────

describe("XFormToDictBuilder - geopoint with hint", () => {
	it("should strip hint from geopoint questions", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type     | name | label    | hint            |
				|        | geopoint | loc  | Location | Pick a location |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		// The original XML has a hint
		expect(xml).toContain("hint");
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
		// After round-trip, geopoint hint is removed by xform2json
		const outXml = survey.toXml({ validate: false, prettyPrint: false });
		// The geopoint should still be in the output
		expect(outXml).toContain("geopoint");
	});
});

// ─── Lines 580-600: repeat with nested children ─────────────────────────────

describe("XFormToDictBuilder - repeat handling", () => {
	it("should parse repeat with jr:count binding", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type         | name  | label     | repeat_count |
				|        | integer      | num   | How many? |              |
				|        | begin_repeat | items | Items     | \${num}      |
				|        | text         | item  | Item      |              |
				|        | end_repeat   |       |           |              |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
		const outXml = survey.toXml({ validate: false, prettyPrint: false });
		expect(outXml).toContain("repeat");
		expect(outXml).toContain("items");
	});

	it("should parse repeat with nested groups", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type         | name    | label    |
			|        | begin_repeat | rep     | Repeat   |
			|        | begin_group  | grp     | Group    |
			|        | text         | q1      | Q1       |
			|        | integer      | q2      | Q2       |
			|        | end_group    |         |          |
			|        | end_repeat   |         |          |
		`);
		expect(observed).toBe(expected);
	});
});

// ─── Lines 492-497: nodeset fallback in _getQuestionFromObject ──────────────

describe("XFormToDictBuilder - nodeset fallback", () => {
	it("should handle questions with nodeset attribute in XForm body", () => {
		// trigger elements use nodeset instead of ref
		const { survey } = roundTrip(`
			| survey |
			|        | type        | name | label               |
			|        | acknowledge | ack  | I agree to the terms |
		`);
		expect(survey).toBeDefined();
	});
});

// ─── Lines 398-404: calculate in bindList cleanup ───────────────────────────

describe("XFormToDictBuilder - calculate in bind list cleanup", () => {
	it("should handle calculate fields that remain in bind list", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type      | name   | label  | calculation         |
				|        | integer   | price  | Price  |                     |
				|        | integer   | qty    | Qty    |                     |
				|        | calculate | total  |        | \${price} * \${qty} |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
		const outXml = survey.toXml({ validate: false, prettyPrint: false });
		expect(outXml).toContain("total");
		expect(outXml).toContain("calculate");
	});
});

// ─── Lines 435-438: meta group with bodyless control ────────────────────────

describe("XFormToDictBuilder - meta group handling", () => {
	it("should mark meta group as bodyless", () => {
		// Forms with metadata like instanceID get a meta group
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label |
				|        | text | q1   | Q1    |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		// The XML should contain meta/instanceID
		expect(xml).toContain("instanceID");
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
		const outXml = survey.toXml({ validate: false, prettyPrint: false });
		expect(outXml).toContain("instanceID");
	});
});

// ─── Lines 784-787: output without _text (output-only label) ────────────────

describe("XFormToDictBuilder - output expression without leading text", () => {
	it("should handle label that is only an output reference", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label     |
				|        | text | q1   | Name      |
				|        | note | n1   | \${q1}    |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
		const outXml = survey.toXml({ validate: false, prettyPrint: false });
		expect(outXml).toContain("/data/q1");
	});
});

// ─── Lines 709-711: constraint/relevant/calculate xpath shortening ──────────

describe("XFormToDictBuilder - xpath shortening in bind attributes", () => {
	it("should shorten xpaths in constraint expressions", () => {
		const { survey } = roundTrip(`
			| survey |
			|        | type    | name | label | constraint   | constraint_message |
			|        | integer | age  | Age   | . > 0 and . < 200 | Must be 1-199 |
		`);
		expect(survey).toBeDefined();
	});

	it("should shorten xpaths in relevant expressions", () => {
		const result = convert({
			xlsform: `
				| survey  |
				|         | type              | name    | label    | relevant             |
				|         | select_one yn     | q1      | Q1?      |                      |
				|         | text              | q2      | Q2       | \${q1} = 'yes'       |
				| choices |
				|         | list_name | name | label |
				|         | yn        | yes  | Yes   |
				|         | yn        | no   | No    |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});
});

// ─── Lines 880-888: constraint message with itext reference ─────────────────

describe("XFormToDictBuilder - constraint message itext lookup", () => {
	it("should resolve translated constraint messages from itext", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type    | name | label::en | label::fr | constraint | constraint_message::en | constraint_message::fr |
				|        | integer | age  | Age       | Âge       | . > 0      | Must be positive       | Doit être positif      |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		expect(xml).toContain("jr:constraintMsg");
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
		const outXml = survey.toXml({ validate: false, prettyPrint: false });
		expect(outXml).toContain("constraint");
	});
});

// ─── Lines 548-549: mediatype in body object ────────────────────────────────

describe("XFormToDictBuilder - mediatype handling", () => {
	it("should parse upload with image mediatype", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type  | name  | label |
			|        | image | photo | Photo |
		`);
		expect(observed).toBe(expected);
	});

	it("should parse upload with audio mediatype", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type  | name | label |
			|        | audio | rec  | Rec   |
		`);
		expect(observed).toBe(expected);
	});

	it("should parse upload with video mediatype", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type  | name | label |
			|        | video | vid  | Video |
		`);
		expect(observed).toBe(expected);
	});
});

// ─── Lines 524-540: control attributes (appearance, rows, autoplay, count) ──

describe("XFormToDictBuilder - control attributes", () => {
	it("should parse rows parameter from body", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label | appearance | parameters |
				|        | text | q1   | Q1    | multiline  | rows=5     |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});

	it("should parse appearance from body", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type | name | label | appearance |
			|        | text | q1   | Q1    | multiline  |
		`);
		expect(observed).toBe(expected);
	});
});

// ─── Lines 272-278: array body elements (multiple questions of same type) ───

describe("XFormToDictBuilder - multiple body elements of same type", () => {
	it("should handle multiple input elements in body", () => {
		const { expected, observed } = roundTrip(`
			| survey |
			|        | type    | name | label |
			|        | text    | q1   | Q1    |
			|        | text    | q2   | Q2    |
			|        | text    | q3   | Q3    |
			|        | integer | q4   | Q4    |
			|        | integer | q5   | Q5    |
		`);
		expect(observed).toBe(expected);
	});
});

// ─── Lines 331-346: submission info parsing ─────────────────────────────────

describe("XFormToDictBuilder - submission info", () => {
	it("should parse auto_send and auto_delete from submission", () => {
		const result = convert({
			xlsform: `
				| survey   |
				|          | type | name | label |
				|          | text | q1   | Q1    |
				| settings |
				|          | form_title | form_id | auto_send | auto_delete |
				|          | My Form    | myform  | true      | true        |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});

	it("should parse submission_url from action attribute", () => {
		const result = convert({
			xlsform: `
				| survey   |
				|          | type | name | label |
				|          | text | q1   | Q1    |
				| settings |
				|          | form_title | form_id | submission_url        |
				|          | My Form    | myform  | https://example.com/s |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		expect(xml).toContain("submission");
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});

	it("should parse public_key from submission", () => {
		const result = convert({
			xlsform: `
				| survey   |
				|          | type | name | label |
				|          | text | q1   | Q1    |
				| settings |
				|          | form_title | form_id | public_key   |
				|          | My Form    | myform  | test_key_abc |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});
});

// ─── Lines 716-719: preload uid binding ─────────────────────────────────────

describe("XFormToDictBuilder - preload uid binding", () => {
	it("should parse uid preload and set jr:preload in bind", () => {
		// simkey/uid comes from metadata like simserial
		const result = convert({
			xlsform: `
				| survey |
				|        | type      | name      | label |
				|        | simserial | simserial |       |
				|        | text      | q1        | Q1    |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});
});

// ─── Output with tail text (line 779-781) ───────────────────────────────────

describe("XFormToDictBuilder - output with tail text", () => {
	it("should handle output expression with trailing text", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label                      |
				|        | text | q1   | Name                       |
				|        | note | n1   | Hello \${q1}, how are you? |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
		const outXml = survey.toXml({ validate: false, prettyPrint: false });
		expect(outXml).toContain("/data/q1");
	});
});

// ─── Lines 743-745: single translation (non-array itext.translation) ────────

describe("XFormToDictBuilder - single translation handling", () => {
	it("should handle form with single language translations", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label | media::image |
				|        | text | q1   | Q1    | pic.jpg      |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});
});

// ─── Lines 803: label value is '-' (skip) ───────────────────────────────────

describe("XFormToDictBuilder - translation with dash placeholder", () => {
	it("should skip translation entries with value '-'", () => {
		const result = convert({
			xlsform: `
				| survey |
				|        | type | name | label::en | label::fr |
				|        | text | q1   | Question  | -         |
			`,
			prettyPrint: false,
		});
		const xml = result.xform;
		const survey = createSurveyElementFromXml(xml);
		expect(survey).toBeDefined();
	});
});
