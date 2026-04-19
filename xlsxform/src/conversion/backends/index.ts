/**
 * Backend dispatcher for reading XLSForm data from various formats.
 */

import { PyXFormError } from "../../errors.js";
import { csvToDict } from "./csv.js";
import { mdToDict } from "./markdown.js";
import type { DefinitionData, FormRow, XlsxWorkBook } from "./types.js";
import { workbookToDictRaw } from "./xlsx.js";

export type {
	CellValue,
	DefinitionData,
	FormRow,
	XlsxWorkBook,
	XlsxWorkSheet,
	XlsxCell,
} from "./types.js";
export { xlsxValueToStr } from "./xlsx.js";
export { mdToDict } from "./markdown.js";
export { csvToDict } from "./csv.js";

const SHEET_KEYS = [
	"survey",
	"choices",
	"settings",
	"external_choices",
	"entities",
	"osm",
] as const;

/** Coerce a loose dict into a typed DefinitionData. */
export function toDefinitionData(
	d: Record<string, unknown>,
	fallbackFormName?: string,
): DefinitionData {
	const result = { fallback_form_name: fallbackFormName } as DefinitionData;
	for (const key of SHEET_KEYS) {
		result[key] = (d[key] ?? []) as FormRow[];
		const hKey = `${key}_header` as keyof DefinitionData;
		if (d[hKey]) {
			(result as unknown as Record<string, unknown>)[hKey] = d[hKey];
		}
	}
	result.sheet_names = d.sheet_names as string[] | undefined;
	return result;
}

/** Type guard for XlsxWorkBook. */
export function isWorkBook(obj: unknown): obj is XlsxWorkBook {
	return (
		typeof obj === "object" &&
		obj !== null &&
		"SheetNames" in obj &&
		"Sheets" in obj &&
		Array.isArray((obj as XlsxWorkBook).SheetNames)
	);
}

/**
 * Convert an XLSX WorkBook into DefinitionData.
 */
export function workbookToDict(
	wb: XlsxWorkBook,
	fallbackFormName?: string,
): DefinitionData {
	const raw = workbookToDictRaw(wb);
	return toDefinitionData(raw, fallbackFormName);
}

/**
 * Get XLSForm data from WorkBook, string, or dict inputs.
 */
export function getXlsform(
	xlsform: string | XlsxWorkBook | Record<string, unknown>,
	fileType?: string,
): DefinitionData {
	if (isWorkBook(xlsform)) {
		return workbookToDict(xlsform);
	}

	if (typeof xlsform === "object" && !Array.isArray(xlsform)) {
		return toDefinitionData(xlsform);
	}

	if (typeof xlsform === "string") {
		if (fileType === "csv") {
			return csvToDict(xlsform);
		}
		// Check if it's markdown
		if (fileType === "md" || xlsform.includes("|")) {
			return mdToDict(xlsform);
		}
		throw new PyXFormError(
			"Unsupported input type: string without markdown format. Pass fileType for CSV strings.",
		);
	}

	throw new PyXFormError("Unsupported xlsform input type.");
}
