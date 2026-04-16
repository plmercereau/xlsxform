/**
 * Port of test_xls2xform.py - Tests for xls2xform module.
 */

import { describe, expect, it } from "vitest";
import { convert } from "../src/xls2xform.js";
import { assertPyxformXform } from "./helpers/test-case.js";

// The Python tests heavily test CLI argument parsing (_create_parser, _validator_args_logic)
// and file I/O (xls2xform_convert). The TS port only has the `convert` API, so CLI/parser
// tests are marked as TODO and convert-API tests are ported directly.

describe("XLS2XFormTests", () => {
	// TODO: requires CLI parser API
	it("test_create_parser_without_args", () => {
		// TODO: requires CLI parser API (_create_parser)
		// Should exit when no args provided.
	});

	// TODO: requires CLI parser API
	it("test_create_parser_optional_output_path", () => {
		// TODO: requires CLI parser API (_create_parser)
		// Should run fine for a single argument (path to xlsx file)
	});

	// TODO: requires CLI parser API
	it("test_create_parser_with_args", () => {
		// TODO: requires CLI parser API (_create_parser)
		// Should parse the provided arguments.
	});

	// TODO: requires CLI parser API
	it("test_create_parser_file_name_with_space", () => {
		// TODO: requires CLI parser API (_create_parser)
		// Should interpret the path correctly.
	});

	// TODO: requires CLI parser API
	it("test_create_parser_json_default_false", () => {
		// TODO: requires CLI parser API (_create_parser)
		// Should have json=False if not specified.
	});

	// TODO: requires CLI parser API
	it("test_create_parser_skip_validate_default_true", () => {
		// TODO: requires CLI parser API (_create_parser)
		// Should have skip_validate=True if not specified.
	});

	// TODO: requires CLI parser API
	it("test_create_parser_no_enketo_default_false", () => {
		// TODO: requires CLI parser API (_create_parser)
		// Should have enketo_validate=False if not specified.
	});

	// TODO: requires CLI parser API
	it("test_create_parser_pretty_print_default_False", () => {
		// TODO: requires CLI parser API (_create_parser)
		// Should have pretty_print=False if not specified.
	});

	// TODO: requires CLI parser API
	it("test_validator_args_logic_skip_validate_alone", () => {
		// TODO: requires CLI parser API (_validator_args_logic)
		// Should deactivate both validators.
	});

	// TODO: requires CLI parser API
	it("test_validator_args_logic_odk_default", () => {
		// TODO: requires CLI parser API (_validator_args_logic)
		// Should activate ODK only.
	});

	// TODO: requires CLI parser API
	it("test_validator_args_logic_enketo_only", () => {
		// TODO: requires CLI parser API (_validator_args_logic)
		// Should activate Enketo only.
	});

	// TODO: requires CLI parser API
	it("test_validator_args_logic_odk_only", () => {
		// TODO: requires CLI parser API (_validator_args_logic)
		// Should activate ODK only.
	});

	// TODO: requires CLI parser API
	it("test_validator_args_logic_odk_and_enketo", () => {
		// TODO: requires CLI parser API (_validator_args_logic)
		// Should activate ODK and Enketo.
	});

	// TODO: requires CLI parser API
	it("test_validator_args_logic_skip_validate_override", () => {
		// TODO: requires CLI parser API (_validator_args_logic)
		// Should deactivate both validators.
	});

	// TODO: requires CLI parser API (main_cli, mock)
	it("test_xls2form_convert_parameters", () => {
		// TODO: requires CLI parser API (main_cli, mock patching)
		// Checks that xls2xform_convert is given the right arguments,
		// when the output-path is not given.
	});

	// TODO: requires CLI parser API (main_cli, mock)
	it("test_xls2xform_convert_params_with_flags", () => {
		// TODO: requires CLI parser API (main_cli, mock patching)
		// Should call xlsform_convert with the correct input for output path
		// where only the xlsform input path and json flag were provided.
	});

	// TODO: requires CLI parser API (main_cli, mock)
	it("test_xls2xform_convert_throwing_odk_error", () => {
		// TODO: requires CLI parser API (main_cli, mock patching)
		// Parse and validate bad_calc.xlsx
	});

	// TODO: requires file I/O API
	it("test_get_xml_path_function", () => {
		// TODO: requires file I/O API (get_xml_path)
		// Should return an xml path in the same directory as the xlsx file.
	});
});

describe("TestXLS2XFormConvert", () => {
	// TODO: requires file I/O API
	it("test_xls2xform_convert__ok", () => {
		// TODO: requires file I/O API (xls2xform_convert with file paths)
		// Should find the expected output files for the conversion.
		// Tests various xlsform files (group.xlsx, group.xls, group.csv, group.md,
		// choice_name_as_type.xls) with combinations of validate and pretty_print.
	});
});

describe("TestXLS2XFormConvertAPI", () => {
	// TODO: requires file I/O API for file-based inputs
	it("test_args_combinations__ok", () => {
		// TODO: requires file I/O API for file-based inputs
		// Should find that generic call patterns return a ConvertResult without error.
		// Tests str path, PathLike, bytes, BytesIO, BinaryIO, str data inputs.
	});

	// TODO: requires file I/O API
	it("test_invalid_input_raises", () => {
		// TODO: requires file I/O API
		// Should raise an error for invalid input or file types.
		// Tests None, "", b"", "ok", b"ok", empty file, bad.xls, bad.xlsx, bad.txt.
	});

	it("test_call_with_dict__ok", () => {
		/**
		 * Should find that passing in a dict returns a ConvertResult without error.
		 * Python test uses "label:English (en)" keys; TS convert uses "label" directly.
		 */
		const ssStructure = {
			survey: [
				{
					type: "text",
					name: "family_name",
					label: "What's your family name?",
				},
				{
					type: "begin group",
					name: "father",
					label: "Father",
				},
				{
					type: "phone number",
					name: "phone_number",
					label: "What's your father's phone number?",
				},
				{
					type: "integer",
					name: "age",
					label: "How old is your father?",
				},
				{
					type: "end group",
				},
			],
		};
		const observed = convert({ xlsform: ssStructure });
		expect(observed).toBeDefined();
		expect(observed.xform.length).toBeGreaterThan(0);
	});

	it("test_call_with_dict__ok_via_assertPyxformXform", () => {
		/**
		 * Same as test_call_with_dict__ok but using assertPyxformXform with ss_structure.
		 */
		const result = assertPyxformXform({
			ss_structure: {
				survey: [
					{
						type: "text",
						name: "family_name",
						label: "What's your family name?",
					},
					{
						type: "begin group",
						name: "father",
						label: "Father",
					},
					{
						type: "phone number",
						name: "phone_number",
						label: "What's your father's phone number?",
					},
					{
						type: "integer",
						name: "age",
						label: "How old is your father?",
					},
					{
						type: "end group",
					},
				],
			},
			xml__contains: ["<family_name/>", "<phone_number/>", "<age/>"],
		});
		expect(result).not.toBeNull();
		expect(result?.xform.length).toBeGreaterThan(0);
	});
});
