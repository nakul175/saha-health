# SAHA-128 independent bounded source/test review

11 October 2026. Advisory review of ENG-BR-SEC-07 / APL-764 at main base `7668a03d97c1ae62174f09e65ccd5a5717120be6`, specification revision 2. No unresolved blocking finding was identified in the inspected runtime and test-driver scope. This is an independent agent review of source and retained author evidence; it is not a human approval, full delivery-gate certification, formal acceptance, merge or deployment clearance.

The reviewer performed read-only source inspection, static comparisons and parsing of existing reports. No production/test runtime, backend, build, network or source edit was performed. Reviewer outputs are confined to this independent-review directory. The initial label-only review remains separately retained as stale historical analysis.

## Final source binding

All ten source hashes in `CURRENT-SOURCE-FREEZE.json` match the independently read files. The frozen receipt's SHA-256 is recorded in `source-and-evidence-pins.final.json`, alongside full source/evidence hashes and captured final source snapshots.

| Source | SHA-256 |
| --- | --- |
| lib/saha/monitoring.ts | d9ae3eee545e1451d4b3db8d63dc922eb9727bfb358de697e037c5d388993b37 |
| lib/saha/request-metric-routes.ts | 592848a22c5b1fd19a972ee47ef44f6a0af2d6e452ce09a0e93bc405eabd1113 |
| lib/saha/identity.ts | 3465582bd580ee3501795a7058ecf7bef6933f171af6b584b259df38243b058a |
| docs/current/saha-128/SPECIFICATION.md | 3f59cba00e547ddce805627a39d736f6dbf33f451ed38414550cc3d491398e77 |
| tests/request-metric-privacy-contract.mjs | 1372825775d653fc236ff142ee674e181fbb8708898c4fcdfa6d719fda97299c |
| tests/request-metric-native-contract.mjs | af51570f7ecc886271d20c9d8406d3e493ccd9c6f52dbb1b1b432a5685965927 |

## Implementation assessment

The allowlist exactly preserves all 61 route strings from the base union; the fixture also matches that base in order and pins its actual monitoring bytes. The public union adds only `unclassified`. The private helper checks the primitive string type before set membership, avoiding non-string coercion, and maps every other value to the fixed fallback. `measured()` normalizes before the existing action timing, then uses that same value in the console envelope, metrics bind and anaemia-specific drain-limit branch.

Apart from normalization and DELETE authorization, the diff retains action execution, original response, numeric status/duration, INSERT/upsert, identity and tenant resolution, correlation/privacy headers, body drain/cancellation branch and fixed metric-failure message. The known anaemia label retains its larger body limit. No clinical writer, retry, schema, patient authority, hosting or retention schedule is introduced.

The inherited DELETE defect is repaired correctly at monitoring.ts line 17: its original org/cutoff predicates and burden exemption are followed by the same active-membership `EXISTS` used for INSERT, with resolved org and trusted `user.userId` bound after org/cutoff. The row's org predicate and membership org bind refer to the same value. An actor without active membership cannot insert, increment or prune selected-tenant metrics. Authorized own-tenant pruning retains its original cutoff and exemptions.

Revision 2 explicitly documents this additional repair and updates M3/M4 accordingly. Revision 1 is preserved in history with SHA-256 `8138d41478e576d60b2add67fa3ae6ceb7f3ba92cedd32f691b17d6d064d5086`, exactly matching the initially read revision. This is a recorded scope revision, not a retrospective claim that revision 1 required unchanged deletion behavior and the new guard simultaneously.

## Oracle and evidence assessment

The original native failure is real: parsing its assertion gives 68 expected rows and 67 actual rows, with exactly one old other-org/patients row removed and no additions. It occurs at both base and label-only source. INSERT's zero-row membership refusal cannot authorize the separate DELETE. The full-row snapshot oracle is stronger than the original “no new authenticated metric” case label and appropriately exposes unauthorized pruning.

The revised native driver preserves that wrong-tenant witness. It also seeds an eligible expired own-org history row before suspending membership, compares the complete ordered snapshot and restores active membership in `finally`. The old native suspended pass lacked this old-row witness and must not be represented as equivalent. The current module driver additionally checks the DELETE membership predicate and org/trusted-actor bind suffix; this validates SQL construction, while the native driver validates actual SQL effects.

Final module94/0 executes exact captured production input strings through TypeScript transpilation, with controlled Workers environment/D1/log collaborators. Its reported source, driver and fixture hashes match current files and its added source-stability check passes. Final native86/0 uses actual monitoring/identity and helper in workerd, real HTTP to a test-only component wrapper and disposable native D1 using existing table DDL. Its recorded input hashes and after-build hashes are equal, match independently read production/driver/fixture/DDL files, and its added end-of-run stability check passes. These repairs address the initial execution-source pin limitations.

The final raw reports match their frozen driver counts: module94 is the original 93 feature groups plus one source receipt; native86 is the strengthened 85 feature groups plus one source receipt. They overlap and are not 180 distinct acceptance outcomes. Preserved revised85-driver reports are base72/13 and repaired85/0; historical original85-driver reports remain base73/12 and label-only84/1. Initial module76/17, missing-import0/93 and corrected93/0 are also retained with their original source hashes. No driver-byte equality is inferred across these editions. The initially observed historical native driver hash5279… matches its reconstructed saved bytes, but this observation was after the historical runs, not an execution-time input capture.

Native M2 requires fallback console labels and absence of the sentinel in DB rows, without a separate per-case fallback-row/count assertion. The module tests directly check the normalized INSERT bind; the production source passes the same normalized variable to both sinks, and historical native snapshot evidence contains an actual fallback row with count11. This is an explicit oracle limit, not evidence of a current runtime defect. Large/non-string/coercion adversarial cases are module coverage; native HTTP covers its declared 11 JSON-transportable adversarial inputs. Detailed large-body cancellation and the anaemia allowance remain source-preservation observations rather than newly exercised native scenarios.

The retained unit-runner report records 203 suites/10,882 passed assertions, no failed/skipped groups, original201 guard evaluation and safe-logs13. This includes the native component under the runner's unit catalogue and does not make it a mounted-app or hosted test. Independently comparing baseline JSON values to base confirms all374 original entries unchanged and only two new entries added, with minima native86/module94. There are no missing or changed original entries.

## Open gates and limits

This review covers runtime label protection, membership-bound operational pruning and the named module/native fixtures. Full M6 still requires the final published candidate's complete checks, separate final-head CI and any changed-base integration checks. Broad HTTP/restore, later documentation/type/lint/security results, publication and remote state were not reviewed or certified here.

Whole-story hosting path logs, crash-report configuration/retention, sensitive-diagnostic store and policy, actual live telemetry, privacy authority, observed deployed SHA, human/formal acceptance and measured user benefit remain open. Original BR-SEC-07 and TC-BR-SEC-07-A/B status remains unchanged. This finite review supplies no whole SAHA-128 Done or deployed-story count and closes no D03/D04 gate.
