/**
 * Backend for reading XLSForm data from various formats.
 * Supports markdown tables, dict input, and XLSX WorkBook objects.
 */

import * as constants from "./constants.js";
import { PyXFormError } from "./errors.js";

/** A single row of form data with string keys and string values. */
type FormRow = Record<string, string>;

/** Cell value types that can appear in spreadsheet cells. */
type CellValue = string | number | boolean | Date;

// --- XLSX WorkBook types (duck-typed, no xlsx import needed) ---

/** Duck-typed XLSX worksheet cell. */
export interface XlsxCell {
	v?: CellValue;
}

/** Duck-typed XLSX worksheet — plain object keyed by cell addresses like "A1". */
export interface XlsxWorkSheet {
	"!ref"?: string;
	[cell: string]: unknown;
}

/** Duck-typed XLSX WorkBook. */
export interface XlsxWorkBook {
	SheetNames: string[];
	Sheets: Record<string, XlsxWorkSheet>;
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

const SHEET_KEYS = [
	"survey",
	"choices",
	"settings",
	"external_choices",
	"entities",
	"osm",
] as const;

/** Coerce a loose dict into a typed DefinitionData. */
function toDefinitionData(
	d: Record<string, unknown>,
	fallbackFormName?: string,
): DefinitionData {
	const result = { fallback_form_name: fallbackFormName } as DefinitionData;
	for (const key of SHEET_KEYS) {
		result[key] = (d[key] ?? []) as FormRow[];
		const hKey = `${key}_header` as keyof DefinitionData;
		if (d[hKey]) (result as unknown as Record<string, unknown>)[hKey] = d[hKey];
	}
	result.sheet_names = d.sheet_names as string[] | undefined;
	return result;
}

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

// --- WorkBook → DefinitionData conversion (isomorphic, no XLSX.utils needed) ---

const RE_WHITESPACE = /( )+/g;

/** Encode a 0-based (row, col) into an A1-style cell address. */
function encodeCell(row: number, col: number): string {
	let colStr = "";
	let c = col;
	do {
		colStr = String.fromCharCode(65 + (c % 26)) + colStr;
		c = Math.floor(c / 26) - 1;
	} while (c >= 0);
	return `${colStr}${row + 1}`;
}

/** Decode a range ref like "A1:D10" into start/end row/col. */
function decodeRange(ref: string): {
	s: { r: number; c: number };
	e: { r: number; c: number };
} {
	const parts = ref.split(":");
	const decode = (addr: string) => {
		const m = /^([A-Z]+)(\d+)$/.exec(addr);
		if (!m) return { r: 0, c: 0 };
		let c = 0;
		for (let i = 0; i < m[1].length; i++) {
			c = c * 26 + (m[1].charCodeAt(i) - 64);
		}
		return { r: Number(m[2]) - 1, c: c - 1 };
	};
	const s = decode(parts[0]);
	const e = parts.length > 1 ? decode(parts[1]) : s;
	return { s, e };
}

function isEmpty(value: unknown): boolean {
	if (value == null) return true;
	if (typeof value === "string") {
		if (!value || value.trim() === "") return true;
	}
	return false;
}

function getExcelColumnHeaders(
	firstRow: (string | null | undefined)[],
): (string | null)[] {
	const maxAdjacentEmptyCols = 20;
	const columnHeaderList: (string | null)[] = [];
	let adjacentEmptyCols = 0;

	for (const colHeader of firstRow) {
		if (isEmpty(colHeader)) {
			columnHeaderList.push(null);
			if (maxAdjacentEmptyCols === adjacentEmptyCols) {
				break;
			}
			adjacentEmptyCols++;
		} else {
			adjacentEmptyCols = 0;
			const header = String(colHeader);
			if (columnHeaderList.includes(header)) {
				throw new PyXFormError(`Duplicate column header: ${header}`);
			}
			const cleanHeader = header.trim().replace(RE_WHITESPACE, " ");
			columnHeaderList.push(cleanHeader);
		}
	}

	return trimTrailingEmpty(columnHeaderList, adjacentEmptyCols);
}

function trimTrailingEmpty<T>(list: T[], nEmpty: number): T[] {
	if (nEmpty > 0) {
		return list.slice(0, list.length - nEmpty);
	}
	return list;
}

function sheetToRows(
	sheet: XlsxWorkSheet,
): [FormRow[], Record<string, null>[]] {
	const range = decodeRange(sheet["!ref"] || "A1");
	const rawHeaders: (string | null)[] = [];
	for (let c = range.s.c; c <= range.e.c; c++) {
		const cellAddr = encodeCell(range.s.r, c);
		const cell = sheet[cellAddr] as XlsxCell | undefined;
		rawHeaders.push(cell?.v != null ? String(cell.v) : null);
	}

	const headers = getExcelColumnHeaders(rawHeaders);
	const columnHeaderList = headers.filter((h): h is string => h !== null);
	const headerDictList = listToDictList(columnHeaderList);

	const maxAdjacentEmptyRows = 60;
	let adjacentEmptyRows = 0;
	const resultRows: FormRow[] = [];

	for (let r = range.s.r + 1; r <= range.e.r; r++) {
		const rowDict: FormRow = {};
		for (let c = 0; c < headers.length; c++) {
			const key = headers[c];
			if (key === null) continue;
			const cellAddr = encodeCell(r, range.s.c + c);
			const cell = sheet[cellAddr] as XlsxCell | undefined;
			if (cell != null && !isEmpty(cell.v)) {
				let value = cell.v;
				if (typeof value === "string") {
					value = value.trim();
				}
				if (!isEmpty(value)) {
					rowDict[key] = xlsxValueToStr(value as CellValue);
				}
			}
		}

		if (Object.keys(rowDict).length === 0) {
			if (maxAdjacentEmptyRows === adjacentEmptyRows) {
				break;
			}
			adjacentEmptyRows++;
		} else {
			adjacentEmptyRows = 0;
		}
		resultRows.push(rowDict);
	}

	return [trimTrailingEmpty(resultRows, adjacentEmptyRows), headerDictList];
}

/**
 * Convert an XLSX WorkBook into DefinitionData.
 * Pure JS — no XLSX.utils needed.
 */
export function workbookToDict(
	wb: XlsxWorkBook,
	fallbackFormName?: string,
): DefinitionData {
	const raw: Record<string, unknown> = { sheet_names: [] };

	for (const sheetName of wb.SheetNames) {
		(raw.sheet_names as string[]).push(sheetName);
		const lower = sheetName.toLowerCase();
		const sheet = wb.Sheets[sheetName];

		if (!constants.SUPPORTED_SHEET_NAMES.has(lower)) {
			if (wb.SheetNames.length === 1) {
				const [rows, header] = sheetToRows(sheet);
				raw[constants.SURVEY] = rows;
				raw[`${constants.SURVEY}_header`] = header;
			}
			continue;
		}

		const [rows, header] = sheetToRows(sheet);
		raw[lower] = rows;
		raw[`${lower}_header`] = header;
	}

	return toDefinitionData(raw, fallbackFormName);
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
