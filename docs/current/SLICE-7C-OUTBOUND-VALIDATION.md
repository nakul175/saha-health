# Development slice 7c — pinned outbound FHIR validation

30 September 2026 (IST). Third part of slice 7 (ABDM). Synthetic data only; formal acceptance unchanged.

## What changed

- **One versioned rule set.** `lib/saha/fhir-validate.ts` defines `saha-fhir-r4-document-structure` version 1.0.0 for FHIR 4.0.1. It applies HL7 FHIR R4 Bundle invariants bdl-7 (unique `fullUrl`), bdl-9 (document identifier with system and value), bdl-10 (document date) and bdl-11 (Composition first), plus Saha's structural subset: permitted resource types, exactly one Composition and one Patient, every reference resolved inside the bundle, a final Composition with type, title and author, observation times with a time zone, and UCUM units for the supported LOINC vital signs. It declares no profile package and no terminology source.
- **EHR publication.** Preparing a publication validates the document first; a failure refuses with the rule set, version and specific reason, and no operation is created. The prepared operation carries a validation stamp (rule set, version, FHIR version, time), and the audit line names the rule set.
- **Mock ABDM HIP.** The mock HIP now sends each care context as a FHIR document (Composition first) instead of the earlier example collection, and validates it before encryption. A document that fails is refused with the rule set and reason; no transfer or received record is stored.
- **Mock ABDM HIU.** Received entries are validated after decryption and checksum; a failure stores nothing. Each received record keeps its stamp, and the ABHA and consent dialog shows "passed saha-fhir-r4-document-structure 1.0.0 (structure only, not NRCeS)".

## Evidence

- 20 contract assertions (`tests/fhir-validate-contract.mjs`): rule set identity and the absence of a profile package and terminology; a product-built document passes with its stamp; a regression corpus of 14 single-rule violations (not a document, bdl-9, bdl-10, bdl-11, bdl-7, unresolved reference, wrong unit, negative value, time without zone, contained resource, unsupported resource type, second Patient, non-final Composition, empty section), each refused with the rule set, version, the specific reason and "Nothing was sent"; patient mismatch; non-validation errors are not relabelled.
- ABDM transfer contract: the received bundle is a document carrying the visit's weight and the stamp; a deliberate violation (negative weight) in the HIP document is refused with the rule set and reason, with no transfer or received record stored (19 → 21 assertions). The earlier assertion that compared the received bundle with the example collection was replaced, because the HIP now sends documents.
- HTTP/D1: the prepared EHR publication carries the stamp; received ABDM records are Composition-first and show the stamp (1,487 → 1,489).
- Browser check (headless Chromium): the full mock ABDM flow showed the received record with the stamp line; all requests returned 200; no console errors. `tests/evidence/slice-7c/abdm-received-browser.json`.
- The EHR contract suites from R11 import the new module; their file lists gained `fhir-validate`. Their assertions are unchanged.
- All suites: 1,489 HTTP/D1, 738 contract/checkpoint and 21 restore assertions. Reports in `tests/evidence/slice-7c/`.

## Limits

- This is not NRCeS conformance. No NRCeS implementation guide package, HL7 validator, terminology server or ABDM mapping bundle is installed, so profile, cardinality, value-set and slicing rules are not checked. BR-INT-17 is partial.
- The rule set is pinned in source and versioned by hand; upgrading it has no owner-approval workflow yet. The regression corpus is 14 cases.
- `GET /api/fhir/{id}` still returns the unvalidated example collection used for download; it is labelled as not ABDM validated.

## Source

- HL7 FHIR R4 (4.0.1), Bundle resource, constraints bdl-7, bdl-9, bdl-10 and bdl-11: https://hl7.org/fhir/R4/bundle.html
