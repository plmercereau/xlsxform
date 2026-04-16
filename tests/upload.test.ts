/**
 * Port of test_upload_question.py - Upload (image, audio, file) question tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("UploadTest", () => {
	it("test_image_question", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |      |         |       |
				|        | type | name    | label |
				|        | image | photo | Take a photo: |
			`,
			xml__contains: [
				'<bind nodeset="/data/photo" type="binary"/>',
				'<upload mediatype="image/*" ref="/data/photo">',
				"<label>Take a photo:</label>",
				"</upload>",
			],
		});
	});

	it("test_audio_question", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |      |         |       |
				|        | type | name    | label |
				|        | audio | recording1 | Record a sound: |
			`,
			xml__contains: [
				'<bind nodeset="/data/recording1" type="binary"/>',
				'<upload mediatype="audio/*" ref="/data/recording1">',
				"<label>Record a sound:</label>",
				"</upload>",
			],
		});
	});

	it("test_file_question", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |      |         |       |
				|        | type | name    | label |
				|        | file | file1 | Upload a file: |
			`,
			xml__contains: [
				'<bind nodeset="/data/file1" type="binary"/>',
				'<upload mediatype="application/*" ref="/data/file1">',
				"<label>Upload a file:</label>",
				"</upload>",
			],
		});
	});

	it("test_file_question_restrict_filetype", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |      |         |       |       |
				|        | type | name    | label | body::accept |
				|        | file | upload_a_pdf | Upload a PDF: | application/pdf |
			`,
			xml__contains: ['<upload accept="application/pdf"'],
		});
	});

	it("test_image_question_custom_col_calc", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |       |                  |                 |                               |
				|        | type  | name             | label           | body:esri:style               |
				|        | text  | watermark_phrase | Watermark Text: |                               |
				|        | text  | text1            | Text            |                               |
				|        | image | image1           | Take a Photo:   | watermark=\${watermark_phrase} |
			`,
			errored: false,
			xml__contains: ["watermark= /data/watermark_phrase "],
		});
	});
});
