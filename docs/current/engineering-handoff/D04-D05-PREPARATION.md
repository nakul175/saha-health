# Saha offline retention and reconnect preparation

Prepared 10 October 2026. This packet prepares the existing D04/#177 and D05/#178 tasks without starting a competing implementation or changing their original sources. **Every proposed case below is Not run.** D04 implementation waits for the existing D03 candidate's full unchanged A1–A10 gate; D05 follows qualified retention and the relevant current-authority contract.

The intended outcome is truthful continuity: distinguish work kept on this device, a server draft, a confirmed encounter and destination acceptance. Existing encrypted field storage and signed prepared-work mechanisms are reuse candidates. They must be inspected against the new selected journey; a historical field/app test or packet cannot qualify new routine-screen behavior by inheritance.

## Source and authority boundary

Use the current [test and recovery plan](TEST-AND-RECOVERY-PLAN.md), [development guide](../DEVELOPMENT-AND-CI.md), [testing guide](../TESTING.md), original [test strategy](../../reference/07_Test-Strategy_v1.0.md) and original [test catalogue](../../reference/workbook/Test-Catalogue.csv). Planning defaults use disposable synthetic local state, existing interfaces and providers off. Actual institution/privacy/security policy, real-device access and qualified review remain separate evidence.

**DEC-03 remains unresolved for production offline grant duration and key recovery.** Source proposed 24/72-hour values and an existing synthetic 24-hour grant guard do not establish an approved production policy. Do not add daily supervisor approval, a new login gate, a new key recovery service or a parallel patient database. Synthetic fixtures must name their declared duration, expiry and intended test boundary; they cannot supply institutional approval.

The original applicable encrypted-local-save target is **p95 ≤500 ms**, measured at the declared durable local write/readback boundary, separately from connected server timing. A one-second proposal is not approved. The original **NFR-05 / TC-NFR-05-A** requires **at least 10,000 replay and timeout events** with no duplicate accepted activity in supported connector fixtures, including timeouts before and after external acceptance. A smaller local reconnect test is useful evidence for its scope; it cannot close that original criterion. This is distinct from the R2 proposed 10,000-worker scale target, which needs its own topology/cost authority and is outside this packet.

## Inspect before freezing the execution contract

| Concern | Existing source or test to inspect | Decision to record |
| --- | --- | --- |
| Encrypted local transaction | `public/field/vault.js`, `tests/field-storage-client.mjs`, `tests/field-capacity-client.mjs` | Exact version/CAS, ciphertext, acknowledgement, readback, capacity and cleanup semantics; selected routine payload is actually covered. |
| Actor and grant binding | `public/field/app-grants.js`, `tests/app-offline-contract.mjs`, `tests/offline-open-account-binding-browser.mjs`, `tests/offline-lifecycle-auth-transport-review.mjs` | Exact original account/device/grant binding, expiry and no fallback to new account. Preserve declared synthetic policy, unresolved production DEC-03. |
| Prepared programme work | `lib/saha/field.ts`, `lib/saha/programmes.ts`, `tests/offline-programme-contract.mjs`, `tests/raw-key-independent-repeat-offline-programme-contract.mjs` | Signed schema, original question IDs, pack/episode/hash/version freshness; no authority to confirm or send inferred from a prepared packet. |
| Local presentation evidence | `tests/offline-opens-contract.mjs`, `tests/offline-opens-http.mjs`, `tests/offline-opens-auth-first-http.mjs`, `tests/offline-open-unsent-pruning-contract.mjs` | Exact open/receipt/link identity and privacy; metadata receipt never reconstructs a protected body or grants new care scope. |
| Guided offline browser reuse | `tests/integration-offline-guided-device-browser.mjs`, `tests/integration-offline-guided-review-browser.mjs`, `tests/integration-offline-guided-purge-failure-browser.mjs`, `tests/offline-sync-hash-cold-parity-browser.mjs` | Separate selected-screen draft durability, restart/unlock, review parity and cleanup failure; retained earlier raw evidence remains historical. |
| Reconnect writer | Existing field dispatcher, command receipts, immutable revisions, `tests/field-contract.mjs`, `tests/field-client.mjs`, `tests/offline-sync-hash-repair-browser.mjs` | Original operation/payload hash, current authority, conflicts, acknowledged/uncertain attempts and authoritative readback. Never invent a destination acceptance from transport 200. |

These are actual existing files on the inspected main-based checkout. They are source pointers, not a claim that they run unchanged against a new routine screen. Preserve current catalogue suite identities and minima, and select affected regressions from actual imports/contracts.

## D04 proposed retention contract

`CASE-D04-*` and `CASE-D05-*` are proposed handoff cases, distinct from existing task IDs and original formal `TC-*` cases. They create no new native implementation story.

Keep one declared existing person's permitted routine draft, exact person/visit/organisation/account, entered/canonical units, time/source/missing state, programme question/pack version and original operation metadata together. A local Saved acknowledgement requires completed encrypted durable transaction and correct readback. Ordinary page state is labelled unsaved; ciphertext without a usable valid owner-bound record is not a successful save.

Close/reload/restart testing must use a real browser/storage implementation. Authority-sensitive reopen may require the original valid prepared grant; preserve its exact limitations. Refusal, expiry, changed account, corrupt data or unavailable key never authorises showing another account's protected content. Capacity/storage failures retain the prior good durable revision and expose a truthful recoverable failure. Cleanup is deliberate, version-safe and cannot erase confirmed server evidence.

| Case | Fixture/action | Oracle and prohibited side effect |
| --- | --- | --- |
| CASE-D04-01 | Synthetic permitted original-account draft; edit source/time/unit/notes and distinct programme answers, save locally | Encrypted transaction and readback bind exact selected record/pack/account; no plaintext in general storage/logs, no server-confirmation or destination claim. |
| CASE-D04-02 | Save then reload page, close/reopen browser context, restart supported browser/device separately | Exact acknowledged draft survives applicable restart boundary with source/version intact; no silent reset or substitution. Physical-device result requires actual device evidence. |
| CASE-D04-03 | Fail local write before commit, fail readback, exhaust quota and race two tabs at one revision | No false Saved; prior good revision survives. CAS conflict cannot silently overwrite either draft; distinguish uncertain commit from definitely failed write. |
| CASE-D04-04 | Original grant expires, account changes, role/scope changes on reconnect or unlock uses wrong key | Refuse/clear protected display as required by current policy; no wider scope, new-account recovery or silent copied grant. Preserve recovery material only through the actual approved lifecycle. |
| CASE-D04-05 | Tamper ciphertext/packet signature/hash, schema, programme key, pack/episode version or source provenance | Authentication/freshness fails closed; no invented clinical answer, cross-person reuse, implicit confirmation or corrupted draft promotion. |
| CASE-D04-06 | Measure encrypted durable local save/readback on frozen payload/storage/device profile | p95 ≤500 ms at original boundary; retain raw samples/N/faults. Existing component timing is not a replacement for selected-screen performance. |
| CASE-D04-07 | Explicit delete/retire a selected prepared draft; simulate purge failure and concurrent write | Truthful retained/deleted state and version-safe cleanup; unrelated drafts/keys/server revisions/receipts unchanged. No plaintext recovery copy to bypass a failed purge. |
| CASE-D04-08 | Phone keyboard, 200% text and assistive state announcements during save, failure and reopen | Accessible state distinguishes on-device versus server saved; no overflow, hidden error, forced new approval or provider dependency. |

## D05 proposed reconnect contract

Prepare a versioned attempt using the exact original operation key and payload/hash. Reconnect checks current identity, assignment, purpose, record/pack/grant freshness and accepted receipt evidence. Lost reply after acceptance remains uncertain until exact reconciliation; never mint a replacement key to hide uncertainty. Conflict review is explicit and preserves unsaved input. Only a real owner-authorised destination receipt can establish destination acceptance.

| Case | Fixture/action | Oracle and prohibited side effect |
| --- | --- | --- |
| CASE-D05-01 | Reconnect one valid prepared draft, then repeat the identical attempt | One logical server draft mutation/receipt; exact authoritative readback. Local retained versus server draft versus confirmed versus accepted state stays distinct. |
| CASE-D05-02 | Timeout before server acceptance and separately drop reply after commit | Original key/payload retained; retry/reconciliation follows actual receipt contract and produces no duplicate. Record uncertainty without assuming failure or success. |
| CASE-D05-03 | Repeat key with changed payload, wrong person/org/account or altered packet/hash | Source-defined refusal, no clinical mutation/external effect, no patient disclosure or receipt body reconstruction. |
| CASE-D05-04 | Server visit changes; user has unsaved local correction; compare latest then explicitly choose resolution | Conflict never overwrites local input automatically. New supported attempt uses reviewed current version; original failed/uncertain attempt remains traceable. Confirmed records stay immutable. |
| CASE-D05-05 | Membership/scope/purpose revoked or programme/episode/version no longer current | Current server authority/freshness refuses; stale signed packet cannot grant continuing access or confirmation. Protected UI clears when authoritative refusal requires it. |
| CASE-D05-06 | Restart local Worker and browser between send and reply/readback; restore separate synthetic database if applicable | Original receipt/key/version survives; truthful reconciliation and audit without duplicate accepted work. Restore is not permission for blind external replay. |
| CASE-D05-07 | Receipt missing, partial, repeated, wrong actor, stale or for another operation | No false Completed/Accepted. Preserve pending attempt and original encrypted draft; local cleanup follows exact accepted receipt and current CAS only. |
| CASE-D05-08 | Supported connector fixture batch with timeouts before/after acceptance, at least 10,000 replay/timeout events | Original NFR-05 no-duplicate accepted activity target; retain per-event IDs, classifications, destination counts, failures and uncertainty. Run only within actual connector/data/spending permission; do not use smaller count or manual-only path as whole-source acceptance. |

## Evidence and completion boundary

Before coding freeze the selected D04 contract after D03's complete gate, then freeze D05 against the qualified retention path. Record actual suite/fixture additions without removing old assertions, source requirements or DEC-03. Run component, real native database, API and browser cases, applicable adverse/regression/NFRs, exact final-head checks and separate review. Follow the [shared execution evidence rules](TEST-AND-RECOVERY-PLAN.md#environment-and-evidence).

Completed local synthetic mechanics do not establish production offline authority, real phones, clinical safety, owner-authorised connector interoperability or formal UAT. The broader NFR-05 suite and external/physical approval gates stay open until their exact evidence exists. No provider activation, paid service, new hosting, migration, clinical policy, patient database or production key-recovery decision is introduced by this preparation.
