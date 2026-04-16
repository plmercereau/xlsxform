/**
 * Convert workbook data (from XLS/XLSX/MD) to the JSON intermediate format
 * that the builder uses to construct Survey objects.
 */

import * as aliases from "./aliases.js";
import * as constants from "./constants.js";

/**
 * A permissive value type for XLSForm row data and question dictionaries.
 *
 * XLSForm data is inherently dynamic: rows from spreadsheet sheets are
 * transformed into nested structures (translated labels, bind objects,
 * control attributes, children arrays, etc.). This type uses an interface
 * with a self-referencing index signature to allow arbitrary nested
 * property access without explicit casts.
 */
interface FormRecord {
	[key: string]: unknown;
}

import {
	ContainerPath,
	applyEntitiesDeclarations,
	getEntityDeclarations,
	getEntityVariableReferences,
	processEntityReferencesForQuestion,
	validateEntityLabelReferences,
} from "./entities.js";
import { PyXFormError } from "./errors.js";
import { isPyxformReference, isXmlTag } from "./parsing/expression.js";
import {
	cleanTextValues,
	dealiasAndGroupHeaders,
} from "./parsing/sheet-headers.js";
import { getMetaGroup } from "./question-type-dictionary.js";
import { defaultIsDynamic } from "./question.js";
import type { DefinitionData } from "./xls2json-backends.js";

// --- Translation completeness checking ---

/**
 * Detect all languages used in sheet headers and find missing translations.
 * Mirrors Python pyxform's SheetTranslations / Translations classes.
 */
class TranslationChecker {
	seen: Record<string, string[]> = {};
	columnsSeen: Set<string> = new Set();
	missing: Record<string, string[]> = {};

	constructor(
		headers: string[],
		translatableColumns: Record<string, string | [string, string]>,
	) {
		this._findTranslations(headers, translatableColumns);
		this._findMissing();
	}

	private _findTranslations(
		headers: string[],
		translatableColumns: Record<string, string | [string, string]>,
	) {
		// Detect delimiter: if any header uses "::", use "::"; otherwise use ":"
		const useDoubleColon = headers.some((h) => h.includes("::"));
		const delimiter = useDoubleColon ? "::" : ":";
		for (const header of headers) {
			// Split on delimiter
			let parts = header.split(delimiter).map((p) => p.trim());
			// When using single colon, handle "jr:" prefixed names
			if (
				!useDoubleColon &&
				parts.length >= 2 &&
				parts[0].toLowerCase() === "jr"
			) {
				parts = [`jr:${parts[1]}`, ...parts.slice(2)];
			}

			let tokens: string[];
			// Handle media:: prefix: media::audio, media::audio::English
			if (parts.length >= 2 && parts[0].toLowerCase() === "media") {
				tokens = parts.slice(1);
			} else if (parts.length >= 2 && parts[0].toLowerCase() === "bind") {
				tokens = parts.slice(1);
			} else {
				tokens = parts;
			}

			if (tokens.length === 0) continue;

			const colName = tokens[0].toLowerCase();
			// Check if this is a translatable column
			if (colName in translatableColumns) {
				let name: string;
				const mapped = translatableColumns[colName];
				if (Array.isArray(mapped)) {
					name = colName;
				} else {
					name = mapped;
				}

				const lang =
					tokens.length >= 2 ? tokens[1] : constants.DEFAULT_LANGUAGE_VALUE;

				if (!this.seen[lang]) this.seen[lang] = [];
				if (!this.seen[lang].includes(name)) {
					this.seen[lang].push(name);
				}
				this.columnsSeen.add(name);
			}
		}
	}

	seenDefaultOnly(): boolean {
		const langs = Object.keys(this.seen);
		return (
			langs.length === 0 ||
			(langs.length === 1 && constants.DEFAULT_LANGUAGE_VALUE in this.seen)
		);
	}

	private _findMissing() {
		if (this.seenDefaultOnly()) return;
		for (const lang of Object.keys(this.seen)) {
			const langTrans = this.seen[lang];
			for (const seenTran of this.columnsSeen) {
				if (!langTrans.includes(seenTran)) {
					if (!this.missing[lang]) this.missing[lang] = [];
					this.missing[lang].push(seenTran);
				}
			}
		}
	}
}

function formatMissingTranslationsMsg(
	_in: Record<string, Record<string, string[]>>,
): string | null {
	function getSheetMsg(
		name: string,
		sheet?: Record<string, string[]>,
	): string | null {
		if (!sheet) return null;
		const langs = Object.keys(sheet).sort();
		if (langs.length === 0) return null;
		const langMsgs: string[] = [];
		for (const lang of langs) {
			const cols = sheet[lang];
			if (cols.length === 1) {
				langMsgs.push(
					`Language '${lang}' is missing the ${name} ${cols[0]} column.`,
				);
			}
			if (cols.length > 1) {
				const c = [...cols].sort().join(", ");
				langMsgs.push(
					`Language '${lang}' is missing the ${name} columns ${c}.`,
				);
			}
		}
		return langMsgs.join("\n");
	}

	const survey = getSheetMsg(constants.SURVEY, _in[constants.SURVEY]);
	const choices = getSheetMsg(constants.CHOICES, _in[constants.CHOICES]);
	const messages = [survey, choices].filter((m): m is string => m !== null);
	if (messages.length === 0) return null;
	return messages.join("\n");
}

const OR_OTHER_WARNING =
	"This form uses or_other and translations, which is not recommended. " +
	"An untranslated input question label and choice label is generated " +
	"for 'other'. Learn more: https://xlsform.org/en/#specify-other).";

/**
 * Extract all unique header names from an array of row objects.
 */
function extractHeaders(rows: FormRecord[]): string[] {
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
function findSheetMisspellings(
	key: string,
	sheetNames: string[],
): string | null {
	if (!sheetNames || sheetNames.length === 0) return null;
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

// --- Pyxform reference utilities ---

const PYXFORM_REF_RE = /\$\{([^}]*)\}/g;
// Valid reference name: NCName pattern (no whitespace, starts with letter/underscore, with optional last-saved# prefix)
const VALID_REF_NAME_RE = /^(?:last-saved#)?[a-zA-Z_][a-zA-Z0-9._-]*$/;

/**
 * Validate pyxform reference syntax in a string. Returns error message or null.
 */
function validatePyxformReferenceSyntax(
	value: string,
	rowNum: number,
	sheet: string,
	column: string,
): string | null {
	// Check for unclosed references: ${ without matching }
	let pos = 0;
	while (pos < value.length) {
		const idx = value.indexOf("${", pos);
		if (idx === -1) break;
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
function extractPyxformReferences(value: string): string[] {
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
function hasPyxformReference(value: string): boolean {
	return /\$\{/.test(value);
}

// --- Android package name validation ---

// --- Audit parameter validation ---

const AUDIT_LOCATION_PARAMS = new Set([
	constants.LOCATION_PRIORITY,
	constants.LOCATION_MIN_INTERVAL,
	constants.LOCATION_MAX_AGE,
]);

const LOCATION_PRIORITY_VALUES = new Set([
	"no-power",
	"low-power",
	"balanced",
	"high-accuracy",
]);

function validateAuditParams(
	params: Record<string, string>,
	name: string,
	questionDict: FormRecord,
): void {
	// Check name
	if (name !== "audit") {
		throw new PyXFormError("Audits must always be named 'audit.'");
	}

	if (!params || Object.keys(params).length === 0) return;

	// Validate track-changes
	if (constants.TRACK_CHANGES in params) {
		const val = params[constants.TRACK_CHANGES];
		if (val !== "true" && val !== "false") {
			throw new PyXFormError("track-changes must be set to true or false");
		}
	}

	// Validate identify-user
	if (constants.IDENTIFY_USER in params) {
		const val = params[constants.IDENTIFY_USER];
		if (val !== "true" && val !== "false") {
			throw new PyXFormError("identify-user must be set to true or false");
		}
	}

	// Validate track-changes-reasons
	if (constants.TRACK_CHANGES_REASONS in params) {
		const val = params[constants.TRACK_CHANGES_REASONS];
		if (val !== "on-form-edit") {
			throw new PyXFormError(
				"track-changes-reasons must be set to on-form-edit",
			);
		}
	}

	// Check if any location params are set
	const hasLocationParams = [...AUDIT_LOCATION_PARAMS].some((p) => p in params);

	if (hasLocationParams) {
		// All three must be present
		const missingLocation = [...AUDIT_LOCATION_PARAMS].filter(
			(p) => !(p in params),
		);
		if (missingLocation.length > 0) {
			throw new PyXFormError(
				"'location-priority', 'location-min-interval', and 'location-max-age' are required parameters",
			);
		}

		// Validate location-priority value
		const priority = params[constants.LOCATION_PRIORITY];
		if (!LOCATION_PRIORITY_VALUES.has(priority)) {
			throw new PyXFormError(
				"location-priority must be set to no-power, low-power, balanced, or high-accuracy",
			);
		}

		// Validate location-min-interval is positive
		const minInterval = Number(params[constants.LOCATION_MIN_INTERVAL]);
		if (minInterval < 0) {
			throw new PyXFormError(
				"location-min-interval must be greater than or equal to zero",
			);
		}

		// Validate location-max-age >= location-min-interval
		const maxAge = Number(params[constants.LOCATION_MAX_AGE]);
		if (maxAge < minInterval) {
			throw new PyXFormError(
				"location-max-age must be greater than or equal to location-min-interval",
			);
		}
	}

	// Add audit params to bind as odk: attributes
	if (!questionDict[constants.BIND]) {
		questionDict[constants.BIND] = {};
	}
	const bindDict = questionDict[constants.BIND] as FormRecord;
	for (const [k, v] of Object.entries(params)) {
		bindDict[`odk:${k}`] = v;
	}
}

// --- Geopoint/Geoshape/Geotrace parameter validation ---

const GEO_TYPES = new Set(["geopoint", "geoshape", "geotrace"]);

function validateGeoParams(
	params: Record<string, string>,
	type: string,
	questionDict: FormRecord,
	rowNum?: number,
): void {
	if (!params || Object.keys(params).length === 0) return;

	for (const [k, v] of Object.entries(params)) {
		if (k === "allow-mock-accuracy") {
			if (v !== "true" && v !== "false") {
				throw new PyXFormError("Invalid value for allow-mock-accuracy.");
			}
			// Add to bind
			if (!questionDict[constants.BIND]) {
				questionDict[constants.BIND] = {};
			}
			(questionDict[constants.BIND] as FormRecord)[`odk:${k}`] = v;
		} else if (k === "capture-accuracy") {
			// Only valid for geopoint
			if (type !== "geopoint") {
				throw new PyXFormError(
					`The question type '${type}' has invalid parameter(s): '${k}'.`,
				);
			}
			if (v === "" || Number.isNaN(Number(v))) {
				throw new PyXFormError(
					"Parameter capture-accuracy must have a numeric value.",
				);
			}
			// Add as control attribute
			if (!questionDict[constants.CONTROL]) {
				questionDict[constants.CONTROL] = {};
			}
			(questionDict[constants.CONTROL] as FormRecord).accuracyThreshold = v;
		} else if (k === "warning-accuracy") {
			// Only valid for geopoint
			if (type !== "geopoint") {
				throw new PyXFormError(
					`The question type '${type}' has invalid parameter(s): '${k}'.`,
				);
			}
			if (v === "" || Number.isNaN(Number(v))) {
				throw new PyXFormError(
					"Parameter warning-accuracy must have a numeric value.",
				);
			}
			// Add as control attribute
			if (!questionDict[constants.CONTROL]) {
				questionDict[constants.CONTROL] = {};
			}
			(
				questionDict[constants.CONTROL] as FormRecord
			).unacceptableAccuracyThreshold = v;
		} else if (k === "incremental") {
			// Handled elsewhere for geoshape/geotrace; invalid for other geo types
			if (type !== "geoshape" && type !== "geotrace") {
				throw new PyXFormError(
					`The following are invalid parameter(s): '${k}'.`,
				);
			}
		} else {
			throw new PyXFormError(`The following are invalid parameter(s): '${k}'.`);
		}
	}
}

// --- Audio quality parameter validation ---

const VALID_AUDIO_QUALITIES = new Set([
	constants.AUDIO_QUALITY_VOICE_ONLY,
	constants.AUDIO_QUALITY_LOW,
	constants.AUDIO_QUALITY_NORMAL,
	constants.AUDIO_QUALITY_EXTERNAL,
]);

const VALID_BACKGROUND_AUDIO_QUALITIES = new Set([
	constants.AUDIO_QUALITY_VOICE_ONLY,
	constants.AUDIO_QUALITY_LOW,
	constants.AUDIO_QUALITY_NORMAL,
]);

function validateAudioParams(
	params: Record<string, string>,
	questionDict: FormRecord,
	isBackground = false,
): void {
	if (!params || Object.keys(params).length === 0) return;

	const allowedAudioParams = new Set(["quality"]);
	const invalidParams = Object.keys(params).filter(
		(k) => !allowedAudioParams.has(k),
	);
	if (invalidParams.length > 0) {
		throw new PyXFormError(
			`The following are invalid parameter(s): '${invalidParams.join("', '")}'.`,
		);
	}

	if ("quality" in params) {
		const val = params.quality;
		const validSet = isBackground
			? VALID_BACKGROUND_AUDIO_QUALITIES
			: VALID_AUDIO_QUALITIES;
		if (!validSet.has(val)) {
			throw new PyXFormError("Invalid value for quality.");
		}
		// Add to bind as odk:quality
		if (!questionDict[constants.BIND]) {
			questionDict[constants.BIND] = {};
		}
		(questionDict[constants.BIND] as FormRecord)["odk:quality"] = val;
	}
}

// --- Range parameter validation ---

const VALID_RANGE_PARAMS = new Set([
	"start",
	"end",
	"step",
	"tick_interval",
	"placeholder",
	"tick_labelset",
]);

const RANGE_TICKS_APPEARANCES = new Set(["", "vertical", "no-ticks"]);

const PACKAGE_NAME_REGEX = /[^a-zA-Z0-9._]/;

function validateAndroidPackageName(name: string): string | null {
	const prefix = "Parameter 'app' has an invalid Android package name - ";
	if (!name.trim()) {
		return `${prefix}package name is missing.`;
	}
	if (!name.includes(".")) {
		return `${prefix}the package name must have at least one '.' separator.`;
	}
	if (name.endsWith(".")) {
		return `${prefix}the package name cannot end in a '.' separator.`;
	}
	const segments = name.split(".");
	if (segments.some((s) => s === "")) {
		return `${prefix}package segments must be of non-zero length.`;
	}
	if (PACKAGE_NAME_REGEX.test(name)) {
		return `${prefix}the package name can only include letters (a-z, A-Z), numbers (0-9), dots (.), and underscores (_).`;
	}
	for (const segment of segments) {
		if (segment[0] === "_") {
			return `${prefix}the character '_' cannot be the first character in a package name segment.`;
		}
		if (/^\d/.test(segment)) {
			return `${prefix}a digit cannot be the first character in a package name segment.`;
		}
	}
	return null;
}

function validateRangeParams(
	params: Record<string, string>,
	questionDict: FormRecord,
	rowNum: number,
	choices: Record<string, FormRecord[]>,
	settings: FormRecord,
): void {
	if (!params) return;

	// Normalize parameter keys to lowercase
	const normalizedParams: Record<string, string> = {};
	for (const [k, v] of Object.entries(params)) {
		normalizedParams[k.toLowerCase()] = v;
	}

	// Check for unknown parameters
	const unknownParams = Object.keys(normalizedParams).filter(
		(k) => !VALID_RANGE_PARAMS.has(k),
	);
	if (unknownParams.length > 0) {
		throw new PyXFormError(
			`[row : ${rowNum}] On the 'survey' sheet, the 'parameters' value is invalid. Accepted parameters are 'end, placeholder, start, step, tick_interval, tick_labelset'. The following are invalid parameter(s): '${unknownParams.join("', '")}'.`,
		);
	}

	// Get values with defaults
	const start = normalizedParams.start ?? "1";
	const end = normalizedParams.end ?? "10";
	const step = normalizedParams.step ?? "1";

	// Validate numeric params
	const numericParams = [
		"start",
		"end",
		"step",
		"tick_interval",
		"placeholder",
	];
	for (const paramName of numericParams) {
		if (paramName in normalizedParams) {
			const val = normalizedParams[paramName];
			if (val === "" || Number.isNaN(Number(val))) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter '${paramName}' must be a number.`,
				);
			}
		}
	}

	const startNum = Number(start);
	const endNum = Number(end);
	const stepNum = Number(step);
	const rangeSize = Math.abs(endNum - startNum);

	// Appearance-restricted parameters (check early, before detailed validation)
	const appearance = (
		(questionDict[constants.CONTROL] as FormRecord | undefined)?.appearance ??
		""
	)
		.toString()
		.trim();
	const hasTicksParams =
		"tick_interval" in normalizedParams ||
		"placeholder" in normalizedParams ||
		"tick_labelset" in normalizedParams;
	if (hasTicksParams && !RANGE_TICKS_APPEARANCES.has(appearance)) {
		throw new PyXFormError(
			`[row : ${rowNum}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameters 'tick_interval', 'placeholder', and 'tick_labelset' are only supported for the appearances 'vertical', 'no-ticks' and the default (empty) horizontal.`,
		);
	}

	// step and tick_interval must not be zero
	for (const paramName of ["step", "tick_interval"]) {
		if (paramName in normalizedParams) {
			const val = Number(normalizedParams[paramName]);
			if (val === 0) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter '${paramName}' must not be '0' (zero).`,
				);
			}
		}
	}

	// step and tick_interval must not be larger than range
	for (const paramName of ["step", "tick_interval"]) {
		if (paramName in normalizedParams) {
			const val = Math.abs(Number(normalizedParams[paramName]));
			if (val > rangeSize) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter '${paramName}' must not be larger than the range (the difference between 'start' and 'end').`,
				);
			}
		}
	}

	// tick_interval must be a multiple of step
	if ("tick_interval" in normalizedParams) {
		const tickInterval = Math.abs(Number(normalizedParams.tick_interval));
		const absStep = Math.abs(stepNum);
		if (absStep > 0 && !isMultiple(tickInterval, absStep)) {
			throw new PyXFormError(
				`[row : ${rowNum}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter 'tick_interval' must be a multiple of 'step'.`,
			);
		}
	}

	// placeholder must be a multiple of step starting at start
	if ("placeholder" in normalizedParams) {
		const placeholderVal = Number(normalizedParams.placeholder);
		const absStep = Math.abs(stepNum);

		// Check placeholder is a multiple of step relative to start
		if (
			absStep > 0 &&
			!isMultiple(Math.abs(placeholderVal - startNum), absStep)
		) {
			throw new PyXFormError(
				`[row : ${rowNum}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter 'placeholder' must be a multiple of 'step'.`,
			);
		}

		// Check placeholder is within range
		const rangeMin = Math.min(startNum, endNum);
		const rangeMax = Math.max(startNum, endNum);
		if (placeholderVal < rangeMin || placeholderVal > rangeMax) {
			throw new PyXFormError(
				`[row : ${rowNum}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter 'placeholder' must be between the 'start' and 'end' values, inclusive).`,
			);
		}
	}

	// tick_labelset validation
	if ("tick_labelset" in normalizedParams) {
		const listName = normalizedParams.tick_labelset;
		const choiceList = choices[listName];
		if (!choiceList || choiceList.length === 0) {
			throw new PyXFormError(
				`[row : ${rowNum}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter 'tick_labelset' must be a choice list name from the 'list_name' column on the choices sheet.`,
			);
		}

		// Validate choice names are present
		for (let i = 0; i < choiceList.length; i++) {
			const choice = choiceList[i];
			const choiceName = (choice[constants.NAME] ?? "").toString().trim();
			if (!choiceName) {
				const choiceRowNum = i + 2; // 1-based, after header
				throw new PyXFormError(
					`[row : ${choiceRowNum}] On the 'choices' sheet, the 'name' value is invalid. Choices must have a name. Learn more: https://xlsform.org/en/#setting-up-your-worksheets`,
				);
			}
		}

		// Validate choice name uniqueness
		const allowDuplicates = settings[constants.ALLOW_CHOICE_DUPLICATES];
		const isDuplicatesAllowed =
			allowDuplicates === "yes" ||
			allowDuplicates === "Yes" ||
			allowDuplicates === "YES" ||
			allowDuplicates === true;
		if (!isDuplicatesAllowed) {
			const seenNames = new Map<string, number>();
			for (let i = 0; i < choiceList.length; i++) {
				const choice = choiceList[i];
				const choiceName = (choice[constants.NAME] ?? "").toString().trim();
				if (seenNames.has(choiceName)) {
					const choiceRowNum = i + 2;
					throw new PyXFormError(
						`[row : ${choiceRowNum}] On the 'choices' sheet, the 'name' value is invalid. Choice names must be unique for each choice list. If this is intentional, use the setting 'allow_choice_duplicates'. Learn more: https://xlsform.org/#choice-names.`,
					);
				}
				seenNames.set(choiceName, i);
			}
		}

		// Validate choice names are numeric
		for (let i = 0; i < choiceList.length; i++) {
			const choice = choiceList[i];
			const choiceName = (choice[constants.NAME] ?? "").toString().trim();
			if (!choiceName) continue;
			const num = Number(choiceName);
			if (Number.isNaN(num) || !Number.isFinite(num)) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter 'tick_labelset' choice list values may only`,
				);
			}
		}

		// Validate choices are within range
		const rangeMin = Math.min(startNum, endNum);
		const rangeMax = Math.max(startNum, endNum);
		for (let i = 0; i < choiceList.length; i++) {
			const choice = choiceList[i];
			const choiceName = (choice[constants.NAME] ?? "").toString().trim();
			if (!choiceName) continue;
			const val = Number(choiceName);
			if (val < rangeMin || val > rangeMax) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter 'tick_labelset' choices must be between the 'start' and 'end' values, inclusive.`,
				);
			}
		}

		// Validate choices are multiples of step from start
		const absStep = Math.abs(stepNum);
		const tickIntervalVal =
			"tick_interval" in normalizedParams
				? Math.abs(Number(normalizedParams.tick_interval))
				: null;

		// Use tick_interval if available, otherwise step
		const tickStep = tickIntervalVal ?? absStep;
		if (tickStep > 0) {
			for (let i = 0; i < choiceList.length; i++) {
				const choice = choiceList[i];
				const choiceName = (choice[constants.NAME] ?? "").toString().trim();
				if (!choiceName) continue;
				const val = Number(choiceName);
				if (!isMultiple(Math.abs(val - startNum), tickStep)) {
					const stepName = tickIntervalVal != null ? "tick_interval" : "step";
					throw new PyXFormError(
						`[row : ${rowNum}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter 'tick_labelset' choices' values must be equal to the start of the range plus a multiple of '${stepName}'.`,
					);
				}
			}
		}

		// no-ticks: only 2 items allowed, and they must be start and end
		if (appearance === "no-ticks") {
			const uniqueChoices = new Set(
				choiceList.map((c) => (c[constants.NAME] ?? "").toString().trim()),
			);
			if (uniqueChoices.size > 2) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter 'tick_labelset' choice list must have only 2 items when the 'appearance' is 'no-ticks'.`,
				);
			}
			// 2 choices must be start and end
			if (uniqueChoices.size === 2) {
				const startStr = String(startNum);
				const endStr = String(endNum);
				if (!uniqueChoices.has(startStr) || !uniqueChoices.has(endStr)) {
					throw new PyXFormError(
						`[row : ${rowNum}] On the 'survey' sheet, the 'parameters' value is invalid. For the 'range' question type, the parameter 'tick_labelset' choice list values may only`,
					);
				}
			}
		}
	}

	// Replace params with normalized and update questionDict
	questionDict[constants.PARAMETERS] = normalizedParams;

	// Detect decimal values and switch bind type to decimal if needed
	const hasDecimalValue = Object.entries(normalizedParams).some(([k, v]) => {
		if (k === "tick_labelset") return false;
		const num = Number(v);
		return !Number.isNaN(num) && v.includes(".");
	});
	if (hasDecimalValue) {
		if (!questionDict[constants.BIND]) {
			questionDict[constants.BIND] = {};
		}
		(questionDict[constants.BIND] as FormRecord).type = "decimal";
	}
}

function isMultiple(value: number, divisor: number): boolean {
	if (divisor === 0) return true;
	// Use a small epsilon for floating point comparison
	const ratio = value / divisor;
	return Math.abs(ratio - Math.round(ratio)) < 1e-9;
}

// --- Choices sheet validation ---

function validateChoices(
	choicesByListName: Record<string, FormRecord[]>,
	settings: FormRecord,
	warnings: string[],
	choicesData: FormRecord[],
): void {
	const allowDuplicates = settings[constants.ALLOW_CHOICE_DUPLICATES];
	const isDuplicatesAllowed =
		allowDuplicates === "yes" ||
		allowDuplicates === "Yes" ||
		allowDuplicates === "YES" ||
		allowDuplicates === true;

	// Track running row number. Choices data rows start at row 2 (1-based, after header).
	let rowNum = 1;
	const listNameRowMap: Record<string, Map<string, number>> = {};
	const duplicateErrors: string[] = [];

	for (const row of choicesData) {
		rowNum++;
		const listName = row[constants.LIST_NAME_S] ?? row[constants.LIST_NAME_U];
		if (!listName) continue;

		const choiceName = (row[constants.NAME] ?? row.value ?? "")
			.toString()
			.trim();
		const label = row[constants.LABEL] ?? row.label;

		// Check if there are translated labels (label::lang)
		const hasTranslatedLabel = Object.keys(row).some(
			(k) => k.startsWith("label::") || k.startsWith("label :"),
		);

		// Check if there is any media (image, audio, video, or translated variants)
		const hasMedia = Object.keys(row).some((k) => {
			const kl = k.toLowerCase();
			return (
				(kl === "image" ||
					kl === "audio" ||
					kl === "video" ||
					kl.startsWith("image::") ||
					kl.startsWith("audio::") ||
					kl.startsWith("video::") ||
					kl.startsWith("image :") ||
					kl.startsWith("audio :") ||
					kl.startsWith("video :") ||
					kl === "media::image" ||
					kl === "media::audio" ||
					kl === "media::video") &&
				row[k] &&
				(typeof row[k] !== "string" || row[k].trim())
			);
		});

		// Warn about missing labels (only if no translated labels)
		if (
			!hasTranslatedLabel &&
			(!label || (typeof label === "string" && !label.trim()))
		) {
			warnings.push(
				`[row : ${rowNum}] On the 'choices' sheet, the 'label' value is invalid. Choices should have a label. Learn more: https://xlsform.org/en/#setting-up-your-worksheets`,
			);
		}

		// Validate choice name presence
		if (!choiceName) {
			throw new PyXFormError(
				`[row : ${rowNum}] On the 'choices' sheet, the 'name' value is invalid. Choices must have a name. Learn more: https://xlsform.org/en/#setting-up-your-worksheets`,
			);
		}

		// Track choice name uniqueness per list
		if (!isDuplicatesAllowed) {
			const listNameStr = String(listName);
			if (!listNameRowMap[listNameStr]) {
				listNameRowMap[listNameStr] = new Map();
			}
			if (listNameRowMap[listNameStr].has(choiceName)) {
				duplicateErrors.push(
					`[row : ${rowNum}] On the 'choices' sheet, the 'name' value is invalid. Choice names must be unique for each choice list. If this is intentional, use the setting 'allow_choice_duplicates'. Learn more: https://xlsform.org/#choice-names.`,
				);
			}
			listNameRowMap[listNameStr].set(choiceName, rowNum);
		}
	}

	if (duplicateErrors.length > 0) {
		throw new PyXFormError(duplicateErrors.join("\n"));
	}
}

/**
 * Main conversion function: workbook dict → JSON for builder.
 */
export function workbookToJson(opts: {
	workbookDict: DefinitionData;
	formName?: string | null;
	fallbackFormName?: string | null;
	defaultLanguage?: string | null;
	warnings?: string[];
}): FormRecord {
	const { workbookDict, defaultLanguage, warnings = [] } = opts;

	let formName =
		opts.formName ?? opts.fallbackFormName ?? constants.DEFAULT_FORM_NAME;
	const sheetNames = workbookDict.sheet_names ?? [];

	// Validate form name from file/API parameter
	if (opts.formName && !isXmlTag(opts.formName)) {
		throw new PyXFormError(
			`The 'form_name' value is invalid. Names must begin with a letter, colon, or underscore. Subsequent characters can include numbers, dashes, and periods.`,
		);
	}

	// Validate survey sheet presence
	if (!workbookDict.survey || workbookDict.survey.length === 0) {
		// Check if we have a survey sheet at all (by looking at sheet_names)
		const hasSurveySheet = sheetNames.some((n) => n.toLowerCase() === "survey");
		if (!hasSurveySheet) {
			let msg = `You must have a sheet named 'survey'. `;
			const similar = findSheetMisspellings(constants.SURVEY, sheetNames);
			if (similar) {
				msg += similar;
			}
			throw new PyXFormError(msg);
		}
	}

	// Process settings
	const settingsRows = workbookDict.settings ?? [];
	const settings: FormRecord = {};
	if (settingsRows.length > 0) {
		const row = settingsRows[0];
		for (const [k, rawVal] of Object.entries(row)) {
			const v = cleanTextValues(rawVal);
			const alias =
				aliases.settingsHeader[k] ?? aliases.settingsHeader[k.toLowerCase()];
			if (alias) {
				settings[alias] = v;
			} else {
				// Preserve original key casing for settings (e.g., omit_instanceID, clean_text_values)
				settings[k] = v;
				// Also store a lowercased version for case-insensitive lookup
				if (k !== k.toLowerCase()) {
					settings[k.toLowerCase()] = v;
				}
			}
		}
	}

	// Check for settings sheet misspellings (warning only, settings is optional)
	if (settingsRows.length === 0) {
		const hasSupportedSettings = sheetNames.some(
			(n) => n.toLowerCase() === "settings",
		);
		if (!hasSupportedSettings) {
			const similar = findSheetMisspellings(constants.SETTINGS, sheetNames);
			if (similar) {
				warnings.push(
					`${similar} To prevent this warning, prefix the sheet name with an underscore.`,
				);
			}
		}
	}

	// If settings has a 'name' field, validate and use it as form name
	if (settings[constants.NAME]) {
		const settingsName = String(settings[constants.NAME]);
		if (!isXmlTag(settingsName)) {
			throw new PyXFormError(
				`[row : 1] On the 'settings' sheet, the 'name' value is invalid. Names must begin with a letter, colon, or underscore. Subsequent characters can include numbers, dashes, and periods.`,
			);
		}
		formName = settingsName;
	}

	// id_string (form_id) sets the @id attribute but not the form name
	// Default to fallbackFormName (filename), not formName
	const idString =
		(settings[constants.ID_STRING] as string | undefined) ??
		opts.fallbackFormName ??
		constants.DEFAULT_FORM_NAME;

	// Validate Android package name if 'app' setting is present
	if ("app" in settings) {
		const appValidationResult = validateAndroidPackageName(
			(settings.app as string) ?? "",
		);
		if (appValidationResult) {
			throw new PyXFormError(appValidationResult);
		}
	}

	// Determine clean_text_values setting (defaults to yes/true)
	const cleanTextValuesEnabled =
		aliases.yesNo[(settings.clean_text_values as string) ?? "yes"] ?? true;

	// Process choices
	const choicesData = workbookDict.choices ?? [];

	// Validate choices headers: 'name' (or 'value' alias) and 'list_name' must be present
	if (choicesData.length > 0) {
		const choicesHeaders = extractHeaders(choicesData);
		// Also include header metadata from the workbook (covers columns with all-empty values)
		if (workbookDict.choices_header) {
			for (const headerRow of workbookDict.choices_header) {
				for (const h of Object.keys(headerRow)) {
					if (h) choicesHeaders.push(h);
				}
			}
		}
		const choicesHeadersLower = new Set(
			choicesHeaders.map((h) => h.toLowerCase()),
		);
		// Check for 'name' column (or its alias 'value')
		const hasNameCol =
			choicesHeadersLower.has("name") || choicesHeadersLower.has("value");
		if (!hasNameCol) {
			throw new PyXFormError(
				`Invalid headers provided for sheet: 'choices'. One or more required column headers were not found: 'name'. Learn more: https://xlsform.org/en/#setting-up-your-worksheets`,
			);
		}
		// Check for 'list_name' column (or its alias 'list name')
		const hasListNameCol =
			choicesHeadersLower.has("list_name") ||
			choicesHeadersLower.has("list name");
		if (!hasListNameCol) {
			throw new PyXFormError(
				`Invalid headers provided for sheet: 'choices'. One or more required column headers were not found: 'list_name'. The choices sheet must have a 'list_name' and 'name' column. Learn more: https://xlsform.org/en/#setting-up-your-worksheets`,
			);
		}
	}

	const choicesByListName: Record<string, FormRecord[]> = {};
	const choicesDefaultLang =
		(settings[constants.DEFAULT_LANGUAGE_KEY] as string | undefined) ??
		constants.DEFAULT_LANGUAGE_VALUE;
	// Detect delimiter for choices: if any header uses "::", use that; otherwise use ":"
	const choicesUseDoubleColon = choicesData.some((r: FormRecord) =>
		Object.keys(r).some((k: string) => k.includes("::")),
	);
	const choicesDelimiter = choicesUseDoubleColon ? "::" : ":";
	for (const row of choicesData) {
		const listName = row[constants.LIST_NAME_S] ?? row[constants.LIST_NAME_U];
		if (!listName) continue;

		if (!choicesByListName[listName]) {
			choicesByListName[listName] = [];
		}

		const choice: FormRecord = {};
		for (const [k, rawV] of Object.entries(row)) {
			if (k === constants.LIST_NAME_S || k === constants.LIST_NAME_U) continue;
			const v = cleanTextValues(rawV);
			if (v == null || v === "") continue;

			// Handle grouped columns: media::audio, media::image::English, etc.
			const parts = k.split(choicesDelimiter).map((p) => p.trim());
			if (parts.length >= 2 && parts[0] === "media") {
				// media::audio or media::audio::English
				const mediaType = parts[1]; // e.g., "audio", "image", "big-image", "video"
				if (parts.length === 3) {
					// media::audio::English → translated media
					const lang = parts[2];
					if (!choice.media) choice.media = {};
					const choiceMedia1 = choice.media as FormRecord;
					if (!choiceMedia1[mediaType]) choiceMedia1[mediaType] = {};
					if (typeof choiceMedia1[mediaType] === "string") {
						// Convert to object for translations
						choiceMedia1[mediaType] = {};
					}
					(choiceMedia1[mediaType] as FormRecord)[lang] = v;
				} else {
					// media::audio → untranslated media
					if (!choice.media) choice.media = {};
					(choice.media as FormRecord)[mediaType] = v;
				}
				continue;
			}

			// Handle translation columns like "label::English"
			if (parts.length === 2) {
				const baseCol = parts[0];
				const lang = parts[1];
				// Check if it's a translatable column
				const alias = aliases.listHeader[baseCol];
				// Handle array aliases like ["media", "audio"] → audio::de means media.audio for lang de
				if (Array.isArray(alias) && alias[0] === "media") {
					const mediaType = alias[1]; // e.g., "audio", "image"
					if (!choice.media) choice.media = {};
					const choiceMedia2 = choice.media as FormRecord;
					if (
						!choiceMedia2[mediaType] ||
						typeof choiceMedia2[mediaType] === "string"
					) {
						const existing =
							typeof choiceMedia2[mediaType] === "string"
								? (choiceMedia2[mediaType] as string)
								: undefined;
						choiceMedia2[mediaType] = {};
						if (existing) {
							(choiceMedia2[mediaType] as FormRecord)[choicesDefaultLang] =
								existing;
						}
					}
					(choiceMedia2[mediaType] as FormRecord)[lang] = v;
					continue;
				}
				const targetKey = alias && typeof alias === "string" ? alias : baseCol;
				if (!choice[targetKey]) {
					choice[targetKey] = {};
				} else if (typeof choice[targetKey] === "string") {
					// Convert existing string value to a dict with default language
					choice[targetKey] = { [choicesDefaultLang]: choice[targetKey] };
				}
				if (typeof choice[targetKey] === "object") {
					(choice[targetKey] as FormRecord)[lang] = v;
				}
				continue;
			}

			// Dealias choice headers
			const alias = aliases.listHeader[k];
			if (alias && typeof alias === "string") {
				// If a translation dict already exists for this key, add as default language
				if (
					typeof choice[alias] === "object" &&
					choice[alias] !== null &&
					!Array.isArray(choice[alias])
				) {
					(choice[alias] as FormRecord)[constants.DEFAULT_LANGUAGE_VALUE] = v;
				} else {
					choice[alias] = v;
				}
			} else if (Array.isArray(alias)) {
				if (!choice[alias[0]]) choice[alias[0]] = {};
				(choice[alias[0]] as FormRecord)[alias[1]] = v;
			} else {
				choice[k] = v;
			}
		}
		choicesByListName[listName].push(choice);
	}

	// Validate and clean invalid choices column headers (e.g., columns with spaces)
	const invalidChoiceHeaders = new Set<string>();
	if (choicesData.length > 0) {
		const allChoiceHeaders = extractHeaders(choicesData);
		for (const header of allChoiceHeaders) {
			// Skip known valid headers with spaces (list_name / "list name")
			if (header === constants.LIST_NAME_S || header === constants.LIST_NAME_U)
				continue;
			// Skip translated headers (e.g. "label::English (en)") - the language part can contain spaces
			if (header.includes("::")) continue;
			if (header === "" || header.includes(" ")) {
				warnings.push(
					`[row : 1] On the 'choices' sheet, the '${header}' value is invalid. Column headers must not be empty and must not contain spaces. Learn more: https://xlsform.org/en/#setting-up-your-worksheets`,
				);
				invalidChoiceHeaders.add(header);
			}
		}
		// Remove invalid headers from choice data
		if (invalidChoiceHeaders.size > 0) {
			for (const listChoices of Object.values(choicesByListName)) {
				for (const choice of listChoices) {
					for (const ih of invalidChoiceHeaders) {
						delete choice[ih];
					}
				}
			}
		}
	}

	// Validate choices
	validateChoices(choicesByListName, settings, warnings, choicesData);

	// Process entities sheet
	let entityDeclarations: Record<string, FormRecord> | null = null;
	let entityVariableReferences: Record<string, string[]> | null = null;
	const entitiesData = workbookDict.entities ?? [];

	// Check for sheet name misspellings for entities
	if (entitiesData.length === 0 && sheetNames) {
		const msg = findSheetMisspellings("entities", sheetNames);
		if (msg) {
			warnings.push(msg);
		}
	}

	if (entitiesData.length > 0) {
		// Lowercase entity header keys for case-insensitive processing
		const normalizedEntities = entitiesData.map((row: FormRecord) => {
			const normalized: FormRecord = {};
			for (const [k, v] of Object.entries(row)) {
				normalized[k.toLowerCase()] = v;
			}
			return normalized;
		});
		entityDeclarations = getEntityDeclarations(normalizedEntities);
		entityVariableReferences = getEntityVariableReferences(entityDeclarations);
	}

	// Process survey rows
	const surveyRows = workbookDict.survey ?? [];
	const hasChoicesSheet = choicesData.length > 0;
	const hasExternalChoicesSheet =
		(workbookDict.external_choices ?? []).length > 0;
	const entityReferencesByQuestion: FormRecord = {};

	// Check for missing translations across survey and choices sheets
	const surveyHeaders = extractHeaders(surveyRows);
	const choicesHeaders = extractHeaders(choicesData);
	const surveyTranslations = new TranslationChecker(
		surveyHeaders,
		aliases.TRANSLATABLE_SURVEY_COLUMNS,
	);
	const choicesTranslations = new TranslationChecker(
		choicesHeaders,
		aliases.TRANSLATABLE_CHOICES_COLUMNS,
	);

	if (
		Object.keys(surveyTranslations.missing).length > 0 ||
		Object.keys(choicesTranslations.missing).length > 0
	) {
		const msg = formatMissingTranslationsMsg({
			[constants.SURVEY]: surveyTranslations.missing,
			[constants.CHOICES]: choicesTranslations.missing,
		});
		if (msg) {
			warnings.push(msg);
		}
	}

	// Build external choices list name lookup
	const externalChoicesListNames = new Set<string>();
	const externalChoicesData = workbookDict.external_choices ?? [];
	for (const row of externalChoicesData) {
		const ln = (row[constants.LIST_NAME_S] ?? row[constants.LIST_NAME_U] ?? "")
			.toString()
			.trim();
		if (ln) {
			externalChoicesListNames.add(ln);
		}
	}

	// Process OSM sheet - group tags by list_name
	const osmTags: Record<string, FormRecord[]> = {};
	const osmData = workbookDict.osm ?? [];
	for (const row of osmData) {
		const ln = (row[constants.LIST_NAME_S] ?? row[constants.LIST_NAME_U] ?? "")
			.toString()
			.trim();
		if (ln) {
			if (!osmTags[ln]) osmTags[ln] = [];
			osmTags[ln].push(row);
		}
	}

	const children = processSurveyRows(
		surveyRows,
		choicesByListName,
		warnings,
		settings,
		hasChoicesSheet,
		hasExternalChoicesSheet,
		sheetNames,
		choicesData,
		entityDeclarations,
		entityVariableReferences,
		entityReferencesByQuestion,
		surveyTranslations,
		choicesTranslations,
		externalChoicesListNames,
		formName,
		cleanTextValuesEnabled,
		workbookDict,
		osmTags,
	);

	// Build the final JSON structure
	const smsKeyword = settings[constants.SMS_KEYWORD] ?? idString;
	const result: FormRecord = {
		[constants.NAME]: formName,
		[constants.TYPE]: constants.SURVEY,
		[constants.TITLE]: settings[constants.TITLE] ?? idString,
		[constants.ID_STRING]: idString,
		[constants.SMS_KEYWORD]: smsKeyword,
		[constants.DEFAULT_LANGUAGE_KEY]:
			defaultLanguage ?? constants.DEFAULT_LANGUAGE_VALUE,
		[constants.CHILDREN]: children,
	};

	// Apply entity declarations
	if (entityDeclarations) {
		applyEntitiesDeclarations(
			entityDeclarations,
			entityReferencesByQuestion as Parameters<
				typeof applyEntitiesDeclarations
			>[1],
			result,
		);

		// Merge all meta groups into one (entity injection may add separate meta groups)
		const allChildren = result[constants.CHILDREN] as FormRecord[];
		const metaGroups: FormRecord[] = [];
		const nonMetaChildren: FormRecord[] = [];
		for (const child of allChildren) {
			if (
				child[constants.NAME] === "meta" &&
				child[constants.TYPE] === constants.GROUP
			) {
				metaGroups.push(child);
			} else {
				nonMetaChildren.push(child);
			}
		}
		if (metaGroups.length > 1) {
			// Merge all meta group children into the first one
			const primary = metaGroups[0];
			for (let i = 1; i < metaGroups.length; i++) {
				const otherChildren =
					(metaGroups[i][constants.CHILDREN] as FormRecord[]) ?? [];
				(primary[constants.CHILDREN] as FormRecord[]).push(...otherChildren);
			}
			result[constants.CHILDREN] = [...nonMetaChildren, primary];
		}
	}

	const effectiveDefaultLanguage =
		settings[constants.DEFAULT_LANGUAGE_KEY] ?? defaultLanguage;
	if (effectiveDefaultLanguage) {
		result[constants.DEFAULT_LANGUAGE_KEY] = effectiveDefaultLanguage;
	}
	if (settings[constants.VERSION]) {
		result[constants.VERSION] = settings[constants.VERSION];
	}
	if (settings[constants.STYLE]) {
		result[constants.STYLE] = settings[constants.STYLE];
	}
	if (settings[constants.PUBLIC_KEY]) {
		result[constants.PUBLIC_KEY] = settings[constants.PUBLIC_KEY];
	}
	if (settings[constants.SUBMISSION_URL]) {
		result[constants.SUBMISSION_URL] = settings[constants.SUBMISSION_URL];
	}
	if (settings[constants.AUTO_SEND]) {
		result[constants.AUTO_SEND] = settings[constants.AUTO_SEND];
	}
	if (settings[constants.AUTO_DELETE]) {
		result[constants.AUTO_DELETE] = settings[constants.AUTO_DELETE];
	}
	if (settings[constants.CLIENT_EDITABLE]) {
		result[constants.CLIENT_EDITABLE] = settings[constants.CLIENT_EDITABLE];
	}
	if (settings[constants.NAMESPACES]) {
		result[constants.NAMESPACES] = settings[constants.NAMESPACES];
	}
	if (settings.instance_xmlns) {
		result.instance_xmlns = settings.instance_xmlns;
	}
	if (settings[constants.COMPACT_PREFIX]) {
		result[constants.COMPACT_PREFIX] = settings[constants.COMPACT_PREFIX];
	}
	if (settings[constants.COMPACT_DELIMITER]) {
		result[constants.COMPACT_DELIMITER] = settings[constants.COMPACT_DELIMITER];
	}

	// Pass through attribute::* settings
	for (const [k, v] of Object.entries(settings)) {
		if (k.startsWith("attribute::")) {
			result[k] = v;
		}
	}

	// Add choices to the result
	if (Object.keys(choicesByListName).length > 0) {
		result[constants.CHOICES] = choicesByListName;
	}

	return result;
}

function processSurveyRows(
	rows: FormRecord[],
	choices: Record<string, FormRecord[]>,
	warnings: string[],
	settings: FormRecord,
	hasChoicesSheet: boolean,
	hasExternalChoicesSheet: boolean,
	sheetNames: string[],
	choicesData: FormRecord[],
	entityDeclarations: Record<string, FormRecord> | null = null,
	entityVariableReferences: Record<string, string[]> | null = null,
	entityReferencesByQuestion: FormRecord = {},
	surveyTranslations?: TranslationChecker,
	choicesTranslations?: TranslationChecker,
	externalChoicesListNames: Set<string> = new Set(),
	formName = "data",
	stripWhitespace = false,
	workbookDict?: DefinitionData,
	osmTags: Record<string, FormRecord[]> = {},
): FormRecord[] {
	const result: FormRecord[] = [];
	let orOtherSeen = false;
	const stack: {
		type: string;
		name: string;
		children: FormRecord[];
		rowNum: number;
		namesInScope: Set<string>;
		namesLowerInScope: Set<string>;
		control_name?: string;
		control_type?: string;
		container_path?: ContainerPath;
		table_list?: boolean | string;
	}[] = [];
	// Track names at the top (survey) scope
	const topScopeNames = new Set<string>();
	const topScopeNamesLower = new Set<string>();
	// Track all question names across the entire survey (for trigger/reference validation)
	const allQuestionNames = new Set<string>();
	// Track repeat names globally (repeats must be unique across all contexts)
	const repeatNames = new Set<string>();
	// Track names that appear more than once across different scopes (ambiguous references)
	const allQuestionNameCounts = new Map<string, number>();
	// Track trigger references to validate after all questions are processed
	const triggerReferences: {
		target: string;
		rowNum: number;
		questionName: string;
	}[] = [];
	// Track hidden (non-user-visible) question names for trigger validation
	const hiddenQuestionNames = new Set<string>();
	// Track survey label/column references to validate after all questions are processed
	const surveyColumnReferences: {
		target: string;
		rowNum: number;
		sheet: string;
		column: string;
	}[] = [];
	let rowNum = 1; // 1-based, after header

	const settingsDefaultLang =
		(settings[constants.DEFAULT_LANGUAGE_KEY] as string | undefined) ??
		constants.DEFAULT_LANGUAGE_VALUE;

	// Validate survey headers
	const surveyHeaders = extractHeaders(rows);
	const surveyHeader = workbookDict?.survey_header;
	if (surveyHeader && surveyHeader.length > 0) {
		for (const h of Object.keys(surveyHeader[0])) {
			if (h && !surveyHeaders.includes(h)) {
				surveyHeaders.push(h);
			}
		}
	}

	// 1. Check for unknown headers first (fires before required header check, matches Python behavior)
	{
		const knownHeaders = new Set<string>();
		if (surveyHeader && surveyHeader.length > 0) {
			for (const h of Object.keys(surveyHeader[0])) {
				knownHeaders.add(h);
			}
		} else {
			for (let i = 0; i < Math.min(100, rows.length); i++) {
				for (const k of Object.keys(rows[i])) {
					knownHeaders.add(k);
				}
			}
		}
		for (let i = 0; i < rows.length; i++) {
			for (const k of Object.keys(rows[i])) {
				if (!knownHeaders.has(k)) {
					const headerName = k || "unknown";
					throw new PyXFormError(
						`Invalid headers provided for sheet: 'survey'. For XLSForms, this may be due a missing header row, in which case add a header row as per the reference template https://xlsform.org/en/ref-table/. For internal API usage, may be due to a missing mapping for '${headerName}', in which case ensure that the full set of headers appear within the first 100 rows, or specify the header row in 'survey_header'.`,
					);
				}
			}
		}
	}

	// 2. Check required headers: 'type' must be present
	{
		const resolvedSurveyHeaders = new Set<string>();
		for (const h of surveyHeaders) {
			const hl = h.toLowerCase();
			const alias = aliases.surveyHeader[h] ?? aliases.surveyHeader[hl];
			if (alias) {
				const resolved = Array.isArray(alias) ? alias[0] : alias;
				resolvedSurveyHeaders.add(resolved);
			}
			resolvedSurveyHeaders.add(hl);
		}
		if (rows.length > 0 || (surveyHeader && surveyHeader.length > 0)) {
			if (
				!resolvedSurveyHeaders.has("type") &&
				!resolvedSurveyHeaders.has("command")
			) {
				throw new PyXFormError(
					`Invalid headers provided for sheet: 'survey'. One or more required column headers were not found: 'type'. Learn more: https://xlsform.org/en/#setting-up-your-worksheets`,
				);
			}
		}
	}

	// 3. Check for duplicate aliases (e.g., both 'name' and 'value' columns)
	{
		const resolvedHeaders = new Map<string, string>();
		for (const header of surveyHeaders) {
			const headerLower = header.toLowerCase();
			const alias =
				aliases.surveyHeader[header] ?? aliases.surveyHeader[headerLower];
			const resolved = alias
				? Array.isArray(alias)
					? alias.join("::")
					: alias
				: headerLower;
			const existing = resolvedHeaders.get(resolved);
			if (existing && existing.toLowerCase() !== headerLower) {
				throw new PyXFormError(
					`Invalid headers provided for sheet: 'survey'. Headers that are different names for the same column were found: '${existing}', '${header}'. Rename or remove one of these columns.`,
				);
			}
			resolvedHeaders.set(resolved, header);
		}
	}

	for (const rawRow of rows) {
		rowNum++;
		const row = dealiasAndGroupHeaders(
			rawRow,
			aliases.surveyHeader,
			false,
			settingsDefaultLang,
			stripWhitespace,
		);

		const type = (row[constants.TYPE] ?? "").toString().trim();
		let name = (row[constants.NAME] ?? "").toString().trim();

		if (!type) continue;

		// Validate name presence for question rows
		// Allow no name for: end_group, end_repeat, end_loop (closers never need names)
		// Also allow no name for: begin_loop (handled separately), and meta types like "audit" that auto-assign names
		const isEnd = /^end[_ ](group|repeat|loop)$/i.test(type);
		const isBeginLoop = /^begin[_ ]loop\b/i.test(type);
		const isBeginGroupOrRepeat = /^begin[_ ](group|repeat)$/i.test(type);
		const isBeginEnd = isEnd || isBeginLoop || isBeginGroupOrRepeat;

		// Types that auto-assign their name when left blank
		const autoNameTypes: Record<string, string | ((rowNum: number) => string)> =
			{
				audit: "audit",
				note: (rn: number) => `generated_note_name_${rn}`,
			};

		if (!isEnd && !isBeginLoop && !name) {
			// begin_group / begin_repeat with no name is also an error
			if (isBeginGroupOrRepeat) {
				throw new PyXFormError(
					`[row : ${rowNum}] Question or group with no name.`,
				);
			}
			// Check if type supports auto-naming
			const autoNameEntry = autoNameTypes[type.toLowerCase()];
			if (!autoNameEntry) {
				throw new PyXFormError(
					`[row : ${rowNum}] Question or group with no name.`,
				);
			}
			// Auto-assign the name
			const autoName =
				typeof autoNameEntry === "function"
					? autoNameEntry(rowNum)
					: autoNameEntry;
			name = autoName;
			row[constants.NAME] = autoName;
		}

		// Validate reserved names (case-sensitive match only; uppercase variants are allowed)
		if (
			!isBeginEnd &&
			name &&
			constants.RESERVED_NAMES_SURVEY_SHEET.has(name)
		) {
			throw new PyXFormError(
				`[row : ${rowNum}] On the 'survey' sheet, the 'name' value '${name}' is invalid. The name '${name}' is reserved for form metadata.`,
			);
		}

		// Validate name doesn't contain ${...} references
		if (!isEnd && name && hasPyxformReference(name)) {
			throw new PyXFormError(
				`[row : ${rowNum}] On the 'survey' sheet, the 'name' value is invalid. Names must not contain references (e.g. \${...}).`,
			);
		}

		// Validate name format (must begin with letter or underscore)
		if (!isEnd && name && !/^[a-zA-Z_]/.test(name)) {
			throw new PyXFormError(
				`[row : ${rowNum}] On the 'survey' sheet, the 'name' value is invalid. Names must begin with a letter or underscore.`,
			);
		}

		// Validate name uniqueness within the current scope
		if (!isEnd && name) {
			const currentScopeNames =
				stack.length > 0 ? stack[stack.length - 1].namesInScope : topScopeNames;
			const currentScopeNamesLower =
				stack.length > 0
					? stack[stack.length - 1].namesLowerInScope
					: topScopeNamesLower;
			if (currentScopeNames.has(name)) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the 'name' value '${name}' is invalid. Questions, groups, and repeats must be unique within their nearest parent group or repeat, or the survey if not inside a group or repeat.`,
				);
			}
			// Case-insensitive duplicate warning
			const nameLower = name.toLowerCase();
			if (
				currentScopeNamesLower.has(nameLower) &&
				!currentScopeNames.has(name)
			) {
				warnings.push(
					`[row : ${rowNum}] On the 'survey' sheet, the 'name' value '${name}' is problematic. The name is a case-insensitive match to another name. Questions, groups, and repeats should be unique within the nearest parent group or repeat, or the survey if not inside a group or repeat. Some data processing tools are not case-sensitive, so the current names may make analysis difficult.`,
				);
			}
			currentScopeNames.add(name);
			currentScopeNamesLower.add(nameLower);
			// Track in the global set for reference validation
			allQuestionNames.add(name);
			allQuestionNameCounts.set(
				name,
				(allQuestionNameCounts.get(name) ?? 0) + 1,
			);
			// Track hidden (non-user-visible) questions for trigger validation
			const hasLabel =
				row.label &&
				(typeof row.label === "string"
					? row.label.trim() !== ""
					: Object.keys(row.label).length > 0);
			const rowBind = row.bind as FormRecord | undefined;
			const hasCalculation = rowBind?.calculate || row.calculation;
			if (type === "calculate" || (hasCalculation && !hasLabel)) {
				hiddenQuestionNames.add(name);
			}
		}

		// Check for begin group/repeat
		const beginMatch = type.match(/^begin[_ ](group|repeat)$/i);
		if (beginMatch) {
			// Validate reserved names for groups/repeats too
			if (name && constants.RESERVED_NAMES_SURVEY_SHEET.has(name)) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the 'name' value '${name}' is invalid. The name '${name}' is reserved for form metadata.`,
				);
			}

			const sectionType =
				beginMatch[1].toLowerCase() === "group"
					? constants.GROUP
					: constants.REPEAT;

			// Validate repeat names: must be unique globally and not same as survey root
			if (sectionType === constants.REPEAT) {
				if (name === formName) {
					throw new PyXFormError(
						`[row : ${rowNum}] On the 'survey' sheet, the 'name' value '${name}' is invalid. Repeat names must not be the same as the survey root (which defaults to 'data').`,
					);
				}
				if (repeatNames.has(name)) {
					throw new PyXFormError(
						`[row : ${rowNum}] On the 'survey' sheet, the 'name' value '${name}' is invalid. Repeat names must unique anywhere in the survey, at all levels of group or repeat nesting.`,
					);
				}
				repeatNames.add(name);
			}

			const parentPath =
				stack.length > 0
					? (stack[stack.length - 1].container_path ?? ContainerPath.default())
					: ContainerPath.default();
			const newPath = new ContainerPath([
				...parentPath.nodes,
				{ name, type: sectionType },
			]);
			stack.push({
				type: sectionType,
				name,
				children: [],
				rowNum,
				namesInScope: new Set<string>(),
				namesLowerInScope: new Set<string>(),
				control_name: name,
				control_type: sectionType,
				container_path: newPath,
			});
			// Build the section dict
			const sectionDict: FormRecord = {
				...row,
				[constants.TYPE]: sectionType,
				[constants.NAME]: name,
				[constants.CHILDREN]: stack[stack.length - 1].children,
			};
			// Remove type from row since we're setting it explicitly
			sectionDict.type = undefined;
			sectionDict[constants.TYPE] = sectionType;

			// Warn if repeat has no label
			if (sectionType === constants.REPEAT && !sectionDict[constants.LABEL]) {
				const msgDict = `{'name': '${row[constants.NAME] ?? ""}', 'type': '${row[constants.TYPE] ?? ""}'}`;
				warnings.push(`[row : ${rowNum}] Repeat has no label: ${msgDict}`);
			}

			// Handle repeat_count: generate a calculated node for non-simple references
			const repeatCountExpr = (
				sectionDict[constants.CONTROL] as FormRecord | undefined
			)?.["jr:count"];
			if (repeatCountExpr) {
				if (!isPyxformReference(repeatCountExpr as string)) {
					const generatedNodeName = `${name}_count`;
					if (allQuestionNames.has(generatedNodeName)) {
						throw new PyXFormError(
							`[row : ${rowNum}] On the 'survey' sheet, the repeat_count expression for '${name}' requires a generated element named '${generatedNodeName}', but a question with that name already exists. Please rename the existing question or use a simple variable reference for repeat_count.`,
						);
					}
					const parentArray =
						stack.length > 1 ? stack[stack.length - 2].children : result;
					parentArray.push({
						[constants.NAME]: generatedNodeName,
						bind: {
							readonly: "true()",
							calculate: repeatCountExpr,
						},
						[constants.TYPE]: "calculate",
					});
					(sectionDict[constants.CONTROL] as FormRecord)["jr:count"] =
						`\${${generatedNodeName}}`;
					allQuestionNames.add(generatedNodeName);
				}
			}

			// Handle table-list appearance
			const tableListAppearance = (
				sectionDict[constants.CONTROL] as FormRecord | undefined
			)?.appearance;
			if (tableListAppearance) {
				const appearanceMods = tableListAppearance.toString().split(/\s+/);
				if (appearanceMods.includes(constants.TABLE_LIST)) {
					let appearanceString = "field-list";
					for (const w of appearanceMods) {
						if (w !== constants.TABLE_LIST) {
							appearanceString += ` ${w}`;
						}
					}
					(sectionDict[constants.CONTROL] as FormRecord).appearance =
						appearanceString;
					if (sectionDict[constants.LABEL] || sectionDict.hint) {
						const generatedLabelElement: FormRecord = {
							[constants.TYPE]: "note",
							[constants.NAME]: `generated_table_list_label_${String(rowNum)}`,
						};
						if (sectionDict[constants.LABEL]) {
							generatedLabelElement[constants.LABEL] =
								sectionDict[constants.LABEL];
							delete sectionDict[constants.LABEL];
						}
						if (sectionDict.hint) {
							generatedLabelElement.hint = sectionDict.hint;
							sectionDict.hint = undefined;
						}
						stack[stack.length - 1].children.push(generatedLabelElement);
					}
					stack[stack.length - 1].table_list = true;
				}
			}

			// Handle intent: move intent from top-level to control.intent
			if (sectionDict.intent) {
				if (!sectionDict[constants.CONTROL])
					sectionDict[constants.CONTROL] = {};
				(sectionDict[constants.CONTROL] as FormRecord).intent =
					sectionDict.intent;
				sectionDict.intent = undefined;
			}

			// Check entity save_to on begin group/repeat (error)
			if (
				(row[constants.BIND] as FormRecord | undefined)?.[
					constants.ENTITIES_SAVETO_NS
				] &&
				name
			) {
				processEntityReferencesForQuestion(
					newPath,
					row,
					rowNum,
					name,
					entityDeclarations,
					entityVariableReferences,
					entityReferencesByQuestion as Parameters<
						typeof processEntityReferencesForQuestion
					>[6],
					true,
					false,
				);
			}

			if (stack.length > 1) {
				stack[stack.length - 2].children.push(sectionDict);
			} else {
				result.push(sectionDict);
			}
			continue;
		}

		// Check for begin loop: "begin_loop over <listname>" or "begin loop over <listname>"
		const beginLoopMatch = type.match(/^begin[_ ]loop\s+over\s+(.+)$/i);
		if (beginLoopMatch) {
			const loopListName = beginLoopMatch[1].trim();
			stack.push({
				type: constants.LOOP,
				name,
				children: [],
				rowNum,
				namesInScope: new Set<string>(),
				namesLowerInScope: new Set<string>(),
			});
			const sectionDict: FormRecord = {
				...row,
				[constants.TYPE]: constants.LOOP,
				[constants.NAME]: name,
				[constants.CHILDREN]: stack[stack.length - 1].children,
				columns: choices[loopListName] ?? [],
			};
			sectionDict.type = undefined;
			sectionDict[constants.TYPE] = constants.LOOP;

			if (stack.length > 1) {
				stack[stack.length - 2].children.push(sectionDict);
			} else {
				result.push(sectionDict);
			}
			continue;
		}

		// Check for end group/repeat/loop
		const endMatch = type.match(/^end[_ ](group|repeat|loop)$/i);
		if (endMatch) {
			const endName = name || "unknown";
			if (stack.length === 0) {
				throw new PyXFormError(
					`[row : ${rowNum}] Unmatched 'end_${endMatch[1]}'. No matching 'begin_${endMatch[1]}' was found for the name '${endName}'.`,
				);
			}
			const top = stack[stack.length - 1];
			const endType = endMatch[1].toLowerCase();
			const expectedType =
				endType === "group"
					? constants.GROUP
					: endType === "repeat"
						? constants.REPEAT
						: constants.LOOP;
			if (top.type !== expectedType) {
				throw new PyXFormError(
					`[row : ${rowNum}] Unmatched 'end_${endMatch[1]}'. No matching 'begin_${endMatch[1]}' was found for the name '${endName}'.`,
				);
			}
			// Check entity save_to on end group/repeat (error)
			if (
				(row[constants.BIND] as FormRecord | undefined)?.[
					constants.ENTITIES_SAVETO_NS
				]
			) {
				const endCPath =
					stack.length > 0
						? (stack[stack.length - 1].container_path ??
							ContainerPath.default())
						: ContainerPath.default();
				processEntityReferencesForQuestion(
					endCPath,
					row,
					rowNum,
					endName,
					entityDeclarations,
					entityVariableReferences,
					entityReferencesByQuestion as Parameters<
						typeof processEntityReferencesForQuestion
					>[6],
					false,
					true,
				);
			}
			stack.pop();
			continue;
		}

		// Process trigger column (for background-geopoint and calculate with triggers)
		let triggerRefs: string[] = [];
		if (row.trigger) {
			const triggerVal = row.trigger.toString().trim();
			if (triggerVal) {
				// Parse trigger references
				triggerRefs = extractPyxformReferences(triggerVal);
				if (triggerRefs.length === 0 && triggerVal) {
					// Trigger value present but no valid ${...} references
					throw new PyXFormError(
						`[row : ${rowNum}] On the 'survey' sheet, the 'trigger' value is invalid. Reference variables must start with '\${', then a question name, and end with '}'.`,
					);
				}
				// Validate comma-separated format: adjacent ${...}${...} without comma is invalid
				if (/\}\s*\$\{/.test(triggerVal)) {
					throw new PyXFormError(
						`[row : ${rowNum}] On the 'survey' sheet, the 'trigger' value is invalid. Reference variable lists must have a comma between each variable.`,
					);
				}
				for (const ref of triggerRefs) {
					triggerReferences.push({ target: ref, rowNum, questionName: name });
				}
			}
		}

		// Background-geopoint validation
		if (type === "background-geopoint") {
			if (triggerRefs.length === 0 && !row.trigger) {
				throw new PyXFormError(
					`[row : ${rowNum}] For 'background-geopoint' questions, the 'trigger' column must not be empty.`,
				);
			}
			// Check that calculation is not set
			const calc =
				row.calculation ?? (row.bind as FormRecord | undefined)?.calculate;
			if (calc?.toString().trim()) {
				throw new PyXFormError(
					`[row : ${rowNum}] For 'background-geopoint' questions, the 'calculation' column must be empty.`,
				);
			}
		}

		// Validate survey label/hint/constraint_message references
		// We check BOTH the raw row (for original column names) and dealiased row
		const surveyRefColumns = new Set([
			"label",
			"hint",
			"constraint_message",
			"guidance_hint",
			"calculation",
			"constraint",
			"relevant",
			"required",
			"default",
			"choice_filter",
			"repeat_count",
		]);
		// Build a map from dealiased key -> original key for reference error reporting
		const checkedRawCols = new Set<string>();
		for (const [rawColKey, rawColVal] of Object.entries(rawRow)) {
			if (typeof rawColVal !== "string") continue;
			if (!hasPyxformReference(rawColVal)) continue;
			// Resolve the column name through aliases to check if it's a ref column
			const baseRawCol = rawColKey.split("::")[0].trim();
			const aliased = aliases.surveyHeader[baseRawCol];
			const resolvedCol =
				typeof aliased === "string"
					? aliased
					: Array.isArray(aliased)
						? aliased[0]
						: baseRawCol;
			const resolvedBase = resolvedCol.split("::")[0].trim().toLowerCase();
			const baseRawColLower = baseRawCol.toLowerCase();
			// Only validate label-type columns
			if (
				!surveyRefColumns.has(resolvedBase) &&
				!surveyRefColumns.has(baseRawColLower)
			)
				continue;
			checkedRawCols.add(rawColKey);
			// Validate reference syntax first
			const syntaxErr = validatePyxformReferenceSyntax(
				rawColVal,
				rowNum,
				"survey",
				rawColKey,
			);
			if (syntaxErr) {
				throw new PyXFormError(syntaxErr);
			}
			const refs = extractPyxformReferences(rawColVal);
			for (const ref of refs) {
				surveyColumnReferences.push({
					target: ref,
					rowNum,
					sheet: "survey",
					column: rawColKey,
				});
			}
		}
		// Also check dealiased row for any label-type columns that came from dealiasing
		for (const [colKey, colVal] of Object.entries(row)) {
			if (typeof colVal !== "string") continue;
			if (!hasPyxformReference(colVal)) continue;
			const baseCol = colKey.split("::")[0].trim().toLowerCase();
			if (!surveyRefColumns.has(baseCol)) continue;
			// Skip if we already checked this value via the raw row
			if (checkedRawCols.size > 0) {
				// Check if this dealiased value matches a raw col we already processed
				let alreadyChecked = false;
				for (const rawKey of checkedRawCols) {
					if (rawRow[rawKey] === colVal) {
						alreadyChecked = true;
						break;
					}
				}
				if (alreadyChecked) continue;
			}
			const refs = extractPyxformReferences(colVal);
			for (const ref of refs) {
				surveyColumnReferences.push({
					target: ref,
					rowNum,
					sheet: "survey",
					column: colKey,
				});
			}
		}

		// Process entity references for this question
		const hasSaveTo = (row[constants.BIND] as FormRecord | undefined)?.[
			constants.ENTITIES_SAVETO_NS
		];
		if ((entityDeclarations || hasSaveTo) && name) {
			const currentContainerPath =
				stack.length > 0
					? (stack[stack.length - 1].container_path ?? ContainerPath.default())
					: ContainerPath.default();
			const isContainerBegin = isBeginGroupOrRepeat;
			processEntityReferencesForQuestion(
				currentContainerPath,
				row,
				rowNum,
				name,
				entityDeclarations,
				entityVariableReferences,
				entityReferencesByQuestion as Parameters<
					typeof processEntityReferencesForQuestion
				>[6],
				isContainerBegin,
				isEnd,
			);
		}

		// Process question type
		const questionDict = processQuestionRow(
			row,
			type,
			name,
			choices,
			rowNum,
			warnings,
			settings,
			hasChoicesSheet,
			hasExternalChoicesSheet,
			sheetNames,
			externalChoicesListNames,
			osmTags,
		);
		if (!questionDict) continue;

		// Handle or_other
		let specifyOtherQuestion: FormRecord | null = null;
		if (questionDict.or_other) {
			orOtherSeen = true;
			if (
				questionDict[constants.CHOICE_FILTER] ||
				row[constants.CHOICE_FILTER] ||
				row.choice_filter
			) {
				throw new PyXFormError(
					`[row : ${rowNum}] Choice filter not supported with or_other.`,
				);
			}
			const listName =
				questionDict[constants.LIST_NAME_U] ?? questionDict[constants.ITEMSET];
			const itemsetChoices = listName ? choices[String(listName)] : null;
			if (itemsetChoices && Array.isArray(itemsetChoices)) {
				const hasOther = itemsetChoices.some(
					(c) => c[constants.NAME] === "other",
				);
				if (!hasOther) {
					const hasTranslatedLabels = itemsetChoices.some(
						(c) =>
							typeof c[constants.LABEL] === "object" &&
							c[constants.LABEL] !== null,
					);
					if (hasTranslatedLabels) {
						const allLangs = new Set<string>();
						for (const c of itemsetChoices) {
							if (
								typeof c[constants.LABEL] === "object" &&
								c[constants.LABEL] !== null
							) {
								for (const lang of Object.keys(c[constants.LABEL]))
									allLangs.add(lang);
							}
						}
						const otherLabel: Record<string, string> = {};
						for (const lang of allLangs) otherLabel[lang] = "Other";
						itemsetChoices.push({
							[constants.NAME]: "other",
							[constants.LABEL]: otherLabel,
						});
					} else {
						itemsetChoices.push({
							[constants.NAME]: "other",
							[constants.LABEL]: "Other",
						});
					}
				}
			}
			specifyOtherQuestion = {
				[constants.TYPE]: "text",
				[constants.NAME]: `${name}_other`,
				[constants.LABEL]: "Specify other.",
				[constants.BIND]: { relevant: `selected(../${name}, 'other')` },
			};
		}

		// Handle table-list select appearance
		const currentTableList =
			stack.length > 0 ? stack[stack.length - 1].table_list : undefined;
		if (currentTableList !== undefined && questionDict[constants.ITEMSET]) {
			const selectListName = questionDict[constants.ITEMSET];
			if (currentTableList === true) {
				// First select in the table-list group
				stack[stack.length - 1].table_list = selectListName as string;
				if (
					questionDict[constants.CHOICE_FILTER] ||
					row[constants.CHOICE_FILTER] ||
					row.choice_filter
				) {
					throw new PyXFormError(
						`[row : ${rowNum}] Choice filter not supported for table-list appearance.`,
					);
				}
				const tableListHeader: FormRecord = {
					[constants.TYPE]: questionDict[constants.TYPE],
					[constants.NAME]: `reserved_name_for_field_list_labels_${String(rowNum)}`,
					[constants.CONTROL]: { appearance: "label" },
					[constants.ITEMSET]: selectListName,
					[constants.LABEL]: " ",
				};
				if (choices[String(selectListName)]) {
					tableListHeader[constants.CHOICES] = choices[String(selectListName)];
				}
				stack[stack.length - 1].children.push(tableListHeader);
			} else if (currentTableList !== selectListName) {
				throw new PyXFormError(
					`[row : ${rowNum}] Badly formatted table list, list names don't match: ${currentTableList} vs. ${selectListName}`,
				);
			}
			if (!questionDict[constants.CONTROL])
				questionDict[constants.CONTROL] = {};
			(questionDict[constants.CONTROL] as FormRecord).appearance =
				"list-nolabel";
		}

		if (stack.length > 0) {
			stack[stack.length - 1].children.push(questionDict);
			if (specifyOtherQuestion)
				stack[stack.length - 1].children.push(specifyOtherQuestion);
		} else {
			result.push(questionDict);
			if (specifyOtherQuestion) result.push(specifyOtherQuestion);
		}
	}

	// Add or_other warning if translations are present
	if (orOtherSeen && surveyTranslations && choicesTranslations) {
		if (
			!surveyTranslations.seenDefaultOnly() ||
			!choicesTranslations.seenDefaultOnly()
		) {
			warnings.push(OR_OTHER_WARNING);
		}
	}

	if (stack.length > 0) {
		const unclosed = stack[stack.length - 1];
		throw new PyXFormError(
			`[row : ${unclosed.rowNum}] Unmatched 'begin_${unclosed.type}'. No matching 'end_${unclosed.type}' was found for the name '${unclosed.name}'.`,
		);
	}

	// Add well-known meta names to the question name set for reference validation
	const omitInstanceIDForRefs =
		settings.omit_instanceID === "yes" || settings.omit_instanceID === "true";
	const metaRefNames: string[] = [
		"instanceName",
		"meta",
		"audit",
		"start",
		"end",
		"today",
		"deviceid",
		"phonenumber",
		"username",
		"simserial",
		"subscriberid",
	];
	// Only allow ${instanceID} reference when instanceID is not omitted
	if (!omitInstanceIDForRefs) {
		metaRefNames.push("instanceID");
	}
	for (const n of metaRefNames) {
		allQuestionNames.add(n);
	}

	// Validate trigger references: each target must exist in the survey
	for (const { target, rowNum: refRow, questionName } of triggerReferences) {
		if (!allQuestionNames.has(target)) {
			throw new PyXFormError(
				`[row : ${refRow}] On the 'survey' sheet, the 'trigger' value is invalid. Reference variables must contain a name from the 'survey' sheet. Could not find the name '${target}'.`,
			);
		}
		// Trigger target must be user-visible (not a calculate or hidden question)
		if (hiddenQuestionNames.has(target)) {
			throw new PyXFormError(
				`The question \${${target}} is not user-visible so it can't be used as a calculation trigger for question \${${questionName}}.`,
			);
		}
	}

	// Validate survey column references: each target must exist uniquely in the survey
	for (const {
		target: rawTarget,
		rowNum: refRow,
		sheet,
		column,
	} of surveyColumnReferences) {
		// Strip last-saved# prefix for validation
		const target = rawTarget.startsWith("last-saved#")
			? rawTarget.substring("last-saved#".length)
			: rawTarget;
		if (!allQuestionNames.has(target)) {
			throw new PyXFormError(
				`[row : ${refRow}] On the '${sheet}' sheet, the '${column}' value is invalid. Reference variables must contain a name from the 'survey' sheet. Could not find the name '${target}'.`,
			);
		}
		// Check for ambiguous references (name used in multiple scopes)
		const count = allQuestionNameCounts.get(target) ?? 0;
		if (count > 1) {
			throw new PyXFormError(
				`[row : ${refRow}] On the '${sheet}' sheet, the '${column}' value is invalid. Reference variables must contain a name from the 'survey' sheet. Could not find the name '${target}'.`,
			);
		}
	}

	// Validate entity label references
	if (entityDeclarations) {
		validateEntityLabelReferences(entityDeclarations, allQuestionNames);
	}

	// Validate choice label/media references against survey question names
	validateChoiceReferences(choicesData, allQuestionNames);

	// Collect metadata-type children that belong in the <meta> group
	const metaTypes = new Set([
		"audit",
		"start",
		"end",
		"today",
		"deviceid",
		"phonenumber",
		"username",
		"simserial",
		"subscriberid",
	]);
	const metaChildren: FormRecord[] = [];
	const filteredResult: FormRecord[] = [];
	for (const child of result) {
		if (metaTypes.has(child[constants.TYPE] as string)) {
			metaChildren.push(child);
		} else {
			filteredResult.push(child);
		}
	}
	result.length = 0;
	result.push(...filteredResult);

	// Add meta group with collected metadata children
	const omitInstanceID =
		settings.omit_instanceID === "yes" || settings.omit_instanceID === "true";

	// Handle instance_name setting
	if (settings.instance_name) {
		// Validate references in instance_name
		const instanceNameStr = String(settings.instance_name);
		const instanceNameRefs = extractPyxformReferences(instanceNameStr);
		for (const ref of instanceNameRefs) {
			if (!allQuestionNames.has(ref)) {
				throw new PyXFormError(
					`[row : 2] On the 'settings' sheet, the 'instance_name' value is invalid. Could not find the name '${ref}'.`,
				);
			}
		}
		metaChildren.push({
			[constants.NAME]: "instanceName",
			[constants.TYPE]: "calculate",
			[constants.BIND]: {
				type: "string",
				calculate: settings.instance_name,
			},
		});
	}

	if (metaChildren.length > 0 || !omitInstanceID) {
		const instanceIdPreload =
			(settings.instance_id as string | undefined) ?? "uid";
		result.push(getMetaGroup(metaChildren, omitInstanceID, instanceIdPreload));
	}

	return result;
}

function parseParameters(rawParams: string): Record<string, string> {
	const result: Record<string, string> = {};
	if (!rawParams || typeof rawParams !== "string") return result;
	// Parameters are separated by spaces, commas, or semicolons
	const pairs = rawParams
		.trim()
		.split(/[\s,;]+/)
		.filter(Boolean);
	for (const pair of pairs) {
		const eqIdx = pair.indexOf("=");
		if (eqIdx > 0) {
			result[pair.substring(0, eqIdx).trim()] = pair
				.substring(eqIdx + 1)
				.trim();
		}
	}
	return result;
}

/**
 * Validate ${name} references in choice label and media columns.
 * Only label, label::lang, and supported media columns are validated.
 * Extra/unknown columns are not validated.
 */
function validateChoiceReferences(
	choicesData: FormRecord[],
	surveyNames: Set<string>,
): void {
	// The columns of interest for reference validation in choices:
	// label, label::*, audio, audio::*, image, image::*, video, video::*
	const LABEL_COLUMNS = new Set(["label"]);
	const MEDIA_COLUMNS = new Set(["audio", "image", "video"]);

	let rowNum = 1;
	for (const row of choicesData) {
		rowNum++;
		for (const [colKey, colVal] of Object.entries(row)) {
			if (typeof colVal !== "string") continue;
			if (!hasPyxformReference(colVal)) continue;

			// Determine if this column is a label or media column
			const baseCol = colKey.split("::")[0].trim().toLowerCase();
			const isLabelCol = LABEL_COLUMNS.has(baseCol);
			const isMediaCol = MEDIA_COLUMNS.has(baseCol);
			if (!isLabelCol && !isMediaCol) continue;

			const refs = extractPyxformReferences(colVal);
			for (const ref of refs) {
				if (!surveyNames.has(ref)) {
					throw new PyXFormError(
						`[row : ${rowNum}] On the 'choices' sheet, the '${colKey}' value is invalid. Reference variables must contain a name from the 'survey' sheet. Could not find the name '${ref}'.`,
					);
				}
			}
		}
	}
}

function processQuestionRow(
	row: FormRecord,
	rawType: string,
	name: string,
	choices: Record<string, FormRecord[]>,
	rowNum: number,
	warnings: string[],
	settings: FormRecord,
	hasChoicesSheet: boolean,
	hasExternalChoicesSheet: boolean,
	sheetNames: string[],
	externalChoicesListNames: Set<string> = new Set(),
	osmTags: Record<string, FormRecord[]> = {},
): FormRecord | null {
	let type = rawType;
	let listName: string | null = null;
	let orOther = false;
	let selectCommand: string | null = null;

	// Handle select types: "select_one listname" / "select_multiple listname"
	// Also handle "select_one_from_file filename.ext" and "select_multiple_from_file filename.ext"
	const selectFromFileMatch = type.match(
		/^(select[_ ]one[_ ]from[_ ]file|select[_ ]multiple[_ ]from[_ ]file)\s+(.+)$/i,
	);
	const selectExternalMatch =
		!selectFromFileMatch && type.match(/^(select[_ ]one[_ ]external)\s+(.+)$/i);
	const osmMatch =
		!selectFromFileMatch &&
		!selectExternalMatch &&
		type.match(/^(osm)\s+(.+)$/i);
	const selectMatch =
		!selectFromFileMatch &&
		!selectExternalMatch &&
		!osmMatch &&
		type.match(
			/^(add select one prompt using|add select multiple prompt using|select all that apply from|select[_ ]one[_ ]from|select[_ ]one|select[_ ]multiple|select[_ ]all[_ ]that[_ ]apply|select1|rank)\s+(.+)$/i,
		);

	if (selectFromFileMatch) {
		selectCommand = selectFromFileMatch[1].toLowerCase();
		const selectType = selectFromFileMatch[1].toLowerCase().replace(/_/g, " ");
		type =
			aliases.selectFromFile[selectType] ??
			aliases.selectFromFile[selectFromFileMatch[1].toLowerCase()] ??
			constants.SELECT_ONE;
		listName = selectFromFileMatch[2].trim();
	} else if (selectExternalMatch) {
		selectCommand = "select_one_external";
		type = constants.SELECT_ONE_EXTERNAL;
		listName = selectExternalMatch[2].trim();
	} else if (osmMatch) {
		type = "osm";
		listName = osmMatch[2].trim();
	} else if (selectMatch) {
		let rawListName = selectMatch[2].trim();

		// Handle "or_other" suffix
		if (
			rawListName.endsWith(" or_other") ||
			rawListName.endsWith(" or other")
		) {
			rawListName = rawListName.replace(/\s+or[_ ]other$/i, "");
			orOther = true;
		}

		const selectType = selectMatch[1]
			.toLowerCase()
			.replace(/_/g, " ")
			.replace("select multiple", "select all that apply");

		// Map to canonical type
		type =
			aliases.select[selectType] ??
			aliases.select[selectMatch[1].toLowerCase()] ??
			selectType;
		listName = rawListName;
	} else {
		// Check type aliases
		const aliasedType = aliases.typeAliasMap[type.toLowerCase()];
		if (aliasedType) {
			type = aliasedType;
		}
	}

	// Validate choices sheet presence for select types
	if (
		selectMatch &&
		listName &&
		!selectFromFileMatch &&
		!selectExternalMatch &&
		!listName.includes("${")
	) {
		if (!hasChoicesSheet && Object.keys(choices).length === 0) {
			let msg = "There should be a choices sheet in this xlsform.";
			const similar = findSheetMisspellings(constants.CHOICES, sheetNames);
			if (similar) {
				msg += ` ${similar}`;
			}
			msg += ` Please ensure that the choices sheet name is 'choices'.`;
			throw new PyXFormError(msg);
		}
	}
	if (selectExternalMatch && listName) {
		if (!hasExternalChoicesSheet) {
			let msg = "There should be an external_choices sheet in this xlsform.";
			const similar = findSheetMisspellings(
				constants.EXTERNAL_CHOICES,
				sheetNames,
			);
			if (similar) {
				msg += ` ${similar}`;
			}
			msg += ` Please ensure that the external_choices sheet name is 'external_choices'.`;
			throw new PyXFormError(msg);
		}
		if (!externalChoicesListNames.has(listName)) {
			throw new PyXFormError(
				`[row : ${rowNum}] List name not in external choices sheet: ${listName}`,
			);
		}
	}

	// Validate file extension for select_from_file types
	if (selectFromFileMatch && selectCommand && listName) {
		const dotIdx = listName.lastIndexOf(".");
		const fileExt = dotIdx >= 0 ? listName.substring(dotIdx) : "";
		if (dotIdx < 0 || !constants.EXTERNAL_INSTANCE_EXTENSIONS.has(fileExt)) {
			const exts = [...constants.EXTERNAL_INSTANCE_EXTENSIONS]
				.map((e) => `'${e}'`)
				.join(", ");
			throw new PyXFormError(
				`[row : ${rowNum}] File name for '${selectCommand} ${listName}' should end with one of the supported file extensions: ${exts}`,
			);
		}
	}

	// Warn about deprecated metadata types
	if (constants.DEPRECATED_DEVICE_ID_METADATA_FIELDS.has(type)) {
		warnings.push(
			`[row : ${rowNum}] ${type} is no longer supported on most devices. Only old versions of Collect on Android versions older than 11 still support it.`,
		);
	}

	// Validate calculate type has a calculation or dynamic default
	if (type === "calculate") {
		const calculation = (row[constants.BIND] as FormRecord | undefined)
			?.calculate;
		const defaultVal = row.default;
		const hasDynamic = defaultVal && defaultIsDynamic(String(defaultVal), type);
		if (!calculation && !hasDynamic) {
			throw new PyXFormError(`[row : ${rowNum}] Missing calculation.`);
		}
	}

	// Build the question dict
	const questionDict: FormRecord = { ...row };
	questionDict[constants.TYPE] = type;
	questionDict[constants.NAME] = name;

	// Parse parameters column
	if (
		questionDict[constants.PARAMETERS] &&
		typeof questionDict[constants.PARAMETERS] === "string"
	) {
		const rawParamsStr = questionDict[constants.PARAMETERS] as string;

		// Check for malformed parameters (range-specific)
		if (type === "range") {
			const trimmed = rawParamsStr.trim();
			if (trimmed) {
				const tokens = trimmed.split(/[\s,;]+/).filter(Boolean);
				for (const token of tokens) {
					const eqCount = (token.match(/=/g) || []).length;
					// Must have exactly one '=' and not start with '='
					// (ending with '=' is OK -- it means empty value, caught by numeric validation)
					if (eqCount === 0 || eqCount > 1 || token.startsWith("=")) {
						throw new PyXFormError(
							"Expecting parameters to be in the form of 'parameter1=value parameter2=value'.",
						);
					}
				}
				// Check for invalid separators
				const cleaned = trimmed.replace(/[^\s,;=\w.+-]/g, "");
				if (cleaned !== trimmed) {
					throw new PyXFormError(
						"Expecting parameters to be in the form of 'parameter1=value parameter2=value'.",
					);
				}
			}
		}

		questionDict[constants.PARAMETERS] = parseParameters(rawParamsStr);
	}

	// Type-specific parameter validation
	const params = questionDict[constants.PARAMETERS] as
		| Record<string, string>
		| undefined;

	// Audit validation
	if (type === "audit") {
		validateAuditParams(params ?? {}, name, questionDict);
	}

	// Incremental parameter handling for geoshape/geotrace
	if (params && "incremental" in params) {
		if (type === "geoshape" || type === "geotrace") {
			const incVal = params.incremental;
			const INCREMENTAL_ALIASES = new Set(["true", "yes", "true()"]);
			if (!INCREMENTAL_ALIASES.has(incVal)) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the 'parameters' value is invalid. For geoshape and geotrace questions, the 'incremental' parameter may either be 'true' or not included.`,
				);
			}
			// Normalize to "true"
			params.incremental = "true";
		}
	}

	// Geopoint/geoshape/geotrace validation
	if (GEO_TYPES.has(type) && params) {
		validateGeoParams(params, type, questionDict, rowNum);
	}

	// Audio quality validation
	if (type === "audio" && params) {
		validateAudioParams(params, questionDict);
	}

	// Background-audio quality validation and action setup
	if (type === "background-audio") {
		if (params) {
			validateAudioParams(params, questionDict, true);
		}
		// Add odk:recordaudio action
		const recordAudioAction: Record<string, string> = {
			name: "odk:recordaudio",
			event: "odk-instance-load",
		};
		if (params?.quality) {
			recordAudioAction["odk:quality"] = params.quality;
		}
		if (!questionDict.actions) questionDict.actions = [];
		(questionDict.actions as Record<string, string>[]).push(recordAudioAction);
	}

	// Photo/image parameter validation
	if ((type === "photo" || type === "image") && params) {
		const allowedImageParams = new Set(["app", "max-pixels"]);
		const invalidParams = Object.keys(params).filter(
			(k) => !allowedImageParams.has(k),
		);
		if (invalidParams.length > 0) {
			throw new PyXFormError(
				`Accepted parameters are '${[...allowedImageParams].sort().join(", ")}'. The following are invalid parameter(s): '${invalidParams.join(", ")}'.`,
			);
		}
	}
	// Photo/image max-pixels parameter
	if (type === "photo" || type === "image") {
		if (params?.["max-pixels"]) {
			const mp = params["max-pixels"];
			if (!/^\d+$/.test(mp)) {
				throw new PyXFormError(
					"Parameter max-pixels must have an integer value.",
				);
			}
			if (!questionDict[constants.BIND]) questionDict[constants.BIND] = {};
			(questionDict[constants.BIND] as FormRecord)["orx:max-pixels"] = mp;
		} else {
			warnings.push(
				`[row : ${rowNum}] Use the max-pixels parameter to speed up submission sending and save storage space. Learn more: https://xlsform.org/#image`,
			);
		}

		// App parameter → intent attribute on control
		if (params && "app" in params) {
			const appearance = (
				(questionDict[constants.CONTROL] as FormRecord | undefined)
					?.appearance ?? ""
			)
				.toString()
				.trim();
			if (!appearance || appearance === "annotate") {
				const appPackageName = String(params.app);
				const validationResult = validateAndroidPackageName(appPackageName);
				if (validationResult === null) {
					if (!questionDict[constants.CONTROL])
						questionDict[constants.CONTROL] = {};
					(questionDict[constants.CONTROL] as FormRecord).intent =
						appPackageName;
				} else {
					throw new PyXFormError(`[row : ${rowNum}] ${validationResult}`);
				}
			}
		}
	}

	// Range validation
	if (type === "range" && params) {
		validateRangeParams(params, questionDict, rowNum, choices, settings);
	}

	// Select parameter validation - always ensure parameters dict exists for selects
	if (selectFromFileMatch || selectExternalMatch || selectMatch) {
		if (!questionDict[constants.PARAMETERS]) {
			questionDict[constants.PARAMETERS] = {};
		}
		const selectParamsAllowed = ["randomize", "seed"];
		if (selectFromFileMatch) {
			selectParamsAllowed.push("value", "label");
		}
		if (params) {
			const extras = Object.keys(params).filter(
				(k) => !selectParamsAllowed.includes(k),
			);
			if (extras.length > 0) {
				throw new PyXFormError(
					`Accepted parameters are '${selectParamsAllowed.sort().join(", ")}'. The following are invalid parameter(s): '${extras.sort().join(", ")}'.`,
				);
			}
		}
		if (selectFromFileMatch && params) {
			if (params.value && !isXmlTag(params.value)) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the 'parameters (value)' value is invalid. Names must begin with a letter or underscore. After the first character, names may contain letters, digits, underscores, hyphens, or periods.`,
				);
			}
			if (params.label && !isXmlTag(params.label)) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the 'parameters (label)' value is invalid. Names must begin with a letter or underscore. After the first character, names may contain letters, digits, underscores, hyphens, or periods.`,
				);
			}
		}
		// Randomize parameter validation
		if (params) {
			if (
				params.randomize &&
				params.randomize !== "true" &&
				params.randomize !== "True" &&
				params.randomize !== "false"
			) {
				throw new PyXFormError(
					`[row : ${rowNum}] randomize must be set to true or false: '${params.randomize}' is an invalid value`,
				);
			}
			if (params.seed && !params.randomize) {
				throw new PyXFormError(
					`[row : ${rowNum}] Parameters must include randomize=true to use a seed.`,
				);
			}
			if (params.seed) {
				const seedVal = params.seed;
				// seed must be a number or a ${reference}
				const isNum = /^-?\d+(\.\d+)?$/.test(seedVal);
				const isRef = /^\$\{[^}]+\}$/.test(seedVal);
				if (!isNum && !isRef) {
					throw new PyXFormError(
						`[row : ${rowNum}] seed value must be a number or a reference to another field.`,
					);
				}
			}
		}
	}

	// Rows parameter validation (for text/multiline inputs)
	if (params && "rows" in params) {
		const rowsVal = params.rows;
		if (!rowsVal || !/^\d+$/.test(rowsVal)) {
			throw new PyXFormError(
				`[row : ${rowNum}] Parameter rows must have an integer value.`,
			);
		}
	}

	if (listName) {
		questionDict[constants.ITEMSET] = listName;
		questionDict[constants.LIST_NAME_U] = listName;

		// For select_one_external with choice_filter, set query to list_name
		const choiceFilter =
			questionDict[constants.CHOICE_FILTER] ||
			row[constants.CHOICE_FILTER] ||
			row.choice_filter ||
			"";
		if (type === constants.SELECT_ONE_EXTERNAL && choiceFilter) {
			questionDict.query = listName;
		}

		// Attach choices
		if (choices[listName]) {
			questionDict[constants.CHOICES] = choices[listName];
		}
	}

	if (orOther) {
		questionDict.or_other = true;
	}

	// Attach OSM tags for osm question types
	if (type === "osm" && listName && osmTags[listName]) {
		const tags = osmTags[listName].map((tag) => ({ ...tag }));
		for (const tag of tags) {
			if (tag.name && osmTags[tag.name as string]) {
				tag.choices = osmTags[tag.name as string];
			}
		}
		questionDict.tags = tags;
	}

	return questionDict;
}

// --- SurveyReader and parseFileToJson ---

import * as path from "node:path";
import { getXlsform } from "./xls2json-backends.js";

/**
 * A wrapper for workbookToJson. Reads a file and converts to JSON dict.
 */
export function parseFileToJson(
	filePath: string,
	opts?: {
		defaultName?: string;
		defaultLanguage?: string;
		warnings?: string[];
	},
): FormRecord {
	const defaultName = opts?.defaultName ?? constants.DEFAULT_FORM_NAME;
	const defaultLanguage =
		opts?.defaultLanguage ?? constants.DEFAULT_LANGUAGE_VALUE;
	const warnings = opts?.warnings ?? [];

	const workbookDict = getXlsform(filePath);
	return workbookToJson({
		workbookDict,
		formName: defaultName,
		fallbackFormName: workbookDict.fallback_form_name,
		defaultLanguage,
		warnings,
	});
}

/**
 * SurveyReader wraps parseFileToJson with the old interface:
 * create a reader, then call toJsonDict().
 */
export class SurveyReader {
	private _dict: FormRecord;
	private _path: string;
	private _warnings: string[];
	_name: string;

	constructor(pathOrFile: string, defaultName?: string) {
		this._path = pathOrFile;
		this._warnings = [];
		const name =
			defaultName ?? path.basename(pathOrFile, path.extname(pathOrFile));
		this._name = name;
		this._dict = parseFileToJson(pathOrFile, {
			defaultName: name,
			warnings: this._warnings,
		});
	}

	toJsonDict(): FormRecord {
		return this._dict;
	}
}
