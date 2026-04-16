/**
 * Port of test_survey.py - Survey class tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestSurvey", () => {
	it("should not hit 64 recursion limit with many xpath references one to one", () => {
		const n = Array.from({ length: 250 }, () => "q1 = \${q1} ").join("");
		const r = Array.from({ length: 250 }, () => "\${q1} = 'y'").join(" or ");
		assertPyxformXform({
			md: `
			| survey |      |      |       |          |
			|        | type | name | label | relevant |
			|        | text | q1   | Q1    |          |
			|        | note | n    | ${n}  |          |
			|        | text | q2   | Q2    | ${r}     |
			`,
		});
	});

	it("should not hit 64 recursion limit with many xpath references many to one", () => {
		const qRows = Array.from({ length: 249 }, (_, i) => {
			const num = i + 1;
			return `|        | text | q${num}   | Q${num}    |`;
		}).join("\n");
		const nLabel = Array.from({ length: 249 }, (_, i) => {
			const num = i + 1;
			return `q${num} = \${q${num}} `;
		}).join(" ");
		assertPyxformXform({
			md: `
			| survey |      |      |       |
			|        | type | name | label |
			${qRows}
			|        | note | n    | ${nLabel}  |
			`,
		});
	});

	it("should not hit 64 recursion limit with many xpath references many to many", () => {
		const qRows = Array.from({ length: 249 }, (_, i) => {
			const num = i + 1;
			return `|        | text | q${num} | Q${num}    |`;
		}).join("\n");
		const nRows = Array.from({ length: 249 }, (_, i) => {
			const num = i + 1;
			return `|        | note | n${num} | q${num} = \${q${num}} |`;
		}).join("\n");
		assertPyxformXform({
			md: `
			| survey |      |      |       |
			|        | type | name | label |
			${qRows}
			${nRows}
			`,
		});
	});

	it("should add autoplay attribute to question body control", () => {
		assertPyxformXform({
			md: `
			| survey |
			|        | type  | name | label      | audio       | autoplay |
			|        | text  | feel | Song feel? | amazing.mp3 | audio    |
			`,
			xml__xpath_match: [
				`
				/h:html/h:body/x:input[@ref='/test_name/feel' and @autoplay='audio']
				`,
			],
		});
	});

	// TODO: requires internal API - test_xpath_dict_initialised_once
	// This test uses Survey/InputQuestion internal API directly (Survey.add_children,
	// _setup_xpath_dictionary, _xpath, to_xml) which doesn't map to assertPyxformXform.
});

describe.todo("TestGetPathRelativeToLCAR", () => {
	// TODO: requires internal API - test_relative_paths__combinations_max_inner_depth_of_2
	// This test reads a CSV fixture and calls build_survey_from_path_spec / get_path_relative_to_lcar
	// internal APIs directly. Cannot be converted to assertPyxformXform.

	// TODO: requires internal API - test_relative_paths__outer_gg
	// Uses build_survey_from_path_spec / get_path_relative_to_lcar internal APIs.

	// TODO: requires internal API - test_relative_paths__outer_rr
	// Uses build_survey_from_path_spec / get_path_relative_to_lcar internal APIs.

	// TODO: requires internal API - test_relative_paths__outer_gr
	// Uses build_survey_from_path_spec / get_path_relative_to_lcar internal APIs.

	// TODO: requires internal API - test_relative_paths__separate_ggg
	// Uses build_survey_from_path_spec / get_path_relative_to_lcar internal APIs.

	// TODO: requires internal API - test_relative_paths__separate_ggr
	// Uses build_survey_from_path_spec / get_path_relative_to_lcar internal APIs.

	// TODO: requires internal API - test_relative_paths__source_under_target__outer_r
	// Uses build_survey_from_path_spec / get_path_relative_to_lcar internal APIs.

	// TODO: requires internal API - test_relative_paths__source_under_target__outer_rr
	// Uses build_survey_from_path_spec / get_path_relative_to_lcar internal APIs.

	// TODO: requires internal API - test_relative_paths__source_under_target__outer_gr
	// Uses build_survey_from_path_spec / get_path_relative_to_lcar internal APIs.

	// TODO: requires internal API - test_relative_paths__source_under_target__outer_r__inner_r
	// Uses build_survey_from_path_spec / get_path_relative_to_lcar internal APIs.

	// TODO: requires internal API - test_relative_paths__source_under_target__outer_r__inner_rr
	// Uses build_survey_from_path_spec / get_path_relative_to_lcar internal APIs.

	// TODO: requires internal API - test_relative_paths__source_under_target__outer_r__inner_rg
	// Uses build_survey_from_path_spec / get_path_relative_to_lcar internal APIs.

	// TODO: requires internal API - test_relative_paths__source_under_target__outer_r__inner_g
	// Uses build_survey_from_path_spec / get_path_relative_to_lcar internal APIs.

	// TODO: requires internal API - test_relative_paths__source_under_target__outer_r__inner_gg
	// Uses build_survey_from_path_spec / get_path_relative_to_lcar internal APIs.

	// TODO: requires internal API - test_relative_paths__source_under_target__outer_r__inner_gr
	// Uses build_survey_from_path_spec / get_path_relative_to_lcar internal APIs.
});

describe("TestReferencesToAncestorRepeat", () => {
	it("should find xpath reference path is absolute for source under target", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type         | name | label  | default     |
			| | begin_repeat | t    | target |             |
			| | begin group  | g1t  | g1t    |             |
			| | date         | s    | source | \${t}[position() = position(current()/../..) - 1]/g1t/s |
			| | end group    | g1t  |        |             |
			| | end_repeat   | t    |        |             |
			| | begin_repeat | t2   | t2     |             |
			| | text         | s2   | s2     | \${t2}[position() = position(current()/..) - 1]/s2 |
			| | end_repeat   | t2   |        |             |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:setvalue[
				  @ref='/test_name/t/g1t/s'
				  and @value=' /test_name/t [position() = position(current()/../..) - 1]/g1t/s'
				]
				`,
				`
				/h:html/h:head/x:model/x:setvalue[
				  @ref='/test_name/t2/s2'
				  and @value=' /test_name/t2 [position() = position(current()/..) - 1]/s2'
				]
				`,
			],
		});
	});

	it("should find xpath reference path is absolute for source under target repeat", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type         | name | label | default   |
			| | begin_repeat | t    | t     |           |
			| | text         | s    | s     | \${t}[1]/s |
			| | end_repeat   |      |       |           |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:setvalue[
				  @ref='/test_name/t/s'
				  and @value=' /test_name/t [1]/s'
				]
				`,
			],
		});
	});

	it("should find xpath reference path is absolute for source under target repeat with inner group", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type         | name | label | default       |
			| | begin_repeat | t    | t     |               |
			| | begin_group  | g1s  | g1s   |               |
			| | text         | s    | s     | \${t}[1]/g1s/s |
			| | end_group    |      |       |               |
			| | end_repeat   |      |       |               |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:setvalue[
				  @ref='/test_name/t/g1s/s'
				  and @value=' /test_name/t [1]/g1s/s'
				]
				`,
			],
		});
	});

	it("should find xpath reference path is absolute for source under target repeat with inner repeat", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type         | name | label | default       |
			| | begin_repeat | t    | t     |               |
			| | begin_repeat | r1s  | r1s   |               |
			| | text         | s    | s     | \${t}[1]/r1s/s |
			| | end_repeat   |      |       |               |
			| | end_repeat   |      |       |               |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:setvalue[
				  @ref='/test_name/t/r1s/s'
				  and @value=' /test_name/t [1]/r1s/s'
				]
				`,
			],
		});
	});

	it("should find xpath reference path is absolute for source under target repeat with outer group", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type         | name | label | default   |
			| | begin_group  | g1o  | g1o   |           |
			| | begin_repeat | t    | t     |           |
			| | text         | s    | s     | \${t}[1]/s |
			| | end_repeat   |      |       |           |
			| | end_group    |      |       |           |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:setvalue[
				  @ref='/test_name/g1o/t/s'
				  and @value=' /test_name/g1o/t [1]/s'
				]
				`,
			],
		});
	});

	it("should find xpath reference path is absolute for source under target repeat with outer group and inner group", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type         | name | label | default       |
			| | begin_group  | g1o  | g1o   |               |
			| | begin_repeat | t    | t     |               |
			| | begin_group  | g1s  | g1s   |               |
			| | text         | s    | s     | \${t}[1]/g1s/s |
			| | end_group    |      |       |               |
			| | end_repeat   |      |       |               |
			| | end_group    |      |       |               |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:setvalue[
				  @ref='/test_name/g1o/t/g1s/s'
				  and @value=' /test_name/g1o/t [1]/g1s/s'
				]
				`,
			],
		});
	});

	it("should find xpath reference path is absolute for source under target repeat with outer group and inner repeat", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type         | name | label | default       |
			| | begin_group  | g1o  | g1o   |               |
			| | begin_repeat | t    | t     |               |
			| | begin_repeat | r1s  | r1s   |               |
			| | text         | s    | s     | \${t}[1]/r1s/s |
			| | end_repeat   |      |       |               |
			| | end_repeat   |      |       |               |
			| | end_group    |      |       |               |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:setvalue[
				  @ref='/test_name/g1o/t/r1s/s'
				  and @value=' /test_name/g1o/t [1]/r1s/s'
				]
				`,
			],
		});
	});
});
