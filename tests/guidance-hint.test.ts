/**
 * Port of test_guidance_hint.py - Guidance hint tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("GuidanceHintTest", () => {
	it("should output a hint element for hint only column", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |        |          |       |           |
				|        | type   |   name   | label | hint      |
				|        | string |   name   | Name  | your name |
			`,
			xml__contains: ["<hint>your name</hint>"],
		});
	});

	it("should output itext hint ref for guidance_hint and label", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |        |          |       |                              |
				|        | type   |   name   | label | guidance_hint                |
				|        | string |   name   | Name  | as shown on birth certificate|
			`,
			xml__contains: [
				"<hint ref=\"jr:itext('/data/name:hint')\"/>",
				'<value form="guidance">as shown on birth certificate</value>',
				"<hint ref=\"jr:itext('/data/name:hint')\"/>",
			],
		});
	});

	it("should output hint and guidance hint with itext in one language", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |        |          |       |           |                              |
				|        | type   |   name   | label | hint      | guidance_hint                |
				|        | string |   name   | Name  | your name | as shown on birth certificate|
			`,
			xml__contains: [
				"<hint ref=\"jr:itext('/data/name:hint')\"/>",
				"<value>your name</value>",
				'<value form="guidance">as shown on birth certificate</value>',
			],
		});
	});

	it("should output multi language guidance hint", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |        |          |       |           |                              |                                     |
				|        | type   |   name   | label | hint      | guidance_hint                | guidance_hint::French (fr)          |
				|        | string |   name   | Name  | your name | as shown on birth certificate| comme sur le certificat de naissance|
			`,
			xml__contains: [
				'<translation lang="French (fr)">',
				'<value form="guidance">comme sur le certificat de naissance</value>',
				'<translation default="true()" lang="default">',
				'<value form="guidance">as shown on birth certificate</value>',
				"<hint ref=\"jr:itext('/data/name:hint')\"/>",
			],
		});
	});

	it("should error when guidance_hint only without label or hint", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |        |      |                               |
				|        | type   | name | guidance_hint                 |
				|        | string | name | as shown on birth certificate |
			`,
			errored: true,
			error__contains: ["The survey element named 'name' has no label or hint."],
		});
	});

	it("should error when multi language guidance only without label or hint", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |        |      |                              |                                      |
				|        | type   | name | guidance_hint                | guidance_hint::French (fr)           |
				|        | string | name | as shown on birth certificate| comme sur le certificat de naissance |
			`,
			errored: true,
			error__contains: ["The survey element named 'name' has no label or hint."],
		});
	});

	it("should output multi language hint with itext", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |        |          |                      |                    |
				|        | type   |   name   | hint                 | hint::French (fr)  |
				|        | string |   name   | default language hint| French hint        |
			`,
			xml__contains: [
				"<hint ref=\"jr:itext('/data/name:hint')\"/>",
				"<value>French hint</value>",
				"<value>default language hint</value>",
			],
		});
	});
});
