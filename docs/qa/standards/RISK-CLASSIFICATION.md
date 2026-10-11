# Risk classification and threshold policy
Assess each failure mode, not just each feature. Record impact (1 cosmetic, 2 recoverable inconvenience, 3 material outcome/service harm, 4 severe privacy/security/financial/safety harm) and likelihood (1 rare with evidence, 2 plausible, 3 likely/exposed, 4 frequent/easy exploitation). Score = impact × likelihood. Unknown likelihood uses a conservative provisional rating and a resolution plan.

| Tier | Rule | Minimum validation depth |
|---|---|---|
| Critical | Impact 4 overrides score | Threat/harm review; negative and abuse cases; authorization and isolation; failure/fallback; independent specialist review; all critical ACs evidenced |
| High | Score 9–16 or material irreversible action | Boundary/negative/integration and relevant E2E; domain tests; recovery; reviewed evidence |
| Medium | Score 4–8 | Functional, boundaries, changed interfaces and targeted regression |
| Low | Score 1–3 | Focused verification or review proportional to change |

Escalate for vulnerable users, broad blast radius, hard-to-detect failures, sensitive data, external actions or unvalidated AI. Score is prioritization, not proof of safety. Record inherent and residual risk separately after observing control evidence. Severity of an observed defect is separate from predicted risk and scheduling priority.

## Default proposed release rules
- Every in-scope acceptance criterion has a test or explicit reviewed non-test verification. All critical/high required cases execute successfully with current evidence; no unresolved release-blocking defects.
- Critical invariant failures (cross-tenant disclosure, unauthorized irreversible action, unsafe AI authority, corrupted recovery) block release regardless of average pass rate.
- Medium/low unmet requirements require a bounded exception from actual authority; do not report them as passes. Mandatory contractual/legal/accessibility requirements cannot be waived by scoring them low.
- Unknown release-critical applicability, undefined required targets, missing required review, stale evidence or blocked required checks means NOT_READY.
- No arbitrary universal coverage %, latency, accuracy, uptime or vulnerability score threshold. Define targets from user needs, contracts, SLOs, baselines and harm analysis before execution.

## Threshold record
For every numeric gate record metric definition/unit, population and slices, risk tier, target direction/value, denominator, window, workload/sample size, uncertainty rule, baseline, source rationale, owner, version and approval. For statistical gates define confidence method and decision bound in advance; zero observed failures does not imply zero true risk. Report confidence intervals, missing data and slice performance. Undefined target = unresolved gate, not pass. Reject material regression even if a pooled score remains above target when the predefined regression rule says so.

## Defect severity alignment
Use D1 minor, D2 recoverable material issue, D3 major function impaired, D4 severe harm/critical outage/disclosure. Higher number means greater harm for both impact and defect severity. Priority remains separate. Existing external S1–S4 systems may retain their native codes, but map explicitly (S1→D4, S2→D3, S3→D2, S4→D1) at import; never reinterpret historical labels silently.
