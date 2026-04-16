/**
 * Survey builder - creates Survey objects from JSON dicts.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as constants from "./constants.js";
import { PyXFormError } from "./errors.js";
import { parseFileToJson } from "./xls2json.js";
import {
	InputQuestion,
	Itemset,
	MultipleChoiceQuestion,
	type Option,
	OsmUploadQuestion,
	type Question,
	RangeQuestion,
	TriggerQuestion,
	UploadQuestion,
} from "./question.js";
import { QUESTION_TYPE_DICT, type QuestionTypeEntry } from "./question-type-dictionary.js";
import { GroupedSection, RepeatingSection, type Section } from "./section.js";
import { Survey } from "./survey.js";
import { SurveyElement, type SurveyElementData } from "./survey-element.js";

const QUESTION_CLASSES: Record<string, any> = {
	"": InputQuestion, // Default
	action: InputQuestion,
	input: InputQuestion,
	"odk:rank": MultipleChoiceQuestion,
	range: RangeQuestion,
	select: MultipleChoiceQuestion,
	select1: MultipleChoiceQuestion,
	osm: OsmUploadQuestion,
	trigger: TriggerQuestion,
	upload: UploadQuestion,
};

const SECTION_CLASSES: Record<string, any> = {
	[constants.GROUP]: GroupedSection,
	[constants.REPEAT]: RepeatingSection,
	[constants.SURVEY]: Survey,
};

export class SurveyElementBuilder {
	private _addNoneOption = false;
	private _sections: Record<string, any> = {};
	setvalues_by_triggering_ref: Record<string, [string, string][]> = {};
	setgeopoint_by_triggering_ref: Record<string, [string, string][]> = {};

	constructor(opts: { sections?: Record<string, any> } = {}) {
		if (opts.sections) {
			this._sections = opts.sections;
		}
	}

	setSections(sections: Record<string, any>): void {
		this._sections = sections;
	}

	createSurveyElementFromDict(
		d: Record<string, any>,
		choices?: Record<string, Itemset> | null,
	): any {
		if (d.add_none_option != null) {
			this._addNoneOption = d.add_none_option;
		}

		const type = d[constants.TYPE];

		if (type in SECTION_CLASSES) {
			const section = this._createSectionFromDict(d, choices);

			if (type === constants.SURVEY) {
				(section as Survey).setvalues_by_triggering_ref =
					this.setvalues_by_triggering_ref;
				(section as Survey).setgeopoint_by_triggering_ref =
					this.setgeopoint_by_triggering_ref;
			}

			return section;
		}

		if (type === constants.LOOP) {
			return this._createLoopFromDict(d, choices);
		}

		if (type === "include") {
			const sectionName = d[constants.NAME];
			if (!(sectionName in this._sections)) {
				throw new PyXFormError("This section has not been included.");
			}
			const sectionDict = this._sections[sectionName];
			const fullSurvey = this.createSurveyElementFromDict(sectionDict, choices);
			return (fullSurvey as any).children ?? [];
		}

		if (type === "xml-external" || type === "csv-external") {
			// External instance - return a placeholder
			return new SurveyElement(d as SurveyElementData);
		}

		if (type === "entity") {
			// Entity declaration - preserve children data in extra_data
			const entityElement = new SurveyElement(d as SurveyElementData);
			if (!entityElement.extra_data) entityElement.extra_data = {};
			entityElement.extra_data._entity_children = d[constants.CHILDREN] ?? [];
			return entityElement;
		}

		// Save trigger info
		this._saveTrigger(d);

		return this._createQuestionFromDict(d, QUESTION_TYPE_DICT, choices);
	}

	private _saveTrigger(d: Record<string, any>): void {
		const trigger = d.trigger;
		if (!trigger) return;

		const triggers = Array.isArray(trigger) ? trigger : [trigger];
		for (const t of triggers) {
			const value =
				d[constants.BIND]?.calculate ?? "";
			const questionRef: [string, string] = [d[constants.NAME], value];
			if (d[constants.TYPE] === "background-geopoint") {
				if (!this.setgeopoint_by_triggering_ref[t]) {
					this.setgeopoint_by_triggering_ref[t] = [];
				}
				this.setgeopoint_by_triggering_ref[t].push(questionRef);
			} else {
				if (!this.setvalues_by_triggering_ref[t]) {
					this.setvalues_by_triggering_ref[t] = [];
				}
				this.setvalues_by_triggering_ref[t].push(questionRef);
			}
		}
	}

	private _createQuestionFromDict(
		d: Record<string, any>,
		qtd: Record<string, QuestionTypeEntry>,
		choices?: Record<string, Itemset> | null,
	): Question | Question[] {
		const typeStr = d[constants.TYPE];
		const questionClass = this._getQuestionClass(typeStr, qtd);

		if (!questionClass) return [];

		// If choices are available and the question references them
		if (choices && d[constants.ITEMSET]) {
			const itemset = choices[d[constants.ITEMSET]];
			if (itemset) {
				return new questionClass({
					...d,
					question_type_dictionary: qtd,
					choices: itemset,
				});
			}
		}

		return new questionClass({ ...d, question_type_dictionary: qtd });
	}

	private _getQuestionClass(
		typeStr: string,
		qtd: Record<string, QuestionTypeEntry>,
	): any {
		let controlTag = "";
		const questionType = qtd[typeStr];
		if (questionType) {
			const controlDict = questionType.control;
			if (controlDict) {
				controlTag = controlDict.tag ?? "";
				if (controlTag === "upload" && controlDict.mediatype === "osm/*") {
					controlTag = "osm";
				}
			}
		}

		return QUESTION_CLASSES[controlTag] ?? InputQuestion;
	}

	private _createSectionFromDict(
		d: Record<string, any>,
		choices?: Record<string, Itemset> | null,
	): Survey | GroupedSection | RepeatingSection {
		const children = d[constants.CHILDREN];
		const SectionClass = SECTION_CLASSES[d[constants.TYPE]];

		if (d[constants.TYPE] === constants.SURVEY && !d[constants.TITLE]) {
			d[constants.TITLE] = d[constants.NAME];
		}

		const result = new SectionClass(d);

		if (children) {
			for (const child of children) {
				let surveyElement: SurveyElement | SurveyElement[];
				if (result instanceof Survey) {
					surveyElement = this.createSurveyElementFromDict(
						child,
						result.choices,
					);
				} else {
					surveyElement = this.createSurveyElementFromDict(child, choices);
				}
				result.addChildren(surveyElement);
			}
		}

		return result;
	}

	private _createLoopFromDict(
		d: Record<string, any>,
		choices?: Record<string, Itemset> | null,
	): any {
		const children = d[constants.CHILDREN];
		const result = new GroupedSection({ ...d, [constants.TYPE]: constants.GROUP } as any);

		for (const columnDict of d[constants.COLUMNS] ?? []) {
			if (columnDict[constants.NAME] === "none") continue;

			const column = new GroupedSection({
				type: constants.GROUP,
				...columnDict,
			});
			if (children) {
				for (const child of children) {
					const questionDict = SurveyElementBuilder._nameAndLabelSubstitutions(child, columnDict);
					const question = this.createSurveyElementFromDict(questionDict, choices);
					column.addChildren(question as any);
				}
			}
			result.addChild(column);
		}

		if (result.name !== "") return result;
		return result.children;
	}

	/**
	 * Perform Python-style %(name)s / %(label)s substitutions on question templates
	 * for loop expansion. Mirrors Python pyxform's _name_and_label_substitutions.
	 */
	private static _nameAndLabelSubstitutions(
		questionTemplate: Record<string, any>,
		columnHeaders: Record<string, any>,
	): Record<string, any> {
		// If the label in columnHeaders has multiple languages, setup a
		// dictionary by language to do substitutions.
		let infoByLang: Record<string, Record<string, any>> | null = null;
		if (
			columnHeaders[constants.LABEL] &&
			typeof columnHeaders[constants.LABEL] === "object" &&
			!Array.isArray(columnHeaders[constants.LABEL])
		) {
			infoByLang = {};
			for (const lang of Object.keys(columnHeaders[constants.LABEL])) {
				infoByLang[lang] = {
					[constants.NAME]: columnHeaders[constants.NAME],
					[constants.LABEL]: columnHeaders[constants.LABEL][lang],
				};
			}
		}

		const result = { ...questionTemplate };
		for (const key of Object.keys(result)) {
			if (typeof result[key] === "string") {
				result[key] = pyPercentSubstitute(result[key], columnHeaders);
			} else if (
				result[key] &&
				typeof result[key] === "object" &&
				!Array.isArray(result[key])
			) {
				result[key] = { ...result[key] };
				for (const key2 of Object.keys(result[key])) {
					if (typeof result[key][key2] === "string") {
						if (
							infoByLang &&
							typeof columnHeaders[constants.LABEL] === "object"
						) {
							result[key][key2] = pyPercentSubstitute(
								result[key][key2],
								infoByLang[key2] ?? columnHeaders,
							);
						} else {
							result[key][key2] = pyPercentSubstitute(
								result[key][key2],
								columnHeaders,
							);
						}
					}
				}
			}
		}
		return result;
	}
}

/**
 * Python-style %(key)s substitution.
 * Replaces %(name)s, %(label)s etc. with values from the dict.
 */
function pyPercentSubstitute(
	template: string,
	values: Record<string, any>,
): string {
	return template.replace(/%\((\w+)\)s/g, (match, key) => {
		if (key in values) {
			return String(values[key]);
		}
		return match;
	});
}

export function createSurveyElementFromDict(
	d: Record<string, any>,
	sections?: Record<string, any>,
): SurveyElement {
	const builder = new SurveyElementBuilder();
	if (sections) builder.setSections(sections);
	return builder.createSurveyElementFromDict(d) as SurveyElement;
}

export function createSurvey(opts: {
	nameOfMainSection?: string;
	sections?: Record<string, any>;
	mainSection?: Record<string, any>;
	idString?: string;
	title?: string;
}): Survey {
	const sections = opts.sections ?? {};
	let mainSection = opts.mainSection;
	if (!mainSection && opts.nameOfMainSection) {
		mainSection = sections[opts.nameOfMainSection];
	}
	if (!mainSection) {
		throw new PyXFormError("No main section provided.");
	}

	const builder = new SurveyElementBuilder();
	builder.setSections(sections);

	if (!mainSection.id_string) {
		mainSection.id_string = opts.nameOfMainSection;
	}

	const survey = builder.createSurveyElementFromDict(mainSection) as Survey;

	if (opts.idString) {
		survey.id_string = opts.idString;
	}
	if (opts.title) {
		survey.title = opts.title;
	}

	return survey;
}

/**
 * Create a Survey from an XLS/XLSX/CSV file path.
 */
export function createSurveyFromXls(pathOrFile: string, defaultName?: string): Survey {
	const name = defaultName ?? undefined;
	const d = parseFileToJson(pathOrFile, { defaultName: name });
	const readerName = defaultName ?? path.basename(pathOrFile, path.extname(pathOrFile));
	const survey = createSurveyElementFromDict(d) as Survey;
	if (!survey.id_string) {
		survey.id_string = readerName;
	}
	return survey;
}

function sectionName(pathOrFileName: string): string {
	const basename = path.basename(pathOrFileName);
	const ext = path.extname(basename);
	return basename.slice(0, basename.length - ext.length);
}

function loadFileToDict(filePath: string): [string, Record<string, any>] {
	const name = sectionName(filePath);
	if (filePath.endsWith(".json")) {
		const content = fs.readFileSync(filePath, "utf-8");
		return [name, JSON.parse(content)];
	}
	return [name, parseFileToJson(filePath, { defaultName: name })];
}

/**
 * Create a Survey from a file path (XLS, XLSX, CSV, or JSON).
 */
export function createSurveyFromPath(filePath: string, includeDirectory = false): Survey {
	let nameOfMainSection: string;
	let sections: Record<string, any>;

	if (includeDirectory) {
		nameOfMainSection = sectionName(filePath);
		const dir = path.dirname(filePath);
		sections = collectCompatibleFiles(dir);
	} else {
		const [name, section] = loadFileToDict(filePath);
		nameOfMainSection = name;
		sections = { [name]: section };
	}

	return createSurvey({
		nameOfMainSection,
		sections,
	});
}

function collectCompatibleFiles(directory: string): Record<string, any> {
	const sections: Record<string, any> = {};
	const files = fs.readdirSync(directory);
	for (const file of files) {
		if (file.endsWith(".xls") || file.endsWith(".xlsx") || file.endsWith(".json")) {
			const fullPath = path.join(directory, file);
			const [name, section] = loadFileToDict(fullPath);
			sections[name] = section;
		}
	}
	return sections;
}
