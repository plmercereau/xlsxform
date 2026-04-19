/**
 * XLSX WorkBook → DefinitionData conversion.
 */

import * as constants from "../../constants.js";
import { PyXFormError } from "../../errors.js";
import type {
	CellValue,
	FormRow,
	XlsxCell,
	XlsxWorkBook,
	XlsxWorkSheet,
} from "./types.js";

/**
 * Convert a cell value to string, displaying integers without decimal.
 */
function xlsxValueToStr(value: CellValue): string {
	if (value === true) {
		return "TRUE";
	}
	if (value === false) {
		return "FALSE";
	}
	if (typeof value === "number") {
		if (Number.isInteger(value)) {
			return String(value);
		}
		return String(value);
	}
	if (value instanceof Date) {
		const y = value.getUTCFullYear();
		const mo = String(value.getUTCMonth() + 1).padStart(2, "0");
		const d = String(value.getUTCDate()).padStart(2, "0");
		const h = String(value.getUTCHours()).padStart(2, "0");
		const mi = String(value.getUTCMinutes()).padStart(2, "0");
		const s = String(value.getUTCSeconds()).padStart(2, "0");
		return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
	}
	let str = String(value);
	if (str.includes("\u00a0")) {
		str = str.replace(/\u00a0/g, " ");
	}
	return str;
}

// Re-export for use by index.ts
export { xlsxValueToStr };

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
		if (!m) {
			return { r: 0, c: 0 };
		}
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
	if (value == null) {
		return true;
	}
	if (typeof value === "string") {
		if (!value || value.trim() === "") {
			return true;
		}
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

/** Read raw header values from the first row of a sheet. */
function extractRawHeaders(
	sheet: XlsxWorkSheet,
	range: ReturnType<typeof decodeRange>,
): (string | null)[] {
	const rawHeaders: (string | null)[] = [];
	for (let c = range.s.c; c <= range.e.c; c++) {
		const cell = sheet[encodeCell(range.s.r, c)] as XlsxCell | undefined;
		rawHeaders.push(cell?.v != null ? String(cell.v) : null);
	}
	return rawHeaders;
}

/** Read a single row from a sheet, returning a FormRow keyed by headers. */
function readSheetRow(
	sheet: XlsxWorkSheet,
	row: number,
	colStart: number,
	headers: (string | null)[],
): FormRow {
	const rowDict: FormRow = {};
	for (let c = 0; c < headers.length; c++) {
		const key = headers[c];
		if (key === null) {
			continue;
		}
		const cell = sheet[encodeCell(row, colStart + c)] as XlsxCell | undefined;
		if (cell == null || isEmpty(cell.v)) {
			continue;
		}
		const value = typeof cell.v === "string" ? cell.v.trim() : cell.v;
		if (!isEmpty(value)) {
			rowDict[key] = xlsxValueToStr(value as CellValue);
		}
	}
	return rowDict;
}

function listToDictList(items: string[]): Record<string, null>[] {
	if (items.length > 0) {
		const d: Record<string, null> = {};
		for (const item of items) {
			if (item) {
				d[item] = null;
			}
		}
		return [d];
	}
	return [];
}

function sheetToRows(
	sheet: XlsxWorkSheet,
): [FormRow[], Record<string, null>[]] {
	const range = decodeRange(sheet["!ref"] || "A1");
	const rawHeaders = extractRawHeaders(sheet, range);
	const headers = getExcelColumnHeaders(rawHeaders);
	const columnHeaderList = headers.filter((h): h is string => h !== null);
	const headerDictList = listToDictList(columnHeaderList);

	const maxAdjacentEmptyRows = 60;
	let adjacentEmptyRows = 0;
	const resultRows: FormRow[] = [];

	for (let r = range.s.r + 1; r <= range.e.r; r++) {
		const rowDict = readSheetRow(sheet, r, range.s.c, headers);

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
 * Convert an XLSX WorkBook into raw sheet data.
 * Returns a raw dict that needs to be passed through toDefinitionData().
 */
export function workbookToDictRaw(wb: XlsxWorkBook): Record<string, unknown> {
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

	return raw;
}
