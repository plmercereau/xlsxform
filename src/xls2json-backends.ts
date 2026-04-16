/**
 * Backend for reading XLSForm data from various formats.
 * Supports: markdown tables, dict input, xlsx/xls/csv files.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as constants from "./constants.js";
import { PyXFormError } from "./errors.js";

// Use xlsx (SheetJS) for reading XLS/XLSX files
import * as XLSX from "xlsx";

export interface DefinitionData {
	survey: Record<string, any>[];
	choices: Record<string, any>[];
	settings: Record<string, any>[];
	external_choices: Record<string, any>[];
	entities: Record<string, any>[];
	osm: Record<string, any>[];
	survey_header?: Record<string, null>[];
	choices_header?: Record<string, null>[];
	settings_header?: Record<string, null>[];
	external_choices_header?: Record<string, null>[];
	entities_header?: Record<string, null>[];
	osm_header?: Record<string, null>[];
	fallback_form_name?: string;
	sheet_names?: string[];
}

const RE_WHITESPACE = /( )+/g;

function isEmpty(value: any): boolean {
	if (value == null) return true;
	if (typeof value === "string") {
		if (!value || value.trim() === "") return true;
	}
	return false;
}

function listToDictList(items: (string | null)[]): Record<string, null>[] {
	if (items && items.length > 0) {
		const d: Record<string, null> = {};
		for (const item of items) {
			if (item != null) {
				d[String(item)] = null;
			}
		}
		return [d];
	}
	return [];
}

function trimTrailingEmpty<T>(list: T[], nEmpty: number): T[] {
	if (nEmpty > 0) {
		return list.slice(0, list.length - nEmpty);
	}
	return list;
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

/**
 * Convert a numeric value to string, displaying integers without decimal.
 */
export function xlsxValueToStr(value: any): string {
	if (value === true) return "TRUE";
	if (value === false) return "FALSE";
	if (typeof value === "number") {
		if (Number.isInteger(value)) {
			return String(value);
		}
		// Check if it's a float that represents an integer
		if (Math.floor(value) === value) {
			return String(Math.floor(value));
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
	value: any,
	valueType: number,
	datemode: number,
): string {
	// xlrd cell types
	const XL_CELL_BOOLEAN = 4;
	const XL_CELL_NUMBER = 2;
	const XL_CELL_DATE = 3;

	if (valueType === XL_CELL_BOOLEAN) {
		return value ? "TRUE" : "FALSE";
	}
	if (valueType === XL_CELL_NUMBER) {
		const intValue = Math.floor(value);
		if (intValue === value) {
			return String(intValue);
		}
		return String(value);
	}
	if (valueType === XL_CELL_DATE) {
		// Handle date values - use XLSX date parsing
		try {
			const dateObj = XLSX.SSF.parse_date_code(value);
			if (dateObj.y === 0 && dateObj.m === 0 && dateObj.d === 0) {
				// Time only
				const h = String(dateObj.H).padStart(2, "0");
				const m = String(dateObj.M).padStart(2, "0");
				const s = String(dateObj.S).padStart(2, "0");
				return `${h}:${m}:${s}`;
			}
			const y = String(dateObj.y);
			const mo = String(dateObj.m).padStart(2, "0");
			const d = String(dateObj.d).padStart(2, "0");
			const h = String(dateObj.H).padStart(2, "0");
			const mi = String(dateObj.M).padStart(2, "0");
			const s = String(dateObj.S).padStart(2, "0");
			return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
		} catch {
			return String(value);
		}
	}
	// Default: ensure string and replace nbsp
	return String(value).replace(/\u00a0/g, " ");
}

function readWorkbook(filePath: string): XLSX.WorkBook {
	const data = fs.readFileSync(filePath);
	return XLSX.read(data, { cellDates: true });
}

/**
 * Read an XLSX file and return a dict structure.
 */
export function xlsxToDict(pathOrFile: string): Record<string, any> {
	try {
		const wb = readWorkbook(pathOrFile);
		return processWorkbook(wb);
	} catch (e: any) {
		if (e instanceof PyXFormError) throw e;
		throw new PyXFormError(`Error reading .xlsx file: ${e.message}`);
	}
}

/**
 * Read an XLS file and return a dict structure.
 */
export function xlsToDict(pathOrFile: string): Record<string, any> {
	try {
		const wb = readWorkbook(pathOrFile);
		return processWorkbook(wb);
	} catch (e: any) {
		if (e instanceof PyXFormError) throw e;
		throw new PyXFormError(`Error reading .xls file: ${e.message}`);
	}
}

function processWorkbook(wb: XLSX.WorkBook): Record<string, any> {
	const resultBook: Record<string, any> = { sheet_names: [] };

	for (const sheetName of wb.SheetNames) {
		resultBook.sheet_names.push(sheetName);
		const sheetNameLower = sheetName.toLowerCase();
		const sheet = wb.Sheets[sheetName];

		if (!constants.SUPPORTED_SHEET_NAMES.has(sheetNameLower)) {
			if (wb.SheetNames.length === 1) {
				const [rows, header] = sheetToRows(sheet);
				resultBook[constants.SURVEY] = rows;
				resultBook[`${constants.SURVEY}_header`] = header;
			}
			continue;
		}

		const [rows, header] = sheetToRows(sheet);
		resultBook[sheetNameLower] = rows;
		resultBook[`${sheetNameLower}_header`] = header;
	}

	return resultBook;
}

function sheetToRows(
	sheet: XLSX.WorkSheet,
): [Record<string, any>[], Record<string, null>[]] {
	const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
	// Read first row as headers
	const rawHeaders: (string | null)[] = [];
	for (let c = range.s.c; c <= range.e.c; c++) {
		const cellAddr = XLSX.utils.encode_cell({ r: range.s.r, c });
		const cell = sheet[cellAddr];
		rawHeaders.push(cell ? String(cell.v) : null);
	}

	const headers = getExcelColumnHeaders(rawHeaders);
	const columnHeaderList = headers.filter((h): h is string => h !== null);
	const headerDictList = listToDictList(columnHeaderList);

	// Read data rows
	const maxAdjacentEmptyRows = 60;
	let adjacentEmptyRows = 0;
	const resultRows: Record<string, any>[] = [];

	for (let r = range.s.r + 1; r <= range.e.r; r++) {
		const rowDict: Record<string, any> = {};
		for (let c = 0; c < headers.length; c++) {
			const key = headers[c];
			if (key === null) continue;
			const cellAddr = XLSX.utils.encode_cell({ r, c: range.s.c + c });
			const cell = sheet[cellAddr];
			if (cell != null && !isEmpty(cell.v)) {
				let value = cell.v;
				if (typeof value === "string") {
					value = value.trim();
				}
				if (!isEmpty(value)) {
					rowDict[key] = xlsxValueToStr(value);
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
 * Read a CSV file and return a dict structure.
 */
export function csvToDict(pathOrFile: string): Record<string, any> {
	try {
		const content = fs.readFileSync(pathOrFile, "utf-8");
		return processCsvData(content);
	} catch (e: any) {
		throw new PyXFormError(`Error reading .csv file: ${e.message}`);
	}
}

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

function processCsvData(content: string): Record<string, any> {
	const lines = content.split(/\r?\n/);
	const _dict: Record<string, any> = { sheet_names: [] };
	let sheetName: string | null = null;
	let currentHeaders: string[] | null = null;

	for (const line of lines) {
		if (!line.trim()) continue;
		const row = parseCsvLine(line);

		const firstCol = row[0]?.trim() || "";
		const restCols = row.slice(1).map((v) => String(v).trim());

		if (firstCol !== "") {
			// This is a sheet name
			sheetName = firstCol;
			if (sheetName && !(sheetName in _dict)) {
				_dict.sheet_names.push(sheetName);
				const lowerName = sheetName.toLowerCase();
				_dict[lowerName] = [];
				sheetName = lowerName;
			} else {
				sheetName = sheetName.toLowerCase();
			}
			currentHeaders = null;
		}

		const hasContent = restCols.some((c) => c !== "");
		if (hasContent && sheetName) {
			if (currentHeaders === null) {
				currentHeaders = restCols;
				_dict[`${sheetName}_header`] = listToDictList(currentHeaders);
			} else {
				const d: Record<string, any> = {};
				for (let i = 0; i < currentHeaders.length; i++) {
					const v = i < restCols.length ? restCols[i] : "";
					if (v !== "") {
						d[currentHeaders[i]] = v;
					}
				}
				_dict[sheetName].push(d);
			}
		}
	}

	return _dict;
}

// --- Markdown backend (file-based version) ---

const MD_COMMENT = /^\s*#/;
const MD_COMMENT_INLINE = /^(.*)(#[^|]+)$/;
const MD_CELL = /\s*\|(.*)\|\s*/;
const MD_SEPARATOR = /^[\|-]+$/;
const MD_PIPE_OR_ESCAPE = /(?<!\\)\|/;

function mdStrpCell(cell: string): string | null {
	if (!cell || cell.trim() === "") return null;
	return cell.trim().replace(/\\\|/g, "|");
}

function mdTableToSsStructure(
	mdstr: string,
): Record<string, (string | null)[][]> {
	let sheetName: string | false = false;
	let sheetArr: (string | null)[][] | false = false;
	const sheets: Record<string, (string | null)[][]> = {};

	for (let line of mdstr.split("\n")) {
		if (MD_COMMENT.test(line)) continue;

		const inlineMatch = MD_COMMENT_INLINE.exec(line);
		if (inlineMatch) {
			line = inlineMatch[1];
		}

		const match = MD_CELL.exec(line);
		if (match) {
			const mtchstr = match[1];
			if (!MD_SEPARATOR.test(mtchstr)) {
				const rowSplit = mtchstr.split(MD_PIPE_OR_ESCAPE);
				const firstCol = mdStrpCell(rowSplit[0]);
				const row = rowSplit.slice(1).map(mdStrpCell);

				if (firstCol === null && row.every((c) => c === null)) continue;

				if (firstCol !== null) {
					if (sheetArr !== false && sheetName !== false) {
						sheets[sheetName] = sheetArr;
					}
					sheetArr = [];
					sheetName = firstCol;
				}

				if (sheetName && row.some((c) => c !== null)) {
					(sheetArr as (string | null)[][]).push(row);
				}
			}
			if (sheetName !== false && sheetArr !== false) {
				sheets[sheetName] = sheetArr;
			}
		}
	}

	return sheets;
}

/**
 * File-based md_to_dict - reads an .md file and returns a dict structure.
 * This matches the Python md_to_dict function signature for file paths.
 */
export function mdToDictFromFile(pathOrFile: string): Record<string, any> {
	try {
		const content = fs.readFileSync(pathOrFile, "utf-8");
		return processMdData(content);
	} catch (e: any) {
		throw new PyXFormError(`Error reading .md file: ${e.message}`);
	}
}

function processMdData(mdStr: string): Record<string, any> {
	const resultBook: Record<string, any> = { sheet_names: [] };
	const ssStructure = mdTableToSsStructure(mdStr);

	for (const [sheet, contents] of Object.entries(ssStructure)) {
		resultBook.sheet_names.push(sheet);
		const sheetNameLower = sheet.toLowerCase();

		if (!constants.SUPPORTED_SHEET_NAMES.has(sheetNameLower)) {
			if (Object.keys(ssStructure).length === 1) {
				resultBook[constants.SURVEY] = listToDicts(contents);
				resultBook[`${constants.SURVEY}_header`] = listToDictList(
					contents[0]?.filter((h): h is string => h !== null) ?? [],
				);
			}
			continue;
		}

		resultBook[sheetNameLower] = listToDicts(contents);
		resultBook[`${sheetNameLower}_header`] = listToDictList(
			contents[0]?.filter((h): h is string => h !== null) ?? [],
		);
	}

	return resultBook;
}

function listToDicts(arr: (string | null)[][]): Record<string, any>[] {
	if (arr.length === 0) return [];
	const headers = arr[0];
	return arr.slice(1).map((row) => {
		const d: Record<string, any> = {};
		for (let i = 0; i < row.length; i++) {
			if (
				i < headers.length &&
				headers[i] !== null &&
				row[i] !== null &&
				row[i] !== ""
			) {
				d[headers[i]!] = row[i];
			}
		}
		return d;
	});
}

// --- Inline markdown parser for test md strings (existing mdToDict) ---

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
			result.sheet_names!.push(firstCell);

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
			(result as any)[headerKey] = [
				Object.fromEntries(
					headers.filter((h) => h !== "").map((h) => [h, null]),
				),
			];
			continue;
		}

		// This is a data row
		const row: Record<string, any> = {};
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
			(result as any)[currentSheet].push(row);
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

/**
 * Convert a dict (ss_structure) directly to DefinitionData.
 */
export function dictToDefinitionData(d: Record<string, any>): DefinitionData {
	return {
		survey: d.survey ?? [],
		choices: d.choices ?? [],
		settings: d.settings ?? [],
		external_choices: d.external_choices ?? [],
		entities: d.entities ?? [],
		osm: d.osm ?? [],
		fallback_form_name: d.fallback_form_name,
	};
}

/**
 * Convert a raw dict result (from file backends) to DefinitionData.
 */
function rawDictToDefinitionData(
	d: Record<string, any>,
	fallbackFormName?: string,
): DefinitionData {
	return {
		survey: d.survey ?? [],
		choices: d.choices ?? [],
		settings: d.settings ?? [],
		external_choices: d.external_choices ?? [],
		entities: d.entities ?? [],
		osm: d.osm ?? [],
		survey_header: d.survey_header,
		choices_header: d.choices_header,
		settings_header: d.settings_header,
		external_choices_header: d.external_choices_header,
		entities_header: d.entities_header,
		osm_header: d.osm_header,
		sheet_names: d.sheet_names,
		fallback_form_name: fallbackFormName,
	};
}

/**
 * Determine file type and call appropriate backend.
 */
function getProcessorForFileType(
	filePath: string,
): (p: string) => Record<string, any> {
	const ext = path.extname(filePath).toLowerCase();
	switch (ext) {
		case ".xlsx":
		case ".xlsm":
			return xlsxToDict;
		case ".xls":
			return xlsToDict;
		case ".csv":
			return csvToDict;
		case ".md":
			return mdToDictFromFile;
		default:
			throw new PyXFormError(
				`Unsupported file type: ${ext}. Must be one of: .xlsx, .xlsm, .xls, .csv, .md`,
			);
	}
}

/**
 * Get XLSForm data from various input types (file paths, dicts, or md strings).
 */
export function getXlsform(
	xlsform: string | Record<string, any>,
	fileType?: string,
): DefinitionData {
	if (typeof xlsform === "object" && !Array.isArray(xlsform)) {
		// It's a dict/ss_structure
		return dictToDefinitionData(xlsform);
	}

	if (typeof xlsform === "string") {
		// Check if it's a file path
		try {
			if (fs.existsSync(xlsform)) {
				const processor = getProcessorForFileType(xlsform);
				const rawDict = processor(xlsform);
				const stem = path.basename(xlsform, path.extname(xlsform));
				return rawDictToDefinitionData(rawDict, stem);
			}
		} catch (e: any) {
			if (e instanceof PyXFormError) throw e;
			// Fall through to try as markdown
		}

		// Check if it's markdown
		if (fileType === "md" || xlsform.includes("|")) {
			return mdToDict(xlsform);
		}
		throw new PyXFormError(
			"Unsupported input type: string without markdown format",
		);
	}

	throw new PyXFormError("Unsupported xlsform input type.");
}

/**
 * Convert an XLS/CSV file to a CSV string representation.
 * Used for testing equivalency between formats.
 */
export function convertFileToCsvString(filePath: string): string {
	let importedSheets: Record<string, any>;
	if (filePath.endsWith(".csv")) {
		importedSheets = csvToDict(filePath);
	} else {
		importedSheets = xlsToDict(filePath);
	}

	const lines: string[] = [];
	for (const [sheetName, rows] of Object.entries(importedSheets)) {
		if (sheetName === "sheet_names") continue;
		if (sheetName.endsWith("_header")) continue;
		if (!Array.isArray(rows)) continue;

		lines.push(csvEscapeField(sheetName));
		const outKeys: string[] = [];
		const outRows: string[][] = [];

		for (const row of rows as Record<string, any>[]) {
			const outRow: (string | null)[] = [];
			for (const key of Object.keys(row)) {
				if (!outKeys.includes(key)) {
					outKeys.push(key);
				}
			}
			for (const outKey of outKeys) {
				outRow.push(row[outKey] ?? null);
			}
			outRows.push(outRow as string[]);
		}

		// Write header row
		const headerFields = [null, ...outKeys].map((f) =>
			f === null ? "" : csvEscapeField(f),
		);
		lines.push(headerFields.join(","));

		// Write data rows
		for (const outRow of outRows) {
			const fields = [null, ...outRow].map((f) =>
				f === null ? "" : csvEscapeField(String(f)),
			);
			lines.push(fields.join(","));
		}
	}

	return `${lines.join("\n")}\n`;
}

function csvEscapeField(field: string): string {
	if (field.includes(",") || field.includes('"') || field.includes("\n")) {
		return `"${field.replace(/"/g, '""')}"`;
	}
	return field;
}
