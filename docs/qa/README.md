# APLYD Software Testing & Quality Assurance Package
Version 1.3 • 11 October 2026 • reusable Markdown edition

Start with [ADOPTION-CHECKLIST.md](ADOPTION-CHECKLIST.md), complete [PRODUCT-CONTEXT.md](PRODUCT-CONTEXT.md), then use [MASTER-PROMPT.md](MASTER-PROMPT.md). Copy this folder into `docs/qa/` in the product repository. Merge the testing instructions into the repository's existing AGENTS.md; do not replace its other instructions.

This package supplies a testing operating system, not an assessment of APLYD's current product. APLYD's stack, users, scope, owners, environments, targets and regulatory obligations have not been established. Initial cases are fictional and NOT_RUN. The lifecycle fixture contains explicitly fictional PASS/FAIL observations for checker demonstrations, not product evidence. No product tests were executed to create this package.

## Navigation
- [Testing standard](standards/TESTING-STANDARD.md): authority, lifecycle and evidence rules.
- [Risk classification](standards/RISK-CLASSIFICATION.md): risk-based depth and gates.
- [Traceability](workflow/TRACEABILITY.md): vision → roadmap → release → epic → story → acceptance criteria → technical task → test → execution → defect → decision.
- [Linear/GitHub workflow](workflow/LINEAR-GITHUB.md): planning records, implementation and evidence.
- [Quality gates](workflow/CI-CD-GATES.md), [release readiness](workflow/RELEASE-READINESS.md), [reporting](workflow/REPORTING.md).
- `domains/`: functional/API/E2E, AI/ML, security/privacy, accessibility, performance, reliability, test data.
- `templates/`: strategy, release plan, scenario, case, evidence, defect, risk, AI evaluation, exception, release decision, report, data/environment, exploratory charter and provisional target.
- `examples/`: filled illustrative cases plus a synthetic full lifecycle fixture; no authentic product execution.
- `registers/`: empty CSV registers, usable in any editor or spreadsheet.
- [File tree](FILE-TREE.md), [references](REFERENCES.md), [change log](CHANGELOG.md).

## Operating loop
1. Establish scope, authoritative requirement revisions and owners.
2. Classify risk and applicability; resolve unknowns needed for the current decision.
3. Plan observable acceptance, test coverage and measurable thresholds before execution.
4. Implement the smallest meaningful tests, execute on an identified build, retain evidence.
5. Triage failures; fix and rerun affected tests; update traceability.
6. Assess release gates and obtain the actual decision owner's approval.
7. Observe rollout, incidents and user outcomes; feed learning back into roadmap and vision.

Product documentation completeness is separate from implementation correctness. A completed template is neither passing evidence nor release permission. This package complements the prior generic product-management framework and its shared readiness/completion and AI assurance records; it does not replace their schemas or executable checker.

## v1.1 adoption
Start with [task routing](workflow/TASK-ROUTING.md). Use the Low-tier fast path for eligible small changes; full release ceremony belongs to release work. See [checker commands/limits](checker/README.md), [typed statuses](standards/STATUS-MODEL.md), [provisional targets](standards/PROVISIONAL-TARGETS.md), [PM integration](workflow/PM-INTEGRATION.md), and [fictional full lifecycle](examples/lifecycle/RECORDS.md).

**Breaking CSV change:** traceability is links-only, AC inventory supplies the denominator, runs are immutable and selected explicitly for a scope snapshot. Follow checker migration instructions. Keep examples outside live registers.

## v1.2 release integrity
[Canonical criteria pins](workflow/CRITERIA-SOURCE-PINNING.md) now protect the denominator; [evidence roots](workflow/EVIDENCE-ROOT.md) support relocated registers. Defect severity decreases require reviewed rationale; closure requires the same case and candidate. PM fields, aliases and gate prefixes are validated separately. Checker regression suite: 57 tests. No product results or approvals are authenticated by this package.

## v1.3 adoption boundary
Local evidence references now remain inside the evidence root, including symlink resolution; absolute roots are rejected by default. See [source protection](workflow/SOURCE-PROTECTION.md) and the inactive [GitHub ownership template](adoption/github/CODEOWNERS.template). Real repository enforcement must be configured and verified before release reliance; no live protection was installed by building this ZIP.
