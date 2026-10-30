# Stocker

TypeScript/Next.js rebuild of [stk-adj](https://github.com/swasthik-s/stk-adj), targeting Vercel with no separately hosted Python runtime.

> **Migration foundation only.** Do not use for live stock adjustments until all feature parity and differential tests pass.

## Stack
Next.js App Router, TypeScript, MongoDB Atlas, ExcelJS, PDF.js/pdf-lib, Zod, Vitest and Vercel.

## Run
Node.js 20+. Run `npm install`, copy `.env.example` to `.env.local`, configure it, then `npm run dev`. Checks: `npm run typecheck && npm test && npm run build`.

## Legacy feature parity
| Feature | Status |
|---|---|
| Negative-stock overview/category totals/concentration/dead barcodes | Pending |
| Conservative bundle-break and wrong-sale matcher | Initial TypeScript port; differential validation pending |
| Candidate selection/review/manual pair/conversion/cost drift | Pending |
| Signed verification workflow | Pending |
| XLSX output and iTrade TXT import | Pending |
| Master sheet audit | Pending |
| Digital PDF tables, scanned OCR, invoice parsing and reconciliation | Pending |
| Item creation/activation/description templates and GP% | Pending |
| Uploaded Excel layout scan/mapping/style-preserving fill | Pending |
| Sessions/snapshots/runs/batches/archive/restore | Pending |
| Settings, retention, defaults and authentication | Defaults documented; UI pending |

## Matcher invariants
Candidate suggestions only; never posts adjustments. Preserve description normalization, size-unit canonicalization, pack-count extraction, class/brand/leading-token gates, size/apparel/model/variant conflict rejection, active/positive-stock checks, cost corroboration for metadata-only pack quantities, and manual review of combos/sets/already-multipacks/weighted KG items.

## Scale and Vercel
Legacy validation notes describe 102,652 master rows and 1,565 negative rows. Use inverted indexes, not all-pairs matching. Vercel functions are bounded executions, not always-running workers. Large files should use browser parsing or direct-to-object-storage uploads; do not post huge JSON payloads. OCR compatibility and accuracy must be proven, not assumed.

Preserve MongoDB collections: `runs`, `batches`, `templates`, `sessions`, `snapshots`, `app_settings`. Do not rename/drop them.

## Release acceptance
Carry the eight Python matcher regression tests into Vitest and compare outputs against Python fixtures. Verify barcode preservation/leading zeroes, seven-decimal cost precision, workbook formulas/styles, GP% = (RSP-COST)/RSP*100, OCR fail-closed reconciliation within AED 0.05, archive/restore/template reload and retention. Never add automatic stock posting.
