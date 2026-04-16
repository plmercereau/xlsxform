/**
 * Backend for reading XLSForm data from various formats.
 * Supports markdown tables and dict input.
 */

import { PyXFormError } from "./errors.js";

/** A single row of form data with string keys and string values. */
type FormRow = Record<string, string>;

/** Cell value types that can appear in spreadsheet cells. */
type CellValue = string | number | boolean | Date;

export interface DefinitionData {
	survey: FormRow[];
	choices: FormRow[];
	settings: FormRow[];
	external_choices: FormRow[];
	entities: FormRow[];
	osm: FormRow[];
	survey_header?: Record<string, null>[];
	choices_header?: Record<string, null>[];
	settings_header?: Record<string, null>[];
	external_choices_header?: Record<string, null>[];
	entities_header?: Record<string, null>[];
	osm_header?: Record<string, null>[];
	fallback_form_name?: string;
	sheet_names?: string[];
}

/**
 * Convert a numeric value to string, displaying integers without decimal.
 */
export function xlsxValueToStr(value: CellValue): string {
	if (value === true) return "TRUE";
	if (value === false) return "FALSE";
	if (typeof value === "number") {
		if (Number.isInteger(value)) {
			return String(value);
		}
		return String(value);
	}
	if (value instanceof Date) {
		// Format date as "YYYY-MM-DD HH:MM:SS" to match Python datetime output
		const y = value.getUTCFullYear();
		const mo = String(value.getUTCMonth() + 1).padStart(2, "0");
		const d = String(value.getUTCDate()).padStart(2, "0");
		const h = String(value.getUTCHours()).padStart(2, "0");
		const mi = String(value.getUTCMinutes()).padStart(2, "0");
		const s = String(value.getUTCSeconds()).padStart(2, "0");
		return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
	}
	// Replace non-breaking spaces
	let s = String(value);
	if (s.includes("\u00a0")) {
		s = s.replace(/\u00a0/g, " ");
	}
	return s;
}

/**
 * Convert an XLS cell value to unicode string (equivalent to Python xls_value_to_unicode).
 */
export function xlsValueToUnicode(
	value: CellValue,
	valueType: number,
	_datemode: number,
): string {
	// xlrd cell types
	const XL_CELL_BOOLEAN = 4;
	const XL_CELL_NUMBER = 2;
	const XL_CELL_DATE = 3;

	if (valueType === XL_CELL_BOOLEAN) {
		return value ? "TRUE" : "FALSE";
	}
	if (valueType === XL_CELL_NUMBER) {
		const intValue = Math.floor(value as number);
		if (intValue === value) {
			return String(intValue);
		}
		return String(value);
	}
	if (valueType === XL_CELL_DATE) {
		// Handle date values - needs XLSX SSF for proper parsing
		// In browser context, fall back to string conversion
		return String(value);
	}
	// Default: ensure string and replace nbsp
	return String(value).replace(/\u00a0/g, " ");
}

// --- Inline markdown parser for md strings ---

/**
 * Parse markdown tables into a DefinitionData structure.
 * This is the inline version used by tests with md strings.
 * Format:
 *   | survey |
 *   |        | type | name | label |
 *   |        | text | q1   | Q1    |
 */
export function mdToDict(md: string): DefinitionData {
	const result: DefinitionData = {
		survey: [],
		choices: [],
		settings: [],
		external_choices: [],
		entities: [],
		osm: [],
		sheet_names: [],
	};

	const lines = md.split("\n");
	let currentSheet: string | null = null;
	let headers: string[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || !trimmed.startsWith("|")) continue;

		// Parse cells from the pipe-delimited line
		const cells = parseMdRow(trimmed);
		if (cells.length === 0) continue;

		// Check if this is a sheet header line (first cell is non-empty)
		const firstCell = cells[0].trim();
		if (firstCell) {
			// Record original sheet name for misspelling detection
			result.sheet_names?.push(firstCell);

			// This is a sheet name declaration
			const sheetName = firstCell.toLowerCase();
			if (
				sheetName === "survey" ||
				sheetName === "choices" ||
				sheetName === "settings" ||
				sheetName === "external_choices" ||
				sheetName === "entities" ||
				sheetName === "osm"
			) {
				currentSheet = sheetName;
				headers = [];

				// Check if remaining cells are headers
				const restCells = cells
					.slice(1)
					.map((c) => c.trim())
					.filter(Boolean);
				if (restCells.length > 0) {
					headers = restCells;
				}
			} else {
				currentSheet = null;
			}
			continue;
		}

		// First cell is empty - this is either headers or data
		const dataCells = cells.slice(1).map((c) => c.trim());

		if (!currentSheet) continue;

		if (headers.length === 0) {
			// This row is the header row
			headers = dataCells;
			// Store headers for the sheet (excluding empty headers)
			const headerKey = `${currentSheet}_header` as keyof DefinitionData;
			(result as unknown as Record<string, unknown>)[headerKey] = [
				Object.fromEntries(
					headers.filter((h) => h !== "").map((h) => [h, null]),
				),
			];
			continue;
		}

		// This is a data row
		const row: FormRow = {};
		let hasData = false;
		for (let i = 0; i < headers.length; i++) {
			const value = i < dataCells.length ? dataCells[i] : "";
			if (value !== "") {
				row[headers[i]] = value;
				hasData = true;
			} else if (currentSheet === "settings") {
				// For settings, preserve empty values so we know the header was present
				row[headers[i]] = "";
			}
		}

		if ((hasData || currentSheet === "settings") && currentSheet in result) {
			(result as unknown as Record<string, unknown[]>)[currentSheet].push(row);
		}
	}

	return result;
}

/**
 * Parse a markdown table row into cells.
 * Handles escaped pipes (\|) within cells.
 */
function parseMdRow(line: string): string[] {
	// Remove leading and trailing pipe
	let content = line;
	if (content.startsWith("|")) content = content.substring(1);
	if (content.endsWith("|")) content = content.substring(0, content.length - 1);

	// Split by | but not \|
	const cells: string[] = [];
	let current = "";
	for (let i = 0; i < content.length; i++) {
		if (
			content[i] === "\\" &&
			i + 1 < content.length &&
			content[i + 1] === "|"
		) {
			current += "|";
			i++;
		} else if (content[i] === "|") {
			cells.push(current);
			current = "";
		} else {
			current += content[i];
		}
	}
	cells.push(current);

	return cells;
}

// --- Inline CSV parser for XLSForm CSV strings ---

/**
 * Parse a CSV line respecting quoted fields.
 */
function parseCsvLine(line: string): string[] {
	const fields: string[] = [];
	let current = "";
	let inQuotes = false;
	let i = 0;

	while (i < line.length) {
		const ch = line[i];
		if (inQuotes) {
			if (ch === '"') {
				if (i + 1 < line.length && line[i + 1] === '"') {
					current += '"';
					i += 2;
				} else {
					inQuotes = false;
					i++;
				}
			} else {
				current += ch;
				i++;
			}
		} else {
			if (ch === '"') {
				inQuotes = true;
				i++;
			} else if (ch === ",") {
				fields.push(current);
				current = "";
				i++;
			} else {
				current += ch;
				i++;
			}
		}
	}
	fields.push(current);
	return fields;
}

function listToDictList(items: string[]): Record<string, null>[] {
	if (items.length > 0) {
		const d: Record<string, null> = {};
		for (const item of items) {
			if (item) d[item] = null;
		}
		return [d];
	}
	return [];
}

/**
 * Parse an XLSForm CSV string into DefinitionData.
 * XLSForm CSV format: first column is the sheet name, subsequent columns are data.
 */
export function csvToDict(content: string): DefinitionData {
	const lines = content.split(/\r?\n/);
	const result: DefinitionData = {
		survey: [],
		choices: [],
		settings: [],
		external_choices: [],
		entities: [],
		osm: [],
		sheet_names: [],
	};

	let sheetName: string | null = null;
	let currentHeaders: string[] | null = null;

	for (const line of lines) {
		if (!line.trim()) continue;
		const row = parseCsvLine(line);

		const firstCol = row[0]?.trim() || "";
		const restCols = row.slice(1).map((v) => String(v).trim());

		if (firstCol !== "") {
			result.sheet_names?.push(firstCol);
			const lowerName = firstCol.toLowerCase();
			sheetName = lowerName;
			currentHeaders = null;
		}

		const hasContent = restCols.some((c) => c !== "");
		if (hasContent && sheetName) {
			if (currentHeaders === null) {
				currentHeaders = restCols;
				const headerKey = `${sheetName}_header` as keyof DefinitionData;
				(result as unknown as Record<string, unknown>)[headerKey] =
					listToDictList(currentHeaders);
			} else {
				const d: FormRow = {};
				for (let i = 0; i < currentHeaders.length; i++) {
					const v = i < restCols.length ? restCols[i] : "";
					if (v !== "") {
						d[currentHeaders[i]] = v;
					}
				}
				if (sheetName in result) {
					(result as unknown as Record<string, unknown[]>)[sheetName].push(d);
				}
			}
		}
	}

	return result;
}

/**
 * Convert a dict (ss_structure) directly to DefinitionData.
 */
export function dictToDefinitionData(
	d: Record<string, unknown>,
): DefinitionData {
	return {
		survey: (d.survey ?? []) as FormRow[],
		choices: (d.choices ?? []) as FormRow[],
		settings: (d.settings ?? []) as FormRow[],
		external_choices: (d.external_choices ?? []) as FormRow[],
		entities: (d.entities ?? []) as FormRow[],
		osm: (d.osm ?? []) as FormRow[],
		survey_header: d.survey_header as Record<string, null>[] | undefined,
		choices_header: d.choices_header as Record<string, null>[] | undefined,
		settings_header: d.settings_header as Record<string, null>[] | undefined,
		external_choices_header: d.external_choices_header as
			| Record<string, null>[]
			| undefined,
		entities_header: d.entities_header as Record<string, null>[] | undefined,
		osm_header: d.osm_header as Record<string, null>[] | undefined,
		sheet_names: d.sheet_names as string[] | undefined,
		fallback_form_name: d.fallback_form_name as string | undefined,
	};
}

/**
 * Get XLSForm data from dict or markdown string inputs.
 */
export function getXlsform(
	xlsform: string | Record<string, unknown>,
	fileType?: string,
): DefinitionData {
	if (typeof xlsform === "object" && !Array.isArray(xlsform)) {
		// It's a dict/ss_structure
		return dictToDefinitionData(xlsform);
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
