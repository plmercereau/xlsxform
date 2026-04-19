/**
 * Node.js extension for xform2json - adds file-path fallback to _tryParse.
 */

import * as fs from "node:fs";
import { DOMParser, type Element as XmlElement } from "@xmldom/xmldom";
import type { DOMParserOptions } from "@xmldom/xmldom";
import { IOError, XMLParseError } from "../../src/conversion/xform2json.js";

/**
 * Try to parse the root from an XML string or a file path.
 * This is the Node.js version that falls back to reading from disk.
 */
export function tryParseFromFile(root: string): XmlElement {
	// First, try parsing as XML string
	let parseErrors: string[] = [];
	const onError = (_level: string, msg: string) => {
		parseErrors.push(msg);
	};
	const parser = new DOMParser({ onError } as DOMParserOptions);

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
		const fileParser = new DOMParser({ onError } as DOMParserOptions);
		try {
			const doc = fileParser.parseFromString(content, "text/xml");
			const docEl = doc?.documentElement;
			if (
				docEl &&
				parseErrors.length === 0 &&
				docEl.nodeName !== "parsererror"
			) {
				return docEl;
			}
		} catch (_e) {
			// xmldom may throw ParseError for invalid content
		}
		throw new XMLParseError(`Failed to parse XML from file: ${root}`);
	}

	throw new IOError(
		"Could not parse XML string and input is not a valid file path.",
	);
}

/**
 * Check if a string looks like a file path rather than XML content.
 */
function _looksLikePath(s: string): boolean {
	const trimmed = s.trim();
	if (trimmed.startsWith("<")) {
		return false;
	}
	return true;
}
