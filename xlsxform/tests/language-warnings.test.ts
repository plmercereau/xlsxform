/**
 * Port of test_language_warnings.py
 * Test language warnings.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("LanguageWarningTest", () => {
	it("test_label_with_valid_subtag_should_not_warn", () => {
		assertPyxformXform({
			md: `
			| survey |
			|        | type | name    | label::English (en) | label::Acoli (ach) |
			|        | note | my_note | My note             | coc na             |
			`,
			warnings_count: 0,
		});
	});

	it("test_label_with_no_subtag_should_warn", () => {
		assertPyxformXform({
			md: `
			| survey |      |         |                     |
			|        | type | name    | label::English      |
			|        | note | my_note | My note             |
			`,
			warnings_count: 1,
			warnings__contains: [
				"The following language declarations do not contain valid machine-readable " +
					"codes: English. Learn more: http://xlsform.org#multiple-language-support",
			],
		});
	});

	it("test_label_with_unknown_subtag_should_warn", () => {
		assertPyxformXform({
			md: `
			| survey |      |         |                       |
			|        | type | name    | label::English (schm) | label::Bosnian (bos) |
			|        | note | my_note | My note               | Moja napomena        |
			`,
			warnings_count: 1,
			warnings__contains: [
				"The following language declarations do not contain valid machine-readable " +
					"codes: English (schm), Bosnian (bos). Learn more: http://xlsform.org#multiple-language-support",
			],
		});
	});

	it("test_default_language_only_should_not_warn", () => {
		assertPyxformXform({
			md: `
			| survey |                 |         |        |               |
			|        | type            | name    | label  | choice_filter |
			|        | select_one opts | opt     | My opt | fake = 1      |
			| choices|                 |         |        |               |
			|        | list_name       | name    | label  | fake          |
			|        | opts            | opt1    | Opt1   | 1             |
			|        | opts            | opt2    | Opt2   | 1             |
			`,
			warnings_count: 0,
		});
	});
});
