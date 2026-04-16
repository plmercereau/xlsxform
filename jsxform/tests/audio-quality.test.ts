import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("AudioQualityTest", () => {
	it("test_voice_only", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |        |          |       |                |
			|        | type   | name     | label | parameters     |
			|        | audio  | audio    | Audio | quality=voice-only |
			`,
			xml__contains: [
				'xmlns:odk="http://www.opendatakit.org/xforms"',
				'<bind nodeset="/data/audio" type="binary" odk:quality="voice-only"/>',
			],
		});
	});

	it("test_low", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |        |          |       |                |
			|        | type   | name     | label | parameters     |
			|        | audio  | audio    | Audio | quality=low |
			`,
			xml__contains: [
				'xmlns:odk="http://www.opendatakit.org/xforms"',
				'<bind nodeset="/data/audio" type="binary" odk:quality="low"/>',
			],
		});
	});

	it("test_normal", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |        |          |       |                |
			|        | type   | name     | label | parameters     |
			|        | audio  | audio    | Audio | quality=normal |
			`,
			xml__contains: [
				'xmlns:odk="http://www.opendatakit.org/xforms"',
				'<bind nodeset="/data/audio" type="binary" odk:quality="normal"/>',
			],
		});
	});

	it("test_external", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |        |          |       |                |
			|        | type   | name     | label | parameters     |
			|        | audio  | audio    | Audio | quality=external |
			`,
			xml__contains: [
				'xmlns:odk="http://www.opendatakit.org/xforms"',
				'<bind nodeset="/data/audio" type="binary" odk:quality="external"/>',
			],
		});
	});

	it("test_foo_fails", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |        |          |       |                |
			|        | type   | name     | label | parameters     |
			|        | audio  | audio    | Audio | quality=foo |
			`,
			errored: true,
			error__contains: ["Invalid value for quality."],
		});
	});
});
