/**
 * Port of test_loop.py - Loop tests.
 */

import { describe, expect, it } from "vitest";
import { convert } from "../src/xls2xform.js";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestLoopOutput", () => {
	it("should find that each item in the loop is repeated for each loop choice", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type               | name | label             |
				|        | begin_loop over c1 | l1   |                   |
				|        | integer            | q1   | Age               |
				|        | select_one c2      | q2   | Size of %(label)s |
				|        | end_loop           |      |                   |

				| choices |
				|         | list_name | name   | label   |
				|         | c1        | thing1 | Thing 1 |
				|         | c1        | thing2 | Thing 2 |
				|         | c2        | type1  | Big     |
				|         | c2        | type2  | Small   |
			`,
			xml__xpath_match: [
				// Instance
				"/h:html/h:head/x:model/x:instance/x:test_name/x:l1/x:thing1/x:q1",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:l1/x:thing1/x:q2",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:l1/x:thing2/x:q1",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:l1/x:thing2/x:q2",
				// Bind
				`/h:html/h:head/x:model/x:bind[
					@nodeset='/test_name/l1/thing1/q1'
					and @type='int'
				]`,
				`/h:html/h:head/x:model/x:bind[
					@nodeset='/test_name/l1/thing1/q2'
					and @type='string'
				]`,
				`/h:html/h:head/x:model/x:bind[
					@nodeset='/test_name/l1/thing1/q1'
					and @type='int'
				]`,
				`/h:html/h:head/x:model/x:bind[
					@nodeset='/test_name/l1/thing1/q1'
					and @type='int'
				]`,
				// Control
				`
				/h:html/h:body/x:group[@ref = '/test_name/l1']/x:group[
				  @ref = '/test_name/l1/thing1'
				  and ./x:label = 'Thing 1'
				  and ./x:input[
				        @ref = '/test_name/l1/thing1/q1'
				        and ./x:label = 'Age'
				      ]
				  and ./x:select1[
				        @ref = '/test_name/l1/thing1/q2'
				        and ./x:label = 'Size of Thing 1'
				        and ./x:itemset[
				              @nodeset = "instance('c2')/root/item"
				              and ./x:value[@ref = 'name']
				              and ./x:label[@ref = 'label']
				            ]
				      ]
				]
				`,
				`
				/h:html/h:body/x:group[@ref = '/test_name/l1']/x:group[
				  @ref = '/test_name/l1/thing2'
				  and ./x:label = 'Thing 2'
				  and ./x:input[
				        @ref = '/test_name/l1/thing2/q1'
				        and ./x:label = 'Age'
				      ]
				  and ./x:select1[
				        @ref = '/test_name/l1/thing2/q2'
				        and ./x:label = 'Size of Thing 2'
				        and ./x:itemset[
				              @nodeset = "instance('c2')/root/item"
				              and ./x:value[@ref = 'name']
				              and ./x:label[@ref = 'label']
				            ]
				      ]
				]
				`,
			],
		});
	});

	it("should find that using a group in a loop works", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type               | name | label             |
				|        | begin_loop over c1 | l1   |                   |
				|        | begin_group        | g1   |                   |
				|        | integer            | q1   | Age               |
				|        | select_one c2      | q2   | Size of %(label)s |
				|        | end_group          |      |                   |
				|        | end_loop           |      |                   |

				| choices |
				|         | list_name | name   | label   |
				|         | c1        | thing1 | Thing 1 |
				|         | c1        | thing2 | Thing 2 |
				|         | c2        | type1  | Big     |
				|         | c2        | type2  | Small   |
			`,
			xml__xpath_match: [
				// Instance
				"/h:html/h:head/x:model/x:instance/x:test_name/x:l1/x:thing1/x:g1/x:q1",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:l1/x:thing1/x:g1/x:q2",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:l1/x:thing2/x:g1/x:q1",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:l1/x:thing2/x:g1/x:q2",
				// Bind
				`/h:html/h:head/x:model/x:bind[
					@nodeset='/test_name/l1/thing1/g1/q1'
					and @type='int'
				]`,
				`/h:html/h:head/x:model/x:bind[
					@nodeset='/test_name/l1/thing1/g1/q2'
					and @type='string'
				]`,
				`/h:html/h:head/x:model/x:bind[
					@nodeset='/test_name/l1/thing1/g1/q1'
					and @type='int'
				]`,
				`/h:html/h:head/x:model/x:bind[
					@nodeset='/test_name/l1/thing1/g1/q1'
					and @type='int'
				]`,
				// Control
				// TODO: name/label substitution doesn't work with nested group
				`
				/h:html/h:body/x:group[@ref = '/test_name/l1']/x:group[
				  @ref = '/test_name/l1/thing1'
				  and ./x:label = 'Thing 1'
				]/x:group[
				  @ref = '/test_name/l1/thing1/g1'
				  and ./x:input[
				        @ref = '/test_name/l1/thing1/g1/q1'
				        and ./x:label = 'Age'
				      ]
				  and ./x:select1[
				        @ref = '/test_name/l1/thing1/g1/q2'
				        and ./x:label = 'Size of %(label)s'
				        and ./x:itemset[
				              @nodeset = "instance('c2')/root/item"
				              and ./x:value[@ref = 'name']
				              and ./x:label[@ref = 'label']
				            ]
				      ]
				]
				`,
				`
				/h:html/h:body/x:group[@ref = '/test_name/l1']/x:group[
				  @ref = '/test_name/l1/thing2'
				  and ./x:label = 'Thing 2'
				]/x:group[
				  @ref = '/test_name/l1/thing2/g1'
				  and ./x:input[
				        @ref = '/test_name/l1/thing2/g1/q1'
				        and ./x:label = 'Age'
				      ]
				  and ./x:select1[
				        @ref = '/test_name/l1/thing2/g1/q2'
				        and ./x:label = 'Size of %(label)s'
				        and ./x:itemset[
				              @nodeset = "instance('c2')/root/item"
				              and ./x:value[@ref = 'name']
				              and ./x:label[@ref = 'label']
				            ]
				      ]
				]
				`,
			],
		});
	});

	it("should find a group control with a child label element and no warnings for label ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type               | name | label |
				| | begin_loop over c1 | g1   | G1    |
				| | text               | q1   | Q1    |
				| | end_loop           |      |       |

				| choices |
				| | list_name | name | label |
				| | c1        | n1   | N1    |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				// Primary loop group.
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
				// Choice loop group.
				`
				/h:html/h:body/x:group[@ref='/test_name/g1']/x:group[
				  @ref='/test_name/g1/n1'
				  and count(@*) = 1
				  and ./x:label[
				    not(@ref)
				    and text()='N1'
				  ]
				]
				`,
			],
		});
	});

	it("should find a group control with no child label element and no warnings for no label ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type               | name | label |
				| | begin_loop over c1 | g1   |       |
				| | text               | q1   | Q1    |
				| | end_loop           |      |       |

				| choices |
				| | list_name | name | label |
				| | c1        | n1   | N1    |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				// Primary loop group.
				`
				/h:html/h:body/x:group[
				  @ref='/test_name/g1'
				  and count(@*) = 1
				  and not(./x:label)
				]
				`,
				// Choice loop group.
				`
				/h:html/h:body/x:group[@ref='/test_name/g1']/x:group[
				  @ref='/test_name/g1/n1'
				  and count(@*) = 1
				  and ./x:label[
				    not(@ref)
				    and text()='N1'
				  ]
				]
				`,
			],
		});
	});

	it("should find a group control with a child label element and no warnings for label translated ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type               | name | label::English (en) |
				| | begin_loop over c1 | g1   | G1                  |
				| | text               | q1   | Q1                  |
				| | end_loop           |      |                     |

				| choices |
				| | list_name | name | label::English (en) |
				| | c1        | n1   | N1                  |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				// Primary loop group.
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
				// Choice loop group.
				`
				/h:html/h:body/x:group[@ref='/test_name/g1']/x:group[
				  @ref='/test_name/g1/n1'
				  and count(@*) = 1
				  and ./x:label[
				    @ref="jr:itext('/test_name/g1/n1:label')"
				    and not(text())
				  ]
				]
				`,
			],
		});
	});

	it("should find a group control with no child label element and no warnings for no label translated ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type               | name | label::English (en) |
				| | begin_loop over c1 | g1   |                     |
				| | text               | q1   | Q1                  |
				| | end_loop           |      |                     |

				| choices |
				| | list_name | name | label::English (en) |
				| | c1        | n1   | N1                  |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				// Primary loop group.
				`
				/h:html/h:body/x:group[
				  @ref='/test_name/g1'
				  and count(@*) = 1
				  and not(./x:label)
				]
				`,
				// Choice loop group.
				`
				/h:html/h:body/x:group[@ref='/test_name/g1']/x:group[
				  @ref='/test_name/g1/n1'
				  and count(@*) = 1
				  and ./x:label[
				    @ref="jr:itext('/test_name/g1/n1:label')"
				    and not(text())
				  ]
				]
				`,
			],
		});
	});

	it("should find a group control with a child label element and no warnings for label appearance ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type               | name | label | appearance |
				| | begin_loop over c1 | g1   | G1    | field-list |
				| | text               | q1   | Q1    |            |
				| | end_loop           |      |       |            |

				| choices |
				| | list_name | name | label |
				| | c1        | n1   | N1    |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				// Primary loop group.
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
				// Choice loop group.
				`
				/h:html/h:body/x:group[@ref='/test_name/g1']/x:group[
				  @ref='/test_name/g1/n1'
				  and count(@*) = 1
				  and ./x:label[
				    not(@ref)
				    and text()='N1'
				  ]
				]
				`,
			],
		});
	});

	it("should find a group control with no child label element and no warnings for no label appearance ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type               | name | label | appearance |
				| | begin_loop over c1 | g1   |       | field-list |
				| | text               | q1   | Q1    |            |
				| | end_loop           |      |       |            |

				| choices |
				| | list_name | name | label |
				| | c1        | n1   | N1    |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				// Primary loop group.
				`
				/h:html/h:body/x:group[
				  @ref='/test_name/g1'
				  and @appearance='field-list'
				  and count(@*) = 2
				  and not(./x:label)
				]
				`,
				// Choice loop group.
				`
				/h:html/h:body/x:group[@ref='/test_name/g1']/x:group[
				  @ref='/test_name/g1/n1'
				  and count(@*) = 1
				  and ./x:label[
				    not(@ref)
				    and text()='N1'
				  ]
				]
				`,
			],
		});
	});

	it("should find a group control with a child label element and no warnings for label translated appearance ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type               | name | label::English (en) | appearance |
				| | begin_loop over c1 | g1   | G1                  | field-list |
				| | text               | q1   | Q1                  |            |
				| | end_loop           |      |                     |            |

				| choices |
				| | list_name | name | label::English (en) |
				| | c1        | n1   | N1                  |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				// Primary loop group.
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
				// Choice loop group.
				`
				/h:html/h:body/x:group[@ref='/test_name/g1']/x:group[
				  @ref='/test_name/g1/n1'
				  and count(@*) = 1
				  and ./x:label[
				    @ref="jr:itext('/test_name/g1/n1:label')"
				    and not(text())
				  ]
				]
				`,
			],
		});
	});

	it("should find a group control with no child label element and no warnings for no label translated appearance ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type               | name | label::English (en) | appearance |
				| | begin_loop over c1 | g1   |                     | field-list |
				| | text               | q1   | Q1                  |            |
				| | end_loop           |      |                     |            |

				| choices |
				| | list_name | name | label::English (en) |
				| | c1        | n1   | N1                  |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				// Primary loop group.
				`
				/h:html/h:body/x:group[
				  @ref='/test_name/g1'
				  and @appearance='field-list'
				  and count(@*) = 2
				  and not(./x:label)
				]
				`,
				// Choice loop group.
				`
				/h:html/h:body/x:group[@ref='/test_name/g1']/x:group[
				  @ref='/test_name/g1/n1'
				  and count(@*) = 1
				  and ./x:label[
				    @ref="jr:itext('/test_name/g1/n1:label')"
				    and not(text())
				  ]
				]
				`,
			],
		});
	});
});

describe("TestLoopParsing", () => {
	it("should find that using a repeat in a loop results in an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type               | name | label             |
				|        | begin loop over c1 | l1   |                   |
				|        | begin repeat       | r1   |                   |
				|        | integer            | q1   | Count %(label)s   |
				|        | select_one c2      | q2   | Type of %(label)s |
				|        | end repeat         |      |                   |
				|        | end loop           |      |                   |

				| choices |
				|         | list_name | name   | label   |
				|         | c1        | thing1 | Thing 1 |
				|         | c1        | thing2 | Thing 2 |
				|         | c2        | type1  | Big     |
				|         | c2        | type2  | Small   |
			`,
			errored: true,
			error__contains: [
				"[row : None] On the 'survey' sheet, the 'name' value 'r1' is invalid. Repeat names must unique anywhere in the survey, at all levels of group or repeat nesting.",
			],
		});
	});

	it("should find that using a reference variable in a loop results in an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type               | name | label           |
				|        | begin loop over c1 | l1   |                 |
				|        | integer            | q1   | Count %(label)s |
				|        | note               | q2   | Counted \${q1}   |
				|        | end loop           |      |                 |

				| choices |
				|         | list_name | name   | label   |
				|         | c1        | thing1 | Thing 1 |
				|         | c1        | thing2 | Thing 2 |
			`,
			errored: true,
			error__contains: [
				"There has been a problem trying to replace ${q1} with the XPath to the survey element named 'q1'. There are multiple survey elements named 'q1'.",
			],
		});
	});
});

describe("TestLoopInternalRepresentation", () => {
	it("should find that the internal pyxform data structure remains consistent", () => {
		const md = `
			| survey |
			| | type                       | name     | label::English                    |
			| | begin loop over my_columns | my_table | My Table                          |
			| | integer                    | count    | How many are there in this group? |
			| | end loop                   |          |                                   |

			| choices |
			| | list name  | name | label:English |
			| | my_columns | col1 | Column 1      |
			| | my_columns | col2 | Column 2      |

			| settings |
			| | id_string   |
			| | simple_loop |
		`;
		const result = convert({
			xlsform: md,
			prettyPrint: true,
			fileType: "md",
		});
		const observed = result._pyxform;
		const expected = {
			name: "data",
			title: "simple_loop",
			sms_keyword: "simple_loop",
			default_language: "default",
			id_string: "simple_loop",
			type: "survey",
			children: [
				{
					children: [
						{
							type: "integer",
							name: "count",
							label: { English: "How many are there in this group?" },
						},
					],
					type: "loop",
					name: "my_table",
					columns: [
						{ name: "col1", label: { English: "Column 1" } },
						{ name: "col2", label: { English: "Column 2" } },
					],
					label: { English: "My Table" },
				},
				{
					control: { bodyless: true },
					type: "group",
					name: "meta",
					children: [
						{
							bind: { readonly: "true()", "jr:preload": "uid" },
							type: "calculate",
							name: "instanceID",
						},
					],
				},
			],
			choices: {
				my_columns: [
					{ label: { English: "Column 1" }, name: "col1" },
					{ label: { English: "Column 2" }, name: "col2" },
				],
			},
		};
		expect(observed).toEqual(expected);
	});

	it("should find that the survey to_json_dict output remains consistent", () => {
		const md = `
			| survey |
			| | type                  | name               | label::English        | label::French    | constraint    |
			| | begin loop over types | loop_vehicle_types |                       |                  |               |
			| | integer               | total              | How many do you have? | Combien avoir?   |               |
			| | integer               | working            | How many are working? | Combien marcher? | . <= ../total |
			| | end loop              |                    |                       |                  |               |

			| choices |
			| | list_name | name        | label::English | label::French |
			| | types     | car         | Car            | Voiture       |
			| | types     | motor_cycle | Motorcycle     | Moto          |

			| settings |
			| | id_string    |
			| | another_loop |
		`;
		const result = convert({
			xlsform: md,
			prettyPrint: true,
			fileType: "md",
		});
		const observed = (result as any)._survey!.toJsonDict();
		const expected = {
			name: "data",
			id_string: "another_loop",
			sms_keyword: "another_loop",
			default_language: "default",
			title: "another_loop",
			type: "survey",
			children: [
				{
					name: "loop_vehicle_types",
					type: "group",
					children: [
						{
							label: { English: "Car", French: "Voiture" },
							name: "car",
							type: "group",
							children: [
								{
									label: {
										English: "How many do you have?",
										French: "Combien avoir?",
									},
									name: "total",
									type: "integer",
								},
								{
									bind: { constraint: ". <= ../total" },
									label: {
										English: "How many are working?",
										French: "Combien marcher?",
									},
									name: "working",
									type: "integer",
								},
							],
						},
						{
							label: { English: "Motorcycle", French: "Moto" },
							name: "motor_cycle",
							type: "group",
							children: [
								{
									label: {
										English: "How many do you have?",
										French: "Combien avoir?",
									},
									name: "total",
									type: "integer",
								},
								{
									bind: { constraint: ". <= ../total" },
									label: {
										English: "How many are working?",
										French: "Combien marcher?",
									},
									name: "working",
									type: "integer",
								},
							],
						},
					],
				},
				{
					children: [
						{
							bind: { "jr:preload": "uid", readonly: "true()" },
							name: "instanceID",
							type: "calculate",
						},
					],
					control: { bodyless: true },
					name: "meta",
					type: "group",
				},
			],
			choices: {
				types: [
					{ label: { English: "Car", French: "Voiture" }, name: "car" },
					{
						label: { English: "Motorcycle", French: "Moto" },
						name: "motor_cycle",
					},
				],
			},
		};
		expect(observed).toEqual(expected);
	});
});
