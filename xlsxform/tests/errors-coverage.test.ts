/**
 * Additional tests for errors.ts coverage.
 */

import { describe, expect, it } from "vitest";
import {
	ErrorCode,
	ODKValidateError,
	PyXFormError,
	ValidationError,
} from "../src/errors.js";

describe("Error classes", () => {
	it("should create PyXFormError with correct name", () => {
		const err = new PyXFormError("test");
		expect(err.name).toBe("PyXFormError");
		expect(err.message).toBe("test");
		expect(err instanceof Error).toBe(true);
	});

	it("should create ValidationError as subclass of PyXFormError", () => {
		const err = new ValidationError("validation failed");
		expect(err.name).toBe("ValidationError");
		expect(err.message).toBe("validation failed");
		expect(err instanceof PyXFormError).toBe(true);
	});

	it("should create ODKValidateError with correct name", () => {
		const err = new ODKValidateError("odk error");
		expect(err.name).toBe("ODKValidateError");
		expect(err.message).toBe("odk error");
		expect(err instanceof Error).toBe(true);
	});
});

describe("ErrorCode", () => {
	it("should have a value property that returns msg", () => {
		expect(ErrorCode.HEADER_004.value).toBe(ErrorCode.HEADER_004.msg);
	});

	it("should format with kwargs", () => {
		const formatted = ErrorCode.HEADER_004.format({ column: "test_col" });
		expect(formatted).toContain("test_col");
		expect(formatted).not.toContain("{column}");
	});
});
