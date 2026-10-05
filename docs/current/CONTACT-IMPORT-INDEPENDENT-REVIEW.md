# B08 contact import — independent review

5 October 2026. Exact author revision `62825938f5757401ae2191356ff199b7fb6b2bf0`, reviewed in isolated `saha-contact-import-review`. No production source edits. No new grounded defect found in the bounded contacts/reversal implementation. This does not close the broader B08/BR-DATA-11 import backlog or external acceptance.

The source review covered strict input and CSV bounds, contact source snapshots, raw-file and reviewed-plan digests, current care/supervision/purpose authority, ordinary patient scope without owner widening, original apply/reversal receipt authorization, import/reversal audit transactions, preference comparison, merge/history preservation, UI recovery by saved batch ID and existing enrolment/identifier/visit compatibility.

`authorizeRecordImport` locates retained contact apply lineage by the original importer and reviewed plan, then checks every retained batch person. Reversal receipt access resolves the exact batch and repeats those current checks. Contact history remains retained after reversal/merge; merged patients are refused rather than widening access. There is no production record deletion in the reviewed retention machinery. These checks depend on intact server-held source/receipt history, not client identity or a client owner override.

Reversal compares the complete current preferences against the original source snapshot, including its original version/author/time, and never deletes that snapshot. A later care edit that restores the same visible fields still differs from the original fingerprint and requires individual review. A saved reversal receipt is a historical scoped read: it must not repeat removal of preferences that were recorded later. Contact-only reversal also preserves independently changed exchange-consent state; it does not restore old sharing permission.

The normal full-organisation persistence guard compares both organisation and patient revision counters. Contact preferences, source entries, patient revisions, audit chain and receipt therefore commit in the existing atomic transaction. This review did not add a per-patient partition certification or new communication authority.

## Actual verification

- Independent adverse Worker/D1 probe: **14 checks**, including purpose/membership withdrawal on saved apply, unknown reference/unsupported owner override, actual `setContactPreferences` permission change, visible-value reversion refusal, contact-only reversal preserving an unrelated exchange-consent withdrawal, later preferences surviving saved reversal receipt replay, patient-scope withdrawal and intact chained audit.
- Author Worker/D1 and 390px Chromium touch harness independently rerun unchanged: **15 checks**. This includes exact apply/reversal replay, all-batch scope withdrawal, audit-trigger and receipt-trigger rollback, confirmed visit rows byte-equivalent, no messages/contact permission from import, saved-batch phone recovery and data-exit source-history roundtrip.
- Pure contacts contract independently rerun: **18 checks**.
- Legacy record import **49** and historical visit import **54** checks pass.
- Fresh production build and TypeScript checks pass.

Reports and logs are in `tests/evidence/contact-import-independent-review`. Two initial independent probe fixture failures are retained: operations had not yet been persisted before the purpose-policy intervention, and a first preference command incorrectly included server-only version/author/time keys. The corrected probe uses an actual operations initialization and the strict client preference shape; all original adverse expectations remain.

Synthetic local processes only. No provider/network delivery, physical Android, native issuer/source verification, consent legal acceptance, hosted qualification or complete cross-source conflict/attachment/structured-note import acceptance. Source-system labels are documentary provenance, not externally verified source authority. Existing contact preferences are never replaced by import. Reversal refuses current edited or permission-bearing contacts and retains all source history. Formal/external acceptance remains pending.

The new `tests/contact-import-independent-review.mjs` is an independent integration Node harness requiring a local built Worker; root owns catalogue registration and combined regression. No shared assessment/catalogue/validation files were edited. Untracked generated legacy result files remain outside the review commit.
