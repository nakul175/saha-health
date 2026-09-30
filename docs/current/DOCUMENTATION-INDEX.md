# Current documentation index

Edition 1.1 reconciles application R11 to BRD v1.1. Read [Implementation](../IMPLEMENTATION.md), [Next delivery](../NEXT-DELIVERY.md) and [Qualification](../QUALIFICATION.md) first. All current documents describe synthetic engineering scope; formal acceptance remains pending.

| Document | Purpose |
| --- | --- |
| [Development slice 2b](SLICE-2B-MEDIA.md) | Visit photos and voice notes with checks, playback and draft deletion |
| [Development slice 6e](SLICE-6E-ACCESSIBILITY.md) | Automated WCAG A/AA audit of 16 screens and contrast fixes |
| [Development slice 3a](SLICE-3A-OFFLINE-MEDIA.md) | Encrypted offline photo and voice-note queue with recheck before upload |
| [Development slice 3b](SLICE-3B-STORAGE-WARNINGS.md) | Field notebook storage usage, keep-data request and low-space pause |
| [Development slice 7c](SLICE-7C-OUTBOUND-VALIDATION.md) | Pinned outbound FHIR structural validation and regression corpus |
| [Development slice 6f](SLICE-6F-FIELD-ACCESSIBILITY.md) | Field notebook, phone and keyboard focus accessibility |
| [Development slice 6g](SLICE-6G-ALERTS.md) | Computed operational alerts with owners and next actions |
| [Development slice 3c](SLICE-3C-QUEUE-HARDENING.md) | Media queue hardening after independent review |
| [Development slice 6h](SLICE-6H-ALERT-ACKNOWLEDGEMENT.md) | Alert acknowledgement by the owning role |
| [Development slice 3d](SLICE-3D-VOICE-RECORDING.md) | In-app voice-note recording in the field notebook |
| [Development slice 3e](SLICE-3E-PHOTO-REDUCTION.md) | On-device photo reduction and metadata removal |
| [Development slice 3f](SLICE-3F-WORKSPACE-PHOTO-REDUCTION.md) | Photo reduction in the online visit screen |
| [Development slice 4b](SLICE-4B-ACTION-PLAN.md) | Per-patient action plan with ownership gaps and assignment |
| [Development slice 6i](SLICE-6I-EXCEPTION-QUEUE.md) | Item-level exception queue with links to the patient or visit |
| [Development slice 7b](SLICE-7B-ABDM-TRANSFER.md) | Care contexts, encrypted consent-bound transfer and received-record review (mock gateway) |
| [Development slice 7a](SLICE-7A-ABDM-MOCK.md) | ABDM module readiness, ABHA workflows and consent artefacts against a local mock gateway |
| [Development slice 1d](SLICE-1D-ROSTER.md) | Workforce roster preview and apply |
| [Development slice 2a](SLICE-2A-REUSE.md) | Reproducible reuse, blocked reuse, repeated-entry and correction metering |
| [Development slice 4a](SLICE-4A-REFERRALS.md) | Referral lifecycle, urgency, reasoned delay and escalation queue |
| [Development slice 6d](SLICE-6D-INDICATORS.md) | Indicator catalogue, small-cell suppression and governed questions |
| [Development slice 6c](SLICE-6C-RETENTION.md) | Retention schedules, legal holds and eligibility review without deletion |
| [Development slice 0b-2](SLICE-0B2-SCOPED-READS.md) | Viewer-scoped workspace reads and ASHA read measurements |
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
