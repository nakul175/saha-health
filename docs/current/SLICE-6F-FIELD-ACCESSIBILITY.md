# Development slice 6f — field notebook, phone and keyboard accessibility

30 September 2026 (IST). Part of slice 6 (accessibility). Synthetic data only; formal acceptance unchanged.

## What changed

- **Wider audit.** `tests/a11y-audit.mjs` now also covers the field notebook (locked, a prepared draft with the media section, and the same draft in Hindi) at desktop size and at a 390 × 844 phone viewport, plus the owner home and patient screens on the phone viewport: 24 screens in all, up from 16.
- **Keyboard walk.** On the owner home screen and a field notebook draft, the audit presses Tab up to 60 times, waits for focus-style transitions, and records every focus stop and whether it shows a visible focus indicator (an outline or a focus shadow). Automated rules do not check this (WCAG 2.4.7, focus visible).
- **Fixes.** The walk found two stops without a visible indicator: the owner's "Search people" field (the design system's focus shadow is removed by the app stylesheet) and the date-time field in the field notebook while focus is on its calendar button. Text fields, text areas and select triggers in the workspace now show a 3 px keyboard focus outline; notebook inputs keep their outline while focus is inside them.

## Evidence

- Before: `tests/evidence/slice-6f/a11y-audit-before.json` — 24 screens, no axe-core violations, 2 focus stops without a visible indicator (29 stops walked on each screen).
- After: `tests/evidence/slice-6f/a11y-audit-result.json` — 24 screens, no violations, every walked focus stop visible.
- An earlier walk also flagged "Add person" and "Open next visit"; they were measured mid-transition, before the focus outline finished drawing. The walk now waits 250 ms after each Tab, and those buttons pass.
- All suites rerun on the changed stylesheets: 1,489 HTTP/D1, 738 contract/checkpoint and 21 restore assertions. Reports in `tests/evidence/slice-6f/`.

## Limits

- The keyboard walk checks reachability and a visible focus style on two screens only. It does not judge focus order, focus traps in dialogs, or contrast of the focus indicator.
- No screen-reader, 200% or 400% zoom, reflow or representative-user review; no independent accessibility review. NFR-13 remains partial.
