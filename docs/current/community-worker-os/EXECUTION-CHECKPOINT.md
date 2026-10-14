# Execution checkpoint — 9 October 2026

This additive record preserves D01-D08 and issue IDs #174-#181 from planning PR #173. It does not replace their definitions or close any original requirement.

## Source integrity

[cwo-links.tsv](cwo-links.tsv) adds all 32 CWO primary/related mappings and outcomes to the existing 160-item [scope.tsv](scope.tsv). [new-criteria.tsv](new-criteria.tsv) retains the 95 numbered source criteria verbatim, each with one canonical owner. The original 176 requirements and acceptance clauses remain unchanged in requirements/brd-v1.1.json. The complete earlier narrative artifacts remain in the previously supplied v0.2 ZIP, not silently represented by shortened titles here.

Command: `python3 docs/current/community-worker-os/verify-source.py`. Local result: 10 checks passed, zero failed. Checks verify source blob identity, ownership, counts, aliases and exact mapping/criterion bytes. This is planning/source integrity, not an application or acceptance test.

## D01: original-source baseline actually executed

GitHub Actions run 37920175452 completed successfully against pinned original source 43f445acf4c54352cd2084e0bcd88bfbf605d757. The observed job passed documentation/requirement integrity, catalogue, dependency installation, lint ratchet, type check, build, security gate, existing unit suites and the selected existing HTTP/database and recovery suites. The workflow's final guard requires every selected check to pass. Evidence is in the run and its baseline-results artifact.

This is a bounded original-source engineering baseline, not the entire regression suite, a candidate feature qualification, formal 364-case acceptance, physical-device evidence or a production/clinical assessment. It does not establish that all 160 scope items work. Native git access in this container failed with DNS resolution; the authorised GitHub runner supplied the actual execution environment. The broader pre-existing regression issue is separately retained in #183.

## D02/D03: integrated candidate is PR #184

Continue implementation in PR #184, branch feat/worker-day-2026-10-09. The opt-in /app?experience=worker-day interface supplies Today, People and My Space inside the existing protected app. It reuses the current scoped work list, audited record open, dirty-navigation protection and guided capture/save. It adds no database, role, clinical rule, approval chain or provider. Default /app and other environments/roles remain unchanged.

At 4e012f87d1bebaa2530fee0eb6d82b5fd8b420c6, the raw results of run 37922392180 showed integrity, dependencies, build, browser installation, 16 pure checks and the security gate passed. The combined lint/type step failed on one new set-state-in-effect lint finding, so its type command did not execute. The browser fixture failed on its person-context transition after six checks. The selected existing integration/recovery run was cancelled. These failures remain in artifact 11612598876; continue-on-error step conclusions are not passing outcomes.

The subsequent committed repair f6d97894304a35d0b755a21915bf42049e4f2c41 introduces a useSyncExternalStore subscription for the explicit browser opt-in and updates the test to await context visibility and use the existing observation/save selector. Source inspection establishes those changes, not their runtime acceptance. The final repaired-source runs returned action_required when checked; passing runs of an earlier commit cannot qualify the repair. D02/D03 remain open and the exact repaired-source build/lint/type/browser/save evidence is still required before accepting the slice. Check the current PR results for later evidence.

## Superseded read-only alternative: PR #182

PR #182 is closed without merge and superseded by #184. Its branch and evidence remain; it does not constitute a second active implementation. It supplied a read-only /worker-today/ entry. At 1090093, 25 presentation-adapter checks passed; run 37921804531 found a 200% text-reflow failure. CSS correction 18e7fa9 retained the assertion, and mocked-API preview run 37922450544 passed. Generated coverage-document drift and broader supply-chain-gate failures remained recorded for that alternative. These results do not qualify the integrated PR #184.

## Publication boundary

Planning PR #173 and integrated feature PR #184 remain draft. No main merge, DigitalOcean inspection/update, migration, timer change, provider activation or real-recipient contact occurred. Conversation, Academy, unified offline operation and full ASHA validation remain future delivery work. No whole parent requirement, clinical case or original acceptance case is closed by a partial entry/save witness. The end-to-end Today-to-saved-visit milestone remains in progress.
