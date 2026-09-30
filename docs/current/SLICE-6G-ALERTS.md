# Development slice 6g — computed operational alerts

30 September 2026 (IST). Part of slice 6. Synthetic data only; formal acceptance unchanged.

## What changed

- **Alert rules 1.0.0** (`lib/saha/alerts.ts`). Every operations read now includes alerts computed from data the viewer may already see:
  - programme submissions and EHR publications without a final receipt (high; operations; look up, never resend blindly);
  - referrals past their due date (high; supervisors), follow-ups past their due date and open referrals without a due date (normal; supervisors);
  - provider calls without reported usage (normal; operations);
  - a 24-hour server error rate above 5% over at least 20 requests (critical; operations);
  - unresolved critical incidents (critical) and other unresolved incidents (normal; operations);
  - the organisation paused for maintenance (high; operations).
- Each alert names the owning role, the count, and the next safe action. They are ordered by severity and then count.
- **Scope.** Supervisors see alerts from their scoped report only; administrators see service and incident alerts but no clinical backlog; owners see both.
- **Operations page.** An Alerts section above the tabs lists each alert; "Show details" opens the tab holding the evidence.

## Evidence

- 14 contract assertions (`tests/alerts-contract.mjs`): quiet data raises nothing; every rule; resolved incidents excluded; ownership and actions; ordering; error-rate thresholds (19 requests, exactly 5%, above 5%, no traffic); supervisor and administrator scope.
- 4 HTTP/D1 assertions in the operations suite: rule version and arrays present; supervisor and administrator alerts scoped; an open incident raises `incident-open` for operations; a resolved incident raises nothing.
- Browser check (headless Chromium): a critical incident appeared as a critical alert, and "Show details" opened "Service & incidents"; no console errors. The accessibility audit still reports no violations on 24 screens. `tests/evidence/slice-6g/`.
- All suites: 1,493 HTTP/D1, 754 contract/checkpoint and 21 restore assertions.

## Limits

- Alerts are computed when the page is read. Nothing is pushed, paged, emailed or messaged, and there is no acknowledgement or snooze. The five-minute detection target in NFR-18 is not met, and there are no approved response targets. BR-OPS-04 and NFR-18 remain partial.
- Thresholds are engineering defaults. Alerts do not yet link to individual tasks, provider calls or receipts; they point to the tab that lists them.
