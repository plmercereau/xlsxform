/**
 * Survey class - the root element that generates XForm XML.
 */

import * as fs from "node:fs";
import { DOMImplementation, XMLSerializer } from "@xmldom/xmldom";
import * as constants from "./constants.js";
import { PyXFormError } from "./errors.js";
import { SurveyInstance } from "./instance.js";
import { RE_PYXFORM_REF, hasPyxformReference } from "./parsing/expression.js";
import {
	Itemset,
	MultipleChoiceQuestion,
	type Question,
	defaultIsDynamic,
} from "./question.js";
import { RepeatingSection, type Section } from "./section.js";
import { SurveyElement, type SurveyElementData } from "./survey-element.js";
import { node, registerNamespace, serializeXml } from "./utils.js";
import { getLanguagesWithBadTags } from "./validators/iana_subtags/validation.js";

const domImpl = new DOMImplementation();

/**
 * Standalone function matching Python's get_path_relative_to_lcar.
 * Get the number of steps from the source to the LCAR, and the path to the target.
 */
export function getPathRelativeToLcarStandalone(
	target: SurveyElement,
	source: SurveyElement,
	lcarStepsSource: number,
	lcar: SurveyElement,
	referenceParent = false,
): [number, string] | [null, null] {
	const isRepeat = (e: SurveyElement) => e.type === constants.REPEAT;

	if (referenceParent) {
		const sourceCarIter = source.iterAncestors(isRepeat);
		const sourceCar = sourceCarIter.next().value?.element ?? null;
		const targetCarIter = target.iterAncestors(isRepeat);
		const targetCar = targetCarIter.next().value?.element ?? null;
		const lcarNotInRepeat = lcar.iterAncestors(isRepeat).next().done !== false;

		if (lcar === targetCar && (lcarNotInRepeat || sourceCar !== lcar)) {
			return [lcarStepsSource + 1, target.getXpath(lcar.parent)];
		}
	}

	const [, lcaStepsSource, , lca] = source.lowestCommonAncestor(target);
	if (lca === null || lcaStepsSource === null) {
		return [null, null];
	}
	return [lcaStepsSource, target.getXpath(lca)];
}
const xmlSerializer = new XMLSerializer();

/**
 * Regex to match pulldata() calls and extract the first argument (the instance name).
 * Handles both single and double quotes, and optional whitespace.
 */
const RE_PULLDATA = /pulldata\s*\(\s*(['"])(.*?)\1/g;

/**
 * Regex to match search() function in appearance.
 */
const SEARCH_FUNCTION_REGEX = /search\(.*?\)/;

/**
 * Find boundaries of instance() expressions in text.
 * Returns array of [start, end] positions.
 *
 * An instance expression is: instance('name')/path/to/node[predicate]/more/path
 * It may contain nested predicates with nested instance() calls.
 */
function findInstanceBoundaries(text: string): [number, number][] {
	const boundaries: [number, number][] = [];
	// Match instance( with optional quotes
	const instancePattern = /instance\s*\(/g;
	let instMatch: RegExpExecArray | null = instancePattern.exec(text);

	while (instMatch !== null) {
		const start = instMatch.index;
		let pos = instMatch.index + instMatch[0].length;

		// Skip past the argument and closing paren: instance('name') or instance("name")
		// Find the closing paren for the instance() call
		let parenDepth = 1;
		while (pos < text.length && parenDepth > 0) {
			const ch = text[pos];
			if (ch === "'" || ch === '"') {
				// Skip string literal
				pos++;
				while (pos < text.length && text[pos] !== ch) pos++;
			} else if (ch === "(") {
				parenDepth++;
			} else if (ch === ")") {
				parenDepth--;
			}
			pos++;
		}

		if (parenDepth !== 0) continue; // Unbalanced parens

		// Now parse the XPath path after instance(...)
		// It consists of path separators, names, and predicates
		while (pos < text.length) {
			const ch = text[pos];
			if (ch === "/") {
				// Path separator - continue
				pos++;
				// Read the path segment (name characters)
				while (pos < text.length && /[a-zA-Z0-9_.\-:]/.test(text[pos])) {
					pos++;
				}
			} else if (ch === "[") {
				// Predicate - find matching ]
				let bracketDepth = 1;
				pos++;
				while (pos < text.length && bracketDepth > 0) {
					const pch = text[pos];
					if (pch === "'" || pch === '"') {
						// Skip string literal inside predicate
						pos++;
						while (pos < text.length && text[pos] !== pch) pos++;
					} else if (pch === "[") {
						bracketDepth++;
					} else if (pch === "]") {
						bracketDepth--;
					}
					pos++;
				}
			} else {
				// End of instance expression
				break;
			}
		}

		boundaries.push([start, pos]);
		// Continue searching from where we left off
		instancePattern.lastIndex = pos;
		instMatch = instancePattern.exec(text);
	}

	return boundaries;
}

/**
 * Escape XML special characters inside an instance expression for use in
 * an XML attribute value that will be parsed as XML (via toParseString).
 * Since the result is parsed as XML, &, <, > need double-escaping so that
 * the entity references survive parsing (e.g. & → &amp;amp; → &amp; in final value).
 * Quotes only need single-escaping (&quot;) for the attribute delimiter;
 * after parsing they become literal " which is the desired result.
 */
function escapeInstanceExprForXml(text: string): string {
	return text
		.replace(/&/g, "&amp;amp;")
		.replace(/</g, "&amp;lt;")
		.replace(/>/g, "&amp;gt;")
		.replace(/"/g, "&quot;");
}

interface ExternalInstanceInfo {
	id: string;
	src: string;
	type: string; // 'external', 'file', 'pulldata', 'choice'
	context: string; // Description of where it was found
}

export interface SurveyData extends SurveyElementData {
	title?: string;
	id_string?: string;
	sms_keyword?: string;
	version?: string;
	style?: string;
	default_language?: string;
	choices?: Record<string, Itemset>;
	_translations?: Record<string, any>;
	public_key?: string;
	submission_url?: string;
	auto_send?: string;
	auto_delete?: string;
	client_editable?: string;
	namespaces?: string;
	instance_xmlns?: string;
	entity_version?: string;
	[key: string]: any;
}

export class Survey extends SurveyElement {
	title: string;
	id_string: string;
	sms_keyword: string;
	version: string;
	style: string | null;
	default_language: string;
	children: (Section | Question | SurveyElement)[];
	choices: Record<string, Itemset> | null;
	_translations: Record<string, any>;
	_xpath_dictionary: Record<string, SurveyElement | null>;
	setvalues_by_triggering_ref: Record<string, [string, string][]>;
	setgeopoint_by_triggering_ref: Record<string, [string, string][]>;
	_hasLastSavedReference: boolean;
	public_key: string | null;
	submission_url: string | null;
	auto_send: string | null;
	auto_delete: string | null;
	client_editable: string | null;
	namespaces: string | null;
	instance_xmlns: string | null;
	prefix: string | null;
	delimiter: string | null;
	_settingsAttributes: Record<string, string>;
	entity_version: string | null;

	constructor(data: SurveyData) {
		super(data);
		this.title = data.title ?? "";
		this.id_string = data.id_string ?? "";
		this.sms_keyword = data.sms_keyword ?? "";
		this.version = data.version ?? "";
		this.style = data.style ?? null;
		this.default_language = data.default_language ?? "";
		this.children = [];
		this.choices = data.choices ?? null;
		this._translations = data._translations ?? {};
		this._xpath_dictionary = {};
		this.setvalues_by_triggering_ref = {};
		this.setgeopoint_by_triggering_ref = {};
		this._hasLastSavedReference = false;
		this.public_key = data.public_key ?? null;
		this.submission_url = data.submission_url ?? null;
		this.auto_send = data.auto_send ?? null;
		this.auto_delete = data.auto_delete ?? null;
		this.client_editable = data.client_editable ?? null;
		this.namespaces = data.namespaces ?? null;
		this.instance_xmlns = data.instance_xmlns ?? null;
		this.prefix = data.prefix ?? null;
		this.delimiter = data.delimiter ?? null;
		this.entity_version = data.entity_version ?? null;

		// Collect attribute::* settings
		this._settingsAttributes = {};
		for (const [k, v] of Object.entries(data)) {
			if (k.startsWith("attribute::") && v != null) {
				const attrName = k.substring("attribute::".length);
				this._settingsAttributes[attrName] = String(v);
			}
		}

		// Process choices from dict format to Itemset objects
		if (data.choices && typeof data.choices === "object") {
			const processed: Record<string, Itemset> = {};
			for (const [listName, value] of Object.entries(data.choices)) {
				if (value instanceof Itemset) {
					processed[listName] = value;
				} else if (Array.isArray(value)) {
					processed[listName] = new Itemset(listName, value);
				}
			}
			this.choices = processed;
		}
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
		this._validateUniquenessOfSectionNames();
	}

	/**
	 * Override to filter out underscore-prefixed properties (matching Python Survey.to_json_dict).
	 */
	toJsonDict(deleteKeys?: Set<string>): Record<string, any> {
		const toDelete = new Set<string>(deleteKeys ?? []);
		// Delete all keys starting with _
		for (const k of Object.keys(this)) {
			if (k.startsWith("_")) toDelete.add(k);
		}
		return super.toJsonDict(toDelete);
	}

	/**
	 * Dump the survey as JSON to a file.
	 */
	jsonDump(filePath?: string): void {
		const fp = filePath ?? `${this.name}.json`;
		const jsonStr = JSON.stringify(this.toJsonDict(), null, 2);
		fs.writeFileSync(fp, jsonStr, "utf-8");
	}

	/**
	 * Print the XForm XML to a file.
	 */
	printXformToFile(outputPath: string, opts?: { warnings?: string[] }): void {
		const warnings = opts?.warnings ?? [];
		const xform = this.toXml({ warnings });
		fs.writeFileSync(outputPath, xform, "utf-8");
	}

	/**
	 * Validate that repeat names are unique across the entire survey
	 * (including after loop expansion).
	 */
	private _validateUniquenessOfSectionNames(): void {
		const repeatNames = new Set<string>();
		for (const element of this.iterDescendants()) {
			if (element instanceof RepeatingSection) {
				if (element.name === this.name) {
					throw new PyXFormError(
						`[row : None] On the 'survey' sheet, the 'name' value '${element.name}' is invalid. Repeat names must not be the same as the survey root (which defaults to 'data').`,
					);
				}
				if (repeatNames.has(element.name)) {
					throw new PyXFormError(
						`[row : None] On the 'survey' sheet, the 'name' value '${element.name}' is invalid. Repeat names must unique anywhere in the survey, at all levels of group or repeat nesting.`,
					);
				}
				repeatNames.add(element.name);
			}
		}
	}

	*iterDescendants(): Generator<SurveyElement> {
		yield this;
		for (const child of this.children) {
			if (
				"iterDescendants" in child &&
				typeof child.iterDescendants === "function"
			) {
				yield* child.iterDescendants();
			} else {
				yield child;
			}
		}
	}

	/**
	 * Set up the xpath dictionary mapping element names to elements.
	 */
	setupXpathDictionary(): void {
		this._xpath_dictionary = {};
		for (const element of this.iterDescendants()) {
			if (element.name && element !== this) {
				if (element.name in this._xpath_dictionary) {
					// Mark duplicates as null (ambiguous)
					this._xpath_dictionary[element.name] = null;
				} else {
					this._xpath_dictionary[element.name] = element;
				}
			}
		}
	}

	/**
	 * Create a SurveyInstance for collecting answers.
	 * Port of Python Survey.instantiate().
	 */
	instantiate(): SurveyInstance {
		return new SurveyInstance(this);
	}

	getElementByName(
		name: string,
		errorPrefix?: string,
	): SurveyElement | undefined {
		if (!(name in this._xpath_dictionary)) {
			return undefined;
		}
		const element = this._xpath_dictionary[name];
		if (element === null) {
			const prefix = errorPrefix ? `${errorPrefix} ` : "";
			throw new PyXFormError(
				`${prefix}There are multiple survey elements named '${name}'.`,
			);
		}
		return element;
	}

	getNsmap(): Record<string, string> {
		const nsmap = { ...constants.NSMAP };
		// Add entities namespace when entities are used
		if (this.entity_version) {
			nsmap["xmlns:entities"] = "http://www.opendatakit.org/xforms/entities";
		}
		// Parse custom namespaces from settings
		if (this.namespaces) {
			const nsString = this.namespaces;
			// Parse format: prefix="uri" prefix2="uri2"
			const nsRegex = /(\w+)\s*=\s*"([^"]+)"/g;
			let match: RegExpExecArray | null = nsRegex.exec(nsString);
			while (match !== null) {
				nsmap[`xmlns:${match[1]}`] = match[2];
				// Register for dynamic element/attribute creation
				registerNamespace(match[1], match[2]);
				match = nsRegex.exec(nsString);
			}
		}
		return nsmap;
	}

	/**
	 * Replace ${ref} with actual XPath expressions.
	 */
	insertXpaths(
		text: string,
		context: SurveyElement,
		useCurrent = false,
		referenceParent = false,
	): string {
		if (!text || typeof text !== "string") return text;

		// Pre-process indexed-repeat: handle ${ref} args specially.
		// In indexed-repeat(target, repeat1, index1, repeat2, index2, ...):
		// - Args at positions 0, 1, 3, 5... (target, repeats) → always absolute paths
		// - Args at positions 2, 4, 6... (index expressions) → normal relative resolution
		let processed = text;
		const indexedRepeatRegex = /indexed-repeat\s*\(/g;
		let irMatch: RegExpExecArray | null;
		indexedRepeatRegex.lastIndex = 0;
		const irMatches: { start: number; end: number; argsStart: number }[] = [];
		irMatch = indexedRepeatRegex.exec(text);
		while (irMatch !== null) {
			const startPos = irMatch.index;
			const argsStart = startPos + irMatch[0].length;
			let depth = 1;
			let pos = argsStart;
			while (pos < text.length && depth > 0) {
				if (text[pos] === "(") depth++;
				else if (text[pos] === ")") depth--;
				pos++;
			}
			irMatches.push({ start: startPos, end: pos, argsStart });
			irMatch = indexedRepeatRegex.exec(text);
		}
		// Process from end to start to preserve positions
		for (let i = irMatches.length - 1; i >= 0; i--) {
			const { start, end, argsStart } = irMatches[i];
			const prefix = text.substring(start, argsStart); // "indexed-repeat("
			const argsStr = text.substring(argsStart, end - 1); // content inside parens
			const suffix = text.substring(end - 1, end); // ")"

			// Split args by top-level commas
			const args: string[] = [];
			let depth = 0;
			let argStart = 0;
			for (let j = 0; j < argsStr.length; j++) {
				if (argsStr[j] === "(") depth++;
				else if (argsStr[j] === ")") depth--;
				else if (argsStr[j] === "," && depth === 0) {
					args.push(argsStr.substring(argStart, j));
					argStart = j + 1;
				}
			}
			args.push(argsStr.substring(argStart));

			// Process each arg based on position
			const processedArgs = args.map((arg, idx) => {
				// Positions 0 (target), 1 (repeat1), 3 (repeat2), 5 (repeat3)... → absolute
				const useAbsolute =
					idx === 0 || idx === 1 || (idx >= 3 && idx % 2 === 1);
				RE_PYXFORM_REF.lastIndex = 0;
				return arg.replace(RE_PYXFORM_REF, (_match, refName: string) => {
					let name = refName;
					let lastSaved = false;
					if (name.startsWith("last-saved#")) {
						lastSaved = true;
						name = name.substring("last-saved#".length);
					}
					const intro = `There has been a problem trying to replace \${${name}} with the XPath to the survey element named '${name}'.`;
					const element = this.getElementByName(name, intro);
					if (!element) {
						throw new PyXFormError(
							`Reference variable '${refName}' not found.`,
						);
					}
					if (lastSaved) {
						this._hasLastSavedReference = true;
						return ` instance('__last-saved')${element.getXpath()} `;
					}
					if (useAbsolute) {
						return ` ${element.getXpath()} `;
					}
					// Normal relative resolution for index expressions
					const xpath = element.getXpath();
					const resolved = this.getPathRelativeToLcar(context, element, xpath);
					return ` ${resolved} `;
				});
			});

			const replaced = prefix + processedArgs.join(",") + suffix;
			processed =
				processed.substring(0, start) + replaced + processed.substring(end);
		}

		// Check if context is inside a repeat (for predicate current() wrapping)
		const contextRepeats = this.getRepeatAncestors(context);
		const contextInRepeat = contextRepeats.length > 0;

		RE_PYXFORM_REF.lastIndex = 0;
		return processed.replace(
			RE_PYXFORM_REF,
			(_match, refName: string, offset: number) => {
				let lastSaved = false;
				let name = refName;
				if (name.startsWith("last-saved#")) {
					lastSaved = true;
					name = name.substring("last-saved#".length);
				}

				const intro = `There has been a problem trying to replace \${${name}} with the XPath to the survey element named '${name}'.`;
				const element = this.getElementByName(name, intro);
				if (!element) {
					throw new PyXFormError(`Reference variable '${refName}' not found.`);
				}

				if (lastSaved) {
					this._hasLastSavedReference = true;
					return ` instance('__last-saved')${element.getXpath()} `;
				}

				const xpath = element.getXpath();

				// Check if this ref needs current() wrapping:
				// - useCurrent is explicitly set (choice filters), OR
				// - the ref is inside a predicate [...] in an instance() expression,
				//   AND the context is in a repeat, AND the target shares the repeat
				let shouldUseCurrent = useCurrent;
				if (!shouldUseCurrent && contextInRepeat && !referenceParent) {
					shouldUseCurrent = this.isRefInPredicate(processed, offset);
				}

				if (shouldUseCurrent) {
					// Use relative path with current() prefix if target shares a repeat with context
					const resolved = this.getPathRelativeToLcar(context, element, xpath);
					if (resolved !== xpath) {
						// It's relative within a repeat - use current() prefix
						return ` current()/${resolved} `;
					}
					// Target is not in the same repeat - use absolute path
					return ` ${xpath} `;
				}

				// Check for relative path in repeats
				const resolved = this.getPathRelativeToLcar(context, element, xpath);
				return ` ${resolved} `;
			},
		);
	}

	/**
	 * Get path relative to Lowest Common Ancestor Repeat.
	 */
	getPathRelativeToLcar(
		context: SurveyElement,
		target: SurveyElement,
		xpath: string,
	): string {
		// Find if context and target share a common repeat ancestor
		const contextRepeats = this.getRepeatAncestors(context);
		const targetRepeats = this.getRepeatAncestors(target);

		if (contextRepeats.length === 0 && targetRepeats.length === 0) {
			return xpath;
		}

		// Find the lowest common ancestor repeat
		let lcar: SurveyElement | null = null;
		for (const cr of contextRepeats) {
			for (const tr of targetRepeats) {
				if (cr === tr) {
					lcar = cr;
					break;
				}
			}
			if (lcar) break;
		}

		if (lcar) {
			// Both are inside the same repeat - compute relative path through actual LCA
			const contextXpath = context.getXpath();
			const targetXpath = target.getXpath();
			const contextParts = contextXpath.split("/").filter(Boolean);
			const targetParts = targetXpath.split("/").filter(Boolean);

			// Find the actual lowest common ancestor (longest common prefix)
			let commonLen = 0;
			for (
				let i = 0;
				i < Math.min(contextParts.length, targetParts.length);
				i++
			) {
				if (contextParts[i] === targetParts[i]) {
					commonLen = i + 1;
				} else {
					break;
				}
			}

			// Number of ".." needed = depth of context below the common ancestor
			const upsNeeded = contextParts.length - commonLen;
			const ups = Array(upsNeeded).fill("..").join("/");
			const targetSuffix = targetParts.slice(commonLen);

			if (targetSuffix.length > 0) {
				return `${ups}/${targetSuffix.join("/")}`;
			}
			return ups;
		}

		return xpath;
	}

	/**
	 * Check if a ${ref} at the given offset is inside a predicate [...] that
	 * should use current() wrapping. This happens when:
	 * 1. The ref is inside brackets [...]
	 * 2. The brackets are NOT on a path that was expanded from a ${ref}
	 *    (i.e., they follow a literal path or secondary instance reference)
	 *
	 * The heuristic: track bracket depth, but also check if the path leading
	 * to the bracket is a secondary instance reference or a literal XPath.
	 */
	private isRefInPredicate(text: string, offset: number): boolean {
		// Find all bracket positions and their contexts
		let bracketDepth = 0;
		let inSingleQuote = false;
		let inDoubleQuote = false;
		let lastBracketStart = -1;

		for (let i = 0; i < offset; i++) {
			const ch = text[i];
			if (ch === "'" && !inDoubleQuote) {
				inSingleQuote = !inSingleQuote;
			} else if (ch === '"' && !inSingleQuote) {
				inDoubleQuote = !inDoubleQuote;
			} else if (!inSingleQuote && !inDoubleQuote) {
				if (ch === "[") {
					if (bracketDepth === 0) lastBracketStart = i;
					bracketDepth++;
				} else if (ch === "]") {
					bracketDepth--;
					if (bracketDepth === 0) lastBracketStart = -1;
				}
			}
		}

		if (bracketDepth <= 0 || lastBracketStart < 0) return false;

		// Check what precedes the bracket - is it a secondary instance path
		// or a literal path (not from a ${ref} expansion)?
		const beforeBracket = text.substring(0, lastBracketStart);

		// Check if preceded by an instance() reference path
		if (/instance\s*\(\s*['"][^'"]*['"]\s*\)\s*\/[^\[]*$/.test(beforeBracket)) {
			return true;
		}

		// Check if preceded by a literal XPath (not from ${ref} expansion)
		// A ${ref} expansion produces " /path/to/element " with spaces.
		// A literal path like "/test_name" won't have the expansion pattern.
		// If the bracket is immediately preceded by a path that starts with /
		// and doesn't have the " path " pattern from expansion, it's literal.
		const pathMatch = beforeBracket.match(/([^\s,()]+)\s*$/);
		if (pathMatch) {
			const precedingPath = pathMatch[1];
			// If the preceding path is absolute and not part of a ${ref} expansion,
			// this is a literal XPath predicate - should use current()
			if (precedingPath.startsWith("/") && !beforeBracket.endsWith(" ")) {
				return true;
			}
		}

		// Check for chained predicates: ][
		// Walk back past ALL preceding predicates to find the base path
		// If that base path is a secondary instance reference, use current()
		let stripPos = lastBracketStart;
		// Walk backward past any preceding ]...[ pairs
		while (stripPos > 0) {
			// Skip whitespace before the bracket
			let p = stripPos - 1;
			while (p >= 0 && text[p] === " ") p--;
			if (p >= 0 && text[p] === "]") {
				// Find matching opening bracket
				let bdepth = 1;
				p--;
				while (p >= 0 && bdepth > 0) {
					if (text[p] === "]") bdepth++;
					else if (text[p] === "[") bdepth--;
					p--;
				}
				stripPos = p + 1;
			} else {
				break;
			}
		}
		if (stripPos < lastBracketStart) {
			const basePath = text.substring(0, stripPos);
			if (/instance\s*\(\s*['"][^'"]*['"]\s*\)\s*\/[^\[]*$/.test(basePath)) {
				return true;
			}
		}

		return false;
	}

	private getRepeatAncestors(element: SurveyElement): SurveyElement[] {
		const repeats: SurveyElement[] = [];
		for (const { element: ancestor } of element.iterAncestors()) {
			if (ancestor.type === constants.REPEAT) {
				repeats.push(ancestor);
			}
		}
		return repeats;
	}

	/**
	 * Resolve a single ${ref} to its xpath string (without <output> wrapping).
	 */
	private _resolveRef(refName: string, context: SurveyElement): string | null {
		let name = refName;
		let lastSaved = false;
		if (name.startsWith("last-saved#")) {
			lastSaved = true;
			name = name.substring("last-saved#".length);
		}

		if (
			name in this._xpath_dictionary &&
			this._xpath_dictionary[name] === null
		) {
			const intro = `There has been a problem trying to replace \${${name}} with the XPath to the survey element named '${name}'.`;
			throw new PyXFormError(
				`${intro} There are multiple survey elements named '${name}'.`,
			);
		}

		const element = this._xpath_dictionary[name];
		if (!element) {
			return null;
		}

		if (lastSaved) {
			this._hasLastSavedReference = true;
			return `instance('__last-saved')${element.getXpath()}`;
		}
		return this.getPathRelativeToLcar(context, element, element.getXpath());
	}

	/**
	 * Insert output values into labels (replace ${ref} with <output value="xpath"/>).
	 * When ${ref} appears inside an instance() expression, the whole instance expression
	 * becomes a single <output value="..."/> with ${ref} replaced by just the xpath.
	 */
	insertOutputValues(
		text: string,
		context: SurveyElement,
	): { text: string; hasOutput: boolean } {
		if (!text || typeof text !== "string")
			return { text: text ?? "", hasOutput: false };
		const hasPyxform = hasPyxformReference(text);
		const hasInstance = /instance\s*\(/.test(text);
		if (!hasPyxform && !hasInstance) return { text, hasOutput: false };

		// First, handle instance() expressions: find them, replace ${ref} inside
		// with just the xpath, then wrap the whole expression in <output value="..."/>.
		let processed = this._replaceInstanceExpressionsWithOutput(text, context);

		// Then handle any remaining ${ref} outside instance() expressions.
		RE_PYXFORM_REF.lastIndex = 0;
		processed = processed.replace(RE_PYXFORM_REF, (_match, refName: string) => {
			const xpath = this._resolveRef(refName, context);
			if (xpath === null) return _match;
			return `<output value=" ${xpath} "/>`;
		});

		return { text: processed, hasOutput: true };
	}

	/**
	 * Find instance() expression boundaries in text and replace them with
	 * <output value="..."/> elements, resolving any ${ref} inside to xpaths.
	 */
	private _replaceInstanceExpressionsWithOutput(
		text: string,
		context: SurveyElement,
	): string {
		const boundaries = findInstanceBoundaries(text);
		if (boundaries.length === 0) return text;

		let result = text;
		let offset = 0;

		for (const [start, end] of boundaries) {
			const oldStr = text.substring(start, end);
			// Replace ${ref} inside the instance expression with just the xpath.
			RE_PYXFORM_REF.lastIndex = 0;
			const resolvedStr = oldStr.replace(
				RE_PYXFORM_REF,
				(_match, refName: string) => {
					const xpath = this._resolveRef(refName, context);
					if (xpath === null) return _match;
					return ` ${xpath} `;
				},
			);
			// Escape XML special chars inside the expression for the attribute value,
			// but preserve quotes (single and double) as-is since they're part of XPath.
			const escapedStr = escapeInstanceExprForXml(resolvedStr);
			const newStr = `<output value="${escapedStr}"/>`;
			result =
				result.substring(0, start + offset) +
				newStr +
				result.substring(end + offset);
			offset += newStr.length - oldStr.length;
		}

		return result;
	}

	/**
	 * Set up translations from all elements.
	 */
	private _translationContexts: Record<string, SurveyElement> = {};

	private setupTranslations(): void {
		const translations: Record<
			string,
			Record<string, Record<string, any>>
		> = {};
		this._translationContexts = {};

		for (const element of this.iterDescendants()) {
			for (const t of element.getTranslations(this.default_language)) {
				const lang = t.lang as string;
				const path = t.path as string;
				const text = t.text;

				if (!translations[lang]) translations[lang] = {};
				if (!translations[lang][path]) translations[lang][path] = {};

				// Store the output context for this translation path
				if (t.output_context) {
					this._translationContexts[path] = t.output_context as SurveyElement;
				}

				const displayElement = t.display_element;
				if (displayElement) {
					translations[lang][path][displayElement] = text;
				} else {
					translations[lang][path].text = text;
				}
			}
		}

		// Handle choice translations
		if (this.choices) {
			for (const [listName, itemset] of Object.entries(this.choices)) {
				if (!itemset.requires_itext) continue;
				for (let optIdx = 0; optIdx < itemset.options.length; optIdx++) {
					const option = itemset.options[optIdx];
					const itextId = `${listName}-${optIdx}`;

					if (typeof option.label === "object" && option.label !== null) {
						for (const [lang, text] of Object.entries(option.label)) {
							if (!translations[lang]) translations[lang] = {};
							if (!translations[lang][itextId])
								translations[lang][itextId] = {};
							translations[lang][itextId].label = text;
						}
					} else if (option.label) {
						const lang = this.default_language;
						if (!translations[lang]) translations[lang] = {};
						if (!translations[lang][itextId]) translations[lang][itextId] = {};
						translations[lang][itextId].label = option.label;
					}

					if (option.media) {
						for (const [mediaType, mediaValue] of Object.entries(
							option.media,
						)) {
							if (typeof mediaValue === "object" && mediaValue !== null) {
								for (const [lang, text] of Object.entries(mediaValue)) {
									if (!translations[lang]) translations[lang] = {};
									if (!translations[lang][itextId])
										translations[lang][itextId] = {};
									translations[lang][itextId][mediaType] = text;
								}
							} else {
								const lang = this.default_language;
								if (!translations[lang]) translations[lang] = {};
								if (!translations[lang][itextId])
									translations[lang][itextId] = {};
								translations[lang][itextId][mediaType] = mediaValue;
							}
						}
					}
				}
			}
		}

		// Process search() appearance for MultipleChoiceQuestions
		const searchLists = new Set<string>(); // "qname|listname"
		const nonSearchLists = new Set<string>();
		for (const element of this.iterDescendants()) {
			if (element instanceof MultipleChoiceQuestion) {
				const selectRef = `${element.name}|${element.list_name}`;
				if (this._redirectIsSearchItext(element)) {
					searchLists.add(selectRef);
				} else {
					nonSearchLists.add(selectRef);
				}
			}
		}

		// Validate: search and non-search questions must not share choice lists
		for (const ref of searchLists) {
			const [qName, listName] = ref.split("|");
			const conflicting: string[] = [];
			for (const nsRef of nonSearchLists) {
				const [nsQName, nsListName] = nsRef.split("|");
				if (nsListName === listName) {
					conflicting.push(`'${nsQName}'`);
				}
			}
			if (conflicting.length > 0) {
				const refsStr = conflicting.join(", ");
				throw new PyXFormError(
					`Question '${qName}' uses 'search()', and its select type references the choice list name '${listName}'. This choice list name is referenced by at least one other question that is not using 'search()', which will not work: ${refsStr}. Either 1) use 'search()' for all questions using this choice list name, or 2) use a different choice list name for the question using 'search()'.`,
				);
			}
		}

		this._translations = translations;
		this._addEmptyTranslations();
	}

	/**
	 * For selects using the "search()" function, redirect itext for in-line items.
	 * Clears element.itemset so inline items are rendered instead of itemset references.
	 */
	private _redirectIsSearchItext(element: MultipleChoiceQuestion): boolean {
		let isSearch = false;
		try {
			const appearance = element.control?.[constants.APPEARANCE];
			if (appearance && appearance.length > 7) {
				isSearch = SEARCH_FUNCTION_REGEX.test(appearance);
			}
		} catch {
			// ignore
		}

		if (isSearch) {
			// Check for select_from_file + search combination (not supported)
			const itemsetStr = element.itemset ?? "";
			const dotIdx = itemsetStr.lastIndexOf(".");
			if (dotIdx >= 0) {
				const ext = itemsetStr.substring(dotIdx);
				if (ext && constants.EXTERNAL_INSTANCE_EXTENSIONS.has(ext)) {
					throw new PyXFormError(
						`Question '${element.name}' is a select from file type, using 'search()'. This combination is not supported. Remove the 'search()' usage, or change the select type.`,
					);
				}
			}

			let choices: Itemset | null = null;
			if (this.choices) {
				choices = this.choices[element.itemset ?? ""] ?? null;
			}
			if (!choices) {
				choices = element.choices;
			}
			element.itemset = "";
			if (choices && !choices.used_by_search) {
				choices.used_by_search = true;
				for (let i = 0; i < choices.options.length; i++) {
					choices.options[i]._choice_itext_ref =
						`jr:itext('${choices.name}-${i}')`;
				}
			}
		}

		return isSearch;
	}

	/**
	 * Add placeholder translations so that every itext element has the same elements
	 * across every language. When translations are not provided, "-" will be used.
	 * This matches Python pyxform's _add_empty_translations behavior.
	 */
	private _addEmptyTranslations(): void {
		// Collect all paths and their content types across all languages
		const paths: Record<string, Set<string>> = {};
		for (const translation of Object.values(this._translations)) {
			for (const [path, content] of Object.entries(translation)) {
				if (!paths[path]) paths[path] = new Set<string>();
				if (typeof content === "object" && content !== null) {
					for (const key of Object.keys(content)) {
						paths[path].add(key);
					}
				}
			}
		}

		// For each language, add missing paths/content types with "-"
		for (const lang of Object.keys(this._translations)) {
			for (const [path, contentTypes] of Object.entries(paths)) {
				if (!this._translations[lang][path]) {
					this._translations[lang][path] = {};
				}
				for (const contentType of contentTypes) {
					if (!(contentType in this._translations[lang][path])) {
						this._translations[lang][path][contentType] = "-";
					}
				}
			}
		}
	}

	/**
	 * Generate the itext element for translations.
	 */
	private xmlItext(): Element | null {
		const languages = Object.keys(this._translations);
		if (languages.length === 0) return null;

		const translationElements: Element[] = [];

		for (const lang of languages) {
			const items = this._translations[lang];
			const textElements: Element[] = [];

			for (const [path, forms] of Object.entries(
				items as Record<string, any>,
			)) {
				const valueElements: Element[] = [];

				for (const [form, text] of Object.entries(
					forms as Record<string, string>,
				)) {
					if (
						form === "label" ||
						form === "hint" ||
						form === "guidance_hint" ||
						form === "text"
					) {
						// Map form names to itext form attributes:
						// - label, text, hint → no form attribute (just <value>text</value>)
						// - guidance_hint → form="guidance"
						const formAttr = form === "guidance_hint" ? "guidance" : undefined;
						// Use the correct output context for this translation path
						const outputContext = this._translationContexts[path] ?? this;
						const { text: processedText, hasOutput } = this.insertOutputValues(
							String(text),
							outputContext,
						);
						if (formAttr) {
							valueElements.push(
								node("value", {
									text: processedText,
									attrs: { form: formAttr },
									toParseString: hasOutput,
								}),
							);
						} else {
							valueElements.push(
								node("value", {
									text: processedText,
									toParseString: hasOutput,
								}),
							);
						}
					} else if (["image", "big-image", "audio", "video"].includes(form)) {
						// Skip media entries with placeholder value "-"
						if (String(text) === "-") continue;
						const jrPrefix =
							form === "audio"
								? "jr://audio/"
								: form === "video"
									? "jr://video/"
									: "jr://images/";
						let mediaRef = `${jrPrefix}${text}`;
						if (String(text).startsWith("jr://")) mediaRef = String(text);
						// Resolve ${ref} output values in media references
						const outputContext = this._translationContexts[path];
						const { text: resolvedText, hasOutput } = this.insertOutputValues(
							mediaRef,
							outputContext || this,
						);
						valueElements.push(
							node("value", {
								text: resolvedText,
								toParseString: hasOutput,
								attrs: { form },
							}),
						);
					}
				}

				if (valueElements.length > 0) {
					textElements.push(
						node("text", { children: valueElements, attrs: { id: path } }),
					);
				}
			}

			if (textElements.length > 0) {
				const attrs: Record<string, string> = { lang };
				if (lang === this.default_language) {
					attrs.default = "true()";
				}
				translationElements.push(
					node("translation", { children: textElements, attrs }),
				);
			}
		}

		if (translationElements.length === 0) return null;

		return node("itext", { children: translationElements });
	}

	/**
	 * Generate the main XML instance.
	 */
	private xmlMainInstance(): Element {
		const instanceChildren: Element[] = [];
		let appendTemplate = false;
		for (const child of this.children) {
			let repeatingTemplate: Element | null = null;
			if (child instanceof RepeatingSection && !appendTemplate) {
				appendTemplate = true;
				repeatingTemplate = child.generateRepeatingTemplate(this);
			}

			const childInstance = child.xmlInstance(this, appendTemplate);
			if (childInstance) {
				if (appendTemplate && repeatingTemplate) {
					// Insert template before the regular instance
					instanceChildren.push(repeatingTemplate);
					appendTemplate = false;
				}
				instanceChildren.push(childInstance);
			}
		}

		const dataAttrs: Record<string, string> = {
			id: this.id_string || this.name,
		};
		if (this.version) {
			dataAttrs.version = this.version;
		}
		if (this.instance_xmlns) {
			dataAttrs.xmlns = this.instance_xmlns;
		}
		if (this.prefix) {
			dataAttrs["odk:prefix"] = this.prefix;
		}
		if (this.delimiter) {
			dataAttrs["odk:delimiter"] = this.delimiter;
		}
		// Add attribute::* settings to the data node
		for (const [attrName, attrValue] of Object.entries(
			this._settingsAttributes,
		)) {
			dataAttrs[attrName] = attrValue;
		}

		const dataNode = node(this.name, {
			children: instanceChildren,
			attrs: dataAttrs,
		});

		return node("instance", { children: [dataNode] });
	}

	/**
	 * Generate static instances for choice lists.
	 */
	private *xmlStaticInstances(): Generator<Element> {
		if (!this.choices) return;

		for (const [listName, itemset] of Object.entries(this.choices)) {
			if (itemset.used_by_search) continue;

			const itemNodes: Element[] = [];
			for (let optIdx = 0; optIdx < itemset.options.length; optIdx++) {
				const option = itemset.options[optIdx];
				const children: Element[] = [
					node(constants.DEFAULT_ITEMSET_VALUE_REF, { text: option.name }),
				];

				if (itemset.requires_itext) {
					const itextId = `${listName}-${optIdx}`;
					children.push(node("itextId", { text: itextId }));
				} else if (typeof option.label === "string") {
					children.push(
						node(constants.DEFAULT_ITEMSET_LABEL_REF, { text: option.label }),
					);
				}

				// Add extra columns (geometry, etc.)
				if (option.extra_data && typeof option.extra_data === "object") {
					for (const [k, v] of Object.entries(option.extra_data)) {
						if (v != null) {
							children.push(node(k, { text: String(v) }));
						}
					}
				}

				itemNodes.push(node("item", { children }));
			}

			const rootNode = node("root", { children: itemNodes });
			yield node("instance", {
				children: [rootNode],
				attrs: { id: listName },
			});
		}
	}

	/**
	 * Generate all bind elements.
	 */
	private *xmlBinds(): Generator<Element> {
		for (const element of this.iterDescendants()) {
			if (element === this) continue;
			yield* element.xmlBindings(this);
		}
	}

	/**
	 * Generate the body element.
	 */
	private xmlBody(): Element {
		const controls: Element[] = [];
		for (const child of this.children) {
			const control = child.xmlControl(this);
			if (control != null) {
				if (Symbol.iterator in Object(control)) {
					for (const c of control as any) {
						controls.push(c);
					}
				} else {
					controls.push(control as Element);
				}
			}
		}

		return node("h:body", { children: controls });
	}

	/**
	 * Get a context description for an element (for error messages).
	 */
	private getElementContext(element: SurveyElement): string {
		if (element.parent && element.parent !== this) {
			return `[type: ${element.parent.type}, name: ${element.parent.name}]`;
		}
		return "survey";
	}

	/**
	 * Extract pulldata instance names from an expression string.
	 */
	private extractPulldataInstances(
		expression: string,
		context: string,
	): ExternalInstanceInfo[] {
		const results: ExternalInstanceInfo[] = [];
		RE_PULLDATA.lastIndex = 0;
		let match: RegExpExecArray | null = RE_PULLDATA.exec(expression);
		while (match !== null) {
			const instanceName = match[2];
			results.push({
				id: instanceName,
				src: `jr://file-csv/${instanceName}.csv`,
				type: "pulldata",
				context,
			});
			match = RE_PULLDATA.exec(expression);
		}
		return results;
	}

	/**
	 * Collect all external instances needed by this survey.
	 * Sources: xml-external, csv-external types, select_*_from_file with
	 * file extensions, and pulldata() calls in bind expressions.
	 */
	private collectExternalInstances(): ExternalInstanceInfo[] {
		const instances: ExternalInstanceInfo[] = [];

		for (const element of this.iterDescendants()) {
			if (element === this) continue;

			const context = this.getElementContext(element);

			// 1. xml-external and csv-external types
			if (element.type === "xml-external") {
				instances.push({
					id: element.name,
					src: `jr://file/${element.name}.xml`,
					type: "external",
					context,
				});
			} else if (element.type === "csv-external") {
				instances.push({
					id: element.name,
					src: `jr://file-csv/${element.name}.csv`,
					type: "external",
					context,
				});
			}

			// 2. select_*_from_file with file extensions (MultipleChoiceQuestion with itemset containing file extension)
			if (element instanceof MultipleChoiceQuestion && element.itemset) {
				const dotIdx = element.itemset.lastIndexOf(".");
				if (dotIdx >= 0) {
					const fileExtension = element.itemset.substring(dotIdx);
					if (constants.EXTERNAL_INSTANCE_EXTENSIONS.has(fileExtension)) {
						const itemsetName = element.itemset.substring(0, dotIdx);
						const filePrefix = fileExtension === ".csv" ? "file-csv" : "file";
						const src = `jr://${filePrefix}/${itemsetName}${fileExtension}`;
						instances.push({
							id: itemsetName,
							src,
							type: "file",
							context,
						});
					}
				}
			}

			// 3. pulldata() calls in bind expressions
			if (element.bind) {
				for (const bindAttr of [
					"calculate",
					"constraint",
					"readonly",
					"required",
					"relevant",
				]) {
					const value = element.bind[bindAttr];
					if (typeof value === "string" && value.includes("pulldata")) {
						instances.push(...this.extractPulldataInstances(value, context));
					}
				}
			}

			// 4. pulldata() in choice_filter
			if ("choice_filter" in element) {
				const cf = (element as any).choice_filter;
				if (typeof cf === "string" && cf.includes("pulldata")) {
					instances.push(...this.extractPulldataInstances(cf, context));
				}
			}

			// 5. pulldata() in default
			if (
				element.default &&
				typeof element.default === "string" &&
				element.default.includes("pulldata")
			) {
				instances.push(
					...this.extractPulldataInstances(element.default, context),
				);
			}

			// 6. Entity update mode - needs CSV instance for the dataset
			if (element.type === "entity" && element.extra_data?._entity_children) {
				const entityChildren = element.extra_data._entity_children as any[];
				for (const child of entityChildren) {
					if (
						child[constants.NAME] === "baseVersion" &&
						child[constants.BIND]?.calculate
					) {
						// Extract dataset name from the calculate expression
						const calcExpr = child[constants.BIND].calculate;
						const instanceMatch = calcExpr.match(
							/instance\s*\(\s*'([^']+)'\s*\)/,
						);
						if (instanceMatch) {
							const datasetName = instanceMatch[1];
							instances.push({
								id: datasetName,
								src: `jr://file-csv/${datasetName}.csv`,
								type: "file",
								context,
							});
						}
					}
				}
			}
		}

		return instances;
	}

	/**
	 * Validate and deduplicate external instances, then generate instance elements.
	 * Same id + same src is allowed (deduplicated).
	 * Same id + different src is an error.
	 */
	private xmlExternalInstances(): Element[] {
		const allInstances = this.collectExternalInstances();

		// Count how many times each name appears as an 'external' type declaration
		const externalDeclCounts = new Map<string, number>();
		for (const inst of allInstances) {
			if (inst.type === "external") {
				externalDeclCounts.set(
					inst.id,
					(externalDeclCounts.get(inst.id) ?? 0) + 1,
				);
			}
		}

		// Check for duplicate external declarations
		for (const [id, count] of externalDeclCounts) {
			if (count > 1) {
				throw new PyXFormError(
					`Instance names must be unique. The name '${id}' was found ${count} time(s) in the 'survey' sheet.`,
				);
			}
		}

		// Deduplicate and validate
		const seen = new Map<string, ExternalInstanceInfo>();
		const result: Element[] = [];

		for (const inst of allInstances) {
			const existing = seen.get(inst.id);
			if (existing) {
				if (existing.src !== inst.src) {
					// Different source for same id - error
					throw new PyXFormError(
						`Instance name: '${inst.id}', ` +
							`Existing type: '${existing.type}', Existing URI: '${existing.src}', ` +
							`Duplicate type: '${inst.type}', Duplicate URI: '${inst.src}', ` +
							`Duplicate context: '${inst.context}'.`,
					);
				}
				// Same src - skip (already added)
				continue;
			}
			seen.set(inst.id, inst);
		}

		// Also check against static choice instances for conflicts
		// (skip choices used by search since they don't generate static instances)
		if (this.choices) {
			for (const [listName, itemset] of Object.entries(this.choices)) {
				if (itemset.used_by_search) continue;
				const ext = seen.get(listName);
				if (ext) {
					throw new PyXFormError(
						`Instance name: '${listName}', Existing type: '${ext.type}', Existing URI: '${ext.src}', Duplicate type: 'choice', Duplicate URI: 'None', Duplicate context: 'survey'.`,
					);
				}
			}
		}

		for (const inst of seen.values()) {
			result.push(
				node("instance", {
					attrs: { id: inst.id, src: inst.src },
				}),
			);
		}

		return result;
	}

	/**
	 * Convert to XML string.
	 */
	toXml(
		opts: {
			validate?: boolean;
			prettyPrint?: boolean;
			warnings?: string[];
			enketo?: boolean;
		} = {},
	): string {
		this.setupXpathDictionary();
		this._hasLastSavedReference = false;
		this.setupTranslations();

		const nsmap = this.getNsmap();

		// Build model
		const modelChildren: Element[] = [];

		// itext
		const itext = this.xmlItext();
		if (itext) modelChildren.push(itext);

		// Main instance
		modelChildren.push(this.xmlMainInstance());

		// External instances (xml-external, csv-external, select_*_from_file, pulldata)
		const externalInstances = this.xmlExternalInstances();
		for (const inst of externalInstances) {
			modelChildren.push(inst);
		}

		// Static instances (choice lists)
		for (const inst of this.xmlStaticInstances()) {
			modelChildren.push(inst);
		}

		// Submission element
		const submissionAttrs: Record<string, string> = {};
		if (this.submission_url) {
			submissionAttrs.action = this.submission_url;
			submissionAttrs.method = "post";
		}
		if (this.public_key) {
			submissionAttrs.base64RsaPublicKey = this.public_key;
		}
		if (this.auto_send) {
			submissionAttrs["orx:auto-send"] = this.auto_send;
		}
		if (this.auto_delete) {
			submissionAttrs["orx:auto-delete"] = this.auto_delete;
		}
		if (this.client_editable) {
			const val = this.client_editable.toLowerCase();
			if (val === "yes" || val === "true") {
				submissionAttrs["odk:client-editable"] = "true";
			}
		}
		if (Object.keys(submissionAttrs).length > 0) {
			modelChildren.push(node("submission", { attrs: submissionAttrs }));
		}

		// Binds
		for (const bind of this.xmlBinds()) {
			modelChildren.push(bind);
		}

		// Setvalue elements for dynamic defaults, setgeopoint, actions, and entity setvalues
		for (const element of this.iterDescendants()) {
			if (element === this) continue;
			if (
				element.default &&
				typeof element.default === "string" &&
				defaultIsDynamic(element.default, element.type)
			) {
				const value = this.insertXpaths(element.default, element);
				const setvalueNode = node("setvalue", {
					attrs: {
						event: "odk-instance-first-load",
						ref: element.getXpath(),
						value,
					},
				});
				modelChildren.push(setvalueNode);
			}
			// Add odk:setgeopoint for start-geopoint type questions
			if (element.type === "start-geopoint") {
				modelChildren.push(
					node("odk:setgeopoint", {
						attrs: {
							event: "odk-instance-first-load",
							ref: element.getXpath(),
						},
					}),
				);
			}
			// Generate model-level action elements (e.g. odk:recordaudio for background-audio)
			if ("actions" in element && (element as any).actions) {
				const actions = (element as any).actions as Record<string, string>[];
				for (const action of actions) {
					const actionName = action.name;
					const event = action.event;
					// Only emit model-level actions (not odk-new-repeat which goes in body)
					if (event === "odk-new-repeat") continue;
					const actionAttrs: Record<string, string> = {
						event,
						ref: element.getXpath(),
					};
					// Pass through extra attributes (e.g. odk:quality)
					for (const [k, v] of Object.entries(action)) {
						if (k !== "name" && k !== "event" && k !== "value") {
							actionAttrs[k] = v;
						}
					}
					if (action.value) {
						actionAttrs.value = this.insertXpaths(action.value, element);
					}
					modelChildren.push(node(actionName, { attrs: actionAttrs }));
				}
			}
			// Add entity setvalue elements (e.g. uuid() generation for entity id)
			// Only model-level setvalues (odk-instance-first-load), not body-level (odk-new-repeat)
			if (element.type === "entity") {
				for (const sv of element.getEntitySetvalues()) {
					if (sv.event === "odk-instance-first-load") {
						modelChildren.push(
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

		// Body (generate before finalizing model, so labels can set _hasLastSavedReference)
		const bodyNode = this.xmlBody();

		// Add __last-saved instance if any expression referenced last-saved#
		if (this._hasLastSavedReference) {
			// Check for conflict with an explicit xml-external __last-saved instance
			const existingLastSaved = modelChildren.find(
				(el) =>
					el.tagName === "instance" && el.getAttribute("id") === "__last-saved",
			);
			if (existingLastSaved) {
				const existingSrc = existingLastSaved.getAttribute("src") ?? "";
				if (existingSrc !== "jr://instance/last-saved") {
					throw new PyXFormError(
						`The same instance id will be generated for different external instance source URIs. Please check the form. Instance name: '__last-saved', Existing type: 'external', Existing URI: '${existingSrc}', Duplicate type: 'instance', Duplicate URI: 'jr://instance/last-saved', Duplicate context: 'None'.`,
					);
				}
			} else {
				const mainInstanceIndex = modelChildren.findIndex(
					(el) => el.tagName === "instance" && !el.getAttribute("id"),
				);
				const lastSavedInstance = node("instance", {
					attrs: { id: "__last-saved", src: "jr://instance/last-saved" },
				});
				modelChildren.splice(mainInstanceIndex + 1, 0, lastSavedInstance);
			}
		}

		const modelAttrs: Record<string, string> = {};
		if (this.entity_version) {
			modelAttrs["entities:entities-version"] = this.entity_version;
		}
		const modelNode = node("model", {
			children: modelChildren,
			attrs: modelAttrs,
		});

		// Head
		const titleNode = node("h:title", { text: this.title || this.name });
		const headNode = node("h:head", { children: [titleNode, modelNode] });

		// Root html element
		const htmlAttrs: Record<string, string> = {};
		for (const [k, v] of Object.entries(nsmap)) {
			htmlAttrs[k] = v;
		}

		const htmlNode = node("h:html", {
			children: [headNode, bodyNode],
			attrs: htmlAttrs,
		});

		// Serialize
		const xmlDecl = '<?xml version="1.0"?>\n';
		const xml = xmlDecl + serializeXml(htmlNode, opts.prettyPrint ?? false);

		// Warn if one or more translation is missing a valid IANA subtag
		const warnings = opts.warnings;
		const translations = Object.keys(this._translations);
		if (warnings && translations.length > 0) {
			const badLanguages = getLanguagesWithBadTags(translations);
			if (badLanguages.length > 0) {
				warnings.push(
					`The following language declarations do not contain valid machine-readable codes: ${badLanguages.join(", ")}. Learn more: http://xlsform.org#multiple-language-support`,
				);
			}
		}

		return xml;
	}

	/**
	 * Pretty print XML output.
	 */
	toPrettyXml(): string {
		return this.toXml({ prettyPrint: true });
	}

	xmlInstance_forSurvey(survey: any): Element {
		return this.xmlMainInstance();
	}

	*xmlBindings(survey: any): Generator<Element> {
		// Survey root doesn't generate its own bind
	}
}
