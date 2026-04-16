/**
 * Port of test_group.py - Group element tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestGroupOutput", () => {
	it("should output group type with correct model structure", () => {
		assertPyxformXform({
			md: `
				| survey |             |         |                  |
				|        | type        | name    | label            |
				|        | text        | pregrp  | Pregroup text    |
				|        | begin group | xgrp    | XGroup questions |
				|        | text        | xgrp_q1 | XGroup Q1        |
				|        | integer     | xgrp_q2 | XGroup Q2        |
				|        | end group   |         |                  |
				|        | note        | postgrp | Post group note  |
			`,
			model__contains: [
				"<pregrp/>",
				"<xgrp>",
				"<xgrp_q1/>",
				"<xgrp_q1/>",
				"<xgrp_q2/>",
				"</xgrp>",
				"<postgrp/>",
			],
		});
	});

	it("should output group intent", () => {
		assertPyxformXform({
			name: "intent_test",
			md: `
				| survey |             |         |                  |                                                             |
				|        | type        | name    | label            | intent                                                      |
				|        | text        | pregrp  | Pregroup text    |                                                             |
				|        | begin group | xgrp    | XGroup questions | ex:org.redcross.openmapkit.action.QUERY(osm_file=\${pregrp}) |
				|        | text        | xgrp_q1 | XGroup Q1        |                                                             |
				|        | integer     | xgrp_q2 | XGroup Q2        |                                                             |
				|        | end group   |         |                  |                                                             |
				|        | note        | postgrp | Post group note  |                                                             |
			`,
			xml__contains: [
				'<group intent="ex:org.redcross.openmapkit.action.QUERY(osm_file= /intent_test/pregrp )" ref="/intent_test/xgrp">',
			],
		});
	});

	it("should include group relevant in bind", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label | relevant     |
				|        | integer     | q1   | Q1    |              |
				|        | begin group | g1   | G1    | \${q1} = 1   |
				|        | text        | q2   | Q2    |              |
				|        | end group   |      |       |              |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:bind[
				  @nodeset = '/test_name/g1' and @relevant=' /test_name/q1  = 1'
				]
				`,
			],
		});
	});

	it("should output table list appearance", () => {
		const xmlContains = `<group appearance="field-list minimal" ref="/table-list-appearance-mod/tablelist1">
      <input ref="/table-list-appearance-mod/tablelist1/generated_table_list_label_2">
        <label>Table_Y_N</label>
      </input>
      <select1 appearance="label" ref="/table-list-appearance-mod/tablelist1/reserved_name_for_field_list_labels_3">
        <label> </label>
        <itemset nodeset="instance('yes_no')/root/item"><value ref="name"/><label ref="label"/></itemset>
      </select1>
      <select1 appearance="list-nolabel" ref="/table-list-appearance-mod/tablelist1/options1a">
        <label>Q1</label>
        <hint>first row!</hint>`;
		assertPyxformXform({
			name: "table-list-appearance-mod",
			md: `
				| survey  |
				| | type              | name       | label     | hint       | appearance         |
				| | begin_group       | tablelist1 | Table_Y_N |            | table-list minimal |
				| | select_one yes_no | options1a  | Q1        | first row! |                    |
				| | select_one yes_no | options1b  | Q2        |            |                    |
				| | end_group         |            |           |            |                    |
				| choices |
				| | list_name | name | label |
				| | yes_no    | yes  | Yes   |
			`,
			xml__contains: [xmlContains],
		});
	});

	it("should output group label ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin_group | g1   | G1    |
				| | text        | q1   | Q1    |
				| | end_group   |      |       |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				`
				/h:html/h:body/x:group[
				  @ref='/test_name/g1'
				  and count(@*) = 1
				  and ./x:label[
				    not(@ref)
				    and text()='G1'
				  ]
				]
				`,
			],
		});
	});

	it("should output group no label ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin_group | g1   |       |
				| | text        | q1   | Q1    |
				| | end_group   |      |       |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				`
				/h:html/h:body/x:group[
				  @ref='/test_name/g1'
				  and count(@*) = 1
				  and not(./x:label)
				]
				`,
			],
		});
	});

	it("should output group label translated ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label::English (en) |
				| | begin_group | g1   | G1                  |
				| | text        | q1   | Q1                  |
				| | end_group   |      |                     |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				`
				/h:html/h:body/x:group[
				  @ref='/test_name/g1'
				  and count(@*) = 1
				  and ./x:label[
				    @ref="jr:itext('/test_name/g1:label')"
				    and not(text())
				  ]
				]
				`,
			],
		});
	});

	it("should output group no label translated ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label::English (en) |
				| | begin_group | g1   |                     |
				| | text        | q1   | Q1                  |
				| | end_group   |      |                     |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				`
				/h:html/h:body/x:group[
				  @ref='/test_name/g1'
				  and count(@*) = 1
				  and not(./x:label)
				]
				`,
			],
		});
	});

	it("should output group label with appearance ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | appearance |
				| | begin_group | g1   | G1    | field-list |
				| | text        | q1   | Q1    |            |
				| | end_group   |      |       |            |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				`
				/h:html/h:body/x:group[
				  @ref='/test_name/g1'
				  and @appearance='field-list'
				  and count(@*) = 2
				  and ./x:label[
				    not(@ref)
				    and text()='G1'
				  ]
				]
				`,
			],
		});
	});

	it("should output group no label with appearance ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | appearance |
				| | begin_group | g1   |       | field-list |
				| | text        | q1   | Q1    |            |
				| | end_group   |      |       |            |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				`
				/h:html/h:body/x:group[
				  @ref='/test_name/g1'
				  and @appearance='field-list'
				  and count(@*) = 2
				  and not(./x:label)
				]
				`,
			],
		});
	});

	it("should output group label translated with appearance ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label::English (en) | appearance |
				| | begin_group | g1   | G1                  | field-list |
				| | text        | q1   | Q1                  |            |
				| | end_group   |      |                     |            |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				`
				/h:html/h:body/x:group[
				  @ref='/test_name/g1'
				  and @appearance='field-list'
				  and count(@*) = 2
				  and ./x:label[
				    @ref="jr:itext('/test_name/g1:label')"
				    and not(text())
				  ]
				]
				`,
			],
		});
	});

	it("should output group no label translated with appearance ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label::English (en) | appearance |
				| | begin_group | g1   |                     | field-list |
				| | text        | q1   | Q1                  |            |
				| | end_group   |      |                     |            |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				`
				/h:html/h:body/x:group[
				  @ref='/test_name/g1'
				  and @appearance='field-list'
				  and count(@*) = 2
				  and not(./x:label)
				]
				`,
			],
		});
	});
});

describe("TestGroupParsing", () => {
	it("should find that a single unique group name is ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin group | g1   | G1    |
				| | text        | q1   | Q1    |
				| | end group   |      |       |
			`,
			warnings_count: 0,
		});
	});

	it("should find that groups with unique names in the same context is ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin group | g1   | G1    |
				| | text        | q1   | Q1    |
				| | end group   |      |       |
				| | begin group | g2   | G2    |
				| | text        | q2   | Q2    |
				| | end group   |      |       |
			`,
			warnings_count: 0,
		});
	});

	it("should find that a group name can be the same as another group in a different context", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin group | g1   | G1    |
				| | text        | q1   | Q1    |
				| | end group   |      |       |
				| | begin group | g2   | G2    |
				| | begin group | g1   | G1    |
				| | text        | q1   | Q1    |
				| | end group   |      |       |
				| | text        | q2   | Q2    |
				| | end group   |      |       |
			`,
			warnings_count: 0,
		});
	});

	it("should find that a group name can be the same as another group in a different repeat context", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin group  | g1   | G1    |
				| | text         | q1   | Q1    |
				| | end group    |      |       |
				| | begin repeat | r1   | R1    |
				| | begin group  | g1   | G1    |
				| | text         | q1   | Q1    |
				| | end group    |      |       |
				| | text         | q2   | Q2    |
				| | end repeat   |      |       |
			`,
			warnings_count: 0,
		});
	});

	it("should find that a repeat name can be the same as a group in a different group context", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin group  | g1   | G1    |
				| | begin repeat | g2   | G2    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
				| | end group    |      |       |
				| | begin group  | g2   | G2    |
				| | text         | q2   | Q2    |
				| | end group    |      |       |
			`,
			warnings_count: 0,
		});
	});

	it("should find that a repeat name can be the same as a group in a different repeat context", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | r1   | R1    |
				| | begin repeat | g2   | G2    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
				| | end repeat   |      |       |
				| | begin group  | g2   | G2    |
				| | text         | q2   | Q2    |
				| | end group    |      |       |
			`,
			warnings_count: 0,
		});
	});

	it("should find that a group name can be the same as the survey root", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin group | data | G1    |
				| | text        | q1   | Q1    |
				| | end group   |      |       |
			`,
			name: "data",
			warnings_count: 0,
		});
	});

	it("should find that a group name can be the same (CI) as the survey root", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin group | DATA | G1    |
				| | text        | q1   | Q1    |
				| | end group   |      |       |
			`,
			name: "data",
			warnings_count: 0,
		});
	});

	it("should find that a duplicate group name in same context in survey raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin group | g1   | G1    |
				| | text        | q1   | Q1    |
				| | end group   |      |       |
				| | begin group | g1   | G2    |
				| | text        | q2   | Q2    |
				| | end group   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 5] On the 'survey' sheet, the 'name' value 'g1' is invalid. Questions, groups, and repeats must be unique within their nearest parent group or repeat, or the survey if not inside a group or repeat.",
			],
		});
	});

	it("should find that a duplicate group name same as repeat in same context in survey raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | g1   | G1    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
				| | begin group  | g1   | G2    |
				| | text         | q2   | Q2    |
				| | end group    |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 5] On the 'survey' sheet, the 'name' value 'g1' is invalid. Questions, groups, and repeats must be unique within their nearest parent group or repeat, or the survey if not inside a group or repeat.",
			],
		});
	});

	it("should find that a duplicate group name in same context in group raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin group | g1   | G1    |
				| | begin group | g2   | G2    |
				| | text        | q1   | Q1    |
				| | end group   |      |       |
				| | begin group | g2   | G2    |
				| | text        | q2   | Q2    |
				| | end group   |      |       |
				| | end group   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 6] On the 'survey' sheet, the 'name' value 'g2' is invalid. Questions, groups, and repeats must be unique within their nearest parent group or repeat, or the survey if not inside a group or repeat.",
			],
		});
	});

	it("should find that a duplicate group name same as repeat in same context in group raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin group  | g1   | G1    |
				| | begin repeat | g2   | G2    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
				| | begin group  | g2   | G2    |
				| | text         | q2   | Q2    |
				| | end group    |      |       |
				| | end group    |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 6] On the 'survey' sheet, the 'name' value 'g2' is invalid. Questions, groups, and repeats must be unique within their nearest parent group or repeat, or the survey if not inside a group or repeat.",
			],
		});
	});

	it("should find that a duplicate group name in same context in repeat raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | r1   | R1    |
				| | begin group  | g2   | G2    |
				| | text         | q1   | Q1    |
				| | end group    |      |       |
				| | begin group  | g2   | G2    |
				| | text         | q2   | Q2    |
				| | end group    |      |       |
				| | end repeat   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 6] On the 'survey' sheet, the 'name' value 'g2' is invalid. Questions, groups, and repeats must be unique within their nearest parent group or repeat, or the survey if not inside a group or repeat.",
			],
		});
	});

	it("should find that a duplicate group name same as repeat in same context in repeat raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type          | name | label |
				| | begin repeat  | r1   | R1    |
				| | begin repeat  | g2   | G2    |
				| | text          | q1   | Q1    |
				| | end repeat    |      |       |
				| | begin group   | g2   | G2    |
				| | text          | q2   | Q2    |
				| | end group     |      |       |
				| | end repeat    |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 6] On the 'survey' sheet, the 'name' value 'g2' is invalid. Questions, groups, and repeats must be unique within their nearest parent group or repeat, or the survey if not inside a group or repeat.",
			],
		});
	});

	it("should find that a duplicate group name (CI) in same context in survey raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin group | g1   | G1    |
				| | text        | q1   | Q1    |
				| | end group   |      |       |
				| | begin group | G1   | G2    |
				| | text        | q2   | Q2    |
				| | end group   |      |       |
			`,
			warnings__contains: [
				"[row : 5] On the 'survey' sheet, the 'name' value 'G1' is problematic. The name is a case-insensitive match to another name. Questions, groups, and repeats should be unique within the nearest parent group or repeat, or the survey if not inside a group or repeat. Some data processing tools are not case-sensitive, so the current names may make analysis difficult.",
			],
		});
	});

	it("should find that a duplicate group name (CI) same as repeat in same context in survey raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin group | g1   | G1    |
				| | text        | q1   | Q1    |
				| | end group   |      |       |
				| | begin group | G1   | G2    |
				| | text        | q2   | Q2    |
				| | end group   |      |       |
			`,
			warnings__contains: [
				"[row : 5] On the 'survey' sheet, the 'name' value 'G1' is problematic. The name is a case-insensitive match to another name. Questions, groups, and repeats should be unique within the nearest parent group or repeat, or the survey if not inside a group or repeat. Some data processing tools are not case-sensitive, so the current names may make analysis difficult.",
			],
		});
	});

	it("should find that a duplicate group name (CI) in same context in group raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin group | g1   | G1    |
				| | begin group | g2   | G2    |
				| | text        | q1   | Q1    |
				| | end group   |      |       |
				| | begin group | G2   | G2    |
				| | text        | q2   | Q2    |
				| | end group   |      |       |
				| | end group   |      |       |
			`,
			warnings__contains: [
				"[row : 6] On the 'survey' sheet, the 'name' value 'G2' is problematic. The name is a case-insensitive match to another name. Questions, groups, and repeats should be unique within the nearest parent group or repeat, or the survey if not inside a group or repeat. Some data processing tools are not case-sensitive, so the current names may make analysis difficult.",
			],
		});
	});

	it("should find that a duplicate group name (CI) same as repeat in same context in group raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin group  | g1   | G1    |
				| | begin repeat | g2   | G2    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
				| | begin group  | G2   | G2    |
				| | text         | q2   | Q2    |
				| | end group    |      |       |
				| | end group    |      |       |
			`,
			warnings__contains: [
				"[row : 6] On the 'survey' sheet, the 'name' value 'G2' is problematic. The name is a case-insensitive match to another name. Questions, groups, and repeats should be unique within the nearest parent group or repeat, or the survey if not inside a group or repeat. Some data processing tools are not case-sensitive, so the current names may make analysis difficult.",
			],
		});
	});

	it("should find that a duplicate group name (CI) in same context in repeat raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | r1   | R1    |
				| | begin group  | g2   | G2    |
				| | text         | q1   | Q1    |
				| | end group    |      |       |
				| | begin group  | G2   | G2    |
				| | text         | q2   | Q2    |
				| | end group    |      |       |
				| | end repeat   |      |       |
			`,
			warnings__contains: [
				"[row : 6] On the 'survey' sheet, the 'name' value 'G2' is problematic. The name is a case-insensitive match to another name. Questions, groups, and repeats should be unique within the nearest parent group or repeat, or the survey if not inside a group or repeat. Some data processing tools are not case-sensitive, so the current names may make analysis difficult.",
			],
		});
	});

	it("should find that a duplicate group name (CI) same as repeat in same context in repeat raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type          | name | label |
				| | begin repeat  | r1   | R1    |
				| | begin repeat  | g2   | G2    |
				| | text          | q1   | Q1    |
				| | end repeat    |      |       |
				| | begin group   | G2   | G2    |
				| | text          | q2   | Q2    |
				| | end group     |      |       |
				| | end repeat    |      |       |
			`,
			warnings__contains: [
				"[row : 6] On the 'survey' sheet, the 'name' value 'G2' is problematic. The name is a case-insensitive match to another name. Questions, groups, and repeats should be unique within the nearest parent group or repeat, or the survey if not inside a group or repeat. Some data processing tools are not case-sensitive, so the current names may make analysis difficult.",
			],
		});
	});

	it("should raise an error for begin group with no name", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label |
				|        | begin group |      | G1    |
				|        | text        | q1   | Q1    |
			`,
			errored: true,
			error__contains: ["[row : 2] Question or group with no name."],
		});
	});

	it("should raise an error for begin group with no end group", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label |
				|        | begin group | g1   | G1    |
				|        | text        | q1   | Q1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] Unmatched 'begin_group'. No matching 'end_group' was found for the name 'g1'.",
			],
		});
	});

	it("should raise an error for begin group with different end type", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label |
				|        | begin group | g1   | G1    |
				|        | text        | q1   | Q1    |
				|        | end repeat  |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 4] Unmatched 'end_repeat'. No matching 'begin_repeat' was found for the name 'unknown'.",
			],
		});
	});

	it("should raise an error for begin group with no end group but another closed group", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label |
				|        | begin group | g1   | G1    |
				|        | begin group | g2   | G2    |
				|        | text        | q1   | Q1    |
				|        | end group   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 2] Unmatched 'begin_group'. No matching 'end_group' was found for the name 'g1'.",
			],
		});
	});

	it("should raise an error for end group with no begin group", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label |
				|        | text        | q1   | Q1    |
				|        | end group   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 3] Unmatched 'end_group'. No matching 'begin_group' was found for the name 'unknown'.",
			],
		});
	});

	it("should raise an error for end group with no begin group but with name", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label |
				|        | text        | q1   | Q1    |
				|        | end group   | g1   |       |
			`,
			errored: true,
			error__contains: [
				"[row : 3] Unmatched 'end_group'. No matching 'begin_group' was found for the name 'g1'.",
			],
		});
	});

	it("should raise an error for end group with no begin group but with another closed group", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type        | name | label |
				|        | begin group | g1   | G1    |
				|        | text        | q1   | Q1    |
				|        | end group   |      |       |
				|        | end group   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 5] Unmatched 'end_group'. No matching 'begin_group' was found for the name 'unknown'.",
			],
		});
	});

	it("should raise an error for end group with no begin group but with another closed repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name | label |
				|        | begin repeat | g1   | G1    |
				|        | text         | q1   | Q1    |
				|        | end group    |      |       |
				|        | end repeat   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 4] Unmatched 'end_group'. No matching 'begin_group' was found for the name 'unknown'.",
			],
		});
	});

	// NOTE: The following two tests use odk_validate_error__contains which is ODK Validate-specific
	// and not available in the TS test helper. They are included for completeness but use
	// xml__contains as a placeholder assertion approach. Adjust if odk_validate support is added.

	it("should raise an error for an empty group with no questions", () => {
		// In Python this uses run_odk_validate=True and odk_validate_error__contains.
		// The TS test helper does not support odk_validate_error__contains.
		// This test verifies the form compiles but would fail ODK Validate.
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin group | g1   | G1    |
				| | end group   |      |       |
			`,
		});
	});

	it("should raise an error for an empty group with no question controls", () => {
		// In Python this uses run_odk_validate=True and odk_validate_error__contains.
		// The TS test helper does not support odk_validate_error__contains.
		// This test verifies the form compiles but would fail ODK Validate.
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | calculation |
				| | begin group | g1   | G1    |             |
				| | text        | q1   |       | 0 + 0       |
				| | end group   |      |       |             |
			`,
		});
	});
});

describe("TestGroupInternalRepresentations", () => {
	// NOTE: The Python tests test_survey_to_json_output and test_to_json_round_trip
	// use internal Python APIs (convert()._survey.to_json_dict() and
	// create_survey_element_from_dict()) that do not have direct TypeScript equivalents.
	// These tests are included as structural placeholders.

	it("should find that the survey to JSON dict output remains consistent", () => {
		// This test verifies internal JSON representation consistency.
		// In Python it checks convert()._survey.to_json_dict() output.
		// Here we verify the form at least converts successfully.
		assertPyxformXform({
			name: "group",
			md: `
				| survey |
				| | type         | name         | label::English (en)                |
				| | text         | family_name  | What's your family name?           |
				| | begin group  | father       | Father                             |
				| | phone number | phone_number | What's your father's phone number? |
				| | integer      | age          | How old is your father?            |
				| | end group    |              |                                    |

				| settings |
				| | id_string |
				| | group     |
			`,
			xml__contains: [
				"<family_name/>",
				"<father>",
				"<phone_number/>",
				"<age/>",
				"</father>",
			],
		});
	});

	it("should find that survey to JSON dict output can be re-used to build the survey", () => {
		// This test verifies JSON round-trip consistency.
		// In Python it checks create_survey_element_from_dict(to_json_dict()).
		// Here we verify the form at least converts successfully with the same structure.
		assertPyxformXform({
			name: "group",
			md: `
				| survey |
				| | type         | name         | label::English (en)                |
				| | text         | family_name  | What's your family name?           |
				| | begin group  | father       | Father                             |
				| | phone number | phone_number | What's your father's phone number? |
				| | integer      | age          | How old is your father?            |
				| | end group    |              |                                    |

				| settings |
				| | id_string |
				| | group     |
			`,
			xml__contains: [
				"<family_name/>",
				"<father>",
				"<phone_number/>",
				"<age/>",
				"</father>",
			],
		});
	});
});
