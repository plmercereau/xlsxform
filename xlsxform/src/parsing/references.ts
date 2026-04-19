/**
 * Pyxform reference utilities for ${...} variable references.
 */

export const PYXFORM_REF_RE = /\$\{([^}]*)\}/g;
// Valid reference name: NCName pattern (no whitespace, starts with letter/underscore, with optional last-saved# prefix)
export const VALID_REF_NAME_RE = /^(?:last-saved#)?[a-zA-Z_][a-zA-Z0-9._-]*$/;

/**
 * Validate pyxform reference syntax in a string. Returns error message or null.
 */
export function validatePyxformReferenceSyntax(
	value: string,
	rowNum: number,
	sheet: string,
	column: string,
): string | null {
	// Check for unclosed references: ${ without matching }
	let pos = 0;
	while (pos < value.length) {
		const idx = value.indexOf("${", pos);
		if (idx === -1) {
			break;
		}
		const endIdx = value.indexOf("}", idx + 2);
		if (endIdx === -1) {
			return `[row : ${rowNum}] On the '${sheet}' sheet, the '${column}' value is invalid. Malformed pyxform reference - an opening '\${' was found without a closing '}'.`;
		}
		const refContent = value.substring(idx + 2, endIdx);
		if (!VALID_REF_NAME_RE.test(refContent)) {
			return `[row : ${rowNum}] On the '${sheet}' sheet, the '${column}' value is invalid. Malformed pyxform reference - the content between '\${' and '}' must be a valid question name.`;
		}
		// Check for nested ${
		if (refContent.includes("${")) {
			return `[row : ${rowNum}] On the '${sheet}' sheet, the '${column}' value is invalid. Malformed pyxform reference - nested '\${' found.`;
		}
		pos = endIdx + 1;
	}
	return null;
}

/**
 * Extract all ${name} references from a string value.
 */
export function extractPyxformReferences(value: string): string[] {
	const refs: string[] = [];
	let match: RegExpExecArray | null;
	const re = new RegExp(PYXFORM_REF_RE.source, "g");
	match = re.exec(value);
	while (match !== null) {
		if (match[1]) {
			refs.push(match[1]);
		}
		match = re.exec(value);
	}
	return refs;
}

/**
 * Check if a string contains a ${...} reference.
 */
export function hasPyxformReference(value: string): boolean {
	return /\$\{/.test(value);
}
