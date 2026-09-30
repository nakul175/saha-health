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
| Implementation assessment | 14 implemented-local, 150 partial, 3 not-built, 9 unverified after slice 6m (R11: 134 partial, 19 not-built) |
| Saved R11 qualification | 902 HTTP/D1 + 361 contract/checkpoint + 21 restore assertions = 1,284 |
| Original acceptance catalogue | 364 preserved cases; no formal case passes inferred from engineering tests |
| Planned future batches | R12–R16, plus open R11 live-provider and clinical follow-through |
| Development slices since R11 | 0a patient-partitioned storage, 0b delta responses and 0c identity layer with supply-chain gate, 1 households with proxy authority, 1b workforce lifecycle and caseload transfer, 1c controlled identity merge, 6a exceptional access, 6b rights requests, 0b-2 viewer-scoped reads, 6c retention schedules and holds, 6d indicators, 4a referral lifecycle and escalation, 2a reuse metering, 1d roster reconciliation, 7a ABDM mock workflows, 7b ABDM mock transfer, 2b visit media, 6e automated accessibility audit with contrast fixes, 3a offline media queue, 3b field storage warnings, 7c pinned outbound FHIR validation, 6f field, phone and keyboard accessibility, 6g computed operational alerts, 3c media queue hardening after independent review, 6h alert acknowledgement, 3d in-app voice-note recording, 3e on-device photo reduction, 3f workspace photo reduction, 3g offline registration with ordered sync, 2c source and time for each fact, 3h clinician action on field referral requests, 4b unified action plan with ownership, 6i item-level exception queue, 6k reconciled operational export, 6j tamper-evident audit chain, 5a AI cost budgets with stopping of unsent requests, 6l safe-logs check with free text moved out of request URLs, 5b provider self-service in a provider sandbox, 5c conflicting assistant values and inability to assess, 5d capability lifecycle with replacement and in-progress work, and and 6m organisation data export with offline verification delivered on stacked branches; see [slice 6m](docs/current/SLICE-6M-DATA-EXIT.md), [slice 5d](docs/current/SLICE-5D-CAPABILITY-LIFECYCLE.md), [slice 5c](docs/current/SLICE-5C-CONFLICTS-QUALITY.md), [slice 5b](docs/current/SLICE-5B-PROVIDER-SANDBOX.md), [slice 6l](docs/current/SLICE-6L-SAFE-LOGS.md), [slice 5a](docs/current/SLICE-5A-AI-BUDGETS.md), [slice 6j](docs/current/SLICE-6J-AUDIT-CHAIN.md), [slice 6k](docs/current/SLICE-6K-RECONCILED-EXPORTS.md), [slice 6i](docs/current/SLICE-6I-EXCEPTION-QUEUE.md), [slice 4b](docs/current/SLICE-4B-ACTION-PLAN.md), [slice 3h](docs/current/SLICE-3H-REFERRAL-REQUESTS.md), [slice 2c](docs/current/SLICE-2C-FACT-PROVENANCE.md), [slice 3g](docs/current/SLICE-3G-OFFLINE-REGISTRATION.md), [slice 3f](docs/current/SLICE-3F-WORKSPACE-PHOTO-REDUCTION.md), [slice 3e](docs/current/SLICE-3E-PHOTO-REDUCTION.md), [slice 3d](docs/current/SLICE-3D-VOICE-RECORDING.md), [slice 6h](docs/current/SLICE-6H-ALERT-ACKNOWLEDGEMENT.md), [slice 3c](docs/current/SLICE-3C-QUEUE-HARDENING.md), [slice 6g](docs/current/SLICE-6G-ALERTS.md), [slice 6f](docs/current/SLICE-6F-FIELD-ACCESSIBILITY.md), [slice 7c](docs/current/SLICE-7C-OUTBOUND-VALIDATION.md), [slice 3b](docs/current/SLICE-3B-STORAGE-WARNINGS.md), [slice 3a](docs/current/SLICE-3A-OFFLINE-MEDIA.md), [slice 6e](docs/current/SLICE-6E-ACCESSIBILITY.md), [slice 2b](docs/current/SLICE-2B-MEDIA.md), [slice 7b](docs/current/SLICE-7B-ABDM-TRANSFER.md), [slice 7a](docs/current/SLICE-7A-ABDM-MOCK.md), [slice 1d](docs/current/SLICE-1D-ROSTER.md), [slice 2a](docs/current/SLICE-2A-REUSE.md), [slice 4a](docs/current/SLICE-4A-REFERRALS.md), [slice 6d](docs/current/SLICE-6D-INDICATORS.md), [slice 6c](docs/current/SLICE-6C-RETENTION.md), [slice 0b-2](docs/current/SLICE-0B2-SCOPED-READS.md), [slice 6b](docs/current/SLICE-6B-RIGHTS.md), [slice 6a](docs/current/SLICE-6A-EXCEPTIONAL-ACCESS.md), [slice 1c](docs/current/SLICE-1C-MERGE.md), [slice 1b](docs/current/SLICE-1B-CASELOAD.md), [slice 1](docs/current/SLICE-1-HOUSEHOLDS.md), [slice 0a](docs/current/SLICE-0A-STORAGE.md), [slice 0b](docs/current/SLICE-0B-DELTAS.md), [slice 0c](docs/current/SLICE-0C-IDENTITY.md) and [development order](docs/NEXT-DELIVERY.md) |

The runtime uses React/Vinext, a Cloudflare Worker and D1. The original PostgreSQL/RLS, native Android and broader REST design remains a target, not installed functionality. Live AI/MIS/EHR/ABDM, physical-device/offline, independent clinical/security/accessibility, representative scale, hosted recovery and field acceptance remain open.

GitHub main contains R11 and development slices 0a–3f, merged on 30 September 2026 at the sponsor's instruction without independent human review. Branch from main after checking its history. Follow [AGENTS.md](AGENTS.md), preserve concurrent work and publish each completed batch through a branch/draft PR. GitHub publication does not deploy the running Site.

For documentation verification:

```sh
python3 scripts/check-documentation.py
node scripts/audit-requirements.mjs --check
```

Detailed release history remains in [VALIDATION.md](VALIDATION.md), [RELEASE-11.md](RELEASE-11.md), [the remaining plan](REMAINING-RELEASES.md) and the preserved [pre-handover README](docs/history/README-R11-before-handover.md).
