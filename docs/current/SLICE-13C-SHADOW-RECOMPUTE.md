# Development slice 13c — corrected shadow comparisons recomputed on read

4 October 2026 (IST). At the sponsor's request ("fix all"), this slice closes the last open finding of the agent review of the 15 R-slices (#144): `recompareShadow` (slice R26) had no caller, so the shadow and drift reports counted comparisons against values later corrected or recorded for the wrong patient, and the correction tasks could not honestly say otherwise. Synthetic data only; formal acceptance unchanged (BR-DATA-06 and BR-AI-10 stay partial).

## What changed

- **`shadow.currentFields`** gives a shadow result's comparison as it stands now:
  - an uncorrected visit keeps its stored fields;
  - an amended visit whose correction is confirmed is recompared against the current confirmed visit of its amendment chain (`recompareShadow`);
  - an amended visit whose correction is not yet confirmed, or a voided (wrong-patient) visit, is left out;
  - a visit not in the state being read keeps its stored fields.

  Nothing stored is rewritten; the governance record stays as recorded.
- **The shadow report** (`shadowReport`) counts each field from the current comparison and reports how many comparisons were recomputed and how many were left out (`visits.recomputed`, `visits.excluded`). The governance panel shows both counts when they are not zero.
- **The drift report** (`driftReport`) takes the current comparison from its caller. The governance read and the notification sources (drift drops) pass `currentFields`, so a left-out comparison no longer counts in its period. Called without it, the report is unchanged.
- **Correction tasks** for a shadow comparison are again recorded as done:
  - recomputed for an amendment, with the correction visit named;
  - invalidated for a void;

  as slice R26 intended. The integration of #144 had kept them open for review while nothing recomputed them. Indicator releases since confirmation still leave an open review task, because a released figure is never recalled.

## Tests

- `tests/shadow-recompute-contract.mjs` (unit, 3 checks over five results: untouched, amended and confirmed, amended with a draft correction, voided, not loaded): the current comparison, the shadow report counts, and the drift report with and without `currentFields`.
  Making `currentFields` return the stored fields for every result fails it.
- `tests/correction-tasks-contract.mjs` and `tests/r26-correction-propagation-contract.mjs`: expectations returned to recomputed/invalidated for shadow comparisons; open-task counts adjusted (14 open, 6 done).
- `tests/shadow-contract.mjs` and the HTTP `tests/shadow-smoke.mjs`: the report's visit counts now include `recomputed: 0, excluded: 0` for uncorrected visits.

## Limits

- A recomputed comparison is dated in the drift report by the original visit's confirmation, not the correction's.
- The governance read loads the organisation's visits; a comparison whose visit is outside a scoped read keeps its stored fields.
- Built and reviewed by one agent; no independent review.
