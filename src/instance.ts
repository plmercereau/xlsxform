/**
 * SurveyInstance class - represents a filled-in survey with answers.
 * Port of pyxform/instance.py.
 */

import { PyXFormError } from "./errors.js";
import type { Survey } from "./survey.js";
import { parseXformInstance } from "./xform-instance-parser.js";

export class SurveyInstance {
	private _survey: Survey;
	private _keys: string[];
	private _name: string;
	private _id: string;
	private _xpaths: string[];
	private _answers: Record<string, string>;
	private _orphanAnswers: Record<string, string>;

	constructor(surveyObject: Survey) {
		this._survey = surveyObject;
		this._keys = surveyObject.children.map((c) => c.name);
		this._name = surveyObject.name;
		this._id = surveyObject.id_string;

		// Setup xpath dictionary so we can track valid question names
		surveyObject.setupXpathDictionary();

		// Collect xpaths: the survey itself + all descendants
		this._xpaths = [];
		for (const element of surveyObject.iterDescendants()) {
			this._xpaths.push(element.getXpath());
		}

		this._answers = {};
		this._orphanAnswers = {};
	}

	keys(): string[] {
		return this._keys;
	}

	xpaths(): string[] {
		return this._xpaths;
	}

	answer({ name, value }: { name: string; value: string }): void {
		if (name == null) {
			throw new PyXFormError("In answering, name must be given");
		}

		if (name in this._survey._xpath_dictionary) {
			this._answers[name] = value;
		} else {
			this._orphanAnswers[name] = value;
		}
	}

	answers(): Record<string, string> {
		return this._answers;
	}

	toJsonDict(): Record<string, unknown> {
		const children = Object.entries(this._answers).map(([k, v]) => ({
			node_name: k,
			value: v,
		}));
		return { node_name: this._name, id: this._id, children };
	}

	toXml(): string {
		const openStr = `<?xml version='1.0' ?><${this._name} id="${this._id}">`;
		const closeStr = `</${this._name}>`;
		let vals = "";
		for (const [k, v] of Object.entries(this._answers)) {
			vals += `<${k}>${String(v)}</${k}>`;
		}
		return openStr + vals + closeStr;
	}

	importFromXml(xmlStringOrFilename: string): void {
		// In the TypeScript port, we only support XML strings (not file paths)
		const keyValDict = parseXformInstance(xmlStringOrFilename);
		for (const [k, v] of Object.entries(keyValDict)) {
			if (v != null) {
				this.answer({ name: k, value: String(v) });
			}
		}
	}

	toString(): string {
		const orphanCount = Object.keys(this._orphanAnswers).length;
		const placedCount = Object.keys(this._answers).length;
		const answerCount = orphanCount + placedCount;
		return `<Instance (${answerCount} answers: ${placedCount} placed. ${orphanCount} orphans)>`;
	}
}
