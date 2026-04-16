/**
 * Port of pyxform/validators/pyxform/iana_subtags/validation.py
 * Validates language declarations against IANA language subtag registry.
 */

import { TAGS_2, TAGS_3 } from "./iana-subtags-data.js";

const LANG_CODE_REGEX = /\((.*)\)$/;

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
			if (TAGS_2.has(langMatch)) {
				continue;
			}
			if (TAGS_3.has(langMatch)) {
				continue;
			}
			languagesWithBadTags.push(lang);
		}
	}
	return languagesWithBadTags;
}
