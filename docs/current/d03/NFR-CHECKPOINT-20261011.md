# D03 NFR and safe coding checkpoint — 11 October 2026

D03/#176 is the only active story. **It is not delivered.** This draft preserves current test corrections, completed actual browser measurements and failed evidence. Frozen revision 1 A1–A10, original source/history, server authority, clinical records and existing test minima are unchanged. No next feature story, main merge or new live demo is claimed. Read [the compact source/evidence receipt](EVIDENCE-20261011-NFR-CHECKPOINT.json) and [exact-byte saved artifacts](nfr-checkpoint-evidence-20261011/README.md).

## Current authorization and report tests

The separately named authorization fixture retains its original checks and adds the assigned Routine person/organization selectors required by the current contract. It passes **63/0**, with original stable minimum **59**. Original driver bytes and their earlier **59/1** failure remain preserved.

The strict report-refusal classifier passes **11/0**. A built native-D1 causal control passes **10/0**, observing stable200 → a real patient-version source change → exact no-data/no-store409 → fresh stable200. Its owned trigger is dropped in finally, audit/receipt/clinical history remains intact, and owned processes/ports are disposed. This establishes the bounded synthetic refusal behavior, not complete reporting availability.

The revised eight-client load fixture retains original workload, duration/latency budgets and minimum **13**. Only an exact no-data/no-store GET `/api/operations` freshness409 can receive four additional fresh reads; arbitrary409/403/503 or extra protected data is not eligible for this new report-freshness refresh. Original bounded audited-read503 recovery (four retries and at most5% share) remains unchanged and separate. All attempts, failed slots, refresh waits and Worker output are retained. Actual result is **12 passed / 3 failed**, guard **FAILED**: **360/400** required logical slots completed; one owner report exhausted the initial read plus four refreshes. There were489 HTTP attempts,23 exact report refusals,22 refresh requests and no transport failures.

Successful clinical-command acknowledgements overlap every failed report attempt. The native causal control supports safe fail-closed behavior, while the bounded load caller's availability expectation remains unmet. The private initial/fresh report basis was not instrumented; no per-refusal digest cause or missing historical basis is reconstructed. The reporting freshness guard is unchanged from main. Do not relax it, increase refresh budgets, filter failed samples or reduce400 slots to obtain green. Original full five-NFR result **198/2** remains historical failed evidence.

## Completed real browser measurements

The original b492/a72 control finished10 October22:25:56UTC. Actual8,000 records contain exactly1,000 samples per core path plus1,000 composite journeys; there are no action errors or discarded/missing samples. Four local paths use real trusted input, fresh native IndexedDB commit/ACK, signature/current-grant checks and exact readback. Five native flush cohorts acknowledge402/400/400/400/400 original events and leave every queue empty. Clinical versions/facts and all2,928 source +278 build file digests remain unchanged.

| Path | Actual p95 (ms) | Original target (ms) | Local result |
| --- | ---: | ---: | --- |
| Autosave | 28.700 | 500 | Within target |
| Explicit save | 50.300 | 500 | Within target |
| Cached Today | 49.900 | 2000 per entry | All entries within target |
| Cached patient | 65.900 | 2000 per entry | All entries within target |
| Connected Today list | 2350.505 | 3000 | Within target |
| Connected Today detail | 400.798 | 3000 | Within target |
| Connected Routine entry | **3132.309** | **3000** | **Failed;1000/1000 above target** |

This is a serial desktop/Chromium390×844,1Mbps/300ms surrogate. It is not a physical Android or representative R1/device result; degraded repeat is pending. Prepared signed packet/vault setup and declared same-D1 restarts outside intervals are explicit. Cached Today denotes the prepared local draft queue, not the complete assigned schedule. Composite p95 has no invented3s composite budget. Native flushes and browser-local controls do not imply production acceptance. Full raw archives remain local; saved compact summaries/receipts and frozen driver bytes travel with Git.

## Withdrawn navigation proposal

A minimal `next/link` candidate with prefetch disabled built and typechecked, but original Routine browser qualification failed **22/1** after a real organization switch; unchanged Today passed **58/0**. A single separate bounded click reproduced a browser `TypeError` before any Routine API or navigation/RSC request, leaving Today displayed. Independent static-build/stack review maps the callee to a missing named `navigateClientSide` export in the dynamic built module. The transformation stage and decoded live response-body hash remain unproven; this does not implicate organization selectors or server read latency. The proposal is withheld; original `app/today/today.tsx` remains unchanged. No n10/new1000 timing run or improvement is claimed. Preserve the patch and red evidence for diagnosis, without copying it into production source.

## Resume and delivery gates

1. Read HANDOVER.md, the frozen specification, this receipt, saved failures and current Git/source pins. Preserve the sole D03 candidate and original305 unit lineage.
2. Address the actual report availability/recovery contract without relaxing authority/privacy or load minima. Preserve the red400-slot run; use fresh isolated state/output for any explicitly justified new control.
3. Address Routine's3s breach safely. The withdrawn navigation proposal has a functional regression; source-only review/build success cannot qualify it. Require original functional browser contracts before timings, then the same fixed1000 oracle with original targets and retained failures.
4. Complete declared applicable NFR, separate source/evidence review and actual affected checks. Prior green205/166 outcomes remain dated evidence with their source limits; new fixture206 is recorded separately:10,802/0/0, guarded206 with zero quarantine, including unchanged native work-burden-policy13. All382 prior baseline records remain exact; only new classifier min11 is added. The final isolated206 receipt matches1,573 affected unit/support/runtime files, including current305,access229/storea460 and original Today. Enumerated documentation/evidence differences are excluded, so this is not a whole final-head CI claim. Fresh build/types pass, lint retains1392/618, documentation1803 and requirements176 checks pass. Initial generatedUAT62/1 stale coverage is preserved; normal coverage regeneration yields63/0, guarded3, without changing an assertion/minimum or formal register.
5. FinancialCI approval has no answer. Do not infer paid hosted CI/provider/cloud authority from “cont”; preserve reviewable drafts with skipCI. Current-head CI and A10 sponsor merge/exact-host/live synthetic gates remain open. No next story until all D03 delivery gates pass.

Coding authority ends11 October08:00IST/02:30UTC. At the deadline save the exact commit/remote/tree and remaining gates, stop new feature work and pause the heartbeat. Agent turns were interrupted by usage limits20:55UTC–01:14UTC; the already-running browser process completed during that interval. No unattended coding progress is claimed in the gap. Product-plan PR193/controller188/Linear remain separately owned and are not overwritten by this coding checkpoint. Formal BRD0/176 and UAT0/364 remain unchanged.
