# Durable command delta read auditing

5 October 2026. Bounded B04 / BR-SEC-08 software change based on integration `92ee70a7`. A certified patient command can answer with a partition delta. Previously that branch reloaded its target partition with `loadFor`'s default non-material setting and returned patient data without the corresponding response-read audit. The full snapshot response was already audited.

The delta branch now reloads current scope, then awaits an existing access-only chained audit batch before constructing and returning the snapshot. It writes one `viewWorkspace` summary explicitly labelled “response to a command”, with counts of the returned partition rather than the whole care scope. Each actually permitted patient returned in full receives a `viewPatientRecord` event with the same response label and access route. These full-record events do not reuse the screen-open or paged-window coalescing logic. Details contain counts, authority and access identifiers, without names, facts or notes.

The clinical mutation and its idempotent command receipt commit before this read audit. If the audit cannot be written, the response fails closed with the established 503 access refusal; no result, delta or snapshot is returned. Retrying the same key reaches the saved-receipt path, rechecks current role/patient scope and returns its existing audited snapshot shape. It does not execute the clinical mutation again. Access-only batches do not move organisation or patient revisions, record versions or command receipts. Partition certification and non-delta response behaviour remain unchanged.

## Local verification

- Actual built Worker and Miniflare D1: 18 checks passed, with fresh synthetic identities and database.
- A D1 trigger rejects the second event in a partition read batch: both read events roll back, the command receipt and visit remain saved, and the response contains no patient data.
- After removing the fault, same-key retry returns the saved visit id without changing visit/record versions, organisation or patient revision, or creating another visit.
- A scope above 500 patients genuinely activates paged workspace reads. A certified command still returns only its target patient partition despite a different requested window; audit counts and identifiers match the actual partition.
- Repeated partition disclosures produce fresh full-record read events. Read detail omits the synthetic patient name and private note/measurement values.
- Removing patient assignment while retaining active ASHA membership, then withdrawing membership, both refuse saved receipt disclosure without repeating mutation.
- Existing read-audit contracts: 52 passed; scoped-read contracts: 27 passed. TypeScript and framework build passed; diff whitespace check passed.

Evidence is in `tests/evidence/delta-read-audit/`; the new route suite is `tests/delta-read-audit-http.mjs`. It requires a built local Worker and temporary local D1 runtime. Add that file to the integration suite list in `scripts/test-catalogue.mjs` when integrating; shared catalogue and generated requirement/validation documents were deliberately left to the integrator.

## Limits

This is local synthetic software evidence, not hosted or formal requirement acceptance. Current read authorization uses the existing fresh scoped load and access-audit commit machinery; this batch does not redesign all read transactions. General command authority metadata, encrypted offline open reporting and independent external checkpoint publication/key lifecycle remain separate B04 clauses. No provider activation or real external sends were performed.
