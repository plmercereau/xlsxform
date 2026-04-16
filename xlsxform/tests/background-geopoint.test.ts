/**
 * Port of test_background_geopoint.py - Test background-geopoint question type.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestBackgroundGeopoint", () => {
	it("test_error__missing_trigger", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |
				|        | type                | name          | label      | trigger |
				|        | integer             | temp          | Enter temp |         |
				|        | background-geopoint | temp_geo      |            |         |
			`,
			errored: true,
			error__contains: [
				"[row : 3] For 'background-geopoint' questions, the 'trigger' column must not be empty.",
			],
		});
	});

	it("test_error__invalid_trigger", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type                | name     | label      | trigger      |
				|        | integer             | temp     | Enter temp |              |
				|        | background-geopoint | temp_geo |            | \${invalid}  |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'trigger' value is invalid. Reference variables must contain a name from the 'survey' sheet. Could not find the name 'invalid'.",
			],
		});
	});

	it("test_error__calculation_exists", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type                | name     | label      | trigger    | calculation |
				|        | integer             | temp     | Enter temp |            |             |
				|        | background-geopoint | temp_geo |            | \${temp}   | 5 * temp    |
			`,
			errored: true,
			error__contains: [
				"[row : 3] For 'background-geopoint' questions, the 'calculation' column must be empty.",
			],
		});
	});

	it("test_question_no_group__trigger_no_group", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |
				|        | type                | name     | label      | trigger    |
				|        | integer             | temp     | Enter temp |            |
				|        | background-geopoint | temp_geo |            | \${temp}   |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/data/temp_geo' and @type='geopoint']",
				`
				/h:html/h:body/x:input[@ref='/data/temp']
				  /odk:setgeopoint[@event='xforms-value-changed' and @ref='/data/temp_geo']
				`,
			],
		});
	});

	it("test_question_no_group__trigger_no_group__with_calculate_same_trigger", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |
				|        | type                | name         | label      | trigger    | calculation    |
				|        | integer             | temp         | Enter temp |            |                |
				|        | background-geopoint | temp_geo     |            | \${temp}   |                |
				|        | calculate           | temp_doubled |            | \${temp}   | \${temp} * 2   |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/data/temp_geo' and @type='geopoint']",
				`
				/h:html/h:body/x:input[@ref='/data/temp']
				  /odk:setgeopoint[@event='xforms-value-changed' and @ref='/data/temp_geo']
				`,
				"/h:html/h:head/x:model/x:bind[@nodeset='/data/temp_doubled' and @type='string']",
				`
				/h:html/h:body/x:input[@ref='/data/temp']
				  /x:setvalue[@event='xforms-value-changed'
				    and @ref='/data/temp_doubled'
				    and normalize-space(@value)='/data/temp * 2'
				  ]
				`,
			],
		});
	});

	it("test_question_in_nonrep_group__trigger_in_same_nonrep_group", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |
				|        | type                | name     | label      | trigger    |
				|        | begin_group         | groupA   |            |            |
				|        | integer             | temp     | Enter temp |            |
				|        | background-geopoint | temp_geo |            | \${temp}   |
				|        | end_group           |          |            |            |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/data/groupA/temp_geo' and @type='geopoint']",
				`
				/h:html/h:body/x:group[@ref='/data/groupA']
				  /x:input[@ref='/data/groupA/temp']/odk:setgeopoint[
				    @event='xforms-value-changed' and @ref='/data/groupA/temp_geo'
				]
				`,
			],
		});
	});

	it("test_question_in_nonrep_group__trigger_in_different_nonrep_group", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |
				|        | type                | name     | label      | trigger    |
				|        | begin_group         | groupA   |            |            |
				|        | integer             | temp     | Enter temp |            |
				|        | end_group           |          |            |            |
				|        | begin_group         | groupB   |            |            |
				|        | background-geopoint | temp_geo |            | \${temp}   |
				|        | date                | today    | Enter date |            |
				|        | end_group           |          |            |            |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/data/groupB/temp_geo' and @type='geopoint']",
				`
				/h:html/h:body/x:group[@ref="/data/groupA"]
				  /x:input[@ref="/data/groupA/temp"]
				  /odk:setgeopoint[
				    @event="xforms-value-changed" and @ref="/data/groupB/temp_geo"
				  ]
				`,
			],
		});
	});

	it("test_question_in_rep_group__trigger_in_same_rep_group", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |
				|        | type                | name     | label      | trigger    |
				|        | begin_repeat        | groupA   |            |            |
				|        | integer             | temp     | Enter temp |            |
				|        | background-geopoint | temp_geo |            | \${temp}   |
				|        | end_repeat          |          |            |            |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/data/groupA/temp_geo' and @type='geopoint']",
				`
				/h:html/h:body/x:group[@ref='/data/groupA']
				  /x:repeat[@nodeset='/data/groupA']/x:input[@ref='/data/groupA/temp']
				  /odk:setgeopoint[
				    @event='xforms-value-changed' and @ref='/data/groupA/temp_geo'
				]
				`,
			],
		});
	});

	it("test_question_in_rep_group__trigger_in_different_rep_group", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |
				|        | type                | name     | label      | trigger    |
				|        | begin_repeat        | groupA   |            |            |
				|        | integer             | temp     | Enter temp |            |
				|        | end_repeat          |          |            |            |
				|        | begin_repeat        | groupB   |            |            |
				|        | background-geopoint | temp_geo |            | \${temp}   |
				|        | end_repeat          |          |            |            |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/data/groupB/temp_geo' and @type='geopoint']",
				`
				/h:html/h:body/x:group[@ref='/data/groupA']
				  /x:repeat[@nodeset='/data/groupA']/x:input[@ref='/data/groupA/temp']
				  /odk:setgeopoint[
				    @event='xforms-value-changed' and @ref='/data/groupB/temp_geo'
				]
				`,
			],
		});
	});

	it("test_question_in_nonrep_group__trigger_in_different_rep_group", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |
				|        | type                | name     | label      | trigger    |
				|        | begin_repeat        | groupA   |            |            |
				|        | integer             | temp     | Enter temp |            |
				|        | end_repeat          |          |            |            |
				|        | begin_group         | groupB   |            |            |
				|        | background-geopoint | temp_geo |            | \${temp}   |
				|        | date                | today    | Enter date |            |
				|        | end_group           |          |            |            |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/data/groupB/temp_geo' and @type='geopoint']",
				`
				/h:html/h:body/x:group[@ref='/data/groupA']
				  /x:repeat[@nodeset='/data/groupA']/x:input[@ref='/data/groupA/temp']
				  /odk:setgeopoint[
				    @event='xforms-value-changed' and @ref='/data/groupB/temp_geo'
				]
				`,
			],
		});
	});

	it("test_question_in_rep_group__trigger_in_different_nonrep_group", () => {
		assertPyxformXform({
			name: "data",
			md: `
				| survey |
				|        | type                | name     | label      | trigger    |
				|        | begin_group         | groupA   |            |            |
				|        | integer             | temp     | Enter temp |            |
				|        | end_group           |          |            |            |
				|        | begin_repeat        | groupB   |            |            |
				|        | background-geopoint | temp_geo |            | \${temp}   |
				|        | end_repeat          |          |            |            |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/data/groupB/temp_geo' and @type='geopoint']",
				`
				/h:html/h:body/x:group[@ref='/data/groupA']
				  /x:input[@ref='/data/groupA/temp']/odk:setgeopoint[
				    @event='xforms-value-changed' and @ref='/data/groupB/temp_geo'
				]
				`,
			],
		});
	});
});
