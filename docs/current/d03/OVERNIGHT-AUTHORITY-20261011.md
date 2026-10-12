# D03 access and attempt recovery checkpoint

Health Saha D03/#176 remains the only active feature story during the owner-authorised coding window ending 11 October 2026 at 08:00 IST (02:30 UTC). This checkpoint repairs current ASHA access, read-audit contention and recovery of an uncertain routine write. The frozen revision-1 specification and all A1–A10 gates remain unchanged. D04 is held until those gates pass.

Work is saved on `feat/d03-qualification-2026-10-11`, draft [PR #192](https://github.com/nakul175/saha-health/pull/192), from main `7668a03d97c1ae62174f09e65ccd5a5717120be6`. Published checkpoint `0009fc506437bed597fd1d7d0bf7df532a66612c` and its [recovery evidence](EVIDENCE-20261011-RECOVERY.json), [UAT mapping receipt](EVIDENCE-20261011-UAT-MAP.json), source baselines and original failure witnesses remain immutable. The next publication receipt records the actual pushed head and tree separately.

## Current behaviour

Routine and Today reads recheck current authority after their durable access audit, using one final consistent database batch. This checks the exact organisation, current ASHA membership and teams, ordinary programme/facility/locality policy, indexed patient assignment and indexed visit ownership. A discovered draft must still be current; a list must retain exactly the same eligible IDs, including detecting equal-count substitution. The guard reads only the fields needed for access decisions. It returns the already audited projection rather than loading another unaudited patient or draft. No awaited hydration follows that final guard.

An omitted organisation is resolved once for the whole routine POST. The dispatcher, refusal proof and successful readback keep that organisation even if a native interposition changes the account's active organisation. Receipt lookup remains global to the trusted actor/key; an active-organisation change does not turn a foreign receipt into absence. Explicit original-organisation replay preserves the original receipt and clinical revision.

ACCESS audit append retries now have a bounded 24-attempt policy with a 25ms backoff cap. Retry requires a recognised exact audit sequence uniqueness collision and a moved chain head. Unknown constraint errors, unrelated uniqueness failures, trigger aborts and malformed nested errors fail closed. Existing clinical-writer retry policy, atomic revision checks, append-only chain, receipts and read semantics remain unchanged. The repair addresses the retained full-unit read-starvation failure; it does not certify every audit or current-authority path in the application.

The routine response supplies `X-Saha-Operation-Actor` from trusted server identity. The current UI pins that actor with the original operation key, exact body, organisation, person and version, and sends it back as an expected-actor precondition. The server checks it before protected context, audit or dispatch. It never authenticates a caller from this header. Older direct clients without the optional expectation retain compatibility; the current UI always supplies it.

A 401/403/404 after POST is not evidence that nothing saved: the command and receipt may already have committed before protected readback was refused. The screen clears protected projections and keeps the original unresolved attempt in memory. Its recovery button remains reachable outside the protected editor. A fresh read of the original selection must show restored authority and the original actor before an exact retry; the server enforces the actor expectation again if sign-in changes between that read and POST. No alternate actor, organisation or new operation key may execute that intent.

Original facts and programme choices remain only in the mounted page's private memory while recovery is unresolved. They return to the editor only after fresh authorisation by the original account for the same selected record. Programme recovery carries only locally changed answers/absence choices against the newly saved baseline and filters current captured-question eligibility. An authoritative stale-version proof releases uncertainty without silently replacing corrections. Comparison and replacement remain explicit. Successful reconciliation or explicit saved-record replacement consumes the recovery snapshot. Closing the page is not a durable local save; encrypted prepared/offline restart remains D04.

## Qualification evidence

All runtime tests use synthetic loopback Worker/native D1 fixtures. Counts are assertions within their own runs, not user-story completion or formal acceptance percentages. Independent source review and the causal before/after witnesses are retained outside Git, with compact file digests in the new checkpoint receipt.

| Check | Actual observation | Scope |
| --- | --- | --- |
| Narrow liveness repair | Before 32/120 reads refused; repaired contract 12/0 and immutable original contention contract 3/0 | Bounded ACCESS append policy, including recognised-collision and strict negative error controls |
| Full liveness-only unit copy | 202 suites / 10714 passed, 0 failures, guard passed | Earlier isolated repair copy; original 201-suite failure and the later missing-build prerequisite failure remain retained |
| Final disclosure guard contract | 34 groups passed and independently repeated | Real SQLite and all 33 applied migrations; immediate-before-batch authority changes, malformed policy, indexed ownership/version/draft, exact-ID lists and all-table evidence preservation |
| Current-authority native HTTP | Identical driver before 183 passed / 62 failed; repaired 245/0 across 34 fault cases | Before exposed 32 private 200 responses; repaired responses disclose none. Precommand refusals make no mutation; post-save refusals retain actual committed receipts and exact restored replay |
| Whole-operation organisation pin | Identical driver before 43/9; repaired 52/0 | Two real organisations with the same patient ID; mutable active-account controls, native command/receipt/visit/audit lineage and original-organisation replay |
| Independent old UI diagnostic | 12 diagnostic checks reproduce three defects | Committed-save 403 loses key, compare 403 hides recovery, and actor A's aborted intent creates a new actor B receipt after legitimate account/reassignment change |
| New actor and refusal recovery browser | Identical final driver before 40 passed / 57 failed; repaired 97/0, six actual browser cases | Scope refusal before/after persistence, comparison, restored original account, changed account, competing facts/programme saves and actor metadata controls |
| Existing routine and Today browsers | 244 + 58 passed on the final parent build; 302 total, 0 failures, original guards passed | Existing drivers unchanged; repeated with native245, organisation52 and new actor97 as one696-assertion guarded selection |
| Existing shared programme recovery | 30 + 53 passed; 83 total, 0 failures, original guards passed | Final snapshot-dependency source; ordinary Load, merge, lost acknowledgement, conditional absence and untouched competing answer controls |
| Final combined unit/API/restore | 203 suites / 10748 unit assertions; API 5020 + restore 21; all passed with guards, 0 failures/skips | Fresh independent copy/build and unchanged 16658 source / 278 build-file pins. Later revised integration-browser fixture is excluded from these selections; this is not final Git-head hosted CI |
| Final local build, types and lint ratchet | Passed; 1392 errors / 618 warnings, unchanged | Current dependencies reused; no suppression or debt-baseline increase |

The original browser's 1000 warm encrypted field-vault transactions retain the original p95 ≤500ms target. That component measurement excludes key derivation, cloning before the timer, reference physical-device/network conditions and disconnected restart. It does not make the connected screen durable or qualify the complete NFR. Current-head hosted CI and A10 have no new passing result in this checkpoint.

## Requirements and remaining gates

Related SAHA-004/006/020/021/024/049 and parent BR-UX-01/02, BR-ID-02, BR-DATA-01/02/05/10, BR-RULE-03, BR-SEC-08 and NFR-02/05/09/10/13 retain their implementation and formal assessment levels. The wider generic captured-member audit helper outside Routine/Today remains a disclosed authority finding; this narrow repair cannot close whole-application security or audit coverage. Formal UAT remains 0/364 and BRD acceptance remains 0/176.

A9 still requires final published-head CI, complete applicable NFR and final publication review. The final identical-driver browser recovery result and696-assertion final parent native/browser selection are locally passed; they do not supply those remaining gates. A10 still requires sponsor-authorised isolated merge, observed hosted commit and authorised live synthetic review/save/readback/refusal. Main merge is not a deployment observation. Paid CI/provider/cloud work requires actual financial authority; routine source publication does not grant new spending or live role changes.

The current product plan is independently published in draft [PR #193](https://github.com/nakul175/saha-health/pull/193), head `29afc692f5a8d832be5c4cf3cf29ed1cfb6174a5`, with its [Linear product hub](https://linear.app/aplyd-sandbox/document/saha-current-product-plan-and-coding-start-8ae95cae358c). Engineering handoff is separately saved in draft [PR #191](https://github.com/nakul175/saha-health/pull/191), head `e63339125f0e3da1bb6419bcad5f449cfcd9fea1`. Neither is silently merged into this application branch. Preserve the original source drafts and the other Health Saha chat's product outputs.

## Resume steps

1. Read `HANDOVER.md`, `AGENTS.md`, [the frozen specification](SPECIFICATION.md), this checkpoint and its evidence receipt. Verify actual PR/head before changing source; use the owned overnight checkout.
2. Reconcile the actual final local results to their exact frozen source and observe final published-head checks. Preserve every failed, interrupted and prerequisite invocation. Final browser principal interposition uses a real native B request and its actual response after an authorised A read; it does not certify a hosted identity provider or browser-cookie reauthentication.
3. Run documentation/requirements integrity and static UAT consistency on final text. Keep the formal execution register byte-identical. Append a new immutable source baseline after staging new runtime/test files; retain every prior manifest.
4. Publish a coherent source/test/documentation batch normally, verify remote head/tree and keep PR #192 as draft until required release authority and checks are satisfied. Never force-push or overwrite concurrent work.
5. D04 starts only when all original D03 gates pass. At 08:00 IST start no new feature, preserve the safe checkpoint, report the actual outcome/blockers and pause heartbeat `health-saha-sequential-stories-until-8-am`.

Raw evidence and the live tracker are in `outputs/saha-health-overnight-20261011/`. ETAs are ranges tied to remaining evidence; no development-completion percentage is inferred.
