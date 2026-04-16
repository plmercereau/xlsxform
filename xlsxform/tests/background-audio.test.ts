import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("BackgroundAudioTest", () => {
	it("test_background_audio", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |                  |              |
			|        | type             | name         |
			|        | background-audio | my_recording |
			`,
			xml__contains: [
				'<bind nodeset="/data/my_recording" type="binary"/>',
				'<odk:recordaudio event="odk-instance-load" ref="/data/my_recording"/>',
			],
		});
	});

	it("test_background_audio_voice_only", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |                  |              |                      |
			|        | type             | name         | parameters           |
			|        | background-audio | my_recording | quality=voice-only |
			`,
			xml__contains: [
				'<odk:recordaudio event="odk-instance-load" ref="/data/my_recording" odk:quality="voice-only"/>',
			],
		});
	});

	it("test_background_audio_low", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |                  |              |                      |
			|        | type             | name         | parameters           |
			|        | background-audio | my_recording | quality=low |
			`,
			xml__contains: [
				'<odk:recordaudio event="odk-instance-load" ref="/data/my_recording" odk:quality="low"/>',
			],
		});
	});

	it("test_background_audio_normal", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |                  |              |                      |
			|        | type             | name         | parameters           |
			|        | background-audio | my_recording | quality=normal |
			`,
			xml__contains: [
				'<odk:recordaudio event="odk-instance-load" ref="/data/my_recording" odk:quality="normal"/>',
			],
		});
	});

	it("test_external_quality_fails", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |                  |              |                      |
			|        | type             | name         | parameters           |
			|        | background-audio | my_recording | quality=external |
			`,
			errored: true,
			error__contains: ["Invalid value for quality."],
		});
	});

	it("test_foo_quality_fails", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |                  |              |                      |
			|        | type             | name         | parameters           |
			|        | background-audio | my_recording | quality=foo |
			`,
			errored: true,
			error__contains: ["Invalid value for quality."],
		});
	});
});
