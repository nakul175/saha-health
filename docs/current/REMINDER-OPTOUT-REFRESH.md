# Reminder opt-out refresh isolation

5 October 2026 (IST). Independent review found that the mock STOP control refreshed its original organisation after a successful event, then passed that response directly to the root workspace. Switching organisations while this response was delayed could show the former organisation while subsequent command headers still named the new one.

The root now accepts a reminder snapshot through a functional state update only when both the currently displayed organisation and the active request organisation still match it. The control also tracks its mounted organisation lifetime and ignores results, errors and refresh completions after it has unmounted or changed organisation. The event POST is not cancelled or undone: its server receipt remains durable, and a later read shows the result. Local retries continue using the original event body while the control remains mounted.

## Verification

- Production build and TypeScript passed; the existing client bundle size warning remains.
- `tests/reminder-optout-refresh-browser.mjs`: 10 checks passed against real cached Chromium and an isolated synthetic Worker/D1. The test holds an actual old-organisation workspace response, switches using the organisation selector, then releases that response. The selected organisation stays correct and subsequent outreach requests use its header. The original STOP remains saved.
- The same test submits two signed copies of one event simultaneously: both return the same durable receipt and only one patient event is appended.
- It also starts two copies of another event concurrently with a contact replacement. In the recorded run the edit returned 200 and both callbacks returned 409; the replacement retained its permission and no event was appended. The test also accepts the converse valid serial ordering, checking exact-once evidence and replay receipts when the event wins.
- Evidence: `tests/evidence/reminder-optout-refresh/result.json`.

No real message, external provider or hosted authentication was exercised. This closes the reviewed response race and adds concurrency evidence; it does not promote R77 formal acceptance. Android SDK licence approval remains separate and pending.
