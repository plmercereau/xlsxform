/**
 * pyxform_validator_update - command to update XForm validators.
 * Ported from pyxform/validators/updater.py
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import AdmZip from "adm-zip";
import { PyXFormError } from "../../errors.js";
import { CapturingHandler, requestGet } from "../util.js";

const UTC_FMT_REGEX =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;

function formatUtc(date: Date): string {
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, "0");
	const d = String(date.getUTCDate()).padStart(2, "0");
	const h = String(date.getUTCHours()).padStart(2, "0");
	const min = String(date.getUTCMinutes()).padStart(2, "0");
	const s = String(date.getUTCSeconds()).padStart(2, "0");
	return `${y}-${m}-${d}T${h}:${min}:${s}Z`;
}

function parseUtc(str: string): Date | null {
	const match = UTC_FMT_REGEX.exec(str.trim());
	if (!match) {
		return null;
	}
	return new Date(
		Date.UTC(
			Number(match[1]),
			Number(match[2]) - 1,
			Number(match[3]),
			Number(match[4]),
			Number(match[5]),
			Number(match[6]),
		),
	);
}

/**
 * Minimatch/fnmatch-style glob matching (simple version).
 * Supports * as wildcard matching any sequence of characters.
 */
function fnmatch(filename: string, pattern: string): boolean {
	// Convert pattern to regex
	const regexStr = pattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, ".*");
	const regex = new RegExp(`^${regexStr}$`);
	return regex.test(filename);
}

export type InstallCheckFn = (binFilePath?: string) => boolean;

export class UpdateInfo {
	private _apiUrl = "";
	repoUrl: string;
	validateSubfolder: string;
	installCheck: InstallCheckFn | null;
	validatorBasename: string;
	modPath: string;
	latestPath: string;
	lastCheckPath: string;
	binPath: string;
	installedPath: string;
	binNewPath: string;
	manualMsg: string;

	constructor(opts: {
		apiUrl: string;
		repoUrl: string;
		validateSubfolder: string;
		installCheck: InstallCheckFn | null;
		validatorBasename: string;
		modRoot?: string;
	}) {
		this.apiUrl = opts.apiUrl;
		this.repoUrl = opts.repoUrl;
		this.validateSubfolder = opts.validateSubfolder;
		this.installCheck = opts.installCheck;
		this.validatorBasename = opts.validatorBasename;

		if (opts.modRoot == null) {
			// In production, use the module's directory
			this.modPath = path.join(
				path.dirname(new URL(import.meta.url).pathname),
				opts.validateSubfolder,
			);
		} else {
			this.modPath = path.join(opts.modRoot, opts.validateSubfolder);
		}
		this.latestPath = path.join(this.modPath, "latest.json");
		this.lastCheckPath = path.join(this.modPath, ".last_check");
		this.binPath = path.join(this.modPath, "bin");
		this.installedPath = path.join(this.binPath, "installed.json");
		this.binNewPath = path.join(this.modPath, "bin_new");
		this.manualMsg = `Download manually from: ${this.repoUrl}.`;
	}

	get apiUrl(): string {
		return this._apiUrl;
	}

	set apiUrl(value: string) {
		this._apiUrl = value;
	}
}

export const captureHandler = new CapturingHandler();

export class UpdateHandler {
	static async _requestLatestJson(
		url: string,
	): Promise<Record<string, unknown>> {
		const content = await requestGet(url);
		return JSON.parse(content.toString("utf-8"));
	}

	static _checkPath(filePath: string): boolean {
		if (!fs.existsSync(filePath)) {
			throw new PyXFormError(
				`Expected path does not exist: ${filePath}`,
			);
		}
		return true;
	}

	static _readJson(filePath: string): Record<string, unknown> {
		UpdateHandler._checkPath(filePath);
		const data = fs.readFileSync(filePath, "utf-8");
		return JSON.parse(data);
	}

	static _writeJson(
		filePath: string,
		content: Record<string, unknown>,
	): void {
		const data = JSON.stringify(content, Object.keys(content).sort(), 2);
		fs.writeFileSync(filePath, data, { encoding: "utf-8" });
	}

	static _readLastCheck(filePath: string): Date | null {
		UpdateHandler._checkPath(filePath);
		const data = fs.readFileSync(filePath, "utf-8");
		const firstLine = data.split("\n")[0];
		return parseUtc(firstLine);
	}

	static _writeLastCheck(filePath: string, content: Date): void {
		fs.writeFileSync(filePath, formatUtc(content), { encoding: "utf-8" });
	}

	static _checkNecessary(updateInfo: UpdateInfo, utcNow: Date): boolean {
		if (!fs.existsSync(updateInfo.lastCheckPath)) {
			return true;
		}
		if (!fs.existsSync(updateInfo.latestPath)) {
			return true;
		}
		const lastCheck = UpdateHandler._readLastCheck(
			updateInfo.lastCheckPath,
		);
		if (lastCheck === null) {
			return true;
		}
		const ageMs = utcNow.getTime() - lastCheck.getTime();
		const thirtyMinutesMs = 1800 * 1000;
		if (thirtyMinutesMs < ageMs) {
			return true;
		}
		return false;
	}

	static async _getLatest(
		updateInfo: UpdateInfo,
	): Promise<Record<string, unknown>> {
		const utcNow = new Date();
		if (UpdateHandler._checkNecessary(updateInfo, utcNow)) {
			const latest = await UpdateHandler._requestLatestJson(
				updateInfo.apiUrl,
			);
			UpdateHandler._writeJson(updateInfo.latestPath, latest);
			UpdateHandler._writeLastCheck(updateInfo.lastCheckPath, utcNow);
			return latest;
		}
		return UpdateHandler._readJson(updateInfo.latestPath);
	}

	static _getReleaseMessage(
		jsonData: Record<string, unknown>,
	): string {
		return `- Tag name = ${jsonData.tag_name}\n- Tag URL = ${jsonData.html_url}\n\n`;
	}

	static async list(updateInfo: UpdateInfo): Promise<void> {
		let installedInfo: string;
		if (!fs.existsSync(updateInfo.installedPath)) {
			installedInfo = "- None!\n\n";
		} else {
			const installed = UpdateHandler._readJson(
				updateInfo.installedPath,
			);
			installedInfo = UpdateHandler._getReleaseMessage(installed);
		}

		const latest = await UpdateHandler._getLatest(updateInfo);
		const latestFiles = latest.assets as Array<Record<string, unknown>>;
		let fileMessage: string;
		if (latestFiles.length === 0) {
			fileMessage = `- None!\n\n${updateInfo.manualMsg}`;
		} else {
			const fileNames = latestFiles.map(
				(x) => `- ${x.name}`,
			);
			fileMessage = fileNames.join("\n");
		}

		const message =
			`\nInstalled release:\n\n${installedInfo}` +
			`Latest release:\n\n${UpdateHandler._getReleaseMessage(latest)}` +
			`Files available:\n\n${fileMessage}\n`;
		captureHandler.info(message);
	}

	static _findDownloadUrl(
		updateInfo: UpdateInfo,
		jsonData: Record<string, unknown>,
		fileName: string,
	): string {
		const relName = jsonData.tag_name as string;
		const files = jsonData.assets as Array<Record<string, unknown>>;

		if (files.length === 0) {
			throw new PyXFormError(
				`No files attached to release '${relName}'.\n\n${updateInfo.manualMsg}`,
			);
		}

		const fileUrls = files
			.filter((x) => x.name === fileName)
			.map((x) => x.browser_download_url as string);

		const urlsLen = fileUrls.length;
		if (urlsLen === 0) {
			throw new PyXFormError(
				`No files with the name '${fileName}' attached to release '${relName}'.\n\n${updateInfo.manualMsg}`,
			);
		}
		if (urlsLen > 1) {
			throw new PyXFormError(
				`${urlsLen} files with the name '${fileName}' attached to release '${relName}'.\n\n${updateInfo.manualMsg}`,
			);
		}
		return fileUrls[0];
	}

	static async _downloadFile(url: string, filePath: string): Promise<void> {
		const data = await requestGet(url);
		fs.writeFileSync(filePath, data);
	}

	static _getBinPaths(
		updateInfo: UpdateInfo,
		filePath: string,
	): Array<[string, string]> {
		const fileName = path.basename(filePath);
		let mainBin: string;
		if (fileName.includes("windows")) {
			mainBin = "*validate.exe";
		} else if (fileName.includes("linux")) {
			mainBin = "*validate";
		} else if (fileName.includes("macos")) {
			mainBin = "*validate";
		} else {
			throw new PyXFormError(
				`Did not find a supported main binary for file: ${filePath}.\n\n${updateInfo.manualMsg}`,
			);
		}
		return [
			[mainBin, updateInfo.validatorBasename],
			[
				"*node_modules/libxmljs-mt/build*/xmljs.node",
				"node_modules/libxmljs-mt/build/xmljs.node",
			],
			[
				"*node_modules/libxslt/build*/node-libxslt.node",
				"node_modules/libxslt/build/node-libxslt.node",
			],
		];
	}

	static _unzipFindJobs(
		openZipFile: AdmZip,
		binPaths: Array<[string, string]>,
		outPath: string,
	): Map<string, AdmZip.IZipEntry> {
		const zipInfo = openZipFile.getEntries();
		const zipJobs = new Map<string, AdmZip.IZipEntry>();

		for (const zipItem of zipInfo) {
			if (zipItem.entryName.startsWith("__MACOSX")) {
				continue;
			}
			for (const fileTarget of binPaths) {
				if (fnmatch(zipItem.entryName, fileTarget[0])) {
					const fileOutPath = path.join(outPath, fileTarget[1]);
					const maybeExisting = zipJobs.get(fileOutPath);
					if (maybeExisting !== undefined) {
						if (maybeExisting.header.crc === zipItem.header.crc) {
							continue;
						}
					}
					zipJobs.set(fileOutPath, zipItem);
				}
			}
		}

		if (binPaths.length !== zipJobs.size) {
			throw new PyXFormError(
				`Expected ${binPaths.length} zip job files, found: ${zipJobs.size}`,
			);
		}
		return zipJobs;
	}

	static _unzipExtractFile(
		openZipFile: AdmZip,
		zipItem: AdmZip.IZipEntry,
		fileOutPath: string,
	): void {
		const outParent = path.dirname(fileOutPath);
		if (!fs.existsSync(outParent)) {
			fs.mkdirSync(outParent, { recursive: true });
		}
		const data = openZipFile.readFile(zipItem);
		if (data === null) {
			throw new Error(
				`Bad CRC-32 for file '${zipItem.entryName}'`,
			);
		}
		fs.writeFileSync(fileOutPath, data);
	}

	static _unzip(
		updateInfo: UpdateInfo,
		filePath: string,
		outPath: string,
	): void {
		UpdateHandler._checkPath(filePath);
		UpdateHandler._checkPath(outPath);
		const binPaths = UpdateHandler._getBinPaths(updateInfo, filePath);

		const zipFile = new AdmZip(filePath);
		const jobs = UpdateHandler._unzipFindJobs(zipFile, binPaths, outPath);
		for (const [fileOutPath, zipItem] of jobs.entries()) {
			UpdateHandler._unzipExtractFile(zipFile, zipItem, fileOutPath);
		}
	}

	static async _install(
		updateInfo: UpdateInfo,
		fileName: string,
	): Promise<Record<string, unknown>> {
		try {
			const latest = await UpdateHandler._getLatest(updateInfo);
			const filePath = path.join(updateInfo.binNewPath, fileName);
			const newBinFilePath = path.join(
				updateInfo.binNewPath,
				updateInfo.validatorBasename,
			);

			if (fs.existsSync(updateInfo.binNewPath)) {
				fs.rmSync(updateInfo.binNewPath, { recursive: true });
			}
			fs.mkdirSync(updateInfo.binNewPath, { recursive: true });

			const installed = path.join(
				updateInfo.binNewPath,
				"installed.json",
			);
			UpdateHandler._writeJson(installed, latest);
			const url = UpdateHandler._findDownloadUrl(
				updateInfo,
				latest,
				fileName,
			);
			await UpdateHandler._downloadFile(url, filePath);

			const ext = path.extname(filePath);
			if (ext === ".zip") {
				UpdateHandler._unzip(updateInfo, filePath, updateInfo.binNewPath);
			} else {
				fs.renameSync(filePath, newBinFilePath);
			}

			// chmod ug+x
			const currentMode = fs.statSync(newBinFilePath).mode;
			// S_IXUSR = 0o100, S_IXGRP = 0o010
			fs.chmodSync(newBinFilePath, currentMode | 0o110);

			return latest;
		} catch (err) {
			if (err instanceof PyXFormError) {
				throw new PyXFormError(
					`\n\nUpdate failed!\n\n${err.message}`,
				);
			}
			throw err;
		}
	}

	static _replaceOldBinPath(updateInfo: UpdateInfo): void {
		if (fs.existsSync(updateInfo.binPath)) {
			fs.rmSync(updateInfo.binPath, { recursive: true });
		}
		fs.renameSync(updateInfo.binNewPath, updateInfo.binPath);
	}

	static async update(
		updateInfo: UpdateInfo,
		fileName: string,
		force = false,
	): Promise<boolean> {
		let installed: Record<string, unknown>;
		let latest: Record<string, unknown>;

		if (!fs.existsSync(updateInfo.installedPath)) {
			installed = await UpdateHandler._install(updateInfo, fileName);
			latest = installed;
		} else {
			installed = UpdateHandler._readJson(updateInfo.installedPath);
			latest = await UpdateHandler._getLatest(updateInfo);
			if (installed.tag_name === latest.tag_name && !force) {
				const installedInfo =
					UpdateHandler._getReleaseMessage(installed);
				const latestInfo = UpdateHandler._getReleaseMessage(latest);
				const message =
					"\nUpdate failed!\n\n" +
					"The installed release appears to be the latest. " +
					"To update anyway, use the '--force' flag.\n\n" +
					`Installed release:\n\n${installedInfo}` +
					`Latest release:\n\n${latestInfo}`;
				throw new PyXFormError(message);
			}
			await UpdateHandler._install(updateInfo, fileName);
		}

		const installedInfo = UpdateHandler._getReleaseMessage(installed);
		const latestInfo = UpdateHandler._getReleaseMessage(latest);
		const newBinFilePath = path.join(
			updateInfo.binNewPath,
			updateInfo.validatorBasename,
		);

		if (
			updateInfo.installCheck &&
			updateInfo.installCheck(newBinFilePath)
		) {
			UpdateHandler._replaceOldBinPath(updateInfo);
			const message =
				"\nUpdate success!\n\n" +
				"Install check of the latest release succeeded.\n\n" +
				`Latest release:\n\n${latestInfo}`;
			captureHandler.info(message);
			return true;
		}
		const message =
			"\nUpdate failed!\n\n" +
			"The latest release does not appear to work. " +
			`It is saved here in case it's needed:\n${newBinFilePath}\n\n` +
			"The installed release has not been changed.\n\n" +
			`Installed release:\n\n${installedInfo}` +
			`Latest release:\n\n${latestInfo}`;
		throw new PyXFormError(message);
	}

	static check(updateInfo: UpdateInfo): boolean {
		if (!fs.existsSync(updateInfo.installedPath)) {
			throw new PyXFormError(
				"\nCheck failed!\n\nNo installed release found.",
			);
		}

		const installed = UpdateHandler._readJson(updateInfo.installedPath);
		if (updateInfo.installCheck && updateInfo.installCheck()) {
			const message =
				"\nCheck success!\n\n" +
				"The installed release appears to work.\n\n" +
				`Installed release:\n\n${UpdateHandler._getReleaseMessage(installed)}`;
			captureHandler.info(message);
			return true;
		}
		const message =
			"\nCheck failed!\n\n" +
			"The installed release does not appear to work.\n\n" +
			`Installed release:\n\n${UpdateHandler._getReleaseMessage(installed)}`;
		throw new PyXFormError(message);
	}
}

export class EnketoValidateUpdater {
	updateInfo: UpdateInfo;

	constructor() {
		this.updateInfo = new UpdateInfo({
			apiUrl: "https://api.github.com/repos/enketo/enketo-validate/releases/latest",
			repoUrl: "https://github.com/enketo/enketo-validate",
			validateSubfolder: "enketo_validate",
			installCheck: this._installCheck.bind(this),
			validatorBasename: "validate",
		});
	}

	_installCheck(_binFilePath?: string): boolean {
		// Placeholder - real implementation would run the binary
		return false;
	}

	async list(): Promise<void> {
		return UpdateHandler.list(this.updateInfo);
	}

	async update(fileName: string, force = false): Promise<boolean> {
		return UpdateHandler.update(this.updateInfo, fileName, force);
	}

	check(): boolean {
		return UpdateHandler.check(this.updateInfo);
	}
}
