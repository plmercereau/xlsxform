# xlsxform

TypeScript port of [pyxform](https://github.com/XLSForm/pyxform) — converts [XLSForms](https://xlsform.org) to [ODK XForms](https://getodk.github.io/xforms-spec/).

**[Live demo](https://xlsxform.vercel.app)** — upload an XLSForm and preview it as a live ODK web form powered by [@getodk/web-forms](https://github.com/getodk/web-forms). Runs entirely in the browser, no backend.

## Getting started

```bash
npm install xlsxform
```

```typescript
import { convert } from "xlsxform";

// Convert from an XLSX WorkBook (requires the optional `xlsx` peer dependency)
import * as XLSX from "xlsx";
const wb = XLSX.read(fileBuffer, { cellDates: true });
const result = convert({ xlsform: wb, formName: "my_form", prettyPrint: true });
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

See the [xlsxform README](xlsxform/README.md) for full API documentation.

## Development

```bash
pnpm install           # Install all dependencies
pnpm run build         # Build all packages
pnpm run test          # Run all tests
pnpm run lint          # Lint all packages
pnpm run typecheck     # Typecheck all packages
```

| Directory              | Description                                |
| ---------------------- | ------------------------------------------ |
| [`xlsxform`](xlsxform) | Core library — XLSForm to XForm conversion |
| [`demo`](demo)         | Demo app — upload & preview XLSForms       |