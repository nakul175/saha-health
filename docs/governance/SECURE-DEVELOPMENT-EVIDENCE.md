# Secure development and supply-chain evidence

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: a CI workflow change, a new gate, or a review result. Only list evidence that exists; link, do not copy.

**Agent-drafted index of existing evidence on 2026-10-08. Not an audit. No certification is claimed.**

| Practice | Evidence in the repository | Strength / limit |
| --- | --- | --- |
| Pinned dependencies | `pnpm-lock.yaml`, `packageManager: pnpm@11.25.0`, exact pins for most tooling in `package.json` | Some runtime deps use caret ranges |
| SBOM | [sbom.cdx.json](sbom.cdx.json) from `scripts/security-gate.mjs` ([inventory](THIRD-PARTY-INVENTORY.md)) | Production deps only; not published with releases |
| Vulnerability gate | `security-gate.mjs` runs `pnpm audit`; fails on any critical and any high in `dist/`; run in `ci.yml` and `deploy-staging.yml`. Run 2026-10-08: passed, 48 accepted | Needs registry access; fails closed; acceptances automatic |
| Tiered tests on pull requests | `.github/workflows/ci.yml`: documentation integrity, catalogue check, type check, build, gate, unit, integration, resilience, smoke ([Testing Saha](../current/TESTING.md)) | Not run on push to `main`; skipped for docs-only changes |
| Weekly regression and UI/accessibility | `regression.yml` (cron `30 2 * * 1`) | Weekly, not per PR |
| Documentation integrity | `docs-checks.yml`, `scripts/check-documentation.py`, `scripts/audit-requirements.mjs` | Documentation only |
| Safe logs | [Slice 6l](../current/SLICE-6L-SAFE-LOGS.md): static and runtime check that patient text and credentials do not reach logs | Local; hosted platform logs unchecked |
| Server-side authorisation matrix, identity hardening | `tests/nfr/` ([slice 11d](../current/SLICE-11D-NON-FUNCTIONAL.md)) | Local, synthetic, not a penetration test |
| Review | Agent-run independent reviews ([VALIDATION.md](../../VALIDATION.md)); many PRs merged at the sponsor's instruction **without human review** ([CLAUDE.md](../../CLAUDE.md)) | No human code review has occurred |
| Branch policy | Draft PR into `main`, no force-push ([AGENTS.md](../../AGENTS.md)); [CODEOWNERS](../../.github/CODEOWNERS) added 2026-10-08 | Branch protection settings not verified from the repository |
| Deploy path | Cloudflare deploy frozen via `SAHA_DEPLOY_FREEZE`; droplet pulls `main` every 3 minutes with a read-only token or deploy key | Anything merged to `main` reaches staging within minutes |
| Secret handling | [Secrets register](SECRETS-REGISTER.md); `.env.example` names only | No secret scanning configured |

## Gaps

No SAST/DAST tooling, no signed commits or provenance (SLSA), no dependency update automation, no container or droplet image scanning, GitHub Actions pinned by major tag (`actions/checkout@v4`, `setup-node@v4`, `upload-artifact@v4`), not by commit SHA, no penetration test, no human code review: TBD (owner: Nakul Jain).
