# Complete fictional lifecycle — never product evidence
All requirements, outputs, people, authority, hashes, PRs and approvals in this folder are synthetic teaching data. No product execution occurred. An illustrative PASS below demonstrates record shape, not an APLYD passing result. Keep this folder outside live qualification registers.

## Requirement
AC-DEMO-02 v1: tenant B cannot read/modify tenant A's draft. AC-DEMO-06 v1: a noncritical textual error fits a declared 320px viewport. This second demonstration assumes a bounded internal prototype without a mandatory accessibility requirement implicated; that assumption cannot be copied to a real product without review.
Hierarchy: VIS-DEMO-01 → STR-DEMO-01 → RM-DEMO-01 → RG-DEMO-01 → REL-DEMO-01 → EP-DEMO-01 → ST-DEMO-01 → the two ACs/tasks.

## Risk
RISK-DEMO-02: impact 4 × likelihood 2 = 8, Critical because impact 4 overrides score. RISK-DEMO-06: impact 2 × likelihood 2 = 4, Medium. Sources and owners are fictional. Register rows show actual scoring fields.

## Cases
TC-DEMO-02: seed two synthetic tenants, request A's draft as B, require denial/no content; then verify A's content unchanged. TC-DEMO-06: open the noncritical error at 320px and inspect clipping. Cleanup: fixture reset. Both are manual, fixed procedures with version v1.

## Protocol
One qualification execution per case on each candidate, no retry-to-green. A fix produces a new build/run linked to the failed original. Extra unchanged-build reruns would be DIAGNOSTIC and cannot replace selected evidence.

## Observations
RUN-DEMO-FAIL on original candidate: illustrative FAIL, tenant B received content. Retained as STALE for fixed candidate; not deleted. RUN-DEMO-RETEST on fixed candidate: illustrative PASS, denial and unchanged original content. RUN-DEMO-MEDIUM on fixed candidate: illustrative FAIL, clipped text. These are authored assertions, not screenshots or authentic logs; timestamps and SHA labels are fake.

## Defect
BUG-DEMO-01 D4: OPEN → FIXED by FICTIONAL-PR-01 → CLOSED after RUN-DEMO-RETEST. Three immutable event IDs preserve history. Closure refers to the passing retest and the unchanged-content regression assertion. BUG-DEMO-02 D2 remains OPEN; the exception does not close it.

## Exception
EX-DEMO-01 is an illustrative eligible exception for the D2 nonmandatory usability issue only. Fictional authority grants a bounded internal pilot through 18 October 2026 with full error details in support instructions, support owner present, and remediation before broader rollout. No sensitive-data, safety, security or mandatory accessibility condition is waived. The observed usability failure remains FAIL. Controls/approval described here are fictional and cannot authenticate a real release.

## Decision
Fictional release-owner disposition: WITH_EXCEPTION for that limited internal pilot, approval APPROVED within the demo only, quality DOES_NOT_MEET_GATES, delivery NOT_ESTABLISHED, learning NOT_STARTED. Critical isolation sentinel fixed; medium issue unresolved. This is not a full security review or total readiness claim. A real candidate additionally needs all applicable domain/operational evidence and authenticated approval.

Mechanical report: planned coverage 2/2; validated coverage 1/2; selected results PASS 1, FAIL 1; required completion 2/2; pass rate 1/2. Historical qualification runs PASS 1, FAIL 2. The strict checker `--release` intentionally exits 1 because the second required mapping failed: it does not auto-approve exceptions or turn WITH_EXCEPTION into a clean record pass. An actual authorized exception path is a separate reviewed release decision.

## Bootstrap target example
Fictional first-release target: draft-save client p95 ≤2 seconds at 10 concurrent synthetic users for a 15-minute window; errors ≤1%. These numbers are illustrative only. Rationale: a hypothetical approved pilot user tolerance/capacity estimate; expiry after pilot; baseline established during REL-DEMO-01's declared pilot window and reviewed before REL-DEMO-02. No performance run exists, so result NOT_RUN and no real release inference follows. Nonwaivable isolation invariant remains zero disclosure independent of this provisional performance target.

## v1.2 source and path bindings
criteria-source.json is a fictional independent-PM-export shape for this teaching fixture. scope.json pins its exact bytes, expected two ACs and sorted ID/version-set hash. evidence_root uses package:examples/lifecycle, so copies of the registers resolve against the same illustrative source/evidence folder. This fixture demonstrates integrity mechanics, not authentic PM source approval.
