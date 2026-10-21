# SAHA-156 — Point-of-need help

Date: 20 October 2026<br>
Status: local coding candidate; independent review, CI, merge, formal acceptance and deployment pending

## Frozen scope

This candidate implements the conservative, decision-gated v1.0 criteria frozen on APL-179/CWO-023 on 15 October 2026. The underlying originating CWO narrative and help-source decision remain unavailable; this candidate therefore stays inside the frozen synthetic boundary and does not claim a recovered source or product/domain approval. The eligible user is an authenticated ASHA already inside the existing assigned-person routine-visit journey. Help is optional and applies only to the current permitted task step.

The fixed source is `Saha routine-task guidance` version `1.0`, with provenance `Internal procedural guidance; no external provider or clinical content.` It is an application-owned procedural source. It does not add a diagnosis, clinical interpretation, patient fact, escalation, external service, destination action or completion state.

## Behaviour

- The control is closed by default and identifies the exact source and version when opened.
- Guidance applies to observation time/source, the five existing routine facts, notes, a valid installed programme question identifier, draft-save review and final review.
- Opening or closing help preserves the current form. A task, step, actor or source-availability transition remounts it closed so stale help cannot remain visible or reopen later.
- Every response gives the manual path: close help and continue the form, or return to Today.
- Other actors, other tasks and unknown step identifiers are refused without revealing the help catalogue.
- If the approved source is unavailable, the panel states the limitation and creates no replacement instructions, fact, action or completion status.
- The feature has no network, durable-storage, command, confirmation, assignment, send or provider operation.

## Local evidence

The evidence directory is `tests/evidence/saha-156-point-of-need-help/`.

| Check | Result |
| --- | --- |
| Point-of-need contract | 30 passed, 0 failed |
| Actual React component in Chromium | 16 passed, 0 failed |
| Actual local Worker/D1 and Chromium routine journey | 11 passed, 0 failed |
| Existing guided-instructions contract | 28 passed |
| Existing routine save-state contract | 20 passed, 0 failed |
| TypeScript on the current integration successor | passed |
| Production build on the current integration successor | passed |
| Focused changed-source lint | passed with zero warnings |

The first full-repository lint invocation remains a failed receipt: it ran the repository's existing `eslint .` baseline and reported 1,411 errors and 1,825 warnings, including generated temporary bundle output from the first component run. The owned temporary directory was removed. A direct lint of every new file passes. Existing lint findings elsewhere were not changed or suppressed.

Initial focused failures are retained in `LOCAL-COMPLETION.json`: a permissive empty programme identifier, stale help reopening after a context round-trip, an ambiguous browser selector and a stale built runtime. The candidate fixes each issue without weakening an assertion.

## Limits

The historical candidate evidence uses synthetic local records and an owned local runtime. The current integration successor was re-run separately and its exact source custody is recorded in the successor receipt. Neither establishes clinical correctness, privacy acceptance, ASHA field usability, physical-device behaviour, independent approval, merge or observed deployment. The exact candidate's historical CI remains separate from the current integration successor. The formal BRD assessment remains unchanged because no approved BRD mapping exists for APL-179/CWO-023; the 176 criteria and 0/364 formal acceptance register are not promoted.
