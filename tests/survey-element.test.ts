/**
 * Port of pyxform/tests/test_survey_element.py
 * Tests for SurveyElement mapping behaviour.
 *
 * These tests use internal Python APIs (SurveyElement, dict-like access, warnings).
 * They are ported as TODO stubs since they test Python-specific internal APIs.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestSurveyElementMappingBehaviour", () => {
	it("test_get_call_patterns_equivalent_to_base_dict", () => {
		// TODO: requires internal API (SurveyElement dict-like access, DeprecationWarning, getattr)
		// Original test verifies that SurveyElement behaves like a dict for get/getattr calls,
		// including deprecation warnings for undefined keys with defaults.
	});

	it("test_validate__invalid_name__error", () => {
		// The original test calls SurveyElement(name=".q", label="Q1").validate() directly.
		// We can test this via assertPyxformXform by using an invalid name.
		assertPyxformXform({
			md: `
				| survey |
				|        | type | name | label |
				|        | text | .q   | Q1    |
			`,
			error__contains: ["name"],
		});
	});
});
