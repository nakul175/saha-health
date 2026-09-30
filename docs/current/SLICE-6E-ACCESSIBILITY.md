# Development slice 6e — automated accessibility audit and contrast fixes

30 September 2026 (IST). Part of slice 6 (accessibility). Synthetic data only; formal acceptance unchanged.

## What changed

- **Repeatable audit.** `tests/a11y-audit.mjs` drives a running local Worker in headless Chromium as a synthetic owner and a synthetic ASHA, opens 16 screens and dialogs, and runs every axe-core rule tagged WCAG 2.0, 2.1 or 2.2 level A or AA on each. It writes a report with the rule, impact, node count and first targets per screen.
- **Screens covered.** Owner: home, people, patient record, household and proxies, identity and merges, rights requests, ABHA and consent, care handover, operations, organisation and team, connections. ASHA: home, my work, patient record, a started visit, care handover.
- **Contrast.** The first run found one failing rule, `color-contrast`, on all 16 screens (271 elements); every other A/AA rule passed. Secondary text, table headings, tags, captions, audit lines, footer text and inactive tab labels were darkened to at least 4.5:1 against their own background (`app/globals.css`). Light text on the dark sidebar was left as it was, because it already passed. The second run found no violations.

## Running it

The audit is not part of CI because Playwright and axe-core are not project dependencies. To repeat it, install `playwright` and `axe-core` in a separate directory, start a built Worker, then run:

```
SAHA_A11Y_MODULES=<directory with node_modules> SAHA_A11Y_CHROMIUM=<chromium executable> node tests/a11y-audit.mjs
```

`SAHA_A11Y_ORIGIN` defaults to `http://127.0.0.1:8790`; `SAHA_A11Y_OUT` defaults to `tests/a11y-audit-result.json`.

## Evidence

- Before: `tests/evidence/slice-6e/a11y-audit-before.json` — axe-core 4.13.0, 16 screens, 271 `color-contrast` nodes, no other violations.
- After: `tests/evidence/slice-6e/a11y-audit-result.json` — 16 screens, no violations.
- The first contrast pass also darkened two sidebar captions that were already passing on the dark background, making them fail (38 nodes on the second run). They were restored and inactive tab labels were fixed; the third run was clean.
- All suites rerun on the changed stylesheet: 1,487 HTTP/D1, 618 contract/checkpoint and 21 restore assertions. Reports in `tests/evidence/slice-6e/`.

## Limits

- Automated rules find only part of WCAG. No screen-reader, keyboard-only, 200% or 400% zoom, reflow or representative-user review was done, and no independent accessibility reviewer was involved. NFR-13 remains partial.
- Not covered by this audit: the field notebook, visit confirmation and correction dialogs, referral, outreach, programme, EHR, retention, roster and indicator panels in their populated states, error and empty states, and mobile viewports.
- Hindi screens were not audited.
