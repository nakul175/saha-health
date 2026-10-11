# Product context intake
Status: UNCONFIGURED. Owner: TBD. Version: TBD. Source revisions: TBD.

| Field | Value / source |
|---|---|
| Product and intended user outcomes | APLYD; details TBD |
| Users, affected people, operators, locales | TBD |
| Critical journeys and prohibited outcomes | TBD |
| Stack, repository, architecture and dependencies | TBD |
| Linear workspace/team and GitHub repository | TBD |
| Release ID, stage, scope and exclusions | TBD |
| Supported browsers/devices/networks | TBD |
| Test environments and authorized actions/budgets | TBD |
| Personal data, jurisdictions, retention and reviewer | Unknown |
| AI/ML use and decision authority | Unknown |
| Accessibility target and applicability evidence | TBD |
| Quality owner, security/privacy/AI reviewers, release owner | TBD |
| Shared readiness and completion checklist ID/version | TBD |
| Existing SLOs, contracts, baselines and thresholds | TBD |
| Evidence store/access/retention policy | TBD |

For AI and personal data record yes/no/unknown, rationale and authoritative source references. Unknown is not no. A no requires scope-covering evidence. For unresolved fields identify owner, due decision, resolution action and whether it blocks planning, execution or release. Discovery can proceed within a documented authorized boundary; release-dependent unknowns block release.

Bind this record to the existing product documentation context and AI assurance record by ID/version/hash. Keep canonical facts there rather than maintaining conflicting copies. Record authoring AI separately from AI delivered in the product.

## Minimum context by action
| Action | Must be known | Missing-field behavior |
|---|---|---|
| Design tests | Scoped behavior/AC or authorized discovery question, risk, observable oracle, sources | Block that design decision; document question/owner; independent inventory/review may proceed |
| Execute tests | Above + exact build/config, fixture/data permissions, approved environment/action boundary, reproducible method | BLOCKED for dependent execution; no fabricated run |
| Make numeric gate claim | Approved target (established or provisional), metric/population/window and predeclared uncertainty/repetition rule | Gate unresolved; no pass claim |
| Release decision | Frozen scope, current required evidence, applicability resolved, required reviews, real decision authority, rollout/rollback | NOT_READY; stop release action |

Absence of historical baselines does not require an exception: use PROVISIONAL-TARGETS.md where eligible. No baseline is different from no acceptance target.
