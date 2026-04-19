/**
 * Choices sheet validation for XLSForm.
 */

import * as constants from "../constants.js";
import { PyXFormError } from "../errors.js";
import {
	extractPyxformReferences,
	hasPyxformReference,
} from "../parsing/references.js";
import type { FormRecord } from "../types.js";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported from pyxform
export function validateChoices(
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
		if (!listName) {
			continue;
		}

		const choiceName = (row[constants.NAME] ?? row.value ?? "")
			.toString()
			.trim();
		const label = row[constants.LABEL] ?? row.label;

		// Check if there are translated labels (label::lang)
		const hasTranslatedLabel = Object.keys(row).some(
			(k) => k.startsWith("label::") || k.startsWith("label :"),
		);

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
 * Validate ${name} references in choice label and media columns.
 * Only label, label::lang, and supported media columns are validated.
 * Extra/unknown columns are not validated.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported from pyxform
export function validateChoiceReferences(
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
			if (typeof colVal !== "string") {
				continue;
			}
			if (!hasPyxformReference(colVal)) {
				continue;
			}

			// Determine if this column is a label or media column
			const baseCol = colKey.split("::")[0].trim().toLowerCase();
			const isLabelCol = LABEL_COLUMNS.has(baseCol);
			const isMediaCol = MEDIA_COLUMNS.has(baseCol);
			if (!(isLabelCol || isMediaCol)) {
				continue;
			}

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
