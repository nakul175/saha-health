# Release readiness
Use templates/release-decision.md for each immutable candidate. Identify release scope/version, deployable digest, environment/configuration and evidence snapshot.

A candidate is READY only when applicable required AC and domain gates have current evidence, blocking defects are closed with retest, reviews/approvals are real, rollout and rollback are feasible, and operational ownership is established. NOT_READY covers failed/missing/stale required evidence and unresolved critical applicability. WITH_EXCEPTION is an explicit qualified decision, not a pass, and cannot cover nonwaivable requirements. Readiness does not itself authorize deployment.

Checklist: scope frozen; traceability reconciled; required runs complete; threshold owners and versions known; AI/data/prompt/corpus pinned; security/privacy and accessibility reviews complete when applicable; performance at representative load; migrations and backup restore exercised; test fixtures removed; rollback trigger/steps/owner established; alerts and support/runbooks ready; approved exceptions within expiry; release decision signed by actual authority.

Use staged rollout where feasible. Define cohort, exposure budget, observation duration, latency/error/harm measures, stop conditions and rollback ownership before deploy. Smoke verifies basic health, not every acceptance criterion. Monitor exact deployed version and compare to baseline. Rollback of code may not undo data migrations or external actions: test restoration/compensation accordingly.

After the learning window record observed outcomes, baseline, denominator, uncertainty, incidents and decision to continue, improve, narrow, roll back or retire. Create linked follow-up work within authority. Preserve distinct quality, approval, readiness, delivery and learning statuses.

## Source-integrity adoption gate
Actual source/pin protection must be verified before this QA process supports real release decisions. Link the complete-scope review and source-protection-verification record to the release dossier. A self-pinned source passing qa_lint.py cannot clear this independent governance gate. Required control NOT_CONFIGURED/FAILED means the real release remains NOT_READY.
