/**
 * Port of test_xlsform_spec.py
 * Test XLSForm spec warnings and unknown control groups.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestWarnings", () => {
	it("test_warnings__count", () => {
		assertPyxformXform({
			md: `
			| survey   |                        |                         |                           |         |                    |              |       |       |
			|          | type                   | name                    | label                     | hint    | appearance         | image        | audio | video |
			|          | text                   | some_text               |                           | a hint  |                    |              |       |       |
			|          | note                   | number_label            |                           | a note  |                    |              |       |       |
			|          | note                   | display_image_test      |                           |         |                    | img_test.jpg |       |       |
			|          | select_one yes_no      | autocomplete_test       | autocomplete_test         |         | autocomplete       |              |       |       |
			|          | select_one yes_no      | autocomplete_chars_test | autocomplete_chars_test   |         | autocomplete_chars |              |       |       |
			|          | integer                | a_integer               |                           | integer |                    |              |       |       |
			|          | decimal                | a_decimal               |                           | decimal |                    |              |       |       |
			|          | begin repeat           | repeat_test             |                           |         |                    |              |       |       |
			|          | begin group            | group_test              |                           |         |                    |              |       |       |
			|          | text                   | required_text           | required_text             |         |                    |              |       |       |
			|          | select_multiple yes_no | select_multiple_test    | select multiple test      |         | minimal            |              |       |       |
			|          | end group              | adsaf                   |                           |         |                    |              |       |       |
			|          | begin group            | labeled_select_group    | labeled select group test |         | field-list         |              |       |       |
			|          | text                   | inside                  | Inside                    |         |
			|          | end group              |                         |                           |         |                    |              |       |       |
			|          | begin group            | name                    |                           |         | table-list         |              |       |       |
			|          | select_one yes_no      | table_list_question     | table list question       | hint    |                    |              |       |       |
			|          | end group              |                         |                           |         |                    |              |       |       |
			|          | select_one a_b         | compact-test            |                           | hint    | compact            |              |       |       |
			|          | end repeat             |                         |                           |         |                    |              |       |       |
			|          | acknowledge            | acknowledge_test        |                           | hint    |                    |              |       |       |
			|          | date                   | date_test               |                           | hint    |                    |              |       |       |
			|          | time                   | time_test               |                           | hint    |                    |              |       |       |
			|          | datetime               | datetime_test           |                           | hint    |                    |              |       |       |
			|          | geopoint               | geopoint_test           |                           | hint    |                    |              |       |       |
			|          | barcode                | barcode_test            |                           | hint    |                    |              |       |       |
			|          | image                  | image_test              |                           | hint    |                    |              |       |       |
			|          | audio                  | audio_test              |                           | hint    |                    |              |       |       |
			|          | video                  | video_test              |                           | hint    |                    |              |       |       |
			|          | start                  | start                   |                           |         |                    |              |       |       |
			|          | end                    | end                     |                           |         |                    |              |       |       |
			|          | today                  | today                   |                           |         |                    |              |       |       |
			|          | deviceid               | deviceid                |                           |         |                    |              |       |       |
			|          | phonenumber            | phonenumber             |                           |         |                    |              |       |       |
			| choices  |           |         |       |       |
			|          | list_name | name    | label | image |
			|          | yes_no    | yes     | yes   |       |
			|          | yes_no    | no      | no    |       |
			|          | a_b       | a       |       | a.jpg |
			|          | a_b       | b       |       | b.jpg |
			|          | animals   | zebra   |       |       |
			|          | animals   | buffalo |       |       |
			| settings |            |           |            |                |                  |
			|          | form_title | form_id   | public_key | submission_url | default_language |
			|          | spec_test  | spec_test |            |                |                  |
			`,
			warnings__contains: [
				"[row : 4] On the 'choices' sheet, the 'label' value is invalid. Choices should have a label. Learn more: https://xlsform.org/en/#setting-up-your-worksheets",
				"[row : 5] On the 'choices' sheet, the 'label' value is invalid. Choices should have a label. Learn more: https://xlsform.org/en/#setting-up-your-worksheets",
				"[row : 6] On the 'choices' sheet, the 'label' value is invalid. Choices should have a label. Learn more: https://xlsform.org/en/#setting-up-your-worksheets",
				"[row : 7] On the 'choices' sheet, the 'label' value is invalid. Choices should have a label. Learn more: https://xlsform.org/en/#setting-up-your-worksheets",
				"[row : 9] Repeat has no label: {'name': 'repeat_test', 'type': 'begin repeat'}",
				"[row : 28] Use the max-pixels parameter to speed up submission sending and save storage space. Learn more: https://xlsform.org/#image",
			],
			warnings_count: 6,
		});
	});

	it("test_warnings__unknown_control_group__with_name", () => {
		assertPyxformXform({
			name: "spec_test",
			md: `
			| survey   |               |         |
			|          | type          | name    |
			|          | begin dancing | dancing |
			`,
			errored: true,
			error__contains: ["Unknown question type 'begin dancing'."],
		});
	});

	it("test_warnings__unknown_control_group__no_name", () => {
		assertPyxformXform({
			name: "spec_test",
			md: `
			| survey   |               |         |
			|          | type          | name    |
			|          | begin         | empty   |
			`,
			errored: true,
			error__contains: ["Unknown question type 'begin'."],
		});
	});
});
