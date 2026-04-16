/**
 * Port of test_geo.py - Geo widget tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("GeoWidgetsTest", () => {
	it("should handle gps type", () => {
		assertPyxformXform({
			name: "geo",
			md: `
				| survey |      |          |       |
				|        | type |   name   | label |
				|        | gps  | location | GPS   |
			`,
			xml__contains: ["geopoint"],
		});
	});

	it("should handle gps alias", () => {
		assertPyxformXform({
			name: "geo_alias",
			md: `
				| survey |          |          |       |
				|        | type     | name     | label |
				|        | geopoint | location | GPS   |
			`,
			xml__contains: ["geopoint"],
		});
	});

	it("should handle geo widgets types", () => {
		assertPyxformXform({
			name: "geos",
			md: `
				| survey |              |            |                   |
				|        | type         | name       | label             |
				|        | begin_repeat | repeat     |                   |
				|        | geopoint     | point      | Record Geopoint   |
				|        | note         | point_note | Point \${point}    |
				|        | geotrace     | trace      | Record a Geotrace |
				|        | note         | trace_note | Trace: \${trace}   |
				|        | geoshape     | shape      | Record a Geoshape |
				|        | note         | shape_note | Shape: \${shape}   |
				|        | end_repeat   |            |                   |
			`,
			xml__contains: [
				"<point/>",
				"<point_note/>",
				"<trace/>",
				"<trace_note/>",
				"<shape/>",
				"<shape_note/>",
				'<bind nodeset="/geos/repeat/point" type="geopoint"/>',
				'<bind nodeset="/geos/repeat/point_note" readonly="true()" type="string"/>',
				'<bind nodeset="/geos/repeat/trace" type="geotrace"/>',
				'<bind nodeset="/geos/repeat/trace_note" readonly="true()" type="string"/>',
				'<bind nodeset="/geos/repeat/shape" type="geoshape"/>',
				'<bind nodeset="/geos/repeat/shape_note" readonly="true()" type="string"/>',
			],
		});
	});
});

describe("TestParameterIncremental", () => {
	it("should not be emitted by default", () => {
		const md = `
			| survey |
			| | type   | name | label |
			| | {type} | q1   | Q1    |
		`;
		const types = ["geoshape", "geotrace", "geopoint", "integer", "note"];
		for (const t of types) {
			assertPyxformXform({
				md: md.replace("{type}", t),
				xml__xpath_match: [
					"/h:html/h:body/x:input[@ref='/test_name/q1' and not(@incremental)]",
				],
			});
		}
	});

	it("should emit incremental for geoshape and geotrace when specified", () => {
		const md = `
			| survey |
			| | type   | name | label | parameters       |
			| | {type} | q1   | Q1    | incremental=true |
		`;
		const types = ["geoshape", "geotrace"];
		for (const t of types) {
			assertPyxformXform({
				md: md.replace("{type}", t),
				xml__xpath_match: [
					`/h:html/h:head/x:model/x:bind[@nodeset='/test_name/q1' and @type='${t}']`,
					"/h:html/h:body/x:input[@ref='/test_name/q1' and @incremental='true']",
				],
			});
		}
	});

	it("should emit incremental for geoshape and geotrace with aliases", () => {
		const md = `
			| survey |
			| | type   | name | label | parameters          |
			| | {type} | q1   | Q1    | incremental={value} |
		`;
		const types = ["geoshape", "geotrace"];
		const values = ["yes", "true()"];
		for (const t of types) {
			for (const v of values) {
				assertPyxformXform({
					md: md.replace("{type}", t).replace("{value}", v),
					xml__xpath_match: [
						`/h:html/h:head/x:model/x:bind[@nodeset='/test_name/q1' and @type='${t}']`,
						"/h:html/h:body/x:input[@ref='/test_name/q1' and @incremental='true']",
					],
				});
			}
		}
	});

	it("should error for geoshape and geotrace with wrong incremental value", () => {
		const md = `
			| survey |
			| | type   | name | label | parameters          |
			| | {type} | q1   | Q1    | incremental={value} |
		`;
		const types = ["geoshape", "geotrace"];
		const values = ["", "yeah", "false"];
		for (const t of types) {
			for (const v of values) {
				assertPyxformXform({
					md: md.replace("{type}", t).replace("{value}", v),
					errored: true,
					error__contains: [
						"[row : 2] On the 'survey' sheet, the 'parameters' value is invalid. " +
							"For geoshape and geotrace questions, the 'incremental' parameter may either " +
							"be 'true' or not included.",
					],
				});
			}
		}
	});

	it("should error for wrong type with params when incremental specified", () => {
		const md = `
			| survey |
			| | type   | name | label | parameters       |
			| | {type} | q1   | Q1    | incremental=true |
		`;
		const types = ["geopoint", "audio"];
		for (const t of types) {
			assertPyxformXform({
				md: md.replace("{type}", t),
				errored: true,
				error__contains: [
					"The following are invalid parameter(s): 'incremental'.",
				],
			});
		}
	});

	it("should not error for wrong type without params when incremental specified", () => {
		const md = `
			| survey |
			| | type   | name | label | parameters       |
			| | {type} | q1   | Q1    | incremental=true |
		`;
		const types = ["integer", "note"];
		for (const t of types) {
			assertPyxformXform({
				md: md.replace("{type}", t),
				xml__xpath_match: [
					"/h:html/h:body/x:input[@ref='/test_name/q1' and not(@incremental)]",
				],
			});
		}
	});
});
