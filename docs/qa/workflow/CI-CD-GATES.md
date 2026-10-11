# CI/CD quality gates
Adapt to existing runner and commands. This document is a gate design, not an installed pipeline. Required checks must be configured in the actual repository and validated; file presence does not enforce them.

| Stage | Required when applicable | Evidence and blocking rule |
|---|---|---|
| Local/change | Static checks, focused unit/component and affected tests | Failures resolved or explicitly pending before review |
| Pull request | Build, lint/types, unit, integration/contract, security scans, changed-domain tests | Current head and relevant integration build; required checks must genuinely execute |
| Merge/integration | Cross-service contracts, critical E2E and migration checks | Integration artifact identified; no unresolved blockers |
| Release candidate | Full risk-based plan; AI/accessibility/performance/recovery/UAT as scoped | Exact deployable artifact and signed decision dossier |
| Deployment | Config checks, safe migrations, smoke and health | Stop/rollback against declared criteria |
| Post-release | SLO/harm monitoring, cohort health, incident review | Predeclared observation window and owner |

Always-run gate aggregator must distinguish success from missing, skipped, neutral, cancelled, timed-out and unavailable required child checks. GitHub can accept some non-failure check conclusions, so do not rely on green UI alone to demonstrate execution. Protect branches with named checks and trusted reporting source where available. For merge queues ensure checks execute on the integration candidate using supported events; validate repository settings.

Do not expose secrets to untrusted PR code; apply least privileges and use controlled environments for privileged tests. Retain redacted logs, reports, run links and artifact hashes with appropriate access/expiry. Pipeline caches and retries must not hide original failures or use stale results.

Quarantine requires defect, owner, scope, expiry and replacement validation. A quarantined required check still blocks its gate unless actual authority grants an eligible bounded exception. Record flake rate and first-attempt outcomes. Infrastructure failure = BLOCKED, not product PASS.

For each stage configure trigger, commands, risk selection, check name, environment, time/budget limits, permissions, retention and gate expression. Verify deliberately failing a required check prevents merging in a safe repository test; document the result rather than assuming enforcement.

## Runnable record gate
Use `python3 docs/qa/checker/qa_lint.py --registers docs/qa/registers --root .` for structural checks/reporting. Use `--release` only when a complete qualification snapshot is expected; it also fails for unvalidated ACs, unknown applicability and required non-current/non-passing mappings. A structurally valid plan may still have zero product evidence. The checker is one subordinate record gate, not the always-run aggregator, specialist approval or complete release-readiness engine. Its exit code must be included in the real configured pipeline.

## Protect source/control changes
Follow SOURCE-PROTECTION.md and the inactive adoption/github/CODEOWNERS.template. Code-owner review must be required in actual branch/ruleset settings; protect the checker/workflow/schema and ownership file as well as criteria-source/scope. Offline consistency checks do not authenticate that setup. An independently controlled PM/Linear export comparison is an alternative integration, not included as a live connector here.
