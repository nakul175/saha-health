# D01 → D03 morning coding packet

Prepared 10 October 2026, 17:50 UTC / 23:20 IST, for the 11 October coding handoff. This is a source-inspected engineering plan, not a new execution, acceptance, CI or release result. Read the current [HANDOVER](../../../HANDOVER.md), [repository rules](../../../AGENTS.md) and [Claude rules](../../../CLAUDE.md) first.

**First package:** decide the bounded D01 baseline/defect impact, then qualify the sole existing D03 routine-visit candidate. Keep the existing implementation and frozen revision 1 A1–A10. D04 follows only when all ten D03 gates actually pass. This handoff provides concrete work; it does not change native issue statuses, planning holds or action-specific release authority.

## Source and ownership

| Subject | Inspected source / authority | Meaning |
| --- | --- | --- |
| Application baseline | Main `7668a03d97c1ae62174f09e65ccd5a5717120be6` | The base of this documentation branch and the existing candidate; refresh against current main before coding. |
| D03 candidate | Local `work/saha-d03-isolated`, branch `story/d03-routine-visit-20261010`; HEAD remains the base above | Implementation exists as staged **and** unstaged changes. HEAD is not a D03 implementation commit. No published D03 SHA/PR was observed in this inspection. Preserve both sets of changes. |
| Frozen execution contract | [Exact source copy](source/frozen-d03.md), SHA-256 `f390d7c13d7794556115b04caed8982179d1fcfd18a81dda59d70f6f573758df` | Copied byte for byte from the existing candidate specification. It governs A1–A10; the table in this packet maps it without replacing it. |
| Existing author evidence | Candidate `docs/current/d03/EVIDENCE.json` and ignored `outputs/d03-evidence/` | Retained author/local results. All 20 declared source-file hashes matched the inspected candidate bytes; that is source consistency, not an independent rerun or final approval. |
| Execution control | [GitHub #188](https://github.com/nakul175/saha-health/issues/188) | Read the latest evidenced checkpoint and current resumption decision. Historical seeds, old schedule instructions and copied status prose cannot dispatch work. |
| Baseline and bounded delivery | [D01/#174](https://github.com/nakul175/saha-health/issues/174), [D03/#176](https://github.com/nakul175/saha-health/issues/176), native [APL-5](https://linear.app/aplyd-sandbox/issue/APL-5/task-d01-reproduce-the-current-application-baseline) / [APL-7](https://linear.app/aplyd-sandbox/issue/APL-7/task-d03-review-and-save-a-bounded-routine-visit) | Keep source dependencies and the six existing qualification tasks below. This packet creates no new scope or competing candidate. |

The local candidate path is a source locator on the authoring workstation, not a portable code artifact. Another machine must obtain the owner-published candidate and exact frozen source; a copy of this packet cannot reconstruct the uncommitted implementation. Do not substitute main for the candidate and assume the new routine route exists there.

## First morning actions and reviewable outputs

1. **Establish one current owner and exact inputs.** Read #188, inspect fresh main, the candidate branch, staged/unstaged diff, frozen specification and source pins. Preserve the current candidate and failed receipts. Reconcile concurrent changes before any edit. Retain the source planning hold as a historical/current-controller fact; this document itself does not lift or extend it.
2. **Decide D01 for the affected D03 boundary.** Record source/runtime/configuration/tool versions and actual results. Reproduce the relevant baseline failures on the pinned source and compare with the candidate. Classify each as inherited product behavior, fixture assumption, environment failure or new regression only from evidence. Record impact and the dependency decision; do not silently close D01 or delete its relation.
3. **Inspect T01 and T02 independently, then qualify T03 together.** Review API/command authority and the mobile UI separately. Use one integrated candidate for the built local backend/browser, exact-person/refusal/recovery cases and original NFR. Keep raw outputs and assertions before doing another run.
4. **Complete T04 source/document integrity and publication.** Reconcile current source, generated records and requirement evidence; keep original formal acceptance pending. Publish the isolated existing candidate and a draft PR when its applicable resumption/publication authority exists. The documentation-only branch containing this packet is not that implementation PR.
5. **Complete T05 on the final published implementation head.** Run all actually required native checks, the complete unit selection and affected regression layers; obtain the required separate current diff/evidence review. New code after a run invalidates its affected evidence. Verify actual protections and approvals rather than assuming local author checks satisfy them.
6. **Complete T06 only under current release/live authority.** Record isolated merge SHA, separately observed hosted SHA/configuration/time, then the authorized live synthetic review/save/readback/refusal journey and cleanup. Existing D02 temporary role permission is not automatically D03 live-write authority. Matching commit identity alone does not prove the journey. Stop only the dependent action when its genuine gate is unmet.

**Recommended effort assumption:** budget an initial 60–90-minute source/baseline triage session for steps 1–2, then estimate remaining inspected work in low/likely/high engineering days. This is a low-confidence time box for obtaining a decision, not a delivery ETA, capacity commitment or permission to stop after elapsed time. No whole-product completion date is inferred.

## D01 retained failures and impact decision

| Existing defect | Retained observation | First comparison / required result |
| --- | --- | --- |
| [#185](https://github.com/nakul175/saha-health/issues/185) | At source `43f445acf4c54352cd2084e0bcd88bfbf605d757`, `integration/composite-measures-http` failed “Independent viewer retains a meaningful safe original or reissue”; minimum 133. | Reproduce `tests/composite-measures-privacy-current-http.mjs`; retain current scope and safe-viewer oracle. Determine whether D03 reuse or candidate changes affect it. Diagnose before proposing the smallest repair. |
| [#186](https://github.com/nakul175/saha-health/issues/186) | Same source/147-suite selection: `integration/reminder-optout-http` returned worker-restart 503 where refusal 403 was expected; minimum 55. | Reproduce `tests/reminder-optout-http.mjs`; distinguish runtime lifecycle from permission behavior. Keep original mutation identity and refusal expectation. No blind mutation retry or refashioned expected status to obtain a pass. |

The retained selection was 145 passed / 2 failed; it is not a diagnosis or a new run on main `7668a03…`. Source: [original engineering job](https://github.com/nakul175/saha-health/actions/runs/37920175529/job/113785953095). D03's synthetic audit-outage 503 is a different, explicit fail-closed contract; it does not justify changing #186's permission-refusal oracle.

Record the D01 decision with: baseline/candidate/configuration hashes; selected suite IDs and unchanged minima; commands/exits; observed failures and side effects; causal classification with uncertainty; D03 impact; repair or precisely scoped remaining blocker; reviewer and resume condition. A scoped prerequisite decision does not establish all-green product acceptance.

## Exact implementation map

Paths marked **candidate** exist in the local uncommitted D03 implementation; the other paths were inspected on current main. No code is copied into this documentation package.

| Boundary | Concrete files | Contract to retain |
| --- | --- | --- |
| Entry and selected person | **Candidate:** `app/routine-visit/page.tsx`, `app/routine-visit/routine-visit.tsx`, `app/today/today.tsx` | `/today` opens the assigned record, then `/routine-visit?personId=<stable ID>`. Opening creates no visit. Name, village, full person reference and visit reference remain visible. Start/resume is explicit. |
| Projection and route | **Candidate:** `app/api/routine-visit/route.ts`, `lib/saha/routine-visit-server.ts`, `lib/saha/routine-visit.ts` | One assigned person's bounded context; no general workspace/provider payload. Read audit completes before protected response. No-store response and trusted server identity. |
| Identity and authority | `lib/saha/identity.ts`, `lib/saha/server.ts`, `lib/saha/store.ts`, `lib/saha/access.ts`, `lib/saha/purpose-scope.ts`, `lib/saha/access-audit.ts` | Actual configured trusted provider, active organisation membership, ASHA role, selected-person assignment, patient scope and purpose. Owner management authority does not enlarge patient scope. Public identity headers never establish production identity. |
| Existing clinical commands | `lib/saha/core.ts`, `lib/saha/platform.ts`, `lib/saha/server.ts` | Existing `startVisit`, `saveVisit`, `saveProgrammeAnswers`, `confirmVisit`; strict schemas, version checks, current authority, immutable confirmed records, trusted authors and receipt replay. The new route delegates writes to this existing dispatcher. |
| Shared facts and programme questions | `app/guided-capture.tsx`, `app/programmes.tsx`, `lib/saha/programmes.ts`, `lib/saha/fact-provenance.ts`, `lib/saha/fact-verification.ts` | Same-visit compatible shared fact once; distinct/conditional questions remain. Entered/canonical unit, source/time, authors and captured pack/range versions remain attributable. Blank/uncertain is not normal. |
| State and persistence | `lib/saha/types.ts`, `lib/saha/store.ts`, `db/schema.ts`, existing applied `drizzle/` migrations | Existing `Person`, `Visit`, facts/programme capture; organisation CAS, visits, record revisions, audit events and actor/key command receipts. No new patient store or migration. |
| View states and ergonomics | **Candidate:** routine component/CSS; `app/guided-capture.tsx`, `app/programmes.tsx` | Preserve edits across steps, fail truthfully, compare conflicts read-only, replace edits only explicitly, clear protected context on authoritative refusal. Draft, confirmed and destination status remain distinct. |
| Local NFR component | `public/field/vault.js`; **candidate:** `tests/smoke/routine-visit-browser.mjs` | Original encrypted vault seal/write/read/unseal timing with revisioned IndexedDB transaction; p95 ≤500 ms. This measures an existing component, not durable offline saving by the connected screen. |
| Integration/regression qualification | **Candidate:** routine browser suite/catalogue/workflow additions; existing `tests/smoke/today-browser.mjs`, `scripts/test.mjs`, `tests/regression-baseline.json`, `.github/workflows/ci.yml` | One owned result per sequential run, unchanged existing minima, current source pins and exact final-head native checks. Browser viewport evidence stays separate from physical-device evidence. |

## API, data and observable state contract

**GET `/api/routine-visit?personId=<id>[&visitId=<id>]`:** one person selector and at most one visit selector; unknown/duplicate selectors reject. Identity, synthetic/training environment, active ASHA membership and assignment are checked. An explicitly selected visit must belong to that person. Without it the candidate selects a current nonvoided/nonsuperseded draft, otherwise `visit: null`. The actual projection is `{ organisationId, person, visit }`; person fields are `id/name/village/age/sex/version`. Capture metadata is carried in the selected visit's existing programme/range capture. It omits unrelated visits, plans and AI result payloads. Review this concrete projection against the frozen specification before declaring T01 complete.

**POST `/api/routine-visit`:** same-origin JSON, bounded 20,000-byte body, `Idempotency-Key` and current organisation context. Exact wrapper: `{ personId, command }`; it permits only the four commands above. Nonstart commands require a selected-person visit reference; `startVisit.personId` must equal the wrapper's person. The existing dispatcher validates the command and performs the authoritative write. Response includes `result`, `replayed` and freshly audited/read-back `context`; saved acknowledgement requires the matching person/visit context, not HTTP status alone.

| Command | Bound inputs | Observable output / no forbidden effect |
| --- | --- | --- |
| `startVisit` | Exact selected `personId`, stable operation key | Existing current draft resumed or one draft created/read back; opening remains read-only; replay does not add another logical visit. |
| `saveVisit` | `visitId`, current `version`, exact `facts` incl. time/source/unit/missingness | Draft revision and trusted provenance saved/read back; stale/wrong-person/invalid/confirmed/voided/superseded mutation refused. |
| `saveProgrammeAnswers` | Existing platform-schema fields bound to `visitId` and current revision | Answers/absence reasons and trusted authors stored against captured packs; unsaved observation corrections cannot be silently discarded. Read the exact existing schema rather than inventing a replacement DTO. |
| `confirmVisit` | `visitId/version`, `{personId, personVersion, confirmed:true}` patient check | Existing unresolved-question, unusual-value, identity and immutability rules apply; confirmed encounter remains distinct from destination acceptance. |

**Error/recovery oracles:** malformed selector/key → 400; authoritative anonymous/role/scope refusal → applicable 401/403/404 without patient body; stale/wrong binding/state conflict → 409; unsupported/invalid command/value → 422; unsuitable content type → 415; audit/service outage → applicable 503/fail closed. Check exact route/domain outcome for each fixture; do not merge these classes into one expected status. Clinical rows remain unchanged on forbidden mutations while required refusal/audit evidence may append. Audit failure must not expose protected content.

The connected UI keeps unsaved input only in page memory. Offline attempt states “unsaved”; reload/restart durability is D04. A lost response/5xx pauses editing and retains the original key plus exact payload; compare latest record read-only or reconcile that same attempt. Never generate a new key to hide an unknown write outcome. Server refusal clears protected UI content. Conflict comparison keeps edits until explicit replacement.

## A1–A10, task ownership and evidence

[D03-TRACEABILITY.csv](D03-TRACEABILITY.csv) contains the exact frozen criterion text, concrete file boundaries, applicable tasks, retained evidence and remaining results. It has one row for each of the ten gates. Rows record a qualification plan, not new pass verdicts.

| Existing task | Criterion boundary | Required reviewable output |
| --- | --- | --- |
| [T01 / APL-818](https://linear.app/aplyd-sandbox/issue/APL-818/d03-t01-bounded-current-identity-api-and-exact-person-audited-commands) | A2–A5 | Source-pinned route/dispatcher review; allowed/refused requests, trusted identity/provenance, clinical and audit side effects. |
| [T02 / APL-819](https://linear.app/aplyd-sandbox/issue/APL-819/d03-t02-guided-routine-ui-and-truthful-saverecovery-states) | A1–A4, A6–A8 | Source-pinned UI flow review; same/distinct questions, held input, readback, exact-key recovery, explicit conflict and phone ergonomics. |
| [T03 / APL-820](https://linear.app/aplyd-sandbox/issue/APL-820/d03-t03-real-synthetic-backendbrowser-authorization-and-nfr) | A1–A8; local test/NFR part of A9 | One integrated built synthetic backend/browser result, adversarial cases, original timing boundary and failed/physical-device limits. Does not finish all of A9. |
| [T04 / APL-821](https://linear.app/aplyd-sandbox/issue/APL-821/d03-t04-sourcedocument-integrity-and-isolated-candidate-publication) | Publication/source portion of A9 | Source/document integrity, meaningful isolated candidate commit/draft PR and exact artifact pins. |
| [T05 / APL-822](https://linear.app/aplyd-sandbox/issue/APL-822/d03-t05-final-head-ci-and-separate-final-diffevidence-review) | Final CI/review portion of A9 | Final published-head checks, complete unit selection, separate final review/findings and genuine required protections/approvals. |
| [T06 / APL-823](https://linear.app/aplyd-sandbox/issue/APL-823/d03-t06-qualified-isolated-release-and-observed-live-synthetic-gate) | A10 | Isolated qualified merge, separate exact-host identity and authorized synthetic journey/cleanup, or precise blocker. |

T01/T02 inspection can be parallel; T03 depends on both, then T04 → T05 → T06. Keep D01/D02 parent prerequisites and all existing task identities. These six are already within the native task total, not six new backlog items.

### Retained author evidence versus remaining evidence

Candidate evidence observed at `2026-10-10T08:39:50.286155+00:00` records **51 routine checks, 58 Today regression checks, 5,020 HTTP plus 21 recovery checks**, build/types/focused lint and the existing supply-chain gate. Local encrypted-save p95 was approximately **0.90 ms over 100 transactions** on the synthetic desktop/browser fixture, with the full three-pack captured context. Connected-server timing is separate. Physical devices were not measured. This pass checked source hashes only; it did not rerun those checks or review every raw report.

The broad unit attempt recorded 199/201 positive suites and 10,614 assertions with two macOS `sha256sum` environment failures. An unchanged-argument compatibility launcher then repeated the two original 44-assertion suites, 88/0. This covers two retained attempts; it is **not** a new single green 201-suite final-head result. The concurrent smoke aggregate was rejected for shared-report contamination. All original failure records stay retained. Source/document integrity, fresh exact published-head CI, final separate review, qualified merge and the authorized A10 live journey remain pending in that evidence record.

## Planned tests and exact command route

The plan below is for the implementation owner after current inputs/access are resolved. No application tests were executed by preparing this packet. Use pinned Node ≥22.13 (Node 24 where required), pnpm 11.25.0 and existing dependencies. Fresh independent output/state per run; do not run suite layers concurrently within one checkout because `tests/reports/` and result discovery are shared. Never erase the only failed evidence during cleanup. Local/CI provider or cloud actions remain subject to applicable financial permission; this packet authorizes no paid run.

| Layer | Intended qualification |
| --- | --- |
| Static/source | Both mandated documentation checks, test catalogue, unchanged lint ratchet, types/build, supply-chain policy. Preserve target/source assertions and applied migrations. |
| Unit | Complete current 201-suite selection, no quarantines or reduced minima; rerun affected fact/provenance/programme/authority/receipt components after edits. Record current actual catalogue count rather than assuming 201 never changes. |
| API/database/recovery | Built synthetic HTTP/D1 and encrypted recovery; route projection and selector restrictions; exactly bound commands; immutable rows and durable audit; changed role/tenant/assignment/purpose; current-authority replay. |
| Browser/smoke | Real Today → routine entry; shared three-pack fact once, distinct/conditional evidence, correction/readback, program-answer retention, dropped committed acknowledgement/exact-key reconciliation, explicit conflict, offline unsaved state and refusal clearing. |
| NFR/accessibility | Existing encrypted local transaction p95 ≤500 ms separately from server timing; declared N/fixture; 360×640 and taller viewport, 200% text, keyboard/focus/labels, ≥44px primary target, no horizontal page overflow. Full physical-phone/field qualification remains separate. |
| Regression | Actual native workflow selection including baseline defects #185/#186 and affected D02/manual/programme/security paths; no source assertion replaced by a convenience adapter without before/after justification. |
| Release/live | Final-head required checks/protections, separate review, exact merge/host identity and authorized synthetic review/save/readback/refusal/cleanup. This is A10, not local smoke. |

From the preserved implementation checkout, first review the exact candidate workflow/catalogue. The inspected command route is:

```sh
python3 scripts/check-documentation.py
node scripts/audit-requirements.mjs --check
node scripts/test.mjs --check-catalogue
npm run lint:baseline
npm run typecheck
npm run build
node scripts/test.mjs smoke --only smoke/today-browser,smoke/routine-visit-browser --fast --guard --report outputs/d03-next/routine-today.json
node scripts/test.mjs integration smoke --only integration/composite-measures-http,integration/reminder-optout-http --fast --guard --report outputs/d03-next/baseline-impact.json
node scripts/test.mjs integration resilience --only integration/run-api-smoke,resilience/recovery-drill --fast --guard --report outputs/d03-next/api-recovery.json
node scripts/test.mjs unit --fast --guard --report outputs/d03-next/units.json
```

These commands are a planned route, not an execution receipt. Create a new owned output folder and preserve raw suite logs/results before another command overwrites shared locations. Review/run the existing `checks` and `regressions` job selections on the final implementation head; the short focused sequence above does not replace them or actual required branch checks.

The original **at-least-10,000 supported replay/timeout events** requirement concerns programme/EHR external execution. D03 adds no connector/provider send; this requirement is retained, not waived or automatically credited by D03's 51 checks or 100 local timing transactions. See [replay/timeout scope](../SLICE-7D-REPLAY-SOAK.md) and `tests/replay-soak-contract.mjs`: bounded CI uses 1,500 counted events; the full declared suite uses `SAHA_SOAK_EVENTS=10000`. Run/refresh the applicable external-execution evidence when that boundary changes or its acceptance is claimed. Uncertainty never permits a blind external retry.

## Scope and completion record

This package covers assigned existing-person manual routine review/correction/save/confirmation through existing authority and persistence. It excludes new registration/database/migration, offline restart delivery, AI/provider activation, external programme/EHR sends, real patient/recipient use, clinical-policy changes, new hosting or paid services, bulk merging PR #173/#184/#187 and restarting the five old schedules. Existing source artifacts remain preserved.

Before claiming D03 complete, attach the exact implementation SHA/configuration and spec hash; one result for every A1–A10; retained failures; unchanged targets/minima; genuine required review/approval/protections; isolated merge identity; separately observed host identity; authorized live journey/cleanup; remaining parent/formal/physical-device/clinical limits. Full product acceptance **0/160** and formal UAT **0/364** are the retained planning checkpoint, independent of this bounded package. No task count, filled document or elapsed overnight window changes those states.
