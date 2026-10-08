# Restore-test log

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: every restore test or real restore, successful or not. Append a row; never edit or delete earlier rows.

**No restore test has been performed on a real host.** The only restore evidence is the automated local drill on a disposable synthetic database (`tests/recovery-drill.mjs`, result file `tests/recovery-result.json`), which is not an entry in this log because it does not exercise a deployed environment, real backup storage or an operator on call.

| Date (UTC) | Host / environment | Backup used (id, age) | Operator | Time to restore (RTO observed) | Data loss (RPO observed) | Checks run (digests, integrity, receipts, access) | Result | Notes / follow-ups |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

_Zero entries as of 2026-10-08._

## Procedure to follow when adding an entry

1. Follow [Backup and DR](BACKUP-AND-DR.md) and [OPERATIONS.md](../../OPERATIONS.md): restore into a fresh isolated destination, never over live state.
2. Record the checks from `scripts/recovery.mjs restore` (SHA-256, integrity, foreign keys, table digests, schema hash) and a read of receipts and memberships after restore.
3. Record failures too, and open a follow-up PR for each fix.
