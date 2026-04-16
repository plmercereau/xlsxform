# jsxform

TypeScript port of [pyxform](https://github.com/XLSForm/pyxform) — converts [XLSForms](https://xlsform.org) to [ODK XForms](https://getodk.github.io/xforms-spec/).

**[Live demo](https://jsxform.vercel.app)** — upload an XLSForm and preview it as a live ODK web form powered by [@getodk/web-forms](https://github.com/getodk/web-forms). Runs entirely in the browser, no backend.

## Getting started

```bash
npm install jsxform
```

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

See the [jsxform README](jsxform/README.md) for full API documentation.

## Development

```bash
pnpm install           # Install all dependencies
pnpm run build         # Build all packages
pnpm run test          # Run all tests
pnpm run lint          # Lint all packages
pnpm run typecheck     # Typecheck all packages
```

| Directory            | Description                                |
| -------------------- | ------------------------------------------ |
| [`jsxform`](jsxform) | Core library — XLSForm to XForm conversion |
| [`demo`](demo)       | Demo app — upload & preview XLSForms       |