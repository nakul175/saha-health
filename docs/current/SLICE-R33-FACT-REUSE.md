# Development slice R33 — cross-visit reuse of recorded facts with provenance

3 October 2026 (IST). Builds on slice 2c (fact provenance), 2e (measurement author and verification), 2i (units and
unusual values), 10g (disputes and sign-off) and 10i (imported read-only visits). Synthetic data only; formal
acceptance unchanged. This is one part of BR-DATA-12 (measurement of actual reuse): it makes a recorded measurement
reusable across visits; the time, sync and support burden instrumentation is a separate slice (R34).

## What changed

- **One new command, `reuseFact`.** A care worker editing a current draft visit can reuse one measurement recorded on
  an earlier confirmed visit of the same person: `{ type: 'reuseFact', visitId, version, sourceVisitId, measure }`.
  It is additive — the existing single-visit fact path (`saveVisit`, `checkFacts`, field sync and field registration)
  is unchanged.
- **Provenance is carried forward.** The reused measurement copies its value field(s) (systolic and diastolic
  together for blood pressure) and its effective source and observation time. A measurement's own slice 2c entry is
  copied as-is; a measurement that only had visit-level provenance falls back to the source visit's source and time,
  carried into the new visit as an explicit entry. The new visit's own date and notes are kept, so the original
  fact's meaning and time are preserved instead of being silently re-dated.
- **What is refused.**
  - A measurement with an **open dispute** on its `fact:<measure>` target cannot be reused; a resolved dispute, or a
    dispute on a different measurement, does not block.
  - A measurement on an **imported read-only visit** (slice 10i) cannot be reused.
  - Also refused: a non-care role, a stale visit version, a source that is the target itself, a source visit of a
    different person, a source that is not a current confirmed visit, and a measurement not recorded on the source.
- **Author and unusual values.** Reuse does not carry the earlier fact's author (a later `recordFactAuthors` credits
  the actor who reused it, as with any save) or its entered-unit / unusual-value reasons; the reused value is
  re-validated by the ordinary save path on this visit. Reusing a value outside the placeholder expected range still
  needs its own reason (and, beyond the confirmation range, a clinician confirmation) on the new visit.
- **Classification.** `reuseFact` is a certified per-patient command (`lib/saha/partition.ts`) and is listed in
  `lib/saha/imported-visits.ts` as blocked on an imported visit, satisfying the completeness check that every command
  naming a visit is classified. The command is dispatched through `platformApply` (`lib/saha/platform.ts`), the same
  additive pattern as the programme commands.

## Evidence

- 21 contract assertions (`tests/fact-reuse-contract.mjs`): `reusedMeasurement` copying the value field(s) and the
  effective source and observation time (per-measurement and visit-level fallback), and dropping stale entered-unit /
  unusual-value reasons; the `reuseFact` command's refusals (non-care role, stale version, self-source, cross-person
  source, imported read-only source, non-confirmed source, unrecorded measurement) and an open dispute on the reused
  measurement blocking reuse while a resolved dispute or one on another measurement does not; a successful reuse
  carrying value and provenance forward, bumping the visit version and writing the audit event; and the strict schema
  (known measures only, no extra fields).
- `node_modules/typescript/bin/tsc --noEmit` is clean (0 errors).
- Result: `tests/evidence/slice-r33/fact-reuse-contract-result.json` with a manifest.

## Limits

- Reuse covers the five measurements only (blood pressure, weight, temperature, gestational age, cough duration), not
  visit notes or programme answers, which keep their own absence reasons.
- The reused fact's author is the worker who reuses it (credited by the existing author-stamping rule), not the
  original recorder; only its source and observation time are carried forward, as the requirement names.
- Entered-unit and unusual-value reasons are not carried: a reused value is re-validated by the existing single-visit
  checks, and an out-of-range value needs a fresh reason (and possibly a clinician confirmation) on the new visit.
- Reuse refuses a disputed or imported source at apply time; nothing records a per-measurement "reused from" link on
  the stored facts beyond the audit event (the audit line names the source visit).
- The value ranges remain the engineering placeholder from slice 2i (not clinically approved).
