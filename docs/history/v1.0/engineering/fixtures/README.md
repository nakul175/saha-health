# Synthetic reference fixtures

`schema_examples.json` contains shape-valid examples for the proposed internal schemas. They use deterministic synthetic identifiers and are not clinical records, complete workflow fixtures or evidence of semantic validity. Timestamp ordering and relationships require scenario-specific setup before application testing.

`events/` contains reference-only event envelopes. `provider_manifest.json` and `connector_profile.json` demonstrate configuration fields and explicitly have no production approval.

The 364 `FX` entries in `../fixture_recipes.json` are test setup recipes. Engineering must implement them against the actual application and approved protocol. They are not represented as executed fixtures.
