# Release 2 / v0.3 — Programme engine

26 September 2026. Incremental software Release 2; distinct from the clinical R2 scope in the original BRD.

## Delivered

- Three immutable code-versioned sandbox packs: maternal care, TB screening and hypertension follow-up. A catalogue exposes purpose and evidence requirements. Production activation is unavailable without approved content; these are illustrative configurations, not clinical protocols.
- Explicit local enrolment with independent episode IDs, descriptions, known or unknown start date, and closure outcome. Existing patient programme tags never silently become accepted enrolments. Official registration remains `not_submitted`.
- Every newly started visit snapshots all active episode IDs and complete pack definitions. Enrolling after a visit starts takes effect on the next new visit. Old visits and confirmed records are preserved.
- Shared semantic questions resolve once within the same visit (e.g. weight and BP), with units, observation time and measured/reported source. Programme-specific answers use a separate explicit save with actor and time. Conditional cough duration appears only for a positive cough answer.
- Mandatory evidence is checked on the server at confirmation. Missing facts require an explicit unknown, not measured, declined or unable-to-obtain reason. Unknown never becomes a negative finding. Invalid options, inactive questions and contradictory answer/absence combinations are rejected.
- No automatic historical reuse: new observations and programme answers start blank. Compatibility across different sources, units, episodes or observation times is not assumed.
- Reviewed follow-ups have independent programme/episode ownership, due date, responsible accessible care worker, outcome and completion/cancellation state. Duplicate open tasks are blocked. Worklists group compatible tasks by person and expose overdue dates without clinical urgency claims.
- Episode closure cancels its remaining open tasks and preserves other programmes' work. Resolve an open encounter before closing its episode. Completion of a visit never silently completes a follow-up.
- All changes use current role/patient scope, patient/visit optimistic versions, org transaction CAS, idempotency and append-only audit and record revisions. Programme changes invalidate unexecuted plans; payload hashes include pinned pack evidence.

## Storage and upgrade

Enrolments and follow-ups are nested aggregates in the existing structured patient row; capture and pinned definitions live in the structured visit row. Each mutation is atomically revisioned and audited by the R1 store. No new SQL migration or modification of applied migrations is required. Absent optional aggregates read as empty. No historical measurements or external enrolment states are inferred. This is a bounded sandbox design; large-scale programme reporting will require dedicated indexed tables.

## Verification

202 API/database checks pass, including all 163 R1 regressions and 39 programme checks. Coverage: multi-pack capture, stale enrolment/answer writes, permission denial, unknown start, date validation, immutable confirmed answers, conditional evidence, task deduplication, owner scope, closure cancellation, independent programme outcomes, preserved history, and fresh subsequent measurements. TypeScript and production build pass. See VALIDATION.md for browser verification.

## Remaining production gates

Named programme and clinical approvals; authored population/eligibility and escalation protocols; signed activation/effective-date governance; editable pack publishing; authoritative enrolment acceptance and mappings; cross-source freshness and reuse policy; pilot clinical validation. These are not represented as completed BR-PROG requirements.

Live AI, live MIS dispatch, EHR integration and ABDM onboarding remain later releases. Existing AI tools and submissions are simulators; the FHIR export remains unvalidated example output. No ABDM compliance or clinical certification claim is made.

## Walkthrough

1. Open Programmes to inspect the three sandbox definitions.
2. Open a patient, choose Open programme episode, select a pack and describe the locally confirmed episode. Leave start date blank if unknown. Add another pack to demonstrate reuse.
3. Start a new visit. Save common facts, then save programme evidence and absence reasons. Review and confirm; unresolved requirements block confirmation.
4. Schedule follow-ups under the relevant episode. Review grouped work under My work.
5. Record completion or cancellation with an outcome. Close an episode to cancel remaining work for that episode only.
