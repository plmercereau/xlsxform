/**
 * Type-specific parameter validation for XLSForm question types.
 */

import * as constants from "../constants.js";
import { PyXFormError } from "../errors.js";
import type { FormRecord } from "../types.js";

// --- Helpers ---

export function ensureBind(questionDict: FormRecord): FormRecord {
	if (!questionDict[constants.BIND]) {
		questionDict[constants.BIND] = {};
	}
	return questionDict[constants.BIND] as FormRecord;
}

export function ensureControl(questionDict: FormRecord): FormRecord {
	if (!questionDict[constants.CONTROL]) {
		questionDict[constants.CONTROL] = {};
	}
	return questionDict[constants.CONTROL] as FormRecord;
}

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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported from pyxform
export function validateAuditParams(
	params: Record<string, string>,
	name: string,
	questionDict: FormRecord,
): void {
	// Check name
	if (name !== "audit") {
		throw new PyXFormError("Audits must always be named 'audit.'");
	}

	if (!params || Object.keys(params).length === 0) {
		return;
	}

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
	const bindDict = ensureBind(questionDict);
	for (const [k, v] of Object.entries(params)) {
		bindDict[`odk:${k}`] = v;
	}
}

// --- Geopoint/Geoshape/Geotrace parameter validation ---

export const GEO_TYPES = new Set(["geopoint", "geoshape", "geotrace"]);

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported from pyxform
export function validateGeoParams(
	params: Record<string, string>,
	type: string,
	questionDict: FormRecord,
	_rowNum?: number,
): void {
	if (!params || Object.keys(params).length === 0) {
		return;
	}

	for (const [k, v] of Object.entries(params)) {
		if (k === "allow-mock-accuracy") {
			if (v !== "true" && v !== "false") {
				throw new PyXFormError("Invalid value for allow-mock-accuracy.");
			}
			// Add to bind
			ensureBind(questionDict)[`odk:${k}`] = v;
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
			ensureControl(questionDict).accuracyThreshold = v;
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
			ensureControl(questionDict).unacceptableAccuracyThreshold = v;
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

export function validateAudioParams(
	params: Record<string, string>,
	questionDict: FormRecord,
	isBackground = false,
): void {
	if (!params || Object.keys(params).length === 0) {
		return;
	}

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
		ensureBind(questionDict)["odk:quality"] = val;
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

export function isMultiple(value: number, divisor: number): boolean {
	if (divisor === 0) {
		return true;
	}
	// Use a small epsilon for floating point comparison
	const ratio = value / divisor;
	return Math.abs(ratio - Math.round(ratio)) < 1e-9;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported from pyxform
export function validateRangeParams(
	params: Record<string, string>,
	questionDict: FormRecord,
	rowNum: number,
	choices: Record<string, FormRecord[]>,
	settings: FormRecord,
): void {
	if (!params) {
		return;
	}

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
		for (const choice of choiceList) {
			const choiceName = (choice[constants.NAME] ?? "").toString().trim();
			if (!choiceName) {
				continue;
			}
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
		for (const choice of choiceList) {
			const choiceName = (choice[constants.NAME] ?? "").toString().trim();
			if (!choiceName) {
				continue;
			}
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
			for (const choice of choiceList) {
				const choiceName = (choice[constants.NAME] ?? "").toString().trim();
				if (!choiceName) {
					continue;
				}
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
				if (!(uniqueChoices.has(startStr) && uniqueChoices.has(endStr))) {
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
		if (k === "tick_labelset") {
			return false;
		}
		const num = Number(v);
		return !Number.isNaN(num) && v.includes(".");
	});
	if (hasDecimalValue) {
		ensureBind(questionDict).type = "decimal";
	}
}

// --- Android package name validation ---

const PACKAGE_NAME_REGEX = /[^a-zA-Z0-9._]/;

export function validateAndroidPackageName(name: string): string | null {
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
