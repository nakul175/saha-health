# Adapter operation scope fixture repair

The new execution-boundary normal-scope check revealed an incomplete EHR patient fixture in `tests/adapter-operations-contract.mjs`. Its worker belonged to `t1` but its patient had no team. Actual stored failure was `Not sent: Patient scope changed. Nothing was sent.` The patient GET was never reached, so the injected operation withdrawal after that GET did not occur and no adapter-operation refusal object should have existed.

The fixture now assigns the patient to `t1` and asserts exactly one authorized patient GET before the injected operation withdrawal. All 14 existing cases pass with their original refusal stage, operation, message and trace assertions preserved. No production authorization or refusal semantics changed. Dedicated evidence is in `tests/evidence/adapter-operation-scope-fixture/result.json`.
