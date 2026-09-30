# Saha developer handover

Read [AGENTS.md](AGENTS.md), then [the documentation index](docs/DOCUMENTATION-INDEX.md), [implementation boundary](docs/IMPLEMENTATION.md), [next delivery](docs/NEXT-DELIVERY.md), and [qualification](docs/QUALIFICATION.md). These instructions apply to Claude and other developers continuing this repository.

The application baseline is R11 / v1.3-readiness. Documentation edition 1.1 reconciles that implementation to the original BRD and design. It is ready for continued development; it is not accepted for production or real patient use. All 176 formal BRD acceptance criteria remain pending.

- Work from GitHub `main`. On 30 September 2026, at the sponsor's instruction, the stacked release PRs (#1–#6, R7–R11) and development slices (#7–#34, 0a–3f) were merged into `main` without independent human review, followed the same day by development slices and review fixes #36–#70 (3g–6r); agent-run code reviews found defects that #65, #69 and #70 fix, but no person has reviewed any of it; `main` is not accepted for production or real patient use. Publish new work through a branch and draft PR into `main`. Do not force-push `main`.
- Use current source and `docs/current/` for implemented contracts. `docs/history/v1.0/` and `docs/reference/` describe the preserved target design. Their PostgreSQL SQL, 74 proposed REST operations, role catalogue and prototype are not the current runtime.
- Keep application authorization on the server. Owner authority does not override patient scope. The Sites dispatcher supplies identity; never expose a worker that trusts public identity headers directly.
- Preserve confirmed records, revisions, audit, receipts, applied migrations and legacy source. Corrections append evidence; uncertainty never authorizes a blind external retry.
- Keep secrets, real patient data, databases, dependency/build output and recovery artifacts out of Git. Use synthetic fixtures. Do not turn on providers, message real recipients or deploy a Site merely because a documentation update is complete.
- For code changes, run the affected checks and update release evidence honestly. For documentation changes, run `python3 scripts/check-documentation.py` and `node scripts/audit-requirements.mjs --check`. Historical results must retain their original dates and limitations.
- Update the implementation boundary, exact requirement assessments, next delivery and evidence together. Do not promote a whole acceptance case to passed merely because a related unit assertion passes.

Setup, safe test commands and module ownership are in [Development and CI](docs/current/DEVELOPMENT-AND-CI.md). Finish one reviewable slice, commit it, publish it to GitHub and verify the resulting tree, following AGENTS.md.
