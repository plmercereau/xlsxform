/**
 * Port of test_external_instances.py
 * Test xml-external syntax and instances generated from pulldata calls.
 */

import { describe, expect, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("ExternalInstanceTests", () => {
	it("test_can__output_single_external_xml_item", () => {
		assertPyxformXform({
			md: `
				| survey |              |        |       |
				|        | type         | name   | label |
				|        | xml-external | mydata |       |
			`,
			model__contains: ['<instance id="mydata" src="jr://file/mydata.xml"/>'],
		});
	});

	it("test_can__output_single_external_csv_item", () => {
		assertPyxformXform({
			md: `
				| survey |              |        |       |
				|        | type         | name   | label |
				|        | csv-external | mydata |       |
			`,
			model__contains: [
				'<instance id="mydata" src="jr://file-csv/mydata.csv"/>',
			],
		});
	});

	it("test_cannot__use_same_external_xml_id_in_same_section", () => {
		assertPyxformXform({
			md: `
				| survey |              |        |       |
				|        | type         | name   | label |
				|        | xml-external | mydata |       |
				|        | xml-external | mydata |       |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'name' value 'mydata' is invalid. Questions, groups, and repeats must be unique within their nearest parent group or repeat, or the survey if not inside a group or repeat.",
			],
		});
	});

	it("test_can__use_unique_external_xml_in_same_section", () => {
		assertPyxformXform({
			md: `
				| survey |              |         |       |
				|        | type         | name    | label |
				|        | xml-external | mydata  |       |
				|        | xml-external | mydata2 |       |
			`,
			model__contains: [
				'<instance id="mydata" src="jr://file/mydata.xml"/>',
				'<instance id="mydata2" src="jr://file/mydata2.xml"/>',
			],
		});
	});

	it("test_can__use_unique_external_csv_in_same_section", () => {
		assertPyxformXform({
			md: `
				| survey |              |         |       |
				|        | type         | name    | label |
				|        | csv-external | mydata  |       |
				|        | csv-external | mydata2 |       |
			`,
			model__contains: [
				'<instance id="mydata" src="jr://file-csv/mydata.csv"/>',
				'<instance id="mydata2" src="jr://file-csv/mydata2.csv"/>',
			],
		});
	});

	it("test_cannot__use_same_external_xml_id_across_groups", () => {
		expect(() =>
			assertPyxformXform({
				md: `
					| survey |              |        |       |
					|        | type         | name   | label |
					|        | xml-external | mydata |       |
					|        | begin group  | g1     |       |
					|        | xml-external | mydata |       |
					|        | end group    | g1     |       |
					|        | begin group  | g2     |       |
					|        | xml-external | mydata |       |
					|        | end group    | g2     |       |
				`,
				model__contains: [],
			}),
		).toThrow(/Instance names must be unique/);
	});

	it("test_cannot__use_same_external_xml_id_across_groups_count", () => {
		expect(() =>
			assertPyxformXform({
				md: `
					| survey |              |        |       |
					|        | type         | name   | label |
					|        | xml-external | mydata |       |
					|        | begin group  | g1     |       |
					|        | xml-external | mydata |       |
					|        | end group    | g1     |       |
					|        | begin group  | g2     |       |
					|        | xml-external | mydata |       |
					|        | end group    | g2     |       |
				`,
				model__contains: [],
			}),
		).toThrow(/The name 'mydata' was found 3 time\(s\)/);
	});

	it("test_cannot__use_external_xml_and_csv_with_same_filename", () => {
		expect(() =>
			assertPyxformXform({
				md: `
					| survey |              |        |       |
					|        | type         | name   | label |
					|        | csv-external | mydata |       |
					|        | begin group  | g1     |       |
					|        | xml-external | mydata |       |
					|        | end group    | g1     |       |
				`,
				model__contains: [],
			}),
		).toThrow(/Instance names must be unique/);
	});

	it("test_cannot__use_external_xml_and_csv_with_same_filename_count", () => {
		expect(() =>
			assertPyxformXform({
				md: `
					| survey |              |        |       |
					|        | type         | name   | label |
					|        | csv-external | mydata |       |
					|        | begin group  | g1     |       |
					|        | xml-external | mydata |       |
					|        | end group    | g1     |       |
				`,
				model__contains: [],
			}),
		).toThrow(/The name 'mydata' was found 2 time\(s\)/);
	});

	it("test_can__use_unique_external_xml_across_groups", () => {
		assertPyxformXform({
			md: `
				| survey |              |         |                |
				|        | type         | name    | label          |
				|        | xml-external | mydata  |                |
				|        | begin group  | g1      |                |
				|        | xml-external | mydata1 |                |
				|        | note         | note1   | It's note-able |
				|        | end group    | g1      |                |
				|        | begin group  | g2      |                |
				|        | note         | note2   | It's note-able |
				|        | xml-external | mydata2 |                |
				|        | end group    | g2      |                |
				|        | begin group  | g3      |                |
				|        | note         | note3   | It's note-able |
				|        | xml-external | mydata3 |                |
				|        | end group    | g3      |                |
			`,
			model__contains: [
				'<instance id="mydata" src="jr://file/mydata.xml"/>',
				'<instance id="mydata1" src="jr://file/mydata1.xml"/>',
				'<instance id="mydata2" src="jr://file/mydata2.xml"/>',
				'<instance id="mydata3" src="jr://file/mydata3.xml"/>',
			],
		});
	});

	it("test_cannot__use_same_external_xml_id_with_mixed_types", () => {
		expect(() =>
			assertPyxformXform({
				md: `
					| survey |                                      |      |       |                                             |
					|        | type                                 | name | label | calculation                                 |
					|        | begin group                          | g1   |       |                                             |
					|        | xml-external                         | city |       |                                             |
					|        | end group                            | g1   |       |                                             |
					|        | xml-external                         | city |       |                                             |
					|        | begin group                          | g2   |       |                                             |
					|        | select_one_from_file cities.csv      | city | City  |                                             |
					|        | end group                            | g2   |       |                                             |
					|        | begin group                          | g3   |       |                                             |
					|        | select_multiple_from_file cities.csv | city | City  |                                             |
					|        | end group                            | g3   |       |                                             |
					|        | begin group                          | g4   |       |                                             |
					|        | calculate                            | city | City  | pulldata('fruits', 'name', 'name', 'mango') |
					|        | end group                            | g4   |       |                                             |
				`,
				model__contains: [],
			}),
		).toThrow(/The name 'city' was found 2 time\(s\)/);
	});

	it("test_can__use_same_external_csv_id_with_mixed_types", () => {
		assertPyxformXform({
			md: `
				| survey |                                      |      |       |                                             |
				|        | type                                 | name | label | calculation                                 |
				|        | begin group                          | g1   |       |                                             |
				|        | text                                 | foo  | Foo   |                                             |
				|        | csv-external                         | city |       |                                             |
				|        | end group                            | g1   |       |                                             |
				|        | begin group                          | g2   |       |                                             |
				|        | select_one_from_file cities.csv      | city | City  |                                             |
				|        | end group                            | g2   |       |                                             |
				|        | begin group                          | g3   |       |                                             |
				|        | select_multiple_from_file cities.csv | city | City  |                                             |
				|        | end group                            | g3   |       |                                             |
				|        | begin group                          | g4   |       |                                             |
				|        | text                                 | foo  | Foo   |                                             |
				|        | calculate                            | city | City  | pulldata('fruits', 'name', 'name', 'mango') |
				|        | end group                            | g4   |       |                                             |
			`,
			model__contains: ['<instance id="city" src="jr://file-csv/city.csv"/>'],
		});
	});

	it("test_can__use_all_types_together_with_unique_ids", () => {
		assertPyxformXform({
			md: `
				| survey  |                                      |       |       |                                             |               |
				|         | type                                 | name  | label | calculation                                 | choice_filter |
				|         | begin group                          | g1    |       |                                             |               |
				|         | xml-external                         | city1 |       |                                             |               |
				|         | note                                 | note1 | Note  |                                             |               |
				|         | end group                            | g1    |       |                                             |               |
				|         | begin group                          | g2    |       |                                             |               |
				|         | select_one_from_file cities.csv      | city2 | City2 |                                             |               |
				|         | end group                            | g2    |       |                                             |               |
				|         | begin group                          | g3    |       |                                             |               |
				|         | select_multiple_from_file cities.csv | city3 | City3 |                                             |               |
				|         | end group                            | g3    |       |                                             |               |
				|         | begin group                          | g4    |       |                                             |               |
				|         | calculate                            | city4 | City4 | pulldata('fruits', 'name', 'name', 'mango') |               |
				|         | note                                 | note4 | Note  |                                             |               |
				|         | end group                            | g4    |       |                                             |               |
				|         | select_one states                    | test  | Test  |                                             | true()        |
				| choices |                                      |       |       |                                             |               |
				|         | list_name                            | name  | label |                                             |               |
				|         | states                               | 1     | Pass  |                                             |               |
				|         | states                               | 2     | Fail  |                                             |               |
			`,
			model__contains: [
				'<instance id="city1" src="jr://file/city1.xml"/>',
				'<instance id="cities" src="jr://file-csv/cities.csv"/>',
				'<instance id="fruits" src="jr://file-csv/fruits.csv"/>',
			],
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:instance[@id='states']/x:root[
				  ./x:item/x:name/text() = '1' and ./x:item/x:label/text() = 'Pass'
				  and ./x:item/x:name/text() = '2' and ./x:item/x:label/text() = 'Fail'
				]
				`,
			],
		});
	});

	it("test_cannot__use_different_src_same_id__select_then_internal", () => {
		assertPyxformXform({
			md: `
				| survey  |                                 |       |       |                                    |
				|         | type                            | name  | label | choice_filter                      |
				|         | select_one_from_file states.csv | state | State |                                    |
				|         | select_one states               | test  | Test  | state=/select_from_file_test/state |
				| choices |                                 |       |       |                                    |
				|         | list_name                       | name  | label |                                    |
				|         | states                          | 1     | Pass  |                                    |
				|         | states                          | 2     | Fail  |                                    |
			`,
			errored: true,
			error__contains: [
				"Instance name: 'states', " +
					"Existing type: 'file', Existing URI: 'jr://file-csv/states.csv', " +
					"Duplicate type: 'choice', Duplicate URI: 'None', " +
					"Duplicate context: 'survey'.",
			],
		});
	});

	it("test_cannot__use_different_src_same_id__external_then_pulldata", () => {
		assertPyxformXform({
			md: `
				| survey |              |        |                  |                                             |
				|        | type         | name   | label            | calculation                                 |
				|        | begin group  | g1     |                  |                                             |
				|        | xml-external | fruits |                  |                                             |
				|        | calculate    | f_csv  | City             | pulldata('fruits', 'name', 'name', 'mango') |
				|        | note         | note   | Fruity! \${f_csv} |                                             |
				|        | end group    | g1     |                  |                                             |
			`,
			errored: true,
			error__contains: [
				"Instance name: 'fruits', " +
					"Existing type: 'external', Existing URI: 'jr://file/fruits.xml', " +
					"Duplicate type: 'pulldata', Duplicate URI: 'jr://file-csv/fruits.csv', " +
					"Duplicate context: '[type: group, name: g1]'.",
			],
		});
	});

	it("test_cannot__use_different_src_same_id__pulldata_then_external", () => {
		assertPyxformXform({
			md: `
				| survey |              |        |                  |                                             |
				|        | type         | name   | label            | calculation                                 |
				|        | begin group  | g1     |                  |                                             |
				|        | calculate    | f_csv  | City             | pulldata('fruits', 'name', 'name', 'mango') |
				|        | xml-external | fruits |                  |                                             |
				|        | note         | note   | Fruity! \${f_csv} |                                             |
				|        | end group    | g1     |                  |                                             |
			`,
			errored: true,
			error__contains: [
				"Instance name: 'fruits', " +
					"Existing type: 'pulldata', Existing URI: 'jr://file-csv/fruits.csv', " +
					"Duplicate type: 'external', Duplicate URI: 'jr://file/fruits.xml', " +
					"Duplicate context: '[type: group, name: g1]'.",
			],
		});
	});

	it("test_can__reuse_csv__selects_then_pulldata", () => {
		assertPyxformXform({
			md: `
				| survey |                                              |        |                                    |                                                   |
				|        | type                                         | name   | label                              | calculation                                       |
				|        | select_multiple_from_file pain_locations.csv | plocs  | Locations of pain this week.       |                                                   |
				|        | select_one_from_file pain_locations.csv      | pweek  | Location of worst pain this week.  |                                                   |
				|        | select_one_from_file pain_locations.csv      | pmonth | Location of worst pain this month. |                                                   |
				|        | select_one_from_file pain_locations.csv      | pyear  | Location of worst pain this year.  |                                                   |
				|        | calculate                                    | f_csv  | pd                                 | pulldata('pain_locations', 'name', 'name', 'arm') |
				|        | note                                         | note   | Arm \${f_csv}                       |                                                   |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:instance[
				  @id='pain_locations'
				  and @src='jr://file-csv/pain_locations.csv'
				]
				`,
			],
		});
	});

	it("test_can__reuse_csv__pulldata_then_selects", () => {
		assertPyxformXform({
			md: `
				| survey |                                              |        |                                    |                                                   |
				|        | type                                         | name   | label                              | calculation                                       |
				|        | calculate                                    | f_csv  | pd                                 | pulldata('pain_locations', 'name', 'name', 'arm') |
				|        | note                                         | note   | Arm \${f_csv}                       |                                                   |
				|        | select_multiple_from_file pain_locations.csv | plocs  | Locations of pain this week.       |                                                   |
				|        | select_one_from_file pain_locations.csv      | pweek  | Location of worst pain this week.  |                                                   |
				|        | select_one_from_file pain_locations.csv      | pmonth | Location of worst pain this month. |                                                   |
				|        | select_one_from_file pain_locations.csv      | pyear  | Location of worst pain this year.  |                                                   |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:instance[
				  @id='pain_locations'
				  and @src='jr://file-csv/pain_locations.csv'
				]
				`,
			],
		});
	});

	it("test_can__reuse_xml__selects_then_external", () => {
		assertPyxformXform({
			md: `
				| survey |                                              |                |                                    |
				|        | type                                         | name           | label                              |
				|        | select_multiple_from_file pain_locations.xml | plocs          | Locations of pain this week.       |
				|        | select_one_from_file pain_locations.xml      | pweek          | Location of worst pain this week.  |
				|        | select_one_from_file pain_locations.xml      | pmonth         | Location of worst pain this month. |
				|        | select_one_from_file pain_locations.xml      | pyear          | Location of worst pain this year.  |
				|        | xml-external                                 | pain_locations |                                    |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:instance[
				  @id='pain_locations'
				  and @src='jr://file/pain_locations.xml'
				]
				`,
			],
		});
	});

	it("test_can__reuse_xml__external_then_selects", () => {
		assertPyxformXform({
			md: `
				| survey |                                              |                |                                    |
				|        | type                                         | name           | label                              |
				|        | xml-external                                 | pain_locations |                                    |
				|        | select_multiple_from_file pain_locations.xml | plocs          | Locations of pain this week.       |
				|        | select_one_from_file pain_locations.xml      | pweek          | Location of worst pain this week.  |
				|        | select_one_from_file pain_locations.xml      | pmonth         | Location of worst pain this month. |
				|        | select_one_from_file pain_locations.xml      | pyear          | Location of worst pain this year.  |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:instance[
				  @id='pain_locations'
				  and @src='jr://file/pain_locations.xml'
				]
				`,
			],
		});
	});

	it("test_external_instance_pulldata_constraint", () => {
		assertPyxformXform({
			md: `
				| survey |        |         |                |                                                         |
				|        | type   | name    | label          | constraint                                              |
				|        | text   | Part_ID | Participant ID | pulldata('ID', 'ParticipantID', 'ParticipantIDValue',.) |
			`,
			xml__contains: ['<instance id="ID" src="jr://file-csv/ID.csv"/>'],
		});
	});

	it("test_external_instance_pulldata_constraint_in_expression", () => {
		assertPyxformXform({
			md: `
				| survey |        |         |                |                                                             |
				|        | type   | name    | label          | constraint                                                  |
				|        | text   | Part_ID | Participant ID | . > pulldata('ID', 'ParticipantID', 'ParticipantIDValue',.) |
			`,
			xml__contains: ['<instance id="ID" src="jr://file-csv/ID.csv"/>'],
		});
	});

	it("test_pulldata_calculate_multi_line_expression__one_call", () => {
		const qd =
			"if(${a},\n" +
			"pulldata('my_data_b', 'my_ref', 'metainstanceID', ${b}),\n" +
			"(count-selected(${c})))";
		assertPyxformXform({
			ss_structure: {
				survey: [
					{ type: "calculate", name: "a", label: "QA", calculate: "1" },
					{ type: "calculate", name: "b", label: "QB", calculate: "1" },
					{ type: "calculate", name: "c", label: "QC", calculate: "1" },
					{
						type: "calculate",
						name: "d",
						label: "QD",
						calculate: qd,
					},
				],
			},
			xml__contains: [
				'<instance id="my_data_b" src="jr://file-csv/my_data_b.csv"/>',
			],
		});
	});

	it("test_pulldata_calculate_multi_line_expression__multiple_calls", () => {
		const qd =
			"if(${a},\n" +
			"pulldata('my_data_b', 'my_ref', 'metainstanceID', ${b}),\n" +
			"pulldata('my_data_c', 'my_ref', 'metainstanceID', ${c}))";
		assertPyxformXform({
			ss_structure: {
				survey: [
					{ type: "calculate", name: "a", label: "QA", calculate: "1" },
					{ type: "calculate", name: "b", label: "QB", calculate: "1" },
					{ type: "calculate", name: "c", label: "QC", calculate: "1" },
					{
						type: "calculate",
						name: "d",
						label: "QD",
						calculate: qd,
					},
				],
			},
			xml__contains: [
				'<instance id="my_data_b" src="jr://file-csv/my_data_b.csv"/>',
				'<instance id="my_data_c" src="jr://file-csv/my_data_c.csv"/>',
			],
		});
	});

	it("test_pulldata_calculate_single_line_expression__multiple_calls", () => {
		const qd =
			"if(${a}, pulldata('my_data_b', 'my_ref', 'metainstanceID', ${b}), " +
			"pulldata('my_data_c', 'my_ref', 'metainstanceID', ${c}))";
		assertPyxformXform({
			ss_structure: {
				survey: [
					{ type: "calculate", name: "a", label: "QA", calculate: "1" },
					{ type: "calculate", name: "b", label: "QB", calculate: "1" },
					{ type: "calculate", name: "c", label: "QC", calculate: "1" },
					{ type: "calculate", name: "d", label: "QD", calculate: qd },
				],
			},
			xml__contains: [
				'<instance id="my_data_b" src="jr://file-csv/my_data_b.csv"/>',
				'<instance id="my_data_c" src="jr://file-csv/my_data_c.csv"/>',
			],
		});
	});

	it("test_external_instance_pulldata_readonly", () => {
		assertPyxformXform({
			md: `
				| survey |        |         |                |                                                         |
				|        | type   | name    | label          | readonly                                                |
				|        | text   | Part_ID | Participant ID | pulldata('ID', 'ParticipantID', 'ParticipantIDValue',.) |
			`,
			xml__contains: ['<instance id="ID" src="jr://file-csv/ID.csv"/>'],
		});
	});

	it("test_external_instance_pulldata_required", () => {
		assertPyxformXform({
			md: `
				| survey |        |         |                |                                                         |
				|        | type   | name    | label          | required                                                |
				|        | text   | Part_ID | Participant ID | pulldata('ID', 'ParticipantID', 'ParticipantIDValue',.) |
			`,
			xml__contains: ['<instance id="ID" src="jr://file-csv/ID.csv"/>'],
		});
	});

	it("test_external_instance_pulldata_relevant", () => {
		assertPyxformXform({
			md: `
				| survey |        |         |                |                                                         |
				|        | type   | name    | label          | relevant                                                |
				|        | text   | Part_ID | Participant ID | pulldata('ID', 'ParticipantID', 'ParticipantIDValue',.) |
			`,
			xml__contains: ['<instance id="ID" src="jr://file-csv/ID.csv"/>'],
		});
	});

	it("test_external_instance_pulldata_choice_filter", () => {
		assertPyxformXform({
			md: `
				| survey |                |      |       |                                                                         |
				|        | type           | name | label | choice_filter                                                           |
				|        | select_one foo | foo  | Foo   | contains(name, pulldata('ID', 'ParticipantID', 'ParticipantIDValue',.)) |
				| choices|                |      |       |                                                                         |
				|        | list_name      | name | label |                                                                         |
				|        | foo            | a    | A     |                                                                         |
			`,
			xml__contains: ['<instance id="ID" src="jr://file-csv/ID.csv"/>'],
		});
	});

	it("test_external_instance_pulldata_default", () => {
		assertPyxformXform({
			md: `
				| survey |      |      |       |                                                         |
				|        | type | name | label | default                                                 |
				|        | text | foo  | Foo   | pulldata('ID', 'ParticipantID', 'ParticipantIDValue',.) |
			`,
			xml__contains: ['<instance id="ID" src="jr://file-csv/ID.csv"/>'],
		});
	});

	it("test_external_instance_pulldata", () => {
		assertPyxformXform({
			md: `
				| survey |        |         |                |                                                         |                                                         |                                                         |
				|        | type   | name    | label          | relevant                                                | required                                                | constraint                                              |
				|        | text   | Part_ID | Participant ID | pulldata('ID', 'ParticipantID', 'ParticipantIDValue',.) | pulldata('ID', 'ParticipantID', 'ParticipantIDValue',.) | pulldata('ID', 'ParticipantID', 'ParticipantIDValue',.) |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:instance[
				  @id='ID'
				  and @src='jr://file-csv/ID.csv'
				]
				`,
			],
		});
	});

	it("test_external_instances_multiple_diff_pulldatas", () => {
		assertPyxformXform({
			md: `
				| survey |        |         |                |                                                 |                                                             |
				|        | type   | name    | label          | relevant                                        | required                                                    |
				|        | text   | Part_ID | Participant ID | pulldata('fruits', 'name', 'name_key', 'mango') | pulldata('OtherID', 'ParticipantID', ParticipantIDValue',.) |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:instance[
				  @id='fruits'
				  and @src='jr://file-csv/fruits.csv'
				]
				`,
				`
				/h:html/h:head/x:model/x:instance[
				  @id='OtherID'
				  and @src='jr://file-csv/OtherID.csv'
				]
				`,
			],
		});
	});

	it("test_mixed_quotes_and_functions_in_pulldata", () => {
		assertPyxformXform({
			name: "pulldata",
			md: `
				| survey |             |            |       |                                                            |
				|        | type        | name       | label | calculation                                                |
				|        | text        | rcid       | ID    |                                                            |
				|        | calculate   | calculate1 |       | pulldata("instance1","first","rcid",concat("Foo",\${rcid})) |
				|        | calculate   | calculate2 |       | pulldata('instance2',"last",'rcid',concat('RC',\${rcid}))   |
				|        | calculate   | calculate3 |       | pulldata('instance3','envelope','rcid',"Bar")              |
				|        | calculate   | calculate4 |       | pulldata('instance4'          ,'envelope','rcid',"Bar")    |
			`,
			xml__contains: [
				'<instance id="instance1" src="jr://file-csv/instance1.csv"/>',
				'<instance id="instance2" src="jr://file-csv/instance2.csv"/>',
				'<instance id="instance3" src="jr://file-csv/instance3.csv"/>',
				'<instance id="instance4" src="jr://file-csv/instance4.csv"/>',
			],
		});
	});
});
