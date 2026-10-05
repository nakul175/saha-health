# Workspace response metadata batching

On 2026-10-05, workspace responses changed from three independent D1 calls to one batch containing the same three read statements. This reduces service-boundary work without caching authority, skipping audit events, or changing collection settings. O-2 remains open; no performance or memory plateau claim is made.

## Before/after contract

At baseline 23cbcf89, `snapshotFor` sequentially read:

1. The caller's active organisation memberships, joined to organisation names, ordered by creation time.
2. The current organisation's legacy migration date and counts.
3. The default Activity page, with its fresh active-membership join, patient/team/ASHA predicates, summary exclusions, timestamp/id order and 101-row continuation sentinel.

`snapshotDecorations` now submits those identical bound statements in one D1 batch and projects the same output. The statements share one transaction view rather than three separate views. These are response decorations; no write, command receipt, revision guard or access-policy calculation moves into the batch. `accountCode` remains a digest, not a database read.

The direct audit route still uses one standalone statement. Both paths share the existing query builder and result projection, including cursor and summary behavior, avoiding a duplicated visibility predicate.

Workspace loading still waits for scheduled caseload evaluation, paging scope, record-window audits and the durable `viewWorkspace` access commit before constructing the decorated response. All identity, permission, scope, audit-chain retries, metrics and fail-closed behavior remain in their existing paths. Large organisation-state reads were already batched; changing fresh scope/chain checkpoints merely to save calls was excluded from this bounded change.

## Verification

The new contract uses actual SQLite migrations and a frozen pre-change SQL/projection fixture from 23cbcf89. It passed **147 checks**, including 20 role/owner/status combinations, 80 direct-audit cursor/summary combinations, exact SQL and bind parity, three-to-one D1-call counts with three statements retained, missing migrations, removed teams, unknown memberships, batch failure and 100-event pagination without repeats.

The built no-inspector Worker with actual local D1 passed **20 focused HTTP checks**: unchanged metadata and user shape, Activity parity with the direct route, summaries, one durable workspace audit per load, unchanged revisions/receipts, audit-write refusal without patient data, recovery and preserved success/failure metrics. The first HTTP run's final assertion incorrectly expected four successful workspace requests; the test makes three. Correcting that expectation produced the recorded passing result; no application change was needed.

Existing read-audit completion **52**, scoped-read **27** and audit-query-plan contracts passed. TypeScript and production build passed. Evidence is under `tests/evidence/workspace-metadata-batch/`. The new standalone contract and smoke runners require catalogue integration by the lead.

This is a measured reduction in D1 API calls at the helper boundary, not a measured reduction in RSS or native graphs. Memory qualification, isolate ownership, hosted limits and production acceptance are separate unfinished work. No provider was activated and all test records are synthetic.
