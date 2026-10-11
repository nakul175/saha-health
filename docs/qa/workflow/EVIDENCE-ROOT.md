# Portable, confined evidence roots
Set evidence_root in scope.json so references keep the same approved store when registers move. The checker prints resolved_evidence_root and the full attempted path on an invalid local reference. CSV accepts UTF-8 with/without BOM and CRLF/LF.

Default portable bases:
- `package:examples/lifecycle` anchors to the QA package. The fixture uses it; moving registers alone stays valid.
- `repo:docs/qa/evidence` anchors to the product repository passed with --root.
- A relative directory (for example `../evidence`) resolves from scope.json's directory. Relocation may require an override.

```sh
python3 checker/qa_lint.py --registers copied-registers --evidence-root package:examples/lifecycle
python3 checker/qa_lint.py --registers docs/qa/registers --root . --release
```

Absolute evidence_root settings and overrides are rejected by default because they are machine-specific. An approved machine-local mount may be explicitly enabled using --allow-absolute-evidence-root; the report warns it is not portable. This option allows the base only, not absolute references or reference escape.

Every local source/evidence/review/procedure reference must use forward-slash relative paths inside the resolved root. Absolute paths (including Windows drive paths), traversal outside the store and symlink escapes are rejected. package:/repo: roots cannot escape their anchors. Absolute references inside the store are also rejected: use their portable relative equivalent. Resolution is a point-in-time offline check; use an immutable approved evidence store during assessment rather than a concurrently changing directory.

AUTO automation_locator remains repository-relative under --root. HTTPS and record: references remain external identifiers with authenticity warnings; they are not local file access and the tool does not fetch them. Canonical criteria source must be a local confined snapshot for offline hashing. Moving the whole store changes the configured base, not each CSV reference. Legacy planning mode has register-relative fallback; release mode requires an explicit base.
