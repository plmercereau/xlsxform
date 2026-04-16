/**
 * Port of test_validators.py - Test validators.
 */

import { describe, expect, it, vi } from "vitest";
import { checkJavaAvailable } from "./helpers/validators/odk-validate.js";

const msg =
	"Form validation failed because Java (8+ required) could not be found.";

describe("TestValidatorsUtil", () => {
	it("test_check_java_available__found - Should not raise an error when Java is found", () => {
		const mockWhich = vi.fn().mockReturnValue("/usr/bin/java");
		expect(() => checkJavaAvailable(mockWhich)).not.toThrow();
	});

	it("test_check_java_available__not_found - Should raise an error when Java is not found", () => {
		const mockWhich = vi.fn().mockReturnValue(null);
		expect(() => checkJavaAvailable(mockWhich)).toThrow(Error);
		try {
			checkJavaAvailable(mockWhich);
		} catch (e) {
			expect((e as Error).message).toContain(msg);
		}
	});
});
