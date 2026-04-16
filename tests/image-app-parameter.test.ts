import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestImageParameters", () => {
	it("test_adding_valid_android_package_name_in_image_with_supported_appearances", () => {
		const appearances = ["", "annotate"];
		const md = `
		| survey |        |          |       |                                     |            |
		|        | type   | name     | label | parameters                          | appearance |
		|        | image  | my_image | Image | app=com.jeyluta.timestampcamerafree | {case}     |
		`;
		for (const case_ of appearances) {
			assertPyxformXform({
				name: "data",
				md: md.replace("{case}", case_),
				xml__xpath_match: [
					"/h:html/h:body/x:upload[@intent='com.jeyluta.timestampcamerafree' and @mediatype='image/*' and @ref='/data/my_image']",
				],
			});
		}
	});

	it("test_throwing_error_when_invalid_android_package_name_is_used_with_supported_appearances", () => {
		const appearances = ["", "annotate"];
		const parameters = ["app=something", "app=_"];
		const md = `
		| survey |        |          |       |              |              |
		|        | type   | name     | label | parameters   | appearance   |
		|        | image  | my_image | Image | {parameter}  | {appearance} |
		`;
		for (const appearance of appearances) {
			for (const parameter of parameters) {
				assertPyxformXform({
					name: "data",
					errored: true,
					error__contains: [
						"[row : 2] Parameter 'app' has an invalid Android package name - the package name must have at least one '.' separator.",
					],
					md: md.replace("{parameter}", parameter).replace("{appearance}", appearance),
					xml__xpath_match: [
						"/h:html/h:body/x:upload[not(@intent) and @mediatype='image/*' and @ref='/data/my_image']",
					],
				});
			}
		}
	});

	it("test_throwing_error_when_blank_android_package_name_is_used_with_supported_appearances", () => {
		const appearances = ["", "annotate"];
		const parameters = ["app=", "app= "];
		const md = `
		| survey |        |          |       |              |              |
		|        | type   | name     | label | parameters   | appearance   |
		|        | image  | my_image | Image | {parameter}  | {appearance} |
		`;
		for (const appearance of appearances) {
			for (const parameter of parameters) {
				assertPyxformXform({
					name: "data",
					errored: true,
					error__contains: [
						"[row : 2] Parameter 'app' has an invalid Android package name - package name is missing.",
					],
					md: md.replace("{parameter}", parameter).replace("{appearance}", appearance),
					xml__xpath_match: [
						"/h:html/h:body/x:upload[not(@intent) and @mediatype='image/*' and @ref='/data/my_image']",
					],
				});
			}
		}
	});

	it("test_ignoring_invalid_android_package_name_with_not_supported_appearances", () => {
		const appearances = ["signature", "draw", "new-front"];
		const md = `
		| survey |        |          |       |                 |            |
		|        | type   | name     | label | parameters      | appearance |
		|        | image  | my_image | Image | app=something   | {case}     |
		`;
		for (const case_ of appearances) {
			assertPyxformXform({
				name: "data",
				md: md.replace("{case}", case_),
				xml__xpath_match: [
					`/h:html/h:body/x:upload[not(@intent) and @mediatype='image/*' and @ref='/data/my_image' and @appearance='${case_}']`,
				],
			});
		}
	});

	it("test_ignoring_android_package_name_in_image_with_not_supported_appearances", () => {
		const appearances = ["signature", "draw", "new-front"];
		const md = `
		| survey |        |          |       |                                     |            |
		|        | type   | name     | label | parameters                          | appearance |
		|        | image  | my_image | Image | app=com.jeyluta.timestampcamerafree | {case}     |
		`;
		for (const case_ of appearances) {
			assertPyxformXform({
				name: "data",
				md: md.replace("{case}", case_),
				xml__xpath_match: [
					`/h:html/h:body/x:upload[not(@intent) and @mediatype='image/*' and @ref='/data/my_image' and @appearance='${case_}']`,
				],
			});
		}
	});

	it("test_integer_max_pixels", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |        |          |       |                |
			|        | type   | name     | label | parameters     |
			|        | image  | my_image | Image | max-pixels=640 |
			`,
			xml__contains: [
				'xmlns:orx="http://openrosa.org/xforms"',
				'<bind nodeset="/data/my_image" type="binary" orx:max-pixels="640"/>',
			],
		});
	});

	it("test_string_max_pixels", () => {
		assertPyxformXform({
			name: "data",
			errored: true,
			md: `
			| survey |        |          |       |                |
			|        | type   | name     | label | parameters     |
			|        | image  | my_image | Image | max-pixels=foo |
			`,
			error__contains: ["Parameter max-pixels must have an integer value."],
		});
	});

	it("test_string_extra_params", () => {
		assertPyxformXform({
			name: "data",
			errored: true,
			md: `
			| survey |        |          |       |                        |
			|        | type   | name     | label | parameters             |
			|        | image  | my_image | Image | max-pixels=640 foo=bar |
			`,
			error__contains: [
				"Accepted parameters are 'app, max-pixels'. The following are invalid parameter(s): 'foo'.",
			],
		});
	});

	it("test_image_with_no_max_pixels_should_warn", () => {
		assertPyxformXform({
			md: `
			| survey |       |            |         |
			|        | type  | name       | label   |
			|        | image | my_image   | Image   |
			|        | image | my_image_1 | Image 1 |
			`,
			warnings_count: 2,
			warnings__contains: [
				"[row : 2] Use the max-pixels parameter to speed up submission sending and save storage space. Learn more: https://xlsform.org/#image",
				"[row : 3] Use the max-pixels parameter to speed up submission sending and save storage space. Learn more: https://xlsform.org/#image",
			],
		});
	});

	it("test_max_pixels_and_app", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |        |          |       |                                                    |
			|        | type   | name     | label | parameters                                         |
			|        | image  | my_image | Image | max-pixels=640 app=com.jeyluta.timestampcamerafree |
			`,
			xml__contains: [
				'xmlns:orx="http://openrosa.org/xforms"',
				'<bind nodeset="/data/my_image" type="binary" orx:max-pixels="640"/>',
			],
			xml__xpath_match: [
				"/h:html/h:body/x:upload[@intent='com.jeyluta.timestampcamerafree' and @mediatype='image/*' and @ref='/data/my_image']",
			],
		});
	});
});
