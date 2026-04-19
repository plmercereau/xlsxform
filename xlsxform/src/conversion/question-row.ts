/**
 * Process individual question rows from the survey sheet.
 */

import * as aliases from "../aliases.js";
import * as constants from "../constants.js";
import { PyXFormError } from "../errors.js";
import { defaultIsDynamic } from "../model/question.js";
import { isXmlTag } from "../parsing/expression.js";
import type { FormRecord } from "../types.js";
import {
	GEO_TYPES,
	validateAndroidPackageName,
	validateAudioParams,
	validateAuditParams,
	validateGeoParams,
	validateRangeParams,
} from "../validators/question-params.js";

export function parseParameters(rawParams: string): Record<string, string> {
	const result: Record<string, string> = {};
	if (!rawParams || typeof rawParams !== "string") {
		return result;
	}
	// Parameters are separated by spaces, commas, or semicolons
	const pairs = rawParams
		.trim()
		.split(/[\s,;]+/)
		.filter(Boolean);
	for (const pair of pairs) {
		const eqIdx = pair.indexOf("=");
		if (eqIdx > 0) {
			result[pair.substring(0, eqIdx).trim()] = pair
				.substring(eqIdx + 1)
				.trim();
		}
	}
	return result;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported from pyxform
export function processQuestionRow(
	row: FormRecord,
	rawType: string,
	name: string,
	choices: Record<string, FormRecord[]>,
	rowNum: number,
	warnings: string[],
	settings: FormRecord,
	hasChoicesSheet: boolean,
	hasExternalChoicesSheet: boolean,
	sheetNames: string[],
	externalChoicesListNames: Set<string>,
	osmTags: Record<string, FormRecord[]>,
	findSheetMisspellings: (key: string, sheetNames: string[]) => string | null,
): FormRecord | null {
	let type = rawType;
	let listName: string | null = null;
	let orOther = false;
	let selectCommand: string | null = null;

	// Handle select types: "select_one listname" / "select_multiple listname"
	// Also handle "select_one_from_file filename.ext" and "select_multiple_from_file filename.ext"
	const selectFromFileMatch = type.match(
		/^(select[_ ]one[_ ]from[_ ]file|select[_ ]multiple[_ ]from[_ ]file)\s+(.+)$/i,
	);
	const selectExternalMatch =
		!selectFromFileMatch && type.match(/^(select[_ ]one[_ ]external)\s+(.+)$/i);
	const osmMatch =
		!(selectFromFileMatch || selectExternalMatch) &&
		type.match(/^(osm)\s+(.+)$/i);
	const selectMatch =
		!(selectFromFileMatch || selectExternalMatch || osmMatch) &&
		type.match(
			/^(add select one prompt using|add select multiple prompt using|select all that apply from|select[_ ]one[_ ]from|select[_ ]one|select[_ ]multiple|select[_ ]all[_ ]that[_ ]apply|select1|rank)\s+(.+)$/i,
		);

	if (selectFromFileMatch) {
		selectCommand = selectFromFileMatch[1].toLowerCase();
		const selectType = selectFromFileMatch[1].toLowerCase().replace(/_/g, " ");
		type =
			aliases.selectFromFile[selectType] ??
			aliases.selectFromFile[selectFromFileMatch[1].toLowerCase()] ??
			constants.SELECT_ONE;
		listName = selectFromFileMatch[2].trim();
	} else if (selectExternalMatch) {
		selectCommand = "select_one_external";
		type = constants.SELECT_ONE_EXTERNAL;
		listName = selectExternalMatch[2].trim();
	} else if (osmMatch) {
		type = "osm";
		listName = osmMatch[2].trim();
	} else if (selectMatch) {
		let rawListName = selectMatch[2].trim();

		// Handle "or_other" suffix
		if (
			rawListName.endsWith(" or_other") ||
			rawListName.endsWith(" or other")
		) {
			rawListName = rawListName.replace(/\s+or[_ ]other$/i, "");
			orOther = true;
		}

		const selectType = selectMatch[1]
			.toLowerCase()
			.replace(/_/g, " ")
			.replace("select multiple", "select all that apply");

		// Map to canonical type
		type =
			aliases.select[selectType] ??
			aliases.select[selectMatch[1].toLowerCase()] ??
			selectType;
		listName = rawListName;
	} else {
		// Check type aliases
		const aliasedType = aliases.typeAliasMap[type.toLowerCase()];
		if (aliasedType) {
			type = aliasedType;
		}
	}

	// Validate choices sheet presence for select types
	if (
		selectMatch &&
		listName &&
		!selectFromFileMatch &&
		!selectExternalMatch &&
		!listName.includes("${")
	) {
		if (!hasChoicesSheet && Object.keys(choices).length === 0) {
			let msg = "There should be a choices sheet in this xlsform.";
			const similar = findSheetMisspellings(constants.CHOICES, sheetNames);
			if (similar) {
				msg += ` ${similar}`;
			}
			msg += ` Please ensure that the choices sheet name is 'choices'.`;
			throw new PyXFormError(msg);
		}
	}
	if (selectExternalMatch && listName) {
		if (!hasExternalChoicesSheet) {
			let msg = "There should be an external_choices sheet in this xlsform.";
			const similar = findSheetMisspellings(
				constants.EXTERNAL_CHOICES,
				sheetNames,
			);
			if (similar) {
				msg += ` ${similar}`;
			}
			msg += ` Please ensure that the external_choices sheet name is 'external_choices'.`;
			throw new PyXFormError(msg);
		}
		if (!externalChoicesListNames.has(listName)) {
			throw new PyXFormError(
				`[row : ${rowNum}] List name not in external choices sheet: ${listName}`,
			);
		}
	}

	// Validate file extension for select_from_file types
	if (selectFromFileMatch && selectCommand && listName) {
		const dotIdx = listName.lastIndexOf(".");
		const fileExt = dotIdx >= 0 ? listName.substring(dotIdx) : "";
		if (dotIdx < 0 || !constants.EXTERNAL_INSTANCE_EXTENSIONS.has(fileExt)) {
			const exts = [...constants.EXTERNAL_INSTANCE_EXTENSIONS]
				.map((e) => `'${e}'`)
				.join(", ");
			throw new PyXFormError(
				`[row : ${rowNum}] File name for '${selectCommand} ${listName}' should end with one of the supported file extensions: ${exts}`,
			);
		}
	}

	// Warn about deprecated metadata types
	if (constants.DEPRECATED_DEVICE_ID_METADATA_FIELDS.has(type)) {
		warnings.push(
			`[row : ${rowNum}] ${type} is no longer supported on most devices. Only old versions of Collect on Android versions older than 11 still support it.`,
		);
	}

	// Validate calculate type has a calculation or dynamic default
	if (type === "calculate") {
		const calculation = (row[constants.BIND] as FormRecord | undefined)
			?.calculate;
		const defaultVal = row.default;
		const hasDynamic = defaultVal && defaultIsDynamic(String(defaultVal), type);
		if (!(calculation || hasDynamic)) {
			throw new PyXFormError(`[row : ${rowNum}] Missing calculation.`);
		}
	}

	// Build the question dict
	const questionDict: FormRecord = { ...row };
	questionDict[constants.TYPE] = type;
	questionDict[constants.NAME] = name;

	// Parse parameters column
	if (
		questionDict[constants.PARAMETERS] &&
		typeof questionDict[constants.PARAMETERS] === "string"
	) {
		const rawParamsStr = questionDict[constants.PARAMETERS] as string;

		// Check for malformed parameters (range-specific)
		if (type === "range") {
			const trimmed = rawParamsStr.trim();
			if (trimmed) {
				const tokens = trimmed.split(/[\s,;]+/).filter(Boolean);
				for (const token of tokens) {
					const eqCount = (token.match(/=/g) || []).length;
					// Must have exactly one '=' and not start with '='
					// (ending with '=' is OK -- it means empty value, caught by numeric validation)
					if (eqCount === 0 || eqCount > 1 || token.startsWith("=")) {
						throw new PyXFormError(
							"Expecting parameters to be in the form of 'parameter1=value parameter2=value'.",
						);
					}
				}
				// Check for invalid separators
				const cleaned = trimmed.replace(/[^\s,;=\w.+-]/g, "");
				if (cleaned !== trimmed) {
					throw new PyXFormError(
						"Expecting parameters to be in the form of 'parameter1=value parameter2=value'.",
					);
				}
			}
		}

		questionDict[constants.PARAMETERS] = parseParameters(rawParamsStr);
	}

	// Type-specific parameter validation
	const params = questionDict[constants.PARAMETERS] as
		| Record<string, string>
		| undefined;

	// Audit validation
	if (type === "audit") {
		validateAuditParams(params ?? {}, name, questionDict);
	}

	// Incremental parameter handling for geoshape/geotrace
	if (params && "incremental" in params) {
		if (type === "geoshape" || type === "geotrace") {
			const incVal = params.incremental;
			const INCREMENTAL_ALIASES = new Set(["true", "yes", "true()"]);
			if (!INCREMENTAL_ALIASES.has(incVal)) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the 'parameters' value is invalid. For geoshape and geotrace questions, the 'incremental' parameter may either be 'true' or not included.`,
				);
			}
			// Normalize to "true"
			params.incremental = "true";
		}
	}

	// Geopoint/geoshape/geotrace validation
	if (GEO_TYPES.has(type) && params) {
		validateGeoParams(params, type, questionDict, rowNum);
	}

	// Audio quality validation
	if (type === "audio" && params) {
		validateAudioParams(params, questionDict);
	}

	// Background-audio quality validation and action setup
	if (type === "background-audio") {
		if (params) {
			validateAudioParams(params, questionDict, true);
		}
		// Add odk:recordaudio action
		const recordAudioAction: Record<string, string> = {
			name: "odk:recordaudio",
			event: "odk-instance-load",
		};
		if (params?.quality) {
			recordAudioAction["odk:quality"] = params.quality;
		}
		if (!questionDict.actions) {
			questionDict.actions = [];
		}
		(questionDict.actions as Record<string, string>[]).push(recordAudioAction);
	}

	// Photo/image parameter validation
	if ((type === "photo" || type === "image") && params) {
		const allowedImageParams = new Set(["app", "max-pixels"]);
		const invalidParams = Object.keys(params).filter(
			(k) => !allowedImageParams.has(k),
		);
		if (invalidParams.length > 0) {
			throw new PyXFormError(
				`Accepted parameters are '${[...allowedImageParams].sort().join(", ")}'. The following are invalid parameter(s): '${invalidParams.join(", ")}'.`,
			);
		}
	}
	// Photo/image max-pixels parameter
	if (type === "photo" || type === "image") {
		if (params?.["max-pixels"]) {
			const mp = params["max-pixels"];
			if (!/^\d+$/.test(mp)) {
				throw new PyXFormError(
					"Parameter max-pixels must have an integer value.",
				);
			}
			if (!questionDict[constants.BIND]) {
				questionDict[constants.BIND] = {};
			}
			(questionDict[constants.BIND] as FormRecord)["orx:max-pixels"] = mp;
		} else {
			warnings.push(
				`[row : ${rowNum}] Use the max-pixels parameter to speed up submission sending and save storage space. Learn more: https://xlsform.org/#image`,
			);
		}

		// App parameter → intent attribute on control
		if (params && "app" in params) {
			const appearance = (
				(questionDict[constants.CONTROL] as FormRecord | undefined)
					?.appearance ?? ""
			)
				.toString()
				.trim();
			if (!appearance || appearance === "annotate") {
				const appPackageName = String(params.app);
				const validationResult = validateAndroidPackageName(appPackageName);
				if (validationResult === null) {
					if (!questionDict[constants.CONTROL]) {
						questionDict[constants.CONTROL] = {};
					}
					(questionDict[constants.CONTROL] as FormRecord).intent =
						appPackageName;
				} else {
					throw new PyXFormError(`[row : ${rowNum}] ${validationResult}`);
				}
			}
		}
	}

	// Range validation
	if (type === "range" && params) {
		validateRangeParams(params, questionDict, rowNum, choices, settings);
	}

	// Select parameter validation - always ensure parameters dict exists for selects
	if (selectFromFileMatch || selectExternalMatch || selectMatch) {
		if (!questionDict[constants.PARAMETERS]) {
			questionDict[constants.PARAMETERS] = {};
		}
		const selectParamsAllowed = ["randomize", "seed"];
		if (selectFromFileMatch) {
			selectParamsAllowed.push("value", "label");
		}
		if (params) {
			const extras = Object.keys(params).filter(
				(k) => !selectParamsAllowed.includes(k),
			);
			if (extras.length > 0) {
				throw new PyXFormError(
					`Accepted parameters are '${selectParamsAllowed.sort().join(", ")}'. The following are invalid parameter(s): '${extras.sort().join(", ")}'.`,
				);
			}
		}
		if (selectFromFileMatch && params) {
			if (params.value && !isXmlTag(params.value)) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the 'parameters (value)' value is invalid. Names must begin with a letter or underscore. After the first character, names may contain letters, digits, underscores, hyphens, or periods.`,
				);
			}
			if (params.label && !isXmlTag(params.label)) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the 'parameters (label)' value is invalid. Names must begin with a letter or underscore. After the first character, names may contain letters, digits, underscores, hyphens, or periods.`,
				);
			}
		}
		// Randomize parameter validation
		if (params) {
			if (
				params.randomize &&
				params.randomize !== "true" &&
				params.randomize !== "True" &&
				params.randomize !== "false"
			) {
				throw new PyXFormError(
					`[row : ${rowNum}] randomize must be set to true or false: '${params.randomize}' is an invalid value`,
				);
			}
			if (params.seed && !params.randomize) {
				throw new PyXFormError(
					`[row : ${rowNum}] Parameters must include randomize=true to use a seed.`,
				);
			}
			if (params.seed) {
				const seedVal = params.seed;
				// seed must be a number or a ${reference}
				const isNum = /^-?\d+(\.\d+)?$/.test(seedVal);
				const isRef = /^\$\{[^}]+\}$/.test(seedVal);
				if (!(isNum || isRef)) {
					throw new PyXFormError(
						`[row : ${rowNum}] seed value must be a number or a reference to another field.`,
					);
				}
			}
		}
	}

	// Rows parameter validation (for text/multiline inputs)
	if (params && "rows" in params) {
		const rowsVal = params.rows;
		if (!(rowsVal && /^\d+$/.test(rowsVal))) {
			throw new PyXFormError(
				`[row : ${rowNum}] Parameter rows must have an integer value.`,
			);
		}
	}

	if (listName) {
		questionDict[constants.ITEMSET] = listName;
		questionDict[constants.LIST_NAME_U] = listName;

		// For select_one_external with choice_filter, set query to list_name
		const choiceFilter =
			questionDict[constants.CHOICE_FILTER] ||
			row[constants.CHOICE_FILTER] ||
			row.choice_filter ||
			"";
		if (type === constants.SELECT_ONE_EXTERNAL && choiceFilter) {
			questionDict.query = listName;
		}

		// Attach choices
		if (choices[listName]) {
			questionDict[constants.CHOICES] = choices[listName];
		}
	}

	if (orOther) {
		questionDict.or_other = true;
	}

	// Attach OSM tags for osm question types
	if (type === "osm" && listName && osmTags[listName]) {
		const tags = osmTags[listName].map((tag) => ({ ...tag }));
		for (const tag of tags) {
			if (tag.name && osmTags[tag.name as string]) {
				tag.choices = osmTags[tag.name as string];
			}
		}
		questionDict.tags = tags;
	}

	return questionDict;
}
