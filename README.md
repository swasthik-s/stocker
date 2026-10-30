# Stocker

A TypeScript / Next.js rebuild of [stk-adj](https://github.com/swasthik-s/stk-adj), designed for Vercel and MongoDB Atlas without a Python backend.

## Stack

- Next.js 15 App Router + TypeScript
- shadcn/ui component conventions (New York style), Radix UI primitives, Tailwind CSS v4 and Lucide icons
- MongoDB Atlas (stockadj database; legacy collection names retained)
- SheetJS / ExcelJS for spreadsheet import and export
- PDF.js and pdf-lib for PDF workflows
- Vitest regression tests

## Current migration build

| Area | Current state |
|---|---|
| Responsive application shell and dashboard | Implemented |
| shadcn/ui component foundation | Implemented: button, card, badge, input, table, checkbox, select, dialog, separator |
| Negative report + master workbook import | Browser-side CSV/XLS/XLSX import |
| Bundle-break matcher | TypeScript port with conservative gates and inverted token index; regression tests added |
| Wrong-sale matcher | TypeScript port with strict product/variant/price gates; regression tests added |
| Manual pairing | Explicit operator override with stock and conversion checks |
| iTrade TXT output | Single-item quantity is positive; outer quantity is negative; 7-decimal cost formatting |
| Master audit | Negative stock, below-cost, missing barcode/name, duplicate barcode, invalid cost |
| Category breakdown | Negative stock count, quantity and value |
| Matching run history | MongoDB runs write and history listing |
| Settings | MongoDB app_settings read/write |
| Item templates | Editable item worksheet and GP% calculator; XLSX draft export |
| PDF tools | Digital/selectable text extraction and XLSX export |
| Scanned OCR + invoice reconciliation | Not yet ported; no OCR-derived import is enabled |
| Original PDF template generation and custom workbook layout preservation | Not yet ported |
| Full session/snapshot save/restore and batch file storage | Not yet ported |
| API access control | Protected MongoDB APIs require STOCKER_API_TOKEN; full user roles/session authentication remains pending |

## Run locally

Node.js 20+:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set MONGODB_URI and optionally MONGODB_DB=stockadj for history/settings. Checks:

```bash
npm run typecheck
npm test
npm run build
```

## Matcher safety invariants

- Candidate suggestions only; never post stock adjustments.
- Use an inverted token index rather than all-pairs comparison.
- Reject mismatched class, brand, leading product token, explicit size, apparel size, model/style code and product variants.
- Metadata pack quantity is not proof of an outer SKU: exact normalized description and unit-cost corroboration are required.
- Explicit pack count, positive active outer stock and stock coverage are required.
- Combo/set/already-multipack/weighted-KG items are excluded or flagged for manual review.
- Manual pairings are marked MANUAL_OVERRIDE; operator must verify identity, conversion and costs.
- iTrade TXT uses PREFIX,barcode,cost,quantity, no header/quotes. Bundle-break single quantity is positive; outer quantity is negative.
- Preserve barcodes as text, including leading zeroes.
- GP% = (RSP - COST) / RSP * 100; blank when RSP is missing or zero.
- OCR import must fail closed unless invoice line totals reconcile to the invoice header within AED 0.05.

## Scale and deployment

Legacy validation notes reference 102,652 master rows and 1,565 negative lines. Keep parsing and matching in the browser where possible; do not send the full master workbook as a huge JSON request to Vercel. Vercel functions have bounded execution time and memory. OCR runtime compatibility, spreadsheet formatting parity, auth and the complete legacy workflows must be validated before production cutover.

Preserve existing MongoDB collections: runs, batches, templates, sessions, snapshots, app_settings, and layouts. Never drop or rename them.
