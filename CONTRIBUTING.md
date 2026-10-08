# Contributing to Saha

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: a change to [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md) or the CI workflows. Those files are the authority; this page summarises them.

Read first: [HANDOVER.md](HANDOVER.md), [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), [documentation index](docs/DOCUMENTATION-INDEX.md), [implementation boundary](docs/IMPLEMENTATION.md) and [Development and CI](docs/current/DEVELOPMENT-AND-CI.md).

## Workflow

1. Branch from current `origin/main`. Never push to, force-push or merge `main`; only the sponsor merges.
2. Finish one reviewable slice, commit it, push the branch and open a **draft** pull request into `main`. Check the remote branch first and preserve concurrent work.
3. Describe real evidence in the PR using the [template](.github/PULL_REQUEST_TEMPLATE.md).

## Rules that apply to every change

- Synthetic data only. Do not turn on providers, message real recipients or deploy because a change is finished.
- Keep application authorisation on the server. Identity comes only from `lib/saha/identity.ts`. Owner authority does not override patient scope.
- Preserve confirmed records, revisions, audit, receipts, applied migrations (`drizzle/`) and legacy source. Corrections append evidence; uncertainty never authorises a blind external retry.
- Keep secrets, real patient data, databases, dependency and build output out of Git. `.env.example` lists names only.
- Do not edit `docs/history/` or `sources/`.

## Checks

| Change | Run |
| --- | --- |
| Documentation | `python3 scripts/check-documentation.py` and `node scripts/audit-requirements.mjs --check` |
| Code | Type check (`node node_modules/typescript/bin/tsc --noEmit`), `npm run build`, `node scripts/security-gate.mjs`, and the affected suites from `npm test` / [Testing Saha](docs/current/TESTING.md) |

Record code results, with date and limits, in [VALIDATION.md](VALIDATION.md). Update the implementation boundary, requirement assessments, next delivery and evidence together; do not promote a whole acceptance case because a related unit assertion passes.

## Design changes

Material choices follow the [design and RFC process](docs/governance/DESIGN-AND-RFC-PROCESS.md) and are recorded as dated decisions ([architecture decisions](docs/current/ARCHITECTURE-DECISIONS.md)).

## Reporting security issues

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).
