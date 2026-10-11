# Source protection verification
Control status: NOT_CONFIGURED. Repository/base branch: TBD.
Actual human source owner/team and authority evidence: TBD.
Criteria-source path and scope.json path: TBD.
Protected control/checker/schema/CODEOWNERS/workflow paths: TBD.
Branch/ruleset identifier and accessible configuration evidence: TBD.
Required owner-review setting, stale approval/latest-push policy: TBD.
Required QA check/trusted integration and bypass/direct-push policy: TBD.
Canonical source revision and complete-scope review evidence: TBD.

## Safe enforcement checks — NOT_RUN
1. Change criteria source and scope pins on a test PR with no owner approval. Expected: cannot merge despite a passing consistency check. Observed/config evidence: None.
2. Add new reviewable changes after approval. Expected: configured fresh-review requirement applies. Observed evidence: None.
3. Propose changing CODEOWNERS/workflow/checker or moving the source outside owned paths. Expected: control-owner review required or configuration detects uncovered path. Observed evidence: None.

Verifier/review time and actual results: TBD. Uncovered paths/bypass access: TBD.
Control status after verified setup: VERIFIED or FAILED. These are control-verification states, not execution outcomes. No name typed here proves authority. Do not run real unauthorized merge/deployment actions for this check.
