# Development slice 5i — drift monitoring from shadow comparisons

30 September 2026 (IST). Stacked on slice 5h. Synthetic data only; formal acceptance unchanged. No migration, no new command and no new route.

## What changed

- **Agreement over time per revision.** The governance read (`GET /api/governance`) now gives owners and clinician governance managers, the people who see shadow comparisons (slice 5f), a `drift` report for each capability revision in their scope that has been in shadow. The per-field outcomes of all its shadow operations are grouped into four consecutive 7-day periods ending with the current UTC day, by the date the compared visit was confirmed (or the comparison time if the visit is no longer present). For each period it gives the visits, agreement, disagreement, missing, not recorded by the clinician and unable to assess, the rated fields (agreement + disagreement + missing, the fields with a clinician-confirmed value) and the agreement rate over the rated fields. Visits not run are not counted.
- **Flagged drops.** Between each pair of consecutive periods it gives the change in percentage points and a status: *drop* when the rate falls by more than 10 points, *stable* otherwise, and *insufficient* when either period has fewer than 10 rated fields. A revision is flagged *agreement dropped* when any pair is a drop. Rows with a drop are listed first.
- **Counts only.** The report carries no visit, person or value; it is derived on read from the stored shadow results and nothing new is stored. Nothing is suspended or changed automatically: a governance manager decides, and can place the existing safety hold.
- **Clinical governance page.** Each capability revision's shadow section shows "Agreement over time" with the four periods, their rated fields, rates and changes, the status and how the flag is decided.

## Decisions

- Thresholds are fixed in this slice (7-day periods, four periods, a drop of more than 10 percentage points, at least 10 rated fields per period) and stated on the page; they are not owner-configurable.
- Synthetic evaluations are version-bound single runs (slice 5d), not a series over time, so drift uses shadow comparisons only.
- No operational alert: the operations alerts go to operations staff, supervisors and owners, while drift belongs to governance managers, who see the flag where they review the revision.

## Evidence

- 15 contract assertions (`tests/drift-contract.mjs`): period boundaries; a revision's counts per period by confirmation date, with not-recorded, unable and not-run outcomes; rates; changes of null (insufficient), -8.4 (stable) and -44.8 (drop); the drop status; no visit, person or value identifiers; a drop of exactly 10 points not flagged and one of 20 flagged; nine rated fields insufficient; a rise never a drop; a revision no longer in governance labelled by its key; several shadows of one revision combined and revisions kept apart, drops first; no shadow, no row; the notice.
- 1 more HTTP/D1 assertion in `tests/shadow-smoke.mjs`, and the existing check before any shadow now also expects an empty drift list: after one compared visit the revision's last period shows one visit, two rated fields, one agreement, one disagreement and a rate of 50%, status insufficient, with no visit, person or note text. Totals and first-run results in [VALIDATION.md](../../VALIDATION.md).
- Browser check (headless Chromium, built Worker, synthetic owner and reviewer, the slice 5f scenario): after one shadow comparison the capability's shadow section showed "Agreement over time" with four periods, the current one with one visit, two rated fields and 50%, and "Not enough rated fields to compare"; axe-core found no WCAG A/AA violations in the tab; no console errors. `tests/evidence/slice-5i/drift-browser.json`.

## Limits

- Shadow comparisons in this build come from the local rules provider on confirmed records; the rates are not a validated accuracy measure and say nothing about a live provider on representative data.
- Periods are counted by confirmation date, so a shadow run that processes older confirmed visits fills earlier periods; periods before the four shown are not reported.
- Nothing is delivered: no notification, operations alert or automatic suspension. There is no independent ground truth or adjudication beyond the clinician-confirmed values.
- BR-AI-10 stays partial.
