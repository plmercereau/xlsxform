/**
 * Port of test_validators.py - Test validators.
 */

import { describe, it } from "vitest";

describe("TestValidatorsUtil", () => {
	it.todo("test_check_java_available__found - TODO: requires internal API (check_java_available, Java dependency)", () => {
		// The Python test mocks shutil.which to return a java path and
		// verifies check_java_available does not throw.
	});

	it.todo("test_check_java_available__not_found - TODO: requires internal API (check_java_available, Java dependency)", () => {
		// The Python test mocks shutil.which to return None and verifies
		// check_java_available raises EnvironmentError with expected message.
	});
});
