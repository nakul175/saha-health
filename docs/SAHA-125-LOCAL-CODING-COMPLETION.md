# SAHA-125 local coding completion

## Frozen contract

- Story: SAHA-125 / APL-148, Sensitive data and proxy handling
- Contract: `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-148.md`
- Contract SHA-256: `55d61d103781fd883f8c0c265f4b30b40ec8aa458fa681580bb6056b199aafc1`
- Source base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`
- Remaining-40 ledger SHA-256 inspected before editing: `51cc702960d6da32fecd76cf4ad0521d7b2b37300cadb22e27423d991f525e1e`

## Implemented local behavior

Household membership still grants neither staff access nor disclosure. A proxy grant records the representative, relationship, purpose, sensitive classes, evidence, start, expiry, grant actor and any later revocation separately. Server-side sharing continues to omit a household member when no current grant matches the recipient and purpose, and removes items that reveal a sensitive class absent from the grant.

Grant creation now refuses a sensitive class that does not currently apply to the subject. This prevents a grant from silently pre-authorising a later child, adolescent, maternal or TB care context. Creating or revoking a grant increments the patient version; stale concurrent grant and revoke commands are refused without changing authority. Grant validation is mutation-free when it refuses a request.

A household proxy grant can lodge a grievance, which does not disclose confidential history. It no longer authorises a representative to request access, correction, restriction or deletion of confidential history. Those operations fail server-side until separately approved authority exists. Future, expired and revoked grants are excluded from both the proxy picker and server-side intake. The interface explains the boundary and disables the unsupported representative request types.

The implementation adds no jurisdiction-specific sensitivity category, provider or outbound notification path. It applies the existing configured purpose and sensitive-class vocabulary and otherwise refuses.

## Verification

- SAHA-125 focused sensitive/proxy contract: 15/15 passed.
- Existing rights-request contract: 18/18 passed.
- Existing household disclosure contract: 12/12 passed.
- Existing read-only household/proxy boundary review: 60/60 passed.
- Exact built local API/D1 smoke: 5020/5020 passed.
- TypeScript typecheck: passed.
- Production build: passed.
- A broad integration-layer attempt inside the restricted sandbox was stopped after its local Worker migrations were refused permission to bind `127.0.0.1`. The exact API smoke was then run through the approved owned-local runtime and passed; the environmental failure is retained in this record rather than counted as a product failure.
- Formal cases TC-BR-SEC-04-A and TC-BR-SEC-04-B remain Not run.

## Boundaries and pending gates

This is local coding-completion evidence against the frozen application contract. It does not establish the jurisdiction or care-context policy, privacy/security-owner acceptance, formal source-fixture acceptance, independent final source review, final-head CI, merge or observed deployment. It uses synthetic records only, creates no provider/database/hosting service, sends nothing externally and does not modify `sources/`.
