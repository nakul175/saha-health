# Reporting and evidence summaries
Use templates/test-report.md. Report scope and build first, then actual results and unresolved decisions.

Count PASS/FAIL/BLOCKED/NOT_RUN/SKIPPED/NOT_APPLICABLE separately, with stale evidence flagged separately rather than double counted as a seventh execution outcome. Executed pass rate = PASS / (PASS + FAIL); undefined when denominator is zero. Always show required-case completion and AC validated coverage alongside it so a small passing subset cannot imply readiness. Report first attempt and rerun outcomes, critical/high case coverage, reviewed exclusions, open defects by severity, exception expiry and domain metrics by slice.

No percentage without numerator/denominator, population, window and scope. No pooled AI result without required slice results and uncertainty. No 'all tests pass' if checks are blocked/not-run or stale. A screenshot alone rarely proves build identity or all assertions; attach it to a reproducible record.

Cadence: PR impact/evidence summary; release-candidate gate report; rollout health report; post-release learning review. Choose actual owners and dates. Executive summary separates quality finding, approval status, readiness decision, deployed state and observed user outcome. Evidence references must remain accessible to authorized reviewers through the decision and retention period.

## Mechanical metrics
Use checker output instead of reimplementing CSV arithmetic. It distinguishes selected required-mapping results from historical qualification run counts, and prints freshness and AC coverage separately. Current scoped evidence can validate coverage; stale/diagnostic runs cannot. Full interpretation and limitations are in checker/README.md.
