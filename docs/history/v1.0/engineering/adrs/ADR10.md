# ADR10 Defence in depth authorisation

Status: Proposed

## Decision

Use service policy and tenant RLS with separate runtime roles.

## Rationale

Prevents client scope selection and catches tenant query errors.

## Consequences

Tenant RLS does not replace patient relationship and purpose checks.

Authority: BRD v1.1; High Level Design v1.0. Review owner: architecture lead with relevant clinical, privacy or integration owner. Acceptance remains open.
