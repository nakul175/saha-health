# Support guide

Support should preserve evidence and identify the responsible owner before changing state. The current application has a bounded incident register and redacted diagnostics; it has no independent support role with unrestricted patient access, automatic paging or complete production support service.

| Reported problem | First safe check | Escalation |
| --- | --- | --- |
| Cannot open or see records | Site access, sign-in, active organisation/membership/team and direct assignment | Organisation owner; do not reveal hidden patient existence |
| Save conflict | Current version and unsaved local edits | Assigned care user; compare and explicitly resave |
| Submission uncertain | Original logical key, destination and receipt lookup | Integration owner; preserve uncertainty, avoid a fresh key |
| AI blocked or unable to assess | Permission, intended context, current capability, language, dates and dependency readiness | Governance/clinical owner; no workaround to the gate |
| Offline sync failure | Encrypted draft, grant/current authority and exact command identity | Field support; do not delete unacknowledged storage |
| Wrong person or possible harm | Stop further consequential actions and preserve restricted evidence | Established care escalation and named clinical owner immediately |
| Broad outage | Safe request metadata, maintenance and incident owner | Operations owner; hosted monitoring/cutover remains deployment work |

Record a safe case ID, environment/build, observed and expected behavior, first occurrence, severity, owner, containment, next review and restricted evidence reference. Do not paste raw narratives, patient identifiers, tokens, secrets or provider payloads into ordinary tickets. A diagnostic download is not permission to send the file outside the organization.

Incident resolution requires findings and evidence; resolved records are immutable. Create a linked follow-up case when more work is needed. Do not treat an operator's entered evidence reference as independently verified proof.

For recovery, follow [runbooks](09_Operational-Runbooks_v1.1.md). For privacy/retention requests, route to the custody owner: current correction, consent and access controls do not constitute a complete rights or deletion service. The support team must not invent a deadline, legal interpretation or hidden administrative bypass.
