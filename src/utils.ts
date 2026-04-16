import { DOMImplementation, DOMParser, XMLSerializer } from "@xmldom/xmldom";
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
 * Register a custom namespace prefix→URI mapping for use in element/attribute creation.
 */
export function registerNamespace(prefix: string, uri: string): void {
	dynamicNS[prefix] = uri;
}

export function setAttributeWithNS(
	elem: Element,
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

function createElementWithNS(doc: Document, tag: string): Element {
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

export function escapeTextForXml(text: string, attribute = false): string {
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

/**
 * Create an XML element with children and attributes.
 * String args become text nodes. Element args become child elements.
 */
export function xmlNode(tag: string, ...args: any[]): Element {
	const doc: any = domImpl.createDocument(
		null as any,
		null as any,
		null as any,
	);
	const elem = createElementWithNS(doc, tag);

	const stringArgs: string[] = [];
	const otherArgs: any[] = [];

	for (const arg of args) {
		if (typeof arg === "string") {
			stringArgs.push(arg);
		} else {
			otherArgs.push(arg);
		}
	}

	// Extract kwargs (last arg if it's a plain object with no tagName)
	let kwargs: Record<string, string> = {};
	if (
		otherArgs.length > 0 &&
		otherArgs[otherArgs.length - 1] &&
		typeof otherArgs[otherArgs.length - 1] === "object" &&
		!otherArgs[otherArgs.length - 1].tagName &&
		!Array.isArray(otherArgs[otherArgs.length - 1]) &&
		!Array.isArray(otherArgs[otherArgs.length - 1])
	) {
		const last = otherArgs[otherArgs.length - 1];
		// Check if it looks like attributes (not an Element)
		if (!last.nodeType) {
			kwargs = otherArgs.pop();
		}
	}

	if (stringArgs.length > 1) {
		throw new PyXFormError("Invalid value for string args.");
	}
	if (stringArgs.length === 1) {
		const textNode = doc.createTextNode(stringArgs[0]);
		elem.appendChild(textNode);
	}

	// Set attributes
	for (const [k, v] of Object.entries(kwargs)) {
		setAttributeWithNS(elem, k, v);
	}

	// Append child elements
	for (const child of otherArgs) {
		if (child == null) continue;
		if (typeof child === "number") {
			elem.appendChild(doc.createTextNode(String(child)));
		} else if (child.nodeType) {
			// It's a DOM node - import it
			const imported = doc.importNode(child, true);
			elem.appendChild(imported);
		} else if (Array.isArray(child)) {
			for (const c of child) {
				if (c?.nodeType) {
					elem.appendChild(doc.importNode(c, true));
				}
			}
		}
	}

	return elem;
}

/**
 * Create an XML node with named parameters approach.
 * More aligned with the Python node() function signature.
 */
export function node(
	tag: string,
	opts: {
		children?: (Element | string | number | null | undefined)[];
		text?: string;
		toParseString?: boolean;
		attrs?: Record<string, string>;
	} = {},
): Element {
	const doc: any = domImpl.createDocument(
		null as any,
		null as any,
		null as any,
	);
	const elem = createElementWithNS(doc, tag);

	if (opts.text != null) {
		if (opts.toParseString) {
			// Parse the text as XML and import child nodes
			const wrapper = `<?xml version="1.0" ?><${tag}>${opts.text}</${tag}>`;
			const parsed = domParser.parseFromString(wrapper, "text/xml");
			const root = parsed.documentElement;
			if (root) {
				const childCount = root.childNodes.length;
				for (let i = 0; i < childCount; i++) {
					const child = root.childNodes[i];
					// Replicate Python pyxform's mixed-content spacing (DetachableElement.writexml):
					// If multiple children and the first child is a text node, prepend a space
					if (childCount > 1 && i === 0 && child.nodeType === 3) {
						elem.appendChild(doc.createTextNode(" "));
					}
					elem.appendChild(doc.importNode(child, true));
					// If multiple children and this is the last child, append a space
					if (childCount > 1 && i === childCount - 1) {
						elem.appendChild(doc.createTextNode(" "));
					}
				}
			}
		} else {
			elem.appendChild(doc.createTextNode(opts.text));
		}
	}

	if (opts.attrs) {
		// Sort: plain attrs alphabetically, then namespaced attrs alphabetically
		const sortedKeys = Object.keys(opts.attrs).sort((a, b) => {
			const aHasNs = a.includes(":");
			const bHasNs = b.includes(":");
			if (aHasNs !== bHasNs) return aHasNs ? 1 : -1;
			return a.localeCompare(b);
		});
		for (const k of sortedKeys) {
			setAttributeWithNS(elem, k, opts.attrs[k]);
		}
	}

	if (opts.children) {
		for (const child of opts.children) {
			if (child == null) continue;
			if (typeof child === "string") {
				elem.appendChild(doc.createTextNode(child));
			} else if (typeof child === "number") {
				elem.appendChild(doc.createTextNode(String(child)));
			} else if (child.nodeType) {
				elem.appendChild(doc.importNode(child, true));
			}
		}
	}

	return elem;
}

/**
 * Serialize an Element to XML string using pyxform-compatible escaping.
 * Equivalent to Python's DetachableElement.writexml + PatchedText.writexml.
 * Only escapes what is necessary: [&<>] in text, [&<>"] in attributes.
 * Does NOT escape ', \r, \n, \t (unlike standard XML serializers).
 */
export function nodeToXml(
	elem: Element,
	indent = "",
	addindent = "",
	newl = "",
): string {
	let result = `${indent}<${elem.tagName}`;

	// Write attributes
	if (elem.attributes) {
		for (let i = 0; i < elem.attributes.length; i++) {
			const attr = elem.attributes[i];
			result += ` ${attr.name}="${escapeTextForXml(attr.value, true)}"`;
		}
	}

	if (elem.childNodes && elem.childNodes.length > 0) {
		result += ">";
		// Check if any child is a text node
		let hasTextNode = false;
		for (let i = 0; i < elem.childNodes.length; i++) {
			const cnode = elem.childNodes[i];
			if (cnode.nodeType === 3 || cnode.nodeType === 4) {
				hasTextNode = true;
				break;
			}
		}

		if (hasTextNode) {
			// For text or mixed content, write without adding indents or newlines
			const childCount = elem.childNodes.length;
			for (let i = 0; i < childCount; i++) {
				const cnode = elem.childNodes[i];
				if (
					childCount > 1 &&
					i === 0 &&
					(cnode.nodeType === 3 || cnode.nodeType === 4)
				) {
					result += " ";
				}
				if (cnode.nodeType === 3 || cnode.nodeType === 4) {
					result += escapeTextForXml(cnode.data ?? "");
				} else if (cnode.nodeType === 1) {
					result += nodeToXml(cnode as Element, "", "", "");
				}
				if (childCount > 1 && i + 1 === childCount) {
					result += " ";
				}
			}
		} else {
			result += newl;
			for (let i = 0; i < elem.childNodes.length; i++) {
				const cnode = elem.childNodes[i];
				if (cnode.nodeType === 1) {
					result += nodeToXml(
						cnode as Element,
						`${indent}${addindent}`,
						addindent,
						newl,
					);
				}
			}
			result += indent;
		}
		result += `</${elem.tagName}>${newl}`;
	} else {
		result += `/>${newl}`;
	}

	return result;
}

export function serializeXml(element: any, prettyPrint = false): string {
	let xml = xmlSerializer.serializeToString(element);
	if (prettyPrint) {
		xml = formatXml(xml);
	}
	return xml;
}

function formatXml(xml: string, indent = "  "): string {
	// Tokenize: split XML into tags and text segments
	const tokens: string[] = [];
	let pos = 0;
	while (pos < xml.length) {
		if (xml[pos] === "<") {
			const end = xml.indexOf(">", pos);
			if (end < 0) break;
			tokens.push(xml.substring(pos, end + 1));
			pos = end + 1;
		} else {
			const end = xml.indexOf("<", pos);
			const text = end < 0 ? xml.substring(pos) : xml.substring(pos, end);
			tokens.push(text);
			pos = end < 0 ? xml.length : end;
		}
	}

	let formatted = "";
	let depth = 0;

	for (let t = 0; t < tokens.length; t++) {
		const token = tokens[t];
		const trimmedToken = token.trim();
		if (!trimmedToken) continue;

		if (token.startsWith("<?")) {
			formatted += `${token}\n`;
		} else if (token.startsWith("</")) {
			depth--;
			formatted += `${indent.repeat(depth) + token}\n`;
		} else if (token.startsWith("<") && token.endsWith("/>")) {
			formatted += `${indent.repeat(depth) + token}\n`;
		} else if (token.startsWith("<")) {
			// Opening tag - look ahead for inline/mixed content
			const tagMatch = token.match(/^<([^\s>/]+)/);
			const tagName = tagMatch ? tagMatch[1] : "";
			const closingTag = `</${tagName}>`;

			// Collect inline content until we find the matching closing tag
			// or discover nested opening tags that need indentation
			let inlineContent = "";
			let ahead = t + 1;
			let canInline = true;

			while (ahead < tokens.length) {
				const next = tokens[ahead];
				if (next === closingTag || next.trim() === closingTag) {
					break;
				}
				// Another opening tag (not self-closing) means we need block formatting
				if (
					next.startsWith("<") &&
					!next.startsWith("</") &&
					!next.endsWith("/>")
				) {
					canInline = false;
					break;
				}
				inlineContent += next;
				ahead++;
			}

			if (canInline && ahead < tokens.length && inlineContent.length < 500) {
				if (inlineContent.length === 0) {
					// Empty element: <tag></tag> → <tag/>
					formatted += `${indent.repeat(depth) + token.replace(/>$/, "/>")}\n`;
				} else {
					formatted += `${indent.repeat(depth) + token + inlineContent + closingTag}\n`;
				}
				t = ahead; // skip past closing tag
			} else {
				formatted += `${indent.repeat(depth) + token}\n`;
				depth++;
			}
		} else {
			// Pure text node (shouldn't normally happen at top level after tokenizing)
			formatted += `${indent.repeat(depth) + trimmedToken}\n`;
		}
	}
	return formatted;
}

export function coalesce<T>(...args: (T | null | undefined)[]): T | undefined {
	for (const a of args) {
		if (a != null) return a;
	}
	return undefined;
}
