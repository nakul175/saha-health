# D03 recovery checkpoint — 11 October 2026

The owner authorized sequential Health Saha development until 11 October 2026, 08:00 IST (02:30 UTC). D03/#176 remains the sole active feature story. Its original revision-1 specification and all A1–A10 gates remain unchanged. This checkpoint repairs the existing candidate; it does not declare a delivered story or authorize main merge, new hosting or spending.

## Source and ownership

Work in `feat/d03-qualification-2026-10-11`, draft [PR #192](https://github.com/nakul175/saha-health/pull/192), based on main `7668a03d97c1ae62174f09e65ccd5a5717120be6`. Commit `c3d36c88ab034a4d78e8c83f3a0ae29d7aab33f0` preserves the existing D03 candidate's 37 changed files, with exact-byte import verification. The original D03 checkout, historical evidence and source drafts remain untouched. Frozen specification SHA-256: `f390d7c13d7794556115b04caed8982179d1fcfd18a81dda59d70f6f573758df`.

The latest engineering documentation handoff is separately saved in draft [PR #191](https://github.com/nakul175/saha-health/pull/191), head `e63339125f0e3da1bb6419bcad5f449cfcd9fea1`. Consume it with its stated assumptions and pending external decisions; it is not silently incorporated into main. The other active Health Saha chat owns its product-plan outputs and Linear publication. Do not edit or message that chat without owner authorization.

## Repaired behavior

1. Today binds its routine-visit link to the organisation of the authorized selected record. Detail reads, the initial routine read, writes and exact retries retain that organisation even if the account changes its active organisation. Today response bodies remain unchanged; the bounded authorised organisation is response metadata. The legacy person-only navigation is refused rather than guessing the currently active organisation.
2. Comparing a saved record never abandons an unknown write key. While an exact attempt is unresolved, editing, saved-record replacement and fresh writes remain paused. A committed lost acknowledgement replays the original key/body and increments the clinical revision once. An original POST aborted before reaching the server likewise reconciles through its original key/body.
3. An exact retry after a competing save can leave uncertainty only on a bounded server proof. The existing dispatcher first refuses one of the three versioned visit commands. A fresh authorized, audited read must show a strictly higher version of the same visit; a subsequent global trusted-actor/exact-key receipt lookup must find no saved receipt. Existing atomic revision guards then prevent an old-version intent still in flight from committing. The 409 proof contains only key, organisation/person/visit IDs, expected/current versions and the literal disposition. It contains no patient facts or foreign receipt. A plain GET, generic 409, mismatched proof, saved foreign-organisation key or failed proof audit cannot release uncertainty. Recognized proof retains unsaved inputs, clears the stale comparison and patient check, and enables explicit comparison/replacement; it never acknowledges a save.
4. All links inside the routine screen now receive its existing 44px minimum target styling. The nested device-drafts link previously measured 36px high. Other shared components, clinical rules, writer semantics, identity, receipts and migrations remain unchanged.

## Evidence and limits

[The append-only receipt](EVIDENCE-20261011-RECOVERY.json) pins source and retained evidence. Raw logs, screenshots, layouts, timings and failure witnesses are outside Git under the workspace's `outputs/saha-health-overnight-20261011/`.

| Check | Observed result | Boundary |
| --- | --- | --- |
| Fresh D01 impact builds/checks on original main, preserved candidate and original D03 source | Each build passed; each unchanged composite/reminder selection passed 188 | Scoped impact only; older failures are non-reproduced, not retroactively erased |
| First-repair affected existing checks | Today 58, native API 5020, encrypted restore 21; guards passed | Frozen source receipt identifies the exact first-repair scope; not a later full-head CI result |
| Current repair build/types/focused lint | Passed | Actual local Node 24.19.0 build; unchanged dependencies |
| Current lint ratchet | 1392 errors / 618 warnings, unchanged | Existing debt; no baseline increase or suppression |
| Full current routine browser journey | Independent QA 244 passed, 0 failed; separate canonical runner repeat 244/0 with raised guard passed | Actual built local synthetic Worker/D1, source and build pins stable |
| Phone layout and input | 56 stage/comparison layouts; 619 labelled controls; minimum height 44px, width 50.484375px; no horizontal overflow; actual 16px/32px root font | 360×640 and 390×844, 100%/200% text; real keyboard navigation/edit/save/readback; desktop Chromium emulation |
| Encrypted local component | 1000 warm seal/CAS/read/unseal transactions; median 0.5ms, p95 approximately 0.6ms, p99 approximately 1.2ms, maximum approximately 6.1ms | Same full three-pack fixture; original p95≤500ms target retained. Excludes key derivation/pre-timing clone, reference physical device/network, restart/disconnected journey and full NFR certification |
| Full unit selection | **FAILED**: 201 suites selected; 10699 completed positive assertions; audit-contention suite aborted on 1 of 120 read refusals | Reporting `failed: 0` inside the aggregate does not mean a pass; failed suite/exit/guard remain authoritative |
| Focused unchanged audit repetitions | Two runs passed 3 assertions each | Do not clear the original failure or substitute for a single full unit pass |
| Adverse valid zero-backoff diagnostic | **FAILED** original zero-refusal oracle: 32 refused, 88 recorded out of 120; chain remained intact | Separate diagnostic copy, no production/driver edit; identifies admitted starvation without reconstructing the original random schedule |

Independent QA reproduced the original organisation-loss and unknown-key bugs, the first-repair stale-retry lockout and the 36px target defect. Failed snapshots/logs remain. Two native proof negatives verify a saved same-actor foreign-organisation key returns error-only 409 and a failure of the second read audit returns error-only 503 with no clinical mutation. Browser negatives retain the original key after generic 409 or a different-key proof. Final separate source/evidence review found no concrete introduced defect and confirmed the original 51-check semantics were retained; the local performance sample count was strengthened to 1000. The routine minimum is raised from 51 to the actual observed 244, with no other original minimum removed or reduced.

## Requirement and delivery position

The related SAHA-004/006/020/021/024/049 and parent BR-UX-01/02, BR-DATA-01/02/05, BR-RULE-03 and NFR-02/05/09/10/13 remain at their existing implementation/formal assessment levels. These are synthetic engineering observations, not formal case execution or clinical approval. Formal UAT remains 0/364; BRD acceptance remains 0/176.

A1–A8 have bounded local evidence in the current routine journey. A9 remains incomplete because the full unit gate is red, full reference-device NFR is unqualified, and final-head CI/separate complete publication review have not passed. A10 has no new qualified merge, exact hosted commit or authorized live routine-save/readback/refusal evidence. No D04 feature work may begin before the original ten gates pass. The connected screen still makes no durable local-save acknowledgement.

## Resume one step at a time

1. Read `HANDOVER.md`, `AGENTS.md`, the frozen [specification](SPECIFICATION.md), this note and its receipt. Use the owned checkout `work/saha-health-overnight-20261011`; preserve other chats and original drafts.
2. Close the audited-read starvation finding with a bounded, independently reviewed repair and a regression that fails before it. Preserve the failed complete unit run and adverse diagnostic. Do not increase time bounds, weaken assertions, quarantine the test or declare success from retrying until green.
3. On the actual final source, run meaningful affected checks and one canonical full unit gate; never aggregate unrelated report directories. Review exact sources/build and update new evidence, assessment, implementation, next-delivery and validation together. Append a new immutable source manifest after all covered text is final.
4. Commit/push each meaningful batch normally and verify its remote head/tree. Draft publication is authorized. Current financial permission for paid CI/cloud actions and sponsor merge authority must be established before those actions; earlier Tola window instructions are not Saha release authorization. Observe actual final-head required jobs and protections, then qualified isolated merge and exact-host synthetic qualification under that authority.
5. Start D04 only after all ten D03 gates pass. At 08:00 IST start no new feature, save the safe checkpoint, report the real outcome/blockers and pause heartbeat `health-saha-sequential-stories-until-8-am`.

Portable local paths are recorded in the receipt; environment state and credentials are not committed. Runtime command recipes are in [Development and CI](../DEVELOPMENT-AND-CI.md). The tracker is `outputs/saha-health-overnight-20261011/STATUS.json`; ETAs are ranges tied to remaining evidence, never a completion percentage.

## Static UAT mapping follow-up

The first fresh static UAT consistency gate failed on the unmapped routine panel and stale generated scripts. The [separate append-only repair receipt](EVIDENCE-20261011-UAT-MAP.json) retains that failure. The panel now maps to an explicitly candidate-only, deployment-pending routine screen visible to ASHA; other roles are not granted that screen. The existing generator regenerated affected role/journey scripts. All three consistency suites pass 63 assertions with their original guards. The formal execution register remains byte-identical; no human catalogue case was run or promoted. The earlier recovery receipt and its source baseline remain unchanged.
