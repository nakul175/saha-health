# Administrator guide

Organisation ownership and membership role are separate. Owners manage membership and configuration, but their patient scope still follows their care role and teams. An administrator role has no patient-record or clinical-export access.

## Membership and teams

Use **Organisation & team** to create teams and issue invitations to the intended account code. Invitations are single-use, account-bound and expire after 72 hours. The application provides the code; it sends no email. Site audience access is an additional hosting setting and is not changed by an app invitation.

Review current versions when changing roles, teams, owner status or suspension. Last-active-owner protection prevents ordinary lockout. Before moving a worker's patients, use the supported handover workflow so open work has an eligible recipient. Completed actions and original receipts must remain unchanged. An inactive incident/safety owner requires accountable reassignment.

## Connections

Use **Connections** to inspect mode, readiness and supported mapping/capabilities. A registered HTTP endpoint is not an approved destination. Secure credential bindings, exact scoped grants, validation and explicit activation remain required. Keep unqualified connections suspended. Never paste a credential into a label, note, incident or repository file.

MIS mapping changes affect the reviewed payload version. EHR requires an explicit external patient link and scoped permission. A generic FHIR export does not provide ABHA or HIP/HIU functionality. Live partner acceptance must come from the selected system owner.

## Environment and exit

Every deployment declares `SAHA_ENVIRONMENT`: `synthetic` (the default when unset), `training`, `staging` or `production`; any other value is treated as misconfigured and refuses fixtures and live calls. Only synthetic and training seed the six synthetic people and the demonstration connectors. Outside synthetic, records marked as synthetic fixtures are never sent to a destination; outside synthetic and training, demonstration connectors cannot be activated or receive records. Owners use **Organisation & team → Environment and configuration** to see which settings are missing or unsafe; it names settings and their state and never shows a secret value. Live calls from production are refused in this build because outbound messages still carry a synthetic label (slice 6n).

Owners use **Organisation & team → Data export for exit or transfer** for a tar archive of the organisation's records, audit chain, media and hand-over list, with a manifest and checksums; patient records outside the owner's care teams are withheld and counted. Check a received archive with `node scripts/verify-export.mjs <file>` (slice 6m).

Opening a patient's history, visit media, received ABDM records, a FHIR download or a full record in a paged workspace is recorded in the audit chain and shown in the **Activity log** as record access (slice 6t); if Saha cannot write that record, the request is refused with a message and nothing is shown or sent. Owners and administrators can use **Activity log → Audit chain → Download head checkpoint** and keep the file outside Saha (for example in a ticket or a signed email); pasting it later into **Saved checkpoint** shows whether anything up to that point has changed.

Fixtures seeded before slice 6n are not marked as synthetic. Owners use **Organisation & team → Data migration: mark seeded fixtures** to run a dry run, apply exactly that plan with a reason, and reverse the batch if needed; a fixture whose name was changed is rejected for manual review (slice 2d).

## Governance and operations

R11 manifests carry immutable revisions, intended use, dates, owners and dependency references. Author, reviewer and activation rules require distinct eligible people where specified. Never impersonate a second account to obtain a review. A passed synthetic evaluation does not remove independent review or production evidence requirements.

Use **Operations** for service metadata, safe diagnostics, incidents and owner-controlled maintenance. Administrators cannot see clinical aggregates merely because they operate the system. Maintenance preserves safe recovery paths and in-flight receipts; it does not promise remote cancellation.

Pilot configuration, training acknowledgements, four-reviewer decisions and expansion evidence are synthetic rehearsal controls. Keep real patient access gated until the institutional owners accept the [release gates](10_Pilot-and-Release-Acceptance_v1.1.md). See [Support](SUPPORT-GUIDE.md) and [Data governance](DATA-GOVERNANCE.md).
