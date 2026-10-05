# Independent support visibility repair review

5 October2026. Production-source deltaed10fcd1 cherry-picked alone onto the isolated existing ledger review source. Fresh build and actual original11-check positive Worker/D1 suite pass. The original deliberate-bug driver remains unchanged as historical direct-only evidence; it is not a positive regression on repaired source.

The requester/helper visibility predicate now runs before ORDER/LIMIT. A non-owner's own request and assigned helper queue remain reachable after51 unrelated workflows; genuine authorized overflow still returns50 with an explicit flag, unrelated workers receive no unrelated rows or false overflow, and assign/attest/ack, stable ordering, audit failure and patient withdrawal pass.

## Additional grounded P2: current helper choices stale across audit

`lib/saha/work-support-server.ts:46` constructs helpers from the initial membership snapshot. Line47 reloads the requesting actor and patient after audit but returns those old helper choices. An actual D1 AFTER-audit trigger suspends a different offered helper. The response still returns200 and advertises that helper although the current membership is suspended. Assigning the advertised helper correctly refuses403 and creates no unauthorized workflow event. The defect is stale current selection guidance, not an authorization bypass.

Derive helper candidates from the fresh members and fresh scoped patient after the audit/check, or explicitly refuse a changed helper policy. Preserve historical workflow IDs/state and the repaired actor-visible bound; old assistance evidence does not need to disappear. Add a positive regression for both helper membership withdrawal and patient-scope loss during the audit window.

The independent13-check race probe preserves the author11 checks and intentionally asserts this additional old behavior. It should remain a direct-only historical diagnostic after repair, with a separate positive repaired test. Reports and hashes are in `tests/evidence/work-ledger-independent-review/`. No production-source edit or acceptance promotion is included.
