/**
 * Translation completeness checking for XLSForm sheets.
 */

import * as constants from "./constants.js";

/**
 * Detect all languages used in sheet headers and find missing translations.
 * Mirrors Python pyxform's SheetTranslations / Translations classes.
 */
export class TranslationChecker {
	seen: Record<string, string[]> = {};
	columnsSeen: Set<string> = new Set();
	missing: Record<string, string[]> = {};

	constructor(
		headers: string[],
		translatableColumns: Record<string, string | [string, string]>,
	) {
		this._findTranslations(headers, translatableColumns);
		this._findMissing();
	}

	private _findTranslations(
		headers: string[],
		translatableColumns: Record<string, string | [string, string]>,
	) {
		const useDoubleColon = headers.some((h) => h.includes("::"));
		const delimiter = useDoubleColon ? "::" : ":";
		for (const header of headers) {
			const tokens = this._extractTokens(header, delimiter, useDoubleColon);
			if (tokens.length === 0) {
				continue;
			}

			const colName = tokens[0].toLowerCase();
			if (!(colName in translatableColumns)) {
				continue;
			}

			const mapped = translatableColumns[colName];
			const name = Array.isArray(mapped) ? colName : mapped;
			const lang =
				tokens.length >= 2 ? tokens[1] : constants.DEFAULT_LANGUAGE_VALUE;

			if (!this.seen[lang]) {
				this.seen[lang] = [];
			}
			if (!this.seen[lang].includes(name)) {
				this.seen[lang].push(name);
			}
			this.columnsSeen.add(name);
		}
	}

	private _extractTokens(
		header: string,
		delimiter: string,
		useDoubleColon: boolean,
	): string[] {
		let parts = header.split(delimiter).map((p) => p.trim());
		if (
			!useDoubleColon &&
			parts.length >= 2 &&
			parts[0].toLowerCase() === "jr"
		) {
			parts = [`jr:${parts[1]}`, ...parts.slice(2)];
		}
		const prefix = parts.length >= 2 ? parts[0].toLowerCase() : "";
		if (prefix === "media" || prefix === "bind") {
			return parts.slice(1);
		}
		return parts;
	}

	seenDefaultOnly(): boolean {
		const langs = Object.keys(this.seen);
		return (
			langs.length === 0 ||
			(langs.length === 1 && constants.DEFAULT_LANGUAGE_VALUE in this.seen)
		);
	}

	private _findMissing() {
		if (this.seenDefaultOnly()) {
			return;
		}
		for (const lang of Object.keys(this.seen)) {
			const langTrans = this.seen[lang];
			for (const seenTran of this.columnsSeen) {
				if (!langTrans.includes(seenTran)) {
					if (!this.missing[lang]) {
						this.missing[lang] = [];
					}
					this.missing[lang].push(seenTran);
				}
			}
		}
	}
}

export function formatMissingTranslationsMsg(
	_in: Record<string, Record<string, string[]>>,
): string | null {
	function getSheetMsg(
		name: string,
		sheet?: Record<string, string[]>,
	): string | null {
		if (!sheet) {
			return null;
		}
		const langs = Object.keys(sheet).sort();
		if (langs.length === 0) {
			return null;
		}
		const langMsgs: string[] = [];
		for (const lang of langs) {
			const cols = sheet[lang];
			if (cols.length === 1) {
				langMsgs.push(
					`Language '${lang}' is missing the ${name} ${cols[0]} column.`,
				);
			}
			if (cols.length > 1) {
				const c = [...cols].sort().join(", ");
				langMsgs.push(
					`Language '${lang}' is missing the ${name} columns ${c}.`,
				);
			}
		}
		return langMsgs.join("\n");
	}

	const survey = getSheetMsg(constants.SURVEY, _in[constants.SURVEY]);
	const choices = getSheetMsg(constants.CHOICES, _in[constants.CHOICES]);
	const messages = [survey, choices].filter((m): m is string => m !== null);
	if (messages.length === 0) {
		return null;
	}
	return messages.join("\n");
}

export const OR_OTHER_WARNING =
	"This form uses or_other and translations, which is not recommended. " +
	"An untranslated input question label and choice label is generated " +
	"for 'other'. Learn more: https://xlsform.org/en/#specify-other).";
