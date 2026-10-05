# Support workflow visibility race

5 October2026. After the separately verified offered-helper repair0e28550e, an actual Worker/D1 probe models an allowed pre-attestation reassignment during the support read audit.

The request is originally owned by one care worker and currently assigned to a different non-operator care helper. The helper selects their authorized latest sequence2. A synthetic AFTER-audit trigger appends the valid next assignment sequence3 to another active scoped care helper. The fresh reader role/owner/patient checks still pass, so the former helper receives200 with the old private request sequence2/helperId. The current durable latest assignment is elsewhere. Initial patient access does not imply continued requester/helper workflow visibility.

This is a grounded P2 metadata-disclosure race at `lib/saha/work-support-server.ts:45`/47. The current workflow membership predicate is not repeated after audit. The trigger intentionally models the allowed assignment transition in the disposable database; it does not claim an unauthorized application write or expose clinical facts.

Recheck the authorized latest workflow set after the audited current actor/patient check. Preserve visibility-before-limit,50/51 overflow semantics and historical workflow rows. If a changed snapshot is returned, its actual count must receive durable audit before disclosure; a bounded stability loop or fail-closed changed-snapshot refusal can achieve this. Avoid silently returning pre-audit rows or filtering only the former selection after limit, which can hide other eligible latest requests.

The20-check reproduction retains the18 positive queue/helper checks and intentionally asserts old race behavior; preserve it as direct-only historical evidence after repair. Results and hashes live in tests/evidence/work-ledger-independent-review/support-current-workflow-race. No production changes are included in this evidence batch.
