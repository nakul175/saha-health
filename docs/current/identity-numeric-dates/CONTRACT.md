# Bounded authentication validity repair

Frozen before implementation, 12 October 2026. Base: `22a271033eaa57e124a235fc615744928f1ac106`.

Canonical story: SAHA-012 / APL-35; task: ENG-BR-ID-03 / APL-195; original requirement: BR-ID-03; design: FR-ID-03. Original formal cases TC-BR-ID-03-A and TC-BR-ID-03-B remain unexecuted. This is a bounded existing authentication repair, not a completed recovery/MFA implementation or a parent acceptance pass.

## Intended behaviour and boundary

Cloudflare Access identity continues to require the selected provider, valid RS256 signature, trusted issuer/audience, subject and email. Required `exp` must be a finite numeric value. Optional `nbf`, when present, must also be a finite numeric value. Refuse a signed credential containing an overflowed JSON numeric date or malformed optional validity date. Preserve the existing 60-second clock allowance exactly, including its existing equality boundaries. Fractional finite numeric dates remain supported. An omitted `nbf` remains valid. No provider, session, membership, recovery, MFA, policy, route, database or audit semantics change.

The current implementation accepts a signed raw JSON `exp:1e309` after it decodes to JavaScript Infinity, and ignores nonnumeric `nbf`; both can bypass its existing credential validity gate. Reproduce with local RSA keys before changing the implementation. No external identity endpoint is used.

## Checks frozen before code

1. Positive controls: finite future expiry; absent or finite allowed `nbf`; fractional finite dates; exact current expiry/activation clock allowance boundaries.
2. Refusal: overflowed positive/negative expiry, missing/string/null expiry, overflowed positive/negative `nbf`, present string/null/boolean/array/object `nbf`, expiry outside the unchanged allowance, future activation outside the unchanged allowance.
3. Provider isolation: trusted Sites headers cannot rescue an invalid Access token. Existing identity contract remains unchanged and runs separately.
4. Actual built local Worker: positive sign-in works with the locally generated trusted key; malformed date tokens return 401 for workspace, person list and mutation routes, disclose no protected workspace content, and create no accounts, organisations, visits or command receipts. Inspect native synthetic SQLite state before/after refusals; perform no hosted access.
5. Source review: only the narrow validity predicate changes. Original test minimums, catalogue policies and source acceptance remain unchanged. A separate reviewer examines final source and actual test results before publication qualification.

Risk: C2 because authentication parsing changes, despite its small diff. Compatibility: properly formed finite token dates retain the existing acceptance window. Rollback is the source predicate only; no migration or persisted data change. New tests are additive. Formal workforce recovery, MFA, live identity-provider governance and real deployment tests remain open.

## Authority and delivery

The human explicitly requested code for the next 50 canonical stories; this development-only slice advances the existing task without declaring it Done. Repository rules remain authoritative. APLYD packages are reference standards; no installed `.engineering/repository.json` or operational four-package enforcement is claimed. No merge, hosting or tracker completion is implied by a local pass. PR 206/207 were identified by the controller as separate permission/tenant test work; these paths do not alter their tests or source.
