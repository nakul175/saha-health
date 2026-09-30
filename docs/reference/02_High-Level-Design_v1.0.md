# Original target design — 02_High-Level-Design_v1.0

Unchanged design content transcribed from the archived v1.0 Word file. This is a target specification, not an R11 implementation claim. See the [current index](../current/DOCUMENTATION-INDEX.md).

[Original editable file](../history/v1.0/02_High-Level-Design_v1.0.docx)

High Level Design

System architecture and operational boundaries for a modular platform with independently governed integrations.

| Document | Baseline | Status |
| --- | --- | --- |
| HAO 02 · Version 1.0 | BRD v1.1 · 26 September 2026 | Proposed for review |

This document expands the existing BRD. Source requirements retain their priority and release labels. Architecture choices are proposals until the named owners accept them. Specified behaviour, implemented behaviour and executed evidence are separate statuses.

## Architecture choice

Start with one modular application service, a relational operational store and durable background workers. The native Android client owns encrypted offline drafts and an outbox. Online web views serve supervisors and administrators. Provider and destination adapters are isolated modules with separately scoped credentials. Components can be split into services after measured scale, team ownership or data custody justifies the added failure modes.

| Boundary | Responsibility | Trust rule |
| --- | --- | --- |
| Device | Capture, cached assigned data, review and sync | Device state and client-supplied roles are untrusted on the server |
| Application | Policy, canonical records, plans, tasks and action lifecycle | Only verified principals can perform typed commands |
| Provider | Approved AI analysis within one capability contract | Outputs are untrusted data until validated; never instructions |
| Destination | Authoritative programme or EHR business records | Acceptance requires destination evidence |
| ABDM ecosystem | Selected identity and health-information exchange roles | Role onboarding and current scoped consent or authority are prerequisites |

## Logical components

| ID and component | Owned responsibility | Invariant |
| --- | --- | --- |
| C01 Field client | Scoped encrypted cache, capture, review, device queue | Native Android reference; key protected by device keystore |
| C02 Identity and policy | Workforce identity, active role and record-level authorisation | Verified OIDC subject; fail closed; no client-selected tenant authority |
| C03 Encounter service | Person context, observations, revisions and encounter confirmation | PostgreSQL transaction boundary with audit and outbox |
| C04 Programme and terminology | Versioned packs, reuse rules, mappings and clinical protocols | Only active reviewed configuration may drive live work |
| C05 Agent coordinator | Typed plan, dependency graph, limits and approval snapshots | Planner is untrusted; executor repeats policy checks |
| C06 AI broker | Eligibility, budget, minimal provider request and result validation | Adapter isolation; no provider secret in user client or prompts |
| C07 Capability registry | Provider versions and connector capability profiles | Review and activation history; deployment-scoped status |
| C08 Care coordination | Referrals, service directory and follow-up ownership | Evidence-backed outcome states |
| C09 Exchange adapters | MIS, EHR and ABDM translation, transmission and receipts | Each destination isolated; no distributed transaction claim |
| C10 Sync service | Device lease, ordered ingestion, receipts and conflicts | Current server policy overrides stale offline authority |
| C11 Operational projection | Tasks, exception queues and governed measures | Source-aware projection; application permissions still apply |
| C12 Administration and reporting | Configuration, reports, exports and support cases | Separate privileged views and export approval |
| C13 Audit and operations | Audit chain, telemetry, incidents, retention and release manifests | Payload redaction; restricted evidence store |
| C14 Data custody | Database, object storage, key management and recovery | Tenant boundaries, backup controls and approved hosting |

## End to end data flow

1. C01 obtains a verified workforce session from C02. C02 resolves active deployment membership, role and caseload; no patient data enters an identity token.

2. C01 reads permitted person context and sends draft observations to C03. C04 assembles required questions using the active programme versions. C03 retains observation provenance and immutable confirmed revisions.

3. C05 proposes a typed plan. C02 evaluates each action’s person, purpose, authority and recipient. C06 admits eligible AI calls through C07 manifests and reserves budget before dispatch.

4. C03 persists a confirmation or action change with its audit record and outbox event in one transaction. Workers consume committed outbox entries and recheck current policy before side effects.

5. C09 maps each approved submission independently. A verified destination receipt changes that submission to accepted. A timeout creates an uncertain outcome and a reconciliation task.

6. C11 updates task and reporting projections using deduplicated events. C13 observes queue age and failures without copying patient content into telemetry.

## Deployment topology

Proposed topology: internet ingress with request filtering; application instances in private compute; isolated worker pools for AI, exchange and exports; private PostgreSQL; encrypted object storage for media and evidence; a managed key service; and a restricted observability store. The deployment owner chooses actual hosting and processing regions before real data. Production, test and synthetic environments use different accounts or equivalent hard isolation, keys, identities and external credentials.

| Workload | Scaling unit | Back pressure |
| --- | --- | --- |
| Interactive API | Stateless instance; database connection budget | Reject excess load with explicit retry guidance rather than lose confirmed input |
| AI invocation | Provider-specific worker concurrency | Budget, provider rate limit, circuit breaker and clinical deadline |
| MIS or EHR exchange | Connector-specific worker and reconciliation queue | Per-destination limit; one slow destination cannot block another |
| Sync | Device batch with causal item dependencies | Bounded batch size; item-level receipts and retry cursor |
| Export or report | Governed asynchronous job or read projection | Scope and row limits; cancel stale jobs before delivery |

## Authority and source ownership

The platform is authoritative for captured encounter revisions, user approvals, task state and its own receipts. Each programme remains authoritative for enrolment and programme acceptance. Each EHR remains authoritative for its signed clinical records and orders. Imported records carry their original issuer and time. ABHA linking supplies an identity relationship; it is not permission to access every linked record.

## Resilience and consistency

Strong local transactions protect records, revisions, audit and the outbox. Cross-system execution is eventually consistent and uses independent action states. There is no all-or-nothing transaction across unrelated MIS or EHR systems. The UI exposes partial success and uncertain outcomes. Compensating work requires owner-authorised correction; deleting a local record does not undo an accepted external entry.

Use bounded retries with jitter for transport failures only when idempotency or definitive non-acceptance makes them safe. An ambiguous write stops in reconciliation. Provider circuit breakers are capability-specific, with approved manual workflows available. A stale report projection shows its last processed event and source freshness.

## Capacity and service targets

| Dimension | Proposed planning basis | Verification |
| --- | --- | --- |
| Pilot cohort | 100 to 200 workers in one district; subject to D02 | Observe concurrent sessions and bursty end-of-day sync |
| Offline | 24 hour default lease; proposed 500 MB media allowance | Lease expiry, storage pressure and interrupted upload tests |
| Quality targets | Exact NFR values retained in Test Strategy | Measure each percentile and denominator under declared workload |
| Expansion | No fleet-wide throughput promise in this pack | Benchmark larger cohorts and provider quotas before G7 |

Capacity estimates require observed visits per worker, fields per visit, media bytes, AI calls per encounter, callback frequency and destination latency. Size structured storage from records × average bytes × revision factor; size media independently using retention and replication. Budget both peak sync ingestion and slower downstream completion. Do not substitute the pilot cohort size for a concurrency or storage measurement.

## Architecture decisions

### ADR01 One encounter workspace

Proposed decision Use a task-centred mobile flow with person and encounter context fixed

Reason Workers reuse facts across programmes; distinct patient records remain isolated

Consequence UI widgets and question packs require usability validation

### ADR02 Modular server and durable workers

Proposed decision Start with a modular service and database-backed outbox workers

Reason Reduces cross-service failure modes while preserving clear component contracts

Consequence Split components only when measured scale or custody requires it

### ADR03 Canonical operational model

Proposed decision Persist typed operational entities and transform at adapter boundaries

Reason Shared facts retain provenance while destinations keep independent schemas

Consequence Canonical shape is not itself an ABDM clinical document

### ADR04 Native field client

Proposed decision Use an Android reference client with encrypted local storage and keystore wrapping

Reason Offline lease and media recovery require controlled device behaviour

Consequence Web admin supports online work; browser storage is not the default clinical offline store

### ADR05 Bounded planner

Proposed decision Separate model planning from deterministic execution and policy

Reason Tool outputs and retrieved records cannot grant authority

Consequence Model vendor selected through performance privacy and cost review

### ADR06 Independent destination actions

Proposed decision Use saga-style recovery and evidence-based reconciliation

Reason No global atomic commit exists across unrelated programme systems

Consequence Uncertain results need lookup or manual resolution before retry

### ADR07 Immutable confirmed revisions

Proposed decision Use append-only clinical fact revisions and approval hashes

Reason Corrections remain attributable and invalidate affected work

Consequence Storage and retention policy must cover original and corrected versions

### ADR08 Versioned capability activation

Proposed decision Activate provider and model version per deployment and scope

Reason Evidence and local permission differ from a successful API test

Consequence Substitution requires equivalent approved intended use

### ADR09 Explicit exchange scope

Proposed decision Implement ABDM and direct EHR as separate connector types

Reason Consent or API availability does not grant universal records access

Consequence Exact external contracts stay blocked until owner verification

### ADR10 Defence in depth authorisation

Proposed decision Use service policy and tenant RLS with separate runtime roles

Reason Prevents client scope selection and catches tenant query errors

Consequence Tenant RLS does not replace patient relationship and purpose checks

### ADR11 Operational metrics projection

Proposed decision Build controlled report projections from versioned domain events

Reason Queries can disclose source completeness and avoid double counting

Consequence Late records require reproducible metric revision

### ADR12 Explicit synthetic environment

Proposed decision Simulators emit mode and source markers and use isolated fixtures

Reason Development can exercise failures before partner credentials exist

Consequence Simulation evidence cannot pass live connector or clinical validation gates

## Architecture gates

Before production, confirm record custody, processing locations, network routes, keys, institutional identity provider, external contracts, model manifests, clinical review routes, backup restoration and on-call coverage. The reference SQL and OpenAPI describe a starting contract; they are not evidence of a running service or certified exchange.

## Sources and related artefacts

S01 BRD v1.1 Health-AI-Orchestration-Platform-BRD-v1.1.docx — Product source of authority; 176 requirements and 12 journeys

S02 NRCeS ABDM FHIR guide https://nrces.in/ndhm/fhir/r4/ — Published guide retrieved 26 September 2026 shows version 6.5.0 on FHIR R4; pin deployment package at onboarding

S04 PostgreSQL row security https://www.postgresql.org/docs/current/ddl-rowsecurity.html — Database row security is defence in depth; trusted service role and record-level policy remain necessary

Companion workbook: Health-AI-Delivery-Control-Workbook-v1.0.xlsx. Machine-readable contracts and reference checks: engineering folder. Requirements and test IDs are stable across the pack. Open decisions remain in the Decisions sheet; no document changes their approval status.
