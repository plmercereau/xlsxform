/**
 * Port of test_dynamic_default.py - Dynamic default value tests.
 */

import { describe, expect, it } from "vitest";
import { defaultIsDynamic } from "../src/question.js";
import { coalesce } from "../src/utils.js";
import { assertPyxformXform } from "./helpers/test-case.js";

// ---------------------------------------------------------------------------
// XPath helper: xpq (questions)
// ---------------------------------------------------------------------------
const xpq = {
	setvalue(opts: {
		path: string;
		ref: string;
		event: string;
		value?: string;
	}): string {
		const valueCmp = opts.value ? `and @value="${opts.value}" ` : "";
		return `
		/h:html/${opts.path}/x:setvalue[
		  @ref='${opts.ref}'
		  and @event='${opts.event}'
		  ${valueCmp}
		]
		`;
	},

	setgeopoint(opts: { path: string; ref: string; event: string }): string {
		return `
		/h:html/${opts.path}/odk:setgeopoint[
		  @ref='${opts.ref}'
		  and @event='${opts.event}'
		]
		`;
	},

	body_select1_itemset(qName: string): string {
		return `
		/h:html/h:body/x:select1[
		  @ref = '/test_name/${qName}'
		  and ./x:itemset
		  and not(./x:item)
		]
		`;
	},
};

// ---------------------------------------------------------------------------
// XPath helper: xpc (choices)
// ---------------------------------------------------------------------------
const xpc = {
	model_instance_choices_label(
		cname: string,
		choices: [string, string][],
	): string {
		const choicesXp = choices
			.map(
				([cv, cl]) =>
					`./x:item/x:name/text() = '${cv}' and ./x:item/x:label/text() = '${cl}'`,
			)
			.join("\n              and ");
		return `
		/h:html/h:head/x:model/x:instance[@id='${cname}']/x:root[
		  ${choicesXp}
		]
		`;
	},
};

// ---------------------------------------------------------------------------
// Case data type and XPath helper: xp
// ---------------------------------------------------------------------------
interface Case {
	isDynamic: boolean;
	qType: string;
	qDefault: string;
	qValue?: string | null;
	qLabelFr?: string;
}

function makeCase(
	isDynamic: boolean,
	qType: string,
	qDefault = "",
	qValue: string | null = null,
	qLabelFr = "",
): Case {
	return { isDynamic, qType, qDefault, qValue, qLabelFr };
}

const xp = {
	model_setvalue(qNum: number): string {
		return `
		/h:html/h:head/x:model/x:setvalue[
		  @ref="/test_name/q${qNum}"
		  and @event='odk-instance-first-load'
		]/@value
		`;
	},

	model(qNum: number, c: Case): string {
		const qDefaultFinal = coalesce(c.qValue, c.qDefault) ?? "";

		let qBind: string;
		if (["calculate", "select_one", "text"].includes(c.qType)) {
			qBind = "string";
		} else if (c.qType === "integer") {
			qBind = "int";
		} else {
			qBind = c.qType;
		}

		if (c.isDynamic) {
			const valueCmp = qDefaultFinal.includes("'")
				? ""
				: `and @value="${qDefaultFinal}" `;
			return `
			/h:html/h:head/x:model
			  /x:instance/x:test_name[@id="data"]/x:q${qNum}[
			    not(text())
			    and ancestor::x:model/x:bind[
			      @nodeset='/test_name/q${qNum}'
			      and @type='${qBind}'
			    ]
			    and ancestor::x:model/x:setvalue[
			      @ref="/test_name/q${qNum}"
			      and @event='odk-instance-first-load'
			      ${valueCmp}
			    ]
			  ]
			`;
		}
		let qDefaultCmp: string;
		if (qDefaultFinal.length === 0) {
			qDefaultCmp = "and not(text()) ";
		} else if (qDefaultFinal.includes("'")) {
			qDefaultCmp = "";
		} else {
			qDefaultCmp = `and text()='${qDefaultFinal}' `;
		}
		return `
			/h:html/h:head/x:model
			  /x:instance/x:test_name[@id="data"]/x:q${qNum}[
			    ancestor::x:model/x:bind[
			      @nodeset='/test_name/q${qNum}'
			      and @type='${qBind}'
			    ]
			    and not(ancestor::x:model/x:setvalue[@ref="/test_name/q${qNum}"])
			    ${qDefaultCmp}
			  ]
			`;
	},

	body_input(qNum: number, c: Case): string {
		const labelCmp =
			(c.qLabelFr ?? "") === ""
				? `./x:label[text()="Q${qNum}"]`
				: `./x:label[@ref="jr:itext('/test_name/q${qNum}:label')"]`;
		return `
		  /h:html/h:body/x:input[
		    @ref="/test_name/q${qNum}"
		    and  ${labelCmp}
		  ]
		`;
	},
};

// ===========================================================================
// TestDynamicDefault
// ===========================================================================
describe("TestDynamicDefault", () => {
	it("should use instance repeat template and first row for static default inside a repeat", () => {
		assertPyxformXform({
			md: `
			| survey |              |      |       |         |
			|        | type         | name | label | default |
			|        | integer      | q0   | Foo   | foo     |
			|        | begin repeat | r1   |       |         |
			|        | integer      | q1   | Bar   | 12      |
			|        | end repeat   | r1   |       |         |
			`,
			xml__xpath_match: [
				xp.model(0, makeCase(false, "integer", "foo")),
				// Repeat template and first row.
				`
				/h:html/h:head/x:model/x:instance/x:test_name[
				  @id="data"
				  and ./x:r1[@jr:template='']
				  and ./x:r1[not(@jr:template)]
				]
				`,
				// q1 static default value in repeat template.
				`
				/h:html/h:head/x:model[
				  ./x:bind[@nodeset='/test_name/r1/q1' and @type='int']
				]/x:instance/x:test_name[@id="data"]/x:r1[@jr:template='']/x:q1[text()='12']
				`,
				// q1 static default value in repeat row.
				`
				/h:html/h:head/x:model[
				  ./x:bind[@nodeset='/test_name/r1/q1' and @type='int']
				]/x:instance/x:test_name[@id="data"]/x:r1[not(@jr:template)]/x:q1[text()='12']
				`,
			],
		});
	});

	it("should use body setvalue for dynamic default form inside a repeat", () => {
		assertPyxformXform({
			md: `
			| survey |              |      |              |           |
			|        | type         | name | label        | default   |
			|        | begin repeat | r1   | Households   |           |
			|        | integer      | q0   | Your age     | random()  |
			|        | text         | q1   | Your feeling | not_func$ |
			|        | end repeat   | r1   |              |           |
			`,
			xml__xpath_match: [
				// Repeat template and first row.
				`
				/h:html/h:head/x:model/x:instance/x:test_name[
				  @id="data"
				  and ./x:r1[@jr:template='']
				  and ./x:r1[not(@jr:template)]
				]
				`,
				// q0 dynamic default value not in repeat template.
				`
				/h:html/h:head/x:model[
				  ./x:bind[@nodeset='/test_name/r1/q0' and @type='int']
				]/x:instance/x:test_name[@id="data"]/x:r1[@jr:template='']/x:q0[not(text())]
				`,
				// q0 dynamic default value not in repeat row.
				`
				/h:html/h:head/x:model[
				  ./x:bind[@nodeset='/test_name/r1/q0' and @type='int']
				]/x:instance/x:test_name[@id="data"]/x:r1[not(@jr:template)]/x:q0[not(text())]
				`,
				// q0 dynamic default value in model setvalue, with first-load event.
				xpq.setvalue({
					path: "h:head/x:model",
					ref: "/test_name/r1/q0",
					event: "odk-instance-first-load",
					value: "random()",
				}),
				// q0 dynamic default value in body group setvalue, with new-repeat event.
				xpq.setvalue({
					path: "h:body/x:group[@ref='/test_name/r1']/x:repeat[@nodeset='/test_name/r1']",
					ref: "/test_name/r1/q0",
					event: "odk-new-repeat",
					value: "random()",
				}),
				// q1 static default value in repeat template.
				`
				/h:html/h:head/x:model[
				  ./x:bind[@nodeset='/test_name/r1/q1' and @type='string']
				]/x:instance/x:test_name[@id="data"]/x:r1[@jr:template='']/x:q1[text()='not_func$']
				`,
				// q1 static default value in repeat row.
				`
				/h:html/h:head/x:model[
				  ./x:bind[@nodeset='/test_name/r1/q1' and @type='string']
				]/x:instance/x:test_name[@id="data"]/x:r1[not(@jr:template)]/x:q1[text()='not_func$']
				`,
			],
			// No other setvalue expected besides those above.
			xml__xpath_count: [["/h:html//x:setvalue", 2]],
		});
	});

	it("should use model setvalue for dynamic default form inside a group", () => {
		assertPyxformXform({
			md: `
			| survey |             |      |       |         |
			|        | type        | name | label | default |
			|        | integer     | q0   | Foo   |         |
			|        | begin group | g1   |       |         |
			|        | integer     | q1   | Bar   | \${q0}  |
			|        | end group   | g1   |       |         |
			`,
			xml__xpath_match: [
				// q0 element in instance.
				`/h:html/h:head/x:model/x:instance/x:test_name[@id="data"]/x:q0`,
				// Group element in instance.
				`/h:html/h:head/x:model/x:instance/x:test_name[@id="data"]/x:g1`,
				// q1 dynamic default not in instance.
				`/h:html/h:head/x:model/x:instance/x:test_name[@id="data"]/x:g1/x:q1[not(text())]`,
				// q1 dynamic default value in model setvalue, with 1 event.
				xpq.setvalue({
					path: "h:head/x:model",
					ref: "/test_name/g1/q1",
					event: "odk-instance-first-load",
					value: " /test_name/q0 ",
				}),
				// q1 dynamic default value not in body group setvalue.
				`
				/h:html/h:body/x:group[
				  @ref='/test_name/g1'
				  and not(child::setvalue[@ref='/test_name/g1/q1'])
				]
				`,
			],
			// No other setvalue expected besides those above.
			xml__xpath_count: [["/h:html//x:setvalue", 1]],
		});
	});

	it("should find model setvalue for dynamic default form inside a group", () => {
		assertPyxformXform({
			md: `
			| survey |              |      |       |         |
			|        | type         | name | label | default |
			|        | begin group  | g1   |       |         |
			|        | integer      | q0   | Foo   |         |
			|        | integer      | q1   | Bar   | \${q0}  |
			|        | end group    | g1   |       |         |
			`,
			xml__xpath_match: [
				// Group element in instance.
				`/h:html/h:head/x:model/x:instance/x:test_name[@id="data"]/x:g1`,
				// q0 element in group.
				`/h:html/h:head/x:model/x:instance/x:test_name[@id="data"]/x:g1/x:q0`,
				// q1 dynamic default not in instance.
				`/h:html/h:head/x:model/x:instance/x:test_name[@id="data"]/x:g1/x:q1[not(text())]`,
				// q1 dynamic default value in model setvalue, with 1 event.
				xpq.setvalue({
					path: "h:head/x:model",
					ref: "/test_name/g1/q1",
					event: "odk-instance-first-load",
					value: " /test_name/g1/q0 ",
				}),
				// q1 dynamic default value not in body group setvalue.
				`
				/h:html/h:body/x:group[
				  @ref='/test_name/g1'
				  and not(child::setvalue[@ref='/test_name/g1/q1'])
				]
				`,
			],
			// No other setvalue expected besides those above.
			xml__xpath_count: [["/h:html//x:setvalue", 1]],
		});
	});

	it("should find body setvalue for dynamic default form inside a repeat", () => {
		assertPyxformXform({
			md: `
			| survey |              |      |       |         |
			|        | type         | name | label | default |
			|        | begin repeat | r1   |       |         |
			|        | integer      | q0   | Foo   |         |
			|        | integer      | q1   | Bar   | \${q0}  |
			|        | end repeat   | r1   |       |         |
			`,
			xml__xpath_match: [
				// Repeat template and first row.
				`
				/h:html/h:head/x:model/x:instance/x:test_name[
				  @id="data"
				  and ./x:r1[@jr:template='']
				  and ./x:r1[not(@jr:template)]
				]
				`,
				// q0 element in repeat template.
				`
				/h:html/h:head/x:model[
				  ./x:bind[@nodeset='/test_name/r1/q0' and @type='int']
				]/x:instance/x:test_name[@id="data"]/x:r1[@jr:template='']/x:q0
				`,
				// q0 element in repeat row.
				`
				/h:html/h:head/x:model[
				  ./x:bind[@nodeset='/test_name/r1/q0' and @type='int']
				]/x:instance/x:test_name[@id="data"]/x:r1[not(@jr:template)]/x:q0
				`,
				// q1 dynamic default value in model setvalue, with first-load event.
				xpq.setvalue({
					path: "h:head/x:model",
					ref: "/test_name/r1/q1",
					event: "odk-instance-first-load",
					value: " ../q0 ",
				}),
				// q1 dynamic default value in body group setvalue, with new-repeat event.
				xpq.setvalue({
					path: "h:body/x:group[@ref='/test_name/r1']/x:repeat[@nodeset='/test_name/r1']",
					ref: "/test_name/r1/q1",
					event: "odk-new-repeat",
					value: " ../q0 ",
				}),
			],
			// No other setvalue expected besides those above.
			xml__xpath_count: [["/h:html//x:setvalue", 2]],
		});
	});

	it("should find body setvalue for dynamic default form inside a group and repeat", () => {
		assertPyxformXform({
			md: `
			| survey |              |      |       |         |
			|        | type         | name | label | default |
			|        | begin repeat | r1   |       |         |
			|        | begin group  | g1   |       |         |
			|        | integer      | q0   | Foo   |         |
			|        | integer      | q1   | Bar   | \${q0}  |
			|        | end group    | g1   |       |         |
			|        | end repeat   | r1   |       |         |
			`,
			xml__xpath_match: [
				// Repeat template and first row contains the group.
				`
				/h:html/h:head/x:model/x:instance/x:test_name[
				  @id="data"
				  and ./x:r1[@jr:template='']/x:g1
				  and ./x:r1[not(@jr:template)]/x:g1
				]
				`,
				// q0 element in repeat template.
				`
				/h:html/h:head/x:model[
				  ./x:bind[@nodeset='/test_name/r1/g1/q0' and @type='int']
				]/x:instance/x:test_name[@id="data"]/x:r1[@jr:template='']/x:g1/x:q0
				`,
				// q0 element in repeat row.
				`
				/h:html/h:head/x:model[
				  ./x:bind[@nodeset='/test_name/r1/g1/q0' and @type='int']
				]/x:instance/x:test_name[@id="data"]/x:r1[not(@jr:template)]/x:g1/x:q0
				`,
				// q1 dynamic default value in model setvalue, with first-load event.
				xpq.setvalue({
					path: "h:head/x:model",
					ref: "/test_name/r1/g1/q1",
					event: "odk-instance-first-load",
					value: " ../q0 ",
				}),
				// q1 dynamic default value in body group setvalue, with new-repeat event.
				xpq.setvalue({
					path: "h:body/x:group[@ref='/test_name/r1']/x:repeat[@nodeset='/test_name/r1']",
					ref: "/test_name/r1/g1/q1",
					event: "odk-new-repeat",
					value: " ../q0 ",
				}),
			],
			// No other setvalue expected besides those above.
			xml__xpath_count: [["/h:html//x:setvalue", 2]],
		});
	});

	it("should find body setvalue for dynamic default form inside 2 levels of repeat", () => {
		assertPyxformXform({
			md: `
			| survey |              |      |       |         |
			|        | type         | name | label | default |
			|        | begin repeat | r1   |       |         |
			|        | date         | q0   | Date  | now()   |
			|        | integer      | q1   | Foo   |         |
			|        | begin repeat | r2   |       |         |
			|        | integer      | q2   | Bar   | \${q1}  |
			|        | end repeat   | r2   |       |         |
			|        | end repeat   | r1   |       |         |
			`,
			xml__xpath_match: [
				// Repeat templates and first rows.
				`
				/h:html/h:head/x:model/x:instance/x:test_name[
				  @id="data"
				  and ./x:r1[@jr:template='']/x:r2[@jr:template='']
				  and ./x:r1[not(@jr:template)]/x:r2[not(@jr:template)]
				]
				`,
				// q0 element in repeat template.
				`
				/h:html/h:head/x:model[
				  ./x:bind[@nodeset='/test_name/r1/q0' and @type='date']
				]/x:instance/x:test_name[@id="data"]/x:r1[@jr:template='']/x:q0
				`,
				// q0 element in repeat row.
				`
				/h:html/h:head/x:model[
				  ./x:bind[@nodeset='/test_name/r1/q0' and @type='date']
				]/x:instance/x:test_name[@id="data"]/x:r1[not(@jr:template)]/x:q0
				`,
				// q0 dynamic default value in model setvalue, with first-load event.
				xpq.setvalue({
					path: "h:head/x:model",
					ref: "/test_name/r1/q0",
					event: "odk-instance-first-load",
					value: "now()",
				}),
				// q0 dynamic default value in body group setvalue, with new-repeat event.
				xpq.setvalue({
					path: "h:body/x:group[@ref='/test_name/r1']/x:repeat[@nodeset='/test_name/r1']",
					ref: "/test_name/r1/q0",
					event: "odk-new-repeat",
					value: "now()",
				}),
				// q1 element in repeat template.
				`
				/h:html/h:head/x:model[
				  ./x:bind[@nodeset='/test_name/r1/q1' and @type='int']
				]/x:instance/x:test_name[@id="data"]/x:r1[@jr:template='']/x:q1
				`,
				// q1 element in repeat row.
				`
				/h:html/h:head/x:model[
				  ./x:bind[@nodeset='/test_name/r1/q1' and @type='int']
				]/x:instance/x:test_name[@id="data"]/x:r1[not(@jr:template)]/x:q1
				`,
				// q2 element in repeat template.
				`
				/h:html/h:head/x:model[
				  ./x:bind[@nodeset='/test_name/r1/q1' and @type='int']
				]/x:instance/x:test_name[@id="data"]/x:r1[@jr:template='']/x:r2[@jr:template='']/x:q2
				`,
				// q2 element in repeat row.
				`
				/h:html/h:head/x:model[
				  ./x:bind[@nodeset='/test_name/r1/q1' and @type='int']
				]/x:instance/x:test_name[@id="data"]/x:r1[not(@jr:template)]/x:r2[not(@jr:template)]/x:q2
				`,
				// q2 dynamic default value in model setvalue, with first-load event.
				xpq.setvalue({
					path: "h:head/x:model",
					ref: "/test_name/r1/r2/q2",
					event: "odk-instance-first-load",
					value: " ../../q1 ",
				}),
				// q2 dynamic default value in body group setvalue, with new-repeat event.
				xpq.setvalue({
					path: "h:body/x:group/x:repeat/x:group/x:repeat[@nodeset='/test_name/r1/r2']",
					ref: "/test_name/r1/r2/q2",
					event: "odk-new-repeat",
					value: " ../../q1 ",
				}),
			],
			// No other setvalue expected besides those above.
			xml__xpath_count: [["/h:html//x:setvalue", 4]],
		});
	});

	it("should find body setvalue for dynamic default form inside 2 repeats and 1 group", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type         | name | label | default |
			| | begin_repeat | r1   |       |         |
			| | begin_repeat | r2   |       |         |
			| | begin_group  | g3   |       |         |
			| | integer      | q1   | Q1    |         |
			| | integer      | q2   | Q2    | 1 + 1   |
			| | end_group    | g3   |       |         |
			| | end_repeat   | r2   |       |         |
			| | end_repeat   | r1   |       |         |
			`,
			xml__xpath_match: [
				// q2 dynamic default value in model setvalue, with first-load event.
				xpq.setvalue({
					path: "h:head/x:model",
					ref: "/test_name/r1/r2/g3/q2",
					event: "odk-instance-first-load",
					value: "1 + 1",
				}),
				// q2 dynamic default value in body group setvalue, with new-repeat event.
				xpq.setvalue({
					path: "h:body/x:group/x:repeat/x:group/x:repeat[@nodeset='/test_name/r1/r2']",
					ref: "/test_name/r1/r2/g3/q2",
					event: "odk-new-repeat",
					value: "1 + 1",
				}),
			],
			// No other setvalue expected besides those above.
			xml__xpath_count: [["/h:html//x:setvalue", 2]],
		});
	});

	it("should not warn about dynamic defaults", () => {
		assertPyxformXform({
			md: `
			| survey |      |         |       |         |
			|        | type | name    | label | default |
			|        | text | foo     | Foo   |         |
			|        | text | bar     | Bar   | \${foo} |
			`,
			warnings_count: 0,
		});
	});

	it("should handle dynamic default on calculate", () => {
		assertPyxformXform({
			md: `
			| survey |            |      |       |             |                       |
			|        | type       | name | label | calculation | default               |
			|        | calculate  | q1   |       |             | random() + 0.5        |
			|        | calculate  | q2   |       |             | if(\${q1} < 1,'A','B') |
			`,
			xml__xpath_match: [
				xp.model(1, makeCase(true, "calculate", "random() + 0.5")),
				xp.model(
					2,
					makeCase(true, "calculate", "if( /test_name/q1  < 1,'A','B')"),
				),
				// Nothing in body since both questions are calculations.
				"/h:html/h:body[not(text) and count(./*) = 0]",
			],
		});
	});

	it("should handle dynamic default select choice name with hyphen", () => {
		assertPyxformXform({
			md: `
			| survey  |               |      |         |         |
			|         | type          | name | label   | default |
			|         | select_one c1 | q1   | Select1 | a-2     |
			|         | select_one c2 | q2   | Select2 | 1-1     |
			|         | select_one c3 | q3   | Select3 | a-b     |
			| choices |           |      |       |
			|         | list_name | name | label |
			|         | c1        | a-1  | C A-1 |
			|         | c1        | a-2  | C A-2 |
			|         | c2        | 1-1  | C 1-1 |
			|         | c2        | 2-2  | C 1-2 |
			|         | c3        | a-b  | C A-B |
			`,
			xml__xpath_match: [
				xp.model(1, makeCase(false, "select_one", "a-2")),
				xp.model(2, makeCase(false, "select_one", "1-1")),
				xp.model(3, makeCase(false, "select_one", "a-b")),
				xpc.model_instance_choices_label("c1", [
					["a-1", "C A-1"],
					["a-2", "C A-2"],
				]),
				xpc.model_instance_choices_label("c2", [
					["1-1", "C 1-1"],
					["2-2", "C 1-2"],
				]),
				xpc.model_instance_choices_label("c3", [["a-b", "C A-B"]]),
				xpq.body_select1_itemset("q1"),
				xpq.body_select1_itemset("q2"),
				xpq.body_select1_itemset("q3"),
			],
		});
	});

	it("should find setvalues for dynamic default and trigger", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type         | name | label | default | trigger |
			| | begin_repeat | r1   |       |         |         |
			| | integer      | q1   | Q1    | 1 + 1   |         |
			| | text         | q2   | Q2    |         | \${q1}  |
			| | end_repeat   | r1   |       |         |         |
			`,
			xml__xpath_match: [
				// q1 dynamic default value in model setvalue, with first-load event.
				xpq.setvalue({
					path: "h:head/x:model",
					ref: "/test_name/r1/q1",
					event: "odk-instance-first-load",
					value: "1 + 1",
				}),
				// q1 dynamic default value in body group setvalue, with new-repeat event.
				xpq.setvalue({
					path: "h:body/x:group/x:repeat[@nodeset='/test_name/r1']",
					ref: "/test_name/r1/q1",
					event: "odk-new-repeat",
					value: "1 + 1",
				}),
				// q1 trigger in body input control setvalue, with xforms-value-changed event.
				xpq.setvalue({
					path: "h:body/x:group/x:repeat/x:input[@ref='/test_name/r1/q1']",
					ref: "/test_name/r1/q2",
					event: "xforms-value-changed",
				}),
			],
			// No other setvalue expected besides those above.
			xml__xpath_count: [["/h:html//x:setvalue", 3]],
		});
	});

	it("should find actions for dynamic default and start-geopoint", () => {
		assertPyxformXform({
			md: `
			| survey |
			| | type           | name | label | default |
			| | begin_repeat   | r1   |       |         |
			| | start-geopoint | q1   | Q1    |         |
			| | geopoint       | q2   | Q2    | \${q1}  |
			| | end_repeat     | r1   |       |         |
			`,
			xml__xpath_match: [
				// q2 dynamic default value in model setvalue, with first-load event.
				xpq.setvalue({
					path: "h:head/x:model",
					ref: "/test_name/r1/q2",
					event: "odk-instance-first-load",
					value: " ../q1 ",
				}),
				// q2 dynamic default value in body group setvalue, with new-repeat event.
				xpq.setvalue({
					path: "h:body/x:group/x:repeat[@nodeset='/test_name/r1']",
					ref: "/test_name/r1/q2",
					event: "odk-new-repeat",
					value: " ../q1 ",
				}),
				// q1 setgeopoint in model, with first-load event.
				xpq.setgeopoint({
					path: "h:head/x:model",
					ref: "/test_name/r1/q1",
					event: "odk-instance-first-load",
				}),
			],
			// No other setvalue/setgeopoint expected besides those above.
			xml__xpath_count: [
				["/h:html//x:setvalue", 2],
				["/h:html//odk:setgeopoint", 1],
			],
		});
	});
});

// ===========================================================================
// TestDynamicDefaultSimpleInput
// ===========================================================================
describe("TestDynamicDefaultSimpleInput", () => {
	// Case data shared across tests in this describe block.
	const caseData: Case[] = [
		// --------
		// TEXT
		// --------
		// Literal with just alpha characters.
		makeCase(false, "integer", "foo"),
		// Literal with numeric characters.
		makeCase(false, "integer", "123"),
		// Literal with alphanumeric characters.
		makeCase(false, "text", "bar123"),
		// Literal text containing URI; https://github.com/XLSForm/pyxform/issues/533
		makeCase(false, "text", "https://my-site.com"),
		// Literal text containing brackets.
		makeCase(false, "text", "(https://mysite.com)"),
		// Literal text containing URI.
		makeCase(false, "text", "go to https://mysite.com"),
		// Literal text containing various non-operator symbols.
		makeCase(false, "text", "Repeat after me: '~!@#$%^&()_"),
		makeCase(false, "text", "not_func$"),
		// Names that look like a math expression.
		makeCase(false, "text", "f-g"),
		makeCase(false, "text", "f-4"),
		// Name that looks like a math expression, in a node ref.
		makeCase(false, "text", "./f-4"),
		// --------
		// INTEGER
		// --------
		// Names that look like a math expression.
		makeCase(false, "integer", "f-g"),
		makeCase(false, "integer", "f-4"),
		// --------
		// DATE(TIME)
		// --------
		// Literal date.
		makeCase(false, "date", "2022-03-14"),
		// Literal date, BCE.
		makeCase(false, "date", "-2022-03-14"),
		// Literal time.
		makeCase(false, "time", "01:02:55"),
		// Literal time, UTC.
		makeCase(false, "time", "01:02:55Z"),
		// Literal time, UTC + 0.
		makeCase(false, "time", "01:02:55+00:00"),
		// Literal time, UTC + 10.
		makeCase(false, "time", "01:02:55+10:00"),
		// Literal time, UTC - 7.
		makeCase(false, "time", "01:02:55-07:00"),
		// Literal datetime.
		makeCase(false, "date", "2022-03-14T01:02:55"),
		// Literal datetime, UTC.
		makeCase(false, "dateTime", "2022-03-14T01:02:55Z"),
		// Literal datetime, UTC + 0.
		makeCase(false, "dateTime", "2022-03-14T01:02:55+00:00"),
		// Literal datetime, UTC + 10.
		makeCase(false, "dateTime", "2022-03-14T01:02:55+10:00"),
		// Literal datetime, UTC - 7.
		makeCase(false, "dateTime", "2022-03-14T01:02:55-07:00"),
		// --------
		// GEO*
		// --------
		// Literal geopoint.
		makeCase(false, "geopoint", "32.7377112 -117.1288399 14 5.01"),
		// Literal geotrace.
		makeCase(
			false,
			"geotrace",
			"32.7377112 -117.1288399 14 5.01;32.7897897 -117.9876543 14 5.01",
		),
		// Literal geoshape.
		makeCase(
			false,
			"geoshape",
			"32.7377112 -117.1288399 14 5.01;32.7897897 -117.9876543 14 5.01;32.1231231 -117.1145877 14 5.01",
		),
		// --------
		// DYNAMIC
		// --------
		// Function call with no args.
		makeCase(true, "integer", "random()"),
		// Function with mixture of quotes.
		makeCase(true, "text", `ends-with('mystr', "str")`),
		// Function with node paths.
		makeCase(true, "text", "ends-with(../t2, ./t4)"),
		// Namespaced function. Although jr:itext probably does nothing?
		makeCase(true, "text", "jr:itext('/test/ref_text:label')"),
		// Compound expression with functions, operators, numeric/string literals.
		makeCase(true, "text", "if(../t2 = 'test', 1, 2) + 15 - int(1.2)"),
		// Compound expression with a literal first.
		makeCase(true, "text", "1 + decimal-date-time(now())"),
		// Nested function calls.
		makeCase(
			true,
			"text",
			`concat(if(../t1 = "this", 'go', "to"), "https://mysite.com")`,
		),
		// Two constants in a math expression.
		makeCase(true, "integer", "7 - 4"),
		makeCase(true, "text", "3 mod 3"),
		makeCase(true, "text", "5 div 5"),
		// 3 or more constants in a math expression.
		makeCase(true, "text", "2 + 3 * 4"),
		makeCase(true, "text", "5 div 5 - 5"),
		// Two constants, with a function call.
		makeCase(true, "integer", "random() + 2 * 5"),
		// Node path with operator and constant.
		makeCase(true, "text", "./f - 4"),
		// Two node paths with operator.
		makeCase(true, "text", "../t2 - ./t4"),
		// Math expression.
		makeCase(true, "text", "1 + 2 - 3 * 4 div 5 mod 6"),
		// Function with date type result.
		makeCase(true, "date", "concat('2022-03', '-14')"),
		// Pyxform reference.
		makeCase(true, "text", "${ref_text}", " /test_name/ref_text "),
		makeCase(true, "integer", "${ref_int}", " /test_name/ref_int "),
		// Pyxform reference, with last-saved.
		makeCase(
			true,
			"text",
			"${last-saved#ref_text}",
			" instance('__last-saved')/test_name/ref_text ",
		),
		// Pyxform reference, with last-saved, inside a function.
		makeCase(
			true,
			"integer",
			"if(${last-saved#ref_int} = '', 0, ${last-saved#ref_int} + 1)",
			"if( instance('__last-saved')/test_name/ref_int  = '', 0,  instance('__last-saved')/test_name/ref_int  + 1)",
		),
	];

	// Additional cases passed through default_is_dynamic only, not markdown->xform test.
	const caseDataExtras: Case[] = [
		// Union expression.
		// Rejected by ODK Validate: https://github.com/getodk/xforms-spec/issues/293
		makeCase(true, "text", String.raw`../t2 \| ./t4`),
	];

	it("should find expected return value for each case passed to defaultIsDynamic", () => {
		for (const c of [...caseData, ...caseDataExtras]) {
			expect(
				defaultIsDynamic(c.qDefault, c.qType),
				`Case: isDynamic=${c.isDynamic}, qType=${c.qType}, qDefault=${c.qDefault}`,
			).toBe(c.isDynamic);
		}
	});

	it("should find non-dynamic values in instance and dynamic values in setvalue", () => {
		const casesEnum: [number, Case][] = caseData.map((c, i) => [i, c]);
		// Ref_* items here for the above Cases to use in Pyxform ${references}.
		const mdHead = `
		| survey |            |          |          |               |                    |
		|        | type       | name     | label    | default       | label::French (fr) |
		|        | text       | ref_text | RefText  |               | Oui                |
		|        | integer    | ref_int  | RefInt   |               |                    |
		`;
		const mdRows = casesEnum
			.map(
				([qNum, c]) =>
					`|        | ${c.qType} | q${qNum} | Q${qNum} | ${c.qDefault} | ${c.qLabelFr ?? ""} |`,
			)
			.join("\n");
		const md = `${mdHead}\n${mdRows}`;

		// Build xpath_match: exclude if single quote in qValue.
		const xpathMatch: string[] = [];
		for (const [qNum, c] of casesEnum) {
			if (!coalesce(c.qValue, "")?.includes("'")) {
				xpathMatch.push(xp.model(qNum, c));
				xpathMatch.push(xp.body_input(qNum, c));
			}
		}

		// Build xpath_exact: for values with single quote.
		const xpathExact: [string, Set<string>][] = [];
		for (const [qNum, c] of casesEnum) {
			if (coalesce(c.qValue, "")?.includes("'")) {
				xpathExact.push([xp.model_setvalue(qNum), new Set([c.qValue!])]);
			}
		}

		assertPyxformXform({
			md,
			xml__xpath_match: xpathMatch,
			xml__xpath_exact: xpathExact,
		});
	});

	// Skipped: performance test (time) -- Python-specific, uses psutil/Process
	it.skip("should find dynamic default check costs little extra relative time for large forms", () => {
		// Ported from test_dynamic_default_performance__time.
		// This test is Python-specific and uses psutil.Process for memory/time measurement.
	});

	it("should find dynamic default check costs little extra RAM for large forms", () => {
		const surveyHeader = `
			| survey |            |          |          |               |
			|        | type       | name     | label    | default       |
		`;
		const questions = Array.from(
			{ length: 2000 },
			(_, i) =>
				`|        | text       | q${i}     | Q${i}     | if(../t2 = 'test', 1, 2) + 15 - int(1.2) |`,
		).join("\n");
		const md = `${surveyHeader}\n${questions}`;
		if (typeof globalThis.gc === "function") globalThis.gc();
		const preMem = process.memoryUsage().rss;
		assertPyxformXform({ md });
		if (typeof globalThis.gc === "function") globalThis.gc();
		const postMem = process.memoryUsage().rss;
		expect(postMem).toBeLessThan(preMem * 2);
	});
});
