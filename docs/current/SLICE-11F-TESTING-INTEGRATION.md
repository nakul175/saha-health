# Development slice 11f — testing ecosystem integration and the defects it found

3 October 2026 (IST). Round 11 built the testing ecosystem the sponsor asked for in five parallel slices: 11a runner, catalogue, regression guard and CI tiers; 11b smoke; 11c browser UI; 11d non-functional; 11e UAT pack and coverage map. This slice joins them, fixes what the new suites found, and wires every layer into the runner and CI. The resulting system is described in [Testing Saha](TESTING.md). Synthetic data only; formal acceptance unchanged.

## Defects the new suites found

- **D-1, hosted sign-in never worked (fixed in slice 0c-1, pull request #118, and carried here).** The identity-hardening suite (11d) signed a Cloudflare Access token in the real Workers runtime and every request was refused 401: `lib/saha/identity.ts` fetched the Access signing keys with `redirect: 'error'`, which workerd rejects. Since Access was turned on (2 October) nobody could use the hosted site after signing in.
- **D-1, same option in provider and partner calls (fixed here).** `lib/saha/mis.ts`, `agent-provider.ts`, `ehr-provider.ts` and `server.ts` (`externalCall`) passed the same mode; on Cloudflare every live MIS, EHR and AI provider call would have thrown before sending. They now use `redirect: 'manual'`: a 3xx is not `ok`, so it is refused by the existing checks as an unconfirmed or failed result and never followed. The MIS, EHR and agent contracts assert `manual` and that a 301, 302 or 307 is refused after exactly one request. These calls are off in every hosted environment, so nothing changed for users.
- **Shared harness flake (fixed here).** `tests/lib/worker.mjs` applied the sixteen migrations with one wrangler process per file; on a loaded machine 4 of 6 trials left a broken database (slice 11b). It now applies them in one call (`tests/lib/migrate.mjs`).

## Findings left open

- **O-1 (availability, fails closed):** under eight concurrent clients a read is occasionally refused with 503 because its access audit event could not be written; nothing is shown and a retry succeeds (2 of 8 burst runs, one read in about 290 each).
- **O-2 (memory):** in Miniflare without an inspector, the Worker's resident memory grew from about 199 MB to 583 MB over 3,000 workspace loads (heap, not the database) and had not levelled off; a Cloudflare isolate is limited to 128 MB. Not measured on Cloudflare.
- **O-4 (performance):** the time for 1,000 workspace loads rose from 21.5 s to 37.4 s across 8,000 loads in the same run. Not investigated.
- Smaller observations (FHIR download without `nosniff`, a 422 before 401 on malformed bodies, command responses carrying the whole snapshot, a cut-off phone search placeholder, receipts with equal timestamps in random order) are listed in the 11c and 11d slice documents.

## Wiring

- Integration of 11a and 11c: Playwright helpers moved to `tests/ui/support/`, which the catalogue treats as support; the runner contract counts Playwright specs as components of the UI configuration.
- `scripts/test-catalogue.mjs` `SUITE_ARGS`: the UAT generators run in their drift-check mode and the hosted smoke runs its local self-test when the runner starts them, so a test run never rewrites tracked documents or reaches the hosted site.
- CI (`ci.yml`, pull requests): adds the authorisation matrix, identity hardening and the three UAT checks after the smoke step. Weekly and on demand (`regression.yml`): every layer with the regression guard; Chromium is installed for the UI suite (Playwright is now a pinned dev dependency). After each deploy (`deploy-staging.yml`): the hosted smoke, which fails the job on a failed check and warns when the site cannot be reached.
- `requirements/evidence-map.json` cites the new suites as evidence context for BR-ID-02, BR-ID-03, BR-SEC-06, BR-UX-01, BR-UX-05, NFR-02, NFR-05, NFR-08, NFR-09, NFR-10, NFR-13, NFR-15 and NFR-24; the coverage map and UAT pack were regenerated. No requirement changes status.

## Evidence

See the round-11 section of `VALIDATION.md` and `tests/evidence/slice-11f/`.

## Limits

- Built by agents in parallel and integrated by an agent; no person has reviewed the test code. A test that cannot fail would not be noticed by the regression guard, which counts passed assertions.
- Nothing ran against the hosted site from this machine (its egress blocks the host); the hosted smoke has run only against a local stand-in.
- Screenshot baselines were rendered on this container and may need regenerating on GitHub's runner.
