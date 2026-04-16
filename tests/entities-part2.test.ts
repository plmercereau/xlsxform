/**
 * Port of the second half of test_entities.py (from test_list_name_or_dataset_alias__error onwards)
 * plus all tests from test_create_repeat.py.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

/**
 * XPath helper functions matching pyxform's tests/xpath_helpers/entities.py
 */
const xpe = {
	model_entities_version: (version: string) => `
		/h:html/h:head/x:model[@entities:entities-version='${version}']
	`,
	model_no_entities_version: () => `
		/h:html/h:head/x:model/@*[
		  not(
		    namespace-uri()='http://www.opendatakit.org/xforms/entities'
		    and local-name()='entities-version'
		  )
		]
	`,
	model_instance_meta: (
		list_name: string,
		meta_path = "",
		opts: {
			repeat?: boolean | null;
			template?: boolean | null;
			create?: boolean | null;
			update?: boolean | null;
			label?: boolean | null;
		} = {},
	) => {
		const {
			repeat = false,
			template = false,
			create = false,
			update = false,
			label = false,
		} = opts;
		const assertion = (val: boolean | null, expr: string) => {
			if (val === true) return expr;
			if (val === false) return `not(${expr})`;
			return "true()";
		};
		const templateAsserts = [assertion(template, "@jr:template")];
		const repeatAsserts = [assertion(repeat, "not(./x:instanceID)")];
		const createAsserts = [assertion(create, "@create='1'")];
		const updateAsserts = [
			assertion(update, "@update='1'"),
			assertion(update, "@baseVersion=''"),
			assertion(update, "@branchId=''"),
			assertion(update, "@trunkVersion=''"),
		];
		const labelAsserts = [assertion(label, "./x:label")];
		return `
		/h:html/h:head/x:model/x:instance/x:test_name${meta_path}[
		  ${templateAsserts.join(" and ")}
		]/x:meta[
		  ${repeatAsserts.join(" and ")}
		]/x:entity[
		  @dataset='${list_name}'
		  and @id=''
		  and ${createAsserts.join(" and ")}
		  and ${updateAsserts.join(" and ")}
		  and ${labelAsserts.join(" and ")}
		]
		`;
	},
	model_no_instance_csv: (list_name: string) => `
		/h:html/h:head/x:model[
		  not(./x:instance[@id='${list_name}' and @src='jr://file-csv/${list_name}.csv'])
		]
	`,
	model_instance_csv: (list_name: string) => `
		/h:html/h:head/x:model/x:instance[
		  @id='${list_name}' and @src='jr://file-csv/${list_name}.csv'
		]
	`,
	model_setvalue_meta_id: (meta_path = "") => `
		/h:html/h:head/x:model/x:setvalue[
		  @ref='/test_name${meta_path}/meta/entity/@id'
		  and @event='odk-instance-first-load'
		  and @value='uuid()'
		]
	`,
	model_no_setvalue_meta_id: (meta_path = "") => `
		/h:html/h:head/x:model[
		  not(./x:setvalue[@ref='/test_name${meta_path}/meta/entity/@id'])
		]
	`,
	model_bind_question_saveto: (qpath: string, saveto: string) => `
		/h:html/h:head/x:model/x:bind[
		  @nodeset='/test_name${qpath}'
		  and @entities:saveto='${saveto}'
		]
	`,
	model_bind_meta_id: (expression = "", meta_path = "") => {
		const exprPart = expression
			? `@calculate='${expression}'`
			: "not(@calculate)";
		return `
		/h:html/h:head/x:model/x:bind[
		  @nodeset='/test_name${meta_path}/meta/entity/@id'
		  and ${exprPart}
		  and @type='string'
		  and @readonly='true()'
		]
		`;
	},
	model_bind_meta_create: (expression: string, meta_path = "") => `
		/h:html/h:head/x:model/x:bind[
		  @nodeset='/test_name${meta_path}/meta/entity/@create'
		  and @calculate="${expression}"
		  and @type='string'
		  and @readonly='true()'
		]
	`,
	model_bind_meta_update: (expression: string, meta_path = "") => `
		/h:html/h:head/x:model/x:bind[
		  @nodeset='/test_name${meta_path}/meta/entity/@update'
		  and @calculate="${expression}"
		  and @type='string'
		  and @readonly='true()'
		]
	`,
	model_bind_meta_baseversion: (
		list_name: string,
		id_path: string,
		meta_path = "",
	) => `
		/h:html/h:head/x:model/x:bind[
		  @nodeset='/test_name${meta_path}/meta/entity/@baseVersion'
		  and @calculate="instance('${list_name}')/root/item[name= ${id_path} ]/__version"
		  and @type='string'
		  and @readonly='true()'
		]
	`,
	model_bind_meta_trunkversion: (
		list_name: string,
		id_path: string,
		meta_path = "",
	) => `
		/h:html/h:head/x:model/x:bind[
		  @nodeset='/test_name${meta_path}/meta/entity/@trunkVersion'
		  and @calculate="instance('${list_name}')/root/item[name= ${id_path} ]/__trunkVersion"
		  and @type='string'
		  and @readonly='true()'
		]
	`,
	model_bind_meta_branchid: (
		list_name: string,
		id_path: string,
		meta_path = "",
	) => `
		/h:html/h:head/x:model/x:bind[
		  @nodeset='/test_name${meta_path}/meta/entity/@branchId'
		  and @calculate="instance('${list_name}')/root/item[name= ${id_path} ]/__branchId"
		  and @type='string'
		  and @readonly='true()'
		]
	`,
	model_bind_meta_label: (value: string, meta_path = "") => `
		/h:html/h:head/x:model/x:bind[
		  @nodeset='/test_name${meta_path}/meta/entity/label'
		  and @calculate='${value}'
		  and @type='string'
		  and @readonly='true()'
		]
	`,
	model_bind_meta_instanceid: () => `
		/h:html/h:head/x:model/x:bind[
		  @nodeset='/test_name/meta/instanceID'
		  and @readonly='true()'
		  and @type='string'
		  and @jr:preload='uid'
		]
	`,
	body_repeat_setvalue_meta_id: (repeat_path = "", meta_path = "") => `
		/h:html/h:body${repeat_path}/x:setvalue[
		  @ref='/test_name${meta_path}/meta/entity/@id'
		  and @event='odk-new-repeat'
		  and @value='uuid()'
		]
	`,
};

/**
 * XPath helper functions matching pyxform's tests/xpath_helpers/settings.py
 */
const xps = {
	instance_meta_survey_element: (name: string) => `
		/h:html/h:head/x:model/x:instance/x:test_name/x:meta/x:${name}
	`,
};

/**
 * XPath helper functions matching pyxform's tests/xpath_helpers/questions.py
 */
const xpq = {
	setvalue: (path: string, ref: string, event: string, value = "") => {
		const valuePart = value ? `and @value="${value}" ` : "";
		return `
		/h:html/${path}/x:setvalue[
		  @ref='${ref}'
		  and @event='${event}'
		  ${valuePart}
		]
		`;
	},
};

// Error message fragment used in ENTITY_009
const ENTITY_009_MSG = (row: number, scope: string, other_row: number) =>
	`[row : ${row}] On the 'entities' sheet, the entity declaration is invalid. Each container (survey, group, repeat) may have only one entity declaration, but there are no valid containers available in the scope: '${scope}', which has been allocated to the entity on row '${other_row}'.`;

describe("TestEntitiesParsing (second half)", () => {
	it("test_list_name_or_dataset_alias__error", () => {
		const cases = ["list_name", "dataset"];
		for (const c of cases) {
			const md = `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | ${c} | label   |
				| | e1     | \${q1} |
			`;
			assertPyxformXform({ md, warnings_count: 0 });
		}
	});

	it("test_no_allocations__single_entity__ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			warnings_count: 0,
		});
	});

	it("test_no_allocations__multiple_entity__error", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
			`,
			errored: true,
			error__contains: [ENTITY_009_MSG(3, "/survey", 2)],
		});
	});

	it("test_no_allocations__multiple_entity__survey_target__error", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | \${q1} |
			`,
			errored: true,
			error__contains: [ENTITY_009_MSG(3, "/survey", 2)],
		});
	});

	it("test_no_allocations__multiple_entity__survey_target_dispersed__error", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin_group | g1   | G1    |
				| | text        | q1   | Q1    |
				| | end_group   | g1   |       |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | \${q1} |
				| | e3        | E3    |
			`,
			errored: true,
			error__contains: [ENTITY_009_MSG(4, "/survey", 2)],
		});
	});

	it("test_no_allocations__multiple_entity__no_sibling_search__error", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin_group | g1   | G1    |
				| | text        | q1   | Q1    |
				| | end_group   | g1   |       |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
			`,
			errored: true,
			error__contains: [ENTITY_009_MSG(3, "/survey", 2)],
		});
	});
});

describe("TestEntitiesOutput", () => {
	it("test_namespace__entities_not_used__not_exists", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |
			`,
			xml__excludes: [
				'xmlns:entities="http://www.opendatakit.org/xforms/entities"',
			],
		});
	});

	it("test_namespace__entities_used__exists", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__contains: [
				'xmlns:entities="http://www.opendatakit.org/xforms/entities"',
			],
		});
	});

	it("test_namespace__used_outside_main_instance", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [xpe.model_entities_version("2024.1.0")],
		});
	});

	it("test_namespace__not_used_in_main_instance", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [
				xpe.model_instance_meta("e1", "", {
					repeat: null,
					create: true,
					label: true,
				}),
			],
		});
	});

	it("test_version__not_entities__not_exists", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |
			`,
			xml__xpath_count: [
				[
					`/h:html/h:head/x:model/@*[
					  namespace-uri()='http://www.opendatakit.org/xforms/entities'
					  and local-name()='entities-version'
					]`,
					0,
				],
			],
		});
	});

	it("test_version__2024_1_0", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [xpe.model_entities_version("2024.1.0")],
		});
	});

	it("test_version__2025_1_0", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name  | label | save_to |
				| | begin_repeat | r1    | R1    |         |
				| | text         | q1    | Q1    | e1p1    |
				| | end_repeat   |       |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [xpe.model_entities_version("2025.1.0")],
		});
	});

	it("test_create__container_survey__child_of_meta", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [xps.instance_meta_survey_element("entity")],
		});
	});

	it("test_create__container_survey__child_of_meta__other_settings", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |

				| settings |
				| | instance_name |
				| | my_form       |
			`,
			xml__xpath_match: [
				xps.instance_meta_survey_element("entity"),
				xps.instance_meta_survey_element("instanceName"),
			],
		});
	});

	it("test_create__container_survey__id_attribute__exists", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [
				xpe.model_instance_meta("e1", "", {
					repeat: null,
					create: true,
					label: true,
				}),
			],
		});
	});

	it("test_create__container_survey__id_attribute__has_uuid", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [xpe.model_setvalue_meta_id()],
		});
	});

	it("test_create__container_survey__dataset_attribute__exists", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [
				xpe.model_instance_meta("e1", "", {
					repeat: null,
					create: true,
					label: true,
				}),
			],
		});
	});

	it("test_create__container_survey__dataset_attribute__has_dataset", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [
				xpe.model_instance_meta("e1", "", {
					repeat: null,
					create: true,
					label: true,
				}),
			],
		});
	});

	it("test_implicit_create_mode__survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [
				xpe.model_no_instance_csv("e1"),
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "", { create: true, label: true }),
				xpe.model_bind_meta_label("E1"),
				xpe.model_bind_meta_id(),
				xpe.model_setvalue_meta_id(),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 1]],
		});
	});

	it("test_implicit_create_mode__repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin_repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end_repeat   | r1   |       |

				| entities |
				| | list_name | label |
				| | e1        | \${q1} |
			`,
			xml__xpath_match: [
				xpe.model_no_instance_csv("e1"),
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					create: true,
					label: true,
				}),
				xpe.model_bind_meta_label(" ../../../q1 ", "/r1"),
				xpe.model_bind_meta_id("", "/r1"),
				xpe.model_setvalue_meta_id("/r1"),
				xpe.body_repeat_setvalue_meta_id(
					"/x:group/x:repeat[@nodeset='/test_name/r1']",
					"/r1",
				),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 2]],
		});
	});

	it("test_implicit_create_mode__create_if__survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label | create_if  |
				| | e1        | E1    | \${q1} = '' |
			`,
			xml__xpath_match: [
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "", { create: true, label: true }),
				xpe.model_bind_meta_label("E1"),
				xpe.model_bind_meta_id(),
				xpe.model_setvalue_meta_id(),
				xpe.model_bind_meta_create(" /test_name/q1  = ''"),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 1]],
		});
	});

	it("test_implicit_create_mode__create_if__repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin_repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end_repeat   | r1   |       |

				| entities |
				| | list_name | label | create_if  |
				| | e1        | \${q1} | \${q1} = '' |
			`,
			xml__xpath_match: [
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					create: true,
					label: true,
				}),
				xpe.model_bind_meta_label(" ../../../q1 ", "/r1"),
				xpe.model_bind_meta_id("", "/r1"),
				xpe.model_setvalue_meta_id("/r1"),
				xpe.body_repeat_setvalue_meta_id(
					"/x:group/x:repeat[@nodeset='/test_name/r1']",
					"/r1",
				),
				xpe.model_bind_meta_create(" ../../../q1  = ''", "/r1"),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 2]],
		});
	});

	// Skipping test_implicit_update_mode__instance_required__error - uses run_odk_validate

	it("test_implicit_update_mode__entity_id__survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | text         | q1   | Q1    |
				| | csv-external | e1   |       |

				| entities |
				| | list_name | entity_id |
				| | e1        | \${q1}     |
			`,
			xml__xpath_match: [
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "", { update: true }),
				xpe.model_bind_meta_id(" /test_name/q1 "),
				xpe.model_bind_meta_baseversion("e1", "/test_name/q1"),
				xpe.model_bind_meta_trunkversion("e1", "/test_name/q1"),
				xpe.model_bind_meta_branchid("e1", "/test_name/q1"),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 0]],
		});
	});

	it("test_implicit_update_mode__entity_id__repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin_repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end_repeat   | r1   |       |
				| | csv-external | e1   |       |

				| entities |
				| | list_name | entity_id |
				| | e1        | \${q1}     |
			`,
			xml__xpath_match: [
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "/x:r1", { repeat: true, update: true }),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					template: true,
					update: true,
				}),
				xpe.model_bind_meta_id(" ../../../q1 ", "/r1"),
				xpe.model_bind_meta_baseversion("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_trunkversion("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_branchid("e1", "current()/../../../q1", "/r1"),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 0]],
		});
	});

	it("test_implicit_update_mode__entity_id__with_csv_instance__survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | csv-external | e1   |       |
				| | text         | q1   | Q1    |

				| entities |
				| | list_name | entity_id |
				| | e1        | \${q1}     |
			`,
			xml__xpath_match: [
				xpe.model_instance_csv("e1"),
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "", { update: true }),
				xpe.model_bind_meta_id(" /test_name/q1 "),
				xpe.model_bind_meta_baseversion("e1", "/test_name/q1"),
				xpe.model_bind_meta_trunkversion("e1", "/test_name/q1"),
				xpe.model_bind_meta_branchid("e1", "/test_name/q1"),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 0]],
		});
	});

	it("test_implicit_update_mode__entity_id__with_csv_instance__repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | csv-external | e1   |       |
				| | begin_repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end_repeat   | r1   |       |

				| entities |
				| | list_name | entity_id |
				| | e1        | \${q1}     |
			`,
			xml__xpath_match: [
				xpe.model_instance_csv("e1"),
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "/x:r1", { repeat: true, update: true }),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					template: true,
					update: true,
				}),
				xpe.model_bind_meta_id(" ../../../q1 ", "/r1"),
				xpe.model_bind_meta_baseversion("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_trunkversion("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_branchid("e1", "current()/../../../q1", "/r1"),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 0]],
		});
	});

	it("test_implicit_update_mode__entity_id__with_label__survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | text         | q1   | Q1    |
				| | csv-external | e1   |       |

				| entities |
				| | list_name | entity_id | label |
				| | e1        | \${q1}     | E1    |
			`,
			xml__xpath_match: [
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "", { update: true, label: true }),
				xpe.model_bind_meta_id(" /test_name/q1 "),
				xpe.model_bind_meta_baseversion("e1", "/test_name/q1"),
				xpe.model_bind_meta_trunkversion("e1", "/test_name/q1"),
				xpe.model_bind_meta_branchid("e1", "/test_name/q1"),
				xpe.model_bind_meta_label("E1"),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 0]],
		});
	});

	it("test_implicit_update_mode__entity_id__with_label__repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin_repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end_repeat   | r1   |       |
				| | csv-external | e1   |       |

				| entities |
				| | list_name | entity_id | label |
				| | e1        | \${q1}     | E1    |
			`,
			xml__xpath_match: [
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					update: true,
					label: true,
				}),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					template: true,
					update: true,
					label: true,
				}),
				xpe.model_bind_meta_id(" ../../../q1 ", "/r1"),
				xpe.model_bind_meta_baseversion("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_trunkversion("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_branchid("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_label("E1", "/r1"),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 0]],
		});
	});

	it("test_implicit_update_mode__entity_id__with_other_setvalue__survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | default |
				| | text         | q1   | Q1    | uuid()  |
				| | csv-external | e1   |       |         |

				| entities |
				| | list_name | entity_id |
				| | e1        | \${q1}     |
			`,
			xml__xpath_match: [
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "", { update: true }),
				xpe.model_bind_meta_id(" /test_name/q1 "),
				xpe.model_bind_meta_baseversion("e1", "/test_name/q1"),
				xpe.model_bind_meta_trunkversion("e1", "/test_name/q1"),
				xpe.model_bind_meta_branchid("e1", "/test_name/q1"),
				xpq.setvalue(
					"h:head/x:model",
					"/test_name/q1",
					"odk-instance-first-load",
					"uuid()",
				),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 1]],
		});
	});

	it("test_implicit_update_mode__entity_id__with_other_setvalue__repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | default |
				| | begin_repeat | r1   | R1    |         |
				| | text         | q1   | Q1    | uuid()  |
				| | end_repeat   | r1   |       |         |
				| | csv-external | e1   |       |         |

				| entities |
				| | list_name | entity_id |
				| | e1        | \${q1}     |
			`,
			xml__xpath_match: [
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "/x:r1", { repeat: true, update: true }),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					template: true,
					update: true,
				}),
				xpe.model_bind_meta_id(" ../../../q1 ", "/r1"),
				xpe.model_bind_meta_baseversion("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_trunkversion("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_branchid("e1", "current()/../../../q1", "/r1"),
				xpq.setvalue(
					"h:head/x:model",
					"/test_name/r1/q1",
					"odk-instance-first-load",
					"uuid()",
				),
				xpq.setvalue(
					"h:body/x:group/x:repeat[@nodeset='/test_name/r1']",
					"/test_name/r1/q1",
					"odk-new-repeat",
					"uuid()",
				),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 2]],
		});
	});

	it("test_implicit_update_mode__update_if__survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | text         | q1   | Q1    |
				| | csv-external | e1   |       |

				| entities |
				| | list_name | entity_id | update_if   |
				| | e1        | \${q1}     | \${q1} != '' |
			`,
			xml__xpath_match: [
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "", { update: true }),
				xpe.model_bind_meta_id(" /test_name/q1 "),
				xpe.model_bind_meta_baseversion("e1", "/test_name/q1"),
				xpe.model_bind_meta_trunkversion("e1", "/test_name/q1"),
				xpe.model_bind_meta_branchid("e1", "/test_name/q1"),
				xpe.model_bind_meta_update(" /test_name/q1  != ''"),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 0]],
		});
	});

	it("test_implicit_update_mode__update_if__repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin_repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end_repeat   | r1   |       |
				| | csv-external | e1   |       |

				| entities |
				| | list_name | entity_id | update_if   |
				| | e1        | \${q1}     | \${q1} != '' |
			`,
			xml__xpath_match: [
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "/x:r1", { repeat: true, update: true }),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					template: true,
					update: true,
				}),
				xpe.model_bind_meta_id(" ../../../q1 ", "/r1"),
				xpe.model_bind_meta_baseversion("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_trunkversion("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_branchid("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_update(" ../../../q1  != ''", "/r1"),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 0]],
		});
	});

	it("test_implicit_upsert_mode__survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | text         | q1   | Q1    |
				| | csv-external | e1   |       |

				| entities |
				| | list_name | entity_id | update_if   | create_if   |
				| | e1        | \${q1}     | \${q1} != '' | \${q1} != '' |
			`,
			xml__xpath_match: [
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "", { update: true, create: true }),
				xpe.model_bind_meta_id(" /test_name/q1 "),
				xpe.model_bind_meta_baseversion("e1", "/test_name/q1"),
				xpe.model_bind_meta_trunkversion("e1", "/test_name/q1"),
				xpe.model_bind_meta_branchid("e1", "/test_name/q1"),
				xpe.model_bind_meta_update(" /test_name/q1  != ''"),
				xpe.model_bind_meta_create(" /test_name/q1  != ''"),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 0]],
		});
	});

	it("test_implicit_upsert_mode__repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin_repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end_repeat   | r1   |       |
				| | csv-external | e1   |       |

				| entities |
				| | list_name | entity_id | update_if   | create_if   |
				| | e1        | \${q1}     | \${q1} != '' | \${q1} != '' |
			`,
			xml__xpath_match: [
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					update: true,
					create: true,
				}),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					template: true,
					update: true,
					create: true,
				}),
				xpe.model_bind_meta_id(" ../../../q1 ", "/r1"),
				xpe.model_bind_meta_baseversion("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_trunkversion("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_branchid("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_update(" ../../../q1  != ''", "/r1"),
				xpe.model_bind_meta_create(" ../../../q1  != ''", "/r1"),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 0]],
		});
	});

	it("test_implicit_upsert_mode__with_label__survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | text         | q1   | Q1    |
				| | csv-external | e1   |       |

				| entities |
				| | list_name | entity_id | update_if   | create_if   | label |
				| | e1        | \${q1}     | \${q1} != '' | \${q1} != '' | E1    |
			`,
			xml__xpath_match: [
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "", {
					update: true,
					create: true,
					label: true,
				}),
				xpe.model_bind_meta_id(" /test_name/q1 "),
				xpe.model_bind_meta_baseversion("e1", "/test_name/q1"),
				xpe.model_bind_meta_trunkversion("e1", "/test_name/q1"),
				xpe.model_bind_meta_branchid("e1", "/test_name/q1"),
				xpe.model_bind_meta_update(" /test_name/q1  != ''"),
				xpe.model_bind_meta_create(" /test_name/q1  != ''"),
				xpe.model_bind_meta_label("E1"),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 0]],
		});
	});

	it("test_implicit_upsert_mode__with_label__repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin_repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end_repeat   | r1   |       |
				| | csv-external | e1   |       |

				| entities |
				| | list_name | entity_id | update_if   | create_if   | label |
				| | e1        | \${q1}     | \${q1} != '' | \${q1} != '' | E1    |
			`,
			xml__xpath_match: [
				xpe.model_bind_meta_instanceid(),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					update: true,
					create: true,
					label: true,
				}),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					template: true,
					update: true,
					create: true,
					label: true,
				}),
				xpe.model_bind_meta_id(" ../../../q1 ", "/r1"),
				xpe.model_bind_meta_baseversion("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_trunkversion("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_branchid("e1", "current()/../../../q1", "/r1"),
				xpe.model_bind_meta_update(" ../../../q1  != ''", "/r1"),
				xpe.model_bind_meta_create(" ../../../q1  != ''", "/r1"),
				xpe.model_bind_meta_label("E1", "/r1"),
			],
			xml__xpath_count: [["/h:html//x:setvalue", 0]],
		});
	});

	it("test_save_to__create__survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to |
				| | text | q1   | Q1    | e1p1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [xpe.model_bind_question_saveto("/q1", "e1p1")],
		});
	});

	it("test_save_to__create__group", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to |
				| | begin_group | g1   | G1    |         |
				| | text        | q1   | Q1    | e1p1    |
				| | end_group   | g1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [xpe.model_bind_question_saveto("/g1/q1", "e1p1")],
		});
	});

	it("test_save_to__create__repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | begin_repeat | r1   | R1    |         |
				| | text         | q1   | Q1    | e1p1    |
				| | end_repeat   | r1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [xpe.model_bind_question_saveto("/r1/q1", "e1p1")],
		});
	});

	it("test_save_to__create__repeat_group", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | begin_repeat | r1   | R1    |         |
				| | begin_group  | g1   | G1    |         |
				| | text         | q1   | Q1    | e1p1    |
				| | end_group    | g1   |       |         |
				| | end_repeat   | r1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [xpe.model_bind_question_saveto("/r1/g1/q1", "e1p1")],
		});
	});

	it("test_save_to__create__group_repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | begin_group  | g1   | G1    |         |
				| | begin_repeat | r1   | R1    |         |
				| | text         | q1   | Q1    | e1p1    |
				| | end_repeat   | r1   |       |         |
				| | end_group    | g1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [xpe.model_bind_question_saveto("/g1/r1/q1", "e1p1")],
		});
	});

	it("test_save_to__update__survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | text         | q1   | Q1    | e1p1    |
				| | csv-external | e1   |       |         |

				| entities |
				| | list_name | label | entity_id |
				| | e1        | E1    | uuid()    |
			`,
			xml__xpath_match: [xpe.model_bind_question_saveto("/q1", "e1p1")],
		});
	});

	it("test_save_to__update__group", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | begin_group  | g1   | G1    |         |
				| | text         | q1   | Q1    | e1p1    |
				| | end_group    | g1   |       |         |
				| | csv-external | e1   |       |         |

				| entities |
				| | list_name | label | entity_id |
				| | e1        | E1    | uuid()    |
			`,
			xml__xpath_match: [xpe.model_bind_question_saveto("/g1/q1", "e1p1")],
		});
	});

	it("test_save_to__update__repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | begin_repeat | r1   | R1    |         |
				| | text         | q1   | Q1    | e1p1    |
				| | end_repeat   | r1   |       |         |
				| | csv-external | e1   |       |         |

				| entities |
				| | list_name | label | entity_id |
				| | e1        | E1    | uuid()    |
			`,
			xml__xpath_match: [xpe.model_bind_question_saveto("/r1/q1", "e1p1")],
		});
	});

	it("test_save_to__update__repeat_group", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | begin_repeat | r1   | R1    |         |
				| | begin_group  | g1   | G1    |         |
				| | text         | q1   | Q1    | e1p1    |
				| | end_group    | g1   |       |         |
				| | end_repeat   | r1   |       |         |
				| | csv-external | e1   |       |         |

				| entities |
				| | list_name | label | entity_id |
				| | e1        | E1    | uuid()    |
			`,
			xml__xpath_match: [xpe.model_bind_question_saveto("/r1/g1/q1", "e1p1")],
		});
	});

	it("test_save_to__update__group_repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | begin_group  | g1   | G1    |         |
				| | begin_repeat | r1   | R1    |         |
				| | text         | q1   | Q1    | e1p1    |
				| | end_repeat   | r1   |       |         |
				| | end_group    | g1   |       |         |
				| | csv-external | e1   |       |         |

				| entities |
				| | list_name | label | entity_id |
				| | e1        | E1    | uuid()    |
			`,
			xml__xpath_match: [xpe.model_bind_question_saveto("/g1/r1/q1", "e1p1")],
		});
	});

	it("test_save_to__multiple_properties__survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to |
				| | text | q1   | Q1    | e1p1    |
				| | text | q2   | Q2    | e1p2    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [
				xpe.model_bind_question_saveto("/q1", "e1p1"),
				xpe.model_bind_question_saveto("/q2", "e1p2"),
			],
		});
	});

	it("test_save_to__multiple_properties__group", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to |
				| | begin_group | g1   | G1    |         |
				| | text        | q1   | Q1    | e1p1    |
				| | text        | q2   | Q2    | e1p2    |
				| | end_group   | g1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [
				xpe.model_bind_question_saveto("/g1/q1", "e1p1"),
				xpe.model_bind_question_saveto("/g1/q2", "e1p2"),
			],
		});
	});

	it("test_save_to__multiple_properties__repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | begin_repeat | r1   | R1    |         |
				| | text         | q1   | Q1    | e1p1    |
				| | text         | q2   | Q2    | e1p2    |
				| | end_repeat   | r1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [
				xpe.model_bind_question_saveto("/r1/q1", "e1p1"),
				xpe.model_bind_question_saveto("/r1/q2", "e1p2"),
			],
		});
	});

	it("test_save_to__multiple_properties__repeat_group", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | begin_repeat | r1   | R1    |         |
				| | begin_group  | g1   | G1    |         |
				| | text         | q1   | Q1    | e1p1    |
				| | text         | q2   | Q2    | e1p2    |
				| | end_group    | g1   |       |         |
				| | end_repeat   | r1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [
				xpe.model_bind_question_saveto("/r1/g1/q1", "e1p1"),
				xpe.model_bind_question_saveto("/r1/g1/q2", "e1p2"),
			],
		});
	});

	it("test_save_to__multiple_properties__group_repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | begin_group  | g1   | G1    |         |
				| | begin_repeat | r1   | R1    |         |
				| | text         | q1   | Q1    | e1p1    |
				| | text         | q2   | Q2    | e1p2    |
				| | end_repeat   | r1   |       |         |
				| | end_group    | g1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [
				xpe.model_bind_question_saveto("/g1/r1/q1", "e1p1"),
				xpe.model_bind_question_saveto("/g1/r1/q2", "e1p2"),
			],
		});
	});

	it("test_save_to__multiple_properties__split_groups__survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to |
				| | begin_group | g1   | G1    |         |
				| | text        | q1   | Q1    | e1p1    |
				| | end_group   | g1   |       |         |
				| | begin_group | g2   | G2    |         |
				| | text        | q2   | Q2    | e1p2    |
				| | end_group   | g2   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [
				xpe.model_instance_meta("e1", "", {
					repeat: null,
					create: true,
					label: true,
				}),
				xpe.model_bind_question_saveto("/g1/q1", "e1p1"),
				xpe.model_bind_question_saveto("/g2/q2", "e1p2"),
			],
		});
	});

	it("test_save_to__multiple_properties__split_groups__survey__with_var", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to |
				| | begin_group | g1   | G1    |         |
				| | text        | q1   | Q1    | e1p1    |
				| | text        | q2   | Q2    | e1p2    |
				| | end_group   | g1   |       |         |
				| | begin_group | g2   | G2    |         |
				| | text        | q3   | Q3    | e1p3    |
				| | text        | q4   | Q4    | e1p4    |
				| | end_group   | g2   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | \${q1} |
			`,
			xml__xpath_match: [
				xpe.model_instance_meta("e1", "", {
					repeat: null,
					create: true,
					label: true,
				}),
				xpe.model_bind_question_saveto("/g1/q1", "e1p1"),
				xpe.model_bind_question_saveto("/g1/q2", "e1p2"),
				xpe.model_bind_question_saveto("/g2/q3", "e1p3"),
				xpe.model_bind_question_saveto("/g2/q4", "e1p4"),
				xpe.model_bind_meta_label(" /test_name/g1/q1 ", ""),
			],
		});
	});

	it("test_save_to__multiple_properties__split_groups__group", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to |
				| | begin_group | g1   | G1    |         |
				| | begin_group | g2   | G2    |         |
				| | text        | q1   | Q1    | e1p1    |
				| | end_group   | g2   |       |         |
				| | begin_group | g3   | G3    |         |
				| | text        | q2   | Q2    | e1p2    |
				| | end_group   | g3   |       |         |
				| | end_group   | g1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [
				xpe.model_instance_meta("e1", "", {
					repeat: null,
					create: true,
					label: true,
				}),
				xpe.model_bind_question_saveto("/g1/g2/q1", "e1p1"),
				xpe.model_bind_question_saveto("/g1/g3/q2", "e1p2"),
			],
		});
	});

	it("test_save_to__multiple_properties__split_groups__repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | begin_repeat | r1   | R1    |         |
				| | begin_group  | g1   | G1    |         |
				| | text         | q1   | Q1    | e1p1    |
				| | end_group    | g1   |       |         |
				| | begin_group  | g2   | G2    |         |
				| | text         | q2   | Q2    | e1p2    |
				| | end_group    | g2   |       |         |
				| | end_repeat   | r1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					create: true,
					label: true,
				}),
				xpe.model_bind_question_saveto("/r1/g1/q1", "e1p1"),
				xpe.model_bind_question_saveto("/r1/g2/q2", "e1p2"),
			],
		});
	});

	it("test_save_to__multiple_properties__uneven_groups__survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to |
				| | text        | q1   | Q1    | e1p1    |
				| | begin_group | g1   | G1    |         |
				| | text        | q2   | Q2    | e1p2    |
				| | end_group   | g1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [
				xpe.model_instance_meta("e1", "", {
					repeat: null,
					create: true,
					label: true,
				}),
				xpe.model_bind_question_saveto("/q1", "e1p1"),
				xpe.model_bind_question_saveto("/g1/q2", "e1p2"),
			],
		});
	});

	it("test_save_to__multiple_properties__uneven_groups__group", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to |
				| | begin_group | g1   | G1    |         |
				| | text        | q1   | Q1    | e1p1    |
				| | begin_group | g2   | G2    |         |
				| | text        | q2   | Q2    | e1p2    |
				| | end_group   | g2   |       |         |
				| | end_group   | g1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [
				xpe.model_instance_meta("e1", "", {
					repeat: null,
					create: true,
					label: true,
				}),
				xpe.model_bind_question_saveto("/g1/q1", "e1p1"),
				xpe.model_bind_question_saveto("/g1/g2/q2", "e1p2"),
			],
		});
	});

	it("test_save_to__multiple_properties__uneven_groups__group__with_var", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to |
				| | begin_group | g1   | G1    |         |
				| | text        | q1   | Q1    | e1p1    |
				| | begin_group | g2   | G2    |         |
				| | text        | q2   | Q2    | e1p2    |
				| | end_group   | g2   |       |         |
				| | end_group   | g1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | \${q2} |
			`,
			xml__xpath_match: [
				xpe.model_instance_meta("e1", "", {
					repeat: null,
					create: true,
					label: true,
				}),
				xpe.model_bind_question_saveto("/g1/q1", "e1p1"),
				xpe.model_bind_question_saveto("/g1/g2/q2", "e1p2"),
				xpe.model_bind_meta_label(" /test_name/g1/g2/q2 ", ""),
			],
		});
	});

	it("test_save_to__multiple_properties__uneven_groups__repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | begin_repeat | r1   | R1    |         |
				| | text         | q1   | Q1    | e1p1    |
				| | begin_group  | g2   | G2    |         |
				| | text         | q2   | Q2    | e1p2    |
				| | end_group    | g2   |       |         |
				| | end_repeat   | r1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			xml__xpath_match: [
				xpe.model_instance_meta("e1", "/x:r1[not(@jr:template)]", {
					create: true,
					label: true,
					repeat: true,
				}),
				xpe.model_bind_question_saveto("/r1/q1", "e1p1"),
				xpe.model_bind_question_saveto("/r1/g2/q2", "e1p2"),
			],
		});
	});

	it("test_save_to__multiple_entities__survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to |
				| | text        | q1   | Q1    | e1#e1p1 |
				| | begin_group | g1   | G1    |         |
				| | text        | q2   | Q2    | e2#e2p1 |
				| | end_group   | g1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
			`,
			xml__xpath_match: [
				xpe.model_bind_question_saveto("/q1", "e1p1"),
				xpe.model_bind_question_saveto("/g1/q2", "e2p1"),
			],
		});
	});

	it("test_save_to__multiple_entities__group", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to |
				| | begin_group | g1   | G1    |         |
				| | text        | q1   | Q1    | e1#e1p1 |
				| | begin_group | g2   | G2    |         |
				| | text        | q2   | Q2    | e2#e2p1 |
				| | end_group   | g2   |       |         |
				| | end_group   | g1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
			`,
			xml__xpath_match: [
				xpe.model_bind_question_saveto("/g1/q1", "e1p1"),
				xpe.model_bind_question_saveto("/g1/g2/q2", "e2p1"),
			],
		});
	});

	it("test_save_to__multiple_entities__repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | begin_repeat | r1   | R1    |         |
				| | text         | q1   | Q1    | e1#e1p1 |
				| | begin_group  | g1   | G1    |         |
				| | text         | q2   | Q2    | e2#e2p1 |
				| | end_group    | g1   |       |         |
				| | end_repeat   | r1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
			`,
			xml__xpath_match: [
				xpe.model_bind_question_saveto("/r1/q1", "e1p1"),
				xpe.model_bind_question_saveto("/r1/g1/q2", "e2p1"),
			],
		});
	});

	it("test_save_to__multiple_entities__repeat_group", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | begin_repeat | r1   | R1    |         |
				| | begin_group  | g1   | G1    |         |
				| | text         | q1   | Q1    | e1#e1p1 |
				| | begin_group  | g2   | G1    |         |
				| | text         | q2   | Q2    | e2#e2p1 |
				| | end_group    | g2   |       |         |
				| | end_group    | g1   |       |         |
				| | end_repeat   | r1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
			`,
			xml__xpath_match: [
				xpe.model_bind_question_saveto("/r1/g1/q1", "e1p1"),
				xpe.model_bind_question_saveto("/r1/g1/g2/q2", "e2p1"),
			],
		});
	});

	it("test_save_to__multiple_entities__group_repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | begin_group  | g1   | G1    |         |
				| | begin_repeat | r1   | R1    |         |
				| | text         | q1   | Q1    | e1#e1p1 |
				| | begin_group  | g2   | G1    |         |
				| | text         | q2   | Q2    | e2#e2p1 |
				| | end_group    | g2   |       |         |
				| | end_repeat   | r1   |       |         |
				| | end_group    | g1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
			`,
			xml__xpath_match: [
				xpe.model_bind_question_saveto("/g1/r1/q1", "e1p1"),
				xpe.model_bind_question_saveto("/g1/r1/g2/q2", "e2p1"),
			],
		});
	});

	it("test_var__multiple_var__cross_boundary__before", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type          | name | label |
				| | begin_group   | g1   | G1    |
				| |   begin_group | g2   | G2    |
				| |     text      | q2   | Q2    |
				| |   end_group   | g2   |       |
				| | end_group     | g1   |       |
				| | begin_repeat  | r1   | R1    |
				| |   text        | q1   | Q1    |
				| | end_repeat    | r1   |       |

				| entities |
				| | list_name | label                |
				| | e1        | concat(\${q1}, \${q2}) |
			`,
			xml__xpath_match: [
				xpe.model_instance_meta("e1", "/x:r1[not(@jr:template)]", {
					create: true,
					label: true,
					repeat: true,
				}),
				xpe.model_bind_meta_label(
					"concat( ../../../q1 ,  /test_name/g1/g2/q2 )",
					"/r1",
				),
			],
		});
	});

	it("test_var__multiple_var__cross_boundary__after", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type          | name | label |
				| | begin_repeat  | r1   | R1    |
				| |   text        | q1   | Q1    |
				| | end_repeat    | r1   |       |
				| | begin_group   | g1   | G1    |
				| |   begin_group | g2   | G2    |
				| |     text      | q2   | Q2    |
				| |   end_group   | g2   |       |
				| | end_group     | g1   |       |

				| entities |
				| | list_name | label                |
				| | e1        | concat(\${q1}, \${q2}) |
			`,
			xml__xpath_match: [
				xpe.model_instance_meta("e1", "/x:r1[not(@jr:template)]", {
					create: true,
					label: true,
					repeat: true,
				}),
				xpe.model_bind_meta_label(
					"concat( ../../../q1 ,  /test_name/g1/g2/q2 )",
					"/r1",
				),
			],
		});
	});

	it("test_single_entity__no_repeats__survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to |
				| | begin_group | g1   | G1    |         |
				| | text        | q1   | Q1    | e1p1    |
				| | end_group   | g1   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | \${q1} |
			`,
			xml__xpath_match: [
				xpe.model_instance_meta("e1", "", {
					create: true,
					repeat: null,
					label: true,
				}),
				xpe.model_bind_question_saveto("/g1/q1", "e1p1"),
				xpe.model_bind_meta_label(" /test_name/g1/q1 ", ""),
			],
		});
	});
});

describe("TestEntitiesCreateRepeat", () => {
	it("test_other_controls_before__ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name  | label |
				| | begin_repeat | r1    | R1    |
				| | text         | q1    | Q1    |
				| | end_repeat   |       |       |
				| | begin_group  | g1    | G1    |
				| | text         | q2    | Q2    |
				| | end_group    |       |       |
				| | begin_repeat | r2    | R2    |
				| | text         | q3    | Q3    |
				| | end_repeat   |       |       |

				| entities |
				| | list_name | label |
				| | e1        | \${q3} |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				xpe.model_entities_version("2025.1.0"),
				xpe.model_instance_meta("e1", "/x:r2", {
					repeat: true,
					template: true,
					create: true,
					label: true,
				}),
				xpe.model_instance_meta("e1", "/x:r2", {
					repeat: true,
					create: true,
					label: true,
				}),
				xpe.model_bind_meta_id("", "/r2"),
				xpe.model_setvalue_meta_id("/r2"),
				xpe.model_bind_meta_label(" ../../../q3 ", "/r2"),
				xpe.model_bind_meta_instanceid(),
				xpe.body_repeat_setvalue_meta_id(
					"/x:group/x:repeat[@nodeset='/test_name/r2']",
					"/r2",
				),
			],
			xml__contains: [
				'xmlns:entities="http://www.opendatakit.org/xforms/entities"',
			],
			xml__xpath_count: [["/h:html//x:setvalue", 2]],
		});
	});

	it("test_other_controls_after__ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name  | label |
				| | begin_repeat | r1    | R1    |
				| | text         | q1    | Q1    |
				| | end_repeat   |       |       |
				| | begin_group  | g1    | G1    |
				| | text         | q2    | Q2    |
				| | end_group    |       |       |
				| | begin_repeat | r2    | R2    |
				| | text         | q3    | Q3    |
				| | end_repeat   |       |       |

				| entities |
				| | list_name | label |
				| | e1        | \${q1} |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				xpe.model_entities_version("2025.1.0"),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					template: true,
					create: true,
					label: true,
				}),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					create: true,
					label: true,
				}),
				xpe.model_bind_meta_id("", "/r1"),
				xpe.model_setvalue_meta_id("/r1"),
				xpe.model_bind_meta_label(" ../../../q1 ", "/r1"),
				xpe.model_bind_meta_instanceid(),
				xpe.body_repeat_setvalue_meta_id(
					"/x:group/x:repeat[@nodeset='/test_name/r1']",
					"/r1",
				),
			],
			xml__contains: [
				'xmlns:entities="http://www.opendatakit.org/xforms/entities"',
			],
			xml__xpath_count: [["/h:html//x:setvalue", 2]],
		});
	});

	it("test_other_controls_before_and_after__ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name  | label |
				| | begin_repeat | r1    | R1    |
				| | text         | q1    | Q1    |
				| | end_repeat   |       |       |
				| | begin_group  | g1    | G1    |
				| | text         | q2    | Q2    |
				| | end_group    |       |       |
				| | begin_repeat | r2    | R2    |
				| | text         | q3    | Q3    |
				| | end_repeat   |       |       |
				| | begin_group  | g2    | G2    |
				| | text         | q4    | Q4    |
				| | end_group    |       |       |
				| | begin_repeat | r3    | R3    |
				| | text         | q5    | Q5    |
				| | end_repeat   |       |       |

				| entities |
				| | list_name | label |
				| | e1        | \${q3} |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				xpe.model_entities_version("2025.1.0"),
				xpe.model_instance_meta("e1", "/x:r2", {
					repeat: true,
					template: true,
					create: true,
					label: true,
				}),
				xpe.model_instance_meta("e1", "/x:r2", {
					repeat: true,
					create: true,
					label: true,
				}),
				xpe.model_bind_meta_id("", "/r2"),
				xpe.model_setvalue_meta_id("/r2"),
				xpe.model_bind_meta_label(" ../../../q3 ", "/r2"),
				xpe.model_bind_meta_instanceid(),
				xpe.body_repeat_setvalue_meta_id(
					"/x:group/x:repeat[@nodeset='/test_name/r2']",
					"/r2",
				),
			],
			xml__contains: [
				'xmlns:entities="http://www.opendatakit.org/xforms/entities"',
			],
			xml__xpath_count: [["/h:html//x:setvalue", 2]],
		});
	});

	it("test_question_without_saveto_in_entity_repeat__ok", () => {
		assertPyxformXform({
			md: `
				| survey |              |       |       |         |
				|        | type         | name  | label | save_to |
				|        | begin_repeat | r1    | R1    |         |
				|        | text         | q1    | Q1    | p1      |
				|        | text         | q2    | Q2    |         |
				|        | end_repeat   |       |       |         |

				| entities |
				|          | list_name | label |
				|          | e1        | \${q1} |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				xpe.model_entities_version("2025.1.0"),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					template: true,
					create: true,
					label: true,
				}),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					create: true,
					label: true,
				}),
				xpe.model_bind_question_saveto("/r1/q1", "p1"),
				xpe.model_bind_meta_id("", "/r1"),
				xpe.model_setvalue_meta_id("/r1"),
				xpe.model_bind_meta_label(" ../../../q1 ", "/r1"),
				xpe.model_bind_meta_instanceid(),
				xpe.body_repeat_setvalue_meta_id(
					"/x:group/x:repeat[@nodeset='/test_name/r1']",
					"/r1",
				),
				// repeat model instance question
				`
				/h:html/h:head/x:model/x:instance/x:test_name/x:r1[@jr:template='']/x:q2
				`,
				`
				/h:html/h:head/x:model/x:instance/x:test_name/x:r1[not(@jr:template='')]/x:q2
				`,
				// repeat bind question no saveto
				`
				/h:html/h:head/x:model/x:bind[
				  @nodeset='/test_name/r1/q2'
				  and not(@entities:saveto)
				]
				`,
			],
			xml__contains: [
				'xmlns:entities="http://www.opendatakit.org/xforms/entities"',
			],
			xml__xpath_count: [["/h:html//x:setvalue", 2]],
		});
	});

	it("test_repeat_without_saveto_in_entity_repeat__ok", () => {
		assertPyxformXform({
			md: `
				| survey |              |       |       |         |
				|        | type         | name  | label | save_to |
				|        | begin_repeat | r1    | R1    |         |
				|        | text         | q1    | Q1    | p1      |
				|        | begin_repeat | r2    | R2    |         |
				|        | text         | q2    | Q2    |         |
				|        | end_repeat   |       |       |         |
				|        | end_repeat   |       |       |         |

				| entities |
				|          | list_name | label |
				|          | e1        | \${q1} |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				xpe.model_entities_version("2025.1.0"),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					template: true,
					create: true,
					label: true,
				}),
				xpe.model_instance_meta("e1", "/x:r1", {
					repeat: true,
					create: true,
					label: true,
				}),
				xpe.model_bind_question_saveto("/r1/q1", "p1"),
				xpe.model_bind_meta_id("", "/r1"),
				xpe.model_setvalue_meta_id("/r1"),
				xpe.model_bind_meta_label(" ../../../q1 ", "/r1"),
				xpe.model_bind_meta_instanceid(),
				xpe.body_repeat_setvalue_meta_id(
					"/x:group/x:repeat[@nodeset='/test_name/r1']",
					"/r1",
				),
				// repeat template for adjacent repeat doesn't get meta block
				`
				/h:html/h:head/x:model/x:instance/x:test_name/x:r1[
				  @jr:template=''
				  and ./x:q1
				  and ./x:r2[not(./x:meta)]
				]
				`,
				// repeat default for adjacent repeat doesn't get meta block
				`
				/h:html/h:head/x:model/x:instance/x:test_name/x:r1[
				  not(@jr:template)
				  and ./x:q1
				  and ./x:r2[not(./x:meta)]
				]
				`,
			],
			xml__contains: [
				'xmlns:entities="http://www.opendatakit.org/xforms/entities"',
			],
			xml__xpath_count: [["/h:html//x:setvalue", 2]],
		});
	});

	it("test_somewhat_ambiguous_repeat_nesting_references", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name  | label |
				| | begin_repeat | r1    | R1    |
				| | begin_group  | g1    | G1    |
				| | text         | q1    | Q1    |
				| | begin_repeat | r2    | R2    |
				| | begin_group  | g2    | G2    |
				| | text         | q2    | Q2    |
				| | begin_group  | g3    | G3    |
				| | text         | q3    | Q3    |
				| | end_group    |       |       |
				| | end_group    |       |       |
				| | end_repeat   |       |       |
				| | end_group    |       |       |
				| | end_repeat   |       |       |

				| entities |
				| | list_name | label                |
				| | e1        | concat(\${q1}, " ", \${q2}, " ", \${q3}) |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				xpe.model_entities_version("2025.1.0"),
				xpe.model_instance_meta(
					"e1",
					"/x:r1[@jr:template='']/x:g1/x:r2[@jr:template='']/x:g2/x:g3",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e1",
					"/x:r1[@jr:template='']/x:g1/x:r2[not(@jr:template)]/x:g2/x:g3",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e1",
					"/x:r1[not(@jr:template)]/x:g1/x:r2[not(@jr:template)]/x:g2/x:g3",
					{ template: null, repeat: true, create: true, label: true },
				),
				// no save_to in this test
				xpe.model_bind_meta_id("", "/r1/g1/r2/g2/g3"),
				xpe.model_bind_meta_label(
					`concat( ../../../../../../q1 , " ",  ../../../../q2 , " ",  ../../../q3 )`,
					"/r1/g1/r2/g2/g3",
				),
				xpe.model_bind_meta_instanceid(),
				xpe.body_repeat_setvalue_meta_id(
					"/x:group/x:repeat/x:group/x:group/x:repeat[@nodeset='/test_name/r1/g1/r2']",
					"/r1/g1/r2/g2/g3",
				),
			],
			xml__contains: [
				'xmlns:entities="http://www.opendatakit.org/xforms/entities"',
			],
			xml__xpath_count: [["/h:html//x:setvalue", 2]],
		});
	});

	it("test_somewhat_ambiguous_repeat_nesting_references_with_saveto", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name  | label | save_to |
				| | begin_repeat | r1    | R1    |         |
				| | begin_group  | g1    | G1    |         |
				| | text         | q1    | Q1    |         |
				| | begin_repeat | r2    | R2    |         |
				| | begin_group  | g2    | G2    |         |
				| | text         | q2    | Q2    |         |
				| | begin_group  | g3    | G3    |         |
				| | text         | q3    | Q3    |         |
				| | text         | q4    | Q4    | p1      |
				| | end_group    |       |       |         |
				| | end_group    |       |       |         |
				| | end_repeat   |       |       |         |
				| | end_group    |       |       |         |
				| | end_repeat   |       |       |         |

				| entities |
				| | list_name | label                                 |
				| | e1        | concat(\${q1}, " ", \${q2}, " ", \${q3}) |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				xpe.model_entities_version("2025.1.0"),
				xpe.model_instance_meta(
					"e1",
					"/x:r1[@jr:template='']/x:g1/x:r2[@jr:template='']/x:g2/x:g3",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e1",
					"/x:r1[@jr:template='']/x:g1/x:r2[not(@jr:template)]/x:g2/x:g3",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e1",
					"/x:r1[not(@jr:template)]/x:g1/x:r2[not(@jr:template)]/x:g2/x:g3",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_bind_question_saveto("/r1/g1/r2/g2/g3/q4", "p1"),
				xpe.model_bind_meta_id("", "/r1/g1/r2/g2/g3"),
				xpe.model_bind_meta_label(
					`concat( ../../../../../../q1 , " ",  ../../../../q2 , " ",  ../../../q3 )`,
					"/r1/g1/r2/g2/g3",
				),
				xpe.model_bind_meta_instanceid(),
				xpe.body_repeat_setvalue_meta_id(
					"/x:group/x:repeat/x:group/x:group/x:repeat[@nodeset='/test_name/r1/g1/r2']",
					"/r1/g1/r2/g2/g3",
				),
			],
			xml__contains: [
				'xmlns:entities="http://www.opendatakit.org/xforms/entities"',
			],
			xml__xpath_count: [["/h:html//x:setvalue", 2]],
		});
	});

	it("test_somewhat_ambiguous_repeat_nesting_references_with_saveto_and_competing_lists", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name  | label | save_to |
				| | begin_repeat | r1    | R1    |         |
				| | begin_group  | g1    | G1    |         |
				| | text         | q1    | Q1    |         |
				| | begin_repeat | r2    | R2    |         |
				| | begin_group  | g2    | G2    |         |
				| | text         | q2    | Q2    | e1#e1p1 |
				| | begin_group  | g3    | G3    |         |
				| | text         | q3    | Q3    |         |
				| | text         | q4    | Q4    | e2#e2p1 |
				| | end_group    |       |       |         |
				| | end_group    |       |       |         |
				| | end_repeat   |       |       |         |
				| | end_group    |       |       |         |
				| | end_repeat   |       |       |         |

				| entities |
				| | list_name | label                                 |
				| | e1        | concat(\${q1}, " ", \${q2}, " ", \${q3}) |
				| | e2        | concat(\${q1}, " ", \${q2}, " ", \${q3}) |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				xpe.model_entities_version("2025.1.0"),
				xpe.model_instance_meta(
					"e1",
					"/x:r1[@jr:template='']/x:g1/x:r2[@jr:template='']/x:g2",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e1",
					"/x:r1[@jr:template='']/x:g1/x:r2[not(@jr:template)]/x:g2",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e1",
					"/x:r1[not(@jr:template)]/x:g1/x:r2[not(@jr:template)]/x:g2",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e2",
					"/x:r1[@jr:template='']/x:g1/x:r2[@jr:template='']/x:g2/x:g3",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e2",
					"/x:r1[@jr:template='']/x:g1/x:r2[not(@jr:template)]/x:g2/x:g3",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e2",
					"/x:r1[not(@jr:template)]/x:g1/x:r2[not(@jr:template)]/x:g2/x:g3",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_bind_question_saveto("/r1/g1/r2/g2/q2", "e1p1"),
				xpe.model_bind_question_saveto("/r1/g1/r2/g2/g3/q4", "e2p1"),
				xpe.model_bind_meta_id("", "/r1/g1/r2/g2"),
				xpe.model_bind_meta_id("", "/r1/g1/r2/g2/g3"),
				xpe.model_setvalue_meta_id("/r1/g1/r2/g2"),
				xpe.model_setvalue_meta_id("/r1/g1/r2/g2/g3"),
				xpe.model_bind_meta_label(
					`concat( ../../../../../q1 , " ",  ../../../q2 , " ",  ../../../g3/q3 )`,
					"/r1/g1/r2/g2",
				),
				xpe.model_bind_meta_label(
					`concat( ../../../../../../q1 , " ",  ../../../../q2 , " ",  ../../../q3 )`,
					"/r1/g1/r2/g2/g3",
				),
				xpe.model_bind_meta_instanceid(),
				xpe.body_repeat_setvalue_meta_id(
					"/x:group/x:repeat/x:group/x:group/x:repeat[@nodeset='/test_name/r1/g1/r2']",
					"/r1/g1/r2/g2",
				),
				xpe.body_repeat_setvalue_meta_id(
					"/x:group/x:repeat/x:group/x:group/x:repeat[@nodeset='/test_name/r1/g1/r2']",
					"/r1/g1/r2/g2/g3",
				),
			],
			xml__contains: [
				'xmlns:entities="http://www.opendatakit.org/xforms/entities"',
			],
			xml__xpath_count: [["/h:html//x:setvalue", 4]],
		});
	});

	it("test_somewhat_ambiguous_repeat_nesting_references_with_saveto_and_many_competing_lists", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name  | label | save_to |
				| | begin_repeat | r1    | R1    |         |
				| | begin_group  | g1    | G1    |         |
				| | text         | q1    | Q1    |         |
				| | begin_repeat | r2    | R2    |         |
				| | begin_group  | g2    | G2    |         |
				| | text         | q2    | Q2    | e1#e1p1 |
				| | begin_group  | g3    | G3    |         |
				| | begin_group  | g4    | G4    |         |
				| | text         | q3    | Q3    |         |
				| | text         | q4    | Q4    | e2#e2p1 |
				| | end_group    |       |       |         |
				| | end_group    |       |       |         |
				| | end_group    |       |       |         |
				| | end_repeat   |       |       |         |
				| | end_group    |       |       |         |
				| | end_repeat   |       |       |         |

				| entities |
				| | list_name | label                                 | create_if  |
				| | e1        | concat(\${q1}, " ", \${q2}, " ", \${q3}) | \${q1} = '' |
				| | e2        | concat(\${q1}, " ", \${q2}, " ", \${q3}) | |
				| | e3        | concat(\${q1}, " ", \${q2}, " ", \${q3}) | |
				| | e4        | concat(\${q1}, " ", \${q2}, " ", \${q3}) | |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				xpe.model_entities_version("2025.1.0"),
				xpe.model_bind_meta_instanceid(),
				// model entity x12 (r1 template + r2 template, r1 template + r2, r1 + r2)
				xpe.model_instance_meta(
					"e1",
					"/x:r1[@jr:template='']/x:g1/x:r2[@jr:template='']/x:g2",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e1",
					"/x:r1[@jr:template='']/x:g1/x:r2[not(@jr:template)]/x:g2",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e1",
					"/x:r1[not(@jr:template)]/x:g1/x:r2[not(@jr:template)]/x:g2",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e2",
					"/x:r1[@jr:template='']/x:g1/x:r2[@jr:template='']/x:g2/x:g3/x:g4",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e2",
					"/x:r1[@jr:template='']/x:g1/x:r2[not(@jr:template)]/x:g2/x:g3/x:g4",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e2",
					"/x:r1[not(@jr:template)]/x:g1/x:r2[not(@jr:template)]/x:g2/x:g3/x:g4",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e3",
					"/x:r1[@jr:template='']/x:g1/x:r2[@jr:template='']/x:g2/x:g3",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e3",
					"/x:r1[@jr:template='']/x:g1/x:r2[not(@jr:template)]/x:g2/x:g3",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e3",
					"/x:r1[not(@jr:template)]/x:g1/x:r2[not(@jr:template)]/x:g2/x:g3",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e4",
					"/x:r1[@jr:template='']/x:g1/x:r2[@jr:template='']",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e4",
					"/x:r1[@jr:template='']/x:g1/x:r2[not(@jr:template)]",
					{ template: null, repeat: true, create: true, label: true },
				),
				xpe.model_instance_meta(
					"e4",
					"/x:r1[not(@jr:template)]/x:g1/x:r2[not(@jr:template)]",
					{ template: null, repeat: true, create: true, label: true },
				),
				// saveto x2
				xpe.model_bind_question_saveto("/r1/g1/r2/g2/q2", "e1p1"),
				xpe.model_bind_question_saveto("/r1/g1/r2/g2/g3/g4/q4", "e2p1"),
				// model bind meta/entity/@id x4
				xpe.model_bind_meta_id("", "/r1/g1/r2"),
				xpe.model_bind_meta_id("", "/r1/g1/r2/g2"),
				xpe.model_bind_meta_id("", "/r1/g1/r2/g2/g3"),
				xpe.model_bind_meta_id("", "/r1/g1/r2/g2/g3/g4"),
				// model setvalue meta/entity/@id x4
				xpe.model_setvalue_meta_id("/r1/g1/r2"),
				xpe.model_setvalue_meta_id("/r1/g1/r2/g2"),
				xpe.model_setvalue_meta_id("/r1/g1/r2/g2/g3"),
				xpe.model_setvalue_meta_id("/r1/g1/r2/g2/g3/g4"),
				// model bind meta/entity/label x4
				xpe.model_bind_meta_label(
					`concat( ../../../../q1 , " ",  ../../../g2/q2 , " ",  ../../../g2/g3/g4/q3 )`,
					"/r1/g1/r2",
				),
				xpe.model_bind_meta_label(
					`concat( ../../../../../q1 , " ",  ../../../q2 , " ",  ../../../g3/g4/q3 )`,
					"/r1/g1/r2/g2",
				),
				xpe.model_bind_meta_label(
					`concat( ../../../../../../q1 , " ",  ../../../../q2 , " ",  ../../../g4/q3 )`,
					"/r1/g1/r2/g2/g3",
				),
				xpe.model_bind_meta_label(
					`concat( ../../../../../../../q1 , " ",  ../../../../../q2 , " ",  ../../../q3 )`,
					"/r1/g1/r2/g2/g3/g4",
				),
				// body repeat setvalue x4
				xpe.body_repeat_setvalue_meta_id(
					"/x:group/x:repeat/x:group/x:group/x:repeat[@nodeset='/test_name/r1/g1/r2']",
					"/r1/g1/r2",
				),
				xpe.body_repeat_setvalue_meta_id(
					"/x:group/x:repeat/x:group/x:group/x:repeat[@nodeset='/test_name/r1/g1/r2']",
					"/r1/g1/r2/g2",
				),
				xpe.body_repeat_setvalue_meta_id(
					"/x:group/x:repeat/x:group/x:group/x:repeat[@nodeset='/test_name/r1/g1/r2']",
					"/r1/g1/r2/g2/g3",
				),
				xpe.body_repeat_setvalue_meta_id(
					"/x:group/x:repeat/x:group/x:group/x:repeat[@nodeset='/test_name/r1/g1/r2']",
					"/r1/g1/r2/g2/g3/g4",
				),
			],
			xml__contains: [
				'xmlns:entities="http://www.opendatakit.org/xforms/entities"',
			],
			xml__xpath_count: [
				["/h:html//x:setvalue", 8],
				["/h:html/h:head/x:model/x:instance/x:test_name//x:entity", 12],
			],
		});
	});
});
