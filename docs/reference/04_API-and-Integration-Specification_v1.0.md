# Original target design — 04_API-and-Integration-Specification_v1.0

Unchanged design content transcribed from the archived v1.0 Word file. This is a target specification, not an R11 implementation claim. See the [current index](../current/DOCUMENTATION-INDEX.md).

[Original editable file](../history/v1.0/04_API-and-Integration-Specification_v1.0.docx)

API and Integration Specification

Internal command and query contracts, event exchange and external connector onboarding.

| Document | Baseline | Status |
| --- | --- | --- |
| HAO 04 · Version 1.0 | BRD v1.1 · 26 September 2026 | Proposed for review |

This document expands the existing BRD. Source requirements retain their priority and release labels. Architecture choices are proposals until the named owners accept them. Specified behaviour, implemented behaviour and executed evidence are separate statuses.

## Contract authority

engineering/openapi.json is the proposed internal OpenAPI 3.1.1 contract. It contains 74 operations and closed JSON request and resource schemas. The example.invalid server is a documentation placeholder. The operation IDs in the workbook and API catalogue are stable references. Partner API paths, authentication and callback payloads must come from authorised system owners; none are invented here.

## Common protocol

| Concern | Contract |
| --- | --- |
| Authentication | Verified short-lived bearer token from the selected identity integration. Validate issuer, audience, signature, expiry and active membership; refresh is managed by the identity provider. |
| Tenant and actor | Derived from the verified session. Resource lookup is tenant and patient scoped. Body fields cannot elevate role or select a different tenant. |
| Mutation | POST commands require Idempotency-Key. Updates require If-Match with the quoted numeric resource version. Payload drift on a reused key yields 409. |
| Response | 202 plus CommandReceipt means durable platform acceptance. Follow resource state and destination receipt for business completion. Upload negotiation and sync use their explicit result schemas. |
| Read | GET uses opaque tenant-bound cursors, default limit 25 and maximum 100. Record representations expose version and ETag. A client must not infer data outside its relationship scope. |
| Time and text | ISO date or UTC-offset date-time as typed; UTF-8; explicit absence codes. Server time determines expiry. Internal currency amounts use integer minor units and an explicit ISO currency code. |
| Versioning | Breaking resource or command changes require a new contract version and client compatibility plan. Programme, model, mapping and metric versions remain independently pinned. |

## Errors and safe retry

| HTTP | Meaning | Client behaviour |
| --- | --- | --- |
| 400 | Malformed envelope | Correct request; never blind retry |
| 401 or 403 | Session invalid or authority denied | Renew or seek assigned workflow; never widen scope |
| 404 | Resource unavailable in permitted scope | Do not expose whether another tenant has it |
| 409 | State, idempotency or duplicate identity conflict | Read authoritative state and resolve |
| 412 | If-Match version changed | Refresh and review; preserve unsaved work |
| 422 | Schema or domain validation failure | Show field or rule code; no side effect |
| 429 | Quota or rate budget exceeded | Respect server/provider retry policy and deadline |
| 503 | Temporary platform dependency failure | Retry same command key only; inspect receipt if outcome uncertain |

Problem responses include code, a safe user message, correlation ID, retryable flag and optional field error codes. Do not include raw patient data, provider secrets or internal stack traces. Retryability is not permission to repeat an external write; the submission state governs that decision.

## Operation catalogue

### ID operations

| ID and operation | Method and path | Meaning |
| --- | --- | --- |
| API001 createPerson | POST /v1/persons | Create a provisional local person |
| API002 linkIdentifier | POST /v1/persons/{id}/identifier-links | Create a verified external identity link after confirmation |
| API003 correctIdentifier | POST /v1/identifier-links/{id}/correct | Supersede a wrong identity link and create repair tasks |
| API036 listPersons | GET /v1/persons | Policy-scoped read; cursor is opaque and tenant-bound |
| API037 getPerson | GET /v1/persons/{id} | Policy-scoped read; cursor is opaque and tenant-bound |
| API072 getSession | GET /v1/me | Session or policy-scoped projection |

### UX operations

| ID and operation | Method and path | Meaning |
| --- | --- | --- |
| API004 createEncounter | POST /v1/encounters | Start an encounter for a confirmed active person |
| API006 confirmEncounter | POST /v1/encounters/{id}/confirm | Confirm the reviewed encounter snapshot |
| API038 listEncounters | GET /v1/encounters | Policy-scoped read; cursor is opaque and tenant-bound |
| API039 getEncounter | GET /v1/encounters/{id} | Policy-scoped read; cursor is opaque and tenant-bound |

### DATA operations

| ID and operation | Method and path | Meaning |
| --- | --- | --- |
| API005 recordObservation | POST /v1/encounters/{id}/observations | Create a draft observation with value or missingness |
| API007 amendObservation | POST /v1/observations/{id}/amend | Append a correction and invalidate dependent approval |
| API008 resolveConflict | POST /v1/conflicts/{id}/resolve | Resolve a recorded conflict without silent overwrite |
| API029 reserveMedia | POST /v1/media | Reserve a scoped upload target |
| API030 completeMedia | POST /v1/media/{id}/complete | Verify upload and queue scan and quality checks |
| API040 listObservations | GET /v1/observations | Policy-scoped read; cursor is opaque and tenant-bound |
| API041 getObservation | GET /v1/observations/{id} | Policy-scoped read; cursor is opaque and tenant-bound |
| API042 listConflicts | GET /v1/conflicts | Policy-scoped read; cursor is opaque and tenant-bound |
| API043 getConflict | GET /v1/conflicts/{id} | Policy-scoped read; cursor is opaque and tenant-bound |

### SEC operations

| ID and operation | Method and path | Meaning |
| --- | --- | --- |
| API009 recordAuthority | POST /v1/authorities | Record verified processing authority |
| API010 withdrawAuthority | POST /v1/authorities/{id}/withdraw | Revoke authority and invalidate pending disclosures |
| API044 listAuthorityRecords | GET /v1/authorities | Policy-scoped read; cursor is opaque and tenant-bound |
| API045 getAuthorityRecord | GET /v1/authorities/{id} | Policy-scoped read; cursor is opaque and tenant-bound |

### AG operations

| ID and operation | Method and path | Meaning |
| --- | --- | --- |
| API011 preparePlan | POST /v1/plans | Prepare a typed bounded plan |
| API012 approvePlan | POST /v1/plans/{id}/approvals | Approve exact permitted actions and evidence |
| API013 executePlan | POST /v1/plans/{id}/execute | Queue approved actions after current policy checks |
| API014 cancelPlan | POST /v1/plans/{id}/cancel | Cancel unfinished work and retain accepted external effects |
| API046 listAgentPlans | GET /v1/plans | Policy-scoped read; cursor is opaque and tenant-bound |
| API047 getAgentPlan | GET /v1/plans/{id} | Policy-scoped read; cursor is opaque and tenant-bound |

### AI operations

| ID and operation | Method and path | Meaning |
| --- | --- | --- |
| API015 invokeCapability | POST /v1/ai-requests | Admit an eligible provider invocation |
| API016 cancelAIRequest | POST /v1/ai-requests/{id}/cancel | Request provider cancellation with actual outcome tracking |
| API017 registerCapability | POST /v1/capabilities | Register a non-active capability version |
| API018 transitionCapability | POST /v1/capabilities/{id}/transition | Review activate suspend or retire a pinned capability |
| API048 listAIRequests | GET /v1/ai-requests | Policy-scoped read; cursor is opaque and tenant-bound |
| API049 getAIRequest | GET /v1/ai-requests/{id} | Policy-scoped read; cursor is opaque and tenant-bound |
| API050 listProviderCapabilitys | GET /v1/capabilities | Policy-scoped read; cursor is opaque and tenant-bound |
| API051 getProviderCapability | GET /v1/capabilities/{id} | Policy-scoped read; cursor is opaque and tenant-bound |

### INT operations

| ID and operation | Method and path | Meaning |
| --- | --- | --- |
| API019 prepareSubmission | POST /v1/submissions | Prepare a validated minimal destination payload |
| API020 dispatchSubmission | POST /v1/submissions/{id}/dispatch | Queue one destination action after revalidation |
| API021 reconcileSubmission | POST /v1/submissions/{id}/reconcile | Look up uncertain external state before considering retry |
| API026 requestExchange | POST /v1/exchanges | Request an authorised ABDM exchange through its adapter |
| API052 listSubmissions | GET /v1/submissions | Policy-scoped read; cursor is opaque and tenant-bound |
| API053 getSubmission | GET /v1/submissions/{id} | Policy-scoped read; cursor is opaque and tenant-bound |
| API054 listConnectors | GET /v1/connectors | Policy-scoped read; cursor is opaque and tenant-bound |
| API055 getConnector | GET /v1/connectors/{id} | Policy-scoped read; cursor is opaque and tenant-bound |
| API060 listExchanges | GET /v1/exchanges | Policy-scoped read; cursor is opaque and tenant-bound |
| API061 getExchange | GET /v1/exchanges/{id} | Policy-scoped read; cursor is opaque and tenant-bound |

### CARE operations

| ID and operation | Method and path | Meaning |
| --- | --- | --- |
| API022 createReferral | POST /v1/referrals | Prepare a referral with accountable ownership |
| API023 transitionReferral | POST /v1/referrals/{id}/transition | Record an evidence-backed referral state change |
| API024 assignTask | POST /v1/tasks/{id}/assign | Transfer task responsibility |
| API025 completeTask | POST /v1/tasks/{id}/complete | Complete a task using authorised outcome evidence |
| API056 listReferrals | GET /v1/referrals | Policy-scoped read; cursor is opaque and tenant-bound |
| API057 getReferral | GET /v1/referrals/{id} | Policy-scoped read; cursor is opaque and tenant-bound |
| API058 listTasks | GET /v1/tasks | Policy-scoped read; cursor is opaque and tenant-bound |
| API059 getTask | GET /v1/tasks/{id} | Policy-scoped read; cursor is opaque and tenant-bound |

### PROG operations

| ID and operation | Method and path | Meaning |
| --- | --- | --- |
| API034 publishPack | POST /v1/programme-packs/{id}/publish | Activate a reviewed programme version |
| API066 listProgrammePacks | GET /v1/programme-packs | Policy-scoped read; cursor is opaque and tenant-bound |
| API067 getProgrammePack | GET /v1/programme-packs/{id} | Policy-scoped read; cursor is opaque and tenant-bound |

### OFF operations

| ID and operation | Method and path | Meaning |
| --- | --- | --- |
| API027 createLease | POST /v1/offline-leases | Issue a server-scoped signed offline lease |
| API028 syncBatch | POST /v1/sync-batches | Ingest ordered offline commands with per-item receipts |

### CLIN operations

| ID and operation | Method and path | Meaning |
| --- | --- | --- |
| API031 openSafetyCase | POST /v1/safety-cases | Record a safety or privacy incident |
| API062 listSafetyCases | GET /v1/safety-cases | Policy-scoped read; cursor is opaque and tenant-bound |
| API063 getSafetyCase | GET /v1/safety-cases/{id} | Policy-scoped read; cursor is opaque and tenant-bound |

### REP operations

| ID and operation | Method and path | Meaning |
| --- | --- | --- |
| API032 requestExport | POST /v1/exports | Request a scoped expiring export |
| API070 listExportJobs | GET /v1/exports | Policy-scoped read; cursor is opaque and tenant-bound |
| API071 getExportJob | GET /v1/exports/{id} | Policy-scoped read; cursor is opaque and tenant-bound |
| API073 runReport | GET /v1/reports/{id} | Session or policy-scoped projection |
| API074 getExportDownload | GET /v1/exports/{id}/download | Session or policy-scoped projection |

### OPS operations

| ID and operation | Method and path | Meaning |
| --- | --- | --- |
| API033 createSupportCase | POST /v1/support-cases | Open a case with redacted diagnostics |
| API035 publishConfiguration | POST /v1/deployment-configs/{id}/publish | Activate a compatible reviewed deployment configuration |
| API064 listSupportCases | GET /v1/support-cases | Policy-scoped read; cursor is opaque and tenant-bound |
| API065 getSupportCase | GET /v1/support-cases/{id} | Policy-scoped read; cursor is opaque and tenant-bound |
| API068 listDeploymentConfigs | GET /v1/deployment-configs | Policy-scoped read; cursor is opaque and tenant-bound |
| API069 getDeploymentConfig | GET /v1/deployment-configs/{id} | Policy-scoped read; cursor is opaque and tenant-bound |

## Representative command exchange

POST /v1/encounters/{id}/confirm

 Authorization: Bearer <verified session>

 Idempotency-Key: syn-confirm-0001

 If-Match: "3"

 {

   "patient_context_hash": "<64 lowercase hex characters>",

   "reviewed_refs": [{"resource_type": "Observation",

       "resource_id": "<UUID>", "version": 1}],

   "unresolved_refs": []

 }

This is a shape example, not a runnable payload. Concrete synthetic UUIDs and valid example objects are supplied under engineering/fixtures. The server resolves all referenced records and rejects a reference whose person, tenant or current revision differs. An unchanged retry returns the same resource and version with replayed=true.

## Domain events

The 16 event schemas are versioned JSON Schema 2020-12 envelopes. They contain record references and purpose, not a copy of the patient chart. Delivery is at least once, and ordering is defined per aggregate. A consumer must retrieve data through current policy rather than treating the event as an authorisation grant.

| Event | Resource | Primary consumer |
| --- | --- | --- |
| encounter.confirmed | Encounter | Projection, audit or affected-action worker |
| observation.amended | Observation | Projection, audit or affected-action worker |
| authority.revoked | AuthorityRecord | Projection, audit or affected-action worker |
| plan.approved | AgentPlan | Projection, audit or affected-action worker |
| ai.requested | AIRequest | Projection, audit or affected-action worker |
| ai.result_available | AIResult | Projection, audit or affected-action worker |
| capability.suspended | ProviderCapability | Projection, audit or affected-action worker |
| submission.accepted | Submission | Projection, audit or affected-action worker |
| submission.uncertain | Submission | Projection, audit or affected-action worker |
| referral.state_changed | Referral | Projection, audit or affected-action worker |
| identity.link_corrected | IdentifierLink | Projection, audit or affected-action worker |
| sync.conflict_detected | Conflict | Projection, audit or affected-action worker |
| exchange.validated | Exchange | Projection, audit or affected-action worker |
| safety.case_opened | SafetyCase | Projection, audit or affected-action worker |
| configuration.published | DeploymentConfig | Projection, audit or affected-action worker |
| export.available | ExportJob | Projection, audit or affected-action worker |

## Provider adapter contract

| Contract field | Required evidence |
| --- | --- |
| Identity and version | Provider legal/service identity, capability key, immutable release ID, signed or otherwise authenticated manifest |
| Eligibility | Intended use, exclusions, population, supported language, device and acquisition conditions |
| Input and output | Closed schemas, units, missingness, signal quality, unable-to-assess states and result limitations |
| Processing | Permitted locations, subprocessors, purpose, retention, deletion and training prohibition unless separately authorised |
| Execution | Synchronous or asynchronous pattern, timeout, rate limits, cancellation, retry, callback authentication and replay defence |
| Commercial | Currency, unit charging, reservation ceiling, duplicate charging behaviour and unresolved timeout settlement |
| Evidence and review | Technical contract results, clinical evidence appropriate to intended use, local scope approval and incident contact |

## MIS and EHR capability profiles

Connect through standards or owner-approved proprietary APIs. Declare each resource, search, read, create, amend and acknowledgement operation separately. A system supporting patient lookup and document ingestion may still lack observation updates or order creation. Capability discovery enables only supported workflows. Unsupported write-back uses a labelled assisted hand-off with an accountable operator and no automated success claim.

Every profile pins identity matching, terminology, mandatory fields, deduplication, stable external references, receipt semantics, correction rules, test environment and lookup/reconciliation. Mapping tests cover missing values, unit conversion, unknown codes, timestamps, duplicate requests, pagination and late results. A file-based exchange can be supported when authorised; file delivery and business acceptance remain separate states.

## ABDM implementation scope

| Role or module | Required platform behaviour | Evidence before activation |
| --- | --- | --- |
| ABHA identity workflows | Use approved identity APIs where selected; retain a local person without mandatory ABHA; verify links and correction paths | Current authorised API contract and tested matching/recovery |
| HIP publication | Link care contexts and prepare supported clinical documents from the actual provider’s records and authority | Provider provenance, profile validation, linking and transfer evidence |
| HIU retrieval | Request only permitted data types and date ranges; enforce purpose, recipient, expiry and revocation | Verified consent flow, exact request context and authenticated data transfer |
| Clinical interoperability | Map canonical records into supported ABDM FHIR R4 document profiles and terminology | Pinned NRCeS package, profile tests and semantic review |
| External consent management | Use the official flow appropriate to the enabled role; do not invent an internal consent artefact as its replacement | Role-specific onboarding, environment credentials and end-to-end receipts |

The public NRCeS guide retrieved for this pack identifies version 6.5.0 on FHIR R4. Pin the package and terminology actually accepted by the deployment, then validate document structure, references, identifiers, timestamps, required sections and clinical meaning. Passing a generic FHIR parser does not establish conformance to an ABDM document profile. Current external API versions and onboarding remain D19 and D21 gates.

“Connect to any EHR” is implemented as an extensible adapter framework with a tested capability profile per system. It is not a guarantee of access, bidirectional write support or procurement permission. The platform’s internal canonical schema and a patient’s ABHA link do not remove these constraints.

## Connector activation checklist

1. Obtain owner authority, intended resources and purpose. Record the production support and correction owners.

2. Pin exact authentication, schemas, versions, rate limits and receipt semantics. Configure environment-scoped secrets outside manifests.

3. Execute synthetic contract tests and owner-approved test environment scenarios including timeout after acceptance.

4. Test mapping and clinical semantics with the designated informatics and programme owners. Validate identity, authority and revocation.

5. Record evidence for a real destination exchange in the permitted environment. Activate only the tested operations and population.

6. Monitor rejection codes, uncertain queue age, schema drift and receipt reconciliation. Suspend the affected operation when its contract changes.

## Sources and related artefacts

S01 BRD v1.1 Health-AI-Orchestration-Platform-BRD-v1.1.docx — Product source of authority; 176 requirements and 12 journeys

S02 NRCeS ABDM FHIR guide https://nrces.in/ndhm/fhir/r4/ — Published guide retrieved 26 September 2026 shows version 6.5.0 on FHIR R4; pin deployment package at onboarding

S03 OpenAPI Specification 3.1.1 https://spec.openapis.org/oas/v3.1.1.html — Selected contract format for this pack, not a claim to use the newest OAS release

S05 ABDM Sandbox https://sandbox.abdm.gov.in/ — External onboarding dependency; actual API and callback versions require official account-specific confirmation

Companion workbook: Health-AI-Delivery-Control-Workbook-v1.0.xlsx. Machine-readable contracts and reference checks: engineering folder. Requirements and test IDs are stable across the pack. Open decisions remain in the Decisions sheet; no document changes their approval status.
