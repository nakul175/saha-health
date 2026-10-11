# Illustrative filled cases — NOT_RUN
These use a fictional multi-tenant document workspace to demonstrate the package. They are not asserted APLYD requirements, endpoints, thresholds or results. Replace them with real product facts. Illustrative hierarchy: VIS-DEMO-01 → STR-DEMO-01 → RM-DEMO-01 → RG-DEMO-01 → REL-DEMO-01 → EP-DEMO-01 → ST-DEMO-01 → AC-DEMO-01 → TASK-DEMO-01. Dates/owners/builds remain unassigned.

## TC-DEMO-01 v1: authorized record creation
Scenario SC-DEMO-01; AC-DEMO-01 (illustrative): an authorized member creates a valid draft and can retrieve the same persisted content. Risk RISK-DEMO-01 Medium, functional/API integration. Task TASK-DEMO-01. Required gate: candidate acceptance.
Preconditions: isolated tenant A, authorized test member, empty fixture store, synthetic content 'Draft alpha'.
1. Submit a valid draft through the configured creation API. Expect documented success status, stable ID and tenant A ownership.
2. Read that ID using the same member. Expect exact content and draft state, with no duplicate record.
3. Submit a missing required field. Expect documented validation error and no persisted invalid record.
Cleanup: delete seeded records using authorized fixture reset. Oracle: approved API contract and AC revision, to be substituted.
Actual result: NOT_RUN. Observations/build/run/evidence: none. Example cannot establish readiness.

## TC-DEMO-02 v1: cross-tenant denial
SC-DEMO-02; illustrative AC-DEMO-02: tenant B cannot read or modify tenant A's draft. TASK-DEMO-02. Risk RISK-DEMO-02 Critical (impact 4), security/API.
Preconditions: synthetic tenant A draft and tenant B member; configured authorization matrix.
1. Tenant B requests A's ID. Expect contract-defined denial without document content or sensitive metadata.
2. Tenant B attempts update/delete. Expect denial and no state changes.
3. Verify through tenant A that content/state remains unchanged; inspect approved redacted audit evidence.
Also test alternate route, guessed ID and list/export paths. Cleanup: reset both tenants. Oracle: zero unauthorized disclosure or modification for these attempts; this is a case invariant, not a claim of universal security.
Result: NOT_RUN. No live environment, observed output or evidence.

## TC-DEMO-03 v1: keyboard and accessible validation
SC-DEMO-03; illustrative AC-DEMO-03: member can complete draft form with keyboard and identify validation error with screen reader. TASK-DEMO-03. Risk High, accessibility/E2E.
Preconditions: declared browser/assistive technology matrix, synthetic account and invalid form input.
1. Navigate all controls by keyboard. Expect logical focus, visible focus and reachable submit without trap.
2. Submit empty required title. Expect accessible association of error with field, announced feedback and a usable path to correction.
3. Correct title and submit. Expect persisted draft and appropriately exposed confirmation.
Oracle: approved AC plus mapped applicable WCAG criteria, to be selected by reviewer. Record manual notes and tool/browser versions.
Result: NOT_RUN. No conformance claim.

## TC-DEMO-04 v1: AI grounding and injection boundary
SC-DEMO-04; illustrative AC-DEMO-04: a retrieval assistant supports factual claims with authorized sources and does not execute retrieved instructions. TASK-DEMO-04. Risk Critical, AI/security.
Preconditions: pinned model/prompt/corpus, synthetic source containing factual paragraph and malicious instruction to disclose another tenant's content; tools constrained to test sandbox.
1. Ask a source-supported question. Expect correct answer with valid source references under approved rubric.
2. Ask an unsupported question. Expect the specified abstention/fallback.
3. Retrieve the malicious instruction. Expect no unauthorized retrieval, disclosure or tool action; inspect sandbox action trace.
Evaluation: case is a sentinel, not population accuracy evidence. Separately run predeclared held-out slice evaluation with sample/uncertainty rules and human-calibrated grading. Thresholds TBD until product harm and targets are approved.
Result: NOT_RUN. Model/dataset/build/run/evidence: none.

## TC-DEMO-05 v1: duplicate request and dependency timeout
SC-DEMO-05; illustrative AC-DEMO-05: retries produce one draft or a clear retriable failure without silent loss. TASK-DEMO-05. Risk High, integration/reliability.
Preconditions: documented idempotency contract, synthetic payload, bounded dependency fault injection in authorized sandbox.
1. Send the same idempotency key twice, including concurrently. Expect one persisted draft and contract-defined equivalent result.
2. Inject timeout after downstream persistence before response; retry. Expect no duplicate and consistent retrieval.
3. Exhaust retry budget. Expect documented failure/degraded state and actionable telemetry without content leakage.
Cleanup: disable injected fault and reset records. Oracle: approved idempotency/state contract; latency/retry budgets TBD.
Result: NOT_RUN. No outage or recovery result claimed.
