# SAHA-130 physical disposal decision record

Parent: `9b2ccf34f1929c5b677b3b901b01f43ca7408c21`
Contract: APL-153, SHA-256 `db1b6f31cd18ab5754eb5f4b921ea28e31437c9c1a6aa307d04af857812c636e`

## Authorized design derived from the frozen contract

The organisation owner's current versioned schedule supplies record class, purpose, location, jurisdiction and duration. A recorded organisation or patient hold overrides routine disposal. No duration, jurisdiction, provider or clinical exception is supplied by application code.

For programme receipts, outreach messages, closed rights requests, transcripts and raw audio, the repository has an exact operational payload boundary. Disposal therefore writes the append-only tombstone/audit evidence and deletes or scrubs the D1 operational payload in one organisation-revision-guarded batch. The outreach statement removes the exact canonical person-bound message object, so its body and embedded attempt receipts are absent from the persisted outreach JSON while unrelated messages remain. Transcript/audio metadata in immutable visit revisions is retained as historical custody evidence; the media content is held only in the media row or exact private object.

For private objects, the D1 batch first writes a durable job containing the exact immutable object key, version and ETag, then scrubs the operational media reference. Reconciliation is owner-only and same-origin. Before the external boundary it atomically changes the job from pending to reserved and appends an immutable reservation event, reloads current owner/policy/hold authority, and performs a second exact version/ETag check. Application object writes use random immutable keys and conditional create-only puts; a replacement observed before deletion is blocked rather than deleted. Completion, replacement, authority-change and unconfirmed outcomes are persisted in the job and an immutable outcome event without requiring authority to remain current after the irreversible boundary. This prevents a post-delete authority race from erasing evidence. A retry after delete-before-outcome-write observes absence and converges without a second delete.

The current private provider API has no conditional-delete primitive. Linearization therefore relies on the repository's enforced immutable-key/no-overwrite writer boundary plus the final exact pre-delete check. Mutation outside that supported writer boundary is not claimed safe; any observed version/ETag change fails closed.

## Explicitly unsupported choices

Patient records, model outputs embedded in immutable clinical revisions, field packages/local caches, audit events, exports and backups have no complete class-specific physical-disposal authority in APL-153 or the current provider boundaries. They remain inventory/review-only. Supporting them requires an approved choice among permanent preservation, content-redacted immutable evidence, or physical/cryptographic deletion, and an authoritative export/backup provider interface. The implementation does not infer that choice.

## Gate statement

This successor resolves the narrow D1/private-object mechanism blocker for classes with an exact boundary. It does not make SAHA-130 a full-story PASS. Independent source review, exact-source CI, formal privacy/security acceptance, merge and deployment remain separate gates.
