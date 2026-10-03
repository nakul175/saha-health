# Independent Anaemia Screen provider demonstration

3 October 2026. Synthetic engineering demonstration; no clinical approval or formal BRD acceptance.

Saha and Anaemia Screen are presented as independent organisations that already operate their own products. They have separate application deployments, D1 databases, administration and service credentials. Saha contains a versioned consumer adapter and no model weights or inference runtime. Anaemia Screen operates the pinned research model, service contract and its own customer request ledger.

## Demonstration

1. Open the private Saha product and select **Connections**. The Anaemia Screen card identifies the two organisations, server configuration, demonstration agreement and activation revision.
2. Choose **Open synthetic screening example**. A care-role organisation owner creates or opens one synthetic patient and confirmed fixture visit in their normal care team. It does not use a service credential to impersonate a care worker.
3. In the visit's **Anaemia screening** panel, choose **Try synthetic texture**, explicitly confirm the image is synthetic and approve sending the crop. This is an engineering pattern, not a clinical case or anatomy example.
4. Saha saves the request checkpoint, calls the separate provider once and verifies the signed, input-bound result. Review or reject the result with a reason. The score, provider receipt, model and consent revision are inspectable; clinical facts, diagnosis, treatment and EHR output are not changed.
5. Choose **Try quality refusal** for a uniform grey fixture. The provider returns `unable_to_assess` with no model score. Open the provider company's console to see the independent request ledger.
6. Suspend Saha in the provider console. Saha cannot override the provider's customer decision. Alternatively, suspend the Saha connection from its Connections card. Suspensions and revision changes withhold results that arrive during a change.

## Ownership and service contract

| Responsibility | Saha | Anaemia Screen |
| --- | --- | --- |
| Identity, care-team access, patient record | Owns | Receives no patient identifiers |
| AI permission and approval | Enforces at send and result acceptance | Requires an explicitly synthetic request |
| Image capture | Decodes and crops in the browser | Receives only 224 × 224 RGB bytes |
| Model and quality checks | Consumes typed result | Operates pinned EfficientNet-B0 / CPU WASM |
| Records | Request metadata, result, review and audit | Request hash, result and provider receipt |
| Service controls | Owner-managed demo agreement and connection suspension | Customer activation/suspension and daily quota |
| Clinical deployment | Excluded | Excluded |

Contract: `anaemia-screening-v1`; model: `conjify-5659a76-onnx-v1`; ONNX SHA-256: `1441feaeb799a55d8f2dc710f70f65cbc96b72f42cb18deb5e7383d1b7ffbd94`.

The provider exposes `POST /api/v1/screenings`, `GET /api/v1/screenings/{requestId}`, a manifest and an OpenAPI document. Saha exposes owner/care-role connection readiness, owner configuration, a care-role owner synthetic example and scoped screening run/lookup/review routes. These are separate from the text assistant contract and clinical capability activation system.

Request fields exclude names, patient/visit IDs, notes, other clinical data and EXIF. The input hash covers the complete canonical request. Results carry exact provider, contract/model/hash, original request/input binding, quality, uncalibrated research score or a quality refusal, `clinicalUse:false`, receipt and HMAC-SHA256 signature. Unexpected fields, altered signatures, wrong input, inconsistent status and non-finite scores are refused. HMAC establishes integrity under the shared partner credential; it is not an independent clinical certification or public-key attestation.

A separate connection-test route accepts only two built-in engineering fixtures. A Saha owner can invoke it from Connections, or an authenticated service diagnostic can invoke it with the server credential. This path does not establish a care identity, accept arbitrary image/patient content, read patient records or change visits. It verifies the same provider contract and HMAC before claiming connection success.

## Checkpoint and permission boundaries

An active ASHA or clinician in normal care scope must use a current confirmed, non-imported, non-voided visit. The patient must be explicitly synthetic, AI permission current, identity resolved, unmerged and unrestricted, with no open visit disputes. Maintenance, provider suspension, an unapproved origin, missing credentials or any non-synthetic environment prevent a new screening.

The organisation and actor idempotency key bind the request to one opaque provider ID. The Saha checkpoint is committed before the network call. Provider reservation and quota are atomic in its separate database. Replaying the same request returns its original result; changed input under the same ID is refused. Worker fetch uses manual redirects and refuses redirect responses; credentials never follow a changed origin. There are no inference retries. Unknown outcomes remain unresolved and can only trigger GET receipt lookup. Another screening is blocked while an unresolved request exists. Pending results have no fabricated score.

After a provider response Saha reloads membership, scope, consent, person/visit versions, maintenance, disputes and its provider agreement. Changes withhold the result. A staff decision appends review evidence without changing confirmed observations. The standalone Anaemia Screen app still performs photo inference on device; this separate partner flow explicitly sends a crop to a server.

## Deployment and terms

The private Sites demo alone enables `SAHA_ANAEMIA_DEMO_ENABLED`, the external switch, exact approved provider origin, a server-only partner key and the provider's private-service dispatch credential. Anaemia Screen has its own server-only partner key. Private dispatch access does not create a Saha user identity. Both audiences remain owner-private. No secrets are tracked or delivered to browser code. One-time deployment demo bootstrap creates an initial customer/connection only; it never reactivates a stored suspension.

The allowance is 100 provider requests per UTC day, and at most eight screening attempts per Saha visit. This is a demonstration allowance, not metered invoicing or a contractual SLA. The agreement reference is a demo identifier, not a signed legal document. Production onboarding, regulatory review, representative validation, security review, support/SLA, retention/deletion terms, key rotation and billing integration remain partner work.

Cloudflare synthetic staging and GitHub main are unchanged until the sponsor explicitly approves the pull request merge. Its default environment template keeps this service disabled.

## Evidence and limitations

The private hosted Saha Worker successfully called the independently hosted provider on 3 October 2026. Eight fixed-fixture diagnostic checks verified real model inference, a signed result accepted by the consumer, a technical quality refusal with no score, invalid credential refusal and refusal of extra patient fields. No Saha patient record was read or changed in this hosted check. Consent, checkpoint and staff-review interleavings are separately covered by local D1 and component tests.

Evidence is under `tests/evidence/independent-anaemia-provider/` and in the separately versioned provider repository. The Saha contract suite uses the real migrations and D1-compatible SQLite persistence with an injected transport; the provider suite uses its built Worker, actual model and separate local D1. Component interaction is tested in jsdom with canvas and API shims. Real-browser, mobile-camera, physical-device and clinical validation are not established by these tests.

The research publisher reports paediatric Ghana data and no external clinical validation. Adult, pregnancy, India population and actual capture-workflow performance are unestablished. The technical quality gate checks brightness, clipping, resolution and sharpness; it does not verify anatomy. No haemoglobin estimate, anaemia diagnosis or treatment recommendation is made. Synthetic texture output cannot be used to infer clinical accuracy.
