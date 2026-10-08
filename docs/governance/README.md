# Governance documents: the 27 standard documents

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: any change to a mapped file's path or status; review the whole table at each release.

The owner decided that every app must have all 27 standard documents. This page maps each to its **canonical path in this repository**, existing or new. It links; it does not copy. New governance documents are in this folder. Drafting status: documents marked *agent-drafted* were written on 2026-10-08 from repository files, **have not been reviewed by a person or counsel, and claim no certification or compliance**. Unknowns are marked `TBD (owner: Nakul Jain)`. Deployments hold synthetic data only.

Status key: **Present** (existed before), **New** (added by this change), **Extended** (existing plus a new supplement), **Gap** (listed under Known gaps).

| # | Item | Canonical file(s) | Status | Reviewed |
| --- | --- | --- | --- | --- |
| 1 | README | [README.md](../../README.md) (status, run steps, doc links) | Extended | 2026-10-08 |
| 2 | LICENSE + CODEOWNERS | [LICENSE](../../LICENSE) (placeholder, all rights reserved), [.github/CODEOWNERS](../../.github/CODEOWNERS) | New | 2026-10-08 |
| 3 | Contributing + PR template | [CONTRIBUTING.md](../../CONTRIBUTING.md), [PR template](../../.github/PULL_REQUEST_TEMPLATE.md) | New | 2026-10-08 |
| 4 | Config / env reference | [.env.example](../../.env.example), [CONFIGURATION-REFERENCE.md](CONFIGURATION-REFERENCE.md) | Extended | 2026-10-08 |
| 5 | Changelog | [docs/current/CHANGELOG.md](../current/CHANGELOG.md) (documentation edition record), [VALIDATION.md](../../VALIDATION.md) and `RELEASE-*.md` (release history) | Present | 2026-10-08 |
| 6 | Security policy | [SECURITY.md](../../SECURITY.md) | New | 2026-10-08 |
| 7 | Architecture overview | [High-level design](../current/02_High-Level-Design_v1.1.md), [deploy/README.md](../../deploy/README.md) (deployed view) | Present | 2026-10-08 |
| 8 | Design docs / RFC process | [DESIGN-AND-RFC-PROCESS.md](DESIGN-AND-RFC-PROCESS.md), slice notes `docs/current/SLICE-*.md` | Extended | 2026-10-08 |
| 9 | ADRs | [Architecture decisions](../current/ARCHITECTURE-DECISIONS.md), originals in `docs/history/v1.0/engineering/adrs/` | Present | 2026-10-08 |
| 10 | API contract | [API-CONTRACT.md](API-CONTRACT.md) (pointer), [API inventory](../current/CURRENT-API-INVENTORY.md); OpenAPI is history only | Extended | 2026-10-08 |
| 11 | Data dictionary + migrations | [Data dictionary](../current/CURRENT-DATA-DICTIONARY.md), [MIGRATION-HISTORY.md](MIGRATION-HISTORY.md) | Extended | 2026-10-08 |
| 12 | Runbooks | [Runbooks](../current/09_Operational-Runbooks_v1.1.md), [OPERATIONS.md](../../OPERATIONS.md), [PILOT-RUNBOOK.md](../../PILOT-RUNBOOK.md), [deploy/README.md](../../deploy/README.md) (deploy, rollback, restart, restore); secret rotation in [SECRETS-REGISTER.md](SECRETS-REGISTER.md) | Present (rotation procedures are proposals) | 2026-10-08 |
| 13 | SLOs + alert catalogue | [SLO-AND-ALERTS.md](SLO-AND-ALERTS.md) (proposed, not measured) | New | 2026-10-08 |
| 14 | Incident process + postmortem template | [INCIDENT-PROCESS.md](INCIDENT-PROCESS.md), [POSTMORTEM-TEMPLATE.md](POSTMORTEM-TEMPLATE.md) | New | 2026-10-08 |
| 15 | Backup/DR + restore log | [BACKUP-AND-DR.md](BACKUP-AND-DR.md), [RESTORE-TEST-LOG.md](RESTORE-TEST-LOG.md) (zero real-host entries) | New | 2026-10-08 |
| 16 | Test strategy | [Testing Saha](../current/TESTING.md), [07 Test strategy](../current/07_Test-Strategy_v1.1.md) | Present | 2026-10-08 |
| 17 | Release / deploy process | [Hosted staging](../current/HOSTED-STAGING.md), [deploy/README.md](../../deploy/README.md), [Development and CI](../current/DEVELOPMENT-AND-CI.md) | Present | 2026-10-08 |
| 18 | User + admin guide | [User](../current/USER-GUIDE.md), [Administrator](../current/ADMINISTRATOR-GUIDE.md), [Support](../current/SUPPORT-GUIDE.md), [OPERATOR-AND-HOST-ADMIN-ADDENDUM.md](OPERATOR-AND-HOST-ADMIN-ADDENDUM.md) | Extended | 2026-10-08 |
| 19 | Third-party inventory / SBOM | [THIRD-PARTY-INVENTORY.md](THIRD-PARTY-INVENTORY.md), [sbom.cdx.json](sbom.cdx.json) | New | 2026-10-08 |
| 20 | Threat model | [THREAT-MODEL.md](THREAT-MODEL.md) *(agent-drafted)* | New | 2026-10-08 |
| 21 | Access-control model | [ACCESS-CONTROL-MODEL.md](ACCESS-CONTROL-MODEL.md) | New | 2026-10-08 |
| 22 | Secrets / key register | [SECRETS-REGISTER.md](SECRETS-REGISTER.md) (names only) | New | 2026-10-08 |
| 23 | Privacy docs | [Record of processing](PRIVACY-RECORD-OF-PROCESSING.md), [DPIA](DPIA.md), [Retention schedule](RETENTION-SCHEDULE.md), [Data-subject requests](DATA-SUBJECT-REQUESTS.md) *(agent-drafted)*; [Data governance](../current/DATA-GOVERNANCE.md) | New | 2026-10-08 |
| 24 | Secure-dev / supply chain | [SECURE-DEVELOPMENT-EVIDENCE.md](SECURE-DEVELOPMENT-EVIDENCE.md) | New | 2026-10-08 |
| 25 | Accessibility statement | [ACCESSIBILITY-STATEMENT.md](ACCESSIBILITY-STATEMENT.md) (conformance not claimed) | New | 2026-10-08 |
| 26 | AI-feature docs | [AI-MODEL-CARD.md](AI-MODEL-CARD.md), [AI-GOVERNANCE.md](../../AI-GOVERNANCE.md) | Extended | 2026-10-08 |
| 27 | Compliance control mapping | [COMPLIANCE-CONTROL-MAPPING.md](COMPLIANCE-CONTROL-MAPPING.md) *(agent-drafted)* | New | 2026-10-08 |

## Known gaps

- **No CI workflow was added** (out of scope for this change). Nothing automatically checks that governance documents stay current, that the SBOM matches the lockfile, or that links resolve; `docs-checks.yml` covers only the existing documentation integrity check.
- LICENSE is a placeholder decision for the owner; no licence has been chosen.
- No machine-readable OpenAPI of the real API; `.env.example` omits five variables (see [CONFIGURATION-REFERENCE.md](CONFIGURATION-REFERENCE.md)).
- No measured SLOs, monitoring, on-call, backup schedule or real-host restore test.
- No human review of any governance document, threat model, DPIA or compliance mapping.
- Secret rotation has not been tested; holders and backup holder are TBD.

Preserved folders `docs/history/`, `docs/reference/` and `sources/` were not touched.
