/**
 * Port of test_range.py - Range control tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

// --- XPath helpers matching pyxform's xpq helpers ---

const RANGE_DEFAULTS: Record<string, string> = {
	start: "1",
	end: "10",
	step: "1",
};

function bodyRange(qname: string, attrs?: Record<string, string>): string {
	const parameters = { ...RANGE_DEFAULTS, ...attrs };
	const attrStr = Object.entries(parameters)
		.map(([k, v]) => `@${k}='${v}'`)
		.join(" and ");
	return `/h:html/h:body/x:range[@ref='/test_name/${qname}' and ${attrStr}]`;
}

function rangeItemset(qname: string, labelset: string): string {
	return `/h:html/h:body/x:range[@ref='/test_name/${qname}']/x:itemset[@nodeset="instance('${labelset}')/root/item"]`;
}

function modelInstanceItem(qname: string): string {
	return `/h:html/h:head/x:model/x:instance/x:test_name/x:${qname}`;
}

function modelInstanceBind(qname: string, type: string): string {
	return `/h:html/h:head/x:model/x:bind[@nodeset='/test_name/${qname}' and @type='${type}']`;
}

// --- Error message templates matching pyxform ErrorCode values ---

function RANGE_001(row: number, name: string): string {
	return `[row : ${row}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter '${name}' must be a number.`;
}
function RANGE_002(row: number, name: string): string {
	return `[row : ${row}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter '${name}' must not be '0' (zero).`;
}
function RANGE_003(row: number, name: string): string {
	return `[row : ${row}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter '${name}' must not be larger than the range (the difference between 'start' and 'end').`;
}
function RANGE_004(row: number, name: string): string {
	return `[row : ${row}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter '${name}' must be a multiple of 'step'.`;
}
function RANGE_005(row: number, name: string): string {
	return `[row : ${row}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter '${name}' must be between the 'start' and 'end' values, inclusive).`;
}
function RANGE_006(row: number): string {
	return `[row : ${row}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter 'tick_labelset' must be a choice list name from the 'list_name' column on the choices sheet.`;
}
function RANGE_007(row: number): string {
	return `[row : ${row}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter 'tick_labelset' choice list must have only 2 items when the 'appearance' is 'no-ticks'.`;
}
function RANGE_008(row: number): string {
	return `[row : ${row}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameters 'tick_interval', 'placeholder', and 'tick_labelset' are only supported for the appearances 'vertical', 'no-ticks' and the default (empty) horizontal.`;
}
function RANGE_009(row: number): string {
	return `[row : ${row}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter`;
}
function RANGE_010(row: number): string {
	return `[row : ${row}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter 'tick_labelset' choices must be between the 'start' and 'end' values, inclusive.`;
}
function RANGE_011(row: number, name: string): string {
	return `[row : ${row}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter 'tick_labelset' choices' values must be equal to the start of the range plus a multiple of '${name}'.`;
}
function RANGE_012(row: number): string {
	return `[row : ${row}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter 'tick_labelset' choice list values may only`;
}
function NAMES_006(row: number): string {
	return `[row : ${row}] On the 'choices' sheet, the 'name' value is invalid. Choices must have a name.`;
}
function NAMES_007(row: number): string {
	return `[row : ${row}] On the 'choices' sheet, the 'name' value is invalid. Choice names must be unique for each choice list.`;
}

describe("TestRangeParsing", () => {
	it("should accept delimiters: space, comma, semicolon", () => {
		// RC001
		const md = `
			| survey |
			| | type  | name | label | parameters        |
			| | range | q1   | Q1    | start=2{sep}end=9 |
		`;
		const cases = [" ", "  ", ",", ";", ", ", ", ", " , ", "; ", " ;", " ; "];
		for (const sep of cases) {
			assertPyxformXform({
				md: md.replace("{sep}", sep),
				xml__xpath_match: [bodyRange("q1", { start: "2", end: "9" })],
			});
		}
	});

	it("should raise an error for unknown parameters", () => {
		// RC002
		assertPyxformXform({
			md: `
				| survey |
				| | type  | name | label | parameters     |
				| | range | q1   | Q1    | start=2 stop=9 |
			`,
			errored: true,
			error__contains: [
				"Accepted parameters are 'end, placeholder, start, step, tick_interval, tick_labelset'. The following are invalid parameter(s): 'stop'.",
			],
		});
	});

	it("should not raise an error for known parameters", () => {
		// RC002
		assertPyxformXform({
			md: `
				| survey |
				| | type  | name | label | parameters                                                          |
				| | range | q1   | Q1    | start=2 end=9 step=1 tick_interval=2 placeholder=6 tick_labelset=c1 |

				| choices |
				| | list_name | name | label |
				| | c1        | 2    | N1    |
				| | c1        | 4    | N2    |
			`,
			xml__xpath_match: [
				bodyRange("q1", {
					start: "2",
					end: "9",
					step: "1",
					"odk:tick-interval": "2",
					"odk:placeholder": "6",
				}),
				rangeItemset("q1", "c1"),
			],
		});
	});

	it("should not raise an error for known parameters in mixed case", () => {
		// RC003
		assertPyxformXform({
			md: `
				| survey |
				| | type  | name | label | parameters                                                          |
				| | range | q1   | Q1    | Start=2 eNd=9 SteP=1 TICK_interval=2 placeHOLDER=6 tick_LABELset=c1 |

				| choices |
				| | list_name | name | label |
				| | c1        | 2    | N1    |
				| | c1        | 4    | N2    |
			`,
			xml__xpath_match: [
				bodyRange("q1", {
					start: "2",
					end: "9",
					step: "1",
					"odk:tick-interval": "2",
					"odk:placeholder": "6",
				}),
				rangeItemset("q1", "c1"),
			],
		});
	});

	it("should raise an error for invalid delimiters", () => {
		// RC004
		const md = `
			| survey |
			| | type  | name | label | parameters        |
			| | range | q1   | Q1    | start=2{sep}end=9 |
		`;
		const cases = [" . ", " & ", "-"];
		for (const sep of cases) {
			assertPyxformXform({
				md: md.replace("{sep}", sep),
				errored: true,
				error__contains: [
					"Expecting parameters to be in the form of 'parameter1=value parameter2=value'.",
				],
			});
		}
	});

	it("should raise an error if a parameter is malformed", () => {
		// RC004
		const md = `
			| survey |
			| | type  | name | label | parameters    |
			| | range | q1   | Q1    | {name}{value} |
		`;
		const params = ["start", "end", "step", "tick_interval", "placeholder"];
		const cases = ["==1", "1", "==1"];
		for (const name of params) {
			for (const value of cases) {
				assertPyxformXform({
					md: md.replace("{name}", name).replace("{value}", value),
					errored: true,
					error__contains: [
						"Expecting parameters to be in the form of 'parameter1=value parameter2=value'.",
					],
				});
			}
		}
	});

	it("should raise an error if a numeric parameter has a non-numeric value", () => {
		// RC005
		const md = `
			| survey |
			| | type  | name | label | parameters     |
			| | range | q1   | Q1    | {name}={value} |
		`;
		const params = ["start", "end", "step", "tick_interval", "placeholder"];
		const cases = ["", "one"];
		for (const name of params) {
			for (const value of cases) {
				assertPyxformXform({
					md: md.replace("{name}", name).replace("{value}", value),
					errored: true,
					error__contains: [RANGE_001(2, name)],
				});
			}
		}
	});

	it("should not raise an error if a numeric parameter has a numeric value", () => {
		// RC005
		const md = `
			| survey |
			| | type  | name | label | parameters |
			| | range | q1   | Q1    | {name}=1   |
		`;
		const params: [string, Record<string, string>][] = [
			["start", { start: "1" }],
			["end=2 step", { end: "2", step: "1" }],
			["step", { step: "1" }],
			["tick_interval", { "odk:tick-interval": "1" }],
			["placeholder", { "odk:placeholder": "1" }],
		];
		for (const [name, attrs] of params) {
			assertPyxformXform({
				md: md.replace("{name}", name),
				xml__xpath_match: [bodyRange("q1", attrs)],
			});
		}
	});

	it("should raise an error if the relevant ticks parameter is zero", () => {
		// RS001 RI001
		const md = `
			| survey |
			| | type  | name | label | parameters |
			| | range | q1   | Q1    | {name}=0   |
		`;
		const params = ["step", "tick_interval"];
		for (const name of params) {
			assertPyxformXform({
				md: md.replace("{name}", name),
				errored: true,
				error__contains: [RANGE_002(2, name)],
			});
		}
	});

	it("should not raise an error if the relevant ticks parameter is not zero", () => {
		// RS001 RI001
		const md = `
			| survey |
			| | type  | name | label | parameters |
			| | range | q1   | Q1    | {name}=1   |
		`;
		const params: [string, string][] = [
			["step", "step"],
			["tick_interval", "odk:tick-interval"],
		];
		for (const [name, attr] of params) {
			assertPyxformXform({
				md: md.replace("{name}", name),
				xml__xpath_match: [bodyRange("q1", { [attr]: "1" })],
			});
		}
	});

	it("should raise an error if the relevant ticks parameter is larger than the range", () => {
		// RS002 RI002
		const md = `
			| survey |
			| | type  | name | label | parameters               |
			| | range | q1   | Q1    | start=0 end=10 {name}=11 |
		`;
		const params = ["step", "tick_interval"];
		for (const name of params) {
			assertPyxformXform({
				md: md.replace("{name}", name),
				errored: true,
				error__contains: [RANGE_003(2, name)],
			});
		}
	});

	it("should not raise an error if the relevant ticks parameter is not larger than the range", () => {
		// RS002 RI002
		const md = `
			| survey |
			| | type  | name | label | parameters                    |
			| | range | q1   | Q1    | start=1 end=10 {name}={value} |
		`;
		const params: [string, string][] = [
			["step", "step"],
			["tick_interval", "odk:tick-interval"],
		];
		const cases = ["1", "2"];
		for (const [name, attr] of params) {
			for (const value of cases) {
				assertPyxformXform({
					md: md.replace("{name}", name).replace("{value}", value),
					xml__xpath_match: [bodyRange("q1", { [attr]: value })],
				});
			}
		}
	});

	it("should raise an error if tick interval is not a multiple of step", () => {
		// RI003 RP001
		const md = `
			| survey |
			| | type  | name | label | parameters                                  |
			| | range | q1   | Q1    | start=-3 end=3 step=2 tick_interval={value} |
		`;
		const cases = ["-3", "3", "-1", "1"];
		for (const value of cases) {
			assertPyxformXform({
				md: md.replace("{value}", value),
				errored: true,
				error__contains: [RANGE_004(2, "tick_interval")],
			});
		}
	});

	it("should raise an error if the placeholder is not a multiple of step starting at start", () => {
		// RI003 RP001
		const md = `
			| survey |
			| | type  | name | label | parameters                                |
			| | range | q1   | Q1    | start=-3 end=3 step=2 placeholder={value} |
		`;
		const cases = ["-2", "2", "0"];
		for (const value of cases) {
			assertPyxformXform({
				md: md.replace("{value}", value),
				errored: true,
				error__contains: [RANGE_004(2, "placeholder")],
			});
		}
	});

	it("should not raise an error if the relevant ticks parameter is a multiple of step", () => {
		// RI003 RP001
		const md = `
			| survey |
			| | type  | name | label | parameters                           |
			| | range | q1   | Q1    | start=-1 end=1 step=1 {name}={value} |
		`;
		const params: [string, string][] = [
			["tick_interval", "odk:tick-interval"],
			["placeholder", "odk:placeholder"],
		];
		const cases = ["1", "-1"];
		for (const [name, attr] of params) {
			for (const value of cases) {
				assertPyxformXform({
					md: md.replace("{name}", name).replace("{value}", value),
					xml__xpath_match: [
						bodyRange("q1", {
							start: "-1",
							end: "1",
							step: "1",
							[attr]: value,
						}),
					],
				});
			}
		}
	});

	it("should not raise an error if the relevant ticks parameter is a multiple of step (decimal)", () => {
		// RI003 RP001
		const md = `
			| survey |
			| | type  | name | label | parameters                             |
			| | range | q1   | Q1    | start=-1 end=1 step=0.1 {name}={value} |
		`;
		const params: [string, string][] = [
			["tick_interval", "odk:tick-interval"],
			["placeholder", "odk:placeholder"],
		];
		const cases = ["0.6", "-0.6"];
		for (const [name, attr] of params) {
			for (const value of cases) {
				assertPyxformXform({
					md: md.replace("{name}", name).replace("{value}", value),
					xml__xpath_match: [
						bodyRange("q1", {
							start: "-1",
							end: "1",
							step: "0.1",
							[attr]: value,
						}),
					],
				});
			}
		}
	});

	it("should raise an error if the placeholder is outside the range", () => {
		// RP002
		const md = `
			| survey |
			| | type  | name | label | parameters                               |
			| | range | q1   | Q1    | start=3 end=7 step=2 placeholder={value} |
		`;
		const cases = ["1", "9"];
		for (const value of cases) {
			assertPyxformXform({
				md: md.replace("{value}", value),
				errored: true,
				error__contains: [RANGE_005(2, "placeholder")],
			});
		}
	});

	it("should raise an error if the placeholder is outside an inverted range", () => {
		// RP002
		const md = `
			| survey |
			| | type  | name | label | parameters                               |
			| | range | q1   | Q1    | start=7 end=3 step=2 placeholder={value} |
		`;
		const cases = ["9", "1"];
		for (const value of cases) {
			assertPyxformXform({
				md: md.replace("{value}", value),
				errored: true,
				error__contains: [RANGE_005(2, "placeholder")],
			});
		}
	});

	it("should not raise an error if the placeholder is inside an inverted range", () => {
		// RP002
		const md = `
			| survey |
			| | type  | name | label | parameters                               |
			| | range | q1   | Q1    | start=7 end=3 step=2 placeholder={value} |
		`;
		const cases = ["7", "5", "3"];
		for (const value of cases) {
			assertPyxformXform({
				md: md.replace("{value}", value),
				xml__xpath_match: [
					bodyRange("q1", {
						start: "7",
						end: "3",
						step: "2",
						"odk:placeholder": value,
					}),
				],
			});
		}
	});

	it("should not raise an error if the placeholder is inside the range", () => {
		// RP002
		const md = `
			| survey |
			| | type  | name | label | parameters                               |
			| | range | q1   | Q1    | start=1 end=7 step=2 placeholder={value} |
		`;
		const cases = ["1", "3", "5", "7"];
		for (const value of cases) {
			assertPyxformXform({
				md: md.replace("{value}", value),
				xml__xpath_match: [
					bodyRange("q1", {
						start: "1",
						end: "7",
						step: "2",
						"odk:placeholder": value,
					}),
				],
			});
		}
	});

	it("should raise an error if the tick_labelset choice list does not exist", () => {
		// RL001
		assertPyxformXform({
			md: `
				| survey |
				| | type  | name | label | parameters       |
				| | range | q1   | Q1    | tick_labelset=c1 |
			`,
			errored: true,
			error__contains: [RANGE_006(2)],
		});
	});

	it("should not raise an error if the tick_labelset choice list exists", () => {
		// RL001
		assertPyxformXform({
			md: `
				| survey |
				| | type  | name | label | parameters       |
				| | range | q1   | Q1    | tick_labelset=c1 |

				| choices |
				| | list_name | name | label |
				| | c1        | 1    | N1    |
			`,
			xml__xpath_match: [bodyRange("q1"), rangeItemset("q1", "c1")],
		});
	});

	it("should raise an error if the tick_labelset choice list is empty", () => {
		// RL002
		assertPyxformXform({
			md: `
				| survey |
				| | type  | name | label | parameters       |
				| | range | q1   | Q1    | tick_labelset=c1 |

				| choices |
				| | list_name | name | label |
				| | c1        |      | N1    |
			`,
			errored: true,
			error__contains: [NAMES_006(2)],
		});
	});

	it("should raise an error if the tick_labelset choices has >2 items with no-ticks", () => {
		// RL005
		assertPyxformXform({
			md: `
				| survey |
				| | type  | name | label | parameters              | appearance |
				| | range | q1   | Q1    | step=1 tick_labelset=c1 | no-ticks   |

				| choices |
				| | list_name | name | label |
				| | c1        | 1    | N1    |
				| | c1        | 2    | N2    |
				| | c1        | 3    | N3    |
			`,
			errored: true,
			error__contains: [RANGE_007(2)],
		});
	});

	it("should not raise an error if 2 choices with no-ticks are start/end", () => {
		// RL005
		assertPyxformXform({
			md: `
				| survey |
				| | type  | name | label | parameters       | appearance |
				| | range | q1   | Q1    | tick_labelset=c1 | no-ticks   |

				| choices |
				| | list_name | name | label |
				| | c1        | 1    | N1    |
				| | c1        | 10   | N2    |
			`,
			xml__xpath_match: [
				bodyRange("q1", { appearance: "no-ticks" }),
				rangeItemset("q1", "c1"),
			],
		});
	});

	it("should raise an error for >2 choices with no-ticks when duplicates are not allowed", () => {
		// RL005
		assertPyxformXform({
			md: `
				| survey |
				| | type  | name | label | parameters              | appearance |
				| | range | q1   | Q1    | step=1 tick_labelset=c1 | no-ticks   |

				| choices |
				| | list_name | name | label |
				| | c1        | 1    | N1    |
				| | c1        | 1    | N2    |
				| | c1        | 10   | N3    |
			`,
			errored: true,
			error__contains: [NAMES_007(3)],
		});
	});

	it("should not raise an error for >2 choices with no-ticks when duplicates are allowed", () => {
		// RL005
		assertPyxformXform({
			md: `
				| settings |
				| | allow_choice_duplicates |
				| | yes                     |

				| survey |
				| | type  | name | label | parameters              | appearance |
				| | range | q1   | Q1    | step=1 tick_labelset=c1 | no-ticks   |

				| choices |
				| | list_name | name | label |
				| | c1        | 1    | N1    |
				| | c1        | 1    | N2    |
				| | c1        | 10   | N3    |
			`,
			xml__xpath_match: [
				bodyRange("q1", { appearance: "no-ticks" }),
				rangeItemset("q1", "c1"),
			],
		});
	});

	it("should raise an error if the tick_labelset choices with no-ticks are not start/end", () => {
		// RL005
		assertPyxformXform({
			md: `
				| survey |
				| | type  | name | label | parameters       | appearance |
				| | range | q1   | Q1    | tick_labelset=c1 | no-ticks   |

				| choices |
				| | list_name | name | label |
				| | c1        | 1    | N1    |
				| | c1        | 9    | N2    |
			`,
			errored: true,
			error__contains: [RANGE_012(2)],
		});
	});

	it("should raise an error if the appearance parameters are not supported", () => {
		// RC006
		const md = `
			| survey |
			| | type  | name | label | parameters     | appearance |
			| | range | q1   | Q1    | step=6 {param} | {value}    |

			| choices |
			| | list_name | name | label |
			| | c1        | 1    | N1    |
		`;
		const params = ["tick_interval=1", "placeholder=1", "tick_labelset=c1"];
		const cases = ["picker", "rating", "someting-new"];
		for (const param of params) {
			for (const value of cases) {
				assertPyxformXform({
					md: md.replace("{param}", param).replace("{value}", value),
					errored: true,
					error__contains: [RANGE_008(2)],
				});
			}
		}
	});

	it("should not raise an error if the appearance parameters are supported", () => {
		// RC006
		const md = `
			| survey |
			| | type  | name | label | parameters     | appearance |
			| | range | q1   | Q1    | step=1 {param} | {value}    |

			| choices |
			| | list_name | name | label |
			| | c1        | 1    | N1    |
			| | c1        | 10   | N2    |
		`;
		const params: [string, Record<string, string>][] = [
			["tick_interval=2", { "odk:tick-interval": "2" }],
			["placeholder=3", { "odk:placeholder": "3" }],
			["tick_labelset=c1", {}],
		];
		const cases = ["", "vertical", "no-ticks"];
		for (const [param, attr] of params) {
			for (const appearance of cases) {
				assertPyxformXform({
					md: md.replace("{param}", param).replace("{value}", appearance),
					xml__xpath_match: [bodyRange("q1", attr)],
				});
			}
		}
	});

	it("should raise an error if any tick_labelset choices are not numeric", () => {
		// RC005
		const md = `
			| survey |
			| | type  | name | label | parameters       |
			| | range | q1   | Q1    | tick_labelset=c1 |

			| choices |
			| | list_name | name    | label |
			| | c1        | {value} | N1    |
		`;
		const cases = ["n1", "one", "1n", "infinity"];
		for (const value of cases) {
			assertPyxformXform({
				md: md.replace("{value}", value),
				errored: true,
				error__contains: [RANGE_009(2)],
			});
		}
	});

	it("should not raise an error if the tick_labelset choices are numeric", () => {
		// RC005
		const md = `
			| survey |
			| | type  | name | label | parameters       |
			| | range | q1   | Q1    | tick_labelset=c1 |

			| choices |
			| | list_name | name    | label |
			| | c1        | {value} | N1    |
		`;
		const cases = ["1", "1.0"];
		for (const value of cases) {
			assertPyxformXform({
				md: md.replace("{value}", value),
				xml__xpath_match: [
					modelInstanceBind("q1", "int"),
					rangeItemset("q1", "c1"),
				],
			});
		}
	});

	it("should raise an error if any tick_labelset choices are outside the range", () => {
		// RL004
		const md = `
			| survey |
			| | type  | name | label | parameters                            |
			| | range | q1   | Q1    | start=3 end=7 step=2 tick_labelset=c1 |

			| choices |
			| | list_name | name    | label |
			| | c1        | {value} | N1    |
		`;
		const cases = ["1", "2"];
		for (const value of cases) {
			assertPyxformXform({
				md: md.replace("{value}", value),
				errored: true,
				error__contains: [RANGE_010(2)],
			});
		}
	});

	it("should raise an error if any tick_labelset choices are outside the inverted range", () => {
		// RL004
		const md = `
			| survey |
			| | type  | name | label | parameters                            |
			| | range | q1   | Q1    | start=7 end=3 step=2 tick_labelset=c1 |

			| choices |
			| | list_name | name    | label |
			| | c1        | {value} | N1    |
		`;
		const cases = ["9", "1"];
		for (const value of cases) {
			assertPyxformXform({
				md: md.replace("{value}", value),
				errored: true,
				error__contains: [RANGE_010(2)],
			});
		}
	});

	it("should not raise an error if any tick_labelset choices are inside the range", () => {
		// RL004
		const md = `
			| survey |
			| | type  | name | label | parameters                            |
			| | range | q1   | Q1    | start=0 end=7 step=1 tick_labelset=c1 |

			| choices |
			| | list_name | name    | label |
			| | c1        | {value} | N1    |
		`;
		const cases = ["1", "2"];
		for (const value of cases) {
			assertPyxformXform({
				md: md.replace("{value}", value),
				xml__xpath_match: [
					bodyRange("q1", {
						start: "0",
						end: "7",
						step: "1",
					}),
					rangeItemset("q1", "c1"),
				],
			});
		}
	});

	it("should not raise an error if any tick_labelset choices are inside the inverted range", () => {
		// RL004
		const md = `
			| survey |
			| | type  | name | label | parameters                            |
			| | range | q1   | Q1    | start=7 end=3 step=2 tick_labelset=c1 |

			| choices |
			| | list_name | name    | label |
			| | c1        | {value} | N1    |
		`;
		const cases = ["7", "5", "3"];
		for (const value of cases) {
			assertPyxformXform({
				md: md.replace("{value}", value),
				xml__xpath_match: [
					bodyRange("q1", {
						start: "7",
						end: "3",
						step: "2",
					}),
					rangeItemset("q1", "c1"),
				],
			});
		}
	});

	it("should raise an error if the relevant ticks parameter is not a multiple of step (tick_labelset)", () => {
		// RL003
		const md = `
			| survey |
			| | type  | name | label | parameters                              |
			| | range | q1   | Q1    | start=0 end=7 {name}=3 tick_labelset=c1 |

			| choices |
			| | list_name | name    | label |
			| | c1        | {value} | N1    |
		`;
		const params = ["step", "tick_interval"];
		const cases = ["2", "4"];
		for (const name of params) {
			for (const value of cases) {
				assertPyxformXform({
					md: md.replace("{name}", name).replace("{value}", value),
					errored: true,
					error__contains: [RANGE_011(2, name)],
				});
			}
		}
	});

	it("should not raise an error if the relevant ticks parameter is a multiple of step (tick_labelset)", () => {
		// RL003
		const md = `
			| survey |
			| | type  | name | label | parameters                              |
			| | range | q1   | Q1    | start=0 end=7 {name}=1 tick_labelset=c1 |

			| choices |
			| | list_name | name | label |
			| | c1        | 1    | N1    |
		`;
		const params = ["step", "tick_interval"];
		for (const name of params) {
			assertPyxformXform({
				md: md.replace("{name}", name),
				xml__xpath_match: [
					bodyRange("q1", {
						start: "0",
						end: "7",
						step: "1",
					}),
					rangeItemset("q1", "c1"),
				],
			});
		}
	});

	it("should not raise an error if the choice is aligned with ticks (both step and tick_interval)", () => {
		// RL003
		assertPyxformXform({
			md: `
				| survey |
				| | type  | name | label | parameters                                             |
				| | range | q1   | Q1    | start=1 end=12 step=2 tick_interval=4 tick_labelset=c1 |

				| choices |
				| | list_name | name | label |
				| | c1        | 1    | N1    |
				| | c1        | 5    | N2    |
				| | c1        | 9    | N3    |
			`,
			xml__xpath_match: [
				bodyRange("q1", {
					start: "1",
					end: "12",
					step: "2",
					"odk:tick-interval": "4",
				}),
				rangeItemset("q1", "c1"),
			],
		});
	});

	it("should not raise an error for valid positive/negative and/or asc/desc ranges", () => {
		// RC007
		const md = `
			| survey |
			| | type  | name | label | parameters |
			| | range | q1   | Q1    | {params}   |
		`;
		const cases: Record<string, string>[] = [
			{ start: "-10", end: "-1", step: "1" }, // neg/asc
			{ start: "-10", end: "-1", step: "-1" }, // neg/empty
			{ start: "-1", end: "-10", step: "1" }, // neg/empty
			{ start: "-1", end: "-10", step: "-1" }, // neg/desc
			{ start: "1", end: "10", step: "1" }, // pos/asc
			{ start: "1", end: "10", step: "-1" }, // pos/empty
			{ start: "10", end: "1", step: "1" }, // pos/empty
			{ start: "10", end: "1", step: "-1" }, // pos/desc
		];
		for (const params of cases) {
			const paramStr = Object.entries(params)
				.map(([k, v]) => `${k}=${v}`)
				.join(" ");
			assertPyxformXform({
				md: md.replace("{params}", paramStr),
				xml__xpath_match: [bodyRange("q1", params)],
			});
		}
	});
});

describe("TestRangeOutput", () => {
	it("should find that default values are output as attributes of the range control", () => {
		// RB001 RB003
		assertPyxformXform({
			md: `
				| survey |
				| | type  | name | label | parameters |
				| | range | q1   | Q1    |            |
			`,
			xml__xpath_match: [
				modelInstanceItem("q1"),
				modelInstanceBind("q1", "int"),
				bodyRange("q1"),
			],
		});
	});

	it("should find that user values are output as attributes of the range control (int)", () => {
		// RB001 RB002 RB003
		assertPyxformXform({
			md: `
				| survey |
				| | type  | name | label | parameters                                                               |
				| | range | q1   | Q1    | start=3 end=13 step=2 tick_interval=2 placeholder=7 tick_labelset=c1 |

				| choices |
				| | list_name | name | label |
				| | c1        | 5    | N1    |
				| | c1        | 11   | N2    |
			`,
			xml__xpath_match: [
				modelInstanceItem("q1"),
				modelInstanceBind("q1", "int"),
				bodyRange("q1", {
					start: "3",
					end: "13",
					step: "2",
					"odk:tick-interval": "2",
					"odk:placeholder": "7",
				}),
				rangeItemset("q1", "c1"),
			],
		});
	});

	it("should find that user values are output as attributes of the range control (decimal)", () => {
		// RB001 RB002 RB004
		assertPyxformXform({
			md: `
				| survey |
				| | type  | name | label | parameters                                                                          |
				| | range | q1   | Q1    | start=0.5 end=5.0 step=0.5 tick_interval=1.5 placeholder=2.5 tick_labelset=c1 |

				| choices |
				| | list_name | name | label |
				| | c1        | 2.0  | N1    |
				| | c1        | 3.5  | N2    |
			`,
			xml__xpath_match: [
				modelInstanceItem("q1"),
				modelInstanceBind("q1", "decimal"),
				bodyRange("q1", {
					start: "0.5",
					end: "5.0",
					step: "0.5",
					"odk:tick-interval": "1.5",
					"odk:placeholder": "2.5",
				}),
				rangeItemset("q1", "c1"),
			],
		});
	});
});
