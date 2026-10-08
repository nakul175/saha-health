## What and why

<!-- One paragraph. Link the slice note or issue. -->

## Checklist (see CONTRIBUTING.md)

- [ ] Branch is from current `origin/main`; this is a draft PR; I did not push to or merge `main`
- [ ] Synthetic data only; no secrets, real patient data, databases or build output committed
- [ ] Applied migrations (`drizzle/*.sql`) are unchanged; any new migration is additive
- [ ] Server-side authorisation unchanged or tested; identity still comes only from `lib/saha/identity.ts`
- [ ] Code change: affected checks run and real results recorded in `VALIDATION.md` with date and limits
- [ ] Documentation change: `python3 scripts/check-documentation.py` and `node scripts/audit-requirements.mjs --check` pass
- [ ] Implementation boundary, requirement assessments, next delivery and evidence updated together (no acceptance case promoted because a related unit test passes)
- [ ] `docs/governance/` documents touched by this change are updated (owner, last-reviewed date)

## Evidence

<!-- Commands run and their results. State what was not run. -->

## Risks and rollback

<!-- Data, privacy, clinical-safety or deployment impact. Rollback is by reverting on main; applied migrations are not reversed. -->
