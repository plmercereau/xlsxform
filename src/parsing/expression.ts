/**
 * Expression parsing for XPath and pyxform references.
 */

// Regex for pyxform variable references: ${variable_name}
export const RE_PYXFORM_REF = /\$\{([^}]+)\}/g;

// NCName regex adapted from eulxml (Apache v2.0 License)
// https://www.w3.org/TR/REC-xml/#NT-NameStartChar
// https://www.w3.org/TR/REC-xml-names/#NT-NCName
const nameStartChar =
	"[A-Z_a-z\\xC0-\\xD6\\xD8-\\xF6\\xF8-\\u02FF" +
	"\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F" +
	"\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD]";
const nameCharExtra = "[\\-.0-9\\xB7\\u0300-\\u036F\\u203F-\\u2040]";
const ncName = `${nameStartChar}(?:${nameStartChar}|${nameCharExtra})*`;
// Namespaced NCName: ncname or ncname:ncname
const ncNameNs = `${ncName}(?::${ncName})?`;
const RE_NCNAME_NAMESPACED = new RegExp(`^${ncNameNs}$`);

export function isXmlTag(name: string): boolean {
	if (!name) return false;
	return RE_NCNAME_NAMESPACED.test(name);
}

export function hasPyxformReference(text: string): boolean {
	if (!text || typeof text !== "string") return false;
	RE_PYXFORM_REF.lastIndex = 0;
	return RE_PYXFORM_REF.test(text);
}

export function isPyxformReference(text: string): boolean {
	if (!text || typeof text !== "string") return false;
	const trimmed = text.trim();
	return /^\$\{[^}]+\}$/.test(trimmed);
}

/**
 * Parse pyxform references from a string, returning array of {name, lastSaved}.
 */
export function parsePyxformReferences(
	text: string,
): { name: string; lastSaved: boolean }[] {
	const results: { name: string; lastSaved: boolean }[] = [];
	RE_PYXFORM_REF.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = RE_PYXFORM_REF.exec(text)) !== null) {
		const ref = match[1];
		if (ref.startsWith("last-saved#")) {
			results.push({ name: ref.substring("last-saved#".length), lastSaved: true });
		} else {
			results.push({ name: ref, lastSaved: false });
		}
	}
	return results;
}

/**
 * If text is wrapped in whitespace, strip it. Used for XPath expressions.
 */
export function maybeStrip(text: string): string {
	return text.trim();
}
