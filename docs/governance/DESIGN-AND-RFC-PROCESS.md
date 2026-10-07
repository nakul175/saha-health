# Design documents and RFC process

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: a change to how slices are specified or reviewed (see [AGENTS.md](../../AGENTS.md)).

Status: describes the practice visible in this repository. No separate RFC template existed before this document; the one below is a proposal.

## What exists

| Purpose | Where |
| --- | --- |
| Preserved target design (ten specifications, prototype, 12 ADR proposals) | [docs/reference/](../reference/README.md), [docs/history/](../history/README.md) (never edit) |
| Current reconciled specifications | [docs/current/DOCUMENTATION-INDEX.md](../current/DOCUMENTATION-INDEX.md) |
| One design-and-evidence note per development slice | `docs/current/SLICE-*.md` (for example [slice 6j](../current/SLICE-6J-AUDIT-CHAIN.md)) |
| Independent reviews of merged work | `docs/current/*-INDEPENDENT-REVIEW.md`, [VALIDATION.md](../../VALIDATION.md) |
| Decisions | [Architecture decision reconciliation](../current/ARCHITECTURE-DECISIONS.md) |
| Delivery sequence | [Engineering plan](../current/08_Engineering-Implementation-Plan_v1.1.md), [NEXT-DELIVERY](../NEXT-DELIVERY.md) |

## Proposed RFC flow for a material change

A material change is one touching persistence or scale, identity, sensitive-data separation, a real provider or partner, native versus browser field custody, or hosted recovery (the list in the ADR reconciliation).

1. Write a note in `docs/current/` named after the slice: problem, options considered, chosen option, consequences, tests and evidence plan, what is explicitly not done.
2. Open it as a draft PR into `main` with the [PR template](../../.github/PULL_REQUEST_TEMPLATE.md). The owner (Nakul Jain) decides; no other approver is defined (TBD, owner: Nakul Jain).
3. If it changes an ADR disposition, add a new dated entry to the ADR reconciliation with options, evidence, owner and consequences. Do not rewrite a historical proposal as if it had been accepted.
4. After implementation, add independent-review findings and fixes as separate notes and record real results in `VALIDATION.md`.
