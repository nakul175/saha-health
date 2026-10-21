# SAHA-110 local coding completion — privacy-preserving aggregation

Date: 20 October 2026
Story: SAHA-110 / APL-133
Requirement: BR-REP-04
Base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`

## Implemented behaviour

Operational reports and exports apply a minimum cohort of five and withhold the complete protected projection when a cohort, contributing group, complementary difference or retained disclosure history could reveal a small group. The bounded seven-day ledger compares filters, definitions, groupings, windows, numerator/denominator components, cross-viewer overlap and non-nested population profiles. Capacity exhaustion fails closed and older protecting evidence is retained.

Patient records remain outside aggregate reporting authority. A reporting-context drilldown requires the current reporting purpose and a separate, current patient-care scope. Reporting-only delegation cannot widen that care scope. Patient downloads are available only through the same reporting-context gate, are audited before release, and recheck membership, purpose, delegation, patient scope and record version after preparation. A changed basis returns no patient content.

Ordinary care-context patient reads retain their existing behaviour. Aggregate CSV exports remain scoped, suppressed, reconciled, checksummed and audited; no external destination or live patient data was used.

## Local evidence

- Reporting patient-purpose/access contract: 5/5.
- Operational privacy contract: 41/41.
- Protected operational export contract: 7/7.
- Patient directory and separate care-scope contract: 56/56.
- Independent non-nested/cross-viewer privacy contract: 49/49.
- Composite independent disclosure contract: 57/57.
- Composite-measure disclosure contract: 57/57.
- Total focused assertions: 272/272.
- TypeScript and production build: passed.
- Direct legacy contract fixtures were updated only to transpile the current `installed-transition-authority` dependency; original assertions and minima remain unchanged.

## Gates not promoted

This is local coding completion only. Formal `TC-BR-REP-04-A/B` and `TC-J06`, programme/domain approval, independent source review, exact-source CI, merge and observed deployment remain separate and pending.
