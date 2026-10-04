# Development slice 13b — frontline provider hardening

4 October 2026 (IST). At the sponsor's request ("fix all"), this slice closes two findings of the agent review of the eight frontline provider apps (#145) that remained open after the merge. Synthetic data only; the demonstration stays disabled on hosted staging; formal acceptance unchanged.

## What changed

- **The open-model libraries run in an isolated frame (review M2).** `lib/saha/frontline-capture.ts` used to `import()` Tesseract.js and Transformers.js from a CDN into Saha's own page, where a compromised package could have read the signed-in worker's data through Saha's API. Each read now runs in a fresh hidden iframe with `sandbox="allow-scripts"` and no `allow-same-origin`, so the libraries execute in an opaque origin:
  - they cannot read Saha's page, storage or cookies;
  - any request they make to Saha carries `Origin: null`, which the Worker refuses before the application runs (slice 13a);
  - storage-backed caches are off (`cacheMethod: 'none'`, `useBrowserCache: false`), because an opaque origin has none.

  The page sends the chosen file's bytes in and accepts back only text of the expected kind, engine label and length (`acceptRead`); the frame is removed after each read.
- **A receipt must answer the request Saha sent (review L1).** Before this slice a receipt with a valid signature was accepted even if its observations differed from those sent, its prompt was not what the shared demonstration rules give, or it carried extra keys. `lib/saha/frontline.ts` now requires:
  - exactly the contract's keys;
  - observations and evidence that hash to the request Saha reserved (the engine label is now recorded on the run at reservation, so a lookup can recompute the hash);
  - a prompt (priority, title, action, basis, status, clinical-use flag) equal to `assess()` from the shared rules;
  - the inference-provenance wording for the evidence kind.

  A receipt that fails any of these leaves the request uncertain and stores nothing.

## Tests

- `tests/frontline-provider-contract.mjs`: 109 checks (99 before). Five new cases have the provider return a receipt **re-signed with the correct key** but carrying:
  - different observations;
  - edited evidence text;
  - a prompt the rules do not give;
  - an extra key;
  - a misstated provenance.

  Each is left uncertain with no result stored. Removing the new checks makes the first case fail.
- `tests/ui/frontline-sandbox.spec.mjs` (Chromium, no network): a stand-in for the CDN library tries, from inside the frame, to read the parent page, cookies and local storage, and to call `/api/workspace` with credentials. The page is answered as a worst-case proxy would (reflected origin, credentials allowed). The test asserts:
  - parent page, cookies and storage are all blocked;
  - the API request carries `Origin: null`, which the Worker refuses (slice 13a);
  - the result is cut to 4,000 characters;
  - the frame is removed after a success and after a failure.

## Limits

- The libraries themselves are still fetched from the CDN without an integrity check; they are isolated, not verified. Pinning them as dependencies (inside the SBOM and audit gate) remains the stronger fix.
- No real model ran in any test, and the frame was not exercised with the real Tesseract.js and Transformers.js. Their workers and WebAssembly loading inside an opaque-origin frame are untested, so the demonstration's reads may need adjustment when it is next run with network access.
- A run reserved before this slice has no recorded engine, so a lookup of it cannot recompute the request hash; the other receipt checks still apply.
- One key is still the provider's credential, receipt signer and diagnostic credential; separating them needs a change in the eight provider apps, outside this repository.
- Built and reviewed by one agent; no independent review.
