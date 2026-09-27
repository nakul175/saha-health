# Release 11 / v1.3-readiness — AI and clinical governance

27 September 2026. Private synthetic engineering release; live-provider and clinical-validation follow-through remains open.

Technical provider readiness previously had no independent capability evidence gate. Clinical source/service metadata, protocol reviews and encounter-linked safety reports also lacked a governed lifecycle. This release adds those controls while keeping actual clinical deployment unavailable.

## Changes

- Clinical governance registers immutable source, service, protocol and documentary AI capability revisions with accountable ownership, care teams, dates, independent clinical review and owner activation. Version, membership, date and dependency checks run again when content is used. Superseded active revisions retire; safety concerns can suspend current packages.
- A fixed 18-case synthetic evaluation corpus reports field/language/group precision and recall, errors and critical failures. Each case has a durable one-call reservation and retained outcome. Exact manifest/corpus/provider/agent/member bindings prevent stale evidence reuse. Cancellation and interrupted work never trigger automatic resends.
- The local English parser passes its 16 known fixtures. A capability claiming Hindi fails the independent language gate. Neither result establishes representative model quality or clinical accuracy. Live models were not invoked.
- Agent v1.1 adds capability context gates, reserved-token/call quotas, common identifier checks and full-clause/field evidence validation. Original outputs retain reasoned accept/reject/override decisions. Legacy HTTP free-text AI execution is disabled; external work must use the governed evidence assistant.
- Encounter review evaluates bounded, source-backed rules without a model, surfaces unknown/stale inputs and records worker concern. Clinical decisions bind the originating worker's still-valid context, including ASHA-only protocol scope. Directory referral drafts retain a current reviewed service snapshot. Legacy free-text referrals are labelled as unverified.
- Safety cases preserve encounter/output references, named clinical responsibility, reassignment, resolution and optional capability/protocol suspension. Administrators cannot see patient-linked cases or affected encounters.

## Validation

**1,284 automated assertions passed:** 902 built-Worker HTTP/D1 assertions, 361 contracts/checkpoint checks and 21 encrypted recovery checks. These are checks across layers, not 1,284 end-to-end workflows. Strict TypeScript, production build, whitespace and all-176 requirements consistency checks passed.

The new migration adds one organisation-keyed governance table. The restore drill verifies all 25 tables, restarts the built Worker and compares retained governance manifests, evaluations, safety cases and earlier continuity/referral evidence. Hosted recovery, RPO/RTO and production capacity remain unvalidated.

Browser preview verified capability draft creation, completion of all 16 English cases, independent-review blocking after a passing evaluation, and saved unknown worker concern with evidence. It retained earlier synthetic patients and referrals. Independent multi-account approval, ASHA-context clinical review, suspension, rejected-output retention and source/service invalidation were exercised by HTTP/D1 tests. No real reviewer was impersonated or clinical acceptance recorded.

Local test runs encountered a transient Worker restart on rejected requests. The final complete run passed without retries or relaxed expectations. The harness now isolates the built artifact and development registry from the UI preview. An empty-visit test fixture was also corrected to record an explicit synthetic note before confirmation; the server's confirmation requirement was preserved.

## Open work

The audit records **14 implemented-local, 134 partial, 19 not-built and 9 unverified** requirements; all **176 formal acceptance criteria remain pending**. Five prior not-built items now have partial local implementations, not accepted clinical capabilities.

R12–R16 remain five future planned batches. R11 follow-through is still open: supported secure provider credential setup, real provider evaluation, approved sources/services/protocols, representative corpora, verified professional authority, complete programme semantics and clinical sign-off. No current Site environment secret was supplied. See [AI-GOVERNANCE.md](AI-GOVERNANCE.md), [REMAINING-RELEASES.md](REMAINING-RELEASES.md) and [REQUIREMENTS-TRACEABILITY.md](REQUIREMENTS-TRACEABILITY.md).
