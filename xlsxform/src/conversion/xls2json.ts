/**
 * Convert workbook data (from XLS/XLSX/MD) to the JSON intermediate format
 * that the builder uses to construct Survey objects.
 */

import * as aliases from "../aliases.js";
import * as constants from "../constants.js";
import {
	applyEntitiesDeclarations,
	getEntityDeclarations,
	getEntityVariableReferences,
} from "../entities.js";
import { PyXFormError } from "../errors.js";
import { isXmlTag } from "../parsing/expression.js";
import {
	cleanTextValues,
	extractHeaders,
	findSheetMisspellings,
	toSnakeCase,
} from "../parsing/sheet-headers.js";
import {
	TranslationChecker,
	formatMissingTranslationsMsg,
} from "../translations.js";
import type { FormRecord } from "../types.js";
import { validateChoices } from "../validators/choices.js";
import { validateAndroidPackageName } from "../validators/question-params.js";
import type { DefinitionData } from "./backends/index.js";
import { processSurveyRows } from "./survey-processing.js";

/**
 * Look up a value in a row by key, trying the exact key first then case-insensitive match.
 * Python's dealias_and_group_headers normalizes known headers to snake_case,
 * so LIST_NAME/List Name become list_name. This function emulates that lookup.
 */
function getRowValue(row: FormRecord, ...keys: string[]): string | undefined {
	for (const key of keys) {
		if (row[key] != null && row[key] !== "") {
			return String(row[key]);
		}
	}
	// Try case-insensitive match (snake_case normalization)
	for (const key of keys) {
		for (const rowKey of Object.keys(row)) {
			if (
				toSnakeCase(rowKey) === key &&
				row[rowKey] != null &&
				row[rowKey] !== ""
			) {
				return String(row[rowKey]);
			}
		}
	}
	return undefined;
}

/**
 * Main conversion function: workbook dict → JSON for builder.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported from pyxform
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
					if (h) {
						choicesHeaders.push(h);
					}
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

	// Known option column names (matching Python's Option.get_slot_names()).
	// When a header normalizes to one of these, use the normalized form;
	// otherwise preserve the original for choice_filter expressions.
	const optionColumns = new Set(["name", "label", "media", "sms_option"]);
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
		const listName =
			getRowValue(row, constants.LIST_NAME_S, constants.LIST_NAME_U) ?? "";
		if (!listName) {
			continue;
		}

		if (!choicesByListName[listName]) {
			choicesByListName[listName] = [];
		}

		const choice: FormRecord = {};
		for (const [k, rawV] of Object.entries(row)) {
			const kNorm = toSnakeCase(k);
			if (kNorm === constants.LIST_NAME_S || kNorm === constants.LIST_NAME_U) {
				continue;
			}
			const v = cleanTextValues(rawV);
			if (v == null || v === "") {
				continue;
			}

			// Handle grouped columns: media::audio, media::image::English, etc.
			const parts = k.split(choicesDelimiter).map((p) => p.trim());
			if (parts.length >= 2 && parts[0].toLowerCase() === "media") {
				// media::audio or media::audio::English
				const mediaType = parts[1]; // e.g., "audio", "image", "big-image", "video"
				if (parts.length === 3) {
					// media::audio::English → translated media
					const lang = parts[2];
					if (!choice.media) {
						choice.media = {};
					}
					const choiceMedia1 = choice.media as FormRecord;
					if (!choiceMedia1[mediaType]) {
						choiceMedia1[mediaType] = {};
					}
					if (typeof choiceMedia1[mediaType] === "string") {
						// Convert to object for translations
						choiceMedia1[mediaType] = {};
					}
					(choiceMedia1[mediaType] as FormRecord)[lang] = v;
				} else {
					// media::audio → untranslated media
					if (!choice.media) {
						choice.media = {};
					}
					(choice.media as FormRecord)[mediaType] = v;
				}
				continue;
			}

			// Handle translation columns like "label::English"
			if (parts.length === 2) {
				const baseCol = parts[0];
				const lang = parts[1];
				// Check if it's a translatable column (case-insensitive)
				const baseColNorm = toSnakeCase(baseCol);
				const alias =
					aliases.listHeader[baseColNorm] ?? aliases.listHeader[baseCol];
				// Handle array aliases like ["media", "audio"] → audio::de means media.audio for lang de
				if (Array.isArray(alias) && alias[0] === "media") {
					const mediaType = alias[1]; // e.g., "audio", "image"
					if (!choice.media) {
						choice.media = {};
					}
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
				const targetKey =
					alias && typeof alias === "string" ? alias : baseColNorm;
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

			// Dealias choice headers (case-insensitive)
			const alias = aliases.listHeader[kNorm] ?? aliases.listHeader[k];
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
				if (!choice[alias[0]]) {
					choice[alias[0]] = {};
				}
				(choice[alias[0]] as FormRecord)[alias[1]] = v;
			} else {
				// Normalize known option columns (e.g. NAME → name) but preserve
				// unknown columns as-is for choice_filter expressions.
				choice[optionColumns.has(kNorm) ? kNorm : k] = v;
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
			if (
				header === constants.LIST_NAME_S ||
				header === constants.LIST_NAME_U
			) {
				continue;
			}
			// Skip translated headers (e.g. "label::English (en)") - the language part can contain spaces
			if (header.includes("::")) {
				continue;
			}
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
	validateChoices(settings, warnings, choicesData);

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
		const ln = (
			getRowValue(row, constants.LIST_NAME_S, constants.LIST_NAME_U) ?? ""
		).trim();
		if (ln) {
			externalChoicesListNames.add(ln);
		}
	}

	// Process OSM sheet - group tags by list_name
	const osmTags: Record<string, FormRecord[]> = {};
	const osmData = workbookDict.osm ?? [];
	for (const row of osmData) {
		const ln = (
			getRowValue(row, constants.LIST_NAME_S, constants.LIST_NAME_U) ?? ""
		).trim();
		if (ln) {
			if (!osmTags[ln]) {
				osmTags[ln] = [];
			}
			// Normalize known option columns (e.g. NAME → name)
			const normalizedRow: FormRecord = {};
			for (const [k, v] of Object.entries(row)) {
				const kn = toSnakeCase(k);
				if (kn === constants.LIST_NAME_S || kn === constants.LIST_NAME_U) {
					continue;
				}
				normalizedRow[optionColumns.has(kn) ? kn : k] = v;
			}
			osmTags[ln].push(normalizedRow);
		}
	}

	const children = processSurveyRows({
		rows: surveyRows,
		choices: choicesByListName,
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
		stripWhitespace: cleanTextValuesEnabled,
		workbookDict,
		osmTags,
	});

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
	for (const key of [
		constants.VERSION,
		constants.STYLE,
		constants.PUBLIC_KEY,
		constants.SUBMISSION_URL,
		constants.AUTO_SEND,
		constants.AUTO_DELETE,
		constants.CLIENT_EDITABLE,
		constants.NAMESPACES,
		"instance_xmlns",
		constants.COMPACT_PREFIX,
		constants.COMPACT_DELIMITER,
	]) {
		if (settings[key]) {
			result[key] = settings[key];
		}
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
