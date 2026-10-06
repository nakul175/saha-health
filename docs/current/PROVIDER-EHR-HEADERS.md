# FHIR transport header representation repair

Before-fix independent evidence is 0b3abe8b and remains immutable. Standard Headers and tuple representations passed validation but object spreading dropped their conditional-create, content-type and preference headers at the actual transport boundary.

The bounded repair materialises the already validated headers with `new Headers` and `Object.fromEntries`. Server-owned Accept and Authorization are applied last; caller Authorization remains refused before any request. The prepared document string, hash, idempotency identifier, clinical lineage and receipt lookup are unchanged. No provider is enabled.

The new actual injected-transport contract checks all three standard header representations, all required headers, exact body and hash, zero calls for caller-authentication injection with no credential echo, and body-free metadata/patient/receipt lookup. It passes92. Affected author/existing EHR, publication, resolution, validation, provenance, probe and ABDM tests plus independent execution review pass303:395 total. Fresh framework build and TypeScript pass. Reports and SHA-256 manifest are in tests/evidence/provider-ehr-headers-fixed. No live EHR or ABDM conformance acceptance is claimed.

The historical provider-ehr-header-review driver deliberately asserts the pre-fix gap and must remain manual/direct-only. provider-ehr-headers-contract is the positive regression. This own repair needs the parent's independent review; it is not self-approved.
