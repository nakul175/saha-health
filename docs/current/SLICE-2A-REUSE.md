# Development slice 2a — reuse and re-entry metering

30 September 2026 (IST). First part of slice 2 of the development-completion plan. Synthetic data only; formal acceptance unchanged.

## What changed

- **Reproducible from stored visits.** Nothing new is recorded at capture time. Each confirmed visit already stores the programme packs captured and their answers, so reuse is recomputed from those records whenever it is asked for.
- **Definitions.** In one confirmed visit, a question shared by N programme packs gives N−1 reuse opportunities. Answering it once reuses it for all N packs. Recording it as unknown, declined, not measured or unobtainable blocks that reuse. A confirmed visit that repeats the date and core measurements (weight, blood pressure, temperature) of an earlier confirmed visit for the same person counts as a possible repeated entry. Correction drafts and visits marked wrong-patient count as corrections.
- **Four catalogue indicators** (version 1, slice 6d machinery, so the same scope, cohort minimum and suppression apply): shared answers reused across programmes (proportion), reuse blocked by a missing shared answer, possible repeated entries, and visit corrections. The question interpreter recognises reuse, repeated-entry and correction wording.

## Evidence

- 7 contract assertions (`tests/reuse-contract.mjs`) with real pack definitions: two packs sharing weight and blood pressure give three opportunities; a three-pack visit counts weight twice; blocked reuse from an absence reason; single-pack and pack-less visits give none; a six-person cohort computes 22 of 33 reused (66.7 percent), 11 blocked, 5 repeated entries and 6 corrections, with voided visits excluded.
- The HTTP/D1 suite grew by 26 assertions across a new reuse suite (`tests/reuse-smoke.mjs`: a maternal plus hypertension visit captured through the real commands raises the reuse denominator by three and the numerator by one, with blood pressure recorded as not measured) and the extended indicator suite (twelve indicators, the eight-per-query limit, and the small-cell property check on both query chunks).
- No user-interface code changed; the Operations indicator list reads the catalogue from the server. No new browser check was run.
- All suites: 1,364 HTTP/D1, 567 contract/checkpoint and 21 restore assertions. Reports in `tests/evidence/slice-2a/`.

## Limits

- Reuse is measured within a visit. Reuse of earlier answers across visits, time saved and worker-reported burden are not measured.
- "Possible repeated entry" is a heuristic on identical same-day measurements, not a confirmed duplicate.
- Sync burden and support burden (BR-REP-07) are not metered here.
