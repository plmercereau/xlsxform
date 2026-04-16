/**
 * AuditTest - test audit question type.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("AuditTest", () => {
	it("should audit", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |       |
            |        | type   |   name   | label |
            |        | audit  |   audit  |       |
            `,
			xml__contains: [
				"<meta>",
				"<audit/>",
				"</meta>",
				'<bind nodeset="/meta_audit/meta/audit" type="binary"/>',
			],
		});
	});

	it("should audit random name", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |       |
            |        | type   |   name   | label |
            |        | audit  |   bobby  |       |
            `,
			errored: true,
			error__contains: ["Audits must always be named 'audit.'"],
		});
	});

	it("should audit blank name", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |       |
            |        | type   |   name   | label |
            |        | audit  |          |       |
            `,
			xml__contains: [
				"<meta>",
				"<audit/>",
				"</meta>",
				'<bind nodeset="/meta_audit/meta/audit" type="binary"/>',
			],
		});
	});

	it("should audit blank parameters", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |       |            |
            |        | type   |   name   | label | parameters |
            |        | audit  |          |       |            |
            `,
			xml__contains: [
				"<meta>",
				"<audit/>",
				"</meta>",
				'<bind nodeset="/meta_audit/meta/audit" type="binary"/>',
			],
		});
	});

	it("should audit location required parameters", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |                                             |
            |        | type   |   name   | parameters                                  |
            |        | audit  |   audit  | location-max-age=3, location-min-interval=1 |
            `,
			errored: true,
			error__contains: [
				"'location-priority', 'location-min-interval', and 'location-max-age' are required parameters",
			],
		});
	});

	it("should audit location priority values", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |                                                                    |
            |        | type   |   name   | parameters                                                         |
            |        | audit  |   audit  | location-priority=foo, location-min-interval=1, location-max-age=2 |
            `,
			errored: true,
			error__contains: [
				"location-priority must be set to no-power, low-power, balanced, or high-accuracy",
			],
		});
	});

	it("should audit location max age gt min interval", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |                                                                         |
            |        | type   |   name   | parameters                                                              |
            |        | audit  |   audit  | location-priority=balanced, location-min-interval=2, location-max-age=1 |
            `,
			errored: true,
			error__contains: [
				"location-max-age must be greater than or equal to location-min-interval",
			],
		});
	});

	it("should audit location min interval positive", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |                                                                          |
            |        | type   |   name   | parameters                                                               |
            |        | audit  |   audit  | location-priority=balanced, location-min-interval=-1, location-max-age=1 |
            `,
			errored: true,
			error__contains: [
				"location-min-interval must be greater than or equal to zero",
			],
		});
	});

	it("should audit location", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |                                                                            |
            |        | type   |   name   | parameters                                                                 |
            |        | audit  |   audit  | location-priority=balanced, location-min-interval=60, location-max-age=300 |
            `,
			xml__contains: [
				"<meta>",
				"<audit/>",
				"</meta>",
				'<bind nodeset="/meta_audit/meta/audit" type="binary" odk:location-max-age="300" odk:location-min-interval="60" odk:location-priority="balanced"/>',
			],
		});
	});

	it("should audit track changes true", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |                    |
            |        | type   |   name   | parameters         |
            |        | audit  |   audit  | track-changes=true |
            `,
			xml__contains: [
				"<meta>",
				"<audit/>",
				"</meta>",
				'<bind nodeset="/meta_audit/meta/audit" type="binary" odk:track-changes="true"/>',
			],
		});
	});

	it("should audit track changes false", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |                     |
            |        | type   |   name   | parameters          |
            |        | audit  |   audit  | track-changes=false |
            `,
			xml__contains: [
				"<meta>",
				"<audit/>",
				"</meta>",
				'<bind nodeset="/meta_audit/meta/audit" type="binary" odk:track-changes="false"/>',
			],
		});
	});

	it("should audit track changes foo", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |                   |
            |        | type   |   name   | parameters        |
            |        | audit  |   audit  | track-changes=foo |
            `,
			errored: true,
			error__contains: ["track-changes must be set to true or false"],
		});
	});

	it("should audit identify user foo", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |                   |
            |        | type   |   name   | parameters        |
            |        | audit  |   audit  | identify-user=foo |
            `,
			errored: true,
			error__contains: ["identify-user must be set to true or false"],
		});
	});

	it("should audit identify user true", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |                    |
            |        | type   |   name   | parameters         |
            |        | audit  |   audit  | identify-user=true |
            `,
			xml__contains: [
				"<meta>",
				"<audit/>",
				"</meta>",
				'<bind nodeset="/meta_audit/meta/audit" type="binary" odk:identify-user="true"/>',
			],
		});
	});

	it("should audit identify user false", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |                     |
            |        | type   |   name   | parameters          |
            |        | audit  |   audit  | identify-user=false |
            `,
			xml__contains: [
				"<meta>",
				"<audit/>",
				"</meta>",
				'<bind nodeset="/meta_audit/meta/audit" type="binary" odk:identify-user="false"/>',
			],
		});
	});

	it("should audit track changes reasons foo", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |                          |
            |        | type   |   name   | parameters               |
            |        | audit  |   audit  | track-changes-reasons=foo |
            `,
			errored: true,
			error__contains: ["track-changes-reasons must be set to on-form-edit"],
		});
	});

	it("should audit track changes reasons on form edit", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |                          |
            |        | type   |   name   | parameters               |
            |        | audit  |   audit  | track-changes-reasons=on-form-edit |
            `,
			xml__contains: [
				"<meta>",
				"<audit/>",
				"</meta>",
				'<bind nodeset="/meta_audit/meta/audit" type="binary" odk:track-changes-reasons="on-form-edit"/>',
			],
		});
	});

	it("should audit location track changes", () => {
		assertPyxformXform({
			name: "meta_audit",
			md: `
            | survey |        |          |                                                                                                |
            |        | type   |   name   | parameters                                                                                     |
            |        | audit  |   audit  | location-priority=balanced, track-changes=true, location-min-interval=60, location-max-age=300 |
            `,
			xml__contains: [
				"<meta>",
				"<audit/>",
				"</meta>",
				'<bind nodeset="/meta_audit/meta/audit" type="binary" odk:location-max-age="300" odk:location-min-interval="60" odk:location-priority="balanced" odk:track-changes="true"/>',
			],
		});
	});
});
