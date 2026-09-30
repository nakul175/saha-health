# Development slice 0c — identity layer, supply-chain gate and CI

30 September 2026 (IST). Third foundation slice, following the sponsor's decision to keep the current sign-in during development behind a swappable layer. Synthetic data only; no acceptance status changes.

## What changed

- **Identity layer.** `lib/saha/identity.ts` gives the server, the page and request metrics one `Principal`. `SAHA_IDENTITY_PROVIDER` selects exactly one trusted provider:
  - `sites-chatgpt` (default): the R11 Sites headers and account IDs, unchanged.
  - `cloudflare-access`: a Cloudflare Access application in front of the Worker. The `Cf-Access-Jwt-Assertion` token is verified (RS256 signature against the team's published keys, issuer, audience, expiry and not-before with 60 s skew). Access can federate an institutional SAML or OIDC identity provider, which is the route to a government or buyer sign-in (BRD D10).
  - Headers of the unselected provider are ignored. A misconfigured provider answers 503 instead of falling back. The sign-out link follows the provider.
- **Supply-chain gate.** `scripts/security-gate.mjs` writes a CycloneDX 1.5 SBOM of the 222 production dependencies and runs `pnpm audit`. It fails on critical advisories and on high advisories present in the built bundle. On 30 September: 0 critical, 22 high, 16 moderate and 7 low advisories, all in development or build tooling (miniflare, vite, eslint and related packages, plus build-time `browserslist` via `next`); none found in `dist/`. Gate passed.
- **CI workflow.** `.github/workflows/ci.yml` runs the documentation checks, install, type check, build, supply-chain gate, HTTP/D1 suite, contract suites and restore drill on pull requests with synthetic data. It has not yet run on GitHub.
- **Local test stability.** Requests rejected before their body was read (CSRF, media type, scope) intermittently made the next request on the same local connection fail with "worker restarted mid-request" (seen in R10, R11, 0a and 0b runs). The request wrapper now drains up to 64 KB of an unread body and cancels the rest. Five consecutive full runs afterwards had no restarts; before the fix roughly one run in three failed.

## Evidence

- 18 identity contract assertions (`tests/identity-contract.mjs`) with a locally generated RSA key and an injected key endpoint: valid token, key caching, wrong audience, wrong issuer, expired, not yet valid, wrong key, unknown key id, `alg: none`, missing signature, tampered claims, malformed email, provider exclusivity in both directions, header parsing, key-endpoint failure failing closed, sign-out paths.
- HTTP checks against the built Worker: with Access selected but not configured, API calls return 503; configured, both Sites headers and a forged token return 401; with the default provider an unauthenticated call returns 401 and an Access header is ignored. The browser check found the sign-out link unchanged for the default provider.
- All suites: 950 HTTP/D1, 398 contract/checkpoint (380 plus 18 identity) and 21 restore assertions; reports, SBOM and gate report in `tests/evidence/slice-0c/`.

## Limits

- No real Cloudflare Access application or institutional identity provider was connected. Privileged MFA, workforce recovery, device replacement and session revocation remain with the identity provider and are not verified here.
- Switching an existing deployment to Access creates new account IDs; members must be re-invited. There is no identity migration tool.
- The SBOM covers npm production dependencies only, not the Workers runtime or hosting. The audit reflects the registry advisory database on the day it runs.
