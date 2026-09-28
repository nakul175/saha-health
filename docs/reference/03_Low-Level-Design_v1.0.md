# Original target design — 03_Low-Level-Design_v1.0

Unchanged design content transcribed from the archived v1.0 Word file. This is a target specification, not an R11 implementation claim. See the [current index](../current/DOCUMENTATION-INDEX.md).

[Original editable file](../history/v1.0/03_Low-Level-Design_v1.0.docx)

Low Level Design

Detailed state, transaction and failure-handling rules for implementation and technical review.

| Document | Baseline | Status |
| --- | --- | --- |
| HAO 03 · Version 1.0 | BRD v1.1 · 26 September 2026 | Proposed for review |

This document expands the existing BRD. Source requirements retain their priority and release labels. Architecture choices are proposals until the named owners accept them. Specified behaviour, implemented behaviour and executed evidence are separate statuses.

## Command processing contract

All mutations enter through a typed command handler. Derive tenant, actor and active role from a verified session. Reject unexpected request fields. Resolve target resources within tenant and relationship scope before revealing their existence. For an update, If-Match carries the exact resource version. The Idempotency-Key is scoped by tenant, actor and command name; reuse with different canonical bytes returns a conflict.

handle(command, session):

  verify_session_and_schema(command, session)

  begin transaction

  set_local_verified_tenant(session.tenant)

  claim_idempotency_key_or_return_matching_receipt()

  lock_target_and_check_expected_version()

  evaluate_current_policy_and_state_guard()

  append_revision_and_apply_transition()

  append_redacted_audit_and_outbox_event()

  persist_command_receipt()

  commit

  return platform_receipt

A concurrent claim on the same key waits for the first transaction or returns its committed receipt. A database failure before commit yields no accepted command. The client can retry the same key to resolve an uncertain response. A platform receipt reports durable command acceptance, not an external destination receipt.

## Resource state machines

### Encounter

| From | Event | To | Guard |
| --- | --- | --- | --- |
| draft | confirm | confirmed | Worker confirms person and facts; expected version matches |
| confirmed | amend | confirmed | Append revision; invalidate affected pending approvals |
| draft | void | void | Reason required; preserve local audit |
| confirmed | void | void | Authorised correction review; accepted external records require repair |

### Submission

| From | Event | To | Guard |
| --- | --- | --- | --- |
| prepared | authorise | authorised | Approval hash and policy decision bound |
| authorised | enqueue | queued | Payload validated; consent and input versions current |
| queued | dispatch | sent | Worker holds action lease; stable external reference |
| sent | accept | accepted | Destination business receipt verified |
| sent | reject | rejected | Business rejection recorded |
| sent | timeout | uncertain | Outcome unknown; do not resubmit blindly |
| uncertain | reconcile accept | accepted | Evidence ties receipt to exact logical action |
| uncertain | reconcile absent | queued | Destination proves no acceptance and policy remains valid |
| rejected | correct | prepared | New payload revision and review; previous attempt retained |

### Ai Request

| From | Event | To | Guard |
| --- | --- | --- | --- |
| prepared | admit | queued | Eligible pinned capability; budget reserved |
| queued | dispatch | running | Authority rechecked; input payload validated |
| running | valid result | succeeded | Schema, correlation and intended-use validation pass |
| running | quality failure | unable_to_assess | No clinical negative inferred |
| running | timeout | failed | Deadline passed; attempt accounted |
| queued | cancel | cancelled | Provider not yet invoked |
| running | cancel request | cancelling | Best effort cancellation; keep actual provider outcome |
| cancelling | acknowledge | cancelled | Provider confirms cancellation or broker records completed cleanup |

### Referral

| From | Event | To | Guard |
| --- | --- | --- | --- |
| proposed | authorise | authorised | Qualified actor where required |
| authorised | send | sent | Destination known and disclosure permitted |
| sent | acknowledge | received | Receiving service evidence |
| received | schedule | scheduled | Appointment reference |
| scheduled | attend | attended | Attendance evidence |
| attended | complete | completed | Service outcome evidence and accountable verifier |
| sent | unresolved close | unresolved | Approved coded reason, responsible actor and follow-up disposition |

### Consent

| From | Event | To | Guard |
| --- | --- | --- | --- |
| requested | approve | active | Authenticated artefact and exact scope |
| requested | deny | denied | Denial received |
| active | withdraw | revoked | Block new disclosure and dispose queues |
| active | time expiry | expired | Server clock exceeds expiry |
| active | replace | superseded | New authority scope requires new artefact |

### Capability

| From | Event | To | Guard |
| --- | --- | --- | --- |
| registered | technical review | verified | Contract tests and provider identity |
| verified | review | under_review | Evidence and data-use review |
| under_review | approve | approved | Named independent approval for scope |
| approved | activate | active | Deployment policy and compatible version |
| active | suspend | suspended | Incident or version incompatibility |
| suspended | reapprove | approved | Corrective evidence reviewed |
| active | retire | retired | No new calls; history retained |

The tables describe allowed core paths. States named in a resource schema but not linked here are reserved dispositions and must not be entered through an undocumented transition. Late results after cancellation are retained as evidence and handled by explicit reconciliation; they do not automatically restart cancelled care actions.

## Question assembly and reuse

1. Load active programme packs and the person’s permitted episode context. Expand only rules whose eligibility inputs are known; an unknown input creates a question rather than false eligibility.

2. Create requirement keys from concept system and code, person, episode, effective-time rule, unit dimension, source and verification requirement. Merge only questions declared equivalent by an approved mapping.

3. Search confirmed observations within each rule’s freshness interval. Preserve original measurement time. Convert compatible units through a versioned tested conversion and retain both the original and normalised representation.

4. Reject a candidate that is stale, disputed, wrong-episode, unverified or outside the permitted purpose. Present multiple clinically distinct observations separately.

5. Ask unresolved shared questions once. Retain programme-specific attestations and any required per-programme review. On amendment, recompute impacted eligibility and pending action snapshots.

## Plan approval and execution

An approval binds tenant, person, encounter revision, action IDs, exact input resource versions, payload hashes, recipient IDs, purpose, model or connector versions and expiry. Canonical JSON uses deterministic key ordering and a defined number representation; hash the canonical bytes using SHA-256. Hashes are integrity references, not anonymisation. The executor independently checks both the hash and current policy.

1. The planner can request only registered tools with closed schemas. Validate its output, allowed action classes and dependency graph; reject cycles and unknown tools.

2. Calculate the minimum fields and authority per action. Prepare the disclosure and cost preview. A routine read may run under an existing permitted workflow; a consequential write requires the configured approval.

3. Persist approval against the snapshot. Before each dispatch, re-resolve assignment, person link, authority, model status, source freshness and remaining budget.

4. If any binding changed, mark the action blocked for renewed review. Do not silently substitute recipients or provider versions.

5. Persist the action checkpoint before calling a provider or destination. Use stable logical action identity and record every attempt. Resume only unfinished steps; preserve already accepted external effects.

## AI broker algorithm

Admission intersects deployment activation, intended use, population, input quality, actor scope, authority, region and budget. The broker pins a manifest and provider release. It reserves a maximum permitted charge in a ledger transaction; actual settlement and release of unused reservation are idempotent. Timeouts retain the charge uncertainty until the provider contract resolves it.

1. Build a minimal input from confirmed resource revisions. Remove direct identifiers unless the approved capability contract explicitly requires them. Record fields sent and the authority snapshot.

2. Dispatch under per-provider concurrency and a deadline. For asynchronous results, authenticate the callback and check timestamp, replay token, request correlation, provider version and payload hash.

3. Validate the output against the pinned schema and intended-use result vocabulary. Distinguish quality failure, unable to assess, clinical finding and transport failure.

4. Store independent results and their limitations. Disagreement creates a human review task. A composition rule must have its own approved evidence before producing a combined clinical recommendation.

5. Settle the invocation state and budget once. Duplicate callbacks have no duplicate clinical or financial effects. Suspension blocks new calls and identifies unfinished dependent plans.

## Destination adapter and reconciliation

dispatch(action):

  lock_and_lease(action)

  revalidate_policy_approval_inputs_and_mapping()

  payload = transform_and_validate_exact_snapshot()

  checkpoint_attempt_with_stable_logical_reference()

  response = destination.send(payload)

  if verified_business_receipt(response): accept()

  elif definitive_business_rejection(response): reject()

  else: mark_uncertain_and_schedule_lookup()

reconcile(action):

  evidence = destination.lookup(action.logical_reference)

  if verified_acceptance(evidence): accept_without_resending()

  elif proven_nonacceptance(evidence): revalidate_then_queue()

  else: keep_uncertain_and_assign_manual_owner()

Worker lease expiry does not itself permit another external write. A new worker first inspects the previous attempt and reconciles any possible side effect. A destination without reliable lookup or idempotent write semantics is ineligible for unattended replay. Business correction creates a new payload revision and appropriate approval; it does not overwrite the original receipt.

## Offline lease and synchronisation

Store the device encryption key using supported platform key protection. A server-signed lease limits person scope, actions, purpose, policy version and expiry. The client uses a trusted elapsed-time anchor as well as server time; suspicious time rollback or reboot without a trusted anchor locks private content until renewal. Remote revocation takes effect on the server immediately and on a disconnected device when it reconnects or its lease expires; do not claim instant offline revocation.

1. Commit a local draft, command and dependency record atomically before reporting Saved on device. Media uses resumable chunks and a final digest; incomplete uploads cannot enter a clinical AI call.

2. Sync a bounded batch with stable command IDs, device sequence, base version, payload digest and dependencies. Reject cross-device or cross-tenant payload references.

3. Process valid causal predecessors first. Return accepted, duplicate, conflict, rejected or dependency_pending for each item. A failed item does not erase accepted siblings.

4. Recheck current server authority before external disclosure. An expired lease may permit an authorised recovery process for existing drafts, but cannot authorise stale AI or destination actions.

5. Retain local records until their durable server receipt is committed locally. Clean up only acknowledged eligible media under retention policy. A full disk blocks new capture with clear recovery instructions.

## Conflict and identity correction

Optimistic concurrency protects mutable resource pointers. Confirmed facts use immutable revisions. A concurrent candidate that differs in meaning or effective time can be retained as a separate observation; competing corrections to the same fact create a conflict requiring an accountable reviewer. Last writer wins is prohibited for patient identity, confirmed facts, authority and action approvals.

Correcting an identifier link supersedes it rather than merging persons automatically. Freeze affected pending disclosures, enumerate dependent records and external actions, ask a steward to confirm ownership, and create destination-specific repair work. Restrict exposure during investigation. The history keeps the original attribution and the correction reason.

## Projection and audit consumers

The outbox publisher delivers at least once. Consumers insert a unique tenant plus consumer plus event ID receipt in the same transaction as their projection change. Track aggregate version and defer an event that requires a missing predecessor. Rebuild projections from retained revisions or a versioned event snapshot; reconcile against source receipts before showing a report as complete.

Audit events record actor, action, resource revision, purpose, policy result, correlation and evidence references. Clinical payload is stored only in the authorised record store. Hash chaining or signed periodic manifests may support tamper detection, but does not replace append-only runtime access, separated storage permissions and restoration checks.

## Implementation limits

The reference checks exercise policy and state invariants in memory. They do not implement the database transaction, device key custody, real cryptography, provider billing, clinical protocol or network adapter. Native PostgreSQL execution, full OpenAPI toolchain validation and deployment-specific FHIR validation remain engineering gates. Administrative workforce lifecycle uses the chosen institutional identity provider; its provisioning contract must be pinned during WP01.

## Sources and related artefacts

S01 BRD v1.1 Health-AI-Orchestration-Platform-BRD-v1.1.docx — Product source of authority; 176 requirements and 12 journeys

S03 OpenAPI Specification 3.1.1 https://spec.openapis.org/oas/v3.1.1.html — Selected contract format for this pack, not a claim to use the newest OAS release

S04 PostgreSQL row security https://www.postgresql.org/docs/current/ddl-rowsecurity.html — Database row security is defence in depth; trusted service role and record-level policy remain necessary

Companion workbook: Health-AI-Delivery-Control-Workbook-v1.0.xlsx. Machine-readable contracts and reference checks: engineering folder. Requirements and test IDs are stable across the pack. Open decisions remain in the Decisions sheet; no document changes their approval status.
