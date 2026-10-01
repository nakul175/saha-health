# Development slice 6d — indicator catalogue, suppression and governed questions

30 September 2026 (IST). Fourth part of slice 6. Synthetic data only; formal acceptance unchanged. No AI model is involved.

## What changed

- **Catalogue.** `lib/saha/indicators.ts` defines eight versioned indicators, each with numerator, denominator where relevant, exclusions, owner role and cadence: confirmed visits, patients with a confirmed visit, overdue follow-ups, referrals completed, active maternal episodes, open work without an active owner, unresolved programme submissions and provisional identities.
- **Queries.** `GET /api/indicators?ids=…&days=…&group=…` computes up to eight catalogue indicators over the viewer's current scope for a 1–366 day window, optionally filtered by one of the viewer's teams, a village or a programme, and grouped by team, village, programme or age band. Merged records are excluded. Supervisors and owners with a clinical role may query; ASHAs, non-owner clinicians and administrators may not. Reads use the viewer-scoped load from slice 0b-2.
- **Privacy.** A cohort with fewer than 5 people is refused outright. Counts from 1 to 4 are suppressed, as are proportions whose numerator, denominator or complement falls in that range. When exactly one cell in a grouping is suppressed, the next smallest non-zero cell is suppressed too so the hidden value cannot be recovered from the others. Zero is shown.
- **Freshness.** Each result states when it was computed, the window, the cohort size and the latest source record time in scope.
- **Governed questions.** `GET /api/indicators?question=…` maps words in a question to catalogue indicators, a grouping and a window, and returns that interpretation for the manager to review and run. It never runs a query itself, never uses a model and answers "not understood" for anything outside the catalogue.
- **Workspace.** The Operations page gains an "Indicators" section for supervisors and owners: question box, indicator checklist, window, grouping and filters, and result tables that mark suppressed cells.

## Evidence

- 27 new HTTP/D1 assertions (`tests/indicators-smoke.mjs`): role refusals; catalogue shape; all eight indicators computed; for four groupings every shown cell is zero or at least five; invalid indicator, window and grouping refused; a team outside the viewer's scope refused; a two-person village cohort refused; question interpretation and refusal.
- 9 contract assertions (`tests/indicators-contract.mjs`) cover authority, input validation, cohort protection, merged and out-of-scope exclusion, window boundaries, primary and complementary suppression, proportion and complement suppression, zero display, interpretation and a catalogue without executable parts.
- Browser check (headless Chromium, built Worker, synthetic owner): a question interpreted and run from the Operations page. No console errors.
- All suites: 1,285 HTTP/D1, 550 contract/checkpoint and 21 restore assertions. Reports in `tests/evidence/slice-6d/`.

## Limits

- The catalogue is defined in code by engineering. Adding or changing an indicator needs a release; there is no owner-maintained registry, approval workflow or historical re-computation by definition version.
- Suppression protects single queries. Differencing across many overlapping queries is not tracked, and exports do not use this path yet.
- The interpreter is a keyword matcher over the catalogue, not natural-language understanding.
- A patient in two programmes is counted under each programme when grouped by programme.

## Later change, 1 October 2026 (slice 6s)

Slice 6s turns the catalogue into an owner-maintained registry (these definitions become its version 1 entries), lets a result be recomputed from the definition version it names, adds differencing protection across one viewer's nested queries and an indicator CSV that keeps the suppression. See [slice 6s](SLICE-6S-INDICATOR-REGISTRY.md). The text above is kept as written.

## Later change, 2 October 2026 (slice 6ac)

Slice 6ac adds source-specific freshness beside each result: per team the viewer belongs to, the latest record time and banded counts of records arriving in the window and arriving late for online visits, field-notebook syncs, imports and programme receipts, a data-still-syncing warning, and on each released visit-based result the banded number of late visits since the viewer's previous release. See [slice 6ac](SLICE-6AC-REPORTING-FRESHNESS.md). The text above is kept as written.
