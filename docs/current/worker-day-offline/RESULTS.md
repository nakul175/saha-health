# D04a / D05 witness: observed execution

9 October 2026. Draft PR #187, dependent on #184. No merge, hosting change, provider activation or formal acceptance.

## Exact source and evidence

Prepared source: `50c672c95044bf093f241f3f6dea1fce308dd3d5`.
Execution: https://github.com/nakul175/saha-health/actions/runs/37938542080
The run trigger is seed `9b7d931`; its second job explicitly checks out the published prepared source above. Do not mistake the seed for the tested source.
Artifact: `worker-day-offline-evidence`, ID `11620965339`, SHA-256 `7cb7df728cb0d841f886ef13c19f7af498f855c9d0a2b064617b8eec5e3e1e5f`.
The ZIP was downloaded and inspected: source-commit.txt matches the prepared source, all eleven checks.tsv exits are zero, and the actual browser and contract reports agree with their runner logs. Fourteen-day artifact retention is not permanent archiving.

## Observed results

| Selection | Result | Boundary |
| --- | --- | --- |
| New offline metadata/crypto/routing contract | 26 passed | Actual Web Crypto; injected service-worker events, not browser durability |
| Existing app grant contract | 11 passed | Unchanged grant rules |
| Current public-shell policy successor | 12 passed | All original policy assertions, stable unit/field-shell ID and minimum retained |
| Existing worker-day online browser journey | 18 passed | Local synthetic backend persistence, not a live host |
| New offline browser journey | 26 passed | Actual Chromium restart/profile/IndexedDB, isolated synthetic Worker/D1 |
| Documentation, requirements, catalogue, dependencies, restored workspace input, lint, types, build, Chromium setup | Passed | Selected engineering checks only |

Total in the named unit and browser selections: 93 reported assertions, zero failed/skipped. Lint remains at its original 1,392-error / 618-warning debt baseline; this does not mean no lint issues. The new tests are not yet adopted into the global count-baseline register; their actual assertions ran, but a guard reporting zero baselined browser suites is not count-ratchet coverage. Retain and register their observed minima through the existing process before merge.

## What the real browser demonstrated

1. Existing Today opens same-origin prepared work; online IDs resolve only within the assigned list.
2. A private passphrase protects the existing encrypted vault. No name is shown before unlock.
3. A prepared visit captures an observation and note, then continues after network loss.
4. Query-bearing offline reload returns a public locked shell; unlock resumes the same visit/step.
5. Closing Chromium and relaunching the SAME persistent profile while offline preserves acknowledged edits and the selected step through actual IndexedDB.
6. Public caches, localStorage and sessionStorage contain no decrypted test name/note; API and query responses are not cached.
7. Injected quota failure does not produce a saved acknowledgement, and the previous durable value survives.
8. A sync response is deliberately dropped AFTER the real backend accepts it. The original pending operation identity survives; recovery yields one matching, unconfirmed server draft without duplication.
9. A connected account change conceals protected information and blocks unlock even when the old passphrase is supplied.

The test uses a 360 x 640 Chromium viewport, not a physical handset. It restarts a browser process cleanly; it does not simulate sudden power loss, OS crash, storage eviction or a destroyed device. The synthetic record has weight 57.5 plus fictional notes; it is not a clinically complete visit.

## Story-level evidence, not blanket acceptance

D04a-A1 through A3: observed on the bounded prepared fixture. A4: pure metadata/legacy-shape checks; not a full legacy-vault migration qualification. A5: injected quota fault observed. A6: directly inspected public/plaintext stores in the browser fixture. A7: navigation count and horizontal-overflow check only, not full accessibility or keyboard certification. D05w-A1 through A3: observed draft sync, dropped-response recovery and connected account refusal.

Full D04/D05, original 364 formal cases, physical Android, p95 500 ms save performance, all record types, multi-programme semantics, government/provider acceptance and ASHA usability remain pending. The existing passphrase, manual preparation and reviewed-sync interactions are retained for this slice; it is not seamless recovery of an unprepared online form or automatic background submission.

## Publication history and release

The first preparation failed on an immutable historical test driver before publication. The successor now hash-checks and executes its twelve policy assertions with the new thirteen-asset fixture. The next preparation passed integrity but the CI bot was refused workflow publication. Workflow files were published by the already-authorised repository connector instead; the bot was restricted to application/documentation changes, without broader permissions. No error was relabelled as a passing product test.

The temporary branch-writing preparation workflow is removed with this result note through the authorised connector. The remaining verifier is read-only. Application and test bytes are unchanged by that cleanup; fresh final-head CI remains a separate observation, not an inherited green claim. Parent #184's CI/review gate and inherited defects #185/#186 are not waived.

Release remains unapproved. The DigitalOcean updater may follow main independently; neither this PR nor its parent is to be merged without sponsor approval.
