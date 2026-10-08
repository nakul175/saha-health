# Threat model

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: a new external interface, provider, hosting change, or security incident.

**Agent-drafted on 2026-10-08. Not reviewed by a person or counsel. No certification or compliance is claimed.** It restates and extends the ten-threat table in [06 Security, privacy and clinical safety](../current/06_Security-Privacy-and-Clinical-Safety_v1.1.md) and the target catalogue in the [original specification](../reference/06_Security-Privacy-and-Clinical-Safety_v1.0.md). Mitigation claims are those the cited documents make; none was re-tested for this document.

## Assets and boundaries

Assets: confirmed clinical records and revisions, audit chain, receipts, identity and membership, provider/partner credentials, backups. Currently all data is synthetic.

Trust boundaries: browser or field notebook, sign-in gateway (Caddy on the droplet; Cloudflare Access on the frozen Worker), the application (Next/Vinext on a Workers runtime), the D1/SQLite store, outbound provider/MIS/EHR/ABDM adapters (off in synthetic deployments), the update path (GitHub to droplet), and the operator.

See the [architecture overview](../current/02_High-Level-Design_v1.1.md) for the design context; the deployed container view is in [deploy/README.md](../../deploy/README.md).

## Threats (STRIDE-labelled)

| # | Threat | Class | Existing mitigation (per cited docs) | Residual / open |
| --- | --- | --- | --- | --- |
| T1 | Forged identity headers reach the app | Spoofing | App trusts one provider; Caddy overrides headers; app listens on 127.0.0.1 only; Access JWT verified | Do not expose the Worker publicly with trusted headers; independent test not done |
| T2 | Weak droplet sign-in (shared basic auth, no lockout/MFA, no sign-out) | Spoofing | Named users, bcrypt hashes, synthetic data only | Accepted only for private synthetic demo ([deploy/README.md](../../deploy/README.md)); real IdP needed |
| T3 | Cross-organisation or cross-patient read | Information disclosure | Server scope checks; authorisation matrix; viewer-scoped SQL pre-filter | No independent test ([access control](ACCESS-CONTROL-MODEL.md)) |
| T4 | Cross-site request abuse (Access reflected Origin with credentials) | Tampering/Disclosure | Cross-site API refusal ([13a](../current/SLICE-13A-ACCESS-SCOPE.md)) | Whether Access adds headers to Worker answers untested ([Hosted staging](../current/HOSTED-STAGING.md)) |
| T5 | Stale authority or replayed command | Tampering | Access recheck on replay, version-bound commands, organisation CAS | Representative concurrency untested |
| T6 | Silent overwrite or audit tampering | Tampering/Repudiation | Append-only triggers, revisions, hash chain, signed checkpoints | Privileged operator/DB access can bypass; no external anchoring ([6j](../current/SLICE-6J-AUDIT-CHAIN.md)) |
| T7 | Duplicate or lost external action | Tampering | Stable logical key, receipts, uncertain-lookup, no blind retry | No real partner semantics tested |
| T8 | Prompt injection / unsupported AI output | Tampering | Closed task schema, source validation, human review, selected apply | Lexical validation only ([AI model card](AI-MODEL-CARD.md)) |
| T9 | Secret leakage (repo, logs, CI, droplet) | Information disclosure | `.env.example` names only; safe-logs check; token files mode 600 | See [secrets register](SECRETS-REGISTER.md); no secret scanning evidence |
| T10 | Supply-chain compromise (dependency, CI, auto-pull deploy) | Tampering | Lockfile, `security-gate.mjs`, droplet pulls read-only | 48 accepted dev-tool advisories; droplet deploys `main` unreviewed within 3 minutes ([third-party](THIRD-PARTY-INVENTORY.md)) |
| T11 | Lost field device | Information disclosure | Encrypted browser storage, lock, bounded grants | No native keystore; physical-device tests absent |
| T12 | Data loss or unverified restore | Denial of service | Encrypted snapshot tool, drill | No scheduled backup or real restore ([Backup and DR](BACKUP-AND-DR.md)) |
| T13 | Single droplet failure or build memory exhaustion | Denial of service | 4 GB sizing, swap, build lock | One failure domain for all apps; no monitoring ([SLOs](SLO-AND-ALERTS.md)) |
| T14 | Report re-identification via small cells | Information disclosure | Scoped aggregates, CSV escaping | Small-cell suppression incomplete |
| T15 | Insider misuse (owner/admin/operator) | Elevation | Owner cannot bypass patient scope; break-glass review | Droplet root and Cloudflare account are outside app controls |

## Out of scope / not assessed

Physical security, the Cloudflare and DigitalOcean platforms, GitHub account security, mobile OS, third-party AI vendors' own controls.

## Next review

No penetration test, no secure-code review by a person, and no tabletop exercise has occurred: TBD (owner: Nakul Jain).
