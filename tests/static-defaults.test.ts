/**
 * Port of test_static_defaults.py - Static default value tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("StaticDefaultTests", () => {
	it("test_static_defaults", () => {
		assertPyxformXform({
			name: "static",
			md: `
				| survey |              |          |       |                   |
				|        | type         | name     | label | default           |
				|        | integer      | numba    | Foo   | foo               |
				|        | begin repeat | repeat   |       |                   |
				|        | integer      | bar      | Bar   | 12                |
				|        | end repeat   | repeat   |       |                   |
			`,
			model__contains: ["<numba>foo</numba>", "<bar>12</bar>"],
			model__excludes: ["setvalue", "<numba />"],
		});
	});

	it("test_static_image_defaults", () => {
		assertPyxformXform({
			name: "static_image",
			md: `
				| survey |        |          |       |                |                        |
				|        | type   | name     | label | parameters     | default                |
				|        | image  | my_image | Image | max-pixels=640 | my_default_image.jpg   |
				|        | text   | my_descr | descr |                | no description provied |
			`,
			xml__contains: [
				// image needed NS (xmlns is on the html root, not in model section)
				'xmlns:orx="http://openrosa.org/xforms"',
			],
			model__contains: [
				'<bind nodeset="/static_image/my_image" type="binary" orx:max-pixels="640"/>',
				// image default appears
				"<my_image>jr://images/my_default_image.jpg</my_image>",
				// other defaults appear
				"<my_descr>no description provied</my_descr>",
			],
			model__excludes: [
				"setvalue",
				"<my_image></my_image>",
				"<my_descr></my_descr>",
			],
		});
	});
});
