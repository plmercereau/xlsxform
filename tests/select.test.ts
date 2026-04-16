/**
 * Port of tests related to select_one and select_multiple questions,
 * including external instances for selects.
 *
 * Sources:
 * - Original select.test.ts
 * - select-extended.test.ts
 * - pyxform/tests/test_external_instances_for_selects.py
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("SelectTests", () => {
	it("should output a select_one question with choices", () => {
		assertPyxformXform({
			md: `
				| survey  |
				|         | type              | name | label    |
				|         | select_one colors | q1   | Color?   |
				| choices |
				|         | list_name | name  | label  |
				|         | colors    | red   | Red    |
				|         | colors    | blue  | Blue   |
				|         | colors    | green | Green  |
			`,
			xml__contains: ["<select1"],
		});
	});

	it("should output choices as itemset", () => {
		assertPyxformXform({
			md: `
				| survey  |
				|         | type              | name | label    |
				|         | select_one colors | q1   | Color?   |
				| choices |
				|         | list_name | name  | label  |
				|         | colors    | red   | Red    |
				|         | colors    | blue  | Blue   |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:select1[@ref='/test_name/q1']",
			],
		});
	});

	it("should create a static instance for choice list", () => {
		assertPyxformXform({
			md: `
				| survey  |
				|         | type              | name | label    |
				|         | select_one colors | q1   | Color?   |
				| choices |
				|         | list_name | name  | label  |
				|         | colors    | red   | Red    |
				|         | colors    | blue  | Blue   |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance[@id='colors']",
			],
		});
	});

	it("should output select_multiple", () => {
		assertPyxformXform({
			md: `
				| survey  |
				|         | type                   | name | label   |
				|         | select_multiple colors | q1   | Colors? |
				| choices |
				|         | list_name | name  | label  |
				|         | colors    | red   | Red    |
				|         | colors    | blue  | Blue   |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:select[@ref='/test_name/q1']",
			],
		});
	});

	it("should output a note question", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label      |
				|        | note | n1   | Some note  |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/test_name/n1' and @readonly='true()']",
			],
		});
	});

	it("should output an integer question", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type    | name | label        |
				|        | integer | q1   | Enter number |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/test_name/q1' and @type='int']",
			],
		});
	});

	it("should output a decimal question", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type    | name | label           |
				|        | decimal | q1   | Enter decimal   |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/test_name/q1' and @type='decimal']",
			],
		});
	});

	it("should output a date question", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label        |
				|        | date | q1   | Enter date   |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/test_name/q1' and @type='date']",
			],
		});
	});

	it("should output a calculate question", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type      | name | label | calculation |
				|        | calculate | c1   |       | 1 + 1      |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:bind[@nodeset='/test_name/c1' and @calculate='1 + 1']",
			],
		});
	});
});

describe("SelectExtendedTests", () => {
	it("should handle select_one with choice_filter", () => {
		assertPyxformXform({
			md: `
				| survey  |
				|         | type              | name   | label  | choice_filter    |
				|         | text              | q0     | Q0     |                  |
				|         | select_one colors | q1     | Color  | \${q0} = cf      |
				| choices |
				|         | list_name | name  | label | cf  |
				|         | colors    | red   | Red   | a   |
				|         | colors    | blue  | Blue  | b   |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance[@id='colors']",
			],
		});
	});

	it("should handle select_one or_other", () => {
		assertPyxformXform({
			md: `
				| survey  |
				|         | type                       | name | label |
				|         | select_one yes_no or_other | q1   | Q1    |
				| choices |
				|         | list_name | name | label |
				|         | yes_no    | yes  | Yes   |
				|         | yes_no    | no   | No    |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance[@id='yes_no']",
			],
		});
	});

	it("should handle select_multiple with multiple choice lists", () => {
		assertPyxformXform({
			md: `
				| survey  |
				|         | type                    | name | label   |
				|         | select_multiple fruits  | q1   | Fruits  |
				|         | select_multiple vegs    | q2   | Veggies |
				| choices |
				|         | list_name | name   | label   |
				|         | fruits    | apple  | Apple   |
				|         | fruits    | banana | Banana  |
				|         | vegs      | carrot | Carrot  |
				|         | vegs      | pea    | Pea     |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance[@id='fruits']",
				"/h:html/h:head/x:model/x:instance[@id='vegs']",
				"/h:html/h:body/x:select[@ref='/test_name/q1']",
				"/h:html/h:body/x:select[@ref='/test_name/q2']",
			],
		});
	});

	it("should handle select_one with numeric choice names", () => {
		assertPyxformXform({
			md: `
				| survey  |
				|         | type               | name | label |
				|         | select_one ratings | q1   | Rate  |
				| choices |
				|         | list_name | name | label  |
				|         | ratings   | 1    | Poor   |
				|         | ratings   | 2    | Fair   |
				|         | ratings   | 3    | Good   |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance[@id='ratings']/x:root/x:item/x:name[text()='1']",
				"/h:html/h:head/x:model/x:instance[@id='ratings']/x:root/x:item/x:name[text()='3']",
			],
		});
	});
});

describe("TestSelectFromFile", () => {
	/**
	 * Helper to build XPath for model external instance and bind.
	 */
	function modelExternalInstanceAndBind(
		_qType: string,
		qName: string,
		qFile: string,
	): string {
		const fileId = qFile.replace(/\.[^.]+$/, "");
		const jrPath = qFile.endsWith(".csv") ? "file-csv" : "file";
		return `
		/h:html/h:head/x:model[
		  ./x:instance[
		    @id='${fileId}'
		    and @src='jr://${jrPath}/${qFile}'
		  ]
		  and ./x:bind[
		    @nodeset='/test/${qName}'
		    and @type="string"
		  ]
		]
		`;
	}

	/**
	 * Helper to build XPath for body itemset nodeset and refs.
	 */
	function bodyItemsetNodesetAndRefs(
		qType: string,
		qName: string,
		qFile: string,
		value: string,
		label: string,
		nodesetPred = "",
	): string {
		const fileId = qFile.replace(/\.[^.]+$/, "");
		return `
		/h:html/h:body/x:${qType}[@ref='/test/${qName}']
		  /x:itemset[
		    @nodeset="instance('${fileId}')/root/item${nodesetPred}"
		    and ./x:value[@ref='${value}']
		    and ./x:label[@ref='${label}']
		  ]
		`;
	}

	const testArgs: Array<{
		ext: string;
		cityFile: string;
		subsFile: string;
		cityType: string;
		subsType: string;
	}> = [
		{
			ext: ".csv",
			cityFile: "cities.csv",
			subsFile: "suburbs.csv",
			cityType: "select1",
			subsType: "select",
		},
		{
			ext: ".xml",
			cityFile: "cities.xml",
			subsFile: "suburbs.xml",
			cityType: "select1",
			subsType: "select",
		},
		{
			ext: ".geojson",
			cityFile: "cities.geojson",
			subsFile: "suburbs.geojson",
			cityType: "select1",
			subsType: "select",
		},
	];

	describe("test_no_params_no_filters", () => {
		for (const { ext, cityFile, subsFile, cityType, subsType } of testArgs) {
			it(`should find internal instance referencing the file (${ext})`, () => {
				const expectedValueRef = ext === ".geojson" ? "id" : "name";
				const expectedLabelRef = ext === ".geojson" ? "title" : "label";

				assertPyxformXform({
					name: "test",
					md: `
						| survey |                                          |         |         |
						|        | type                                     | name    | label   |
						|        | select_one_from_file cities${ext}       | city    | City    |
						|        | select_multiple_from_file suburbs${ext} | suburbs | Suburbs |
					`,
					xml__xpath_match: [
						modelExternalInstanceAndBind(cityType, "city", cityFile),
						modelExternalInstanceAndBind(subsType, "suburbs", subsFile),
						bodyItemsetNodesetAndRefs(cityType, "city", cityFile, expectedValueRef, expectedLabelRef),
						bodyItemsetNodesetAndRefs(subsType, "suburbs", subsFile, expectedValueRef, expectedLabelRef),
					],
				});
			});
		}
	});

	describe("test_with_params_no_filters", () => {
		for (const { ext, cityFile, subsFile, cityType, subsType } of testArgs) {
			it(`should find that parameters value/label override defaults (${ext})`, () => {
				assertPyxformXform({
					name: "test",
					md: `
						| survey |                                          |         |         |                      |
						|        | type                                     | name    | label   | parameters           |
						|        | select_one_from_file cities${ext}       | city    | City    | value=val, label=lbl |
						|        | select_multiple_from_file suburbs${ext} | suburbs | Suburbs | value=val, label=lbl |
					`,
					xml__xpath_match: [
						modelExternalInstanceAndBind(cityType, "city", cityFile),
						modelExternalInstanceAndBind(subsType, "suburbs", subsFile),
						bodyItemsetNodesetAndRefs(cityType, "city", cityFile, "val", "lbl"),
						bodyItemsetNodesetAndRefs(subsType, "suburbs", subsFile, "val", "lbl"),
					],
				});
			});
		}
	});

	describe("test_no_params_with_filters", () => {
		for (const { ext, cityFile, subsFile, cityType, subsType } of testArgs) {
			it(`should find that choice_filter adds a predicate to the itemset (${ext})`, () => {
				const expectedValueRef = ext === ".geojson" ? "id" : "name";
				const expectedLabelRef = ext === ".geojson" ? "title" : "label";

				assertPyxformXform({
					name: "test",
					md: `
						| survey |                                          |         |         |                |
						|        | type                                     | name    | label   | choice_filter  |
						|        | select_one_from_file cities${ext}       | city    | City    |                |
						|        | select_multiple_from_file suburbs${ext} | suburbs | Suburbs | city=\${city} |
					`,
					xml__xpath_match: [
						modelExternalInstanceAndBind(cityType, "city", cityFile),
						modelExternalInstanceAndBind(subsType, "suburbs", subsFile),
						bodyItemsetNodesetAndRefs(cityType, "city", cityFile, expectedValueRef, expectedLabelRef),
						bodyItemsetNodesetAndRefs(subsType, "suburbs", subsFile, expectedValueRef, expectedLabelRef, "[city= /test/city ]"),
					],
				});
			});
		}
	});

	describe("test_with_params_with_filters", () => {
		for (const { ext, cityFile, subsFile, cityType, subsType } of testArgs) {
			it(`should find updated value/label refs and predicate in itemset (${ext})`, () => {
				assertPyxformXform({
					name: "test",
					md: `
						| survey |                                          |         |         |                |                      |
						|        | type                                     | name    | label   | choice_filter  | parameters           |
						|        | select_one_from_file cities${ext}       | city    | City    |                | value=val, label=lbl |
						|        | select_multiple_from_file suburbs${ext} | suburbs | Suburbs | city=\${city} | value=val, label=lbl |
					`,
					xml__xpath_match: [
						modelExternalInstanceAndBind(cityType, "city", cityFile),
						modelExternalInstanceAndBind(subsType, "suburbs", subsFile),
						bodyItemsetNodesetAndRefs(cityType, "city", cityFile, "val", "lbl"),
						bodyItemsetNodesetAndRefs(subsType, "suburbs", subsFile, "val", "lbl", "[city= /test/city ]"),
					],
				});
			});
		}
	});

	describe("test_param_value_and_label_validation", () => {
		const qTypes = ["select_one_from_file", "select_multiple_from_file"];
		const extensions = [".xml", ".csv", ".geojson"];
		const goodParams = [
			"value=val",
			"value=VAL",
			"value=_val",
			"value=val3",
			"label=lb-l",
			"value=val_",
			"label=lbl..",
		];
		const badParams = [
			{ param: "value=7val", name: "value" },
			{ param: "value=-VAL", name: "value" },
			{ param: "value=.val", name: "value" },
			{ param: "value=*val3", name: "value" },
			{ param: "label=lb-l%", name: "label" },
			{ param: "value=val_#", name: "value" },
			{ param: "label=lbl.()", name: "label" },
		];

		for (const qType of qTypes) {
			for (const ext of extensions) {
				for (const param of goodParams) {
					it(`should accept good param ${param} for ${qType} with ${ext}`, () => {
						assertPyxformXform({
							md: `
								| survey |               |         |         |            |
								|        | type          | name    | label   | parameters |
								|        | ${qType} cities${ext} | city    | City    | ${param}        |
							`,
						});
					});
				}
				for (const { param, name } of badParams) {
					it(`should reject bad param ${param} for ${qType} with ${ext}`, () => {
						assertPyxformXform({
							md: `
								| survey |               |         |         |            |
								|        | type          | name    | label   | parameters |
								|        | ${qType} cities${ext} | city    | City    | ${param}        |
							`,
							errored: true,
							error__contains: [
								`parameters (${name})`,
							],
						});
					});
				}
			}
		}
	});

	describe("test_param_value_case_preserved", () => {
		for (const { ext, cityFile, cityType } of testArgs) {
			it(`should preserve case in parameter values (${ext})`, () => {
				assertPyxformXform({
					name: "test",
					md: `
						| survey |                                        |         |         |                      |
						|        | type                                   | name    | label   | parameters           |
						|        | select_one_from_file cities${ext}       | city    | City    | value=VAL, label=lBl |
					`,
					xml__xpath_match: [
						modelExternalInstanceAndBind(cityType, "city", cityFile),
						bodyItemsetNodesetAndRefs(cityType, "city", cityFile, "VAL", "lBl"),
					],
				});
			});
		}
	});

	describe("test_expected_error_message", () => {
		const selectTypes = ["select_one_from_file", "select_multiple_from_file"];
		const badExts = ["", ".exe", ".sav", ".pdf"];

		for (const selectType of selectTypes) {
			for (const ext of badExts) {
				it(`should error for unsupported file extension: ${selectType} cities${ext}`, () => {
					assertPyxformXform({
						md: `
							| survey |                      |      |       |
							|        | type                 | name | label |
							|        | ${selectType} cities${ext} | city | City  |
						`,
						errored: true,
						error__contains: [
							`should end with`,
						],
					});
				});
			}
		}
	});
});

describe("TestSelectOneExternal", () => {
	const allChoices = `
		| choices |           |      |       |
		|         | list_name | name | label |
		|         | state     | nsw  | NSW   |
		|         | state     | vic  | VIC   |
		| external_choices |           |           |       |           |
		|                  | list_name | name      | state | city      |
		|                  | city      | Sydney    | nsw   |           |
		|                  | city      | Melbourne | vic   |           |
		|                  | suburb    | Balmain   | nsw   | sydney    |
		|                  | suburb    | Footscray | vic   | melbourne |
	`;

	it("test_with_params_no_filters - should error since value not a supported param", () => {
		assertPyxformXform({
			name: "test",
			md: `
				| survey |                            |        |        |                      |
				|        | type                       | name   | label  | parameters           |
				|        | select_one state           | state  | State  |                      |
				|        | select_one_external city   | city   | City   | value=val, label=lbl |
				|        | select_one_external suburb | suburb | Suburb | value=val, label=lbl |
			` + allChoices,
			errored: true,
			error__contains: [
				"invalid parameter",
			],
		});
	});

	it("test_no_params_with_filters - should generate input()s referencing external itemsets", () => {
		assertPyxformXform({
			md: `
				| survey |                            |        |        |                                 |
				|        | type                       | name   | label  | choice_filter                   |
				|        | select_one state           | state  | State  |                                 |
				|        | select_one_external city   | city   | City   | state=\${state}                  |
				|        | select_one_external suburb | suburb | Suburb | state=\${state} and city=\${city} |
			` + allChoices,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model[
				  not(./x:instance[@id='city'])
				  and not(./x:instance[@id='suburb'])
				  and ./x:bind[@nodeset='/test_name/state' and @type='string']
				  and ./x:bind[@nodeset='/test_name/city' and @type='string']
				  and ./x:bind[@nodeset='/test_name/suburb' and @type='string']
				]
				`,
				// select_one generates internal select with instance and itemset
				`
				/h:html/h:head/x:model/x:instance[@id='state']/x:root[
				  ./x:item/x:name/text() = 'nsw' and ./x:item/x:label/text() = 'NSW'
				  and ./x:item/x:name/text() = 'vic' and ./x:item/x:label/text() = 'VIC'
				]
				`,
				`
				/h:html/h:body/x:select1[
				  @ref = '/test_name/state'
				  and ./x:itemset
				  and not(./x:item)
				]
				`,
				// select_one_external generates input referencing itemsets.csv
				`
				/h:html/h:body[.
				  /x:input[
				    @ref='/test_name/city'
				    and @query="instance('city')/root/item[state= /test_name/state ]"
				    and ./x:label[text()='City']
				  ]
				  and ./x:input[
				    @ref='/test_name/suburb'
				    and @query="instance('suburb')/root/item[state= /test_name/state  and city= /test_name/city ]"
				    and ./x:label[text()='Suburb']
				  ]
				]
				`,
			],
		});
	});

	it("test_with_params_with_filters - should error since value not a supported param", () => {
		assertPyxformXform({
			name: "test",
			md: `
				| survey |                            |        |        |                                 |                      |
				|        | type                       | name   | label  | choice_filter                   | parameters           |
				|        | select_one state           | state  | State  |                                 |                      |
				|        | select_one_external city   | city   | City   | state=\${state}                  | value=val, label=lbl |
				|        | select_one_external suburb | suburb | Suburb | state=\${state} and city=\${city} | value=val, label=lbl |
			` + allChoices,
			errored: true,
			error__contains: [
				"invalid parameter",
			],
		});
	});

	it("test_list_name_not_in_external_choices_sheet_raises_error", () => {
		assertPyxformXform({
			md: `
				| survey |                             |        |        |                                 |
				|        | type                        | name   | label  | choice_filter                   |
				|        | select_one state            | state  | State  |                                 |
				|        | select_one_external city    | city   | City   | state=\${state}                  |
				|        | select_one_external suburby | suburb | Suburb | state=\${state} and city=\${city} |
			` + allChoices,
			errored: true,
			error__contains: ["List name not in external choices sheet: suburby"],
		});
	});
});
