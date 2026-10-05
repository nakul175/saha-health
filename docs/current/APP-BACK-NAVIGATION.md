# App Back and Forward navigation

5 October 2026 (IST). Closes independent review finding P2: the original `/app` tabs and patient journey only changed React state, so browser/Android Back exited the page instead of following the app journey through its dirty-form guard.

`/app` now records screen transitions in browser history. Browser history stores a random session identifier and numeric position only; organisation/patient/visit identifiers stay in a bounded 128-screen memory map. It stores no names, observations, authentication tokens or unsaved form data. Creating/saving a visit updates the existing screen snapshot rather than adding a duplicate patient screen. Forward works within that same session. The full `/` workspace retains its existing navigation behavior.

When Back or Forward would leave unsaved visit facts, history first returns to the current screen position and opens the existing Keep editing/Discard edits dialog. Cancelling retains both the draft and its history position. Discarding permits the originally requested traversal, with no silent server mutation. Navigation while a command is busy returns to the current position. A new navigation after Back replaces the forward branch. At the app root, Back leaves for the preceding document normally; there is no sentinel loop that traps the user in Saha.

History restoration checks the currently loaded organisation, role views and patient scope. Reopening a patient reports the existing record-open audit and refuses to show it when that read is refused. Missing, pruned or previous-organisation record context returns to an available root screen. Older sessions cannot restore their in-memory patient context after a reload. App Back behavior is browser behavior, so the Android TWA requires no JavaScript/native bridge.

## Verification

- TypeScript and production build passed, with the existing client bundle warning.
- `tests/app-history-contract.mjs`: 17 checks passed using the actual navigation controller and asynchronous injected history; covers Back/Forward, correction/cancellation, approval, busy handling, same-screen visit updates, forward branching, malformed/older-session markers, bounded context and privacy.
- `tests/smoke/app-back-browser.mjs`: 11 checks passed in real cached Chromium at a 390px viewport against isolated synthetic Worker/D1. Covers clean Back/Forward, unsaved Back cancellation, discard/readback, saved draft preservation, history privacy and normal root exit to the full workspace.
- Existing `tests/app-first-browser.mjs`: all 16 browser checks passed again; the result is copied into this change's evidence folder.
- Results: `tests/evidence/app-back-navigation/`. No formal acceptance is promoted.

Limits: no physical Android system-Back test, hosted Cloudflare Access authentication, field acceptance or full regression claim. The Android TWA uses browser history, but the physical-device check remains required. Unprepared offline `/app` reload and native storage remain outside this change.
