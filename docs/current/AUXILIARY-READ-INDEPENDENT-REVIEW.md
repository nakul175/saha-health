# Independent auxiliary-read audit review

Reviewed the lead's changes to continuity, referral escalations and action-plan reads on 2026-10-05, using an isolated checkout at 2a05652f plus copied uncommitted files. The lead checkout was read-only throughout.

A P2 interaction was confirmed in the built Worker with actual local D1: the original action-plan audit used `viewPatientRecord`, so the 12-hour window-read lookup treated derived work as a prior full-record access. With 507 synthetic patients and a full-record audit-write fault active, the window correctly returned zero patients before a plan read. After a successful plan read, the same window returned one full patient despite the fault, without attempting its full-record audit. The only patient event described an action plan. Historical evidence is preserved in `window-interaction.json`.

The lead changed the derived event to distinct `viewActionPlan` in the action registry and typed names. An independent rebuild and the identical HTTP sequence then returned zero patients both before and after the action-plan read while the full-record audit fault remained active. The distinct plan event was still durably recorded. Fixed evidence is `window-interaction-fixed.json`.

The lead's revised populated auxiliary-read HTTP suite independently passed all **15 checks** on separate local ports/D1 state: successful and empty responses, count-only chained details, administrator refusal before audit, ASHA and removed-team refusals, actual durable-audit faults with no patient response, and recovery. The populated queues returned patient data while event details excluded the synthetic name/locality. Evidence is `populated-http.json`.

The source changes retain existing scope calculations; all derived results are computed before an awaited access commit and returned afterward. Details use fixed view labels, counts and permitted identifiers, with existing access-route/authority metadata. No facts, names or free-form patient text are added to details. No further actionable finding was identified in this bounded review. Other routes, hosted operation and clinical acceptance were not requalified.

The copied implementation/test files were restored/removed after review; only this document and aggregate evidence are committed. The diagnostic builds were removed to avoid serving a bundle that differs from the restored source.
