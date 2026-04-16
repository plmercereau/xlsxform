/**
 * Section survey element module - groups and repeats.
 */

import * as constants from "./constants.js";
import { type Question, defaultIsDynamic } from "./question.js";
import { SurveyElement, type SurveyElementData } from "./survey-element.js";
import { node } from "./utils.js";

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

	xmlInstance(survey: any, _appendTemplate = false): Element {
		let appendTemplate = _appendTemplate;
		const attrs: Record<string, string> = {};
		if (this.instance) {
			for (const [k, v] of Object.entries(this.instance)) {
				attrs[k] = survey.insertXpaths(v, this);
			}
		}

		const elem = node(this.name, { attrs });

		for (const child of this.children) {
			if (child instanceof ExternalInstance) continue;

			let repeatingTemplate: Element | null = null;
			if (child instanceof RepeatingSection && !appendTemplate) {
				appendTemplate = true;
				repeatingTemplate = child.generateRepeatingTemplate(survey);
			}

			const childInstance = child.xmlInstance(survey, appendTemplate);
			if (childInstance) {
				const doc = elem.ownerDocument!;
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

	*xmlBindings(survey: any): Generator<Element> {
		// Only yield own bind - children are handled by Survey.iterDescendants
		yield* super.xmlBindings(survey);
	}

	*xmlControl(survey: any): Generator<Element> {
		for (const child of this.children) {
			const control = child.xmlControl(survey);
			if (control != null) {
				if (Symbol.iterator in Object(control)) {
					yield* control as any;
				} else {
					yield control as Element;
				}
			}
		}
	}
}

export class RepeatingSection extends Section {
	constructor(data: SectionData) {
		super({ ...data, type: data.type ?? constants.REPEAT });
	}

	*xmlControl(survey: any): Generator<Element> {
		const controlAttrs: Record<string, string> = {
			nodeset: this.getXpath(),
		};
		if (this.control) {
			for (const [k, v] of Object.entries(this.control)) {
				controlAttrs[k] = survey.insertXpaths(String(v), this);
			}
		}

		const repeatChildren: Element[] = [];
		for (const child of this.children) {
			const control = child.xmlControl(survey);
			if (control != null) {
				if (Symbol.iterator in Object(control)) {
					for (const c of control as any) {
						repeatChildren.push(c);
					}
				} else {
					repeatChildren.push(control as Element);
				}
			}
		}

		// Add setvalue elements for dynamic defaults inside this repeat.
		// Only include elements whose closest ancestor repeat is THIS repeat,
		// not elements inside deeper nested repeats.
		for (const element of this.iterDescendants()) {
			if (element === this) continue;
			// Skip elements that are inside a deeper nested repeat
			if (this._closestRepeatAncestor(element) !== this) continue;
			if (
				element.default &&
				typeof element.default === "string" &&
				defaultIsDynamic(element.default, element.type)
			) {
				const value = survey.insertXpaths(element.default, element);
				repeatChildren.push(
					node("setvalue", {
						attrs: {
							event: "odk-new-repeat",
							ref: element.getXpath(),
							value,
						},
					}),
				);
			}
			// Add entity setvalue elements for odk-new-repeat inside repeats
			if (
				element.type === "entity" &&
				typeof element.getEntitySetvalues === "function"
			) {
				for (const sv of element.getEntitySetvalues()) {
					if (sv.event === "odk-new-repeat") {
						repeatChildren.push(
							node("setvalue", {
								attrs: {
									event: sv.event,
									ref: sv.ref,
									value: sv.value,
								},
							}),
						);
					}
				}
			}
		}

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

	xmlInstance(survey: any, _appendTemplate = false): Element {
		let appendTemplate = _appendTemplate;
		const elem = node(this.name);
		for (const child of this.children) {
			if (child instanceof ExternalInstance) continue;

			let repeatingTemplate: Element | null = null;
			if (child instanceof RepeatingSection && !appendTemplate) {
				appendTemplate = true;
				repeatingTemplate = child.generateRepeatingTemplate(survey);
			}

			const childInstance = child.xmlInstance(survey, appendTemplate);
			if (childInstance) {
				const doc = elem.ownerDocument!;
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
	generateRepeatingTemplate(survey: any): Element {
		const elem = node(this.name, { attrs: { "jr:template": "" } });
		for (const child of this.children) {
			if (child instanceof ExternalInstance) continue;
			if (child instanceof RepeatingSection) {
				// Only generate the template version for nested repeats
				const templateInstance = child.generateRepeatingTemplate(survey);
				if (templateInstance) {
					const doc = elem.ownerDocument!;
					elem.appendChild(doc.importNode(templateInstance, true));
				}
			} else {
				// For non-repeat children (groups, questions), generate regular instance
				// Groups will internally handle their own nested repeat templates
				const childInstance = child.xmlInstance(survey);
				if (childInstance) {
					const doc = elem.ownerDocument!;
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

	*xmlControl(survey: any): Generator<Element> {
		if (this.control?.bodyless) return;

		const attrs: Record<string, string> = {};
		if (this.control) {
			for (const [k, v] of Object.entries(this.control)) {
				if (k === "bodyless") continue;
				attrs[k] = survey.insertXpaths(String(v), this);
			}
		}
		if (!this.flat) {
			attrs.ref = this.getXpath();
		}

		const children: Element[] = [];
		if (this.label) {
			children.push(this.xmlLabel(survey));
		}
		for (const child of this.children) {
			const control = child.xmlControl(survey);
			if (control != null) {
				if (Symbol.iterator in Object(control)) {
					for (const c of control as any) {
						children.push(c);
					}
				} else {
					children.push(control as Element);
				}
			}
		}

		yield node("group", { children, attrs });
	}
}

// Placeholder for ExternalInstance
class ExternalInstance extends SurveyElement {}
