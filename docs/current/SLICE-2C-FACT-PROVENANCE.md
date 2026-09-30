# Development slice 2c — source and time for each fact

30 September 2026 (IST). Builds on slice 3g. Synthetic data only; formal acceptance unchanged.

## What changed

- **Per-measurement provenance.** Visit facts gain an optional `provenance` entry for each of five measurements: blood pressure (systolic and diastolic together), weight, temperature, gestational age and cough duration. Each entry has a source and an optional observation time (UTC, to the minute). Sources: measured, reported, not asked, declined, unknown, not applicable.
- **Rules, on every path that stores facts.** A new shared check (`checkFacts`) is used by the online save, the field notebook sync (through the same save) and field registration. A recorded value must be measured or reported; not asked, declined, unknown and not applicable apply only to a blank value; a time applies only to a recorded value; no time may be in the future. The existing visit-level checks (future observation time, both blood pressure readings) moved into the same function unchanged.
- **Old visits stay valid.** Facts without entries are accepted as before. Wherever a measurement's source or time is read, a missing entry falls back to the visit-level source and observation time.
- **Where it is used.**
  - Visit screen: a "Source and time for each measurement" section under the common observations, with "Same as visit" as the default; a warning when a value is marked as missing. The review tab lists each measurement's source and time (marked "visit-level" when inherited) and each missing reason. The version-conflict comparison and record history show the entries as text.
  - Field notebook: the same controls for each draft, in English and Hindi (Hindi unreviewed). Before sync, the notebook drops entries that say nothing (a recorded source or a time on a blank value); contradictions are sent and refused by the server, which routes the draft to review with the reason.
  - FHIR document (EHR publication and mock ABDM transfer) and the FHIR example download: each Observation has its own `effectiveDateTime`; a reported value has a `method` text and every Observation's note names its source, marked "visit-level" when inherited. A missing measurement is not an Observation; the document narrative states "not recorded" with the reason. The pinned outbound validator (`saha-fhir-r4-document-structure` 1.0.0) is unchanged and passes.
  - Demo summary: each measurement's source (and its time when it differs from the visit), and a "Not recorded" line with reasons. Text for visits without entries is unchanged.
  - Protocol checks: a rule's freshness is measured from that measurement's own time when one is recorded.
  - Assistant: fields applied from a reviewed extraction take the reviewed visit-level source and time, so their own entries are cleared.

## Evidence

- 41 contract assertions (`tests/fact-provenance-contract.mjs`): schema (old facts valid, strict entries, six sources, minute times, unknown measurement and source refused); every rule of the shared check; the fallback; tidying; history text; demo summary with and without entries; FHIR document per-observation time, method and note, the declined measurement absent and stated in the narrative, validator stamp, and the reader's dates; unchanged output for a visit without entries; the FHIR example download.
- 27 HTTP/D1 assertions (`tests/fact-provenance-smoke.mjs`): six refusals storing nothing; a save without entries; a save with entries stored as sent; the history change; confirmation and the FHIR example's per-observation times with the declined temperature absent; field sync refusing a contradiction and storing valid entries; field registration applying the same check.
- 17 client assertions (`tests/field-provenance-client.mjs`): the notebook's controls, time only with an entry and a value, editing through the controls, the contradiction warning, tidying, the sync body, and a refusal routed to review then a corrected sync.
- Browser check (headless Chromium, built Worker): recorded a reported weight with an earlier time and a declined temperature in the visit screen, saved, reviewed and confirmed; the server stored the entries as entered, the review listed both, the FHIR example's weight carried the earlier time and the reported method, and no temperature Observation was produced. No console errors. `tests/evidence/slice-2c/fact-provenance-browser.json`.
- Existing contract harnesses that transpile `core.ts` now also transpile the new `fact-provenance.ts` (29 files; no assertion changed).
- All suites: 1,578 HTTP/D1, 953 contract/checkpoint (895 plus 58) and 21 restore assertions.

## Limits

- Entries cover the five measurements only. Visit notes, programme answers (which keep their own absence reasons) and the visit-level source are unchanged; the two sets of missing reasons are not unified.
- Author and verification state per observation (also named in BR-DATA-02) are not recorded separately; the visit's author and confirmation still apply to all facts.
- Programme (MIS) mappings still send the visit-level `source` and `date`; no per-measurement mapping source exists yet.
- The FHIR `method` is free text, not a coded value; no terminology binding has been approved.
- The field registration form (slice 3g) does not offer per-measurement entries; the server accepts them.
