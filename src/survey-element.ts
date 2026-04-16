/**
 * Base class for all survey elements.
 */

import { BINDING_CONVERSIONS } from "./aliases.js";
import * as constants from "./constants.js";
import { PyXFormError } from "./errors.js";
import { hasPyxformReference, isXmlTag } from "./parsing/expression.js";
import { node } from "./utils.js";

export interface SurveyElementData {
	name: string;
	label?: string | Record<string, string> | null;
	hint?: string | Record<string, string> | null;
	guidance_hint?: string | Record<string, string> | null;
	type?: string;
	bind?: Record<string, any> | null;
	control?: Record<string, any> | null;
	media?: Record<string, string> | null;
	instance?: Record<string, string> | null;
	default?: string | null;
	children?: any[];
	parent?: SurveyElement | null;
	[key: string]: any;
}

export class SurveyElement {
	name: string;
	label: string | Record<string, string> | null;
	hint: string | Record<string, string> | null;
	guidance_hint: string | Record<string, string> | null;
	type: string | null;
	bind: Record<string, any> | null;
	control: Record<string, any> | null;
	media: Record<string, string> | null;
	instance: Record<string, string> | null;
	default: string | null;
	parent: SurveyElement | null;
	extra_data: Record<string, any> | null;
	private _xpath: string | null = null;

	constructor(data: SurveyElementData) {
		this.name = data.name;
		this.label = data.label ?? null;
		this.hint = data.hint ?? null;
		this.guidance_hint = data.guidance_hint ?? null;
		this.type = data.type ?? null;
		this.bind = data.bind ?? null;
		this.control = data.control ?? null;
		this.media = data.media ?? null;
		this.instance = data.instance ?? null;
		this.default = data.default ?? null;
		this.parent = data.parent ?? null;
		this.extra_data = null;

		// Store any extra data
		const knownKeys = new Set([
			"name",
			"label",
			"hint",
			"guidance_hint",
			"type",
			"bind",
			"control",
			"media",
			"instance",
			"default",
			"parent",
			"children",
			"choices",
			"itemset",
			"list_name",
			"choice_filter",
			"parameters",
			"trigger",
			"query",
			"sms_field",
			"actions",
			"flat",
		]);
		const extra: Record<string, any> = {};
		for (const [k, v] of Object.entries(data)) {
			if (!knownKeys.has(k) && v != null) {
				extra[k] = v;
			}
		}
		if (Object.keys(extra).length > 0) {
			this.extra_data = extra;
		}
	}

	get nameForXpath(): string {
		return this.name;
	}

	validate(): void {
		if (!isXmlTag(this.name)) {
			throw new PyXFormError(
				`The '${this.name}' value is invalid. Names must begin with a letter or underscore.`,
			);
		}
	}

	getXpath(relativeTo?: SurveyElement | null): string {
		if (this._xpath && !relativeTo) return this._xpath;

		const parts: string[] = [];
		let current: SurveyElement | null = this;
		while (current != null) {
			if (relativeTo && current === relativeTo) break;
			parts.unshift(current.nameForXpath);
			current = current.parent;
		}
		const xpath = `/${parts.join("/")}`;
		if (!relativeTo) this._xpath = xpath;
		return xpath;
	}

	clearXpathCache(): void {
		this._xpath = null;
	}

	setParent(parent: SurveyElement): void {
		this.parent = parent;
		this._xpath = null;
	}

	translationPath(displayElement: string): string {
		return `${this.getXpath()}:${displayElement}`;
	}

	needsItextRef(): boolean {
		return (
			(this.label != null && typeof this.label === "object") ||
			(this.media != null &&
				typeof this.media === "object" &&
				Object.keys(this.media).length > 0)
		);
	}

	/**
	 * Generate the label XML element.
	 */
	xmlLabel(survey: any): Element {
		if (this.needsItextRef()) {
			const ref = `jr:itext('${this.translationPath("label")}')`;
			return node("label", { attrs: { ref } });
		}
		if (this.label && typeof this.label === "string") {
			const { text, hasOutput } = survey.insertOutputValues(this.label, this);
			return node("label", { text, toParseString: hasOutput });
		}
		return node("label");
	}

	/**
	 * Generate the hint XML element.
	 */
	xmlHint(survey: any): Element {
		if (
			(this.hint != null && typeof this.hint === "object") ||
			this.guidance_hint
		) {
			const path = this.translationPath("hint");
			return node("hint", { attrs: { ref: `jr:itext('${path}')` } });
		}
		if (this.hint && typeof this.hint === "string") {
			const { text, hasOutput } = survey.insertOutputValues(this.hint, this);
			return node("hint", { text, toParseString: hasOutput });
		}
		return node("hint");
	}

	/**
	 * Return label and hint elements.
	 */
	xmlLabelAndHint(survey: any): Element[] {
		const result: Element[] = [];
		let labelAppended = false;

		if (this.label || this.media) {
			result.push(this.xmlLabel(survey));
			labelAppended = true;
		}

		if (this.hint || this.guidance_hint) {
			// guidance_hint alone (without label or hint) is not sufficient
			if (!this.label && !this.hint && !this.media) {
				throw new PyXFormError(
					`The survey element named '${this.name}' has no label or hint.`,
				);
			}
			if (!labelAppended) {
				result.push(this.xmlLabel(survey));
			}
			result.push(this.xmlHint(survey));
		}

		if (result.length === 0) {
			throw new PyXFormError(
				`The survey element named '${this.name}' has no label or hint.`,
			);
		}

		// big-image must combine with image
		if (
			this.media &&
			typeof this.media === "object" &&
			!("image" in this.media) &&
			"big-image" in this.media
		) {
			throw new PyXFormError(
				`To use big-image, you must also specify an image for the survey element named ${this.name}.`,
			);
		}

		return result;
	}

	/**
	 * Generate the instance XML for this element.
	 */
	xmlInstance(survey: any): Element {
		if (this.type === "entity" && this.extra_data?._entity_children) {
			return this._xmlEntityInstance();
		}
		return node(this.name);
	}

	/**
	 * Generate instance XML for entity elements.
	 */
	private _xmlEntityInstance(): Element {
		const children = this.extra_data!._entity_children as any[];
		const attrs: Record<string, string> = {};
		const childElements: Element[] = [];

		for (const child of children) {
			if (child.type === "attribute") {
				attrs[child[constants.NAME]] = child.value ?? "";
			} else if (child.type === "label") {
				childElements.push(node("label"));
			}
		}

		return node(this.name, { children: childElements, attrs });
	}

	/**
	 * Generate bind XML elements for entity children (attributes and label).
	 */
	private *_xmlEntityBindings(survey: any): Generator<Element> {
		const children = this.extra_data!._entity_children as any[];
		const entityXpath = this.getXpath();

		for (const child of children) {
			if (!child[constants.BIND]) continue;
			const bindData = child[constants.BIND];
			const bindDict: Record<string, string> = {};

			let nodeset: string;
			let context: SurveyElement;
			if (child.type === "attribute") {
				nodeset = `${entityXpath}/@${child[constants.NAME]}`;
				context = this._createChildProxy(`@${child[constants.NAME]}`);
			} else {
				// label - one level deeper than entity
				nodeset = `${entityXpath}/${child[constants.NAME]}`;
				context = this._createChildProxy(child[constants.NAME]);
			}

			for (const [k, v] of Object.entries(bindData)) {
				if (typeof v === "string") {
					bindDict[k] = survey.insertXpaths(v, context);
				}
			}

			yield node("bind", {
				attrs: { nodeset, ...bindDict },
			});
		}
	}

	/**
	 * Create a child proxy element for xpath resolution.
	 */
	private _createChildProxy(childName: string): SurveyElement {
		const proxy = new SurveyElement({ name: childName });
		proxy.setParent(this);
		return proxy;
	}

	/**
	 * Get entity setvalue elements (for uuid generation).
	 */
	getEntitySetvalues(): { ref: string; event: string; value: string }[] {
		if (this.type !== "entity" || !this.extra_data?._entity_children) return [];
		const children = this.extra_data._entity_children as any[];
		const entityXpath = this.getXpath();
		const result: { ref: string; event: string; value: string }[] = [];

		for (const child of children) {
			if (child.actions && Array.isArray(child.actions)) {
				for (const action of child.actions) {
					if (action.name === "setvalue") {
						result.push({
							ref: `${entityXpath}/@${child[constants.NAME]}`,
							event: action.event,
							value: action.value,
						});
					}
				}
			}
		}
		return result;
	}

	/**
	 * Generate bind XML elements.
	 */
	/** Whether this element has a trigger (overridden by Question) */
	protected hasTrigger(): boolean {
		return false;
	}

	*xmlBindings(survey: any): Generator<Element> {
		if (this.type === "entity" && this.extra_data?._entity_children) {
			yield* this._xmlEntityBindings(survey);
			return;
		}
		if (!this.bind) return;

		const TRANSLATABLE_BIND_KEYS = new Set([
			"jr:constraintMsg",
			"jr:requiredMsg",
			"jr:noAppErrorString",
		]);
		const skipCalculate = this.hasTrigger();

		const bindDict: Record<string, string> = {};
		for (let [k, v] of Object.entries(this.bind)) {
			// Skip calculate when element has a trigger (it becomes a setvalue)
			if (skipCalculate && k === "calculate") continue;
			if (typeof v === "string") {
				// Apply binding conversions (yes→true(), no→false(), etc.)
				if (
					constants.CONVERTIBLE_BIND_ATTRIBUTES.has(k) &&
					v in BINDING_CONVERSIONS
				) {
					v = BINDING_CONVERSIONS[v];
				}
				// Translatable bind attrs with ${ref} → use itext reference
				if (TRANSLATABLE_BIND_KEYS.has(k) && hasPyxformReference(v)) {
					bindDict[k] = `jr:itext('${this.translationPath(k)}')`;
				} else {
					bindDict[k] = survey.insertXpaths(v, this);
				}
			} else if (typeof v === "object") {
				// Multi-language dict → use itext reference
				if (TRANSLATABLE_BIND_KEYS.has(k)) {
					bindDict[k] = `jr:itext('${this.translationPath(k)}')`;
				}
			} else {
				bindDict[k] = String(v);
			}
		}

		yield node("bind", {
			attrs: { nodeset: this.getXpath(), ...bindDict },
		});
	}

	/**
	 * Generate the control XML. Subclasses override this.
	 */
	xmlControl(survey: any): any {
		return null;
	}

	/**
	 * Iterate over ancestors, optionally filtering by a condition.
	 */
	*iterAncestors(
		condition?: (e: SurveyElement) => boolean,
	): Generator<{ element: SurveyElement; distance: number }> {
		let distance = 1;
		let current = this.parent;
		while (current != null) {
			if (!condition || condition(current)) {
				yield { element: current, distance };
			}
			current = current.parent;
			distance++;
		}
	}

	/**
	 * Find the lowest common ancestor with another element.
	 * Returns [relationType, stepsFromSelf, stepsFromOther, ancestor].
	 */
	lowestCommonAncestor(
		other: SurveyElement,
		groupType?: string,
	): [string, number | null, number | null, SurveyElement | null] {
		const typeFilter = groupType
			? new Set([groupType])
			: new Set([constants.GROUP, constants.REPEAT]);

		const selfAncestors = new Map<SurveyElement, number>();
		const otherAncestors = new Map<SurveyElement, number>();
		let selfCurrent: SurveyElement | null = this.parent;
		let otherCurrent: SurveyElement | null = other.parent;
		let selfDistance = 1;
		let otherDistance = 1;
		let lca: SurveyElement | null = null;

		while (selfCurrent || otherCurrent) {
			if (selfCurrent) {
				selfAncestors.set(selfCurrent, selfDistance);
				if (
					selfCurrent.type &&
					typeFilter.has(selfCurrent.type) &&
					otherAncestors.has(selfCurrent)
				) {
					lca = selfCurrent;
					break;
				}
				selfDistance++;
				selfCurrent = selfCurrent.parent;
			}

			if (otherCurrent) {
				otherAncestors.set(otherCurrent, otherDistance);
				if (
					otherCurrent.type &&
					typeFilter.has(otherCurrent.type) &&
					selfAncestors.has(otherCurrent)
				) {
					lca = otherCurrent;
					break;
				}
				otherDistance++;
				otherCurrent = otherCurrent.parent;
			}
		}

		if (lca === null) {
			return ["Unrelated", null, null, null];
		}
		return [
			"Common Ancestor",
			selfAncestors.get(lca)!,
			otherAncestors.get(lca)!,
			lca,
		];
	}

	/**
	 * Get translations from this element.
	 */
	*getTranslations(defaultLanguage: string): Generator<Record<string, any>> {
		// Bind translations (constraintMsg, requiredMsg, noAppErrorString)
		if (this.bind && typeof this.bind === "object") {
			for (const bindKey of [
				"jr:constraintMsg",
				"jr:requiredMsg",
				"jr:noAppErrorString",
			]) {
				const val = this.bind[bindKey];
				if (typeof val === "object" && val !== null) {
					for (const [lang, text] of Object.entries(val)) {
						yield {
							path: this.translationPath(bindKey),
							lang,
							text,
							output_context: this,
						};
					}
				} else if (typeof val === "string" && hasPyxformReference(val)) {
					// String with ${ref} → single-language translation
					yield {
						path: this.translationPath(bindKey),
						lang: defaultLanguage,
						text: val,
						output_context: this,
					};
				}
			}
		}

		// Label, hint, guidance_hint translations
		for (const displayElement of ["label", "hint", "guidance_hint"]) {
			let labelOrHint: any = (this as any)[displayElement];

			if (
				displayElement === "label" &&
				this.needsItextRef() &&
				typeof labelOrHint !== "object" &&
				labelOrHint
			) {
				labelOrHint = { [defaultLanguage]: labelOrHint };
			}

			if (
				displayElement === "guidance_hint" &&
				labelOrHint != null &&
				typeof labelOrHint !== "object" &&
				String(labelOrHint).length > 0
			) {
				labelOrHint = { [defaultLanguage]: labelOrHint };
			}

			if (
				displayElement === "hint" &&
				typeof labelOrHint !== "object" &&
				this.hint != null &&
				String(this.hint).length > 0 &&
				this.guidance_hint != null &&
				String(this.guidance_hint).length > 0
			) {
				labelOrHint = { [defaultLanguage]: labelOrHint };
			}

			if (typeof labelOrHint === "object" && labelOrHint !== null) {
				for (const [lang, text] of Object.entries(labelOrHint)) {
					// guidance_hint uses the hint path with "guidance_hint" display element
					const translationPathKey =
						displayElement === "guidance_hint" ? "hint" : displayElement;
					yield {
						display_element: displayElement,
						path: this.translationPath(translationPathKey),
						element: this,
						output_context: this,
						lang,
						text,
					};
				}
			}
		}

		// Media translations (image, audio, video, big-image)
		if (this.media && typeof this.media === "object") {
			for (const [mediaType, mediaValue] of Object.entries(this.media)) {
				if (typeof mediaValue === "object" && mediaValue !== null) {
					// Translated media: { English: "file.jpg", French: "fichier.jpg" }
					for (const [lang, text] of Object.entries(
						mediaValue as Record<string, string>,
					)) {
						yield {
							display_element: mediaType,
							path: this.translationPath("label"),
							element: this,
							output_context: this,
							lang,
							text,
						};
					}
				} else if (typeof mediaValue === "string") {
					// Untranslated media
					yield {
						display_element: mediaType,
						path: this.translationPath("label"),
						element: this,
						output_context: this,
						lang: defaultLanguage,
						text: mediaValue,
					};
				}
			}
		}
	}

	/**
	 * Create a plain dict representation of this element, recursively converting children.
	 * Matches Python's SurveyElement.to_json_dict().
	 */
	toJsonDict(deleteKeys?: Set<string>): Record<string, any> {
		this.validate();
		const result: Record<string, any> = {};

		// Collect all relevant properties
		const internalKeys = new Set(["parent", "extra_data", "_xpath"]);
		if (deleteKeys) {
			for (const k of deleteKeys) internalKeys.add(k);
		}

		for (const key of Object.keys(this)) {
			if (key.startsWith("_")) continue;
			if (internalKeys.has(key)) continue;
			const val = (this as any)[key];
			if (val == null) continue;
			if (key === "children" && Array.isArray(val)) {
				const children = val
					.map((c: any) =>
						typeof c.toJsonDict === "function"
							? c.toJsonDict(new Set(["parent"]))
							: c,
					)
					.filter((c: any) => c && Object.keys(c).length > 0);
				if (children.length > 0) result[key] = children;
			} else if (key === "choices" && typeof val === "object") {
				const choices: Record<string, any[]> = {};
				for (const [listName, itemset] of Object.entries(val)) {
					const is = itemset as any;
					if (is.options && Array.isArray(is.options)) {
						choices[listName] = is.options.map((o: any) =>
							typeof o.toJsonDict === "function"
								? o.toJsonDict(new Set(["parent"]))
								: o,
						);
					}
				}
				if (Object.keys(choices).length > 0) result[key] = choices;
			} else if (key === "bind" && typeof val === "object") {
				// Filter out XForm type mapping (type key) - this is an implementation
				// detail not present in the Python model's bind dict at this level
				const filtered: Record<string, any> = {};
				for (const [bk, bv] of Object.entries(val)) {
					if (bk === "type") continue;
					filtered[bk] = bv;
				}
				if (Object.keys(filtered).length > 0) result[key] = filtered;
			} else if (key === "control" && typeof val === "object") {
				// Filter out the tag key - this is an XML generation detail
				const filtered: Record<string, any> = {};
				for (const [ck, cv] of Object.entries(val)) {
					if (ck === "tag") continue;
					filtered[ck] = cv;
				}
				if (Object.keys(filtered).length > 0) result[key] = filtered;
			} else if (
				typeof val === "object" &&
				!Array.isArray(val) &&
				Object.keys(val).length === 0
			) {
			} else if (val === "" || val === false) {
			} else {
				result[key] = val;
			}
		}

		return result;
	}
}
