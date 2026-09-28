# ADR06 Independent destination actions

Status: Proposed

## Decision

Use saga-style recovery and evidence-based reconciliation.

## Rationale

No global atomic commit exists across unrelated programme systems.

## Consequences

Uncertain results need lookup or manual resolution before retry.

Authority: BRD v1.1; High Level Design v1.0. Review owner: architecture lead with relevant clinical, privacy or integration owner. Acceptance remains open.
