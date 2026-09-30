# Development slice 2b — visit photos and voice notes

30 September 2026 (IST). Second part of slice 2. Synthetic data only; formal acceptance unchanged.

## What changed

- **Upload.** `POST /api/media?visitId=…&purpose=…` (care roles with patient access) attaches one file to a **draft** visit. Accepted: JPEG, PNG or WebP photos and WebM, Ogg, MP3 or MP4 audio, 512 bytes to 256 KB. The declared type must match the file's own signature, so a renamed file is refused. A purpose is required (wound or skin, document or card, medicine packaging, voice note, other clinical); a voice note must be audio. At most 10 per visit; the same file cannot be attached twice. Uploads need an idempotency key and are replayed, not duplicated, on retry.
- **Storage.** Migration `0012_media.sql` adds `media` (content stored base64 in D1 with type, size, SHA-256 and purpose). The visit keeps references only, so workspace snapshots never carry content. Attaching and removing run under the patient-scoped commit guard and create visit revisions and audit events.
- **Playback.** `GET /api/media/{id}` returns the file to anyone with access to the patient, with `no-store`, `nosniff` and a sandboxing content-security policy. Administrators and out-of-scope staff are refused.
- **Draft deletion.** `DELETE /api/media/{id}?reason=…` removes media only while the visit is a draft: the content is erased and a tombstone keeps type, hash, purpose and who removed it and why. Once the visit is confirmed, media cannot be added or removed.
- **Guards.** Merged records refuse new media; emergency access permits attaching media as urgent care; maintenance mode pauses uploads.
- **Local stability.** Over-limit uploads are read and discarded up to 1 MB before the 413 response, because cancelling an unread body restarts the local Worker runtime.
- **Workspace.** The visit screen gains "Photos and voice notes": attach with a purpose, preview images, play audio, remove from drafts.

## Evidence

- 35 new HTTP/D1 assertions (`tests/media-smoke.mjs`): worker and admin refused; HTML, a renamed PNG, a too-small and an over-limit file refused; purpose mismatch refused; upload and idempotent replay; duplicate refused; playback returning identical bytes with the expected headers; refusals for other roles and unknown ids; references without content in snapshots; removal refused to a worker and without a reason, then allowed with a tombstone and a 410 on playback; attaching and removing refused after confirmation while playback continues; audit events.
- 5 contract assertions (`tests/media-contract.mjs`) cover every accepted signature including MP3 frame sync, renamed and unsupported types, size bounds, purposes and base64 encoding of a 200 KB file.
- Browser check (headless Chromium, built Worker, synthetic owner): started a visit, attached a 40 × 40 PNG and saw it rendered from the playback route. No console errors. The first attempt found the panel only on confirmed visits; it was moved to the draft visit screen before the evidence run.
- The first full run stopped when an over-limit upload was refused before its body was read and the local Worker restarted on the next request; draining up to 1 MB fixed it and the rerun passed.
- All suites: 1,487 HTTP/D1, 618 contract/checkpoint and 21 restore assertions (31 SQLite tables). Reports in `tests/evidence/slice-2b/`.

## Limits

- Content lives in D1 and is limited to 256 KB; object storage, client-side compression and larger recordings are not built. Offline capture and queued upload from the field notebook (BR-OFF-04) are not built.
- Signature checks confirm the container type, not that an image or recording is clinically usable.
- Media is not yet part of FHIR exports, ABDM transfers or the retention review.
