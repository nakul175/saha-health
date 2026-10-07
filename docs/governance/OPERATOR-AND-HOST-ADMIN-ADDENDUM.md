# User and administrator guide addendum: sign-in and hosting administration

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: a change to the sign-in gateway, hosting arrangement or the two guides.

Supplements, does not replace, the [User guide](../current/USER-GUIDE.md), [Administrator guide](../current/ADMINISTRATOR-GUIDE.md) and [Support guide](../current/SUPPORT-GUIDE.md), which describe the application (roles, visits, submissions, connections, export, operations). They do not cover signing in on the droplet or host-level administration; this page does.

## For users

- **Where:** the private synthetic staging copy on the DigitalOcean droplet (`https://health.64-227-190-72.sslip.io/` per [HOSTED-STAGING](../current/HOSTED-STAGING.md)). Synthetic data only; never enter real patient information.
- **Signing in:** the browser asks for your email address and a password issued to you. There is no sign-out other than closing the browser, no lockout and no second factor. Ask the owner if you forget the password.
- **First access in an organisation:** give the organisation owner the account code shown in your account; accept the account-bound invitation (valid 72 hours). Accounts on the droplet are namespaced differently from the frozen Cloudflare copy, so members must be invited again.

## For the host operator (root on the droplet)

| Task | Command or place | Source |
| --- | --- | --- |
| Add or reset a person | `saha-health-add-user <email>`; password shown once; only a bcrypt hash is kept in `/etc/saha/saha-health.users` | [deploy/add-user.sh](../../deploy/add-user.sh) |
| Service status and logs | `systemctl status saha-health`, `journalctl -u saha-health -f`, `journalctl -u saha-health-update -n 50` | [deploy/README.md](../../deploy/README.md) |
| Release status | `cat /var/lib/saha-health/deploy-status.json` | same |
| Roll back | Revert the commit on `main`; the 3-minute timer redeploys. Data is untouched; migrations are not reversed | same |
| Rotate git token | Replace `/etc/saha/<app>.git-token` or use the deploy key | [Secrets register](SECRETS-REGISTER.md) |

Operational, incident and recovery procedures: [Runbooks](../current/09_Operational-Runbooks_v1.1.md), [OPERATIONS.md](../../OPERATIONS.md), [Incident process](INCIDENT-PROCESS.md), [Backup and DR](BACKUP-AND-DR.md).
