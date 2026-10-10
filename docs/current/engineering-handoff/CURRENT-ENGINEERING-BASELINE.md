# Current engineering baseline for the 11 October coding handoff

Prepared 10 October 2026 from inspected main `7668a03d97c1ae62174f09e65ccd5a5717120be6`, the
isolated D02 merge checkpoint. This is a source-backed engineering map, not a newly tested release or live-host
inspection. Read [HANDOVER](../../../HANDOVER.md), [AGENTS](../../../AGENTS.md) and
[the engineering guide](../ENGINEERING-GUIDE.md) before execution. Current product planning and its frozen
criteria remain separate from this architecture map.

## Select the correct source before coding

| Scope | Source identity / action |
| --- | --- |
| Current main in this checkout | `7668a03d97c1ae62174f09e65ccd5a5717120be6`. It contains the isolated assigned-Today D02 path; no `/api/routine-visit` route is present in this base. Re-inspect fresh main before execution. |
| Existing D03 candidate | Preserved `story/d03-routine-visit-20261010` in the existing author checkout, based on this main. At inspection its new routine route, presentation, domain wrapper, tests and evidence remain uncommitted/staged. Do not copy them into this documentation branch, dispatch a second implementation or treat the base SHA as the candidate's final source identity. |
| D03 frozen contract | Existing author file `docs/current/d03/SPECIFICATION.md`, revision 1, 5,347 bytes, SHA-256 `f390d7c13d7794556115b04caed8982179d1fcfd18a81dda59d70f6f573758df`. A1–A10 and the original local-save p95 ≤500 ms remain unchanged. Preserve source authority when obtaining the frozen file. |
| Product and execution ownership | Product planning is mapped in Linear; [GitHub #188](https://github.com/nakul175/saha-health/issues/188) retains current execution ownership. Current controller/source receipts, candidate qualification and native protections decide advancement. This document does not restart disabled schedules or change native issue state. |
| Historical targets | `docs/history/v1.0/`, `docs/reference/` and the older R11 edition bodies remain reference/provenance. They do not install PostgreSQL, serve the 74-operation target REST catalogue or qualify native Android custody. |

Recommended next package: establish the bounded D01 baseline decision needed by D03, then finish qualification of
the preserved candidate. Keep inherited #185/#186 failures and their scope decisions visible. D04 waits for all
ten declared D03 gates; planning a future test packet does not dispatch its implementation.

## Current system and source map

The source stack is React/Vinext on Workers APIs, with D1-compatible SQLite and Drizzle declarations. The existing
package scripts use Node ≥22.13; the full test/recovery workflow needs Node 24 for `node:sqlite`. The repository
package manager is pnpm 11.25.0. Do not install/change dependencies or accept a license merely to refine docs.

| Engineering question | Inspect these files | Contract / next-slice consequence |
| --- | --- | --- |
| Who is the caller? | [identity.ts](../../../lib/saha/identity.ts), [server.ts](../../../lib/saha/server.ts) | Configured trusted provider establishes principal; current application authority is checked separately. Never add public role/author headers. |
| Who may see or change this person? | [access.ts](../../../lib/saha/access.ts), [store.ts](../../../lib/saha/store.ts), [today-server.ts](../../../lib/saha/today-server.ts) | Membership, assignment, purpose and current domain checks remain authoritative. Owner status does not waive person scope. |
| What does D02 actually expose? | [Today UI](../../../app/today/today.tsx), [GET route](../../../app/api/today/route.ts), [projection](../../../lib/saha/today.ts), [server](../../../lib/saha/today-server.ts) | Separate synthetic/training active-ASHA read-only path; assigned unmerged people, minimal identity context, durable read audits. Preserve its regression behavior. |
| How are writes validated and replayed? | [commands route](../../../app/api/commands/route.ts), [server.ts](../../../lib/saha/server.ts), [core.ts](../../../lib/saha/core.ts) | Typed command, bounded body, same-origin checks, exact operation key/hash, current-authority receipt recovery; no blind retry with a new key. |
| What defines visit data and pack semantics? | [types.ts](../../../lib/saha/types.ts), [programmes.ts](../../../lib/saha/programmes.ts), [fact provenance](../../../lib/saha/fact-provenance.ts) | Exact person/visit, versioned programme evidence and source/time/unit/author handling; client simplification cannot invent clinical rules or merge unlike questions. |
| What makes a mutation atomic? | [store.ts](../../../lib/saha/store.ts), [partition.ts](../../../lib/saha/partition.ts), [schema](../../../db/schema.ts) | Guarded patient/organisation write sets, revisions, audit-chain handling and receipts. Additive presentation should retain these contracts. |
| What may the response contain? | [server.ts](../../../lib/saha/server.ts), [delta.ts](../../../lib/saha/delta.ts) | Full scoped snapshot or certified delta/partition; replay uses current scoped read. Refused access must not leave protected content visible. |
| What persists offline? | [field.ts](../../../lib/saha/field.ts), [vault.js](../../../public/field/vault.js), [sync-receipt.js](../../../public/field/sync-receipt.js), [field client](../../../public/field/app.js) | Prepared signed grant and encrypted client storage, exact sync/reconciliation; server save alone is not disconnected restart retention. Inspect actual storage limits and errors before D04/D05 freeze. |
| What is the current schema/API surface? | [generated inventory](../../verification/generated-inventory.json), [data dictionary](../CURRENT-DATA-DICTIONARY.md), [API inventory](../CURRENT-API-INVENTORY.md), [SQL migrations](../../../drizzle/) | Generated declaration inventory at this source: 60 application tables, 475 SQL columns, 33 migration files, 97 HTTP method/route pairs and 253 command discriminators. These are source counts, not accepted capabilities or a host-schema inspection. |
| What schedules work? | [worker entry](../../../worker/index.ts), [scheduled job](../../../lib/saha/scheduled-job.ts) | Existing bounded scheduled handler and domain checks; no new autonomous delivery loop follows from its presence. |
| What builds and qualifies a slice? | [package scripts](../../../package.json), [development/CI](../DEVELOPMENT-AND-CI.md), [test catalogue](../../../scripts/test-catalogue.mjs), [test guard](../../../scripts/test-guard.mjs) | Select applicable tests on exact candidate; retain original minima, failures and actual results. Documentation checks are distinct from application qualification. |

The dated supplements in [HLD](../02_High-Level-Design_v1.1.md), [LLD](../03_Low-Level-Design_v1.1.md) and
[data model](../05_Data-Model-Specification_v1.1.md) supersede stale R11 statements for this source checkpoint.
They preserve the original edition text and source-design boundary.

## Documented hosting versus observed delivery

[deploy/README.md](../../../deploy/README.md) and [HOSTED-STAGING](../HOSTED-STAGING.md) record synthetic DigitalOcean
hosting at `https://health.aplyd.org`, Caddy basic-auth/trusted identity headers, persisted local D1 state, and the
frozen Cloudflare copy. [Droplet configuration](../../../deploy/make-droplet-config.mjs) selects `synthetic`,
`sites-chatgpt`, external APIs disabled and empty MIS/EHR connections. Cloudflare's configured Access provider is
a different deployment path; do not apply it implicitly to the droplet.

[The existing updater](../../../deploy/update.sh) documents following `main`, building, applying unrecorded SQL
migrations once, and restarting. `SAHA_DEPLOY_FREEZE` freezes Cloudflare deployment; it is not proof that the
DigitalOcean updater is stopped. A branch/docs push does not establish merge or a running release. Do not run
provisioning, update, role changes, data writes or recovery solely because an operating recipe is included here.

The release witness must separately bind tested/published candidate, qualified merge, observed running commit,
configuration/schema identity, and the authorised live synthetic journey. A successful health response does not
prove the actor, record, save/readback, refusal or recovery behavior. No new live observation or recovery drill was
performed in this documentation pass. Recovery must preserve applied migrations, append-only evidence and queues;
reverting code is not permission to reverse data history.

## Next-candidate review packet

| Decision | Minimum handoff evidence |
| --- | --- |
| Bounded baseline prerequisite | Exact fresh main and candidate, actual #185/#186 evidence, inherited-versus-candidate impact and recorded decision; do not close D01 or delete its dependency from a planning assumption. |
| D03 source freeze | Preserve original specification; identify final candidate commit, source/config/fixture hashes and a diff confined to the declared scope. Local uncommitted author results are not exact published-head qualification. |
| Data and UI outcome | A1–A8 evidence for distinct/shared programme facts, correct source/time/unit/person, audit/authority refusal, honest save/readback, replay, retained input/conflict and usable manual phone flow without models/providers. |
| A9 qualification | Actual applicable build/types, affected existing checks, native backend/browser/NFR results, final-head required CI and separate final diff/evidence review. Local encrypted-component timing, connected-server timing and physical-device claims stay separate. |
| A10 delivery | Actual required merge authority/protections, observed hosted commit and separately authorised synthetic save/readback/refusal journey. Do not assume D02's prior role-test permission authorises D03 writes or role changes. |
| Future continuity | After D03's full gate, freeze D04/D05 fault scenarios around the actual encrypted grant, persistence, exact operation keys, uncertain acknowledgements, conflicts and changed authority. Unresolved DEC-03 blocks production offline-policy/recovery claims, not independent synthetic preparation. |

No criterion is marked passed here. Formal BRD acceptance and the original 364 UAT cases remain independent;
physical phone, frontline, clinical, partner and production acceptance are not supplied by planning. Recommendations
are default engineering choices for refinement, not a fabricated approval, participant, legal basis or measured result.

## Exact source pins inspected for this reconciliation

SHA-256 is over the local exact bytes at the main checkpoint stated above. These pins make the inspection
reproducible; they do not replace the repository's current-baseline integrity manifest or assert execution success.

| Source | SHA-256 |
| --- | --- |
| `lib/saha/identity.ts` | `3465582bd580ee3501795a7058ecf7bef6933f171af6b584b259df38243b058a` |
| `lib/saha/server.ts` | `8dcd9d28f2a1df33a9e428e77f20cfa84774797f0c82964d12b25632952f2f52` |
| `lib/saha/store.ts` | `a16ec292082b8f73eabb89a01c6e4558dda71620803a1d8aaa58db653b4ff630` |
| `db/schema.ts` | `494b1b09d2f77657b3599332485e4e1ad1d84fbb9ab444dfeefa1c418e63c2c5` |
| `deploy/make-droplet-config.mjs` | `8c8e24f2f16840d8ac987d39c5942d8914ede977b4c58e93144f962100406ccb` |
| `docs/verification/generated-inventory.json` | `aa23095f7138fcc1c7a62d2a4db13e2ec248c071277974fb11e7eb462bb20def` |

This revision performed source/document reads and preservation/link checks only. Final documentation-integrity and
requirement-generation checks belong to the integrated documentation batch; record their real results after the
last edit. No application test, current-head CI, deployment, provider call, hosted mutation or formal acceptance is
claimed by this engineering reconciliation.
