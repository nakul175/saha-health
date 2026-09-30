# Operations, reporting and recovery

Release 7 / v0.8. Synthetic engineering workspace. Deployment owners must accept all clinical, security, integration, device and recovery gates before a real pilot.

## Supervisor reporting

Open **Operations → Team overview**. The server derives counts using current membership and care-team scope. Supervisors cannot see other teams. Owners retain their clinical role's scope; ownership is not blanket clinical access. Administrators receive technical metrics and incidents but no patient aggregates or clinical CSV exports. ASHA workers and non-owner clinicians use their existing care worklists.

The selected window is 7, 30 or 90 UTC calendar days including today. Started visits use creation time; confirmed visits use confirmation time; voided and superseded visits are excluded. Backlog always reflects current state, independently of the selected period. Undated referrals are counted separately from overdue referrals. A missing record is not evidence that no care is needed. The report has no connection freshness guarantee for disconnected programme sources.

Active workers means distinct actors on scoped patient audit events in the window. It is activity, not staffing, hours worked, clinical productivity or adoption against a baseline. Confirmed visits, accepted destination receipts and completed follow-ups remain separate measures. Destination simulations are labelled. CSVs contain scoped aggregates, dates and destination names, with spreadsheet-formula escaping; they contain no patient rows. Small groups can still reveal information in context; exports remain restricted programme data.

Agent requests show local/live calls and known input/output token usage. The owner can set USD-per-million-token assumptions. The current assumptions are applied to the entire selected period. Estimates exclude missing usage, legacy AI, hosting, data transfer, MIS/EHR and other charges. They are not invoice reconciliation. Rate changes are audited but there is no effective-dated billing ledger.

## Service monitoring and support

**Service & incidents** shows the previous 24 hours of authenticated application request counts by fixed route/status, server-error counts, mean and maximum latency. It is not end-to-end uptime or a p95 service-level objective. The current response is recorded after the report query and appears on the next refresh. Production identity is required; development preview's synthetic fallback is deliberately excluded from durable metrics.

Hourly metrics store only organisation ID, fixed route, numeric status, count, total duration and maximum duration. Old buckets are removed on subsequent traffic to that organisation, with a 30-day cutoff. A dormant organisation's old rows remain until its next request; this is not a scheduled erasure guarantee. No body, query, patient/actor ID, credential, provider response or exception text is stored in metrics. Platform logs receive a random request reference, fixed route, status and elapsed time. Upstream platform logging is separately controlled by the hosting operator. A failed metrics write does not fail a clinical request; the platform log records that monitoring is unavailable.

Pre-authentication errors, a wholly unavailable worker/database, callback ingress, external provider uptime, device-only actions and hosting-layer failures are outside this counter. External uptime checks, alert delivery, escalation paging, log retention and an incident rota are deployment dependencies. Saha sends no new email/SMS/Slack alerts in this release.

**Support diagnostics** downloads release, time, maintenance flag, numeric request summaries, open-incident count and gate IDs/statuses. It excludes clinical aggregates, identities, organisation ID, incident free text and connector URLs. Downloading does not authorise transmitting it to an external support provider. CSV and support downloads create audit records; if the audit write or concurrent-access check fails, the export is withheld.

## Incident handling

Owners and administrators record a concise operational title/case reference, severity and an active operations owner. Status moves from open to investigating or resolved. Findings are required; resolution also needs an evidence reference. Resolved records cannot be edited. Open a new linked incident for follow-up. A suspended incident owner is labelled inactive and should be reassigned through an update.

Do not put patient details or secrets in incident text. Store clinical evidence in the existing restricted record and refer to the governed case. The register is capped at 100 incidents pending a separately designed archival policy. There are no attachments, automated severity classification, automatic owner escalation or independent verification of operator-entered evidence.

## Maintenance and safe recovery

Only an organisation owner can pause or resume it. Every change needs a reason and the current operations version. The existing organisation compare-and-swap means a concurrent in-progress database command cannot silently commit across the maintenance change.

While paused, new capture, confirmation, field sync, model requests and new MIS/EHR sends are rejected with HTTP 423. The UI keeps the user's form input. Authenticated reading, switching organisations, known receipt replay, MIS/EHR receipt lookup, legacy reconciliation, permission withdrawal, cancellation, grant/invitation revocation and membership suspension remain available. Callback evidence and final receipts from requests already in flight are retained. Maintenance is not a distributed cancellation guarantee: an external request whose checkpoint has committed may still finish. EHR publication rechecks maintenance after patient lookup and before its document write.

Do not approve new work during an incident. Look up unresolved keys before considering retries. Never treat a timeout as definitive failure or regenerate a key to bypass an uncertain receipt. Reopening after maintenance requires the owner's reviewed reason, not an automatic timer.

## Encrypted database snapshot tool

`scripts/recovery.mjs` is an operator-only local tool. It does not fetch hosted D1 data, manage credentials, schedule backups, perform a live cutover or overwrite any file. It accepts an authorised local SQLite database, acquires a consistent snapshot using SQLite's online backup API, checks database integrity and foreign keys, and encrypts the database plus manifest using AES-256-GCM. The manifest has a complete schema hash and per-table row count/digest. PBKDF2-SHA-256 uses 310,000 iterations and a random 32-byte salt; each backup uses a random 12-byte IV. The passphrase must be 16–1024 characters and is read from standard input, not command arguments.

Node 24 was used for the drill. A runtime exposing `node:sqlite` and its `backup` API is required. The tool is bounded to a 64 MiB SQLite snapshot; it is not a large-database backup service. Encrypted files use owner-only permissions. Plaintext intermediate databases use a private temporary directory and are removed in `finally`; filesystem deletion is not guaranteed secure erasure. Use an appropriately encrypted operator device. There is no password recovery.

```sh
node scripts/recovery.mjs backup /secure/source.sqlite /secure/new-backup.sahabackup --passphrase-stdin
node scripts/recovery.mjs restore /secure/new-backup.sahabackup /secure/isolated-new.sqlite --passphrase-stdin
```

Supply the passphrase from an approved secret-manager pipe, with terminal echo disabled if entering interactively. Do not commit it or put it in shell history. Use an independent retained copy in approved encrypted storage and keep the recovery secret separately. Backup locations, scheduling, rotation, retention, owners and production recovery objectives must be agreed for the actual deployment. GitHub contains source and test evidence only; it is not the patient database backup.

Restore refuses an existing destination, authenticates ciphertext, checks the database SHA-256, integrity, foreign keys, all table digests and schema hash, and only then writes a new candidate database. Review restored receipt states and access controls before any cutover. Device-only encrypted drafts, hosting secrets, DNS, provider grants and external system state are not in this database snapshot.

## Drill and rollback

1. Run the built Worker regression suite against isolated local D1.
2. Run `node tests/recovery-drill.mjs`. It backs up that synthetic database, rejects wrong-passphrase/tampered input and overwrite attempts, restores to a new directory, compares all tables, verifies append-only triggers and opens the real built Worker on the restored database at an isolated local port.
3. Inspect `tests/recovery-result.json`. The drill makes authenticated reads only after restore; existing command receipts must remain unchanged. It does not contact partners or resend submissions.
4. For a real incident, pause and reconcile in-flight external work before the database operator takes an authorised consistent hosted snapshot. Retain the original. Restore first to an isolated environment, verify schema/source compatibility, run workflow acceptance, and obtain deployment-owner approval for the actual cutover.
5. Prefer a compatible forward fix. The new migration is additive and prior migration files remain immutable. Do not run old releases against live data: older code does not enforce Release 7 maintenance and may lack field/receipt safeguards. A source revert alone is not a database or external-system rollback.
6. Before resuming, compare identities, member status, confirmed records, audit/revisions, pending field grants, queue keys and external receipts; expire stale approvals and reconcile every uncertain operation. Restoring an old snapshot can revive revoked access or approvals, so no automatic reopen is provided.

## API and schema

- `GET /api/operations?days=7|30|90`: scoped report, authorised operations metadata and immutable release gates.
- `GET /api/operations?days=30&format=csv`: audited care aggregates.
- `GET /api/operations?format=support`: audited technical diagnostics.
- Commands: `opsMaintenance`, `opsIncident`, `opsUpdateIncident`, `opsRates` use the existing authenticated JSON command endpoint, idempotency key and CSRF controls. All require the current operations version. Owner-only actions remain owner-only on receipt replay.
- Migration `0002_petite_marten_broadcloak.sql` adds organisation operations state and hourly request metrics; it modifies no existing record or migration.
- Streamed commands stop at 20,000 bytes. The request is parsed once so retry handling cannot create an unbounded unread body clone.

## Remaining Release 7 acceptance

The engineering controls are implemented and locally exercised. Independent security testing, physical mobile/accessibility validation, representative load/soak testing, automated alerting, hosted backups and disaster-recovery cutover are not accepted. The whole-organisation state loader and organisation-level write guard remain scale constraints. ABHA/HIP/HIU implementation, live integrations, model validation and device/speech gates from earlier releases remain open. Release 8 cannot be treated as an automatically approved real-patient launch.
