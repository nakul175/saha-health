# Pinning the acceptance-criteria population
The QA denominator must match the complete, independently reviewed PM scope snapshot. A count alone misses substitutions; a hash alone without an independent source is self-attestation. Pin both to an actual source export.

## Export and review
1. Export **all in-scope ACs** from the canonical PM release-goal/scope, including not-applicable and unresolved items, as a local JSON snapshot shaped like templates/criteria-source.json. Each record contains ac_id, ac_version and YES/NO/UNKNOWN applicability. Do not derive the export from tests, coverage links or the QA register.
2. Record source_id, source_version, scope_id and review_ref. The responsible source owner reviews completeness and applicability. Store the snapshot and review in the controlled evidence store; freeze them independently of implementation changes.
3. Set scope.json criteria_source_ref (relative to evidence_root), criteria_source_sha256 (exact file-byte hash), expected_ac_count (all records), expected_ac_ids_sha256 (canonical identity-set hash), and criteria_source_review_ref. Use the helper below to calculate pins from the reviewed export.
4. Populate ac-register separately and run the checker. A missing/substituted AC/version, duplicate, changed applicability or mismatched source digest blocks the release-record gate.

```sh
python3 checker/criteria_pin.py --source /absolute/path/to/reviewed-criteria-source.json
```

The helper prints candidate pin values and does not write scope.json or approve the source. Review and bind the frozen values to the real scope record before qualification.

Hash algorithm: sort the list of [ac_id, ac_version] pairs lexicographically; serialize with JSON ensure_ascii=False and separators=(',', ':'); SHA-256 over UTF-8 bytes, with no trailing newline. Count includes YES/NO/UNKNOWN. Identity versions and complete source-byte hashing prevent substitution and applicability drift. Renaming, adding, removing or changing applicability requires an approved new source version and pins; affected results become stale.

## Trust boundary
The checker verifies consistency with the supplied snapshot/pins. It cannot discover criteria omitted from the canonical export, authenticate source-owner authority, or stop someone who can maliciously change both the source and its approved pins. Protect source snapshots/pins through existing reviewer-controlled changes or an externally administered approval service; require an independent review for changes. A locally typed review name/path is not proof of approval. Do not claim source completeness or release approval from checksum consistency alone.

For planning, an unconfigured source can remain unresolved and reporting stays advisory. Release mode requires the snapshot and valid pins. Mandatory ACs must remain in the export; NOT_APPLICABLE/NO requires actual scope-covering evidence and review.

## Enforced adoption control (v1.3)
Before relying on the register gate for real release decisions, follow SOURCE-PROTECTION.md: configure actual required human CODEOWNER review of source/pins and their validation controls, or independent trusted CI reconciliation. Complete source-protection-verification with real configuration and safe-PR evidence. The supplied inactive template and a report exit 0 do not install or prove enforcement.
