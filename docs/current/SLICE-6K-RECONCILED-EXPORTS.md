# Development slice 6k — reconciled operational export

30 September 2026 (IST). Builds on the R11 scoped CSV export. Synthetic data only; formal acceptance unchanged.

## What changed

- **Identification.** The Operations CSV (`GET /api/operations?format=csv`) now opens with its report definition and version (`saha-operational-report` 1.1.0), a new export identifier, the status "Draft export; not an official or reviewed submission", the exporting member's name and role, the window in days and the teams in scope, before the existing generation time, window start and scope rows.
- **Control totals.** A closing section ties four displayed measures to the sum of their detail rows: visits confirmed in the window against the daily rows, open and overdue follow-ups against the programme rows, and unresolved programme receipts against the destination rows. Each line says whether it reconciles.
- **Manifest.** The last two lines give the number of rows above them and the SHA-256 of those rows exactly as written. A receiver checks the file with `head -n -2 saha-report.csv | wc -l` and `head -n -2 saha-report.csv | sha256sum`. Line breaks inside a cell are written as spaces so that each row is one line. `lib/saha/report-export.ts` also has `verifyExportCsv`, which recounts, rehashes and reads the control totals.
- **Provenance.** The export identifier and checksum are returned in `X-Saha-Export-Id` and `X-Saha-Content-SHA256`, and recorded in the export's audit line with the definition, row count and reconciliation result, so a received file can be matched to the export that produced it. The page confirms the download with the identifier and the start of the checksum.
- **Access** is unchanged: supervisors and owners with care scope may export; administrators, care roles and non-members may not.

## Evidence

- 7 contract checks (`tests/report-export-contract.mjs`): identification rows, with formula escaping still applied to a team name; control totals against a fixture with known sums; manifest row count and SHA-256 against Node's own hash, and the receiver recipe run literally with coreutils; an edited figure, a dropped row and a missing manifest each detected; an inconsistent report flagged "no" and refused by verification; the refactored report rows give the same CSV through the old and new helpers and still begin with the original title and generation rows; an export with no teams says so.
- 10 HTTP/D1 assertions (`tests/report-export-smoke.mjs`): a supervisor's export carries the identification rows, a manifest matching its content and response headers, four reconciled control totals, and figures equal to the Operations page read just before it; the audit line names the export identifier, checksum and definition; administrator, ASHA and stranger downloads refused.
- Browser check (headless Chromium, built Worker, synthetic owner): the CSV downloaded from the Operations page matched its own manifest, its four control totals reconciled, and the confirmation named the same checksum. No console errors. `tests/evidence/slice-6k/browser-export.json`.
- The accessibility audit on this build, which also carries the slice 4b and 6i panels, found no violations on 24 screens (`tests/evidence/slice-6k/a11y-audit-result.json`).
- All suites: see [VALIDATION.md](../../VALIDATION.md). Reports in `tests/evidence/slice-6k/`.

## Limits

- The export reconciles within itself and to the page at the moment it is generated. A figure shown on screen earlier can differ if records changed in between; the file carries its own generation time.
- A downloaded file has no protected expiry: once saved it is outside the application. Filters are the window and the viewer's teams only.
- There is no official reporting lifecycle. Every export is a draft; review, approval and submission of an official report (BR-REP-05's distinct state) are not built. The checksum shows the file is unchanged since export; it is not a signature and does not prove who sent it.

## Correction, 30 September 2026 (slice 6p)

An independent review after this slice was built found that the CSV and support exports recorded their `opsExport` audit event against the state read at the start of the request, so a command saved by a teammate while the export was generated made it fail with 409 and nothing was delivered. Slice 6p records the event through `persist` with a bounded retry on a fresh read that repeats the authority check for the format (CSV: not an administrator; support: owner or administrator) and refuses if the role changed. See [slice 6p](SLICE-6P-REVIEW-FIXES.md). The text above is kept as written.
