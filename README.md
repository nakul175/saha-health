# Current release: 4 / v0.5

Programme integration engineering build: mapping, durable outbox, reviewed delivery, receipts, safe retries and linked corrections. **Live acceptance with two actual programme systems remains blocked by partner access.** See [Release 4](RELEASE-4.md) and [MIS contract and setup](MIS-API.md).

# Release 3 baseline

Bounded record assistant delivered; live model activation pending credentials. See [Release 3](RELEASE-3.md) and [provider contract](AGENT-API.md).

# Release 2 baseline

Programme engine delivered; see [Release 2](RELEASE-2.md). Earlier release documentation below is retained for architecture and operations context.

# Saha — Release 1 / v0.2

A working foundation for the Health AI Orchestration product. Release 1 adds collaborative identity, organisation and team access, assignments, structured storage, record revisions and correction workflows to the v0.1 sandbox. It is a synthetic-data release, not a clinical launch or completion of the full BRD.

## Release 1 scope

| Capability | Implemented behaviour |
| --- | --- |
| Individual accounts | ChatGPT sign-in provides a stable Site-specific account ID. Display names never grant authority or bind approvals. |
| Organisations | Separate records, membership and configuration; create, rename and switch organisations. |
| Teams and permissions | Server-owned membership; care teams, role changes, owner delegation, suspension and last-active-owner protection. |
| Invitations | 256-bit, single-use, 72-hour codes bound to the recipient's account code; hashed invitation lookup, revocation and expired/used-code rejection. Codes are created in the app; no email is sent. |
| Patient assignments | One accountable worker plus a care team; versioned reassignment with a reason. |
| Structured records | Seventeen new D1 tables plus the retained v0.1 table; independent entities for accounts, organisations, membership, teams, patients, visits, plans, AI outputs, submissions, referrals, revisions, audit and command receipts. Clinical facts remain versioned visit documents within this relational model. |
| Concurrency | Atomic D1 batches with an organisation revision guard; stale entity versions are rejected. A draft comparison screen lets the user review and merge their edited fields with newer saved facts before explicitly saving again. |
| History | Append-only patient/visit revisions and audit events, with stable actor ID, display name, reason and change details. Database triggers reject updates/deletes. History and activity paginate through retained records. |
| Identity correction | Correct name, age, sex or locality with a reason and expected revision. Original values remain in history; pending approvals are invalidated. |
| Visit correction | Create a linked correction draft; original confirmed facts, AI outputs and receipts remain. New actions on the superseded visit are blocked. |
| Wrong-patient handling | Mark a visit as recorded against the wrong person, retain the evidence and block further use. No automatic merge, reassociation or recall of earlier submissions. |
| Legacy migration | Atomic first-open backfill, source hash, count ledger, immutable baseline revisions and preserved v0.1 source. Failure rolls back the new organisation state; retry can safely resume. |

## Access policy

| Membership | Patient visibility | Allowed actions |
| --- | --- | --- |
| ASHA worker | Directly assigned patients in the worker's teams | Capture, confirm, consent, reviewed assistance, corrections and referral tracking |
| Clinician | Patients in the clinician's teams | Same care actions across that team scope |
| Supervisor | Patients in the supervisor's teams | Work oversight, assignment management and receipt reconciliation; no clinical fact writes |
| Administrator | No patient records, visit facts, clinical history or clinical exports | Connection configuration and membership metadata |
| Organisation owner | Patient scope still follows the owner's clinical role and teams | Membership, owner delegation, team and organisation management, connections; assignment only when patient access is permitted |

The original owner receives an explicit owner + clinician membership in the migrated care team. The old sandbox persona selection does not become a staff entitlement. `setRole` is no longer accepted. Membership suspension, team changes and reassignment apply on subsequent server requests, including receipt replay and exports. An in-flight write based on earlier authority loses the organisation compare-and-swap if an intervening permission change commits.

Site sharing and app membership are separate requirements. This release preserves the existing owner-private Site audience. Before staff can join, the Site owner must grant those people Site access, then invite their displayed account codes from **Organisation & team**. The app does not broaden Site sharing or send invitations externally.

## Continuing v0.1 workflows

Shared observations, saved drafts, immutable confirmation, human-approved programme plans, two simulated MIS destinations, independent receipts, safe uncertain-receipt lookup, two deterministic assistance tools, optional AI permission, result review, manual referral tracking and synthetic FHIR R4 examples continue to run.

A plan binds the visit facts version, patient version, permission version, destination versions, recipients and payload hash. Approval is tied to a stable account ID and expires after 15 minutes. A demographic correction, assignment change or permission change invalidates earlier pending plans. Already completed receipts remain evidence of the original action.

The generic HTTP assistance adapter remains disabled without approved server configuration. It accepts a registered HTTPS origin, a server secret binding, explicit approval, an allowlist, no redirects, bounded response size and timeout. No live provider was connected or tested in this release. Live MIS and EHR writes remain gated. The FHIR example does not demonstrate ABDM conformance or certification.

## Storage and migration

`drizzle/0000_handy_blockbuster.sql` and its metadata are unchanged. `0001_tearful_victor_mancha.sql` adds schema, indexes and append-only triggers; it contains no backfill dataset. On first authenticated access, the application copies the legacy aggregate in one guarded D1 batch. The ledger records the source revision, SHA-256 digest and source entity counts. Unexecuted legacy approvals are marked blocked because they were approved under sandbox personas. Older AI outputs, receipts, audit events and idempotency receipts are retained.

The legacy `workspaces` row is a preserved reference, not the active data store after migration. Do not roll back to the v0.1 application and resume writes: doing so would fork history. Roll forward with a compatible fix, or enter maintenance and reconcile from an independently verified backup. A migration test is not a production backup/restore drill.

Entity writes, new revisions, audit and command receipt commit together. Every statement after the organisation CAS checks its unique transaction token. Losing the guard performs no dependent writes. Duplicate concurrent commands return the committed receipt after rechecking current access. Tokens and commands are scoped to the actor and organisation; other users cannot replay someone else's receipt. A copied invitation code cannot be accepted by a different account.

## Run and verify

Preserve the pnpm lockfile and Sites execution profile. Strict checking: `node node_modules/typescript/bin/tsc --noEmit`. Generate future schema deltas with the existing Drizzle configuration and inspect them before publication. Applied migrations and snapshots are immutable.

Build using the Sites build helper. Apply each migration in order to `.wrangler/test-state` using the built Worker configuration, then run `node tests/run-api-smoke.mjs`. The runner starts the real built Worker, uses isolated local D1, constructs synthetic legacy fixtures, exercises separate authenticated identities through HTTP and writes `tests/latest-result.json`. The identity test headers only model the trusted Sites dispatcher in this local test process.

`VALIDATION.md` records evidence and limits. `RELEASE-1.md` maps the release scope to implementation and checks.

## Remaining releases and limitations

Programme-specific schemas/validation, live model orchestration, live MIS connectors, EHR adapters, ABDM ABHA/HIP/HIU consent exchange, offline durability, speech/languages, production monitoring, production backup and restoration, independent security review, load testing and a controlled clinical pilot remain later releases. No certification, clinical validation or BRD pilot gate is claimed.

The current service reconstructs an organisation's entity state for commands and serializes changes with one organisation revision. This is appropriate for the small synthetic workspace tested here; high-volume scale has not been established. Large-scale query/payload partitioning, per-record scheduling, audit retention/export policies and production disaster recovery require further work. Owner creation is limited to 10 organisations per account and 30 teams per organisation. End-user actions cannot rewrite audit rows, but privileged database operators still control the database; this is not externally notarised or independently tamper-evident storage.

Browser memory holds unsaved form input only. Offline edits do not survive tab closure. No ABHA identifiers, duplicate-patient merge or cross-patient record transfer are implemented. An identity correction does not automatically correct copies already shared to downstream systems. Wrong-patient evidence remains in restricted history for authorised users.
