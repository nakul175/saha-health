# SAHA-131 rights and correction workflow — local coding completion

20 October 2026. This record applies only to local source based on `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`. The frozen APL-154 contract hash is `280fb877ce7207f5009f86518fe85c7597e33fc1b90d6761056eddf16ffc15fd`.

## Implemented application boundary

- An organisation owner records append-only versions of the approved rights policy. Each version names the accountable organisation, one due period for each request kind, allowed identity-verification methods, and the grievance escalation destination and period. A request captures its policy version, route and due date, so a later policy cannot rewrite existing accountable work. Stale organisation-settings versions are refused.
- Intake requires a structured verification method and evidence reference. Representative requests require the patient’s current proxy grant and the representative-grant verification method. Current tenant, role, team/patient scope and request version are checked on every protected action.
- Access handlers can prepare a patient-scoped JSON record copy. It excludes organisation settings, credentials, staff rosters and audit-chain contents, records the read, refuses if the record changes during preparation, and returns a SHA-256 reference. Closure as fulfilled requires that record-copy evidence to be appended.
- Correction, restriction and grievance outcomes likewise require typed append-only evidence. Corrections point at the retained revision or correction record; they never overwrite clinical history.
- A grievance can be escalated to the policy-defined accountable organisation, with a named current owner and policy-derived deadline. An unresolved escalation blocks closure; its outcome and evidence are appended.
- A deletion request requires a review against the current approved retention policy. Active holds prevent an eligible-for-disposal finding. The workflow cannot claim fulfilled deletion and never deletes a record; it records retained, not-applicable or eligible-for-controlled-disposal decisions and keeps any remaining disposal work explicit.
- Existing downstream programme and EHR destination items, restriction enforcement, owner assignment, audit entries, command receipts and optimistic request versions are preserved.

## Local verification

| Check | Result |
|---|---|
| `node tests/rights-contract.mjs` | 20 assertions passed |
| `pnpm run typecheck` | passed |
| `pnpm run build` | passed; `/api/rights/package` included |
| Isolated API/D1 suite | 5,026 passed, 0 failed, 0 skipped |

The exact machine-readable receipt is [local-coding-completion.json](../../tests/evidence/saha-131-rights-completion/local-coding-completion.json); the runner report is [api-suite.json](../../tests/evidence/saha-131-rights-completion/api-suite.json). Failed and blocked attempts remain listed in the receipt rather than being rewritten as passes.

## Gates that remain separate

Local application coding can be marked complete because no identified application-code gap remains against the frozen story. The organisation still must supply and approve real privacy/legal policy values; the code refuses intake until that happens. Formal TC-BR-SEC-10-A/B, privacy/security-owner acceptance, independent review, exact-source CI, merge and observed deployment remain pending. Restore-safe disposal execution also remains separate: this workflow can reach an evidence-backed eligibility decision but performs no destructive deletion.
