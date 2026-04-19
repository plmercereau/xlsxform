/**
 * RangeQuestion - range/slider question type.
 */

import type {
	Document as XDocument,
	Element as XElement,
} from "@xmldom/xmldom";
import * as constants from "../constants.js";
import { PyXFormError } from "../errors.js";
import { node, setAttributeWithNS } from "../utils.js";
import { Question } from "./question.js";
import type { SurveyContext } from "./survey-element.js";

// Use xmldom's Element type throughout (returned by node() from utils.ts)
type Element = XElement;

// Maps range parameter names to their XML attribute names
const RANGE_PARAM_MAP: Record<string, string> = {
	start: "start",
	end: "end",
	step: "step",
	tick_interval: "odk:tick-interval",
	placeholder: "odk:placeholder",
};

export class RangeQuestion extends Question {
	itemset: string | null;
	list_name: string | null;

	constructor(
		data: ConstructorParameters<typeof Question>[0] & {
			itemset?: string | null;
			list_name?: string | null;
		},
	) {
		super(data);
		this.itemset = data.itemset ?? null;
		this.list_name = data.list_name ?? null;
	}

	protected buildXml(survey: SurveyContext): Element | null {
		if (
			!(
				this.bind?.type && ["int", "decimal"].includes(this.bind.type as string)
			)
		) {
			throw new PyXFormError(`Invalid value for bind type: ${this.bind?.type}`);
		}

		const result = this._buildXml(survey);
		if (!result) {
			return null;
		}

		if (this.parameters) {
			for (const [k, v] of Object.entries(this.parameters)) {
				if (k === "tick_labelset") {
					continue; // Handled as itemset below
				}
				const xmlAttr = RANGE_PARAM_MAP[k] ?? k;
				setAttributeWithNS(result, xmlAttr, v);
			}

			// Handle tick_labelset as an itemset
			if (this.parameters.tick_labelset) {
				const listName = this.parameters.tick_labelset;
				const itemsetElem = node("itemset", {
					children: [
						node("value", {
							attrs: { ref: constants.DEFAULT_ITEMSET_VALUE_REF },
						}),
						node("label", {
							attrs: { ref: constants.DEFAULT_ITEMSET_LABEL_REF },
						}),
					],
					attrs: { nodeset: `instance('${listName}')/root/item` },
				});
				result.appendChild(
					(result.ownerDocument as XDocument).importNode(itemsetElem, true),
				);
			}
		}

		return result;
	}
}
