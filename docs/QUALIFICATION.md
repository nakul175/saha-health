# Qualification record

The retained R11 product checks ran on 27 September 2026. This documentation edition was checked separately on 28 September. Publishing this pack does not create a new product test run, clinical sign-off, partner acceptance or production certification.

| Evidence group | Saved assertions | Interpretation |
| --- | ---: | --- |
| Built Worker HTTP and isolated D1 | 902 | Synthetic account, scope, state, persistence and recovery behavior |
| Contracts and execution checkpoints | 361 | Local contracts, injected transport/CAS, field cryptography and client/shell stubs |
| Encrypted restore | 21 | Isolated local SQLite snapshot and restarted Worker; 25 tables including metadata |
| Total | 1284 | Assertions across layers; not end-to-end workflow count or requirement coverage percentage |

The [execution register](current/EXECUTION-REGISTER.csv) lists each report, its digest, stored timestamp when available and reproduction command. Reports lacking their own timestamp are labelled as such; the release narrative supplies context without inventing dates. [VALIDATION.md](../VALIDATION.md) preserves release-by-release observations, failed initial attempts and final result limitations.

The original catalogue contains 364 application acceptance definitions. [TEST-CATALOGUE.csv](current/TEST-CATALOGUE.csv) preserves every original case, step and expected outcome. All 364 remain **Not run as formal catalogue cases**: related engineering assertions have not been manually equated to full original acceptance cases. The 176 BRD acceptance decisions are also all pending. Archived reference-model checks are design checks and are not included in 1,284.

## Evidence limits

- Saved contract checks use injected transport; no live AI, MIS, EHR or ABDM acceptance is established.
- Browser observations in VALIDATION are limited synthetic desktop journeys. Multi-account approvals are tested through HTTP/D1, not browser impersonation. Physical devices, actual disconnected IndexedDB durability and screen-reader qualification remain open.
- The local parser's known English corpus pass does not establish representative multilingual accuracy. Hindi eligibility fails; no approved production clinical protocol is seeded.
- Local encrypted restore excludes hosted export, scheduled retention, production cutover, device-only drafts and external side-effect reconciliation. RPO/RTO remain unqualified.
- Source references in traceability provide implementation context, not clause-level proof. No independent security audit, legal finding, clinical outcome or field effectiveness is claimed.
- The documentation checker verifies hashes, relationships and coverage. It cannot judge clinical correctness or replace a human acceptance decision.

Reproduction instructions are in [Development and CI](current/DEVELOPMENT-AND-CI.md). Full product reruns were not needed for this documentation-only update; runtime source, migrations and saved test results are checked against the baseline manifest. The new documentation verification record is [DOCUMENTATION-QA.md](current/DOCUMENTATION-QA.md).


### Worker-day entry candidate — 9 October 2026

[Bounded delivery and remaining qualification](current/worker-day-delivery/README.md). Opt-in synthetic presentation; no formal requirement or clinical acceptance promoted.


### Worker-day offline continuation — candidate

[Story, implementation and verification boundary](current/worker-day-offline/README.md). Existing encrypted vault, scoped packets and draft sync are reused; no new approval or data store. Parent requirements remain pending.
