/**
 * Node.js file-writing helpers for Survey objects.
 */

import * as fs from "node:fs";
import type { Survey } from "../../src/survey.js";

/**
 * Dump the survey as JSON to a file.
 */
export function surveyJsonDump(survey: Survey, filePath?: string): void {
	const fp = filePath ?? `${survey.name}.json`;
	const jsonStr = JSON.stringify(survey.toJsonDict(), null, 2);
	fs.writeFileSync(fp, jsonStr, "utf-8");
}

/**
 * Print the XForm XML to a file.
 */
export function surveyPrintXformToFile(
	survey: Survey,
	outputPath: string,
	opts?: { warnings?: string[] },
): void {
	const warnings = opts?.warnings ?? [];
	const xform = survey.toXml({ warnings });
	fs.writeFileSync(outputPath, xform, "utf-8");
}
