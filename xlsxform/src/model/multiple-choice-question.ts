/**
 * MultipleChoiceQuestion - select one/multiple question type.
 */

import type {
	Document as XDocument,
	Element as XElement,
} from "@xmldom/xmldom";
import * as constants from "../constants.js";
import { PyXFormError } from "../errors.js";
import { RE_PYXFORM_REF, hasPyxformReference } from "../parsing/expression.js";
import { node } from "../utils.js";
import { Itemset, type Option } from "./option.js";
import { Question } from "./question.js";
import type { SurveyContext, SurveyElement } from "./survey-element.js";

// Use xmldom's Element type throughout (returned by node() from utils.ts)
type Element = XElement;

// ── Helper functions for MultipleChoiceQuestion.buildXml ──

/**
 * Find the nearest repeat ancestor of the given element.
 */
function findRepeatAncestor(element: SurveyElement): SurveyElement | null {
	for (const { element: ancestor } of element.iterAncestors()) {
		if (ancestor.type === "repeat") {
			return ancestor;
		}
	}
	return null;
}

/**
 * Compute a relative path from contextParts up to the target repeat,
 * producing a nodeset like "../../repeatName".
 */
function computeRelativeRepeatPath(
	contextParts: string[],
	targetRepeatParts: string[],
): string {
	const repeatParentParts = targetRepeatParts.slice(0, -1);
	let commonLen = 0;
	for (
		let i = 0;
		i < Math.min(contextParts.length, repeatParentParts.length);
		i++
	) {
		if (contextParts[i] === repeatParentParts[i]) {
			commonLen = i + 1;
		} else {
			break;
		}
	}
	const upsNeeded = contextParts.length - commonLen;
	const repeatName = targetRepeatParts[targetRepeatParts.length - 1];
	const ups = new Array(upsNeeded).fill("..").join("/");
	const downParts = repeatParentParts.slice(commonLen);
	return [ups, ...downParts, repeatName].filter(Boolean).join("/");
}

/**
 * Resolve a single ${var} reference in a choice filter for repeat context.
 * Variables in the target repeat become ./field_path,
 * variables elsewhere become current()/../var.
 */
function resolveRepeatFilterRef(
	refName: string,
	originalMatch: string,
	survey: SurveyContext,
	question: SurveyElement,
	targetRepeatParts: string[],
): string {
	const refElement = survey.getElementByName?.(refName);
	if (!refElement) {
		return originalMatch;
	}
	const refXpath = refElement.getXpath();
	const refParts = refXpath.split("/").filter(Boolean);
	const isInTargetRepeat =
		refParts.length > targetRepeatParts.length &&
		targetRepeatParts.every((p: string, i: number) => refParts[i] === p);
	if (isInTargetRepeat) {
		const fieldWithinRepeat = refParts
			.slice(targetRepeatParts.length)
			.join("/");
		return ` ./${fieldWithinRepeat} `;
	}
	const resolved = survey.getPathRelativeToLcar(question, refElement, refXpath);
	if (resolved !== refXpath) {
		return ` current()/${resolved} `;
	}
	return ` ${refXpath} `;
}

/**
 * Build the choice filter for a repeat-context previous question reference.
 */
function buildRepeatChoiceFilter(
	question: MultipleChoiceQuestion,
	survey: SurveyContext,
	targetRepeatXpath: string,
	targetRepeatParts: string[],
	relativeFieldPath: string,
	contextInRepeat: boolean,
	currentChoiceFilter: string | null,
): string | null {
	if (contextInRepeat && question.choice_filter) {
		RE_PYXFORM_REF.lastIndex = 0;
		return question.choice_filter.replace(
			RE_PYXFORM_REF,
			(match: string, refName: string) =>
				resolveRepeatFilterRef(
					refName,
					match,
					survey,
					question,
					targetRepeatParts,
				),
		);
	}
	if (contextInRepeat) {
		return `./${relativeFieldPath} != ''`;
	}
	// Not in repeat context - use absolute path
	if (currentChoiceFilter) {
		const absRepeatPath = `${targetRepeatXpath}/`;
		return currentChoiceFilter.split(absRepeatPath).join(" ./");
	}
	return `./${relativeFieldPath} != ''`;
}

interface PreviousQuestionResult {
	nodeset: string;
	choiceFilter: string | null;
	itemsetValueRef: string;
	itemsetLabelRef: string;
}

/**
 * Build nodeset for a previous-question itemset with a repeat ancestor.
 */
function buildRepeatNodeset(
	question: MultipleChoiceQuestion,
	survey: SurveyContext,
	targetElement: SurveyElement,
	targetRepeat: SurveyElement,
	choiceFilter: string | null,
): PreviousQuestionResult {
	const targetRepeatXpath = targetRepeat.getXpath();
	const targetRepeatParts = targetRepeatXpath.split("/").filter(Boolean);
	const targetXpathParts = targetElement.getXpath().split("/").filter(Boolean);
	const relativeFieldPath = targetXpathParts
		.slice(targetRepeatParts.length)
		.join("/");

	const contextInRepeat = findRepeatAncestor(question) !== null;
	let nodeset: string;
	if (contextInRepeat) {
		const contextParts = question.getXpath().split("/").filter(Boolean);
		nodeset = computeRelativeRepeatPath(contextParts, targetRepeatParts);
	} else {
		nodeset = targetRepeatXpath;
	}

	const resolvedFilter = buildRepeatChoiceFilter(
		question,
		survey,
		targetRepeatXpath,
		targetRepeatParts,
		relativeFieldPath,
		contextInRepeat,
		choiceFilter,
	);

	return {
		nodeset,
		choiceFilter: resolvedFilter,
		itemsetValueRef: relativeFieldPath,
		itemsetLabelRef: relativeFieldPath,
	};
}

/**
 * Fallback nodeset logic when we can't find the repeat ancestor.
 */
function buildFallbackNodeset(
	question: MultipleChoiceQuestion,
	survey: SurveyContext,
	choiceFilter: string | null,
): PreviousQuestionResult {
	const pathStr = survey
		.insertXpaths(question.itemset ?? "", question, false, true)
		.trim();
	const pathParts = pathStr.split("/");
	const nodeset = pathParts.slice(0, -1).join("/");
	const fieldName = pathParts[pathParts.length - 1];
	let resolvedFilter = choiceFilter;
	if (resolvedFilter) {
		resolvedFilter = resolvedFilter
			.replace(`current()/${nodeset}`, ".")
			.replace(nodeset, ".");
	} else {
		resolvedFilter = `./${fieldName} != ''`;
	}
	return {
		nodeset,
		choiceFilter: resolvedFilter,
		itemsetValueRef: fieldName,
		itemsetLabelRef: fieldName,
	};
}

/**
 * Build nodeset and refs for a previous-question itemset reference (${ref} syntax).
 */
function buildPreviousQuestionNodeset(
	question: MultipleChoiceQuestion,
	survey: SurveyContext,
	choiceFilter: string | null,
): PreviousQuestionResult {
	const refMatch = /\$\{([^}]+)\}/.exec(question.itemset ?? "");
	const targetVarName = refMatch ? refMatch[1] : (question.itemset ?? "");
	const targetElement = survey.getElementByName?.(targetVarName);
	const targetRepeat = targetElement ? findRepeatAncestor(targetElement) : null;

	if (!(targetRepeat && targetElement)) {
		return buildFallbackNodeset(question, survey, choiceFilter);
	}

	return buildRepeatNodeset(
		question,
		survey,
		targetElement,
		targetRepeat,
		choiceFilter,
	);
}

/**
 * Wrap a nodeset with randomize() if parameters request it.
 */
function applyRandomize(
	nodeset: string,
	parameters: Record<string, string> | null,
	survey: SurveyContext,
	question: SurveyElement,
): string {
	if (!parameters || parameters.randomize?.toLowerCase() !== "true") {
		return nodeset;
	}
	let result = `randomize(${nodeset}`;
	if (parameters.seed) {
		const seed = survey.insertXpaths(parameters.seed, question).trim();
		result = `${result}, ${seed}`;
	}
	return `${result})`;
}

/**
 * Build the label element for a search-based option.
 */
function buildOptionLabel(
	option: Option,
	choices: Itemset,
	hasLabel: boolean,
	survey: SurveyContext,
): Element {
	if (choices.requires_itext && option._choice_itext_ref) {
		return node("label", { attrs: { ref: option._choice_itext_ref } });
	}
	if (hasLabel) {
		const { text: labelText, hasOutput } = survey.insertOutputValues(
			typeof option.label === "string" ? option.label : "",
			option,
		);
		return node("label", { text: labelText, toParseString: hasOutput });
	}
	return node("label");
}

/**
 * Append search-based option items to the result element.
 */
function appendSearchChoices(
	result: Element,
	choices: Itemset,
	hasLabel: boolean,
	survey: SurveyContext,
): void {
	for (const option of choices.options) {
		const labelNode = buildOptionLabel(option, choices, hasLabel, survey);
		const itemElem = node("item", {
			children: [labelNode, node("value", { text: option.name })],
		});
		result.appendChild(
			(result.ownerDocument as XDocument).importNode(itemElem, true),
		);
	}
}

export class MultipleChoiceQuestion extends Question {
	choices: Itemset | null;
	itemset: string | null;
	list_name: string | null;

	constructor(
		data: ConstructorParameters<typeof Question>[0] & {
			itemset?: string | null;
			list_name?: string | null;
			choices?: Itemset | Record<string, unknown>[] | null;
		},
	) {
		const { choices: choicesData, ...rest } = data;
		super(rest);
		this.itemset = data.itemset ?? null;
		this.list_name = data.list_name ?? null;

		if (choicesData instanceof Itemset) {
			this.choices = choicesData;
		} else {
			this.choices = null;
		}
	}

	protected buildXml(survey: SurveyContext): Element | null {
		if (
			!(
				this.bind?.type &&
				["string", "odk:rank"].includes(this.bind.type as string)
			)
		) {
			throw new PyXFormError("Invalid value for bind type.");
		}

		const result = this._buildXml(survey);
		if (!result) {
			return null;
		}

		const choices = this.resolveChoices(survey);

		if (this.itemset && typeof this.itemset === "string") {
			this.appendItemsetElement(result, survey, choices);
		} else if (choices?.used_by_search) {
			appendSearchChoices(result, choices, !!this.label, survey);
		}

		return result;
	}

	private resolveChoices(survey: SurveyContext): Itemset | null {
		if (survey.choices) {
			const found =
				(survey.choices[this.itemset ?? ""] as Itemset | undefined) ?? null;
			if (found) {
				return found;
			}
		}
		return this.choices;
	}

	private parseItemsetName(): {
		itemsetName: string;
		fileExtension: string;
	} {
		const itemset = this.itemset ?? "";
		const dotIdx = itemset.lastIndexOf(".");
		if (dotIdx >= 0) {
			return {
				itemsetName: itemset.substring(0, dotIdx),
				fileExtension: itemset.substring(dotIdx),
			};
		}
		return { itemsetName: itemset, fileExtension: "" };
	}

	private resolveItemsetRefs(fileExtension: string): {
		itemsetValueRef: string;
		itemsetLabelRef: string;
	} {
		const isGeojson = fileExtension === ".geojson";
		let itemsetValueRef = isGeojson
			? constants.EXTERNAL_CHOICES_ITEMSET_REF_VALUE_GEOJSON
			: constants.DEFAULT_ITEMSET_VALUE_REF;
		let itemsetLabelRef = isGeojson
			? constants.EXTERNAL_CHOICES_ITEMSET_REF_LABEL_GEOJSON
			: constants.DEFAULT_ITEMSET_LABEL_REF;

		if (this.parameters) {
			itemsetValueRef = this.parameters.value ?? itemsetValueRef;
			itemsetLabelRef = this.parameters.label ?? itemsetLabelRef;
		}

		return { itemsetValueRef, itemsetLabelRef };
	}

	private resolveItemsetName(
		itemsetName: string,
		fileExtension: string,
		choices: Itemset | null,
	): { name: string; labelRef: string | null } {
		if (constants.EXTERNAL_INSTANCE_EXTENSIONS.has(fileExtension)) {
			return { name: itemsetName, labelRef: null };
		}
		const labelRef = choices?.requires_itext ? "jr:itext(itextId)" : null;
		return { name: this.itemset ?? itemsetName, labelRef };
	}

	private appendItemsetElement(
		result: Element,
		survey: SurveyContext,
		choices: Itemset | null,
	): void {
		const { itemsetName, fileExtension } = this.parseItemsetName();
		let { itemsetValueRef, itemsetLabelRef } =
			this.resolveItemsetRefs(fileExtension);
		const resolved = this.resolveItemsetName(
			itemsetName,
			fileExtension,
			choices,
		);
		if (resolved.labelRef) {
			itemsetLabelRef = resolved.labelRef;
		}

		let choiceFilter = this.choice_filter;
		if (choiceFilter) {
			choiceFilter = survey.insertXpaths(choiceFilter, this, true);
		}

		let nodeset: string;
		if (hasPyxformReference(this.itemset ?? "")) {
			const prevResult = buildPreviousQuestionNodeset(
				this,
				survey,
				choiceFilter,
			);
			nodeset = prevResult.nodeset;
			choiceFilter = prevResult.choiceFilter;
			itemsetValueRef = prevResult.itemsetValueRef;
			itemsetLabelRef = prevResult.itemsetLabelRef;
		} else {
			nodeset = `instance('${resolved.name}')/root/item`;
		}

		if (choiceFilter) {
			nodeset += `[${choiceFilter}]`;
		}

		nodeset = applyRandomize(nodeset, this.parameters, survey, this);

		const itemsetElem = node("itemset", {
			children: [
				node("value", { attrs: { ref: itemsetValueRef } }),
				node("label", { attrs: { ref: itemsetLabelRef } }),
			],
			attrs: { nodeset },
		});
		result.appendChild(
			(result.ownerDocument as XDocument).importNode(itemsetElem, true),
		);
	}
}
