# Contextual range server binding: independent review

Reviewed feature `141addf857707bf54f963a7ed61b5906656b54b8` on metadata integration base `2a05652f` in an isolated checkout. The local feature cherry-pick is `19887ae0`; it is a review baseline, not an additional integration patch. No new actionable defect was found in the reviewed import, assistant application or confirmation bindings.

## What was checked

New captures are derived on the server from the stored publication manifest and current patient context. Command schemas do not accept caller-supplied range captures or thresholds. New visits receive a unique visit-bound capture; legacy visits retain their previous engineering defaults until explicit adoption. Saving and confirming population captures refuse a changed current patient context. The refresh command requires a current care role, scoped current draft, visit version and patient version; replay checks current scope again. Refresh retains the previous capture and override history, clears current reasons, and assigns a new capture identity. The child-to-adult-to-child contract verifies that earlier severe-value confirmations cannot satisfy the refreshed capture.

Assistant application validates the proposed facts against the visit's pinned selection and refuses stale context. The server environment gate also covers assistant application and unusual-value confirmation, so illustrative population captures cannot be applied in production through those routes. Unusual-value review remains clinician-scoped, binds the current override, rejects the original recorder, and records history without changing the facts.

Import planning resolves the current scoped patient and captures that current context. The accepted plan includes the exact capture; recomputation and plan-hash comparison reject changes in publication or context before apply. Imported visits retain that capture and existing immutable import rules. Superseding or retiring a publication preserves historical visit captures. Field packet signing carries the pinned capture; the actual browser test exercised that handoff as supporting integration evidence, while the independent offline and governance reviews remain separate.

## Independently repeated checks

- Real cached Chromium, built local Worker and actual Miniflare D1: 24 checks passed.
- Range contract: 25; legacy import: 54; fact review: 37; overrides: 53; assistant overrides: 4. All passed.
- TypeScript validation and framework build passed.

Results are preserved under `tests/evidence/range-server-independent-review/`. Browser checks include stale save and confirmation refusal, explicit refresh, assistant refusal, imported capture lineage, changed-publication dry-run refusal, immutable supersession, and real encrypted field sync. The severe confirmation reuse case is contract coverage, not a separately executed HTTP confirmation lineage test.

## Limits

Clinical approval remains pending. Population activation is limited to synthetic or training environments. Imports bind context at import, not historical pregnancy or historical age. Legacy captures retain default behaviour. Refresh remains an organisation-load persistence command and is not certified for partitioned writes. This review makes no hosted acceptance, clinical safety, performance or full-product completion claim. It does not cover the separate CSV quantity followup `b08c10d`, the reviewer's own availability batch, or unrelated integration changes.
