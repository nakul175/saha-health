# SAHA-111 local coding completion — 2026-10-20

## Frozen scope

- Story: SAHA-111 / APL-134, Reconciled exports.
- Contract SHA-256: `ead624c7d731c013500ee024efa54c71560dc7f3568205667c69a39e556cc023`.
- Exact base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`.
- Original BR-REP-05 and TC-BR-REP-05-A/B remain unchanged.

## Implemented application behaviour

- The existing direct CSV remains explicitly labelled as a draft export. It identifies report definition/version, exact period, team filter, generator, generation time, control totals, row count and content SHA-256.
- A new governed export workspace prepares the exact protected CSV as a bounded immutable package. It freezes the supported period/team/delegation filters, source basis, protected payload, row count and checksum.
- The preparer cannot approve their own package. A different current owner, supervisor or clinician with reporting purpose and whole current report scope must approve it.
- Approval is for the exact package and expires after 24 hours. Only the current preparer or current reviewer may download it.
- Download recomputes the exact report at its original cutoff and rejects changed filters, report source, payload, scope, preparer authority or reviewer authority. The approved bytes are returned only after a protected export audit commits.
- Idempotent writes and read-only exact saved-outcome recovery prevent an uncertain response from authorising a duplicate action.
- History returns metadata only and never returns the stored CSV. Capacity is bounded to eight open packages, 80 kB per payload and 400 kB total.
- Every package has explicit `submissionState: not-submitted`. The existing aggregate-report lifecycle remains the application path for a configured reviewed submission and receipt. Demonstration destinations do not establish official acceptance, and this change does not invent a programme provider or submission receipt.
- The Operations UI exposes prepare, independent review, expiry, filter-bound download and read-only uncertain-outcome recovery.

## Verification run

- `node tests/governed-report-export-contract.mjs`: 24/24 passed.
- `node tests/governed-report-export-http.mjs`: 19/19 passed against the built Worker and fresh local D1.
- `node tests/operational-privacy-export-current-contract.mjs`: 7/7 existing reconciled-export assertions passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; `/api/report-exports` present in the production route manifest.
- `sources/` was not modified.

The Worker/D1 scenario covers prepare, exact idempotent replay, read-only outcome recovery, self-review refusal, independent approval, pre-review refusal, expiring authorised download, unauthorised identity refusal, changed-filter refusal, changed-source refusal, metadata-only history and explicit not-submitted state.

## Gates kept separate

No identified application-code gap remains against the frozen BR-REP-05 scope. The following are still pending and are not claimed by this record:

- independent source review;
- formal TC-BR-REP-05-A/B execution by the named QA / Supervisor / programme-manager roles;
- programme/domain acceptance of an official reporting destination and receipt;
- exact-source CI and branch protections;
- merge; and
- observed staging or production deployment.

Local synthetic engineering evidence is not formal acceptance and does not establish an official submission.
