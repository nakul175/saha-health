# Development slice 5g — provider and model history per capability

30 September 2026 (IST). Stacked on slice 5f. Synthetic data only; formal acceptance unchanged. No migration.

## What changed

- **History per capability key.** Each capability revision already pins one provider, model and agent version in its manifest, and a new revision of the same key may change them. The governance read (`GET /api/governance`) now gives governance managers (owners, clinicians and administrators who author packages) a `capabilityHistory` for the capability keys in their scope: for each key, the number of distinct providers and, for each revision in scope, its provider, model, agent version, lifecycle stage (slice 5d), when it was reviewed, when it was first activated and when it stopped being active (its last suspension or retirement, or none while it is current), the number of assistant requests prepared under that exact revision (any status) with the last use, and what changed from the previous revision: provider, model and agent version. It is derived on read from the governance packages and the requests' recorded governance reference (`lib/saha/capability-lifecycle.ts`); nothing new is stored. It carries no patient, visit or request identifiers.
- **Clinical governance page.** The AI capabilities tab shows a "Provider and model history" table per capability with these columns, and states that a change needs a new revision with its own evaluation, independent review and owner activation.

## Evidence

- 13 contract assertions (`tests/provider-history-contract.mjs`): revision order with each pinned provider and model; provider, model and agent-version changes from the previous revision; first activation and end of activity for a replaced, a suspended and a never-activated revision; a revision reactivated after a suspension shown as current with its first activation kept; stages; request counts of every status and last use; review times; histories for capabilities only, with the number of providers, and restricted to the keys in scope; no patient, visit or request identifiers.
- 3 more HTTP/D1 assertions in `tests/capability-lifecycle-smoke.mjs` (including the clinician's read): after replacement and suspension, the history shows revision 1 replaced with 2 requests and revision 2 suspended with 1, one provider and no changes, with activation and end times; a clinician governance manager in scope sees it.
- Browser check (headless Chromium, built Worker, synthetic owner and reviewer): after a second revision replaced the first, the AI capabilities tab showed "Browser history capability (browser-history · 1 provider)" with revision 1 Replaced (active from and until today, first revision) and revision 2 Active (current, no change); axe-core found no WCAG A/AA violations in the tab; no console errors. `tests/evidence/slice-5g/provider-history-browser.json`.
- All suites: 2,351 HTTP/D1, 1,467 contract/checkpoint and 21 restore assertions.

## Limits

- This is a history of what was approved and used, not a formal provider change review: there is no separate change record, impact assessment or comparison of the new provider against the old one beyond the version-bound evaluation each revision already needs. Shadow comparisons (slice 5f) can be run on a reviewed revision before it replaces the active one.
- One provider serves one capability key (existing rule), so a key's history can include several providers only across revisions; two providers cannot serve the same key at the same time.
- Live provider contract compatibility and legacy provenance (requests made before governance references existed) are not covered. BR-AI-07 stays partial.
