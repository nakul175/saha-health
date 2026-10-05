# Unified reconciliation queue and historical task backfill

5 October 2026 (IST). R27 / BR-DATA-06. Synthetic data only; formal acceptance unchanged.

## What changed

Care handover now includes a reachable Reconciliation panel combining open visit-correction tasks and identity-merge impact items. The new `POST /api/reconciliation` read supports a patient filter, My assignments, 50-item pages and opaque hashed cursors; a changed queue restarts paging. Current care access is applied to each item. A merge item is shown only when the viewer has normal access to both records; hidden items never contribute to returned totals. Material-read audit events for every returned patient's record, including both merge records, must be recorded before the response. An audit failure refuses the whole read.

Four commands use the existing authenticated `/api/commands` pipeline and replay/commit guards:

- `assignReconciliationTask`: checks operator authority, current task state and expected assignment history/owner; the assignee must be active and have normal access to every affected record. Merge responsibility requires a clinician or supervisor steward. Appends assignment history with reason and replaces the current in-app assignment notice.
- `acknowledgeReconciliationTask`: the current notice recipient acknowledges it while they still hold care scope. Assignment notices are visible in My assignments and disappear from that view as soon as access is lost.
- `previewReconciliationBackfill`: explicitly previews missing downstream tasks for a selected patient's historical amended/voided visits that have no task collection. It records the read and returns a plan hash and task descriptions without changing tasks.
- `applyReconciliationBackfill`: re-derives the plan against current visit/child versions, patient version and downstream obligations; a mismatch is refused. It appends tasks using the existing correction derivation, deterministic task ids and a provenance marker on each visit. Applying the same plan under another request key does not append another set. Existing task collections are never replaced. More than 100 eligible visits requires a separate staged reviewed migration.

Assignment and backfill append audit/revision evidence and leave receipts and confirmed history intact. The original verified-receipt/reason correction closure and identity-impact resolution paths remain responsible for outcomes. This queue never sends, resends, recalls, retries, or automatically closes external work. Its record links lead back to the existing evidence and review screens.

## Evidence

`tests/reconciliation-http.mjs` starts the actual built Worker with an isolated fresh local D1 database. Sixteen checks passed: unified queue and chained read audit, administrator/ASHA scope refusal, hidden merge counterpart and counts, stale cursor reset, command replay, assignment notice and acknowledgement, stale/unauthorised assignment, steward ownership, cross-site refusal, unchanged open obligations, historical read-only preview, stale plan refusal, reviewed apply/new-key replay, existing-task preservation, immediate scope revocation, and fail-closed read audit.

Focused regression: merge contract 27 checks, correction-tasks contract 13, safe-logs contract 13. TypeScript `--noEmit`, the Vinext production build and `git diff --check` passed. Additional storage/import results are recorded alongside the HTTP report in `tests/evidence/reconciliation/`.

## Limits and integration

Notifications are a scoped assignment notice in the reachable reconciliation panel, not a new SMS/email channel or system-wide alert occurrence; no recipient outside Saha is contacted. The queue currently loads organisation state before applying scope and paging, so large-tenant performance is unmeasured. A preview reconstructs obligations from retained current records and cannot recover missing historical destination evidence. Existing tasks are not regenerated, and historical amendments with missing successor links are refused for human review. Policy approvals, real-world reconciliation acceptance, independent accessibility/security review and external corrections remain pending.

No new migration or certified patient-partitioned command is added. Assignment can affect an identity case involving two records, so these commands retain the organisation-wide commit guard. One HTTP method/route handler is added. The integrator must register the HTTP suite in the test catalogue, update the implementation boundary, BR-DATA-06 assessment/evidence, next-delivery entry and dated validation, and regenerate documentation/baseline checks.
