/**
 * Question survey element types.
 */

import type { Element as XElement } from "@xmldom/xmldom";
import { PyXFormError } from "../errors.js";
import {
	QUESTION_TYPE_DICT,
	type QuestionTypeEntry,
} from "../question-type-dictionary.js";
import { node, setAttributeWithNS } from "../utils.js";
import {
	type SurveyContext,
	SurveyElement,
	type SurveyElementData,
} from "./survey-element.js";

// Use xmldom's Element type throughout (returned by node() from utils.ts)
type Element = XElement;

/**
 * Extract pyxform reference names (${name}) from a trigger key string.
 * Falls back to using the key itself if no references found.
 */
function extractRefNames(key: string): string[] {
	const RE_REF = /\$\{([^}]+)\}/g;
	const names: string[] = [];
	let m = RE_REF.exec(key);
	while (m !== null) {
		names.push(m[1]);
		m = RE_REF.exec(key);
	}
	if (names.length === 0) {
		names.push(key);
	}
	return names;
}

/**
 * Collect triggered child elements (setvalue or odk:setgeopoint) for a given trigger name.
 */
function collectTriggeredChildren(
	survey: SurveyContext,
	triggerName: string,
	refMap: unknown,
	tagName: string,
	children: Element[],
): void {
	if (!refMap) {
		return;
	}
	for (const [key, targets] of Object.entries(
		refMap as Record<string, [string, string][]>,
	)) {
		if (!extractRefNames(key).includes(triggerName)) {
			continue;
		}
		for (const [targetName, targetValue] of targets) {
			const targetElement = survey.getElementByName?.(targetName);
			if (!targetElement) {
				continue;
			}
			const attrs: Record<string, string> = {
				event: "xforms-value-changed",
				ref: targetElement.getXpath(),
			};
			if (targetValue) {
				attrs.value = survey.insertXpaths(targetValue, targetElement);
			}
			children.push(node(tagName, { attrs }));
		}
	}
}

interface QuestionData extends SurveyElementData {
	question_type_dictionary?: Record<string, QuestionTypeEntry>;
	choice_filter?: string | null;
	parameters?: Record<string, string> | null;
	trigger?: string | string[] | null;
	query?: string | null;
	sms_field?: string | null;
	actions?: Record<string, string>[] | null;
}

export class Question extends SurveyElement {
	choice_filter: string | null;
	parameters: Record<string, string> | null;
	trigger: string | string[] | null;
	query: string | null;
	sms_field: string | null;
	actions: Record<string, string>[] | null;
	_qtd_defaults: QuestionTypeEntry | null = null;

	constructor(data: QuestionData) {
		const qtd = data.question_type_dictionary ?? QUESTION_TYPE_DICT;
		const typeStr = data.type;

		if (!(typeStr && typeStr in qtd)) {
			throw new PyXFormError(`Unknown question type '${typeStr}'.`);
		}

		const qtdEntry = qtd[typeStr];
		const merged = { ...data };

		// Merge QTD defaults into the data
		if (qtdEntry) {
			for (const [k, v] of Object.entries(qtdEntry)) {
				if (typeof v === "object" && v !== null && !Array.isArray(v)) {
					const template = { ...v };
					if (
						k in merged &&
						typeof merged[k] === "object" &&
						merged[k] !== null
					) {
						Object.assign(template, merged[k] as Record<string, unknown>);
					}
					(merged as Record<string, unknown>)[k] = template;
				} else if (!(k in merged) || merged[k as keyof typeof merged] == null) {
					(merged as Record<string, unknown>)[k] = v;
				}
			}
		}

		super(merged);
		this.choice_filter = data.choice_filter ?? null;
		this.parameters =
			((merged as Record<string, unknown>).parameters as Record<
				string,
				string
			> | null) ?? null;
		this.trigger = data.trigger ?? null;
		this.query = data.query ?? null;
		this.sms_field = data.sms_field ?? null;
		this.actions = data.actions ?? null;
		this._qtd_defaults = qtdEntry ?? null;
	}

	protected hasTrigger(): boolean {
		if (this.trigger == null) {
			return false;
		}
		if (Array.isArray(this.trigger)) {
			return this.trigger.length > 0;
		}
		return true;
	}

	xmlInstance(survey: SurveyContext): Element {
		const defaultVal = this.default;
		let text: string | undefined;
		if (defaultVal && !defaultIsDynamic(defaultVal, this.type)) {
			text = String(defaultVal);
			// Add jr:// prefix for media types
			if (text && !text.startsWith("jr://")) {
				const mediaTypes: Record<string, string> = {
					image: "jr://images/",
					photo: "jr://images/",
					"big-image": "jr://images/",
					audio: "jr://audio/",
					video: "jr://video/",
				};
				const prefix = this.type ? mediaTypes[this.type] : undefined;
				if (prefix) {
					text = prefix + text;
				}
			}
		}
		const elem = node(this.name, text != null ? { text } : undefined);
		if (this.instance) {
			for (const [k, v] of Object.entries(this.instance)) {
				setAttributeWithNS(elem, k, survey.insertXpaths(v, this));
			}
		}
		return elem;
	}

	xmlControl(survey: SurveyContext): Element | null {
		if (
			this.type === "calculate" ||
			this.type === "background-audio" ||
			this.type === "background-geopoint" ||
			((this.bind?.calculate || this.trigger) && !this.label && !this.hint)
		) {
			return null;
		}
		return this.buildXml(survey);
	}

	protected buildXml(_survey: SurveyContext): Element | null {
		return null;
	}

	protected _buildXml(survey: SurveyContext): Element | null {
		if (!this.control?.tag) {
			return null;
		}

		const labelAndHint = this.xmlLabelAndHint(survey);
		const attrs: Record<string, string> = { ref: this.getXpath() };

		// Add control attributes
		for (const [k, v] of Object.entries(this.control)) {
			if (k !== "tag") {
				attrs[k] = survey.insertXpaths(v as string, this);
			}
		}

		this._applyParameterAttrs(attrs);

		const children = [...labelAndHint];

		collectTriggeredChildren(
			survey,
			this.name,
			survey.setvalues_by_triggering_ref,
			"setvalue",
			children,
		);
		collectTriggeredChildren(
			survey,
			this.name,
			survey.setgeopoint_by_triggering_ref,
			"odk:setgeopoint",
			children,
		);

		return node(this.control.tag as string, { children, attrs });
	}

	private _applyParameterAttrs(attrs: Record<string, string>): void {
		if (!this.parameters) {
			return;
		}
		if (
			this.parameters.incremental &&
			(this.type === "geoshape" || this.type === "geotrace")
		) {
			attrs.incremental = this.parameters.incremental;
		}
		if (this.parameters.rows) {
			attrs.rows = this.parameters.rows;
		}
	}
}

export class InputQuestion extends Question {
	protected buildXml(survey: SurveyContext): Element | null {
		const result = this._buildXml(survey);
		if (!result) {
			return null;
		}

		if (this.query) {
			const choiceFilter = this.choice_filter;
			let queryStr: string;
			if (choiceFilter) {
				const pred = survey.insertXpaths(choiceFilter, this, true);
				queryStr = `instance('${this.query}')/root/item[${pred}]`;
			} else {
				queryStr = `instance('${this.query}')/root/item`;
			}
			result.setAttribute("query", queryStr);
		}
		return result;
	}
}

export class TriggerQuestion extends Question {
	protected buildXml(survey: SurveyContext): Element | null {
		return this._buildXml(survey);
	}
}

export class UploadQuestion extends Question {
	protected buildXml(survey: SurveyContext): Element | null {
		return this._buildXml(survey);
	}
}

interface TagData {
	name: string;
	label?: string | Record<string, string> | null;
	[key: string]: unknown;
}

export class OsmUploadQuestion extends UploadQuestion {
	private _osmTags: TagData[];

	constructor(data: QuestionData & { tags?: TagData[] }) {
		const tags = data.tags ?? [];
		const { tags: _removed, ...rest } = data;
		super(rest);
		this._osmTags = tags;
	}

	protected buildXml(survey: SurveyContext): Element | null {
		const result = this._buildXml(survey);
		if (!result) {
			return null;
		}

		for (const tag of this._osmTags) {
			const labelText =
				typeof tag.label === "string"
					? tag.label
					: tag.label && typeof tag.label === "object"
						? Object.values(tag.label)[0]
						: "";
			const labelEl = node(
				"label",
				labelText ? { text: labelText } : undefined,
			);
			const tagEl = node("tag", {
				children: [labelEl],
				attrs: { key: tag.name },
			});
			result.appendChild(tagEl);
		}

		return result;
	}
}

// ── Helper types and constants for defaultIsDynamic ──

const NCNAME = "[a-zA-Z_][\\w.-]*";
const NCNAME_NS = `${NCNAME}(?::${NCNAME})?`;

/** Priority-ordered token patterns for expression tokenization. */
const TOKEN_PATTERNS: [string, RegExp][] = [
	[
		"DATETIME",
		/^-?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(((\+|-)\d{2}:\d{2})|Z)?/,
	],
	["DATE", /^-?\d{4}-\d{2}-\d{2}/],
	["TIME", /^\d{2}:\d{2}:\d{2}(\.\d+)?(((\+|-)\d{2}:\d{2})|Z)?/],
	["NUMBER", /^-?\d+\.\d*|^-?\.\d+|^-?\d+/],
	["OPS_MATH", /^[*+-]|^ mod |^ div /],
	["OPS_COMP", /^[=!<>]=?/],
	["OPS_BOOL", /^ and | or /],
	["OPS_UNION", /^\|/],
	["OPEN_PAREN", /^\(/],
	["CLOSE_PAREN", /^\)/],
	["BRACKET", /^[[\]{}]/],
	["PARENT_REF", /^\.\./],
	["SELF_REF", /^\./],
	["PATH_SEP", /^\//],
	["SYSTEM_LITERAL", /^"[^"]*"|^'[^']*'/],
	["COMMA", /^,/],
	["WHITESPACE", /^\s+/],
	["PYXFORM_REF", /^\$\{(?:last-saved#)?[a-zA-Z_][\w.-]*\}/],
	["FUNC_CALL", new RegExp(`^(?:${NCNAME_NS})\\(`)],
	["XPATH_PRED", new RegExp(`^(?:${NCNAME_NS})\\[`)],
	["URI_SCHEME", new RegExp(`^${NCNAME}://`)],
	["NAME", new RegExp(`^(?:${NCNAME_NS})`)],
	["PYXFORM_REF_START", /^\$\{/],
	["PYXFORM_REF_END", /^\}/],
	["OPS_UNION", /^\\\|/],
	["OTHER", /^.+?/],
];

/** Token types that indicate a dynamic expression. */
const DYNAMIC_TOKEN_TYPES = new Set([
	"OPS_MATH",
	"OPS_UNION",
	"XPATH_PRED",
	"PYXFORM_REF",
	"FUNC_CALL",
]);

/** Types where '-' in OPS_MATH should NOT be considered dynamic. */
const MINUS_EXEMPT_TYPES = new Set([
	"date",
	"dateTime",
	"geopoint",
	"geotrace",
	"geoshape",
	"time",
]);

/**
 * Check if a matched dynamic token truly indicates a dynamic expression,
 * with special handling for minus in date/time/geo types.
 * Returns true if dynamic, false if the minus is exempt.
 */
function isDynamicToken(
	tokenType: string,
	tokenValue: string,
	elementType: string | null | undefined,
): boolean {
	if (
		tokenType === "OPS_MATH" &&
		tokenValue.trim() === "-" &&
		elementType &&
		MINUS_EXEMPT_TYPES.has(elementType)
	) {
		return false;
	}
	return true;
}

/**
 * Match the next token in the remaining string.
 * Returns the number of characters consumed, true if a dynamic token was found,
 * or false if nothing matched (skip one character).
 */
function matchNextToken(
	remaining: string,
	elementType: string | null | undefined,
): number | boolean {
	for (const [tokenType, pattern] of TOKEN_PATTERNS) {
		const m = pattern.exec(remaining);
		if (!m) {
			continue;
		}

		const tokenValue = m[0];
		if (DYNAMIC_TOKEN_TYPES.has(tokenType)) {
			if (isDynamicToken(tokenType, tokenValue, elementType)) {
				return true;
			}
		}
		return tokenValue.length;
	}
	return false;
}

/**
 * Check if a default value is dynamic (contains expressions).
 *
 * Uses a priority-based tokenizer approach matching Python pyxform's parse_expression.
 * Tokens that indicate a dynamic default:
 * - PYXFORM_REF: ${...} references
 * - FUNC_CALL: identifier( function calls
 * - OPS_MATH: +, *, -, div, mod (with special handling for - in date/time/geo types)
 * - OPS_UNION: | union operator
 * - XPATH_PRED: identifier[ predicates
 */
export function defaultIsDynamic(
	elementDefault: unknown,
	elementType?: string | null,
): boolean {
	if (!elementDefault || typeof elementDefault !== "string") {
		return false;
	}

	let remaining = elementDefault;
	while (remaining.length > 0) {
		const consumed = matchNextToken(remaining, elementType);
		if (consumed === true) {
			return true;
		}
		if (consumed === false) {
			remaining = remaining.substring(1);
		} else {
			remaining = remaining.substring(consumed as number);
		}
	}

	return false;
}
