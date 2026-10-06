# R77: incoming reminder opt-out, mock provider

5 October 2026 (IST). Synthetic-only implementation of incoming reminder STOP handling for BR-CARE-07. No formal acceptance is promoted; no real SMS provider or recipient is contacted.

## Reachable demonstration

In Outreach → Contact preferences, choose a patient with a synthetic `TEST-` SMS contact and select “Simulate incoming STOP”. The trusted staff simulation withdraws automated-contact permission, cancels unsent reminders, appends before/after preference evidence and consent history, and returns a durable `SIM-OPTOUT-` receipt. If the response is uncertain the browser retains the same event for retry. This control does not contact a provider and does not send a message.

The existing contact-preference table reflects the new permission after a successful refresh. Existing consent history holds a withdrawal event with the opt-out receipt as its evidence reference. The full before/after contact settings and cancelled reminder IDs are stored in the patient's `reminderOptouts` evidence, preserved by the usual patient record revision mechanism.

## Interfaces and authentication

- `POST /api/reminder-optout`: existing trusted identity provider, active organisation membership and current care scope. Only ASHA, clinician or supervisor roles can record the local simulation. Owner status does not bypass care scope. Scope is checked again on retries and receipt replay.
- `POST /api/reminder-optout/callback`: exact organisation/provider grant and HMAC verification before any organisation or patient data is read. Public user-identity headers never authenticate this route.

Both accept a strict 4 KiB JSON contract:

```json
{
  "provider": "mock-reminder",
  "organisationId": "org_synthetic",
  "eventId": "provider_event_001",
  "destination": "TEST-CONTACT-001",
  "preferenceVersion": 1,
  "occurredAt": "2026-10-05T08:00:00.000Z",
  "action": "STOP"
}
```

Only STOP is accepted; callbacks cannot grant permission or restart delivery. A contact must resolve to exactly one patient in that organisation. Shared identifiers, merged records and stale contact versions are refused for reconciliation. The event must follow the recorded contact preference update, be no more than 24 hours old and no more than five minutes in the future.

Mock callback configuration defaults to disabled in `.env.example`. Enable it only in synthetic/training environments with `SAHA_REMINDER_MOCK_CALLBACK_ENABLED=true` and `SAHA_REMINDER_MOCK_CALLBACK_GRANTS`, an array of exact `{organisationId,provider:"mock-reminder",secretBinding}` grants. Bindings must match `SAHA_REMINDER_MOCK_*`; their server-only secret must be at least 32 characters. The callback uses existing SHA-256 HMAC verification over `timestamp + "." + rawRequestBody`, with `x-saha-timestamp` (13-digit milliseconds) and `x-saha-signature` (64 lowercase hex digits). Signature expiry is five minutes. Every authentication refusal has the same response and reads no patient data. Secrets/configuration values are never sent to the browser.

`SAHA_EXTERNAL_APIS_ENABLED` remains false in the tests and is not changed by either route. These are local mock provider events; no real provider is enabled.

## Durability and preservation

The provider, organisation and event ID form a stable receipt key. The full canonical event forms its input hash. A successful retry returns the original receipt; reuse of a provider event ID for different content is rejected. Receipt replay survives a later contact change without reapplying the event. Staff receipt replay is still refused after patient reassignment.

Contact permission becomes false and its version advances. Existing contact withdrawal handling cancels only `draft`, `approved` and retriable `failed` reminders. Previously simulated reminders, cancelled terminal records and every existing attempt receipt remain unchanged. Neither programme submissions nor confirmed clinical records are altered. The consent event lists stopped reminders and existing simulated outcomes without claiming to recall a message. Fresh grant of contact permission continues to require the existing care-worker preference workflow.

Updates and receipts commit atomically through the existing D1 persistence, record revisions, audit chain and organisation conflict guard. Up to three conflicts reload the latest state and replay/validate the same event. The mock evidence collection is bounded at 100 records per patient; hitting it requires reconciliation and preserves all stored evidence.

## Validation

Evidence is in `tests/evidence/reminder-optout/`:

- TypeScript: passed.
- Production build: passed; existing client bundle warning remains.
- `tests/reminder-optout-contract.mjs`: 39 checks passed for schema, unique contact resolution, care scope, stale/future events, HMAC grants, append evidence and immutable terminal attempts.
- `tests/reminder-optout-http.mjs`: 53 checks passed against actual isolated Worker/D1, including 2 real Chromium checks for the reachable Outreach control and server readback. It covers signed callbacks, forged/expired/wrong-organisation refusals, stale preference/event refusal, stable receipt replay, changed event-key input, terminal receipt preservation, receipt replay after contact changes and revoked staff scope. D1 inspection verifies durable receipt/audit counts and retained delivery attempts.
- Existing outreach and consent contracts: 55 and 25 checks passed.

The first HTTP run reached 47 passing checks and then failed in test database selection because Miniflare also creates `metadata.sqlite`. The test now selects the actual D1 database and the complete rerun passed. No product fix was required for that harness issue.

## Acceptance boundary

Two POST method/route handlers added; no command, certified patient command or migration added. BR-CARE-07 remains partial and its formal acceptance remains pending. Live provider provisioning, real SMS sender identity, phone-number ownership, culturally/language-appropriate STOP keywords, outbound channel approval, carrier delays and field acceptance are external work. This slice intentionally supports strict synthetic TEST contacts and an English STOP token only. It is not a production opt-out provider integration.
