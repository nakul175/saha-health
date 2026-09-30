# Development slice 3d — in-app voice-note recording

30 September 2026 (IST). Builds on slices 3a and 3c. Synthetic data only; formal acceptance unchanged.

## What changed

- **Record in the notebook.** A draft's "Photos and voice notes" section gains "Record voice note (up to 60 s)". It asks for the microphone, records with the browser's MediaRecorder at 24 kbps in one-second slices, and shows "Stop recording" while running.
- **Limits.** Recording stops by itself at 60 seconds, or once 240 KB has been captured, so the file stays under the 256 KB media limit.
- **Queueing.** On stop, the microphone is released and the recording is queued as a voice note through the same path as a chosen file: the same type, signature and size checks, per-item encryption on the device, and upload only after sync and a fresh access check. The recording's codec suffix is dropped from its type (for example `audio/webm;codecs=opus` becomes `audio/webm`) so the server's type check applies.
- **Lock and refusals.** Locking the notebook during a recording discards it and releases the microphone. Recording is refused, with nothing captured, when permission is denied, when the browser has no supported recording type, or when the draft has already synced.

## Evidence

- 28 client assertions (`tests/field-recording-client.mjs`) with an injected MediaRecorder and microphone: bit rate, type and slice length; Stop queues a voice note with the plain type and releases the microphone; the 60-second and size-limit auto-stops; lock discards a recording; the three refusals.
- Browser check (headless Chromium with its synthetic microphone and real IndexedDB): prepared a visit online, went offline, recorded for about 3.5 seconds and stopped; the recording was queued on the device; after going online and syncing, the server's draft visit held a 6,267-byte `audio/webm` voice note, and the device copy was gone. No console errors. `tests/evidence/slice-3d/record-browser.json`.
- The first run of the new checks failed twice on the test itself: it waited too briefly for the notebook to unlock, and its size-limit case added up to 230 KB, below the 240 KB stop point. Both were corrected before the evidence run.
- All suites: 1,500 HTTP/D1, 813 contract/checkpoint and 21 restore assertions. Reports in `tests/evidence/slice-3d/`.

## Limits

- Tested with Chromium's synthetic microphone only; no real phone, background noise, interruption by a call, or Safari recording was tested.
- Audio quality at 24 kbps is not assessed for clinical use. No playback before queueing in the notebook; playback is in the online visit screen.
- BR-UX-03 remains partial (supported-device speech and full workflow coverage outstanding).
