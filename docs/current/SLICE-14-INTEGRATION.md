# Integration 14 — slices 14a to 14g combined

4 October 2026 (IST). The sponsor said "merge all" for round 14. Seven draft pull requests were open, all branched from `main` 2adfbde1. This page records how they were combined on one branch, `int-14`, before anything reaches `main`: the order, the conflicts, the seam fixes, the tests and the limits. Synthetic data only. Nothing here was merged into `main`; the integration is a draft pull request for the sponsor.

Built by one agent; no independent review of the merge. Seven independent agent reviews of the slices found defects that are listed as open in [HANDOVER.md](../../HANDOVER.md) and [VALIDATION.md](../../VALIDATION.md); none of them is fixed here.

## What was merged, in what order

Each branch was merged with `git merge --no-ff`, so every slice keeps its own commits and history. After each merge the type check passed before the next one started.

| Order | Slice | Pull request | Branch | Tip |
| --- | --- | --- | --- | --- |
| 1 | 14a atomic review and refusal limits, O-2 investigation | #154 | `slice-14a-open-defects` | f907ad5d |
| 2 | 14d notice versions and permission expiry | #158 | `slice-14d-notices-consent-expiry` | 5b3fdeec |
| 3 | 14b proxy authority | #153 | `slice-14b-proxy-authority` | 76bdff7a |
| 4 | 14c withdrawal and EHR amendment through approval | #155 | `slice-14c-withdrawal` | a6a2e39c |
| 5 | 14e field device reports, device-copy removal, withdrawal notices | #156 | `slice-14e-withdrawal-propagation` | 00ac89d8 |
| 6 | 14f disposal execution | #157 | `slice-14f-disposal` | d4bec1cf |
| 7 | 14g suppression on every export path | #159 | `slice-14g-export-suppression` | 73d2e225 |

## Conflicts and how they were resolved

Both sides were kept wherever both were additions.

- **Migrations.** The numbers stay as assigned: 0018 `limit_slots` (14a), 0020 `field_device` (14e), 0021 `disposal` (14f), 0022 `export_suppression` (14g); 0019 is unused.
  - `drizzle/meta/_journal.json` is one ordered list of 22 entries with consecutive `idx` 0–21 and strictly increasing `when` (14f's original `when` was earlier than 14e's; it was moved one second later, which changes no SQL).
  - The snapshot chain is repaired: 14a, 14e and 14f had each been generated from 0017. Now 0018 follows 0017, 0020 follows 0018 (adds `field_sync_reports`), 0021 follows 0020 (adds `disposals`), and 0022 follows 0021 (adds `held_exports`; 14g had no snapshot). Each keeps every earlier table (38 in all). 0022's snapshot was produced by `drizzle-kit generate` against `db/schema.ts` in a scratch folder; it found nothing to add except `held_exports`, which confirms the chain matches the schema. `0022_export_suppression.sql` itself (unchanged) has no foreign key on `held_exports.org_id`, while the schema declares one; the snapshot follows the schema.
  - `SCHEMA_MIGRATION` in `lib/saha/data-exit.ts` is `0022_export_suppression`. Every slice's table entry or left-out entry in that file is kept (`field_sync_reports`, `disposals`; `held_exports` and `limit_slots` left out with reasons).
  - `db/schema.ts` declares `limit_slots`, `field_sync_reports`, the disposal register and `held_exports` together.
- **14b with 14d** (`lib/saha/consent.ts`, `lib/saha/core.ts`). The `ConsentEvent` type carries both sets of optional fields (`decidedBy`, `representative` and `notice`, `expiresAt`, `renews`). The `setConsent` schema accepts both `representative` and `notice`. `decider(g)` and `recordTerms` both run: a permission given by a representative records who decided and under which notice, with both audit events (`proxyUse`, `consentTerms`).
- **14e with the others.** `consent.ts` imports `createWithdrawalNotices` and keeps 14d's imports; the `field-copy` downstream kind is kept. `app/workspace.tsx` imports both panels. The two modules that exported a function called `noticesOf` are disambiguated: the 14e one (per-patient withdrawal notices) is now `withdrawalNoticesOf` in `lib/saha/withdrawal-notices.ts`, its tests and its panel; `noticesOf` in `core.ts` stays the organisation's consent notices.
- **14f and 14g.** `lib/saha/monitoring.ts` lists the routes `exports` (14g), `field-device` (14e) and `retention-disposal-register` (14f); `server.ts` runs `authorizeDisposal` in the replay chain and handles `disposal` in the platform chain beside 14c's `withdrawal`; the authorisation matrix lists `/api/exports`, `/api/field-device` and `/api/retention/disposal-register`; `tests/api-smoke.mjs` imports every slice's smoke module (limit race, withdrawal, field device, consent notices, proxy authority, disposal, export suppression).
- **Module lists in older contract tests** (`record-import`, `report-export`, `visit-import`, `workforce-import`, `data-exit`, `household-visit`, `review-fixes`): the union of `field-device`, `withdrawal-notices`, `disposal-effects` and `export-suppression`.
- **Requirement ledger.** `BR-SEC-02` is one row and one evidence key with both slices' text (14b representatives, 14d notices and expiry) and both evidence lists; it stays partial. `BR-SEC-03` carries 14e's text, `BR-SEC-04` 14b's, and `BR-REP-04` and `BR-REP-05` carry 14a's and 14g's. The remaining-work column of `BR-SEC-02` also names the open finding that a representative's permission does not end with their authority.
- **Documents.** `VALIDATION.md`, `docs/NEXT-DELIVERY.md`, `docs/IMPLEMENTATION.md` and `HANDOVER.md` keep every slice's section or row. The implementation boundary now states 71 route handlers (69 the UI calls plus the two `/api/exports` handlers it does not), 61 certified patient commands, 38 declared tables and 22 migration files; the HANDOVER size line, which still said 56 commands and 19 migrations, is corrected. A duplicated "Round-11 test findings" bullet in `HANDOVER.md` was removed (the one that keeps 14a's O-2 text stays).
- **Generated documents** (the command and test catalogues, the API inventory, the data dictionary, the coverage map, the UAT pack, the requirement traceability, the baselines and `tests/regression-baseline.json`) were not hand-merged. Conflicts were resolved to one side and the files regenerated by their own scripts after the last merge; the regression baseline is recomputed from the merged run, not summed.

## Seam fixes

Eight small fixes where the slices meet. Each has a test.

1. **14c with 14d: a lapsed sharing permission blocks an EHR amendment.** `bindingProblem` in `lib/saha/withdrawal.ts` tested the raw `exchangeConsent` flag. For an amendment it now also asks `consentStanding(p, 'exchange', now, noticesOf(s))` (the organisation's notice registry, as 14d does elsewhere): a permission that has expired, or was given under an earlier material notice, refuses approve and execute with "the sharing permission is no longer in force". A renewed permission works again.
2. **14c with the processing restriction (review finding, high): an EHR amendment is refused while a restriction is active.** An amendment writes a new document to an outside system, which `PAUSED_WHEN_RESTRICTED` pauses for `executeEhrPublish`. Prepare, approve and execute of an *amendment* now refuse with 409 when `activeRestriction(p)` holds (`amendRestricted`, `AMEND_RESTRICTED` in `withdrawal.ts`; approve and both execute checks go through `bindingProblem`). The command types are not added to `PAUSED_WHEN_RESTRICTED`, because that set is by command type and would also stop plain withdrawals and retractions, which continue and are tested to continue.
3. **14b with 14d: the representative form shows the notice.** "Record a permission given by a representative" in `app/consent-panel.tsx` now shows the notice version in force, the language choice and the notice text, asks for the confirmation that it was shown, and sends `notice: {id, language}` with the representative. The server already refused a missing or stale notice (409). The form also lists a permission that is recorded but no longer in force (expired or needing renewal), so a representative can renew it as the person can.
4. **14e with 14d: the `noticesOf` name collision** (above).
5. **14g: classification of what 14a–14f added** in `lib/saha/export-routes.ts`: `GET` and `POST /api/field-device` (14e), `GET /api/retention/disposal-register` (a file export, source `disposal-server.ts`, saved by `app/retention-panel.tsx`; 14f), and, in a new `OTHER_OUTBOUND_COMMANDS` table, the 14c and 14e commands that can send a person's data or a notice about it (`executeWithdrawal`, `sendWithdrawalNotice` carry a record; prepare, approve, lookup, cancel and record carry none). They are not keys of `COMMAND_PURPOSE`, so they cannot go in `COMMANDS`.
6. **Migration chain** (above): journal, snapshots, `SCHEMA_MIGRATION`.
7. **14g: anonymous `POST /api/exports` was a 422, not a 401.** `heldExportsPost` validated the body before it identified the caller. The authorisation matrix (anonymous on every non-GET route) found it on the merged tree; the caller is now identified first. The defect is in 14g's code as merged; the 14g branch's own matrix run passed 51 checks, and why it did not see this was not traced.
8. **Older tests that assumed one branch:** `tests/limit-slots-contract.mjs` assumed 0018 was the last migration and now finds it by name; `tests/data-exit-contract.mjs` expects 34 tables (32 + `field_sync_reports` + the disposal register, plus member accounts).

## Tests

All run locally on the merged tree (built Worker, local D1, Node 22.22.2, shared 2-core container, synthetic data; ports 8860–8869). New in this integration: `tests/integration-14-contract.mjs` (13 checks: the migration chain, the name collision, the classification, a representative's permission under a notice including renewal under a material notice, the consent-panel form and the withdrawal seams in source) and two groups in `tests/withdrawal-contract.mjs` (lapsed and renewed sharing permission, expired and needing renewal; a restriction refuses prepare, approve and execute of an amendment while a retraction still prepares and approves).

Every contract and smoke module from all seven slices still runs and passes. Counts changed by the union, not by weakened checks:

- `tests/data-exit-contract.mjs`: tables 33 to 34 (14e adds one, 14f adds one, from a base of 32).
- `tests/limit-slots-contract.mjs`: the migration it tests is found by name (0018) instead of being the last one.
- `tests/withdrawal-contract.mjs`: 63 to 65 checks.
- The regression baseline is recomputed from this run.

Results are in [VALIDATION.md](../../VALIDATION.md) and `tests/evidence/slice-int14/`.

## Limits

- Built by one agent; no independent review of the merge. The seven slices were each built by one agent and reviewed by separate agents; nobody has reviewed the union.
- The review findings listed in [HANDOVER.md](../../HANDOVER.md) are open: 14g complementary suppression and cross-export differencing; 14f the unkeyed register chain, visit-media blockers, the unset-environment gate and the media-then-patient 500; 14e a removal receipt from any or an empty device, repeated withdrawals and a second notice to an uncertain destination; 14d/14b a representative's permission outliving their authority; 14d the single-owner material flag and the 20-version cap; 14c an uncertain EHR withdrawal that cannot be closed and the missing `BLOCKED_WHEN_MERGED` entries; 14a the O-2 evidence resting on one route.
- The seam fixes cover two of the 14c review findings and the 14b form; they do not make a representative's permission end with their authority, and they do not add withdrawal commands to the merge-blocking list.
- The UI end-to-end, performance, memory and load layers were not re-run on the merged tree; the consent-panel form change has a source check, not a browser test.
- `0022_export_suppression.sql` has no foreign key on `held_exports.org_id` while the schema and snapshot declare one (above).
- Requirement counts are unchanged: all statuses touched by the seven slices stay partial or unverified; none was promoted.
