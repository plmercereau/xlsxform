/**
 * Parse the survey sheet 'parameters' column into a key-value map.
 *
 * Ported from pyxform/parsing/parameters.py. Key-value pairs are separated by
 * whitespace, commas, or semicolons, and may have whitespace around the '='
 * delimiter. Keys are normalised to lowercase; values are lowercased unless the
 * key is case-sensitive (used to match user-specified file columns).
 */

import { ErrorCode, PyXFormError } from "../errors.js";

// Label and value are matched against user-specified files so case is preserved.
const CASE_SENSITIVE_VALUES = new Set(["label", "value"]);

// A symbol is either the '=' assignment operator or a run of characters that are
// not a delimiter (whitespace, comma, semicolon) or '='. Delimiters are skipped.
const PARAMETER_SYMBOL = /[^\s=,;]+|=/g;

/**
 * Parse a raw parameters string into a normalised key-value map.
 *
 * @throws PyXFormError (SURVEY_004) when the string is not a sequence of
 *   `key=value` pairs.
 */
export function parseParameters(
	rawParameters: string | null | undefined,
	rowNumber: number,
): Record<string, string> {
	if (!rawParameters?.trim()) {
		return {};
	}

	const symbols = rawParameters.match(PARAMETER_SYMBOL) ?? [];
	if (symbols.length === 0) {
		// Only delimiters: no pairs, same as an empty string.
		return {};
	}

	// Valid input is a sequence of "<token> = <token>" triples, i.e. every third
	// symbol (and only those) must be the '=' operator.
	const invalid =
		symbols.length % 3 !== 0 ||
		symbols.some((symbol, i) => (i % 3 === 1) === (symbol !== "="));
	if (invalid) {
		throw new PyXFormError(
			ErrorCode.SURVEY_004.format({ row: String(rowNumber) }),
		);
	}

	const result: Record<string, string> = {};
	for (let i = 0; i < symbols.length; i += 3) {
		const key = symbols[i].toLowerCase();
		const value = symbols[i + 2];
		result[key] = CASE_SENSITIVE_VALUES.has(key) ? value : value.toLowerCase();
	}
	return result;
}
