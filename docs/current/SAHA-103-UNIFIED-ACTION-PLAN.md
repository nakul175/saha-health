# SAHA-103 unified action plan — local coding evidence

This candidate implements the frozen APL-126 / BR-CARE-05 application boundary on base `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`. The frozen contract file SHA-256 is `3d7f1dacc4364713c310df6c695ae3ed724434e2c35f161b750611e702c2b84c`; its source-plus-refinement identifier remains `75a1d3c5f56c3a2093423c73ef4677ffa84d50fd35872be4c6356c77f2f5a5a9`.

## Implemented boundary

- A current request carries patient and visit versions and an exact time window. The server rechecks active care role, current assignment/team scope, care-coordination purpose, patient version, confirmed-visit version and live record identity before writing.
- Requests consolidate only when person, pack-declared purpose, normalised destination and exact time window are all equal. A different purpose, destination or window produces separate work.
- The shared referral retains one immutable programme-episode source per pack, every pack-specific reason, the exact pack/version/manifest declaration, the episode state at request time and the current independent state of every programme episode.
- An installed pack may declare that a referral depends on named completion rules. Installation rejects unknown or repeated rule ids. The server resolves open blockers from the same episode, derives auditable action-plan dependencies and refuses the whole batch before mutation when a declared blocker is unavailable.
- Waiting referrals and follow-ups remain open and visible. They are omitted from escalation, exception, overdue indicator and overdue caseload counts until their blockers resolve.
- A referral created before this boundary is never merged by fuzzy matching. A worker must choose one matching referral from the same confirmed visit and submit its current version; a stale, terminal, already governed or destination-mismatched record is refused.
- The command prepares local work and writes an audit record. It never contacts a facility and does not complete a programme episode.

## Synthetic evidence

`tests/unified-action-plan-contract.mjs` exercises equivalent consolidation, separate purpose/destination/window work, preserved reasons and sources, independent programme states, declared-rule validation, derived blockers, waiting-state resolution, invalid dates, lost assignment, lost purpose, stale patient/visit versions, missing version binding, atomic unavailable-dependency refusal and explicit version-bound legacy adoption. The engineering contract passes 30 checks.

Affected compatibility checks pass: action-plan contract 8, household-completion contract 42, TypeScript typecheck and production build. Exact command logs and the machine-readable manifest are under `tests/evidence/saha-103-unified-action-plan/`.

The unchanged household-visit contract has a retained current-main harness limitation: its explicit transpile list omits current transitive modules (`installed-transition-authority`, then `aggregate-alert-disclosure`). It is recorded as a baseline test-fixture gap and is not represented as a product regression or a passing receipt.

## Gate status

| Gate | Status |
|---|---|
| Frozen scope inspected | Pass for APL-126; exact hash recorded above |
| Application code gap against the frozen local boundary | None identified after focused implementation and checks |
| Synthetic engineering contract | Pass, 30 checks |
| Typecheck | Pass |
| Production build | Pass; existing large-chunk advisory retained |
| Independent source review | Not performed |
| Exact-source CI | Not run |
| Formal TC-BR-CARE-05-A / TC-BR-CARE-05-B / TC-J11 | Not run |
| Domain or clinical approval | Not provided |
| Merge | Not performed |
| Observed deployment | Not performed |

Local coding completeness does not alter the canonical requirement assessment or formal case register. BR-CARE-05 remains `partial` and every formal result remains pending until its named executors run the source cases and required approvals are recorded.
