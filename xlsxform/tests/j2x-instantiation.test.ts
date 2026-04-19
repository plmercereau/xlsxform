/**
 * Port of test_j2x_instantiation.py - Testing the instance object for pyxform.
 */

import { describe, expect, it } from "vitest";
import { createSurveyElementFromDict } from "../src/model/builder.js";
import { SurveyInstance } from "../src/model/instance.js";
import { Survey } from "../src/model/survey.js";

describe("Json2XformExportingPrepTests", () => {
	it("test_simple_survey_instantiation", () => {
		const surv = new Survey({ name: "Simple", type: "survey" });
		const q = createSurveyElementFromDict({
			type: "text",
			name: "survey_question",
			label: "Question",
		});
		surv.addChild(q);

		const i = surv.instantiate();

		expect(i.keys()).toEqual(["survey_question"]);
		expect(new Set(i.xpaths())).toEqual(
			new Set(["/Simple", "/Simple/survey_question"]),
		);
	});

	it("test_simple_survey_answering", () => {
		const surv = new Survey({ name: "Water", type: "survey" });
		const q = createSurveyElementFromDict({
			type: "text",
			name: "color",
			label: "Color",
		});
		const q2 = createSurveyElementFromDict({
			type: "text",
			name: "feeling",
			label: "Feeling",
		});

		surv.addChild(q);
		surv.addChild(q2);
		const i = new SurveyInstance(surv);

		i.answer({ name: "color", value: "blue" });
		expect(i.answers().color).toBe("blue");

		i.answer({ name: "feeling", value: "liquidy" });
		expect(i.answers().feeling).toBe("liquidy");
	});

	it("test_answers_can_be_imported_from_xml", () => {
		const surv = new Survey({ name: "data", type: "survey" });

		surv.addChild(
			createSurveyElementFromDict({
				type: "text",
				name: "name",
				label: "Name",
			}),
		);
		surv.addChild(
			createSurveyElementFromDict({
				type: "integer",
				name: "users_per_month",
				label: "Users per month",
			}),
		);
		surv.addChild(
			createSurveyElementFromDict({
				type: "gps",
				name: "geopoint",
				label: "gps",
			}),
		);
		surv.addChild(
			createSurveyElementFromDict({
				type: "imei",
				name: "device_id",
			}),
		);

		const instance = surv.instantiate();
		const importXml =
			"<?xml version='1.0' ?><data id=\"build_WaterSimple_1295821382\"><name>JK Resevoir</name><users_per_month>300</users_per_month><geopoint>40.783594633609184 -73.96436698913574 300.0 4.0</geopoint></data>";
		instance.importFromXml(importXml);
	});

	it("test_simple_registration_xml", () => {
		const regXform = new Survey({ name: "Registration", type: "survey" });
		const nameQuestion = createSurveyElementFromDict({
			type: "text",
			name: "name",
			label: "Name",
		});
		regXform.addChild(nameQuestion);

		const regInstance = regXform.instantiate();

		regInstance.answer({ name: "name", value: "bob" });

		const rx = regInstance.toXml();
		const expectedXml = `<?xml version='1.0' ?><Registration id="${regXform.id_string}"><name>bob</name></Registration>`;
		expect(rx).toBe(expectedXml);
	});
});
