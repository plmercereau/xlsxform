# xlsxform

TypeScript port of [pyxform](https://github.com/XLSForm/pyxform) — converts [XLSForms](https://xlsform.org) to [ODK XForms](https://getodk.github.io/xforms-spec/).

## Installation

```bash
npm install xlsxform
```

## Usage

```typescript
import { convert } from "xlsxform";

// From a workbook dict (plain JS object)
const result = convert({ xlsform: workbookDict, formName: "my_form" });
console.log(result.xform); // XForm XML string

// From an XLSX WorkBook (requires the optional `xlsx` peer dependency)
import * as XLSX from "xlsx";
const wb = XLSX.read(fileBuffer, { cellDates: true });
const result = convert({ xlsform: wb, formName: "my_form" });

// From a Markdown table (handy for tests)
const result = convert({
  xlsform: `
    | survey |      |       |        |
    |        | type | name  | label  |
    |        | text | name  | Name?  |
  `,
  fileType: "md",
});
```

`convert()` returns an object with:

- **`xform`** — the generated XForm XML string
- **`warnings`** — any conversion warnings
- **`itemsets`** — external itemsets XML, if applicable

See the [source types](./src/xls2xform.ts) for the full options and return type.

## License

[MIT](../LICENSE)
