# SAHA-126 — encryption and secrets local coding completion

Date: 20 October 2026

Story: SAHA-126 / APL-149, **Encryption and secrets**

Base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`

Frozen contract SHA-256: `dac32cb11344b3d3688b6c5d7ae11094df2bc26ab56e6fac6ef18478d3de809a`

## Implemented local boundary

The existing application already keeps provider values in server bindings, encrypts the field notebook and media with AES-GCM, revision-checks browser writes, and encrypts local recovery snapshots with AES-256-GCM. This story closes the locally supportable ownership, rotation, and review-tooling gaps without claiming a hosting or KMS control:

- `SAHA_SECRET_ROTATION_RECORDS` accepts metadata-only records with an exact schema: binding name, owner reference, canonical `rotatedAt`, and later `rotateBy` date. Unknown fields, duplicates, noncanonical dates, future rotations, and expired records fail closed.
- Staging and production deployment checks require a current record for every configured MIS/EHR credential and callback binding, plus any configured server variable whose name ends in `KEY`, `TOKEN`, `SECRET`, `PASSWORD`, or `PASSPHRASE`. The live-service policy stays refused while these checks contain an error.
- The owner-only configuration report shows binding names, owners, dates, and state. It never reads a provider value into the response.
- `scripts/security-material-audit.mjs` consumes SHA-256 fingerprints rather than plaintext values. It requires one bounded regular text artefact for each of client bundle, configuration export, log, and model context. It refuses path traversal, absolute paths, symlinks, duplicate target kinds, oversized inputs, malformed/expired records, extra descriptor fields, and the descriptor itself as a target. Findings contain binding, target, line, and token position only.
- Existing encrypted notebook, sealed media, wrong-key/tamper refusal, atomic revision checks, encrypted backup, fresh-destination restore, and owner-only report authorization remain in force.

No secret, provider credential, real patient content, hosting setting, KMS integration, database, or external service was added. No external message was sent.

## Verification

All results below are synthetic and local:

| Check | Result |
|---|---|
| `node tests/encryption-secrets-contract.mjs` | 25/25 groups pass: schema, current/missing/expired/future metadata, stale-time race, notebook/media encryption, wrong-key/tamper refusal, direct encrypted backup/restore, four artefact leak detections, unsafe-plan refusals, owner authorization source, and retained recovery/vault controls |
| `node tests/environment-contract.mjs` | 29/29 pass with current-module fixture, current/missing/malformed/expired rotation metadata, and live-policy refusal |
| `node tests/field-contract.mjs` | 38/38 pass with current-module fixture |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `node scripts/test.mjs --check-catalogue` | pass; 1,045 suites and 100 component modules classified |
| `node scripts/audit-requirements.mjs --check` | required after documentation/traceability generation |
| Selected runner with deliberate baseline update | 92/92 pass; new SAHA-126 minimum 25 added and environment minimum raised 26→29; no minimum lowered or removed |

The direct invocation of `tests/recovery-drill.mjs` was retained as an invalid setup failure because this isolated checkout had no populated `.wrangler/test-state` database. The new focused suite creates its own synthetic SQLite database and verifies encrypted backup, wrong-passphrase refusal, authenticated restore, restored plaintext, and overwrite refusal. The full 21-check Worker restart drill remains a separate integration/resilience gate.

An attempted repository-wide ESLint invocation overlapped a test-owned temporary directory being removed and failed while scanning that now-absent directory. A bounded post-test lint is run separately and recorded in the evidence manifest; the failed invocation is not described as passing.

## Coding-completion decision

No identified **application-code** gap remains inside this local story boundary. Local coding completion is supportable once the final checks and commit below are recorded. The requirement remains `partial`, and all of these gates stay separate:

- independent review of source and exact evidence;
- configured CI on the exact commit;
- hosted storage, database, media, cache, log, and backup encryption verification;
- actual provider/KMS secret creation, access control, rotation, revocation, and audit evidence;
- deployed bundle, log, model-context, and configuration-export inspection using approved fingerprints;
- physical-device encrypted media/storage assessment;
- end-to-end encryption design/assessment where the approved product policy requires it;
- formal security, domain, and human acceptance;
- merge and observed deployment.

This record is author evidence. It is not independent approval, CI, merge, deployment, hosting acceptance, or formal BRD acceptance.
