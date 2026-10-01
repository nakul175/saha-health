# EHR exchange and ABDM implementation boundary — v0.6

## Supported workflow

An owner registers an HTTP EHR profile using its **FHIR service base URL**, configures read and/or document-storage capabilities, and provisions a dedicated credential. The server checks `GET [base]/metadata`. Activation requires FHIR 4.0.1 JSON, Patient read, and the configured Bundle operations. Write additionally requires conditional create and identifier search. This is a capability declaration check, not a partner conformance certificate.

The care worker opens **EHR records & exchange** on a scoped patient:

1. Confirm the exact external Patient resource ID and external name against the source system; record the matching reason. No fuzzy matching, automatic merge, ABHA assertion or identity proof is inferred. A duplicate active external reference cannot be linked to a different local person.
2. Record the patient's general sharing choice, then a separate local permission for each linked EHR and direction. Purpose is care coordination; data type is the supported visit document; observation date range and an expiry within 30 days are mandatory. Identity changes invalidate the link for new exchange. Revoking a link revokes its permissions. Record capture never requires ABHA.
3. Import a synthetic FHIR document file, or retrieve a known Bundle ID from an activated EHR. Review patient identity, observation time, units, narrative and provenance. Accepted review stores external history separately; it never copies historical values into a current visit.
4. For a current confirmed visit, prepare the exact outgoing document, inspect it, and approve one publication within 15 minutes. The native adapter checks the remote Patient ID/name, rechecks authority immediately before POST, and uses FHIR conditional create. A saved checkpoint precedes external traffic. Unconfirmed writes remain unresolved; lookup searches the same document identifier, with no automatic resend. Since slice 7f an owner can declare, per connection and from the partner contract, that the identifier search is authoritative (see below); without that declaration an empty or multiple search result leaves the publication unresolved.

`accepted` means the EHR acknowledged storage of a matching Bundle, not that its clinical user interface consumed the document. Native systems that use transactions, DocumentReference, proprietary endpoints, HL7 v2, CDA, CSV or SFTP need additional adapters. This release does not connect to every EHR.

## Server provisioning

Set dedicated server-only values (never enter a secret value into the UI):

```
SAHA_EXTERNAL_APIS_ENABLED=true
SAHA_EHR_PARTNER_KEY=<approved bearer token>
SAHA_EHR_CONNECTIONS=[{"organisationId":"actual-org","integrationId":"actual-profile-id","baseUrl":"https://partner.example/fhir","credentialBinding":"SAHA_EHR_PARTNER_KEY"}]
```

The grant binds the exact organisation, connection, base URL and credential name; an origin-only grant is insufficient. HTTPS only, no credentials/query/fragments in base URLs, no redirects, no localhost or IP-literal endpoints. Operators must verify approved domain ownership and network routing; this is not a DNS rebinding firewall. OAuth/SMART token issuance and refresh are not implemented; a partner-approved bearer credential is required. No credential values are included in snapshots or logs.

GET operations: `metadata`, `Patient/{exact-id}`, `Bundle/{exact-id}`, and identifier search on Bundle. No arbitrary URL supplied by imported resources is fetched. POST is limited to Bundle document creation with `Prefer: return=representation` and `If-None-Exist: identifier=<encoded urn:saha:documents|document-id>`. Conditional create must be atomically supported by the partner. The response must preserve the document identifier and entries; transformations are deliberately left unresolved. HTTP failures, changed content, empty/multiple search matches or unsupported acknowledgement formats never count as acceptance. There is no POST retry button or background scheduler. Metadata/test and read failures are surfaced to the user; write uncertainty is retained for lookup.

**Receipt lookup policy (slice 7f).** Each EHR connection may carry a lookup policy set by an owner with a reason: whether the partner contract makes identifier search authoritative, the partner's consistency delay, and a named reconciliation owner (an owner or administrator). Default: not authoritative, as above. With an authoritative search, a lookup that finds no document after 45 seconds from the publication checkpoint plus the stated delay closes the publication as `not-stored`; a new publication of the visit may then be prepared and approved as usual (never sent automatically). More than one match, or one match that differs from the published document, is a `conflict` that holds the visit and is shown to the reconciliation owner in the exception queue. Each lookup checks the lookup operation, is limited to 24 per publication, and is recorded as an external request in the audit chain before it is sent; it never sends a document. The write request must start within 30 seconds of the checkpoint. See [slice 7f](docs/current/SLICE-7F-EHR-RESOLUTION.md).

## FHIR document subset

The prior `?format=collection`/default synthetic export remains compatible. `?format=document` creates a document Bundle with identifier, timestamp, full URLs, Composition first, one Patient, Encounter, author Practitioner, Organization and linked observations. Four numerical values are mapped: weight, temperature, systolic and diastolic BP using LOINC and UCUM. Gestational age and cough duration remain documentary narrative rather than unverified coded resources. Notes are escaped into XHTML on export; imported XHTML is shown only as escaped source text, never executed.

Import is deliberately narrow: one final Composition, one matching Patient, resolved internal references, supported resource types, explicit observation timezones, final/amended/corrected Observation status, and exact supported units. Recognised observations are displayed without unit conversion; unknown codes are flagged and retained only in the source. All observation dates, including unsupported codes, and encounter period endpoints must fall within the local permission range. Narrative claims cannot be date-validated semantically. No contained resources, modifier extensions, nested sections, attachments, orders, prescriptions or clinical reconciliation are supported. File provenance is unverified; API provenance identifies the configured EHR.

These are structural subset checks, **not full FHIR validation or NRCeS profile validation**. No ABDM `meta.profile` assertion is added. The official validator, terminology validation and authenticated partner round-trip remain acceptance requirements. Synthetic imported documents are limited to 12,000 JSON characters, 40 entries, 20 documents and 20 publication operations per patient; up to 20 links and 30 permission records. Structured state uses existing patient JSON and append-only revisions in D1; no SQL migration. Retained snapshots can grow and need production retention/partitioning work. Revocation blocks new exchange and review; previously stored records remain visible to currently authorised care members for provenance, rather than being recalled or silently erased. This is not ABDM data-erasure policy implementation.

## ABDM: implementation is still pending

| Workflow | Current evidence | Remaining implementation / external dependency |
|---|---|---|
| ABHA | Local patient works without ABHA; no ABHA identifiers collected or verified | Authorised sandbox onboarding, identity challenge/verification, opt-out and correction workflows |
| HIP | Synthetic FHIR document construction and reviewed native EHR publication | ABDM care-context discovery/linking, authenticated consent notification, request validation, encrypted transfer, acknowledgements, sandbox acceptance |
| HIU | Local permission scoping and reviewed native EHR retrieval | Authenticated consent request/artefact lifecycle, HIP discovery, expiry/revocation notifications, key agreement/decryption, data erasure, sandbox acceptance |
| Conformance | Published reference baseline recorded below, structural subset checks | Validate against agreed official packages and terminology; preserve validation reports and witness partner scenarios |

A manually recorded local permission is never treated as an ABDM consent artefact. A worker-confirmed EHR link is never treated as verified ABHA. The read/write adapter does not call ABDM gateways. Readiness labels cannot enable these absent capabilities.

## Official reference baseline

Reviewed 27 September 2026 UTC. NRCeS's published page identifies version **6.5.0**; its separately hosted preview is 7.0.0. Pin the actual package/version agreed for partner onboarding rather than treating a preview as the production contract.

- [NRCeS published implementation guide](https://nrces.in/ndhm/fhir/r4/)
- [NRCeS DocumentBundle](https://www.nrces.in/ndhm/fhir/r4/StructureDefinition-DocumentBundle.html): document envelope constraints include identifier, timestamp and leading Composition.
- [NRCeS WellnessRecord](https://nrces.in/ndhm/fhir/r4/StructureDefinition-WellnessRecord.html): a profile-specific clinical document; this release does not claim conformance to it.
- [HL7 FHIR R4 Bundle](https://hl7.org/fhir/R4/bundle.html)
- [HL7 FHIR R4 RESTful API](https://hl7.org/fhir/R4/http.html): CapabilityStatement, MIME types, create/read/search and conditional create inform the native adapter.
- [Official ABDM sandbox documentation](https://sandbox.abdm.gov.in/sandbox/v3/new-documentation): onboarding and milestone source. The detailed dynamic milestone page could not be retrieved in this environment; no live gateway API implementation was inferred from third-party guides.

## Acceptance still required

Select a real EHR and its read/write contract; obtain authorised synthetic test access; prove patient matching, consent withdrawal during exchange, conditional-create deduplication and receipt lookup after a lost response; verify how documents reach the clinician workflow. Independently implement and test the chosen ABDM pathways with sandbox credentials, official FHIR validation evidence, encrypted exchange and consent lifecycle. These gates are not passed by local fixtures.
