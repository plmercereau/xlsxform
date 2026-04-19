/**
 * Base class for all survey elements.
 */

import type { Element as XElement } from "@xmldom/xmldom";
import { BINDING_CONVERSIONS } from "../aliases.js";
import * as constants from "../constants.js";
import { PyXFormError } from "../errors.js";
import { hasPyxformReference, isXmlTag } from "../parsing/expression.js";
import { node } from "../utils.js";

// Use xmldom's Element type throughout (returned by node() from utils.ts)
type Element = XElement;

/**
 * Filter an object by removing entries with the given key.
 * Returns the filtered object if non-empty, otherwise undefined.
 */
function filterObjectKeys(
	obj: Record<string, unknown>,
	excludeKey: string,
): Record<string, unknown> | undefined {
	const filtered: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(obj)) {
		if (k !== excludeKey) {
			filtered[k] = v;
		}
	}
	return Object.keys(filtered).length > 0 ? filtered : undefined;
}

/**
 * Interface representing the survey methods needed by elements during XML generation.
 * Avoids circular dependency with Survey class.
 */
export interface SurveyContext {
	insertXpaths(
		text: string,
		context: SurveyElement,
		useCurrent?: boolean,
		referenceParent?: boolean,
	): string;
	insertOutputValues(
		text: string,
		context: SurveyElement,
	): { text: string; hasOutput: boolean };
	getElementByName(
		name: string,
		errorPrefix?: string,
	): SurveyElement | undefined;
	getPathRelativeToLcar(
		context: SurveyElement,
		target: SurveyElement,
		xpath: string,
	): string;
	setvalues_by_triggering_ref?: Record<string, [string, string][]>;
	setgeopoint_by_triggering_ref?: Record<string, [string, string][]>;
	choices?: Record<string, unknown> | null;
}

export interface SurveyElementData {
	name: string;
	label?: string | Record<string, string> | null;
	hint?: string | Record<string, string> | null;
	guidance_hint?: string | Record<string, string> | null;
	type?: string;
	bind?: Record<string, unknown> | null;
	control?: Record<string, unknown> | null;
	media?: Record<string, string> | null;
	instance?: Record<string, string> | null;
	default?: string | null;
	children?: SurveyElement[];
	parent?: SurveyElement | null;
	[key: string]: unknown;
}

export class SurveyElement {
	name: string;
	label: string | Record<string, string> | null;
	hint: string | Record<string, string> | null;
	guidance_hint: string | Record<string, string> | null;
	type: string | null;
	bind: Record<string, unknown> | null;
	control: Record<string, unknown> | null;
	media: Record<string, string> | null;
	instance: Record<string, string> | null;
	default: string | null;
	parent: SurveyElement | null;
	extra_data: Record<string, unknown> | null;
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
		const extra: Record<string, unknown> = {};
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
		if (this._xpath && !relativeTo) {
			return this._xpath;
		}

		const parts: string[] = [];
		let current: SurveyElement | null = this;
		while (current != null) {
			if (relativeTo && current === relativeTo) {
				break;
			}
			parts.unshift(current.nameForXpath);
			current = current.parent;
		}
		const xpath = `/${parts.join("/")}`;
		if (!relativeTo) {
			this._xpath = xpath;
		}
		return xpath;
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
	xmlLabel(survey: SurveyContext): Element {
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
	xmlHint(survey: SurveyContext): Element {
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
	xmlLabelAndHint(survey: SurveyContext): Element[] {
		const result: Element[] = [];
		let labelAppended = false;

		if (this.label || this.media) {
			result.push(this.xmlLabel(survey));
			labelAppended = true;
		}

		if (this.hint || this.guidance_hint) {
			// guidance_hint alone (without label or hint) is not sufficient
			if (!(this.label || this.hint || this.media)) {
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
	xmlInstance(_survey: SurveyContext): Element {
		if (this.type === "entity" && this.extra_data?._entity_children) {
			return this._xmlEntityInstance();
		}
		return node(this.name);
	}

	/**
	 * Generate instance XML for entity elements.
	 */
	private _xmlEntityInstance(): Element {
		const children = (this.extra_data?._entity_children ?? []) as Record<
			string,
			unknown
		>[];
		const attrs: Record<string, string> = {};
		const childElements: Element[] = [];

		for (const child of children) {
			if (child.type === "attribute") {
				attrs[child[constants.NAME] as string] = (child.value as string) ?? "";
			} else if (child.type === "label") {
				childElements.push(node("label"));
			}
		}

		return node(this.name, { children: childElements, attrs });
	}

	/**
	 * Generate bind XML elements for entity children (attributes and label).
	 */
	private *_xmlEntityBindings(survey: SurveyContext): Generator<Element> {
		const children = (this.extra_data?._entity_children ?? []) as Record<
			string,
			unknown
		>[];
		const entityXpath = this.getXpath();

		for (const child of children) {
			if (!child[constants.BIND]) {
				continue;
			}
			const bindData = child[constants.BIND] as Record<string, unknown>;
			const bindDict: Record<string, string> = {};

			let nodeset: string;
			let context: SurveyElement;
			if (child.type === "attribute") {
				nodeset = `${entityXpath}/@${child[constants.NAME] as string}`;
				context = this._createChildProxy(`@${child[constants.NAME] as string}`);
			} else {
				// label - one level deeper than entity
				nodeset = `${entityXpath}/${child[constants.NAME] as string}`;
				context = this._createChildProxy(child[constants.NAME] as string);
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
		if (this.type !== "entity" || !this.extra_data?._entity_children) {
			return [];
		}
		const children = this.extra_data._entity_children as Record<
			string,
			unknown
		>[];
		const entityXpath = this.getXpath();
		const result: { ref: string; event: string; value: string }[] = [];

		for (const child of children) {
			if (child.actions && Array.isArray(child.actions)) {
				for (const action of child.actions as Record<string, unknown>[]) {
					if (action.name === "setvalue") {
						result.push({
							ref: `${entityXpath}/@${child[constants.NAME] as string}`,
							event: action.event as string,
							value: action.value as string,
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

	*xmlBindings(survey: SurveyContext): Generator<Element> {
		if (this.type === "entity" && this.extra_data?._entity_children) {
			yield* this._xmlEntityBindings(survey);
			return;
		}
		if (!this.bind) {
			return;
		}

		const bindDict = this._buildBindDict(survey);
		yield node("bind", {
			attrs: { nodeset: this.getXpath(), ...bindDict },
		});
	}

	private _buildBindDict(survey: SurveyContext): Record<string, string> {
		const TRANSLATABLE_BIND_KEYS = new Set([
			"jr:constraintMsg",
			"jr:requiredMsg",
			"jr:noAppErrorString",
		]);
		const skipCalculate = this.hasTrigger();
		const bindDict: Record<string, string> = {};

		const bind = this.bind as Record<string, unknown>;
		for (const [k, v] of Object.entries(bind)) {
			if (skipCalculate && k === "calculate") {
				continue;
			}
			bindDict[k] = this._resolveBindValue(
				k,
				v,
				survey,
				TRANSLATABLE_BIND_KEYS,
			);
		}

		// Remove entries set to empty string (unresolved non-string, non-object values)
		for (const [k, v] of Object.entries(bindDict)) {
			if (v === "") {
				delete bindDict[k];
			}
		}
		return bindDict;
	}

	private _resolveBindValue(
		key: string,
		value: unknown,
		survey: SurveyContext,
		translatableKeys: Set<string>,
	): string {
		if (typeof value === "string") {
			return this._resolveStringBindValue(key, value, survey, translatableKeys);
		}
		if (typeof value === "object" && translatableKeys.has(key)) {
			return `jr:itext('${this.translationPath(key)}')`;
		}
		if (typeof value !== "object") {
			return String(value);
		}
		return "";
	}

	private _resolveStringBindValue(
		key: string,
		value: string,
		survey: SurveyContext,
		translatableKeys: Set<string>,
	): string {
		let sv = value;
		if (
			constants.CONVERTIBLE_BIND_ATTRIBUTES.has(key) &&
			sv in BINDING_CONVERSIONS
		) {
			sv = BINDING_CONVERSIONS[sv];
		}
		if (translatableKeys.has(key) && hasPyxformReference(sv)) {
			return `jr:itext('${this.translationPath(key)}')`;
		}
		return survey.insertXpaths(sv, this);
	}

	/**
	 * Generate the control XML. Subclasses override this.
	 */
	xmlControl(_survey: SurveyContext): Element | Generator<Element> | null {
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
		const lca = this._findLca(other, typeFilter, selfAncestors, otherAncestors);

		if (lca === null) {
			return ["Unrelated", null, null, null];
		}
		return [
			"Common Ancestor",
			selfAncestors.get(lca) ?? null,
			otherAncestors.get(lca) ?? null,
			lca,
		];
	}

	private _findLca(
		other: SurveyElement,
		typeFilter: Set<string>,
		selfAncestors: Map<SurveyElement, number>,
		otherAncestors: Map<SurveyElement, number>,
	): SurveyElement | null {
		let selfCurrent: SurveyElement | null = this.parent;
		let otherCurrent: SurveyElement | null = other.parent;
		let selfDistance = 1;
		let otherDistance = 1;

		while (selfCurrent || otherCurrent) {
			if (selfCurrent) {
				const match = this._advanceAncestor(
					selfCurrent,
					selfDistance,
					selfAncestors,
					otherAncestors,
					typeFilter,
				);
				if (match) {
					return match;
				}
				selfCurrent = selfCurrent.parent;
				selfDistance++;
			}
			if (otherCurrent) {
				const match = this._advanceAncestor(
					otherCurrent,
					otherDistance,
					otherAncestors,
					selfAncestors,
					typeFilter,
				);
				if (match) {
					return match;
				}
				otherCurrent = otherCurrent.parent;
				otherDistance++;
			}
		}
		return null;
	}

	private _advanceAncestor(
		current: SurveyElement,
		distance: number,
		ownMap: Map<SurveyElement, number>,
		otherMap: Map<SurveyElement, number>,
		typeFilter: Set<string>,
	): SurveyElement | null {
		ownMap.set(current, distance);
		if (current.type && typeFilter.has(current.type) && otherMap.has(current)) {
			return current;
		}
		return null;
	}

	/**
	 * Get translations from this element.
	 */
	*getTranslations(
		defaultLanguage: string,
	): Generator<Record<string, unknown>> {
		yield* this._getBindTranslations(defaultLanguage);
		yield* this._getDisplayTranslations(defaultLanguage);
		yield* this._getMediaTranslations(defaultLanguage);
	}

	private *_getBindTranslations(
		defaultLanguage: string,
	): Generator<Record<string, unknown>> {
		if (!this.bind || typeof this.bind !== "object") {
			return;
		}
		for (const bindKey of [
			"jr:constraintMsg",
			"jr:requiredMsg",
			"jr:noAppErrorString",
		]) {
			const val = this.bind[bindKey];
			if (typeof val === "object" && val !== null) {
				for (const [lang, text] of Object.entries(
					val as Record<string, unknown>,
				)) {
					yield {
						path: this.translationPath(bindKey),
						lang,
						text,
						output_context: this,
					};
				}
			} else if (typeof val === "string" && hasPyxformReference(val)) {
				yield {
					path: this.translationPath(bindKey),
					lang: defaultLanguage,
					text: val,
					output_context: this,
				};
			}
		}
	}

	private _normalizeDisplayValue(
		displayElement: "label" | "hint" | "guidance_hint",
		value: string | Record<string, string> | null,
		defaultLanguage: string,
	): string | Record<string, string> | null {
		if (typeof value === "object") {
			return value;
		}
		const shouldWrap =
			(displayElement === "label" && this.needsItextRef() && value) ||
			(displayElement === "guidance_hint" &&
				value != null &&
				String(value).length > 0) ||
			(displayElement === "hint" &&
				this.hint != null &&
				String(this.hint).length > 0 &&
				this.guidance_hint != null &&
				String(this.guidance_hint).length > 0);

		if (shouldWrap) {
			return { [defaultLanguage]: value as string };
		}
		return value;
	}

	private *_getDisplayTranslations(
		defaultLanguage: string,
	): Generator<Record<string, unknown>> {
		for (const displayElement of ["label", "hint", "guidance_hint"] as const) {
			const normalized = this._normalizeDisplayValue(
				displayElement,
				this[displayElement],
				defaultLanguage,
			);
			if (typeof normalized !== "object" || normalized === null) {
				continue;
			}
			const translationPathKey =
				displayElement === "guidance_hint" ? "hint" : displayElement;
			for (const [lang, text] of Object.entries(normalized)) {
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

	private *_getMediaTranslations(
		defaultLanguage: string,
	): Generator<Record<string, unknown>> {
		if (!this.media || typeof this.media !== "object") {
			return;
		}
		for (const [mediaType, mediaValue] of Object.entries(this.media)) {
			if (typeof mediaValue === "object" && mediaValue !== null) {
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

	/**
	 * Create a plain dict representation of this element, recursively converting children.
	 * Matches Python's SurveyElement.to_json_dict().
	 */
	toJsonDict(deleteKeys?: Set<string>): Record<string, unknown> {
		this.validate();
		const result: Record<string, unknown> = {};

		const internalKeys = new Set(["parent", "extra_data", "_xpath"]);
		if (deleteKeys) {
			for (const k of deleteKeys) {
				internalKeys.add(k);
			}
		}

		for (const key of Object.keys(this)) {
			if (key.startsWith("_") || internalKeys.has(key)) {
				continue;
			}
			const val = (this as Record<string, unknown>)[key];
			if (val == null) {
				continue;
			}
			const converted = this._convertJsonDictValue(key, val);
			if (converted !== undefined) {
				result[key] = converted;
			}
		}

		return result;
	}

	private _convertJsonDictValue(
		key: string,
		val: unknown,
	): unknown | undefined {
		if (key === "children" && Array.isArray(val)) {
			return this._convertChildren(val);
		}
		if (key === "choices" && typeof val === "object") {
			return this._convertChoices(val as Record<string, unknown>);
		}
		if (key === "bind" && typeof val === "object") {
			return filterObjectKeys(val as Record<string, unknown>, "type");
		}
		if (key === "control" && typeof val === "object") {
			return filterObjectKeys(val as Record<string, unknown>, "tag");
		}
		if (this._isEmptyJsonValue(val)) {
			// Skip empty objects, empty strings, and false values
			return undefined;
		}
		return val;
	}

	private _isEmptyJsonValue(val: unknown): boolean {
		if (val === "" || val === false) {
			return true;
		}
		return (
			typeof val === "object" &&
			!Array.isArray(val) &&
			Object.keys(val as Record<string, unknown>).length === 0
		);
	}

	private _convertChildren(val: unknown[]): unknown[] | undefined {
		const children = val
			.map((c: unknown) => {
				const item = c as Record<string, unknown>;
				return typeof item.toJsonDict === "function"
					? (item.toJsonDict as (keys: Set<string>) => Record<string, unknown>)(
							new Set(["parent"]),
						)
					: item;
			})
			.filter((c: unknown) => {
				const item = c as Record<string, unknown>;
				return item && Object.keys(item).length > 0;
			});
		return children.length > 0 ? children : undefined;
	}

	private _convertChoices(
		val: Record<string, unknown>,
	): Record<string, unknown[]> | undefined {
		const choices: Record<string, unknown[]> = {};
		for (const [listName, itemset] of Object.entries(val)) {
			const is_ = itemset as Record<string, unknown>;
			if (is_.options && Array.isArray(is_.options)) {
				choices[listName] = is_.options.map((o: unknown) => {
					const item = o as Record<string, unknown>;
					return typeof item.toJsonDict === "function"
						? (
								item.toJsonDict as (
									keys: Set<string>,
								) => Record<string, unknown>
							)(new Set(["parent"]))
						: item;
				});
			}
		}
		return Object.keys(choices).length > 0 ? choices : undefined;
	}
}
