# Current documentation index

Edition 1.1 reconciles application R11 to BRD v1.1. Read [Implementation](../IMPLEMENTATION.md), [Next delivery](../NEXT-DELIVERY.md) and [Qualification](../QUALIFICATION.md) first. All current documents describe synthetic engineering scope; formal acceptance remains pending.

| Document | Purpose |
| --- | --- |
| [Development slice 10h](SLICE-10H-READ-AUDIT-COMPLETION.md) | Audit of the remaining read paths: workspace loads, record opens, searches, list pages and aggregate views as chained fail-closed events, with membership role, version and delegated authority on every access event |
| [Development slice 10c](SLICE-10C-INCENTIVE-CLAIMS.md) | Worker incentive claims on a synthetic placeholder schedule: ASHA claim from her own confirmed activity, supervisor verification, owner approval, immutable hash-chained record, linked corrections, CSV (no payment) |
| [Development slice 10d](SLICE-10D-WORKFORCE-IMPORT.md) | Workforce roster import from a CSV file for owners: dry run with plan hash, rejection report and apply of exactly the previewed plan (slice 1d rules reused; BR-ID-01 stays partial) |
| [Development slice 10f](SLICE-10F-HOUSEHOLD-SCHEDULING.md) | Household visit plan and visit slots (per-member scope, no free text, due dates and completion conditions unchanged, late items shown) and one referral for programme episodes that raise the same need, with every asking pack linked and recorded |
| [Development slice 10b](SLICE-10B-NOTIFICATION-CHANNEL.md) | Out-of-app notification channel: owner-managed recipient tiers, escalation of unacknowledged alerts, demonstration simulator only (synthetic and training environments; no address or number contacted), message log with receipts and audit |
| [Development slice 10a](SLICE-10A-SCHEDULED-TRIGGER.md) | Scheduled trigger (Cron) foundation: due caseload transfers, review marks on requests past their time limit and alert evaluation every five minutes in the hosted configuration |
| [Development slice 10k](SLICE-10K-COMBINED-REVIEW-FIXES.md) | Fixes from the independent review of the combined slices 10a–10j: the operations view returns an allow-list (no incentive claims or patient ids), simulated messages exported per member, two panels marked English in the Hindi workspace, HTTP suite restarts the local Worker between module groups; open findings listed |
| [Testing Saha](TESTING.md) | The testing ecosystem: static, unit, integration, resilience, smoke, UI, non-functional, functional coverage, UAT and regression layers; what each proves, how to run it, when it runs on GitHub |
| [UAT plan and scripts](../testing/uat/UAT-PLAN.md) and [coverage map](../testing/COVERAGE.md) | User acceptance testing on the hosted synthetic site (generated from the acceptance catalogue) and requirement-to-test coverage (generated) |
| [Development slice 11a](SLICE-11A-TEST-RUNNER.md) | Unified test runner, suite catalogue, regression guard and tiered CI |
| [Development slice 11b](SLICE-11B-SMOKE.md) | Local smoke and post-deploy hosted smoke |
| [Development slice 11c](SLICE-11C-UI-E2E.md) | Browser end-to-end journeys, screenshot regression and accessibility (Playwright) |
| [Development slice 11d](SLICE-11D-NON-FUNCTIONAL.md) | Authorisation matrix, identity hardening, performance budgets, memory growth, load burst |
| [Development slice 11e](SLICE-11E-UAT-COVERAGE.md) | UAT pack, results register and validator, functional coverage map |
| [Development slice 11f](SLICE-11F-TESTING-INTEGRATION.md) | Integration of round 11, provider calls fixed for the Workers runtime, CI wiring, open findings |
| [Development slice 11g](SLICE-11G-TEST-REVIEW-FIXES.md) | Fixes from an independent review of the round-11 test code: guard over every layer, documentation-only checks, stricter counting |
| [Development slice 9a](SLICE-9A-DEMONSTRATION-CLINICAL-PACKAGE.md) | Demonstration clinical package for synthetic organisations (two cited demonstration protocols, not clinically approved) |
| [Development slice 10j](SLICE-10J-HINDI-WORKSPACE.md) | Hindi (draft translation) for the ASHA journey in the workspace: message catalogue, per-member language choice, notice on every Hindi screen; not reviewed by a qualified translator |
| [Development slice 9b](SLICE-9B-DEMONSTRATION-SCREENS.md) | Screens ready for a presenter-led demonstration: menu by role, visit first, member names, no build labels |
| [Development slice 10e](SLICE-10E-IDENTIFIER-SEARCH.md) | Issuer-identifier search within the care scope, ABHA number format checks (no checksum found) and programme identity crosswalks with provenance |
| [Development slice 6ae](SLICE-6AE-HELD-TRANSFER-ATOMICITY.md) | Automatic caseload transfers applied all-or-nothing (tenth independent review) |
| [Remaining work estimate](REMAINING-WORK-ESTIMATE.md) | Share of development done on 2 October 2026: requirement classes by who can close them, and remaining buildable slices (estimate, not acceptance) |
| [Hosted synthetic staging](HOSTED-STAGING.md) | Cloudflare Worker, D1 and Access hosting of the synthetic workspace; deploy on merge into main; limits |
| [Development slice 2b](SLICE-2B-MEDIA.md) | Visit photos and voice notes with checks, playback and draft deletion |
| [Development slice 6e](SLICE-6E-ACCESSIBILITY.md) | Automated WCAG A/AA audit of 16 screens and contrast fixes |
| [Development slice 3a](SLICE-3A-OFFLINE-MEDIA.md) | Encrypted offline photo and voice-note queue with recheck before upload |
| [Development slice 3b](SLICE-3B-STORAGE-WARNINGS.md) | Field notebook storage usage, keep-data request and low-space pause |
| [Development slice 7c](SLICE-7C-OUTBOUND-VALIDATION.md) | Pinned outbound FHIR structural validation and regression corpus |
| [Development slice 6f](SLICE-6F-FIELD-ACCESSIBILITY.md) | Field notebook, phone and keyboard focus accessibility |
| [Development slice 6x](SLICE-6X-POPULATED-ACCESSIBILITY.md) | Accessibility of populated panels, empty and error states, dialog focus traps and focus return, Tab order and live regions |
| [Development slice 6g](SLICE-6G-ALERTS.md) | Computed operational alerts with owners and next actions |
| [Development slice 3c](SLICE-3C-QUEUE-HARDENING.md) | Media queue hardening after independent review |
| [Development slice 6h](SLICE-6H-ALERT-ACKNOWLEDGEMENT.md) | Alert acknowledgement by the owning role |
| [Development slice 3d](SLICE-3D-VOICE-RECORDING.md) | In-app voice-note recording in the field notebook |
| [Development slice 3e](SLICE-3E-PHOTO-REDUCTION.md) | On-device photo reduction and metadata removal |
| [Development slice 3f](SLICE-3F-WORKSPACE-PHOTO-REDUCTION.md) | Photo reduction in the online visit screen |
| [Development slice 3g](SLICE-3G-OFFLINE-REGISTRATION.md) | Offline registration with ordered sync |
| [Development slice 2c](SLICE-2C-FACT-PROVENANCE.md) | Source and time for each fact |
| [Development slice 3h](SLICE-3H-REFERRAL-REQUESTS.md) | Clinician action on field referral requests |
| [Development slice 4b](SLICE-4B-ACTION-PLAN.md) | Per-patient action plan with ownership gaps and assignment |
| [Development slice 6i](SLICE-6I-EXCEPTION-QUEUE.md) | Item-level exception queue with links to the patient or visit |
| [Development slice 6k](SLICE-6K-RECONCILED-EXPORTS.md) | Reconciled operational export with control totals and checksum manifest |
| [Development slice 6j](SLICE-6J-AUDIT-CHAIN.md) | Tamper-evident audit chain, verification and auditor export |
| [Development slice 5a](SLICE-5A-AI-BUDGETS.md) | AI capability cost budgets and stopping unsent requests |
| [Development slice 5b](SLICE-5B-PROVIDER-SANDBOX.md) | Provider self-service in a provider sandbox and import into production review |
| [Development slice 5c](SLICE-5C-CONFLICTS-QUALITY.md) | Conflicting assistant values and inability to assess |
| [Development slice 5g](SLICE-5G-PROVIDER-HISTORY.md) | Provider and model history per capability |
| [Development slice 5h](SLICE-5H-INVOICE-RECONCILIATION.md) | AI invoice reconciliation against Saha's estimates |
| [Development slice 5i](SLICE-5I-DRIFT-MONITORING.md) | Drift monitoring from shadow comparisons |
| [Development slice 5f](SLICE-5F-SHADOW-OPERATION.md) | Shadow operation of a reviewed capability revision and its per-field comparison |
| [Development slice 5e](SLICE-5E-TASK-LIMITS-BUDGET-ALERTS.md) | Task time and attempt limits, uncertain timed-out requests, AI budget alerts |
| [Development slice 5d](SLICE-5D-CAPABILITY-LIFECYCLE.md) | Capability lifecycle, replacement and in-progress work |
| [Development slice 6l](SLICE-6L-SAFE-LOGS.md) | Safe-logs check and free text removed from request URLs |
| [Development slice 6m](SLICE-6M-DATA-EXIT.md) | Organisation data export for exit or transfer, with offline verification |
| [Development slice 6n](SLICE-6N-ENVIRONMENTS.md) | Declared environments, their guards and the owner configuration check |
| [Development slice 2d](SLICE-2D-FIXTURE-MIGRATION.md) | Controlled migration marking earlier seeded fixtures, with dry run and reversal |
| [Development slice 6o](SLICE-6O-CONSENT-WITHDRAWAL.md) | Consent withdrawal, downstream dispositions and consent history |
| [Development slice 1e](SLICE-1E-DELEGATION.md) | Time-limited delegation of team supervision and reporting-only access |
| [Development slice 1f](SLICE-1F-EFFECTIVE-TRANSFERS.md) | Scheduled caseload transfers applied automatically at their effective time on the next use, with re-checks, exactly-once commits and a held state, and whole-household transfer |
| [Development slice 4c](SLICE-4C-WORKER-ACTIVITY.md) | Worker activity evidence for supervisors |
| [Development slice 4d](SLICE-4D-ACTION-DEPENDENCIES.md) | Action dependencies and referrals with several sources |
| [SAHA-103 local coding evidence](SAHA-103-UNIFIED-ACTION-PLAN.md) | Exact unified-action equivalence, derived blockers and separate delivery gates |
| [Development slice 4e](SLICE-4E-PACK-MIGRATION.md) | Reviewed migration of open programme episodes to a new pack version |
| [Development slice 4f](SLICE-4F-PACK-INSTALLATION.md) | Governed installation of a programme pack or a new pack version (not clinically approved content) |
| [Development slice 2e](SLICE-2E-OBSERVATION-VERIFICATION.md) | Author and clinician verification for each measurement |
| [Development slice 2g](SLICE-2G-NOTE-ANSWER-SIGNOFF.md) | Author and clinician verification for visit notes and programme answers; optional supervisor sign-off before programme submissions are sent |
| [Development slice 10g](SLICE-10G-DISPUTES-SIGNOFF.md) | Disputes on a confirmed fact or answer that block programme and EHR sending until a clinician resolves them, sign-off rules per programme and per destination, supervisor sign-off withdrawal; checks repeated inside the execution checkpoint |
| [Development slice 2h](SLICE-2H-ENROLMENT-IDENTIFIER-IMPORT.md) | Controlled import of programme enrolments and external identifiers for existing people, and a downloadable rejection report for import dry runs |
| [Development slice 10i](SLICE-10I-VISIT-IMPORT.md) | Controlled import of historical visits with clinical content (owners and clinicians), imported visits as read-only history with source lineage |
| [Development slice 2f](SLICE-2F-IMPORT-DRY-RUN.md) | Controlled patient import with a dry run |
| [Development slice 6p](SLICE-6P-REVIEW-FIXES.md) | Fixes for defects found by an independent review of slices 6m, 6j/6k, 2d, 5b and 1e |
| [Development slice 6q](SLICE-6Q-SECOND-REVIEW-FIXES.md) | Fixes for defects found by a second independent review of slices 5f, 0b-3, 2f and 6p |
| [Development slice 6r](SLICE-6R-MAIN-REVIEW-FIXES.md) | Fixes for defects found by a third independent review of slices already merged into main (1, 1c, 6a, 6b, 6c, 7a, 7b) |
| [Development slice 6s](SLICE-6S-INDICATOR-REGISTRY.md) | Owner-maintained indicator registry, reproduction by version and differencing protection |
| [Development slice 6t](SLICE-6T-ACCESS-AUDIT.md) | Audit of material reads and external requests in the audit chain; reads, commands, exports and external requests refused when the audit cannot be written; chain-head checkpoint for external anchoring |
| [Development slice 6u](SLICE-6U-FOURTH-REVIEW-FIXES.md) | Fixes for defects found by a fourth independent review of code already on main (1c, 6a, 6b, 6c, 6m, 6p, 6r, 7a, EHR publication, programme callback, pilot and expansion exports) |
| [Development slice 6v](SLICE-6V-ALERT-DELIVERY.md) | In-app alert delivery to owning roles with a top-bar bell, acknowledgement clearing, once-only escalation to owners inside the organisation, evaluated idempotently on reads and organisation-wide writes |
| [Development slice 6w](SLICE-6W-FIFTH-REVIEW-FIXES.md) | Fixes for defects found by a fifth independent review of slices 0b-4, 4e, 6s and 6t (indicator differencing and ledger, migration dry-run scope, data exit, paged window audit, checkpoints, work-list cursor) |
| [Development slice 7d](SLICE-7D-REPLAY-SOAK.md) | Replay and timeout soak of programme and EHR delivery, and local adapter overhead benchmark |
| [Development slice 6y](SLICE-6Y-TASK-TRACE.md) | Read-only trace from user commands to execution checkpoints, provider or destination receipts and audit events for a visit, submission or EHR publication, with correlation references on new execution steps |
| [Development slice 6z](SLICE-6Z-SIXTH-REVIEW-FIXES.md) | Fixes for defects found by a sixth independent review of slices 6u, 4f, 6v and 2g (prototype-named question ids, per-recipient alert acknowledgement, guarded escalation inserts, legacy-visit authors, ABHA refusal, alert notifications in data exit) |
| [Development slice 6aa](SLICE-6AA-SEVENTH-REVIEW-FIXES.md) | Fixes for defects found by a seventh independent review of slices 6w, 2h and 6y (population-based differencing check, window in release identity, stated residual risk and property test, size-bounded ledger, audited unpaged reads, issuer allowlist, rejection report access audit, redacted trace receipts, newest-first trace look-ups). |
| [Development slice 6ab](SLICE-6AB-EIGHTH-REVIEW-FIXES.md) | Fixes for defects found by an eighth independent review of slices 6z, 7e, 2i and 7d and the round-5 integration limit (unusual-value self-confirmation, bounded ABHA duplicate oracle, demonstration corrections as updates, consent and EHR patient-read governance, stricter replay soak, assistant summary input, aggregate population check). |
| [Development slice 6ad](SLICE-6AD-NINTH-REVIEW-FIXES.md) | Fixes for defects found by a ninth independent review of the round-5 slices, mainly 7g aggregate delivery (report cells never shown to people, window end recorded for past periods, bounded report storage, open-report limit and expiry, late answers kept, lookup in maintenance). |
| [Development slice 6ac](SLICE-6AC-REPORTING-FRESHNESS.md) | Source freshness and late arrivals beside indicator results: per-team latest record, banded arrivals and late arrivals for online visits, field syncs, imports and programme receipts, a data-still-syncing warning, and late visits since the viewer's previous release; no new differencing channel |
| [Development slice 7e](SLICE-7E-ADAPTER-OPERATIONS.md) | Separate operation permissions (create, update, delete or void, lookup, aggregate) for every record adapter, aggregate-only destinations, refusals on the trace and exception queue |
| [Development slice 7g](SLICE-7G-AGGREGATE-DELIVERY.md) | Aggregate report delivery to aggregate-only demonstration destinations: approval by a different person, suppressed cells with a manifest and SHA-256, payload minimisation check, release recorded for the destination, receipts and lookup |
| [Development slice 2i](SLICE-2I-VALUE-OVERRIDES.md) | Units (lb, °F, weeks) converted on the server with the entered value kept, versioned placeholder ranges (not clinically approved), recorder reasons for unusual values and clinician confirmation beyond the wider range, appended and audited overrides, notebook mirror, FHIR note text under the unchanged rule set |
| [Development slice 7f](SLICE-7F-EHR-RESOLUTION.md) | Per-connection EHR receipt-lookup policy: authoritative identifier search with consistency delay, not-stored and conflict outcomes, named reconciliation owner, audited and limited lookups, soak comparison |
| [Development slice 2j](SLICE-2J-CORRECTION-PROPAGATION.md) | Correction propagation: one owned task per downstream output of an amended or voided visit, the destination's correction through the normal path where supported, manual correction with evidence otherwise, shown in the action plan and exception queue, closed with a verified receipt or a reason |
| [Development slice 7b](SLICE-7B-ABDM-TRANSFER.md) | Care contexts, encrypted consent-bound transfer and received-record review (mock gateway) |
| [Development slice 7a](SLICE-7A-ABDM-MOCK.md) | ABDM module readiness, ABHA workflows and consent artefacts against a local mock gateway |
| [Development slice 1d](SLICE-1D-ROSTER.md) | Workforce roster preview and apply |
| [Development slice 2a](SLICE-2A-REUSE.md) | Reproducible reuse, blocked reuse, repeated-entry and correction metering |
| [Development slice 4a](SLICE-4A-REFERRALS.md) | Referral lifecycle, urgency, reasoned delay and escalation queue |
| [Development slice 6d](SLICE-6D-INDICATORS.md) | Indicator catalogue, small-cell suppression and governed questions |
| [Development slice 6c](SLICE-6C-RETENTION.md) | Retention schedules, legal holds and eligibility review without deletion |
| [Development slice 0b-2](SLICE-0B2-SCOPED-READS.md) | Viewer-scoped workspace reads and ASHA read measurements |
| [Development slice 0b-3](SLICE-0B3-PAGED-PATIENTS.md) | Paged patient lists, on-demand patient detail and supervisor read measurements |
| [Development slice 0b-4](SLICE-0B4-SERVER-WORKLISTS.md) | Server-side work lists (My work, follow-ups, referrals, Submissions) for paged workspaces |
| [Development slice 3i](SLICE-3I-REFERRAL-REQUEST-QUEUE.md) | Open field referral request queue and long-wait exceptions |
| [Development slice 3k](SLICE-3K-NOTEBOOK-MEDIA-CAPACITY.md) | Field notebook at 200 visit drafts plus 100 photos and voice notes: media budget, exhaustion, restart mid-sync, throttled timing |
| [Development slice 3j](SLICE-3J-NOTEBOOK-CAPACITY.md) | Field notebook capacity of 200 visit drafts |
| [Development slice 6b](SLICE-6B-RIGHTS.md) | Rights and grievance requests, destination notification and processing restriction |
| [Development slice 6a](SLICE-6A-EXCEPTIONAL-ACCESS.md) | Time-limited emergency access with restricted actions and independent review |
| [Development slice 1c](SLICE-1C-MERGE.md) | Two-person identity merge, impact queue and unmerge |
| [Development slice 1b](SLICE-1B-CASELOAD.md) | Workforce lifecycle, bulk caseload transfer, responsibility gaps and member removal |
| [Development slice 1](SLICE-1-HOUSEHOLDS.md) | Households, proxy authority and sensitive-class disclosure |
| [Development slice 0c](SLICE-0C-IDENTITY.md) | Identity provider layer, SBOM and audit gate, CI workflow |
| [Development slice 0b](SLICE-0B-DELTAS.md) | Partition delta responses, client merge and evidence |
| [Development slice 0a](SLICE-0A-STORAGE.md) | Patient-partitioned storage, commit guards, load-probe evidence and limits |
| [BRD implementation record](BRD-IMPLEMENTATION-RECORD.md) | Exact source requirements, status semantics and acceptance boundary |
| [Functional specification](01_Functional-Specification_v1.1.md) | Implemented journeys, guards and missing target behavior |
| [High level design](02_High-Level-Design_v1.1.md) | Current components, trust boundaries and architecture differences |
| [Low level design](03_Low-Level-Design_v1.1.md) | Commands, state, persistence and recovery |
| [API and integrations](04_API-and-Integration-Specification_v1.1.md) | Current endpoint/command contract and external gates |
| [Data model](05_Data-Model-Specification_v1.1.md) | Physical storage, versioned JSON and migration rules |
| [Security privacy and clinical safety](06_Security-Privacy-and-Clinical-Safety_v1.1.md) | Current controls, threats, hazards and unresolved decisions |
| [Test strategy](07_Test-Strategy_v1.1.md) | Evidence layers, catalogue handling and acceptance rules |
| [Engineering implementation plan](08_Engineering-Implementation-Plan_v1.1.md) | R11 baseline, R12 slice and R12–R16 plan |
| [Operational runbooks](09_Operational-Runbooks_v1.1.md) | Current safe recovery procedures and target-only steps |
| [Pilot and release acceptance](10_Pilot-and-Release-Acceptance_v1.1.md) | Rehearsal boundary and all eight open gates |
| [Development and CI](DEVELOPMENT-AND-CI.md) | Setup, test execution and maintenance workflow |
| [Engineering guide](ENGINEERING-GUIDE.md) | Naming, layout, helpers, gates and the baseline procedure for engineers |
| [Architecture decisions](ARCHITECTURE-DECISIONS.md) | Reconciliation of all twelve original ADRs |
| [User guide](USER-GUIDE.md) | Safe care-record workflow in the current interface |
| [Administrator guide](ADMINISTRATOR-GUIDE.md) | Membership, teams, connections and governance |
| [Support guide](SUPPORT-GUIDE.md) | Diagnostics, triage and escalation |
| [Data governance](DATA-GOVERNANCE.md) | Custody, access, provenance, retention and export limits |
| [Delivery control](DELIVERY-CONTROL.md) | Current registers and all original workbook sheets |
| [UI and wireframe coverage](UI-COVERAGE.md) | Original 22 screens mapped to current modules and gaps |
| [Documentation QA](DOCUMENTATION-QA.md) | Exact integrity checks and their limits |
| [Change record](CHANGELOG.md) | What this edition changes |

Machine-readable registers: [API commands](COMMAND-CATALOGUE.csv), [HTTP routes](HTTP-ROUTES.csv), [data dictionary](DATA-DICTIONARY.csv), [test cases](TEST-CATALOGUE.csv), [executions](EXECUTION-REGISTER.csv), [screens](SCREEN-COVERAGE.csv), and [requirements](../../requirements/traceability.csv). Human-readable inventories: [API](CURRENT-API-INVENTORY.md), [data](CURRENT-DATA-DICTIONARY.md).

## Detailed implemented contracts

The existing release-owned documents remain authoritative for their detailed modules: [agent API](../../AGENT-API.md), [clinical governance](../../AI-GOVERNANCE.md), [MIS](../../MIS-API.md), [EHR/ABDM](../../EHR-ABDM.md), [field notebook](../../FIELD-CONTINUITY.md), [patient continuity](../../CORE-CONTINUITY.md), [operations](../../OPERATIONS.md), [pilot](../../PILOT-RUNBOOK.md) and [outreach/expansion](../../OUTREACH-EXPANSION.md).

The original ten specifications are fully transcribed in [reference](../reference/README.md); unchanged DOCX/XLSX/HTML/ZIP files and engineering assets are in [history](../history/README.md). Current Markdown is the maintained edition; archived editable documents are explicitly historical.
