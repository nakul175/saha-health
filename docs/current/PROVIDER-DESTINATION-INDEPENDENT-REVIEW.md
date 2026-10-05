# Independent provider destination review

Reviewed author stack b434bce5, b9482d72, 514b77ae, 66f18064 and aef66f47 on canonical e89cf6b7, preserving decoded-source repairs 4442b2ed. No real providers, credentials or clinical data were used.

## Finding: conditional FHIR headers lost for accepted representations (P2)

`assertFhirEnvelope` validates standard `Headers` and tuple forms using `new Headers(init.headers)`. `fhirRequest` then spreads their original representation into an object. A `Headers` instance contributes no conditional headers; a tuple array contributes numeric keys. The injected actual transport therefore receives no `If-None-Exist` for either form, despite validation requiring it. This weakens the conditional-create idempotency contract. Existing executeEhr callers use plain objects; this is a reusable immediate-transport defect, not a client-selected public-route injection. The original document body is unchanged.

Historical `provider-ehr-header-review.mjs` demonstrates both drops: 54 passing diagnostic assertions, including the original 50 author assertions. It must remain manual/direct-only after repair; its assertions describe the pre-fix defect. Evidence is `ehr-headers-before.json`.

## Independent verification

460 author/affected-regression assertions passed: MIS envelope41, EHR envelope50, specialised envelope41, MIS contract45/delivery16, EHR contract48/execution33/probe20/resolution13, ABDM transfer21, aggregate delivery12/population4, enrolment45, FHIR provenance51/validation20. Additional positive execution reviews passed EHR47 and MIS45; historical header diagnostic54 passed: 606 total assertions. Fresh framework build and TypeScript passed. Hashes identify saved independent reports.

The EHR execution review adds malformed mapped-body and changed approval-hash refusal before any transport; two service-audit windows change a known unrelated patient's name and verify zero clinical POSTs. MIS execution similarly changes known unrelated narrative at the service-audit window and verifies zero provider calls/attempts while retaining the exact original body. These execution modules use injected CAS/audit/transport, not hosted HTTP/D1 acceptance. The EHR probe regression uses a SQLite-backed D1 shim and real store/audit/dispatch.

The final aggregate guard repeats current suppression checks even on a valid rehashed small cell, refuses malformed block/cell shapes, and preserves clean authorised clinical values. Review found no other actionable defect in this bounded family stack. This does not close all B18 provider/hosted acceptance, and does not independently approve our own prior decoded-source repair.
