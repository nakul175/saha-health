# Development slice 6l — safe logs check

30 September 2026 (IST). Stacked on slice 5a. Synthetic data only; formal acceptance unchanged.

## What changed

- **End-to-end check.** A new HTTP smoke module (`tests/safe-logs-smoke.mjs`) runs the main flows with distinctive synthetic values: a patient name and village, a visit narrative, a stale-version save, a voice-note upload with marker bytes and its removal with a reason, visit confirmation, a referral reason, a refused registration, a history read, an indicator question naming the patient, and an invitation token (a credential) that is created and revoked. It then asserts that none of those values appears, plain, URL-encoded or base64-encoded, in the `request_metrics` table, the Worker's console output for the run (application log lines and the local platform's request log), the support diagnostic export, the aggregate report export, or the Operations telemetry and supervisor report. A positive control shows the console was captured, and the owner's own workspace read does contain the values. Application log lines are checked to carry only `event`, `requestId`, `route`, `status` and `durationMs`.
- **Static check.** `tests/safe-logs-contract.mjs` fails when a new `console` call is added to server, workspace or field-notebook code without review (four reviewed calls today; the full error object is printed only in development builds), when the request log line or metrics columns gain fields, or when a Saha client puts free text (reason, question, village, name, notes and similar) into an `/api/` URL.
- **Fixes from the review.** The local run found no leak. Reading the code for the same sinks found free text in request URLs, which the local development server does not print but hosted platforms record in request logs:
  - Media removal sent its reason as `?reason=`. The visit screen now sends it in a JSON body; the server reads the body first and still accepts the query form from older clients.
  - Indicator questions and filters (including village names) were sent as query parameters. The workspace now posts them as JSON to a new `POST /api/indicators`, which requires `application/json`, refuses cross-origin requests and bounds the body to 4 KB; `GET` remains for compatibility and returns the same results, including the small-cohort refusal.

## Evidence

- 28 HTTP/D1 assertions (`tests/safe-logs-smoke.mjs`), including the body forms of media removal (tombstone and audited reason) and indicators (interpretation, 415 for a non-JSON body, small-cohort refusal).
- 8 contract assertions (`tests/safe-logs-contract.mjs`), including a check that its URL detector flags the pre-6l media removal URL.
- `tests/run-api-smoke.mjs` now exposes the Worker's captured console output to smoke modules (`globalThis.sahaWorkerOutput`).
- First run, before the fixes: the smoke passed with the query-string forms, because the local development server logs paths without query strings. The fixes rest on the code review, not on a local detection; the contract now guards against regressions.
- Browser check (headless Chromium, built Worker, synthetic owner): a photo was attached and removed from the visit screen, and an indicator question was interpreted on the Operations page; the removal was a `DELETE` without a query string, both indicator requests were `POST`s, no request URL contained the reason or question, and there were no console errors. The accessibility audit (25 screens) reported no violations. `tests/evidence/slice-6l/`.

## Limits

- The check covers local sinks only. Hosted request logs, Workers Logs, crash reporting, analytics and retention settings on a real deployment are not configured or verified here, and record identifiers (patient, visit and media ids) still appear in request paths and query strings.
- Other exports (pilot dossier, audit-chain export, FHIR documents, rights and expansion packs) are purpose-specific records that intentionally contain identifiers or content; they are not general operational telemetry and are not covered.
- There is no separate access-controlled store for sensitive diagnostics, and the AI assistant flow was not included because a governed local capability may be inactive at that point in the shared HTTP run.
- BR-SEC-07 stays partial.
