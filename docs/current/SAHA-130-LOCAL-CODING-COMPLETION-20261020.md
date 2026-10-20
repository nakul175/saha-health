# SAHA-130 controlled retention and disposal — local repair status

Date: 21 October 2026
Story: SAHA-130 / APL-153
Base: `9b2ccf34f1929c5b677b3b901b01f43ca7408c21`
Frozen contract SHA-256: `db1b6f31cd18ab5754eb5f4b921ea28e31437c9c1a6aa307d04af857812c636e`

## Implemented local boundary

The application now records versioned retention rules by record class, purpose, storage location and jurisdiction. The catalogue explicitly covers patient records, programme receipts, audit, outreach, rights requests, field packages, transcripts, raw audio, model outputs, local caches, exports and backups.

Owners can register bounded metadata-only artifacts and apply disposal through a separate command pinned to the current policy version. The server refuses non-owners, malformed/future inventory, duplicate identifiers, stale policies, not-yet-expired artifacts, mismatched purpose/location/jurisdiction and any active organisation or patient hold. For the classes with an exact chain-safe design, the same guarded D1 batch writes the tombstone and audit evidence and deletes or scrubs the operational row. Programme receipts, outreach messages, closed rights requests, transcripts and raw audio are supported. Command receipts, record revisions and historic audit custody remain immutable.

Every database state read applies validated retained tombstones before operational state is returned. Immutable audit events cannot be tombstoned or hidden. Controlled recovery requires a separately encrypted current authority, verifies the backup in quarantine, validates and reapplies current policy, holds, inventory and append-only tombstones, and only then creates the destination database. Patient records and dependent visits/submissions/referrals, programme receipts, model outputs, raw audio, outreach, closed rights work, field packages and local cache references are withheld when tombstoned. Data exit scopes tombstones and rechecks exact retention authority before release. The owner UI exposes complete schedule dimensions, metadata registration, eligible inventory and disposal controls.

Object-backed transcript/audio disposal creates a durable append-only-identity reconciliation job before the media reference is scrubbed. A separate owner-only, same-origin operation commits a durable reservation and immutable event before the external boundary, reloads current policy, holds and membership, and rechecks exact object version and ETag immediately before deletion. Replacement is blocked. Every terminal or retryable result is then stored with an immutable outcome event even if authority changes after deletion. A delete-before-record crash converges on retry through confirmed absence. The provider offers no conditional-delete primitive, so the supported claim is explicitly limited to the application's immutable random-key and conditional-create-only writer boundary. The owner UI lists pending/reserved/blocked jobs and offers explicit retry/verification. No real record, hosted bucket, provider, external send or clinical retention policy was created. Values are organisation-owner configuration.

## Verification

- `node tests/retention-contract.mjs`: **19/19 passed**. Covers owner/refusal paths, complete schedule dimensions, schedule validation, organisation and patient holds, duplicate/current-version/expiry checks, disposal tombstones, validated recovery authority and current policy/hold restoration.
- `node tests/retention-direct-read-contract.mjs`: **12/12 passed**. Covers invalid/duplicate/audit tombstone refusal and immutable activity/direct-media guards.
- `node tests/data-exit-retention-contract.mjs`: **28/28 passed**. Covers direct-table projection, scoped tombstones and exact-authority race checks.
- `node tests/retention-disposal-contract.mjs`: **31/31 passed**. Covers actual SQLite outreach body/embedded-receipt removal, guarded D1 disposal, durable reservation and immutable outcome events/triggers, exact custody binding, pre-boundary authority refusal, interleaved replacement rejection, post-delete authority-race evidence, crash/retry convergence, idempotent absence and changed-object refusal.
- `npm run typecheck`: passed.
- `npm run build`: passed; the existing bundle-size advisory remains informational.
- `node scripts/test.mjs --check-catalogue`: **HOLD** on the exact current parent because `tests/point-of-need-help-browser.mjs`, `tests/point-of-need-help-component.mjs`, and `tests/saha154-optional-assignment-uncertainty-browser.mjs` remain unclassified. This inherited catalogue failure is retained; no classification or criterion was weakened.
- `node scripts/audit-requirements.mjs --check`: **HOLD** on the exact current parent because the generated traceability counts from the current assessment (`implemented-local` 15, `partial` 150) differ from the staged traceability aggregate (`implemented-local` 19, `partial` 146). This successor does not rewrite unrelated requirement statuses.

## Separate gates

The local application-code boundary remains **HOLD** for record classes whose safe physical-disposal meaning is not specified by APL-153. Patient records and embedded model output can appear in immutable clinical revisions; field packages/local caches can be evidence for offline conflict resolution; audit events are append-only; export and backup deletion require storage-provider boundaries that are not present in this repository. These remain inventory/review-only and cannot be selected for disposal.

The smallest required policy/architecture decision is an approved class-by-class rule for whether those retained histories are (a) permanently preserved, (b) cryptographically or physically erased with retained non-content evidence, or (c) selectively redacted, plus the authoritative export/backup provider deletion interfaces. Until that decision exists, BR-SEC-09 remains `partial` and SAHA-130 remains **HOLD** for full-story completion. Independent review, exact-source CI, formal privacy/security approval, merge and observed deployment remain separate. This author record is not evidence for those gates.
