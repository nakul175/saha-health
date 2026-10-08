# Backup and disaster recovery

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: enabling a backup, a real restore test (log it in [RESTORE-TEST-LOG.md](RESTORE-TEST-LOG.md)), a hosting change, or a decision on RPO/RTO.

**Status: a tested local tool exists; no scheduled backup is confirmed on any real host and no restore has been performed on a real host.** All data in every deployment is synthetic.

## Objectives

| Objective | Proposed target (NFR-06, not accepted) | Demonstrated |
| --- | --- | --- |
| RPO | at most 15 minutes | None. No scheduled backup is evidenced |
| RTO | at most 4 hours | None. Local drill finished in seconds on a 28.9 MB synthetic database; not representative |

## What is backed up, where

| Deployment | Data store | Backup state |
| --- | --- | --- |
| DigitalOcean droplet (current synthetic staging, `health.64-227-190-72.sslip.io`) | D1 as a SQLite file under `/var/lib/saha-health/state` | The kit says to turn on DigitalOcean droplet backups before relying on it. Whether they are on: TBD (owner: Nakul Jain). One droplet is shared by several apps, so one backup and one failure domain cover all ([deploy/README.md](../../deploy/README.md)) |
| Cloudflare Worker + D1 (frozen) | D1 | No backup schedule of its own; relies on D1's built-in restore, which has not been exercised ([Hosted staging, Limits](../current/HOSTED-STAGING.md)) |
| Source | GitHub `nakul175/saha-health` | Source and test evidence only, not the patient database ([OPERATIONS.md](../../OPERATIONS.md)) |
| Device-only encrypted drafts, hosting secrets, DNS, provider grants, external system state | n/a | Not in any snapshot |

## The tool

`scripts/recovery.mjs` takes a consistent SQLite online-backup snapshot of an authorised local database, checks integrity and foreign keys, and encrypts the database plus manifest (AES-256-GCM, PBKDF2-SHA-256 with 310,000 iterations, passphrase on stdin). Restore refuses an existing destination, authenticates the ciphertext and verifies digests before writing a new candidate. Bounded to 64 MiB; Node 24 with `node:sqlite`. Procedure and boundaries: [OPERATIONS.md](../../OPERATIONS.md), "Encrypted database snapshot tool" and "Drill and rollback". `tests/recovery-drill.mjs` is run on every pull request (21 checks on synthetic local D1; limits recorded in `tests/recovery-result.json`).

## Recovery principles (from the runbooks)

- Restore first to an isolated environment; verify; get the owner's approval for cutover.
- A restore can revive revoked access or approvals and does not replay deletions; compare identities, memberships, receipts and queue keys before reopening. Never replay external writes because of a restore.
- Prefer a forward fix to a restore; applied migrations are not reversed.

## Gaps

No automated backup job, no off-droplet copy, no backup of the tool's passphrase custody plan (see [secrets register](SECRETS-REGISTER.md)), no restore-time measurement on the real host, no deletion-replay procedure after restore, and no retention rule for backups ([retention schedule](RETENTION-SCHEDULE.md)).
