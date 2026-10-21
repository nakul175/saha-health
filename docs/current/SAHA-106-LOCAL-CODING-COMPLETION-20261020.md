# SAHA-106 local coding completion — worker activity evidence

Date: 20 October 2026
Story: SAHA-106 / APL-129
Requirement: BR-CARE-08
Base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`

## Implemented behaviour

The existing worker and supervisor workflow now has an exact local completion record against the frozen story contract. The scoped supervisor view distinguishes performed visits, claimed outreach work, system-matched verified work and accepted submitted work. Wrong-patient and superseded visits stop contributing to current derived counts while their original record, reviser, reason and correction link remain traceable.

Synthetic incentive evidence stays separate from payment. An ASHA prepares a versioned claim from current eligible evidence; a distinct supervisor verifies it and a distinct owner approves it into an immutable digest chain. If source evidence is later cancelled or corrected, submitted, verified and approved lines are marked stale. Verification and approval fail closed. An approved claim is never edited: an authorised worker or supervisor prepares a linked reversal claim, retaining the original evidence and full review history.

Access remains enforced on the server by current organisation, membership, team supervision and care scope. Worker rows contain no location data. Approved-claim CSV exports contain one-way subject references rather than patient names or identifiers. Placeholder `SYN` amounts cannot be represented as payment or a real programme rate.

## Local evidence

- Worker activity contract: 12/12.
- Incentive claims contract: 35/35.
- TypeScript and production build: passed.
- The two direct contract runners include the current `installed-transition-authority` dependency imported by `programmes.ts`; their assertions and original oracles are unchanged.
- Exact source hashes and logs: `tests/evidence/saha106-local-coding-completion/`.

## Gates not promoted

This is local coding completion only. Formal `TC-BR-CARE-08-A/B`, domain approval, independent source review, exact-source CI, merge and observed deployment remain separate and pending. Real scheme rates, beneficiary or field verification, payment/reconciliation, buyer reporting, external anchoring/signing and archive policy remain external decisions and were not invented.
