/**
 * Node.js file-reading backends for XLSForm data.
 * These functions require node:fs and should only be imported in Node.js environments.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as constants from "../../src/constants.js";
import { PyXFormError } from "../../src/errors.js";
import type { DefinitionData } from "../../src/xls2json-backends.js";
import { xlsxValueToStr } from "../../src/xls2json-backends.js";

import * as XLSX from "xlsx";

/** A single row of form data with string keys and string values. */
type FormRow = Record<string, string>;

/** The raw dict structure returned by file-reading backends before conversion to DefinitionData. */
type RawFormDict = Record<string, unknown>;

const RE_WHITESPACE = /( )+/g;

function isEmpty(value: unknown): boolean {
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

function readWorkbook(filePath: string): XLSX.WorkBook {
	const data = fs.readFileSync(filePath);
	return XLSX.read(data, { cellDates: true });
}

function processWorkbook(wb: XLSX.WorkBook): RawFormDict {
	const resultBook: RawFormDict = { sheet_names: [] };

	for (const sheetName of wb.SheetNames) {
		(resultBook.sheet_names as string[]).push(sheetName);
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
): [FormRow[], Record<string, null>[]] {
	const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
	const rawHeaders: (string | null)[] = [];
	for (let c = range.s.c; c <= range.e.c; c++) {
		const cellAddr = XLSX.utils.encode_cell({ r: range.s.r, c });
		const cell = sheet[cellAddr];
		rawHeaders.push(cell ? String(cell.v) : null);
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
 * Read an XLSX file and return a dict structure.
 */
export function xlsxToDict(pathOrFile: string): RawFormDict {
	try {
		const wb = readWorkbook(pathOrFile);
		return processWorkbook(wb);
	} catch (e: unknown) {
		if (e instanceof PyXFormError) throw e;
		throw new PyXFormError(`Error reading .xlsx file: ${(e as Error).message}`);
	}
}

/**
 * Read an XLS file and return a dict structure.
 */
export function xlsToDict(pathOrFile: string): RawFormDict {
	try {
		const wb = readWorkbook(pathOrFile);
		return processWorkbook(wb);
	} catch (e: unknown) {
		if (e instanceof PyXFormError) throw e;
		throw new PyXFormError(`Error reading .xls file: ${(e as Error).message}`);
	}
}

/**
 * Read a CSV file and return a dict structure.
 */
export function csvToDict(pathOrFile: string): RawFormDict {
	try {
		const content = fs.readFileSync(pathOrFile, "utf-8");
		return processCsvData(content);
	} catch (e: unknown) {
		throw new PyXFormError(`Error reading .csv file: ${(e as Error).message}`);
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

function processCsvData(content: string): RawFormDict {
	const lines = content.split(/\r?\n/);
	const _dict: RawFormDict = { sheet_names: [] };
	let sheetName: string | null = null;
	let currentHeaders: string[] | null = null;

	for (const line of lines) {
		if (!line.trim()) continue;
		const row = parseCsvLine(line);

		const firstCol = row[0]?.trim() || "";
		const restCols = row.slice(1).map((v) => String(v).trim());

		if (firstCol !== "") {
			sheetName = firstCol;
			if (sheetName && !(sheetName in _dict)) {
				(_dict.sheet_names as string[]).push(sheetName);
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
				const d: FormRow = {};
				for (let i = 0; i < currentHeaders.length; i++) {
					const v = i < restCols.length ? restCols[i] : "";
					if (v !== "") {
						d[currentHeaders[i]] = v;
					}
				}
				(_dict[sheetName] as FormRow[]).push(d);
			}
		}
	}

	return _dict;
}

/**
 * File-based md_to_dict - reads an .md file and returns a dict structure.
 */
export function mdToDictFromFile(pathOrFile: string): RawFormDict {
	try {
		const content = fs.readFileSync(pathOrFile, "utf-8");
		return processMdData(content);
	} catch (e: unknown) {
		throw new PyXFormError(`Error reading .md file: ${(e as Error).message}`);
	}
}

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

function listToDicts(arr: (string | null)[][]): FormRow[] {
	if (arr.length === 0) return [];
	const headers = arr[0];
	return arr.slice(1).map((row) => {
		const d: FormRow = {};
		for (let i = 0; i < row.length; i++) {
			if (
				i < headers.length &&
				headers[i] !== null &&
				row[i] !== null &&
				row[i] !== ""
			) {
				const headerKey = headers[i];
				const cellValue = row[i];
				if (headerKey !== null && cellValue !== null) {
					d[headerKey] = cellValue;
				}
			}
		}
		return d;
	});
}

function processMdData(mdStr: string): RawFormDict {
	const resultBook: RawFormDict = { sheet_names: [] };
	const ssStructure = mdTableToSsStructure(mdStr);

	for (const [sheet, contents] of Object.entries(ssStructure)) {
		(resultBook.sheet_names as string[]).push(sheet);
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

/**
 * Convert a raw dict result (from file backends) to DefinitionData.
 */
function rawDictToDefinitionData(
	d: RawFormDict,
	fallbackFormName?: string,
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
		fallback_form_name: fallbackFormName,
	};
}

/**
 * Determine file type and call appropriate backend.
 */
function getProcessorForFileType(filePath: string): (p: string) => RawFormDict {
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
 * Get XLSForm data from a file path. Node.js only.
 */
export function getXlsformFromFile(filePath: string): DefinitionData {
	if (!fs.existsSync(filePath)) {
		throw new PyXFormError(`File not found: ${filePath}`);
	}
	const processor = getProcessorForFileType(filePath);
	const rawDict = processor(filePath);
	const stem = path.basename(filePath, path.extname(filePath));
	return rawDictToDefinitionData(rawDict, stem);
}

/**
 * Convert an XLS/CSV file to a CSV string representation.
 * Used for testing equivalency between formats.
 */
export function convertFileToCsvString(filePath: string): string {
	let importedSheets: RawFormDict;
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

		for (const row of rows as FormRow[]) {
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

		const headerFields = [null, ...outKeys].map((f) =>
			f === null ? "" : csvEscapeField(f),
		);
		lines.push(headerFields.join(","));

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
