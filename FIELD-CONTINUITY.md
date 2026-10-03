# Field notebook and referral operations

## Worker journey

1. Sign in while online. Open **Field notebook · फील्ड नोटबुक** in the sidebar. Use a private passphrase of at least 12 characters; there is no recovery service.
2. Load the online workspace, select the organisation and patient, then prepare the visit. Only a care role with current patient access can obtain a grant. Preparation creates or reuses the current unconfirmed visit; it does not copy an old confirmed visit into a new one.
3. Wait for the encrypted device-save message. Bookmark the notebook page. A secure HTTPS browser with Web Crypto, IndexedDB and a functioning service worker is required for offline reload. Ordinary workspace forms are not offline forms.
4. Record observations and programme answers. Explicit absence reasons remain separate from findings. The notebook auto-saves encrypted drafts; it locks when hidden and after two minutes idle. Unlock with the same passphrase after returning. Use a separate browser profile for each worker on a shared device.
5. When connected, review and sync. A current authenticated account must match the preparing worker. If a response is lost, retry the pending operation; editing is blocked until its outcome is known. Retrying reuses the exact payload and key.
6. For a conflict or expiry, compare with the server. Acknowledge every difference before retaining local fields under a renewed grant. If identity/assignment changed or the visit was confirmed, corrected or voided, retain the encrypted copy and resolve the record online; this version cannot transfer it to a different visit or patient.
7. Open the normal workspace to review programme completeness, confirm the visit and separately approve any AI, MIS or EHR work. Remove the synced device copy when it is no longer needed.

## Signed grant and sync authority

`prepareFieldVisit {personId, version}` returns `{packet, packageHash}`. Packet payload binds schema, lease ID, actor, organisation, patient, identity hash, visit/revision, issued/expiry times, facts and pinned programme capture. A per-grant ECDSA key signs the exact JSON payload. The public key is bundled with the signature and protected by the local vault after delivery over the authenticated HTTPS connection. It is a local integrity anchor, not external identity verification. The server trusts its persisted package hash and current access checks, not a client-supplied public key.

`syncFieldVisit {personId, leaseId, packageHash, facts, answers, absence}` uses the normal authenticated, CSRF-checked command endpoint and `Idempotency-Key`. Persist the frozen command/key before sending. All data and receipt writes use the existing organisation CAS/D1 transaction. A duplicate exact command replays the committed receipt after current access checks; altered input with the same key is rejected. Expired/revoked grants cannot authorize a new write. The client clock is only a convenience check; the server enforces expiry at sync.

`revokeFieldLease {personId, leaseId}` is available to the preparing worker or an organisation owner with patient/care access. It prevents new sync; it cannot erase disconnected ciphertext. Preparing another grant for the same worker/visit revokes their old active grant. Active-grant metadata is bounded to 20 unexpired entries per patient; eviction can require a new comparison/renewal. Existing audit and record revision retention are unchanged.

## Device boundaries

- One vault per browser profile/origin, bound to one worker after loading online. Passphrase and non-extractable derived key live only in process memory. Decrypted active drafts also live in memory until lock. Pending encrypted writes may finish after the screen clears.
- Browser encryption does not defend against compromised scripts, device malware, screenshots, an unlocked browser or a known passphrase. There is no OS keystore binding, MDM control, remote wipe, hardware-backed clock, anti-rollback protection or centrally rotated grant-signing infrastructure.
- Offline revocation cannot be immediate. Expired grants block further local editing but retain ciphertext for review; expiry is not a retention/erasure policy. Patient history is not bulk-cached.
- Browser quota/eviction, data clearing, OS termination during a pending save and forgotten passphrases can lose unsynced data. A failed save blocks sending; this is not a backup service. A successful save message means the IndexedDB transaction committed, not an OS-level durability guarantee.
- Service worker scope is `/field/`. Cache allowlist contains only index.html, app.js, vault.js and style.css. No API, auth, patient response, query-bearing URL or normal workspace page is cached. The dedicated shell is empty until unlocked. Network responses refresh cached shell assets; deployments must retain schema compatibility.
- Main workspace sign-out does not delete the notebook. Lock it explicitly before handing over a device. Notebook lock does not lock the main online workspace. Forgotten passphrases require deleting local data after understanding the loss.

## Speech and language

Slice 12a (3 October 2026) puts a **Speak** button on every text box and the notes box. Speech becomes text on the device (`SpeechRecognition.processLocally=true`) whenever the browser reports the selected language available locally. Otherwise the browser's own speech service is used only when the workspace loaded in the unlocked session says the organisation owner has allowed it (`setSpeechPolicy`, synthetic and training environments only) and the phone is online; the first use shows a notice that the audio goes to the browser's speech service (Google on Android phones). Until 3 October 2026 no vendor cloud fallback existed; the sponsor chose this because on-device browser speech is not available in Chrome on Android. No microphone is opened automatically. What was heard is shown for review and used only when the worker taps "Use this"; numbers are taken from the digits heard. A transcript saved by the earlier "Dictate on device" button stays encrypted with its draft and is still shown for review. Raw audio is not retained by Saha. Browser/vendor implementation and speech accuracy remain acceptance work. See [slice 12a](docs/current/SLICE-12A-VOICE-INPUT.md).

Primary implementation references checked 27 September 2026:
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API

## Referrals

Prepare a referral from a current confirmed visit, assign an active care worker with patient access and a due date, then record ordered events. The responsible worker or an organisation owner with care access records each event. References are text, not attachments. Completion records the source of the report; `facility-reported` is a worker-entered assertion and is not a verified facility callback. Completed evidence is immutable in this release; corrections/cancellation/reopening require a later governed workflow. Historical completions without structured events are labelled as legacy.

No SMS, WhatsApp, email, facility API notification or automatic escalation is sent. Overdue items are visible in the worklist; users must coordinate care through their authorised local workflow. Do not use the software as an emergency referral channel.
