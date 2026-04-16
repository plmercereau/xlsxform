/**
 * Sheet header processing - dealias and group headers.
 */

import * as constants from "../constants.js";
import { PyXFormError } from "../errors.js";

/** Clean up text values (smart quotes, whitespace) */
export function cleanTextValues(text: any, stripWhitespace = false): any {
	if (typeof text !== "string") return text;
	// Optionally collapse sequences of whitespace to a single space
	if (stripWhitespace) {
		text = text.trim().replace(/\s+/g, " ");
	}
	// Replace smart quotes
	text = text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
	return text.trim();
}

/** Merge dicts recursively, b overrides a */
export function mergeDicts(
	a: Record<string, any>,
	b: Record<string, any>,
): Record<string, any> {
	const result = { ...a };
	for (const [key, value] of Object.entries(b)) {
		if (
			key in result &&
			typeof result[key] === "object" &&
			result[key] !== null &&
			!Array.isArray(result[key]) &&
			typeof value === "object" &&
			value !== null &&
			!Array.isArray(value)
		) {
			result[key] = mergeDicts(result[key], value);
		} else {
			result[key] = value;
		}
	}
	return result;
}

/** Convert header string to a processed header path */
function processHeader(
	header: string,
	headerAliases: Record<string, string | [string, string]>,
): { path: string[]; value?: string } {
	// Check for group delimiter (:: separates nested keys)
	const parts = header.split("::").map(p => p.trim());

	if (parts.length === 1) {
		// Simple header - check aliases (case-insensitive fallback)
		const alias = headerAliases[header] ?? headerAliases[header.toLowerCase()];
		if (alias) {
			if (Array.isArray(alias)) {
				return { path: alias };
			}
			return { path: [alias] };
		}
		return { path: [header.toLowerCase()] };
	}

	// Nested header like "bind::relevant" or "instance::abc"
	const prefix = parts[0].toLowerCase();
	const suffix = parts.slice(1).join("::");

	return { path: [prefix, suffix] };
}

// ============================================================
// Python-compatible API functions (matching pyxform internals)
// ============================================================

/**
 * Convert a name (e.g. column name or question type) to snake case.
 * Removes duplicate, leading, trailing spaces.
 */
export function toSnakeCase(value: string): string {
	const parts = value.split(/\s+/).filter(s => s.length > 0);
	return parts.join("_").toLowerCase();
}

/**
 * Convert a list to a nested dict: [1,2,3,4] -> {1:{2:{3:4}}}
 */
export function listToNestedDict(lst: any[]): any {
	if (lst.length > 1) {
		return { [lst[0]]: listToNestedDict(lst.slice(1)) };
	}
	return lst[0];
}

/**
 * Python-compatible process_header: lookup the header in expected columns or aliases.
 *
 * Returns [newHeader, tokens] where newHeader may be a string or string[] (for tuple aliases).
 */
export function processHeaderFull(
	header: string,
	useDoubleColon: boolean,
	headerAliases: Record<string, string | string[]>,
	headerColumns: Iterable<string>,
): [string | string[], string[]] {
	const columnsSet = headerColumns instanceof Set ? headerColumns : new Set(headerColumns);

	// If the header is already recognised then nothing further needed.
	if (columnsSet.has(header) && !(header in headerAliases)) {
		return [header, [header]];
	}

	// Also try normalising to snake_case.
	const headerNormalised = toSnakeCase(header);
	if (columnsSet.has(headerNormalised) && !(headerNormalised in headerAliases)) {
		return [headerNormalised, [headerNormalised]];
	}

	const groupDelimiter = "::";
	let tokens: string[];
	if (useDoubleColon || header.includes(groupDelimiter)) {
		tokens = header.split(groupDelimiter).map(t => t.trim());
	} else {
		tokens = header.split(":").map(t => t.trim());
		// Handle "jr:count" or similar when used with single colon delimiters.
		const jrIdx = tokens.indexOf("jr");
		if (jrIdx !== -1 && jrIdx + 1 < tokens.length) {
			tokens = [
				...tokens.slice(0, jrIdx),
				`jr:${tokens[jrIdx + 1]}`,
				...tokens.slice(jrIdx + 2),
			];
		}
	}

	let newHeader: string | string[] = toSnakeCase(tokens[0]);
	const dealiased = headerAliases[newHeader as string];
	if (dealiased) {
		if (Array.isArray(dealiased)) {
			newHeader = dealiased;
			tokens = [...dealiased, ...tokens.slice(1)];
		} else {
			newHeader = dealiased;
			tokens = [dealiased, ...tokens.slice(1)];
		}
	} else if (columnsSet.has(newHeader as string)) {
		tokens = [newHeader as string, ...tokens.slice(1)];
	} else {
		// Avoid changing unknown columns, since it could break choice_filter expressions.
		newHeader = header;
		tokens = [...tokens];
	}

	return [newHeader, tokens];
}

/**
 * Python-compatible process_row: convert original headers and values to a possibly nested structure.
 */
export function processRow(
	sheetName: string,
	row: Record<string, string>,
	headerKey: Record<string, string[]>,
	rowNumber: number,
	defaultLanguage: string = constants.DEFAULT_LANGUAGE_VALUE,
	stripWhitespace = false,
	addRowNumber = false,
): Record<string, any> {
	let outRow: Record<string, any> = {};
	for (const [header, rawVal] of Object.entries(row)) {
		const val = cleanTextValues(rawVal, stripWhitespace);
		const tokens = headerKey[header];
		if (!tokens) {
			throw new PyXFormError(
				`Invalid headers provided for sheet: '${sheetName}'. For XLSForms, this may be due ` +
				`a missing header row, in which case add a header row as per the reference template ` +
				`https://xlsform.org/en/ref-table/. For internal API usage, may be due to a missing ` +
				`mapping for '${header}', in which case ensure that the full set of headers appear ` +
				`within the first 100 rows, or specify the header row in '${sheetName}_header'.`,
			);
		} else if (tokens.length === 1) {
			outRow[tokens[0]] = val;
		} else {
			const newValue = listToNestedDict([...tokens.slice(1), val]);
			outRow = mergeDictsWithLang(outRow, { [tokens[0]]: newValue }, defaultLanguage);
		}
	}
	if (addRowNumber) {
		outRow["__row"] = rowNumber;
	}
	return outRow;
}

/**
 * Merge dicts recursively with language-aware merging (matching Python merge_dicts).
 */
function mergeDictsWithLang(
	a: Record<string, any>,
	b: Record<string, any>,
	defaultLanguage: string,
): Record<string, any> {
	const result = { ...a };
	for (const [key, value] of Object.entries(b)) {
		if (
			key in result &&
			typeof result[key] === "object" &&
			result[key] !== null &&
			!Array.isArray(result[key]) &&
			typeof value === "object" &&
			value !== null &&
			!Array.isArray(value)
		) {
			result[key] = mergeDictsWithLang(result[key], value, defaultLanguage);
		} else if (
			key in result &&
			typeof result[key] === "string" &&
			typeof value === "object" &&
			value !== null &&
			!Array.isArray(value)
		) {
			result[key] = mergeDictsWithLang({ [defaultLanguage]: result[key] }, value, defaultLanguage);
		} else if (
			key in result &&
			typeof result[key] === "object" &&
			result[key] !== null &&
			!Array.isArray(result[key]) &&
			typeof value === "string"
		) {
			result[key] = { ...result[key], [defaultLanguage]: value };
		} else {
			result[key] = value;
		}
	}
	return result;
}

export interface DealiasAndGroupHeadersResult {
	headers: string[][];
	data: Record<string, any>[];
}

/**
 * Python-compatible dealias_and_group_headers: process a whole sheet's headers and data.
 */
export function dealiasAndGroupSheet(
	sheetName: string,
	sheetData: Record<string, string>[],
	sheetHeader: Record<string, any>[] | null,
	headerAliases: Record<string, string | string[]>,
	headerColumns: Set<string>,
	headersRequired?: Set<string>,
	defaultLanguage: string = constants.DEFAULT_LANGUAGE_VALUE,
	stripWhitespace = false,
	addRowNumber = false,
): DealiasAndGroupHeadersResult {
	const headerKey: Record<string, string[]> = {};
	const tokensKey: Map<string, string> = new Map();

	// If not specified, guess headers from first 100 rows
	if ((!sheetHeader || sheetHeader.length === 0) && sheetData.length > 0) {
		const guessed: Record<string, any> = {};
		for (const row of sheetData.slice(0, 100)) {
			for (const k of Object.keys(row)) {
				guessed[k] = null;
			}
		}
		sheetHeader = [guessed];
	}

	if (sheetHeader && sheetHeader.length > 0) {
		const useDoubleColon = Object.keys(sheetHeader[0]).some(k => k.includes("::"));
		for (const header of Object.keys(sheetHeader[0])) {
			if (header in headerKey) continue;
			const [newHeader, tokens] = processHeaderFull(
				header,
				useDoubleColon,
				headerAliases,
				headerColumns,
			);
			const tokensStr = JSON.stringify(tokens);
			const otherHeader = tokensKey.get(tokensStr);
			if (otherHeader && (typeof newHeader === "string" ? newHeader : JSON.stringify(newHeader)) !== header) {
				throw new PyXFormError(
					`Invalid headers provided for sheet: '${sheetName}'. Headers that are different ` +
					`names for the same column were found: '${otherHeader}', '${header}'. Rename or remove one ` +
					`of these columns.`,
				);
			}
			headerKey[header] = tokens;
			tokensKey.set(tokensStr, header);
		}
	}

	const data = sheetData.map((row, idx) =>
		processRow(
			sheetName,
			row,
			headerKey,
			idx + 2,
			defaultLanguage,
			stripWhitespace,
			addRowNumber,
		),
	);

	if (headersRequired && (data.length > 0 || sheetName === constants.SURVEY)) {
		const allFirstTokens = new Set([...tokensKey.values()].map(h => headerKey[h]?.[0]).filter(Boolean));
		const missing = [...headersRequired].filter(h => !allFirstTokens.has(h));
		if (missing.length > 0) {
			throw new PyXFormError(
				`Invalid headers provided for sheet: '${sheetName}'. One or more required column ` +
				`headers were not found: ${missing.map(h => `'${h}'`).join(", ")}. ` +
				`Learn more: https://xlsform.org/en/#setting-up-your-worksheets`,
			);
		}
	}

	const headers = [...tokensKey.keys()].map(k => JSON.parse(k) as string[]);

	return { headers, data };
}

export interface DealiasedRow {
	[key: string]: any;
}

/**
 * Process a single row of data, dealiasing headers and grouping nested values.
 */
export function dealiasAndGroupHeaders(
	row: Record<string, any>,
	headerAliases: Record<string, string | [string, string]>,
	isChoicesSheet = false,
	defaultLanguage = "default",
	stripWhitespace = false,
): DealiasedRow {
	const result: Record<string, any> = {};

	// Determine delimiter: if any header uses "::", use "::" for all; otherwise use ":"
	const headers = Object.keys(row);
	const useDoubleColon = headers.some(h => h.includes("::"));
	const delimiter = useDoubleColon ? "::" : ":";

	for (const [header, rawValue] of Object.entries(row)) {
		if (rawValue == null || rawValue === "") continue;

		const value = cleanTextValues(rawValue, stripWhitespace);
		if (value === "" || value == null) continue;

		// Handle media columns: media::audio, media::audio::English
		const mediaParts = header.split("::").map(p => p.trim());
		if (mediaParts.length >= 2 && mediaParts[0] === "media") {
			const mediaType = mediaParts[1]; // e.g., "audio", "image", "video", "big-image"
			if (!result.media) result.media = {};
			if (mediaParts.length === 3) {
				// media::audio::English → translated media
				const lang = mediaParts[2];
				if (typeof result.media[mediaType] !== "object" || result.media[mediaType] === null) {
					result.media[mediaType] = {};
				}
				result.media[mediaType][lang] = value;
			} else {
				// media::audio → untranslated media
				result.media[mediaType] = value;
			}
			continue;
		}

		// Handle translation columns like "label::English", "hint::French"
		// Also handles spaces around :: like "constraint_message :: English (en)"
		// When useDoubleColon is false, also handle single colon "label:English"
		const delimPattern = useDoubleColon
			? /^(.+?)(?:\s*)::\s*(.+)$/
			: /^(.+?)(?:\s*):\s*(.+)$/;
		const langMatch = header.match(delimPattern);
		// When using single colon, skip known colon-containing names like jr:constraintMsg
		const isJrPrefix = langMatch && !useDoubleColon && langMatch[1].trim() === "jr";
		if (langMatch && !isJrPrefix) {
			const baseCol = langMatch[1].trim();
			const lang = langMatch[2].trim();
			// Check if it maps to an alias (case-insensitive fallback)
			const alias = headerAliases[baseCol] ?? headerAliases[baseCol.toLowerCase()];
			let targetKey: string;
			if (alias && typeof alias === "string") {
				targetKey = alias;
			} else if (Array.isArray(alias)) {
				// For nested aliases like ["bind", "jr:constraintMsg"],
				// create the nested structure with language
				if (!result[alias[0]]) result[alias[0]] = {};
				if (typeof result[alias[0]] === "object") {
					if (!result[alias[0]][alias[1]]) result[alias[0]][alias[1]] = {};
					if (typeof result[alias[0]][alias[1]] === "object") {
						result[alias[0]][alias[1]][lang] = value;
					}
				}
				continue;
			} else {
				targetKey = baseCol;
			}
			if (!result[targetKey]) {
				result[targetKey] = {};
			} else if (typeof result[targetKey] === "string") {
				// Convert existing string value to a dict with default language
				result[targetKey] = { [defaultLanguage]: result[targetKey] };
			}
			if (typeof result[targetKey] === "object" && !Array.isArray(result[targetKey])) {
				result[targetKey][lang] = value;
			}
			continue;
		}

		const { path } = processHeader(header, headerAliases);

		if (path.length === 1) {
			// If a translation dict already exists for this key, add as default language
			if (typeof result[path[0]] === "object" && result[path[0]] !== null && !Array.isArray(result[path[0]])) {
				result[path[0]][defaultLanguage] = value;
			} else {
				result[path[0]] = value;
			}
		} else if (path.length === 2) {
			if (!result[path[0]]) {
				result[path[0]] = {};
			}
			if (typeof result[path[0]] === "object" && !Array.isArray(result[path[0]])) {
				result[path[0]][path[1]] = value;
			}
		}
	}

	return result;
}
