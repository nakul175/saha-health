# SAHA quality rules — shared fields and whole-hierarchy checks

Planning documentation edition 4.2 · 10 October 2026. Criterion standard `3.0-generic`; canonical SHA-256 `a72502ce4dcfe5ec1e8537cd377f93e77ad32b9d998fdad62c252605089759fe`.

**Do not weaken criteria to obtain a pass.** This edition supersedes earlier checker instructions on this record; historical 166-field/449-detail/1,238-check qualification is not current Saha product evidence. Source snapshots are retained in the documentation revision archive.

## The hierarchy and source ownership

Vision → strategy → roadmap → release goal → epic → canonical product item → acceptance criterion → technical task. Existing items comprise 140 functional stories, 20 support items, 11 epics and 200 tasks. D01–D08 are included in 200 tasks, not extra stories. All 176 original requirements have one primary owning item. Preserve 364 original cases and 95 published CWO clauses, counting shared cases once by original ID. Supporting items retain NFR/spike/enabler/guardrail type even when mapped to the checker’s generic planning-item schema.

## Mandatory automatic checks

Pin the unmodified catalogue; validate known element/field types, unique IDs, permitted parent relationships, current source hashes, source obligation/applicability consistency, acyclic completion prerequisites, exact scope, evidence paths and revision/review bindings. A design reference may be cyclic and is not completion evidence. A stale, conflicting, missing or fabricated claim cannot pass. Source hashes establish consistency, not source truth or authority.

## Shared information

| Field | Required components |
| --- | --- |
| `common.identity` — Identity | Stable ID or canonical document link; title; element type; version |
| `common.purpose` — Purpose | Intended outcome; people or operators served |
| `common.traceability` — Traceability | Parent; authoritative source IDs; relevant children; decision links; canonical record links |
| `common.boundary` — Boundary | Included scope; excluded scope; constraints |
| `common.responsibility` — Responsibility | Actual accountable owner or assignee; applicable approval authority; pending owner/authority explicitly identified |
| `common.state` — State | Planning state; readiness state; delivery state; state reason; agreed dates/targets or explicit pending decision |
| `common.evidence` — Evidence | Claim links; observations; test outputs; explicitly labelled assumptions |
| `common.change_history` — Change history | What changed; why; when; decision impact; source impact; frozen-version impact |
| `common.source_provenance` — Source provenance | Original source or proposed supplement; Exact source/version reference |
| `common.approval_specification_state` — Approval/specification state | Draft/approved/frozen revision; Applicable authority/decision evidence |
| `common.execution_result` — Execution result | Not run/passed/failed/blocked/skipped; Reason; Evidence for observed results |
| `common.context_profile` — Actual product context and assurance applicability | Profile ID, version and content hash; product type, actual users and operating context; AI use: yes/no/unknown, scope and factual source; authoring-only AI separately declared; Safety, security, access, accessibility and information sensitivity with actual consequences; Personal-data and jurisdiction applicability, governing authoritative sources and unresolved legal decisions; AI assurance record ID/version/hash and applicable AI-01 to AI-07 evidence links; Protected source obligations, prohibited effects and qualification/release process |
| `common.ai_assurance_reference` — Pinned AI assurance record and current-stage groups | Actual AI assurance record ID, version and content hash; Current-stage AI-01 to AI-07 status and exact evidence locators; Actual product AI scope, model/prompt/configuration revision and responsible decisions; Dataset rights/quality, evaluation/safety/fallback, privacy/legal and monitoring obligations; Unresolved applicability, failed threshold or required decision with precise resume condition |
| `common.personal_data_controls` — Applicable personal-data rights and governance | Personal-data applicability, categories, subjects, purpose and minimal necessary scope; Jurisdiction/legal applicability and current authoritative sources; actual reviewed decision; Permission/consent or other established legal basis, rights and processing boundaries as applicable; Access, retention/deletion, security, affected third parties and transfer constraints; Actual decision/approval evidence, unresolved legal facts and prohibited processing |

## Whole-hierarchy review

Assess source and parent alignment, user outcome, scope/duplication, dependency order, shared Ready/Done references, consistent acceptance and evidence boundaries, release feasibility, protected safety/permission/data obligations, and explicit unresolved assumptions. Seven current-stage reviews are required for each assessed item; samples never add full-reference coverage or satisfy a required gate. Each item owns its applicable criteria, while common evidence is referenced and pinned rather than duplicated.

Run planning on the whole intended documentation scope; assess D03 readiness separately. No checklist, imported issue, document count, changed status, framework test or planned experiment grants human/domain approval or acceptance. A release learning decision later feeds real measured results into strategy and roadmap.
