/**
 * Port of test_trigger.py - Test handling setvalue of 'trigger' column in forms
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TriggerSetvalueTests", () => {
	it("should error when trigger references a nonexistent node", () => {
		assertPyxformXform({
			name: "trigger-missing-ref",
			md: `
				| survey |          |      |             |             |         |
				|        | type     | name | label       | calculation | trigger |
				|        | dateTime | b    |             | now()       | \${a}   |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'trigger' value is invalid. Reference variables must contain a name from the 'survey' sheet. Could not find the name 'a'.",
			],
		});
	});

	it("should error when trigger has something other than a node ref", () => {
		assertPyxformXform({
			name: "trigger-invalid-ref",
			md: `
				| survey |          |      |             |             |         |
				|        | type     | name | label       | calculation | trigger |
				|        | dateTime | b    |             | now()       | 6       |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'trigger' value is invalid. Reference variables must start with '\${', then a question name, and end with '}'.",
			],
		});
	});

	it("should handle trigger column with no label and no hint", () => {
		assertPyxformXform({
			name: "trigger-column",
			md: `
				| survey |          |      |             |             |         |
				|        | type     | name | label       | calculation | trigger |
				|        | text     | a    | Enter text  |             |         |
				|        | dateTime | b    |             | now()       | \${a}   |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:trigger-column/x:a",
				"/h:html/h:head/x:model/x:instance/x:trigger-column/x:b",
				"/h:html/h:head/x:model/x:bind[@nodeset='/trigger-column/b' and @type='dateTime']",
				"/h:html/h:body/x:input[@ref='/trigger-column/a']",
				"/h:html/h:body/x:input[@ref='/trigger-column/a']/x:setvalue[@event='xforms-value-changed' and @ref='/trigger-column/b'  and @value='now()']",
				"/h:html[not(descendant::x:bind[@nodeset='/trigger-column/b'  and @type='dateTime' and @calculate='now()'])]",
				"/h:html[not(descendant::x:input[@ref='/trigger-column/b'])]",
			],
		});
	});

	it("should handle trigger column with label and hint", () => {
		assertPyxformXform({
			name: "trigger-column",
			md: `
				| survey |          |      |                    |             |         |
				|        | type     | name | label              | calculation | trigger |
				|        | text     | a    | Enter text         |             |         |
				|        | dateTime | c    | Date of diagnostic | now()       | \${a}   |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:trigger-column/x:a",
				"/h:html/h:head/x:model/x:instance/x:trigger-column/x:c",
				"/h:html/h:head/x:model/x:bind[@nodeset='/trigger-column/c' and @type='dateTime']",
				"/h:html/h:body/x:input[@ref='/trigger-column/a']",
				"/h:html/h:body/x:input[@ref='/trigger-column/c']",
				"/h:html/h:body/x:input[@ref='/trigger-column/a']/x:setvalue[@event='xforms-value-changed' and @ref='/trigger-column/c'  and @value='now()']",
				"/h:html[not(descendant::x:bind[@nodeset='/trigger-column/c'  and @type='dateTime' and @calculate='now()'])]",
			],
		});
	});

	it("should handle multiple trigger columns", () => {
		assertPyxformXform({
			name: "trigger-column",
			md: `
				| survey |          |      |            |             |         |        |
				|        | type     | name | label      | calculation | trigger | hint   |
				|        | text     | a    | Enter text |             |         |        |
				|        | integer  | b    |            | 1+1         | \${a}   |        |
				|        | dateTime | c    |            | now()       | \${a}   | A hint |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:trigger-column/x:a",
				"/h:html/h:head/x:model/x:instance/x:trigger-column/x:b",
				"/h:html/h:head/x:model/x:instance/x:trigger-column/x:c",
				"/h:html/h:head/x:model/x:bind[@nodeset='/trigger-column/b' and @type='int']",
				"/h:html/h:head/x:model/x:bind[@nodeset='/trigger-column/c' and @type='dateTime']",
				"/h:html/h:body/x:input[@ref='/trigger-column/a']",
				"/h:html/h:body/x:input[@ref='/trigger-column/c']",
				"/h:html/h:body/x:input[@ref='/trigger-column/a']/x:setvalue[@event='xforms-value-changed' and @ref='/trigger-column/b'  and @value='1+1']",
				"/h:html/h:body/x:input[@ref='/trigger-column/a']/x:setvalue[@event='xforms-value-changed' and @ref='/trigger-column/c'  and @value='now()']",
				"/h:html[not(descendant::x:bind[@nodeset='/trigger-column/b'  and @type='int' and @calculate='1+1'])]",
				"/h:html[not(descendant::x:bind[@nodeset='/trigger-column/c'  and @type='dateTime' and @calculate='now()'])]",
			],
		});
	});

	it("should handle trigger column with no calculation", () => {
		assertPyxformXform({
			name: "trigger-column",
			md: `
				| survey |          |      |                    |             |         |
				|        | type     | name | label              | calculation | trigger |
				|        | text     | a    | Enter text         |             |         |
				|        | dateTime | d    | Date of something  |             | \${a}   |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:trigger-column/x:a",
				"/h:html/h:head/x:model/x:instance/x:trigger-column/x:d",
				"/h:html/h:head/x:model/x:bind[@nodeset='/trigger-column/d' and @type='dateTime']",
				"/h:html/h:body/x:input[@ref='/trigger-column/a']",
				"/h:html/h:body/x:input[@ref='/trigger-column/d']",
				"/h:html/h:body/x:input[@ref='/trigger-column/a']/x:setvalue[@event='xforms-value-changed' and @ref='/trigger-column/d'  and not(@value)]",
				"/h:html[not(descendant::x:bind[@nodeset='/trigger-column/d'  and @type='dateTime' and @calculate=''])]",
			],
		});
	});

	it("should handle trigger column with no calculation no label no hint", () => {
		assertPyxformXform({
			name: "trigger-column",
			md: `
				| survey |          |      |            |             |         |
				|        | type     | name | label      | calculation | trigger |
				|        | text     | a    | Enter text |             |         |
				|        | decimal  | e    |            |             | \${a}   |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:trigger-column/x:a",
				"/h:html/h:head/x:model/x:instance/x:trigger-column/x:e",
				"/h:html/h:head/x:model/x:bind[@nodeset='/trigger-column/e' and @type='decimal']",
				"/h:html/h:body/x:input[@ref='/trigger-column/a']",
				"/h:html/h:body/x:input[@ref='/trigger-column/a']/x:setvalue[@event='xforms-value-changed' and @ref='/trigger-column/e'  and not(@value)]",
				"/h:html[not(descendant::x:bind[@nodeset='/trigger-column/e'  and @type='decimal' and @calculate=''])]",
				"/h:html[not(descendant::x:input[@ref='/trigger-column/e'])]",
			],
		});
	});

	it("should error when trigger refers to a hidden node ref", () => {
		assertPyxformXform({
			name: "trigger-invalid-ref",
			md: `
				| survey |           |        |                         |         |             |
				|        | type      | name   | label                   | trigger | calculation |
				|        | calculate | one    |                         |         | 5 + 4       |
				|        | calculate | one-ts |                         | \${one} | now()       |
				|        | note      | note   | timestamp: \${one-ts}   |         |             |
			`,
			errored: true,
			error__contains: [
				"The question \${one} is not user-visible so it can't be used as a calculation trigger for question \${one-ts}.",
			],
		});
	});

	it("should error when trigger refers to calculate with label", () => {
		assertPyxformXform({
			name: "trigger-invalid-ref",
			md: `
				| survey |           |        |                         |         |             |
				|        | type      | name   | label                   | trigger | calculation |
				|        | calculate | one    | A label                 |         | 5 + 4       |
				|        | calculate | one-ts |                         | \${one} | now()       |
			`,
			errored: true,
			error__contains: [
				"The question \${one} is not user-visible so it can't be used as a calculation trigger for question \${one-ts}.",
			],
		});
	});

	it("should error when typed calculate is used as trigger", () => {
		assertPyxformXform({
			name: "trigger-invalid-ref",
			md: `
				| survey |           |        |         |             |
				|        | type      | name   | trigger | calculation |
				|        | integer   | two    |         | 1 + 1       |
				|        | integer   | two-ts | \${two} | now()       |
			`,
			errored: true,
			error__contains: [
				"The question \${two} is not user-visible so it can't be used as a calculation trigger for question \${two-ts}.",
			],
		});
	});

	it("should handle trigger column in group", () => {
		assertPyxformXform({
			name: "trigger-column",
			md: `
				| survey |             |      |                    |             |         |
				|        | type        | name | label              | calculation | trigger |
				|        | text        | a    | Enter text         |             |         |
				|        | begin_group | grp  |                    |             | \${a}   |
				|        | dateTime    | c    | Date of diagnostic | now()       | \${a}   |
				|        | end_group   |      |                    |             |         |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:trigger-column/x:a",
				"/h:html/h:head/x:model/x:instance/x:trigger-column/x:grp",
				"/h:html/h:head/x:model/x:instance/x:trigger-column/x:grp/x:c",
				"/h:html/h:head/x:model/x:bind[@nodeset='/trigger-column/grp/c'  and @type='dateTime']",
				"/h:html/h:body/x:input[@ref='/trigger-column/a']",
				"/h:html/h:body/x:group[@ref='/trigger-column/grp']",
				"/h:html/h:body/x:group/x:input[@ref='/trigger-column/grp/c']",
				"/h:html/h:body/x:input[@ref='/trigger-column/a']/x:setvalue[@event='xforms-value-changed'  and @ref='/trigger-column/grp/c' and @value='now()']",
				"/h:html[not(descendant::x:bind[@nodeset='/trigger-column/c'  and @type='dateTime' and @calculate='now()'])]",
			],
		});
	});

	it("should have expanded xpath in calculation with trigger column", () => {
		assertPyxformXform({
			name: "trigger-column",
			md: `
				| survey |          |      |             |                         |         |
				|        | type     | name | label       | calculation             | trigger |
				|        | dateTime | a    | A date      |                         |         |
				|        | integer  | b    |             | decimal-date-time(\${a}) | \${a}   |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/trigger-column/a']/x:setvalue[@event='xforms-value-changed' and @ref='/trigger-column/b'  and @value='decimal-date-time( /trigger-column/a )']",
			],
		});
	});

	it("should nest setvalue in select when trigger is of type select", () => {
		assertPyxformXform({
			name: "trigger-select_trigger",
			md: `
				| survey |                    |      |             |                     |         |
				|        | type               | name | label       | calculation         | trigger |
				|        | select_one choices | a    | Some choice |                     |         |
				|        | integer            | b    |             | string-length(\${a}) | \${a}   |
				| choices|                    |      |             |                     |         |
				|        | list_name          | name | label       |
				|        | choices            | a    | A           |
				|        | choices            | aa   | AA          |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:select1[@ref='/trigger-select_trigger/a']/x:setvalue[@event='xforms-value-changed' and @ref='/trigger-select_trigger/b'  and @value='string-length( /trigger-select_trigger/a )']",
			],
		});
	});

	it("should have expanded xpath for trigger column in repeat", () => {
		assertPyxformXform({
			name: "trigger-column",
			md: `
				| survey |              |       |                        |              |         |
				|        | type         | name  | label                  | calculation  | trigger |
				|        | begin repeat | rep   |                        |              |         |
				|        | dateTime     | one   | Enter text             |              |         |
				|        | dateTime     | three | Enter text (triggered) | now()        | \${one} |
				|        | end repeat   |       |                        |              |         |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:group[@ref='/trigger-column/rep']/x:repeat[@nodeset='/trigger-column/rep']/x:input[@ref='/trigger-column/rep/one']/x:setvalue[@event='xforms-value-changed' and @ref='/trigger-column/rep/three'  and @value='now()']",
			],
		});
	});

	it("should have expanded xpath in value for trigger column in repeat", () => {
		assertPyxformXform({
			name: "trigger-column",
			md: `
				| survey |              |       |                        |                        |         |
				|        | type         | name  | label                  | calculation            | trigger |
				|        | begin repeat | rep   |                        |                        |         |
				|        | dateTime     | one   | Enter text             |                        |         |
				|        | dateTime     | three | Enter text (triggered) | string-length(\${one}) | \${one} |
				|        | end repeat   |       |                        |                        |         |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:group[@ref='/trigger-column/rep']/x:repeat[@nodeset='/trigger-column/rep']/x:input[@ref='/trigger-column/rep/one']/x:setvalue[@event='xforms-value-changed' and @ref='/trigger-column/rep/three'  and @value='string-length( ../one )']",
			],
		});
	});

	it("should accept multiple triggers with comma delimiter", () => {
		// Match Python's comprehensive comma variant testing using itertools.product
		const forms: Record<string, number> = {
			"${{a}}{0}${{b}}": 1, // single comma
			"${{a}}{0}{1}${{b}}": 2, // double comma
			"${{a}}{0}${{b}}{1}": 2, // trailing comma
			"${{a}}{0}${{b}}{1}{2}": 3, // trailing double comma
		};
		const commaVariants = [",", ", ", " ,", " , "];
		// Generate all combinations, using a Set to remove duplicates
		const caseSet = new Set<string>();
		for (const [form, repeats] of Object.entries(forms)) {
			const generateCombos = (depth: number, combo: string[]): string[][] => {
				if (depth === 0) return [combo];
				const results: string[][] = [];
				for (const v of commaVariants) {
					results.push(...generateCombos(depth - 1, [...combo, v]));
				}
				return results;
			};
			for (const combo of generateCombos(repeats, [])) {
				let result = form;
				for (let i = 0; i < combo.length; i++) {
					result = result.replace(`{${i}}`, combo[i]);
				}
				result = result.replace(/\$\{\{a\}\}/g, "${a}").replace(/\$\{\{b\}\}/g, "${b}");
				caseSet.add(result);
			}
		}
		const cases = [...caseSet];
		for (const triggerCase of cases) {
			assertPyxformXform({
				md: `
					| survey |          |      |             |             |         |
					|        | type     | name | label       | calculation | trigger |
					|        | text     | a    | Enter text  |             |         |
					|        | text     | b    | Enter text  |             |         |
					|        | dateTime | c    |             | now()       | ${triggerCase} |
				`,
				xml__xpath_match: [
					`
					/h:html/h:body/x:input[@ref='/test_name/a']/x:setvalue[
					  @ref='/test_name/c'
					  and @event='xforms-value-changed'
					  and @value='now()'
					]
					`,
					`
					/h:html/h:body/x:input[@ref='/test_name/b']/x:setvalue[
					  @ref='/test_name/c'
					  and @event='xforms-value-changed'
					  and @value='now()'
					]
					`,
				],
			});
		}
	});

	it("should error with bad comma delimiter in multiple triggers", () => {
		const cases = [
			"\${a}\${b}",
			",\${a}\${b}",
			"\${a},\${b}\${c}",
			"\${a}\${b},",
			"\${a},\${b}\${c}",
		];
		for (const triggerCase of cases) {
			assertPyxformXform({
				md: `
					| survey |          |      |             |             |         |
					|        | type     | name | label       | calculation | trigger |
					|        | text     | a    | Enter text  |             |         |
					|        | text     | b    | Enter text  |             |         |
					|        | dateTime | c    |             | now()       | ${triggerCase} |
				`,
				errored: true,
				error__contains: [
					"[row : 4] On the 'survey' sheet, the 'trigger' value is invalid. Reference variable lists must have a comma between each variable.",
				],
			});
		}
	});

	it("should produce trigger ref for question types with special handling (minimal)", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type    | name | label | trigger |
				| | integer | q1   | Q1    |         |
				| | text    | q2   | Q2    | \${q1}  |
			`,
			xml__xpath_match: [
				`
				/h:html/h:body/x:input[@ref='/test_name/q1']/x:setvalue[
				  @ref='/test_name/q2'
				  and @event='xforms-value-changed'
				]
				`,
			],
		});
	});

	it("should produce trigger ref for question types with special handling (full case)", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type          | name | label | calculate | trigger |
				| | select_one l1 | q1   | Q1    |           |         |
				| | text          | q2   | Q2    | 2+2       | \${q1}  |

				| choices |
				| | list_name | name | label |
				| | l1        | c1   | C1    |
			`,
			xml__xpath_match: [
				`
				/h:html/h:body/x:select1[@ref='/test_name/q1']/x:setvalue[
				  @ref='/test_name/q2'
				  and @event='xforms-value-changed'
				  and @value='2+2'
				]
				`,
			],
		});
	});
});
