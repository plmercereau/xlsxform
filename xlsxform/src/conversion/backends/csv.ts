/**
 * CSV → DefinitionData conversion.
 */

import type { DefinitionData, FormRow } from "./types.js";

/**
 * Parse a CSV line respecting quoted fields.
 */
/** Consume characters inside a quoted CSV field, returning the new index. */
function consumeQuotedField(
	line: string,
	startIndex: number,
): { value: string; nextIndex: number } {
	let current = "";
	let i = startIndex;
	while (i < line.length) {
		if (line[i] !== '"') {
			current += line[i];
			i++;
			continue;
		}
		// Found a quote: check for escaped quote or end of field
		if (i + 1 < line.length && line[i + 1] === '"') {
			current += '"';
			i += 2;
		} else {
			i++; // skip closing quote
			break;
		}
	}
	return { value: current, nextIndex: i };
}

function parseCsvLine(line: string): string[] {
	const fields: string[] = [];
	let current = "";
	let i = 0;

	while (i < line.length) {
		const ch = line[i];
		if (ch === '"') {
			const result = consumeQuotedField(line, i + 1);
			current += result.value;
			i = result.nextIndex;
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

/** Build a FormRow from CSV data cells using the given headers. */
function buildCsvDataRow(headers: string[], dataCells: string[]): FormRow {
	const row: FormRow = {};
	for (let i = 0; i < headers.length; i++) {
		const v = i < dataCells.length ? dataCells[i] : "";
		if (v !== "") {
			row[headers[i]] = v;
		}
	}
	return row;
}

/** Store headers or a data row into the result for the given sheet. */
function processCsvDataCells(
	result: DefinitionData,
	sheetName: string,
	restCols: string[],
	currentHeaders: string[] | null,
): string[] | null {
	if (currentHeaders === null) {
		const headerKey = `${sheetName}_header` as keyof DefinitionData;
		(result as unknown as Record<string, unknown>)[headerKey] =
			listToDictList(restCols);
		return restCols;
	}
	const row = buildCsvDataRow(currentHeaders, restCols);
	if (sheetName in result) {
		(result as unknown as Record<string, unknown[]>)[sheetName].push(row);
	}
	return currentHeaders;
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
		if (!line.trim()) {
			continue;
		}
		const row = parseCsvLine(line);
		const firstCol = row[0]?.trim() || "";
		const restCols = row.slice(1).map((v) => String(v).trim());

		if (firstCol !== "") {
			result.sheet_names?.push(firstCol);
			sheetName = firstCol.toLowerCase();
			currentHeaders = null;
		}

		const hasContent = restCols.some((c) => c !== "");
		if (hasContent && sheetName) {
			currentHeaders = processCsvDataCells(
				result,
				sheetName,
				restCols,
				currentHeaders,
			);
		}
	}

	return result;
}
