# SAHA-122 local coding completion — purpose and lawful authority

Date: 20 October 2026
Story: SAHA-122 / APL-145
Requirement: BR-SEC-01
Base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`

## Implemented behaviour

An organisation owner can create, approve and withdraw versioned data-flow authority records for a specific external provider or connector. Each record binds the organisation, human-readable purpose, structured access purpose, processing basis, consent purpose where applicable, recipient, retention rule, data classes, permitted directions and the exact target configuration fingerprint.

The same target may hold separate concurrent records for programme delivery, reporting, care coordination or AI assistance. One purpose or direction does not grant another. Consent-based authority must identify the matching `ai` or `exchange` consent purpose; non-consent bases remain distinct. These records never create patient consent or override human membership, patient scope, purpose grants, service identity, provider agreement, capability evaluation, credentials or clinical review.

External HTTP connection activation, MIS/EHR activation, independent provider activation, governance capability activation and external dispatch fail closed without a current matching record. Dispatch reloads organisation state and rechecks authority before the operation and after its audit checkpoint. Target revisions and withdrawn authority invalidate later use. In-process local rules and synthetic demo transports do not cross an external boundary, so they retain their existing workflow without a fictitious external processing record.

Owner UI is available on HTTP connections, independent anaemia/frontline providers and external built-in governance providers. It supports multiple purpose records without resetting the selected purpose. Local providers are excluded from that external-authority UI. Non-owners do not receive the organisation's processing inventory.

## Local evidence

- Purpose/authority contract: 15/15.
- Purpose-selection and owner UI contract: 7/7.
- Service dispatch execution-boundary contract: 102/102.
- Programme integration contract: 45/45.
- EHR permission/provider contract: 48/48.
- Governance contract: 27/27.
- Actual synthetic API/D1 smoke: 5,020/5,020, including local agent execution and local capability activation.
- TypeScript, production build and diff check: passed.
- Exact source hashes and logs: `tests/evidence/saha122-local-coding-completion/`.

## Gates not promoted

This record supports local coding completion only. Formal `TC-BR-SEC-01-A/B`, Privacy/security-owner approval, final independent source review, exact-source CI, merge and observed deployment remain separate and pending.
