/**
 * Node.js file-reading backends for XLSForm data.
 * These functions require node:fs and should only be imported in Node.js environments.
 * WorkBook→DefinitionData conversion is handled by the library's workbookToDict.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as constants from "../../src/constants.js";
import type { DefinitionData } from "../../src/conversion/backends/index.js";
import { workbookToDict } from "../../src/conversion/backends/index.js";
import { PyXFormError } from "../../src/errors.js";

import * as XLSX from "xlsx";

/** A single row of form data with string keys and string values. */
type FormRow = Record<string, string>;

/** The raw dict structure returned by file-reading backends before conversion to DefinitionData. */
type RawFormDict = Record<string, unknown>;

function readWorkbook(filePath: string): XLSX.WorkBook {
	const data = fs.readFileSync(filePath);
	return XLSX.read(data, { cellDates: true });
}

/**
 * Convert a WorkBook to a sparse raw dict (only populated sheets have keys).
 * This preserves the format expected by equivalency tests.
 */
function workbookToRawDict(wb: XLSX.WorkBook): RawFormDict {
	const def = workbookToDict(wb);
	const raw: RawFormDict = { sheet_names: def.sheet_names };
	for (const key of [
		"survey",
		"choices",
		"settings",
		"external_choices",
		"entities",
		"osm",
	] as const) {
		const headerKey = `${key}_header` as keyof typeof def;
		const header = def[headerKey];
		if (header) {
			// If headers exist, include both rows (even if empty) and headers
			raw[key] = def[key];
			raw[`${key}_header`] = header;
		}
	}
	return raw;
}

/**
 * Read an XLSX file and return a raw dict structure.
 */
export function xlsxToDict(pathOrFile: string): RawFormDict {
	try {
		const wb = readWorkbook(pathOrFile);
		return workbookToRawDict(wb);
	} catch (e: unknown) {
		if (e instanceof PyXFormError) {
			throw e;
		}
		throw new PyXFormError(`Error reading .xlsx file: ${(e as Error).message}`);
	}
}

/**
 * Read an XLS file and return a raw dict structure.
 */
export function xlsToDict(pathOrFile: string): RawFormDict {
	try {
		const wb = readWorkbook(pathOrFile);
		return workbookToRawDict(wb);
	} catch (e: unknown) {
		if (e instanceof PyXFormError) {
			throw e;
		}
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

function handleQuotedChar(
	line: string,
	i: number,
	current: string,
): { current: string; i: number; inQuotes: boolean } {
	const ch = line[i];
	if (ch === '"') {
		if (i + 1 < line.length && line[i + 1] === '"') {
			return { current: `${current}"`, i: i + 2, inQuotes: true };
		}
		return { current, i: i + 1, inQuotes: false };
	}
	return { current: current + ch, i: i + 1, inQuotes: true };
}

function parseCsvLine(line: string): string[] {
	const fields: string[] = [];
	let current = "";
	let inQuotes = false;
	let i = 0;

	while (i < line.length) {
		const ch = line[i];
		if (inQuotes) {
			const result = handleQuotedChar(line, i, current);
			current = result.current;
			i = result.i;
			inQuotes = result.inQuotes;
		} else if (ch === '"') {
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
	fields.push(current);
	return fields;
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

function updateCsvSheetName(
	firstCol: string,
	_dict: RawFormDict,
	state: { sheetName: string | null; currentHeaders: string[] | null },
): void {
	state.sheetName = firstCol;
	if (state.sheetName in _dict) {
		state.sheetName = state.sheetName.toLowerCase();
	} else {
		(_dict.sheet_names as string[]).push(state.sheetName);
		const lowerName = state.sheetName.toLowerCase();
		_dict[lowerName] = [];
		state.sheetName = lowerName;
	}
	state.currentHeaders = null;
}

function addCsvContentRow(
	restCols: string[],
	_dict: RawFormDict,
	state: { sheetName: string; currentHeaders: string[] | null },
): void {
	if (state.currentHeaders === null) {
		state.currentHeaders = restCols;
		_dict[`${state.sheetName}_header`] = listToDictList(state.currentHeaders);
	} else {
		const d: FormRow = {};
		for (let i = 0; i < state.currentHeaders.length; i++) {
			const v = i < restCols.length ? restCols[i] : "";
			if (v !== "") {
				d[state.currentHeaders[i]] = v;
			}
		}
		(_dict[state.sheetName] as FormRow[]).push(d);
	}
}

function processCsvRow(
	line: string,
	_dict: RawFormDict,
	state: { sheetName: string | null; currentHeaders: string[] | null },
): void {
	if (!line.trim()) {
		return;
	}
	const row = parseCsvLine(line);
	const firstCol = row[0]?.trim() || "";
	const restCols = row.slice(1).map((v) => String(v).trim());

	if (firstCol !== "") {
		updateCsvSheetName(firstCol, _dict, state);
	}

	const hasContent = restCols.some((c) => c !== "");
	if (hasContent && state.sheetName) {
		addCsvContentRow(
			restCols,
			_dict,
			state as { sheetName: string; currentHeaders: string[] | null },
		);
	}
}

function processCsvData(content: string): RawFormDict {
	const lines = content.split(/\r?\n/);
	const _dict: RawFormDict = { sheet_names: [] };
	const state = {
		sheetName: null as string | null,
		currentHeaders: null as string[] | null,
	};

	for (const line of lines) {
		processCsvRow(line, _dict, state);
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
	if (!cell || cell.trim() === "") {
		return null;
	}
	return cell.trim().replace(/\\\|/g, "|");
}

function processMdRow(
	mtchstr: string,
	sheets: Record<string, (string | null)[][]>,
	state: { sheetName: string | false; sheetArr: (string | null)[][] | false },
): void {
	if (MD_SEPARATOR.test(mtchstr)) {
		return;
	}
	const rowSplit = mtchstr.split(MD_PIPE_OR_ESCAPE);
	const firstCol = mdStrpCell(rowSplit[0]);
	const row = rowSplit.slice(1).map(mdStrpCell);

	if (firstCol === null && row.every((c) => c === null)) {
		return;
	}

	if (firstCol !== null) {
		if (state.sheetArr !== false && state.sheetName !== false) {
			sheets[state.sheetName] = state.sheetArr;
		}
		state.sheetArr = [];
		state.sheetName = firstCol;
	}

	if (state.sheetName && row.some((c) => c !== null)) {
		(state.sheetArr as (string | null)[][]).push(row);
	}
}

function processMdLine(
	line: string,
	sheets: Record<string, (string | null)[][]>,
	state: { sheetName: string | false; sheetArr: (string | null)[][] | false },
): void {
	if (MD_COMMENT.test(line)) {
		return;
	}

	const inlineMatch = MD_COMMENT_INLINE.exec(line);
	const cleanLine = inlineMatch ? inlineMatch[1] : line;

	const match = MD_CELL.exec(cleanLine);
	if (!match) {
		return;
	}

	processMdRow(match[1], sheets, state);

	if (state.sheetName !== false && state.sheetArr !== false) {
		sheets[state.sheetName] = state.sheetArr;
	}
}

function mdTableToSsStructure(
	mdstr: string,
): Record<string, (string | null)[][]> {
	const sheets: Record<string, (string | null)[][]> = {};
	const state = {
		sheetName: false as string | false,
		sheetArr: false as (string | null)[][] | false,
	};

	for (const line of mdstr.split("\n")) {
		processMdLine(line, sheets, state);
	}

	return sheets;
}

function listToDicts(arr: (string | null)[][]): FormRow[] {
	if (arr.length === 0) {
		return [];
	}
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

function csvEscapeField(field: string): string {
	if (field.includes(",") || field.includes('"') || field.includes("\n")) {
		return `"${field.replace(/"/g, '""')}"`;
	}
	return field;
}

function processSheetToCsvLines(
	sheetName: string,
	rows: FormRow[],
	lines: string[],
): void {
	lines.push(csvEscapeField(sheetName));
	const outKeys: string[] = [];
	const outRows: string[][] = [];

	for (const row of rows) {
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
		if (
			sheetName === "sheet_names" ||
			sheetName.endsWith("_header") ||
			!Array.isArray(rows)
		) {
			continue;
		}
		processSheetToCsvLines(sheetName, rows as FormRow[], lines);
	}

	return `${lines.join("\n")}\n`;
}
