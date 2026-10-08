# Hosting Saha Health on DigitalOcean (synthetic staging copy)

Status: deployment kit, not yet run on a droplet. The Cloudflare staging copy (saha-staging.nakul17.workers.dev) is untouched and stays live until this host is verified. Synthetic data only. Real identity provider, paid AI and real-recipient delivery stay disabled, as in HANDOVER.md.

## What runs where

- One droplet, Ubuntu 24.04, **4 GB RAM recommended** (see Memory below), Bangalore region.
- The app is the same build that ran on Cloudflare. It runs in the open-source Workers runtime (`wrangler dev --local`) under systemd, with its D1 database stored as a SQLite file in `/var/lib/saha-health/state`. No application code changed.
- Caddy terminates HTTPS (automatic certificate) and proxies to `127.0.0.1:3400`. Firewall allows 22, 80 and 443 only.
- The droplet pulls `main` every 3 minutes (`saha-health-update.timer`), builds, applies any new `drizzle/*.sql` once (ledger in `/var/lib/saha-health/applied-migrations.txt`) and restarts. Nothing connects in from outside to deploy.
- The scheduled job (every five minutes, as the Cloudflare Cron Trigger did) is run by `saha-health-scheduled.timer` calling the runtime's scheduled endpoint. Environment is `synthetic`, external APIs and MIS/EHR connections are off, exactly as on the Cloudflare staging copy (`deploy/make-droplet-config.mjs` writes these settings).
- The runtime is wrangler 4.148.0, installed under `/opt/saha-health/runtime` outside the repository: the repository's wrangler 4.92.0 cannot run the scheduled job locally (it fails with a DataCloneError). Everything else runs on 4.92.0 when built.
- Release status: `/var/lib/saha-health/deploy-status.json` (commit, state, time).

## First-time setup

1. Merge this change into `main` (the droplet clones `main`).
2. Create the droplet. Create a GitHub fine-grained token with read-only "Contents" access to this repository only.
3. On the droplet, as root:

```bash
# the repository is private: copy deploy/provision.sh to the droplet (scp, or paste it into a file)
SAHA_GIT_TOKEN=<token> SAHA_HOST=health.<ip-with-dashes>.sslip.io SAHA_FIRST_USER=<your email> bash provision.sh
```

A custom domain works the same way: point an A record at the droplet and pass it as `SAHA_HOST`.

## Operate

```bash
systemctl status saha-health            # journalctl -u saha-health -f
journalctl -u saha-health-update -n 50
cat /var/lib/saha-health/deploy-status.json
```

Rollback: revert the commit on `main`; the next timer run redeploys it. Data is untouched by a redeploy.

## Known limits

- `wrangler dev --local` is a development runtime, acceptable for the private synthetic demo and not for production or real real patient data.
- The D1 database is one file on the droplet. Turn on DigitalOcean droplet backups (about 20% of the droplet price) before relying on it.
- Sign-in: the application's default identity provider accepts only the headers the original host supplied (`SAHA_IDENTITY_PROVIDER=sites-chatgpt`). On the droplet Caddy is that host: people sign in with an email address and a password (browser basic-auth), and Caddy sets the headers itself, overriding anything a browser sends. Add or reset a person with `saha-health-add-user <email>` (password shown once, only a bcrypt hash is kept in `/etc/saha/saha-health.users`). There is no sign-out other than closing the browser, no lockout and no multi-factor step. This is acceptable for a private synthetic demo for named people and is not real identity management; a real identity provider needs an application change. Cloudflare Access is not used on the droplet. Accounts are namespaced differently from the Cloudflare copy, so members would have to be invited again on this host.

## Memory

Measured on 7 October 2026: `pnpm run build` peaked at about 1.66 GB resident (21 s, one sandbox run). The running app (`wrangler dev --local`) needs further memory beside it, and the build runs while the old release is still serving. A 2 GB droplet with the 2 GB swapfile that `provision.sh` adds should work but will swap during builds; use 4 GB to avoid that. A 1 GB droplet will fail.

## Sharing one droplet with other Saha apps

Several apps can run on one droplet (recommended: 8 GB RAM for four apps). Each app has its own port, system service, database file and sign-in list. Run each app's `provision.sh` in turn with its own `SAHA_HOST` (for example `health.<ip-dashed>.sslip.io`, `agriculture.<ip-dashed>.sslip.io`).

- Caddy: each app writes `/etc/caddy/conf.d/<app>.caddy`; `/etc/caddy/Caddyfile` only imports that folder.
- Builds share one lock (`/var/lock/saha-build.lock`), so update timers never build two apps at once.
- Failure domain: one droplet means one crash, disk or build problem affects every app on it, and one backup covers all of them.

## Public origin (one host per app)

The Worker is started with `--local-upstream SAHA_HOST --upstream-protocol https` (`saha-health.service`; `provision.sh` substitutes the host). Without these flags Miniflare presents the Worker's own address, `http://127.0.0.1:3400`, as `request.url`, so the application's same-origin checks (`origin !== new URL(request.url).origin` in the API routes) compared the browser's `Origin` header with that address and refused every write with 403 behind the proxy. This was found on 8 October 2026 on the shared droplet; with the flags `request.url` carries the public https origin and the writes pass (verified with curl probes on all four apps).

One process can claim only one origin, so `SAHA_HOST` is the app's single canonical name. Any second name for the same app (for example the `<app>.<ip-dashed>.sslip.io` name used before a domain existed) must be a redirect to `SAHA_HOST` in Caddy, not a second site block proxying to the same port: writes through a served second name fail with the same 403.

State of the shared droplet on 8 October 2026: the installed unit predates this change, so the two flags live in the drop-in `/etc/systemd/system/saha-health.service.d/public-origin.conf` (an empty `ExecStart=` followed by the full command line with the flags). The canonical host is `health.aplyd.org`; `health.64-227-190-72.sslip.io` answers 301 to it. That redirect was added to Caddy on the droplet by hand and is not in this kit's `Caddyfile` (the Caddy files from before the change are kept as `/root/saha-health.caddy.bak-origin-fix`). When the unit is next installed from this kit (a re-run of `provision.sh`), delete the drop-in before `systemctl daemon-reload`, so that there is one `ExecStart` line and the kit's unit and the drop-in cannot drift apart; check the redirect for the old name again afterwards, because `provision.sh` rewrites `/etc/caddy/conf.d/saha-health.caddy`.

## Git access: token or deploy key

`provision.sh` reaches the private repository in one of two ways:

- `SAHA_GIT_TOKEN` set: a fine-grained GitHub token with read-only Contents access, stored in `/etc/saha/<app>.git-token`. Fine-grained tokens expire (30 days by default), after which the 3-minute updates stop until the file is replaced.
- `SAHA_GIT_TOKEN` unset: an ed25519 deploy key generated on the droplet at `/etc/saha/<app>.deploy-key`. The first run only prints the public key; add it to the repository under Settings > Deploy keys (read-only), then run `provision.sh` again. GitHub's SSH host keys are fetched from `api.github.com/meta` over TLS into `/etc/ssh/ssh_known_hosts`. Deploy keys do not expire and are scoped to one repository.

Both the first clone and every later update use the same method; `update.sh` picks the key automatically when the file exists.
