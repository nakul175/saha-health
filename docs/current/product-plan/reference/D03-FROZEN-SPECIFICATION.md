# D03 — Bounded routine visit, revision 1

Frozen 10 October 2026 before implementation. Base main: `7668a03d97c1ae62174f09e65ccd5a5717120be6`. D02/#175 delivery gate passed with exact-host signed-in synthetic evidence. Story #176 covers SAHA-004,006,020,021,024,049. The planning source is PR #173 at `9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1`. This specification narrows the presentation without waiving parent requirements.

An active ASHA explicitly chooses an assigned existing person, reviews current captured observations and distinct programme questions, corrects values with source/time/unit, and saves an actual server draft. A saved draft is neither a confirmed encounter nor destination acceptance. Confirmation uses the existing person/version check and existing unresolved/unusual-value rules. Nothing starts on opening a page. No model, provider, new patient store, migration or clinical policy is required.

## Inspected reuse

Current main provides `startVisit`, `saveVisit`, `saveProgrammeAnswers`, `confirmVisit` through the audited, version-checked command dispatcher, capture problems/guided stages, programme semantic-question composition and encrypted field storage. PR #184 was inspected separately: its presentation enters the legacy workspace through a hidden opt-in and its 18-check persistence witness does not qualify this story. No old PR is merged or copied wholesale. Reuse current main's verified components only; preserve legacy source and original assertions.

## UX and data/API

Separate mobile `/routine-visit?personId=<encoded stable ID>`; person name, village, full reference and current visit reference remain visible. Open is read-only; explicit Start or resume uses the existing command and reuses a current draft. Guided time, observations, notes, distinct programme evidence and review stages retain input when moving between steps. Show current/reused same-visit values, missing reasons and uncertainty explicitly. Never silently carry another visit's value. Stable operation keys bind the exact attempt. Failure keeps input; an uncertain write cannot be reissued with a new key. Authoritative readback is required before a saved acknowledgement. Conflict comparison is explicit and never silently overwrites unsaved input.

GET `/api/routine-visit` returns only one assigned person's identity context and one selected/current visit projection, organisation ID and capture policy metadata; authoritative server identity/scope and durable read audit apply. POST accepts only the four existing commands bound to the selected person. No arbitrary command, public identity, client-assigned author or off-origin destination is accepted. The existing dispatcher retains purpose, version, current authority, immutable confirmed records, audit and receipt enforcement. All responses are no-store. Patient content stays out of general browser storage/logs. Refusal clears protected content; unavailable save keeps unsaved input in the current page without claiming persistence. Offline prepared encrypted storage/restart is D04; local-save performance remains a required, separately measured D03 NFR and cannot be inferred from server timing.

## Gate

| Criterion | Required evidence |
|---|---|
| A1 | Compatible multi-programme fixture captures a semantically identical shared fact once, retaining distinct and conditional questions. |
| A2 | Correction/readback preserves exact person/visit, source, observation time, entered/canonical unit, server author and pinned pack version; missing/uncertain data is explicit. |
| A3 | Wrong person, stale version, invalid values, confirmed immutable visit and changed scope cause no authoritative clinical mutation. |
| A4 | Saved acknowledgement requires actual persistence and readback; replay/dropped acknowledgement retains exact key and does not duplicate a logical visit. Draft/confirmed/destination states are separate. |
| A5 | Active ASHA, organisation, assignment and purpose are checked server-side; anonymous/other role/tenant/unassigned refusals disclose no patient content; read/write audit is durable and fail closed. |
| A6 | Loading/empty/refused/error/offline/conflict/uncertain states differ; save failures keep input and conflict cannot silently overwrite it. |
| A7 | Manual capture/review/save remains usable with model/providers unavailable and no external calls, invented values or new approval. |
| A8 | Real browser flow at 360×640 and taller phone, keyboard/focus, 200% text and labelled 44px controls; no horizontal page overflow. |
| A9 | Real build/types, affected existing checks, built local synthetic backend E2E, applicable NFR including original local-save p95 ≤500ms separately from connected-server timing, final-head CI and separate final diff/evidence review. Untested physical-device/clinical/formal UAT remain pending. |
| A10 | Qualified isolated merge under actual required checks/protections, exact observed hosted commit, authorised live synthetic review/save/readback/refusal evidence. Merge alone is not deployment. |

No next story before all ten pass. Failed assertions, measurements and source pins remain evidence. Do not revise a target after a failure. Formal UAT 0/364 and human/clinical/physical-device/government acceptance are independent. A declared blocker prevents delivery, even if a subset passes.
