# Administrator guide

Organisation ownership and membership role are separate. Owners manage membership and configuration, but their patient scope still follows their care role and teams. An administrator role has no patient-record or clinical-export access.

## Membership and teams

Use **Organisation & team** to create teams and issue invitations to the intended account code. Invitations are single-use, account-bound and expire after 72 hours. The application provides the code; it sends no email. Site audience access is an additional hosting setting and is not changed by an app invitation.

Review current versions when changing roles, teams, owner status or suspension. Last-active-owner protection prevents ordinary lockout. Before moving a worker's patients, use the supported handover workflow so open work has an eligible recipient. Completed actions and original receipts must remain unchanged. An inactive incident/safety owner requires accountable reassignment.

## Connections

Use **Connections** to inspect mode, readiness and supported mapping/capabilities. A registered HTTP endpoint is not an approved destination. Secure credential bindings, exact scoped grants, validation and explicit activation remain required. Keep unqualified connections suspended. Never paste a credential into a label, note, incident or repository file.

MIS mapping changes affect the reviewed payload version. EHR requires an explicit external patient link and scoped permission. A generic FHIR export does not provide ABHA or HIP/HIU functionality. Live partner acceptance must come from the selected system owner.

## Governance and operations

R11 manifests carry immutable revisions, intended use, dates, owners and dependency references. Author, reviewer and activation rules require distinct eligible people where specified. Never impersonate a second account to obtain a review. A passed synthetic evaluation does not remove independent review or production evidence requirements.

Use **Operations** for service metadata, safe diagnostics, incidents and owner-controlled maintenance. Administrators cannot see clinical aggregates merely because they operate the system. Maintenance preserves safe recovery paths and in-flight receipts; it does not promise remote cancellation.

Pilot configuration, training acknowledgements, four-reviewer decisions and expansion evidence are synthetic rehearsal controls. Keep real patient access gated until the institutional owners accept the [release gates](10_Pilot-and-Release-Acceptance_v1.1.md). See [Support](SUPPORT-GUIDE.md) and [Data governance](DATA-GOVERNANCE.md).
