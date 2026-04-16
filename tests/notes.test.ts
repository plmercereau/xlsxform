/**
 * Port of test_notes.py - Test the "note" question type.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

interface Case {
	label: string;
	match: Set<string>;
	xpath: string;
}

const xpqBodyInputLabelOutputValue = (qName: string) =>
	`/h:html/h:body/x:input[@ref='/test_name/${qName}']/x:label/x:output/@value`;

describe("TestNotes", () => {
	it("test_instance_expression__original_problem_scenario", () => {
		/**Should produce expected output for scenario similar to pyxform/#646.*/
		const md = `
        | survey  |               |      |       |
        |         | type          | name | label |
        |         | select_one c1 | q1   | Q1    |
        |         | select_one c2 | q2   | Q2    |
        |         | text          | text | Text  |
        |         | note          | note | This is a note with a reference to \${text}. And a reference to a secondary instance: instance('c1')/root/item[name = \${q1}]/label is here, and another instance('c2')/root/item[contains(name, \${q2})]/label is here. |
        | choices |
        |         | list_name | name | label |
        |         | c1        | y    | Yes   |
        |         | c1        | n    | No    |
        |         | c2        | b    | Big   |
        |         | c2        | s    | Small |
        `;
		assertPyxformXform({
			md: md,
			xml__xpath_match: [
				`
                /h:html/h:body/x:input[@ref='/test_name/note']/x:label[
                  contains(., 'This is a note with a reference to')
                    and contains(., '. And a reference to a secondary instance: ')
                    and contains(., 'is here, and another')
                    and contains(., 'is here.')
                ]
                `,
			],
			xml__xpath_exact: [
				[
					xpqBodyInputLabelOutputValue("note"),
					new Set([
						" /test_name/text ",
						"instance('c1')/root/item[name =  /test_name/q1 ]/label",
						"instance('c2')/root/item[contains(name,  /test_name/q2 )]/label",
					]),
				],
			],
		});
	});

	it("test_instance_expression__permutations", () => {
		/**Should produce expected output for various combinations of instance usages.*/
		const md = `
        | survey  |               |      |       |
        |         | type          | name | label |
        |         | select_one c1 | q1   | Q1    |
        |         | select_one c2 | q2   | Q2    |
        |         | text          | text | Text  |
        |         | note          | note | {note} |
        | choices |
        |         | list_name | name | label |
        |         | c1        | y    | Yes   |
        |         | c1        | n    | No    |
        |         | c2        | b    | Big   |
        |         | c2        | s    | Small |
        `;

		const defaultXpath = xpqBodyInputLabelOutputValue("note");

		const cases: Case[] = [
			// A pyxform token.
			{
				label: "${text}",
				match: new Set([" /test_name/text "]),
				xpath: defaultXpath,
			},
			// Instance expression with predicate using pyxform token and equals.
			{
				label: "instance('c1')/root/item[name = ${q1}]/label",
				match: new Set([
					"instance('c1')/root/item[name =  /test_name/q1 ]/label",
				]),
				xpath: defaultXpath,
			},
			// Instance expression with predicate using pyxform token and equals (double quotes).
			{
				label: `instance("c1")/root/item[name = \${q1}]/label`,
				match: new Set([
					`instance("c1")/root/item[name =  /test_name/q1 ]/label`,
				]),
				xpath: defaultXpath,
			},
			// Instance expression with predicate using pyxform token and function.
			{
				label: "instance('c2')/root/item[contains(name, ${q2})]/label",
				match: new Set([
					"instance('c2')/root/item[contains(name,  /test_name/q2 )]/label",
				]),
				xpath: defaultXpath,
			},
			// Instance expression with predicate using pyxform token and function (double quotes).
			{
				label: `instance("c2")/root/item[contains("name", \${q2})]/label`,
				match: new Set([
					`instance("c2")/root/item[contains("name",  /test_name/q2 )]/label`,
				]),
				xpath: defaultXpath,
			},
			// Instance expression with predicate using pyxform token and function (mixed quotes).
			{
				label: `instance('c2')/root/item[contains("name", \${q2})]/label`,
				match: new Set([
					`instance('c2')/root/item[contains("name",  /test_name/q2 )]/label`,
				]),
				xpath: defaultXpath,
			},
			// Instance expression with predicate using pyxform token and equals.
			{
				label:
					"instance('c2')/root/item[contains(name, instance('c1')/root/item[name = ${q1}]/label)]/label",
				match: new Set([
					"instance('c2')/root/item[contains(name, instance('c1')/root/item[name =  /test_name/q1 ]/label)]/label",
				]),
				xpath: defaultXpath,
			},
			// Instance expression with predicate using pyxform token and equals (double quotes).
			{
				label: `instance("c2")/root/item[contains(name, instance("c1")/root/item[name = \${q1}]/label)]/label`,
				match: new Set([
					`instance("c2")/root/item[contains(name, instance("c1")/root/item[name =  /test_name/q1 ]/label)]/label`,
				]),
				xpath: defaultXpath,
			},
			// Instance expression with predicate using pyxform token and equals (mixed quotes).
			{
				label: `instance('c2')/root/item[contains(name, instance("c1")/root/item[name = \${q1}]/label)]/label`,
				match: new Set([
					`instance('c2')/root/item[contains(name, instance("c1")/root/item[name =  /test_name/q1 ]/label)]/label`,
				]),
				xpath: defaultXpath,
			},
			// Instance expression with predicate not using a pyxform token.
			{
				label: "instance('c1')/root/item[name = 'y']/label",
				match: new Set(["instance('c1')/root/item[name = 'y']/label"]),
				xpath: defaultXpath,
			},
			// Instance expression with predicate not using a pyxform token (double quotes).
			{
				label: `instance("c1")/root/item[name = "y"]/label`,
				match: new Set([`instance("c1")/root/item[name = "y"]/label`]),
				xpath: defaultXpath,
			},
			// Instance expression with predicate not using a pyxform token (mixed quotes).
			{
				label: `instance("c1")/root/item[name = 'y']/label`,
				match: new Set([`instance("c1")/root/item[name = 'y']/label`]),
				xpath: defaultXpath,
			},
			// Instance expression with predicate not using a pyxform token (all escaped).
			{
				label: `instance("c1")/root/item[name <> 1 and "<>&" = "1"]/label`,
				match: new Set([
					`instance("c1")/root/item[name &lt;&gt; 1 and "&lt;&gt;&amp;" = "1"]/label`,
				]),
				xpath: defaultXpath,
			},
		];

		const wrapScenarios = ["{}", "Text {}", "{} text", "Text {} text"];

		// All cases together in one.
		const comboCase: Case = {
			label: cases.map((c) => c.label).join(" "),
			match: new Set(cases.flatMap((c) => [...c.match])),
			xpath: defaultXpath,
		};
		cases.push(comboCase);

		for (const c of cases) {
			for (const fmt of wrapScenarios) {
				const noteText = fmt.replace("{}", c.label);
				assertPyxformXform({
					md: md.replace("{note}", noteText),
					xml__xpath_exact: [[c.xpath, c.match]],
					warnings_count: 0,
				});
			}
		}
	});
});
