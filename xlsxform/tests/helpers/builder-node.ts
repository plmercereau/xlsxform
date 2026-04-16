/**
 * Node.js file-based builder functions.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
	createSurvey,
	createSurveyElementFromDict,
} from "../../src/builder.js";
import type { Survey } from "../../src/survey.js";
import { parseFileToJson } from "./xls2json-node.js";

/**
 * Create a Survey from an XLS/XLSX/CSV file path.
 */
export function createSurveyFromXls(
	pathOrFile: string,
	defaultName?: string,
): Survey {
	const name = defaultName ?? undefined;
	const d = parseFileToJson(pathOrFile, { defaultName: name });
	const readerName =
		defaultName ?? path.basename(pathOrFile, path.extname(pathOrFile));
	const survey = createSurveyElementFromDict(d) as Survey;
	if (!survey.id_string) {
		survey.id_string = readerName;
	}
	return survey;
}

function sectionName(pathOrFileName: string): string {
	const basename = path.basename(pathOrFileName);
	const ext = path.extname(basename);
	return basename.slice(0, basename.length - ext.length);
}

function loadFileToDict(filePath: string): [string, Record<string, unknown>] {
	const name = sectionName(filePath);
	if (filePath.endsWith(".json")) {
		const content = fs.readFileSync(filePath, "utf-8");
		return [name, JSON.parse(content)];
	}
	return [name, parseFileToJson(filePath, { defaultName: name })];
}

/**
 * Create a Survey from a file path (XLS, XLSX, CSV, or JSON).
 */
export function createSurveyFromPath(
	filePath: string,
	includeDirectory = false,
): Survey {
	let nameOfMainSection: string;
	let sections: Record<string, Record<string, unknown>>;

	if (includeDirectory) {
		nameOfMainSection = sectionName(filePath);
		const dir = path.dirname(filePath);
		sections = collectCompatibleFiles(dir);
	} else {
		const [name, section] = loadFileToDict(filePath);
		nameOfMainSection = name;
		sections = { [name]: section };
	}

	return createSurvey({
		nameOfMainSection,
		sections,
	});
}

function collectCompatibleFiles(
	directory: string,
): Record<string, Record<string, unknown>> {
	const sections: Record<string, Record<string, unknown>> = {};
	const files = fs.readdirSync(directory);
	for (const file of files) {
		if (
			file.endsWith(".xls") ||
			file.endsWith(".xlsx") ||
			file.endsWith(".json")
		) {
			const fullPath = path.join(directory, file);
			const [name, section] = loadFileToDict(fullPath);
			sections[name] = section;
		}
	}
	return sections;
}
