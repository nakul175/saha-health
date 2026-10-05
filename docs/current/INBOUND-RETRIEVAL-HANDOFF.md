# Retrieved clinical version conflict handoff

This follow-on is based on the independently cleared documentary queue and three-defect repair (`2158e12a`, `5cc44cf6`; independent review `79ebb80f`). It implements the missing local handoff from supported `retrieveEhrDocument` responses to governed version review. It does not claim authenticated partner or clinical acceptance.

## Grounded gap

`tests/evidence/inbound-retrieval-handoff/before.json` and its preserved driver/log show real local Worker/D1 configure → probe → activate → Patient/Bundle GET. A first document is retained; a second supported document with the same identifier and changed content returns 409 and is not retained. Every outbound request is intercepted by a fixed synthetic service; no request reaches an external provider.

## Behavior and guards

Actual retrieval retains a bounded `EhrState.inboundCandidates` entry atomically with its normal command receipt and audit. It keeps the exact first and incoming document bodies/digests, original receiving human/request receipt, declared version tokens (or explicitly labelled content hashes when absent), effective time, source authority digest, and complete pending local draft snapshots at intake. The first document and confirmed/approved bodies are never rewritten. Duplicate same-content/current-authority retrieval returns the original candidate identity. Limits are 40 retained candidates and 20 pending draft snapshots; overflow refuses rather than silently truncating evidence. Supplied malformed version tokens refuse.

The post-response append checks current membership/role, normal patient scope, care-coordination purpose, operating policy, patient/consent versions, connection and current source permission. Scope withdrawal during the final Bundle response withholds intake. Existing service identity and pre-transport checkpoint checks remain in place. Failures during durable audit roll back candidate and receipt; a user can retry the same clinical read key after that failure, without any external mutation.

The normal phone panel offers retained retrieved candidates. Choosing one fills the exact source/version/time/body, while local visit and independent clinician remain explicit choices. India-timezone testing verifies that the local datetime control round-trips the exact source instant. Staging requires exact candidate identifier, bodies, tokens, effective time, and current captured identity/consent/link/permission/connection authority. Decisions recheck the same authority. No candidate automatically becomes a clinical decision, confirmed visit, enrolment, outgoing publication, or partner amendment. A declared same-version/different-content response remains retained but cannot bypass the distinct-version review guard.

Historical candidates remain readable only through the existing audited current care/patient history route; withdrawn source permission prevents further use. Assignment, independent decision, preserved receipts, and coupled blood-pressure lineage retain the cleared queue semantics. File intake remains documentary and cannot forge a server-retrieved origin by omitting/providing arbitrary metadata.

## Evidence and limits

Dedicated author gates: 110 combined contracts (48 unchanged original EHR baseline), 30 real Worker/D1 HTTP checks, final normal-phone evidence, types/build, and 13 affected EHR execution/importing contract suites with unchanged assertions and module inventories. These are focused author gates, not a whole-checkout CI claim. `compatibility.json` records each affected suite exit. Root owns combined catalogue/regression/publication.

The phone driver performs real intercepted retrieval in Miniflare, then opens the same persisted D1 and same built source through the established Wrangler browser harness with provider delivery disabled. Initial direct-Miniflare hydration failures remain preserved; switching the browser fixture is not an application/runtime memory repair. Native version-pattern console diagnostics and the initial unanchored fixture assertion remain preserved separately; the final test uses HTML's full-value pattern semantics.

Partner/source authority, production receiver behavior, clinical mapping approval, and destination amendment/publication acceptance remain external/pending. This batch only completes the buildable local retrieved-response retention and explicit governed review handoff. Retained opaque receipt/version history does not establish partner authority by itself.
