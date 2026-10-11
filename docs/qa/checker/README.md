# Runnable QA record checker
Python 3.10+; standard library only. Run from any directory; pass register folder and optionally repository root for automated case locators.

```sh
python3 checker/qa_lint.py --registers registers
python3 checker/qa_lint.py --registers examples/lifecycle/registers
python3 checker/qa_lint.py --registers examples/lifecycle/registers --release
python3 -m unittest discover -s checker/tests -v
```

Exit 0 = no detected structural error (or strict release-record error when --release). Exit 1 = invalid records/incomplete strict release-record gate. JSON contains six result counts, freshness, coverage fractions and warnings. The fictional fixture passes structural checks and deliberately fails release mode. Empty adoption registers structurally pass with null denominators and no readiness claim; release mode rejects them.

## Contract
- Exact headers and enum values; unique IDs/versions; duplicate mappings; AC/case/risk/run references; immutable predecessor graph consistency.
- Executed PASS/FAIL must carry build/artifact/config/data/tools/time/executor/protocol/oracle/observation/evidence references.
- Scope selected runs must match the declared candidate, AC and case versions, and use QUALIFICATION purpose. Diagnostic attempts remain history only.
- Explicit in-scope AC inventory supplies the denominator, including unmapped/UNKNOWN criteria. NO requires source/rationale/review. Required NOT_APPLICABLE never validates a YES AC automatically.
- Risk scoring, D1–D4 severity, defect retest closure and approved exception expiry checks.
- `--root` checks AUTO code file/marker presence. It does not execute those tests or validate assertions.
- Local evidence references resolve against configured evidence_root (legacy planning fallback: register folder); HTTPS references are structurally accepted without network/authentication or truth checks. Local anchors are locators only, not semantically parsed. `record:` references produce a review warning because canonical external record identity is not authenticated offline.

## Limits
Offline record validation cannot authenticate source/evidence/approval, discover criteria omitted from the canonical PM source export, enforce append-only history against prior Git versions, evaluate numeric or statistical gates, judge compensating controls, validate all specialist evidence, or grant readiness/deployment. Scope reviewers approve selection and source completeness. Release mode compares the complete AC register to the frozen source export and its count/identity/source-byte pins. Strict release mode enforces current all-required PASS coverage and no open D3/D4 defects; it deliberately does not auto-waive exceptions. The overall release workflow handles eligible authenticated exceptions separately.

## Migration from v1.0
Archive old CSV snapshots. Populate ac-register with the authoritative full denominator (never derive it only from tests). Move run/result/build/evidence out of traceability to immutable run-register records. Create reviewed AC-case mapping IDs and explicit scope/selection. Rename case `version` to `case_version`; normalize CURRENT/STALE/UNASSESSED. Convert severity explicitly; preserve defects as predecessor events. Review actual requirement/run versions before selecting old evidence; missing pins remain unresolved. Update code markers in the same review.

Schema is in standards/register-schema.json; enum authority in standards/statuses.json. Referenced target IDs and narrative hierarchy links still require source review. No PM machine-schema compatibility is asserted.

## v1.2 checks and migration
Set evidence_root, criteria_source_ref, criteria_source_sha256, expected_ac_count, expected_ac_ids_sha256 and criteria_source_review_ref in scope.json. See [criteria source pinning](../workflow/CRITERIA-SOURCE-PINNING.md) and [evidence roots](../workflow/EVIDENCE-ROOT.md). Empty adoption registers remain planning-only; missing source pins block release mode. Add severity_change_rationale and severity_review_ref columns to the defect register. Existing events keep these blank unless they record a severity decrease; unresolved historical downgrades require review before release.

```sh
python3 checker/check_pm_mapping.py
python3 checker/check_pm_mapping.py --catalogue /path/to/installed/catalogue.json
python3 checker/criteria_pin.py --source /path/to/reviewed-criteria-source.json
```

Both severity-downgrade and unrelated-retest bypasses have regression tests. UTF-8 BOMs are accepted. A review reference is required but its authenticity is outside this offline tool's authority. Correcting hashes from the QA rows alone cannot establish the expected source population.

## v1.3 path and governance updates
Absolute evidence roots require explicit --allow-absolute-evidence-root; normal use is package:/repo:/relative configuration. Local references cannot escape the resolved evidence store, use absolute paths, or escape via symlinks. The override affects only the base. See EVIDENCE-ROOT.md for supported examples.

Scope/pin truth remains external: SOURCE-PROTECTION.md and the inactive CODEOWNERS template describe required human review or independent export reconciliation. The checker does not query GitHub or certify that protection; overall release readiness must require actual verified control evidence. 57 regression tests cover the bounded checker contract.
