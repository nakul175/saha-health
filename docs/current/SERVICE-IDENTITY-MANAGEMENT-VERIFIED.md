# Service identity management: local database and browser verification

5 October 2026. This follow-up verifies the owner management surface through the built application rather than only a contract harness. It does not change service-dispatch policy or close R13's external acceptance.

The owner reaches the form through Operations → Service & incidents → Service identities. The browser run creates an identity, binds it to Anaemia Screen, reads the stored binding through the actual Operations route, then revokes the identity. Revocation leaves the binding in place so future opted-in dispatch cannot fall back to unmanaged access. The form now uses readable provider names and explicitly labelled, full-width native selectors. Chromium exposed the original selector's ambiguous nested-option label; the corrected selectors pass the full flow.

`tests/service-identity-management.mjs` starts a fresh isolated local Worker/D1 with external APIs and independent provider demonstrations disabled. Synthetic dispatcher identities stay on localhost. Its browser context refuses non-local resources. It runs 10 checks:

- Owner create through `/api/commands`, same-key replay without duplication, and creation audit in actual D1.
- Administrator refused for create/bind/revoke; Operations returns no owner service-authority projection.
- Another organisation's owner refused for reads/changes; another organisation cannot bind the first organisation's service identity.
- Binding persisted in D1 and read back with the initiating human's audit event.
- Wrong-target and expired bindings refused while preserving the current binding.
- Revocation succeeds during maintenance with a synthetic settings-pressure fixture larger than one million bytes; existing binding and fixture are preserved. The fixture is then removed for UI testing.
- Cached Chromium owner create and bind using the reachable form, verified against current server state.
- Cached Chromium owner revoke and current readback; revoke button disappears, binding remains.
- Chromium administrator reaches Service & incidents without owner management controls.
- A former owner loses management receipt replay authority immediately after ownership removal.

All 10 pass against the final form. TypeScript, app build and whitespace checks pass. The successful result and two owner screenshots are pinned in `tests/evidence/service-identity-management/manifest.json`. Local D1 pressure is injected directly only into this disposable synthetic fixture; actual create, bind, revoke, pause/resume and readback use application routes. No provider delivery, model invocation or hosted identity acceptance is exercised.

Run the harness with the project's Node runtime after building. It accepts `SAHA_BROWSER_PACKAGE` for a bundled `playwright-core` module, `SAHA_CHROMIUM` for an existing Chromium executable, and `SAHA_SERVICE_UI_PORT` for an unused localhost port. This run used cached Chromium build 1194 and the bundled Playwright runtime; no browser or dependency installation was performed. It stops its Worker and browser in `finally`.

Integrator: register the new management harness separately from the fast service-dispatch contract suite, and refresh shared source/evidence documentation. This follow-up changes only the UI module, the new management harness, dedicated documentation and evidence. It intentionally leaves the independently reviewed service-dispatch patch to its assigned workstream.
