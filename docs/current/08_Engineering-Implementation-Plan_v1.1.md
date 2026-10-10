# Current engineering sequence 10 October 2026

The current source is main 7668a03d97c1ae62174f09e65ccd5a5717120be6. D02 is a historically delivered isolated gate; freshly resolve D01 impact for the sole existing D03 candidate, then finish its unchanged A1–A10. See [the coding entry](engineering-handoff/START-HERE.md). Continue one bounded implementation at a time; prepare D04/D05 contracts without prematurely dispatching them.

The original eleven product work packages, R1/R2/CWO product goals, historical R11–R16 engineering batches and D01–D08 queue are distinct. The R12-first and stacked-PR wording below describes the older engineering plan and does not supersede the current D01→D03 sequence. GitHub publication, qualified isolated merge and observed hosting are separate evidence events; the current staging topology is documented in [HOSTED-STAGING.md](HOSTED-STAGING.md).

# Engineering implementation plan

Continue from R11 / v1.3-readiness and the [next-delivery slice](../NEXT-DELIVERY.md). The original eleven work packages and 176 backlog items remain in the [target plan](../reference/08_Engineering-Implementation-Plan_v1.0.md) and preserved workbook exports. Their original business phases are distinct from engineering releases.

| Current sequence | Scope | Status |
| --- | --- | --- |
| R1–R6 | Identity, programme records, evidence assistant, programme/EHR adapters and field continuity | Bounded local foundations; original live/device acceptance remains open |
| R7–R10 | Operations/recovery, rehearsal, outreach/expansion and requirements/continuity | Bounded local controls with external and field gates open |
| R11 | Clinical content/capability governance, synthetic evaluation and safety ownership | Local framework delivered; live provider and clinical follow-through open |
| R12 | Real programme/EHR integration and workflow/data semantics | Planned next batch |
| R13 | ABHA, HIP/HIU and scoped ABDM exchange | Planned |
| R14 | Messaging, relationships, disconnected capture, media/language | Planned |
| R15 | Privacy/rights, independent security/accessibility, scale and hosted recovery | Planned |
| R16 | Representative pilot, remediation, acceptance and controlled expansion | Planned |

## Definition of ready

Select exact requirement clauses, describe the current gap, identify affected authority/state/persistence boundaries and define evidence before coding. For partner work, obtain the approved environment, contract, owner, mapping and receipt semantics. When inputs are missing, define the local scaffold and record the external blocker; do not simulate a sign-off.

## Definition of done for a development slice

The intended bounded behavior exists; affected negative/recovery paths pass; applied migrations and historical evidence remain intact; user-visible states distinguish durable/local/external outcomes; source and documentation agree; changed requirement assessments describe the remaining gap; the commit and draft PR are published and verified. A development slice can be done while the associated business acceptance remains pending.

## Review and handover

Use `CLAUDE.md` and `AGENTS.md`. Review the remote branch before publication, preserve concurrent work and never force-push. Keep release PR stacking explicit because GitHub main is older than R11. GitHub publication does not deploy the Site.

The maintained ledger is `requirements/assessment.tsv` plus the evidence map and immutable extracted BRD source. Regenerate traceability, then run its consistency check. Update the current API/data/UI inventories when their sources change and rerun documentation integrity. Do not alter saved historical results solely to make a new summary look current.

Owners in historical work packages are responsibility roles, not assigned people. A real delivery plan must name accountable individuals and dates when those commitments are made. This handover invents neither.
