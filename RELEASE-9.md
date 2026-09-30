# Release 9 / v1.1-readiness — Outreach and expansion proposals

27 September 2026. Private synthetic engineering release. Real pilot exit remains outstanding.

The workspace now connects outreach planning, contact preferences and independently reviewed reminder simulation. Operators can prepare expansion proposals for programmes, AI providers, EHRs and locations, retain evidence and reuse configuration across proposals. A proposal does not install or activate a live capability.

## Delivered

- Human-selected team cohorts with programme/follow-up filters, selection rationale, named care-worker responsibility, reassignment, scheduling and cancellation.
- Attempted and cancelled outcomes retain source references. Completed outcomes require a current confirmed visit created since the plan. Later amendments or voids flag invalid evidence and allow the item and closed plan to reopen.
- Versioned contact method, synthetic destination, phone ownership, language, patient time zone, contact hours, disclosure preference and permission. Shared/unknown phones, private-contact-only preferences and withdrawn permission block automated reminders. Any preference change cancels pending messages.
- Fixed neutral English/Hindi templates with independent operations review. A different clinician or supervisor reviews the exact message context. Execution rechecks author, reviewer, assigned worker, patient scope, identity, contact preferences, template and plan version.
- Due-time checks, 24-hour approval expiry, UTC-day duplicate suppression, retained simulator receipts, three-attempt limit and owned failure follow-up. Retry requires new approval. Simulation is never labelled patient acknowledgement, message delivery or completed care.
- Expansion proposals record jurisdiction, population, language, purpose, local differences, dependencies and rollback. Six evidence categories and a named independent organisation owner are required for proposal review. Scope changes invalidate evidence; membership/evidence changes invalidate review.
- Strict configuration-only JSON import/export excludes record collections, account assignments, evidence and approval objects. Imports start as new drafts with local accountable members. Live activation is blocked.

## Evidence and limits

1,007 automated checks: 687 built-Worker HTTP/database assertions, 55 outreach/expansion contract checks, 248 retained contracts and 17 encrypted restore checks. TypeScript and production build pass. Tests use synthetic records and local D1; see `VALIDATION.md` and `tests/*-result.json`.

The append-only migration adds two organisation-scoped tables. Existing migrations remain unchanged. The encrypted restore drill verifies 24 SQLite tables, including outreach receipts and expansion evidence, through a restarted built Worker.

No actual patient messaging provider, IVR, inbound opt-out webhook, background scheduler or real patient endpoint is connected. New clinical programmes and live AI/EHR adapters are not installed by these proposals. Buyer, jurisdiction, clinical and operational acceptance require separate real evidence. This release does not establish G7 readiness or completion of all 176 BRD requirements.

See `OUTREACH-EXPANSION.md` for the workflow, boundaries and BRD mapping.
