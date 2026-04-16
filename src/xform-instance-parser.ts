/**
 * XFormInstanceParser - parses an instance XML string.
 * Port of pyxform/xform_instance_parser.py.
 */

import { DOMParser } from "@xmldom/xmldom";
import { PyXFormError } from "./errors.js";

export const XFORM_ID_STRING = "_xform_id_string";

function xmlNodeToDict(node: any): Record<string, any> {
	if (!node || !node.nodeName) {
		throw new PyXFormError("Invalid value for `node`.");
	}
	const childNodes = node.childNodes
		? (Array.from(node.childNodes) as any[])
		: [];

	if (childNodes.length === 0) {
		return { [node.nodeName]: null };
	}
	if (childNodes.length === 1 && childNodes[0].nodeType === 3 /* TEXT_NODE */) {
		return { [node.nodeName]: childNodes[0].nodeValue };
	}

	// Internal node
	const value: Record<string, any> = {};
	for (const child of childNodes) {
		if (child.nodeType === 3 /* TEXT_NODE */) continue; // skip whitespace text nodes
		const d = xmlNodeToDict(child);
		const childName = child.nodeName;
		if (Object.keys(d).length !== 1 || !(childName in d)) {
			throw new PyXFormError("Invalid value for `d`.");
		}
		if (!(childName in value)) {
			value[childName] = d[childName];
		} else if (Array.isArray(value[childName])) {
			value[childName].push(d[childName]);
		} else {
			value[childName] = [value[childName], d[childName]];
		}
	}
	return { [node.nodeName]: value };
}

function* flattenDict(
	d: Record<string, any>,
	prefix: string[],
): Generator<[string[], any]> {
	for (const [key, value] of Object.entries(d)) {
		const newPrefix = [...prefix, key];
		if (value && typeof value === "object" && !Array.isArray(value)) {
			yield* flattenDict(value, newPrefix);
		} else if (Array.isArray(value)) {
			for (let i = 0; i < value.length; i++) {
				const itemPrefix = [...newPrefix];
				itemPrefix[itemPrefix.length - 1] += `[${i + 1}]`;
				if (
					value[i] &&
					typeof value[i] === "object" &&
					!Array.isArray(value[i])
				) {
					yield* flattenDict(value[i], itemPrefix);
				} else {
					yield [itemPrefix, value[i]];
				}
			}
		} else {
			yield [newPrefix, value];
		}
	}
}

function getAllAttributes(node: any): [string, string][] {
	const result: [string, string][] = [];
	if (node.attributes) {
		for (let i = 0; i < node.attributes.length; i++) {
			const attr = node.attributes.item(i);
			if (attr) {
				result.push([attr.name, attr.value]);
			}
		}
	}
	const childNodes = node.childNodes
		? (Array.from(node.childNodes) as any[])
		: [];
	for (const child of childNodes) {
		result.push(...getAllAttributes(child));
	}
	return result;
}

export class XFormInstanceParser {
	private _dict: Record<string, any>;
	private _flatDict: Record<string, any>;
	private _attributes: Record<string, string>;
	private _rootNode: any;

	constructor(xmlStr: string) {
		this.parse(xmlStr);
	}

	private parse(xmlStr: string): void {
		let cleanXmlStr = xmlStr.trim();
		cleanXmlStr = cleanXmlStr.replace(/>\s+</g, "><");
		const parser = new DOMParser();
		const doc = parser.parseFromString(cleanXmlStr, "text/xml");
		this._rootNode = doc.documentElement;
		this._dict = xmlNodeToDict(this._rootNode);
		this._flatDict = {};
		for (const [path, value] of flattenDict(this._dict, [])) {
			this._flatDict[path.slice(1).join("/")] = value;
		}
		this._setAttributes();
	}

	getRootNodeName(): string {
		return this._rootNode.nodeName;
	}

	get(abbreviatedXpath: string): any {
		return this._flatDict[abbreviatedXpath];
	}

	toJsonDict(): Record<string, any> {
		return this._dict;
	}

	toFlatDict(): Record<string, any> {
		return this._flatDict;
	}

	getAttributes(): Record<string, string> {
		return this._attributes;
	}

	private _setAttributes(): void {
		this._attributes = {};
		const allAttributes = getAllAttributes(this._rootNode);
		for (const [key, value] of allAttributes) {
			if (key in this._attributes) {
				throw new PyXFormError("Invalid value for `this._attributes`.");
			}
			this._attributes[key] = value;
		}
	}

	getXformIdString(): string {
		return this._attributes.id;
	}

	getFlatDictWithAttributes(): Record<string, any> {
		const result = { ...this._flatDict };
		result[XFORM_ID_STRING] = this.getXformIdString.bind(this);
		return result;
	}
}

export function xformInstanceToDict(xmlStr: string): Record<string, any> {
	const parser = new XFormInstanceParser(xmlStr);
	return parser.toJsonDict();
}

export function xformInstanceToFlatDict(xmlStr: string): Record<string, any> {
	const parser = new XFormInstanceParser(xmlStr);
	return parser.toFlatDict();
}

export function parseXformInstance(xmlStr: string): Record<string, any> {
	const parser = new XFormInstanceParser(xmlStr);
	return parser.getFlatDictWithAttributes();
}
