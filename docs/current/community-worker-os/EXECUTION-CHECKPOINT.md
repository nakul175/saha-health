# Execution checkpoint — 9 October 2026

This additive record preserves D01-D08 and issue IDs #174-#181 from planning PR #173. It does not replace their definitions or close any original requirement.

## Source integrity

[cwo-links.tsv](cwo-links.tsv) adds all 32 CWO primary/related mappings and outcomes to the existing 160-item [scope.tsv](scope.tsv). [new-criteria.tsv](new-criteria.tsv) retains the 95 numbered source criteria verbatim, each with one canonical owner. The original 176 requirements and acceptance clauses remain unchanged in requirements/brd-v1.1.json. The complete earlier narrative artifacts remain in the previously supplied v0.2 ZIP, not silently represented by shortened titles here.

Command: `python3 docs/current/community-worker-os/verify-source.py`. Local result: 10 checks passed, zero failed. Checks verify source blob identity, ownership, counts, aliases and exact mapping/criterion bytes. This is planning/source integrity, not an application or acceptance test.

## D01: original-source baseline actually executed

GitHub Actions run 37920175452 completed successfully against pinned original source 43f445acf4c54352cd2084e0bcd88bfbf605d757. The observed job passed documentation/requirement integrity, catalogue, dependency installation, lint ratchet, type check, build, security gate, existing unit suites and the selected existing HTTP/database and recovery suites. The workflow's final guard requires every selected check to pass. Evidence is in the run and its baseline-results artifact.

This is a bounded original-source engineering baseline, not the entire regression suite, a candidate feature qualification, formal 364-case acceptance, physical-device evidence or a production/clinical assessment. It does not establish that all 160 scope items work. Native git access in this container failed with DNS resolution; the authorised GitHub runner supplied the actual execution environment.

## D02: first candidate

PR #182 adds an opt-in read-only /worker-today/ entry over the existing scoped workspace, linking to the current protected /app patient journey. It does not replace capture/save, create a database, change default navigation or activate a provider. Conversation, Academy and unified offline operation remain future delivery slices.

At 1090093, 25 new presentation-adapter checks passed. A real-Chromium CI test found a 200% text-reflow failure; the original failure is retained in run 37921804531. The CSS correction at 18e7fa9 keeps the failing assertion unchanged; the preview workflow then passed in run 37922450544. Those browser tests mock the workspace API and are not built-backend or handset proof.

The first candidate's broader CI also reported generated coverage-document drift and a supply-chain-gate failure; full checks and registration of added runtime/test files remain release blockers. No claim is made that the full candidate CI is green. Inspect the latest PR checks rather than promoting it from the passing preview job.

## Publication boundary

Both PRs remain draft; main is unchanged by this work. No DigitalOcean inspection/update, migration, timer change, provider activation or real-recipient contact. The end-to-end Today-to-saved-visit milestone remains in progress. Do not close D02 or parent scope from the read-only entry checks alone.
