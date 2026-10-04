# Saha programme connector contract — saha-mis-v1

Release 4 / v0.5. Synthetic data only. This is a Saha adapter contract, not a claim that a government MIS implements it. A partner-specific adapter is required when its native API differs.

## Provisioning

1. Organisation owner registers a `mis` profile with the actual partner HTTPS endpoint and a dedicated `SAHA_MIS_...` credential binding name. Never enter a secret into the interface.
2. Owner selects applicable programmes and maps supported fields to unique flat destination names. Required fields block missing data. Optional missing values are omitted. No calculations, unit conversion, arbitrary scripts, demographic extraction, nested paths or default clinical values. Current supported sources are local person/visit references, observation time/source, six measurements, and notes. Programme-specific answers and external patient-ID matching need additional partner mapping work.
3. Server operator provisions the dedicated bearer credential and `SAHA_MIS_CONNECTIONS` as a JSON array of grants. Each grant binds **organisationId + integrationId + origin + credentialBinding**. Optional callbackBinding names a different dedicated secret. Sharing a general AI provider key is not supported. Set `SAHA_EXTERNAL_APIS_ENABLED=true` only after agreement and acceptance checks.
4. Run the synthetic probe and activate the tested profile within 24 hours. A mapping edit suspends it and invalidates the test. Suspension invalidates pending send approvals. Receipt lookup is permitted for an unchanged endpoint/credential route, including while the profile is suspended or patient sharing permission is withdrawn, because it checks an existing delivery and does not resend visit fields.

Example grant (replace all placeholders; do not use real secrets here):

```json
[{"organisationId":"actual-org-id","integrationId":"actual-integration-id","origin":"https://partner.example","credentialBinding":"SAHA_MIS_PARTNER_KEY","callbackBinding":"SAHA_MIS_PARTNER_CALLBACK_KEY"}]
```

Dedicated grants are separate from AI `SAHA_ALLOWED_ORIGINS`. No redirects are followed. Private IP literals and localhost endpoints are rejected. Operators must approve origins and DNS ownership; this is not a DNS rebinding firewall. Requests and response streams time out after 15 seconds; responses are capped at 16 KB. No credential values are returned in workspace snapshots.

## Probe

POST to the configured endpoint with bearer authorization and an idempotency key:

```json
{"contract":"saha-mis-v1","operation":"probe","environment":"synthetic","required":{"idempotency":true,"lookup":true,"corrections":true}}
```

Response: `{"contract":"saha-mis-v1","idempotency":true,"lookup":true,"corrections":true}`.
The probe is a declared capability check, not evidence of actual deduplication or successful clinical delivery. It includes no patient record.

## Review and submission

Prepare a plan from a current confirmed visit, inspect the **exact mapped payload for each destination**, and approve it. Approval binds patient and consent versions, visit version, each connection version, worker, purpose and payload hash. It expires in 15 minutes. Running the plan persists one independent outbox item per HTTP destination without making an HTTP call. Legacy demo destinations continue to execute locally.

A care worker presses **Send approved payload** in Submissions. Only the approving worker can send within the approval window and current scope/permission. Before HTTP, the server commits a sending checkpoint and command receipt using organisation compare-and-swap. The payload and destination key remain immutable across retries.

```json
{"contract":"saha-mis-v1","environment":"synthetic","operation":"submit","fields":{"patient_reference":"local-person-id","weight_kg":"55"},"key":"submission-uuid","payloadHash":"64-character-sha256"}
```

HTTP `Idempotency-Key` equals body `key`. The partner must atomically enforce uniqueness of this key, retain a receipt and reject different payloads under the same key. The payload hash is SHA-256 of the JSON-serialized approved payload before the transport appends key/hash. Partners echo the received hash rather than reserializing JSON to recompute it.

A matching accepted receipt is mandatory; a generic 200 is not acceptance:

```json
{"contract":"saha-mis-v1","key":"submission-uuid","payloadHash":"64-character-sha256","status":"accepted","receipt":"partner-record-reference"}
```

Other statuses: `pending`, `rejected`. `accepted` requires a nonempty receipt. Terminal receipts cannot be overwritten by a conflicting response. HTTP errors, timeouts, malformed responses and mismatched keys/hashes become uncertain. No automatic send retry is made. At most three send attempts per item. Cancel only queued/retryable (confirmed unsent) items. Cancellation never recalls previously shared data.

## Receipt lookup and safe retry

POST `{"contract":"saha-mis-v1","operation":"lookup","key":"submission-uuid","payloadHash":"..."}` to the same endpoint. No visit fields are sent. The request's HTTP idempotency key identifies the lookup operation; body key always identifies the original submission. Response uses the receipt schema above and may also return `not_found`. Only a definitive `not_found` from lookup permits retry with the original immutable payload/key. The partner must still deduplicate if its lookup is eventually consistent or an earlier request completes late. A running checkpoint can be looked up after 30 seconds. No autonomous polling/backoff/scheduler is included.

## Corrections

After an original accepted delivery, confirm an amendment and review a new plan. An opted-in partner receives `operation:"correct"` and `replaces:{submissionKey,receipt}`, plus corrected mapped fields, under a new key. Original receipts remain visible. An unresolved original blocks correction. The partner must implement correction semantics and receipt linkage; Saha does not silently overwrite remote records. Wrong-patient retraction and demographic corrections require partner handling.

## Withdrawal (slice 14c)

A destination whose operation setting permits `delete` can be asked to withdraw (void) a submission it accepted. A care worker prepares the withdrawal on the visit's Receipts tab; a care worker approves the exact payload hash for 15 minutes; the approver sends it. Saha POSTs, under a new idempotency key (the withdrawal id):

```json
{"contract":"saha-mis-v1","environment":"synthetic","operation":"withdraw","withdraws":{"submissionKey":"original-submission-key","receipt":"original-receipt"},"reason":"wrong-patient","key":"withdrawal-uuid","payloadHash":"64-character-sha256"}
```

`reason` is one of `wrong-patient`, `entered-in-error` or `corrected`; no visit fields and no free-text reason are sent. The response uses the receipt schema above, with `key` and `payloadHash` of the withdrawal. An unknown outcome is looked up with `operation:"lookup"` and the withdrawal's key; a definitive `not_found` ends that withdrawal without a resend, and a new one must be prepared and approved. The original submission and its receipt are never changed. This is Saha's proposed contract: no partner has agreed or tested it, and the release default does not permit `delete`. See [slice 14c](docs/current/SLICE-14C-WITHDRAWAL.md).

## Signed callback receiver

POST `/api/mis/callback` with JSON `{organisationId,integrationId,submissionId,receipt}`. Header `X-Saha-Timestamp` is current Unix **milliseconds** as a 13-digit string. `X-Saha-Signature` is lowercase hex HMAC-SHA256 of `timestamp + "." + exactRawBody`, signed with that connection's separately provisioned callback secret. Five-minute skew allowed. Signature uses constant-time Web Crypto verification; body capped at 16 KB. Receipt must match submission key/hash and an attempted delivery. Callbacks cannot return `not_found` or authorize a retry. Duplicate receipts are idempotent and terminal conflicts are rejected. Callback events use the organisation transaction and append-only audit.

**Ingress limitation:** The deployed Site is private. Unauthenticated partner requests may be blocked by the hosting access layer before this route. Direct partner callback ingress has not been enabled or tested. Do not make the whole patient workspace public to solve this. Until an approved dedicated ingress/gateway is provisioned, use authenticated outbound receipt lookup. Callback authentication must also be tested through that ingress before claiming production readiness.

## Operational limits

This release uses user-driven durable delivery, not an unattended job service. Browser closure before dispatch leaves an unsent queue item; interruption during dispatch leaves a sending/uncertain item to reconcile. Cancelling an expired unsent item and making a fresh approval does not resend already attempted records. Receipt/audit events are capped; no infinite retries. State remains in the existing per-organisation aggregate/SQL submissions, with no new schema migration. Production partitioning, background scheduling, exponential backoff, dead-letter operations, partner rate limits, bulk mapping, external patient matching and real-programme conformance remain unimplemented or externally blocked.
