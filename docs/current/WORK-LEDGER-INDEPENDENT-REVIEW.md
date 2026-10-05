# Independent protected work-ledger review

5 October 2026. Read-only production-source review against canonical `237497f6`, with fresh isolated build and synthetic local evidence. No hosted, physical-device or pilot acceptance claim.

## Grounded P2: own support item hidden by unrelated queue traffic

`lib/saha/work-support-server.ts:45` applies the latest-51 limit before line46 filters a non-operator to their own requester/helper workflows. In the actual Worker/D1 reproduction, a current non-owner clinician initially sees their own pending request. After51 newer unrelated owner requests on the same scoped visit, the same worker receives an empty queue with overflow=true although their own request remains durable. The normal UI cannot reach that existing request to continue assistance. No forged role or scope bypass is used.

Apply the current requester/helper visibility predicate in SQL before ORDER/LIMIT. Operators retain their authorized complete queue. Overflow must describe the authorized set, and current scope/audit-before-disclosure must remain intact. Keep the bounded51/50 policy. Regress own request and own helper latest sequence across unrelated newer records, plus genuine own overflow and scope withdrawal.

Evidence: `tests/work-burden-ledger-adversarial-review.mjs` and `tests/evidence/work-ledger-independent-review/support-visibility-before-limit.json`. The reproducer intentionally asserts the original defect; a repaired implementation will require a separate positive regression. Original unmodified author contract14, actual Worker/D1 HTTP19 and phone Chromium11 checks all passed independently before this adversarial probe. Independent result copies are preserved here; author reports remain unchanged.

The0026 continuation/migration review is active separately and is not approved by this finding batch. No production edits are included.
