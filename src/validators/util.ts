/**
 * The validators utility functions.
 * Ported from pyxform/validators/util.py
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { PyXFormError } from "../errors.js";

export const HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname));

/**
 * HTTP GET request. Returns the response as a Buffer.
 */
export async function requestGet(url: string): Promise<Buffer> {
	if (!url.startsWith("http:") && !url.startsWith("https:")) {
		throw new PyXFormError("URL must start with 'http:' or 'https:'");
	}
	try {
		const response = await fetch(url, {
			headers: { Accept: "application/json" },
		});
		if (!response.ok) {
			throw new PyXFormError(
				`Unable to fulfill request. Error code: '${response.status}'. ` +
					`Reason: '${response.statusText}'. URL: '${url}'.`,
			);
		}
		const arrayBuffer = await response.arrayBuffer();
		const content = Buffer.from(arrayBuffer);
		if (content.length === 0) {
			throw new PyXFormError(`Empty response from URL: '${url}'.`);
		}
		return content;
	} catch (err) {
		if (err instanceof PyXFormError) {
			throw err;
		}
		throw new PyXFormError(
			`Unable to reach a server. Reason: ${err instanceof Error ? err.message : String(err)}. URL: ${url}`,
		);
	}
}

/**
 * Logging watcher - captures log records and output by level.
 */
export interface LogRecord {
	level: string;
	message: string;
}

export interface LoggingWatcher {
	records: LogRecord[];
	output: Record<string, string[]>;
}

/**
 * A capturing handler for log messages (replaces Python's CapturingHandler).
 */
export class CapturingHandler {
	watcher: LoggingWatcher;

	constructor() {
		this.watcher = CapturingHandler._getWatcher();
	}

	info(message: string): void {
		const record: LogRecord = { level: "INFO", message };
		this.watcher.records.push(record);
		this.watcher.output.INFO.push(message);
	}

	reset(): void {
		this.watcher = CapturingHandler._getWatcher();
	}

	private static _getWatcher(): LoggingWatcher {
		const levels = ["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"];
		const output: Record<string, string[]> = {};
		for (const level of levels) {
			output[level] = [];
		}
		return { records: [], output };
	}
}

/**
 * Check if a command is available on PATH (like shutil.which in Python).
 */
export function which(cmd: string): string | null {
	const pathEnv = process.env.PATH || "";
	const pathDirs = pathEnv.split(path.delimiter);
	const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ".com", ""] : [""];

	for (const dir of pathDirs) {
		for (const ext of extensions) {
			const fullPath = path.join(dir, cmd + ext);
			try {
				fs.accessSync(fullPath, fs.constants.X_OK);
				return fullPath;
			} catch {
				// not found, continue
			}
		}
	}
	return null;
}
