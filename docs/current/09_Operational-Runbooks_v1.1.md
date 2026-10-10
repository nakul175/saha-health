# Current operating topology and candidate recovery 10 October 2026

Read [the engineering baseline](engineering-handoff/CURRENT-ENGINEERING-BASELINE.md) and [HOSTED-STAGING.md](HOSTED-STAGING.md) for the documented existing synthetic DigitalOcean host and frozen Cloudflare copy. Cloudflare's deployment freeze does not prove the separate DigitalOcean updater stopped. No fresh live health/schema/commit inspection or hosted recovery is performed here.

For the next D03 gate, preserve the exact attempt key, durable server receipt and unsaved-input/uncertain-outcome distinction; [the recovery plan](engineering-handoff/TEST-AND-RECOVERY-PLAN.md) defines proposed adverse checks. Local recovery tooling, code rollback and reconciliation have distinct boundaries. None permits reversing applied history, clearing a queue to obtain green, or dispatching a possibly completed external write again.

# Operational runbooks

Use these procedures for the current synthetic application. The full ten target runbooks are preserved in the [original document](../reference/09_Operational-Runbooks_v1.0.md). Steps requiring hosted backup, native device management, partner delivery or institutional decisions remain deployment work.

| Situation | Current action | Required closure evidence |
| --- | --- | --- |
| Uncertain MIS/EHR write | Preserve logical key and payload; use receipt lookup; retry only after proven nonacceptance and current authorization | Receipt tied to original action or a named unresolved case; no duplicate write |
| Wrong-person record | Stop dependent actions, use identity/visit correction workflow with reason, preserve history and identify already delivered copies | Correct attribution review and separate downstream disposition; no automatic recall claim |
| Authority withdrawal | Revoke/suspend through supported commands; cancel unsent work, retain in-flight outcomes and scope-check subsequent reads | Revoked access and documented unresolved external effects |
| Clinical concern or unsafe capability | Use established urgent care route; record restricted safety case, named owner and evidence; hold implicated capability | Qualified review, affected-case follow-up and documented correction/review decision |
| Field sync conflict | Preserve encrypted draft and fixed operation key; reconnect under current authority; compare server state and resolve explicitly | Durable server receipt or named unresolved recovery; never clear queue to force success |
| Service incident | Record safe case reference/severity and active operations owner; inspect diagnostics, then apply justified maintenance if needed | Findings, evidence reference and immutable resolution record |
| Restore drill | Use authorized local snapshot, separate key custody and fresh isolated destination; verify digests and restart built Worker | Actual integrity/scope/receipt checks; no new sends caused by reading restored state |
| Release regression | Pause affected actions, preserve records and use compatible roll-forward or reviewed recovery | Build/configuration, decision, integrity/reconciliation checks and remaining ownership |
| Deployment exit | Plan custody and open-work handover; use only available scoped exports | Target-only full export/retention/deletion workflow remains unimplemented |

## Maintenance

Only an owner can pause/resume an organisation with the current operations version and reason. New capture, confirmation, field sync, model execution and external sends are blocked. Permitted reads, withdrawals, revocations, cancellation and receipt lookup remain available. An already checkpointed request may finish; retain its actual receipt. Resume only after the owner reviews the incident state.

## Local encrypted recovery

The exact operator procedure and cryptographic boundaries are in [OPERATIONS.md](../../OPERATIONS.md). `scripts/recovery.mjs` uses a consistent SQLite snapshot, AES-256-GCM and a passphrase on stdin. It rejects an existing destination, wrong passphrase and changed ciphertext. Node must expose `node:sqlite` and its backup API; the saved drill used Node 24. Backup size is bounded to 64 MiB.

Never use a backup restore as an excuse to replay external writes. Determine what may have completed after the snapshot; reconcile independently before any new dispatch. The local tool cannot retrieve hosted D1, schedule retention, perform infrastructure cutover or recover device-only drafts.

## Support evidence

Record environment, application version, safe correlation/case reference, first occurrence, expected/actual behavior, owner, containment, next review and restricted evidence location. Avoid patient narratives, identifiers, secrets and raw provider responses in ordinary support tickets. Exporting diagnostics does not authorize sending it to another party. See [Support guide](SUPPORT-GUIDE.md).
