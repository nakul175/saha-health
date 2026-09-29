# Implementation boundary

R11 / v1.3-readiness is a private synthetic engineering application. It supports a bounded care-record workflow with human review and per-destination outcomes. It does not deliver the entire original design. All formal BRD acceptances are pending.

| Area | Current implementation | Remaining boundary |
| --- | --- | --- |
| Identity and access | Sites account identity; organisation membership, owner flag, four roles, team scope, direct ASHA assignments, account-bound invitations, suspension | Institutional identity lifecycle, independently qualified workforce identity and wider target role model |
| Patient continuity | Scoped matching; provisional registration; clinician resolution; positive patient check before confirmation; atomic transfer of open work and acknowledgement | Household/proxy authority, automatic merge, cross-person transfer and sensitive episode separation |
| Visit records | Shared typed facts, saved drafts, programme evidence, immutable confirmation, linked amendments, wrong-person quarantine and history | Full clinical terminology, longitudinal reuse semantics, media and complete programme coverage |
| Programmes | Version-pinned synthetic packs, conditional questions, episodes and follow-ups | Institution-approved packs, translated content, clinical semantics and real programme acceptance |
| Evidence assistant | Explicit prepare/approve/execute/review/apply; source quotations, input/version binding, rules-only extraction and optional governed provider path | Representative language/model accuracy, live providers and clinical decision support acceptance |
| Clinical governance | Immutable source/service/protocol/capability manifests; independent review; owner activation; context/date/dependency checks; safety cases and holds | Approved clinical content, verified directory, professional review and real intended-use evidence |
| Programme destinations | Versioned mappings, durable outbox/checkpoints, consent and credential gates, receipts, uncertain lookup and linked corrections | Two independent real systems, actual callback/receipt reconciliation and partner acceptance |
| EHR and ABDM | Explicit patient links, local scoped exchange permissions, synthetic FHIR import/export, bounded native adapter | Live EHR qualification, official profile validation, ABHA and HIP/HIU consent/exchange |
| Field continuity | Encrypted browser notebook, signed grants, explicit sync/conflicts, Hindi/English capture and gated on-device dictation | Physical-device disconnected durability, native Android keystore, media, speech/language acceptance |
| Referrals | Named responsibility, due date, ordered evidence events; R11 directory snapshot on draft | Facility delivery, independently verified service outcomes and full target state machine |
| Operations | Scoped reports, bounded request metrics, incident register, maintenance and encrypted local restore | Hosted backup/cutover, real alerts, retention/rights workflows, independent security and scale |
| Pilot and outreach | Synthetic training/rehearsal gates, cohort measurements, human-selected outreach, reminder simulation and expansion proposals | Actual messages, trained field cohort, clinical effectiveness, accepted pilot and expansion |

## Runtime and persistence

The React/Vinext UI calls thirteen HTTP route handlers. Mutations normally enter `POST /api/commands` through a composed Zod discriminated union. `lib/saha/server.ts` authenticates and dispatches; domain modules validate state and authority; `lib/saha/store.ts` commits through D1 batches under one of two guards: a per-patient guard for the 39 certified patient commands in `lib/saha/partition.ts`, or the organisation-wide guard for everything else (development slice 0a). Provider execution modules checkpoint before external calls and preserve uncertainty afterward.

There are 24 application schema tables and seven immutable SQL migrations, 0000–0006. The local restore report counts 25 SQLite tables because it includes D1 metadata. Several tables contain versioned JSON aggregates; the original PostgreSQL foundation schema and 26 proposed entities are a design reference. D1 has no implementation of the proposed PostgreSQL RLS model.

Since slice 0a, certified patient commands load only the named patient plus organisation-level state, and concurrent writes on different patients no longer conflict. Since slice 0b, those commands can answer with a partition delta that the workspace merges, so a write returns kilobytes rather than the whole organisation. The initial workspace read still returns every permitted patient, which a local probe measured at 77 MB and 3.5 s for 100,000 people; paged lists are planned. See [slice 0a](current/SLICE-0A-STORAGE.md) and [slice 0b](current/SLICE-0B-DELTAS.md). The local load probe is engineering evidence, not a production throughput or latency qualification.

## R11 evidence and authority

The saved 27 September qualification contains 902 HTTP/D1 assertions, 361 contract/checkpoint assertions and 21 local encrypted restore assertions, totaling 1,284. These tests use synthetic fixtures. The 18-case evaluation corpus contains 16 English examples and two Hindi examples; the English subset passes and Hindi eligibility fails. The corpus is tiny, fixed and known to the implementation. It cannot establish NFR-16 or clinical accuracy.

Governance activation binds the manifest, model/agent version, reviewers, owner, dates, intended-use context and dependencies. Current authority is checked again before use. A technical connection test alone grants no clinical authority. Local records of review do not establish that an actual professional or institution has approved use.

See [Qualification](QUALIFICATION.md), [API inventory](current/CURRENT-API-INVENTORY.md), [data dictionary](current/CURRENT-DATA-DICTIONARY.md) and [architecture](current/02_High-Level-Design_v1.1.md). Exact module contracts remain in the existing root documents linked from the current index.
