# Development slice 3a — offline photo and voice-note queue

30 September 2026 (IST). First part of slice 3 (offline). Synthetic data only; formal acceptance unchanged.

## What changed

- **Queue on the device.** A draft in the field notebook (`/field/`) gains "Photos and voice notes". The worker chooses a purpose, then a photo or recording. The notebook applies the server's own rules before queueing: JPEG, PNG or WebP photos and WebM, Ogg, MP3 or MP4 audio; 512 bytes to 256 KB; the file signature must match its type; a voice note must be audio. At most 4 items per draft and 1 MB across the notebook; the same file cannot be queued twice on a draft.
- **Encrypted per item.** Each file is sealed with the notebook key (AES-GCM, its own IV and associated data) and stored in IndexedDB under its own key. The notebook holds metadata only (purpose, type, size, SHA-256, capture time, state), so typing in a draft does not re-encrypt media. Locking clears the key; deleting the notebook now clears every stored item as well.
- **Upload only after sync, after a fresh check.** When the draft syncs, the notebook reloads the online workspace and, for each queued item, checks that the field grant is still current, the patient is still in the worker's scope and not merged, and the visit is still a draft. If any check fails the item is routed to review with the reason and nothing is sent. Otherwise it is uploaded to `POST /api/media` (slice 2b), which repeats the server's own authorisation, operating-mode and merge checks.
- **Uncertainty.** Each item uses its own id as the idempotency key. A lost response leaves the item pending; a retry sends the same key and the same bytes, so the server replays rather than duplicates. A pending item cannot be discarded and its draft copy cannot be removed until the retry resolves. Server refusals (400, 403, 404, 409, 410, 413, 415, 422) route the item to review; other failures keep it pending.
- **Retention on the device.** Uploaded items are deleted from the device at once. Items in review stay sealed until the worker discards them. Removing a synced draft deletes its remaining media.

## Evidence

- 70 client assertions (`tests/field-media-client.mjs`), with real Web Crypto and the real sealing functions, injected storage and network: every local refusal; sealed storage without bytes in the notebook; per-draft limit; survival across lock and unlock; discard; upload after sync with the item id as the key and identical bytes; lost response retried with the same key; expired grant, confirmed visit, lost access, damaged device copy and server refusal each routed to review with nothing sent; temporary server failure kept pending; removal blocked while pending and deleting media afterwards.
- Browser check (headless Chromium, real IndexedDB, built Worker, synthetic ASHA): prepared a visit online, went offline, queued a 3,000-byte PNG (IndexedDB held the notebook and one sealed media key), went online, synced; the status reported one upload, IndexedDB then held only the notebook, and the server's draft visit had the PNG with its purpose. No console errors. `tests/evidence/slice-3a/offline-media-browser.json`.
- All suites: 1,487 HTTP/D1, 688 contract/checkpoint (618 plus 70) and 21 restore assertions. Reports in `tests/evidence/slice-3a/`.

## Limits

- Media is uploaded only to Saha. No media is sent to an AI or other provider, so the requirement's provider and capability revalidation before upload is not exercised. BR-OFF-04 is partial.
- In-app camera and microphone capture are not built; the worker picks a file the device already holds, which on most phones offers the camera. No compression.
- Real-device, low-storage, browser-eviction and background-sync behaviour are not tested. Queued media depends on the tab or installed page being opened again; nothing uploads in the background.
- The Hindi strings added here have not been reviewed by a native speaker.
