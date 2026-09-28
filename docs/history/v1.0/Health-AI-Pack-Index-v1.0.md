# Health AI Orchestration documentation pack

Version 1.0 · 26 September 2026 · Based on BRD v1.1

This pack follows the supporting-document structure used in the earlier Sandbox and Impact Management work. It applies that structure to the Health AI Orchestration Platform; the platform and the evaluation sandbox remain separate products.

The product goal is one task-centred workspace that lets an authorised worker capture a fact once and reuse it across permitted programme and AI workflows. Each destination retains its own authority, status and receipt.

## Document index

| File | Coverage | Rendered pages |
|---|---|---|
| [Functional specification](01_Functional-Specification_v1.0.docx) | 12 journeys, 148 functional expansions and 22 screen contracts | 70 |
| [High level design](02_High-Level-Design_v1.0.docx) | 14 logical components, system boundaries, resilience and 12 architecture decisions | 7 |
| [Low level design](03_Low-Level-Design_v1.0.docx) | Command processing, state transitions, approval binding, offline sync and reconciliation | 8 |
| [API and integration specification](04_API-and-Integration-Specification_v1.0.docx) | 74 internal operations, 16 events, provider contracts, ABDM roles and EHR onboarding | 12 |
| [Data model specification](05_Data-Model-Specification_v1.0.docx) | 26 operational entities, 407 field definitions, custody, revisions and migration rules | 9 |
| [Security privacy and clinical safety](06_Security-Privacy-and-Clinical-Safety_v1.0.docx) | 10-role access model, 10 threats, 10 clinical hazards and accountability | 6 |
| [Test strategy](07_Test-Strategy_v1.0.docx) | 364 application test definitions and all 28 BRD quality requirements | 14 |
| [Engineering implementation plan](08_Engineering-Implementation-Plan_v1.0.docx) | 176 backlog items, 11 work packages, dependencies and definitions of ready and done | 6 |
| [Operational runbooks](09_Operational-Runbooks_v1.0.docx) | 10 procedures for support, integration failures, safety, restore and exit | 7 |
| [Pilot and release acceptance](10_Pilot-and-Release-Acceptance_v1.0.docx) | Baseline measurement, eight release gates and acceptance records | 5 |

## Working artefacts

- **Health-AI-Delivery-Control-Workbook-v1.0.xlsx:** 13 sheets covering summary, traceability, tests, backlog, work packages, screens, data dictionary, APIs, events, access, decisions, release gates and ADRs. Amber cells are editable execution fields. The summary flags passed tests without evidence and keeps unaccepted gates visible.
- **Health-AI-Wireframes-v1.0.html:** 22 screen views with an in-memory synthetic workflow. Open locally in a browser. Rehearse capture, confirmation, partial destination success, reconciliation, offline queueing and withdrawal. Administrative views are design examples; they do not perform live actions.
- **engineering/:** OpenAPI 3.1.1, 16 event schemas, foundation SQL, state transitions, synthetic schema examples, 364 fixture recipes, 12 ADRs, Mermaid diagrams and reference checks.
- **source/:** an unchanged copy of the existing BRD v1.1 for context.

## Read and review order

1. Product and programme owners: FSD, wireframes and Requirements sheet. Check the actual worker journey and which duplicate tasks the buyer can retire.
2. Engineering and integration owners: HLD, LLD, API and Data Model documents, then the engineering assets. Pin partner contracts and implementation dependencies.
3. Clinical, privacy and security owners: control and hazard document, Access Matrix, decisions and provider evidence gates.
4. QA and delivery: Test Strategy, Engineering Implementation Plan and workbook. Replace fixture recipes with executable application fixtures before testing.
5. Deployment owner: runbooks and pilot acceptance. Name accountable owners and collect evidence before accepting gates.

## Baseline status

The 176 BRD requirements are mapped to a proposed design and 364 application test definitions. All application tests are **Not run**, all 176 backlog items are **Not started**, all 21 deployment decisions are **Open**, and no release gate is accepted. These are intentional starting states, not omissions to be treated as passes.

Architecture choices are review proposals. Numerical BRD targets are retained in the Test Strategy. Source section and citation references reproduced inside a required-outcome paragraph refer to BRD v1.1, not to the new document’s section numbering.

ABDM participation must be approved for the selected module and role; EHR access is established per owner-authorised capability profile. No document asserts universal EHR connectivity, production onboarding, legal compliance or clinical validation. Exact external API versions, credentials and clinical protocol content remain deployment decisions.

The internal API and SQL are a foundation contract. Engineering must complete identity-provider provisioning, deployment grants, specialised reference tables, partner-specific clinical resource mappings, migrations and production validation. A schema-shape example is not a clinically or relationally complete encounter.

## Checks completed for this pack

| Check | Result | Limit |
|---|---|---|
| In-memory invariant tests | 36 passed | Does not test real persistence, credentials or networks |
| Structural and example contract checks | 327 passed | Bounded custom linter; not a full OpenAPI or JSON Schema certification |
| Prototype state and markup checks | 37 passed | Uses a minimal DOM stub; browser visual/accessibility testing remains unverified |
| Workbook checks | 12 passed; 380 formulas with no cached error cells | Calculation tested in the authoring engine; no claim of separate desktop Excel execution |
| Document layout | Ten DOCX files rendered and reviewed; 144 pages | Page counts may change with local fonts and Word settings |

The browser runtime could not be installed in this environment because the download was invalid. The prototype script and generated views were checked, but browser screenshots and responsive visual QA were not completed. All live MIS, EHR, ABDM, provider and clinical tests remain unrun. Native PostgreSQL execution, production RLS roles, migrations, full OpenAPI tooling, and deployment-specific FHIR validation remain required gates.

## Glossary

| Term | Meaning |
|---|---|
| ASHA | Accredited Social Health Activist |
| MIS | Programme management information system |
| EHR | Electronic health record system |
| ABDM | Ayushman Bharat Digital Mission |
| ABHA | Ayushman Bharat Health Account |
| HIP / HIU | Health Information Provider / Health Information User |
| FSD / HLD / LLD | Functional specification / high level design / low level design |
| ADR | Architecture decision record |
| RLS | Database row-level security |

## Reference sources

- S01 · BRD v1.1: Health-AI-Orchestration-Platform-BRD-v1.1.docx. Product source of authority; 176 requirements and 12 journeys.
- S02 · NRCeS ABDM FHIR guide: https://nrces.in/ndhm/fhir/r4/. Published guide retrieved 26 September 2026 shows version 6.5.0 on FHIR R4; pin deployment package at onboarding.
- S03 · OpenAPI Specification 3.1.1: https://spec.openapis.org/oas/v3.1.1.html. Selected contract format for this pack, not a claim to use the newest OAS release.
- S04 · PostgreSQL row security: https://www.postgresql.org/docs/current/ddl-rowsecurity.html. Database row security is defence in depth; trusted service role and record-level policy remain necessary.
- S05 · ABDM Sandbox: https://sandbox.abdm.gov.in/. External onboarding dependency; actual API and callback versions require official account-specific confirmation.
