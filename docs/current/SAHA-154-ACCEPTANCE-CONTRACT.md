# SAHA-154 approved local acceptance contract

Version: `1.0`
Decision date: 20 October 2026
Story: `SAHA-154` / `APL-177` / `CWO-014`
Source snapshot: `docs/verification/saha154-apl177-contract-snapshot.json`

Source snapshot SHA-256: `7daa9f2e7aea4c364228da611911bed1dd528c60cbdd33664000867e89a3fcc5`

The product sponsor explicitly approved the proposed APL-177 acceptance criteria in the delivery chat on 20 October 2026. This record binds that approval to the exact local planning snapshot above. It does not change the historical snapshot or claim recovery of the unavailable original CWO narrative.

## Frozen application behavior

1. An organisation owner may offer a bounded optional assignment only to an active ASHA who currently belongs to the named team. The invitation records the assignment, evidence request, and due time. It records no real rate, provider, bank detail, approval, settlement, or payment promise.
2. The invited worker can inspect, accept, decline, or ignore the assignment. Declining or ignoring it leaves routine care, patient access, existing tasks, claims, schedules, and payment state unchanged.
3. Only the currently eligible invited worker can submit evidence. Evidence corrections append a new active revision while retaining earlier revisions. Withdrawal retains the revision as inactive history. The owner may cancel an open assignment without deleting the worker's choice or evidence history.
4. Every read and transition enforces current organisation, worker, role, team, and assignment scope. Changed or revoked authority removes access. Invalid input is refused without mutation.
5. Writes are version checked. A stale concurrent write returns a conflict. Saved-command replay must re-authorize current membership and must not duplicate a transition.
6. Unavailable or uncertain assignment state remains unresolved and visible as such. Routine work remains usable. No assignment action fabricates a claim, approval, rate, provider action, or payment.
7. Audit records identify the transition and assignment without copying patient content or free-text evidence into audit detail. State remains bounded.

## Required synthetic evidence

- Positive: offer, inspect, accept, submit evidence, append a correction, withdraw evidence, and cancel.
- Refusal: decline and ignore preserve routine work; non-owner offer, wrong worker, wrong team, inactive membership, closed-state, invalid-input, and out-of-scope reads/writes are refused.
- Error and recovery: stale versions conflict; evidence revisions and withdrawals preserve history; saved replay rechecks authority and does not duplicate state.
- Boundary: assertions demonstrate that assignment activity creates no incentive schedule, claim, approval, provider dispatch, or payment state.

## Separate gates

This approval freezes the local application contract. It does not provide independent code review, exact-source CI, formal catalogue acceptance, domain or clinical approval for real use, merge authority, provider activation, a rate decision, payment authorization, or observed deployment evidence.
