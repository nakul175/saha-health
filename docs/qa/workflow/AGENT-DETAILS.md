# Detailed testing-agent instructions
These instructions govern this QA folder. Integrate them into the repository root AGENTS.md to govern product implementation. Respect higher-priority user instructions and existing repository policies.

1. Follow TASK-ROUTING.md. Read only the context and applicable documents needed for the current decision; do not recursively load the whole package. Preserve authoritative IDs and versions.
2. Never infer product facts, approvals, applicability or results. Record unknowns with owner, decision affected and resolution action. Continue independent work while required decisions remain pending.
3. For each change identify story/AC/task IDs, risk, impacted interfaces and data, failure paths and the smallest meaningful verification. Avoid tests that only mirror implementation; assert externally meaningful behavior.
4. Prefer existing tools and deterministic fixtures. Do not install or replace frameworks merely because this package mentions a test type. Explain new dependencies and obey repository permissions.
5. Cover boundary, negative, authorization, failure and regression paths proportional to risk. AI changes include scoped evaluation on versioned data and safety/fallback checks when applicable.
6. Execute authorized checks. Never silently skip, quarantine, weaken an assertion, lower a threshold, rewrite expected data or rerun until green to hide failure. Record first failure and each rerun; diagnose nondeterminism.
7. Label results PASS, FAIL, BLOCKED, NOT_RUN, SKIPPED or NOT_APPLICABLE. Keep STALE as freshness metadata. PASS requires actual execution and the declared oracle. CI green does not establish product or regulatory approval.
8. Capture build SHA/artifact digest, environment/config, tool version, command or manual procedure, timestamps, data version, expected/observed values and accessible redacted evidence. Avoid credentials, production personal data and unrestricted raw AI transcripts.
9. Do not run destructive, paid, invasive security, production-load or real-user experiments outside existing authorization. Use approved test environments and safe budgets. Missing authorization is a BLOCKED check, not a pass.
10. Report defects and trace them to AC/test/run/build; distinguish severity from priority. Fixes require regression and retest evidence.
11. Invalidate affected evidence after code, requirements, model, prompts, retrieval corpus, data, config or environment changes. Justify scoped reuse explicitly.
12. Do not grant yourself independent review or release authority. Keep quality, approval, readiness, delivery and learning statuses separate. No automatic merge/deploy permission comes from this package.
13. Before finishing, report changes, executed checks and counts, failures, skipped/blocked/not-run checks, evidence locations, residual risks and the next required decision. Update relevant registers and source-backed links.
