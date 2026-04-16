import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("GeoParameterTest", () => {
	it("test_geopoint_allow_mock_accuracy", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |           |             |          |                          |
			|        | type      | name        | label    | parameters               |
			|        | geopoint  | geopoint    | Geopoint | allow-mock-accuracy=true |
			`,
			xml__contains: [
				'xmlns:odk="http://www.opendatakit.org/xforms"',
				'<bind nodeset="/data/geopoint" type="geopoint" odk:allow-mock-accuracy="true"/>',
			],
		});

		assertPyxformXform({
			name: "data",
			md: `
			| survey |           |             |          |                          |
			|        | type      | name        | label    | parameters               |
			|        | geopoint  | geopoint    | Geopoint | allow-mock-accuracy=false |
			`,
			xml__contains: [
				'xmlns:odk="http://www.opendatakit.org/xforms"',
				'<bind nodeset="/data/geopoint" type="geopoint" odk:allow-mock-accuracy="false"/>',
			],
		});
	});

	it("test_geoshape_allow_mock_accuracy", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |           |             |          |                          |
			|        | type      | name        | label    | parameters               |
			|        | geoshape  | geoshape    | Geoshape | allow-mock-accuracy=true |
			`,
			xml__contains: [
				'xmlns:odk="http://www.opendatakit.org/xforms"',
				'<bind nodeset="/data/geoshape" type="geoshape" odk:allow-mock-accuracy="true"/>',
			],
		});

		assertPyxformXform({
			name: "data",
			md: `
			| survey |           |             |          |                          |
			|        | type      | name        | label    | parameters               |
			|        | geoshape  | geoshape    | Geoshape | allow-mock-accuracy=false |
			`,
			xml__contains: [
				'xmlns:odk="http://www.opendatakit.org/xforms"',
				'<bind nodeset="/data/geoshape" type="geoshape" odk:allow-mock-accuracy="false"/>',
			],
		});
	});

	it("test_geotrace_allow_mock_accuracy", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |           |             |          |                          |
			|        | type      | name        | label    | parameters               |
			|        | geotrace  | geotrace    | Geotrace | allow-mock-accuracy=true |
			`,
			xml__contains: [
				'xmlns:odk="http://www.opendatakit.org/xforms"',
				'<bind nodeset="/data/geotrace" type="geotrace" odk:allow-mock-accuracy="true"/>',
			],
		});

		assertPyxformXform({
			name: "data",
			md: `
			| survey |           |             |          |                          |
			|        | type      | name        | label    | parameters               |
			|        | geotrace  | geotrace    | Geotrace | allow-mock-accuracy=false |
			`,
			xml__contains: [
				'xmlns:odk="http://www.opendatakit.org/xforms"',
				'<bind nodeset="/data/geotrace" type="geotrace" odk:allow-mock-accuracy="false"/>',
			],
		});
	});

	it("test_foo_allow_mock_accuracy_value_fails", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |           |             |          |                          |
			|        | type      | name        | label    | parameters               |
			|        | geopoint  | geopoint    | Geopoint | allow-mock-accuracy=foo |
			`,
			errored: true,
			error__contains: ["Invalid value for allow-mock-accuracy."],
		});

		assertPyxformXform({
			name: "data",
			md: `
			| survey |           |             |          |                          |
			|        | type      | name        | label    | parameters               |
			|        | geoshape  | geoshape    | Geoshape | allow-mock-accuracy=foo |
			`,
			errored: true,
			error__contains: ["Invalid value for allow-mock-accuracy."],
		});

		assertPyxformXform({
			name: "data",
			md: `
			| survey |           |             |          |                          |
			|        | type      | name        | label    | parameters               |
			|        | geotrace  | geotrace    | Geotrace | allow-mock-accuracy=foo |
			`,
			errored: true,
			error__contains: ["Invalid value for allow-mock-accuracy."],
		});
	});

	it("test_numeric_geopoint_capture_accuracy_is_passed_through", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |           |             |          |                          |
			|        | type      | name        | label    | parameters               |
			|        | geopoint  | geopoint    | Geopoint | capture-accuracy=2.5     |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@accuracyThreshold='2.5' and @ref='/data/geopoint']",
			],
		});
	});

	it("test_string_geopoint_capture_accuracy_errors", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |           |             |          |                          |
			|        | type      | name        | label    | parameters               |
			|        | geopoint  | geopoint    | Geopoint | capture-accuracy=foo     |
			`,
			errored: true,
			error__contains: ["Parameter capture-accuracy must have a numeric value"],
		});
	});

	it("test_geopoint_warning_accuracy_is_passed_through", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |           |             |          |                          |
			|        | type      | name        | label    | parameters               |
			|        | geopoint  | geopoint    | Geopoint | warning-accuracy=5       |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@unacceptableAccuracyThreshold='5' and @ref='/data/geopoint']",
			],
		});
	});

	it("test_string_geopoint_warning_accuracy_errors", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |           |             |          |                          |
			|        | type      | name        | label    | parameters               |
			|        | geopoint  | geopoint    | Geopoint | warning-accuracy=foo     |
			`,
			errored: true,
			error__contains: ["Parameter warning-accuracy must have a numeric value"],
		});
	});

	it("test_geopoint_parameters_combine", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |           |             |          |                                                             |
			|        | type      | name        | label    | parameters                                                  |
			|        | geopoint  | geopoint    | Geopoint | warning-accuracy=5.5 capture-accuracy=2 allow-mock-accuracy=true |
			`,
			xml__xpath_match: [
				"/h:html/h:body/x:input[@unacceptableAccuracyThreshold='5.5' and @accuracyThreshold='2' and @ref='/data/geopoint']",
				"/h:html/h:head/x:model/x:bind[@nodeset='/data/geopoint' and @odk:allow-mock-accuracy='true']",
			],
		});
	});

	it("test_geoshape_with_accuracy_parameters_errors", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |           |             |          |                          |
			|        | type      | name        | label    | parameters               |
			|        | geoshape  | geoshape    | Geoshape | warning-accuracy=5       |
			`,
			errored: true,
			error__contains: ["invalid parameter(s): 'warning-accuracy'"],
		});
	});

	it("test_geotrace_with_accuracy_parameters_errors", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |           |             |          |                          |
			|        | type      | name        | label    | parameters               |
			|        | geotrace  | geotrace    | Geotrace | warning-accuracy=5       |
			`,
			errored: true,
			error__contains: ["invalid parameter(s): 'warning-accuracy'"],
		});
	});
});
