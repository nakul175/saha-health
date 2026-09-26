# Saha agent provider contract v1

Synthetic test environments only. The caller authenticates with a server-held bearer credential. Configure the exact HTTPS origin in `SAHA_ALLOWED_ORIGINS`; redirects, credentials in URLs, query strings and fragments are rejected. Never place provider keys in the browser, repository or patient notes.

The server sends JSON:

```json
{
  "contract":"saha-agent-v1",
  "agentVersion":"saha-agent-1.0.0",
  "model":"your-pinned-model-release",
  "task":"extract",
  "source":"weight 58 kg",
  "outputSchema":{},
  "limits":{"maxOutputTokens":1400,"maxCalls":1},
  "instructions":"Server-supplied evidence-only policy"
}
```

`outputSchema` contains the complete JSON schema. Supported remote tasks: `extract` and `summary`. `summary` means exact source excerpts; it cannot propose record mutations. Provider must enforce output token limits; the caller also caps the HTTP response at 64 KB. The request contains no tools or additional patient context. Idempotency-Key contains the durable run ID; providers should retain an idempotent response or reject duplicates.

Successful response is the evidence object itself:

```json
{
  "proposals":[{"field":"weight","value":"58","quote":"weight 58 kg","start":0,"end":12}],
  "highlights":[]
}
```

Allowed fields: systolic, diastolic, weight, temperature, weeks, coughDays. Values are positive numerical strings without unit conversion. Fields use mmHg, kg, Celsius, weeks and days. Quote positions are zero-based JavaScript UTF-16 offsets with end exclusive; they must match the submitted source exactly. At most 12 proposals, 8 highlights and 600 characters per quote. Each highlight contains quote/start/end only. Extra keys, tool calls, diagnoses and action requests are rejected. Empty arrays represent insufficient evidence; never manufacture normal findings.

Errors use non-2xx status; raw provider errors are not exposed as clinical output. No automatic retry or provider fallback occurs. Timeouts leave a failed/unknown request that cannot apply values. The human must prepare and approve any new attempt.

Organisation owner setup in the app: register an HTTP AI profile under Connections; attach the Saha agent contract and pinned model under AI tools; configure its approved server origin and credential; review, then activate its profile. Activation in the UI alone does not install credentials or bypass the origin allowlist.
