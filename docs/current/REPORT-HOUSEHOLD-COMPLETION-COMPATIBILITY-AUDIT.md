# Frozen reporting and household completion compatibility audit

Read-only source review of canonical `987f82de` against stable B13 `7320bfc3`, 5 October 2026. No canonical or B13 source was edited. This audit is diagnostic, not a feature acceptance or a fix. Root owns the combined counting repair.

## Grounded mismatch

Canonical `indicators.ts` counts `followups-open` and `followups-overdue` by raw `state === 'open'`. Canonical `indicator-figure-material.ts` stores follow-up due dates using that same filter. B13 deliberately keeps completed task state and original closure evidence immutable when its source confirmed visit is voided or superseded; `followUpOpen` derives that task as unresolved. Household, action-plan and continuity views use this predicate.

The [production-function diagnostic](../../tests/indicator-household-completion-audit.mjs) transpiles exact read-only canonical indicator/live/material modules with the six B13 household and derived-work modules. It invokes B13's actual `applyHouseholdWork` on an eligible synthetic own confirmed visit, then applies the retained void flag and captures new material. It does not imitate either counting function. The result is:

| Step | Care task state | Derived unresolved | Fresh report open/overdue |
| --- | --- | --- | --- |
| Before completion | open | true | 1 / 1 |
| Selected confirmed completion | completed | false | 0 / 0 |
| Source visit voided | completed, original history retained | true | **0 / 0** |

Action-plan displays one unresolved item after the void. The live open measure also returns zero. Source hash changes correctly after the void, so draft freshness detects the change; this is a fresh counting semantics mismatch, not another missing-source hash defect. Original frozen material still returns zero and must keep that value after a repair. New figures/reissues should count the derived unresolved task using the shared predicate. Both live and frozen counting paths require the same change. Amendments through supersession use the same derived predicate; the current diagnostic directly exercises void.

[Diagnostic evidence](../../tests/evidence/report-b13-compatibility/diagnostic.json) preserves all relevant source SHA-256 hashes, three original source hashes and exact observed outputs. [Manifest](../../tests/evidence/report-b13-compatibility/manifest.json) pins bytes/digests. Eleven diagnostic assertions confirm the observed behavior, with zero positive feature acceptance assertions. This is actual production-function execution with synthetic in-memory state; it does not claim HTTP/D1 or browser execution for this cross-feature combination. Existing author HTTP proves household void/replacement behavior separately.

Run from this checkout with sibling `work/saha-household-completion` remaining at stable B13 SHA. The runner reads it without mutations. No shared reports, ports or canonical report runner are used.

## Broader B27 residual software scope

Governed definition proposals, independent review, effective-date release, immutable figure material, original-owner publication, source freshness and parent-linked independently reviewed reissues are implemented in canonical source. Clinical denominator and official publication approval remain external acceptance.

Two buildable clauses remain bounded gaps rather than delivered claims. `indicator-registry.ts` accepts numerator and denominator only from `MEASURE_IDS`, with fixed filters/exclusions; there is no validated owner-defined composite measure expression contract. Natural-language interpretation remains registry keyword matching, as documented. `indicator-figures-server.ts` reissue retains parent query/definitions/cutoff and immutable history, but stores no automatic affected-edition/correction/late-arrival impact record or protected difference summary tied to published editions. New preparation and manual reissue exist; automatic impact workflow remains a separate B27 delivery. Any impact view must preserve cross-edition disclosure protection and current original-cohort authority.

Referral outcome counting is explicitly labelled “referrals created in the window now completed”; it uses created-at eligibility and current completed state. This intentional definition is not claimed as an outcome-time defect. Relevant referral rows and full person/visit rows are included in source hashes, so source outcome changes, programme task closure, void and amendment move freshness material. Household planning alone is not a counted measure and does not require a household-row counting hash. Direct material/source review found no second missing hash coverage defect in those paths.
