# Worker-day offline continuation — D04a

9 October 2026. Dependent on PR #184, source `edbda10e7a8c24bf86d69f54fdbe2e9193dc863c`.
Implements a bounded prepared-visit continuation and a D05 sync witness, not the complete D04/D05 scope.
Canonical scope: SAHA-007, 091, 092, 093, 097; related reconciliation: SAHA-006, 075, 076, 095, 096.
Tracking: #177 and #178. No merge or deployment approval is implied.

## Requirement

As an ASHA, I can open prepared work from Today, record observations without internet,
close and reopen the app, resume the same visit and step, and sync the reviewed draft
without re-entering observations or inventing a new approval process.

## Functional and UX specification

The opt-in worker-day Today includes a fixed same-origin prepared-visit entry. The existing
public offline shell uses Today, People and My Space in this mode; People is explicitly a
prepared-on-this-phone subset, never a purported full caseload. No separate user account,
vendor catalogue or patient store is introduced. The existing online editor remains unchanged.

Preparation uses the existing scoped workspace, explicit preparation action, signed per-visit
packet and private device passphrase. Deep-link IDs only select among the server-returned
records; they do not grant authority or trigger an automatic mutation. Missing/expired
prepared records are not silently replaced with another person.

Every existing device save includes bounded presentation metadata in the SAME encrypted vault.
A valid continuation reopens the selected lease and guided step after unlocking, rather than
selecting the first stored draft. Invalid/removed/wrong-account/expired pointers fall back to
Today without rendering protected clinical information. No missing clinical value is fabricated.

The public service worker handles query-bearing app/offline navigation while caching only
canonical public assets. It never caches `/api/*`, sign-in responses, personalized app HTML,
query-bearing assets, passphrases or decrypted records. New static dependencies are included
in both existing shell asset lists; historical caches remain distinct from encrypted data.

On reconnect the existing privacy/scope reconciliation and reviewed sync operation remain
in force. A server draft is not confirmation or programme acceptance. This increment does
not add automatic background submission or a new confirmation step. Existing unknown-outcome
receipt handling is reused and tested, not replaced with blind retry logic.

## Data and interfaces

No new server table, API, migration, data model, clinical rule or external service.
`book.workerDay` is additive schema-1 encrypted presentation metadata:
`{version:1, tab, leaseId, step, language}`. `tab` is an allowlisted local view; the optional
lease and step must still resolve to a current existing packet. Names, facts, permissions,
receipts and case ownership are NOT copied into that object. Old vaults remain readable.

Reuse: `public/field/vault.js` (Web Crypto, revision-checked IndexedDB), `app-grants.js`,
`device-work.js`, `offline-opens.js`, the existing guided capture and `prepareFieldVisit` /
`syncFieldVisit` backend contracts. Those authority/receipt modules remain unchanged.

The inherited synthetic packet lifetime is 24 hours and the existing passphrase/idle-lock
behaviour is retained. This is not adoption of a new departmental policy; DEC-03 remains
unresolved for deployment. An expired permission is not renewed offline or by client UI.

## Acceptance criteria

- D04a-A1: existing Today enters prepared work within the Saha origin; server-scoped IDs only.
- D04a-A2: a prepared routine fixture is captured/saved with network disabled and no cloud model.
- D04a-A3: acknowledged fields and the selected visit/step survive a browser-process restart
  with the same profile and valid grant; the public shell remains locked until private unlock.
- D04a-A4: legacy vaults without continuation metadata remain readable; wrong/removed/expired
  metadata cannot select or disclose another person.
- D04a-A5: an aborted/quota-failed device write is not shown as saved; earlier durable data remains.
- D04a-A6: no decrypted patient data or authenticated response enters public caches or plaintext stores.
- D04a-A7: the selected phone viewport retains reachable controls and the three worker destinations.
- D05w-A1: reviewed sync persists the original observations into the existing unconfirmed server draft.
- D05w-A2: dropping the response AFTER backend acceptance preserves the original operation identity;
  recovery does not create a duplicate visit or claim destination acceptance.
- D05w-A3: a connected wrong-account response conceals data and blocks unlock even with the passphrase.

## Refusal and delivery rejection

Reject false saved ticks, silent data loss, names shown under expired access, a second local patient
store, changed payload under an uncertain key, raised lint debt, new supervisor gates, altered
clinical deadlines, or treating browser simulation as physical-handset acceptance. Invalid storage
or grant state must produce a visible recoverable refusal, not an empty-success caseload.

## Non-functional boundary

Use actual IndexedDB and browser profile persistence for the restart witness. Inject quota/write
failure and a dropped acknowledgement separately. Public cache isolation is inspected directly.
The initial browser profile is Chromium at 360 x 640, English synthetic data; Hindi is draft UI text.

The original 500 ms p95 local-save target is NOT waived or claimed measured here. Physical Android,
OS process killing/power loss, battery/memory pressure, eviction, assistive technology, full 200%
text scaling, full multi-programme capture and ASHA validation require their own evidence. Database
backup or a tab reload alone is not a device-durability result.

## Verification and release

Local Node 22.16.0 before test failed at query-bearing offline-shell routing. After the scoped fix,
26 focused checks passed, plus all 12 current field-shell policy checks and 11 existing grant checks.
These use actual Web Crypto but injected service-worker events; NOT browser restart evidence.
The real-browser/Worker/D1 test is authored; its results must be read from the exact-source workflow.

A single branch-bound preparation job applies checked preimages, preserves their source snapshots,
regenerates existing documentation/source baselines, removes itself, and publishes only to this
feature branch after checking its remote head. The verification job checks out that resulting
commit explicitly. Future verification is read-only. No secrets/host access/provider activation,
main push or merge. CI permission failures are reported, never bypassed or relabelled as passes.

Rollback is a presentation revert retaining the encrypted vault, metadata, receipts and records.
The legacy offline client ignores the added metadata. Main may be followed by the DigitalOcean
updater; no change should be merged without the sponsor's separate approval.
