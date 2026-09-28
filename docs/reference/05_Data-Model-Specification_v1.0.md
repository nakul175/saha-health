# Original target design — 05_Data-Model-Specification_v1.0

Unchanged design content transcribed from the archived v1.0 Word file. This is a target specification, not an R11 implementation claim. See the [current index](../current/DOCUMENTATION-INDEX.md).

[Original editable file](../history/v1.0/05_Data-Model-Specification_v1.0.docx)

Data Model Specification

Canonical entities, data ownership, revision rules and a PostgreSQL foundation blueprint.

| Document | Baseline | Status |
| --- | --- | --- |
| HAO 05 · Version 1.0 | BRD v1.1 · 26 September 2026 | Proposed for review |

This document expands the existing BRD. Source requirements retain their priority and release labels. Architecture choices are proposals until the named owners accept them. Specified behaviour, implemented behaviour and executed evidence are separate statuses.

## Data model principles

The model supports fact reuse while preserving source ownership. A person has many encounters; each encounter has observations and planned actions. A programme submission, AI request, referral and exchange are separate resources with their own lifecycle. Cross-resource pointers carry tenant context and exact revisions where a decision depends on historical content.

| Relationship | Cardinality and rule |
| --- | --- |
| Person to Encounter | One to many; each encounter belongs to exactly one person |
| Person to IdentifierLink | One to many by issuer; disputed or superseded links remain attributable |
| Encounter to Observation | One to many; person must agree with encounter, and amendments reference prior revisions |
| AgentPlan to ActionApproval | One to many; approval binds an exact plan snapshot and expires |
| AIRequest to AIResult | One request can have attempt evidence; only a validated resolved result is selected |
| Encounter to Submission | One to many destinations and actions; unique tenant plus connector plus logical action prevents duplicate logical writes |
| AuthorityRecord to action | An action requires current matching scope; authority is not inferred from a link or old retrieval |
| HouseholdMembership to Person | Relationship only; membership supplies no implicit access to another person’s chart |

## Entity catalogue

### Person

Local identity remains usable without an external identifier. Store age basis so a reported age cannot masquerade as a verified date of birth.

Entity fields display_name, birth_date, age_basis, reported_age_years, identity_status, preferred_language

Optional fields birth_date, reported_age_years

### IdentifierLink

Issuer-scoped mapping with verification and supersession evidence. Cross-person correction requires a steward and affected-record review.

Entity fields person_id, issuer, external_identifier, verification, evidence_ref, supersedes_id

Optional fields evidence_ref, supersedes_id

### HouseholdMembership

Time-bounded household relationship. Proxy authority is separate and must be verified for the permitted action.

Entity fields person_id, household_id, relationship, effective_from, effective_to, proxy_authority_id

Optional fields effective_to, proxy_authority_id

### Encounter

One person, programme context and confirmation snapshot. New programmes can reuse facts only when their semantic and purpose constraints hold.

Entity fields person_id, programme_ids, episode_ref, state, started_at, confirmed_at, confirmed_by, patient_context_hash

Optional fields confirmed_at, confirmed_by, episode_ref

### Observation

Typed value or explicit absence reason, never both. Preserve concept system, effective time, source, author and amendment pointer.

Entity fields person_id, encounter_id, concept_code, concept_system, effective_at, source_type, verification, value, absent_reason, source_ref, author_id, supersedes_id

Optional fields absent_reason, source_ref, supersedes_id, value

### Conflict

Two or more candidate revisions with a base version and accountable resolution; no silent loss of a competing observation.

Entity fields resource_type, resource_id, base_version, candidate_refs, state, resolution_ref, owner_id

Optional fields resolution_ref

### AuthorityRecord

Evidence-backed processing basis, permitted actions, recipients, data types and interval. External consent artefacts retain their own provenance.

Entity fields person_id, purpose, basis, basis_ref, recipient_ids, data_types, actions, state, valid_from, expires_at, notice_version, external_artefact_ref, date_from, date_to

Optional fields date_from, date_to, external_artefact_ref, notice_version

### ProgrammePack

Immutable content version for questions, rules, mappings, language and approval history. Activation is deployment scoped.

Entity fields programme_id, pack_version, schema_ref, rules_hash, mapping_refs, state, effective_from, approval_refs, language_versions

Optional fields None in the proposed representation

### Task

Owned work with due date when applicable and an evidence-backed completion or unresolved disposition.

Entity fields person_id, encounter_id, task_type, owner_ref, due_at, reason_codes, state, evidence_ref

Optional fields due_at, encounter_id, evidence_ref

### Referral

Separates authorisation, dispatch, receiving acknowledgement, scheduling, attendance and completion.

Entity fields person_id, encounter_id, reason_codes, destination_id, owner_ref, state, due_at, authority_id, evidence_refs, outcome_code

Optional fields due_at, outcome_code

### ProviderCapability

Pinned model and manifest with intended use, data contract, scope approvals and cost ceiling.

Entity fields provider_id, capability_key, manifest_version, provider_release_id, state, manifest_ref, intended_use, input_schema_ref, output_schema_ref, population_rule_ref, approval_refs, region, cost_ceiling_minor, currency

Optional fields None in the proposed representation

### AIRequest

Exact inputs, provider version, authority and budget context for one admitted invocation.

Entity fields person_id, encounter_id, capability_id, manifest_version, input_refs, input_hash, authority_id, state, deadline_at, max_cost_minor, currency, result_id, failure_code

Optional fields failure_code, result_id

### AIResult

Validated provider output, limitations, quality and source request. It is not a clinician decision.

Entity fields request_id, provider_release_id, output_schema_ref, output_ref, output_hash, quality_state, limitations, use_mode, review_state

Optional fields None in the proposed representation

### AgentPlan

Typed action graph and input snapshot. A plan cannot expand the user’s authority.

Entity fields person_id, encounter_id, goal_code, state, steps, input_refs, plan_hash, max_steps, deadline_at, budget_minor, currency

Optional fields None in the proposed representation

### ActionApproval

Human or configured workflow approval bound to the exact snapshot, recipient, purpose and expiry.

Entity fields plan_id, action_ids, snapshot_hash, purpose, recipient_ids, approver_id, approved_at, expires_at, state

Optional fields None in the proposed representation

### Connector

Owner-authorised operation profile and contract version for one external system.

Entity fields connector_key, connector_type, profile_version, supported_operations, supported_resources, mapping_version, external_schema_version, state, receipt_semantics_ref, owner_ref, secret_ref

Optional fields None in the proposed representation

### Submission

Independent logical destination action with attempt history, immutable payload hash and verified receipt.

Entity fields person_id, encounter_id, connector_id, logical_action_id, payload_ref, payload_hash, mapping_version, source_refs, authority_id, approval_id, state, destination_receipt_ref, destination_version, last_error_code, attempt_count

Optional fields destination_receipt_ref, destination_version, last_error_code

### Exchange

Selected HIP, HIU or direct EHR transfer with exact data scope, validation and transaction evidence.

Entity fields person_id, connector_id, role, authority_id, external_transaction_ref, data_types, date_from, date_to, state, profile_package, bundle_refs, validation_ref

Optional fields external_transaction_ref, validation_ref

### OfflineLease

Server-signed device, user, scope, purpose and expiry entitlement, not permanent offline permission.

Entity fields user_id, device_id, record_scope_hash, allowed_actions, policy_version, issued_at, expires_at, server_time_anchor, signature_ref, state

Optional fields None in the proposed representation

### MediaAsset

Encrypted object reference, acquisition context, digest, quality and lifecycle; no durable public URL.

Entity fields person_id, encounter_id, content_type, byte_size, sha256, object_ref, state, purpose, authority_id, quality_result_ref

Optional fields quality_result_ref

### AuditEvent

Append-only attributable action evidence with clinical content kept in its controlled source.

Entity fields actor_id, action, resource_type, resource_id, purpose, policy_decision_id, outcome, correlation_id, occurred_at, evidence_refs

Optional fields None in the proposed representation

### SafetyCase

Potential clinical harm or near miss with containment, evidence and accountable investigation.

Entity fields person_id, encounter_id, category, severity, state, summary, owner_ref, affected_refs, containment_refs

Optional fields encounter_id, person_id

### SupportCase

Operational issue with redacted default context and separately approved temporary access.

Entity fields category, summary, state, owner_ref, diagnostic_refs, access_grant_id, expires_at

Optional fields access_grant_id, expires_at

### ReportDefinition

Versioned numerator, denominator, grain, filters, lateness and suppression rules.

Entity fields metric_key, definition_version, numerator_ref, denominator_ref, exclusion_ref, source_grain, suppression_rule_ref, state

Optional fields None in the proposed representation

### ExportJob

Authorised scope and snapshot with row count, manifest, expiry and delivery evidence.

Entity fields purpose, scope_hash, authority_id, state, format, row_count, manifest_ref, download_expires_at

Optional fields download_expires_at, manifest_ref, row_count

### DeploymentConfig

Versioned tenant configuration linking compatible programme, provider, connector and policy versions.

Entity fields config_version, pack_refs, capability_refs, connector_refs, language_codes, policy_version, state, manifest_hash, approval_refs

Optional fields None in the proposed representation

Every entity also has id, tenant_id, version, environment, created_at and updated_at. The workbook Data Dictionary lists all 407 fields with types, presence, classification and provenance. Draft request shapes differ from complete resource representations: the server derives timestamps, actor and state, and withholds representations that cannot yet satisfy the declared contract.

## Physical schema and transaction records

engineering/001_foundation.sql defines the 26 entity tables and supporting tenant, command_receipt, outbox, consumer_receipt and record_revision tables. Composite tenant-and-ID foreign keys guard core references. Row-level security is enabled and forced on entity and transaction tables. Runtime grants, identity provisioning, specialised indexes, household and service-directory reference tables, and production migration sequencing remain explicit implementation work.

Provision the tenant catalogue through a restricted administrative role; application runtime has no general read or write access to it. Runtime must be a non-owner role without BYPASSRLS. Set the verified tenant with transaction-local state. Connection pools must not leak scope across requests. Tenant RLS alone does not enforce person relationships, purpose or clinical credentials; those remain service policy checks. Test all of these using the actual deployed role.

## Revision and provenance rules

1. Assign a UUID independently of any external patient identifier. Never derive identity from a name, phone number or model response.

2. Record source system, author, observed time, recorded time, source document and transformation version as applicable. Imported and measured values remain distinguishable.

3. Confirming a fact preserves a revision. A correction appends a new revision and reason. Update the current pointer optimistically while retaining original content under the approved custody policy.

4. Bind action inputs to resource ID and version. If a correction affects a queued action, invalidate its approval and recalculate eligibility. Accepted destination records require explicit repair work.

5. Maintain lineage from source fact to canonical value to destination field and business receipt. An exported report records its definition, period, filter and source-as-of time.

## Terminology and missingness

Use coded concepts with a declared system and version where available; retain the original local code when mapping. Unit conversion requires dimensional compatibility and tested precision rules. Missing, refused, not asked and not applicable are distinct absence codes. They never become zero, false or a normal clinical result. A programme requiring a specific attestation must receive that attestation rather than an inferred equivalent.

## Media custody and lifecycle

The relational record stores an opaque object reference, digest, size, media type, acquisition provenance and lifecycle status. An upload reservation limits type and size and expires. Completion verifies digest and malware policy where applicable before eligibility for AI. Access uses short-lived scoped tickets after current policy checks; tickets are not logged. Provider delivery must match the approved retention and processing terms.

## Retention and disposal

| Class | Retention decision | Disposition evidence |
| --- | --- | --- |
| Clinical records and revisions | Buyer and privacy owner approve the applicable record schedule and holds | Authorised disposal ledger or custody transfer; no arbitrary universal number |
| Raw media | Shortest approved period consistent with purpose and clinical obligations | Remove object versions, derived copies and cache references as applicable |
| Audit and receipts | Separate accountability and legal schedule | Restricted retention with integrity and retrieval tests |
| Device cache | Within lease and acknowledged work policy | Secure cleanup without deleting unacknowledged work |
| Exports and support extracts | Purpose-limited short availability and controlled retention | Expiry, recipient record and disposal confirmation |
| Backups | Approved rotation and recovery window | Deletion propagates through documented expiry or controlled restore reconciliation |

## Migration and rollback

1. Inspect the actual legacy schema and authorised custody boundary. Profile duplicates, missing identifiers, units, coding and timestamp quality without exporting unnecessary records.

2. Prepare a mapping manifest and quarantine unresolved identity or semantic matches. Preserve the source reference and import batch ID.

3. Use additive schema changes first. Deploy readers that tolerate old and new versions, then backfill through idempotent batches with counts and checksums.

4. Validate row totals, key uniqueness, cross-person references, consent scope and clinical samples with owners. Reconcile imported destination receipts independently.

5. Switch traffic behind a versioned configuration and monitor rejection and conflict rates. Roll back the compatible reader or configuration when safe; never drop new clinical records to simulate rollback.

6. Retain a signed migration evidence package and unresolved-record owners. Test restore and replay in isolation before approving the production migration.

## Schema verification boundary

The supplied DDL is a foundation blueprint. Its native execution, runtime grants, query plans, backup behaviour and upgrade/downward-compatibility paths have not been proven by the document pack. The engineering plan requires these tests before G4. JSON schema validation also cannot replace clinical semantic review or the selected ABDM profile validator.

## Sources and related artefacts

S01 BRD v1.1 Health-AI-Orchestration-Platform-BRD-v1.1.docx — Product source of authority; 176 requirements and 12 journeys

S02 NRCeS ABDM FHIR guide https://nrces.in/ndhm/fhir/r4/ — Published guide retrieved 26 September 2026 shows version 6.5.0 on FHIR R4; pin deployment package at onboarding

S04 PostgreSQL row security https://www.postgresql.org/docs/current/ddl-rowsecurity.html — Database row security is defence in depth; trusted service role and record-level policy remain necessary

Companion workbook: Health-AI-Delivery-Control-Workbook-v1.0.xlsx. Machine-readable contracts and reference checks: engineering folder. Requirements and test IDs are stable across the pack. Open decisions remain in the Decisions sheet; no document changes their approval status.
