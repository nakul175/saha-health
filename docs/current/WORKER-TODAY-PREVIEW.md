# D02 — Mobile Today entry candidate

9 October 2026. Reference main: 43f445acf4c54352cd2084e0bcd88bfbf605d757. Links to issue #175 and planning PR #173; the D01-D08 definitions there are not renumbered.

## Implementation boundary

New opt-in route `/worker-today/` reads the existing `/api/workspace` and opens `/app?patient=<encoded-id>`. It is restricted to a supported active-ASHA synthetic/training snapshot and does not mutate records, choose a provider, grant authority, invent clinical priority or change default `/app`. The current protected app handles scope revalidation and guided visit capture/review/save. No new backend save implementation or end-to-end qualification is claimed.

The entry has Today, People and My Space, assigned-record filtering, duplicate-name/contextual search, one next existing record, error versus empty states, readable controls and no private browser persistence. It preserves source order, not a newly calculated clinical ranking. The list includes overdue/upcoming records and is explicitly not date-filtered. Unsupported paging and maintenance return the existing workspace path. Pagehide/refused refresh/offline clears private presentation state. An unavailable connection never becomes an empty successful list.

The underlying worker OS remains the goal; this small entry deliberately does not add a placeholder chatbot. Learning, earnings and conversation are stated as not implemented here. Existing offline work is linked, not newly qualified. No new permissions, departmental workflow, database or migration is introduced.

## Tests and evidence

Locally executed: `node tests/worker-today-contract.mjs` — 25 presentation-adapter checks passed, zero failed, using synthetic snapshots. Covers assignment filtering, role/environment/identity binding, paging and malformed refusal, duplicate names/IDs, source immutability, fixed same-origin links and minimised output. `node --check` passed for both new JavaScript files.

Local browser command used Chromium through Python Playwright 1.57.0. Navigation to the local test server was blocked with `ERR_BLOCKED_BY_ADMINISTRATOR` before any browser assertions. No policy bypass was attempted. Thus there is no local browser layout, screenshot or keyboard pass. The committed browser test is runnable on an authorised runner; `.github/workflows/worker-today.yml` has contents:read only, no secrets/deploy and mocks only the existing workspace response. Its actual result must be observed; authoring it is not execution evidence.

Original app type/build/integration checks were not run in this partial local checkout; the original-source baseline is separately running under PR #173. Existing backend, physical-device, full-offline, clinical, ASHA and government acceptance remain pending.

## Before merge

This is a draft candidate, not release approval. In a complete checkout, run the existing catalogue, lint, type/build/security and affected tests, then follow `scripts/update-baseline.py` for the newly tracked runtime/test paths. Do not replace or shrink the historical source manifest to hide missing files. The source-baseline update and precise old acceptance-case mapping have not been completed here. Register/adopt the new suite under the existing catalogue/minima procedure without reducing an old assertion count. The separate Python presentation suite is explicit, not silently claimed part of the existing test runner.

Update the implementation boundary, next-delivery and evidence/assessment links with actual results before acceptance; no original requirement is promoted by this candidate. Main remains unchanged; no host, deployment timer, provider, paid API or real recipient is touched. A main merge can trigger the independently polling DigitalOcean updater.
