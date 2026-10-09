# Baseline qualification

Baseline commit: `43f445acf4c54352cd2084e0bcd88bfbf605d757`. This is an engineering qualification, not clinical, handset, government or production acceptance.

## Observed run — 9 October 2026

The original-source run [37920175452](https://github.com/nakul175/saha-health/actions/runs/37920175452) completed successfully. Its result artifact was downloaded and inspected; all required step outcomes, not merely their continue-on-error conclusions, were success. Environment: Ubuntu 24.04, Node 24.21.0, repository-pinned dependency installation. Original tests and assertion minima were retained.

| Check | Actual result |
|---|---|
| Source snapshot | Exact original commit archived before installation |
| Documentation and requirements | Passed; original 176 requirements and 364 cases preserved, no formal acceptance promoted |
| Test catalogue | Passed |
| Dependency installation | Passed |
| Lint ratchet | Passed against the existing debt baseline; not a zero-lint claim |
| Typecheck and build | Passed |
| Security policy gate | Passed under existing classifications; not an independent security assessment or no-vulnerability claim |
| Unit selection | 201 suites, 10,696 assertions, zero failed/skipped; regression guard passed |
| HTTP/D1 selection | integration/run-api-smoke: 5,020 assertions, zero failed/skipped |
| Recovery selection | resilience/recovery-drill: 21 assertions, zero failed/skipped |

The final HTTP/recovery summary records Node 24.21.0 and completion at 2026-10-09T11:10:09.948Z. Full browser regressions, physical devices, clinical performance, real providers, programme acceptance and live DigitalOcean operation were not qualified by this run.

## Evidence references

- `community-worker-baseline-results`, artifact 11612397487, SHA-256 `3e7d58b8aa095d49686e16beed0b8e227df5b3d423cd32af98a20aff84cb1d62`. Includes `tmp/saha-baseline/results.json`, test logs/summaries and the security gate output. All ten recorded required outcomes are success.
- `community-worker-source-baseline`, artifact 11611715599, SHA-256 `c8cd3abffd372adae01813940bff7b987f00cbc9751afcbbcc166074c45de222`. Contains the tracked source archive and its current baseline manifest; no ignored secrets, databases, dependencies or Git credentials.
- Artifact retention is seven days on this run. These IDs and hashes identify the observed evidence; do not assume the archive remains downloadable after expiry. Preserve evidence in the agreed release archive before expiry when long-term retention is required.

The security report lists 226 production components, with 8 low, 23 moderate, 30 high and 0 critical advisories in the audit output; its existing deployment/dev-only classifications yielded zero blocking findings. This is a pass of the existing gate, not a finding-free or production-ready system. The lint ratchet similarly retains existing debt rather than removing it.

## Method and limits

The workflow checks out the exact original source, not proposed product code. It runs the existing documentation/requirements checks, catalogue, pinned installation, lint ratchet, typecheck, build, security gate, unit selection and HTTP/recovery selection. Node 24 follows the repository development guide for complete recovery tooling; it differs from some existing Node-22 CI.

Continue-on-error collects independent evidence; a final gate fails if a required outcome failed or was skipped. Product acceptance cannot be inferred from a successful step conclusion alone. No new clinical fixtures, real recipients, provider secrets or live databases were used.

The local native Git attempt failed DNS; authenticated connector access and the archived source remained available. This was an authoring-environment limitation, not a product defect. The successful remote run establishes only the named original-source baseline. Candidate code in PR #184 has separate results and cannot inherit this pass. The existing wider regression job and relevant browser/device checks remain separate acceptance work. No main merge, deployment or live-host change occurred.
