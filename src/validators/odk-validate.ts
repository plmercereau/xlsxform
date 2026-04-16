/**
 * ODK Validate wrapper - ported from pyxform/validators/odk_validate/__init__.py
 *
 * For the TypeScript port, we only need check_java_available.
 */

import { which } from "./util.js";

/**
 * Check if Java is available on the PATH.
 * Throws an error if not found.
 */
export function checkJavaAvailable(
	whichFn: (cmd: string) => string | null = which,
): void {
	const javaPath = whichFn("java");
	if (javaPath !== null) {
		return;
	}
	const msg =
		"Form validation failed because Java (8+ required) could not be found. " +
		"To fix this, please either: 1) install Java, or 2) run pyxform with the " +
		"--skip_validate flag, or 3) add the installed Java to the environment path.";
	throw new Error(msg);
}
