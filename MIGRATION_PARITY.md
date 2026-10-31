# Full TypeScript + shadcn/ui Migration

This branch tracks a feature-parity port of `swasthik-s/stk-adj` into `swasthik-s/stocker`.

## Acceptance criteria

- All runtime business logic is TypeScript. No Python service or Streamlit runtime is required.
- The original repository is the behavioral specification. Preserve formulas, validations, file formats, persistence semantics, and safety gates.
- Every interactive UI control uses an actual shadcn/ui component or a composed shadcn pattern. No raw styled form controls.
- Remove application-specific global CSS selectors (for example `.field`, `.panel`, `.button`, `.alert`, `.metric`). Keep only Tailwind/shadcn theme setup and required framework imports.
- Keep the existing dark visual direction, but implement it through shadcn theme tokens and component variants.
- Keep barcode values as text, preserve decimal precision, and never auto-post inventory changes to iTrade.
- Automated tests cover matching, conversion, import parsing, validation, template mapping/filling, invoice extraction/reconciliation, and output formatting.
- A feature is not complete until its implementation and tests are checked. Deployment verification is reported separately.

## Original workflow inventory

### Negative stock
- Master CSV import and negative-stock XLSX import.
- Workbook sheet selection, automatic header detection, manual column mapping, and preview.
- Barcode normalization and duplicate-barcode diagnostics.
- Bundle-break and wrong-sale candidate discovery with explainable match reasons.
- Combo/set/weighted-item exclusions and manual-review cases.
- Cost drift, conversion, available-parent-stock and coverage checks.
- Candidate review, filters, extra columns, manual pairing and verification workbook round-trip.
- Adjustment workbook generation, split sheets, previews, remarks, signatories and iTrade TXT output.
- Saved sessions, snapshots, runs, batches, archive restore and deletion.

### Master audit
- CSV parsing and explicit column mapping.
- Overview, negative stock, below-cost, data issues, healthy items and all-items views.
- Filtered tables, issue counts and report exports.

### PDF tools
- Digital PDF text extraction and table extraction.
- Invoice header and invoice-line parsing.
- OCR for scanned PDFs, page selection, bounding-box row reconstruction and page-level extraction.
- XLSX/TXT exports and iTrade import-file generation.
- Invoice total reconciliation; OCR-derived iTrade import must remain blocked unless totals reconcile within AED 0.05.
- Clear skipped-line diagnostics and per-table/page exports.

### Item templates
- New-item creation, activation and description-change forms with type-specific fields.
- GP calculation, required-field checks, row-level warnings, edit/remove/reset and print preview.
- Generated reference numbers and signatories from Settings.
- PDF and XLSX output, saved-template archive, reopen/edit/reissue/delete.
- Three built-in workbook layouts.
- Custom XLSX upload, layout scan, editable field/column mapping, collision/required-field validation, sample test and save/reset.
- Fill uploaded workbooks while preserving formatting, formulas, merged cells, dimensions, print settings and signatures.

### Settings and history
- MongoDB health and storage diagnostics.
- Save behavior, retention, matching/output defaults, document signatories and access/PIN controls.
- History browsing, session restore, batch/template download and deletion.
- Retention pruning must only run when enabled and must be observable/testable.

## Known baseline gaps (at migration start)

- Current PDF page is a digital-text extractor only; OCR, invoice parsing, reconciliation and iTrade export are not ported.
- Current Item Templates page is a simplified XLSX grid; it does not implement the original three form workflows, PDF, archive or custom layouts.
- Current History page is read-only and does not implement the original restore/download/delete interactions.
- Current Settings page does not implement the full original storage diagnostics and access/PIN workflow.
- Current negative-stock UI does not yet expose all original diagnostics, manual mapping, verification workbook, adjustment workbook, archive and batch workflows.
- Current Master Audit page does not yet reproduce all original tabs, mapping, filters and report types.
- Current UI still contains raw native controls and application-specific CSS selectors; shadcn usage is incomplete.

## Delivery sequence

1. Establish shadcn component system and remove bespoke form-control styling.
2. Complete negative-stock import, review, verification, workbook and archive workflows.
3. Complete Master Audit parity.
4. Port item-template generation and custom workbook layouts.
5. Port PDF text/table/invoice/OCR/reconciliation/export workflows.
6. Complete Settings, History, retention and access workflows.
7. Run all automated tests, typecheck and production build; verify the Vercel deployment separately.

Do not mark the migration complete while any acceptance criterion or original workflow above remains unimplemented or unverified.
