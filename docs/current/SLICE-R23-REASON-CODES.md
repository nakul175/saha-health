# Development slice r23 — unified reason-code vocabulary

3 October 2026 (IST). Builds on slice 2c (per-measurement source and time) and slice 2g (programme answer
absence reasons). Synthetic data only; formal acceptance unchanged.

## What changed

- **One versioned reason-code vocabulary** (`lib/saha/reason-codes.ts`, pure constants and mapping functions,
  no runtime imports). `saha-reason-codes-1.0.0`, system `https://saha.example/reason-codes`, labelled
  "engineering placeholder — not clinically approved". Five codes, each with a canonical display and one of
  the four semantic classes BR-RULE-01 requires to stay distinguishable downstream:
  - `not-asked` (missing), `declined` (refused), `unknown` (uncertain), `not-applicable` (not-applicable),
    `unable-to-obtain` (uncertain).
- **A single mapping function** that maps both existing free-text reason fields onto the vocabulary:
  - Measurement provenance sources (`fact-provenance.ts` `FACT_SOURCES`): `not-asked` → `not-asked`,
    `declined` → `declined`, `unknown` → `unknown`, `not-applicable` → `not-applicable`; recorded sources
    (`measured`, `reported`) are not reasons and map to nothing.
  - Programme answer absence reasons (`programmes.ts` `ABSENCE`): `Unknown` → `unknown`, `Not measured` →
    `not-asked`, `Declined` → `declined`, `Unable to obtain` → `unable-to-obtain`.
- **Coded methods and reason artefacts** for the downstream resources, so missing/refused/uncertain stay
  distinguishable everywhere:
  - `reasonCoding(value)` — a FHIR CodeableConcept coding (Observation `method` / `dataAbsentReason`).
  - `methodCoding(source)` — a coded Observation `method` for a reported value (the existing free-text method
    is kept alongside, never replaced).
  - `misReasons(facts)` — a `reasons` section to merge into a `saha-mis-v1` payload (omitted when no
    measurement has a recorded reason, so payloads without provenance are unchanged).
  - `summaryReasonCodes(facts)` — a coded line to append to the demo summary (the existing free-text summary
    is unchanged).
- **Additive only.** No existing field, save path, export string or schema is removed or changed. The existing
  free-text and boolean reason fields remain the record of truth; this slice is the unification layer that maps
  them onto one stable code.

## Where it is used

The mapping is demonstrated against the real downstream resources in the contract suite: the demo summary's
free-text "Not recorded" line is paired with the coded line, the MIS mapped payload is paired with the `reasons`
section, and the FHIR document/example observations are paired with the coded method for reported values (the
missing measurement stays out of the observations and its reason is stated in the narrative, as before).

The mapping helpers are pure and ready for the integrator to call from the export sites (`core.ts` `summary`,
`mis.ts` `mappedPayload`, `fhir.ts`/`fhir-document.ts`) centrally; this slice does not edit those files because
doing so would add a runtime import that every contract harness would then have to add to its transpile list
(`core.ts` is transpiled by ~90 contract tests). See Limits.

## Evidence

- 61 contract assertions (`tests/reason-codes-contract.mjs`): the vocabulary (system, version, ruleset, status,
  four classes, five codes with display and class); every measurement source mapped (recorded sources are not
  reasons, all missing sources have a code); every programme absence reason mapped onto the same codes and
  classes; the single `reasonForField` mapping; coded FHIR artefacts (reason coding and the coded method for
  reported); provenance and absence maps keyed by field/question id; the MIS `reasons` section (omitted when
  none); the summary reason-codes line; and the mapping applied to the real demo summary, MIS mapped payload,
  FHIR document and FHIR example download.
- `node_modules/typescript/bin/tsc --noEmit` passes cleanly.
- The existing `fact-provenance-contract.mjs` (41) and `mis-contract.mjs` (43) still pass unchanged.

## Limits

- The codes are provided as additive mapping helpers; the export sites (`summary`, `mappedPayload`,
  `fhirDocument`, `fhirExample`) still emit the free-text reason fields exactly as before. Wiring the helpers
  into those sites is deferred to the integrator, because a direct `import` from `reason-codes` in `core.ts` or
  `mis.ts` would require adding `reason-codes` to the transpile list of nearly every contract test. The mapping
  is complete and tested so the wiring is mechanical.
- The vocabulary is an engineering placeholder, not an approved terminology binding; the FHIR `method` coding
  uses the same placeholder system rather than a registered value set.
- `Not measured` (programme absence) maps onto `not-asked` (class missing) rather than its own code; the two
  wordings are kept distinct in the original free-text field, but they share one downstream code.
- Recorded-source semantics (`measured` vs `reported`) are not part of the reason vocabulary; `reported` gets a
  coded method, `measured` gets no method, matching the existing free-text behaviour.
