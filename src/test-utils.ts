/**
 * Test utility functions - ported from tests/utils.py
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Provides a temp file that's cleaned up on dispose.
 * Returns [filePath, cleanup].
 */
export function getTempFile(): { path: string; cleanup: () => void } {
	const tmpDir = os.tmpdir();
	const tmpPath = path.join(
		tmpDir,
		`pyxform_tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
	);
	fs.writeFileSync(tmpPath, "");
	return {
		path: tmpPath,
		cleanup: () => {
			try {
				if (fs.existsSync(tmpPath)) {
					fs.unlinkSync(tmpPath);
				}
			} catch {
				// ignore
			}
		},
	};
}

/**
 * Provides a temp directory that's cleaned up on dispose.
 * Returns [dirPath, cleanup].
 */
export function getTempDir(): { path: string; cleanup: () => void } {
	const tmpDir = os.tmpdir();
	const tmpPath = fs.mkdtempSync(path.join(tmpDir, "pyxform_tmp_"));
	return {
		path: tmpPath,
		cleanup: () => {
			try {
				if (fs.existsSync(tmpPath)) {
					fs.rmSync(tmpPath, { recursive: true });
				}
			} catch {
				// ignore
			}
		},
	};
}
