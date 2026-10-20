# SAHA-108 local coding completion — governed indicator definitions

Date: 20 October 2026
Story: SAHA-108 / APL-131
Requirement: BR-REP-02
Base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`

## Implemented behaviour

An organisation owner can propose a versioned indicator definition containing its numerator, denominator, filters, exclusions, owner, cadence and minimum cohort. Numerators and denominators use a bounded fixed vocabulary or a bounded versioned composite calculation with reviewed examples. A distinct active supervisor or clinician reviews the proposal before the owner schedules its effective release. Retirement and rollback also create new independently reviewed versions; earlier released versions and their governance history remain immutable and addressable.

The fixed vocabulary now includes accepted programme submissions as an event-grain measure, counted by accepted state and recorded update time within the report window. This is separate from confirmed visits, which count encounters, and patients seen, which count each person once. The registry contract proves that two accepted submissions for one person remain two programme events while that person contributes one visit and one unique person.

Reports state the exact definition version, canonical digest, source refresh time, cutoff and window. Protected point-in-time figure material can recalculate all fixed measures for a historical cutoff. Current organisation/team scope, cohort minimums, primary and complementary suppression, bounded differencing history, source freshness and export controls remain enforced. Operator coverage is never substituted for a clinical or programme denominator.

## Local evidence

- Indicator calculation: 9/9.
- Versioned registry and accepted-submission grain: 13/13.
- Independent governance lifecycle: 42/42.
- Immutable figure material: 92/92.
- Freshness: 10/10.
- Household counting compatibility: 35/35.
- Export compatibility: 7/7.
- TypeScript and production build: passed.
- Exact source hashes and logs: `tests/evidence/saha108-local-coding-completion/`.

## Gates not promoted

This is local coding completion only. Formal `TC-BR-REP-02-A/B` and `TC-J06`, programme/clinical approval of definitions and denominators, official publication approval, independent source review, exact-source CI, merge and observed deployment remain separate and pending.
