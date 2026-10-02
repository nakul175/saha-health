# Development slice 6x — accessibility of populated panels, error states and dialogs

1–2 October 2026 (UTC; 2 October IST). Part of slice 6 (accessibility). Synthetic data only; formal acceptance unchanged.

## What changed

- **Wider audit.** `tests/a11y-audit.mjs` now covers 66 screens, up from 24. A second synthetic owner and ASHA work in their own organisation, seeded through the command API: supervisor sign-off required, Meena Devi assigned to the ASHA, two confirmed visits (one voided as recorded against the wrong person), a referral to Synthetic CHC with an overdue urgent due date, a TB programme enrolment, an outreach plan, a legal hold, and a critical incident. In the browser the audit stages the synthetic example pack and previews a one-row roster. It then audits, at desktop size and at 390 × 844, the populated home, patient record (referral tracker, action plan, EHR and programme panels), visit review with sign-off, operations (exception queue, indicators, incidents), care handover with worker activity expanded, outreach, programmes, organisation (retention, roster preview, pack installation), the open alert notifications, and the ASHA's home, my work and patient record. The audit checks that the seeded content shows on each of these screens and records the result in `populatedProbes`.
- **Empty states.** The first owner's organisation has no referrals, outreach, follow-ups or incidents. The audit now also opens its outreach, programmes, clinical governance, pilot readiness, expansion, submissions, AI tools, my work and empty pack installation screens.
- **Error states.** In the browser, `page.route` makes one command come back as a refusal (409) and makes reads fail with 503. The Worker is not changed. The audit covers the refused command, the patient record, operations and organisation with their reads failing, and the whole-workspace failure screen at both widths. It checks that each error message is inside a live region (`aria-live`, `role=status` or `role=alert`).
- **Keyboard checks.** The audit opens eight dialogs and disclosures from the keyboard: four patient dialogs, Plan outreach, Add person, the alert notifications list and the phone navigation sheet. Each must take focus, keep it through 25 Tab and 6 Shift+Tab presses (modal dialogs only), close on Escape, return focus to the control that opened it, and have an accessible name. On five populated screens it also walks the Tab order and checks that it follows document order, with no positive `tabindex`.

## Fixes

- **Focus return after dialogs.** Radix returns focus on close only to its own `Trigger`. Saha opens dialogs from ordinary buttons, so after Escape or Close, focus fell to the page body on every dialog and on the phone navigation sheet. `components/ui/return-focus.ts` now records the focused element when a dialog, alert dialog or sheet opens and returns focus to it on close. A caller's own `onCloseAutoFocus` still takes precedence.
- **Scrollable tables.** On the phone, wide tables in operations, outreach, the indicator registry and organisation scroll sideways but could not be reached by keyboard (axe `scrollable-region-focusable`, 7 nodes on 5 screens). The shared `Table` container becomes a focusable, named region only while it overflows, and it shows the existing focus outline.
- **Announced errors.** The workspace failure screen and the clinical review panel's read errors now use `role="alert"`. Before the fix, neither was announced.
- **Submissions tabs.** The "All submissions / Needs attention" tabs pointed `aria-controls` at panels that did not exist (axe `aria-valid-attr-value`, critical). The list is now the tab panel both tabs control.
- **Contrast.** Success toasts measured 4.25:1. The library's light-theme success, info, warning and error toast text colours were darkened to at least 4.5:1 (its defaults measure 3.1 to 4.4:1). Primary buttons faded to 4.08:1 on hover; they now darken instead.

## Evidence

- First run: `tests/evidence/slice-6x/a11y-audit-first-run.json`. It used the first version of the new checks. The Tab-order check reported the wrap from the last control back to the first as out of order on four screens, and the live-region check counted text inside inline scripts. Both checks were corrected before the "before" report.
- Before: `tests/evidence/slice-6x/a11y-audit-before.json`, from the corrected checks on the unchanged UI. 66 screens, 10 axe-core nodes in three rules: `scrollable-region-focusable` 7 nodes on 5 phone screens, `color-contrast` 2 (success toast, hovered primary button), `aria-valid-attr-value` 1 (submissions tabs). 7 of 8 dialog checks failed focus return (the alert disclosure passed). 3 live-region checks failed: the workspace failure and the clinical review error were not announced. One screen, phone care handover, did not run: the audit looked for the worker-activity heading before the panel had rendered and fell back to the desktop navigation, which is hidden on a phone. The audit now waits up to five seconds for a panel heading, scrolls to the top before opening the navigation sheet, and retries the sheet once.
- Two intermediate runs after the fixes, not kept, found no axe-core violations and passed every keyboard and live-region check. The second hit the phone care-handover timing problem again, and its operations probe looked for the incident title, which the Operations page does not show. The probe now looks for the computed alert, "Critical incidents not resolved".
- After: `tests/evidence/slice-6x/a11y-audit-result.json`. 66 screens with no axe-core violations and no screen errors. All 8 dialog checks, all 5 Tab-order checks and all 4 live-region checks pass. Every walked focus stop shows a visible indicator. All 20 content probes found the seeded content on the populated screens (`populatedProbes`).
- The Tab-order check lists one backward vertical move per walk for review, from "Organisation & team" to the organisation selector in the sidebar footer. It comes from the measurement: the footer sits outside the scrolled navigation list. It is not a failure.

## Running it

The audit stays outside CI because Playwright and axe-core are not project dependencies. To repeat it, install `playwright` and `axe-core` in a separate directory and start a built Worker with fresh local state. Then run:

```
SAHA_A11Y_MODULES=<directory with node_modules> SAHA_A11Y_CHROMIUM=<chromium executable> SAHA_A11Y_ORIGIN=http://127.0.0.1:<port> node tests/a11y-audit.mjs
```

The run takes about three and a half minutes and writes `tests/a11y-audit-result.json`; set `SAHA_A11Y_OUT` to write elsewhere. It creates synthetic accounts, an organisation and records on the Worker it runs against. Run it only against a local synthetic Worker, never against hosted staging.

## Limits

- Automated checks cover only part of WCAG. The keyboard checks confirm that a trap exists, that Escape works, that focus returns and that the Tab sequence follows document order. They do not judge whether the order makes sense to a person, whether announcements are well worded, or whether the 503 screens offer a usable way to recover.
- The error states are simulated in the browser. A Worker that really refuses a command or fails may send other messages.
- With reads failing, the operations screen showed no error message in these runs. The audit records "no error message rendered" for it and does not count it as a pass or a failure. Whether operations should say that some of its reads failed was not reviewed.
- Not covered: visit confirmation and correction dialogs, every outreach and referral sub-dialog, Hindi on the main workspace, high-contrast and reduced-motion modes, and 200% and 400% zoom or reflow beyond the 390-pixel phone width.
- No screen-reader, zoom or representative-user review was done, and no independent accessibility reviewer was involved. NFR-13 remains partial.
