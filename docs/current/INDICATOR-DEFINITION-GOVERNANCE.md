# Reviewed indicator definitions

5 October 2026. B27 first software batch against canonical96b24f36. BR-AG-11 restricts analysis to approved definitions under ordinary reporting policy; BR-REP-02 requires versioned numerator, denominator, exclusions, period, source, cadence and owner with reproducible history. All formal and clinical denominator approvals remain pending.

## Grounded gap

The original actual Worker/D1 accepted an owner addition, immediately included it in the catalogue and allowed its explicit version to run without independent review. `before-gap.json` preserves that observation. Its driver is historical and intentionally fails against the repaired source.

## Software contract

The existing add, revise and retire commands now propose immutable definition versions. A separate active supervisor or clinician independently approves or rejects the exact proposal; its author cannot review it. Owners release an approved version with an explicit effective time, pinned review event and fresh governance sequence. Release rechecks the reviewer's current role, active membership and exact membership version. Saved-command replay checks current actor authority; release replay also rechecks the original reviewer's authority. Organisation command CAS commits the definition/event, audit and receipt atomically.

Proposal, approval, rejection, release and withdrawal are append-only events in existing operations storage. No migration is required and no existing record is rewritten. Built-in and previously released records remain legacy releases; the software does not invent historical approval receipts. A valid release's approval is not retroactively erased by later reviewer membership changes. Future releases can be withdrawn before becoming effective, even after another proposal was staged; effective definitions require a reviewed retirement or reviewed rollback.

Queries and keyword interpretation see only released, effective registry definitions. Drafts, rejected/withdrawn proposals and future releases cannot be queried even by explicit version. Earlier effective active versions remain runnable over the viewer's currently authorised records under unchanged purpose, cohort, suppression and differencing policies. Each result names the immutable review/release event and effective time, or explicitly marks legacy provenance. Rollback appends a new proposal copied from a released version and must receive another independent review; it does not edit an earlier version.

The owner reporting panel links to `/indicator-definitions?organisation=…`, preserving the selected organisation. The dedicated review page uses `registryOnly` metadata: it gives clinicians definition review without granting aggregate reporting or returning patient cohort filters. Current identity and organisation are checked again before dispatch. Synthetic phone evidence includes a real commit followed by a lost acknowledgement and exact original body/key recovery. Pending actions stay bound to their original actor; this online page retains them within the current tab, not an offline or durable patient notebook.

Definition labels explicitly state that clinical denominator and accountable publication acceptance are pending. Reruns use current authorised records and are not described as frozen historical figures. The fixed measure/filter/exclusion vocabulary remains enforced; there is no client expression language, SQL or unrestricted patient-list query.

## Affected paths

- `indicator-registry.ts`: seven strict command variants, lifecycle authority, immutable proposals/events and rollback.
- `indicators.ts`: effective registry resolution and result governance references. Existing interpretation and aggregate callers share this boundary.
- `indicators-server.ts`: metadata-only review projection and trusted identity before local request parsing.
- `indicator-registry-panel.tsx` and `/indicator-definitions`: owner proposal, independent review, dated release, withdrawal and history. Phone action overlap was reproduced and fixed with responsive block flow and wrapped touch actions.
- Existing server command dispatch/replay and platform union already invoke/spread the registry module; no shared dispatch, mapping, contact-import or catalogue edits were needed.

## Evidence and limits

Fresh build and typecheck pass. New lifecycle contract40, actual Worker/D1 HTTP61 and real Chromium phone19 pass. Existing registry contract12, indicators9, aggregate delivery12, aggregate checkpoint4, freshness10 and reuse7 pass. The existing registry smoke also passes65 through an isolated actual Worker/D1 driver with real review/release fixtures; its original privacy, CSV, historical-version and differencing assertions remain intact. Initial browser overlap, premature refreshed-status assertion, minute-zero datetime fixture and fresh-account helper failures remain separately recorded. Positive tests do not use forced clicks or retry a failed source run to claim the initial observations passed.

Evidence: `tests/evidence/indicator-governance/`. Chromium is a synthetic browser check, not physical Android acceptance. The metadata-only clinical review page does not constitute programme denominator approval or publication acceptance. Shared catalogue, requirement assessments and validation integration remain lead-owned.

## Required follow-on: immutable released figures and reissue

B27/B28 remains open. The existing differencing ledger records privacy release evidence; it is not a point-in-time figure snapshot. The next software batch must bind an immutable publication ID to its exact definition/review/release version, reporting cutoff/window, authorised population/source revision references, method/suppression policy and computed figures/digest. A later patient correction must leave that released object unchanged; a separately reviewed reissue must append a superseding publication with reason and exact original linkage.

Historical source access and any reconstruction must still enforce current patient scope and privacy; a publication identifier must not reveal patient lists or grant historical care authority. Plan a protected append-only server snapshot/reissue ledger after migration coordination, with actual correction-after-publication, two independent revisions, stale-authority, lost-ACK, rollback and privacy tests. The buildable snapshot/reissue slice is required work, not deferred success; reporting calendar, real denominator decisions and accountable publication owners remain external acceptance.
