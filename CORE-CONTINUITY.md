# Local identity and care continuity — Release 10

## Registration and identity

A care worker searches the records that their current membership permits them to see. The server compares Unicode-normalised names (preserving combining marks). Exact names produce candidates even if other demographics differ; approximate names require compatible age, sex and locality. This is a small local heuristic, not a validated master patient index, ABHA verification or proof that two records belong to one person.

Candidate sets bind to the entered demographics and current candidate versions. Hidden records do not alter the displayed set or fingerprint. A changed set or edited form requires a fresh search. More than twenty candidates blocks registration. No result is automatically merged, and no-match means only that no candidate was found within the user's permitted records.

When a possible match exists, the worker can open it, record that the new person is distinct with a reason, or retain a separate provisional record. Provisional identities allow draft capture but block visit confirmation, patient-specific AI execution, new referrals, programme delivery, EHR disclosure and reminder creation/approval/simulation. A clinician with current patient access records an evidence reference and findings to resolve the provisional identity. This is a local review; external identity verification remains separate. Revision history retains the earlier registration decision.

Visit confirmation requires a positive patient check bound to the current patient ID and version. The server records actor and time on the confirmed visit. Wrong-person and stale-version checks fail. The checkbox clears when patient or visit context changes. Older confirmed visits are preserved without fabricated retrospective confirmation metadata. API clients must now supply `patientCheck: { personId, personVersion, confirmed: true }` to `confirmVisit`.

## Reassignment and acknowledgement

An authorised owner or supervisor can change the patient's team and assigned care worker. The receiving worker must be active, in that team and permitted a care role. The same optimistic transaction moves every open programme follow-up, incomplete referral, unfinished outreach item and open message-recovery task to that worker. It records the prior and new assignments, effective timestamp, author, reason and number of moved tasks. Completed work and existing receipt histories remain unchanged.

Open work cannot be left without a responsible worker. Any actual assignment change revokes active field grants and cancels draft, approved or failed reminders so their context can be reviewed again. A previously sent or simulated receipt is retained. The latest handover remains in the exception queue until its current receiving worker acknowledges it with evidence. Earlier handovers remain in patient history. One patient is limited to 100 assignment events until a reviewed archival policy is implemented.

The care-handover view derives exceptions from current permissions: provisional identity, unavailable task owners, or an unacknowledged current assignment. Suspending a worker therefore exposes their affected tasks immediately to a scoped supervisor without pretending they have been reassigned. Historical outreach-plan team labels remain historical; item ownership and current patient access control the active work.

## Verification and limits

`tests/continuity-smoke.mjs` checks authenticated Worker/D1 behaviour, scope, stale candidate sets, provisional capture and blocks, clinician resolution, positive patient confirmation, atomic handover, replay, task-owner suspension and acknowledgement. `tests/continuity-contract.mjs` covers hidden-record fingerprints, Unicode normalisation, candidate overflow, preservation of completed work and receipts, and action gates. Encrypted recovery verifies the resulting stored metadata.

Households, proxy authority, provisional identity creation while fully disconnected, national identifiers, controlled record merge/unmerge, cross-organisation transfer, a governed matching policy and representative matching accuracy are not implemented by this release. These remain explicit rows in the requirements audit. No real patient, external identity service or receiving facility was used.
