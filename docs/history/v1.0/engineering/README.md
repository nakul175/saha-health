# Engineering reference assets

These assets accompany the Health AI specification pack v1.0 and are not an implemented production system.

| Asset | Purpose |
|---|---|
| openapi.json | Proposed 74-operation internal OpenAPI 3.1.1 contract |
| events/ | 16 reference-only JSON Schema event envelopes |
| 001_foundation.sql | PostgreSQL foundation blueprint with core tenant RLS policies; native execution and runtime grants remain unverified |
| state_transitions.json | Core allowed paths and guards; other enum states require a documented transition before use |
| fixtures/ | Synthetic shape examples and test-only provider/connector manifests |
| fixture_recipes.json | 364 setup recipes to implement against the application |
| requirements_traceability.json | 176 source requirements with design and test links |
| test_catalogue.json | All application definitions with Not run status |
| adrs/ | 12 proposed architecture decisions |
| *.mmd | Editable architecture, relationship and recovery diagrams |
| reference_model.py | In-memory illustration of selected invariants |
| test_reference_model.py | 36 executable invariant checks |
| validate_contracts.py | Bounded structural/reference/example validator |
| check_wireframe_state.mjs | Prototype state checks with a minimal DOM stub |
| VALIDATION.md | Executed evidence and remaining verification limits |

From this directory, with Python 3 and Node available:

```bash
python3 -m unittest -v test_reference_model
python3 validate_contracts.py
node check_wireframe_state.mjs
```

The Python checks require only the standard library. The Node check reads the HTML one directory above; preserve that relative path. None of these commands sends patient data or connects to an external system. The linter implements only the JSON Schema keywords used here and must not be used as a general conformance validator.

Before production: implement transactional persistence and concurrency, trusted identity and policy, cryptographic controls, partner contracts and clinical protocols; validate the actual database role, API toolchain, FHIR package, device behaviour and operational environment. The specification documents define the required evidence and accountable gates.
