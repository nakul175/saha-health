## Frozen scope and acceptance criteria — v1.0 (15 October 2026)

**Freeze status:** FROZEN as a conservative, decision-gated product contract. The missing originating narrative is not replaced with invented commercial, clinical, privacy or operational policy.

**Frozen scope:** The existing user outcome and bounded optional behavior above are in scope only for an authorised synthetic implementation. Until a later reviewed source decision exists, the feature must remain optional, must not block ordinary care, must not expand record access, must not activate an external provider or destination, must not create payment or sanction, and must not enable background tracking. Any broader behavior is out of scope.

**Frozen acceptance:** Adopt the existing positive, authorization/refusal, invalid-input/dependency-error, recovery/stale-version, audit/privacy and qualification scenarios above as the v1.0 testable contract. The safest stated path must remain available when the optional capability is declined, unavailable, unauthorised or lacks required data. No prohibited side effect may occur.

**Decision rule:** A recovered source narrative or later product/domain decision may create v1.1 only through explicit rationale, affected criteria, impact assessment and product-owner review. It cannot silently weaken v1.0 or turn planning into provider, payment, clinical-policy or live-data authority.

**State separation:** “Frozen” means stable planning scope and acceptance. It does not mean Ready, approved for live use, implemented, tested, accepted, merged or deployed; SAHA-READY-1.0 and SAHA-DONE-1.0 remain separate.
