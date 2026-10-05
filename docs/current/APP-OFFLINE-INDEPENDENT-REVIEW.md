# App offline independent review and scope fix

Reviewed final A02 commit `785baca7` in an isolated checkout. The app service worker caches fixed public resources only: no authenticated app HTML, API response, query-bearing resource, or patient data. Actual Chromium CacheStorage/IndexedDB inspection and source-executed worker contracts verify origin, MIME, redirect, opaque response, path and bypass guards. The vault stores encrypted patient values and retains durable exact-body/exact-key sync retries after a committed response is lost. Historical field access remains compatible.

## Confirmed finding and fix

P1 reproduced against actual Worker/D1: an assigned ASHA prepared a signed packet, the owner reassigned that patient, and the authoritative patient-detail route returned 404 to the ASHA in the packet organisation. Connected app unlock still displayed the old patient. The same-account care-role check alone was insufficient.

App-only online checks now validate each unexpired prepared patient through the existing audited patient-detail route with an explicit original organisation header. A different current identity, non-care role, inactive membership, unavailable patient, malformed response or positive HTTP refusal prevents unlock. The check uses direct patient partitions rather than treating a paginated workspace list as complete authority. Up to four partition reads run together; repeated org/patient pairs are checked once. No fresh clinical data is copied into the encrypted prepared packet.

Reconnect immediately hides and clears rendered patient content while the independent asynchronous validation runs. Positive denial locks and redacts the vault. This check runs even when another notebook operation is busy, and epoch/book guards prevent an old check reopening a subsequently locked notebook. A fetch transport failure preserves the existing signed, account-bound, bounded offline-grant policy. HTTP failures and login redirects do not receive that fallback. Online reads use manual redirects and refuse opaque redirects or 3xx responses, avoiding the indistinguishable TypeError produced by redirect:error. The original field notebook's historical display policy is unchanged.

## Evidence

- `tests/app-offline-scope-browser.mjs`: 10 actual Chromium/Worker/D1 scenarios covering baseline access, withdrawn assignment online denial, disconnected signed access, reconnect redaction, restoration, suspended original-organisation membership while the same account remains a clinician in its home organisation, and reported-online transport failure and actual browser login redirect refusals on unlock/reconnect.
- `tests/app-offline-scope-contract.mjs`: 14 checks for original-org routing, account/role/org/partition refusal, positive HTTP failure and transport fallback.
- `tests/app-offline-review-browser.mjs`: 22 independent actual Chromium/D1 checks covering public-only cache, encrypted blur/save/reload, signed expiry, wrong account/session, packet owner, old field reload and exact-key replay after a committed response is lost.
- `tests/app-sw-review-contract.mjs`: 16 source-executed response/cache guard checks.
- Existing app grant contract: 11 checks. Build passes. Nine historical field VM suites were repaired separately in `1f6ee5eb`, with 320 checks.

Synthetic data and local providers-disabled Worker only. Cached desktop Chromium does not prove physical Android behavior or external acceptance. Scope is checked at connected unlock/reconnect and again by existing server mutation guards; this does not provide continuous push revocation while a device remains disconnected.
