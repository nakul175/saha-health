# Accessibility statement

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: a new audit, a manual or screen-reader review, or a UI change affecting a covered screen.

**Status: partially evaluated; conformance with WCAG 2.2 is not claimed.** Target: WCAG 2.2 level AA (requirement NFR-13, assessed *partial*, acceptance pending in the [requirement register](../../requirements/traceability.csv)). Saha is a private synthetic workspace, not a public service.

## What has been tested

All evidence is **automated** (axe-core rules tagged WCAG 2.0, 2.1 and 2.2, levels A and AA) on synthetic data in headless Chromium:

| Evidence | Coverage | Result recorded |
| --- | --- | --- |
| [Slice 6e](../current/SLICE-6E-ACCESSIBILITY.md), 30 Sep 2026 | 16 owner and ASHA screens | 271 contrast failures fixed; second run no violations |
| [Slice 6f](../current/SLICE-6F-FIELD-ACCESSIBILITY.md) | 24 screens including the field notebook, phone and keyboard | Fixes recorded in the slice |
| [Slice 6x](../current/SLICE-6X-POPULATED-ACCESSIBILITY.md), 1-2 Oct | 66 populated, empty and error-state screens and dialogs, desktop and 390 x 844, focus-return, live regions | Recorded in the slice |
| [Slice R96](../current/SLICE-R96-ACCESSIBILITY.md), 3 Oct | Visit confirmation, correction dialogs, Hindi workspace (16 scans) | No violations |
| [Slice 11c](../current/SLICE-11C-UI-E2E.md) UI specs | axe (serious and critical) on 25 screens, weekly in CI | 0 violations at last record |

## Known limits (from those slice notes)

- No screen-reader review, no 200% or 400% zoom or reflow review beyond the 390-pixel phone width, no high-contrast or reduced-motion modes, no keyboard-walk or focus-indicator test in the UI suite, and no representative-user or independent accessibility review.
- Automated rules find only part of WCAG; absence of axe violations is not conformance.
- Outreach and referral sub-dialogs were not all covered by 6x.
- The Hindi workspace is a draft translation not reviewed by a qualified translator ([slice 10j](../current/SLICE-10J-HINDI-WORKSPACE.md)).
- Physical-device and field accessibility are unqualified ([Android app note](../current/ANDROID-APP.md)).
- The weekly UI job runs on a schedule and on demand, not on every pull request ([Testing Saha](../current/TESTING.md)); `tests/a11y-audit.mjs` is outside CI.

## Feedback and contact

Report accessibility barriers to nakul.jain@aplyd.com. Response commitment: TBD (owner: Nakul Jain). Formal accessibility statement for any public deployment, and a date for a conformance audit: TBD.
