# BRD implementation record

The business baseline remains the original **Health AI Orchestration Platform BRD v1.1**, SHA-256 `8dcc0a392fe46e342d8524a722328e2e8889143d532db9769d09683caf30a1c8`. This edition changes the implementation handover, not the approved meaning or priority of any business requirement.

All 176 exact requirement IDs, titles, priorities, original BRD phases, requirement clauses and acceptance criteria are retained in [brd-v1.1.json](../../requirements/brd-v1.1.json). [Traceability](../../REQUIREMENTS-TRACEABILITY.md) combines them with the assessed R11 state, evidence context and remaining work. Its JSON/CSV/Markdown are generated from the source, assessment TSV and evidence map by `node scripts/audit-requirements.mjs`.

| Implementation label | Count | Meaning |
| --- | ---: | --- |
| implemented-local | 14 | Local control exists; external/field acceptance still pending |
| partial | 150 | A foundation exists with functional or operational gaps (134 at R11) |
| not-built | 3 | No complete implementation of the specified capability (19 at R11; slice 1 moved BR-ID-07 and BR-SEC-04, slice 6a BR-SEC-11, slice 6b BR-SEC-10, slice 6c BR-SEC-09, slice 6d BR-AG-11, slice 2a BR-DATA-12, slice 1d BR-ID-10, slice 7a BR-INT-13, BR-INT-14 and BR-INT-15, slice 7b BR-INT-18 and BR-INT-19, slice 2b BR-DATA-08, slice 3a BR-OFF-04 and slice 7c BR-INT-17 to partial, the ABDM ones against a mock gateway only) |
| unverified | 9 | Required measurable outcome has not been established |
| Formal accepted | 0 | No formal BRD acceptance decision recorded |

The BRD's R1/R2/R3 phases are business scope phases. Saha's R1–R16 sequence is an engineering delivery plan. A matching number does not make them equivalent. Never replace an original phase with an engineering target or call a release accepted because its tests pass.

Core unresolved scope includes household/proxy authority, sensitive-data segmentation, approved clinical/programme semantics, two live programme systems, EHR/ABDM onboarding, real messaging, device/media/language durability, rights/retention, representative scale and formal pilot outcomes. Use the exact per-row remaining work to plan changes; this overview does not narrow any requirement.

An acceptance decision requires the exact build/configuration, approved scenario and population, evidence including failures and exclusions, accountable reviewer and dated disposition. Technical contributors may record implemented behavior and tests; they must not invent sponsor, clinical, privacy or partner acceptance. See [release acceptance](10_Pilot-and-Release-Acceptance_v1.1.md).
