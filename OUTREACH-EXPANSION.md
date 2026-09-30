# Outreach and expansion operating notes

## Outreach workflow

1. In Outreach, select the care team and a responsible clinician or ASHA. Filter the authorised cohort by programme and open follow-ups if useful, explicitly select up to 30 people and record the selection or override rationale. Scheduling never decides eligibility or payment.
2. Review the draft and schedule it. Workers see only permitted patients; administrators have no patient or outreach-record access. Whole-plan actions require access to every item. Reassignment validates the new worker's current patient access and transfers open message follow-up responsibility.
3. Record attempts or cancellations with evidence. Mark completion only against a current confirmed visit created after the plan. A subsequent amendment or void flags the completion as stale. Reopen it for follow-up; the original events and visit remain in history.
4. Record contact preferences with evidence. Only synthetic `TEST-` identifiers are accepted. SMS simulation requires explicit permission, a personal phone, a non-private-contact-only preference, matching template language and permitted local hours. The initial UI defaults to in-person/private contact with no reminder permission.
5. An operations member proposes a neutral English/Hindi template; a different operations member approves it. A care member prepares a reminder, and a different clinician or supervisor reviews its preview. Template approval and per-message approval are separate.
6. Simulate a due approved reminder manually. No network request, timer or provider dispatch occurs. A failed simulation opens a named follow-up. Retrying keeps the same record/receipts, requires fresh review and stops after three attempts. A later successful simulation does not resolve follow-up or imply acknowledgement; resolution requires a separate recorded source.

Approvals expire after 24 hours. Identity, permission, contact, language, template, plan and authority changes block execution. Changes to contact preferences cancel pending messages. Revoked members and reassigned workers cannot replay receipts outside their current patient scope. Cancellation, permission withdrawal, template suspension and failure resolution remain available during maintenance.

Contact windows use an IANA patient time zone and exclude their end minute. Overnight windows are not supported. Scheduling is within 30 days, with at most five minutes of past tolerance. Duplicate suppression uses the scheduled UTC day, not the local day; cancelled records release that day. Outreach plan dates are UTC dates within 90 days. Reassessment is required before adapting these policies to a real service.

Bounds: 100 plans, 30 people per plan, 20 item events, 500 reminder records, two fixed language templates per organisation. These are guardrails for the current whole-organisation transactional storage, not validated production capacity or an archival policy. Plan version changes conservatively stale every pending approval in that plan.

## Expansion workflow

An operations member proposes a programme, AI provider, EHR or location. Record intended population, languages, jurisdiction, purpose, local differences, dependencies and rollback. Name an active operations owner and a different organisation-owner reviewer who is also different from the proposer.

Add references and findings for workflow, integration, population, legal, capacity and rollback. Every evidence entry is bound to the exact specification. Editing the scope preserves historical evidence but requires all six categories for the new specification. Review is bound to the current specification, evidence and membership versions. The application cannot verify whether an uploaded reference represents genuine external acceptance; the UI states this limit.

Configuration export contains only `format`, `schema` and `spec`. It has no patient-record collection, account assignments, credentials, evidence or approvals. Free-text proposal fields must still contain only non-sensitive configuration; this is not a content-redaction engine. Import uses a strict schema and selects fresh local accountable members. Proposal import does not create a care organisation or live deployment. Withdrawn proposals are immutable; export/import creates a separate draft. Limits: 100 proposals and 60 evidence entries per proposal.

The live-expansion endpoint always rejects activation. Genuine pilot exit, buyer/jurisdiction acceptance, provider contracts, live workflow/population validation, support capacity and approved rollback remain external prerequisites.

## BRD v1.1 mapping

Source: `Health-AI-Orchestration-Platform-BRD-v1.1.docx`, version 1, 56 pages, modified 26 September 2026. This is an incremental mapping for R9, not a complete 176-requirement acceptance matrix.

| Requirement | R9 evidence | Remaining boundary |
| --- | --- | --- |
| BR-CARE-06 | Contact method, ownership, language, timing, disclosure preference, permission and revocation tests | Field consent process, real shared-phone safety and language validation |
| BR-CARE-07 | Independent reminder review, simulator receipts, cancellation and owned failure follow-up | Actual approved SMS/IVR/messaging service, delivery evidence and inbound opt-out integration |
| BR-CARE-08 | Visit-linked completion, correction/void detection and retained cancellation history | Buyer-recognised activity evidence and operational validation; no payment promises |
| BR-REP-06 | Explicit cohort filters, recorded criteria and human selection/reassignment | Validated population planning and deployment-specific fairness/service-access review |
| BR-OPS-03 | Independent template/proposal review and stale-authority checks | Controlled live publishing/rollback and independent operational acceptance |
| BR-OPS-08 | Reusable strict configuration pack, local differences and fresh review after import | Actual deployment package, installation and cross-location acceptance |
| G7 expansion gate | Six evidence areas, named independent review and hard live-activation block | Accepted pilot exit and real buyer/jurisdiction/programme/provider/capacity evidence |

R0 simulation evidence cannot satisfy R1 live-integration or pilot gates. The prior release notes and Operations gate register retain those outstanding dependencies.
