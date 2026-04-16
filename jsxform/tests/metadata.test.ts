/**
 * Port of test_metadata.py - Metadata and related warnings tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestMetadata", () => {
	it("should have metadata bindings", () => {
		assertPyxformXform({
			name: "metadata",
			md: `
				| survey |             |             |       |
				|        | type        | name        | label |
				|        | deviceid    | deviceid    |       |
				|        | phonenumber | phonenumber |       |
				|        | start       | start       |       |
				|        | end         | end         |       |
				|        | today       | today       |       |
				|        | username    | username    |       |
				|        | email       | email       |       |
			`,
			xml__contains: [
				'jr:preload="property" jr:preloadParams="deviceid"',
				'jr:preload="property" jr:preloadParams="phonenumber"',
				'jr:preload="timestamp" jr:preloadParams="start"',
				'jr:preload="timestamp" jr:preloadParams="end"',
				'jr:preload="date" jr:preloadParams="today"',
				'jr:preload="property" jr:preloadParams="username"',
				'jr:preload="property" jr:preloadParams="email"',
			],
		});
	});

	it("should warn about simserial deprecation", () => {
		assertPyxformXform({
			md: `
				| survey |              |                       |                                     |
				|        | type         | name                  | label                               |
				|        | simserial    | simserial             |                                     |
				|        | note         | simserial_test_output | simserial_test_output: \${simserial} |
			`,
			warnings_count: 1,
			warnings__contains: [
				"[row : 2] simserial is no longer supported on most devices. " +
					"Only old versions of Collect on Android versions older than 11 still support it.",
			],
		});
	});

	it("should warn about subscriber id deprecation", () => {
		assertPyxformXform({
			md: `
				| survey |              |                          |                                            |
				|        | type         | name                     | label                                      |
				|        | subscriberid | subscriberid             | sub id - extra warning generated w/o this  |
				|        | note         | subscriberid_test_output | subscriberid_test_output: \${subscriberid}  |
			`,
			warnings_count: 1,
			warnings__contains: [
				"[row : 2] subscriberid is no longer supported on most devices. " +
					"Only old versions of Collect on Android versions older than 11 still support it.",
			],
		});
	});

	it("should allow survey named meta", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | q1   | Q1    |
			`,
			name: "meta",
			warnings_count: 0,
		});
	});

	it("should allow question named meta in survey with case insensitive match", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | META | Q1    |
			`,
			warnings_count: 0,
		});
	});

	it("should allow group named meta in survey with case insensitive match", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin group | META | G1    |
				| | text        | q1   | Q1    |
				| | end group   |      |       |
			`,
			warnings_count: 0,
		});
	});

	it("should allow repeat named meta in survey with case insensitive match", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | META | G1    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
			`,
			warnings_count: 0,
		});
	});

	it("should error when question named meta in survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type | name | label |
				| | text | meta | Q1    |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'name' value 'meta' is invalid. " +
					"The name 'meta' is reserved for form metadata.",
			],
		});
	});

	it("should error when group named meta in survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin group | meta | G1    |
				| | text        | q1   | Q1    |
				| | end group   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'name' value 'meta' is invalid. " +
					"The name 'meta' is reserved for form metadata.",
			],
		});
	});

	it("should error when repeat named meta in survey", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | meta | G1    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'name' value 'meta' is invalid. " +
					"The name 'meta' is reserved for form metadata.",
			],
		});
	});

	it("should error when question named meta in group", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin group | g1   | G1    |
				| | text        | meta | Q1    |
				| | end group   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'name' value 'meta' is invalid. " +
					"The name 'meta' is reserved for form metadata.",
			],
		});
	});

	it("should error when group named meta in group", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type        | name | label |
				| | begin group | g1   | G1    |
				| | begin group | meta | G1    |
				| | text        | q1   | Q1    |
				| | end group   |      |       |
				| | end group   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'name' value 'meta' is invalid. " +
					"The name 'meta' is reserved for form metadata.",
			],
		});
	});

	it("should error when repeat named meta in group", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin group  | g1   | G1    |
				| | begin repeat | meta | G1    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
				| | end group    |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'name' value 'meta' is invalid. " +
					"The name 'meta' is reserved for form metadata.",
			],
		});
	});

	it("should error when question named meta in repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | r1   | R1    |
				| | text         | meta | Q1    |
				| | end group    |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'name' value 'meta' is invalid. " +
					"The name 'meta' is reserved for form metadata.",
			],
		});
	});

	it("should error when group named meta in repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | r1   | R1    |
				| | begin group  | meta | G1    |
				| | text         | q1   | Q1    |
				| | end group    |      |       |
				| | end repeat   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'name' value 'meta' is invalid. " +
					"The name 'meta' is reserved for form metadata.",
			],
		});
	});

	it("should error when repeat named meta in repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | r1   | R1    |
				| | begin repeat | meta | G1    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
				| | end repeat   |      |       |
			`,
			errored: true,
			error__contains: [
				"[row : 3] On the 'survey' sheet, the 'name' value 'meta' is invalid. " +
					"The name 'meta' is reserved for form metadata.",
			],
		});
	});
});
