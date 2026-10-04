# Development slice 14a — atomic review and refusal limits, partial-withhold HTTP test, O-2 investigation

4 October 2026 (IST). Round 14, chosen by the sponsor on 4 October: close the open defects first. This slice closes two races left open by slices 13d and 13f, adds the HTTP test that 13f said was missing, and investigates the round-11 memory finding O-2. Synthetic data only; formal acceptance unchanged.

## What changed

**1. The ABHA review throttle holds under parallel requests** (review 10, medium-low; open since slice 6ab).

- Before: the server counted the requester's `abhaLinkReview` audit events, ran the link, and wrote the event afterwards. Parallel links by one person could all pass the "three a day" count before any event was written. On the local Worker, six parallel links for six numbers held outside the requester's care scope wrote six review events, not three.
- Now every `abhaLink` first reserves a slot in a new table `limit_slots` (migration 0018). One SQL statement inserts the reservation only while fewer than three are counted: holding records reviewed in the last 24 hours, plus reservations still in progress. The duplicate lookup runs only with a reservation.
- A lookup that finds a record outside the requester's scope keeps the slot under that record's id. The primary key makes it one per requester and holding record, and the review event is written only for a newly counted record. Any other outcome (linked, wrong code, a duplicate inside the scope, a validation error) gives the slot back.
- Without a slot the link is refused exactly as before: the same checks run on a copy, then the ordinary link refusal (422).
- Why a reservation before the lookup, not a count when a duplicate is found: requests that would succeed would still pass while the duplicates were being counted. The answers of a burst would then reveal every duplicate in it.

**2. The indicator refusal limit holds under parallel queries** (13d/13f limit).

- Before: the 20-a-day count of `indicator refusal` events had the same race. With 17 refusals recorded, eight parallel refused queries were all answered as refusals (25 in the day).
- Now each indicator query reserves a slot before it is run. A whole refusal, a cohort below 5 or a partial differencing withhold keeps it, counted before the refusal is recorded or shown. Any other result gives it back.
- Without a slot the query gets the 429 it got before. The catalogue and question interpretation reserve nothing.
- A partial withhold is now counted and recorded as soon as the releases are screened, before a CSV file is made. Its refusal event therefore comes before the `indicatorExport` event, not after.

**Shared details** (`lib/saha/limit-slots.ts`):

- The windows are unchanged: an event exactly 24 hours old still counts for the ABHA throttle (`at>=`) and not for indicator refusals (`at>`).
- A reservation whose request was stopped half-way stops counting after 10 minutes.
- If the write that keeps a slot fails, the reservation is not given back, so it still counts until it expires.
- Migration 0018 carries the last day's `abhaLinkReview` and `indicator refusal` events into the table, so deploying it does not reset either limit.
- The table holds ids and times only. Data exit lists it as excluded protection state, like the differencing ledger.

**3. HTTP test of a partial differencing withhold** (13f limit). An organisation has 7 women and 2 men. A definition counting everyone and one counting women are asked for together; the second would reveal the 2 men, so only it is withheld.

- The on-screen view returns the first result and withholds the second.
- The view is recorded as `Indicator query partly withheld: 1 result withheld …`, and the CSV export as `… (CSV export) …`.
- Both are counted.
- After 17 cohort refusals, a third partial withhold is the 20th refusal, and the next CSV export is refused with 429.

**4. O-2 investigated: not an application leak.**

- Method: the built Worker ran in Miniflare with a V8 inspector. Before each sample, every isolate's garbage was collected and its live heap read; heap snapshots were compared. Control Workers with no Saha code ran without an inspector.
- The application keeps about 11.5 MB of live JavaScript heap, and it does not grow with workspace loads: 11.55 → 11.61 MB over 3,000 loads after the first round (about 0.02 KB per load).
- The resident memory that grows is garbage and the native memory it holds, which the runtime keeps until V8 collects it. Over 4,000 loads without a forced collection the process grew from 269 to 551 MB; one full collection brought it back to 322 MB within five seconds. With a collection before each sample it levelled at 249 to 266 MB.
- A one-file Worker with no Saha code that writes and reads D1 grows the same way (107, 46 and 24 KB per request by round).
- Nothing in the application was changed for O-2. `tests/nfr/memory-growth.mjs` gains a heap mode (`SAHA_NFR_HEAP=1`) with a budget on the application's live heap growth, so a real application leak would now be caught.

## Measurements

All local, Node 22.22.2, shared 2-core Linux container, synthetic data, 4 October 2026.

**Races** (`tests/limit-race-smoke.mjs` run on its own against a `wrangler dev` Worker; 30 checks):

| | Build of `main` 2adfbde1 (before) | This slice (three runs) |
| --- | --- | --- |
| Six parallel links for six held numbers: review events | 6 | 3 |
| Mixed burst (two free numbers, four held numbers): review events | 4 | at most 3 |
| 17 refusals, then eight parallel refused queries: answered as refusals / 429 | 8 / 0 (25 in the day) | 3 / 5 (20 in the day) |
| Checks passed | 19 of 30 (the other failures are the missing table) | 30 of 30, each run |

**O-2** (1,000 owner workspace loads per round at concurrency 4, after warm-up; RSS of the workerd processes; "live heap" is the application isolate's V8 heap after a full collection):

| Run | RSS (MB) after warm-up, then after each round | Application live heap (MB) |
| --- | --- | --- |
| Inspector, every isolate collected before each sample | 191 → 251, 249, 250, 266 | 10.98 → 11.55, 11.59, 11.60, 11.61 |
| Inspector, no collection (the O-2 condition) | 269 → 466, 491, 537, 551; 322 after one collection | 11.41 after that collection |

Heap snapshots of the application isolate over 200 loads grew from 10.97 to 11.17 MB. The growth was compiled code (+155 KB) and strings (+41 KB), which is the JIT warming up; no application object type grew. Every other isolate (D1, assets, entry) held under 2 MB live.

Controls without an inspector (3 rounds of 1,000 requests; KB of RSS per request by round):

| Worker | KB per request | RSS (MB) |
| --- | --- | --- |
| One file, returns a 30 KB JSON body | 13, 6, 11 | 58 → 88 |
| The same with no `console.log` | 12, 6, 10 | 57 → 85 |
| One file, writes one row to D1 and reads 250 | 107, 46, 24 | 80 → 253 |
| Saha bundle, unauthenticated workspace request (401, no database work) | 80, 35, 38 | 108 → 258 |

None of these released memory after 30 seconds idle; nothing triggered a collection. The heap-mode run of `tests/nfr/memory-growth.mjs` is recorded in `VALIDATION.md` and the evidence folder.

## Tests

- New `tests/limit-slots-contract.mjs` (unit, 15 checks). The real migrations run in SQLite behind a D1 shim that adds 1–3 ms to each round trip, so requests interleave.
  - Migration 0018 makes the table and carries the last day's events, including the latest review of a holder.
  - 40 parallel reservations with a limit of 3 give exactly 3, and 60 with a limit of 20 give exactly 20.
  - Control: a count followed by a separate insert under the same load admits more than 3, so the model can tell a race.
  - The ABHA pattern: 12 parallel requests for distinct holders give exactly 3 reviews; 8 for one holder give 1.
  - Five mixed bursts of 30 never count more than 3 at any moment and leave nothing pending.
  - The window boundary for each limit, expiry of an abandoned reservation, and a holder reviewed again after a day.
  - A failed write keeps the reservation; a failed request gives it back; counting twice counts once.
  - The plans use the primary key.
  - Source checks that both routes reserve before they look anything up and count before they record.
- New `tests/limit-race-smoke.mjs` (HTTP, imported by `tests/api-smoke.mjs`; 30 checks plus its requests). It covers the ABHA and indicator races and the partial withhold above, each in its own organisation, and fails on the build before this slice (table above).
- Existing tests whose source checks followed the old code:
  - `tests/eighth-review-fixes-contract.mjs`: the three throttle source patterns now match the reservation; still 18 checks.
  - `tests/audit-query-plan-contract.mjs`: the two audit counts the limits no longer make (`abhaReviews`, `aggregateViews`) are replaced by checks that they are gone; still 12 checks.
  - `tests/data-exit-contract.mjs` follows migration 0018 (`SCHEMA_MIGRATION`).
  - `tests/eighth-review-smoke.mjs` and `tests/review-leftovers-smoke.mjs` (the sequential behaviour) pass unchanged.
- `tests/nfr/memory-growth.mjs`: optional heap mode with one more check (the application's live heap growth in the last round, budget 2 KB per load). The default run is unchanged. `tests/lib/miniflare.mjs` gains an `inspectorPort` option and `isolateHeaps()`.

## Limits

- The bound now holds against parallel requests reaching one D1 database, which runs one statement at a time; it was tested on the local runtime, not on hosted D1.
- Up to three ABHA links, or 20 indicator queries, by one person can run at once. A fourth (or 21st) concurrent one is refused as if the limit were reached, even if the earlier ones end up giving their slots back. One person rarely runs these in parallel, and it is the price of deciding before the lookup.
- A reservation left by a request stopped half-way counts for 10 minutes. A request that took longer than that between reserving and finishing could exceed the bound by one; nothing in these routes takes that long.
- If the write that turns an ABHA reservation into a review fails, the requester is still refused (as before) and the reservation counts until it expires, but no review event is written for that attempt.
- O-2 is explained for the local runtime only. Cloudflare's 128 MB isolate limit and how the hosted runtime schedules collections were not measured. The heap-mode figures are taken with an inspector attached, which changes what is held. The memory that a full collection did not return (322 MB against 191 MB at the start) was not traced inside workerd.
- The ledger byte use and population-check cost at scale (review 9) remain unmeasured.
- Built by one agent; no independent review.
