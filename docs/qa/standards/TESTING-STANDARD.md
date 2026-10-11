# Testing standard
## Authority and scope
The package defines proposed team policy to adopt and configure. Existing requirements, contracts, rights and repository policy take precedence. Product owner owns acceptance and scope; engineering owns implementation; QA coordinates strategy and evidence; specialist reviewers assess their domains; the designated release owner makes the release decision. Assign real people/roles in context. Agents can collect evidence, not manufacture approval.

## Definitions
- Unit/component: isolated business rules and component behavior.
- Integration/contract/API: dependencies, interfaces and protocol/authorization behavior.
- System/E2E: complete system and user journeys; use E2E selectively for critical interactions.
- UAT: intended users assess real needs against acceptance criteria.
- Smoke: critical availability after build/deploy. Sanity: focused change check. Regression: previous behavior after change.
- Nonfunctional: security/privacy, accessibility, performance, reliability and applicable AI quality.
Exploratory testing complements scripted testing. Static checks and reviews find different problems from runtime tests. Coverage is a diagnostic measure, not proof of correctness.

## Lifecycle controls
Discovery tests assumptions, feasibility and harm in an authorized boundary. Planning establishes testable outcomes, risks and measurement design. Ready establishes feasible tests, fixtures and dependencies. Delivery records observed results and controls. Learning assesses outcomes and incidents in a declared window. Do not demand live delivery results to complete a discovery plan, or mistake discovery evidence for release validation.

## Ready to implement
Story and AC revisions are identified; ambiguity affecting correctness is resolved; risks and applicability are assessed; observable oracles and data exist; required environments/dependencies/permissions are available; owner approves targets where required. Link shared team readiness criteria by version.

## Complete
Acceptance and applicable quality checks have current evidence; defects are triaged and required fixes verified; source/test/docs changes reviewed; operational handoff and separate approvals complete for the scope. Link shared completion criteria by version. A task can be implemented while release readiness remains blocked.

## Evidence and results
PASS means the identified test executed and met its predeclared oracle. FAIL means execution violated it. BLOCKED means a dependency prevented meaningful execution. NOT_RUN means no execution. SKIPPED means intentionally omitted with rationale and owner. NOT_APPLICABLE requires evidence-based applicability and review. STALE evidence cannot establish a current pass.

Each execution is immutable and identifies scope/AC revision, case version, build SHA and artifact digest, configuration, environment, tool versions, procedure, timestamps/timezone, fixture/model/prompt/corpus versions, expected and observed values, attachments, executor and reviewer. Add new runs rather than overwriting failures. Redact sensitive content without removing decision-relevant facts; store restricted detail separately with controlled references.

## Change and exceptions
Analyze changed requirements, code, dependency, data, model, prompt, retrieval and infrastructure against linked cases. Rerun impacted checks and critical smoke. Reuse unchanged evidence only with documented relevance and freshness. Exceptions name scope, risk, compensating controls, responsible authority, expiry and retest trigger. No exception silently waives a protected requirement or grants permission.

## Defect re-triage and closure integrity
Defect events retain the same defect/case identity across their predecessor chain. Any severity decrease needs a nonempty severity_change_rationale and severity_review_ref identifying actual independent triage review. An agent cannot downgrade to bypass a gate. The checker verifies the presence/reference and chain consistency; the team must authenticate reviewer authority.

Closure requires a PASS/CURRENT QUALIFICATION retest for the same case ID and closed-event build, with evidence. During release assessment the retest must match the full release snapshot. A passing unrelated test cannot close a defect. Changes of defect case identity are rejected; changes to the regression plan must preserve the original failed case and follow reviewed requirement/version changes.
