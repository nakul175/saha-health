# SAHA-112 local coding completion — population prioritisation

This isolated candidate implements the application-code scope of APL-135 / SAHA-112 against BR-REP-06 from base `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`. The frozen contract is `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-135.md` in the project root, SHA-256 `13967d6df5eafbbd2af754ad6cc3e15318d4f855ca0b160949c264c700e6ef6d`. This record does not change the frozen contract or native Linear status.

## Implemented behavior

An organisation owner can propose versioned operational care-gap criteria, and a different current supervisor or clinician must approve them before use. The configuration records the objective selector, limitations and uncertainty. It states that approval is software configuration review rather than clinical or programme-policy approval. Criteria can only select overdue open follow-ups, referrals without terminal outcomes, or the union of those two existing operational gaps; no clinical risk score or new clinical threshold is introduced.

A current team-scoped supervisor with `care-coordination` purpose can prepare a bounded review for one team and optional programme. The server refuses cohorts or matching results below five and returns no person-level result, limits a review to 30 matching people, and freezes the approved criterion, reviewer authority, supervisor authority, filter, as-of date, people, follow-ups and referrals in source hashes and versions. Changed criterion, reviewer, supervisor, patient, follow-up, referral, programme or team scope makes the draft stale and requires a new review.

The review shows a reason and uncertainty for every candidate. A supervisor can record a reasoned human inclusion, exclusion or care-worker allocation override. Exclusion affects only the review and never changes the person's service state or eligibility. Included people require a current ASHA or clinician who can access the person. Strict command schemas reject unsupported penalty fields.

Confirmation creates one unscheduled draft outreach plan. It does not schedule or send contact, mutate patient assignment or care status, decide eligibility, change pay, or create sanctions. Cancellation creates no downstream plan. Replays and stale versions are refused, and person-level decisions are audited.

The authenticated `/prioritisation` workspace makes criteria, limitations, uncertainty, reasons and human override controls inspectable. The read API uses the existing audited workspace load and discloses run candidates only to current scoped supervisors; returned people remain bounded to the supervisor's current care scope, and an historical run is withheld if current authorized visibility falls below five. A link from the outreach workspace makes the feature reachable.

## Local verification

- `node tests/prioritisation-contract.mjs`: 23/23 passed. Coverage includes independent review, restricted-role and out-of-team refusal, purpose refusal, small-cohort suppression during creation and later scoped reads, strict-schema penalty refusal, visible reasons/uncertainty, no patient mutation, reasoned exclusion, stale-version and source races, reviewer/supervisor/worker authority changes, current criterion enforcement, draft-only confirmation, replay refusal and cancellation with no downstream action.
- `node tests/access-scope-contract.mjs`: 8/8 passed after regenerating the command catalogue.
- `node scripts/audit-requirements.mjs --check`: 176/176 source IDs, assessments, evidence paths and generated records verified; acceptance remains pending.
- `pnpm typecheck`: passed.
- `pnpm build`: passed; the production route inventory contains `/api/prioritisation` and `/prioritisation`.
- Documentation inventory generation completed with the repository generator executed under the host Python 3.9 compatibility wrapper. It reported 176 requirements, 364 catalogue test cases, 124 HTTP routes and 260 command discriminators.
- `node tests/outreach-contract.mjs`: not run to assertions because the inherited harness imports a missing generated `installed-transition-authority.js` module. The exact failure is retained as a limitation; the focused prioritisation contract verifies the created outreach draft directly.
- `python3 scripts/check-documentation.py`: unavailable on this host because the repository script uses Python's `zip(strict=True)` while the installed interpreter is Python 3.9. It also compares against the unchanged historical baseline, so this intentional source and inventory change requires normal integration refresh.

The custody manifest is [saha-112-local-coding-evidence-sha256.json](../verification/saha-112-local-coding-evidence-sha256.json). Test result files are `tests/prioritisation-contract-result.json` and `tests/access-scope-contract-result.json`.

## Separate pending gates

This is local coding completion only. TC-BR-REP-06-A, TC-BR-REP-06-B and TC-J12 retain formal **Not run** status. Clinical and programme owners must approve any deployment-specific selection criterion and validate real data quality and fairness. Independent source review, CI on the exact commit, merge, physical/accessibility and representative-user acceptance, hosting release, and observed deployment remain pending. No real patient, live provider, external send, paid service, new database or hosting change was used.
