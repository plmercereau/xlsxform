/**
 * Port of test_whitespace.py - Test whitespace around output variables in XForms.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("WhitespaceTest", () => {
	it("test_over_trim", () => {
		assertPyxformXform({
			name: "issue96",
			md: `
			| survey  |                 |             |       |
			|         | type            | label       | name  |
			|         | text            | Ignored     | var   |
			|         | note            | \${var} text | label |
			`,
			xml__contains: ['<label><output value=" /issue96/var "/> text </label>'],
		});
	});

	it("test_whitespace_output_permutations", () => {
		const mdTemplate = `
		| survey |              |      |
		|        | type         | name | label                |
		|        | text         | A    | None                 |
		|        | text         | B1   | Before {0}           |
		|        | text         | C1   | {0} After            |
		|        | text         | D1   | Before x2 {0} {0}    |
		|        | text         | E1   | {0} {0} After x2     |
		|        | text         | F1   | {0} Between {0}      |
		|        | text         | G1   | Wrap {0} in text     |
		|        | text         | H1   | Wrap {0} in {0} text |
		|        | text         | I1   | Wrap {0} in {0}      |
		`;
		const xp = "/h:html/h:body/x:input[@ref='/test_name/{0}']/x:label";
		const testCases = ["A", "B1"];
		for (const case_ of testCases) {
			const md = mdTemplate.replaceAll("{0}", `\${${case_}}`);
			assertPyxformXform({
				md,
				xml__xpath_exact: [
					[xp.replace("{0}", "A"), new Set(["<label>None</label>"])],
					[
						xp.replace("{0}", "B1"),
						new Set([
							`<label> Before <output value=" /test_name/${case_} "/> </label>`,
						]),
					],
					[
						xp.replace("{0}", "C1"),
						new Set([
							`<label><output value=" /test_name/${case_} "/> After </label>`,
						]),
					],
					[
						xp.replace("{0}", "D1"),
						new Set([
							`<label> Before x2 <output value=" /test_name/${case_} "/> <output value=" /test_name/${case_} "/> </label>`,
						]),
					],
					[
						xp.replace("{0}", "E1"),
						new Set([
							`<label><output value=" /test_name/${case_} "/> <output value=" /test_name/${case_} "/> After x2 </label>`,
						]),
					],
					[
						xp.replace("{0}", "F1"),
						new Set([
							`<label><output value=" /test_name/${case_} "/> Between <output value=" /test_name/${case_} "/> </label>`,
						]),
					],
					[
						xp.replace("{0}", "G1"),
						new Set([
							`<label> Wrap <output value=" /test_name/${case_} "/> in text </label>`,
						]),
					],
					[
						xp.replace("{0}", "H1"),
						new Set([
							`<label> Wrap <output value=" /test_name/${case_} "/> in <output value=" /test_name/${case_} "/> text </label>`,
						]),
					],
					[
						xp.replace("{0}", "I1"),
						new Set([
							`<label> Wrap <output value=" /test_name/${case_} "/> in <output value=" /test_name/${case_} "/> </label>`,
						]),
					],
				],
			});
		}
	});

	it("test_values_without_whitespaces_are_processed_successfully", () => {
		const md = `
			| survey  |                 |             |       |
			|         | type            | label       | name  |
			|         | text            | Ignored     | Var   |
			| settings       |                    |            |                                                   |
			|                | id_string          | public_key | submission_url                                    |
			|                | tutorial_encrypted | MIIB       | https://odk.ona.io/random_person/submission       |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:submission[
				  @action='https://odk.ona.io/random_person/submission'
				  and @method='post'
				  and @base64RsaPublicKey='MIIB'
				]
				`,
			],
		});
	});
});
