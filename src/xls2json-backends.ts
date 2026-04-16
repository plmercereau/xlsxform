/**
 * Backend for reading XLSForm data from various formats.
 * Supports: markdown tables, dict input, xlsx files.
 */

import * as constants from "./constants.js";

export interface DefinitionData {
	survey: Record<string, any>[];
	choices: Record<string, any>[];
	settings: Record<string, any>[];
	external_choices: Record<string, any>[];
	entities: Record<string, any>[];
	osm: Record<string, any>[];
	survey_header?: string[][];
	choices_header?: string[][];
	external_choices_header?: string[][];
	fallback_form_name?: string;
	sheet_names?: string[];
}

/**
 * Parse markdown tables into a DefinitionData structure.
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
				const restCells = cells.slice(1).map((c) => c.trim()).filter(Boolean);
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
				Object.fromEntries(headers.filter(h => h !== "").map(h => [h, null])),
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
		if (content[i] === "\\" && i + 1 < content.length && content[i + 1] === "|") {
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
export function dictToDefinitionData(
	d: Record<string, any>,
): DefinitionData {
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
 * Get XLSForm data from various input types.
 */
export function getXlsform(
	xlsform: string | Record<string, any>,
	fileType?: string,
): DefinitionData {
	if (typeof xlsform === "string") {
		// Check if it's markdown
		if (fileType === "md" || xlsform.includes("|")) {
			return mdToDict(xlsform);
		}
		throw new PyXFormError(`Unsupported input type: string without markdown format`);
	}

	if (typeof xlsform === "object" && !Array.isArray(xlsform)) {
		// It's a dict/ss_structure
		return dictToDefinitionData(xlsform);
	}

	throw new PyXFormError(`Unsupported xlsform input type.`);
}

// Local import to avoid circular dependency
class PyXFormError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PyXFormError";
	}
}
