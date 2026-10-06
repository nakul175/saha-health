# Independent A02 review: existing field fixture compatibility

5 October 2026, reviewed final A02 commit 785baca7 in an isolated worktree. A P2 regression blocker was reproduced: `tests/field-client.mjs` and `tests/field-units-client.mjs` stopped before their first assertion because their VM harness removed only the first import from the field client. A02 added a second import for app grant presentation. The minimal fake DOM also lacked the body dataset used to distinguish the additive app shell.

Nine existing field VM fixtures now remove all top-level import lines and supply an empty `document.body.dataset`. Product `public/field/app.js`, its encrypted vault, the app service worker, and server commands are unchanged by this fix. App-specific grant helpers remain unused in these legacy field-mode fixtures; their real module/browser coverage is separate.

All nine existing suites pass: field client 23, units 14, storage 30, provenance 17, recording 28, media 97, registration 66, capacity 15, media capacity 30 (320 checks). The copied reports and digests are in `tests/evidence/app-offline-review-fixtures/`. Capacity runs preserve existing CAS/encryption/queue checks; these local measurements do not establish device or hosted scale acceptance.

This is the fixture-only portion of independent review. Cache, account/grant, actual browser sync and current online patient-scope review are recorded separately. A04 later adds unit controls and can update its own expected control count/canonical conversion values while preserving these harness corrections. Integrator owns shared catalogue/baseline/validation refresh.
