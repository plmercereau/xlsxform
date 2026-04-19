/**
 * Choice option data classes for multiple choice questions.
 */

import { hasPyxformReference } from "../parsing/expression.js";
import { SurveyElement } from "./survey-element.js";

interface OptionData {
	name: string;
	label?: string | Record<string, string> | null;
	media?: Record<string, string> | null;
	sms_option?: string | null;
	[key: string]: unknown;
}

export class Option extends SurveyElement {
	sms_option: string | null;
	_choice_itext_ref: string | null = null;

	constructor(data: OptionData) {
		super({ ...data, media: data.media ?? null });
		this.sms_option = data.sms_option ?? null;
	}

	validate(): void {
		// Options don't need XML tag validation
	}
}

export class Itemset {
	name: string;
	options: Option[];
	requires_itext: boolean;
	used_by_search: boolean;

	constructor(name: string, choices: Record<string, unknown>[]) {
		this.name = name;
		this.requires_itext = false;
		this.used_by_search = false;
		this.options = [];

		for (const c of choices) {
			const option = new Option(c as OptionData);
			this.options.push(option);

			if (!this.requires_itext) {
				if (option.media) {
					this.requires_itext = true;
				} else if (typeof option.label === "object" && option.label !== null) {
					this.requires_itext = true;
				} else if (
					option.label &&
					typeof option.label === "string" &&
					hasPyxformReference(option.label)
				) {
					this.requires_itext = true;
				}
			}
		}
	}
}
