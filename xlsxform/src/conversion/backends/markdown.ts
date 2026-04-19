/**
 * Markdown table → DefinitionData conversion.
 */

import type { DefinitionData, FormRow } from "./types.js";

const VALID_SHEET_NAMES = new Set([
	"survey",
	"choices",
	"settings",
	"external_choices",
	"entities",
	"osm",
]);

/** Try to parse a sheet header line. Returns the new sheet name and headers, or null. */
function parseMdSheetHeader(
	cells: string[],
): { sheetName: string | null; headers: string[] } | null {
	const firstCell = cells[0].trim();
	if (!firstCell) {
		return null;
	}
	const sheetName = firstCell.toLowerCase();
	if (!VALID_SHEET_NAMES.has(sheetName)) {
		return { sheetName: null, headers: [] };
	}
	const restCells = cells
		.slice(1)
		.map((c) => c.trim())
		.filter(Boolean);
	return { sheetName, headers: restCells };
}

/** Build a data row from cells using headers, with settings-specific empty handling. */
function buildMdDataRow(
	headers: string[],
	dataCells: string[],
	isSettings: boolean,
): { row: FormRow; hasData: boolean } {
	const row: FormRow = {};
	let hasData = false;
	for (let i = 0; i < headers.length; i++) {
		const value = i < dataCells.length ? dataCells[i] : "";
		if (value !== "") {
			row[headers[i]] = value;
			hasData = true;
		} else if (isSettings) {
			row[headers[i]] = "";
		}
	}
	return { row, hasData };
}

/**
 * Parse a markdown table row into cells.
 * Handles escaped pipes (\|) within cells.
 */
function parseMdRow(line: string): string[] {
	// Remove leading and trailing pipe
	let content = line;
	if (content.startsWith("|")) {
		content = content.substring(1);
	}
	if (content.endsWith("|")) {
		content = content.substring(0, content.length - 1);
	}

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
		if (!trimmed?.startsWith("|")) {
			continue;
		}

		const cells = parseMdRow(trimmed);
		if (cells.length === 0) {
			continue;
		}

		const sheetHeader = parseMdSheetHeader(cells);
		if (sheetHeader !== null) {
			result.sheet_names?.push(cells[0].trim());
			currentSheet = sheetHeader.sheetName;
			headers = sheetHeader.headers;
			continue;
		}

		const dataCells = cells.slice(1).map((c) => c.trim());
		if (!currentSheet) {
			continue;
		}

		if (headers.length === 0) {
			headers = dataCells;
			const headerKey = `${currentSheet}_header` as keyof DefinitionData;
			(result as unknown as Record<string, unknown>)[headerKey] = [
				Object.fromEntries(
					headers.filter((h) => h !== "").map((h) => [h, null]),
				),
			];
			continue;
		}

		const { row, hasData } = buildMdDataRow(
			headers,
			dataCells,
			currentSheet === "settings",
		);
		if ((hasData || currentSheet === "settings") && currentSheet in result) {
			(result as unknown as Record<string, unknown[]>)[currentSheet].push(row);
		}
	}

	return result;
}
