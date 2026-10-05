# Shared browser offline app journey

5 October 2026. Local synthetic evidence; formal acceptance remains pending.

`/app` retains authenticated network loading and current patient checks. Its Sync action opens `/app/offline/`, a public locked shell with prepared-visit Today, Patient capture and Sync views. On a reported offline connection or failed navigation fetch, the installed `/app` service worker serves that locked shell for `/app` (including query links). Today counts prepared packets and device drafts, not all assignments or visits due today. Sync still creates an unconfirmed draft; a patient/visit link returns to `/app` for an explicit online check before confirmation.

The shell shares the existing `saha-field-v1` IndexedDB vault, revision compare-and-swap writes, PBKDF2/AES-GCM protection, packet signatures/hashes and encrypted media with `/field/`. There is no vault schema, encryption additional-data or database migration. Existing field history and bookmarked `/field/index.html` remain readable offline. Public assets use canonical trailing-slash HTML URLs because the static host redirects `index.html`; redirects are refused during cache installation. App and field workers cache only fixed public resources with expected origin, response URL and content type. Authenticated app HTML, API responses, patient facts and query navigations never enter Cache Storage. App navigation fetches use `no-store`.

Unlock when connected checks the authenticated care account before exposing the vault. Offline unlock is an explicit passphrase operation for the vault's last bound worker; packet and registration owners must match. App patient disclosure/capture requires a finite, current, worker-bound grant no longer than 24 hours. Expired names and facts are withheld while ciphertext remains available for original field history and online comparison/renewal. Registration details are withheld in the offline app. Hiding the page, leaving it or two minutes of inactivity locks memory. Returning online checks identity again and locks on refused reads or account mismatch. Server lease, membership, consent, assignment, visit-version, package-hash and retry-receipt checks remain unchanged and authoritative at sync; there is no offline confirmation or delivery.

The app editor also preserves focus when moving from a measurement to another editor control. Previously the measurement change rebuilt the Notes box during focus transfer, allowing typed notes to be lost. The rendered browser test now checks both measurement and notes after encrypted reload.

## Evidence

- `tests/app-offline-browser.mjs`: real Chromium against isolated synthetic Worker/D1; 18 checks covering shared vault access, offline `/app?patient=…` reload, locked public shell, measurement/notes persistence, ciphertext-only storage and fixed cache URLs, unconfirmed sync, explicit online review link, lost authentication, changed account, wrong account, actual signed-packet expiry, mismatched packet/vault owner, original field history and original field offline reload.
- `tests/app-offline-contract.mjs`: 11 app grant/owner policy checks, including malformed dates, overlong/future grants, exact expiry and owner mismatches.
- Existing `tests/field-contract.mjs`: 38 server field/encryption contracts pass; copied report in `tests/evidence/app-offline/`.
- Existing rendered app UI checks: 15 pass. Direct Chromium app-first regression updated to assert the Sync target; its result is copied into this evidence folder after the run. Phone Playwright specification has the same target assertion; the wrapper was not run locally because `@playwright/test` is not present in linked local dependencies.
- Typecheck and production build pass. The existing large client bundle warning remains.

Reports, storage audit and synthetic screenshots are in `tests/evidence/app-offline/`. No real messages, patient records or provider calls were used. Physical Android, real device eviction, controlled clock abuse, deployment and formal acceptance remain external. Browser-held encryption is not Android Keystore custody. Offline grant validity cannot observe a server revocation or changed account until connectivity returns; the bounded signed grant and explicit passphrase protect local access, and sync always rechecks the server.

## Integration

Register `OfflineRegistration` only in the additive app-first workspace; preserve root workspace navigation and existing Outreach refresh fixes when merging. Point the app Sync button to `/app/offline/`. Add the new contract/browser suite to the test catalogue without lowering existing guard counts. No package, dependency, route-handler, command or D1 migration change is required. The integrator owns shared implementation, requirement and validation documents; this slice does not promote an acceptance criterion.
