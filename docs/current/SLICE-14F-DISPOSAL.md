# Development slice 14f — disposal execution

4 October 2026 (IST). Round 14, the privacy and safety batch. Requirement slice R30 in [remaining-slices.tsv](remaining-work/remaining-slices.tsv): tombstones, restore-safe disposal, server media retention, retention-based deletion and export coverage (BR-SEC-09, BR-SEC-10, BR-DATA-08). Slice 6c gave schedules, holds and eligibility counts but deleted nothing. This slice adds the smallest version of disposal that two owners can run and a reviewer can check. Synthetic data only; formal acceptance unchanged.

## What changed

- **Rules that allow disposal.** A retention rule can now say `dispose: true`, but only for two classes:
  - patient records (counted from the patient's last registration or visit);
  - visit media, a new class counted from the upload of each photo or voice note.

  Every other class stays review only and is never deleted. A class whose rule does not allow disposal is kept: this is how a rule says records must be kept. The periods are owner-set engineering placeholders for synthetic testing, not an approved records schedule. The review, the schedule's audit event and every register entry say so.
- **A plan by one owner (`disposalPrepare`).** The plan is a dry run over the whole organisation. It lists, by identifier only, every record the schedule makes eligible: patient, visits, plans, AI results, submissions, referrals, media, and one item for the patient's revision history. It also gives counts, what was kept and why, and a plan hash. It changes nothing except the plan record. A plan holds at most 200 records, never splits a patient, and expires after 72 hours. Only one plan can wait at a time. These are never planned:
  - anything while an organisation hold is in place, or a patient under a current hold;
  - a patient outside the preparing owner's normal care scope (an administrator-role owner has none);
  - a patient linked to work that is open or unresolved: an unresolved programme send, open referral or follow-up, active field package, emergency access, processing restriction, merge link, EHR or ABDM exchange history, or linked programme receipts or field packages not yet past their own schedule;
  - a patient whose identifier, or the identifier of any of its records, appears in any other record (another patient, households, caseload transfers, identity cases, rights requests, outreach, governance, operations, pilot or expansion). This keeps every remaining record from pointing at a disposed one, and errs towards keeping.
- **Applied by a second owner (`disposalApply`, with the plan hash).** These are refused:
  - the preparing owner (403);
  - a non-owner (403);
  - a wrong hash (409);
  - an applying owner without normal care scope over every planned patient (403);
  - a plan that is stale (409). The plan is computed again at its preparation time, over the records as they are now and in the preparer's scope, and must be identical. A hold placed since, new activity, a scope change or a new link all make it stale; nothing is disposed.

  Disposal is refused outside the synthetic and training environments. The commit is one D1 batch under the organisation-wide guard (`persist` gained a hook for guarded statements). It holds the plan record, an audit event and a receipt, one register row per record, and then each row's effect (`lib/saha/disposal-effects.ts`):
  - the patient, visit, plan, AI-result, submission and referral rows are deleted; the register entry is their tombstone;
  - media content is erased and the media row kept as a tombstone (type, size, SHA-256, purpose, time); visit media is also marked removed on its visit, with the disposal noted;
  - every revision of the patient is kept, but its content is replaced by `{disposed, entry, batch, at}`, its change list emptied and its reason replaced.

  Audit events and command receipts are never touched: the audit chain verifies after a disposal. `disposalCancel` (any owner, with a reason) cancels a waiting plan.
- **The disposal register (migration 0021, table `disposals`).** It is append-only (triggers refuse update and delete) and hash-chained like the audit log. Each entry holds the record identifier, table and class, the patient and team, the time, the rule (schedule version, years, cutoff, placeholder flag), the authority (preparing and applying owners, plan hash) and the SHA-256 of the stored rows removed. It never holds content. The migration also replaces the revisions' update trigger: an update of a revision is still refused unless every column but the content is unchanged, the change list is emptied, the new content is a disposal tombstone, and the register holds that patient's entry it names. Deletion of revisions is still refused.
- **Restore-safe.** Owners download the complete register as JSON (`GET /api/retention/disposal-register`); each download is audited. The register is not limited to the owner's care scope: a partial register would let a restore bring records back. It carries identifiers, times, rules, member identifiers and hashes, never content. `scripts/recovery.mjs restore` now requires either `--disposal-register FILE` (once per organisation) or an explicit `--without-disposal-register`. With a register, each file is checked (format, one organisation, chain from 0). Entries the backup already holds must be identical. The remaining entries are inserted, with the same effects, before anything is written. The database is then rebuilt with deleted content zeroed (`secure_delete`, `VACUUM`), so a backup taken before a disposal restores without the disposed content, even in free pages. A backup older than migration 0021 is refused with the steps to follow.
- **Data exit.** The export adds `tables/disposals.jsonl` and a `disposal` section in the manifest. For patients disposed from the exporter's care scope (by the team recorded in the register):
  - revision tombstones, media tombstones, receipts and register entries are exported;
  - audit events are content digests only, so the chain still verifies;
  - register entries outside the scope are digests too.

  `scripts/verify-export.mjs` resolves references to disposed patients and visits through the register. Its new `disposal-register` check recomputes the register chain and fails if a disposed patient or visit is still in its table, a disposed media file is present, or a revision of a disposed patient still holds content.
- **Elsewhere.** Media playback of disposed media answers 410 "disposed under the retention schedule". The retention review lists plans: the waiting plan's identifiers are shown only for records in the viewer's own scope, the rest counted. A released hold on a disposed patient is shown as "Disposed record". The Organisation page's "Retention and holds" panel gains a disposal column per class, the plan list (prepare, apply by a second owner, cancel) and the register download.

## Tests

- `tests/disposal-contract.mjs` (new, 39 checks). It runs the real store, migrations and `persist` over SQLite through the D1 shim, and covers:
  - rule limits; owner-only commands; environment refusal; an administrator-role owner planning nothing;
  - the plan: exact items, exclusions by hold, scope and link, no names, deterministic hash, organisation hold, the 200-record cap;
  - prepare; a second waiting plan refused; the review's per-scope identifiers;
  - apply refused to the preparer, a wrong hash, an approver without scope, outside synthetic, and a stale plan after a hold;
  - the applied state: rows gone, media and revision tombstones, audit chain intact, one event and one receipt added, the register chain, its tamper detection, and the append-only triggers;
  - grouped against entry-by-entry effects;
  - restore with and without the register; the command-line rule; tampered, foreign and conflicting registers; a register already applied; a backup older than 0021;
  - a cancelled or expired plan; a second disposal continuing the chain;
  - export and verifier, including digests outside scope, forged entries and leftover content.
- `tests/disposal-smoke.mjs` (new, HTTP/D1, its own organisation):
  - roles and stranger refused; the dry run;
  - a backup of the local D1 file taken before the disposal;
  - apply refused to the preparer, other roles, a wrong hash and a stale plan; replay with the same key, and the same key with other input refused;
  - after the apply: tombstones, the audit chain intact, the workspace, media 410, history 404, the review;
  - register download (owners only, audited); data exit verified offline;
  - the earlier backup restored with the downloaded register (nothing disposed comes back) and without it (the patient would).
- Existing tests whose counts this slice legitimately changes:
  - `tests/retention-smoke.mjs`: 7 record classes, not 6;
  - `tests/data-exit-contract.mjs`: 33 exported tables, and the verifier's new `disposal-register` check in its list.

  `tests/data-exit-contract.mjs`, `tests/household-visit-contract.mjs` and `tests/review-fixes-contract.mjs` transpile `disposal-effects`, which the data exit now imports.

Totals are in [VALIDATION.md](../../VALIDATION.md); reports in `tests/evidence/slice-14f/`.

## Limits

- **Only two classes are disposed.** Programme receipts, audit events, outreach messages, closed rights requests and field packages are reviewed only. Programme receipts and field packages of a disposed patient go with it only once past their own schedule. A deletion request (BR-SEC-10) does not trigger or speed up disposal, and a patient referenced by a rights request is kept.
- **Audit events about a disposed patient stay as they are.** They are append-only and chained, so free-text details naming the patient remain in storage. They are no longer shown in the activity log (it joins on the patient) and are exported as digests only. Disposing audit content needs a chain-redaction design.
- **The reference check keeps more than necessary.** For example, a patient ever moved by a caseload transfer, or ever linked to an outreach message, is never disposed.
- **Disposed indicator counts.** Released indicator figures and the differencing ledger are not recomputed; disposal can change later counts.
- **Physical deletion on D1 is not established.** Saha cannot set `secure_delete` on D1. Whether deleted rows stay recoverable in D1's storage, its Time Travel history or Cloudflare backups is not established. Backups themselves still hold disposed content until they are destroyed; no backup retention period is built. Hosted D1 restore (Time Travel) does not re-apply the register automatically; only the local restore tool does.
- **No automatic disposal.** No scheduled job prepares or applies plans. Plans are capped at 200 records per batch; D1's per-invocation query limits on the hosted plan were not measured.
- **The register download is complete for any owner.** Record and patient identifiers outside that owner's care scope are visible (no names or content). This is a deliberate choice for restore safety and needs a reviewer's view.
- **Placeholder periods.** No approved records schedule, jurisdiction or legal review exists. Execution is refused outside synthetic and training environments for that reason.
- **Tests.** The browser panel was type-checked and built, but no UI test drives it. Built by one agent; no independent review.
