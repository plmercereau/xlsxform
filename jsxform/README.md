# jsxform

TypeScript port of [pyxform](https://github.com/XLSForm/pyxform) — converts [XLSForms](https://xlsform.org) to [ODK XForms](https://getodk.github.io/xforms-spec/).

## Installation

```bash
npm install jsxform
```

## Quick start

```typescript
import { convert } from "jsxform";

// Convert from a JSON workbook dict
const result = convert({
  xlsform: workbookDict,
  prettyPrint: true,
  formName: "my_form",
});
console.log(result.xform); // XForm XML string

// Convert from a Markdown table
const result2 = convert({
  xlsform: `
    | survey |      |       |        |
    |        | type | name  | label  |
    |        | text | name  | Name?  |
  `,
  fileType: "md",
});
```

## API

### `convert(opts)`

Main entry point. Accepts a workbook dictionary or Markdown string, and returns XForm XML.

**Options:**

| Option            | Type                                | Default    | Description                    |
| ----------------- | ----------------------------------- | ---------- | ------------------------------ |
| `xlsform`         | `string \| Record<string, unknown>` | *required* | Markdown string or workbook dict |
| `prettyPrint`     | `boolean`                           | `true`     | Pretty-print the XML output    |
| `validate`        | `boolean`                           | `false`    | Run ODK Validate on the result |
| `enketo`          | `boolean`                           | `false`    | Enable Enketo validation mode  |
| `formName`        | `string \| null`                    | `null`     | Override the form name         |
| `defaultLanguage` | `string \| null`                    | `null`     | Set the default language       |
| `fileType`        | `string \| null`                    | `null`     | Force file type detection      |
| `warnings`        | `string[]`                          | `[]`       | Array to collect warnings      |

**Returns:** `ConvertResult`

```typescript
interface ConvertResult {
  xform: string;           // Generated XForm XML
  warnings: string[];      // Conversion warnings
  itemsets: string | null;  // External itemsets XML
  _pyxform: Record<string, unknown> | null; // Intermediate JSON (debug)
  _survey: Survey | null;  // Survey object (debug)
}
```

### Builder functions

For more control over the conversion pipeline:

```typescript
import { createSurvey, createSurveyElementFromDict } from "jsxform";

// From a survey definition dict
const survey = createSurvey({ nameOfMainSection: "survey", sections });
```

### Low-level parsing

```typescript
import { workbookToJson, mdToDict } from "jsxform";

// Parse a Markdown table (useful for testing)
const workbook = mdToDict(`
  | survey |      |       |        |
  |        | type | name  | label  |
  |        | text | name  | Name?  |
`);
```

## Supported features

- **Question types**: text, integer, decimal, select_one, select_multiple, rank, geopoint, geotrace, geoshape, image, audio, video, barcode, calculate, note, range, and more (130+ types)
- **Structure**: groups, repeats, loops
- **Logic**: relevance conditions, constraints, calculations, required fields, default values
- **Translations**: multi-language support
- **Choices**: static lists, cascading selects, external choices, filtered itemsets, search appearance
- **Media**: images, audio, and video on questions and choices
- **Entities**: ODK entity creation and updates
- **Metadata**: deviceid, start/end time, audit logging, and other metadata fields
- **Validation**: optional ODK Validate and Enketo validation

## Development

```bash
pnpm run build       # Compile TypeScript
pnpm run test        # Run tests
pnpm run test:watch  # Watch mode
pnpm run coverage    # Test coverage
pnpm run lint        # Lint with Biome
pnpm run format      # Format with Biome
```
