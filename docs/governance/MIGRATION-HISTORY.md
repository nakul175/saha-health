# Migration history

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: any new file in `drizzle/` (add a row in the same PR).

This complements the [current data dictionary](../current/CURRENT-DATA-DICTIONARY.md) (tables and columns, generated from `db/schema.ts`), which does not list migrations. Source of truth: the SQL files in [drizzle/](../../drizzle/) and the journal `drizzle/meta/_journal.json`. **Applied migrations are never edited, renumbered or deleted** ([AGENTS.md](../../AGENTS.md)); a change is a new additive migration.

Generated on 2026-10-08 from the working tree at `origin/main` (`be580dd`): 33 SQL files. "Journal date" is the drizzle-kit `when` timestamp converted to UTC. The counts are a text count of statements, a rough size indicator, not a review of content. The hash is the first 16 hex characters of the file's SHA-256; recompute with `sha256sum drizzle/*.sql`.

| File | Journal date (UTC) | Statements (text count) | SHA-256 prefix |
| --- | --- | --- | --- |
| `0000_handy_blockbuster.sql` | 2026-09-26 | 1 create table, 0 alter table, 0 index, 0 trigger | `2236e64f6447dbe4` |
| `0001_tearful_victor_mancha.sql` | 2026-09-26 | 17 create table, 0 alter table, 15 index, 4 trigger | `139f64838d42486d` |
| `0002_petite_marten_broadcloak.sql` | 2026-09-27 | 2 create table, 0 alter table, 0 index, 0 trigger | `f6af8de70b458aed` |
| `0003_sparkling_red_wolf.sql` | 2026-09-27 | 1 create table, 0 alter table, 0 index, 0 trigger | `2822e27e9b56cca5` |
| `0004_freezing_scarlet_witch.sql` | 2026-09-27 | 2 create table, 0 alter table, 0 index, 0 trigger | `12002e1afdce4461` |
| `0005_breezy_killraven.sql` | 2026-09-27 | 1 create table, 0 alter table, 0 index, 0 trigger | `dee0b347e61d9e41` |
| `0006_patient_concurrency.sql` | 2026-09-29 | 0 create table, 2 alter table, 0 index, 0 trigger | `aec549f8f38528a2` |
| `0007_households.sql` | 2026-09-29 | 1 create table, 0 alter table, 1 index, 0 trigger | `9e7969af87505308` |
| `0008_caseload_transfers.sql` | 2026-09-29 | 1 create table, 0 alter table, 1 index, 0 trigger | `79505896f6998e68` |
| `0009_identity_cases.sql` | 2026-09-29 | 1 create table, 0 alter table, 2 index, 0 trigger | `2a9bee76aaf7a4e4` |
| `0010_rights_requests.sql` | 2026-09-29 | 1 create table, 0 alter table, 2 index, 0 trigger | `146897ace5fafcd8` |
| `0011_retention.sql` | 2026-09-30 | 1 create table, 0 alter table, 0 index, 0 trigger | `2a95cd06b7fd881a` |
| `0012_media.sql` | 2026-09-30 | 1 create table, 0 alter table, 2 index, 0 trigger | `cae1e5b2f698314d` |
| `0013_audit_chain.sql` | 2026-09-30 | 0 create table, 3 alter table, 1 index, 0 trigger | `f24a3d74d373b162` |
| `0014_alert_delivery.sql` | 2026-10-01 | 2 create table, 0 alter table, 3 index, 0 trigger | `7c54e02a59ef4009` |
| `0015_notification_channel.sql` | 2026-10-02 | 1 create table, 0 alter table, 2 index, 0 trigger | `b4a69051fe3c469a` |
| `0016_scheduled_cursor.sql` | 2026-10-03 | 1 create table, 0 alter table, 0 index, 0 trigger | `6d9a557b92fc0c33` |
| `0017_audit_time_indexes.sql` | 2026-10-03 | 0 create table, 0 alter table, 2 index, 0 trigger | `5f422573b8bb220d` |
| `0018_abha_review_reservations.sql` | not in journal | 1 create table, 0 alter table, 2 index, 0 trigger | `e6fbb3528dffc83e` |
| `0019_availability_samples.sql` | not in journal | 1 create table, 0 alter table, 0 index, 2 trigger | `93f9914cf9b01341` |
| `0020_device_work.sql` | not in journal | 2 create table, 0 alter table, 1 index, 0 trigger | `f12c07f8698406fa` |
| `0021_work_burden.sql` | not in journal | 2 create table, 4 alter table, 4 index, 0 trigger | `29901d522ebe932c` |
| `0022_registration_device_work.sql` | not in journal | 3 create table, 0 alter table, 0 index, 0 trigger | `cbfe4dc10988e175` |
| `0023_offline_opens.sql` | not in journal | 2 create table, 0 alter table, 1 index, 4 trigger | `d202d2b2ce30d50f` |
| `0024_registration_wire_receipts.sql` | not in journal | 1 create table, 0 alter table, 0 index, 2 trigger | `17a610fa08bf46f0` |
| `0025_clinical_source_documents.sql` | not in journal | 1 create table, 0 alter table, 0 index, 2 trigger | `979c344af8990187` |
| `0026_work_burden_sessions.sql` | not in journal | 1 create table, 1 alter table, 3 index, 0 trigger | `18449d9ba061f220` |
| `0027_indicator_figures.sql` | not in journal | 4 create table, 0 alter table, 1 index, 8 trigger | `272ed0cdabacc87f` |
| `0028_indicator_figure_disclosures.sql` | not in journal | 1 create table, 0 alter table, 0 index, 2 trigger | `bbd7962a8a836e7c` |
| `0029_object_media.sql` | not in journal | 1 create table, 1 alter table, 3 index, 2 trigger | `dc6d79a38a3fa6b0` |
| `0030_reporting_completeness.sql` | not in journal | 5 create table, 0 alter table, 0 index, 8 trigger | `b5bb2ac7f8a19e7a` |
| `0031_installed_pack_work.sql` | not in journal | 1 create table, 0 alter table, 1 index, 0 trigger | `17c9cefabde9885d` |
| `0032_installed_pack_transition.sql` | not in journal | 1 create table, 0 alter table, 1 index, 0 trigger | `5a0a8999355222ff` |

## How migrations are applied

- Local tests: every file in order to a disposable `.wrangler/test-state` ([Development and CI](../current/DEVELOPMENT-AND-CI.md)).
- Cloudflare staging (frozen since 2026-10-08): `wrangler d1 migrations apply DB --remote` in the deploy workflow; D1 keeps its own ledger ([Hosted staging](../current/HOSTED-STAGING.md)).
- DigitalOcean droplet: `deploy/update.sh` applies each new `drizzle/*.sql` once and records it in `/var/lib/saha-health/applied-migrations.txt` ([deploy/README.md](../../deploy/README.md)).
- Rollback: none. A source revert is not a database rollback; use a compatible forward migration ([runbooks](../current/09_Operational-Runbooks_v1.1.md)).
