/**
 * Port of pyxform/tests/validators/pyxform/test_pyxform_reference.py
 * Tests for pyxform reference syntax validation.
 *
 * The original tests call validate_pyxform_reference_syntax directly.
 * We port them to use assertPyxformXform where applicable, testing that
 * malformed references in labels produce errors.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

const ok_tokens = [
	"\${a}",
	"\${abc123}",
	"\${last-saved#abc123}",
];

const error_tokens = [
	"\${a }",
	"\${a\n}",
	"\${a",
	"\${a\${b}}",
	"\${last-saved#a }",
	"\${last-saved#a \n}",
	"\${last-saved#a",
	"\${last-saved#a\${b}}",
];

describe("TestPyxformReference", () => {
	it("test_single_reference__ok", () => {
		// Valid references in labels should not cause errors.
		for (const token of ok_tokens) {
			assertPyxformXform({
				md: `
					| survey |
					|        | type    | name    | label        |
					|        | text    | a       | A            |
					|        | text    | b       | B            |
					|        | text    | abc123  | ABC          |
					|        | note    | n1      | ${token}     |
				`,
			});
		}
	});

	it("test_single_reference__error", () => {
		// Malformed references in labels should cause errors.
		for (const token of error_tokens) {
			assertPyxformXform({
				md: `
					| survey |
					|        | type    | name    | label        |
					|        | text    | a       | A            |
					|        | text    | b       | B            |
					|        | text    | abc123  | ABC          |
					|        | note    | n1      | ${token}     |
				`,
				error__contains: ["reference"],
			});
		}
	});

	it("test_multiple_reference__ok", () => {
		// Multiple valid references in a single label should not cause errors.
		for (const token1 of ok_tokens) {
			for (const token2 of ok_tokens) {
				assertPyxformXform({
					md: `
						| survey |
						|        | type    | name    | label                  |
						|        | text    | a       | A                      |
						|        | text    | b       | B                      |
						|        | text    | abc123  | ABC                    |
						|        | note    | n1      | ${token1} ${token2}    |
					`,
				});
			}
		}
	});

	it("test_multiple_references__error", () => {
		// Mixing valid and invalid references should still fail.
		for (const okToken of ok_tokens) {
			for (const errToken of error_tokens) {
				// ok then error
				assertPyxformXform({
					md: `
						| survey |
						|        | type    | name    | label                   |
						|        | text    | a       | A                       |
						|        | text    | b       | B                       |
						|        | text    | abc123  | ABC                     |
						|        | note    | n1      | ${okToken} ${errToken}  |
					`,
					error__contains: ["reference"],
				});
				// error then ok
				assertPyxformXform({
					md: `
						| survey |
						|        | type    | name    | label                   |
						|        | text    | a       | A                       |
						|        | text    | b       | B                       |
						|        | text    | abc123  | ABC                     |
						|        | note    | n1      | ${errToken} ${okToken}  |
					`,
					error__contains: ["reference"],
				});
			}
		}
	});
});
