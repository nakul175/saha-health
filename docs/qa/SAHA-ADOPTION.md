# Saha adoption of QA v1.3

Start here for this product. [Context](SAHA-CONTEXT.md), [inventory summary](ADOPTION-SUMMARY.json), [task routing](workflow/TASK-ROUTING.md), [checker limits](checker/README.md). The imported generic package remains a reusable reference; PRODUCT-CONTEXT.md is its blank intake and examples are fictional. They are never loaded as Saha execution evidence.

## What is adopted

- Frozen-source register with all271 criteria and original literal oracles/owner links.
- All364 original formal test-case identities and procedures, retaining the twelve shared cross-journey cases.
- Ninety-five additional scenario drafts with stable draft case IDs and scenario links. These are design records, not newly approved formal cases.
- 447 proposed direct AC-to-case mappings:352 requirement-specific formal links plus95 draft links. Twelve shared cases need exact criterion-level mapping review; their original owner links remain visible in [mapping gaps](sources/shared-case-mapping-gaps.json).
- Empty execution/selection/defect-transition/exception registers: no historical unit/browser run is silently promoted into a formal QA pass.
- Existing current routine frozen specification copied byte-exact for scope reference; not inserted into the full-product denominator or changed by this adoption.

The scenario register contains95 proposed scenario designs. It is not a complete deduplicated scenario catalogue for all364 existing formal cases. 459 case-design rows =364 original formal cases +95 additional draft procedures; never call them459 executed or accepted tests.

## Source approval

Source snapshot is exported from the retained planning input (edition4.2 revision4), independently of QA coverage rows, and includes its source-description pins and original wording. It is still an author-generated, unapproved planning export. This section is a locator for that unresolved review, not an approval record.

All271 applicability values are UNKNOWN; all are retained in the denominator. A structural exit0 grants no Ready/Done, acceptance or release. [Source protection](workflow/SOURCE-PROTECTION.md) is NOT_CONFIGURED: the actual main-branch API observation showed protected=false. No human CODEOWNER, ruleset or trusted-source reconciliation was installed by copying a template. Changing external governance requires real policy/permissions; no release reliance until verified. The existing documentation-checks job adds local QA structure/integrity commands; no new job, provider, secret or hosted service is created. Required-check enforcement remains unconfigured and hosted CI outcome is not assumed.

## Known engineering observations

Published routine candidate remains draft PR192. Its actual saved206 unit suites/10,802 assertions passed in their source-bound scope; this is not formal product acceptance. The [published source/NFR binding](sources/BF73-FINALHEAD-NFR-GATE-BINDING.json) preserves:

1. Routine1000-sample p953132.31ms versus unchanged3000ms: FAIL; degraded repeat NOT_RUN.
2. Current authorization63/0; load12passed/3failed,360/400slots, unchanged minimum13: FAIL.
3. New bf73 has no CI runs/checks. [Predecessor791 startup annotations](sources/CI-791-STARTUP-ANNOTATIONS-202610110117.json) show account payment/spending-limit blockage before runner/steps/tests. No new head CI failure or billing resolution inferred.

Aggregate observation receipts are preserved separately; they are not selected as per-formal-case runs. Cases require actual individual scope/build/config/data/oracle/evidence binding before migration. No new application test, fix, formal acceptance, merge or hosting pass comes from this documentation adoption.

## Working order

Select one task and its owning story/criteria -> classify risk -> plan required scenarios and exact targets -> run existing meaningful authorized tests -> retain failures -> fix and rerun affected checks -> review final current-source evidence -> qualified merge under actual checks/approvals -> record observed staging separately. Parent story/epic acceptance requires its own complete gate. Keep existing frozen current-story contracts until a legitimate explicit versioned change; never weaken them to pass.

## Checks

From repository root:

```
python3 -B -m unittest discover -s docs/qa/checker/tests -v
python3 -B docs/qa/checker/verify_saha_adoption.py
python3 -B docs/qa/checker/check_pm_mapping.py --catalogue docs/qa/sources/pm-catalogue.json
python3 -B docs/qa/checker/qa_lint.py --registers docs/qa/saha-registers --root .
python3 -B docs/qa/checker/qa_lint.py --registers docs/qa/saha-registers --root . --release
python3 scripts/check-documentation.py
node scripts/audit-requirements.mjs --check
```

The full-plan structure check is expected to pass; strict release mode must fail on unknown applicability, missing executed qualification and unbound candidate artifacts/config/data. That expected negative gate is not a product defect, a waiver or a Ready claim. Run the actual repository required documentation checks and record results in VALIDATION.md before publication.

## Integrity

Use ADOPTION-MANIFEST.json for the adopted files; MANIFEST.json is historical upstream provenance and may differ for configured registers. Preserve the generic checker/schema and their original hashes. Package and checker validity are separate from external source authority, specialist/human review and product outcomes.
