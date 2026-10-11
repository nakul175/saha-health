# Task routing and Low-tier fast path
Read this table once, then load only relevant sections. Existing root instructions and authorized scope still apply.

| Task | Minimum reads | Deliverables |
|---|---|---|
| Copy/docs or Low-risk isolated code fix | Relevant AC/change request, local conventions, risk classification and evidence/result rules | Focused check and PR summary; existing IDs if available |
| Medium code/API change | Above + applicable functional/API guide and scoped traceability | Affected cases, run evidence, links and defects |
| High/Critical change | Above + context, testing standard, relevant domain guides and detailed agent rules | Risk/coverage records, specialist evidence/review as needed |
| AI/model/prompt/retrieval change | Above as risk requires + AI guide and canonical AI assurance | Pinned evaluation plan, slices/safety/fallback evidence |
| Release planning or decision | Context, standard, release plan, traceability, CI gates, readiness/reporting | Scope/target snapshot and full applicable gate report |
| Test infrastructure/checker work | Standard/status/schema and checker README | Meaningful regression tests and record compatibility notes |

## Low-tier eligibility
Change has documented Low risk, bounded reversible impact, no critical journey/contract/authorization/personal-data/AI/safety/migration effect and no protected requirement affected. Unknown risk or scope is not eligible. Specialist requirements still apply when relevant. Escalate on new evidence.

Fast path: identify change/AC and rationale → run focused meaningful verification → record exact build/procedure/outcome/evidence in PR or existing run record → report limitations. Do not create a strategy, release plan, ancestor records or numeric gate solely for this change. If the release already has required mapped cases, keep those mappings/current runs updated. Release assessment still evaluates the complete release boundary.
