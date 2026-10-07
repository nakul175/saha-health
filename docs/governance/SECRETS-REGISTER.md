# Secrets and key register

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: a new secret, a rotation, a change of holder, or a suspected exposure.

**Names, owners and procedures only. Never record a value here or anywhere in Git.** Names come from `.env.example`, `lib/`, `deploy/` and `.github/workflows/`. Whether each secret currently exists in a given environment was not checked: "Set?" is TBD (owner: Nakul Jain) throughout. Rotation intervals are proposals.

Holder for every item: Nakul Jain (sole named owner). Backup holder: TBD.

| Name | Purpose | Where it lives | Proposed rotation | Rotation procedure |
| --- | --- | --- | --- | --- |
| `SAHA_PROVIDER_API_KEY` | Approved HTTP AI provider | Server secret binding | On provider change or exposure | Set new binding, deploy, revoke old at provider |
| `OPENAI_API_KEY` | Built-in OpenAI evidence adapter (off by default) | Server secret binding | 90 days or on exposure | As above; adapter also needs `SAHA_EXTERNAL_APIS_ENABLED=true` and a reviewed capability |
| `SAHA_MIS_PARTNER_KEY`, `SAHA_MIS_PARTNER_CALLBACK_KEY` | MIS partner calls and callback authentication | Server secret binding | With partner | Agree overlap window with partner: TBD |
| `SAHA_EHR_PARTNER_KEY` | EHR partner calls | Server secret binding | With partner | As above |
| `SAHA_ANAEMIA_API_KEY`, `SAHA_ANAEMIA_DISPATCH_TOKEN` | Independent anaemia provider demo | Private demo deployment only | On demo end | Remove binding |
| `SAHA_FRONTLINE_PROVIDERS_JSON` | Frontline demo provider configuration (may reference secret bindings) | Private demo deployment | On demo end | Remove |
| `SAHA_REMINDER_MOCK_CALLBACK_KEY` | Mock reminder STOP callbacks, at least 32 characters | Server secret binding | 180 days | Replace and update grants |
| `SAHA_AUDIT_SIGNING_KEY` | HMAC key signing audit checkpoints | Server secret | Rotating invalidates verification of older signed checkpoints unless kept: key-versioning TBD | Do not rotate without a plan for old checkpoints |
| `SAHA_ACCESS_TEAM_DOMAIN`, `SAHA_ACCESS_AUD` | Access application identifiers | `deploy/cloudflare-staging.json` | n/a | Not secret; must match the Access app |
| `CLOUDFLARE_API_TOKEN` | Deploy workflow to Cloudflare | GitHub Actions secret | 90 days | Create new scoped token, update secret, delete old. Staging deploy is frozen; remove if Worker is retired |
| `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` | Hosted smoke test service token | GitHub Actions secret | 90 days | Reissue in Access, update secrets |
| `SAHA_GIT_TOKEN` | Droplet read-only clone of the private repo; stored as `/etc/saha/<app>.git-token` (mode 600) | Droplet | Fine-grained tokens expire (30 days default); 3-minute updates stop on expiry | Replace the file; or switch to the per-repo deploy key `/etc/saha/<app>.deploy-key`, which does not expire |
| Droplet sign-in passwords | People signing in through Caddy | bcrypt hashes in `/etc/saha/saha-health.users` | On request or leaving | `saha-health-add-user <email>` regenerates and shows a password once |
| Recovery passphrase | Encrypts database snapshots (`scripts/recovery.mjs`) | Held by the operator, separate from the backups; no recovery possible if lost | Per backup set | Custody plan and second holder: TBD |
| SSH access to the droplet; DigitalOcean, Cloudflare, GitHub account credentials | Administration | Owner's credential manager | TBD | TBD |

## Rules

- Secrets live only in server bindings, CI secrets or root-owned droplet files, never in Git, chat, tickets, incident text or labels.
- On suspected exposure: revoke at the issuer first, replace, record an incident ([incident process](INCIDENT-PROCESS.md)), and check `git log` and CI logs for the value.
- Secret scanning in CI or pre-commit: not configured (gap).
