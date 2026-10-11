# Product-management integration
Read PM-MAPPING.json for the explicit concept mapping and inspected catalogue IDs. This is a reference adapter, not a machine-compatible input document for the PM checker. Canonical product authority remains in the installed product framework.

Use Strategy and Release goal in planning traceability. Link operating release candidate/build beneath the release goal. Bind shared Definition of Ready/Done checklist versions and AI assurance to PRODUCT-CONTEXT; reuse their criteria rather than making a second checklist authority. QA supplies observed verification and operational evidence for the relevant PM stage gates. Product-document structural quality, implemented correctness, approval and delivery stay distinct.

The inspected reference is edition 3.0-generic, identified by catalogue hash. Review the installed edition's actual field IDs and rules before enabling an adapter; v4.1 references in reviewer feedback are not proof of compatible local schemas. Record actual source locators/version/hash in the adopted binding.

## Field membership validation (v1.2)
Canonical fields are taken only from catalogue.fields[*].id. Stage-gate prefixes and legacy aliases are separate mapping keys; the canonical replacement fields are mapped directly. Run `python3 checker/check_pm_mapping.py --catalogue /path/to/installed/catalogue.json`. The bundled extracted index supports offline tests and carries the full inspected catalogue's hash. It is not the full catalogue; adopters validate against their installed bytes and edition.
