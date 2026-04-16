/**
 * Port of test_survey.py - Survey class tests.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as constants from "../src/constants.js";
import { InputQuestion } from "../src/question.js";
import { GroupedSection, RepeatingSection } from "../src/section.js";
import { Survey, getPathRelativeToLcarStandalone } from "../src/survey.js";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestSurvey", () => {
	it("should not hit 64 recursion limit with many xpath references one to one", () => {
		const n = Array.from({ length: 250 }, () => "q1 = ${q1} ").join("");
		const r = Array.from({ length: 250 }, () => "${q1} = 'y'").join(" or ");
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

	it("should produce valid XML with variable references (xpath dict idempotency)", () => {
		// Adapted from test_xpath_dict_initialised_once.
		// Original uses internal Survey API; adapted to verify ${ref} variables work via assertPyxformXform.
		const result = assertPyxformXform({
			md: `
				| survey |      |      |                                |
				|        | type | name | label                          |
				|        | text | q1   | Your first name?               |
				|        | text | q2   | \${q1}, what is your last name? |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/test_name/q1']",
				"/h:html/h:body/x:input[@ref='/test_name/q2']",
			],
		});
		// Verify idempotency: converting again produces the same result
		const result2 = assertPyxformXform({
			md: `
				| survey |      |      |                                |
				|        | type | name | label                          |
				|        | text | q1   | Your first name?               |
				|        | text | q2   | \${q1}, what is your last name? |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@ref='/test_name/q1']",
				"/h:html/h:body/x:input[@ref='/test_name/q2']",
			],
		});
		expect(result?.xform).toBe(result2?.xform);
	});
});

/**
 * Build a Survey object tree from XPath specifications (matching Python build_survey_from_path_spec).
 */
function buildSurveyFromPathSpec(
	lcarContext: string,
	targetPath: string,
	sourcePath: string,
): [Survey, RepeatingSection | InputQuestion, InputQuestion] {
	const targetParts = `${lcarContext}${targetPath}`.split("/");
	const sourceParts = `${lcarContext}${sourcePath}`.split("/");

	let sharedPathLength = 0;
	for (let i = 0; i < Math.min(targetParts.length, sourceParts.length); i++) {
		sharedPathLength = i;
		if (targetParts[i] !== sourceParts[i]) {
			break;
		}
	}

	const survey = new Survey({ name: "data", type: constants.SURVEY });
	const targetName = targetParts[targetParts.length - 1];
	let lcar: RepeatingSection;
	let target: RepeatingSection | InputQuestion;

	if (targetName === "t") {
		lcar = new RepeatingSection({ name: "a", type: constants.REPEAT });
		target = new InputQuestion({
			name: targetName,
			label: "target",
			type: "string",
		});
	} else if (targetName === "at") {
		lcar = new RepeatingSection({ name: targetName, type: constants.REPEAT });
		target = lcar;
		sharedPathLength += 1;
	} else {
		throw new Error(`Unknown target_name: ${targetName}`);
	}

	const source = new InputQuestion({
		name: "s",
		label: `source \${${targetName}}`,
		type: "string",
	});
	let currentParent: Survey | RepeatingSection | GroupedSection = survey;
	const sharedPath = targetParts.slice(0, sharedPathLength);

	// Shared path
	for (const item of sharedPath) {
		if (!item || item === "y") continue;

		let newNode: RepeatingSection | GroupedSection;
		if (item[0] === "a") {
			newNode = lcar;
		} else if (item[0] === "r") {
			newNode = new RepeatingSection({ name: item, type: constants.REPEAT });
		} else {
			newNode = new GroupedSection({ name: item, type: constants.GROUP });
		}

		currentParent.addChild(newNode);
		currentParent = newNode;
	}

	// Target path
	let targetParent = currentParent;
	for (const item of targetParts.slice(sharedPathLength)) {
		if (item === "t") {
			targetParent.addChild(target);
		} else {
			if (!item) continue;
			let newNode: RepeatingSection | GroupedSection;
			if (item[0] === "r") {
				newNode = new RepeatingSection({ name: item, type: constants.REPEAT });
			} else {
				newNode = new GroupedSection({ name: item, type: constants.GROUP });
			}
			targetParent.addChild(newNode);
			targetParent = newNode;
		}
	}

	// Source path
	let sourceParent = currentParent;
	for (const item of sourceParts.slice(sharedPathLength)) {
		if (item === "s") {
			sourceParent.addChild(source);
		} else {
			if (!item) continue;
			let newNode: RepeatingSection | GroupedSection;
			if (item[0] === "r") {
				newNode = new RepeatingSection({ name: item, type: constants.REPEAT });
			} else {
				newNode = new GroupedSection({ name: item, type: constants.GROUP });
			}
			sourceParent.addChild(newNode);
			sourceParent = newNode;
		}
	}

	return [survey, target, source];
}

function assertRelativePath(opts: {
	lcarContext: string;
	targetPath: string;
	sourcePath: string;
	referenceParent: string;
	outSteps: string;
	outPath: string;
	expectNone: string;
}) {
	const [, target, source] = buildSurveyFromPathSpec(
		opts.lcarContext,
		opts.targetPath,
		opts.sourcePath,
	);

	const referenceParent = opts.referenceParent === "1";
	const expected: [number, string] = [
		Number.parseInt(opts.outSteps, 10),
		opts.outPath,
	];
	const expectNone = opts.expectNone === "1";

	const relation = source.lowestCommonAncestor(target, constants.REPEAT);
	const observed = getPathRelativeToLcarStandalone(
		target,
		source,
		relation[1] as number,
		relation[3] as number,
		referenceParent,
	);

	if (expectNone) {
		expect(observed).toEqual([null, null]);
	} else {
		expect(observed).toEqual(expected);
	}
}

describe("TestGetPathRelativeToLCAR", () => {
	it("test_relative_paths__combinations_max_inner_depth_of_2", () => {
		const csvPath = resolve(
			__dirname,
			"../../pyxform/tests/fixtures/get_path_relative_to_lcar_cases.csv",
		);
		const content = readFileSync(csvPath, "utf-8");
		const lines = content.trim().split("\n");
		const headers = lines[0].split(",");

		for (let i = 1; i < lines.length; i++) {
			const values = lines[i].split(",");
			const row: Record<string, string> = {};
			for (let j = 0; j < headers.length; j++) {
				row[headers[j]] = values[j];
			}
			assertRelativePath({
				lcarContext: row.lcar_context,
				targetPath: row.target_path,
				sourcePath: row.source_path,
				referenceParent: row.reference_parent,
				outSteps: row.out_steps,
				outPath: row.out_path,
				expectNone: row.expect_none,
			});
		}
	});

	it("test_relative_paths__outer_gg", () => {
		const topo = {
			lcarContext: "/y/g1o/g2o",
			targetPath: "/a/t",
			sourcePath: "/a/s",
			expectNone: "0",
		};
		const cases = [
			{ referenceParent: "0", outSteps: "1", outPath: "/t" },
			{ referenceParent: "1", outSteps: "2", outPath: "/a/t" },
		];
		for (const c of cases) {
			assertRelativePath({ ...topo, ...c });
		}
	});

	it("test_relative_paths__outer_rr", () => {
		const topo = {
			lcarContext: "/y/r1o/r2o",
			targetPath: "/a/t",
			sourcePath: "/a/s",
			expectNone: "0",
		};
		const cases = [
			{ referenceParent: "0", outSteps: "1", outPath: "/t" },
			{ referenceParent: "1", outSteps: "1", outPath: "/t" },
		];
		for (const c of cases) {
			assertRelativePath({ ...topo, ...c });
		}
	});

	it("test_relative_paths__outer_gr", () => {
		const topo = {
			lcarContext: "/y/g1o/r2o",
			targetPath: "/a/t",
			sourcePath: "/a/s",
			expectNone: "0",
		};
		const cases = [
			{ referenceParent: "0", outSteps: "1", outPath: "/t" },
			{ referenceParent: "1", outSteps: "1", outPath: "/t" },
		];
		for (const c of cases) {
			assertRelativePath({ ...topo, ...c });
		}
	});

	it("test_relative_paths__separate_ggg", () => {
		const topo = {
			lcarContext: "/y",
			targetPath: "/a/g1t/g2t/g3t/t",
			sourcePath: "/a/g1s/g2s/g3s/s",
			expectNone: "0",
		};
		const cases = [
			{ referenceParent: "0", outSteps: "4", outPath: "/g1t/g2t/g3t/t" },
			{ referenceParent: "1", outSteps: "5", outPath: "/a/g1t/g2t/g3t/t" },
		];
		for (const c of cases) {
			assertRelativePath({ ...topo, ...c });
		}
	});

	it("test_relative_paths__separate_ggr", () => {
		const topo = {
			lcarContext: "/y",
			targetPath: "/a/g1t/g2t/r3t/t",
			sourcePath: "/a/g1s/g2s/r3s/s",
			expectNone: "0",
		};
		const cases = [
			{ referenceParent: "0", outSteps: "4", outPath: "/g1t/g2t/r3t/t" },
			{ referenceParent: "1", outSteps: "4", outPath: "/g1t/g2t/r3t/t" },
		];
		for (const c of cases) {
			assertRelativePath({ ...topo, ...c });
		}
	});

	it("test_relative_paths__source_under_target__outer_r", () => {
		const topo = {
			lcarContext: "/y/r1o",
			targetPath: "/at",
			sourcePath: "/at/s",
			expectNone: "0",
		};
		const cases = [
			{ referenceParent: "0", outSteps: "2", outPath: "/at" },
			{ referenceParent: "1", outSteps: "3", outPath: "/r1o/at" },
		];
		for (const c of cases) {
			assertRelativePath({ ...topo, ...c });
		}
	});

	it("test_relative_paths__source_under_target__outer_rr", () => {
		const topo = {
			lcarContext: "/y/r1o/r2o",
			targetPath: "/at",
			sourcePath: "/at/s",
			expectNone: "0",
		};
		const cases = [
			{ referenceParent: "0", outSteps: "2", outPath: "/at" },
			{ referenceParent: "1", outSteps: "3", outPath: "/r2o/at" },
		];
		for (const c of cases) {
			assertRelativePath({ ...topo, ...c });
		}
	});

	it("test_relative_paths__source_under_target__outer_gr", () => {
		const topo = {
			lcarContext: "/y/g1o/r2o",
			targetPath: "/at",
			sourcePath: "/at/s",
			expectNone: "0",
		};
		const cases = [
			{ referenceParent: "0", outSteps: "2", outPath: "/at" },
			{ referenceParent: "1", outSteps: "3", outPath: "/r2o/at" },
		];
		for (const c of cases) {
			assertRelativePath({ ...topo, ...c });
		}
	});

	it("test_relative_paths__source_under_target__outer_r__inner_r", () => {
		const topo = {
			lcarContext: "/y/r1o",
			targetPath: "/at",
			sourcePath: "/at/r1s/s",
			expectNone: "0",
		};
		const cases = [
			{ referenceParent: "0", outSteps: "3", outPath: "/at" },
			{ referenceParent: "1", outSteps: "4", outPath: "/r1o/at" },
		];
		for (const c of cases) {
			assertRelativePath({ ...topo, ...c });
		}
	});

	it("test_relative_paths__source_under_target__outer_r__inner_rr", () => {
		const topo = {
			lcarContext: "/y/r1o",
			targetPath: "/at",
			sourcePath: "/at/r1s/r2s/s",
			expectNone: "0",
		};
		const cases = [
			{ referenceParent: "0", outSteps: "4", outPath: "/at" },
			{ referenceParent: "1", outSteps: "5", outPath: "/r1o/at" },
		];
		for (const c of cases) {
			assertRelativePath({ ...topo, ...c });
		}
	});

	it("test_relative_paths__source_under_target__outer_r__inner_rg", () => {
		const topo = {
			lcarContext: "/y/r1o",
			targetPath: "/at",
			sourcePath: "/at/r1s/g2s/s",
			expectNone: "0",
		};
		const cases = [
			{ referenceParent: "0", outSteps: "4", outPath: "/at" },
			{ referenceParent: "1", outSteps: "5", outPath: "/r1o/at" },
		];
		for (const c of cases) {
			assertRelativePath({ ...topo, ...c });
		}
	});

	it("test_relative_paths__source_under_target__outer_r__inner_g", () => {
		const topo = {
			lcarContext: "/y/r1o",
			targetPath: "/at",
			sourcePath: "/at/g1s/s",
			expectNone: "0",
		};
		const cases = [
			{ referenceParent: "0", outSteps: "3", outPath: "/at" },
			{ referenceParent: "1", outSteps: "4", outPath: "/r1o/at" },
		];
		for (const c of cases) {
			assertRelativePath({ ...topo, ...c });
		}
	});

	it("test_relative_paths__source_under_target__outer_r__inner_gg", () => {
		const topo = {
			lcarContext: "/y/r1o",
			targetPath: "/at",
			sourcePath: "/at/g1s/g2s/s",
			expectNone: "0",
		};
		const cases = [
			{ referenceParent: "0", outSteps: "4", outPath: "/at" },
			{ referenceParent: "1", outSteps: "5", outPath: "/r1o/at" },
		];
		for (const c of cases) {
			assertRelativePath({ ...topo, ...c });
		}
	});

	it("test_relative_paths__source_under_target__outer_r__inner_gr", () => {
		const topo = {
			lcarContext: "/y/r1o",
			targetPath: "/at",
			sourcePath: "/at/g1s/r2s/s",
			expectNone: "0",
		};
		const cases = [
			{ referenceParent: "0", outSteps: "4", outPath: "/at" },
			{ referenceParent: "1", outSteps: "5", outPath: "/r1o/at" },
		];
		for (const c of cases) {
			assertRelativePath({ ...topo, ...c });
		}
	});
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
