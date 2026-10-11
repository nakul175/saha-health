# Linear and GitHub workflow
This is a recommended mapping, not a claim that these objects exist in APLYD's workspace. Configure actual names and permissions; use custom fields only where supported, otherwise stable labels and linked Markdown records.

| Canonical concept | Suggested Linear representation | GitHub connection |
|---|---|---|
| Vision/strategy/roadmap | Initiative/project document or linked canonical product record | docs source/version |
| Release goal | Milestone/goal or canonical planning document | planned scope and quality goals |
| Operating release | Release record if used, linked to release goal | tag, artifact digest, release dossier |
| Epic | Parent issue or project capability | related implementation PRs |
| Story | Issue with AC IDs and linked risk/tests | branch/PR references issue |
| Technical task | Subissue or linked issue | commits and PR |
| Defect | Bug issue linked to case/run/AC | fix PR and retest |

Suggested labels: qa-required, risk-critical/high/medium/low, test-blocked, regression, security, accessibility, ai-eval. Status meaning: planned → ready → in progress → in review → verified/done according to the team's configured workflow. Implementation merged does not automatically mean user acceptance or release approved.

## Issue content
Scope and ancestors; canonical ACs/revisions; risk and applicability; test approach; required fixtures/environment; owner; evidence links; remaining decisions. Link rather than duplicating drifting requirements.

## PR content
Problem/result; issue/AC/task IDs; change-impact analysis; tests actually executed with build/run links; tests not executed and why; domain evidence; new risks; migration/rollback considerations; reviewer requirements. Avoid secrets and personal data in public issue/PR attachments.

## Working agreement
Keep requirement/priority authority in the chosen product/Linear source, code and CI evidence in GitHub, and durable test design/traceability in repository QA docs. Bidirectional links use stable IDs. Synchronization conflicts require source-owner resolution; never overwrite an authoritative AC from a PR comment silently. Use existing authorization for external writes; this package does not instruct an agent to message others or create live issues without authorization.
