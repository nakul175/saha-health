# SAHA-125 evidence receipt

## Custody

- Exact base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`
- Frozen contract SHA-256: `55d61d103781fd883f8c0c265f4b30b40ec8aa458fa681580bb6056b199aafc1`
- Inspected ledger SHA-256: `51cc702960d6da32fecd76cf4ad0521d7b2b37300cadb22e27423d991f525e1e`
- Source hashes: `source-hashes.json`
- Environment: owned local synthetic workspace and D1 runtime; no external recipient, provider, patient record, hosting change or deployment.

## Results

| Check | Result | Receipt |
| --- | --- | --- |
| Focused positive/refusal/error/authorization/race contract | PASS, 15/15 | `contract-result.json`, `validation.log` |
| Existing rights-request contract | PASS, 18/18 | `validation.log` |
| Existing household disclosure contract | PASS, 12/12 | `validation.log` |
| Existing household/proxy boundary review | PASS, 60/60 | `validation.log` |
| Exact built API/D1 integration smoke | PASS, 5020/5020 | `validation.log` |
| TypeScript typecheck | PASS | `validation.log` |
| Production build | PASS | `validation.log` |
| TC-BR-SEC-04-A | NOT RUN | Formal QA with privacy and security owners remains pending. |
| TC-BR-SEC-04-B | NOT RUN | Formal QA with privacy and security owners remains pending. |

## Covered behavior

- household membership grants no disclosure and purpose mismatch omits the subject;
- sensitive maternal work is withheld unless the grant names the maternal class;
- current applicable class grants succeed and inapplicable future-class grants fail atomically;
- relationship, evidence, start, expiry, grant actor and revocation remain separate authority fields;
- future, expired and revoked authority is refused and excluded from the UI read model;
- active household authority can lodge a grievance without confidential-history disclosure;
- access, correction, restriction and deletion requested under that unrelated authority are refused without creating a request;
- patient-version changes invalidate stale concurrent grant and revoke commands;
- a current revoke increments the version, retains the authority record and immediately removes sharing;
- interface and API enforce the same representative-request boundary.

## Remaining separate gates

Jurisdiction/care-context policy approval, privacy/security/domain review, independent final source review, formal source-fixture execution, current-source CI, merge and observed deployment are not claimed.
