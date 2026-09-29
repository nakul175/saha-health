# API and integration specification

The running application exposes the [current HTTP routes](HTTP-ROUTES.csv) and a typed JSON command API. The original 74 `/v1` operations and sixteen events are preserved in the [target specification](../reference/04_API-and-Integration-Specification_v1.0.md) and history engineering assets. They are not a served OpenAPI contract for R11.

## Current command envelope

`POST /api/commands` requires trusted Sites identity, `Content-Type: application/json`, an `Idempotency-Key` of 8–100 letters/digits/underscores/hyphens and same-origin changes. `x-saha-organisation` selects an organisation context; current membership still grants authority. Identity headers cannot safely be accepted from arbitrary public callers outside the Sites dispatcher boundary.

The JSON body is a schema-validated object with a `type` discriminator and command-specific fields. Expected versions are body fields. Request bodies stop at 20,000 bytes. The server returns `{result, snapshot}` and marks an exact receipt replay with `replayed: true`. The snapshot is scoped to current membership and omits the internal receipt map. Since slice 0b a client may send `x-saha-response: delta`. For the 39 certified patient commands (`lib/saha/partition.ts`) the server then returns `{result, delta, partition}`: `delta` has complete organisation-level fields and only the named patients' people, visits, submissions and referrals, and the client merges it with `mergeDelta` in `lib/saha/delta.ts`. Every other command, and every receipt replay, still returns the full `snapshot`, so clients must accept either shape.

Illustrative local command shape, with identifiers obtained from the authenticated snapshot:

```json
{"type":"switchOrganisation","organisationId":"<permitted-organisation-id>"}
```

Do not use that placeholder as a real request. [COMMAND-CATALOGUE.csv](COMMAND-CATALOGUE.csv) lists schema discriminators and source locations. Presence in a schema does not mean every context permits execution; role, consent, version, identity, maintenance, configuration and provider gates still apply.

| Response class | Handling |
| --- | --- |
| 400 / 415 / 422 | Correct key, media type or input; preserve unsaved intent |
| 401 / 403 / 404 | Reauthenticate or use the authorized workflow; never widen scope to discover a resource |
| 409 | Refresh and review current state; reconcile an uncertain action before changing its key |
| 423 | Maintenance; preserve edits and use permitted withdrawal or receipt recovery |
| 5xx or lost response | Outcome may be uncertain; retry unchanged command only under its existing key and inspect durable state |

`json` responses use `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. The FHIR route serves a scoped confirmed-current visit as a synthetic example or document. Other read/export paths have their own query and role checks; inspect the linked handler rather than applying a generic client contract.

## External contracts

MIS connections require exact organisation/integration/origin grants, a dedicated secret binding, approved mapping and explicit approval. Native delivery and receipt lookup are separate; correction links keep the original result. Callback ingress uses its separate authenticated HMAC contract, not browser identity. See [MIS-API.md](../../MIS-API.md).

EHR requires an explicit patient link, scoped local permission, approved endpoint/capabilities and server credentials. Structural FHIR checks do not establish clinical correctness or official ABDM profile conformance. See [EHR-ABDM.md](../../EHR-ABDM.md).

Governed AI requires technical enablement, an approved capability context, explicit permission/approval and bounded output validation. Legacy HTTP `runAI` is blocked. Local extraction is rules-only. See [AGENT-API.md](../../AGENT-API.md) and [AI-GOVERNANCE.md](../../AI-GOVERNANCE.md).

No current document pins an unseen live partner API or declares it accepted. R12 onboarding must obtain that owner's actual contract and evidence before changing any adapter.
