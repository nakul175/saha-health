# Development slice 14g — suppression on every export path, a patient-export purpose, held downloads that expire, wider filters

4 October 2026 (IST), round 14. Requirement R81 (BR-REP-04, BR-REP-05). Built on `main` 2adfbde1, independent of slices 14a–14f. Synthetic data only; formal acceptance unchanged. Built by one agent; no independent review.

## What the sponsor asked for

Small-number suppression and withheld records must apply on every export and report path, not only where they existed. There should be a separate purpose for patient-level exports, a protected expiry on downloaded files, and wider filters. The first step was to list every path that sends data out of Saha and record which ones already suppress.

## The inventory (what was found)

Every route handler under `app/api` (68 including the two added here), every source file that sets `Content-Disposition`, every screen that saves a file, and every outbound command is classified in `lib/saha/export-routes.ts`. The classification is a data file, not a policy engine: the protection lives in the named source files and the contract test checks that the named evidence is still there.

Counts by kind: 11 file exports, 5 aggregate views, 5 outbound requests, 5 inbound, 6 mutations, 36 record views. Outbound and disclosing commands (the keys of `COMMAND_PURPOSE`): 29, of which exactly one carries aggregates (`sendAggregateReport`).

Files and aggregate views, with what protected them before this slice and now:

| Route | Carries | Suppression | Purpose | Audit before it leaves | Notes |
| --- | --- | --- | --- | --- | --- |
| `GET /api/operations` | file-export / aggregate | added-14g | reporting | opsExport | format=csv is suppressed (slice 14g); format=support is configuration counters only; the JSON view is the unsuppressed in-app view of the viewer's own authorised scope (see the slice document). |
| `GET /api/exports` | file-export / aggregate | added-14g | reporting | exportDownload | Delivers a held, already-suppressed operational CSV once before it expires. |
| `POST /api/exports` | file-export / aggregate | added-14g | reporting | opsExport | Prepares and holds the suppressed operational CSV through the ordinary operations export. |
| `GET /api/indicators` | aggregate-view / aggregate | applied | reporting | none | Catalogue and interpretation only; results are POST. |
| `POST /api/indicators` | file-export / aggregate | applied | reporting | indicatorExport | Query results and the CSV (format=csv) share the suppression, minimum cohorts and differencing ledger (slices 6d, 6s, 6w, 6aa). |
| `GET /api/aggregate-reports` | aggregate-view / aggregate | applied | reporting | none | History of reports prepared for aggregate-only destinations; cells are the suppressed indicator cells (slice 7g). |
| `GET /api/data-exit` | file-export / record | record-level | patient-export | organisationExport | Owner only; patient-linked rows outside the owner's care scope are withheld and counted (slice 6m). Patient-export purpose added in 14g. |
| `GET /api/fhir/[id]` | file-export / record | record-level | patient-export | downloadFhir | One confirmed visit as a FHIR document; scope, restriction and exceptional-access checks apply. Patient-export purpose added in 14g. |
| `GET /api/audit/chain` | file-export / audit | record-level | none | auditChainExport | Owners and administrators; patient-linked events are exported as digests only. Checkpoints carry a hash and sequence number. |
| `GET /api/incentive-claims` | file-export / record | record-level | none | incentiveExport | format=csv; approved synthetic claims in the viewer's scope, no patient name or identifier. One row is one claim, not an aggregate. |
| `POST /api/import-rejections` | file-export / record | record-level | none | importRejectionsExport | Row numbers and reasons from the importer's own upload; no clinical value. |
| `GET /api/pilot` | file-export / config | not-applicable | none | pilotExport | format=export; the dossier lists configuration, accounts and measurements the viewer may already read. |
| `GET /api/expansion` | file-export / config | not-applicable | none | expansionExport | format=pack; configuration only. |
| `GET /api/worker-activity` | aggregate-view / aggregate | in-app-unsuppressed | none | none | Per-worker counts of actions on patients in the viewer's scope; counts about workers, shown to their supervisors in the app. |
| `GET /api/alerts` | aggregate-view / aggregate | in-app-unsuppressed | none | none | In-app alert inbox; counts are from the member's own scope. |
| `GET /api/caseload` | aggregate-view / aggregate | in-app-unsuppressed | none | none | Caseload sizes per worker for the viewer's teams. |

Plain-language reading of the table:

- **Aggregate counts that leave Saha as a file or a send** were three: the indicator CSV and query results (suppressed since slices 6d and 6s), the aggregate report sent to an aggregate-only destination (suppressed since slice 7g), and the **operational report CSV** (`GET /api/operations?format=csv`). The operational CSV was the only one with no suppression: it carried the number of patients, visits confirmed per day, open and overdue follow-ups per programme, and submissions per destination exactly as counted, including values of 1 to 4. That is the gap this slice closes.
- **Record-level files** (data exit, FHIR download, audit chain export, incentive CSV, import rejection report, pilot dossier, expansion pack) are not aggregates, so small-number suppression does not apply. Their protection is scope (patient-linked rows outside the owner's care scope are withheld and counted in the data exit; patient-linked audit events are digests only in the audit export), a role gate and an audit event written before the file leaves. This slice leaves them as they are, except that the data exit and the FHIR download now also need the new patient-export purpose.
- **In-app views of the viewer's own scope** (the operations JSON view, worker activity, alerts, caseload) are shown unsuppressed. The viewer can already open every patient counted. This is a decision for the sponsor rather than a defect fixed here (see "Not built").

## What changed

1. **Suppression on the operational report CSV** (`lib/saha/export-suppression.ts`, `lib/saha/report-export.ts`; report definition version 1.2.0):
   - A count of 1 to 4 is written as `<5`. Zero is written as 0.
   - If the report covers 1 to 4 people, every count is `withheld`, zeros included.
   - Where a breakdown adds up to a total that is shown (visits confirmed per day, open and overdue follow-ups per programme, pending submissions per destination) and exactly one cell was suppressed, the smallest other non-zero cell is also `withheld`, so the suppressed cell cannot be recovered by subtraction.
   - The control totals still compare the full figures inside Saha. In the file, a total whose breakdown contains a suppressed cell shows its total, no row sum and the status `withheld`; a real mismatch still shows `no`. The receiver's check (`verifyExportCsv`) accepts `yes` and `withheld` and still catches `no`.
   - The file states the rule, the number of cells suppressed or withheld, and the filters used. The audit line carries the same cell count and filters. The JSON view is unchanged.
2. **Wider filters** (BR-REP-05): `team` and `programme` on `GET /api/operations` (JSON and CSV). A team outside the viewer's reporting reach is refused (403); an unknown programme is refused (422). A filter can only narrow the reach. Active workers are recomputed for the filtered people.
3. **A separate patient-export purpose** (`lib/saha/purpose-scope.ts`): `patient-export` joins the five access purposes. A member whose grant lists purposes needs it to download a FHIR document (`GET /api/fhir/[id]`) or the organisation data exit (`GET /api/data-exit`), and `reporting` does not substitute for it. The operational CSV now also needs `reporting`, as indicator queries already did. A member with no purpose limit is unaffected. Owners cannot be purpose-limited today ("Organisation owners keep full access"), so the check on the data exit has nothing to refuse until that changes; it is asserted in the contract, not over HTTP.
4. **Protected, expiring download** (migration `0022_export_suppression`, table `held_exports`; `lib/saha/held-exports.ts`, `lib/saha/held-exports-server.ts`, `app/api/exports/route.ts`):
   - `POST /api/exports` prepares the suppressed operational CSV through the ordinary operations export (same authority, purpose, suppression, filters and audit event) and holds it for the member who prepared it. The reply gives an identifier, the expiry (15 minutes), the checksum and the download path. At most 3 undelivered holds per member and 50 per organisation (429).
   - `GET /api/exports?id=` delivers it once. It is refused when the file belongs to someone else (404, same as missing), has been downloaded (410, replay), has expired (410), or when the member's role, owner flag, reporting reach or purpose changed since it was prepared (409 for reach, 403 for role or purpose). The claim on the file is atomic, so of two simultaneous downloads one wins. The download is recorded as `exportDownload` before the file is returned; if that cannot be written, nothing is delivered and the claim is released.
   - The file content is blanked after delivery or expiry; the checksum, size and times stay for 30 days. `GET /api/exports` without an id lists the member's own holds without content. The table is excluded from the organisation data exit (`EXCLUDED`) and `SCHEMA_MIGRATION` is now `0022_export_suppression`.
   - Held files are limited to the operational CSV. The direct download (`GET /api/operations?format=csv`) still returns the file in the response; nothing is stored, so there is nothing to expire.
5. **A contract that fails when an export is added without being classified** (`tests/export-suppression-contract.mjs`): every route handler, every `Content-Disposition` source, every screen that saves a file and every `COMMAND_PURPOSE` command must be classified; an aggregate file or send must be suppressed; a file export must name its audit action; named evidence text and audit actions must still be in the named source. The check is itself tested by adding a fake route and a stale entry.

## Tests

- **New unit contract** `tests/export-suppression-contract.mjs`: 14 checks. Primary, complementary and cohort suppression; the CSV carries no suppressed raw figure and still verifies (and a real mismatch is still caught); held-download decisions (missing, another member, replay, expiry, empty content, scope change, inclusive expiry); reach fingerprint; the patient-export purpose against `reporting`; the inventory completeness checks and the fake-route and stale-entry self-checks; screens that save files; outbound commands; the claims in the inventory.
- **New HTTP module** `tests/export-suppression-smoke.mjs` (64 checks inside the HTTP suite, in its own organisation): the CSV against two real confirmed visits (shown as `<5` while the JSON view shows 2), the cohort rule through a one-person programme filter, filters (team outside reach 403, unknown programme 422), the `reporting` and `patient-export` purposes with grants set and revoked, held exports (create, list without content, another member and the owner 404, a non-member 403, download once with matching checksum, replay 410, content blanked, audited download, expiry 410, scope change 409, purpose withdrawn 403 without consuming the file, two simultaneous downloads one 200 and one 410, the per-member limit 429), and the role boundary on the data exit and the FHIR download (administrator, supervisor who is not an owner, non-member refused).
- **Changed existing tests:** see the section below.
- **Full local run** (built Worker, Node 22.22.2, Linux container, 4 October 2026): `tsc --noEmit` clean; `npm run build` ok; unit 131 suites, 8,058 checks (8,044 before); HTTP/D1 4,822 (4,758 before) and scheduled check 8; restore drill 21; smoke 36 passed, 1 skipped; authorisation matrix 51 (with `/api/exports` as a bare GET route). No failures; the timing-sensitive audit-contention contract passed in the full run. Regression baseline raised for the HTTP suite (4,758 to 4,822) and one suite added.
- Not run: UI (browser) layer, performance, memory and load, and hosted smoke against a live site. No screen changed.

## Updated existing tests (legitimate changes)

- `tests/report-export-contract.mjs`: definition 1.2.0; control totals may be `withheld`; a single-person test report is now cohort-withheld, so its edit and mismatch checks name `withheld`.
- `tests/report-export-smoke.mjs`: definition 1.2.0; a measure equals the displayed one or is suppressed or withheld, never a different number.
- `tests/purpose-scope-contract.mjs`: six purposes, not five. `tests/access-scope-contract.mjs`: `patient-export` is a route checkpoint, like `household-sharing`.
- `tests/record-import-contract.mjs` and `tests/report-export-contract.mjs` transpile `export-suppression`.
- `tests/nfr/authorisation-matrix.mjs`: `/api/exports` is a bare GET route.

## Limits and what is not built

- **Differencing across operational exports.** Suppression is per file. Two exports with different filters, windows or teams can still be subtracted (all teams minus one team). The indicator ledger that blocks this for indicator queries (slices 6s, 6aa) is not applied to the operational report, and the new filters make it easier to ask for such pairs. Remaining work for R81.
- **In-app aggregate views are not suppressed:** the operations JSON view, worker activity, alerts and caseload sizes. Decision for the sponsor: suppress on screen as well (the viewer can open each counted patient anyway, so this would change the product more than it protects), or leave as is.
- **Held downloads cover the operational CSV only.** The indicator CSV (a POST with a query), the data exit (a large archive, held would mean storing patient data), the audit export, the incentive CSV and the rejection report are still delivered directly. Expiry for the data exit would need encrypted storage and is not designed.
- **Aggregate cells in the aggregate report to a destination** already have their own suppression; this slice did not change them.
- **No screen.** The operations screen still downloads through the direct route; there is no button for a held export, no filter picker and no purpose label for `patient-export` beyond what the purpose list renders.
- **No official reviewed-submission lifecycle, reporting calendar or scheduled report** (BR-REP-05 remainder, R82).
- Owners cannot be purpose-limited, so `patient-export` cannot restrict the data exit today.
- The migration has no drizzle snapshot file (`drizzle/meta/0022_snapshot.json`); the journal entry and SQL are present. Regenerate with `drizzle-kit` when the migration numbers are settled.
- Built by one agent; no independent review. Formal acceptance of all 176 requirements is still pending.
