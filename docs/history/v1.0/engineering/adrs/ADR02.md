# ADR02 Modular server and durable workers

Status: Proposed

## Decision

Start with a modular service and database-backed outbox workers.

## Rationale

Reduces cross-service failure modes while preserving clear component contracts.

## Consequences

Split components only when measured scale or custody requires it.

Authority: BRD v1.1; High Level Design v1.0. Review owner: architecture lead with relevant clinical, privacy or integration owner. Acceptance remains open.
