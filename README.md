# Saha health workspace

Saha is a private synthetic engineering implementation of the Health AI Orchestration Platform: one care-record workspace with reviewed assistance, programme/EHR integration foundations, field continuity and accountable follow-through.

**Current application: R11 / v1.3-readiness. Documentation: edition 1.1, reconciled 28 September 2026.** Ready for continued development; real-patient use and production acceptance remain pending.

## Start here

1. [Documentation index](docs/DOCUMENTATION-INDEX.md)
2. [Implemented behavior and limits](docs/IMPLEMENTATION.md)
3. [Next delivery and remaining releases](docs/NEXT-DELIVERY.md)
4. [Qualification evidence](docs/QUALIFICATION.md)
5. [Developer and Claude handover](CLAUDE.md) and [setup instructions](docs/current/DEVELOPMENT-AND-CI.md)

The current pack contains reconciled BRD/FSD/HLD/LLD, API/data/security/test/delivery/runbook/acceptance specifications, user/admin/support guides, source-derived inventories and exact requirement/test registers. Original Word/Excel/HTML documents and engineering archives are retained in [history](docs/history/README.md).

## Status

| Item | Current record |
| --- | --- |
| BRD requirements | 176; all formal acceptances pending |
| Implementation assessment | 14 implemented-local, 141 partial, 12 not-built, 9 unverified after slice 2a (R11: 134 partial, 19 not-built) |
| Saved R11 qualification | 902 HTTP/D1 + 361 contract/checkpoint + 21 restore assertions = 1,284 |
| Original acceptance catalogue | 364 preserved cases; no formal case passes inferred from engineering tests |
| Planned future batches | R12–R16, plus open R11 live-provider and clinical follow-through |
| Development slices since R11 | 0a patient-partitioned storage, 0b delta responses and 0c identity layer with supply-chain gate, 1 households with proxy authority, 1b workforce lifecycle and caseload transfer, 1c controlled identity merge, 6a exceptional access, 6b rights requests, 0b-2 viewer-scoped reads, 6c retention schedules and holds, 6d indicators, 4a referral lifecycle and escalation, and 2a reuse metering delivered on stacked branches; see [slice 2a](docs/current/SLICE-2A-REUSE.md), [slice 4a](docs/current/SLICE-4A-REFERRALS.md), [slice 6d](docs/current/SLICE-6D-INDICATORS.md), [slice 6c](docs/current/SLICE-6C-RETENTION.md), [slice 0b-2](docs/current/SLICE-0B2-SCOPED-READS.md), [slice 6b](docs/current/SLICE-6B-RIGHTS.md), [slice 6a](docs/current/SLICE-6A-EXCEPTIONAL-ACCESS.md), [slice 1c](docs/current/SLICE-1C-MERGE.md), [slice 1b](docs/current/SLICE-1B-CASELOAD.md), [slice 1](docs/current/SLICE-1-HOUSEHOLDS.md), [slice 0a](docs/current/SLICE-0A-STORAGE.md), [slice 0b](docs/current/SLICE-0B-DELTAS.md), [slice 0c](docs/current/SLICE-0C-IDENTITY.md) and [development order](docs/NEXT-DELIVERY.md) |

The runtime uses React/Vinext, a Cloudflare Worker and D1. The original PostgreSQL/RLS, native Android and broader REST design remains a target, not installed functionality. Live AI/MIS/EHR/ABDM, physical-device/offline, independent clinical/security/accessibility, representative scale, hosted recovery and field acceptance remain open.

GitHub main is older than the latest stacked release branches. Continue from this documentation branch or the latest release after checking its history. Follow [AGENTS.md](AGENTS.md), preserve concurrent work and publish each completed batch through a branch/draft PR. GitHub publication does not deploy the running Site.

For documentation verification:

```sh
python3 scripts/check-documentation.py
node scripts/audit-requirements.mjs --check
```

Detailed release history remains in [VALIDATION.md](VALIDATION.md), [RELEASE-11.md](RELEASE-11.md), [the remaining plan](REMAINING-RELEASES.md) and the preserved [pre-handover README](docs/history/README-R11-before-handover.md).
