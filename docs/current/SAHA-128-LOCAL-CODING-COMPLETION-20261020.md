# SAHA-128 local coding completion — safe logs and analytics

## Frozen contract

- Story: SAHA-128 / APL-151
- Exact base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`
- Frozen contract: `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-151.md`
- Contract SHA-256: `083369a35c07016bedd05ee4c992d358b6befb16e81941c79819c455c472f3e1`
- Original requirement: BR-SEC-07

## Application behavior completed

- General request logs now pass through one structured encoder with exactly event, generated correlation identifier, fixed route label, numeric status, and bounded duration.
- General failure logs now pass through one structured encoder with only a fixed failure code, coarse allow-listed class, and an optional validated correlation identifier.
- URLs, query strings, identifiers, request/response bodies, headers, credentials, provider payloads, prompts, recording bytes, exception messages and stacks cannot be arguments to the general encoder.
- The previous development-only raw exception output was removed. Local development and hosted builds now use the same redaction boundary.
- Unsafe route labels and malformed correlation identifiers fail closed. Numeric fields are bounded before logging.
- Existing request metrics remain fixed-column, aggregate, tenant-bound and pruned. Existing support exports remain operator-only and omit patient records, actor identifiers, credentials, endpoints, and incident free text.
- Patient-linked evidence that may be sensitive stays in the separately authorised audit/revision records under the existing retention workflow; it is not copied into general telemetry.

## Verification on the exact worktree

- Safe-log allow-list and executable encoder contract: **16/16 passed**, scanning 529 runtime files and all 12 application console calls.
- Actual built Worker/D1 routine telemetry tenant-retention integration: **64/64 passed**, with a qualified receipt SHA-256 of `64ba52eddbc5a26c2c453b5856fd99bb923fac94b3cfb1b68e6cc192e7abb263`.
- TypeScript typecheck: passed.
- Production build: passed.
- Test catalogue: passed; 1,044 suites classified on this base. Catalogue citations are context, not acceptance.
- Requirements audit passes after this completion record is present.
- `sources/` is unchanged; all exercised records are synthetic.

## Retained failures and separate gates

- A full API-smoke attempt was retained as failed at the inherited `operations-smoke` patient-count assertion before it reached the safe-log component. It is not reported as a SAHA-128 pass or repaired by weakening its oracle.
- The prior end-to-end safe-log smoke remains registered, but was not newly completed by that interrupted full-suite attempt.
- Formal TC-BR-SEC-07-A and TC-BR-SEC-07-B remain Not run.
- Hosted platform log/crash/analytics configuration and retention inspection, privacy-owner policy review, and representative hosted end-to-end leakage testing remain external acceptance work.
- Independent source review, exact-source CI, merge, and observed deployment remain pending.
- No real patient, secret, provider, paid service, hosting change, new database, or destructive migration was used.

Within the current application boundary, no identified SAHA-128 application-code gap remains against the frozen contract. This is a local coding-complete statement, not formal acceptance or deployed evidence.
