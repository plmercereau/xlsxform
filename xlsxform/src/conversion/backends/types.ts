/**
 * Type definitions for XLSForm backend data structures.
 */

/** A single row of form data with string keys and string values. */
export type FormRow = Record<string, string>;

/** Cell value types that can appear in spreadsheet cells. */
export type CellValue = string | number | boolean | Date;

/** Duck-typed XLSX worksheet cell. */
export interface XlsxCell {
	v?: CellValue;
}

/** Duck-typed XLSX worksheet — plain object keyed by cell addresses like "A1". */
export interface XlsxWorkSheet {
	"!ref"?: string;
	[cell: string]: unknown;
}

/** Duck-typed XLSX WorkBook. */
export interface XlsxWorkBook {
	SheetNames: string[];
	Sheets: Record<string, XlsxWorkSheet>;
}

export interface DefinitionData {
	survey: FormRow[];
	choices: FormRow[];
	settings: FormRow[];
	external_choices: FormRow[];
	entities: FormRow[];
	osm: FormRow[];
	survey_header?: Record<string, null>[];
	choices_header?: Record<string, null>[];
	settings_header?: Record<string, null>[];
	external_choices_header?: Record<string, null>[];
	entities_header?: Record<string, null>[];
	osm_header?: Record<string, null>[];
	fallback_form_name?: string;
	sheet_names?: string[];
}
