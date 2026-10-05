# Independent review of workspace response metadata batching

Reviewed source commit 21771ceb, integrated as 2a05652f, in an isolated review worktree on 2026-10-05. This reviewer did not author this metadata batch. No actionable new defect was found within the reviewed change.

The extracted audit query and projection preserve the original SELECT, active membership join, organisation bind, patient/team/ASHA visibility predicates, summary exclusions, cursor bind order, 101-row sentinel and output shape. The standalone audit route still issues the same one query. The other two statements preserve active organisation membership and legacy migration projections. Metadata batching introduces no cached membership, patient visibility expansion, durable write, command receipt or revision change.

The bundled local Miniflare D1 engine executes its query array inside `storage.transactionSync` (installed miniflare4.20260515.0 `dist/src/workers/d1/database.worker.js`, `#txn`). Its three decoration SELECTs therefore share a transaction view; the former separate calls could observe different intervening metadata versions. This is an intended local consistency improvement, not a claim that these decorations revalidate the already-loaded clinical snapshot or establish hosted request isolation.

`loadFor` still awaits its existing record-window audit and durable `recordWorkspaceLoad` commit before returning state. `snapshot` still awaits that loader before calling `snapshotFor`; the batch is constructed later. Replay and command paths retain their existing access-audit calls. The change touches no access-audit writer, retry, authorization, full-record projection or metrics code. A failure in the awaited material access audit still prevents delivery of the full record. This review concerns preservation of those existing boundaries, not independent approval of unrelated read-route changes.

Independent checks passed:

- Historical SQL/projection oracle147:20 role/owner/status combinations,80 cursor/summary variants, exact bindings, fresh removed-team/unknown-member behavior, pagination and batch refusal.
- Existing material read-audit52, scoped-read27 and audit-query-plan12.
- Fresh framework build and20 actual isolated no-inspector Worker/D1 HTTP checks. Successful workspace loads retain user/organisation/migration/Activity output, append one access event and move no clinical revision or command receipt. An injected workspace audit trigger refuses with503 and no patient `people` property; recovery succeeds. Existing200/503 metric counts remain exact.

Dedicated copies of the independently rerun147/20 evidence are under `tests/evidence/workspace-metadata-independent-review/`. The unit oracle uses migrated SQLite through a D1-shaped API; the HTTP run uses actual local Miniflare D1. Neither is a hosted acceptance, workload benchmark, memory plateau, native graph ownership or O2 closure result. No provider was activated. Auxiliary full-record read-audit changes and this reviewer's own availability work are outside this independent review.
