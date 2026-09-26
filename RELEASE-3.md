# Release 3 / v0.4 — Bounded record assistant

26 September 2026. Incremental engineering Release 3. **Agent workflow delivered; live model activation pending credentials.** Synthetic records only.

## Delivered workflow

1. Select an assigned patient and current visit. Choose draft field extraction, source excerpts, or programme gap review.
2. Select an eligible provider. The interface distinguishes a local rules parser from an external language model. No provider is silently substituted.
3. Enter a narrative once, or use the saved visit for source excerpts and programme gaps. Prepare a request.
4. Review the exact submitted source, purpose, provider/model and record context. Approve one invocation.
5. The server commits a running checkpoint and idempotent command receipt before any provider call. Concurrent retries do not invoke again.
6. Inspect proposals with exact source quotes and character offsets. Conflicting values are withheld. Missing values stay unknown. The server rejects unsupported fields, invalid numeric values, evidence mismatches and basic unit/history/negation/subject mismatches.
7. Select values, explicitly review observation source/time, optionally use the original narrative as visit notes, and apply to a draft. Visit confirmation and programme dispatch remain separate actions.
8. Audit and append-only visit revisions retain preparation, execution, source, result, actor and selected values. Pending/running/review tasks can be cancelled by their requester. Cancellation does not recall requests already sent.

## Provider architecture

- **Local record assistant:** non-generative, conservative parser for six numerical fields, exact source excerpts, and programme gaps. It does not claim clinical comprehension. Historical/negated/other-person clauses are skipped; ambiguous repeated values are withheld.
- **OpenAI adapter:** implemented for Responses API, pinned `gpt-4.1-mini-2025-04-14`, strict JSON-schema output, `store:false`, no tools or global conversation memory, no web retrieval, 1,400 output-token limit. Requires server `OPENAI_API_KEY` and `SAHA_EXTERNAL_APIS_ENABLED=true`. Neither is configured in the deployed site. Account/model access and actual model quality are unverified.
- **Additional HTTP providers:** existing AI profiles can adopt `saha-agent-v1` with a pinned model. Attaching the contract increments its version and leaves it suspended. Activation additionally requires approved origin, server credential and global switch. Contract and limits documented in AGENT-API.md.
- The entire submitted source is shown before approval. Structured identity fields are not added, but identifiers entered inside free text are not automatically removed. Use synthetic text only.

## Enforcement and recovery

Closed command schemas and fixed task catalogue. Care-role and patient-scope checks. Current patient AI permission required even for the local assistant. Approval binds worker ID, exact source hash, task, visit/fact and patient/consent versions, provider version/model and agent release. Approval expires after 15 minutes.

Provider completion rechecks scope and versions; changed authority or input blocks the output. Maximum one invocation per run; no automatic provider retries. Network timeout 20 seconds; response capped at 64 KB. Maximum 30 prepared requests per visit and 60 per actor/organisation/UTC day, with 3,000-character extraction input. These are usage ceilings, not a monetary budget or billing guarantee. No model-driven recursive execution.

A process interruption after the checkpoint can leave running status with an unknown outcome. Refresh can recover a committed result. Cancellation closes an unresolved run. The application never automatically repeats a potentially delivered invocation; starting a new request requires a new approval and may incur another provider charge. Final state writes can retry org CAS without repeating the provider call.

## Storage and compatibility

Run snapshots live in the existing structured visit aggregate and are persisted with the R1 CAS/transaction/revision/audit machinery. No applied SQL migrations are changed. Older visits without agent runs remain usable. The cap bounds per-visit growth; dedicated run/event tables and background jobs are future scaling work. Existing legacy AI demonstrations remain available on confirmed visits.

## Validation

263 API/database assertions pass, including all 202 Release 2 checks. 21 additional provider-contract checks use injected mock HTTP responses: correct request schema and no tools, success, invalid evidence, invalid units, refusals, model-version mismatch, incomplete output, oversized/invalid JSON, HTTP 429, timeout, no credentials, no allowlist and custom adapter routing. No live model request was made.

See VALIDATION.md for browser checks. This is not clinical validation, penetration testing or proof of ABDM compliance.

## Unfinished production requirements

Live account/key activation and a real provider acceptance test; multilingual and clinical extraction evaluation; verified semantic grounding beyond conservative lexical checks; full provider governance/evidence manifest and jurisdiction/population rules; cost reservation and billing reconciliation; durable background workers; cross-model clinical disagreement review policy; model-generated general task planning; governed management analytics. This release does not claim all BR-AG/BR-AI requirements completed.

## Official API references

- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/migrate-to-responses
- https://developers.openai.com/api/docs/models/gpt-4.1-mini

Read 26 September 2026. `store:false` disables response application-state storage; it is not a claim of zero retention or an approved health-data processing arrangement.
