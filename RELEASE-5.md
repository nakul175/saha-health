# Release 5 / v0.6 — EHR exchange foundation

27 September 2026 UTC. Engineering build delivered. **Full Release 5 acceptance is not complete: live EHR testing and ABDM workflows remain outstanding.** Synthetic data only. This engineering numbering is distinct from the BRD pilot R1/R2/R3 gates.

| Roadmap item | Delivered | Status |
|---|---|---|
| Patient matching | Explicit external ID/name confirmation, duplicate-link prevention, revocation, identity-change invalidation; no automatic merging | Implemented, local tests passed; real identity verification pending |
| FHIR import/export | Document Bundle construction, structural subset validation, reviewed imports, deduplication and conflict rejection | Implemented and tested; full profile validation outstanding |
| Selected EHR adapters | Native FHIR 4.0.1 Patient/Bundle adapter, independently configured read/write, capability tests, conditional create and receipt lookup | Implemented and mock-tested; real partner acceptance blocked by credentials |
| Consent enforcement | Local synthetic purpose/direction/date/expiry scope, revocation and in-flight rechecks | Implemented and tested; not an ABDM consent artefact |
| ABHA/HIP/HIU | Visible readiness gates and documented implementation requirements | Not implemented; requires agreed pathways, sandbox access, consent and cryptographic transport work |
| Authorised records retrieved/shared through selected real systems with consent and conformance evidence | No live credentials or gateway exchange used | Not passed |

## Added user journey

Connections → add EHR profile → configure capability directions → provision server grant → test → activate. Patient → EHR records & exchange → confirm external patient link → record read/write permissions → inspect imported history or prepare a confirmed visit → explicitly approve publication → retain a meaningful storage receipt. Imported history never replaces current visit facts. EHR corrections, prescriptions, orders and writeback of AI interpretations are not implemented by the document-storage adapter.

## Verification

340 API/database assertions, 46 FHIR/EHR contract checks, 8 EHR checkpoint checks with injected transport/CAS persistence, and 74 retained AI/MIS contract/checkpoint checks: **468 checks total**. TypeScript and production build pass. HTTP tests use actual local Worker/D1. Injected transport tests are not live network or full clinical conformance evidence. Browser checks cover EHR setup/readiness and the patient exchange interface; see VALIDATION.md.

## Data and operational compatibility

No SQL migration; optional EHR state is stored in existing patient aggregates and append-only patient revisions. Existing records remain usable. Earlier collection export remains available. Large-scale partitioning, retention/erasure, full provenance reconciliation and partner transformations remain future work. Do not roll back while publications are unresolved: older versions do not expose the new operation ledger. Resolve receipts before a rollback.

See EHR-ABDM.md for supported fields, API operations, provisioned access, known limits, official reference baseline and exact unimplemented ABDM requirements.
