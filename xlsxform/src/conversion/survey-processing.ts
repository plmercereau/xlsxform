/**
 * Survey sheet row processing for XLSForm conversion.
 * Extracted from xls2json.ts — handles the main survey row loop,
 * scope management (groups/repeats/loops), and post-processing.
 */

import * as aliases from "../aliases.js";
import * as constants from "../constants.js";
import {
	ContainerPath,
	processEntityReferencesForQuestion,
	validateEntityLabelReferences,
} from "../entities.js";
import { PyXFormError } from "../errors.js";
import { isPyxformReference } from "../parsing/expression.js";
import {
	extractPyxformReferences,
	hasPyxformReference,
	validatePyxformReferenceSyntax,
} from "../parsing/references.js";
import {
	dealiasAndGroupHeaders,
	extractHeaders,
	findSheetMisspellings,
} from "../parsing/sheet-headers.js";
import { getMetaGroup } from "../question-type-dictionary.js";
import { OR_OTHER_WARNING, type TranslationChecker } from "../translations.js";
import type { FormRecord } from "../types.js";
import { validateChoiceReferences } from "../validators/choices.js";
import type { DefinitionData } from "./backends/index.js";
import { processQuestionRow } from "./question-row.js";

export interface SurveyProcessingContext {
	rows: FormRecord[];
	choices: Record<string, FormRecord[]>;
	warnings: string[];
	settings: FormRecord;
	hasChoicesSheet: boolean;
	hasExternalChoicesSheet: boolean;
	sheetNames: string[];
	choicesData: FormRecord[];
	entityDeclarations?: Record<string, FormRecord> | null;
	entityVariableReferences?: Record<string, string[]> | null;
	entityReferencesByQuestion?: FormRecord;
	surveyTranslations?: TranslationChecker;
	choicesTranslations?: TranslationChecker;
	externalChoicesListNames?: Set<string>;
	formName?: string;
	stripWhitespace?: boolean;
	workbookDict?: DefinitionData;
	osmTags?: Record<string, FormRecord[]>;
}

interface ScopeFrame {
	type: string;
	name: string;
	children: FormRecord[];
	rowNum: number;
	namesInScope: Set<string>;
	namesLowerInScope: Set<string>;
	control_name?: string;
	control_type?: string;
	container_path?: ContainerPath;
	table_list?: boolean | string;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported from pyxform
function validateSurveyHeaders(
	rows: FormRecord[],
	surveyHeaders: string[],
	workbookDict?: DefinitionData,
): void {
	const surveyHeader = workbookDict?.survey_header;

	// 1. Check for unknown headers first (fires before required header check, matches Python behavior)
	{
		const knownHeaders = new Set<string>();
		if (surveyHeader && surveyHeader.length > 0) {
			for (const h of Object.keys(surveyHeader[0])) {
				knownHeaders.add(h);
			}
		} else {
			for (let i = 0; i < Math.min(100, rows.length); i++) {
				for (const k of Object.keys(rows[i])) {
					knownHeaders.add(k);
				}
			}
		}
		for (const row of rows) {
			for (const k of Object.keys(row)) {
				if (!knownHeaders.has(k)) {
					const headerName = k || "unknown";
					throw new PyXFormError(
						`Invalid headers provided for sheet: 'survey'. For XLSForms, this may be due a missing header row, in which case add a header row as per the reference template https://xlsform.org/en/ref-table/. For internal API usage, may be due to a missing mapping for '${headerName}', in which case ensure that the full set of headers appear within the first 100 rows, or specify the header row in 'survey_header'.`,
					);
				}
			}
		}
	}

	// 2. Check required headers: 'type' must be present
	{
		const resolvedSurveyHeaders = new Set<string>();
		for (const h of surveyHeaders) {
			const hl = h.toLowerCase();
			const alias = aliases.surveyHeader[h] ?? aliases.surveyHeader[hl];
			if (alias) {
				const resolved = Array.isArray(alias) ? alias[0] : alias;
				resolvedSurveyHeaders.add(resolved);
			}
			resolvedSurveyHeaders.add(hl);
		}
		if (rows.length > 0 || (surveyHeader && surveyHeader.length > 0)) {
			if (
				!(
					resolvedSurveyHeaders.has("type") ||
					resolvedSurveyHeaders.has("command")
				)
			) {
				throw new PyXFormError(
					`Invalid headers provided for sheet: 'survey'. One or more required column headers were not found: 'type'. Learn more: https://xlsform.org/en/#setting-up-your-worksheets`,
				);
			}
		}
	}

	// 3. Check for duplicate aliases (e.g., both 'name' and 'value' columns)
	{
		const resolvedHeaders = new Map<string, string>();
		for (const header of surveyHeaders) {
			const headerLower = header.toLowerCase();
			const alias =
				aliases.surveyHeader[header] ?? aliases.surveyHeader[headerLower];
			const resolved = alias
				? Array.isArray(alias)
					? alias.join("::")
					: alias
				: headerLower;
			const existing = resolvedHeaders.get(resolved);
			if (existing && existing.toLowerCase() !== headerLower) {
				throw new PyXFormError(
					`Invalid headers provided for sheet: 'survey'. Headers that are different names for the same column were found: '${existing}', '${header}'. Rename or remove one of these columns.`,
				);
			}
			resolvedHeaders.set(resolved, header);
		}
	}
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported from pyxform
function processTriggerColumn(
	row: FormRecord,
	rowNum: number,
	name: string,
	type: string,
	triggerReferences: { target: string; rowNum: number; questionName: string }[],
): string[] {
	let triggerRefs: string[] = [];
	if (row.trigger) {
		const triggerVal = row.trigger.toString().trim();
		if (triggerVal) {
			triggerRefs = extractPyxformReferences(triggerVal);
			if (triggerRefs.length === 0 && triggerVal) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the 'trigger' value is invalid. Reference variables must start with '\${', then a question name, and end with '}'.`,
				);
			}
			if (/\}\s*\$\{/.test(triggerVal)) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the 'trigger' value is invalid. Reference variable lists must have a comma between each variable.`,
				);
			}
			for (const ref of triggerRefs) {
				triggerReferences.push({ target: ref, rowNum, questionName: name });
			}
		}
	}

	// Background-geopoint validation
	if (type === "background-geopoint") {
		if (triggerRefs.length === 0 && !row.trigger) {
			throw new PyXFormError(
				`[row : ${rowNum}] For 'background-geopoint' questions, the 'trigger' column must not be empty.`,
			);
		}
		const calc =
			row.calculation ?? (row.bind as FormRecord | undefined)?.calculate;
		if (calc?.toString().trim()) {
			throw new PyXFormError(
				`[row : ${rowNum}] For 'background-geopoint' questions, the 'calculation' column must be empty.`,
			);
		}
	}

	return triggerRefs;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported from pyxform
function collectSurveyReferences(
	rawRow: FormRecord,
	row: FormRecord,
	rowNum: number,
	surveyColumnReferences: {
		target: string;
		rowNum: number;
		sheet: string;
		column: string;
	}[],
): void {
	const surveyRefColumns = new Set([
		"label",
		"hint",
		"constraint_message",
		"guidance_hint",
		"calculation",
		"constraint",
		"relevant",
		"required",
		"default",
		"choice_filter",
		"repeat_count",
	]);
	const checkedRawCols = new Set<string>();
	for (const [rawColKey, rawColVal] of Object.entries(rawRow)) {
		if (typeof rawColVal !== "string") {
			continue;
		}
		if (!hasPyxformReference(rawColVal)) {
			continue;
		}
		const baseRawCol = rawColKey.split("::")[0].trim();
		const aliased = aliases.surveyHeader[baseRawCol];
		const resolvedCol =
			typeof aliased === "string"
				? aliased
				: Array.isArray(aliased)
					? aliased[0]
					: baseRawCol;
		const resolvedBase = resolvedCol.split("::")[0].trim().toLowerCase();
		const baseRawColLower = baseRawCol.toLowerCase();
		if (
			!(
				surveyRefColumns.has(resolvedBase) ||
				surveyRefColumns.has(baseRawColLower)
			)
		) {
			continue;
		}
		checkedRawCols.add(rawColKey);
		const syntaxErr = validatePyxformReferenceSyntax(
			rawColVal,
			rowNum,
			"survey",
			rawColKey,
		);
		if (syntaxErr) {
			throw new PyXFormError(syntaxErr);
		}
		const refs = extractPyxformReferences(rawColVal);
		for (const ref of refs) {
			surveyColumnReferences.push({
				target: ref,
				rowNum,
				sheet: "survey",
				column: rawColKey,
			});
		}
	}
	for (const [colKey, colVal] of Object.entries(row)) {
		if (typeof colVal !== "string") {
			continue;
		}
		if (!hasPyxformReference(colVal)) {
			continue;
		}
		const baseCol = colKey.split("::")[0].trim().toLowerCase();
		if (!surveyRefColumns.has(baseCol)) {
			continue;
		}
		if (checkedRawCols.size > 0) {
			let alreadyChecked = false;
			for (const rawKey of checkedRawCols) {
				if (rawRow[rawKey] === colVal) {
					alreadyChecked = true;
					break;
				}
			}
			if (alreadyChecked) {
				continue;
			}
		}
		const refs = extractPyxformReferences(colVal);
		for (const ref of refs) {
			surveyColumnReferences.push({
				target: ref,
				rowNum,
				sheet: "survey",
				column: colKey,
			});
		}
	}
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported from pyxform
function handleOrOther(
	questionDict: FormRecord,
	row: FormRecord,
	name: string,
	rowNum: number,
	choices: Record<string, FormRecord[]>,
): FormRecord | null {
	if (!questionDict.or_other) {
		return null;
	}

	if (
		questionDict[constants.CHOICE_FILTER] ||
		row[constants.CHOICE_FILTER] ||
		row.choice_filter
	) {
		throw new PyXFormError(
			`[row : ${rowNum}] Choice filter not supported with or_other.`,
		);
	}
	const listName =
		questionDict[constants.LIST_NAME_U] ?? questionDict[constants.ITEMSET];
	const itemsetChoices = listName ? choices[String(listName)] : null;
	if (itemsetChoices && Array.isArray(itemsetChoices)) {
		const hasOther = itemsetChoices.some((c) => c[constants.NAME] === "other");
		if (!hasOther) {
			const hasTranslatedLabels = itemsetChoices.some(
				(c) =>
					typeof c[constants.LABEL] === "object" && c[constants.LABEL] !== null,
			);
			if (hasTranslatedLabels) {
				const allLangs = new Set<string>();
				for (const c of itemsetChoices) {
					if (
						typeof c[constants.LABEL] === "object" &&
						c[constants.LABEL] !== null
					) {
						for (const lang of Object.keys(c[constants.LABEL])) {
							allLangs.add(lang);
						}
					}
				}
				const otherLabel: Record<string, string> = {};
				for (const lang of allLangs) {
					otherLabel[lang] = "Other";
				}
				itemsetChoices.push({
					[constants.NAME]: "other",
					[constants.LABEL]: otherLabel,
				});
			} else {
				itemsetChoices.push({
					[constants.NAME]: "other",
					[constants.LABEL]: "Other",
				});
			}
		}
	}
	return {
		[constants.TYPE]: "text",
		[constants.NAME]: `${name}_other`,
		[constants.LABEL]: "Specify other.",
		[constants.BIND]: { relevant: `selected(../${name}, 'other')` },
	};
}

function handleTableList(
	questionDict: FormRecord,
	row: FormRecord,
	rowNum: number,
	stack: ScopeFrame[],
	choices: Record<string, FormRecord[]>,
): void {
	const currentTableList =
		stack.length > 0 ? stack[stack.length - 1].table_list : undefined;
	if (currentTableList === undefined || !questionDict[constants.ITEMSET]) {
		return;
	}

	const selectListName = questionDict[constants.ITEMSET];
	if (currentTableList === true) {
		stack[stack.length - 1].table_list = selectListName as string;
		if (
			questionDict[constants.CHOICE_FILTER] ||
			row[constants.CHOICE_FILTER] ||
			row.choice_filter
		) {
			throw new PyXFormError(
				`[row : ${rowNum}] Choice filter not supported for table-list appearance.`,
			);
		}
		const tableListHeader: FormRecord = {
			[constants.TYPE]: questionDict[constants.TYPE],
			[constants.NAME]: `reserved_name_for_field_list_labels_${String(rowNum)}`,
			[constants.CONTROL]: { appearance: "label" },
			[constants.ITEMSET]: selectListName,
			[constants.LABEL]: " ",
		};
		if (choices[String(selectListName)]) {
			tableListHeader[constants.CHOICES] = choices[String(selectListName)];
		}
		stack[stack.length - 1].children.push(tableListHeader);
	} else if (currentTableList !== selectListName) {
		throw new PyXFormError(
			`[row : ${rowNum}] Badly formatted table list, list names don't match: ${currentTableList} vs. ${selectListName}`,
		);
	}
	if (!questionDict[constants.CONTROL]) {
		questionDict[constants.CONTROL] = {};
	}
	(questionDict[constants.CONTROL] as FormRecord).appearance = "list-nolabel";
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported from pyxform
function postProcessSurvey(
	result: FormRecord[],
	settings: FormRecord,
	warnings: string[],
	allQuestionNames: Set<string>,
	allQuestionNameCounts: Map<string, number>,
	triggerReferences: { target: string; rowNum: number; questionName: string }[],
	hiddenQuestionNames: Set<string>,
	surveyColumnReferences: {
		target: string;
		rowNum: number;
		sheet: string;
		column: string;
	}[],
	entityDeclarations: Record<string, FormRecord> | null | undefined,
	choicesData: FormRecord[],
	orOtherSeen: boolean,
	surveyTranslations: TranslationChecker | undefined,
	choicesTranslations: TranslationChecker | undefined,
): void {
	// Add or_other warning if translations are present
	if (orOtherSeen && surveyTranslations && choicesTranslations) {
		if (
			!(
				surveyTranslations.seenDefaultOnly() &&
				choicesTranslations.seenDefaultOnly()
			)
		) {
			warnings.push(OR_OTHER_WARNING);
		}
	}

	// Add well-known meta names to the question name set for reference validation
	const omitInstanceIDForRefs =
		settings.omit_instanceID === "yes" || settings.omit_instanceID === "true";
	const metaRefNames: string[] = [
		"instanceName",
		"meta",
		"audit",
		"start",
		"end",
		"today",
		"deviceid",
		"phonenumber",
		"username",
		"simserial",
		"subscriberid",
	];
	if (!omitInstanceIDForRefs) {
		metaRefNames.push("instanceID");
	}
	for (const n of metaRefNames) {
		allQuestionNames.add(n);
	}

	// Validate trigger references
	for (const { target, rowNum: refRow, questionName } of triggerReferences) {
		if (!allQuestionNames.has(target)) {
			throw new PyXFormError(
				`[row : ${refRow}] On the 'survey' sheet, the 'trigger' value is invalid. Reference variables must contain a name from the 'survey' sheet. Could not find the name '${target}'.`,
			);
		}
		if (hiddenQuestionNames.has(target)) {
			throw new PyXFormError(
				`The question \${${target}} is not user-visible so it can't be used as a calculation trigger for question \${${questionName}}.`,
			);
		}
	}

	// Validate survey column references
	for (const {
		target: rawTarget,
		rowNum: refRow,
		sheet,
		column,
	} of surveyColumnReferences) {
		const target = rawTarget.startsWith("last-saved#")
			? rawTarget.substring("last-saved#".length)
			: rawTarget;
		if (!allQuestionNames.has(target)) {
			throw new PyXFormError(
				`[row : ${refRow}] On the '${sheet}' sheet, the '${column}' value is invalid. Reference variables must contain a name from the 'survey' sheet. Could not find the name '${target}'.`,
			);
		}
		const count = allQuestionNameCounts.get(target) ?? 0;
		if (count > 1) {
			throw new PyXFormError(
				`[row : ${refRow}] On the '${sheet}' sheet, the '${column}' value is invalid. Reference variables must contain a name from the 'survey' sheet. Could not find the name '${target}'.`,
			);
		}
	}

	// Validate entity label references
	if (entityDeclarations) {
		validateEntityLabelReferences(entityDeclarations, allQuestionNames);
	}

	// Validate choice label/media references
	validateChoiceReferences(choicesData, allQuestionNames);

	// Collect metadata-type children that belong in the <meta> group
	const metaTypes = new Set([
		"audit",
		"start",
		"end",
		"today",
		"deviceid",
		"phonenumber",
		"username",
		"simserial",
		"subscriberid",
	]);
	const metaChildren: FormRecord[] = [];
	const filteredResult: FormRecord[] = [];
	for (const child of result) {
		if (metaTypes.has(child[constants.TYPE] as string)) {
			metaChildren.push(child);
		} else {
			filteredResult.push(child);
		}
	}
	result.length = 0;
	result.push(...filteredResult);

	// Add meta group with collected metadata children
	const omitInstanceID =
		settings.omit_instanceID === "yes" || settings.omit_instanceID === "true";

	if (settings.instance_name) {
		const instanceNameStr = String(settings.instance_name);
		const instanceNameRefs = extractPyxformReferences(instanceNameStr);
		for (const ref of instanceNameRefs) {
			if (!allQuestionNames.has(ref)) {
				throw new PyXFormError(
					`[row : 2] On the 'settings' sheet, the 'instance_name' value is invalid. Could not find the name '${ref}'.`,
				);
			}
		}
		metaChildren.push({
			[constants.NAME]: "instanceName",
			[constants.TYPE]: "calculate",
			[constants.BIND]: {
				type: "string",
				calculate: settings.instance_name,
			},
		});
	}

	if (metaChildren.length > 0 || !omitInstanceID) {
		const instanceIdPreload =
			(settings.instance_id as string | undefined) ?? "uid";
		result.push(getMetaGroup(metaChildren, omitInstanceID, instanceIdPreload));
	}
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported from pyxform
function processBeginSection(
	row: FormRecord,
	name: string,
	sectionType: string,
	rowNum: number,
	stack: ScopeFrame[],
	result: FormRecord[],
	warnings: string[],
	allQuestionNames: Set<string>,
	repeatNames: Set<string>,
	formName: string,
	entityDeclarations: Record<string, FormRecord> | null | undefined,
	entityVariableReferences: Record<string, string[]> | null | undefined,
	entityReferencesByQuestion: FormRecord,
): void {
	// Validate reserved names for groups/repeats
	if (name && constants.RESERVED_NAMES_SURVEY_SHEET.has(name)) {
		throw new PyXFormError(
			`[row : ${rowNum}] On the 'survey' sheet, the 'name' value '${name}' is invalid. The name '${name}' is reserved for form metadata.`,
		);
	}

	// Validate repeat names: must be unique globally and not same as survey root
	if (sectionType === constants.REPEAT) {
		if (name === formName) {
			throw new PyXFormError(
				`[row : ${rowNum}] On the 'survey' sheet, the 'name' value '${name}' is invalid. Repeat names must not be the same as the survey root (which defaults to 'data').`,
			);
		}
		if (repeatNames.has(name)) {
			throw new PyXFormError(
				`[row : ${rowNum}] On the 'survey' sheet, the 'name' value '${name}' is invalid. Repeat names must unique anywhere in the survey, at all levels of group or repeat nesting.`,
			);
		}
		repeatNames.add(name);
	}

	const parentPath =
		stack.length > 0
			? (stack[stack.length - 1].container_path ?? ContainerPath.default())
			: ContainerPath.default();
	const newPath = new ContainerPath([
		...parentPath.nodes,
		{ name, type: sectionType },
	]);
	stack.push({
		type: sectionType,
		name,
		children: [],
		rowNum,
		namesInScope: new Set<string>(),
		namesLowerInScope: new Set<string>(),
		control_name: name,
		control_type: sectionType,
		container_path: newPath,
	});

	const sectionDict: FormRecord = {
		...row,
		[constants.TYPE]: sectionType,
		[constants.NAME]: name,
		[constants.CHILDREN]: stack[stack.length - 1].children,
	};
	sectionDict.type = undefined;
	sectionDict[constants.TYPE] = sectionType;

	// Warn if repeat has no label
	if (sectionType === constants.REPEAT && !sectionDict[constants.LABEL]) {
		const msgDict = `{'name': '${row[constants.NAME] ?? ""}', 'type': '${row[constants.TYPE] ?? ""}'}`;
		warnings.push(`[row : ${rowNum}] Repeat has no label: ${msgDict}`);
	}

	// Handle repeat_count
	const repeatCountExpr = (
		sectionDict[constants.CONTROL] as FormRecord | undefined
	)?.["jr:count"];
	if (repeatCountExpr) {
		if (!isPyxformReference(repeatCountExpr as string)) {
			const generatedNodeName = `${name}_count`;
			if (allQuestionNames.has(generatedNodeName)) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the repeat_count expression for '${name}' requires a generated element named '${generatedNodeName}', but a question with that name already exists. Please rename the existing question or use a simple variable reference for repeat_count.`,
				);
			}
			const parentArray =
				stack.length > 1 ? stack[stack.length - 2].children : result;
			parentArray.push({
				[constants.NAME]: generatedNodeName,
				bind: {
					readonly: "true()",
					calculate: repeatCountExpr,
				},
				[constants.TYPE]: "calculate",
			});
			(sectionDict[constants.CONTROL] as FormRecord)["jr:count"] =
				`\${${generatedNodeName}}`;
			allQuestionNames.add(generatedNodeName);
		}
	}

	// Handle table-list appearance
	const tableListAppearance = (
		sectionDict[constants.CONTROL] as FormRecord | undefined
	)?.appearance;
	if (tableListAppearance) {
		const appearanceMods = tableListAppearance.toString().split(/\s+/);
		if (appearanceMods.includes(constants.TABLE_LIST)) {
			let appearanceString = "field-list";
			for (const w of appearanceMods) {
				if (w !== constants.TABLE_LIST) {
					appearanceString += ` ${w}`;
				}
			}
			(sectionDict[constants.CONTROL] as FormRecord).appearance =
				appearanceString;
			if (sectionDict[constants.LABEL] || sectionDict.hint) {
				const generatedLabelElement: FormRecord = {
					[constants.TYPE]: "note",
					[constants.NAME]: `generated_table_list_label_${String(rowNum)}`,
				};
				if (sectionDict[constants.LABEL]) {
					generatedLabelElement[constants.LABEL] = sectionDict[constants.LABEL];
					delete sectionDict[constants.LABEL];
				}
				if (sectionDict.hint) {
					generatedLabelElement.hint = sectionDict.hint;
					sectionDict.hint = undefined;
				}
				stack[stack.length - 1].children.push(generatedLabelElement);
			}
			stack[stack.length - 1].table_list = true;
		}
	}

	// Handle intent
	if (sectionDict.intent) {
		if (!sectionDict[constants.CONTROL]) {
			sectionDict[constants.CONTROL] = {};
		}
		(sectionDict[constants.CONTROL] as FormRecord).intent = sectionDict.intent;
		sectionDict.intent = undefined;
	}

	// Check entity save_to on begin group/repeat
	if (
		(row[constants.BIND] as FormRecord | undefined)?.[
			constants.ENTITIES_SAVETO_NS
		] &&
		name
	) {
		processEntityReferencesForQuestion(
			newPath,
			row,
			rowNum,
			name,
			entityDeclarations ?? null,
			entityVariableReferences ?? null,
			entityReferencesByQuestion as Parameters<
				typeof processEntityReferencesForQuestion
			>[6],
			true,
			false,
		);
	}

	if (stack.length > 1) {
		stack[stack.length - 2].children.push(sectionDict);
	} else {
		result.push(sectionDict);
	}
}

function processEndSection(
	row: FormRecord,
	name: string,
	endMatch: RegExpMatchArray,
	rowNum: number,
	stack: ScopeFrame[],
	entityDeclarations: Record<string, FormRecord> | null | undefined,
	entityVariableReferences: Record<string, string[]> | null | undefined,
	entityReferencesByQuestion: FormRecord,
): void {
	const endName = name || "unknown";
	if (stack.length === 0) {
		throw new PyXFormError(
			`[row : ${rowNum}] Unmatched 'end_${endMatch[1]}'. No matching 'begin_${endMatch[1]}' was found for the name '${endName}'.`,
		);
	}
	const top = stack[stack.length - 1];
	const endType = endMatch[1].toLowerCase();
	const expectedType =
		endType === "group"
			? constants.GROUP
			: endType === "repeat"
				? constants.REPEAT
				: constants.LOOP;
	if (top.type !== expectedType) {
		throw new PyXFormError(
			`[row : ${rowNum}] Unmatched 'end_${endMatch[1]}'. No matching 'begin_${endMatch[1]}' was found for the name '${endName}'.`,
		);
	}
	if (
		(row[constants.BIND] as FormRecord | undefined)?.[
			constants.ENTITIES_SAVETO_NS
		]
	) {
		const endCPath =
			stack.length > 0
				? (stack[stack.length - 1].container_path ?? ContainerPath.default())
				: ContainerPath.default();
		processEntityReferencesForQuestion(
			endCPath,
			row,
			rowNum,
			endName,
			entityDeclarations ?? null,
			entityVariableReferences ?? null,
			entityReferencesByQuestion as Parameters<
				typeof processEntityReferencesForQuestion
			>[6],
			false,
			true,
		);
	}
	stack.pop();
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported from pyxform
export function processSurveyRows(ctx: SurveyProcessingContext): FormRecord[] {
	const {
		rows,
		choices,
		warnings,
		settings,
		hasChoicesSheet,
		hasExternalChoicesSheet,
		sheetNames,
		choicesData,
		entityDeclarations = null,
		entityVariableReferences = null,
		entityReferencesByQuestion = {},
		surveyTranslations,
		choicesTranslations,
		externalChoicesListNames = new Set<string>(),
		formName = "data",
		stripWhitespace = false,
		workbookDict,
		osmTags = {},
	} = ctx;

	const result: FormRecord[] = [];
	let orOtherSeen = false;
	const stack: ScopeFrame[] = [];
	const topScopeNames = new Set<string>();
	const topScopeNamesLower = new Set<string>();
	const allQuestionNames = new Set<string>();
	const repeatNames = new Set<string>();
	const allQuestionNameCounts = new Map<string, number>();
	const triggerReferences: {
		target: string;
		rowNum: number;
		questionName: string;
	}[] = [];
	const hiddenQuestionNames = new Set<string>();
	const surveyColumnReferences: {
		target: string;
		rowNum: number;
		sheet: string;
		column: string;
	}[] = [];
	let rowNum = 1;

	const settingsDefaultLang =
		(settings[constants.DEFAULT_LANGUAGE_KEY] as string | undefined) ??
		constants.DEFAULT_LANGUAGE_VALUE;

	// Build and validate survey headers
	const surveyHeaders = extractHeaders(rows);
	const surveyHeader = workbookDict?.survey_header;
	if (surveyHeader && surveyHeader.length > 0) {
		for (const h of Object.keys(surveyHeader[0])) {
			if (h && !surveyHeaders.includes(h)) {
				surveyHeaders.push(h);
			}
		}
	}
	validateSurveyHeaders(rows, surveyHeaders, workbookDict);

	// Main row processing loop
	for (const rawRow of rows) {
		rowNum++;
		const row = dealiasAndGroupHeaders(
			rawRow,
			aliases.surveyHeader,
			false,
			settingsDefaultLang,
			stripWhitespace,
		);

		const type = (row[constants.TYPE] ?? "").toString().trim();
		let name = (row[constants.NAME] ?? "").toString().trim();

		if (!type) {
			continue;
		}

		const isEnd = /^end[_ ](group|repeat|loop)$/i.test(type);
		const isBeginLoop = /^begin[_ ]loop\b/i.test(type);
		const isBeginGroupOrRepeat = /^begin[_ ](group|repeat)$/i.test(type);
		const isBeginEnd = isEnd || isBeginLoop || isBeginGroupOrRepeat;

		// Auto-naming for types that support it
		const autoNameTypes: Record<string, string | ((rowNum: number) => string)> =
			{
				audit: "audit",
				note: (rn: number) => `generated_note_name_${rn}`,
			};

		if (!(isEnd || isBeginLoop || name)) {
			if (isBeginGroupOrRepeat) {
				throw new PyXFormError(
					`[row : ${rowNum}] Question or group with no name.`,
				);
			}
			const autoNameEntry = autoNameTypes[type.toLowerCase()];
			if (!autoNameEntry) {
				throw new PyXFormError(
					`[row : ${rowNum}] Question or group with no name.`,
				);
			}
			const autoName =
				typeof autoNameEntry === "function"
					? autoNameEntry(rowNum)
					: autoNameEntry;
			name = autoName;
			row[constants.NAME] = autoName;
		}

		// Name validations
		if (
			!isBeginEnd &&
			name &&
			constants.RESERVED_NAMES_SURVEY_SHEET.has(name)
		) {
			throw new PyXFormError(
				`[row : ${rowNum}] On the 'survey' sheet, the 'name' value '${name}' is invalid. The name '${name}' is reserved for form metadata.`,
			);
		}
		if (!isEnd && name && hasPyxformReference(name)) {
			throw new PyXFormError(
				`[row : ${rowNum}] On the 'survey' sheet, the 'name' value is invalid. Names must not contain references (e.g. \${...}).`,
			);
		}
		if (!isEnd && name && !/^[a-zA-Z_]/.test(name)) {
			throw new PyXFormError(
				`[row : ${rowNum}] On the 'survey' sheet, the 'name' value is invalid. Names must begin with a letter or underscore.`,
			);
		}

		// Name uniqueness within scope
		if (!isEnd && name) {
			const currentScopeNames =
				stack.length > 0 ? stack[stack.length - 1].namesInScope : topScopeNames;
			const currentScopeNamesLower =
				stack.length > 0
					? stack[stack.length - 1].namesLowerInScope
					: topScopeNamesLower;
			if (currentScopeNames.has(name)) {
				throw new PyXFormError(
					`[row : ${rowNum}] On the 'survey' sheet, the 'name' value '${name}' is invalid. Questions, groups, and repeats must be unique within their nearest parent group or repeat, or the survey if not inside a group or repeat.`,
				);
			}
			const nameLower = name.toLowerCase();
			if (
				currentScopeNamesLower.has(nameLower) &&
				!currentScopeNames.has(name)
			) {
				warnings.push(
					`[row : ${rowNum}] On the 'survey' sheet, the 'name' value '${name}' is problematic. The name is a case-insensitive match to another name. Questions, groups, and repeats should be unique within the nearest parent group or repeat, or the survey if not inside a group or repeat. Some data processing tools are not case-sensitive, so the current names may make analysis difficult.`,
				);
			}
			currentScopeNames.add(name);
			currentScopeNamesLower.add(nameLower);
			allQuestionNames.add(name);
			allQuestionNameCounts.set(
				name,
				(allQuestionNameCounts.get(name) ?? 0) + 1,
			);
			const hasLabel =
				row.label &&
				(typeof row.label === "string"
					? row.label.trim() !== ""
					: Object.keys(row.label).length > 0);
			const rowBind = row.bind as FormRecord | undefined;
			const hasCalculation = rowBind?.calculate || row.calculation;
			if (type === "calculate" || (hasCalculation && !hasLabel)) {
				hiddenQuestionNames.add(name);
			}
		}

		// Begin group/repeat
		const beginMatch = type.match(/^begin[_ ](group|repeat)$/i);
		if (beginMatch) {
			const sectionType =
				beginMatch[1].toLowerCase() === "group"
					? constants.GROUP
					: constants.REPEAT;
			processBeginSection(
				row,
				name,
				sectionType,
				rowNum,
				stack,
				result,
				warnings,
				allQuestionNames,
				repeatNames,
				formName,
				entityDeclarations,
				entityVariableReferences,
				entityReferencesByQuestion,
			);
			continue;
		}

		// Begin loop
		const beginLoopMatch = type.match(/^begin[_ ]loop\s+over\s+(.+)$/i);
		if (beginLoopMatch) {
			const loopListName = beginLoopMatch[1].trim();
			stack.push({
				type: constants.LOOP,
				name,
				children: [],
				rowNum,
				namesInScope: new Set<string>(),
				namesLowerInScope: new Set<string>(),
			});
			const sectionDict: FormRecord = {
				...row,
				[constants.TYPE]: constants.LOOP,
				[constants.NAME]: name,
				[constants.CHILDREN]: stack[stack.length - 1].children,
				columns: choices[loopListName] ?? [],
			};
			sectionDict.type = undefined;
			sectionDict[constants.TYPE] = constants.LOOP;

			if (stack.length > 1) {
				stack[stack.length - 2].children.push(sectionDict);
			} else {
				result.push(sectionDict);
			}
			continue;
		}

		// End group/repeat/loop
		const endMatch = type.match(/^end[_ ](group|repeat|loop)$/i);
		if (endMatch) {
			processEndSection(
				row,
				name,
				endMatch,
				rowNum,
				stack,
				entityDeclarations,
				entityVariableReferences,
				entityReferencesByQuestion,
			);
			continue;
		}

		// Trigger column processing
		processTriggerColumn(row, rowNum, name, type, triggerReferences);

		// Collect survey references
		collectSurveyReferences(rawRow, row, rowNum, surveyColumnReferences);

		// Process entity references
		const hasSaveTo = (row[constants.BIND] as FormRecord | undefined)?.[
			constants.ENTITIES_SAVETO_NS
		];
		if ((entityDeclarations || hasSaveTo) && name) {
			const currentContainerPath =
				stack.length > 0
					? (stack[stack.length - 1].container_path ?? ContainerPath.default())
					: ContainerPath.default();
			processEntityReferencesForQuestion(
				currentContainerPath,
				row,
				rowNum,
				name,
				entityDeclarations,
				entityVariableReferences,
				entityReferencesByQuestion as Parameters<
					typeof processEntityReferencesForQuestion
				>[6],
				isBeginGroupOrRepeat,
				isEnd,
			);
		}

		// Process question type
		const questionDict = processQuestionRow(
			row,
			type,
			name,
			choices,
			rowNum,
			warnings,
			settings,
			hasChoicesSheet,
			hasExternalChoicesSheet,
			sheetNames,
			externalChoicesListNames,
			osmTags,
			findSheetMisspellings,
		);
		if (!questionDict) {
			continue;
		}

		// Handle or_other
		if (questionDict.or_other) {
			orOtherSeen = true;
		}
		const specifyOtherQuestion = handleOrOther(
			questionDict,
			row,
			name,
			rowNum,
			choices,
		);

		// Handle table-list select appearance
		handleTableList(questionDict, row, rowNum, stack, choices);

		// Add to result or current scope
		if (stack.length > 0) {
			stack[stack.length - 1].children.push(questionDict);
			if (specifyOtherQuestion) {
				stack[stack.length - 1].children.push(specifyOtherQuestion);
			}
		} else {
			result.push(questionDict);
			if (specifyOtherQuestion) {
				result.push(specifyOtherQuestion);
			}
		}
	}

	// Check for unclosed sections
	if (stack.length > 0) {
		const unclosed = stack[stack.length - 1];
		throw new PyXFormError(
			`[row : ${unclosed.rowNum}] Unmatched 'begin_${unclosed.type}'. No matching 'end_${unclosed.type}' was found for the name '${unclosed.name}'.`,
		);
	}

	// Post-processing: validate references, build meta group
	postProcessSurvey(
		result,
		settings,
		warnings,
		allQuestionNames,
		allQuestionNameCounts,
		triggerReferences,
		hiddenQuestionNames,
		surveyColumnReferences,
		entityDeclarations,
		choicesData,
		orOtherSeen,
		surveyTranslations,
		choicesTranslations,
	);

	return result;
}
