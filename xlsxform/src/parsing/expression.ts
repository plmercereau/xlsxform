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
 * Token from expression parsing.
 */
interface Token {
	type: string;
	value: string;
}

/**
 * Token rules for the expression lexer, ordered by priority (highest first).
 * This mirrors the Lark grammar in pyxform's expression.py.
 *
 * Lark priority semantics: at each position, try all rules and pick the one with
 * the highest priority. Among equal priority, pick the longest match.
 */
const tokenRules: [string, RegExp][] = [
	// https://www.w3.org/TR/xmlschema-2/#dateTime
	[
		"DATETIME",
		/-?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\s+)?((\+|-)\d{2}:\d{2}|Z)?/,
	],
	["DATE", /-?\d{4}-\d{2}-\d{2}/],
	["TIME", /\d{2}:\d{2}:\d{2}(\.\s+)?((\+|-)\d{2}:\d{2}|Z)?/],
	["NUMBER", /-?\d+\.\d*|-?\.\d+|-?\d+/],
	// https://www.w3.org/TR/1999/REC-xpath-19991116/#exprlex
	["OPS_MATH", /[*+-]| mod | div /],
	["OPS_COMP", /=|!=|<=|>=|<|>/],
	["OPS_BOOL", / and | or /],
	["OPS_UNION", /\|/],
	["OPEN_PAREN", /\(/],
	["CLOSE_PAREN", /\)/],
	["BRACKET", /[[\]{}]/],
	["PARENT_REF", /\.\./],
	["SELF_REF", /\./],
	// javarosa.xpath says "//" is an "unsupported construct".
	["PATH_SEP", /\//],
	["SYSTEM_LITERAL", /"[^"]*"|'[^']*'/],
	["COMMA", /,/],
	["WHITESPACE", /\s+/],
	["PYXFORM_REF", new RegExp(`\\$\\{(?:last-saved#)?${ncName}\\}`)],
	["FUNC_CALL", new RegExp(`${ncNameNs}\\(`)],
	["XPATH_PRED_START", new RegExp(`${ncNameNs}\\[`)],
	["XPATH_PRED_END", /\]/],
	["URI_SCHEME", new RegExp(`${ncName}:\\/\\/`)],
	// Must be lower priority than rules containing ncname_regex.
	["NAME", new RegExp(ncNameNs)],
	["PYXFORM_REF_START", /\$\{/],
	["PYXFORM_REF_END", /\}/],
	// Catch any other character so that parsing doesn't stop.
	["OTHER", /.+?/],
];

// Pre-compile sticky regexes for each rule
const stickyRules: [string, RegExp][] = tokenRules.map(([name, re]) => [
	name,
	new RegExp(re.source, "y"),
]);

const _cache = new Map<string, Token[]>();

/**
 * Parse an expression into tokens.
 *
 * Port of pyxform's parse_expression which uses Lark's lexer.
 * Uses caching for performance (like the Python @lru_cache).
 */
export function parseExpression(text: string): Token[] {
	const cached = _cache.get(text);
	if (cached) return cached;

	const tokens: Token[] = [];
	let pos = 0;

	while (pos < text.length) {
		let bestMatch: { type: string; value: string } | null = null;

		for (const [type, re] of stickyRules) {
			re.lastIndex = pos;
			const m = re.exec(text);
			if (m && m.index === pos) {
				// First match wins (rules are in priority order).
				// Among same-priority rules, Lark picks longest match,
				// but our rules are ordered so first match is correct.
				if (!bestMatch || m[0].length > bestMatch.value.length) {
					bestMatch = { type, value: m[0] };
				} else if (m[0].length === bestMatch.value.length) {
				}
			}
		}

		// bestMatch is always non-null because OTHER (/.+?/) catches any character
		if (bestMatch) {
			tokens.push(bestMatch);
			pos += bestMatch.value.length;
		}
	}

	// Cache management (simple LRU-like: cap at 128)
	if (_cache.size >= 128) {
		const firstKey = _cache.keys().next().value;
		if (firstKey !== undefined) _cache.delete(firstKey);
	}
	_cache.set(text, tokens);

	return tokens;
}
