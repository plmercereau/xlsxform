/**
 * Port of test_validate_unicode_exception.py - Test unicode characters in validate error messages.
 *
 * NOTE: The Python tests use odk_validate_error__contains which requires
 * ODK Validate (Java). The TS test helper does not support ODK Validate.
 * These forms may compile successfully in the TS port since only ODK Validate
 * would catch the invalid XPath expressions. The tests are included for
 * completeness, verifying the forms can at least be processed without crashing.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("ValidateUnicodeException", () => {
	it("test_validate_unicode_exception", () => {
		// In Python: odk_validate_error__contains=['Invalid calculate for the bind
		// attached to "${bad}" : Couldn\'t understand the expression starting at this point:']
		// The TS port does not run ODK Validate, so we just verify the form processes.
		assertPyxformXform({
			md: `
			| survey  |           |       |       |                |
			|         | type      | name  | label | calculation    |
			|         | calculate | bad   | bad   | $(myField)='1' |
			`,
		});
	});

	it("test_validate_with_more_unicode", () => {
		// In Python: odk_validate_error__contains=['Invalid calculate for the bind
		// attached to "${bad}" : Couldn\'t understand the expression starting at this point:']
		// The TS port does not run ODK Validate, so we just verify the form processes.
		assertPyxformXform({
			md: `
			| survey  |           |       |       |                |
			|         | type      | name  | label | calculation    |
			|         | calculate | bad   | bad   | \u00a3\u00a5\u00a7\u00a9\u00ae\u20b1\u20a9        |
			`,
		});
	});
});
