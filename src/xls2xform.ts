/**
 * Main conversion entry point: XLSForm → XForm.
 */

import { createSurveyElementFromDict } from "./builder.js";
import type { Survey } from "./survey.js";
import { coalesce } from "./utils.js";
import { getXlsform } from "./xls2json-backends.js";
import { workbookToJson } from "./xls2json.js";

export interface ConvertResult {
	xform: string;
	warnings: string[];
	itemsets: string | null;
	_pyxform: Record<string, unknown> | null;
	_survey: Survey | null;
}

export function convert(opts: {
	xlsform: string | Record<string, unknown>;
	warnings?: string[];
	validate?: boolean;
	prettyPrint?: boolean;
	enketo?: boolean;
	formName?: string | null;
	defaultLanguage?: string | null;
	fileType?: string | null;
}): ConvertResult {
	const warnings = coalesce(opts.warnings, []) as string[];

	const workbookDict = getXlsform(opts.xlsform, opts.fileType ?? undefined);

	const pyxformData = workbookToJson({
		workbookDict,
		formName: opts.formName,
		fallbackFormName: workbookDict.fallback_form_name,
		defaultLanguage: opts.defaultLanguage,
		warnings,
	});

	const survey = createSurveyElementFromDict(pyxformData) as unknown as Survey;
	// Override root element name for XML generation when no explicit name in settings
	// (pyxformData.name defaults to "data", but XML root should use formName)
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
