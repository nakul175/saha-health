# SAHA-102 / BR-CARE-04 — due work and escalation

Local application coding checkpoint: 20 October 2026. Frozen source contract: `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-125.md` (outside this isolated checkout). This record does not assert formal acceptance, independent review, CI, merge, deployment, clinical approval, recipient approval or live notification delivery.

## Implemented behavior

- An organisation owner can save a draft or activate a versioned due-work policy with explicit IANA timezone and separate emergency, urgent, routine and unknown/missed-outcome thresholds. No escalation threshold is inferred while no active policy exists.
- Workers see their currently owned open follow-ups and referrals in deterministic attention, urgency, overdue-age, due-date and identity order. Supervisors and valid supervision delegates see only escalated work in their permitted teams.
- Open action-plan dependencies suppress time-based escalation for a waiting item. Ownership loss still escalates. The blocker retains its own queue position.
- The queue keeps current and most recent patient-level prior ownership, source due date, versioned policy, delay history, reason and service constraint. Nothing is sent and work is never reassigned automatically.
- A follow-up owner or team supervisor may record a later due date with a bounded service constraint and reason. The command pins patient version, prior due date and policy version; changed membership, scope, assignment, dependency, source, or policy refuses without mutation.
- Existing referral delay evidence is surfaced. Existing referral completion/cancellation and follow-up completion/cancellation with documented resolution remove the item from the live queue while the source and audit history remain. A late outcome updates the existing source; this path does not create another follow-up.
- Every due-work read uses the viewer-scoped server state and creates the existing bounded patient-work read audit. Administrators are refused patient-level queues.
- The standalone due-work screen returns to the signed-in workspace without embedding patient identifiers in the URL.
- An owner whose role is administrator can use a management-only read that returns policy configuration without reading or auditing a patient queue; administrators who are not owners receive neither settings nor patient work.

## Verification

- `npm run typecheck`: pass.
- `node tests/due-work-contract.mjs`: 12 assertions/groups pass, covering command-boundary registration, inactive policy refusal, owner activation, timezone/policy races, worker/owner/supervisor scope, ordering, dependency behavior, authorized delay evidence, changed-state refusal and late-result reconciliation.
- `npm run build`: pass; `/api/due-work` is present in the generated route inventory.
- `git diff --check`: pass.
- Direct legacy contract scripts attempted for operations, referral, action-plan, worklists, continuity and delegation stop before executing because their historical transpile inventories omit the already-imported `installed-transition-authority.js`. This same dependency-closure problem is documented in the repository's existing validation history; it is retained as a failed compatibility attempt and is not reported as a pass.

## Separate gates

Formal TC-BR-CARE-04-A/B remain Not run. An organisation/domain owner must review and activate actual thresholds and timezone. Real notification recipients, on-call arrangements and any external delivery channel require deployment-specific configuration and acceptance. Exact-source CI, separate source review, merge and observed deployment are pending. No clinical threshold or provider was invented by this implementation.
