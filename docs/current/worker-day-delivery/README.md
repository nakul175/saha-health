# Worker-day entry — first code slice

9 October 2026. Baseline: `43f445acf4c54352cd2084e0bcd88bfbf605d757`. Linked to Community Worker OS D02 and the bounded existing-editor part of D03. Source is a candidate on a draft branch, not a deployment or accepted product.

## Outcome and boundary

An explicitly opted-in ASHA in the synthetic/training environment opens `/app?experience=worker-day`, sees a compact Today list with one next-record action, and enters the existing audited person/visit editor. Existing guided capture, Save draft and review continue through their existing server contracts. Today, People and My Space provide three stable navigation destinations. Optional AI, Academy and other future services are not implemented by this slice.

The default `/app` and non-ASHA/production/staging experiences remain unchanged. The opt-in is a presentation choice, not an authentication method. All existing identity, assignment, scope, version, dirty-navigation and command checks remain authoritative. A server draft is not a completed programme submission.

## Reuse and data

`lib/saha/worker-day.ts` derives records from the existing scoped Snapshot, excludes unassigned/merged records and reuses `visitCompare`. It does not invent tasks, dates, urgency or an AI priority. Completed records stay in the underlying source; Today chooses its next record from non-completed records. Paged workspaces get an explicit existing-list fallback instead of a misleading partial count.

`app/worker-day.tsx` supplies Today and navigation presentation. Its open/go/choose callbacks use existing `app/workspace.tsx` handlers. The same unsaved-input guard and server-audited `openPerson` path remain. My Space links to existing saved-work, activity/claim and account screens; it does not add a claims rule, supervisory role or payment promise.

No new table, column, API route, clinical rule, server command, provider, workflow approval or local-storage copy is added. English and draft Hindi presentation use the existing member language. Existing clinical/draft translations remain unqualified; no formal language acceptance is claimed.

## Acceptance and rejection for this slice

- D02-A1: scoped assigned records and existing ordering appear; the new entry creates no task or visit.
- D02-A2: opening a current record reaches its existing draft rather than silently creating another.
- D02-A3: source failure remains an error, not an empty or successful caseload.
- D02-A4: same-name identities remain distinct source records; no name-based automatic match is added.
- D02-A5: compact-screen controls have readable labels, keyboard focus and no horizontal overflow on tested fixtures.
- D03-A2/A3 bounded witness: entering a synthetic weight, saving an unconfirmed draft and reading it back from the built backend gives the same value and draft state.
- Refuse any change that bypasses current authorisation, changes programme due dates, drops unsaved input or calls a server draft destination-accepted.
- Reject claims of complete offline/conversational OS, clinical approval, production readiness or physical-device acceptance from this slice.

The broad shared-field composition and complete routine offline milestones are not closed. The 160 canonical scope items and original 176 requirements are unchanged. Relevant original acceptance cases must remain individually Not run until their entire scope is executed and reviewed.

## Tests and present evidence

`tests/worker-day-contract.mjs`: 16 pure presentation checks passed locally using Node 22.16.0 and the environment's installed TypeScript. It checks opt-in/environment/role gates, no source mutation, paged fallback, empty source, filtering, ties and equality with the existing ordering. It does not prove server authorisation or user experience.

`tests/smoke/worker-day-browser.mjs`: authored to run Chromium against the built synthetic local Worker and D1 using the existing harness. It checks original-home parity, the new three-destination entry, assigned record, dirty-navigation protection, real draft save/read-back, no duplicate draft, existing confirmation boundary, error state and non-ASHA fallback. This report does not claim it passed before its runner result is observed.

Original documentation, requirement audit and test catalogue checks passed against the retrieved original source before wiring. The complete runtime build and browser checks require pinned dependencies; the branch workflow performs those checks and stores actual results. No physical handset, offline restart, external provider, government connection or live DigitalOcean host was tested here.

## Source publication and recovery

The bounded `apply.py` applies exact reviewed edits to workspace.tsx, refusing a different source hash. It archives the original workspace bytes in the existing historical-source snapshot system, appends the candidate boundary to handover/implementation/qualification/validation, updates the source manifest using the existing script and regenerates the existing documentation outputs. It does not change any applied migration or original requirement/acceptance text.

The branch-only preparation workflow is restricted to this repository and the exact feature branch. It may commit those deterministic wiring/baseline updates to that branch only. No main merge, deployment, external credentials or provider activation is allowed. It refuses an unexpected upstream head before pushing. Build/test results never grant merge permission.

Once the source is wired, rollback is a revert of this presentation slice, preserving all existing records and queued work. The documented DigitalOcean updater follows main independently of Cloudflare freeze, so this draft must not be merged without sponsor approval.
