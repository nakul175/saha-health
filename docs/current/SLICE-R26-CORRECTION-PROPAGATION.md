# Development slice R26 — correction propagation: recomputed shadow comparisons and released figures, follow-up source links

3 October 2026 (UTC). Builds on slices 2j, 5f, 6d and 6ad. Synthetic data only; formal acceptance unchanged. No command, route or migration is added; the route count and certified patient-command count are unchanged.

## Integration of #144 (3 October 2026, IST)

An agent review of the 15-slice integration found that nothing recomputed what this slice marked recomputed: `recompareShadow` has no caller, the shadow summary and `drift.ts` count every compared result, and a figure already released is never recalled. A task closed as `recomputed` would therefore have hidden work a person still had to do. The integration keeps `recompareShadow`, `affectedReleases`, the source links and the split fold, and changes two outcomes back:

- A shadow comparison of an amended or voided visit is an **open review task** again (`action: review`), with the visit it scored as its source and an instruction to exclude or note it in Clinical governance. It carries no `output.recomputed`.
- The indicator-releases task stays **open for review** when any release was recorded since the visit's confirmation (the affected figures are still marked on it), and asks a person to decide whether a reissued figure is needed; with no release since confirmation it is recorded as done.

Slice 13c ([corrected shadow comparisons recomputed on read](SLICE-13C-SHADOW-RECOMPUTE.md)) then wired `recompareShadow` into the shadow and drift reports, so a shadow comparison task is again recorded as recomputed or invalidated, as built here. The sections below describe the slice as built; where they say "recomputed" for these two outputs, the paragraph above applies. Both contracts were updated (correction tasks: 13 checks, 15 open tasks; R26: 8 checks).

## What changed (as built)

`lib/saha/correction-tasks.ts` (BR-DATA-06) now recomputes two downstream outputs that slice 2j only flagged for review, and links the sources of two more. External outputs are still never corrected automatically: the manual-with-evidence rule (verified correction receipt or a reason) is unchanged.

- **Shadow comparisons are recomputed, not reviewed.** When a confirmed visit is amended, a shadow comparison that scored the assistant against the earlier facts is recorded as `recomputed` (`state: done`, `action: recomputed`) instead of a review task: the stored assistant output is re-derived against the corrected facts once the correction visit is confirmed, and until then the earlier comparison is excluded from shadow and drift counts. When the visit is voided (wrong patient), the comparison is `invalidated`. The task records the recompute outcome (`output.recomputed`) and the visit it scored; the governance record is never rewritten from a patient-scoped commit. `lib/saha/shadow.ts` gains `recompareShadow`, the pure re-derivation (follows the amendment chain, invalidates a voided or gone visit), which the new contract test exercises directly.
- **Released indicator figures are recomputed and marked affected.** The indicator-releases task is now `recomputed` (`state: done`) with every affected figure marked on the task (`output.releases`: the release's time and hashed series key, never a cell value). `lib/saha/indicators.ts` gains `affectedReleases`, which selects the releases recorded at or after the visit's confirmation — the only identity the differencing ledger keeps, since it stores hashed series and cells with no patient link. Nothing in the organisation-wide ledger is rewritten by a patient-scoped correction.
- **Referral and follow-up tasks link their sources.** A referral task names the source that ties it to the corrected visit (its own visit, or a linked visit/protocol/episode source). A follow-up task names its episode and any visit whose programme capture includes that episode, so a concrete dependant is told apart from the previous "possible dependant" heuristic.
- **Internal outputs past the task cap are recomputed where safe.** Slice 6ad folded internal outputs past the 60-task cap into one review task per kind. Slice R26 splits that fold: outputs the server already recomputes or invalidates (`state: done`) fold into one `done` task per kind (recomputed, no review), and only the open ones fold into one review task per kind — so nothing that needs a person's judgement is silently dropped, and nothing that does not is kept open.
- **Open correction tasks expose their source links.** `openCorrectionTasks` returns, per open task, its resolved follow-up/referral source links (kind, reference id, visit id and a display label).

## Evidence

- New `tests/r26-correction-propagation-contract.mjs`, 8 checks: shadow comparison recomputed for an amendment and invalidated for a void; `recompareShadow` chain-following and invalidation; `affectedReleases` selection; the indicator-releases task marks the affected figures with no cell leak; follow-up and referral source links; `openCorrectionTasks` source links; the recomputed fold of already-done outputs past the cap; and that external corrections are still never sent automatically.
- `tests/correction-tasks-contract.mjs` assertions updated for the changed behaviour (the shadow-comparison and indicator-releases tasks are now `recomputed`/`done`, so the open-task counts drop from 15 to 13; check 3 gains the recompute outcome and a source-link check 3b). It passes 13 checks.
- Regressed suites that touch the same modules pass unchanged: shadow (55), drift (15), indicators (9). `tsc --noEmit` passes clean.
- Reports in `tests/evidence/r26/`.

## Limits

- A patient-scoped correction still cannot write the organisation-level governance record or the differencing ledger, so "recompute" and "mark affected" are recorded on the correction task (and re-derived on read) rather than applied in place. The shadow and drift reports themselves do not yet re-run `recompareShadow`; that read-path change is left for a follow-up.
- The affected-figure mark uses the release's time and hashed series key only; a release has no patient link, so the mark is a "released at or after confirmation" heuristic, exactly as the slice 2j count was.
- Follow-ups still do not record the visit that created them; the episode and capture-visit link is the best available source, and a follow-up with neither falls back to the "possible dependant" wording.
- Corrections made before this slice keep their original tasks; nothing is backfilled. Task reassignment, notification and a unified identity-merge/correction reconciliation view remain open (R27).
- Wiring `recompareShadow` into the shadow summary and drift report was left for a follow-up; slice 13c did it.
- These changes have not been independently reviewed. BR-DATA-06 keeps its status; its text and evidence are updated.
