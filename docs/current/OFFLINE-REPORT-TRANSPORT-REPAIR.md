# Offline-report bounded transport disposal

The offline report receiver now discards refused request bytes up to a separate 256 KiB transport bound while keeping its 12,000-byte JSON business limit. Oversized content is never parsed, retained as a command, or written to patient/report/audit/receipt ledgers. Trusted identity still precedes local parsing, and cross-site refusal remains 403.

## Grounded failure and controls

The unchanged full application on the identity-first baseline produced 12 EPIPE/ECONNRESET failures in 128 ordinary fetch requests: every observed failure was a cross-site request immediately after an anonymous 13,000-byte request. The immutable initial stress report remains `tests/evidence/offline-lifecycle-independent-review/auth-transport/stress-initial.json`; it is a failed diagnostic, not a passing regression.

Pure helper peers, including the same assets router and module shape, each completed 128 requests without faults. With the actual application initialization, a dummy normal response consuming its body completed 128 without faults; the real normal branch failed four. Consuming a normal request clone before application handling removed faults; consuming only the cross-site clone or disposing the original after handling did not. These controls identify the preceding receiver's early body cancellation, rather than the cross-site refusal or assets router, as the demonstrated boundary.

Changing only the route's refused-body disposal bound from 12,001 to 262,144 bytes completed the same 128-request sequence plus five zero-write checks (133 passed). However, a separate authenticated chunked 13,000-byte request still triggered one subsequent connection fault among 32 requests: its parser had already cancelled the body, preventing the route finally block from reading it.

## Repair contract

`boundedJsonBody` accepts an optional trusted transport discard bound. Existing callers retain immediate size rejection. Only the offline-report receiver opts in. Once the business byte limit is exceeded, buffered prefixes are dropped, subsequent bytes are discarded, and EOF returns 413. Reaching the transport bound cancels and returns 413. The optional bound is capped to at most the business limit plus 256 KiB; it cannot enable unbounded buffering. Content-Length rejection remains early, and the route finally block handles its unread refused body within the fixed transport bound.

No request body/hash/receipt is rewritten, and there is no retry or Connection-close workaround. Disposal can still cancel streams beyond the bound; this is not a guarantee for arbitrarily large or indefinitely slow streams.

## Verification

- Fresh framework build and TypeScript check passed.
- New `tests/offline-opens-transport-http.mjs`: 170 passed, zero failures on the actual Worker/D1, using normal fetch without retries. It repeats the original 128-request sequence, 32 authenticated chunked/cross-site requests, and ten zero-write checks.
- New `tests/request-body-transport-contract.mjs`: eight passed, covering default cancellation, opted-in bounded discard, excess hard-cap cancellation, UTF-8 byte accounting, invalid UTF-8, unchanged valid JSON, invalid policy, and declared oversize rejection.
- Existing identity-first HTTP: 13 passed; existing offline-report HTTP: 39 passed; existing operations contract: 24 passed.
- The final streamed diagnostic completed all 32 requests with expected 413/403 and no report writes. Its initial one-fault observation remains separate in `chunked-drain-before.json`.

Evidence and causal control drivers are retained under `tests/evidence/offline-lifecycle-independent-review/`. Only the new positive transport HTTP suite and reader contract should become catalogue gates; historical diagnostic failures remain evidence. These isolated results require integration and independent review before publication.
