/**
 * Section survey element module - groups and repeats.
 */

import type {
	Document as XDocument,
	Element as XElement,
} from "@xmldom/xmldom";
import * as constants from "../constants.js";
import { node } from "../utils.js";
import { type Question, defaultIsDynamic } from "./question.js";
import {
	type SurveyContext,
	SurveyElement,
	type SurveyElementData,
} from "./survey-element.js";

// Use xmldom's Element type throughout (returned by node() from utils.ts)
type Element = XElement;

export interface SectionData extends SurveyElementData {
	flat?: boolean | null;
	sms_field?: string | null;
}

export class Section extends SurveyElement {
	children: (Section | Question | SurveyElement)[];
	flat: boolean | null;
	sms_field: string | null;

	constructor(data: SectionData) {
		super(data);
		this.children = [];
		this.flat = data.flat ?? null;
		this.sms_field = data.sms_field ?? null;
	}

	addChild(child: SurveyElement): void {
		this.children.push(child as Section | Question);
		child.setParent(this);
	}

	addChildren(children: SurveyElement | SurveyElement[]): void {
		if (Array.isArray(children)) {
			for (const child of children) {
				this.addChild(child);
			}
		} else {
			this.addChild(children);
		}
	}

	validate(): void {
		super.validate();
		for (const child of this.children) {
			child.validate();
		}
	}

	*iterDescendants(): Generator<SurveyElement> {
		yield this;
		for (const child of this.children) {
			if (child instanceof Section) {
				yield* child.iterDescendants();
			} else {
				yield child;
			}
		}
	}

	xmlInstance(survey: SurveyContext, _appendTemplate = false): Element {
		let appendTemplate = _appendTemplate;
		const attrs: Record<string, string> = {};
		if (this.instance) {
			for (const [k, v] of Object.entries(this.instance)) {
				attrs[k] = survey.insertXpaths(v, this);
			}
		}

		const elem = node(this.name, { attrs });

		for (const child of this.children) {
			if (child instanceof ExternalInstance) {
				continue;
			}

			let repeatingTemplate: Element | null = null;
			if (child instanceof RepeatingSection && !appendTemplate) {
				appendTemplate = true;
				repeatingTemplate = child.generateRepeatingTemplate(survey);
			}

			const childInstance = child.xmlInstance(survey, appendTemplate);
			if (childInstance) {
				const doc = elem.ownerDocument as XDocument;
				if (appendTemplate && repeatingTemplate) {
					// Insert template before the regular instance
					elem.appendChild(doc.importNode(repeatingTemplate, true));
					appendTemplate = false;
				}
				elem.appendChild(doc.importNode(childInstance, true));
			}
		}

		return elem;
	}

	*xmlBindings(survey: SurveyContext): Generator<Element> {
		// Only yield own bind - children are handled by Survey.iterDescendants
		yield* super.xmlBindings(survey);
	}

	*xmlControl(survey: SurveyContext): Generator<Element> {
		for (const child of this.children) {
			yield* collectControlElements(child, survey);
		}
	}

	/**
	 * Build control attributes from this section's control map,
	 * applying insertXpaths to each value.
	 */
	protected buildControlAttrs(
		survey: SurveyContext,
		initial?: Record<string, string>,
	): Record<string, string> {
		const attrs: Record<string, string> = { ...initial };
		if (this.control) {
			for (const [k, v] of Object.entries(this.control)) {
				attrs[k] = survey.insertXpaths(String(v), this);
			}
		}
		return attrs;
	}
}

/**
 * Collect XML control elements from a child, handling both
 * single-element and iterable returns.
 */
function collectControlElements(
	child: SurveyElement,
	survey: SurveyContext,
): Element[] {
	const result: Element[] = [];
	const control = child.xmlControl(survey);
	if (control != null) {
		if (Symbol.iterator in new Object(control)) {
			for (const c of control as Iterable<Element>) {
				result.push(c);
			}
		} else {
			result.push(control as Element);
		}
	}
	return result;
}

export class RepeatingSection extends Section {
	constructor(data: SectionData) {
		super({ ...data, type: data.type ?? constants.REPEAT });
	}

	*xmlControl(survey: SurveyContext): Generator<Element> {
		const controlAttrs = this.buildControlAttrs(survey, {
			nodeset: this.getXpath(),
		});

		const repeatChildren: Element[] = [];
		for (const child of this.children) {
			repeatChildren.push(...collectControlElements(child, survey));
		}
		repeatChildren.push(...this._collectRepeatSetvalues(survey));

		const repeatNode = node("repeat", {
			children: repeatChildren,
			attrs: controlAttrs,
		});

		const label = this.xmlLabel(survey);
		yield node("group", {
			children: [label, repeatNode],
			attrs: { ref: this.getXpath() },
		});
	}

	/**
	 * Find the closest repeat ancestor for an element, stopping at this section.
	 * Returns this section if the element has no closer repeat ancestor.
	 */
	private _closestRepeatAncestor(element: SurveyElement): SurveyElement {
		let current = element.parent;
		while (current && current !== this) {
			if (current.type === constants.REPEAT) {
				return current;
			}
			current = current.parent;
		}
		return this;
	}

	/**
	 * Collect setvalue elements for dynamic defaults and entity setvalues
	 * inside this repeat (only direct descendants, not nested repeats).
	 */
	private _collectRepeatSetvalues(survey: SurveyContext): Element[] {
		const result: Element[] = [];
		for (const element of this.iterDescendants()) {
			if (element === this) {
				continue;
			}
			if (this._closestRepeatAncestor(element) !== this) {
				continue;
			}
			this._addDynamicDefaultSetvalue(result, element, survey);
			this._addEntitySetvalues(result, element);
		}
		return result;
	}

	/**
	 * If the element has a dynamic default, add an odk-new-repeat setvalue node.
	 */
	private _addDynamicDefaultSetvalue(
		result: Element[],
		element: SurveyElement,
		survey: SurveyContext,
	): void {
		if (
			element.default &&
			typeof element.default === "string" &&
			defaultIsDynamic(element.default, element.type)
		) {
			const value = survey.insertXpaths(element.default, element);
			result.push(
				node("setvalue", {
					attrs: {
						event: "odk-new-repeat",
						ref: element.getXpath(),
						value,
					},
				}),
			);
		}
	}

	/**
	 * If the element is an entity type, add its odk-new-repeat setvalue nodes.
	 */
	private _addEntitySetvalues(result: Element[], element: SurveyElement): void {
		if (
			element.type !== "entity" ||
			typeof element.getEntitySetvalues !== "function"
		) {
			return;
		}
		for (const sv of element.getEntitySetvalues()) {
			if (sv.event === "odk-new-repeat") {
				result.push(
					node("setvalue", {
						attrs: { event: sv.event, ref: sv.ref, value: sv.value },
					}),
				);
			}
		}
	}

	xmlInstance(survey: SurveyContext, _appendTemplate = false): Element {
		let appendTemplate = _appendTemplate;
		const elem = node(this.name);
		for (const child of this.children) {
			if (child instanceof ExternalInstance) {
				continue;
			}

			let repeatingTemplate: Element | null = null;
			if (child instanceof RepeatingSection && !appendTemplate) {
				appendTemplate = true;
				repeatingTemplate = child.generateRepeatingTemplate(survey);
			}

			const childInstance = child.xmlInstance(survey, appendTemplate);
			if (childInstance) {
				const doc = elem.ownerDocument as XDocument;
				if (appendTemplate && repeatingTemplate) {
					elem.appendChild(doc.importNode(repeatingTemplate, true));
					appendTemplate = false;
				}
				elem.appendChild(doc.importNode(childInstance, true));
			}
		}
		return elem;
	}

	/**
	 * Generate the jr:template version of this repeat.
	 * Inside the template, nested repeats only get their template version (no regular).
	 * Non-repeat children (groups, questions) get their regular xml_instance,
	 * which means groups may generate template+regular for their nested repeats.
	 */
	generateRepeatingTemplate(survey: SurveyContext): Element {
		const elem = node(this.name, { attrs: { "jr:template": "" } });
		for (const child of this.children) {
			if (child instanceof ExternalInstance) {
				continue;
			}
			if (child instanceof RepeatingSection) {
				// Only generate the template version for nested repeats
				const templateInstance = child.generateRepeatingTemplate(survey);
				if (templateInstance) {
					const doc = elem.ownerDocument as XDocument;
					elem.appendChild(doc.importNode(templateInstance, true));
				}
			} else {
				// For non-repeat children (groups, questions), generate regular instance
				// Groups will internally handle their own nested repeat templates
				const childInstance = child.xmlInstance(survey);
				if (childInstance) {
					const doc = elem.ownerDocument as XDocument;
					elem.appendChild(doc.importNode(childInstance, true));
				}
			}
		}
		return elem;
	}
}

export class GroupedSection extends Section {
	constructor(data: SectionData) {
		super({ ...data, type: data.type ?? constants.GROUP });
	}

	*xmlControl(survey: SurveyContext): Generator<Element> {
		if (this.control?.bodyless) {
			return;
		}

		const attrs = this._buildGroupAttrs(survey);
		const children = this._buildGroupChildren(survey);

		yield node("group", { children, attrs });
	}

	private _buildGroupAttrs(survey: SurveyContext): Record<string, string> {
		const attrs: Record<string, string> = {};
		if (this.control) {
			for (const [k, v] of Object.entries(this.control)) {
				if (k === "bodyless") {
					continue;
				}
				attrs[k] = survey.insertXpaths(String(v), this);
			}
		}
		if (!this.flat) {
			attrs.ref = this.getXpath();
		}
		return attrs;
	}

	private _buildGroupChildren(survey: SurveyContext): Element[] {
		const children: Element[] = [];
		if (this.label) {
			children.push(this.xmlLabel(survey));
		}
		for (const child of this.children) {
			children.push(...collectControlElements(child, survey));
		}
		return children;
	}
}

// Placeholder for ExternalInstance
class ExternalInstance extends SurveyElement {}
