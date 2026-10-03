# Development slice 10k — fixes from the review of the combined slices 10a–10j

3 October 2026 (IST). Slices 10a–10j were built in parallel by ten agents, each from `main`, and merged into one stack (`int-10a-scheduled-trigger` at the top). A separate agent that wrote none of the code then reviewed the combined code change. This slice fixes its high finding and two smaller ones, and lets the HTTP suite finish on the combined source again. Synthetic data only; formal acceptance unchanged.

## What was fixed

- **Operations view returned other slices' records (review finding H1).** `GET /api/operations` gave owners and administrators the organisation's whole operations document minus three named keys. Since 10c that document also holds incentive claims, with patient ids and evidence visit ids, so an administrator (no patient scope) and an owner outside a patient's team received them. The route now returns an allow-list: version, maintenance, reason, update time, incidents, rates, budgets and the 10d staff-id map (member identifiers kept for the people who manage members; no patient data). Every other record keeps its own scoped route. `tests/incentive-claims-smoke.mjs` now checks, as owner and as administrator, that the operations document has no claims, no patient id from the exercise and no key outside the allow-list.
- **Data export carried other members' simulated messages (M1).** The 10b `notification_messages` table was exported organisation-wide; each message carries a count from its recipient's own care scope. It is now exported like the in-app notifications of slice 6z: only the exporter's own rows, with the number of other members' rows withheld.
- **English panels inside the Hindi workspace (L2).** The imported-visit panel (10i) and the identifier search (10e) were not marked as English inside a Hindi page; both now sit in an English island like the other untranslated panels.
- **HTTP suite stopped part-way on the combined source.** The local Worker ran out of memory (V8 heap limit about 1.4 GB) late in the suite, on the stack before and after 10b. Measured on the `main` build: under `wrangler dev`, each workspace load grows the Worker's memory by about 270 KB (57 MB to 857 MB over 3,000 loads), while the same build in Miniflare with no inspector attached grew from 72 MB to 191 MB over 3,000 loads. The growth is therefore mostly the local development runtime, which keeps request data for its inspector; the suite simply got longer. The runner (`tests/run-api-smoke.mjs`) can now restart the Worker on the same persisted D1 state, and `tests/api-smoke.mjs` does so three times; the Worker's console output is kept across restarts for the safe-logs check.

## Review findings left open

- **M2 — the scheduled rotation can skip organisations.** The 10a job moves its starting point by 20 organisations every five minutes whether or not a run reached 20; a run stopped early by its statement or time bound leaves the organisations in between until the rotation comes round again, and organisations beyond the first 1,000 by id are never visited. Needs a stored cursor (a small migration).
- **M3 — household visit plan is not read-audited.** Slice 10f adds member names and open follow-up and referral titles to the household route, which 10h lists as not yet audited.
- **L1** the scheduled evaluation record is an organisation-wide commit, so a command prepared just before it gets a 409; **L3** only `fixture:` is a reserved identity prefix, while automated audit rows use `system` and `system:notification-simulator`; **L4** the scheduled job and the notification simulator read the environment from two places (the same object in a real Worker); **L5** the 10g send gate does not cover assistant runs; **L6** the operations document has no overall size bound.
- **Memory on Cloudflare not measured.** A Cloudflare Worker isolate has a 128 MB memory limit. Miniflare without an inspector still grew by about 40 KB per workspace load over 3,000 loads (resident memory, including the local D1 database in the same process); whether that levels off was not measured, and nothing was measured on the hosted Worker.

## Limits

- One independent review by an agent; no person has reviewed slices 10a–10k.
- The restarts hide any growth the suite would otherwise expose; the measurements above are the only memory evidence.
