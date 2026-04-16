/**
 * Tests for XLSForm appearance types with zero test coverage in either codebase.
 * Covers: likert, multiline, numbers, thousands-sep, masked, url, calendar variants.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestAppearances", () => {
	it("should output likert appearance on select_one", () => {
		assertPyxformXform({
			md: `
				| survey  |                   |      |       |            |
				|         | type              | name | label | appearance |
				|         | select_one colors | q1   | Q1    | likert     |
				| choices |           |       |       |
				|         | list_name | name  | label |
				|         | colors    | red   | Red   |
				|         | colors    | blue  | Blue  |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:select1[@ref='/test_name/q1' and @appearance='likert']",
			],
		});
	});

	it("should output likert appearance with translations", () => {
		assertPyxformXform({
			md: `
				| survey  |                   |      |              |                 |            |
				|         | type              | name | label::en    | label::fr       | appearance |
				|         | select_one colors | q1   | Pick color   | Choisir couleur | likert     |
				| choices |           |       |           |            |
				|         | list_name | name  | label::en | label::fr  |
				|         | colors    | red   | Red       | Rouge      |
				|         | colors    | blue  | Blue      | Bleu       |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:select1[@ref='/test_name/q1' and @appearance='likert']",
				"/h:html/h:head/x:model/x:itext/x:translation[@lang='en']",
				"/h:html/h:head/x:model/x:itext/x:translation[@lang='fr']",
			],
		});
	});

	it("should output multiline appearance on text", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |       |            |
				|        | type | name | label | appearance |
				|        | text | q1   | Q1    | multiline  |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='multiline']",
			],
		});
	});

	it("should output numbers appearance on text", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |       |            |
				|        | type | name | label | appearance |
				|        | text | q1   | Q1    | numbers    |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='numbers']",
			],
		});
	});

	it("should output thousands-sep appearance on integer", () => {
		assertPyxformXform({
			md: `
				| survey |         |      |       |               |
				|        | type    | name | label | appearance    |
				|        | integer | q1   | Q1    | thousands-sep |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='thousands-sep']",
			],
		});
	});

	it("should output thousands-sep appearance on decimal", () => {
		assertPyxformXform({
			md: `
				| survey |         |      |       |               |
				|        | type    | name | label | appearance    |
				|        | decimal | q1   | Q1    | thousands-sep |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='thousands-sep']",
			],
		});
	});

	it("should output masked appearance on text", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |       |            |
				|        | type | name | label | appearance |
				|        | text | q1   | Q1    | masked     |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='masked']",
			],
		});
	});

	it("should output url appearance on text", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |       |            |
				|        | type | name | label | appearance |
				|        | text | q1   | Q1    | url        |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='url']",
			],
		});
	});

	it("should output ethiopian calendar appearance on date", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |       |            |
				|        | type | name | label | appearance |
				|        | date | q1   | Q1    | ethiopian  |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='ethiopian']",
			],
		});
	});

	it("should output coptic calendar appearance on date", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |       |            |
				|        | type | name | label | appearance |
				|        | date | q1   | Q1    | coptic     |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='coptic']",
			],
		});
	});

	it("should output islamic calendar appearance on date", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |       |            |
				|        | type | name | label | appearance |
				|        | date | q1   | Q1    | islamic    |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='islamic']",
			],
		});
	});

	it("should output bikram-sambat calendar appearance on date", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |       |               |
				|        | type | name | label | appearance    |
				|        | date | q1   | Q1    | bikram-sambat |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='bikram-sambat']",
			],
		});
	});

	it("should output myanmar calendar appearance on date", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |       |            |
				|        | type | name | label | appearance |
				|        | date | q1   | Q1    | myanmar    |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='myanmar']",
			],
		});
	});

	it("should output combined multiline numbers appearance on text", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |       |                   |
				|        | type | name | label | appearance        |
				|        | text | q1   | Q1    | multiline numbers |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='multiline numbers']",
			],
		});
	});

	it("should output no-calendar appearance on date", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |       |             |
				|        | type | name | label | appearance  |
				|        | date | q1   | Q1    | no-calendar |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='no-calendar']",
			],
		});
	});
});
