# Development slice r96 — accessibility audit of the visit confirmation and correction dialogs and the Hindi workspace

3 October 2026 (IST). Part of slice 6 (accessibility). Synthetic data only; formal acceptance unchanged. NFR-13 remains partial.

## What changed

- **Repeatable audit in the UI suite.** A new Playwright spec, `tests/ui/confirm-correct-hindi.spec.mjs`, drives the built local Worker in headless Chromium and runs axe-core (via `@axe-core/playwright`, WCAG 2.0–2.2 level A/AA) over the two areas the earlier audits (slices 6e/6f/6x, `tests/a11y-audit.mjs`) explicitly left outside their coverage: the visit confirmation step, the correction dialogs, and the Hindi workspace screens. Each screen is scanned at desktop (1280×720) and phone (390×844) widths, mirroring the slice 11c UI setup's shared `lab.scan()`.
- **Screens covered.** (1) The visit confirmation step: the Review & act tab with the "I checked the patient, observations, source and date" check and the disabled-then-enabled Confirm visit button, and the resulting "Confirmed facts" state. (2) The two correction dialogs opened from the record tools: Create a correction (amend) and Mark as wrong-patient (void), each checked for an accessible name and for keyboard focus moving inside the dialog. (3) The Hindi (draft translation) ASHA journey: My work, the patient page (with the bilingual danger sign), Review & act and Receipts, with the draft-translation notice's `role="note"` and the `lang="hi"` tagging checked.
- **Result.** No axe-core violations on any of the 16 screens (0 nodes). The earlier contrast, label, focus-return and live-region fixes in the shared components and `app/globals.css` (slices 6e/6f/6x) already cover these dialogs and screens, so no further UI change was needed. This slice adds the missing coverage, not new fixes.

## Running it

The spec runs through the ordinary UI suite, which starts the built Worker once and stops it afterwards:

```
npm run build
npx playwright test -c tests/ui/playwright.config.mjs confirm-correct-hindi.spec.mjs
```

The `lab.scan()` helper records every axe violation (all impacts) and fails the test on serious or critical ones. The run scans 16 screens and takes about a minute on a loaded 2-core machine.

## Evidence

- `tests/evidence/r96/a11y-audit-result.json` — 16 screens, no violations, and 4 of 4 dialog focus checks passing.
- The run wrote `tests/reports/ui-result.json` (2 passed, 0 failed; 16 screens scanned, 0 axe violations).
- This is engineering evidence from an automated tool, not an independent human review.

## Limits

- Automated rules find only a part of WCAG. No screen-reader, keyboard-only walk, 200%/400% zoom or reflow, high-contrast or reduced-motion testing was done, and no independent accessibility reviewer or native Hindi speaker was involved. NFR-13 remains partial.
- The shared scan tag list (`tests/ui/support/fixtures.mjs`) omits `wcag22a` (WCAG 2.2 level A); it matches the existing UI setup and the standalone `tests/a11y-audit.mjs`, so this spec inherits that gap.
- The Hindi text is a draft translation not reviewed by a qualified translator; this audit checks that it is shown and labelled, not that it is correct.
