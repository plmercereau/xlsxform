/**
 * Port of test_xform2json.py - Test xform2json module.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	IOError,
	XMLParseError,
	_tryParse,
	createSurveyElementFromXml,
} from "../src/conversion/xform2json.js";
import { createSurveyElementFromDict } from "../src/model/builder.js";
import { Survey } from "../src/model/survey.js";
import { tryParseFromFile } from "./helpers/xform2json-node.js";
import { convert } from "./helpers/xls2xform-node.js";

describe("TestXMLParse", () => {
	const xml = `<?xml version="1.0"?>\n<a><b>1</b></a>`;
	let tidyFile: string | null = null;
	const testOutputDir = os.tmpdir();

	afterEach(() => {
		if (tidyFile !== null) {
			try {
				fs.unlinkSync(tidyFile);
			} catch (_e) {
				// ignore
			}
			tidyFile = null;
		}
	});

	it("test_try_parse_with_string", () => {
		/** Should return root node from XML string. */
		const root = _tryParse(xml);
		expect(root.nodeName).toBe("a");
	});

	it("test_try_parse_with_path", () => {
		/** Should return root node from XML file path using tryParseFromFile. */
		const xmlPath = path.join(testOutputDir, "test_try_parse.xml");
		tidyFile = xmlPath;
		fs.writeFileSync(xmlPath, xml, "utf-8");
		const root = tryParseFromFile(xmlPath);
		expect(root.nodeName).toBe("a");
	});

	it("test_try_parse_with_bad_path", () => {
		/** Should raise IOError: file doesn't exist. */
		const xmlPath = path.join(testOutputDir, "not_a_real_file.xyz");
		expect(() => tryParseFromFile(xmlPath)).toThrow(IOError);
	});

	it("test_try_parse_with_bad_string", () => {
		/** Should raise IOError: string parse failed and its not a path. */
		expect(() => _tryParse("not valid xml :(")).toThrow(IOError);
	});

	it("test_try_parse_with_bad_file", () => {
		/** Should raise XMLParseError: file exists but content is not valid. */
		const xmlPath = path.join(testOutputDir, "test_try_parse_bad.xml");
		tidyFile = xmlPath;
		fs.writeFileSync(xmlPath, "not valid xml :(", "utf-8");
		expect(() => tryParseFromFile(xmlPath)).toThrow(XMLParseError);
	});
});

describe("TestXForm2JSON", () => {
	it("test_convert_toJSON_multi_language", () => {
		/**
		 * Test that it's possible to convert XLSForms with multiple languages
		 * to JSON and back into XML without losing any of the required information.
		 */
		const md = `
        | survey  |
        |         | type                   | name  | label:Eng  | label:Fr |
        |         | text                   | name  | Name       | Prénom   |
        |         | select_multiple fruits | fruit | Fruit      | Fruit    |
        |         |                        |       |            |          |
        | choices | list name              | name  | label:Eng  | label:Fr |
        |         | fruits                 | 1     | Mango      | Mangue   |
        |         | fruits                 | 2     | Orange     | Orange   |
        |         | fruits                 | 3     | Apple      | Pomme    |
        `;
		const result = convert({ xlsform: md, prettyPrint: false });
		const expected = result.xform;
		const survey = result._survey as NonNullable<typeof result._survey>;
		const generatedJson = JSON.stringify(survey.toJsonDict());
		const surveyFromBuilder = createSurveyElementFromDict(
			JSON.parse(generatedJson),
		);
		expect(surveyFromBuilder).toBeInstanceOf(Survey);
		const observed = (surveyFromBuilder as Survey).toXml({
			prettyPrint: false,
		});
		expect(observed).toBe(expected);
	});
});

describe("DumpAndLoadXForm2JsonTests", () => {
	it("test_load_from_dump - requires internal API (create_survey_from_path, create_survey_element_from_xml, assertXFormEqual)", () => {
		// This test requires loading XLS files via create_survey_from_path, which depends
		// on file-based survey loading that is not yet ported. The test verifies round-tripping:
		// dict -> Survey -> XML -> Survey -> compare XML outputs.
		// We test a simplified version using the convert() API with a markdown form.
		const md = `
        | survey |
        |        | type   | name    | label          |
        |        | text   | q1      | Question 1     |
        |        | integer| q2      | Question 2     |
        `;
		const result = convert({ xlsform: md, prettyPrint: false });
		const expected = result.xform;
		const surveyFromDump = createSurveyElementFromXml(expected);
		const observed = surveyFromDump.toXml({
			validate: false,
			prettyPrint: false,
		});
		expect(observed).toBe(expected);
	});
});
