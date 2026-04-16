/**
 * Port of test_entities.py - TestEntitiesParsing class (first ~75 tests)
 * Entity feature traceability test suite - validation and parsing tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

// --- XPath helpers (ported from pyxform/tests/xpath_helpers/entities.py) ---

function xpe_model_instance_meta(
	list_name: string,
	meta_path = "",
	opts: {
		repeat?: boolean | null;
		template?: boolean | null;
		create?: boolean | null;
		update?: boolean | null;
		label?: boolean | null;
	} = {},
): string {
	const {
		repeat = false,
		template = false,
		create = false,
		update = false,
		label = false,
	} = opts;

	const assertion = (v: boolean | null, s: string) =>
		v === true ? s : v === false ? `not(${s})` : "true()";

	const templateAssert = assertion(template, "@jr:template");
	const repeatAsserts = assertion(repeat, "not(./x:instanceID)");
	const createAsserts = assertion(create, "@create='1'");
	const updateAsserts = [
		assertion(update, "@update='1'"),
		assertion(update, "@baseVersion=''"),
		assertion(update, "@branchId=''"),
		assertion(update, "@trunkVersion=''"),
	].join(" and ");
	const labelAsserts = assertion(label, "./x:label");

	return `
		/h:html/h:head/x:model/x:instance/x:test_name${meta_path}[
		  ${templateAssert}
		]/x:meta[
		  ${repeatAsserts}
		]/x:entity[
		  @dataset='${list_name}'
		  and @id=''
		  and ${createAsserts}
		  and ${updateAsserts}
		  and ${labelAsserts}
		]
	`;
}

function xpe_model_no_instance_csv(list_name: string): string {
	return `
		/h:html/h:head/x:model[
		  not(./x:instance[@id='${list_name}' and @src='jr://file-csv/${list_name}.csv'])
		]
	`;
}

function xpe_model_setvalue_meta_id(meta_path = ""): string {
	return `
		/h:html/h:head/x:model/x:setvalue[
		  @ref='/test_name${meta_path}/meta/entity/@id'
		  and @event='odk-instance-first-load'
		  and @value='uuid()'
		]
	`;
}

function xpe_model_bind_question_saveto(qpath: string, saveto: string): string {
	return `
		/h:html/h:head/x:model/x:bind[
		  @nodeset='/test_name${qpath}'
		  and @entities:saveto='${saveto}'
		]
	`;
}

function xpe_model_bind_meta_id(expression = "", meta_path = ""): string {
	const exprAssert = expression
		? `@calculate='${expression}'`
		: "not(@calculate)";
	return `
		/h:html/h:head/x:model/x:bind[
		  @nodeset='/test_name${meta_path}/meta/entity/@id'
		  and ${exprAssert}
		  and @type='string'
		  and @readonly='true()'
		]
	`;
}

function xpe_model_bind_meta_create(
	expression: string,
	meta_path = "",
): string {
	return `
		/h:html/h:head/x:model/x:bind[
		  @nodeset='/test_name${meta_path}/meta/entity/@create'
		  and @calculate="${expression}"
		  and @type='string'
		  and @readonly='true()'
		]
	`;
}

function xpe_model_bind_meta_label(value: string, meta_path = ""): string {
	return `
		/h:html/h:head/x:model/x:bind[
		  @nodeset='/test_name${meta_path}/meta/entity/label'
		  and @calculate='${value}'
		  and @type='string'
		  and @readonly='true()'
		]
	`;
}

function xpe_model_bind_meta_instanceid(): string {
	return `
		/h:html/h:head/x:model/x:bind[
		  @nodeset='/test_name/meta/instanceID'
		  and @readonly='true()'
		  and @type='string'
		  and @jr:preload='uid'
		]
	`;
}

function xpe_model_entities_version(version: string): string {
	return `
		/h:html/h:head/x:model[@entities:entities-version='${version}']
	`;
}

function xpe_model_no_entities_version(): string {
	return `
		/h:html/h:head/x:model/@*[
		  not(
		    namespace-uri()='http://www.opendatakit.org/xforms/entities'
		    and local-name()='entities-version'
		  )
		]
	`;
}

function xpe_body_repeat_setvalue_meta_id(
	repeat_path = "",
	meta_path = "",
): string {
	return `
		/h:html/h:body${repeat_path}/x:setvalue[
		  @ref='/test_name${meta_path}/meta/entity/@id'
		  and @event='odk-new-repeat'
		  and @value='uuid()'
		]
	`;
}

function xps_instance_meta_survey_element(name: string): string {
	return `
		/h:html/h:head/x:model/x:instance/x:test_name/x:meta/x:${name}
	`;
}

// --- Tests ---

describe("TestEntitiesParsing", () => {
	it("test_sheet_name_misspelling__warning", () => {
		// EV001
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entitoes |
				| | list_name | label |
				| | e1        | E1    |
			`,
			warnings_count: 1,
			warnings__contains: [
				"When looking for a sheet named 'entities', the following sheets with similar names were found: 'entitoes'.",
			],
		});
	});

	it("test_unexpected_column__single__error", () => {
		// EV002
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label | what |
				| | e1        | E1    | !    |
			`,
			errored: true,
			error__contains: [
				"[row : 1] On the 'entities' sheet, one or more column names are invalid. The following column(s) are not supported by this version of pyxform: 'what'.",
			],
		});
	});

	it("test_unexpected_column__multiple__error", () => {
		// EV002
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label | what | why |
				| | e1        | E1    | !    | ?   |
			`,
			errored: true,
			error__contains: [
				"[row : 1] On the 'entities' sheet, one or more column names are invalid. The following column(s) are not supported by this version of pyxform: 'what', 'why'.",
			],
		});
	});

	it("test_unresolved_variable_reference__error", () => {
		// EV003
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label  |
				| | e1        | \${q2} |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'entities' sheet, the 'label' value is invalid. Reference variables must contain a name from the 'survey' sheet. Could not find the name 'q2'.",
			],
		});
	});

	it("test_no_entity_declarations__error", () => {
		// EV004
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to |
				| | text | q1   | Q1    | e1p1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'save_to' value is invalid. To save entity properties using the save_to column, add an entities sheet and declare an entity.",
			],
		});
	});

	it("test_duplicate_entity_declaration__error", () => {
		// EV005
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to  |
				| | text | q1   | Q1    | e1#e1p1  |
				| | text | q2   | Q2    | e2#e2p1  |

				| entities |
				| | list_name | label  |
				| | e1        | \${q1} |
				| | e1        | \${q2} |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'entities' sheet, the 'list_name' value is invalid. The 'list_name' column must not have any duplicate names.",
			],
		});
	});

	it("test_duplicate_entity_property__single_entity__error", () => {
		// EV006
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to |
				| | text | q1   | Q1    | e1p1    |
				| | text | q2   | Q2    | e1p1    |

				| entities |
				| | list_name | label  |
				| | e1        | \${q1} |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'save_to' value is invalid. The save_to property 'e1p1' is already assigned by row '2'. Either remove or change one of these duplicate save_to property names.",
			],
		});
	});

	it("test_duplicate_entity_property__multiple_entity__error", () => {
		// EV006
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to  |
				| | text | q1   | Q1    | e1#e1p1  |
				| | text | q2   | Q2    | e1#e1p2  |
				| | text | q3   | Q3    | e2#e1p1  |
				| | text | q4   | Q4    | e2#e1p1  |

				| entities |
				| | list_name | label  |
				| | e1        | \${q1} |
				| | e2        | \${q3} |
			`,
			errored: true,
			error__contains: [
				"[row : 5] On the 'survey' sheet, the 'save_to' value is invalid. The save_to property 'e1p1' is already assigned by row '4'. Either remove or change one of these duplicate save_to property names.",
			],
		});
	});

	it("test_container_row_has_save_to__begin_group__error", () => {
		// EV007
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to |
				| | begin_group | g1   | G1    | e1p1    |
				| | text        | q1   | Q1    |         |
				| | end_group   |      |       |         |

				| entities |
				| | list_name | label  |
				| | e1        | \${q1} |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'save_to' value is invalid. Groups and repeats can't be saved as entity properties. Either remove or move the save_to value in this row.",
			],
		});
	});

	it("test_container_row_has_save_to__end_group__error", () => {
		// EV007
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to |
				| | begin_group | g1   | G1    |         |
				| | text        | q1   | Q1    |         |
				| | end_group   |      |       | e1p1    |

				| entities |
				| | list_name | label  |
				| | e1        | \${q1} |
			`,
			errored: true,
			error__contains: [
				"[row : 4] On the 'survey' sheet, the 'save_to' value is invalid. Groups and repeats can't be saved as entity properties. Either remove or move the save_to value in this row.",
			],
		});
	});

	it("test_container_row_has_save_to__begin_repeat__error", () => {
		// EV007
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | begin_repeat | g1   | G1    | e1p1    |
				| | text         | q1   | Q1    |         |
				| | end_repeat   |      |       |         |

				| entities |
				| | list_name | label  |
				| | e1        | \${q1} |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'save_to' value is invalid. Groups and repeats can't be saved as entity properties. Either remove or move the save_to value in this row.",
			],
		});
	});

	it("test_container_row_has_save_to__end_repeat__error", () => {
		// EV007
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to |
				| | begin_repeat | g1   | G1    |         |
				| | text         | q1   | Q1    |         |
				| | end_repeat   |      |       | e1p1    |

				| entities |
				| | list_name | label  |
				| | e1        | \${q1} |
			`,
			errored: true,
			error__contains: [
				"[row : 4] On the 'survey' sheet, the 'save_to' value is invalid. Groups and repeats can't be saved as entity properties. Either remove or move the save_to value in this row.",
			],
		});
	});

	it("test_container_as_entity_property__group__no_false_positive__ok (group)", () => {
		// EV007
		assertPyxformXform({
			md: `
				| survey |
				| | type               | name | label | save_to |
				| | select_one group   | q1   | Q1    | e1p1    |

				| choices |
				| | list_name | name | label |
				| | group     | n1   | N1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			warnings_count: 0,
		});
	});

	it("test_container_as_entity_property__group__no_false_positive__ok (my_group1)", () => {
		// EV007
		assertPyxformXform({
			md: `
				| survey |
				| | type                  | name | label | save_to |
				| | select_one my_group1  | q1   | Q1    | e1p1    |

				| choices |
				| | list_name | name | label |
				| | my_group1 | n1   | N1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			warnings_count: 0,
		});
	});

	it("test_container_as_entity_property__group__no_false_positive__ok (repeat)", () => {
		// EV007
		assertPyxformXform({
			md: `
				| survey |
				| | type               | name | label | save_to |
				| | select_one repeat  | q1   | Q1    | e1p1    |

				| choices |
				| | list_name | name | label |
				| | repeat    | n1   | N1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			warnings_count: 0,
		});
	});

	it("test_container_as_entity_property__group__no_false_positive__ok (my_repeat1)", () => {
		// EV007
		assertPyxformXform({
			md: `
				| survey |
				| | type                   | name | label | save_to |
				| | select_one my_repeat1  | q1   | Q1    | e1p1    |

				| choices |
				| | list_name  | name | label |
				| | my_repeat1 | n1   | N1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			warnings_count: 0,
		});
	});

	it("test_missing_entity_declaration__error", () => {
		// EV008
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to  |
				| | text | q1   | Q1    | e2#e1p1  |

				| entities |
				| | list_name | label  |
				| | e1        | \${q1} |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'save_to' value is invalid. The entity list name 'e2' was not found on the entities sheet.",
			],
		});
	});

	it("test_missing_entity_create_label__create_if_present__error", () => {
		// EV009
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name |
				| | e1        |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'entities' sheet, the entity declaration is invalid. The entity list name 'e1' does not have a label",
			],
		});
	});

	it("test_missing_entity_create_label__entity_id_not_present__error", () => {
		// EV009
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | create_if    |
				| | e1        | \${q1} != '' |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'entities' sheet, the entity declaration is invalid. The entity list name 'e1' does not have a label",
			],
		});
	});

	it("test_missing_entity_upsert_update_if__error", () => {
		// EB008 EV010
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | create_if    | entity_id |
				| | e1        | \${q1} != '' | \${q1}    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'entities' sheet, the entity declaration is invalid. The entity list name 'e1' does not have an 'update_if' expression",
			],
		});
	});

	it("test_missing_entity_upsert_update_if__with_label__error", () => {
		// EB008 EV010
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label  | create_if    | entity_id |
				| | e1        | \${q1} | \${q1} != '' | \${q1}    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'entities' sheet, the entity declaration is invalid. The entity list name 'e1' does not have an 'update_if' expression",
			],
		});
	});

	it("test_missing_entity_entity_id__update__error", () => {
		// EB003 EV011
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | update_if    |
				| | e1        | \${q1} != '' |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'entities' sheet, the entity declaration is invalid. The entity list name 'e1' does not have an 'entity_id' expression",
			],
		});
	});

	it("test_missing_entity_entity_id__upsert__error", () => {
		// EB005 EV011
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | create_if    | update_if    |
				| | e1        | \${q1} != '' | \${q1} != '' |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'entities' sheet, the entity declaration is invalid. The entity list name 'e1' does not have an 'entity_id' expression",
			],
		});
	});

	it("test_missing_save_to_prefix__bad_row_first__error", () => {
		// EV012
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to  |
				| | text | q1   | Q1    | e1p1     |
				| | text | q2   | Q2    | e2#e2p1  |

				| entities |
				| | list_name | label  |
				| | e1        | \${q1} |
				| | e2        | \${q2} |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'save_to' value is invalid. When there is more than one entity declaration, 'save_to' names must be prefixed with the entity 'list_name'",
			],
		});
	});

	it("test_missing_save_to_prefix__bad_row_second__error", () => {
		// EV012
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to  |
				| | text | q1   | Q1    | e1#e1p1  |
				| | text | q2   | Q2    | e2p1     |

				| entities |
				| | list_name | label  |
				| | e1        | \${q1} |
				| | e2        | \${q2} |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'save_to' value is invalid. When there is more than one entity declaration, 'save_to' names must be prefixed with the entity 'list_name'",
			],
		});
	});

	it("test_unsolvable_meta_topology__depth_0__saveto_only__error", () => {
		// EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to  |
				| | text | q1   | Q1    | e1#e1p1  |
				| | text | q2   | Q2    | e2#e2p1  |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'entities' sheet, the entity declaration is invalid. Each container (survey, group, repeat) may have only one entity declaration, but there are no valid containers available in the scope: '/survey', which has been allocated to the entity on row '2'.",
			],
		});
	});

	it("test_unsolvable_meta_topology__depth_0__var_only__error", () => {
		// EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label  |
				| | e1        | \${q1} |
				| | e2        | \${q1} |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'entities' sheet, the entity declaration is invalid. Each container (survey, group, repeat) may have only one entity declaration, but there are no valid containers available in the scope: '/survey', which has been allocated to the entity on row '2'.",
			],
		});
	});

	it("test_unsolvable_meta_topology__depth_0__saveto_and_var__error", () => {
		// EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to  |
				| | text | q1   | Q1    | e1#e1p1  |

				| entities |
				| | list_name | label  |
				| | e1        | E1     |
				| | e2        | \${q1} |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'entities' sheet, the entity declaration is invalid. Each container (survey, group, repeat) may have only one entity declaration, but there are no valid containers available in the scope: '/survey', which has been allocated to the entity on row '2'.",
			],
		});
	});

	it("test_save_to_scope_breach__depth_1_group__save_to_only__ok", () => {
		// ES006 EV014 EV015
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to  |
				| | text        | q1   | Q1    | e1#e1p1  |
				| | begin_group | g1   | G1    |          |
				| | text        | q2   | Q2    | e1#e1p2  |
				| | end_group   | g1   |       |          |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			warnings_count: 0,
		});
	});

	it("test_save_to_scope_breach__depth_1_group__save_and_var__ok", () => {
		// ES006 EV014 EV015
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to  |
				| | text        | q1   | Q1    | e1#e1p1  |
				| | begin_group | g1   | G1    |          |
				| | text        | q2   | Q2    | e1#e1p2  |
				| | end_group   | g1   |       |          |
				| | text        | q3   | Q3    |          |

				| entities |
				| | list_name | label                                          |
				| | e1        | concat(\${q1}, " ", \${q2}, " ", \${q3})       |
			`,
			warnings_count: 0,
		});
	});

	it("test_save_to_scope_breach__depth_1_group__var_only__ok", () => {
		// ES006 EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | text        | q1   | Q1    |
				| | begin_group | g1   | G1    |
				| | text        | q2   | Q2    |
				| | end_group   | g1   |       |
				| | text        | q3   | Q3    |

				| entities |
				| | list_name | label                                          |
				| | e1        | concat(\${q1}, " ", \${q2}, " ", \${q3})       |
			`,
			warnings_count: 0,
		});
	});

	it("test_unsolvable_meta_topology__depth_1_group__saveto_only__error", () => {
		// EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to  |
				| | begin_group | g1   | G1    |          |
				| | text        | q1   | Q1    | e1#e1p1  |
				| | text        | q2   | Q2    | e2#e2p1  |
				| | end_group   | g1   |       |          |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'entities' sheet, the entity declaration is invalid. Each container (survey, group, repeat) may have only one entity declaration, but there are no valid containers available in the scope: '/survey', which has been allocated to the entity on row '2'.",
			],
		});
	});

	it("test_unsolvable_meta_topology__depth_1_group__var_only__error", () => {
		// EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin_group | g1   | G1    |
				| | text        | q1   | Q1    |
				| | end_group   | g1   |       |

				| entities |
				| | list_name | label  |
				| | e1        | \${q1} |
				| | e2        | \${q1} |
				| | e3        | \${q1} |
			`,
			errored: true,
			error__contains: [
				"[row : 4] On the 'entities' sheet, the entity declaration is invalid. Each container (survey, group, repeat) may have only one entity declaration, but there are no valid containers available in the scope: '/survey', which has been allocated to the entity on row '3'.",
			],
		});
	});

	it("test_unsolvable_meta_topology__depth_1_group__saveto_and_var__error", () => {
		// EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to  |
				| | begin_group | g1   | G1    |          |
				| | text        | q1   | Q1    | e1#e1p1  |
				| | end_group   | g1   |       |          |

				| entities |
				| | list_name | label  |
				| | e1        | E1     |
				| | e2        | \${q1} |
				| | e3        | \${q1} |
			`,
			errored: true,
			error__contains: [
				"[row : 4] On the 'entities' sheet, the entity declaration is invalid. Each container (survey, group, repeat) may have only one entity declaration, but there are no valid containers available in the scope: '/survey', which has been allocated to the entity on row '3'.",
			],
		});
	});

	it("test_unsolvable_meta_topology__depth_1_repeat__saveto_only__error", () => {
		// EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to  |
				| | begin_repeat | r1   | R1    |          |
				| | text         | q1   | Q1    | e1#e1p1  |
				| | text         | q2   | Q2    | e2#e2p1  |
				| | end_repeat   | r1   |       |          |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'entities' sheet, the entity declaration is invalid. Each container (survey, group, repeat) may have only one entity declaration, but there are no valid containers available in the scope: '/survey/r1', which has been allocated to the entity on row '2'.",
			],
		});
	});

	it("test_unsolvable_meta_topology__depth_1_repeat__var_only__error", () => {
		// EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin_repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end_repeat   | r1   |       |

				| entities |
				| | list_name | label  |
				| | e1        | \${q1} |
				| | e2        | \${q1} |
				| | e3        | \${q1} |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'entities' sheet, the entity declaration is invalid. Each container (survey, group, repeat) may have only one entity declaration, but there are no valid containers available in the scope: '/survey/r1', which has been allocated to the entity on row '2'.",
			],
		});
	});

	it("test_unsolvable_meta_topology__depth_1_repeat__saveto_and_var__error", () => {
		// EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to  |
				| | begin_repeat | r1   | R1    |          |
				| | text         | q1   | Q1    | e1#e1p1  |
				| | end_repeat   | r1   |       |          |

				| entities |
				| | list_name | label  |
				| | e1        | E1     |
				| | e2        | \${q1} |
				| | e3        | \${q1} |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'entities' sheet, the entity declaration is invalid. Each container (survey, group, repeat) may have only one entity declaration, but there are no valid containers available in the scope: '/survey/r1', which has been allocated to the entity on row '2'.",
			],
		});
	});

	it("test_unsolvable_meta_topology__depth_1_repeat__error", () => {
		// EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin_repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end_repeat   | r1   |       |

				| entities |
				| | list_name | label  |
				| | e1        | \${q1} |
				| | e2        | \${q1} |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'entities' sheet, the entity declaration is invalid. Each container (survey, group, repeat) may have only one entity declaration, but there are no valid containers available in the scope: '/survey/r1', which has been allocated to the entity on row '2'.",
			],
		});
	});

	it("test_unsolvable_meta_topology__depth_2_group__error", () => {
		// EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin_repeat | r1   | R1    |
				| | begin_group  | g1   | G1    |
				| | text         | q1   | Q1    |
				| | end_group    | g1   |       |
				| | end_repeat   | r1   |       |

				| entities |
				| | list_name | label  |
				| | e1        | \${q1} |
				| | e2        | \${q1} |
				| | e3        | \${q1} |
			`,
			errored: true,
			error__contains: [
				"[row : 4] On the 'entities' sheet, the entity declaration is invalid. Each container (survey, group, repeat) may have only one entity declaration, but there are no valid containers available in the scope: '/survey/r1', which has been allocated to the entity on row '3'.",
			],
		});
	});

	it("test_unsolvable_meta_topology__depth_1_repeat__conflict_2_group__saveto_only__error", () => {
		// EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type            | name | label | save_to  |
				| | begin_repeat    | r1   | R1    |          |
				| | text            | q1   | Q1    | e1#e1p1  |
				| |   begin_group   | g1   | G1    |          |
				| |     text        | q2   | Q2    | e1#e1p2  |
				| |     begin_group | g2   | G2    |          |
				| |       text      | q3   | Q3    | e2#e2p1  |
				| |     end_group   | g2   |       |          |
				| |     begin_group | g3   | G3    |          |
				| |       text      | q4   | Q4    | e2#e2p2  |
				| |     end_group   | g3   |       |          |
				| |   end_group     | g1   |       |          |
				| | end_repeat      |      |       |          |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'entities' sheet, the entity declaration is invalid. Each container (survey, group, repeat) may have only one entity declaration, but there are no valid containers available in the scope: '/survey/r1', which has been allocated to the entity on row '2'.",
			],
		});
	});

	it("test_unsolvable_meta_topology__depth_1_repeat__conflict_2_group__saveto_only__ok", () => {
		// EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type              | name | label | save_to  |
				| | begin_repeat      | r1   | R1    |          |
				| |   text            | q1   | Q1    | e1#e1p1  |
				| |   begin_group     | g1   | G1    |          |
				| |     text          | q2   | Q2    | e1#e1p2  |
				| |     begin_group   | g2   | G2    |          |
				| |       begin_group | g3   | G3    |          |
				| |         text      | q3   | Q3    | e2#e2p1  |
				| |       end_group   | g3   |       |          |
				| |       begin_group | g4   | G4    |          |
				| |         text      | q4   | Q4    | e2#e2p2  |
				| |       end_group   | g4   |       |          |
				| |     end_group     | g2   |       |          |
				| |   end_group       | g1   |       |          |
				| | end_repeat        |      |       |          |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
			`,
			xml__xpath_match: [
				xpe_model_instance_meta("e1", "/x:r1", {
					create: true,
					label: true,
					repeat: true,
				}),
				xpe_model_instance_meta("e2", "/x:r1[not(@jr:template)]/x:g1/x:g2", {
					create: true,
					label: true,
					repeat: true,
				}),
				xpe_model_bind_question_saveto("/r1/q1", "e1p1"),
				xpe_model_bind_question_saveto("/r1/g1/q2", "e1p2"),
				xpe_model_bind_question_saveto("/r1/g1/g2/g3/q3", "e2p1"),
				xpe_model_bind_question_saveto("/r1/g1/g2/g4/q4", "e2p2"),
			],
		});
	});

	it("test_unsolvable_meta_topology__depth_1_repeat__conflict_2_group__repeat__saveto_only__ok", () => {
		// EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type              | name | label | save_to  |
				| | begin_repeat      | r1   | R1    |          |
				| |   text            | q1   | Q1    | e1#e1p1  |
				| |   begin_group     | g1   | G1    |          |
				| |     text          | q2   | Q2    | e1#e1p2  |
				| |     begin_repeat  | r2   | R2    |          |
				| |       begin_group | g2   | G2    |          |
				| |         text      | q3   | Q3    | e2#e2p1  |
				| |       end_group   | g2   |       |          |
				| |       begin_group | g3   | G3    |          |
				| |         text      | q4   | Q4    | e2#e2p2  |
				| |       end_group   | g3   |       |          |
				| |     end_repeat    | r2   |       |          |
				| |   end_group       | g1   |       |          |
				| | end_repeat        |      |       |          |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
			`,
			xml__xpath_match: [
				xpe_model_instance_meta("e1", "/x:r1", {
					create: true,
					label: true,
					repeat: true,
				}),
				xpe_model_instance_meta(
					"e2",
					"/x:r1[not(@jr:template)]/x:g1/x:r2[not(@jr:template)]",
					{ create: true, label: true, repeat: true },
				),
				xpe_model_bind_question_saveto("/r1/q1", "e1p1"),
				xpe_model_bind_question_saveto("/r1/g1/q2", "e1p2"),
				xpe_model_bind_question_saveto("/r1/g1/r2/g2/q3", "e2p1"),
				xpe_model_bind_question_saveto("/r1/g1/r2/g3/q4", "e2p2"),
			],
		});
	});

	it("test_unsolvable_meta_topology__depth_1_repeat__conflict_2_group__saveto_and_var__ok", () => {
		// EV014 EB016
		assertPyxformXform({
			md: `
				| survey |
				| | type              | name | label | save_to  |
				| | begin_repeat      | r1   | R1    |          |
				| |   text            | q1   | Q1    | e1#e1p1  |
				| |   begin_group     | g1   | G1    |          |
				| |     text          | q2   | Q2    | e1#e1p2  |
				| |     begin_group   | g2   | G2    |          |
				| |       begin_group | g3   | G3    |          |
				| |         text      | q3   | Q3    | e2#e2p1  |
				| |       end_group   | g3   |       |          |
				| |       begin_group | g4   | G4    |          |
				| |         text      | q4   | Q4    | e2#e2p2  |
				| |       end_group   | g4   |       |          |
				| |     end_group     | g2   |       |          |
				| |   end_group       | g1   |       |          |
				| | end_repeat        |      |       |          |
				| | text              | q5   | Q5    |          |

				| entities |
				| | list_name | label                     |
				| | e1        | E1                        |
				| | e2        | concat(\${q3}, \${q5})    |
			`,
			xml__xpath_match: [
				xpe_model_instance_meta("e1", "/x:r1", {
					create: true,
					label: true,
					repeat: true,
				}),
				xpe_model_instance_meta("e2", "/x:r1[not(@jr:template)]/x:g1/x:g2", {
					create: true,
					label: true,
					repeat: true,
				}),
				xpe_model_bind_question_saveto("/r1/q1", "e1p1"),
				xpe_model_bind_question_saveto("/r1/g1/q2", "e1p2"),
				xpe_model_bind_question_saveto("/r1/g1/g2/g3/q3", "e2p1"),
				xpe_model_bind_question_saveto("/r1/g1/g2/g4/q4", "e2p2"),
				xpe_model_bind_meta_label(
					"concat( ../../../g3/q3 ,  /test_name/q5 )",
					"/r1/g1/g2",
				),
			],
		});
	});

	it("test_unsolvable_meta_topology__depth_1_repeat__conflict_3_group__saveto_only__error", () => {
		// EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type              | name | label | save_to  |
				| | begin_repeat      | r1   | R1    |          |
				| | text              | q1   | Q1    | e1#e1p1  |
				| |   begin_group     | g1   | G1    |          |
				| |     text          | q2   | Q2    | e1#e1p2  |
				| |     begin_group   | g2   | G2    |          |
				| |       begin_group | g3   | G3    |          |
				| |         text      | q3   | Q3    | e2#e2p1  |
				| |       end_group   | g3   |       |          |
				| |       begin_group | g4   | G4    |          |
				| |         text      | q4   | Q4    | e2#e2p2  |
				| |       end_group   | g4   |       |          |
				| |       text        | q5   | Q5    | e3#e3p1  |
				| |     end_group     | g2   |       |          |
				| |     text          | q6   | Q6    | e3#e3p2  |
				| |   end_group       | g1   |       |          |
				| | end_repeat        |      |       |          |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
				| | e3        | E3    |
			`,
			errored: true,
			error__contains: [
				"[row : 4] On the 'entities' sheet, the entity declaration is invalid. Each container (survey, group, repeat) may have only one entity declaration, but there are no valid containers available in the scope: '/survey/r1', which has been allocated to the entity on row '3'.",
			],
		});
	});

	it("test_unsolvable_meta_topology__depth_1_repeat__conflict_3_group__saveto_only__ok", () => {
		// EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type              | name | label | save_to  | calculation |
				| | begin_repeat      | r1   | R1    |          |             |
				| | text              | q1   | Q1    | e1#e1p1  |             |
				| |   begin_group     | g1   | G1    |          |             |
				| |     text          | q2   | Q2    | e1#e1p2  |             |
				| |     begin_group   | g2   | G2    |          |             |
				| |       begin_group | g3   | G3    |          |             |
				| |         text      | q3   | Q3    | e2#e2p1  |             |
				| |       end_group   | g3   |       |          |             |
				| |       begin_group | g4   | G4    |          |             |
				| |         text      | q4   | Q4    | e2#e2p2  |             |
				| |       end_group   | g4   |       |          |             |
				| |       text        | q5   | Q5    |          |             |
				| |     end_group     | g2   |       |          |             |
				| |     begin_group   | g5   | G5    |          |             |
				| |       text        | q6   | Q6    | e3#e3p1  |             |
				| |       calculate   | q7   | Q7    | e3#e3p2  | \${q5}      |
				| |     end_group     | g5   |       |          |             |
				| |   end_group       | g1   |       |          |             |
				| | end_repeat        |      |       |          |             |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
				| | e3        | E3    |
			`,
			xml__xpath_match: [
				xpe_model_instance_meta("e1", "/x:r1", {
					create: true,
					label: true,
					repeat: true,
				}),
				xpe_model_instance_meta("e2", "/x:r1[not(@jr:template)]/x:g1/x:g2", {
					create: true,
					label: true,
					repeat: true,
				}),
				xpe_model_instance_meta("e3", "/x:r1[not(@jr:template)]/x:g1/x:g5", {
					create: true,
					label: true,
					repeat: true,
				}),
				xpe_model_bind_question_saveto("/r1/q1", "e1p1"),
				xpe_model_bind_question_saveto("/r1/g1/q2", "e1p2"),
				xpe_model_bind_question_saveto("/r1/g1/g2/g3/q3", "e2p1"),
				xpe_model_bind_question_saveto("/r1/g1/g2/g4/q4", "e2p2"),
				xpe_model_bind_question_saveto("/r1/g1/g5/q6", "e3p1"),
				xpe_model_bind_question_saveto("/r1/g1/g5/q7", "e3p2"),
			],
		});
	});

	it("test_unsolvable_meta_topology__depth_1_repeat__conflict_group__saveto_only__nest_group__error", () => {
		// EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type            | name | label | save_to  |
				| | begin_repeat    | r1   | R1    |          |
				| | text            | q1   | Q1    | e1#e1p1  |
				| |   begin_group   | g1   | G1    |          |
				| |     begin_group | g2   | G2    |          |
				| |       text      | q2   | Q2    | e1#e1p2  |
				| |     end_group   | g2   |       |          |
				| |     begin_group | g3   | G3    |          |
				| |       text      | q3   | Q3    | e2#e2p1  |
				| |     end_group   | g3   |       |          |
				| |     begin_group | g4   | G4    |          |
				| |       text      | q4   | Q4    | e2#e2p2  |
				| |     end_group   | g4   |       |          |
				| |   end_group     | g1   |       |          |
				| | end_repeat      |      |       |          |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'entities' sheet, the entity declaration is invalid. Each container (survey, group, repeat) may have only one entity declaration, but there are no valid containers available in the scope: '/survey/r1', which has been allocated to the entity on row '2'.",
			],
		});
	});

	it("test_save_to_scope_breach__depth_1_repeat__error", () => {
		// ES006 EV015
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to  |
				| | text         | q1   | Q1    | e1#e1p1  |
				| | begin_repeat | r1   | R1    |          |
				| | text         | q2   | Q2    | e1#e1p2  |
				| | end_repeat   | r1   |       |          |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'save_to' value is invalid. The entity list name 'e1' has a reference in container scope '/survey/r1' which is not compatible with this 'save_to' reference in scope '/survey'.",
			],
		});
	});

	it("test_save_to_scope_breach__depth_1_repeat__ancestor_var__ok", () => {
		// ES006 EV015
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to  |
				| | text         | q1   | Q1    |          |
				| | begin_repeat | r1   | R1    |          |
				| | text         | q2   | Q2    | e1#e1p1  |
				| | end_repeat   | r1   |       |          |

				| entities |
				| | list_name | label  |
				| | e1        | \${q1} |
			`,
			warnings_count: 0,
		});
	});

	it("test_save_to_scope_breach__depth_1_repeat__save_to_only__ok", () => {
		// ES006 EV014 EV015
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to  |
				| | begin_repeat | r1   | R1    |          |
				| | text         | q1   | Q1    | e1#e1p1  |
				| | begin_group  | g1   | G1    |          |
				| | text         | q2   | Q2    | e1#e1p2  |
				| | end_group    | g1   |       |          |
				| | end_repeat   | r1   |       |          |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			warnings_count: 0,
		});
	});

	it("test_save_to_scope_breach__depth_1_repeat__save_and_var__ok", () => {
		// ES006 EV014 EV015
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to  |
				| | begin_repeat | r1   | R1    |          |
				| | text         | q1   | Q1    | e1#e1p1  |
				| | begin_group  | g1   | G1    |          |
				| | text         | q2   | Q2    | e1#e1p2  |
				| | end_group    | g1   |       |          |
				| | text         | q3   | Q3    |          |
				| | end_repeat   | r1   |       |          |

				| entities |
				| | list_name | label                                          |
				| | e1        | concat(\${q1}, " ", \${q2}, " ", \${q3})       |
			`,
			warnings_count: 0,
		});
	});

	it("test_save_to_scope_breach__depth_1_repeat__var_only__ok", () => {
		// ES006 EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin_repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | begin_group  | g1   | G1    |
				| | text         | q2   | Q2    |
				| | end_group    | g1   |       |
				| | text         | q3   | Q3    |
				| | end_repeat   | r1   |       |

				| entities |
				| | list_name | label                                          |
				| | e1        | concat(\${q1}, " ", \${q2}, " ", \${q3})       |
			`,
			warnings_count: 0,
		});
	});

	it("test_save_to_scope_breach__depth_1_repeat__multiple_lists__ok", () => {
		// ES006 EV015
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to  |
				| | text         | q1   | Q1    | e1#e1p1  |
				| | begin_repeat | r1   | R1    |          |
				| | text         | q2   | Q2    | e2#e1p1  |
				| | end_repeat   | r1   |       |          |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
			`,
			warnings_count: 0,
		});
	});

	it("test_save_to_scope_breach__depth_1_group__multiple_lists__ok", () => {
		// ES006 EV015
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to  |
				| | text        | q1   | Q1    | e1#e1p1  |
				| | begin_group | g1   | G1    |          |
				| | text        | q2   | Q2    | e2#e1p1  |
				| | end_group   | g1   |       |          |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| | e2        | E2    |
			`,
			warnings_count: 0,
		});
	});

	it("test_save_to_scope_breach__depth_1_repeat__same_scope__ok", () => {
		// ES006 EV015
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to  |
				| | begin_repeat | r1   | R1    |          |
				| | text         | q1   | Q1    | e1#e1p1  |
				| | text         | q2   | Q2    | e1#e1p2  |
				| | end_repeat   | r1   |       |          |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			warnings_count: 0,
		});
	});

	it("test_save_to_scope_breach__depth_1_group__same_scope__ok", () => {
		// ES006 EV015
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label | save_to  |
				| | begin_group | g1   | G1    |          |
				| | text        | q1   | Q1    | e1#e1p1  |
				| | text        | q2   | Q2    | e1#e1p2  |
				| | end_group   | g1   |       |          |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			warnings_count: 0,
		});
	});

	it("test_save_to_scope_breach__depth_2_repeat__error", () => {
		// ES006 EV015
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to  |
				| | text         | q1   | Q1    |          |
				| | begin_repeat | r1   | R1    |          |
				| | text         | q2   | Q2    | e1#e1p1  |
				| | begin_repeat | r2   | R2    |          |
				| | text         | q3   | Q3    | e1#e1p2  |
				| | end_repeat   | r2   |       |          |
				| | end_repeat   | r1   |       |          |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 4] On the 'survey' sheet, the 'save_to' value is invalid. The entity list name 'e1' has a reference in container scope '/survey/r1/r2' which is not compatible with this 'save_to' reference in scope '/survey/r1'.",
			],
		});
	});

	it("test_save_to_scope_breach__depth_2_group__save_to_only__ok", () => {
		// ES006 EV014 EV015
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to  |
				| | begin_group  | g1   | G1    |          |
				| | begin_repeat | r1   | R1    |          |
				| | text         | q1   | Q1    | e1#e1p1  |
				| | begin_group  | g2   | G2    |          |
				| | text         | q2   | Q2    | e1#e1p2  |
				| | end_group    | g2   |       |          |
				| | end_repeat   | r1   |       |          |
				| | end_group    | g1   |       |          |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			warnings_count: 0,
		});
	});

	it("test_save_to_scope_breach__depth_2_group__save_and_var__ok", () => {
		// ES006 EV014 EV015
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to  |
				| | begin_group  | g1   | G1    |          |
				| | begin_repeat | r1   | R1    |          |
				| | text         | q1   | Q1    | e1#e1p1  |
				| | begin_group  | g2   | G2    |          |
				| | text         | q2   | Q2    | e1#e1p2  |
				| | end_group    | g2   |       |          |
				| | text         | q3   | Q3    |          |
				| | end_repeat   | r1   |       |          |
				| | end_group    | g1   |       |          |

				| entities |
				| | list_name | label                                          |
				| | e1        | concat(\${q1}, " ", \${q2}, " ", \${q3})       |
			`,
			warnings_count: 0,
		});
	});

	it("test_save_to_scope_breach__depth_2_group__var_only__ok", () => {
		// ES006 EV014
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin_group  | g1   | G1    |
				| | begin_repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | begin_group  | g2   | G2    |
				| | text         | q2   | Q2    |
				| | end_group    | g2   |       |
				| | text         | q3   | Q3    |
				| | end_repeat   | r1   |       |
				| | end_group    | g1   |       |

				| entities |
				| | list_name | label                                          |
				| | e1        | concat(\${q1}, " ", \${q2}, " ", \${q3})       |
			`,
			warnings_count: 0,
		});
	});

	it("test_ref_scope_conflict__depth_1_sibling_repeat__saveto_only__error", () => {
		// EV016
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to  |
				| | text         | q1   | Q1    |          |
				| | begin_repeat | r1   | R1    |          |
				| | text         | q2   | Q2    | e1#e1p1  |
				| | end_repeat   | r1   |       |          |
				| | begin_repeat | r2   | R2    |          |
				| | text         | q3   | Q3    | e1#e1p2  |
				| | end_repeat   | r2   |       |          |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 7] On the 'survey' sheet, the 'save_to' value is invalid. The entity list name 'e1' has a reference in container scope '/survey/r1' which is not compatible with this 'save_to' reference in scope '/survey/r2'.",
			],
		});
	});

	it("test_ref_scope_conflict__depth_1_sibling_repeat__var_then_saveto__error", () => {
		// EV016
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to  |
				| | text         | q1   | Q1    |          |
				| | begin_repeat | r1   | R1    |          |
				| | text         | q2   | Q2    |          |
				| | end_repeat   | r1   |       |          |
				| | begin_repeat | r2   | R2    |          |
				| | text         | q3   | Q3    | e1#e1p1  |
				| | end_repeat   | r2   |       |          |

				| entities |
				| | list_name | label  |
				| | e1        | \${q2} |
			`,
			errored: true,
			error__contains: [
				"[row : 7] On the 'survey' sheet, the 'save_to' value is invalid. The entity list name 'e1' has a reference in container scope '/survey/r1' which is not compatible with this 'save_to' reference in scope '/survey/r2'.",
			],
		});
	});

	it("test_ref_scope_conflict__depth_1_sibling_repeat__saveto_then_var__error", () => {
		// EV016
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to  |
				| | text         | q1   | Q1    |          |
				| | begin_repeat | r1   | R1    |          |
				| | text         | q2   | Q2    | e1#e1p1  |
				| | end_repeat   | r1   |       |          |
				| | begin_repeat | r2   | R2    |          |
				| | text         | q3   | Q3    |          |
				| | end_repeat   | r2   |       |          |

				| entities |
				| | list_name | label  |
				| | e1        | \${q3} |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'entities' sheet, the entity declaration is invalid. The entity list name 'e1' has a reference in container scope '/survey/r1' which is not compatible with the variable reference to 'q3' in scope '/survey/r2'.",
			],
		});
	});

	it("test_ref_scope_conflict__depth_1_sibling_repeat__var_only__error", () => {
		// EV016
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | text         | q1   | Q1    |
				| | begin_repeat | r1   | R1    |
				| | text         | q2   | Q2    |
				| | end_repeat   | r1   |       |
				| | begin_repeat | r2   | R2    |
				| | text         | q3   | Q3    |
				| | end_repeat   | r2   |       |

				| entities |
				| | list_name | label                          |
				| | e1        | concat(\${q2}, " ", \${q3})    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'entities' sheet, the entity declaration is invalid. The entity list name 'e1' has a reference in container scope '/survey/r1' which is not compatible with the variable reference to 'q3' in scope '/survey/r2'.",
			],
		});
	});

	it("test_ref_scope_conflict__depth_1_sibling_repeat__var_only__indexed_repeat__error", () => {
		// EV016
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | text         | q1   | Q1    |
				| | begin_repeat | r1   | R1    |
				| | text         | q2   | Q2    |
				| | end_repeat   | r1   |       |
				| | begin_repeat | r2   | R2    |
				| | text         | q3   | Q3    |
				| | end_repeat   | r2   |       |

				| entities |
				| | list_name | label                                                        |
				| | e1        | concat(\${q2}, " ", indexed-repeat(\${q3}, \${r2}, 1))       |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'entities' sheet, the entity declaration is invalid. The entity list name 'e1' has a reference in container scope '/survey/r1' which is not compatible with the variable reference to 'q3' in scope '/survey/r2'.",
			],
		});
	});

	it("test_ref_scope_conflict__depth_2_asymmetric_lineage__saveto_only__error", () => {
		// EV016
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to  |
				| | text         | q1   | Q1    |          |
				| | begin_repeat | r1   | R1    |          |
				| | text         | q2   | Q2    | e1#e1p1  |
				| | end_repeat   | r1   |       |          |
				| | begin_repeat | r2   | R2    |          |
				| | begin_repeat | r3   | R3    |          |
				| | text         | q3   | Q3    | e1#e1p2  |
				| | end_repeat   | r3   |       |          |
				| | end_repeat   | r2   |       |          |

				| entities |
				| | list_name | label  |
				| | e1        | \${q3} |
			`,
			errored: true,
			error__contains: [
				"[row : 4] On the 'survey' sheet, the 'save_to' value is invalid. The entity list name 'e1' has a reference in container scope '/survey/r2/r3' which is not compatible with this 'save_to' reference in scope '/survey/r1'.",
			],
		});
	});

	it("test_ref_scope_conflict__depth_2_asymmetric_lineage__var_then_saveto__error", () => {
		// EV016
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to  |
				| | text         | q1   | Q1    |          |
				| | begin_repeat | r1   | R1    |          |
				| | text         | q2   | Q2    |          |
				| | end_repeat   | r1   |       |          |
				| | begin_repeat | r2   | R2    |          |
				| | begin_repeat | r3   | R3    |          |
				| | text         | q3   | Q3    | e1#e1p1  |
				| | end_repeat   | r3   |       |          |
				| | end_repeat   | r2   |       |          |

				| entities |
				| | list_name | label  |
				| | e1        | \${q2} |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'entities' sheet, the entity declaration is invalid. The entity list name 'e1' has a reference in container scope '/survey/r2/r3' which is not compatible with the variable reference to 'q2' in scope '/survey/r1'.",
			],
		});
	});

	it("test_ref_scope_conflict__depth_2_asymmetric_lineage__saveto_then_var__error", () => {
		// EV016
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | save_to  |
				| | text         | q1   | Q1    |          |
				| | begin_repeat | r1   | R1    |          |
				| | text         | q2   | Q2    | e1#e1p1  |
				| | end_repeat   | r1   |       |          |
				| | begin_repeat | r2   | R2    |          |
				| | begin_repeat | r3   | R3    |          |
				| | text         | q3   | Q3    |          |
				| | end_repeat   | r3   |       |          |
				| | end_repeat   | r2   |       |          |

				| entities |
				| | list_name | label  |
				| | e1        | \${q3} |
			`,
			errored: true,
			error__contains: [
				"[row : 4] On the 'survey' sheet, the 'save_to' value is invalid. The entity list name 'e1' has a reference in container scope '/survey/r2/r3' which is not compatible with this 'save_to' reference in scope '/survey/r1'.",
			],
		});
	});

	it("test_ref_scope_conflict__depth_1_asymmetric_lineage__saveto_only__error", () => {
		// EV016 EB023
		assertPyxformXform({
			md: `
				| survey |
				| | type             | name | label | save_to |
				| | begin_repeat     | r1   | R1    |         |
				| |   text           | q1   | Q1    | e1p1    |
				| |   begin_group    | g1   | G1    |         |
				| |     text         | q2   | Q2    | e1p2    |
				| |   end_group      | g1   |       |         |
				| | end_repeat       | r1   |       |         |
				| | begin_group      | g2   | G2    |         |
				| |   begin_group    | g3   | G3    |         |
				| |     text         | q3   | Q3    |         |
				| |     begin_repeat | r2   | R2    |         |
				| |       text       | q4   | Q4    | e1p3    |
				| |     end_repeat   | r2   |       |         |
				| |   end_group      | g2   |       |         |
				| | end_group        | g3   |       |         |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 12] On the 'survey' sheet, the 'save_to' value is invalid. The entity list name 'e1' has a reference in container scope '/survey/r1' which is not compatible with this 'save_to' reference in scope '/survey/g2/g3/r2'.",
			],
		});
	});

	it("test_ref_scope_conflict__depth_2_asymmetric_lineage__var_only__error", () => {
		// EV016
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | text         | q1   | Q1    |
				| | begin_repeat | r1   | R1    |
				| | text         | q2   | Q2    |
				| | end_repeat   | r1   |       |
				| | begin_repeat | r2   | R2    |
				| | begin_repeat | r3   | R3    |
				| | text         | q3   | Q3    |
				| | end_repeat   | r3   |       |
				| | end_repeat   | r2   |       |

				| entities |
				| | list_name | label                          |
				| | e1        | concat(\${q2}, " ", \${q3})    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'entities' sheet, the entity declaration is invalid. The entity list name 'e1' has a reference in container scope '/survey/r2/r3' which is not compatible with the variable reference to 'q2' in scope '/survey/r1'.",
			],
		});
	});

	it("test_duplicate_save_to_delimiter__error (e1##e1p1)", () => {
		// EV017
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to   |
				| | text | q1   | Q1    | e1##e1p1  |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'save_to' value is invalid. A 'save_to' value must have at most one '#' delimiter character.",
			],
		});
	});

	it("test_duplicate_save_to_delimiter__error (e1#e1#p1)", () => {
		// EV017
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to   |
				| | text | q1   | Q1    | e1#e1#p1  |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'save_to' value is invalid. A 'save_to' value must have at most one '#' delimiter character.",
			],
		});
	});

	it("test_duplicate_save_to_delimiter__error (##e1p1)", () => {
		// EV017
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to  |
				| | text | q1   | Q1    | ##e1p1   |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'save_to' value is invalid. A 'save_to' value must have at most one '#' delimiter character.",
			],
		});
	});

	it("test_dataset_name__xml_identifier__error", () => {
		// ES003 EV018
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | $e1       | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'entities' sheet, the 'dataset' value is invalid. Names must begin with a letter or underscore.",
			],
		});
	});

	it("test_dataset_name__period__error", () => {
		// ES003 EV019
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | e.1       | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'entities' sheet, the 'dataset' value is invalid. Names used here must not contain a period.",
			],
		});
	});

	it("test_dataset_name__reserved_prefix__error", () => {
		// ES003 EV020
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | __e1      | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'entities' sheet, the 'dataset' value is invalid. Names used here must not begin with two underscores.",
			],
		});
	});

	it("test_dataset_name__missing__error", () => {
		// ES003 EV024
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| |           | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'entities' sheet, the 'list_name' value is invalid. Entity lists must have a name.",
			],
		});
	});

	it("test_dataset_name__missing_multiple__error", () => {
		// ES003 EV024
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
				| |           | E2    |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'entities' sheet, the 'list_name' value is invalid. Entity lists must have a name.",
			],
		});
	});

	it("test_save_to_name__xml_identifier__error ($e1p1)", () => {
		// ES005 EV021
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to |
				| | text | q1   | Q1    | $e1p1   |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'save_to' value is invalid. Names must begin with a letter or underscore.",
			],
		});
	});

	it("test_save_to_name__xml_identifier__error (e1#)", () => {
		// ES005 EV021
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to |
				| | text | q1   | Q1    | e1#     |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'save_to' value is invalid. Names must begin with a letter or underscore.",
			],
		});
	});

	it("test_save_to_name__xml_identifier__error (e1#$e1p1)", () => {
		// ES005 EV021
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to   |
				| | text | q1   | Q1    | e1#$e1p1  |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'save_to' value is invalid. Names must begin with a letter or underscore.",
			],
		});
	});

	it("test_save_to_name__reserved_name__error (name)", () => {
		// ES005 EV022
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to |
				| | text | q1   | Q1    | name    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'save_to' value is invalid. Names used here must not be 'name' or 'label' (case-insensitive).",
			],
		});
	});

	it("test_save_to_name__reserved_name__error (naMe)", () => {
		// ES005 EV022
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to |
				| | text | q1   | Q1    | naMe    |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'save_to' value is invalid. Names used here must not be 'name' or 'label' (case-insensitive).",
			],
		});
	});

	it("test_save_to_name__reserved_name__error (label)", () => {
		// ES005 EV022
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to |
				| | text | q1   | Q1    | label   |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'save_to' value is invalid. Names used here must not be 'name' or 'label' (case-insensitive).",
			],
		});
	});

	it("test_save_to_name__reserved_name__error (lAbEl)", () => {
		// ES005 EV022
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to |
				| | text | q1   | Q1    | lAbEl   |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'save_to' value is invalid. Names used here must not be 'name' or 'label' (case-insensitive).",
			],
		});
	});

	it("test_save_to_name__reserved_prefix__error", () => {
		// ES005 EV023
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label | save_to  |
				| | text | q1   | Q1    | __e1p1   |

				| entities |
				| | list_name | label |
				| | e1        | E1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'save_to' value is invalid. Names used here must not begin with two underscores.",
			],
		});
	});

	it("test_list_name_or_dataset_alias__error (list_name)", () => {
		// EB001
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | list_name | label  |
				| | e1        | \${q1} |
			`,
			warnings_count: 0,
		});
	});

	it("test_list_name_or_dataset_alias__error (dataset)", () => {
		// EB001
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |

				| entities |
				| | dataset | label  |
				| | e1      | \${q1} |
			`,
			warnings_count: 0,
		});
	});
});
