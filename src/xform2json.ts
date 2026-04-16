/**
 * xform2json module - Transform an XForm to a JSON dictionary.
 * Port of pyxform/xform2json.py.
 */

import * as fs from "node:fs";
import { DOMParser } from "@xmldom/xmldom";
import { createSurveyElementFromDict } from "./builder.js";
import { NSMAP } from "./constants.js";
import { PyXFormError } from "./errors.js";
import type { Survey } from "./survey.js";

const QUESTION_TYPES: Record<string, string> = {
	select: "select all that apply",
	select1: "select one",
	int: "integer",
	dateTime: "datetime",
	string: "text",
};

/**
 * Try to parse the root from an XML string or a file path.
 * Returns the root Element of the parsed XML document.
 */
export function _tryParse(root: string): Element {
	// First, try parsing as XML string
	let parseErrors: string[] = [];
	const onError = (_level: string, msg: string) => {
		parseErrors.push(msg);
	};
	const parser = new DOMParser({ onError } as any);

	try {
		const doc = parser.parseFromString(root, "text/xml");
		const docEl = doc?.documentElement;
		if (docEl && parseErrors.length === 0 && docEl.nodeName !== "parsererror") {
			return docEl;
		}
	} catch (_e) {
		// Fall through to file path attempt
	}

	// If string parsing failed, try as file path
	if (_looksLikePath(root)) {
		if (!fs.existsSync(root)) {
			throw new IOError(`File not found: ${root}`);
		}
		const content = fs.readFileSync(root, "utf-8");
		parseErrors = [];
		const fileParser = new DOMParser({ onError } as any);
		try {
			const doc = fileParser.parseFromString(content, "text/xml");
			const docEl = doc?.documentElement;
			if (docEl && parseErrors.length === 0 && docEl.nodeName !== "parsererror") {
				return docEl;
			}
		} catch (_e) {
			// xmldom may throw ParseError for invalid content
		}
		throw new XMLParseError(`Failed to parse XML from file: ${root}`);
	}

	throw new IOError(`Could not parse XML string and input is not a valid file path.`);
}

/**
 * Check if a string looks like a file path rather than XML content.
 */
function _looksLikePath(s: string): boolean {
	// If it starts with < it's likely XML
	const trimmed = s.trim();
	if (trimmed.startsWith("<")) return false;
	// If it contains path separators or has a file extension, treat as path
	return true;
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
	[key: string]: any;
}

function _convertXmlToDictRecurse(node: Element): XmlDict | string {
	const nodedict: XmlDict = {};

	// Set attributes
	if (node.attributes && node.attributes.length > 0) {
		for (let i = 0; i < node.attributes.length; i++) {
			const attr = node.attributes[i];
			nodedict[attr.name] = attr.value;
		}
	}

	// Recursively add children
	const childElements = _getChildElements(node);
	for (const child of childElements) {
		const newitem: any = _convertXmlToDictRecurse(child);
		// Capture tail text
		const tailText = _getTailText(child, node);
		if (tailText && typeof newitem === "object") {
			newitem.tail = tailText;
		}

		const tag = child.nodeName;
		if (tag in nodedict) {
			if (Array.isArray(nodedict[tag])) {
				nodedict[tag].push(newitem);
			} else {
				nodedict[tag] = [nodedict[tag], newitem];
			}
		} else {
			nodedict[tag] = newitem;
		}
	}

	const textContent = _getDirectText(node);
	const text = textContent.trim();

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
	for (let i = 0; i < node.childNodes.length; i++) {
		const child = node.childNodes[i];
		if (child.nodeType === 1) { // ELEMENT_NODE
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
	for (let i = 0; i < node.childNodes.length; i++) {
		const child = node.childNodes[i];
		if (child.nodeType === 3) { // TEXT_NODE
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
	for (let i = 0; i < parent.childNodes.length; i++) {
		const n = parent.childNodes[i];
		if (n === child) {
			foundChild = true;
			continue;
		}
		if (foundChild) {
			if (n.nodeType === 3) { // TEXT_NODE
				tail += n.nodeValue ?? "";
			} else {
				break;
			}
		}
	}
	if (tail.trim() !== "") return tail;
	return null;
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

	getDict(): Record<string, any> {
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

class XFormToDictBuilder {
	private _xmldict: Record<string, any>;
	private body: Record<string, any>;
	private model: Record<string, any>;
	private bindings: Record<string, any>[];
	private _bindList: Record<string, any>[];
	private title: string;
	private secondaryInstances: any[];
	private translations: any[];
	private choices: Record<string, any>;
	private newDoc: Record<string, any>;
	private children: Record<string, any>[];
	private orderedBindingRefs: string[];

	constructor(xmlFile: string) {
		const docAsDict = new XFormToDict(xmlFile).getDict();
		this._xmldict = docAsDict;

		// Strip namespace prefixes from top-level keys
		const doc = this._stripNsPrefixes(docAsDict);

		if (!("html" in doc)) {
			throw new PyXFormError("Invalid value for `doc_as_dict`.");
		}
		if (!("body" in doc.html)) {
			throw new PyXFormError("Invalid value for `doc_as_dict`.");
		}
		if (!("head" in doc.html)) {
			throw new PyXFormError("Invalid value for `doc_as_dict`.");
		}
		if (!("model" in doc.html.head)) {
			throw new PyXFormError("Invalid value for `doc_as_dict`.");
		}
		if (!("title" in doc.html.head)) {
			throw new PyXFormError("Invalid value for `doc_as_dict`.");
		}
		if (!("bind" in doc.html.head.model)) {
			throw new PyXFormError("Invalid value for `doc_as_dict`.");
		}

		this.body = doc.html.body;
		this.model = doc.html.head.model;
		this.bindings = JSON.parse(JSON.stringify(this.model.bind));
		if (!Array.isArray(this.bindings)) {
			this.bindings = [this.bindings];
		}
		this._bindList = JSON.parse(JSON.stringify(this.bindings));
		this.title = doc.html.head.title;

		let secondary: any[] = [];
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
				this.children.push(this._getQuestionFromObject(obj, key));
			} else if (Array.isArray(obj)) {
				for (const item of obj) {
					this.children.push(this._getQuestionFromObject(item, key));
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
	private _stripNsPrefixes(obj: any): any {
		if (typeof obj !== "object" || obj === null) return obj;
		if (Array.isArray(obj)) return obj.map((item) => this._stripNsPrefixes(item));

		const result: Record<string, any> = {};
		for (const [key, value] of Object.entries(obj)) {
			const stripped = key.includes(":") ? key.split(":").pop()! : key;
			result[stripped] = this._stripNsPrefixes(value);
		}
		return result;
	}

	private _setBindingOrder(): void {
		this.orderedBindingRefs = [];
		for (const bind of this.bindings) {
			this.orderedBindingRefs.push(bind.nodeset);
		}
	}

	private _setSurveyName(): void {
		const name = this.bindings[0].nodeset.split("/")[1];
		this.newDoc.name = name;
		const instances = this.model.instance;
		let idString: string;
		if (typeof instances === "object" && !Array.isArray(instances)) {
			idString = instances[name]?.id ?? this.title;
		} else if (Array.isArray(instances)) {
			idString = instances[0]?.[name]?.id ?? this.title;
		} else {
			throw new PyXFormError(`Unexpected type for model instances: ${typeof instances}`);
		}
		this.newDoc.id_string = idString;
	}

	private _setSubmissionInfo(): void {
		if ("submission" in this.model) {
			const submission = this.model.submission;
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
		const removeRefs = (children: any[]) => {
			for (const child of children) {
				if (typeof child === "object" && child !== null) {
					delete child.nodeset;
					delete child.ref;
					delete child.__order;
					if (child.children) {
						removeRefs(child.children);
					}
				}
			}
		};

		const orderChildren = (children: any[]) => {
			if (Array.isArray(children)) {
				try {
					children.sort((a, b) => (a.__order ?? 0) - (b.__order ?? 0));
				} catch (_e) {
					// ignore
				}
				for (const child of children) {
					if (typeof child === "object" && child !== null && child.children) {
						orderChildren(child.children);
					}
				}
			}
		};

		orderChildren(this.children);
		removeRefs(this.children);
	}

	private _cleanupBindList(): void {
		const toProcess = [...this._bindList];
		this._bindList = [];

		for (const item of toProcess) {
			const ref = item.nodeset;
			const name = XFormToDictBuilder._getNameFromRef(ref);
			const parentRef = ref.substring(0, ref.indexOf(`/${name}`));
			const question: Record<string, any> = this._getQuestionParamsFromBindings(ref) ?? {};
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

			let found = false;
			for (const child of this.children) {
				if (child.ref === parentRef) {
					question.ref = ref;
					let updated = false;
					if (child.children) {
						for (const c of child.children) {
							if (typeof c === "object" && c !== null && c.ref === ref) {
								Object.assign(c, question);
								updated = true;
							}
						}
					}
					if (!updated) {
						if (!child.children) child.children = [];
						child.children.push(question);
					}
					found = true;
				}
			}

			if (!("ref" in question)) {
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
				break;
			}
		}

		if (this._bindList.length > 0) {
			this._cleanupBindList();
		}
	}

	private _getItemFunc(ref: string, name: string, item: any): Record<string, any> {
		const rs: Record<string, any> = {};
		const nameSplits = name.split("/");
		rs.name = nameSplits[0];
		ref = `${ref}/${rs.name}`;
		rs.ref = ref;
		if (nameSplits.length > 1) {
			rs.type = "group";
			rs.children = [this._getItemFunc(ref, nameSplits.slice(1).join("/"), item)];
		}
		return rs;
	}

	survey(): Survey {
		const newDoc = JSON.stringify(this.newDoc);
		return createSurveyElementFromJson(newDoc);
	}

	private _getQuestionOrder(ref: string): number {
		const idx = this.orderedBindingRefs.indexOf(ref);
		if (idx !== -1) return idx;
		for (let i = 0; i < this.orderedBindingRefs.length; i++) {
			if (this.orderedBindingRefs[i].startsWith(ref)) {
				return i + 1;
			}
		}
		return this.orderedBindingRefs.length + 1;
	}

	private _getQuestionFromObject(obj: Record<string, any>, type?: string): Record<string, any> {
		let ref: string;
		if ("ref" in obj) {
			ref = obj.ref;
		} else if ("nodeset" in obj) {
			ref = obj.nodeset;
		} else {
			throw new PyXFormError(`Cannot find "ref" or "nodeset" in ${JSON.stringify(obj)}`);
		}

		const question: Record<string, any> = {
			ref,
			__order: this._getQuestionOrder(ref),
			name: XFormToDictBuilder._getNameFromRef(ref),
		};

		if ("hint" in obj) {
			const [k, v] = this._getLabel(obj.hint, "hint");
			question[k] = v;
		}
		if ("label" in obj) {
			const [k, v] = this._getLabel(obj.label);
			if (typeof v === "object" && v !== null && "label" in v && "media" in v) {
				Object.assign(question, v);
			} else {
				question[k] = v;
			}
		}

		if ("autoplay" in obj || "appearance" in obj || "count" in obj || "rows" in obj) {
			question.control = {};
		}
		if ("appearance" in obj) {
			question.control.appearance = obj.appearance;
		}
		if ("rows" in obj) {
			question.control.rows = obj.rows;
		}
		if ("autoplay" in obj) {
			question.control.autoplay = obj.autoplay;
		}

		const questionParams = this._getQuestionParamsFromBindings(ref);
		if (typeof questionParams === "object" && questionParams !== null) {
			Object.assign(question, questionParams);
		}

		// Some values set from bindings are incorrect or incomplete. Correct them now.
		if ("mediatype" in obj) {
			question.type = obj.mediatype.replace("/*", "");
		}
		if ("item" in obj) {
			const children: any[] = [];
			const items = Array.isArray(obj.item) ? obj.item : [obj.item];
			for (const i of items) {
				if (typeof i === "object" && i !== null && "label" in i && "value" in i) {
					const [k, v] = this._getLabel(i.label);
					children.push({ name: i.value, [k]: v });
				}
			}
			question.children = children;
		}

		let questionType = question.type ?? type;
		if (
			questionType === "text" &&
			question.bind &&
			question.bind.readonly
		) {
			questionType = question.type = "note";
			delete question.bind.readonly;
			if (Object.keys(question.bind).length === 0) {
				delete question.bind;
			}
		}

		if (questionType === "group" || questionType === "repeat") {
			if (questionType === "group" && "repeat" in obj) {
				question.children = this._getChildrenQuestions(obj.repeat);
				questionType = "repeat";
				if ("count" in obj.repeat) {
					if (!question.control) {
						question.control = {};
					}
					question.control["jr:count"] = XFormToDictBuilder._shortenXpathsInString(
						obj.repeat.count.trim(),
					);
				}
			} else {
				question.children = this._getChildrenQuestions(obj);
			}
			question.type = questionType;
		}

		if (type === "trigger") {
			question.type = "acknowledge";
		}
		if (type === "select1" || type === "select") {
			question.type = QUESTION_TYPES[type];
		}
		if (questionType === "geopoint" && "hint" in question) {
			delete question.hint;
		}
		if (!("type" in question) && type) {
			question.type = questionType;
		}

		if ("itemset" in obj) {
			const nodeset = obj.itemset.nodeset;
			const choicesNameMatch = nodeset.match(/^instance\('(.*?)'\)/);
			if (choicesNameMatch) {
				const choicesName = choicesNameMatch[1];
				question.itemset = choicesName;
				question.list_name = choicesName;
				if (this.choices[choicesName]) {
					question.choices = this.choices[choicesName];
				}
				// Choice filters
				const filterRefRegex = new RegExp(`\\[ /${this.newDoc.name}/(.*?) `);
				const filterRefMatch = nodeset.match(filterRefRegex);
				if (filterRefMatch) {
					const filterRef = filterRefMatch[1];
					const filterExpRegex = new RegExp(`${filterRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (.*?)\\]$`);
					const filterExpMatch = nodeset.match(filterExpRegex);
					if (filterExpMatch) {
						question.choice_filter = `\${${filterRef}}${filterExpMatch[1]}`;
						question.query = choicesName;
					}
				}
			}
		}

		return question;
	}

	private _getChildrenQuestions(obj: Record<string, any>): Record<string, any>[] {
		const children: Record<string, any>[] = [];
		for (const [k, v] of Object.entries(obj)) {
			if (["ref", "label", "nodeset"].includes(k)) continue;
			if (typeof v === "object" && v !== null && !Array.isArray(v)) {
				children.push(this._getQuestionFromObject(v, k));
			} else if (Array.isArray(v)) {
				for (const i of v) {
					children.push(this._getQuestionFromObject(i, k));
				}
			}
		}
		return children;
	}

	private _getQuestionParamsFromBindings(ref: string): Record<string, any> | null {
		for (const item of this.bindings) {
			if (item.nodeset === ref) {
				// Remove from bind list
				const idx = this._bindList.findIndex(
					(b) => JSON.stringify(b) === JSON.stringify(item),
				);
				if (idx !== -1) {
					this._bindList.splice(idx, 1);
				}

				const rs: Record<string, any> = {};
				for (const [k, v] of Object.entries(item)) {
					let key = k;
					let val = v as any;
					if (key === "nodeset") continue;
					if (key === "type") {
						val = XFormToDictBuilder._getQuestionType(val);
					}
					if ([
						"relevant", "required", "constraint", "constraintMsg",
						"readonly", "calculate", "noAppErrorString", "requiredMsg",
					].includes(key)) {
						if (key === "noAppErrorString") key = "jr:noAppErrorString";
						if (key === "requiredMsg") key = "jr:requiredMsg";
						if (key === "constraintMsg") {
							key = "jr:constraintMsg";
							val = this._getConstraintMsg(val);
						}
						if (key === "required") {
							if (val === "true()") val = "yes";
							else if (val === "false()") val = "no";
						}
						if (["constraint", "relevant", "calculate"].includes(key)) {
							val = XFormToDictBuilder._shortenXpathsInString(val);
						}
						if (!rs.bind) rs.bind = {};
						rs.bind[key] = val;
						continue;
					}
					if (key === "preload" && val === "uid") {
						if (!rs.bind) rs.bind = {};
						rs.bind["jr:preload"] = val;
					}
					rs[key] = val;
				}
				if ("preloadParams" in rs && "preload" in rs) {
					rs.type = rs.preloadParams;
					delete rs.preloadParams;
					delete rs.preload;
				}
				return rs;
			}
		}
		return null;
	}

	private static _getQuestionType(questionType: string): string {
		return QUESTION_TYPES[questionType] ?? questionType;
	}

	private _getTranslations(): any[] {
		if (!("itext" in this.model)) return [];
		if (!("translation" in this.model.itext)) {
			throw new PyXFormError('Invalid value for `self.model["itext"]`.');
		}
		let translations = this.model.itext.translation;
		if (!Array.isArray(translations)) {
			translations = [translations];
		}
		if (!("text" in translations[0])) {
			throw new PyXFormError("Invalid value for `translations[0]`.");
		}
		if (!("lang" in translations[0])) {
			throw new PyXFormError("Invalid value for `translations[0]`.");
		}
		return translations;
	}

	private _getLabel(labelObj: any, key = "label"): [string, any] {
		if (typeof labelObj === "object" && labelObj !== null && !Array.isArray(labelObj)) {
			if ("ref" in labelObj) {
				const ref = labelObj.ref.replace("jr:itext('", "").replace("')", "");
				return this._getTextFromTranslation(ref, key);
			}
			return [key, this._getOutputText(labelObj)];
		}
		return [key, labelObj];
	}

	private _getOutputText(value: any): any {
		if ("output" in value && "_text" in value) {
			const v = [value._text, this._getBracketedName(value.output.value)];
			let text = v.join(" ");
			if ("tail" in value.output) {
				text = text + value.output.tail;
			}
			return text;
		}
		if ("output" in value && !("_text" in value)) {
			return this._getBracketedName(value.output.value);
		}
		return value;
	}

	private _getTextFromTranslation(ref: string, key = "label"): [string, any] {
		const label: Record<string, any> = {};
		for (const translation of this.translations) {
			const lang = translation.lang;
			const labelList = Array.isArray(translation.text) ? translation.text : [translation.text];
			for (const lbl of labelList) {
				if (!("value" in lbl) || lbl.value === "-") continue;
				if (lbl.id === ref) {
					let text: any = lbl.value;
					const value = lbl.value;
					if (typeof value === "object" && value !== null && !Array.isArray(value)) {
						if ("output" in value) {
							text = this._getOutputText(value);
						}
						if ("form" in value && "_text" in value) {
							key = "media";
							let v = value._text;
							if (value.form === "image") {
								v = v.replace("jr://images/", "");
							} else {
								v = v.replace(`jr://${value.form}/`, "");
							}
							if (v === "-") continue;
							text = { [value.form]: v };
						}
					}
					if (Array.isArray(value)) {
						for (const item of value) {
							if (typeof item === "object" && item !== null && "form" in item && "_text" in item) {
								const mType = item.form;
								let v = item._text;
								if (mType === "image") {
									v = v.replace("jr://images/", "");
								} else {
									v = v.replace(`jr://${mType}/`, "");
								}
								if (v === "-") continue;
								if (!label.media) label.media = {};
								if (!label.media[mType]) label.media[mType] = {};
								label.media[mType][lang] = v;
								continue;
							}
							if (typeof item === "string") {
								if (item === "-") continue;
							}
							if (!label.label) label.label = {};
							label.label[lang] = item;
						}
						continue;
					}
					label[lang] = text;
					break;
				}
			}
		}
		if (key === "media" && Object.keys(label).length === 1 && "default" in label) {
			return [key, label.default];
		}
		return [key, label];
	}

	private _getBracketedName(ref: string): string {
		const name = XFormToDictBuilder._getNameFromRef(ref);
		return `\${${name.trim()}}`;
	}

	private _getConstraintMsg(constraintMsg: any): any {
		if (typeof constraintMsg === "string") {
			if (constraintMsg.includes(":jr:constraintMsg")) {
				const ref = constraintMsg.replace("jr:itext('", "").replace("')", "");
				const [, result] = this._getTextFromTranslation(ref);
				return result;
			}
		}
		return constraintMsg;
	}

	private _getChoices(): Record<string, any> {
		const choices: Record<string, any> = {};
		for (const instance of this.secondaryInstances) {
			const items: any[] = [];
			if (!instance.root || !instance.root.item) continue;
			const instanceItems = Array.isArray(instance.root.item)
				? instance.root.item
				: [instance.root.item];
			for (const choice of instanceItems) {
				const item = { ...choice };
				if ("itextId" in choice) {
					const itextId = item.itextId;
					delete item.itextId;
					const [k, lbl] = this._getTextFromTranslation(itextId, "label");
					item[k] = lbl;
				}
				items.push(item);
			}
			choices[instance.id] = items;
		}
		return choices;
	}

	static _getNameFromRef(ref: string): string {
		const pos = ref.lastIndexOf("/");
		if (pos === -1) return ref;
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
		text = text.replace(/( \/[a-z0-9_-]+(?:\/[a-z0-9_-]+)+ )/gi, replaceFunction);
		// Pattern without spaces
		text = text.replace(/(\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)+)/gi, replaceFunction);
		return text;
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
