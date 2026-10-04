# Development slice 13e — audit log performance (round-11 O-1, O-4; O-2 measured)

4 October 2026 (IST). At the sponsor's request ("fix all"), this slice addresses two of the round-11 non-functional findings ([slice 11d](SLICE-11D-NON-FUNCTIONAL.md)) and measures the third again. Synthetic data only; formal acceptance unchanged.

## What changed

- **O-4 — workspace loads no longer slow down as the audit log grows.** Every workspace load reads the organisation's newest audit events, and several routes count one person's recent events of one kind (identifier-search and indicator limits, the ABHA and identifier-conflict review throttles, the repeat-read window). The only audit indexes were (organisation, person, time) and (organisation, sequence). So the newest-events read sorted the organisation's whole log on every load (SQLite: `USE TEMP B-TREE FOR ORDER BY`), and the counts scanned it. Migration 0017 adds two indexes: (organisation, time) and (organisation, actor, action, time). No query changed.
- **O-1 — fewer audited reads refused under contention.** An audited read first appends a chained audit event. Readers racing for the same chain head retried at once and in lockstep, so a burst could use up all six attempts and the read was refused (503, nothing shown). A commit that loses the race now waits a random time that grows with each attempt (`chainBackoff`: up to 20, 40, 80, 160 and 320 ms; at most about 620 ms in all) before it is rebuilt on the new head. Commands use the same path, so they also give up (409) less often. Fail-closed is unchanged: a read whose event cannot be written is still refused.
- **O-2 — memory growth measured again; not fixed.** The indexes and the backoff do not change it (below).

## Measurements

All in the local build, synthetic data, one run each; hosted D1 and a Cloudflare isolate were not measured.

| | Without migration 0017 | With migration 0017 |
| --- | --- | --- |
| Seconds per 1,000 owner workspace loads, rounds 1–4 (Miniflare, concurrency 4) | 24.9, 26.6, 29.7, 32.1 | 23.8, 23.1, 23.6, 24.3 |
| Worker memory growth over 4,000 loads (KB per load, by round) | 235, 71, 30, 29 | 228, 69, 55, 37 |
| Worker resident memory after 4,000 loads | 559.5 MB | 582.9 MB |
| Newest-events read on SQLite, 5,000 → 80,000 events (scratch measurement, 50 runs each) | 5.5 → 84.8 ms | 0.46 → 0.45 ms |

Both rows of the Miniflare table come from `tests/nfr/memory-growth.mjs` with `SAHA_NFR_ROUNDS=4`, run back to back on the same 13e build. The only difference was whether migration 0017 was applied. Without it, loads slowed by 29 % over 4,000 loads, matching the O-4 trend. With it, they stayed flat (+2 %). The memory figures barely move, so O-2 is not explained by the audit log's size and stays open.

For O-1, a model was used: the real migrations and the real `recordAccess` and `persist`, on in-memory SQLite behind a D1 shim that adds 1–3 ms to each round trip, with 24 readers at once on one organisation, five times. Before the backoff, 50 of 120 reads were refused. After it, none were, with 248–262 race losses absorbed.

## Tests

- New `tests/audit-query-plan-contract.mjs` (unit, 12 checks):
  - migration 0017 adds both indexes;
  - each audit query listed appears in its source file as written, and its plan uses an index;
  - the per-load newest-events read never sorts the whole log;
  - at 40,000 events the newest-events read costs about the same as at 5,000 (ratio below 3), and the search-limit count stays under 2 ms.
  Removing the migration fails it.
- New `tests/audit-contention-contract.mjs` (unit, 3 checks): the backoff is bounded and grows with each attempt; 24 concurrent readers five times are all recorded with none refused; the chain stays intact and verifies.
- `tests/data-exit-contract.mjs` follows migration 0017 (`SCHEMA_MIGRATION`).

## Limits

- **O-2 stays open.** The Worker's resident memory still grows with workspace loads in Miniflare and did not level off within 4,000 loads. A leak is neither shown nor ruled out, and Cloudflare's 128 MB isolate limit has not been measured. Next step: heap snapshots of the local Worker, and memory on the hosted Worker.
- The backoff reduces lockstep retries but does not remove the chain's single point of serialisation. A much larger burst on one organisation can still exhaust the attempts.
- The two indexes add a small cost to every audit insert, and storage proportional to the log. They were not measured on hosted D1.
- Built and reviewed by one agent; no independent review.
