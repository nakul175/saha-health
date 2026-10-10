# SAHA product quality checker and improvement loop

Planning documentation edition 4.2 · 10 October 2026. Criterion standard `3.0-generic`; canonical SHA-256 `a72502ce4dcfe5ec1e8537cd377f93e77ad32b9d998fdad62c252605089759fe`.

**Do not weaken criteria to obtain a pass.** This edition supersedes earlier checker instructions on this record; historical 166-field/449-detail/1,238-check qualification is not current Saha product evidence. Source snapshots are retained in the documentation revision archive.

## Current framework and scope

Use the generic v4.2 engine, unchanged catalogue 3.0 and explicit planning scope. The framework remains generic; this application uses actual Saha sources. Historical package tests are framework mechanics evidence, not current product acceptance. Current checker qualification: 110 tests includes 15 catalogue-integrity regressions; no Saha review is approved by that number.

Seven mandatory consolidated stage checks per assessed element replace the earlier per-detail review load. The 189-field/587-component reference catalogue supports precise diagnosis. Components have no separate circular verdict. Only selected-stage required/conditional fields run; supporting samples are advisory and cannot waive safety/source/approval requirements.

## One operating order

1. **Check:** run `loop` on the current source-backed real product assessment; this creates persistent repair/reviewer/owner queues.
2. **Summary:** read compact results and coverage.
3. **Next:** inspect the next relevant repair, reviewer task or decision.
4. **Fix:** repair verified editorial omissions; add a clearly attributed recommended assumption where the sponsor authorized judgment. Preserve original/frozen text. Retain actual critique, evidence and unresolved authority.
5. **Check again:** rebind the changed subjects and repeat. A finite run, empty queue or completed document is not a pass.

Missing external facts/approval remain explicit resume conditions. The sponsor has requested recommendations instead of routine clarification for this pass; this permits planning choices and forecasts, not invented owners, reviews, clinical policy, consent, participant access or delivery results.

## Execution and refusal

From the bundle checker directory, run:

```sh
python3 -B quality_checker.py loop --document /absolute/path/saha-plan.json --report /absolute/path/report.json --state-dir /absolute/path/review-state --batch-size 3
python3 -B quality_checker.py summary --report /absolute/path/report.json --state-dir /absolute/path/review-state
python3 -B quality_checker.py next --state-dir /absolute/path/review-state --queue all --limit 3
```

Use actual real mode; no `--allow-synthetic` for this product assessment. Exit 2 retains unresolved work. Exit 3 is blocked/malformed input and requires repair. A changed catalogue is rejected before assessment/output mutation with expected/actual identity. Same parsed catalogue content in another location/format is acceptable. The author cannot create its own independent trust registry; offline results remain advisory even if editable local records match.

## Genuine improvement and exit

Record exact selected scope, checked/total must-pass gates, sample coverage, source/field integrity, unresolved questions, stale reviews and actual separate documentation/approval/Ready/acceptance/delivery/learning states. Do not manufacture favorable reviews to obtain exit 0. Independent agents may supply actual advisory critique with provenance; external authority remains genuine.

Observed findings drive a supported candidate revision, impact analysis, current-source/evidence rebinding and re-review. Preserve persistent unanswered questions and prior failed receipts; reopen regressions. When only unavailable authority/evidence remains, retain the specific blocker/resume condition and finish all independent draft work.

AI assurance, versioned shared Ready/Done checklists, per-epic discovery, priority/sizing and release learning form part of the mapped Saha plan. They do not authorize clinical use, new services, providers, recipients or a deployment.
