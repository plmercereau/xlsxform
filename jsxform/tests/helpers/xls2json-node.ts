/**
 * Node.js file-based wrappers for xls2json.
 */

import * as path from "node:path";
import * as constants from "../../src/constants.js";
import { getXlsform } from "../../src/xls2json-backends.js";
import { workbookToJson } from "../../src/xls2json.js";
import { getXlsformFromFile } from "./xls2json-backends-node.js";

interface FormRecord {
	[key: string]: unknown;
}

/**
 * A wrapper for workbookToJson. Reads a file and converts to JSON dict.
 */
export function parseFileToJson(
	filePath: string,
	opts?: {
		defaultName?: string;
		defaultLanguage?: string;
		warnings?: string[];
	},
): FormRecord {
	const defaultName = opts?.defaultName ?? constants.DEFAULT_FORM_NAME;
	const defaultLanguage =
		opts?.defaultLanguage ?? constants.DEFAULT_LANGUAGE_VALUE;
	const warnings = opts?.warnings ?? [];

	// Try as dict/md string first (browser-safe), then as file path
	let workbookDict: import("../../src/xls2json-backends.js").DefinitionData;
	try {
		workbookDict = getXlsform(filePath);
	} catch {
		workbookDict = getXlsformFromFile(filePath);
	}
	return workbookToJson({
		workbookDict,
		formName: defaultName,
		fallbackFormName: workbookDict.fallback_form_name,
		defaultLanguage,
		warnings,
	});
}

/**
 * SurveyReader wraps parseFileToJson with the old interface:
 * create a reader, then call toJsonDict().
 */
export class SurveyReader {
	private _dict: FormRecord;
	private _path: string;
	private _warnings: string[];
	_name: string;

	constructor(pathOrFile: string, defaultName?: string) {
		this._path = pathOrFile;
		this._warnings = [];
		const name =
			defaultName ?? path.basename(pathOrFile, path.extname(pathOrFile));
		this._name = name;
		this._dict = parseFileToJson(pathOrFile, {
			defaultName: name,
			warnings: this._warnings,
		});
	}

	toJsonDict(): FormRecord {
		return this._dict;
	}
}
