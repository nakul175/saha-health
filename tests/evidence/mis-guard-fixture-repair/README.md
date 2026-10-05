# Strict MIS envelope fixture repair

Base source 8c867457, 5 October 2026. Only four older test fixtures are repaired; no production guard, catalogue, assertion threshold or current-authority expectation changes.

The adapter, send-gate and note-answer/sign-off fixtures supplied incomplete envelopes with placeholder hashes. New guards correctly refused these before their intended operation/dispute/sign-off checkpoints. They now generate payloads with the actual `mappedPayload` helper, valid approved mappings/current facts and SHA-256 of the exact payload. Synthetic partner receipts echo the actual approved wire hash. The correction fixture includes a genuine accepted predecessor key/receipt and correction-enabled mapping, plus its append-event history for trace linkage.

The replay soak's direct-created submissions previously carried fields against an empty mapping and missing source facts. Their current person/visit/weight mapping and facts now agree, using the same actual payload builder as planned deliveries. The mock EHR partner now reads `If-None-Exist` through standard case-insensitive `Headers.get`, retaining its exact conditional-create key check; otherwise normalization in the real provider wrapper prevented fault classes from reaching the mock. No fault probabilities, original assertions or reconciliation/replay invariants were removed.

Results: adapter 14, send-gate 29, note-answer/sign-off 52, replay soak 8. The deterministic seed-7 soak still exercises all required fault classes and proves zero duplicate accepted MIS records, zero blind MIS resends, zero duplicate EHR stored documents and zero repeat EHR posts. Initial full-run failures and intermediate malformed predecessor/header fixture failures are retained separately. Positive logs and structured outputs establish all existing minima.

These are injected-store/transport contract tests running actual transpiled production modules, not actual hosted-provider or D1 endpoint acceptance. No source build is required for fixture-only changes; all four focused suites and whitespace checks pass. Shared parent release documentation and catalogues remain untouched.
