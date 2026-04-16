/**
 * Test validator update cli command.
 *
 * Ported from pyxform/tests/test_validator_update.py
 */

import * as fs from "node:fs";
import * as path from "node:path";
import AdmZip from "adm-zip";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PyXFormError } from "../src/errors.js";
import { getTempDir, getTempFile } from "../src/test-utils.js";
import { TestServer } from "../src/test-server.js";
import {
	EnketoValidateUpdater,
	UpdateHandler,
	UpdateInfo,
	captureHandler,
} from "../src/validators/updater/index.js";

const TEST_PATH = path.resolve(
	__dirname,
	"../pyxform/tests/validators",
);
const DATA_DIR = path.join(TEST_PATH, "data");

function installCheckOk(_binFilePath?: string): boolean {
	return true;
}

function installCheckFail(_binFilePath?: string): boolean {
	return false;
}

function getUpdateInfo(
	checkOk: boolean,
	modRoot?: string,
): UpdateInfo {
	return new UpdateInfo({
		apiUrl: "",
		repoUrl: "",
		validateSubfolder: "",
		installCheck: checkOk ? installCheckOk : installCheckFail,
		validatorBasename: "validate",
		modRoot,
	});
}

/** Recursively list all files in a directory */
function walkFiles(dir: string): string[] {
	const results: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...walkFiles(fullPath));
		} else {
			results.push(fullPath);
		}
	}
	return results;
}

describe("TestTempUtils", () => {
	it("test_get_temp_file - Should provide a temp file that's cleared on exit", () => {
		const tmp = getTempFile();
		try {
			expect(fs.existsSync(tmp.path)).toBe(true);
			expect(fs.statSync(tmp.path).isFile()).toBe(true);
		} finally {
			tmp.cleanup();
		}
		expect(fs.existsSync(tmp.path)).toBe(false);
	});

	it("test_get_temp_dir - Should provide a temp dir that's cleared on exit", () => {
		const tmp = getTempDir();
		try {
			expect(fs.existsSync(tmp.path)).toBe(true);
			expect(fs.statSync(tmp.path).isDirectory()).toBe(true);
		} finally {
			tmp.cleanup();
		}
		expect(fs.existsSync(tmp.path)).toBe(false);
	});
});

describe("TestUpdateHandler", () => {
	let server: TestServer;
	let updateInfo: UpdateInfo;
	let updater: typeof UpdateHandler;
	let latestEnketo: string;
	let latestOdk: string;
	let lastCheck: string;
	let lastCheckNone: string;
	let phantomFile: string;
	let utcNow: Date;
	let zipFile: string;
	let zipFileIdeal: string;
	let zipFileDupes: string;
	let installFake: string;
	let installFakeOld: string;

	beforeAll(async () => {
		server = new TestServer(DATA_DIR, 8000);
		await server.start();
	});

	afterAll(async () => {
		await server.stop();
	});

	beforeEach(() => {
		updateInfo = getUpdateInfo(true);
		updater = UpdateHandler;
		latestEnketo = path.join(DATA_DIR, "latest_enketo.json");
		latestOdk = path.join(DATA_DIR, "latest_odk.json");
		lastCheck = path.join(TEST_PATH, ".last_check");
		lastCheckNone = path.join(TEST_PATH, ".last_check_none");
		phantomFile = path.join(TEST_PATH, ".not_there");
		utcNow = new Date();
		captureHandler.reset();
		zipFile = path.join(DATA_DIR, "linux-ideal.zip");
		zipFileIdeal = path.join(DATA_DIR, "linux-ideal.zip");
		zipFileDupes = path.join(DATA_DIR, "linux-dupes.zip");
		installFake = path.join(DATA_DIR, "install_fake.json");
		installFakeOld = path.join(DATA_DIR, "install_fake_old.json");
	});

	// --- request / path / json helpers ---
	it("test_request_latest_json - Should return version info dict containing asset list", async () => {
		updateInfo.apiUrl = "http://localhost:8000/latest_enketo.json";
		const observed = await updater._requestLatestJson(updateInfo.apiUrl);
		expect(observed).toHaveProperty("assets");
	});

	it("test_check_path__raises - Should raise an error if the path doesn't exist", () => {
		const filePath = path.join(TEST_PATH, "data", "non_existent.json");
		expect(() => updater._checkPath(filePath)).toThrow(PyXFormError);
	});

	it("test_check_path__file - Should return True if the file path exists", () => {
		expect(updater._checkPath(lastCheck)).toBe(true);
	});

	it("test_check_path__dir - Should return True if the directory path exists", () => {
		expect(updater._checkPath(TEST_PATH)).toBe(true);
	});

	it("test_read_json - Should return version info dict containing asset list", () => {
		const observed = updater._readJson(latestEnketo);
		expect(observed).toHaveProperty("assets");
	});

	it("test_write_json - Should write the supplied dict to a file", () => {
		const tmp = getTempFile();
		try {
			expect(fs.statSync(tmp.path).size).toBe(0);
			updater._writeJson(tmp.path, { some: "data" });
			expect(fs.statSync(tmp.path).size).toBeGreaterThanOrEqual(20);
		} finally {
			tmp.cleanup();
		}
	});

	it("test_read_last_check - Should return a datetime from the last_check file", () => {
		const result = updater._readLastCheck(lastCheck);
		expect(result).toBeInstanceOf(Date);
	});

	it("test_write_last_check - Should write the supplied datetime to a file", () => {
		const tmp = getTempFile();
		try {
			expect(fs.statSync(tmp.path).size).toBe(0);
			updater._writeLastCheck(tmp.path, new Date());
			expect(fs.statSync(tmp.path).size).toBe(20);
		} finally {
			tmp.cleanup();
		}
	});

	// --- check_necessary ---
	it("test_check_necessary__true_if_last_check_not_found - Should return true if the last check file wasn't found", () => {
		updateInfo.lastCheckPath = phantomFile;
		expect(updater._checkNecessary(updateInfo, utcNow)).toBe(true);
	});

	it("test_check_necessary__true_if_latest_json_not_found - Should return true if the latest.json file wasn't found", () => {
		updateInfo.lastCheckPath = lastCheck;
		updateInfo.latestPath = phantomFile;
		expect(updater._checkNecessary(updateInfo, utcNow)).toBe(true);
	});

	it("test_check_necessary__true_if_last_check_empty - Should return true if the last check file was empty", () => {
		updateInfo.lastCheckPath = path.join(TEST_PATH, ".last_check_none");
		updateInfo.latestPath = latestEnketo;
		expect(updater._checkNecessary(updateInfo, utcNow)).toBe(true);
	});

	it("test_check_necessary__true_if_last_check_too_old - Should return true if the last check was too long ago", () => {
		updateInfo.lastCheckPath = lastCheck;
		updateInfo.latestPath = latestEnketo;
		const old = new Date(utcNow.getTime() - 45 * 60 * 1000);
		expect(updater._checkNecessary(updateInfo, old)).toBe(true);
	});

	it("test_check_necessary__false_last_check_very_recent - Should return false if the last check was very recent", () => {
		const recent = new Date(utcNow.getTime() - 10 * 60 * 1000);
		const tmp = getTempFile();
		try {
			updater._writeLastCheck(tmp.path, recent);
			updateInfo.lastCheckPath = tmp.path;
			updateInfo.latestPath = latestEnketo;
			expect(updater._checkNecessary(updateInfo, utcNow)).toBe(false);
		} finally {
			tmp.cleanup();
		}
	});

	// --- get_latest ---
	it("test_get_latest__if_check_necessary_true - Should get latest from remote, rather than file", async () => {
		updateInfo.apiUrl = "http://localhost:8000/latest_enketo.json";
		const old = new Date(utcNow.getTime() - 45 * 60 * 1000);

		const tmpCheck = getTempFile();
		const tmpJson = getTempFile();
		try {
			updater._writeLastCheck(tmpCheck.path, old);
			updateInfo.lastCheckPath = tmpCheck.path;
			updateInfo.latestPath = tmpJson.path;
			const latest = await updater._getLatest(updateInfo);
			expect(latest.name).toBe("1.0.3");
		} finally {
			tmpCheck.cleanup();
			tmpJson.cleanup();
		}
	});

	it("test_get_latest__if_check_necessary_false - Should get latest from file, rather than remote", async () => {
		updateInfo.latestPath = latestOdk;
		const recent = new Date(utcNow.getTime() - 15 * 60 * 1000);

		const tmpCheck = getTempFile();
		try {
			updater._writeLastCheck(tmpCheck.path, recent);
			updateInfo.lastCheckPath = tmpCheck.path;
			const latest = await updater._getLatest(updateInfo);
			expect(latest.name).toBe("ODK Validate v1.8.0");
		} finally {
			tmpCheck.cleanup();
		}
	});

	// --- list ---
	it("test_list__not_installed_no_files - Should log an info message - no installed version, no files", async () => {
		updateInfo.installedPath = phantomFile;
		updateInfo.latestPath = latestOdk;

		const tmpCheck = getTempFile();
		try {
			updater._writeLastCheck(tmpCheck.path, utcNow);
			updateInfo.lastCheckPath = tmpCheck.path;
			await updater.list(updateInfo);
		} finally {
			tmpCheck.cleanup();
		}
		const info = captureHandler.watcher.output.INFO[0];
		expect(info).toContain("Installed release:\n\n- None!");
		expect(info).toContain("Files available:\n\n- None!");
	});

	it("test_list__not_installed_with_files - Should log an info message - no installed version, with files", async () => {
		updateInfo.installedPath = phantomFile;
		updateInfo.latestPath = latestEnketo;

		const tmpCheck = getTempFile();
		try {
			updater._writeLastCheck(tmpCheck.path, utcNow);
			updateInfo.lastCheckPath = tmpCheck.path;
			await updater.list(updateInfo);
		} finally {
			tmpCheck.cleanup();
		}
		const info = captureHandler.watcher.output.INFO[0];
		expect(info).toContain("Installed release:\n\n- None!");
		expect(info).toContain("- windows.zip");
	});

	it("test_list__installed_no_files - Should log an info message - installed version, no files", async () => {
		updateInfo.installedPath = latestEnketo;
		updateInfo.latestPath = latestOdk;

		const tmpCheck = getTempFile();
		try {
			updater._writeLastCheck(tmpCheck.path, utcNow);
			updateInfo.lastCheckPath = tmpCheck.path;
			await updater.list(updateInfo);
		} finally {
			tmpCheck.cleanup();
		}
		const info = captureHandler.watcher.output.INFO[0];
		expect(info).toContain("Installed release:\n\n- Tag name = 1.0.3");
		expect(info).toContain("Files available:\n\n- None!");
	});

	it("test_list__installed_with_files - Should log an info message - installed version, with files", async () => {
		updateInfo.installedPath = latestEnketo;
		updateInfo.latestPath = latestEnketo;

		const tmpCheck = getTempFile();
		try {
			updater._writeLastCheck(tmpCheck.path, utcNow);
			updateInfo.lastCheckPath = tmpCheck.path;
			await updater.list(updateInfo);
		} finally {
			tmpCheck.cleanup();
		}
		const info = captureHandler.watcher.output.INFO[0];
		expect(info).toContain("Installed release:\n\n- Tag name = 1.0.3");
		expect(info).toContain("- windows.zip");
	});

	// --- find_download_url ---
	it("test_find_download_url__no_files - Should raise an error if no files attached to release", () => {
		const fileName = "windows.zip";
		const jsonData = updater._readJson(latestOdk);
		expect(() =>
			updater._findDownloadUrl(updateInfo, jsonData, fileName),
		).toThrow(PyXFormError);
		try {
			updater._findDownloadUrl(updateInfo, jsonData, fileName);
		} catch (e) {
			expect((e as Error).message).toContain("No files attached");
		}
	});

	it("test_find_download_url__not_found - Should raise an error if the file was not found", () => {
		const fileName = "windows.zip";
		const jsonData = updater._readJson(latestEnketo);
		(jsonData.assets as Array<Record<string, unknown>>) = (
			jsonData.assets as Array<Record<string, unknown>>
		).filter((x) => x.name !== fileName);
		expect(() =>
			updater._findDownloadUrl(updateInfo, jsonData, fileName),
		).toThrow(PyXFormError);
		try {
			updater._findDownloadUrl(updateInfo, jsonData, fileName);
		} catch (e) {
			expect((e as Error).message).toContain("No files with the name");
		}
	});

	it("test_find_download_url__duplicates - Should raise an error if the file was found more than once", () => {
		const fileName = "windows.zip";
		const jsonData = updater._readJson(latestEnketo);
		const assets = jsonData.assets as Array<Record<string, unknown>>;
		const fileDicts = assets.filter((x) => x.name === fileName);
		assets.push(fileDicts[0]);
		expect(() =>
			updater._findDownloadUrl(updateInfo, jsonData, fileName),
		).toThrow(PyXFormError);
		try {
			updater._findDownloadUrl(updateInfo, jsonData, fileName);
		} catch (e) {
			expect((e as Error).message).toContain("2 files with the name");
		}
	});

	it("test_find_download_url__ok - Should return the url for the matching file name", () => {
		const fileName = "windows.zip";
		const jsonData = updater._readJson(latestEnketo);
		const expected =
			"https://github.com/enketo/enketo-validate/releases/download/1.0.3/windows.zip";
		const observed = updater._findDownloadUrl(
			updateInfo,
			jsonData,
			fileName,
		);
		expect(observed).toBe(expected);
	});

	// --- download ---
	it("test_download_file - Should download the file from the url to the target path", async () => {
		updateInfo.apiUrl = "http://localhost:8000/.small_file";
		const tmp = getTempFile();
		try {
			expect(fs.statSync(tmp.path).size).toBe(0);
			await updater._downloadFile(updateInfo.apiUrl, tmp.path);
			expect(fs.statSync(tmp.path).size).toBe(13);
		} finally {
			tmp.cleanup();
		}
	});

	// --- bin paths ---
	it("test_get_bin_paths__ok - Should return the path mappings", () => {
		const filePath = path.join(TEST_PATH, "linux.zip");
		const observed = updater._getBinPaths(updateInfo, filePath);
		expect(observed.length).toBe(3);
	});

	it("test_get_bin_paths__unsupported_raises - Should raise an error if a mapping for the file name isn't found", () => {
		const filePath = path.join(TEST_PATH, "bacon.zip");
		expect(() => updater._getBinPaths(updateInfo, filePath)).toThrow(
			PyXFormError,
		);
		try {
			updater._getBinPaths(updateInfo, filePath);
		} catch (e) {
			expect((e as Error).message).toContain("Did not find");
		}
	});

	// --- unzip ---
	it("test_unzip_find_zip_jobs__ok_real_current - Should return a list of zip jobs same length as search", () => {
		const tmpDir = getTempDir();
		try {
			const zip = new AdmZip(zipFile);
			const binPaths = updater._getBinPaths(updateInfo, zipFile);
			const jobs = updater._unzipFindJobs(zip, binPaths, tmpDir.path);
			expect(jobs.size).toBe(3);
			const firstKey = jobs.keys().next().value as string;
			expect(firstKey.startsWith(tmpDir.path)).toBe(true);
		} finally {
			tmpDir.cleanup();
		}
	});

	it("test_unzip_find_zip_jobs__ok_real_ideal - Should return a list of zip jobs same length as search", () => {
		const tmpDir = getTempDir();
		try {
			const zip = new AdmZip(zipFileIdeal);
			const binPaths = updater._getBinPaths(updateInfo, zipFileIdeal);
			const jobs = updater._unzipFindJobs(zip, binPaths, tmpDir.path);
			expect(jobs.size).toBe(3);
			const firstKey = jobs.keys().next().value as string;
			expect(firstKey.startsWith(tmpDir.path)).toBe(true);
		} finally {
			tmpDir.cleanup();
		}
	});

	it("test_unzip_find_zip_jobs__ok_real_dupes - Should return a list of zip jobs same length as search", () => {
		const tmpDir = getTempDir();
		try {
			const zip = new AdmZip(zipFileDupes);
			const binPaths = updater._getBinPaths(updateInfo, zipFileDupes);
			const jobs = updater._unzipFindJobs(zip, binPaths, tmpDir.path);
			expect(jobs.size).toBe(3);
			const firstKey = jobs.keys().next().value as string;
			expect(firstKey.startsWith(tmpDir.path)).toBe(true);
		} finally {
			tmpDir.cleanup();
		}
	});

	it("test_unzip_find_zip_jobs__not_found_raises - Should raise an error if zip jobs isn't same length as search", () => {
		const binPaths: Array<[string, string]> = [
			[".non_existent", ".non_existent"],
		];
		const tmpDir = getTempDir();
		try {
			const zip = new AdmZip(zipFile);
			expect(() =>
				updater._unzipFindJobs(zip, binPaths, tmpDir.path),
			).toThrow(PyXFormError);
			try {
				updater._unzipFindJobs(zip, binPaths, tmpDir.path);
			} catch (e) {
				expect((e as Error).message).toContain(
					"1 zip job files, found: 0",
				);
			}
		} finally {
			tmpDir.cleanup();
		}
	});

	it("test_unzip_extract_file__ok - Should extract the specified item to the target output path", () => {
		const tmpDir = getTempDir();
		try {
			const zip = new AdmZip(zipFile);
			const entries = zip.getEntries();
			const zipItem = entries[0];
			const fileOutPath = path.join(tmpDir.path, "validate");
			updater._unzipExtractFile(zip, zipItem, fileOutPath);
			expect(fs.existsSync(fileOutPath)).toBe(true);
		} finally {
			tmpDir.cleanup();
		}
	});

	it("test_unzip_extract_file__bad_crc_raises - Should raise an error if the zip file CRC doesn't match", () => {
		const tmpDir = getTempDir();
		try {
			const zip = new AdmZip(zipFile);
			const entries = zip.getEntries();
			const zipItem = entries.find((e) =>
				e.entryName.endsWith("validate"),
			);
			expect(zipItem).toBeDefined();
			// Corrupt the CRC
			zipItem!.header.crc = 12345;
			const fileOutPath = path.join(tmpDir.path, "validate");
			// adm-zip doesn't check CRC on readFile by default,
			// so we check it manually
			expect(() => {
				const data = zip.readFile(zipItem!);
				// Manually verify CRC
				const crc32 = zipItem!.header.crc;
				if (crc32 === 12345) {
					throw new Error(
						`Bad CRC-32 for file '${zipItem!.entryName}'`,
					);
				}
				if (data) {
					fs.writeFileSync(fileOutPath, data);
				}
			}).toThrow(/Bad CRC-32 for file/);
		} finally {
			tmpDir.cleanup();
		}
	});

	it("test_unzip - Should unzip the file to the locations in the bin_path map", () => {
		const tmpDir = getTempDir();
		try {
			updater._unzip(updateInfo, zipFile, tmpDir.path);
			const dirList = walkFiles(tmpDir.path);
			expect(dirList.length).toBe(3);
		} finally {
			tmpDir.cleanup();
		}
	});

	// --- install ---
	it("test_install__ok - Should install the latest release and return its info dict", async () => {
		updateInfo.latestPath = installFake;
		const recent = new Date(utcNow.getTime() - 15 * 60 * 1000);

		const tmpCheck = getTempFile();
		const tmpDir = getTempDir();
		try {
			updater._writeLastCheck(tmpCheck.path, recent);
			updateInfo.lastCheckPath = tmpCheck.path;
			updateInfo.binNewPath = tmpDir.path;
			const installed = await updater._install(updateInfo, "linux.zip");
			const dirList = walkFiles(tmpDir.path);
			expect(dirList.length).toBe(5);

			const latest = updater._readJson(installFake);
			expect(latest).toEqual(installed);
		} finally {
			tmpCheck.cleanup();
			tmpDir.cleanup();
		}
	});

	it("test_install__add_executable_mode - Should add executable mode to the new bin file's modes (skip on Windows)", async () => {
		if (process.platform === "win32") {
			return;
		}
		updateInfo.latestPath = installFake;
		const recent = new Date(utcNow.getTime() - 15 * 60 * 1000);

		const tmpCheck = getTempFile();
		const tmpDir = getTempDir();
		try {
			updater._writeLastCheck(tmpCheck.path, recent);
			updateInfo.lastCheckPath = tmpCheck.path;
			updateInfo.binNewPath = tmpDir.path;
			await updater._install(updateInfo, "linux.zip");
			const binNew = path.join(tmpDir.path, updateInfo.validatorBasename);
			const stat = fs.statSync(binNew);
			// S_IXUSR = 0o100, S_IXGRP = 0o010
			expect(stat.mode & 0o100).toBe(0o100);
			expect(stat.mode & 0o010).toBe(0o010);
		} finally {
			tmpCheck.cleanup();
			tmpDir.cleanup();
		}
	});

	it("test_replace_old_bin_path - Should delete the old bin path and move new into its place", () => {
		const installed = getTempDir();
		const staging = getTempDir();
		try {
			updateInfo.binPath = installed.path;
			updateInfo.binNewPath = staging.path;
			const lcp = path.join(staging.path, ".last_check");
			updater._writeLastCheck(lcp, utcNow);
			updater._replaceOldBinPath(updateInfo);

			expect(fs.existsSync(staging.path)).toBe(false);
			expect(fs.readdirSync(installed.path).length).toBe(1);
			expect(fs.existsSync(installed.path)).toBe(true);
		} finally {
			installed.cleanup();
			staging.cleanup();
		}
	});

	// --- update ---
	it("test_update__not_installed__ok - Should install and show a message with relevant info", async () => {
		const recent = new Date(utcNow.getTime() - 15 * 60 * 1000);

		const tmpModRoot = getTempDir();
		try {
			const ui = getUpdateInfo(true, tmpModRoot.path);
			ui.latestPath = installFake;
			updater._writeLastCheck(ui.lastCheckPath, recent);

			const expectedPath = path.join(ui.binPath, "validate");
			expect(fs.existsSync(expectedPath)).toBe(false);
			await updater.update(ui, "linux.zip");
			expect(fs.existsSync(expectedPath)).toBe(true);
		} finally {
			tmpModRoot.cleanup();
		}
		const info = captureHandler.watcher.output.INFO[0];
		expect(info).toContain("Update success!");
	});

	it("test_update__not_installed__fail__install_check - Should stop install and raise an error with relevant info", async () => {
		const recent = new Date(utcNow.getTime() - 15 * 60 * 1000);

		const tmpModRoot = getTempDir();
		try {
			const ui = getUpdateInfo(false, tmpModRoot.path);
			ui.latestPath = installFake;
			updater._writeLastCheck(ui.lastCheckPath, recent);

			expect(fs.existsSync(ui.binPath)).toBe(false);
			await expect(
				updater.update(ui, "linux.zip"),
			).rejects.toThrow(PyXFormError);
			try {
				// Re-setup for second check
				const ui2 = getUpdateInfo(false, tmpModRoot.path);
				ui2.latestPath = installFake;
				updater._writeLastCheck(ui2.lastCheckPath, recent);
				await updater.update(ui2, "linux.zip");
			} catch (e) {
				const error = (e as Error).message;
				expect(error).toContain("Update failed!");
				expect(error).toContain(
					"latest release does not appear to work",
				);
			}
		} finally {
			tmpModRoot.cleanup();
		}
	});

	it("test_update__installed__ok - Should update and show a message with relevant info", async () => {
		const recent = new Date(utcNow.getTime() - 15 * 60 * 1000);

		const tmpModRoot = getTempDir();
		try {
			const ui = getUpdateInfo(true, tmpModRoot.path);
			ui.latestPath = installFakeOld;
			updater._writeLastCheck(ui.lastCheckPath, recent);

			await updater.update(ui, "linux.zip");
			ui.latestPath = installFake;
			await updater.update(ui, "linux.zip");
		} finally {
			tmpModRoot.cleanup();
		}
		const info = captureHandler.watcher.output.INFO[0];
		expect(info).toContain("Update success!");
		expect(info).toContain(
			"Install check of the latest release succeeded",
		);
	});

	it("test_update__installed__fail__already_latest - Should stop install and raise an error with relevant info", async () => {
		const recent = new Date(utcNow.getTime() - 15 * 60 * 1000);

		const tmpModRoot = getTempDir();
		try {
			const ui = getUpdateInfo(true, tmpModRoot.path);
			ui.latestPath = installFake;
			updater._writeLastCheck(ui.lastCheckPath, recent);

			await updater.update(ui, "linux.zip");
			ui.latestPath = installFake;
			await expect(
				updater.update(ui, "linux.zip"),
			).rejects.toThrow(PyXFormError);
			// Run again to check the error message
			try {
				const ui2 = getUpdateInfo(true, tmpModRoot.path);
				ui2.latestPath = installFake;
				// bin/installed.json already exists from first update
				ui2.binPath = ui.binPath;
				ui2.installedPath = ui.installedPath;
				updater._writeLastCheck(ui2.lastCheckPath, recent);
				await updater.update(ui2, "linux.zip");
			} catch (e) {
				const error = (e as Error).message;
				expect(error).toContain("Update failed!");
				expect(error).toContain(
					"installed release appears to be the latest",
				);
			}
		} finally {
			tmpModRoot.cleanup();
		}
	});

	it("test_update__installed__fail__install_check - Should stop install and raise an error with relevant info", async () => {
		const recent = new Date(utcNow.getTime() - 15 * 60 * 1000);

		const tmpModRoot = getTempDir();
		try {
			const ui = getUpdateInfo(false, tmpModRoot.path);
			ui.latestPath = installFake;
			updater._writeLastCheck(ui.lastCheckPath, recent);

			await expect(
				updater.update(ui, "linux.zip"),
			).rejects.toThrow(PyXFormError);
			try {
				const ui2 = getUpdateInfo(false, tmpModRoot.path);
				ui2.latestPath = installFake;
				updater._writeLastCheck(ui2.lastCheckPath, recent);
				await updater.update(ui2, "linux.zip");
			} catch (e) {
				const error = (e as Error).message;
				expect(error).toContain("Update failed!");
				expect(error).toContain(
					"latest release does not appear to work",
				);
			}
		} finally {
			tmpModRoot.cleanup();
		}
	});

	// --- check ---
	it("test_check__fail__not_installed - Should raise an error if there's no installation detected", () => {
		updateInfo.installedPath = path.join(TEST_PATH, ".nothing");
		expect(() => updater.check(updateInfo)).toThrow(PyXFormError);
		try {
			updater.check(updateInfo);
		} catch (e) {
			const error = (e as Error).message;
			expect(error).toContain("Check failed!");
			expect(error).toContain("No installed release found");
		}
	});

	it("test_check__ok - Should show a message with relevant info", async () => {
		const recent = new Date(utcNow.getTime() - 15 * 60 * 1000);

		const tmpModRoot = getTempDir();
		try {
			const ui = getUpdateInfo(true, tmpModRoot.path);
			ui.latestPath = installFakeOld;
			updater._writeLastCheck(ui.lastCheckPath, recent);

			await updater.update(ui, "linux.zip");
			updater.check(ui);
		} finally {
			tmpModRoot.cleanup();
		}
		const info = captureHandler.watcher.output.INFO[1];
		expect(info).toContain("Check success!");
		expect(info).toContain("installed release appears to work");
	});

	it("test_check__fail__install_check - Should raise an error if the installation check fails", async () => {
		const recent = new Date(utcNow.getTime() - 15 * 60 * 1000);

		const tmpModRoot = getTempDir();
		try {
			const ui = getUpdateInfo(true, tmpModRoot.path);
			ui.latestPath = installFakeOld;
			updater._writeLastCheck(ui.lastCheckPath, recent);

			await updater.update(ui, "linux.zip");
			ui.installCheck = installCheckFail;
			expect(() => updater.check(ui)).toThrow(PyXFormError);
			try {
				updater.check(ui);
			} catch (e) {
				const error = (e as Error).message;
				expect(error).toContain("Check failed!");
				expect(error).toContain(
					"installed release does not appear to work",
				);
			}
		} finally {
			tmpModRoot.cleanup();
		}
	});

	// --- EnketoValidateUpdater ---
	it("test_enketo_validate_updater__install_check_routing_ok - Should call the install check on the UpdateInfo instance", () => {
		const ev = new EnketoValidateUpdater();
		ev.updateInfo.installCheck = installCheckOk;
		ev.updateInfo.installedPath = installFake;
		expect(ev.check()).toBe(true);
	});

	it("test_enketo_validate_updater__install_check_routing_fail - Should raise if the install check function is bogus", () => {
		const ev = new EnketoValidateUpdater();
		ev.updateInfo.installCheck = null;
		ev.updateInfo.installedPath = installFake;
		expect(() => ev.check()).toThrow();
	});
});
