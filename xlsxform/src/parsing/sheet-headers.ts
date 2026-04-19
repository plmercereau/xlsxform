/**
 * Sheet header processing - dealias and group headers.
 */

import * as constants from "../constants.js";
import { PyXFormError } from "../errors.js";
import type { FormRecord } from "../types.js";

/** Clean up text values (smart quotes, whitespace) */
export function cleanTextValues(
	text: unknown,
	stripWhitespace = false,
): unknown {
	if (typeof text !== "string") {
		return text;
	}
	let result = text;
	// Optionally collapse sequences of whitespace to a single space
	if (stripWhitespace) {
		result = result.trim().replace(/\s+/g, " ");
	}
	// Replace smart quotes
	result = result
		.replace(/[\u2018\u2019]/g, "'")
		.replace(/[\u201C\u201D]/g, '"');
	return result.trim();
}

/** Convert header string to a processed header path */
function processHeader(
	header: string,
	headerAliases: Record<string, string | [string, string]>,
): { path: string[]; value?: string } {
	// Check for group delimiter (:: separates nested keys)
	const parts = header.split("::").map((p) => p.trim());

	if (parts.length === 1) {
		// Simple header - check aliases (try original, then snake_case)
		const headerNorm = toSnakeCase(header);
		const alias = headerAliases[header] ?? headerAliases[headerNorm];
		if (alias) {
			if (Array.isArray(alias)) {
				return { path: alias };
			}
			return { path: [alias] };
		}
		return { path: [headerNorm] };
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
	const parts = value.split(/\s+/).filter((s) => s.length > 0);
	return parts.join("_").toLowerCase();
}

/**
 * Convert a list to a nested dict: [1,2,3,4] -> {1:{2:{3:4}}}
 */
function listToNestedDict(lst: unknown[]): unknown {
	if (lst.length > 1) {
		return { [lst[0] as string]: listToNestedDict(lst.slice(1)) };
	}
	return lst[0];
}

/** Split a header into tokens based on delimiter conventions. */
function splitHeaderTokens(header: string, useDoubleColon: boolean): string[] {
	const groupDelimiter = "::";
	if (useDoubleColon || header.includes(groupDelimiter)) {
		return header.split(groupDelimiter).map((t) => t.trim());
	}
	const tokens = header.split(":").map((t) => t.trim());
	// Handle "jr:count" or similar when used with single colon delimiters.
	const jrIdx = tokens.indexOf("jr");
	if (jrIdx !== -1 && jrIdx + 1 < tokens.length) {
		return [
			...tokens.slice(0, jrIdx),
			`jr:${tokens[jrIdx + 1]}`,
			...tokens.slice(jrIdx + 2),
		];
	}
	return tokens;
}

/** Apply header aliases and resolve the new header and tokens. */
function resolveHeaderAlias(
	tokens: string[],
	header: string,
	headerAliases: Record<string, string | string[]>,
	columnsSet: Set<string>,
): { newHeader: string | string[]; tokens: string[] } {
	const normalized = toSnakeCase(tokens[0]);
	const dealiased = headerAliases[normalized];
	if (dealiased) {
		const base = Array.isArray(dealiased) ? dealiased : [dealiased];
		return {
			newHeader: dealiased,
			tokens: [...base, ...tokens.slice(1)],
		};
	}
	if (columnsSet.has(normalized)) {
		return {
			newHeader: normalized,
			tokens: [normalized, ...tokens.slice(1)],
		};
	}
	// Avoid changing unknown columns, since it could break choice_filter expressions.
	return { newHeader: header, tokens: [...tokens] };
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
	const columnsSet =
		headerColumns instanceof Set ? headerColumns : new Set(headerColumns);

	// If the header is already recognised then nothing further needed.
	if (columnsSet.has(header) && !(header in headerAliases)) {
		return [header, [header]];
	}

	// Also try normalising to snake_case.
	const headerNormalised = toSnakeCase(header);
	if (
		columnsSet.has(headerNormalised) &&
		!(headerNormalised in headerAliases)
	) {
		return [headerNormalised, [headerNormalised]];
	}

	const tokens = splitHeaderTokens(header, useDoubleColon);
	const resolved = resolveHeaderAlias(
		tokens,
		header,
		headerAliases,
		columnsSet,
	);
	return [resolved.newHeader, resolved.tokens];
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
): Record<string, unknown> {
	let outRow: Record<string, unknown> = {};
	for (const [header, rawVal] of Object.entries(row)) {
		const val = cleanTextValues(rawVal, stripWhitespace);
		const tokens = headerKey[header];
		if (!tokens) {
			throw new PyXFormError(
				`Invalid headers provided for sheet: '${sheetName}'. For XLSForms, this may be due a missing header row, in which case add a header row as per the reference template https://xlsform.org/en/ref-table/. For internal API usage, may be due to a missing mapping for '${header}', in which case ensure that the full set of headers appear within the first 100 rows, or specify the header row in '${sheetName}_header'.`,
			);
		}
		if (tokens.length === 1) {
			outRow[tokens[0]] = val;
		} else {
			const newValue = listToNestedDict([...tokens.slice(1), val]);
			outRow = mergeDictsWithLang(
				outRow,
				{ [tokens[0]]: newValue },
				defaultLanguage,
			);
		}
	}
	if (addRowNumber) {
		outRow.__row = rowNumber;
	}
	return outRow;
}

/** Check if a value is a non-null, non-array object (i.e. a plain dict). */
function isPlainObject(val: unknown): val is Record<string, unknown> {
	return typeof val === "object" && val !== null && !Array.isArray(val);
}

/**
 * Merge dicts recursively with language-aware merging (matching Python merge_dicts).
 */
function mergeDictsWithLang(
	a: Record<string, unknown>,
	b: Record<string, unknown>,
	defaultLanguage: string,
): Record<string, unknown> {
	const result = { ...a };
	for (const [key, value] of Object.entries(b)) {
		const existing = result[key];
		if (key in result && isPlainObject(existing) && isPlainObject(value)) {
			result[key] = mergeDictsWithLang(existing, value, defaultLanguage);
		} else if (
			key in result &&
			typeof existing === "string" &&
			isPlainObject(value)
		) {
			result[key] = mergeDictsWithLang(
				{ [defaultLanguage]: existing },
				value,
				defaultLanguage,
			);
		} else if (
			key in result &&
			isPlainObject(existing) &&
			typeof value === "string"
		) {
			result[key] = { ...existing, [defaultLanguage]: value };
		} else {
			result[key] = value;
		}
	}
	return result;
}

interface DealiasAndGroupHeadersResult {
	headers: string[][];
	data: Record<string, unknown>[];
}

/** Guess headers from the first 100 rows of sheet data. */
function guessHeaders(
	sheetData: Record<string, string>[],
): Record<string, unknown>[] | null {
	if (sheetData.length === 0) {
		return null;
	}
	const guessed: Record<string, unknown> = {};
	for (const row of sheetData.slice(0, 100)) {
		for (const k of Object.keys(row)) {
			guessed[k] = null;
		}
	}
	return [guessed];
}

/** Build header-to-tokens mapping, detecting duplicate headers. */
function buildHeaderKeyMap(
	sheetName: string,
	resolvedHeader: Record<string, unknown>[],
	headerAliases: Record<string, string | string[]>,
	headerColumns: Set<string>,
): { headerKey: Record<string, string[]>; tokensKey: Map<string, string> } {
	const headerKey: Record<string, string[]> = {};
	const tokensKey: Map<string, string> = new Map();

	const useDoubleColon = Object.keys(resolvedHeader[0]).some((k) =>
		k.includes("::"),
	);

	for (const header of Object.keys(resolvedHeader[0])) {
		if (header in headerKey) {
			continue;
		}
		const [newHeader, tokens] = processHeaderFull(
			header,
			useDoubleColon,
			headerAliases,
			headerColumns,
		);
		const tokensStr = JSON.stringify(tokens);
		const otherHeader = tokensKey.get(tokensStr);
		const newHeaderStr =
			typeof newHeader === "string" ? newHeader : JSON.stringify(newHeader);
		if (otherHeader && newHeaderStr !== header) {
			throw new PyXFormError(
				`Invalid headers provided for sheet: '${sheetName}'. Headers that are different names for the same column were found: '${otherHeader}', '${header}'. Rename or remove one of these columns.`,
			);
		}
		headerKey[header] = tokens;
		tokensKey.set(tokensStr, header);
	}

	return { headerKey, tokensKey };
}

/** Validate that all required headers are present. */
function validateRequiredHeaders(
	sheetName: string,
	headersRequired: Set<string>,
	headerKey: Record<string, string[]>,
	tokensKey: Map<string, string>,
): void {
	const allFirstTokens = new Set(
		[...tokensKey.values()].map((h) => headerKey[h]?.[0]).filter(Boolean),
	);
	const missing = [...headersRequired].filter((h) => !allFirstTokens.has(h));
	if (missing.length > 0) {
		throw new PyXFormError(
			`Invalid headers provided for sheet: '${sheetName}'. One or more required column headers were not found: ${missing.map((h) => `'${h}'`).join(", ")}. Learn more: https://xlsform.org/en/#setting-up-your-worksheets`,
		);
	}
}

/**
 * Python-compatible dealias_and_group_headers: process a whole sheet's headers and data.
 */
export function dealiasAndGroupSheet(
	sheetName: string,
	sheetData: Record<string, string>[],
	sheetHeader: Record<string, unknown>[] | null,
	headerAliases: Record<string, string | string[]>,
	headerColumns: Set<string>,
	headersRequired?: Set<string>,
	defaultLanguage: string = constants.DEFAULT_LANGUAGE_VALUE,
	stripWhitespace = false,
	addRowNumber = false,
): DealiasAndGroupHeadersResult {
	let resolvedHeader = sheetHeader;
	if (!resolvedHeader || resolvedHeader.length === 0) {
		resolvedHeader = guessHeaders(sheetData);
	}

	let headerKey: Record<string, string[]> = {};
	let tokensKey: Map<string, string> = new Map();

	if (resolvedHeader && resolvedHeader.length > 0) {
		const mapped = buildHeaderKeyMap(
			sheetName,
			resolvedHeader,
			headerAliases,
			headerColumns,
		);
		headerKey = mapped.headerKey;
		tokensKey = mapped.tokensKey;
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
		validateRequiredHeaders(sheetName, headersRequired, headerKey, tokensKey);
	}

	const headers = [...tokensKey.keys()].map((k) => JSON.parse(k) as string[]);

	return { headers, data };
}

interface DealiasedRow {
	[key: string]: unknown;
}

/** Handle media columns like media::audio or media::audio::English. */
function handleMediaColumn(
	result: Record<string, unknown>,
	mediaParts: string[],
	value: unknown,
): void {
	const mediaType = mediaParts[1];
	if (!result.media) {
		result.media = {};
	}
	const media = result.media as Record<string, unknown>;
	if (mediaParts.length === 3) {
		if (!isPlainObject(media[mediaType])) {
			media[mediaType] = {};
		}
		(media[mediaType] as Record<string, unknown>)[mediaParts[2]] = value;
	} else {
		media[mediaType] = value;
	}
}

/** Handle a nested alias (tuple) with language, e.g. ["bind", "jr:constraintMsg"]. */
function handleNestedAliasWithLang(
	result: Record<string, unknown>,
	alias: [string, string],
	lang: string,
	value: unknown,
): void {
	if (!result[alias[0]]) {
		result[alias[0]] = {};
	}
	const outer = result[alias[0]];
	if (!isPlainObject(outer)) {
		return;
	}
	if (!outer[alias[1]]) {
		outer[alias[1]] = {};
	}
	const inner = outer[alias[1]];
	if (isPlainObject(inner)) {
		inner[lang] = value;
	}
}

/** Set a value in a translation dict, converting strings to dicts as needed. */
function setTranslationValue(
	result: Record<string, unknown>,
	targetKey: string,
	lang: string,
	value: unknown,
	defaultLanguage: string,
): void {
	if (!result[targetKey]) {
		result[targetKey] = {};
	} else if (typeof result[targetKey] === "string") {
		result[targetKey] = { [defaultLanguage]: result[targetKey] };
	}
	if (isPlainObject(result[targetKey])) {
		(result[targetKey] as Record<string, unknown>)[lang] = value;
	}
}

/** Resolve a translation column header and apply the value to the result. */
function handleTranslationColumn(
	result: Record<string, unknown>,
	langMatch: RegExpMatchArray,
	headerAliases: Record<string, string | [string, string]>,
	value: unknown,
	defaultLanguage: string,
): boolean {
	const baseColRaw = langMatch[1].trim();
	const baseColNorm = toSnakeCase(baseColRaw);
	const lang = langMatch[2].trim();
	const alias = headerAliases[baseColNorm] ?? headerAliases[baseColRaw];

	if (Array.isArray(alias)) {
		handleNestedAliasWithLang(result, alias as [string, string], lang, value);
		return true;
	}

	const targetKey = alias && typeof alias === "string" ? alias : baseColNorm;
	setTranslationValue(result, targetKey, lang, value, defaultLanguage);
	return true;
}

/** Match a translation header like "label::English" or "hint:French". */
function matchTranslationHeader(
	header: string,
	useDoubleColon: boolean,
): RegExpMatchArray | null {
	const delimPattern = useDoubleColon
		? /^(.+?)(?:\s*)::\s*(.+)$/
		: /^(.+?)(?:\s*):\s*(.+)$/;
	const langMatch = header.match(delimPattern);
	if (!langMatch) {
		return null;
	}
	// When using single colon, skip known colon-containing names like jr:constraintMsg
	if (!useDoubleColon && langMatch[1].trim() === "jr") {
		return null;
	}
	return langMatch;
}

/** Determine if a header is a media column. */
function isMediaHeader(mediaParts: string[]): boolean {
	return mediaParts.length >= 2 && mediaParts[0].toLowerCase() === "media";
}

/** Assign a value at a given path within the result dict. */
function assignAtPath(
	result: Record<string, unknown>,
	path: string[],
	value: unknown,
	defaultLanguage: string,
): void {
	if (path.length === 1) {
		if (isPlainObject(result[path[0]])) {
			(result[path[0]] as Record<string, unknown>)[defaultLanguage] = value;
		} else {
			result[path[0]] = value;
		}
	} else if (path.length === 2) {
		if (!result[path[0]]) {
			result[path[0]] = {};
		}
		if (isPlainObject(result[path[0]])) {
			(result[path[0]] as Record<string, unknown>)[path[1]] = value;
		}
	}
}

/**
 * Process a single row of data, dealiasing headers and grouping nested values.
 */
export function dealiasAndGroupHeaders(
	row: Record<string, unknown>,
	headerAliases: Record<string, string | [string, string]>,
	_isChoicesSheet = false,
	defaultLanguage = "default",
	stripWhitespace = false,
): DealiasedRow {
	const result: Record<string, unknown> = {};

	// Determine delimiter: if any header uses "::", use "::" for all; otherwise use ":"
	const headers = Object.keys(row);
	const useDoubleColon = headers.some((h) => h.includes("::"));

	for (const [header, rawValue] of Object.entries(row)) {
		if (rawValue == null || rawValue === "") {
			continue;
		}

		const value = cleanTextValues(rawValue, stripWhitespace);
		if (value === "" || value == null) {
			continue;
		}

		// Handle media columns: media::audio, media::audio::English
		const mediaParts = header.split("::").map((p) => p.trim());
		if (isMediaHeader(mediaParts)) {
			handleMediaColumn(result, mediaParts, value);
			continue;
		}

		// Handle translation columns like "label::English", "hint::French"
		const langMatch = matchTranslationHeader(header, useDoubleColon);
		if (langMatch) {
			handleTranslationColumn(
				result,
				langMatch,
				headerAliases,
				value,
				defaultLanguage,
			);
			continue;
		}

		const { path } = processHeader(header, headerAliases);
		assignAtPath(result, path, value, defaultLanguage);
	}

	return result;
}

// --- Sheet-level utility functions ---

/**
 * Extract all unique header names from an array of row objects.
 */
export function extractHeaders(rows: FormRecord[]): string[] {
	const headers = new Set<string>();
	for (const row of rows) {
		for (const key of Object.keys(row)) {
			headers.add(key);
		}
	}
	return [...headers];
}

// --- Levenshtein distance for sheet name misspelling detection ---

export function levenshteinDistance(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	const v1 = new Array(n + 1).fill(0);
	const v0 = Array.from({ length: n + 1 }, (_, i) => i);
	for (let i = 0; i < m; i++) {
		v1[0] = i + 1;
		for (let j = 0; j < n; j++) {
			const deletionCost = v0[j + 1] + 1;
			const insertionCost = v1[j] + 1;
			const substitutionCost = a[i] === b[j] ? v0[j] : v0[j] + 1;
			v1[j + 1] = Math.min(deletionCost, insertionCost, substitutionCost);
		}
		for (let j = 0; j <= n; j++) {
			v0[j] = v1[j];
		}
	}
	return v0[n];
}

/**
 * Find possible sheet name misspellings.
 * Returns a message fragment if similar names are found, or null otherwise.
 */
export function findSheetMisspellings(
	key: string,
	sheetNames: string[],
): string | null {
	if (!sheetNames || sheetNames.length === 0) {
		return null;
	}
	const candidates = sheetNames.filter(
		(k) =>
			levenshteinDistance(k.toLowerCase(), key) <= 2 &&
			!constants.SUPPORTED_SHEET_NAMES.has(k.toLowerCase()) &&
			!k.startsWith("_"),
	);
	if (candidates.length > 0) {
		const candidateStr = candidates.map((c) => `'${c}'`).join(", ");
		return `When looking for a sheet named '${key}', the following sheets with similar names were found: ${candidateStr}.`;
	}
	return null;
}
