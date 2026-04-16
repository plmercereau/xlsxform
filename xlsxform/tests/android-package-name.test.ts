/**
 * Port of pyxform/tests/validators/pyxform/test_android_package_name.py
 * Tests for Android package name validation.
 *
 * These tests call a direct Python API (validate_android_package_name).
 * Since this is a pure validation function, we test it via assertPyxformXform
 * using the settings sheet 'app' parameter where possible, or mark as TODO.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestAndroidPackageNameValidator", () => {
	it("test_empty_package_name", () => {
		// TODO: requires internal API (validate_android_package_name)
		// Original: validate_android_package_name("") == "Parameter 'app' has an invalid Android package name - package name is missing."
		assertPyxformXform({
			md: `
				| survey   |
				|          | type | name | label |
				|          | text | q1   | Q1    |
				| settings |
				|          | app  |
				|          |      |
			`,
			error__contains: ["package name is missing"],
		});
	});

	it("test_blank_package_name", () => {
		// TODO: requires internal API (validate_android_package_name)
		// Original: validate_android_package_name(" ") == "Parameter 'app' has an invalid Android package name - package name is missing."
		assertPyxformXform({
			md: `
				| survey   |
				|          | type | name | label |
				|          | text | q1   | Q1    |
				| settings |
				|          | app  |
				|          |      |
			`,
			error__contains: ["package name is missing"],
		});
	});

	it("test_missing_separator", () => {
		// TODO: requires internal API (validate_android_package_name)
		// Original: validate_android_package_name("comexampleapp") returns error about missing '.' separator
		assertPyxformXform({
			md: `
				| survey   |
				|          | type | name | label |
				|          | text | q1   | Q1    |
				| settings |
				|          | app           |
				|          | comexampleapp |
			`,
			error__contains: ["at least one '.' separator"],
		});
	});

	it("test_invalid_start_with_underscore", () => {
		// TODO: requires internal API (validate_android_package_name)
		assertPyxformXform({
			md: `
				| survey   |
				|          | type | name | label |
				|          | text | q1   | Q1    |
				| settings |
				|          | app              |
				|          | _com.example.app |
			`,
			error__contains: ["cannot be the first character"],
		});
	});

	it("test_invalid_start_with_digit", () => {
		// TODO: requires internal API (validate_android_package_name)
		assertPyxformXform({
			md: `
				| survey   |
				|          | type | name | label |
				|          | text | q1   | Q1    |
				| settings |
				|          | app              |
				|          | 1com.example.app |
			`,
			error__contains: ["digit cannot be the first character"],
		});
	});

	it("test_invalid_character", () => {
		// TODO: requires internal API (validate_android_package_name)
		assertPyxformXform({
			md: `
				| survey   |
				|          | type | name | label |
				|          | text | q1   | Q1    |
				| settings |
				|          | app              |
				|          | com.example.app$ |
			`,
			error__contains: ["invalid Android package name"],
		});
	});

	it("test_package_name_segment_with_zero_length", () => {
		// TODO: requires internal API (validate_android_package_name)
		assertPyxformXform({
			md: `
				| survey   |
				|          | type | name | label |
				|          | text | q1   | Q1    |
				| settings |
				|          | app     |
				|          | com..app |
			`,
			error__contains: ["non-zero length"],
		});
	});

	it("test_separator_as_last_char_in_package_name", () => {
		// TODO: requires internal API (validate_android_package_name)
		assertPyxformXform({
			md: `
				| survey   |
				|          | type | name | label |
				|          | text | q1   | Q1    |
				| settings |
				|          | app              |
				|          | com.example.app. |
			`,
			error__contains: ["cannot end in a '.' separator"],
		});
	});

	it("test_valid_package_name", () => {
		// TODO: requires internal API (validate_android_package_name)
		// Valid package names should not produce errors.
		const validNames = [
			"com.zenstudios.zenpinball",
			"com.outfit7.talkingtom",
			"com.zeptolab.ctr2.f2p.google",
			"com.ea.game.pvzfree_row",
			"com.rovio.angrybirdsspace.premium",
		];
		for (const pkgName of validNames) {
			assertPyxformXform({
				md: `
					| survey   |
					|          | type | name | label |
					|          | text | q1   | Q1    |
					| settings |
					|          | app       |
					|          | ${pkgName} |
				`,
			});
		}
	});
});
