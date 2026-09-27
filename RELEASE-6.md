# Release 6 / v0.7 — Field continuity

27 September 2026 UTC. Browser engineering implementation; synthetic records only. **Full acceptance is not complete.** Disconnected browser/device sync, native Android protection, real speech accuracy and independent facility outcome verification have not passed acceptance.

## Delivered

- Field notebook linked from the sidebar. Prepare a current patient draft online, then capture facts and pinned programme questions on device. Maximum 10 local drafts; signed grants expire after 24 hours.
- AES-256-GCM encrypted IndexedDB vault; passphrase-derived PBKDF2-SHA-256 key (310,000 iterations, random 16-byte salt), random 12-byte IV per write. Keys/passphrases are never persisted. No patient fields, packet metadata or transcript appear outside ciphertext in the vault.
- ECDSA P-256 grant packet, validated locally; its hash is pinned server-side to the authenticated worker, organisation, identity/assignment, membership version, permission version and visit version. The transient signing key is discarded after issuance; this is not a centrally managed signing-key or device-attestation service.
- Automatic encryption on input, serialized device writes, stale-tab compare-and-swap, explicit locking, lock on hidden/pagehide and two-minute inactivity. Local deletion requires typing DELETE. Browser storage eviction and forgotten passphrases can permanently lose unsynced work.
- Explicit sync, with a frozen payload and operation key saved before transmission. A lost response is retried with the same key. The server persists an unconfirmed draft and receipt transactionally; it never confirms facts or sends MIS/EHR requests offline.
- Conflict review displays local and server facts/answers/absence reasons. The worker must acknowledge the comparison and acquire a fresh grant before resubmitting local values. There is no automatic merge. Identity/assignment changes or a closed/confirmed source draft block this recovery path.
- Hindi/English field capture labels and programme questions. Existing full workspace and some diagnostic messages remain English; bilingual clinical content validation is outstanding.
- On-device-only speech adapter when the browser exposes local recognition and already has the chosen Hindi/English language pack. Transcript remains separate until reviewed and appended to notes. No cloud fallback, automatic field extraction, stored audio or language-pack download.
- Referral ownership, due dates, overdue display and ordered sent/received/completed events with source, timestamp, evidence reference, note and recording actor. The previous evidence-free transition API is blocked. Programme follow-up tasks from Release 2 remain available.

## Validation

581 automated checks: 381 API/database; 38 field/encryption contracts; 23 client recovery checks using real Web Crypto with injected storage/network and a minimal DOM; 11 service-worker policy checks using injected events/cache/network; 128 retained AI/MIS/EHR contract and checkpoint checks. These are not 581 end-to-end user journeys.

TypeScript and production build are checked before publication. The HTTP-only browser preview rejects encrypted storage because Web Crypto requires a secure context. This protection was preserved; no insecure fallback was added. Consequently actual IndexedDB restart, service-worker offline reload, device background/termination, speech recognition and disconnected browser-to-server sync remain unverified. The automated client tests establish recovery logic only. See VALIDATION.md for browser evidence.

## Acceptance and remaining work

| Roadmap acceptance | Status |
|---|---|
| Encrypted offline capture and recovery implementation | Browser code implemented; crypto and state logic tested; real HTTPS device acceptance outstanding |
| Disconnected visit sync | API and injected-client tests passed; real disconnected browser journey not passed |
| Shared-device protection | Notebook lock/encryption implemented; main online workspace is not covered by notebook lock; native keystore, MDM, trusted clock and remote erasure not implemented |
| Hindi/English and voice capture | Bilingual notebook and gated local-only speech adapter implemented; language/device/speech accuracy acceptance outstanding |
| Tasks and referral tracking | Programme tasks retained; referral ownership and evidence workflow implemented; independent facility outcome verification outstanding |
| Prior release live integration gates | Live EHR/MIS/model/ABDM acceptance remains outstanding; ABHA/HIP/HIU are not implemented |

No schema migration or new dependency. Field grants are optional patient JSON state; referral evidence is optional referral JSON state. Server record revisions and audit are retained. Do not roll back while device drafts or pending syncs remain; old code does not accept the new sync commands or enforce evidence-backed referral transitions. The new shell cache has a dedicated version and narrow /field/ scope.
