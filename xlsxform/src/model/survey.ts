/**
 * Survey class - the root element that generates XForm XML.
 */

import {
	DOMImplementation,
	type Element as XElement,
	XMLSerializer,
} from "@xmldom/xmldom";
import * as constants from "../constants.js";

// Use xmldom's Element type throughout (returned by node() from utils.ts)
type Element = XElement;
import { PyXFormError } from "../errors.js";
import { RE_PYXFORM_REF, hasPyxformReference } from "../parsing/expression.js";
import { node, registerNamespace, serializeXml } from "../utils.js";
import { getLanguagesWithBadTags } from "../validators/iana_subtags/validation.js";
import { SurveyInstance } from "./instance.js";
import { MultipleChoiceQuestion } from "./multiple-choice-question.js";
import { Itemset } from "./option.js";
import { type Question, defaultIsDynamic } from "./question.js";
import { RepeatingSection, type Section } from "./section.js";
import { SurveyElement, type SurveyElementData } from "./survey-element.js";

const _domImpl = new DOMImplementation();

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
const _xmlSerializer = new XMLSerializer();

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
 * Skip past a string literal starting at `pos` (the opening quote).
 * Returns the position after the closing quote.
 */
function skipStringLiteral(text: string, startPos: number): number {
	const quote = text[startPos];
	let p = startPos + 1;
	while (p < text.length && text[p] !== quote) {
		p++;
	}
	return p + 1;
}

/**
 * Skip past a balanced group (parens or brackets) starting at `startPos`
 * (the position after the opening delimiter).
 * Returns the position after the closing delimiter, or -1 if unbalanced.
 */
function skipBalancedGroup(
	text: string,
	startPos: number,
	open: string,
	close: string,
): number {
	let depth = 1;
	let p = startPos;
	while (p < text.length && depth > 0) {
		const ch = text[p];
		if (ch === "'" || ch === '"') {
			p = skipStringLiteral(text, p);
			continue;
		}
		if (ch === open) {
			depth++;
		} else if (ch === close) {
			depth--;
		}
		p++;
	}
	return depth === 0 ? p : -1;
}

/**
 * Parse the XPath path after an instance(...) call.
 * Consumes path segments (/name) and predicates ([...]).
 * Returns the position after the last consumed token.
 */
function parseXPathTail(text: string, startPos: number): number {
	let p = startPos;
	while (p < text.length) {
		const ch = text[p];
		if (ch === "/") {
			p++;
			while (p < text.length && /[a-zA-Z0-9_.\-:]/.test(text[p])) {
				p++;
			}
		} else if (ch === "[") {
			p = skipBalancedGroup(text, p + 1, "[", "]");
			if (p === -1) {
				return text.length;
			}
		} else {
			break;
		}
	}
	return p;
}

/**
 * Find boundaries of instance() expressions in text.
 * Returns array of [start, end] positions.
 *
 * An instance expression is: instance('name')/path/to/node[predicate]/more/path
 * It may contain nested predicates with nested instance() calls.
 */
function findInstanceBoundaries(text: string): [number, number][] {
	const boundaries: [number, number][] = [];
	const instancePattern = /instance\s*\(/g;
	let instMatch: RegExpExecArray | null = instancePattern.exec(text);

	while (instMatch !== null) {
		const start = instMatch.index;
		const afterOpen = instMatch.index + instMatch[0].length;
		const pos = skipBalancedGroup(text, afterOpen, "(", ")");

		if (pos === -1) {
			instMatch = instancePattern.exec(text);
			continue;
		}

		const end = parseXPathTail(text, pos);
		boundaries.push([start, end]);
		instancePattern.lastIndex = end;
		instMatch = instancePattern.exec(text);
	}

	return boundaries;
}

/**
 * A nested map: language -> path -> content-type -> value.
 */
type TranslationsMap = Record<string, Record<string, Record<string, unknown>>>;

/**
 * Ensure `translations[lang][path]` exists as an object.
 */
function ensureTranslationPath(
	translations: TranslationsMap,
	lang: string,
	path: string,
): void {
	if (!translations[lang]) {
		translations[lang] = {};
	}
	if (!translations[lang][path]) {
		translations[lang][path] = {};
	}
}

/** Regex that matches a trailing instance() reference path. */
const RE_INSTANCE_PATH_SUFFIX =
	/instance\s*\(\s*['"][^'"]*['"]\s*\)\s*\/[^\[]*$/;

/**
 * Check if text ends with a secondary instance() reference path.
 */
function isInstancePath(text: string): boolean {
	return RE_INSTANCE_PATH_SUFFIX.test(text);
}

/**
 * Check if text ends with a literal absolute XPath (not from ${ref} expansion).
 * ${ref} expansions produce " /path " with trailing space; literal paths do not.
 */
function isLiteralAbsolutePath(text: string): boolean {
	const pathMatch = text.match(/([^\s,()]+)\s*$/);
	if (!pathMatch) {
		return false;
	}
	return pathMatch[1].startsWith("/") && !text.endsWith(" ");
}

/**
 * Track bracket state while scanning text, yielding non-quoted bracket chars.
 * Returns { bracketDepth, lastBracketStart } after scanning up to `end`.
 */
/**
 * Classify a character for quote-aware scanning.
 * Returns 'quote-toggle-single', 'quote-toggle-double', or 'normal'.
 */
function classifyQuotedChar(
	ch: string,
	inSingleQuote: boolean,
	inDoubleQuote: boolean,
): "toggle-single" | "toggle-double" | "normal" {
	if (ch === "'" && !inDoubleQuote) {
		return "toggle-single";
	}
	if (ch === '"' && !inSingleQuote) {
		return "toggle-double";
	}
	return "normal";
}

interface BracketState {
	bracketDepth: number;
	inSingleQuote: boolean;
	inDoubleQuote: boolean;
	lastBracketStart: number;
}

function updateBracketState(
	state: BracketState,
	ch: string,
	pos: number,
): void {
	const kind = classifyQuotedChar(ch, state.inSingleQuote, state.inDoubleQuote);
	if (kind === "toggle-single") {
		state.inSingleQuote = !state.inSingleQuote;
		return;
	}
	if (kind === "toggle-double") {
		state.inDoubleQuote = !state.inDoubleQuote;
		return;
	}
	if (state.inSingleQuote || state.inDoubleQuote) {
		return;
	}
	if (ch === "[") {
		if (state.bracketDepth === 0) {
			state.lastBracketStart = pos;
		}
		state.bracketDepth++;
		return;
	}
	if (ch === "]") {
		state.bracketDepth--;
		if (state.bracketDepth === 0) {
			state.lastBracketStart = -1;
		}
	}
}

function scanBrackets(
	text: string,
	end: number,
): { bracketDepth: number; lastBracketStart: number } {
	const state: BracketState = {
		bracketDepth: 0,
		inSingleQuote: false,
		inDoubleQuote: false,
		lastBracketStart: -1,
	};

	for (let i = 0; i < end; i++) {
		updateBracketState(state, text[i], i);
	}

	return {
		bracketDepth: state.bracketDepth,
		lastBracketStart: state.lastBracketStart,
	};
}

/**
 * Find the position of the outermost unmatched '[' before `offset`,
 * respecting string literals. Returns -1 if offset is not inside brackets.
 */
function findOutermostOpenBracket(text: string, offset: number): number {
	const { bracketDepth, lastBracketStart } = scanBrackets(text, offset);
	return bracketDepth > 0 ? lastBracketStart : -1;
}

/**
 * Find the position of the matching '[' scanning backward from a ']' at `closingPos`.
 * Returns the position of the '[' or 0 if unbalanced.
 */
function findMatchingOpenBracketBackward(
	text: string,
	closingPos: number,
): number {
	let bdepth = 1;
	let p = closingPos - 1;
	while (p >= 0 && bdepth > 0) {
		if (text[p] === "]") {
			bdepth++;
		} else if (text[p] === "[") {
			bdepth--;
		}
		p--;
	}
	return p + 1;
}

/**
 * Walk backward from `pos` past any chained predicate pairs (][...]),
 * returning the position of the base path before all predicates.
 */
function walkBackPastPredicates(text: string, pos: number): number {
	let stripPos = pos;
	while (stripPos > 0) {
		let p = stripPos - 1;
		while (p >= 0 && text[p] === " ") {
			p--;
		}
		if (p < 0 || text[p] !== "]") {
			break;
		}
		stripPos = findMatchingOpenBracketBackward(text, p);
	}
	return stripPos;
}

/**
 * Compute a relative path from `contextXpath` to `targetXpath`
 * using "../" segments to walk up from the common prefix.
 */
function computeRelativePath(
	contextXpath: string,
	targetXpath: string,
): string {
	const contextParts = contextXpath.split("/").filter(Boolean);
	const targetParts = targetXpath.split("/").filter(Boolean);

	let commonLen = 0;
	const maxLen = Math.min(contextParts.length, targetParts.length);
	for (let i = 0; i < maxLen; i++) {
		if (contextParts[i] === targetParts[i]) {
			commonLen = i + 1;
		} else {
			break;
		}
	}

	const ups = new Array(contextParts.length - commonLen).fill("..").join("/");
	const targetSuffix = targetParts.slice(commonLen);
	return targetSuffix.length > 0 ? `${ups}/${targetSuffix.join("/")}` : ups;
}

/**
 * Split a string by top-level commas (respecting nested parentheses).
 */
function splitTopLevelArgs(argsStr: string): string[] {
	const args: string[] = [];
	let depth = 0;
	let argStart = 0;
	for (let j = 0; j < argsStr.length; j++) {
		if (argsStr[j] === "(") {
			depth++;
		} else if (argsStr[j] === ")") {
			depth--;
		} else if (argsStr[j] === "," && depth === 0) {
			args.push(argsStr.substring(argStart, j));
			argStart = j + 1;
		}
	}
	args.push(argsStr.substring(argStart));
	return args;
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

interface SurveyData extends SurveyElementData {
	title?: string;
	id_string?: string;
	sms_keyword?: string;
	version?: string;
	style?: string;
	default_language?: string;
	choices?: Record<string, Itemset | Record<string, unknown>[]>;
	_translations?: Record<string, Record<string, Record<string, unknown>>>;
	public_key?: string;
	submission_url?: string;
	auto_send?: string;
	auto_delete?: string;
	client_editable?: string;
	namespaces?: string;
	instance_xmlns?: string;
	entity_version?: string;
	[key: string]: unknown;
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
	_translations: Record<string, Record<string, Record<string, unknown>>>;
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
		this.choices = null;
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
		this.prefix = (data.prefix as string) ?? null;
		this.delimiter = (data.delimiter as string) ?? null;
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
	toJsonDict(deleteKeys?: Set<string>): Record<string, unknown> {
		const toDelete = new Set<string>(deleteKeys ?? []);
		// Delete all keys starting with _
		for (const k of Object.keys(this)) {
			if (k.startsWith("_")) {
				toDelete.add(k);
			}
		}
		return super.toJsonDict(toDelete);
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
	 * Resolve a ${ref} to its XPath, handling last-saved references.
	 * Returns the XPath string wrapped with spaces.
	 */
	private resolveRef(
		refName: string,
		options: { useAbsolute?: boolean; context?: SurveyElement },
	): string {
		let name = refName;
		let lastSaved = false;
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
		if (options.useAbsolute) {
			return ` ${element.getXpath()} `;
		}
		const xpath = element.getXpath();
		if (options.context) {
			const resolved = this.getPathRelativeToLcar(
				options.context,
				element,
				xpath,
			);
			return ` ${resolved} `;
		}
		return ` ${xpath} `;
	}

	/**
	 * Pre-process indexed-repeat calls, resolving ${ref} args with
	 * position-dependent absolute/relative paths.
	 */
	private processIndexedRepeats(text: string, context: SurveyElement): string {
		const indexedRepeatRegex = /indexed-repeat\s*\(/g;
		const irMatches: { start: number; end: number; argsStart: number }[] = [];
		let irMatch: RegExpExecArray | null = indexedRepeatRegex.exec(text);
		while (irMatch !== null) {
			const startPos = irMatch.index;
			const argsStart = startPos + irMatch[0].length;
			let depth = 1;
			let pos = argsStart;
			while (pos < text.length && depth > 0) {
				if (text[pos] === "(") {
					depth++;
				} else if (text[pos] === ")") {
					depth--;
				}
				pos++;
			}
			irMatches.push({ start: startPos, end: pos, argsStart });
			irMatch = indexedRepeatRegex.exec(text);
		}

		let processed = text;
		for (let i = irMatches.length - 1; i >= 0; i--) {
			const { start, end, argsStart } = irMatches[i];
			const prefix = text.substring(start, argsStart);
			const argsStr = text.substring(argsStart, end - 1);
			const suffix = text.substring(end - 1, end);
			const args = splitTopLevelArgs(argsStr);

			const processedArgs = args.map((arg, idx) => {
				const useAbsolute =
					idx === 0 || idx === 1 || (idx >= 3 && idx % 2 === 1);
				RE_PYXFORM_REF.lastIndex = 0;
				return arg.replace(RE_PYXFORM_REF, (_match, refName: string) =>
					this.resolveRef(refName, {
						useAbsolute,
						context: useAbsolute ? undefined : context,
					}),
				);
			});

			const replaced = prefix + processedArgs.join(",") + suffix;
			processed =
				processed.substring(0, start) + replaced + processed.substring(end);
		}
		return processed;
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
		if (!text || typeof text !== "string") {
			return text;
		}

		const processed = this.processIndexedRepeats(text, context);

		const contextInRepeat = this.getRepeatAncestors(context).length > 0;

		RE_PYXFORM_REF.lastIndex = 0;
		return processed.replace(
			RE_PYXFORM_REF,
			(_match, refName: string, offset: number) => {
				const resolved = this.resolveRefForXpath(
					refName,
					context,
					processed,
					offset,
					useCurrent,
					referenceParent,
					contextInRepeat,
				);
				return resolved;
			},
		);
	}

	/**
	 * Resolve a single ${ref} in the main (non-indexed-repeat) pass,
	 * handling current() wrapping for predicates in repeats.
	 */
	private resolveRefForXpath(
		refName: string,
		context: SurveyElement,
		processed: string,
		offset: number,
		useCurrent: boolean,
		referenceParent: boolean,
		contextInRepeat: boolean,
	): string {
		let name = refName;
		let lastSaved = false;
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

		let shouldUseCurrent = useCurrent;
		if (!shouldUseCurrent && contextInRepeat && !referenceParent) {
			shouldUseCurrent = this.isRefInPredicate(processed, offset);
		}

		if (shouldUseCurrent) {
			const resolved = this.getPathRelativeToLcar(context, element, xpath);
			return resolved !== xpath ? ` current()/${resolved} ` : ` ${xpath} `;
		}

		const resolved = this.getPathRelativeToLcar(context, element, xpath);
		return ` ${resolved} `;
	}

	/**
	 * Get path relative to Lowest Common Ancestor Repeat.
	 */
	getPathRelativeToLcar(
		context: SurveyElement,
		target: SurveyElement,
		xpath: string,
	): string {
		const lcar = this.findLowestCommonRepeat(context, target);
		if (!lcar) {
			return xpath;
		}
		return computeRelativePath(context.getXpath(), target.getXpath());
	}

	/**
	 * Find the lowest common ancestor repeat between two elements, or null.
	 */
	private findLowestCommonRepeat(
		a: SurveyElement,
		b: SurveyElement,
	): SurveyElement | null {
		const aRepeats = this.getRepeatAncestors(a);
		const bRepeats = this.getRepeatAncestors(b);
		if (aRepeats.length === 0 && bRepeats.length === 0) {
			return null;
		}
		const bSet = new Set(bRepeats);
		for (const r of aRepeats) {
			if (bSet.has(r)) {
				return r;
			}
		}
		return null;
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
		const lastBracketStart = findOutermostOpenBracket(text, offset);
		if (lastBracketStart < 0) {
			return false;
		}

		const beforeBracket = text.substring(0, lastBracketStart);
		if (isInstancePath(beforeBracket)) {
			return true;
		}
		if (isLiteralAbsolutePath(beforeBracket)) {
			return true;
		}

		// Check for chained predicates: walk back past ][...] pairs to find the base path
		const basePos = walkBackPastPredicates(text, lastBracketStart);
		if (basePos < lastBracketStart) {
			return isInstancePath(text.substring(0, basePos));
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
		if (!text || typeof text !== "string") {
			return { text: text ?? "", hasOutput: false };
		}
		const hasPyxform = hasPyxformReference(text);
		const hasInstance = /instance\s*\(/.test(text);
		if (!(hasPyxform || hasInstance)) {
			return { text, hasOutput: false };
		}

		// First, handle instance() expressions: find them, replace ${ref} inside
		// with just the xpath, then wrap the whole expression in <output value="..."/>.
		let processed = this._replaceInstanceExpressionsWithOutput(text, context);

		// Then handle any remaining ${ref} outside instance() expressions.
		RE_PYXFORM_REF.lastIndex = 0;
		processed = processed.replace(RE_PYXFORM_REF, (_match, refName: string) => {
			const xpath = this._resolveRef(refName, context);
			if (xpath === null) {
				return _match;
			}
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
		if (boundaries.length === 0) {
			return text;
		}

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
					if (xpath === null) {
						return _match;
					}
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
		const translations: TranslationsMap = {};
		this._translationContexts = {};

		this.collectElementTranslations(translations);
		this.collectChoiceTranslations(translations);
		this.processSearchAppearances();

		this._translations = translations;
		this._addEmptyTranslations();
	}

	/**
	 * Collect translations from all descendant survey elements.
	 */
	private collectElementTranslations(translations: TranslationsMap): void {
		for (const element of this.iterDescendants()) {
			for (const t of element.getTranslations(this.default_language)) {
				const lang = t.lang as string;
				const path = t.path as string;
				ensureTranslationPath(translations, lang, path);

				if (t.output_context) {
					this._translationContexts[path] = t.output_context as SurveyElement;
				}

				const displayElement = t.display_element as string | undefined;
				if (displayElement) {
					translations[lang][path][displayElement] = t.text;
				} else {
					translations[lang][path].text = t.text;
				}
			}
		}
	}

	/**
	 * Collect translations from choice list options (labels and media).
	 */
	private collectChoiceTranslations(translations: TranslationsMap): void {
		if (!this.choices) {
			return;
		}

		for (const [listName, itemset] of Object.entries(this.choices)) {
			if (!itemset.requires_itext) {
				continue;
			}

			for (let optIdx = 0; optIdx < itemset.options.length; optIdx++) {
				const option = itemset.options[optIdx];
				const itextId = `${listName}-${optIdx}`;
				this.collectOptionLabel(translations, option, itextId);
				this.collectOptionMedia(translations, option, itextId);
			}
		}
	}

	private collectOptionLabel(
		translations: TranslationsMap,
		option: { label?: unknown; media?: unknown },
		itextId: string,
	): void {
		if (typeof option.label === "object" && option.label !== null) {
			for (const [lang, text] of Object.entries(option.label)) {
				ensureTranslationPath(translations, lang, itextId);
				translations[lang][itextId].label = text;
			}
		} else if (option.label) {
			ensureTranslationPath(translations, this.default_language, itextId);
			translations[this.default_language][itextId].label = option.label;
		}
	}

	private collectOptionMedia(
		translations: TranslationsMap,
		option: { label?: unknown; media?: unknown },
		itextId: string,
	): void {
		if (!option.media) {
			return;
		}
		for (const [mediaType, mediaValue] of Object.entries(
			option.media as Record<string, unknown>,
		)) {
			if (typeof mediaValue === "object" && mediaValue !== null) {
				for (const [lang, text] of Object.entries(mediaValue)) {
					ensureTranslationPath(translations, lang, itextId);
					translations[lang][itextId][mediaType] = text;
				}
			} else {
				ensureTranslationPath(translations, this.default_language, itextId);
				translations[this.default_language][itextId][mediaType] = mediaValue;
			}
		}
	}

	/**
	 * Process search() appearances and validate no conflicts with non-search selects.
	 */
	private processSearchAppearances(): void {
		const searchLists = new Set<string>();
		const nonSearchLists = new Set<string>();

		for (const element of this.iterDescendants()) {
			if (!(element instanceof MultipleChoiceQuestion)) {
				continue;
			}
			const selectRef = `${element.name}|${element.list_name}`;
			if (this._redirectIsSearchItext(element)) {
				searchLists.add(selectRef);
			} else {
				nonSearchLists.add(selectRef);
			}
		}

		this.validateNoSearchConflicts(searchLists, nonSearchLists);
	}

	private validateNoSearchConflicts(
		searchLists: Set<string>,
		nonSearchLists: Set<string>,
	): void {
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
	}

	/**
	 * For selects using the "search()" function, redirect itext for in-line items.
	 * Clears element.itemset so inline items are rendered instead of itemset references.
	 */
	private _redirectIsSearchItext(element: MultipleChoiceQuestion): boolean {
		if (!this.hasSearchAppearance(element)) {
			return false;
		}

		this.validateNotSelectFromFile(element);

		let choices: Itemset | null = this.choices?.[element.itemset ?? ""] ?? null;
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

		return true;
	}

	private hasSearchAppearance(element: MultipleChoiceQuestion): boolean {
		try {
			const appearance = element.control?.[constants.APPEARANCE] as
				| string
				| undefined;
			return Boolean(
				appearance &&
					appearance.length > 7 &&
					SEARCH_FUNCTION_REGEX.test(appearance),
			);
		} catch {
			return false;
		}
	}

	private validateNotSelectFromFile(element: MultipleChoiceQuestion): void {
		const itemsetStr = element.itemset ?? "";
		const dotIdx = itemsetStr.lastIndexOf(".");
		if (dotIdx < 0) {
			return;
		}
		const ext = itemsetStr.substring(dotIdx);
		if (ext && constants.EXTERNAL_INSTANCE_EXTENSIONS.has(ext)) {
			throw new PyXFormError(
				`Question '${element.name}' is a select from file type, using 'search()'. This combination is not supported. Remove the 'search()' usage, or change the select type.`,
			);
		}
	}

	/**
	 * Add placeholder translations so that every itext element has the same elements
	 * across every language. When translations are not provided, "-" will be used.
	 * This matches Python pyxform's _add_empty_translations behavior.
	 */
	private _addEmptyTranslations(): void {
		const paths = this.collectAllTranslationPaths();
		this.fillMissingTranslations(paths);
	}

	private collectAllTranslationPaths(): Record<string, Set<string>> {
		const paths: Record<string, Set<string>> = {};
		for (const translation of Object.values(this._translations)) {
			for (const [path, content] of Object.entries(translation)) {
				if (!paths[path]) {
					paths[path] = new Set<string>();
				}
				if (typeof content === "object" && content !== null) {
					for (const key of Object.keys(content)) {
						paths[path].add(key);
					}
				}
			}
		}
		return paths;
	}

	private fillMissingTranslations(paths: Record<string, Set<string>>): void {
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
		if (languages.length === 0) {
			return null;
		}

		const translationElements: Element[] = [];

		for (const lang of languages) {
			const textElements = this.buildItextForLanguage(lang);
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

		if (translationElements.length === 0) {
			return null;
		}

		return node("itext", { children: translationElements });
	}

	private buildItextForLanguage(lang: string): Element[] {
		const items = this._translations[lang] as Record<
			string,
			Record<string, string>
		>;
		const textElements: Element[] = [];

		for (const [path, forms] of Object.entries(items)) {
			const valueElements = this.buildItextValues(path, forms);
			if (valueElements.length > 0) {
				textElements.push(
					node("text", { children: valueElements, attrs: { id: path } }),
				);
			}
		}

		return textElements;
	}

	private buildItextValues(
		path: string,
		forms: Record<string, string>,
	): Element[] {
		const valueElements: Element[] = [];
		for (const [form, text] of Object.entries(forms)) {
			const valueNode = this.buildItextValueNode(path, form, text);
			if (valueNode) {
				valueElements.push(valueNode);
			}
		}
		return valueElements;
	}

	private buildItextValueNode(
		path: string,
		form: string,
		text: string,
	): Element | null {
		const textForms = new Set(["label", "hint", "guidance_hint", "text"]);
		const mediaForms = new Set(["image", "big-image", "audio", "video"]);

		if (textForms.has(form)) {
			return this.buildTextValueNode(path, form, text);
		}
		if (mediaForms.has(form)) {
			return this.buildMediaValueNode(path, form, text);
		}
		return null;
	}

	private buildTextValueNode(
		path: string,
		form: string,
		text: string,
	): Element {
		const formAttr = form === "guidance_hint" ? "guidance" : undefined;
		const outputContext = this._translationContexts[path] ?? this;
		const { text: processedText, hasOutput } = this.insertOutputValues(
			String(text),
			outputContext,
		);
		const attrs = formAttr ? { form: formAttr } : undefined;
		return node("value", {
			text: processedText,
			attrs,
			toParseString: hasOutput,
		});
	}

	private buildMediaValueNode(
		path: string,
		form: string,
		text: string,
	): Element | null {
		if (String(text) === "-") {
			return null;
		}
		const mediaRef = this.resolveMediaRef(form, text);
		const outputContext = this._translationContexts[path] ?? this;
		const { text: resolvedText, hasOutput } = this.insertOutputValues(
			mediaRef,
			outputContext,
		);
		return node("value", {
			text: resolvedText,
			toParseString: hasOutput,
			attrs: { form },
		});
	}

	private resolveMediaRef(form: string, text: string): string {
		if (String(text).startsWith("jr://")) {
			return String(text);
		}
		const jrPrefix =
			form === "audio"
				? "jr://audio/"
				: form === "video"
					? "jr://video/"
					: "jr://images/";
		return `${jrPrefix}${text}`;
	}

	/**
	 * Generate the main XML instance.
	 */
	private xmlMainInstance(): Element {
		const instanceChildren = this.buildInstanceChildren();
		const dataAttrs = this.buildMainInstanceAttrs();

		const dataNode = node(this.name, {
			children: instanceChildren,
			attrs: dataAttrs,
		});

		return node("instance", { children: [dataNode] });
	}

	private buildInstanceChildren(): Element[] {
		const children: Element[] = [];
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
					children.push(repeatingTemplate);
					appendTemplate = false;
				}
				children.push(childInstance);
			}
		}
		return children;
	}

	private buildMainInstanceAttrs(): Record<string, string> {
		const attrs: Record<string, string> = {
			id: this.id_string || this.name,
		};
		if (this.version) {
			attrs.version = this.version;
		}
		if (this.instance_xmlns) {
			attrs.xmlns = this.instance_xmlns;
		}
		if (this.prefix) {
			attrs["odk:prefix"] = this.prefix;
		}
		if (this.delimiter) {
			attrs["odk:delimiter"] = this.delimiter;
		}
		for (const [k, v] of Object.entries(this._settingsAttributes)) {
			attrs[k] = v;
		}
		return attrs;
	}

	/**
	 * Generate static instances for choice lists.
	 */
	private *xmlStaticInstances(): Generator<Element> {
		if (!this.choices) {
			return;
		}

		for (const [listName, itemset] of Object.entries(this.choices)) {
			if (itemset.used_by_search) {
				continue;
			}
			yield this.buildStaticInstance(listName, itemset);
		}
	}

	private buildStaticInstance(listName: string, itemset: Itemset): Element {
		const itemNodes: Element[] = [];
		for (let optIdx = 0; optIdx < itemset.options.length; optIdx++) {
			itemNodes.push(this.buildOptionItemNode(listName, itemset, optIdx));
		}
		const rootNode = node("root", { children: itemNodes });
		return node("instance", {
			children: [rootNode],
			attrs: { id: listName },
		});
	}

	private buildOptionItemNode(
		listName: string,
		itemset: Itemset,
		optIdx: number,
	): Element {
		const option = itemset.options[optIdx];
		const children: Element[] = [
			node(constants.DEFAULT_ITEMSET_VALUE_REF, { text: option.name }),
		];

		if (itemset.requires_itext) {
			children.push(node("itextId", { text: `${listName}-${optIdx}` }));
		} else if (typeof option.label === "string") {
			children.push(
				node(constants.DEFAULT_ITEMSET_LABEL_REF, { text: option.label }),
			);
		}

		if (option.extra_data && typeof option.extra_data === "object") {
			for (const [k, v] of Object.entries(option.extra_data)) {
				if (v != null) {
					children.push(node(k, { text: String(v) }));
				}
			}
		}

		return node("item", { children });
	}

	/**
	 * Generate all bind elements.
	 */
	private *xmlBinds(): Generator<Element> {
		for (const element of this.iterDescendants()) {
			if (element === this) {
				continue;
			}
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
				if (Symbol.iterator in new Object(control)) {
					for (const c of control as Iterable<Element>) {
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
			if (element === this) {
				continue;
			}
			const context = this.getElementContext(element);
			this.collectExternalTypeInstances(element, context, instances);
			this.collectFileSelectInstances(element, context, instances);
			this.collectPulldataFromElement(element, context, instances);
			this.collectEntityDatasetInstances(element, context, instances);
		}

		return instances;
	}

	private collectExternalTypeInstances(
		element: SurveyElement,
		context: string,
		instances: ExternalInstanceInfo[],
	): void {
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
	}

	private collectFileSelectInstances(
		element: SurveyElement,
		context: string,
		instances: ExternalInstanceInfo[],
	): void {
		if (!(element instanceof MultipleChoiceQuestion && element.itemset)) {
			return;
		}
		const dotIdx = element.itemset.lastIndexOf(".");
		if (dotIdx < 0) {
			return;
		}
		const fileExtension = element.itemset.substring(dotIdx);
		if (!constants.EXTERNAL_INSTANCE_EXTENSIONS.has(fileExtension)) {
			return;
		}
		const itemsetName = element.itemset.substring(0, dotIdx);
		const filePrefix = fileExtension === ".csv" ? "file-csv" : "file";
		instances.push({
			id: itemsetName,
			src: `jr://${filePrefix}/${itemsetName}${fileExtension}`,
			type: "file",
			context,
		});
	}

	private collectPulldataFromElement(
		element: SurveyElement,
		context: string,
		instances: ExternalInstanceInfo[],
	): void {
		if (element.bind) {
			for (const attr of [
				"calculate",
				"constraint",
				"readonly",
				"required",
				"relevant",
			]) {
				const value = element.bind[attr];
				if (typeof value === "string" && value.includes("pulldata")) {
					instances.push(...this.extractPulldataInstances(value, context));
				}
			}
		}
		if ("choice_filter" in element) {
			const cf = (element as unknown as { choice_filter: string })
				.choice_filter;
			if (typeof cf === "string" && cf.includes("pulldata")) {
				instances.push(...this.extractPulldataInstances(cf, context));
			}
		}
		if (
			element.default &&
			typeof element.default === "string" &&
			element.default.includes("pulldata")
		) {
			instances.push(
				...this.extractPulldataInstances(element.default, context),
			);
		}
	}

	private collectEntityDatasetInstances(
		element: SurveyElement,
		context: string,
		instances: ExternalInstanceInfo[],
	): void {
		if (element.type !== "entity" || !element.extra_data?._entity_children) {
			return;
		}
		const entityChildren = element.extra_data._entity_children as Record<
			string,
			unknown
		>[];
		for (const child of entityChildren) {
			const childBind = child[constants.BIND] as
				| Record<string, string>
				| undefined;
			if (child[constants.NAME] !== "baseVersion" || !childBind?.calculate) {
				continue;
			}
			const instanceMatch = childBind.calculate.match(
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

	/**
	 * Validate and deduplicate external instances, then generate instance elements.
	 * Same id + same src is allowed (deduplicated).
	 * Same id + different src is an error.
	 */
	private xmlExternalInstances(): Element[] {
		const allInstances = this.collectExternalInstances();
		this.validateExternalDeclUniqueness(allInstances);
		const seen = this.deduplicateInstances(allInstances);
		this.checkChoiceInstanceConflicts(seen);

		const result: Element[] = [];
		for (const inst of seen.values()) {
			result.push(node("instance", { attrs: { id: inst.id, src: inst.src } }));
		}
		return result;
	}

	private validateExternalDeclUniqueness(
		allInstances: ExternalInstanceInfo[],
	): void {
		const counts = new Map<string, number>();
		for (const inst of allInstances) {
			if (inst.type === "external") {
				counts.set(inst.id, (counts.get(inst.id) ?? 0) + 1);
			}
		}
		for (const [id, count] of counts) {
			if (count > 1) {
				throw new PyXFormError(
					`Instance names must be unique. The name '${id}' was found ${count} time(s) in the 'survey' sheet.`,
				);
			}
		}
	}

	private deduplicateInstances(
		allInstances: ExternalInstanceInfo[],
	): Map<string, ExternalInstanceInfo> {
		const seen = new Map<string, ExternalInstanceInfo>();
		for (const inst of allInstances) {
			const existing = seen.get(inst.id);
			if (existing) {
				if (existing.src !== inst.src) {
					throw new PyXFormError(
						`Instance name: '${inst.id}', ` +
							`Existing type: '${existing.type}', Existing URI: '${existing.src}', ` +
							`Duplicate type: '${inst.type}', Duplicate URI: '${inst.src}', ` +
							`Duplicate context: '${inst.context}'.`,
					);
				}
				continue;
			}
			seen.set(inst.id, inst);
		}
		return seen;
	}

	private checkChoiceInstanceConflicts(
		seen: Map<string, ExternalInstanceInfo>,
	): void {
		if (!this.choices) {
			return;
		}
		for (const [listName, itemset] of Object.entries(this.choices)) {
			if (itemset.used_by_search) {
				continue;
			}
			const ext = seen.get(listName);
			if (ext) {
				throw new PyXFormError(
					`Instance name: '${listName}', Existing type: '${ext.type}', Existing URI: '${ext.src}', Duplicate type: 'choice', Duplicate URI: 'None', Duplicate context: 'survey'.`,
				);
			}
		}
	}

	/** Build and append the submission element if any submission attributes are set. */
	private addSubmissionElement(modelChildren: Element[]): void {
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
	}

	/** Add setvalue, setgeopoint, action, and entity setvalue elements to model. */
	private addModelSetvalues(modelChildren: Element[]): void {
		for (const element of this.iterDescendants()) {
			if (element === this) {
				continue;
			}
			this.addDynamicDefault(element, modelChildren);
			this.addSetGeopoint(element, modelChildren);
			this.addModelActions(element, modelChildren);
			this.addEntitySetvalues(element, modelChildren);
		}
	}

	private addDynamicDefault(
		element: SurveyElement,
		modelChildren: Element[],
	): void {
		if (!element.default || typeof element.default !== "string") {
			return;
		}
		if (!defaultIsDynamic(element.default, element.type)) {
			return;
		}
		const value = this.insertXpaths(element.default, element);
		modelChildren.push(
			node("setvalue", {
				attrs: {
					event: "odk-instance-first-load",
					ref: element.getXpath(),
					value,
				},
			}),
		);
	}

	private addSetGeopoint(
		element: SurveyElement,
		modelChildren: Element[],
	): void {
		if (element.type !== "start-geopoint") {
			return;
		}
		modelChildren.push(
			node("odk:setgeopoint", {
				attrs: {
					event: "odk-instance-first-load",
					ref: element.getXpath(),
				},
			}),
		);
	}

	private addModelActions(
		element: SurveyElement,
		modelChildren: Element[],
	): void {
		if (
			!(
				"actions" in element &&
				(element as unknown as { actions: unknown }).actions
			)
		) {
			return;
		}
		const actions = (
			element as unknown as { actions: Record<string, string>[] }
		).actions;
		for (const action of actions) {
			// Only emit model-level actions (not odk-new-repeat which goes in body)
			if (action.event === "odk-new-repeat") {
				continue;
			}
			const actionAttrs: Record<string, string> = {
				event: action.event,
				ref: element.getXpath(),
			};
			for (const [k, v] of Object.entries(action)) {
				if (k !== "name" && k !== "event" && k !== "value") {
					actionAttrs[k] = v;
				}
			}
			if (action.value) {
				actionAttrs.value = this.insertXpaths(action.value, element);
			}
			modelChildren.push(node(action.name, { attrs: actionAttrs }));
		}
	}

	private addEntitySetvalues(
		element: SurveyElement,
		modelChildren: Element[],
	): void {
		if (element.type !== "entity") {
			return;
		}
		for (const sv of element.getEntitySetvalues()) {
			if (sv.event !== "odk-instance-first-load") {
				continue;
			}
			modelChildren.push(
				node("setvalue", {
					attrs: { event: sv.event, ref: sv.ref, value: sv.value },
				}),
			);
		}
	}

	/** Add __last-saved instance if any expression referenced last-saved#. */
	private addLastSavedInstance(modelChildren: Element[]): void {
		if (!this._hasLastSavedReference) {
			return;
		}
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
			return;
		}
		const mainInstanceIndex = modelChildren.findIndex(
			(el) => el.tagName === "instance" && !el.getAttribute("id"),
		);
		const lastSavedInstance = node("instance", {
			attrs: { id: "__last-saved", src: "jr://instance/last-saved" },
		});
		modelChildren.splice(mainInstanceIndex + 1, 0, lastSavedInstance);
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
		if (itext) {
			modelChildren.push(itext);
		}

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
		this.addSubmissionElement(modelChildren);

		// Binds
		for (const bind of this.xmlBinds()) {
			modelChildren.push(bind);
		}

		// Setvalue elements for dynamic defaults, setgeopoint, actions, and entity setvalues
		this.addModelSetvalues(modelChildren);

		// Body (generate before finalizing model, so labels can set _hasLastSavedReference)
		const bodyNode = this.xmlBody();

		// Add __last-saved instance if any expression referenced last-saved#
		this.addLastSavedInstance(modelChildren);

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

	xmlInstance_forSurvey(_survey: Survey): Element {
		return this.xmlMainInstance();
	}

	*xmlBindings(_survey: Survey): Generator<Element> {
		// Survey root doesn't generate its own bind
	}
}
