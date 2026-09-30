# Original target design — 09_Operational-Runbooks_v1.0

Unchanged design content transcribed from the archived v1.0 Word file. This is a target specification, not an R11 implementation claim. See the [current index](../current/DOCUMENTATION-INDEX.md).

[Original editable file](../history/v1.0/09_Operational-Runbooks_v1.0.docx)

Operational Runbooks

Actionable procedures for support, integration uncertainty, safety response and continuity.

| Document | Baseline | Status |
| --- | --- | --- |
| HAO 09 · Version 1.0 | BRD v1.1 · 26 September 2026 | Proposed for review |

This document expands the existing BRD. Source requirements retain their priority and release labels. Architecture choices are proposals until the named owners accept them. Specified behaviour, implemented behaviour and executed evidence are separate statuses.

## Operating responsibilities

Each live deployment names an operations lead, integration on-call contact, clinical safety lead, privacy lead, identity steward and system-owner escalation contact. The workbook names roles only; production must bind them to real people and duty coverage. Support begins with redacted correlation IDs. Access to record content requires a separate time-bound grant with purpose, scope and approver.

| Priority | Trigger | Immediate ownership |
| --- | --- | --- |
| Critical | Suspected serious clinical harm, broad disclosure, wrong-person action or material data loss | Clinical or security incident lead plus operations; use approved urgent escalation |
| High | Core workflow unavailable, growing uncertain writes, widespread sync failure | Operations and relevant connector/mobile owner |
| Normal | Isolated recoverable failure with safe care continuity | Assigned support queue with monitored age |
| Service request | Configuration, access or training need | Institutional owner and standard approval workflow |

Actual response-time commitments follow the BRD targets and the deployment support contract. Alarm thresholds require a measured baseline and an owner; do not deploy unowned alerts or infer that an unacknowledged alarm is resolved.

## Monitoring and routine checks

| Signal | Interpretation | Action |
| --- | --- | --- |
| Oldest uncertain submission | Potential external side effect awaiting proof | Run RB01; escalate by destination and care impact |
| Queue age by destination and AI capability | Local backlog distinct from partner processing | Check workers, quotas, authority expiry and circuit state |
| Unable to assess and schema rejection rate | Quality or contract change, not disease prevalence | Review capability version and input conditions |
| Offline lease and pending sync age | Device exposure and untransmitted work | Contact support through redacted device case |
| Referral overdue state | Care may not have been completed | Assign approved programme escalation |
| Audit or outbox continuity gaps | Possible integrity or processing failure | Stop affected automation until consistency verified |
| Backup restore recency | Recoverability evidence may be stale | Schedule authorised isolated restoration exercise |
| Privileged access and export anomalies | Potential misuse or excess disclosure | Security and privacy review |

## Incident procedures

### RB01 Uncertain destination write

Trigger A submission times out or its worker dies after a possible send

Accountable role Integration on call

1. Stop automated resends for the logical action. Preserve source revisions, mapping, payload hash, attempt ID and correlation.

2. Look up the action using the destination-approved stable reference. Validate that the receipt matches person, action and payload.

3. If accepted, attach the verified receipt and mark accepted without another send. If definitively absent, recheck current authority and approval before queueing.

4. If neither can be proven, keep uncertain and assign the system owner or authorised operator. Show unresolved status to the worker.

Closure evidence Close only with verified acceptance, verified rejection or a documented unresolved disposition and owner. Do not use transport success as business acceptance.

### RB02 AI provider outage or drift

Trigger Timeout rate, malformed result or undeclared release change

Accountable role AI operations and governance

1. Open the provider-specific circuit and pause new affected calls. Keep ordinary capture and approved clinical pathways available.

2. Record manifest and provider release, request IDs, failure codes and budget reservations without exposing payloads.

3. Contact the contracted provider channel and establish failure scope. Do not substitute a different model without equivalent approved scope.

4. Reconcile in-flight requests and charges. Validate corrected contract and representative failures in the permitted environment.

5. Reactivate only after the incident owner and required clinical reviewer accept the evidence.

Closure evidence Attach incident, affected-request disposition, version proof and reactivation approval. No failed call may appear as a negative clinical result.

### RB03 Lost device or account compromise

Trigger Device loss, suspicious login or unauthorised access report

Accountable role Security and deployment support

1. Revoke sessions, device registration and future lease renewal; suspend affected credentials and notify the responsible institution.

2. Identify cached scope, lease expiry and server actions since the last trusted event. A disconnected device may remain readable until lock or expiry; record that limitation.

3. Use supported device-management controls where enrolled. Never rely on remote wipe as the only protection.

4. Restore workforce access through institutional verification on an approved device. Reconcile unsynced work through an authorised recovery process.

Closure evidence Record exposure assessment, patient-care continuity, credential rotation and recovered or unresolved work. Follow the approved notification obligations.

### RB04 Wrong patient identity link

Trigger Worker or destination reports a mislinked record

Accountable role Identity steward and clinical lead

1. Pause affected disclosures and flag disputed links without erasing evidence. Establish the two person contexts with authorised comparison data.

2. Enumerate observations, plans, AI calls, destination submissions and referrals using the disputed link.

3. Approve a superseding link correction and identify which records belong to each person. Do not auto-merge clinical histories.

4. Create owner-authorised external corrections for every accepted destination action and clinical review for any affected decision.

Closure evidence Close only after accountable owners accept person attribution and downstream repair or a recorded unresolved exception.

### RB05 Consent or authority revoked

Trigger Verified withdrawal, expiry or changed processing basis

Accountable role Privacy operations

1. Record the authoritative change with time and scope. Stop new affected disclosure and invalidate queued approvals.

2. Classify actions as not sent, in flight, accepted or uncertain. Cancel not-sent work; reconcile in-flight outcomes.

3. Apply recipient and retention processes according to the approved basis. Do not promise erasure of already accepted clinical records without a lawful custody decision.

4. Refresh device scopes at next contact and allow leases to enforce the defined offline limit.

Closure evidence Evidence shows blocked new disclosures, actual external effects and accountable retention or recipient actions.

### RB06 Clinical safety event

Trigger Suspected harm, near miss, misleading guidance or missed escalation

Accountable role Clinical safety lead

1. Use the established care escalation route immediately. Technical investigation must not delay clinical response.

2. Suspend the affected optional automation or pack where directed; preserve the last safe manual pathway.

3. Capture input revisions, provider/pack versions, user decisions and external receipts in a restricted safety case.

4. Find potentially affected cases and assign qualified follow-up. Assess human factors, protocol, data and model contributions.

5. Release corrective action after independent evidence review and communicate relevant changes to users.

Closure evidence Clinical owner accepts affected-case follow-up, residual risk, communication and release evidence. Avoid unreviewed causal claims.

### RB07 Offline sync backlog or storage pressure

Trigger Pending queue age, repeated conflict or insufficient device space

Accountable role Mobile support

1. Confirm whether each record is saved locally, accepted by the server or accepted by a destination. Preserve unacknowledged records.

2. Inspect redacted lease, sequence, dependency and storage diagnostics. Renew authority through the valid online workflow if allowed.

3. Resume bounded sync and review per-item results. Assign semantic conflicts to the correct reviewer; do not clear the queue to force success.

4. Remove only eligible acknowledged cache or completed uploads under policy. Recover interrupted media by digest-verified chunks.

Closure evidence Every acknowledged local record has a durable server receipt or a named unresolved recovery case; pending work is not silently discarded.

### RB08 Backup restore and regional outage

Trigger Loss of primary service or scheduled recovery exercise

Accountable role Reliability and custody owners

1. Declare incident scope and recovery objective; prevent unsafe concurrent writes. Record last confirmed event and backup/key versions.

2. Restore into an isolated environment with authorised keys and restricted egress. Verify tenant boundaries, revisions, audit, outbox and receipt consistency.

3. Reconcile external actions that may have completed after the restore point. Do not replay uncertain destination writes blindly.

4. Run critical synthetic journeys, verify current authorities and open care tasks, then obtain the accountable traffic-switch approval.

Closure evidence Capture actual recovery time and data-loss window against BRD NFRs, reconciliation results and custody checks before closing.

### RB09 Controlled release and rollback

Trigger Approved change or regression after deployment

Accountable role Release manager

1. Validate signed or otherwise authenticated build and configuration manifests, compatibility and test evidence. Keep the previous compatible release available.

2. Deploy to synthetic/test, then an approved limited cohort. Observe errors, uncertain queue age, clinical workflow failures and data integrity.

3. If a rollback trigger is reached, pause affected actions and restore compatible code/configuration. Preserve new records and versions.

4. Reconcile work accepted during the rollout and communicate any changed steps. Reopen gates if evidence or clinical scope changed.

Closure evidence Release record includes versions, approvals, monitored results, rollback decision and unresolved work ownership.

### RB10 Deployment exit and data handover

Trigger Contract end, programme closure or transfer of custody

Accountable role Buyer and privacy/custody owners

1. Agree authorised recipients, record scope, open care responsibilities and a final operating date. Freeze unneeded new integrations.

2. Export versioned records, provenance, receipts and unresolved work with counts, checksums and a readable manifest.

3. Verify receipt and usability with the new custodian. Keep urgent and open referrals assigned through the transition.

4. Revoke users, providers and secrets in the approved order. Apply retention, holds, backup expiry and deletion evidence.

Closure evidence Named custodian accepts the records and outstanding care/work queues; exit does not strand pending work or imply unjustified deletion.

## Support case minimum record

Record case ID, severity, affected tenant and environment, safe correlation IDs, observed behaviour, expected behaviour, first occurrence, source/build versions, containment, owner, next review time and evidence link. Never paste raw clinical narratives, media, tokens or patient identifiers into unrestricted support tools. A clinical complaint routes to the safety process even if it first arrives as a support ticket.

## Recovery drill schedule

Before G4, execute uncertain-write recovery, device loss, identity repair, authority withdrawal, clinical safety simulation, backup restore and rollback using the relevant test environment. Thereafter choose a risk-based recurring schedule with the buyer and operations lead, and repeat after material architecture, provider or custody changes. Record actual drill outcomes and remaining limitations; a tabletop discussion alone does not prove restore or data reconciliation.

## Sources and related artefacts

S01 BRD v1.1 Health-AI-Orchestration-Platform-BRD-v1.1.docx — Product source of authority; 176 requirements and 12 journeys

Companion workbook: Health-AI-Delivery-Control-Workbook-v1.0.xlsx. Machine-readable contracts and reference checks: engineering folder. Requirements and test IDs are stable across the pack. Open decisions remain in the Decisions sheet; no document changes their approval status.
