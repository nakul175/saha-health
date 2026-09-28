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
