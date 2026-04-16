/**
 * Additional tests for sheet-headers.ts coverage.
 * Targets: mergeDicts recursive path, dealiasAndGroupHeaders translation-then-plain,
 * processHeaderFull branches, cleanTextValues, and dealiasAndGroupSheet.
 */

import { describe, expect, it } from "vitest";
import {
	cleanTextValues,
	dealiasAndGroupHeaders,
	dealiasAndGroupSheet,
	processHeaderFull,
	processRow,
	toSnakeCase,
} from "../src/parsing/sheet-headers.js";

describe("cleanTextValues", () => {
	it("should replace smart quotes", () => {
		expect(cleanTextValues("\u2018hello\u2019")).toBe("'hello'");
		expect(cleanTextValues("\u201Cworld\u201D")).toBe('"world"');
	});

	it("should strip whitespace when requested", () => {
		expect(cleanTextValues("  hello   world  ", true)).toBe("hello world");
	});

	it("should return non-string values unchanged", () => {
		expect(cleanTextValues(42)).toBe(42);
		expect(cleanTextValues(null)).toBe(null);
	});
});

describe("toSnakeCase", () => {
	it("should convert multi-word to snake_case", () => {
		expect(toSnakeCase("Hello World")).toBe("hello_world");
		expect(toSnakeCase("  multiple   spaces  ")).toBe("multiple_spaces");
	});
});

describe("processHeaderFull", () => {
	const columns = new Set(["type", "name", "label", "hint"]);
	const aliases: Record<string, string | string[]> = {
		constraint_message: ["bind", "jr:constraintMsg"],
		required_message: "requiredMsg",
	};

	it("should return recognized column as-is", () => {
		const [header, tokens] = processHeaderFull(
			"label",
			true,
			aliases,
			columns,
		);
		expect(header).toBe("label");
		expect(tokens).toEqual(["label"]);
	});

	it("should normalize to snake_case when recognized", () => {
		const [header, tokens] = processHeaderFull(
			"Label",
			true,
			{ Label: "label" },
			columns,
		);
		// Label is in aliases, so goes through alias path
		expect(header).toBe("label");
	});

	it("should handle array alias (nested)", () => {
		const [header, tokens] = processHeaderFull(
			"constraint_message",
			true,
			aliases,
			columns,
		);
		expect(header).toEqual(["bind", "jr:constraintMsg"]);
		expect(tokens).toEqual(["bind", "jr:constraintMsg"]);
	});

	it("should handle string alias", () => {
		const [header, tokens] = processHeaderFull(
			"required_message",
			true,
			aliases,
			columns,
		);
		expect(header).toBe("requiredMsg");
		expect(tokens).toEqual(["requiredMsg"]);
	});

	it("should handle double-colon headers", () => {
		const [header, tokens] = processHeaderFull(
			"label::English",
			true,
			aliases,
			columns,
		);
		expect(tokens).toEqual(["label", "English"]);
	});

	it("should handle single-colon fallback with jr: prefix", () => {
		const [header, tokens] = processHeaderFull(
			"bind:jr:count",
			false,
			{},
			columns,
		);
		// "bind" + "jr" + "count" → jr rejoined → ["bind", "jr:count"]
		expect(tokens).toContain("jr:count");
	});

	it("should leave unknown headers unchanged", () => {
		const [header, tokens] = processHeaderFull(
			"unknown_col",
			true,
			aliases,
			columns,
		);
		expect(header).toBe("unknown_col");
	});
});

describe("dealiasAndGroupHeaders", () => {
	const aliases: Record<string, string | [string, string]> = {
		constraint_message: ["bind", "jr:constraintMsg"],
	};

	it("should handle translation column then plain column for same key", () => {
		// Process label::English first, then label → triggers lines 460-465
		const row = {
			"label::English": "Hello",
			label: "Default Hello",
		};
		const result = dealiasAndGroupHeaders(row, {});
		// label::English creates {label: {English: "Hello"}}
		// then label (plain) should add as default language
		expect(result.label).toEqual({
			English: "Hello",
			default: "Default Hello",
		});
	});

	it("should handle nested alias with translation", () => {
		const row = {
			"constraint_message::English": "Must be positive",
			"constraint_message::French": "Doit être positif",
		};
		const result = dealiasAndGroupHeaders(row, aliases);
		expect(result.bind).toBeDefined();
		const bind = result.bind as Record<string, unknown>;
		const msg = bind["jr:constraintMsg"] as Record<string, unknown>;
		expect(msg.English).toBe("Must be positive");
		expect(msg.French).toBe("Doit être positif");
	});

	it("should handle media columns with translations", () => {
		const row = {
			"media::audio::English": "en.mp3",
			"media::audio::French": "fr.mp3",
			"media::image": "pic.jpg",
		};
		const result = dealiasAndGroupHeaders(row, {});
		const media = result.media as Record<string, unknown>;
		expect(media.image).toBe("pic.jpg");
		expect((media.audio as Record<string, unknown>).English).toBe("en.mp3");
	});

	it("should skip null/empty values", () => {
		const row = { label: "Hello", hint: "" };
		const result = dealiasAndGroupHeaders(row, {});
		expect(result.label).toBe("Hello");
		expect(result.hint).toBeUndefined();
	});

	it("should handle bind::relevant nested header", () => {
		const row = { "bind::relevant": "${q1} = 'yes'" };
		const result = dealiasAndGroupHeaders(row, {});
		expect((result.bind as Record<string, unknown>).relevant).toBe(
			"${q1} = 'yes'",
		);
	});

	it("should convert existing string to dict when translation arrives", () => {
		// Process with single colon (not double)
		const row = {
			label: "Default",
			"label:English": "English text",
		};
		const result = dealiasAndGroupHeaders(row, {}, false, "default", false);
		expect(result.label).toEqual({
			default: "Default",
			English: "English text",
		});
	});
});

describe("processRow", () => {
	it("should process a simple row", () => {
		const headerKey: Record<string, string[]> = {
			type: ["type"],
			name: ["name"],
		};
		const result = processRow("survey", { type: "text", name: "q1" }, headerKey, 2);
		expect(result.type).toBe("text");
		expect(result.name).toBe("q1");
	});

	it("should add row number when requested", () => {
		const headerKey: Record<string, string[]> = { type: ["type"] };
		const result = processRow(
			"survey",
			{ type: "text" },
			headerKey,
			5,
			"default",
			false,
			true,
		);
		expect(result.__row).toBe(5);
	});

	it("should handle nested tokens", () => {
		const headerKey: Record<string, string[]> = {
			"bind::relevant": ["bind", "relevant"],
		};
		const result = processRow(
			"survey",
			{ "bind::relevant": "${q1} = 'yes'" },
			headerKey,
			2,
		);
		expect((result.bind as Record<string, unknown>).relevant).toBe(
			"${q1} = 'yes'",
		);
	});

	it("should throw for unknown header", () => {
		expect(() =>
			processRow("survey", { unknown: "val" }, {}, 2),
		).toThrow("Invalid headers");
	});
});

describe("processRow - mergeDictsWithLang paths", () => {
	it("should merge existing string with incoming object (lines 233-244)", () => {
		// First token puts a string value, second puts nested object for same key
		// This happens when label is first set as string, then label::English arrives
		const headerKey: Record<string, string[]> = {
			label: ["label"],
			"label::English": ["label", "English"],
		};
		const result = processRow(
			"survey",
			{ label: "Default", "label::English": "English text" },
			headerKey,
			2,
		);
		// label should be a dict with default and English
		expect(result.label).toEqual({
			default: "Default",
			English: "English text",
		});
	});

	it("should merge nested tokens with existing string (string + object merge)", () => {
		// First a single-token header sets a string, then multi-token header creates nested
		// This exercises the mergeDictsWithLang string+object path
		const headerKey: Record<string, string[]> = {
			label: ["label"],
			"label::English": ["label", "English"],
		};
		const result = processRow(
			"survey",
			{ label: "Default", "label::English": "English text" },
			headerKey,
			2,
		);
		// mergeDictsWithLang should merge string "Default" with {English: "English text"}
		const label = result.label as Record<string, unknown>;
		expect(label.English).toBe("English text");
		expect(label.default).toBe("Default");
	});
});

describe("dealiasAndGroupSheet", () => {
	it("should process sheet data with headers", () => {
		const columns = new Set(["type", "name", "label"]);
		const result = dealiasAndGroupSheet(
			"survey",
			[{ type: "text", name: "q1", label: "Q1" }],
			[{ type: null, name: null, label: null }],
			{},
			columns,
		);
		expect(result.data.length).toBe(1);
		expect(result.data[0].type).toBe("text");
	});

	it("should guess headers from data when none provided", () => {
		const columns = new Set(["type", "name"]);
		const result = dealiasAndGroupSheet(
			"survey",
			[{ type: "text", name: "q1" }],
			null,
			{},
			columns,
		);
		expect(result.data.length).toBe(1);
	});

	it("should throw for duplicate aliased headers", () => {
		const columns = new Set(["type", "name", "label"]);
		const aliases = { Label: "label" };
		expect(() =>
			dealiasAndGroupSheet(
				"survey",
				[{ label: "Q1", Label: "Q1b" }],
				[{ label: null, Label: null }],
				aliases,
				columns,
			),
		).toThrow("different names for the same column");
	});

	it("should throw for missing required headers", () => {
		const columns = new Set(["type", "name", "label"]);
		const required = new Set(["type", "name"]);
		expect(() =>
			dealiasAndGroupSheet(
				"survey",
				[{ label: "Q1" }],
				[{ label: null }],
				{},
				columns,
				required,
			),
		).toThrow("required column headers");
	});
});
