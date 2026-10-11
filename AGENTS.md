# Saha development workflow

Every coding agent (Claude, GPT/Codex, Cursor) and every person continuing this repository starts with [HANDOVER.md](HANDOVER.md): current state, how to verify a change, open defects and the next work. [CLAUDE.md](CLAUDE.md) holds the same project rules for Claude.

The user has requested that all ongoing code changes be committed and pushed to GitHub.

- GitHub source repository: https://github.com/nakul175/saha-health (private).
- Commit each completed, meaningful batch of changes, including relevant tests and documentation, and push it before reporting completion.
- Check the remote branch before updating it. Preserve concurrent work; never force-push or overwrite unrelated changes.
- Use the authenticated GitHub connector when native git authentication is unavailable. Create a commit from the current remote parent, update its branch, and verify the resulting tree matches the intended source. Connector commits may have different SHAs from local commits.
- Report a failed push accurately and retain the local commit for recovery.
- Keep credentials, real patient records, local databases, generated build output, and dependencies out of git. Track only the empty environment template.
- Retain Sites hosting configuration. GitHub source publication does not move or redeploy the running application.

The initial GitHub source import is the complete Release 3 working tree. Earlier development history remains in the Sites-managed repository.

## Project rules for every agent

- Branch from GitHub `main`, open a pull request into `main`, and merge only when the sponsor says so. Every merge into `main` deploys the hosted synthetic staging Worker unless the repository variable `SAHA_DEPLOY_FREEZE` is `true` ([hosted synthetic staging](docs/current/HOSTED-STAGING.md)).
- Keep application authorisation on the server. Owner authority does not override patient scope. Identity comes only from the trusted provider in `lib/saha/identity.ts`; never trust public identity headers directly.
- Preserve confirmed records, revisions, audit, receipts, applied migrations and legacy source. Corrections append evidence; uncertainty never authorises a blind external retry.
- Synthetic data only. Do not turn on providers or message real recipients.
- For code changes, run the affected checks and record the real results, with dates and limits, in `VALIDATION.md`. Update the implementation boundary, requirement assessments, next-delivery row and evidence together, and never promote an acceptance case because a related unit check passes. For documentation changes run `python3 scripts/check-documentation.py` and `node scripts/audit-requirements.mjs --check`.

## Adopted QA workflow

- Start Saha QA work at `docs/qa/SAHA-ADOPTION.md` and `docs/qa/SAHA-CONTEXT.md`, then load only documents routed by `docs/qa/workflow/TASK-ROUTING.md`. The generic intake and fictional examples are templates, not Saha facts or results.
- Classify each change's risk. Use the Low-tier fast path only when eligible; preserve canonical IDs, frozen criteria and existing regression minima. Do not weaken criteria or targets to obtain a pass.
- Execute meaningful authorized checks and retain failures and reruns. PASS requires observed evidence. BLOCKED, NOT_RUN, SKIPPED and stale checks never become passes; a structural checker pass is not product acceptance.
- Resolve only decision-dependent unknowns while continuing independent work. Synthetic sandbox only, no real users/patients, providers, paid services or destructive migrations. Existing specialist and action-specific authority remains required.
- Report exact source/build, checks, limitations and residual risks. Never self-approve independent review, exceptions or release. Merged, observed staging deployment, accepted parent story and production release are separate statuses.
- For adopted package integrity, use only `docs/qa/ADOPTION-MANIFEST.json`. `docs/qa/MANIFEST.json` is the historical upstream manifest. Read `docs/qa/workflow/AGENT-DETAILS.md` for planned QA, high/critical or release work.
