# Development slice 14c — withdrawal and EHR amendment through approval

4 October 2026 (IST). Remaining-work row R58: "Void/withdrawal path for programme submissions and EHR amendment/withdrawal through approval (mock partners)" (BR-INT-02, BR-RULE-04, BR-INT-21). Built on slices 2j (correction tasks), 5b/7e (programme delivery checkpoints and operation permissions), 6y (trace) and 7f (EHR receipts). Synthetic data only; formal acceptance unchanged.

## What changed

- **A withdrawal is its own record.** A care worker can ask a destination to withdraw (void) a record it accepted: a programme submission, or an EHR publication. For an EHR publication of an amended visit, the same path sends an amendment instead. Each one is stored on the visit whose output it withdraws (`Visit.withdrawals`, `lib/saha/withdrawal.ts`; no migration). It names the original by id and receipt. The original submission or publication, and its receipt, are never edited.
- **Prepared, approved, executed.** As for sharing plans:
  - `prepareWithdrawal` stores the exact payload and its SHA-256. Patient, target, `withdraw` or `amend`, a reason code (`wrong-patient`, `entered-in-error`, `corrected`) and a reason of 10–500 characters.
  - `approveWithdrawal` must quote that hash. The approval lasts 15 minutes.
  - `executeWithdrawal` is done by the approving person inside that window: one checkpoint commit before the request, one request, and the destination's own receipt (`lib/saha/withdrawal-execution.ts`).
  - `cancelWithdrawal` closes a withdrawal that was never sent.
  - Each step needs an ASHA or clinician with normal (not emergency-only) access to the patient. Administrators, other teams, owners outside the team and supervisors are refused; the same check runs on an idempotent replay.
- **Bound to what was reviewed.** Preparing records:
  - the patient's record and sharing-permission versions;
  - the visit's facts version and whether it is current, superseded or voided;
  - the destination connection's version, operation-setting version and route;
  - the original's accepted receipt;
  - for an amendment, also the correction visit, patient link, identity and EHR write permission.
  If any of these changes, approval and sending are refused before anything is sent; the withdrawal is cancelled and prepared again. The bindings are checked again on a fresh read inside the checkpoint. A change there closes the withdrawal as not sent and releases the attempt.
- **The destination must permit it.** A withdrawal needs the slice 7e operation `delete` ("delete or void"); an EHR amendment needs `update`. The release default permits neither, so an owner must allow it per connection.
  - The permission is checked when preparing, approving, before the checkpoint and inside it.
  - If it is withdrawn after approval, the withdrawal is closed as not sent, with the refusal on its record, the trace and the audit (`adapterOperationRefused`).
  - A destination without the permission gets no withdrawal: its correction task stays a manual correction with the destination.
- **Unknown outcomes are looked up, never resent.**
  - A withdrawal is sent once. Pressing send again, or replaying, returns its state.
  - A lost or non-matching answer leaves it `uncertain`. Only `lookupWithdrawal` resolves it, under the withdrawal's own key and at most 24 times.
  - A lookup that confirms nothing is held ends it as `not-stored`, nothing resent; a new withdrawal must be prepared and approved.
  - Lookups and cancellation stay available during maintenance.
- **Programme destinations.** The `saha-mis-v1` contract gains `operation: "withdraw"`. The payload carries `withdraws: {submissionKey, receipt}` and the reason code only: never the free-text reason or any visit fact.
  - HTTP connections send it through the existing programme adapter, with the withdrawal id as idempotency key. The receipt must echo that key and the payload hash. External services stay off unless a deployment enables them; no live call was made.
  - The two demonstration simulators answer in process. The maternal register accepts with its own receipt (`SIM-W-…`). The community MIS records the withdrawal but loses its response, so the withdrawal stays uncertain until a lookup finds the receipt. A simulator rejects a withdrawal of a receipt it never issued.
- **EHR connections** (HTTP only, no simulator).
  - A withdrawal is a conditional create of a notice document (identifier `urn:saha:withdrawals|<id>`). Its Composition is `entered-in-error` and `replaces` the published document's identifier. It names the external patient by id only and carries no visit content.
  - An amendment is the confirmed correction visit's document (identifier `urn:saha:documents|<id>`), which `replaces` the published one. It passes the same checks as a publication: current link, identity, write permission and date range, the outbound rule set, open disputes, sign-off, and (slice 13a) a purpose grant that includes care coordination.
  - A lookup searches the withdrawal's own identifier. Only one matching document equal to the one sent resolves it.
- **Correction tasks (slice 2j).** When a confirmed visit is marked wrong-patient, an accepted output whose destination permits `delete` now gets the task `send-withdrawal`. When a visit is amended, an accepted EHR publication whose connection permits `update` gets `send-correction`. Other destinations keep the manual correction.
  - When the destination confirms, the visit's open tasks for that output are closed with the verified receipt and an audit line. A withdrawal completes the tasks of a wrong-patient visit; an amendment those of an amended visit.
  - `closeCorrectionTask` also accepts that receipt by hand.
  - A void after a confirmed withdrawal adds no external task for that output.
- **Shown on the Receipts tab and in the trace.**
  - The visit's Receipts tab has a "Withdrawals and amendments" panel (English only). It prepares a withdrawal or amendment of each accepted output, shows the exact payload to approve, and offers approve, send, look up and cancel. It shows each record's state, original receipt, own receipt, who prepared and approved it, and the tasks it completed.
  - The visit trace (version 1.2.0) shows each withdrawal as its own thread, its steps linked to their commands and audit events. A redacted trace of a submission or publication also shows its withdrawals, without the receipt.
  - The adapter-operations panel now names the withdrawal and amendment paths.
- **Not guarded on purpose.** A withdrawal sends no new content, so a processing restriction (slice 6b), a purpose grant (slice 13a) or an open dispute does not stop it: these must not prevent undoing a wrong-patient disclosure. A withdrawal does not need the patient's current sharing permission, but a change of it after preparation still invalidates the approval. An amendment carries content and is guarded like a publication.

## Tests

- `tests/withdrawal-contract.mjs`: 63 checks. It runs the real modules, every `lib/saha` module transpiled, with an in-memory compare-and-swap store.
  - Command shapes, the `withdraw`→`delete` operation mapping, maintenance.
  - Refusals:
    - an administrator, another team, an owner outside the team or a supervisor preparing;
    - an unaccepted, unknown or not-permitted target;
    - a programme amendment.
  - The maternal simulator, end to end:
    - the exact payload and hash, the bindings and the audit;
    - a second open withdrawal refused;
    - a wrong hash, a wrong approver and an expired approval refused;
    - an accepted receipt, with the original submission byte-for-byte unchanged;
    - a checkpoint commit before the request;
    - a second press that sends nothing; no withdrawal after a confirmed one.
  - The community simulator: a lost response, no resend, and the lookup that finds the receipt.
  - Changes that block approval or sending: the patient record, the visit, the connection and the sharing permission.
  - The `delete` permission withdrawn before the checkpoint and inside it; a visit voided inside the checkpoint; cancellation.
  - The HTTP programme adapter, with an injected transport:
    - refused while external services are off;
    - the exact withdrawal body and idempotency key;
    - a receipt for another payload hash left uncertain; a `not_found` lookup with its own body and key;
    - a thrown request; a changed route; a rejection.
  - EHR, with an injected FHIR transport:
    - the notice's identifier, status, `replaces` link and minimised patient;
    - changed content left uncertain, then the lookup query and receipt;
    - the published record not edited; `delete` not permitted.
  - EHR amendment:
    - an unconfirmed correction visit refused; `update` not permitted refused; a purpose grant without care coordination refused;
    - the correction visit's document with its `replaces` link and bindings;
    - a correction visit changed after approval refused; the conditional create and receipt.
  - Correction tasks:
    - `send-withdrawal` and `send-correction` where permitted; manual otherwise;
    - completion with the verified receipt and its audit line; closing by hand with that receipt, a wrong one refused;
    - no task after a confirmed withdrawal.
  - The trace thread, its linked audit events and the redacted view.
  - Two deliberate mutations (supervisors allowed to act; the lost response removed) were each seen to fail the suite.
- `tests/withdrawal-smoke.mjs`, in its own organisation: 97 HTTP/D1 assertions over the built Worker.
  - Refusals of an administrator, another team's clinician, a non-member, a short reason and a programme amendment; an unknown EHR publication.
  - A visit marked wrong-patient after both simulators accepted it: two `send-withdrawal` tasks.
  - Maternal register:
    - prepare by the ASHA, the payload as stored, a second preparation refused;
    - a wrong hash, another team and an administrator refused at approval;
    - send refused before approval and by the non-approver;
    - the accepted receipt, the same-key replay and a second press;
    - the completed task, with the original submission unchanged.
  - Community MIS:
    - uncertain, a second press, another team's lookup and a cancellation refused;
    - the lookup's receipt, its task completed, a second lookup refused.
  - The trace (version 1.2.0, two withdrawal threads, linked events), the audit rows and the stored visit and submission rows.
  - A changed sharing permission refusing approval; the `delete` permission withdrawn after approval closing it as not sent; preparation refused without it.
- Browser check (a one-off Playwright script with Chromium against a built local Worker; not a repository suite):
  - On a wrong-patient visit, the Receipts tab panel prepared, approved and sent a withdrawal to the maternal register, which confirmed it.
  - The same was done for the community MIS: unknown outcome, then the receipt found by the panel's lookup.
  - The forms disappeared once each withdrawal was confirmed; there were no console errors.
  - Recorded in `tests/evidence/slice-14c/browser-withdrawal.json`. No axe audit was run.
- Existing suites changed: `tests/trace-smoke.mjs` expects trace version 1.2.0 (was 1.1.0). `tests/regression-baseline.json` gained `unit/withdrawal-contract` (63).
- All suites: see [VALIDATION.md](../../VALIDATION.md). Reports in `tests/evidence/slice-14c/`.

## Limits

- Mock partners only. Two kinds of check were run:
  - the withdrawal operation against the two in-process demonstration simulators;
  - the HTTP programme and FHIR requests against injected transports.
  No real programme system or EHR has agreed or tested these contracts, and no partner-confirmed reversal exists. The `saha-mis-v1` withdrawal and the FHIR notice are Saha's proposals, not partner specifications.
- EHR publications cannot be accepted in the local HTTP suite (external services are off), so EHR withdrawal and amendment are covered by the contract suite only. The EHR lookup uses the default rule: only one equal document resolves it. The slice 7f authoritative-search policy (not stored, conflict, reconciliation owner) is not applied to withdrawals.
- A programme submission is not amended through this path: its correction still goes through the correction visit's plan (`operation: "correct"`). For an amended visit, a programme withdrawal does not complete the visit's correction task, because the destination does not yet hold the corrected record.
- Uncertain withdrawals are not listed as their own rows in the exception queue. A wrong-patient visit's open correction task is listed (rules 1.3.0, unchanged); a withdrawal of a current visit's output is seen on its Receipts tab and trace.
- There is no separate second-person approval. As for sharing plans, the approver may be the preparer; the approver alone sends.
- The withdrawal commands load the whole organisation and are not certified patient commands. Concurrent changes elsewhere in the organisation can make a step return 409; nothing is sent in that case.
- The panel is English only; the Hindi workspace shows it as untranslated.
- Built by one agent; no independent review. No person has reviewed the code or the tests.
