/**
 * Port of pyxform/validators/pyxform/iana_subtags/validation.py
 * Validates language declarations against IANA language subtag registry.
 */

import tags from "language-tags";

const LANG_CODE_REGEX = /\((.*)\)$/;

/**
 * Returns languages with invalid or missing IANA subtags.
 */
export function getLanguagesWithBadTags(languages: string[]): string[] {
	return languages.filter((lang) => {
		if (lang === "default" || lang.length < 3) {
			return false;
		}
		const langCode = LANG_CODE_REGEX.exec(lang);
		if (!langCode) {
			return true;
		}
		return !tags.check(langCode[1]);
	});
}
