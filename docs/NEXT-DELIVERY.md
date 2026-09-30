# Next delivery

## Development-completion order (sponsor decision, 30 September 2026)

The sponsor chose to finish buildable product work before the partner track closes. Decisions taken: keep the encrypted browser field notebook and add native Android only if a buyer requires it; keep the current sign-in and hosting during development behind a swappable identity layer; start with the storage foundation. Each slice ships on its own branch and draft pull request; GitHub main is not updated.

| Slice | Scope | Status |
| --- | --- | --- |
| 0a | Load probe, linear diffing, patient-partitioned loads and per-patient commit guards | Delivered (see [slice 0a](current/SLICE-0A-STORAGE.md)) |
| 0b | Scoped command responses (partition deltas) merged by the workspace | Delivered (see [slice 0b](current/SLICE-0B-DELTAS.md)) |
| 0b-2 | Viewer-scoped workspace reads (ASHA reads independent of organisation size) | Delivered (see [slice 0b-2](current/SLICE-0B2-SCOPED-READS.md)) |
| 0b-3 | Paged patient lists and on-demand patient detail for large team scopes | Delivered (see [slice 0b-3](current/SLICE-0B3-PAGED-PATIENTS.md)) |
| 0c | Swappable identity layer, SBOM and audit gate, CI workflow, local test stability | Delivered (see [slice 0c](current/SLICE-0C-IDENTITY.md)) |
| 1 | Households and proxy authority with sensitive-class disclosure | Delivered (see [slice 1](current/SLICE-1-HOUSEHOLDS.md)) |
| 1b | Workforce lifecycle, bulk caseload transfer with effective dates and acknowledgement, responsibility gaps, member removal | Delivered (see [slice 1b](current/SLICE-1B-CASELOAD.md)) |
| 1c | Controlled identity merge and unmerge with a downstream impact queue | Delivered (see [slice 1c](current/SLICE-1C-MERGE.md)) |
| 1d | Workforce roster reconciliation: preview, apply exactly the preview, invite, update, suspend | Delivered (see [slice 1d](current/SLICE-1D-ROSTER.md)) |
| 1e | Time-limited delegation of team supervision to a clinician and of reporting-only access, with revocation, loss of effect when either party stops qualifying, server-side enforcement and audit of each use; service accounts documented as not supported by the identity model | Delivered (see [slice 1e](current/SLICE-1E-DELEGATION.md)) |
| 2a | Reuse, blocked reuse, repeated-entry and correction metering from stored visits | Delivered (see [slice 2a](current/SLICE-2A-REUSE.md)) |
| 2b | Visit photos and voice notes with type, signature, size and purpose checks, playback and draft deletion | Delivered (see [slice 2b](current/SLICE-2B-MEDIA.md)) |
| 2c | Source and observation time for each measurement, with missing reasons, in the visit screen, field notebook, FHIR exports and summaries | Delivered (see [slice 2c](current/SLICE-2C-FACT-PROVENANCE.md)) |
| 2 | Per-observation author and verification state, import dry runs | Planned |
| 3a | Encrypted offline photo and voice-note queue in the field notebook, uploaded after sync only when grant, access and draft are rechecked | Delivered (see [slice 3a](current/SLICE-3A-OFFLINE-MEDIA.md)) |
| 3b | Field notebook keep-data request, storage usage display and low-space pause on preparing visits and queueing media | Delivered (see [slice 3b](current/SLICE-3B-STORAGE-WARNINGS.md)) |
| 3c | Media queue hardening after independent review: confirmed-upload rule, lock safety, removal guard, orphan sweep | Delivered (see [slice 3c](current/SLICE-3C-QUEUE-HARDENING.md)) |
| 3d | In-app voice-note recording in the field notebook, 60 s and size-bounded, queued through the offline media path | Delivered (see [slice 3d](current/SLICE-3D-VOICE-RECORDING.md)) |
| 3e | On-device photo reduction to JPEG under 256 KB, dropping embedded location metadata | Delivered (see [slice 3e](current/SLICE-3E-PHOTO-REDUCTION.md)) |
| 3f | The same photo reduction in the online visit screen | Delivered (see [slice 3f](current/SLICE-3F-WORKSPACE-PHOTO-REDUCTION.md)) |
| 3g | Offline registration with an optional first visit and referral request, one-command creation, Sync all in dependency order, on-device duplicate review | Delivered (see [slice 3g](current/SLICE-3G-OFFLINE-REGISTRATION.md)) |
| 3h | Clinician action on field referral requests: referral created in one step or declined with a reason | Delivered (see [slice 3h](current/SLICE-3H-REFERRAL-REQUESTS.md)) |
| 3i | Open field referral request queue for clinicians, supervisors and owners in scope, with long waits raised in the exception queue | Delivered (see [slice 3i](current/SLICE-3I-REFERRAL-REQUEST-QUEUE.md)) |
| 3j | Field notebook capacity of 200 visit drafts; Sync all reads the workspace once per run | Delivered (see [slice 3j](current/SLICE-3J-NOTEBOOK-CAPACITY.md)) |
| 3 | 100 queued media items within an approved storage allowance, per-record notebook storage, batch preparation | Planned |
| 4a | Referral lifecycle states, urgency, reasoned delay and escalation queue | Delivered (see [slice 4a](current/SLICE-4A-REFERRALS.md)) |
| 4b | Per-patient action plan across follow-ups, referrals, protocol reviews, safety cases and outreach, with ownership gaps, take-ownership and steward reassignment | Delivered (see [slice 4b](current/SLICE-4B-ACTION-PLAN.md)) |
| 4c | Per-worker activity evidence for supervisors: performed, claimed, verified and submitted activity derived from visits, outreach and receipts, with corrections traceable and no location | Delivered (see [slice 4c](current/SLICE-4C-WORKER-ACTIVITY.md)) |
| 4 | Multi-programme referrals with several source links, action dependencies, pack migration and installation | Planned |
| 5a | Monthly USD cost budgets per AI capability from recorded rates (estimates, not invoices), refusal before preparing or sending, budget use on Operations, care-team stop of unsent requests | Delivered (see [slice 5a](current/SLICE-5A-AI-BUDGETS.md)) |
| 5b | Provider sandbox organisations with a provider-only role for documentation, credential references, proposals and synthetic evaluations; owner import into the standard production review path | Delivered (see [slice 5b](current/SLICE-5B-PROVIDER-SANDBOX.md)) |
| 5c | Explicit unable-to-assess outcome (noisy, unsupported, insufficient input) with no values; conflicts with recorded facts and between open assistant results flagged, listed in the action plan and applied only by explicit choice with a reason | Delivered (see [slice 5c](current/SLICE-5C-CONFLICTS-QUALITY.md)) |
| 5d | Capability lifecycle stages in BRD terms, replacement recorded on activation, use counted per exact version, and in-progress work of a suspended, retired or replaced capability identified with its required action | Delivered (see [slice 5d](current/SLICE-5D-CAPABILITY-LIFECYCLE.md)) |
| 5e | Task time and attempt limits in the capability manifest (a timed-out sent request becomes uncertain, needs a recorded human decision and is never retried; attempts beyond the limit refused), and owner-owned alerts at 80% and 100% of an AI capability's estimated monthly budget | Delivered (see [slice 5e](current/SLICE-5E-TASK-LIMITS-BUDGET-ALERTS.md)) |
| 5f | Shadow operation of a reviewed capability revision for teams or the whole organisation over a bounded period: runs on confirmed visits (local rules provider only), outputs stored for governance only and never shown, applied or planned; consent, restriction, budget and lifecycle respected; per-field agreement, disagreement, missing and unable-to-assess counts for managers | Delivered (see [slice 5f](current/SLICE-5F-SHADOW-OPERATION.md)) |
| 5 | Task time and retry limits, invoice reconciliation, budget alerts, shadow operation, multi-provider history, drift monitoring, isolated provider environment | Planned |
| 6a | Exceptional (break-glass) access with restricted actions and independent review | Delivered (see [slice 6a](current/SLICE-6A-EXCEPTIONAL-ACCESS.md)) |
| 6b | Rights and grievance requests with destination notification and processing restriction | Delivered (see [slice 6b](current/SLICE-6B-RIGHTS.md)) |
| 6o | Consent withdrawal that stops queued deliveries, unexecuted plans, EHR permissions and publications, ABDM mock consents, unsent AI requests and reminders, lists what was already sent, and keeps a consent history on the patient | Delivered (see [slice 6o](current/SLICE-6O-CONSENT-WITHDRAWAL.md)) |
| 6c | Retention schedules, legal holds and disposal-eligibility review (no deletion) | Delivered (see [slice 6c](current/SLICE-6C-RETENTION.md)) |
| 6d | Versioned indicator catalogue, cohort protection, small-cell suppression and governed question interpretation | Delivered (see [slice 6d](current/SLICE-6D-INDICATORS.md)) |
| 6e | Repeatable axe-core WCAG A/AA audit over 16 owner and ASHA screens; colour-contrast failures fixed | Delivered (see [slice 6e](current/SLICE-6E-ACCESSIBILITY.md)) |
| 6f | Audit extended to the field notebook, Hindi and a phone viewport; keyboard focus walk; focus-visible fixes | Delivered (see [slice 6f](current/SLICE-6F-FIELD-ACCESSIBILITY.md)) |
| 6g | Computed operational alerts with owners, actions and viewer scope on the Operations page | Delivered (see [slice 6g](current/SLICE-6G-ALERTS.md)) |
| 6h | Alert acknowledgement by the owning role, count-bound and at most 24 hours | Delivered (see [slice 6h](current/SLICE-6H-ALERT-ACKNOWLEDGEMENT.md)) |
| 6i | Item-level exception queue on the Operations page with owner, age, recovery action and a link to the patient or visit | Delivered (see [slice 6i](current/SLICE-6I-EXCEPTION-QUEUE.md)) |
| 6k | Operational CSV export identifies definition, export, exporter and teams, with control totals and a row-count and SHA-256 manifest | Delivered (see [slice 6k](current/SLICE-6K-RECONCILED-EXPORTS.md)) |
| 6l | End-to-end safe-logs check over metrics, console and support exports; static console and URL review; media removal reasons and indicator questions moved out of URLs | Delivered (see [slice 6l](current/SLICE-6L-SAFE-LOGS.md)) |
| 6m | Owner-only organisation data export: every organisation table as JSONL in a tar archive with manifest, SHA256SUMS, media, audit chain, hand-over list of unresolved external actions and owned patient tasks, optional FHIR documents; offline verifier `scripts/verify-export.mjs` | Delivered (see [slice 6m](current/SLICE-6M-DATA-EXIT.md)) |
| 6n | Declared environment (`SAHA_ENVIRONMENT`) with fixture seeding, live-call, demonstration-connector and synthetic-record guards; environment banner; owner-only read-only configuration check without secret values | Delivered (see [slice 6n](current/SLICE-6N-ENVIRONMENTS.md)) |
| 2d | Controlled migration `mark-seeded-fixtures-v1`: owner dry run with counts, rejects and a version-bound plan hash; apply of that exact plan with per-record revisions and a counted audit batch; batch reversal | Delivered (see [slice 2d](current/SLICE-2D-FIXTURE-MIGRATION.md)) |
| 6j | Per-organisation SHA-256 audit chain with genesis seal, owner/administrator verification and a recorded auditor export | Delivered (see [slice 6j](current/SLICE-6J-AUDIT-CHAIN.md)) |
| 6 | Restore-safe disposal, owner-maintained indicator registry, alert delivery, full Hindi UI, screen-reader, zoom and user accessibility review | Planned |
| 7a | ABDM module readiness, ABHA link/decline/unlink and consent artefacts with enforcement, against a local mock gateway | Delivered (see [slice 7a](current/SLICE-7A-ABDM-MOCK.md)) |
| 7b | Care-context linking, encrypted consent-bound transfer and received-record review against the mock gateway | Delivered (see [slice 7b](current/SLICE-7B-ABDM-TRANSFER.md)) |
| 7c | Pinned, versioned outbound FHIR structural rule set on EHR publication and mock ABDM transfer, with a regression corpus | Delivered (see [slice 7c](current/SLICE-7C-OUTBOUND-VALIDATION.md)) |
| 7 | Real gateway integration to the published specification, partner HIPs and NRCeS profile validation | Planned |
| 8 | Programme and EHR adapters once partner specifications arrive | Blocked on partners |

The external dependencies below are unchanged by this order; slices do not pass any acceptance gate.


The next planned engineering batch is R12. R11 still has open live-provider and clinical follow-through. Five future batches remain planned, R12–R16; this is not a guarantee of production completion. Preserve the exact [176-requirement ledger](../REQUIREMENTS-TRACEABILITY.md) and [remaining release plan](../REMAINING-RELEASES.md).

## First coding slice

Start R12 with a partner onboarding and acceptance dossier around the existing MIS and EHR adapters. Do not replace the tested receipt/checkpoint code or invent a new universal connector. The slice should make one destination's contract, mapping version, test results, responsible owner and unresolved acceptance explicit, then repeat independently for the second programme destination and selected EHR route.

This is a proposed implementation slice derived from the existing R12 plan, not an approved partner contract or a new commitment to a vendor.

1. Select exact R12 requirement rows from `requirements/assessment.tsv`. Preserve their source text and acceptance criteria. Record which clauses this slice addresses and which remain open.
2. Review `MIS-API.md`, `EHR-ABDM.md`, `lib/saha/mis*.ts`, `lib/saha/ehr*.ts`, the execution/checkpoint tests and the corresponding UI panels. Extend their current gates and version model.
3. Define a version-bound dossier for contract, field semantics, units/missingness, endpoint/environment, credentials binding name, receipt lookup, correction protocol, ownership and evidence. Store references, never secrets or real patient payloads.
4. Locally exercise acceptance, rejection, uncertain write, receipt-only lookup, proven absence then same-key retry, stale mapping, revoked permission, concurrent approval, interrupted final save and linked correction. Preserve earlier accepted receipts.
5. Use approved sandbox credentials only after the system owner supplies the exact contract and authorization. Keep live acceptance blocked when that evidence is unavailable. Mock transport is not partner acceptance.
6. Update the ledger, current contracts, release notes and qualification with exact results. Publish the batch on a new branch and draft PR from the latest release. Deploy only as part of an authorized Site task.

## External inputs still required

| Work | Required input | Completion evidence |
| --- | --- | --- |
| R11 provider follow-through | Approved provider terms, secret binding, intended use, clinical owners and representative annotated data | Live contract results; language/population-specific evaluation; independent clinical decision |
| R12 programme and EHR integration | Two independent programme owners and selected EHR owner; sandbox endpoints, mappings, receipt and correction contracts | Separate accepted/rejected/uncertain/correction evidence per destination and named partner acceptance |
| R13 ABDM | Authorized module/role onboarding, exact profiles and sandbox credentials | ABHA, HIP/HIU and scoped consent/exchange evidence; identity reconciliation |
| R14 field and messaging | Authorized channel/templates, device matrix, reviewed translations, household/proxy decisions | Real opt-out recovery, disconnected device and speech tests, relationship authority |
| R15 production controls | Custody/retention policies, qualified reviewers, representative workload and hosted recovery scope | Independent security/accessibility review, measured load/soak and authorized restore/cutover |
| R16 field acceptance | Approved study scope, trained participants, accountable reviewers and baseline | Outcomes including failures/exclusions, remediation and signed requirement decisions |

Do not close an older gap merely because a later engineering release exists. Identity, consent, sensitive-data segmentation, programme semantics and scale risks cut across these batches. See each row's remaining-work statement.
