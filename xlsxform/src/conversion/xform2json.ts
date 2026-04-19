/**
 * xform2json module - Transform an XForm to a JSON dictionary.
 * Port of pyxform/xform2json.py.
 */

import { DOMParser } from "@xmldom/xmldom";
import type { DOMParserOptions } from "@xmldom/xmldom";
import { NSMAP } from "../constants.js";
import { PyXFormError } from "../errors.js";
import { createSurveyElementFromDict } from "../model/builder.js";
import type { Survey } from "../model/survey.js";

const QUESTION_TYPES: Record<string, string> = {
	select: "select all that apply",
	select1: "select one",
	int: "integer",
	dateTime: "datetime",
	string: "text",
};

/**
 * Try to parse the root from an XML string.
 * Returns the root Element of the parsed XML document.
 */
export function _tryParse(root: string): Element {
	const parseErrors: string[] = [];
	const onError = (_level: string, msg: string) => {
		parseErrors.push(msg);
	};
	const parser = new DOMParser({ onError } as DOMParserOptions);

	try {
		const doc = parser.parseFromString(root, "text/xml");
		const docEl = doc?.documentElement;
		if (docEl && parseErrors.length === 0 && docEl.nodeName !== "parsererror") {
			return docEl as unknown as Element;
		}
	} catch (_e) {
		// Fall through to error
	}

	throw new IOError("Could not parse XML string.");
}

export class IOError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "IOError";
	}
}

export class XMLParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "XMLParseError";
	}
}

interface XmlDict {
	[key: string]: XmlDictValue;
}

type XmlDictValue = string | XmlDict | XmlDictValue[];

/**
 * Add a child's converted value into the nodedict, handling duplicate tags by
 * converting to arrays.
 */
function _addChildToDict(
	nodedict: XmlDict,
	tag: string,
	newitem: XmlDict | string,
): void {
	if (tag in nodedict) {
		if (Array.isArray(nodedict[tag])) {
			(nodedict[tag] as XmlDictValue[]).push(newitem);
		} else {
			nodedict[tag] = [nodedict[tag], newitem];
		}
	} else {
		nodedict[tag] = newitem;
	}
}

function _convertXmlToDictRecurse(node: Element): XmlDict | string {
	const nodedict: XmlDict = {};

	// Set attributes
	if (node.attributes) {
		for (const attr of Array.from(node.attributes)) {
			nodedict[attr.name] = attr.value;
		}
	}

	// Recursively add children
	for (const child of _getChildElements(node)) {
		const newitem: XmlDict | string = _convertXmlToDictRecurse(child);
		const tailText = _getTailText(child, node);
		if (tailText && typeof newitem === "object") {
			newitem.tail = tailText;
		}
		_addChildToDict(nodedict, child.nodeName, newitem);
	}

	const text = _getDirectText(node).trim();

	if (Object.keys(nodedict).length > 0) {
		if (text.length > 0) {
			nodedict._text = text;
		}
		return nodedict;
	}

	return text;
}

/**
 * Get child elements (not text nodes) of a node.
 */
function _getChildElements(node: Element): Element[] {
	const elements: Element[] = [];
	for (const child of Array.from(node.childNodes)) {
		if (child.nodeType === 1) {
			elements.push(child as Element);
		}
	}
	return elements;
}

/**
 * Get direct text content of a node (not from children).
 */
function _getDirectText(node: Element): string {
	let text = "";
	for (const child of Array.from(node.childNodes)) {
		if (child.nodeType === 3) {
			text += child.nodeValue ?? "";
		}
	}
	return text;
}

/**
 * Get text that follows a child element (tail text in Python's ElementTree).
 */
function _getTailText(child: Element, parent: Element): string | null {
	let foundChild = false;
	let tail = "";
	for (const n of Array.from(parent.childNodes)) {
		if (n === child) {
			foundChild = true;
			continue;
		}
		if (foundChild) {
			if (n.nodeType === 3) {
				tail += n.nodeValue ?? "";
			} else {
				break;
			}
		}
	}
	return tail.trim() !== "" ? tail : null;
}

class XFormToDict {
	private _root: Element;
	private _dict: XmlDict;

	constructor(root: string) {
		this._root = _tryParse(root);
		this._dict = {
			[this._root.nodeName]: _convertXmlToDictRecurse(this._root),
		};
	}

	getDict(): Record<string, unknown> {
		let jsonStr = JSON.stringify(this._dict);
		for (const uri of Object.values(NSMAP)) {
			// Remove namespace URIs wrapped in curly braces
			jsonStr = jsonStr.split(`{${uri}}`).join("");
		}
		// Also remove namespace prefixes in tag names (e.g. "h:html" -> "html")
		return JSON.parse(jsonStr);
	}
}

export function createSurveyElementFromXml(xmlFile: string): Survey {
	const sb = new XFormToDictBuilder(xmlFile);
	return sb.survey();
}

/** Binding keys that should be placed under the `bind` sub-object. */
const BIND_KEYS = new Set([
	"relevant",
	"required",
	"constraint",
	"constraintMsg",
	"readonly",
	"calculate",
	"noAppErrorString",
	"requiredMsg",
]);

/** Keys that need their xpath expressions shortened. */
const XPATH_BIND_KEYS = new Set(["constraint", "relevant", "calculate"]);

/** Map of binding key renames. */
const BIND_KEY_RENAMES: Record<string, string> = {
	noAppErrorString: "jr:noAppErrorString",
	requiredMsg: "jr:requiredMsg",
	constraintMsg: "jr:constraintMsg",
};

/**
 * Strip a media resource path from its jr:// prefix.
 */
function _stripMediaPath(form: string, path: string): string {
	if (form === "image") {
		return path.replace("jr://images/", "");
	}
	return path.replace(`jr://${form}/`, "");
}

class XFormToDictBuilder {
	private _xmldict: Record<string, unknown>;
	private body: Record<string, unknown>;
	private model: Record<string, unknown>;
	private bindings: Record<string, unknown>[];
	private _bindList: Record<string, unknown>[];
	private title: string;
	private secondaryInstances: Record<string, unknown>[];
	private translations: Record<string, unknown>[];
	private choices: Record<string, unknown>;
	private newDoc: Record<string, unknown>;
	private children: Record<string, unknown>[];
	private orderedBindingRefs: string[];

	constructor(xmlFile: string) {
		const docAsDict = new XFormToDict(xmlFile).getDict();
		this._xmldict = docAsDict;

		// Strip namespace prefixes from top-level keys
		const doc = this._stripNsPrefixes(docAsDict) as Record<string, unknown>;

		if (!("html" in doc)) {
			throw new PyXFormError("Invalid value for `doc_as_dict`.");
		}
		const html = doc.html as Record<string, unknown>;
		if (!("body" in html)) {
			throw new PyXFormError("Invalid value for `doc_as_dict`.");
		}
		if (!("head" in html)) {
			throw new PyXFormError("Invalid value for `doc_as_dict`.");
		}
		const head = html.head as Record<string, unknown>;
		if (!("model" in head)) {
			throw new PyXFormError("Invalid value for `doc_as_dict`.");
		}
		if (!("title" in head)) {
			throw new PyXFormError("Invalid value for `doc_as_dict`.");
		}
		const model = head.model as Record<string, unknown>;
		if (!("bind" in model)) {
			throw new PyXFormError("Invalid value for `doc_as_dict`.");
		}

		this.body = html.body as Record<string, unknown>;
		this.model = model;
		this.bindings = JSON.parse(JSON.stringify(this.model.bind));
		if (!Array.isArray(this.bindings)) {
			this.bindings = [this.bindings];
		}
		this._bindList = JSON.parse(JSON.stringify(this.bindings));
		this.title = head.title as string;

		let secondary: Record<string, unknown>[] = [];
		if (Array.isArray(this.model.instance)) {
			secondary = this.model.instance.slice(1);
		}
		this.secondaryInstances = secondary;
		this.translations = this._getTranslations();
		this.choices = this._getChoices();
		this.newDoc = {
			type: "survey",
			title: this.title,
			children: [],
			id_string: this.title,
			sms_keyword: this.title,
			default_language: "default",
			choices: this.choices,
		};
		this._setSubmissionInfo();
		this._setSurveyName();
		this.children = [];
		this.orderedBindingRefs = [];
		this._setBindingOrder();

		for (const [key, obj] of Object.entries(this.body)) {
			if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
				this.children.push(
					this._getQuestionFromObject(obj as Record<string, unknown>, key),
				);
			} else if (Array.isArray(obj)) {
				for (const item of obj) {
					this.children.push(
						this._getQuestionFromObject(item as Record<string, unknown>, key),
					);
				}
			}
		}
		this._cleanupBindList();
		this._cleanupChildren();
		this.newDoc.children = this.children;
	}

	/**
	 * Strip namespace prefixes from keys recursively.
	 * E.g., "h:html" -> "html", "h:head" -> "head", "h:body" -> "body", "h:title" -> "title"
	 */
	private _stripNsPrefixes(obj: unknown): unknown {
		if (typeof obj !== "object" || obj === null) {
			return obj;
		}
		if (Array.isArray(obj)) {
			return obj.map((item) => this._stripNsPrefixes(item));
		}

		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
			const parts = key.split(":");
			const stripped = key.includes(":") ? (parts.pop() ?? key) : key;
			result[stripped] = this._stripNsPrefixes(value);
		}
		return result;
	}

	private _setBindingOrder(): void {
		this.orderedBindingRefs = [];
		for (const bind of this.bindings) {
			this.orderedBindingRefs.push(bind.nodeset as string);
		}
	}

	private _setSurveyName(): void {
		const name = (this.bindings[0].nodeset as string).split("/")[1];
		this.newDoc.name = name;
		const instances = this.model.instance;
		let idString: string;
		if (typeof instances === "object" && !Array.isArray(instances)) {
			const inst = instances as Record<string, unknown>;
			const instName = inst[name] as Record<string, unknown> | undefined;
			idString = (instName?.id as string) ?? this.title;
		} else if (Array.isArray(instances)) {
			const first = instances[0] as Record<string, unknown> | undefined;
			const firstName = first?.[name] as Record<string, unknown> | undefined;
			idString = (firstName?.id as string) ?? this.title;
		} else {
			throw new PyXFormError(
				`Unexpected type for model instances: ${typeof instances}`,
			);
		}
		this.newDoc.id_string = idString;
	}

	private _setSubmissionInfo(): void {
		if ("submission" in this.model) {
			const submission = this.model.submission as Record<string, unknown>;
			if ("action" in submission) {
				this.newDoc.submission_url = submission.action;
			}
			if ("base64RsaPublicKey" in submission) {
				this.newDoc.public_key = submission.base64RsaPublicKey;
			}
			if ("auto-send" in submission) {
				this.newDoc.auto_send = submission["auto-send"];
			}
			if ("auto-delete" in submission) {
				this.newDoc.auto_delete = submission["auto-delete"];
			}
		}
	}

	private _cleanupChildren(): void {
		const removeRefs = (children: Record<string, unknown>[]) => {
			for (const child of children) {
				if (typeof child === "object" && child !== null) {
					child.nodeset = undefined;
					child.ref = undefined;
					child.__order = undefined;
					if (child.children) {
						removeRefs(child.children as Record<string, unknown>[]);
					}
				}
			}
		};

		const orderChildren = (children: Record<string, unknown>[]) => {
			if (Array.isArray(children)) {
				try {
					children.sort(
						(a, b) =>
							((a.__order as number) ?? 0) - ((b.__order as number) ?? 0),
					);
				} catch (_e) {
					// ignore
				}
				for (const child of children) {
					if (typeof child === "object" && child !== null && child.children) {
						orderChildren(child.children as Record<string, unknown>[]);
					}
				}
			}
		};

		orderChildren(this.children);
		removeRefs(this.children);
	}

	/**
	 * Update or append a question within a parent's children array.
	 */
	private static _upsertChildQuestion(
		parent: Record<string, unknown>,
		question: Record<string, unknown>,
		ref: string,
	): void {
		const children = parent.children as Record<string, unknown>[] | undefined;
		if (children) {
			for (const c of children) {
				if (typeof c === "object" && c !== null && c.ref === ref) {
					Object.assign(c, question);
					return;
				}
			}
		}
		if (!parent.children) {
			parent.children = [];
		}
		(parent.children as Record<string, unknown>[]).push(question);
	}

	/**
	 * Try to attach a question to an existing child whose ref matches parentRef.
	 * Returns true if the question was attached.
	 */
	private _attachToParent(
		question: Record<string, unknown>,
		ref: string,
		parentRef: string,
	): boolean {
		for (const child of this.children) {
			if (child.ref !== parentRef) {
				continue;
			}
			question.ref = ref;
			XFormToDictBuilder._upsertChildQuestion(child, question, ref);
			return true;
		}
		return false;
	}

	/**
	 * Handle an orphan binding item that wasn't matched to any existing child.
	 * Creates a new group structure and adds it to children.
	 */
	private _handleOrphanBind(
		item: Record<string, unknown>,
		ref: string,
		question: Record<string, unknown>,
	): void {
		const newRef = ref.split("/").slice(2).join("/");
		const rootRef = ref.split("/").slice(0, 2).join("/");
		const q = this._getItemFunc(rootRef, newRef, item);
		if (!("type" in q) && "type" in question) {
			Object.assign(q, question);
		}
		if (q.type === "group" && q.name === "meta") {
			q.control = { bodyless: true };
			q.__order = this._getQuestionOrder(ref);
		}
		this.children.push(q);
		this._bindList.push(item);
	}

	private _cleanupBindList(): void {
		const toProcess = [...this._bindList];
		this._bindList = [];

		for (const item of toProcess) {
			const ref = item.nodeset as string;
			const name = XFormToDictBuilder._getNameFromRef(ref);
			const parentRef = ref.substring(0, ref.indexOf(`/${name}`));
			const question: Record<string, unknown> =
				this._getQuestionParamsFromBindings(ref) ?? {};
			question.name = name;
			question.__order = this._getQuestionOrder(ref);

			if ("calculate" in item) {
				question.type = "calculate";
			}
			if (ref.split("/").length === 3) {
				question.ref = ref;
				this.children.push(question);
				continue;
			}

			this._attachToParent(question, ref, parentRef);

			if (!("ref" in question)) {
				this._handleOrphanBind(item, ref, question);
				break;
			}
		}

		if (this._bindList.length > 0) {
			this._cleanupBindList();
		}
	}

	private _getItemFunc(
		ref: string,
		name: string,
		item: Record<string, unknown>,
	): Record<string, unknown> {
		const rs: Record<string, unknown> = {};
		const nameSplits = name.split("/");
		rs.name = nameSplits[0];
		const currentRef = `${ref}/${rs.name}`;
		rs.ref = currentRef;
		if (nameSplits.length > 1) {
			rs.type = "group";
			rs.children = [
				this._getItemFunc(currentRef, nameSplits.slice(1).join("/"), item),
			];
		}
		return rs;
	}

	survey(): Survey {
		const newDoc = JSON.stringify(this.newDoc);
		return createSurveyElementFromJson(newDoc);
	}

	private _getQuestionOrder(ref: string): number {
		const idx = this.orderedBindingRefs.indexOf(ref);
		if (idx !== -1) {
			return idx;
		}
		for (let i = 0; i < this.orderedBindingRefs.length; i++) {
			if (this.orderedBindingRefs[i].startsWith(ref)) {
				return i + 1;
			}
		}
		return this.orderedBindingRefs.length + 1;
	}

	/**
	 * Extract the ref from an object, checking for "ref" or "nodeset" keys.
	 */
	private static _extractRef(obj: Record<string, unknown>): string {
		if ("ref" in obj) {
			return obj.ref as string;
		}
		if ("nodeset" in obj) {
			return obj.nodeset as string;
		}
		throw new PyXFormError(
			`Cannot find "ref" or "nodeset" in ${JSON.stringify(obj)}`,
		);
	}

	/**
	 * Set control-related properties (appearance, rows, autoplay) on the question.
	 */
	private static _applyControlProps(
		question: Record<string, unknown>,
		obj: Record<string, unknown>,
	): void {
		if (
			"autoplay" in obj ||
			"appearance" in obj ||
			"count" in obj ||
			"rows" in obj
		) {
			question.control = {};
		}
		if ("appearance" in obj) {
			(question.control as Record<string, unknown>).appearance = obj.appearance;
		}
		if ("rows" in obj) {
			(question.control as Record<string, unknown>).rows = obj.rows;
		}
		if ("autoplay" in obj) {
			(question.control as Record<string, unknown>).autoplay = obj.autoplay;
		}
	}

	/**
	 * Build inline choice children from an object's "item" entries.
	 */
	private _buildInlineChoices(
		obj: Record<string, unknown>,
	): Record<string, unknown>[] {
		const children: Record<string, unknown>[] = [];
		const items = Array.isArray(obj.item) ? obj.item : [obj.item];
		for (const i of items) {
			if (
				typeof i === "object" &&
				i !== null &&
				"label" in (i as Record<string, unknown>) &&
				"value" in (i as Record<string, unknown>)
			) {
				const iObj = i as Record<string, unknown>;
				const [k, v] = this._getLabel(iObj.label);
				children.push({ name: iObj.value, [k]: v });
			}
		}
		return children;
	}

	/**
	 * Apply itemset (external choices) to the question from the object.
	 */
	private _applyItemset(
		question: Record<string, unknown>,
		obj: Record<string, unknown>,
	): void {
		const itemset = obj.itemset as Record<string, unknown>;
		const nodeset = itemset.nodeset as string;
		const choicesNameMatch = nodeset.match(/^instance\('(.*?)'\)/);
		if (!choicesNameMatch) {
			return;
		}
		const choicesName = choicesNameMatch[1];
		question.itemset = choicesName;
		question.list_name = choicesName;
		if (this.choices[choicesName as string]) {
			question.choices = this.choices[choicesName as string];
		}
		this._applyChoiceFilter(question, nodeset, choicesName as string);
	}

	/**
	 * Parse and apply a choice filter from the nodeset expression.
	 */
	private _applyChoiceFilter(
		question: Record<string, unknown>,
		nodeset: string,
		choicesName: string,
	): void {
		const filterRefRegex = new RegExp(`\\[ /${this.newDoc.name}/(.*?) `);
		const filterRefMatch = nodeset.match(filterRefRegex);
		if (!filterRefMatch) {
			return;
		}
		const filterRef = filterRefMatch[1];
		const escapedRef = (filterRef as string).replace(
			/[.*+?^${}()|[\]\\]/g,
			"\\$&",
		);
		const filterExpMatch = nodeset.match(new RegExp(`${escapedRef} (.*?)\\]$`));
		if (filterExpMatch) {
			question.choice_filter = `\${${filterRef}}${filterExpMatch[1]}`;
			question.query = choicesName;
		}
	}

	/**
	 * Apply hint and label from the XForm object to the question.
	 */
	private _applyHintAndLabel(
		question: Record<string, unknown>,
		obj: Record<string, unknown>,
	): void {
		if ("hint" in obj) {
			const [k, v] = this._getLabel(obj.hint, "hint");
			question[k] = v;
		}
		if ("label" in obj) {
			const [k, v] = this._getLabel(obj.label);
			if (
				typeof v === "object" &&
				v !== null &&
				"label" in (v as Record<string, unknown>) &&
				"media" in (v as Record<string, unknown>)
			) {
				Object.assign(question, v);
			} else {
				question[k] = v;
			}
		}
	}

	/**
	 * Promote a readonly text question to a note and clean up the bind.
	 */
	private static _promoteToNote(
		question: Record<string, unknown>,
	): string | undefined {
		const bind = question.bind as Record<string, unknown> | undefined;
		const questionType = question.type as string | undefined;
		if (questionType === "text" && bind && bind.readonly) {
			question.type = "note";
			bind.readonly = undefined;
			if (Object.keys(bind).length === 0) {
				question.bind = undefined;
			}
			return "note";
		}
		return questionType;
	}

	/**
	 * Apply group/repeat children and repeat count to the question.
	 */
	private _applyGroupOrRepeat(
		question: Record<string, unknown>,
		obj: Record<string, unknown>,
		questionType: string,
	): string {
		let resolvedType = questionType;
		if (questionType === "group" && "repeat" in obj) {
			question.children = this._getChildrenQuestions(
				obj.repeat as Record<string, unknown>,
			);
			resolvedType = "repeat";
			const repeat = obj.repeat as Record<string, unknown>;
			if ("count" in repeat) {
				if (!question.control) {
					question.control = {};
				}
				(question.control as Record<string, unknown>)["jr:count"] =
					XFormToDictBuilder._shortenXpathsInString(
						(repeat.count as string).trim(),
					);
			}
		} else {
			question.children = this._getChildrenQuestions(obj);
		}
		question.type = resolvedType;
		return resolvedType;
	}

	private _getQuestionFromObject(
		obj: Record<string, unknown>,
		type?: string,
	): Record<string, unknown> {
		const ref = XFormToDictBuilder._extractRef(obj);

		const question: Record<string, unknown> = {
			ref,
			__order: this._getQuestionOrder(ref),
			name: XFormToDictBuilder._getNameFromRef(ref),
		};

		this._applyHintAndLabel(question, obj);
		XFormToDictBuilder._applyControlProps(question, obj);

		const questionParams = this._getQuestionParamsFromBindings(ref);
		if (typeof questionParams === "object" && questionParams !== null) {
			Object.assign(question, questionParams);
		}

		if ("mediatype" in obj) {
			question.type = (obj.mediatype as string).replace("/*", "");
		}
		if ("item" in obj) {
			question.children = this._buildInlineChoices(obj);
		}

		let questionType = (question.type as string | undefined) ?? type;
		questionType = XFormToDictBuilder._promoteToNote(question) ?? questionType;

		if (questionType === "group" || questionType === "repeat") {
			questionType = this._applyGroupOrRepeat(question, obj, questionType);
		}

		this._resolveQuestionType(question, type, questionType);

		if ("itemset" in obj) {
			this._applyItemset(question, obj);
		}

		return question;
	}

	/**
	 * Resolve the final question type based on the XForm element type and current state.
	 */
	private _resolveQuestionType(
		question: Record<string, unknown>,
		type: string | undefined,
		questionType: string | undefined,
	): void {
		if (type === "trigger") {
			question.type = "acknowledge";
		}
		if (type === "select1" || type === "select") {
			question.type = QUESTION_TYPES[type];
		}
		if (questionType === "geopoint" && "hint" in question) {
			question.hint = undefined;
		}
		if (!("type" in question) && type) {
			question.type = questionType;
		}
	}

	private _getChildrenQuestions(
		obj: Record<string, unknown>,
	): Record<string, unknown>[] {
		const children: Record<string, unknown>[] = [];
		for (const [k, v] of Object.entries(obj)) {
			if (["ref", "label", "nodeset"].includes(k)) {
				continue;
			}
			if (typeof v === "object" && v !== null && !Array.isArray(v)) {
				children.push(
					this._getQuestionFromObject(v as Record<string, unknown>, k),
				);
			} else if (Array.isArray(v)) {
				for (const i of v) {
					children.push(
						this._getQuestionFromObject(i as Record<string, unknown>, k),
					);
				}
			}
		}
		return children;
	}

	/**
	 * Process a single binding entry key/value pair and place it into the result object.
	 */
	private _processBindingEntry(
		rs: Record<string, unknown>,
		key: string,
		val: unknown,
	): void {
		if (key === "nodeset") {
			return;
		}
		if (key === "type") {
			rs[key] = XFormToDictBuilder._getQuestionType(val as string);
			return;
		}
		if (BIND_KEYS.has(key)) {
			this._processBindKey(rs, key, val);
			return;
		}
		if (key === "preload" && val === "uid") {
			if (!rs.bind) {
				rs.bind = {};
			}
			(rs.bind as Record<string, unknown>)["jr:preload"] = val;
		}
		rs[key] = val;
	}

	/**
	 * Resolve the value for a binding key, applying transforms as needed.
	 */
	private _resolveBindValue(key: string, val: unknown): unknown {
		if (key === "constraintMsg") {
			return this._getConstraintMsg(val);
		}
		if (key === "required") {
			if (val === "true()") {
				return "yes";
			}
			if (val === "false()") {
				return "no";
			}
		}
		if (XPATH_BIND_KEYS.has(key)) {
			return XFormToDictBuilder._shortenXpathsInString(val as string);
		}
		return val;
	}

	/**
	 * Process a binding key that belongs in the bind sub-object.
	 */
	private _processBindKey(
		rs: Record<string, unknown>,
		key: string,
		val: unknown,
	): void {
		const bindKey = BIND_KEY_RENAMES[key] ?? key;
		const resolved = this._resolveBindValue(key, val);
		if (!rs.bind) {
			rs.bind = {};
		}
		(rs.bind as Record<string, unknown>)[bindKey] = resolved;
	}

	private _getQuestionParamsFromBindings(
		ref: string,
	): Record<string, unknown> | null {
		for (const item of this.bindings) {
			if (item.nodeset !== ref) {
				continue;
			}
			// Remove from bind list
			const idx = this._bindList.findIndex(
				(b) => JSON.stringify(b) === JSON.stringify(item),
			);
			if (idx !== -1) {
				this._bindList.splice(idx, 1);
			}

			const rs: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(item)) {
				this._processBindingEntry(rs, k, v);
			}
			if ("preloadParams" in rs && "preload" in rs) {
				rs.type = rs.preloadParams;
				rs.preloadParams = undefined;
				rs.preload = undefined;
			}
			return rs;
		}
		return null;
	}

	private static _getQuestionType(questionType: string): string {
		return QUESTION_TYPES[questionType] ?? questionType;
	}

	private _getTranslations(): Record<string, unknown>[] {
		if (!("itext" in this.model)) {
			return [];
		}
		const itext = this.model.itext as Record<string, unknown>;
		if (!("translation" in itext)) {
			throw new PyXFormError('Invalid value for `self.model["itext"]`.');
		}
		const translations: unknown[] = Array.isArray(itext.translation)
			? itext.translation
			: [itext.translation];
		const firstTranslation = translations[0] as Record<string, unknown>;
		if (!("text" in firstTranslation)) {
			throw new PyXFormError("Invalid value for `translations[0]`.");
		}
		if (!("lang" in firstTranslation)) {
			throw new PyXFormError("Invalid value for `translations[0]`.");
		}
		return translations as Record<string, unknown>[];
	}

	private _getLabel(labelObj: unknown, key = "label"): [string, unknown] {
		if (
			typeof labelObj === "object" &&
			labelObj !== null &&
			!Array.isArray(labelObj)
		) {
			const labelRecord = labelObj as Record<string, unknown>;
			if ("ref" in labelRecord) {
				const ref = (labelRecord.ref as string)
					.replace("jr:itext('", "")
					.replace("')", "");
				return this._getTextFromTranslation(ref, key);
			}
			return [key, this._getOutputText(labelRecord)];
		}
		return [key, labelObj];
	}

	private _getOutputText(value: Record<string, unknown>): unknown {
		if ("output" in value && "_text" in value) {
			const output = value.output as Record<string, unknown>;
			const v = [value._text, this._getBracketedName(output.value as string)];
			let text = v.join(" ");
			if ("tail" in output) {
				text += output.tail;
			}
			return text;
		}
		if ("output" in value && !("_text" in value)) {
			const output = value.output as Record<string, unknown>;
			return this._getBracketedName(output.value as string);
		}
		return value;
	}

	/**
	 * Process a single object-typed translation value (has "form" and/or "output").
	 * Returns the resolved text or media object, or null to skip.
	 */
	private _processObjectTranslationValue(
		value: Record<string, unknown>,
	): { text: unknown; isMedia: boolean } | null {
		let text: unknown = value;
		if ("output" in value) {
			text = this._getOutputText(value);
		}
		if ("form" in value && "_text" in value) {
			const v = _stripMediaPath(value.form as string, value._text as string);
			if (v === "-") {
				return null;
			}
			return { text: { [value.form as string]: v }, isMedia: true };
		}
		return { text, isMedia: false };
	}

	/**
	 * Process an array-typed translation value, populating the label record
	 * with media and label entries per language.
	 */
	private _processArrayTranslationValue(
		value: unknown[],
		lang: string,
		label: Record<string, unknown>,
	): void {
		for (const item of value) {
			if (
				typeof item === "object" &&
				item !== null &&
				"form" in (item as Record<string, unknown>) &&
				"_text" in (item as Record<string, unknown>)
			) {
				this._addMediaTranslation(item as Record<string, unknown>, lang, label);
				continue;
			}
			if (typeof item === "string" && item === "-") {
				continue;
			}
			if (!label.label) {
				label.label = {};
			}
			(label.label as Record<string, unknown>)[lang] = item;
		}
	}

	/**
	 * Add a media entry from a translation item into the label record.
	 */
	private _addMediaTranslation(
		itemObj: Record<string, unknown>,
		lang: string,
		label: Record<string, unknown>,
	): void {
		const mType = itemObj.form as string;
		const v = _stripMediaPath(mType, itemObj._text as string);
		if (v === "-") {
			return;
		}
		if (!label.media) {
			label.media = {};
		}
		const media = label.media as Record<string, unknown>;
		if (!media[mType]) {
			media[mType] = {};
		}
		(media[mType] as Record<string, unknown>)[lang] = v;
	}

	/**
	 * Find the matching label entry for the given ref within a translation's text list.
	 * Returns "break" if the caller should stop iterating labels, "continue" to keep going,
	 * or "skip" if no match was found.
	 */
	private _processTranslationLabel(
		lbl: Record<string, unknown>,
		ref: string,
		lang: string,
		label: Record<string, unknown>,
	): { action: "break" | "continue" | "skip"; isMedia?: boolean } {
		if (!("value" in lbl) || lbl.value === "-" || lbl.id !== ref) {
			return { action: "skip" };
		}
		const value = lbl.value;

		if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			const result = this._processObjectTranslationValue(
				value as Record<string, unknown>,
			);
			if (result === null) {
				return { action: "continue" };
			}
			label[lang] = result.text;
			return { action: "break", isMedia: result.isMedia };
		}

		if (Array.isArray(value)) {
			this._processArrayTranslationValue(value, lang, label);
			return { action: "continue" };
		}

		label[lang] = value;
		return { action: "break" };
	}

	/**
	 * Search a translation's text list for a matching ref and populate the label.
	 * Returns true if a media key was encountered.
	 */
	private _searchTranslationTexts(
		translation: Record<string, unknown>,
		ref: string,
		label: Record<string, unknown>,
	): boolean {
		const lang = translation.lang as string;
		const labelList = Array.isArray(translation.text)
			? translation.text
			: [translation.text];
		let foundMedia = false;
		for (const lbl of labelList as Record<string, unknown>[]) {
			const result = this._processTranslationLabel(lbl, ref, lang, label);
			if (result.action === "skip") {
				continue;
			}
			if (result.isMedia) {
				foundMedia = true;
			}
			if (result.action === "break") {
				break;
			}
		}
		return foundMedia;
	}

	private _getTextFromTranslation(
		ref: string,
		_key = "label",
	): [string, unknown] {
		let key = _key;
		const label: Record<string, unknown> = {};
		for (const translation of this.translations) {
			if (this._searchTranslationTexts(translation, ref, label)) {
				key = "media";
			}
		}
		if (
			key === "media" &&
			Object.keys(label).length === 1 &&
			"default" in label
		) {
			return [key, label.default];
		}
		return [key, label];
	}

	private _getBracketedName(ref: string): string {
		const name = XFormToDictBuilder._getNameFromRef(ref);
		return `\${${name.trim()}}`;
	}

	private _getConstraintMsg(constraintMsg: unknown): unknown {
		if (typeof constraintMsg === "string") {
			if (constraintMsg.includes(":jr:constraintMsg")) {
				const ref = constraintMsg.replace("jr:itext('", "").replace("')", "");
				const [, result] = this._getTextFromTranslation(ref);
				return result;
			}
		}
		return constraintMsg;
	}

	private _getChoices(): Record<string, unknown> {
		const choices: Record<string, unknown> = {};
		for (const instance of this.secondaryInstances) {
			const items: Record<string, unknown>[] = [];
			const root = instance.root as Record<string, unknown> | undefined;
			if (!root?.item) {
				continue;
			}
			const instanceItems = Array.isArray(root.item) ? root.item : [root.item];
			for (const choice of instanceItems as Record<string, unknown>[]) {
				const item = { ...choice };
				if ("itextId" in choice) {
					const itextId = item.itextId as string;
					item.itextId = undefined;
					const [k, lbl] = this._getTextFromTranslation(itextId, "label");
					item[k] = lbl;
				}
				items.push(item);
			}
			choices[instance.id as string] = items;
		}
		return choices;
	}

	static _getNameFromRef(ref: string): string {
		const pos = ref.lastIndexOf("/");
		if (pos === -1) {
			return ref;
		}
		return ref.substring(pos + 1).trim();
	}

	static _shortenXpathsInString(text: string): string {
		const getLastItem = (xpathStr: string): string => {
			const parts = xpathStr.split("/");
			return parts[parts.length - 1].trim();
		};

		const replaceFunction = (_match: string, p1: string): string => {
			return `\${${getLastItem(p1)}}`;
		};

		// Pattern with spaces around xpath
		let result = text.replace(
			/( \/[a-z0-9_-]+(?:\/[a-z0-9_-]+)+ )/gi,
			replaceFunction,
		);
		// Pattern without spaces
		result = result.replace(
			/(\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)+)/gi,
			replaceFunction,
		);
		return result;
	}
}

/**
 * Create a survey element from a JSON string.
 * Equivalent to Python's builder.create_survey_element_from_json.
 */
export function createSurveyElementFromJson(jsonStr: string): Survey {
	const d = JSON.parse(jsonStr);
	return createSurveyElementFromDict(d) as unknown as Survey;
}
