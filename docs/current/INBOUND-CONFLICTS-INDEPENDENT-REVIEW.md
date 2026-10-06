# Independent B09 frozen queue review

5 October2026. Exact author `2158e12a4e2ed5b0f83408ab1c620c5ebd5311f3`, cold checkout, no application source changes. Software review of BR-DATA-07/BR-INT-06/BR-INT-21; formal/device/partner acceptance remains pending. Retrieval handoff and scheduled receipt processing remain separately required interfaces.

## Original grounded findings (repaired separately)

- P2: a suspended assigned clinician blocks controlled assignment to a new active scoped clinician. Both `inboundWrite` and `applyInbound` require the old clinician's current authority before assignment. Actual supported invite/join and suspension witness returns403 instead of accepting a historical-ID-preserving handoff. Keep the current actor/new clinician authority and stale clinical basis checks; retain denial for decisions and saved clinical receipts after withdrawal.
- P2: the unmeasured new POST wrapper leaves unread anonymous request bodies. Actual320 pooled/streamed normal fetches return296 correct401/403 responses and24 transport failures; five unchanged-table checks pass. No retries or Connection-close workaround. Add bounded transport-only cleanup without parsing, clinical writes or metrics, consistent with the root's independently grounded burden wrapper repair.
- P2: mixed pressure field choices relabel retained local measured data. Actual measured121/81 at5October, incoming systolic120/local diastolic81 choice succeeds200, leaving120/81 with shared bloodPressure source reported and1September timestamp. The retained measured diastolic81 is now wrongly attributed. The existing model has one pressure-pair provenance; reject incompatible component choices/times or implement honest explicit component lineage. Do not fabricate historical provenance.

The author owns narrow separate repairs. The corresponding JSON/logs and failing intended-positive drivers are preserved under `tests/evidence/inbound-conflicts-independent/`; before files must not be overwritten after repairs.

## Independently verified positive scope

Fresh build/types and75 original contracts pass. Unchanged actual Worker/D1 HTTP42 and Chromium phone13 pass. Extended actual authority HTTP49 retains those42 and adds supported care-purpose narrowing: saved decision replay/read403, then historical receipt recovery after restoring normal care. Persisted synthetic accepted-receipt drift, uncertain state and expired source permission refuse a new clinical decision409; retained accepted snapshot remains unchanged. These fixture perturbations are deliberately synthetic and do not claim an actual partner receipt.

Original/local/incoming versions are retained and merges remain unconfirmed local drafts. Source/raw approved hashes stay byte-contract hashes; NEW decision canonical content hashes are checked against reloaded D1. Exact source/current local/patient/connection/permission/accepted-operation fingerprint is required for decisions. Original confirmed visits/accepted records are preserved. Scoped reads audit first and fresh-check patient/current actor; read-audit fault and role withdrawal refuse. Owner status does not widen patient scope and own-proposer clinical decisions refuse. Historical source evidence remains care-scoped when exchange/reviewer eligibility has ended, consistent with the documented local audit-history boundary.

The present entry is documentary file FHIR with declared versions/effective times. It does not authenticate partner-origin delivery, implement conditional remote amendment or scheduled unknown-receipt lookup. No provider is enabled, no outbound mutation or blind uncertain send replay occurs. The accepted operation witness is an explicitly labelled seeded synthetic persisted receipt; local amendments and decisions are supported real commands/routes. Browser tests are390px, not physical Android acceptance.

Review drivers are separate from original author reports. No shared catalogue, requirements, generated documentation, migrations or canonical source was edited. Initial pressure probe's unrelated unread-body socket failure is retained; the target probe omitted that unrelated anonymous fixture block without retrying or weakening the clinical assertion. Final clearance requires the exact repair SHA and unchanged intended-positive before drivers, current-source suite reruns and parent canonical/hosted gates.

## Independent repair clearance

Exact author repair `5cc44cf6` was cold-cherry-picked after the immutable before evidence `cf9e2efe` (local source equivalent `e0554708`). Fresh build/types pass. Independent reruns total535 positives:85 contracts,50 actual handoff HTTP,49 authority HTTP,13 pressure HTTP,325 pooled/streamed transport checks and13 Chromium phone checks. Results and reproducible drivers are separate under `tests/evidence/inbound-conflicts-independent-after/`.

All three findings are closed within the verified software boundary. Replacement assignment preserves the historical participant and snapshots; the old reviewer remains denied, and a stale original basis still prevents the replacement's clinical decision. Mixed pressure source choices and mismatched observation times refuse without clinical mutation or receipt, while both local pressure values retain their measured provenance when another measure changes. The unchanged320-request transport probe now has zero transport failures and unchanged evidence tables.

No further blocking defect was grounded in this bounded queue review. This clearance does not complete the separate partner retrieval handoff, scheduled receipt processing, real partner validation or physical-device acceptance. Parent integration and canonical/hosted gates remain separate. Original author and before-failure artifacts are preserved unchanged.
