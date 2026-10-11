# Safe report-edition recovery — 11 October 2026

Existing defect [#185](https://github.com/nakul175/saha-health/issues/185) blocks shared reporting qualification. This clean branch starts at main `7668a03d97c1ae62174f09e65ccd5a5717120be6`, independently of the routine-visit candidate and PR197 timing fixture. The current feature remains one routine-visit story, not another feature dispatch.

## Frozen repair contract

Two independently authorised viewers requesting an original and a one-person-changed reissue concurrently must each retain one meaningful safe edition. Neither may obtain both incompatible editions. Original 133 assertions, minimum cohort five, current reporting purpose, patient scope, frozen bytes and audit remain authoritative. No new clinical policy, database, migration, provider or external recipient is introduced.

The existing release-ledger reservation and organisation-revision disclosure compare-and-swap can race. A disclosure CAS failure returns no data; repeated safe reads can nevertheless starve. The candidate repeats only the typed `AppError` 409 with exact message `Current edition disclosure authority changed. Nothing was shown.` at most three total protected-read attempts. Before every repeat it obtains fresh server context, pins the original actor and organisation, rereads the figure and reevaluates every existing permission/privacy/completeness check. Existing audit/disclosure reservations remain durable. Other privacy, integrity, ordinary/spoofed, authority or ledger errors are returned immediately. This is read recovery, not a clinical-command or external-delivery retry.

## Evidence and limits

The first ordinary main diagnostic passed133, demonstrating an intermittent failure rather than deterministic universal failure. A declared one-time trigger in disposable synthetic D1 changes organisation revision after a ledger update; its unmodified-main control fails the original meaningful-safe-edition assertion. The final typed candidate passes all133 original assertions under that control. Exact hosted failing interleaving was not instrumented and is not claimed identical to the controlled witness.

A separate actual backend revocation control suspends a synthetic membership between ledger evaluation and disclosure. It returns403 and no figures; its131 assertions include129 overlapping setup checks and two distinct revocation checks. The source is manual, separately executable, and does not replace the primary133 gate.

A47-check unit contract executes the actual transpiled `figurePost` request function with controlled collaborators. It tests fresh context, three total attempts under persistent exact conflict, immediate error classification and revoked/changed identity refusal. It is not a D1/HTTP or formal acceptance test.

Two failed SQL persistent-contention experiments are retained outside the positive runnable catalogue. One reached the existing release-ledger409 after three ledger writes; another trigger altered SQL affected-row accounting and could not establish the desired CAS conflict. Neither is a recovery-bound pass. The unit contract and separate real backend controls provide different, explicitly limited evidence.

Build/types pass locally. Affected seven-suite reporting/edition/authority and runner regressions pass512/0/0, with all six prior minima and no quarantine. Final typed real membership-revocation repeat also passes131/0. Source/report manifest is tests/evidence/report-edition-recovery-20261011/manifest.json. Publication, fresh hosted CI and required independent review remain pending. Author diff inspection is advisory; no human/domain approval is invented. No merge/deployed SHA, story Done, formal BRD or UAT acceptance follows from these local checks. Previously failing routine speed/load, two hosted Worker-restart suites and PR197 whole-CI failure remain separate blockers.

Documentation checks pass1,784 source files,176 original requirements and364 cases with zero formal accepted. UAT tooling passes63/0/0 after regenerating existing source-driven pack references; the first62/1 generated-reference failure is retained. An initially edited historical source-index file was correctly refused, restored byte-for-byte, and the preimage added to the existing unpinned composite supplement. No check was weakened. Archived private diagnostic source is the latest experiment variant; it is not asserted to be the exact script version for every earlier SQL experiment.
