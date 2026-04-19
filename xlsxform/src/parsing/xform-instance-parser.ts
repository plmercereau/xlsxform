/**
 * XFormInstanceParser - parses an instance XML string.
 * Port of pyxform/xform_instance_parser.py.
 */

import { DOMParser } from "@xmldom/xmldom";
import { PyXFormError } from "../errors.js";

const XFORM_ID_STRING = "_xform_id_string";

function mergeChildValue(
	target: Record<string, unknown>,
	key: string,
	newValue: unknown,
): void {
	if (!(key in target)) {
		target[key] = newValue;
	} else if (Array.isArray(target[key])) {
		target[key].push(newValue);
	} else {
		target[key] = [target[key], newValue];
	}
}

function xmlNodeToDict(node: Node): Record<string, unknown> {
	if (!node?.nodeName) {
		throw new PyXFormError("Invalid value for `node`.");
	}
	const childNodes = node.childNodes
		? (Array.from(node.childNodes) as Node[])
		: [];

	if (childNodes.length === 0) {
		return { [node.nodeName]: null };
	}
	if (childNodes.length === 1 && childNodes[0].nodeType === 3 /* TEXT_NODE */) {
		return { [node.nodeName]: childNodes[0].nodeValue };
	}

	// Internal node
	const value: Record<string, unknown> = {};
	for (const child of childNodes) {
		if (child.nodeType === 3 /* TEXT_NODE */) {
			continue; // skip whitespace text nodes
		}
		const d = xmlNodeToDict(child);
		const childName = child.nodeName;
		if (Object.keys(d).length !== 1 || !(childName in d)) {
			throw new PyXFormError("Invalid value for `d`.");
		}
		mergeChildValue(value, childName, d[childName]);
	}
	return { [node.nodeName]: value };
}

function* flattenArray(
	arr: unknown[],
	prefix: string[],
): Generator<[string[], unknown]> {
	for (let i = 0; i < arr.length; i++) {
		const itemPrefix = [...prefix];
		itemPrefix[itemPrefix.length - 1] += `[${i + 1}]`;
		if (arr[i] && typeof arr[i] === "object" && !Array.isArray(arr[i])) {
			yield* flattenDict(arr[i] as Record<string, unknown>, itemPrefix);
		} else {
			yield [itemPrefix, arr[i]];
		}
	}
}

function* flattenDict(
	d: Record<string, unknown>,
	prefix: string[],
): Generator<[string[], unknown]> {
	for (const [key, value] of Object.entries(d)) {
		const newPrefix = [...prefix, key];
		if (value && typeof value === "object" && !Array.isArray(value)) {
			yield* flattenDict(value as Record<string, unknown>, newPrefix);
		} else if (Array.isArray(value)) {
			yield* flattenArray(value, newPrefix);
		} else {
			yield [newPrefix, value];
		}
	}
}

function getAllAttributes(node: Node): [string, string][] {
	const result: [string, string][] = [];
	if ((node as Element).attributes) {
		const attrs = (node as Element).attributes;
		for (let i = 0; i < attrs.length; i++) {
			const attr = attrs.item(i);
			if (attr) {
				result.push([attr.name, attr.value]);
			}
		}
	}
	const childNodes = node.childNodes
		? (Array.from(node.childNodes) as Node[])
		: [];
	for (const child of childNodes) {
		result.push(...getAllAttributes(child));
	}
	return result;
}

class XFormInstanceParser {
	private _dict!: Record<string, unknown>;
	private _flatDict!: Record<string, unknown>;
	private _attributes!: Record<string, string>;
	private _rootNode!: Element;

	constructor(xmlStr: string) {
		this.parse(xmlStr);
	}

	private parse(xmlStr: string): void {
		let cleanXmlStr = xmlStr.trim();
		cleanXmlStr = cleanXmlStr.replace(/>\s+</g, "><");
		const parser = new DOMParser();
		const doc = parser.parseFromString(cleanXmlStr, "text/xml");
		this._rootNode = doc.documentElement as unknown as Element;
		this._dict = xmlNodeToDict(this._rootNode);
		this._flatDict = {};
		for (const [path, value] of flattenDict(this._dict, [])) {
			this._flatDict[path.slice(1).join("/")] = value;
		}
		this._setAttributes();
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

	getFlatDictWithAttributes(): Record<string, unknown> {
		const result = { ...this._flatDict };
		result[XFORM_ID_STRING] = this.getXformIdString.bind(this);
		return result;
	}
}

export function parseXformInstance(xmlStr: string): Record<string, unknown> {
	const parser = new XFormInstanceParser(xmlStr);
	return parser.getFlatDictWithAttributes();
}
