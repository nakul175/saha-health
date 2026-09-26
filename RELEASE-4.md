# Release 4 / v0.5 — Programme integration engineering build

26 September 2026. **Engineering build implemented; live release acceptance remains externally blocked.** Synthetic data only. This is the engineering roadmap's Release 4, distinct from the BRD's R1/R2/R3 pilot gates.

| Requirement | Implementation / evidence | Status |
|---|---|---|
| Connection setup | Owner-reviewed HTTP MIS profiles, applicable programmes, suspend/test/activate | Implemented and tested |
| Secure credentials | Dedicated server bindings and organisation/connection/origin grants; no values in UI | Implemented and tested with synthetic credentials; real provisioning blocked |
| Mapping editor | Whitelisted shared facts, flat target names, required fields, exact payload review | Implemented and tested; native partner-specific mapping blocked |
| Connection tests | Patient-free capability probe, version binding, 24-hour activation window | Implemented; actual partner probe blocked |
| Asynchronous dispatch | Durable independent outbox; explicit per-item dispatch after approval; checkpoint before HTTP | Implemented and tested; autonomous background worker deferred |
| Receipt callbacks | Scoped HMAC, timestamp, bounded body, duplicate and terminal-conflict protection | Implemented; signature contract tested; private-host ingress and real callback E2E blocked |
| Retries | Lookup before retry; only definitive not_found permits resend; immutable key/payload; maximum three attempts | Implemented and tested with injected partner responses |
| Corrections | New confirmed amendment, new approval, linked prior receipt, opted-in correction contract | Implemented and contract tested; partner semantics blocked |
| Reconciliation | Independent status, receipt, attempts, payload and event history; permission withdrawal does not hide receipts | Implemented and tested; live partner lookup blocked |
| Two actual programme systems accept one visit, independent receipts, no duplicates | No actual programme endpoints or credentials supplied; simulators do not satisfy this gate | Externally blocked |

## User journey

Connections → add programme profile → configure mapping → provision server grant/key → test → activate. Worker captures once → confirms → chooses destinations → reviews exact per-destination payload → approves → creates queue → sends each approved item → inspects each receipt. Lost responses trigger lookup. Corrections preserve original records and require another review.

## Validation

298 HTTP API/database assertions (including prior releases), 43 programme mapping/transport/receipt/signature contract checks, 10 delivery-checkpoint tests using injected transport and CAS persistence, plus 21 retained AI-provider contract checks. Total: 372. No live programme endpoint or live model invoked. TypeScript and production build pass. API tests exercise actual local D1; injected checkpoint tests do not claim a real network partner or D1 concurrency test.

Browser validation: owner registration of a suspended MIS profile, mapping editor save, mapping reload, disabled test/activation when server configuration is absent. See VALIDATION.md for evidence.

## Deployment and rollback

No SQL migration or applied migration changes. Added JSON fields are optional for existing rows. Existing simulation, memberships, programme packs and assistant flows are preserved. Source goes to Sites and the user's private GitHub repository. Keep the prior deployment available, but do not roll back while real deliveries are in flight: older builds do not understand queued/sending/retryable states. Pause new sends and reconcile first.

## Remaining gate

Supply two authorised programme endpoints, API specifications, credential owners, external patient-ID rules, and correction/receipt semantics. Build native adapters where the partner does not implement saha-mis-v1, provision secrets and isolated callback ingress, and run witnessed lost-response/retry/correction tests in each partner sandbox. This release does not claim general compatibility with any MIS, EHR or ABDM certification. EHR/ABDM remains engineering Release 5.
