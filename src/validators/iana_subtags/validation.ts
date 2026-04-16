/**
 * Port of pyxform/validators/pyxform/iana_subtags/validation.py
 * Validates language declarations against IANA language subtag registry.
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const LANG_CODE_REGEX = /\((.*)\)$/;

const __dirname_ = dirname(fileURLToPath(import.meta.url));

let _tags2: Set<string> | null = null;
let _tags3: Set<string> | null = null;

function readTags(fileName: string): Set<string> {
	const filePath = join(__dirname_, fileName);
	const content = readFileSync(filePath, "utf-8");
	return new Set(
		content
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0),
	);
}

function getTags2(): Set<string> {
	if (!_tags2) {
		_tags2 = readTags("iana_subtags_2_characters.txt");
	}
	return _tags2;
}

function getTags3(): Set<string> {
	if (!_tags3) {
		_tags3 = readTags("iana_subtags_3_or_more_characters.txt");
	}
	return _tags3;
}

/**
 * Returns languages with invalid or missing IANA subtags.
 */
export function getLanguagesWithBadTags(languages: string[]): string[] {
	const languagesWithBadTags: string[] = [];
	for (const lang of languages) {
		// Minimum matchable lang code attempt requires 3 characters e.g. "a()".
		if (lang === "default" || lang.length < 3) {
			continue;
		}
		const langCode = LANG_CODE_REGEX.exec(lang);
		if (!langCode) {
			languagesWithBadTags.push(lang);
		} else {
			const langMatch = langCode[1];
			// Check the short list first: ~190 short codes vs ~8000 long codes.
			if (getTags2().has(langMatch)) {
				continue;
			}
			if (getTags3().has(langMatch)) {
				continue;
			}
			languagesWithBadTags.push(lang);
		}
	}
	return languagesWithBadTags;
}
