/**
 * A permissive value type for XLSForm row data and question dictionaries.
 *
 * XLSForm data is inherently dynamic: rows from spreadsheet sheets are
 * transformed into nested structures (translated labels, bind objects,
 * control attributes, children arrays, etc.). This type uses an interface
 * with a self-referencing index signature to allow arbitrary nested
 * property access without explicit casts.
 */
export interface FormRecord {
	[key: string]: unknown;
}
