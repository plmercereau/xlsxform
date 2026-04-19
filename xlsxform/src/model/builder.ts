/**
 * Survey builder - creates Survey objects from JSON dicts.
 */

import * as constants from "../constants.js";
import { PyXFormError } from "../errors.js";
import {
	QUESTION_TYPE_DICT,
	type QuestionTypeEntry,
} from "../question-type-dictionary.js";
import { MultipleChoiceQuestion } from "./multiple-choice-question.js";
import type { Itemset } from "./option.js";
import {
	InputQuestion,
	OsmUploadQuestion,
	type Question,
	TriggerQuestion,
	UploadQuestion,
} from "./question.js";
import { RangeQuestion } from "./range-question.js";
import {
	GroupedSection,
	RepeatingSection,
	type SectionData,
} from "./section.js";
import { SurveyElement, type SurveyElementData } from "./survey-element.js";
import { Survey } from "./survey.js";

type QuestionConstructor = new (data: Record<string, unknown>) => Question;
type SectionConstructor = new (data: Record<string, unknown>) => SurveyElement;

const QUESTION_CLASSES: Record<string, QuestionConstructor> = {
	"": InputQuestion as unknown as QuestionConstructor, // Default
	action: InputQuestion as unknown as QuestionConstructor,
	input: InputQuestion as unknown as QuestionConstructor,
	"odk:rank": MultipleChoiceQuestion as unknown as QuestionConstructor,
	range: RangeQuestion as unknown as QuestionConstructor,
	select: MultipleChoiceQuestion as unknown as QuestionConstructor,
	select1: MultipleChoiceQuestion as unknown as QuestionConstructor,
	osm: OsmUploadQuestion as unknown as QuestionConstructor,
	trigger: TriggerQuestion as unknown as QuestionConstructor,
	upload: UploadQuestion as unknown as QuestionConstructor,
};

const SECTION_CLASSES: Record<string, SectionConstructor> = {
	[constants.GROUP]: GroupedSection as unknown as SectionConstructor,
	[constants.REPEAT]: RepeatingSection as unknown as SectionConstructor,
	[constants.SURVEY]: Survey as unknown as SectionConstructor,
};

export class SurveyElementBuilder {
	private _addNoneOption = false;
	private _sections: Record<string, Record<string, unknown>> = {};
	setvalues_by_triggering_ref: Record<string, [string, string][]> = {};
	setgeopoint_by_triggering_ref: Record<string, [string, string][]> = {};

	constructor(
		opts: { sections?: Record<string, Record<string, unknown>> } = {},
	) {
		if (opts.sections) {
			this._sections = opts.sections;
		}
	}

	setSections(sections: Record<string, Record<string, unknown>>): void {
		this._sections = sections;
	}

	createSurveyElementFromDict(
		d: Record<string, unknown>,
		choices?: Record<string, Itemset> | null,
	): SurveyElement | SurveyElement[] {
		if (d.add_none_option != null) {
			this._addNoneOption = d.add_none_option as boolean;
		}

		const type = d[constants.TYPE] as string | undefined;

		if (type && type in SECTION_CLASSES) {
			return this._createSectionElement(d, type, choices);
		}

		if (type === constants.LOOP) {
			return this._createLoopFromDict(d, choices);
		}

		if (type === "include") {
			return this._createIncludeElement(d, choices);
		}

		if (type === "xml-external" || type === "csv-external") {
			return new SurveyElement(d as SurveyElementData);
		}

		if (type === "entity") {
			return this._createEntityElement(d);
		}

		this._saveTrigger(d);
		return this._createQuestionFromDict(d, QUESTION_TYPE_DICT, choices);
	}

	private _createSectionElement(
		d: Record<string, unknown>,
		type: string,
		choices?: Record<string, Itemset> | null,
	): Survey | GroupedSection | RepeatingSection {
		const section = this._createSectionFromDict(d, choices);

		if (type === constants.SURVEY) {
			(section as Survey).setvalues_by_triggering_ref =
				this.setvalues_by_triggering_ref;
			(section as Survey).setgeopoint_by_triggering_ref =
				this.setgeopoint_by_triggering_ref;
		}

		return section;
	}

	private _createIncludeElement(
		d: Record<string, unknown>,
		choices?: Record<string, Itemset> | null,
	): SurveyElement[] {
		const sectionName = d[constants.NAME] as string;
		if (!(sectionName in this._sections)) {
			throw new PyXFormError("This section has not been included.");
		}
		const sectionDict = this._sections[sectionName];
		const fullSurvey = this.createSurveyElementFromDict(sectionDict, choices);
		if (!Array.isArray(fullSurvey) && "children" in fullSurvey) {
			return (
				(fullSurvey as unknown as { children: SurveyElement[] }).children ?? []
			);
		}
		return [];
	}

	private _createEntityElement(d: Record<string, unknown>): SurveyElement {
		const entityElement = new SurveyElement(d as SurveyElementData);
		if (!entityElement.extra_data) {
			entityElement.extra_data = {};
		}
		entityElement.extra_data._entity_children = d[constants.CHILDREN] ?? [];
		return entityElement;
	}

	private _saveTrigger(d: Record<string, unknown>): void {
		const trigger = d.trigger;
		if (!trigger) {
			return;
		}

		const triggers = Array.isArray(trigger) ? trigger : [trigger];
		for (const t of triggers) {
			const bind = d[constants.BIND] as Record<string, unknown> | undefined;
			const value = (bind?.calculate as string) ?? "";
			const questionRef: [string, string] = [
				d[constants.NAME] as string,
				value,
			];
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
		d: Record<string, unknown>,
		qtd: Record<string, QuestionTypeEntry>,
		choices?: Record<string, Itemset> | null,
	): Question | Question[] {
		const typeStr = d[constants.TYPE] as string;
		const questionClass = this._getQuestionClass(typeStr, qtd);

		if (!questionClass) {
			return [];
		}

		// If choices are available and the question references them
		if (choices && d[constants.ITEMSET]) {
			const itemset = choices[d[constants.ITEMSET] as string];
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
	): QuestionConstructor {
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
		d: Record<string, unknown>,
		choices?: Record<string, Itemset> | null,
	): Survey | GroupedSection | RepeatingSection {
		const children = d[constants.CHILDREN] as
			| Record<string, unknown>[]
			| undefined;
		const SectionClass = SECTION_CLASSES[d[constants.TYPE] as string];

		if (d[constants.TYPE] === constants.SURVEY && !d[constants.TITLE]) {
			d[constants.TITLE] = d[constants.NAME];
		}

		const result = new SectionClass(d) as
			| Survey
			| GroupedSection
			| RepeatingSection;

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
		d: Record<string, unknown>,
		choices?: Record<string, Itemset> | null,
	): GroupedSection | SurveyElement[] {
		const children = d[constants.CHILDREN] as
			| Record<string, unknown>[]
			| undefined;
		const result = new GroupedSection({
			...d,
			[constants.TYPE]: constants.GROUP,
		} as unknown as SectionData);

		const columns = (d[constants.COLUMNS] ?? []) as Record<string, unknown>[];
		for (const columnDict of columns) {
			if (columnDict[constants.NAME] === "none") {
				continue;
			}

			const column = new GroupedSection({
				type: constants.GROUP,
				...columnDict,
			} as SectionData);
			if (children) {
				for (const child of children) {
					const questionDict = SurveyElementBuilder._nameAndLabelSubstitutions(
						child,
						columnDict,
					);
					const question = this.createSurveyElementFromDict(
						questionDict,
						choices,
					);
					column.addChildren(question as SurveyElement | SurveyElement[]);
				}
			}
			result.addChild(column);
		}

		if (result.name !== "") {
			return result;
		}
		return result.children;
	}

	/**
	 * Perform Python-style %(name)s / %(label)s substitutions on question templates
	 * for loop expansion. Mirrors Python pyxform's _name_and_label_substitutions.
	 */
	private static _nameAndLabelSubstitutions(
		questionTemplate: Record<string, unknown>,
		columnHeaders: Record<string, unknown>,
	): Record<string, unknown> {
		const infoByLang = buildInfoByLang(columnHeaders);

		const result: Record<string, unknown> = { ...questionTemplate };
		for (const key of Object.keys(result)) {
			const val = result[key];
			if (typeof val === "string") {
				result[key] = pyPercentSubstitute(val, columnHeaders);
			} else if (val && typeof val === "object" && !Array.isArray(val)) {
				result[key] = substituteNested(
					val as Record<string, unknown>,
					columnHeaders,
					infoByLang,
				);
			}
		}
		return result;
	}
}

/**
 * Build a language-keyed substitution map from multi-language labels.
 */
function buildInfoByLang(
	columnHeaders: Record<string, unknown>,
): Record<string, Record<string, unknown>> | null {
	const colLabel = columnHeaders[constants.LABEL];
	if (!colLabel || typeof colLabel !== "object" || Array.isArray(colLabel)) {
		return null;
	}
	const labelObj = colLabel as Record<string, unknown>;
	const result: Record<string, Record<string, unknown>> = {};
	for (const lang of Object.keys(labelObj)) {
		result[lang] = {
			[constants.NAME]: columnHeaders[constants.NAME],
			[constants.LABEL]: labelObj[lang],
		};
	}
	return result;
}

/**
 * Apply substitutions to a nested object's string values.
 */
function substituteNested(
	obj: Record<string, unknown>,
	columnHeaders: Record<string, unknown>,
	infoByLang: Record<string, Record<string, unknown>> | null,
): Record<string, unknown> {
	const nested = { ...obj };
	const hasMultiLangLabel =
		infoByLang && typeof columnHeaders[constants.LABEL] === "object";

	for (const key of Object.keys(nested)) {
		if (typeof nested[key] !== "string") {
			continue;
		}
		const context =
			hasMultiLangLabel && infoByLang[key] ? infoByLang[key] : columnHeaders;
		nested[key] = pyPercentSubstitute(nested[key] as string, context);
	}
	return nested;
}

/**
 * Python-style %(key)s substitution.
 * Replaces %(name)s, %(label)s etc. with values from the dict.
 */
function pyPercentSubstitute(
	template: string,
	values: Record<string, unknown>,
): string {
	return template.replace(/%\((\w+)\)s/g, (match, key) => {
		if (key in values) {
			return String(values[key]);
		}
		return match;
	});
}

export function createSurveyElementFromDict(
	d: Record<string, unknown>,
	sections?: Record<string, Record<string, unknown>>,
): SurveyElement {
	const builder = new SurveyElementBuilder();
	if (sections) {
		builder.setSections(sections);
	}
	return builder.createSurveyElementFromDict(d) as SurveyElement;
}

export function createSurvey(opts: {
	nameOfMainSection?: string;
	sections?: Record<string, Record<string, unknown>>;
	mainSection?: Record<string, unknown>;
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
