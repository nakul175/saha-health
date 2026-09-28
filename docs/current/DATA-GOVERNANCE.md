# Data governance

The current workspace and fixtures are synthetic. A production data-custody decision, patient-facing notice, provider agreement, legal basis and retention policy have not been established by this repository. This document records software behavior and decisions still required; it does not supply legal advice or a compliance finding.

## Current controls and boundaries

Membership/team/direct-assignment policy limits patient access on the server. Administrators have no patient scope. Owner authority manages the organisation without bypassing clinical scope. Provider and exchange permissions are explicit and version-bound; a local toggle is not a statutory consent artifact or ABDM consent flow.

Confirmed records, corrections, audit and receipts retain provenance. Identity changes do not erase older attribution. Restrict wrong-person evidence and reconcile downstream copies separately. The retained legacy source and revision ledger support migration accountability but also require a future institution-approved custody and retention policy.

Reports use scoped aggregates and CSV injection protection. Small groups can still reveal information; small-cell suppression and a comprehensive privacy-preserving reporting policy remain incomplete. Support diagnostics omit clinical aggregates and identities, but their export does not grant onward sharing authority.

Hourly request metrics contain organisation, fixed route/status, counts and durations. Old buckets are deleted on later traffic with a 30-day cutoff; dormant organisations are not covered by scheduled erasure. Hosting logs have separate operator controls. This behavior must not be advertised as complete retention enforcement.

## Decisions required before real data

| Decision | Accountable role | Evidence needed |
| --- | --- | --- |
| Custodian, purpose and permitted population | Institution/buyer and privacy owner | Approved scope and patient-facing materials |
| Sensitive episode and purpose separation | Clinical/privacy/security owners | Reviewed access matrix and negative tests |
| Household, guardian and proxy authority | Clinical/privacy owners | Relationship proof, expiry/revocation and scoped workflow |
| Provider disclosure, region and secondary use | Institution and provider owners | Exact contractual terms, data minimization and approved intended use |
| Rights, retention, legal holds and deletion | Custody/privacy owner | Operational policy and implemented, tested dispositions across records and backups |
| Hosted backup and exit transfer | Custody/operations owners | Protected copies, separate key custody, verified restore and accepted recipient handover |

No named owner or acceptance date is invented here. Historical workbook decisions remain open. Future exports must preserve counts, versions, provenance, receipts and unresolved care responsibilities; a successful file download alone cannot complete custody transfer.

See [data model](05_Data-Model-Specification_v1.1.md), [security and safety](06_Security-Privacy-and-Clinical-Safety_v1.1.md) and [acceptance](10_Pilot-and-Release-Acceptance_v1.1.md).
