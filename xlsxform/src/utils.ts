import {
	DOMImplementation,
	DOMParser,
	type CharacterData as XCharacterData,
	type Document as XDocument,
	type DocumentType as XDocumentType,
	type Element as XElement,
	XMLSerializer,
	type Node as XNode,
} from "@xmldom/xmldom";
import { PyXFormError } from "./errors.js";

const domImpl = new DOMImplementation();
const xmlSerializer = new XMLSerializer();
const domParser = new DOMParser();

const NS_MAP: Record<string, string> = {
	h: "http://www.w3.org/1999/xhtml",
	ev: "http://www.w3.org/2001/xml-events",
	xsd: "http://www.w3.org/2001/XMLSchema",
	jr: "http://openrosa.org/javarosa",
	orx: "http://openrosa.org/xforms",
	odk: "http://www.opendatakit.org/xforms",
	entities: "http://www.opendatakit.org/xforms/entities",
	xmlns: "http://www.w3.org/2000/xmlns/",
};

function getNamespaceForPrefix(prefix: string): string | null {
	return NS_MAP[prefix] ?? dynamicNS[prefix] ?? null;
}

const dynamicNS: Record<string, string> = {};

/**
 * Register a custom namespace prefix->URI mapping for use in element/attribute creation.
 */
export function registerNamespace(prefix: string, uri: string): void {
	dynamicNS[prefix] = uri;
}

export function setAttributeWithNS(
	elem: XElement,
	name: string,
	value: string,
): void {
	const colonIdx = name.indexOf(":");
	if (colonIdx > 0) {
		const prefix = name.substring(0, colonIdx);
		if (prefix === "xmlns") {
			elem.setAttributeNS("http://www.w3.org/2000/xmlns/", name, value);
			return;
		}
		const ns = getNamespaceForPrefix(prefix);
		if (ns) {
			elem.setAttributeNS(ns, name, value);
			return;
		}
		// Unknown namespace prefix - use local name only to avoid xmldom namespace errors
		const localName = name.substring(colonIdx + 1);
		elem.setAttribute(localName, value);
		return;
	}
	elem.setAttribute(name, value);
}

function createElementWithNS(doc: XDocument, tag: string): XElement {
	const colonIdx = tag.indexOf(":");
	if (colonIdx > 0) {
		const prefix = tag.substring(0, colonIdx);
		const ns = getNamespaceForPrefix(prefix);
		if (ns) {
			return doc.createElementNS(ns, tag);
		}
	}
	return doc.createElement(tag);
}

const XML_TEXT_SUBS: [string, string][] = [
	["&", "&amp;"],
	["<", "&lt;"],
	[">", "&gt;"],
];

function escapeTextForXml(text: string, attribute = false): string {
	let result = text;
	for (const [from, to] of XML_TEXT_SUBS) {
		if (result.includes(from)) {
			result = result.split(from).join(to);
		}
	}
	if (attribute && result.includes('"')) {
		result = result.split('"').join("&quot;");
	}
	return result;
}

function createDoc(): XDocument {
	return domImpl.createDocument(
		null as unknown as string,
		null as unknown as string,
		null as unknown as XDocumentType,
	);
}

/** Convert a NodeList or NamedNodeMap to an array for safe iteration. */
// biome-ignore lint/suspicious/noExplicitAny: DOM collections need flexible typing
// biome-ignore lint/suspicious/noExplicitAny: xmldom types don't align with standard DOM types
function toArray(collection: ArrayLike<any>): any[] {
	return Array.from(collection);
}

/** Check if a value is a plain object suitable for use as kwargs (not a DOM node or array). */
function isPlainKwargs(value: unknown): boolean {
	return (
		value != null &&
		typeof value === "object" &&
		!(value as Record<string, unknown>).tagName &&
		!(value as Record<string, unknown>).nodeType &&
		!Array.isArray(value)
	);
}

/** Append a single child arg to elem, handling numbers, DOM nodes, and arrays. */
function appendChildArg(doc: XDocument, elem: XElement, child: unknown): void {
	if (child == null) {
		return;
	}
	if (typeof child === "number") {
		elem.appendChild(doc.createTextNode(String(child)));
	} else if ((child as XNode).nodeType) {
		elem.appendChild(doc.importNode(child as XNode, true));
	} else if (Array.isArray(child)) {
		for (const c of child) {
			if ((c as XNode)?.nodeType) {
				elem.appendChild(doc.importNode(c as XNode, true));
			}
		}
	}
}

/**
 * Create an XML element with children and attributes.
 * String args become text nodes. Element args become child elements.
 */
export function xmlNode(tag: string, ...args: unknown[]): XElement {
	const doc = createDoc();
	const elem = createElementWithNS(doc, tag);

	const stringArgs: string[] = [];
	const otherArgs: unknown[] = [];

	for (const arg of args) {
		if (typeof arg === "string") {
			stringArgs.push(arg);
		} else {
			otherArgs.push(arg);
		}
	}

	// Extract kwargs (last arg if it's a plain object with no tagName)
	let kwargs: Record<string, string> = {};
	const last = otherArgs[otherArgs.length - 1];
	if (otherArgs.length > 0 && isPlainKwargs(last)) {
		kwargs = otherArgs.pop() as Record<string, string>;
	}

	if (stringArgs.length > 1) {
		throw new PyXFormError("Invalid value for string args.");
	}
	if (stringArgs.length === 1) {
		elem.appendChild(doc.createTextNode(stringArgs[0]));
	}

	for (const [k, v] of Object.entries(kwargs)) {
		setAttributeWithNS(elem, k, v);
	}

	for (const child of otherArgs) {
		appendChildArg(doc, elem, child);
	}

	return elem;
}

/** Sort attribute keys: plain attrs first (alphabetical), then namespaced (alphabetical). */
function sortAttributeKeys(keys: string[]): string[] {
	return keys.sort((a, b) => {
		const aHasNs = a.includes(":");
		const bHasNs = b.includes(":");
		if (aHasNs !== bHasNs) {
			return aHasNs ? 1 : -1;
		}
		return a.localeCompare(b);
	});
}

/** Import parsed XML children with mixed-content spacing into elem. */
function appendParsedChildren(
	doc: XDocument,
	elem: XElement,
	root: XElement,
): void {
	const children = toArray(root.childNodes);
	const childCount = children.length;
	for (let i = 0; i < childCount; i++) {
		const child = children[i];
		if (childCount > 1 && i === 0 && child.nodeType === 3) {
			elem.appendChild(doc.createTextNode(" "));
		}
		elem.appendChild(doc.importNode(child, true));
		if (childCount > 1 && i === childCount - 1) {
			elem.appendChild(doc.createTextNode(" "));
		}
	}
}

/** Append typed children (string, number, or Element) to elem. */
function appendTypedChildren(
	doc: XDocument,
	elem: XElement,
	children: (XElement | string | number | null | undefined)[],
): void {
	for (const child of children) {
		if (child == null) {
			continue;
		}
		if (typeof child === "string") {
			elem.appendChild(doc.createTextNode(child));
		} else if (typeof child === "number") {
			elem.appendChild(doc.createTextNode(String(child)));
		} else if (child.nodeType) {
			elem.appendChild(doc.importNode(child, true));
		}
	}
}

/**
 * Create an XML node with named parameters approach.
 * More aligned with the Python node() function signature.
 */
export function node(
	tag: string,
	opts: {
		children?: (XElement | string | number | null | undefined)[];
		text?: string;
		toParseString?: boolean;
		attrs?: Record<string, string>;
	} = {},
): XElement {
	const doc = createDoc();
	const elem = createElementWithNS(doc, tag);

	if (opts.text != null) {
		if (opts.toParseString) {
			const wrapper = `<?xml version="1.0" ?><${tag}>${opts.text}</${tag}>`;
			const parsed = domParser.parseFromString(wrapper, "text/xml");
			const root = parsed.documentElement;
			if (root) {
				appendParsedChildren(doc, elem, root as unknown as XElement);
			}
		} else {
			elem.appendChild(doc.createTextNode(opts.text));
		}
	}

	if (opts.attrs) {
		for (const k of sortAttributeKeys(Object.keys(opts.attrs))) {
			setAttributeWithNS(elem, k, opts.attrs[k]);
		}
	}

	if (opts.children) {
		appendTypedChildren(doc, elem, opts.children);
	}

	return elem;
}

/** Serialize an element's attributes to an XML string fragment. */
function serializeAttributes(elem: XElement): string {
	let result = "";
	if (!elem.attributes) {
		return result;
	}
	for (const attr of toArray(elem.attributes)) {
		result += ` ${attr.name}="${escapeTextForXml(attr.value, true)}"`;
	}
	return result;
}

/** Check if any child node is a text or CDATA node. */
function hasTextOrCDataChild(elem: XElement): boolean {
	for (const child of toArray(elem.childNodes)) {
		if (child.nodeType === 3 || child.nodeType === 4) {
			return true;
		}
	}
	return false;
}

/** Serialize mixed content (text + elements) inline without indentation. */
function serializeMixedContent(elem: XElement): string {
	let result = "";
	const children = toArray(elem.childNodes);
	const childCount = children.length;
	for (let i = 0; i < childCount; i++) {
		const cnode = children[i];
		const isTextOrCData = cnode.nodeType === 3 || cnode.nodeType === 4;
		if (childCount > 1 && i === 0 && isTextOrCData) {
			result += " ";
		}
		if (isTextOrCData) {
			result += escapeTextForXml((cnode as XCharacterData).data ?? "");
		} else if (cnode.nodeType === 1) {
			result += nodeToXml(cnode as unknown as XElement, "", "", "");
		}
		if (childCount > 1 && i + 1 === childCount) {
			result += " ";
		}
	}
	return result;
}

/** Serialize element-only children with indentation. */
function serializeElementChildren(
	elem: XElement,
	indent: string,
	addindent: string,
	newl: string,
): string {
	let result = newl;
	for (const cnode of toArray(elem.childNodes)) {
		if (cnode.nodeType === 1) {
			result += nodeToXml(
				cnode as unknown as XElement,
				`${indent}${addindent}`,
				addindent,
				newl,
			);
		}
	}
	result += indent;
	return result;
}

/**
 * Serialize an Element to XML string using pyxform-compatible escaping.
 * Equivalent to Python's DetachableElement.writexml + PatchedText.writexml.
 * Only escapes what is necessary: [&<>] in text, [&<>"] in attributes.
 * Does NOT escape ', \r, \n, \t (unlike standard XML serializers).
 */
export function nodeToXml(
	elem: XElement,
	indent = "",
	addindent = "",
	newl = "",
): string {
	let result = `${indent}<${elem.tagName}`;
	result += serializeAttributes(elem);

	if (!elem.childNodes || elem.childNodes.length === 0) {
		return `${result}/>${newl}`;
	}

	result += ">";

	if (hasTextOrCDataChild(elem)) {
		result += serializeMixedContent(elem);
	} else {
		result += serializeElementChildren(elem, indent, addindent, newl);
	}

	result += `</${elem.tagName}>${newl}`;
	return result;
}

export function serializeXml(
	element: XElement | XDocument,
	prettyPrint = false,
): string {
	let xml = xmlSerializer.serializeToString(element);
	if (prettyPrint) {
		xml = formatXml(xml);
	}
	return xml;
}

/** Split XML string into tag and text tokens. */
function tokenizeXml(xml: string): string[] {
	const tokens: string[] = [];
	let pos = 0;
	while (pos < xml.length) {
		if (xml[pos] === "<") {
			const end = xml.indexOf(">", pos);
			if (end < 0) {
				break;
			}
			tokens.push(xml.substring(pos, end + 1));
			pos = end + 1;
		} else {
			const end = xml.indexOf("<", pos);
			const text = end < 0 ? xml.substring(pos) : xml.substring(pos, end);
			tokens.push(text);
			pos = end < 0 ? xml.length : end;
		}
	}
	return tokens;
}

/**
 * Try to collect inline content from an opening tag to its matching close tag.
 * Returns { content, skipTo } if inlinable, or null if block formatting is needed.
 */
function tryInlineContent(
	tokens: string[],
	start: number,
	closingTag: string,
): { content: string; skipTo: number } | null {
	let content = "";
	let ahead = start;

	while (ahead < tokens.length) {
		const next = tokens[ahead];
		if (next === closingTag || next.trim() === closingTag) {
			break;
		}
		if (
			next.startsWith("<") &&
			!next.startsWith("</") &&
			!next.endsWith("/>")
		) {
			return null;
		}
		content += next;
		ahead++;
	}

	if (ahead >= tokens.length || content.length >= 500) {
		return null;
	}

	return { content, skipTo: ahead };
}

/** Format a single token, returning the formatted line and updated state. */
function formatToken(
	token: string,
	tokens: string[],
	index: number,
	depth: number,
	indent: string,
): { line: string; depth: number; skipTo: number } {
	if (token.startsWith("<?")) {
		return { line: `${token}\n`, depth, skipTo: index };
	}
	if (token.startsWith("</")) {
		const newDepth = depth - 1;
		return {
			line: `${indent.repeat(newDepth) + token}\n`,
			depth: newDepth,
			skipTo: index,
		};
	}
	if (token.startsWith("<") && token.endsWith("/>")) {
		return {
			line: `${indent.repeat(depth) + token}\n`,
			depth,
			skipTo: index,
		};
	}
	if (token.startsWith("<")) {
		return formatOpeningTag(token, tokens, index, depth, indent);
	}
	// Pure text node
	return {
		line: `${indent.repeat(depth) + token.trim()}\n`,
		depth,
		skipTo: index,
	};
}

function formatOpeningTag(
	token: string,
	tokens: string[],
	index: number,
	depth: number,
	indent: string,
): { line: string; depth: number; skipTo: number } {
	const tagMatch = token.match(/^<([^\s>/]+)/);
	const tagName = tagMatch ? tagMatch[1] : "";
	const closingTag = `</${tagName}>`;
	const prefix = indent.repeat(depth);

	const inline = tryInlineContent(tokens, index + 1, closingTag);
	if (inline) {
		if (inline.content.length === 0) {
			// Empty element: <tag></tag> -> <tag/>
			return {
				line: `${prefix + token.replace(/>$/, "/>")}\n`,
				depth,
				skipTo: inline.skipTo,
			};
		}
		return {
			line: `${prefix + token + inline.content + closingTag}\n`,
			depth,
			skipTo: inline.skipTo,
		};
	}

	return {
		line: `${prefix + token}\n`,
		depth: depth + 1,
		skipTo: index,
	};
}

function formatXml(xml: string, indent = "  "): string {
	const tokens = tokenizeXml(xml);
	let formatted = "";
	let depth = 0;

	for (let t = 0; t < tokens.length; t++) {
		const token = tokens[t];
		if (!token.trim()) {
			continue;
		}

		const result = formatToken(token, tokens, t, depth, indent);
		formatted += result.line;
		depth = result.depth;
		t = result.skipTo;
	}
	return formatted;
}

export function coalesce<T>(...args: (T | null | undefined)[]): T | undefined {
	for (const a of args) {
		if (a != null) {
			return a;
		}
	}
	return undefined;
}
