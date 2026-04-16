/**
 * Question survey element types.
 */

import * as constants from "./constants.js";
import { PyXFormError } from "./errors.js";
import { RE_PYXFORM_REF, hasPyxformReference } from "./parsing/expression.js";
import {
	QUESTION_TYPE_DICT,
	type QuestionTypeEntry,
} from "./question-type-dictionary.js";
import { SurveyElement, type SurveyElementData } from "./survey-element.js";
import { node, setAttributeWithNS } from "./utils.js";

export interface QuestionData extends SurveyElementData {
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

		if (!typeStr || !(typeStr in qtd)) {
			throw new PyXFormError(`Unknown question type '${typeStr}'.`);
		}

		const qtdEntry = qtd[typeStr];
		const merged = { ...data };

		// Merge QTD defaults into the data
		if (qtdEntry) {
			for (const [k, v] of Object.entries(qtdEntry)) {
				if (typeof v === "object" && v !== null && !Array.isArray(v)) {
					const template = { ...v };
					if (k in merged && typeof merged[k] === "object" && merged[k] !== null) {
						Object.assign(template, merged[k] as Record<string, any>);
					}
					(merged as any)[k] = template;
				} else if (!(k in merged) || merged[k as keyof typeof merged] == null) {
					(merged as any)[k] = v;
				}
			}
		}

		super(merged);
		this.choice_filter = data.choice_filter ?? null;
		this.parameters = (merged as any).parameters ?? null;
		this.trigger = data.trigger ?? null;
		this.query = data.query ?? null;
		this.sms_field = data.sms_field ?? null;
		this.actions = data.actions ?? null;
		this._qtd_defaults = qtdEntry ?? null;
	}

	protected hasTrigger(): boolean {
		if (this.trigger == null) return false;
		if (Array.isArray(this.trigger)) return this.trigger.length > 0;
		return true;
	}

	xmlInstance(survey: any): Element {
		let defaultVal = this.default;
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

	xmlControl(survey: any): Element | null {
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

	protected buildXml(survey: any): Element | null {
		return null;
	}

	protected _buildXml(survey: any): Element | null {
		if (!this.control?.tag) return null;

		const labelAndHint = this.xmlLabelAndHint(survey);
		const attrs: Record<string, string> = { ref: this.getXpath() };

		// Add control attributes
		for (const [k, v] of Object.entries(this.control)) {
			if (k !== "tag") {
				attrs[k] = survey.insertXpaths(v, this);
			}
		}

		// Add parameters that map to control attributes
		if (this.parameters) {
			if (this.parameters.incremental && (this.type === "geoshape" || this.type === "geotrace")) {
				attrs.incremental = this.parameters.incremental;
			}
			if (this.parameters.rows) {
				attrs.rows = this.parameters.rows;
			}
		}

		const children = [...labelAndHint];

		// Add setvalue children for triggered questions (trigger column)
		if (survey.setvalues_by_triggering_ref) {
			const triggerKey = this.name;
			for (const [key, targets] of Object.entries(survey.setvalues_by_triggering_ref as Record<string, [string, string][]>)) {
				// Match trigger key: could be plain name, ${name}, or comma-separated ${name1},${name2}
				// Extract all pyxform references from the key
				const RE_REF = /\$\{([^}]+)\}/g;
				let refMatch: RegExpExecArray | null;
				const refNames: string[] = [];
				RE_REF.lastIndex = 0;
				while ((refMatch = RE_REF.exec(key)) !== null) {
					refNames.push(refMatch[1]);
				}
				// If no ${...} references found, treat the key itself as the name
				if (refNames.length === 0) {
					refNames.push(key);
				}

				if (refNames.includes(triggerKey)) {
					for (const [targetName, targetValue] of targets) {
						const targetElement = survey.getElementByName?.(targetName);
						if (targetElement) {
							const setvalueAttrs: Record<string, string> = {
								event: "xforms-value-changed",
								ref: targetElement.getXpath(),
							};
							if (targetValue) {
								setvalueAttrs.value = survey.insertXpaths(targetValue, targetElement);
							}
							children.push(node("setvalue", { attrs: setvalueAttrs }));
						}
					}
				}
			}
		}

		// Add odk:setgeopoint children for background-geopoint triggered questions
		if (survey.setgeopoint_by_triggering_ref) {
			const triggerKey = this.name;
			for (const [key, targets] of Object.entries(survey.setgeopoint_by_triggering_ref as Record<string, [string, string][]>)) {
				const RE_REF = /\$\{([^}]+)\}/g;
				let refMatch: RegExpExecArray | null;
				const refNames: string[] = [];
				RE_REF.lastIndex = 0;
				while ((refMatch = RE_REF.exec(key)) !== null) {
					refNames.push(refMatch[1]);
				}
				if (refNames.length === 0) {
					refNames.push(key);
				}

				if (refNames.includes(triggerKey)) {
					for (const [targetName, targetValue] of targets) {
						const targetElement = survey.getElementByName?.(targetName);
						if (targetElement) {
							const setgeopointAttrs: Record<string, string> = {
								event: "xforms-value-changed",
								ref: targetElement.getXpath(),
							};
							if (targetValue) {
								setgeopointAttrs.value = survey.insertXpaths(targetValue, targetElement);
							}
							children.push(node("odk:setgeopoint", { attrs: setgeopointAttrs }));
						}
					}
				}
			}
		}

		const result = node(this.control.tag, {
			children,
			attrs,
		});

		return result;
	}
}

export class InputQuestion extends Question {
	protected buildXml(survey: any): Element | null {
		const result = this._buildXml(survey);
		if (!result) return null;

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
	protected buildXml(survey: any): Element | null {
		return this._buildXml(survey);
	}
}

export class UploadQuestion extends Question {
	protected buildXml(survey: any): Element | null {
		return this._buildXml(survey);
	}
}

export interface TagData {
	name: string;
	label?: string | Record<string, string> | null;
	[key: string]: any;
}

export class OsmUploadQuestion extends UploadQuestion {
	private _osmTags: TagData[];

	constructor(data: QuestionData & { tags?: TagData[] }) {
		const tags = data.tags ?? [];
		const { tags: _removed, ...rest } = data;
		super(rest);
		this._osmTags = tags;
	}

	protected buildXml(survey: any): Element | null {
		const result = this._buildXml(survey);
		if (!result) return null;

		for (const tag of this._osmTags) {
			const labelText = typeof tag.label === "string" ? tag.label :
				(tag.label && typeof tag.label === "object" ? Object.values(tag.label)[0] : "");
			const labelEl = node("label", labelText ? { text: labelText } : undefined);
			const tagEl = node("tag", { children: [labelEl], attrs: { key: tag.name } });
			result.appendChild(tagEl);
		}

		return result;
	}
}

export interface OptionData {
	name: string;
	label?: string | Record<string, string> | null;
	media?: Record<string, string> | null;
	sms_option?: string | null;
	[key: string]: any;
}

export class Option extends SurveyElement {
	sms_option: string | null;
	_choice_itext_ref: string | null = null;

	constructor(data: OptionData) {
		super({ ...data, media: data.media ?? null });
		this.sms_option = data.sms_option ?? null;
	}

	validate(): void {
		// Options don't need XML tag validation
	}
}

export class Itemset {
	name: string;
	options: Option[];
	requires_itext: boolean;
	used_by_search: boolean;

	constructor(name: string, choices: Record<string, any>[]) {
		this.name = name;
		this.requires_itext = false;
		this.used_by_search = false;
		this.options = [];

		for (const c of choices) {
			const option = new Option(c as OptionData);
			this.options.push(option);

			if (!this.requires_itext) {
				if (option.media) {
					this.requires_itext = true;
				} else if (typeof option.label === "object" && option.label !== null) {
					this.requires_itext = true;
				} else if (
					option.label &&
					typeof option.label === "string" &&
					hasPyxformReference(option.label)
				) {
					this.requires_itext = true;
				}
			}
		}
	}
}

export class MultipleChoiceQuestion extends Question {
	choices: Itemset | null;
	itemset: string | null;
	list_name: string | null;

	constructor(data: QuestionData & {
		itemset?: string | null;
		list_name?: string | null;
		choices?: Itemset | Record<string, any>[] | null;
	}) {
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

	protected buildXml(survey: any): Element | null {
		if (!this.bind?.type || !["string", "odk:rank"].includes(this.bind.type)) {
			throw new PyXFormError('Invalid value for bind type.');
		}

		const result = this._buildXml(survey);
		if (!result) return null;

		let choices: Itemset | null = null;
		if (survey.choices) {
			choices = survey.choices[this.itemset ?? ""] ?? null;
		}
		if (!choices) choices = this.choices;

		if (this.itemset && typeof this.itemset === "string") {
			const dotIdx = this.itemset.lastIndexOf(".");
			let itemsetName = this.itemset;
			let fileExtension = "";
			if (dotIdx >= 0) {
				fileExtension = this.itemset.substring(dotIdx);
				itemsetName = this.itemset.substring(0, dotIdx);
			}

			let itemsetValueRef =
				fileExtension === ".geojson"
					? constants.EXTERNAL_CHOICES_ITEMSET_REF_VALUE_GEOJSON
					: constants.DEFAULT_ITEMSET_VALUE_REF;
			let itemsetLabelRef =
				fileExtension === ".geojson"
					? constants.EXTERNAL_CHOICES_ITEMSET_REF_LABEL_GEOJSON
					: constants.DEFAULT_ITEMSET_LABEL_REF;

			if (this.parameters) {
				itemsetValueRef = this.parameters.value ?? itemsetValueRef;
				itemsetLabelRef = this.parameters.label ?? itemsetLabelRef;
			}

			const isPreviousQuestion = hasPyxformReference(this.itemset);

			if (constants.EXTERNAL_INSTANCE_EXTENSIONS.has(fileExtension)) {
				// External file instance
			} else if (choices?.requires_itext) {
				itemsetName = this.itemset;
				itemsetLabelRef = "jr:itext(itextId)";
			} else {
				itemsetName = this.itemset;
			}

			let choiceFilter = this.choice_filter;
			if (choiceFilter) {
				choiceFilter = survey.insertXpaths(choiceFilter, this, true);
			}

			let nodeset: string;
			if (isPreviousQuestion) {
				// Extract the variable name from the ${ref} in this.itemset
				const refMatch = /\$\{([^}]+)\}/.exec(this.itemset!);
				const targetVarName = refMatch ? refMatch[1] : this.itemset!;
				const targetElement = survey.getElementByName?.(targetVarName);

				// Find the nearest repeat ancestor of the target element
				let targetRepeat: any = null;
				if (targetElement) {
					for (const { element: ancestor } of targetElement.iterAncestors()) {
						if (ancestor.type === "repeat") {
							targetRepeat = ancestor;
							break;
						}
					}
				}

				if (targetRepeat && targetElement) {
					const targetRepeatXpath = targetRepeat.getXpath();
					const targetRepeatParts = targetRepeatXpath.split("/").filter(Boolean);

					// Compute the relative path of the target variable within the repeat
					const targetXpath = targetElement.getXpath();
					const targetXpathParts = targetXpath.split("/").filter(Boolean);
					const relativeFieldPath = targetXpathParts.slice(targetRepeatParts.length).join("/");
					itemsetValueRef = relativeFieldPath;
					itemsetLabelRef = relativeFieldPath;

					// Check if current question is inside a repeat
					let contextInRepeat = false;
					for (const { element: ancestor } of this.iterAncestors()) {
						if (ancestor.type === "repeat") {
							contextInRepeat = true;
							break;
						}
					}

					if (contextInRepeat) {
						// Current question is inside a repeat - use relative path to the target repeat.
						// We need to go from the current question up to the parent of the target repeat,
						// then name the repeat. This ensures we reference "all instances" of the repeat,
						// not just the current instance.
						const contextXpath = this.getXpath();
						const contextParts = contextXpath.split("/").filter(Boolean);
						const repeatParentParts = targetRepeatParts.slice(0, -1);
						let commonLen = 0;
						for (let i = 0; i < Math.min(contextParts.length, repeatParentParts.length); i++) {
							if (contextParts[i] === repeatParentParts[i]) {
								commonLen = i + 1;
							} else {
								break;
							}
						}
						const upsNeeded = contextParts.length - commonLen;
						const repeatName = targetRepeatParts[targetRepeatParts.length - 1];
						const ups = Array(upsNeeded).fill("..").join("/");
						const downParts = repeatParentParts.slice(commonLen);
						const parts = [ups, ...downParts, repeatName].filter(Boolean);
						nodeset = parts.join("/");

						if (this.choice_filter) {
							// Resolve ${var} references in the raw choice_filter with custom logic:
							// - Variables in the TARGET repeat → ./field_path (relative within the iterated repeat)
							// - Variables in the current question's context → current()/../var
							const rawFilter = this.choice_filter;
							RE_PYXFORM_REF.lastIndex = 0;
							choiceFilter = rawFilter.replace(RE_PYXFORM_REF, (_match: string, refName: string) => {
								const refElement = survey.getElementByName?.(refName);
								if (!refElement) return _match;
								const refXpath = refElement.getXpath();
								const refParts = refXpath.split("/").filter(Boolean);
								// Check if this variable is inside the target repeat
								const isInTargetRepeat = refParts.length > targetRepeatParts.length &&
									targetRepeatParts.every((p: string, i: number) => refParts[i] === p);
								if (isInTargetRepeat) {
									// Variable is in the target repeat - use ./ relative to the repeat instance
									const fieldWithinRepeat = refParts.slice(targetRepeatParts.length).join("/");
									return ` ./${fieldWithinRepeat} `;
								}
								// Variable is NOT in the target repeat - use current()/../var
								// (relative to the current question's context)
								const resolved = survey.getPathRelativeToLcar(this, refElement, refXpath);
								if (resolved !== refXpath) {
									return ` current()/${resolved} `;
								}
								return ` ${refXpath} `;
							});
						} else {
							choiceFilter = `./${relativeFieldPath} != ''`;
						}
					} else {
						// Current question is NOT inside a repeat - use absolute path
						nodeset = targetRepeatXpath;

						if (choiceFilter) {
							// Replace absolute paths to target repeat fields with ./
							const absRepeatPath = targetRepeatXpath + "/";
							choiceFilter = choiceFilter.split(absRepeatPath).join(" ./");
						} else {
							choiceFilter = `./${relativeFieldPath} != ''`;
						}
					}
				} else {
					// Fallback to original logic if we can't find the repeat
					const pathStr = survey
						.insertXpaths(this.itemset, this, false, true)
						.trim();
					const pathParts = pathStr.split("/");
					nodeset = pathParts.slice(0, -1).join("/");
					itemsetValueRef = pathParts[pathParts.length - 1];
					itemsetLabelRef = pathParts[pathParts.length - 1];
					if (choiceFilter) {
						choiceFilter = choiceFilter
							.replace(`current()/${nodeset}`, ".")
							.replace(nodeset, ".");
					} else {
						const name = pathParts[pathParts.length - 1];
						choiceFilter = `./${name} != ''`;
					}
				}
			} else {
				nodeset = `instance('${itemsetName}')/root/item`;
			}

			if (choiceFilter) {
				nodeset += `[${choiceFilter}]`;
			}

			if (this.parameters) {
				if (
					this.parameters.randomize?.toLowerCase() === "true"
				) {
					nodeset = `randomize(${nodeset}`;
					if (this.parameters.seed) {
						const seed = survey.insertXpaths(this.parameters.seed, this).trim();
						nodeset = `${nodeset}, ${seed}`;
					}
					nodeset += ")";
				}
			}

			const itemsetElem = node("itemset", {
				children: [
					node("value", { attrs: { ref: itemsetValueRef } }),
					node("label", { attrs: { ref: itemsetLabelRef } }),
				],
				attrs: { nodeset },
			});
			result.appendChild(result.ownerDocument!.importNode(itemsetElem, true));
		} else if (choices && choices.used_by_search) {
			// Options processing specific to XLSForms using the "search()" function.
			// The _choice_itext_ref is prepared by Survey._redirectIsSearchItext.
			for (const option of choices.options) {
				let labelNode: Element;
				if (choices.requires_itext && option._choice_itext_ref) {
					labelNode = node("label", { attrs: { ref: option._choice_itext_ref } });
				} else if (this.label) {
					const { text: labelText, hasOutput } = survey.insertOutputValues(
						typeof option.label === "string" ? option.label : "",
						option,
					);
					labelNode = node("label", { text: labelText, toParseString: hasOutput });
				} else {
					labelNode = node("label");
				}
				const itemElem = node("item", {
					children: [
						labelNode,
						node("value", { text: option.name }),
					],
				});
				result.appendChild(result.ownerDocument!.importNode(itemElem, true));
			}
		}

		return result;
	}
}

// Maps range parameter names to their XML attribute names
const RANGE_PARAM_MAP: Record<string, string> = {
	start: "start",
	end: "end",
	step: "step",
	tick_interval: "odk:tick-interval",
	placeholder: "odk:placeholder",
};

export class RangeQuestion extends Question {
	itemset: string | null;
	list_name: string | null;

	constructor(data: QuestionData & { itemset?: string | null; list_name?: string | null }) {
		super(data);
		this.itemset = data.itemset ?? null;
		this.list_name = data.list_name ?? null;
	}

	protected buildXml(survey: any): Element | null {
		if (!this.bind?.type || !["int", "decimal"].includes(this.bind.type)) {
			throw new PyXFormError(`Invalid value for bind type: ${this.bind?.type}`);
		}

		const result = this._buildXml(survey);
		if (!result) return null;

		if (this.parameters) {
			for (const [k, v] of Object.entries(this.parameters)) {
				if (k === "tick_labelset") continue; // Handled as itemset below
				const xmlAttr = RANGE_PARAM_MAP[k] ?? k;
				setAttributeWithNS(result, xmlAttr, v);
			}

			// Handle tick_labelset as an itemset
			if (this.parameters.tick_labelset) {
				const listName = this.parameters.tick_labelset;
				const itemsetElem = node("itemset", {
					children: [
						node("value", { attrs: { ref: constants.DEFAULT_ITEMSET_VALUE_REF } }),
						node("label", { attrs: { ref: constants.DEFAULT_ITEMSET_LABEL_REF } }),
					],
					attrs: { nodeset: `instance('${listName}')/root/item` },
				});
				result.appendChild(result.ownerDocument!.importNode(itemsetElem, true));
			}
		}

		return result;
	}
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
	elementDefault: any,
	elementType?: string | null,
): boolean {
	if (!elementDefault || typeof elementDefault !== "string") return false;

	// Tokenize using priority-ordered regex patterns (matching Python's Lark grammar).
	// Higher priority patterns are tried first and consume characters, preventing
	// lower priority patterns from matching within them.

	const ncname = "[a-zA-Z_][\\w.-]*";
	const ncnameNs = `${ncname}(?::${ncname})?`;

	// Priority-ordered token patterns (highest priority first)
	const tokenPatterns: [string, RegExp][] = [
		// DATETIME (priority 25): matches full datetime with optional timezone
		["DATETIME", /^-?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(((\+|-)\d{2}:\d{2})|Z)?/],
		// DATE (priority 24)
		["DATE", /^-?\d{4}-\d{2}-\d{2}/],
		// TIME (priority 23): matches time with optional timezone
		["TIME", /^\d{2}:\d{2}:\d{2}(\.\d+)?(((\+|-)\d{2}:\d{2})|Z)?/],
		// NUMBER (priority 22)
		["NUMBER", /^-?\d+\.\d*|^-?\.\d+|^-?\d+/],
		// OPS_MATH (priority 21)
		["OPS_MATH", /^[*+-]|^ mod |^ div /],
		// OPS_COMP (priority 20)
		["OPS_COMP", /^[=!<>]=?/],
		// OPS_BOOL (priority 19)
		["OPS_BOOL", /^ and | or /],
		// OPS_UNION (priority 18)
		["OPS_UNION", /^\|/],
		// OPEN_PAREN (priority 17)
		["OPEN_PAREN", /^\(/],
		// CLOSE_PAREN (priority 16)
		["CLOSE_PAREN", /^\)/],
		// BRACKET (priority 15)
		["BRACKET", /^[[\]{}]/],
		// PARENT_REF (priority 14)
		["PARENT_REF", /^\.\./],
		// SELF_REF (priority 13)
		["SELF_REF", /^\./],
		// PATH_SEP (priority 12)
		["PATH_SEP", /^\//],
		// SYSTEM_LITERAL (priority 11)
		["SYSTEM_LITERAL", /^"[^"]*"|^'[^']*'/],
		// COMMA (priority 10)
		["COMMA", /^,/],
		// WHITESPACE (priority 9)
		["WHITESPACE", /^\s+/],
		// PYXFORM_REF (priority 8)
		["PYXFORM_REF", /^\$\{(?:last-saved#)?[a-zA-Z_][\w.-]*\}/],
		// FUNC_CALL (priority 7): ncname followed by (
		["FUNC_CALL", new RegExp(`^(?:${ncnameNs})\\(`)],
		// XPATH_PRED (priority 6): ncname followed by [
		["XPATH_PRED", new RegExp(`^(?:${ncnameNs})\\[`)],
		// URI_SCHEME (priority 4): e.g., https://
		["URI_SCHEME", new RegExp(`^${ncname}://`)],
		// NAME (priority 3)
		["NAME", new RegExp(`^(?:${ncnameNs})`)],
		// PYXFORM_REF_START (priority 2)
		["PYXFORM_REF_START", /^\$\{/],
		// PYXFORM_REF_END (priority 1)
		["PYXFORM_REF_END", /^\}/],
		// Escaped pipe (XLSForm convention)
		["OPS_UNION", /^\\\|/],
		// OTHER (priority 0): any single character
		["OTHER", /^.+?/],
	];

	// Dynamic token types
	const dynamicTypes = new Set([
		"OPS_MATH", "OPS_UNION", "XPATH_PRED", "PYXFORM_REF", "FUNC_CALL",
	]);

	// Types where '-' in OPS_MATH should NOT be considered dynamic
	const minusExemptTypes = new Set([
		"date", "dateTime", "geopoint", "geotrace", "geoshape", "time",
	]);

	let remaining = elementDefault;
	while (remaining.length > 0) {
		let matched = false;
		for (const [tokenType, pattern] of tokenPatterns) {
			const m = pattern.exec(remaining);
			if (m) {
				const tokenValue = m[0];

				if (dynamicTypes.has(tokenType)) {
					// Special handling for minus in date/time/geo types
					if (
						tokenType === "OPS_MATH" &&
						tokenValue.trim() === "-" &&
						elementType &&
						minusExemptTypes.has(elementType)
					) {
						// For date/time/geo types, minus is not dynamic
						remaining = remaining.substring(tokenValue.length);
						matched = true;
						break;
					}
					return true;
				}

				remaining = remaining.substring(tokenValue.length);
				matched = true;
				break;
			}
		}
		if (!matched) {
			// Skip one character if nothing matched
			remaining = remaining.substring(1);
		}
	}

	return false;
}
