# SAHA-129 local coding completion — 20 October 2026

## Frozen scope and custody

- Story: SAHA-129 / APL-152, “Durable audit and end-to-end exchange traceability”.
- Original isolated candidate base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`.
- Integrated composition parent: `b36664f4df8802e92ac8e0bd912ee594cb748b5a`; the source-hash manifest records the exact staged semantic union on that parent.
- Frozen contract: `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-152.md` at SHA-256 `f0f507630240c42f5757aedc04954a189aa05c74c5dbbb3bbca597e377b05bcb`.
- Remaining-40 ledger inspected at SHA-256 `6472d7c1c05e084dbfb4942518f7fe515da9863cfec9f1e941c0ffed9698a123`; its SAHA-129 contract hash matches.
- Synthetic local code and fixtures only. No provider, credential, real patient, hosting, database or deployment change was made. `sources/` remains unchanged.

## Application behavior completed locally

- MIS submissions retain an immutable purpose and approval/version snapshot for accepted, uncertain, queued and refused outcomes.
- Direct-EHR publications expose their permission, purpose, source versions, validation ruleset, content digest, request/audit links, receipt lookup and final state without returning the FHIR body in the trace response.
- Direct-EHR retrieval now commits a consent-bound request checkpoint before the first partner read. Every deliberate attempt has a durable operation record and ends as review, conflict, withheld or failed when the terminal write is available. The same command key cannot blindly repeat the partner read; a concurrent authority change withholds the document and records no clinical content.
- Duplicate and changed EHR documents retain separate request evidence. Conflict candidates and retrieval operations receive immutable command/audit correlation without altering the original document.
- Mock ABDM transfers retain the exact consent purpose/types/times, patient consent version, ABDM configuration version, validation/decryption/acknowledgement phases and final state. Missing consent/source references are reported as incomplete rather than reconstructed.
- Assigned care scope is required for patient-linked transfer and retrieval traces. Owners and administrators do not gain patient scope. Suspended users are refused.
- Trace responses are identifier/state/time/digest metadata only. Synthetic tests prove patient names, localities, ABHA values, notes and raw FHIR/ABDM payloads do not appear.
- Existing append-only chain, atomic patient writes, signed checkpoints, access-audit fail-closed behavior, clock-skew checks and no-blind-retry publication behavior remain intact.

## Actual verification

All checks used the exact source in this worktree.

| Check | Result |
| --- | --- |
| SAHA-129 exchange trace contract | PASS 16/16 |
| Existing trace contract | PASS 27/27 |
| ABDM transfer contract | PASS 22/22 |
| EHR permission/document contract | PASS 48/48 |
| EHR checkpoint/execution contract | PASS 36/36 |
| Audit-chain contract | PASS 48/48 |
| Audit-checkpoint contract | PASS 15/15 |
| Access-audit contract | PASS 35/35 |
| Read-audit completion contract | PASS 52/52 |
| Safe-log contract | PASS 13/13 |
| Audit-query-plan contract | PASS 12/12 |
| Focused total | PASS 324/324 |
| TypeScript | PASS, `tsc --noEmit` |
| Production build | PASS, vinext build |
| Synthetic local API smoke | PASS 5020/5020 |
| Requirement audit | PASS, 176 source IDs and generated records verified; acceptance remains pending |
| Documentation generator | NOT RUN TO COMPLETION: host Python 3.9.6 rejects the repository script's `zip(..., strict=True)` before validation |

The access-audit fault fixtures intentionally print refusal diagnostics while passing their fail-closed assertions. The documentation-generator failure is retained as a tooling/runtime incompatibility and is not counted as a pass.

## Limits and separate gates

This is a truthful local application-code completion record, not formal acceptance. TC-BR-SEC-08-A/B, TC-NFR-10-A/B, TC-NFR-26-A/B and TC-J04 remain **Not run** as formal QA cases. Hosted D1 outage/fault behavior, emergency-read policy, external checkpoint custody/key rotation, official ABDM conformance, a live EHR partner, independent auditor reconstruction, privacy/security owner acceptance, current-source CI, independent source review, merge and observed deployment remain separate. No clinical, privacy, domain or deployment approval is claimed.

Exact evidence and file hashes are in `tests/evidence/saha-129-durable-audit/`.
