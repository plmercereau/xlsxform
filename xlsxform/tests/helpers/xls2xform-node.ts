/**
 * Node.js conversion entry point: XLSForm → XForm.
 * Supports file paths in addition to dict/md string inputs.
 */

import {
	type DefinitionData,
	type XlsxWorkBook,
	getXlsform,
} from "../../src/conversion/backends/index.js";
import { workbookToJson } from "../../src/conversion/xls2json.js";
import { createSurveyElementFromDict } from "../../src/model/builder.js";
import { Survey } from "../../src/model/survey.js";
import { coalesce } from "../../src/utils.js";
import { getXlsformFromFile } from "./xls2json-backends-node.js";

export interface ConvertResult {
	xform: string;
	warnings: string[];
	itemsets: string | null;
	_pyxform: Record<string, unknown> | null;
	_survey: Survey | null;
}

export function convert(opts: {
	xlsform: string | XlsxWorkBook | Record<string, unknown>;
	warnings?: string[];
	validate?: boolean;
	prettyPrint?: boolean;
	enketo?: boolean;
	formName?: string | null;
	defaultLanguage?: string | null;
	fileType?: string | null;
}): ConvertResult {
	const warnings = coalesce(opts.warnings, []) as string[];

	let workbookDict: DefinitionData;
	try {
		workbookDict = getXlsform(opts.xlsform, opts.fileType ?? undefined);
	} catch {
		// If browser-safe getXlsform fails (e.g. file path string), try Node.js file reading
		if (typeof opts.xlsform === "string") {
			workbookDict = getXlsformFromFile(opts.xlsform);
		} else {
			throw new Error("Unsupported xlsform input type.");
		}
	}

	const pyxformData = workbookToJson({
		workbookDict,
		formName: opts.formName,
		fallbackFormName: workbookDict.fallback_form_name,
		defaultLanguage: opts.defaultLanguage,
		warnings,
	});

	const element = createSurveyElementFromDict(pyxformData);
	if (!(element instanceof Survey)) {
		throw new Error("Expected createSurveyElementFromDict to return a Survey");
	}
	const survey = element;
	if (pyxformData.name === "data") {
		const effectiveFormName = opts.formName ?? workbookDict.fallback_form_name;
		if (effectiveFormName) {
			survey.name = effectiveFormName;
		}
	}
	survey.setupXpathDictionary();
	survey.validate();

	const xform = survey.toXml({
		validate: opts.validate,
		prettyPrint: opts.prettyPrint ?? true,
		warnings,
		enketo: opts.enketo,
	});

	return {
		xform,
		warnings,
		itemsets: null,
		_pyxform: pyxformData,
		_survey: survey,
	};
}
