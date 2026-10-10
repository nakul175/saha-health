# Low level design

## Current source reconciliation — 10 October 2026

This supplement applies to inspected main `7668a03d97c1ae62174f09e65ccd5a5717120be6` for the
11 October coding handoff. Read [the current engineering baseline](engineering-handoff/CURRENT-ENGINEERING-BASELINE.md)
for source pins and the distinction between main and the preserved D03 candidate. No runtime behavior, frozen
criterion, evidence receipt or approval is changed by this documentation revision.

### Actual request, mutation and recovery contract

1. [worker/index.ts](../../worker/index.ts) applies the cross-site gate. Routes resolve the configured trusted
   principal through [identity.ts](../../lib/saha/identity.ts) and [server.ts](../../lib/saha/server.ts).
   A browser-supplied role, author or identity header cannot grant application authority.
2. The command parser checks same-origin/fetch metadata, JSON content type, the existing 8–100-character operation
   key format and a 20,000-byte body, then validates `platformSchema`. `x-saha-organisation` selects context; active
   membership, person scope, purpose, versions and domain policy still decide permission.
3. Receipt recovery binds actor, exact key, organisation and payload hash. [The dispatcher](../../lib/saha/server.ts)
   reloads current access and command-specific authority before returning the saved result. Keep the unchanged
   request/key through an uncertain acknowledgement. Changed input under the same key conflicts; an old successful
   receipt is not continuing permission to disclose protected content.
4. [partition.ts](../../lib/saha/partition.ts) identifies certified patient-local commands and permitted side tables.
   [store.ts](../../lib/saha/store.ts) selects patient or organisation concurrency guards from the actual write set,
   then commits guarded domain rows, revisions, audit and the command receipt atomically. The audit-chain head has
   its own guarded conflict/rebuild behavior. A read-audit commit does not manufacture a clinical revision.
5. Responses may contain a full scoped `snapshot` or a certified `delta` plus `partition` when the client requests
   that shape. [mergeDelta](../../lib/saha/delta.ts) reconciles the affected patient collections. Receipt replay still
   obtains a fresh scoped snapshot. Client code must inspect the actual response rather than assume one shape.
6. External adapters retain their explicit checkpoint and outcome contracts. A timeout, lost response or changed
   permission does not prove that an external effect never happened. Use the existing lookup/reconciliation path;
   do not create a new operation key to conceal an uncertain effect.

`json()` marks application JSON responses `no-store` and `nosniff`; the generic unavailable contract in `error()`
returns 503 without an application stack or SQL disclosure. Feature routes may have additional validated query,
role and read-audit contracts. Inspect the owning route rather than apply a generic success/error shortcut.

### Bounded mobile slice boundary

Main's [GET /api/today](../../app/api/today/route.ts) uses [todayRead](../../lib/saha/today-server.ts): only
synthetic/training, active ASHA membership and assigned unmerged records; identity/detail reads are durably audited.
It introduces no routine-visit write. The preserved D03 candidate delegates `startVisit`, `saveVisit`,
`saveProgrammeAnswers` and `confirmVisit` to existing authority/version/audit logic and needs its unchanged frozen
A1–A10 qualification. Its separate `/routine-visit` route must not be presented as deployed main at this checkpoint.

Draft persistence, confirmed clinical state and destination acceptance remain separate. Keep exact person/visit,
source/time/unit, server author, pack versions and explicit conflict comparison. Opening a screen must not start a
visit. Saving after a failure must not acknowledge durability without authoritative readback. Prepared encrypted
restart retention and reconnect are subsequent D04/D05 contracts; local-save p95 ≤500 ms remains an unchanged
applicable source NFR, not a substitute for connected-server timing or physical-device qualification.

## Retained R11 design description

The remainder preserves the earlier edition. Its single organisation-guard and snapshot-only descriptions are
superseded by the current patient-partition/response contract above. Broader target state machines remain reference
design unless the selected source actually implements them.

# Low level design

This is the current command and persistence design. The [original LLD](../reference/03_Low-Level-Design_v1.0.md) retains broader target state machines, worker leases, observation equivalence, native offline behavior and event consumers that are not all implemented.

## Command lifecycle

1. `server.ts` establishes identity and validates origin/fetch metadata, JSON content type, a bounded 20,000-byte body and an 8–100 character idempotency key. `platformSchema` composes the domain command schemas.
2. A saved receipt is looked up by actor and key. Changed payloads or the wrong organisation conflict. Replay reloads current membership, patient scope and relevant command authority before returning saved results.
3. The server loads current organisation state and checks operating status, patient identity, role/team scope and domain-specific versions. Mutation version fields are in command payloads; the application does not implement the original universal `If-Match` REST contract.
4. Ordinary commands compute a candidate state, revisions and audit. `persist` performs an organisation compare-and-swap and guards dependent D1 batch writes with the transaction token. A lost guard cannot partially write the candidate.
5. Side-effecting executors persist their invocation/delivery checkpoint before transport. They recheck the relevant authority and record confirmed outcome, rejection or uncertainty. They do not turn a timeout into proof of no side effect.
6. The response includes a command result and fresh scoped snapshot. A response loss is resolved using the same key and unchanged payload; changed intent needs a new reviewed command after reconciliation.

## Record and workflow invariants

Confirmed visits retain their historical version. Amendment creates a separate linked draft. Wrong-person voiding preserves restricted evidence and blocks further actions. Patient correction and assignment changes invalidate affected pending work, while original accepted receipts remain attributable.

Plan approval binds patient/visit/consent and connector versions, destination set and payload hash, actor and expiry. Provider requests also bind the task, inputs and agent/model/capability context. R11 governance manifests are immutable revisions: review and activation re-evaluate owner/reviewer membership, dates and dependencies. Safety holds can block new use without deleting prior outputs.

The current referral state set is `draft`, `sent`, `received`, `completed`, with evidence and ownership guards. The target design also describes appointment/attendance/unresolved paths; those states must not be assumed to exist. The current submission states are declared in `lib/saha/types.ts`; durable execution metadata lives in the MIS contract.

## Recovery and concurrency

Exact duplicate commands replay the committed receipt only after current access checks. A stale version returns a conflict and keeps the user's unsaved edits available for explicit comparison. Field sync freezes its command key and payload across uncertain response recovery; it does not invent a new key to hide uncertainty.

Maintenance blocks new consequential work while preserving allowed reads, withdrawals, cancellations and receipt lookup. A provider call already checkpointed may still complete. Final external receipts must be retained even when permission changes in flight; revocation is not a remote cancellation guarantee.

Apply migrations in order; never rewrite applied files or snapshots. Legacy aggregate backfill is guarded and retains source hash/count evidence. Returning the application to v0.1 and resuming writes would fork history; use a compatible roll-forward or a separately governed recovery instead.

The executable schemas, domain modules and tests are the exact contract. [API inventory](CURRENT-API-INVENTORY.md), [data dictionary](CURRENT-DATA-DICTIONARY.md) and the root MIS/EHR/agent documents give the concrete interfaces.
