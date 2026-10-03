# Development slice r42 — comprehensive minimisation of AI provider payloads

3 October 2026 (UTC). Builds on the evidence assistant's mapped allowlists (slices 5c/5e) and the aggregate-report payload minimisation (slice 7g). Synthetic data only; formal acceptance unchanged. No route, command or migration is added; this is an additive guard in the agent-execution path.

## What changed

- **A fixed, mapped payload allowlist for AI provider requests.** `lib/saha/agent-minimisation.ts` records the exact set of keys that may appear in an OpenAI or HTTP agent request envelope (`PAYLOAD_KEYS`). The `schema`/`outputSchema` and `instructions` values are the static, pre-approved `OUTPUT_SCHEMA` and `INSTRUCTIONS` constants and are carried by reference, never walked, so they can never introduce an unknown key.
- **Comprehensive sensitive-value set (BR-AG-02, BR-AI-08).** `collectSensitive` gathers, across the whole organisation (not only the current patient), every patient name and village, every ABHA number (grouped and plain) and ABHA address, and every current crosswalk identifier, lowercased and trimmed. Internal record and visit ids are UUIDs and are deliberately left out: they are not meaningful to a provider and would only risk false refusals on free text.
- **A source check that runs before preparing and inside the checkpoint.** `checkAgentSource` refuses (422) when the external-AI source still carries any of those values — data that stripping cannot remove. It is called in `prepareAgent` (before the run is prepared) and again inside the external-execution checkpoint in `executeAgent` before `invokeAgent`; a refusal there sends nothing and marks the run failed, never a blind retry.
- **A payload walk that strips and refuses.** `minimiseAgentPayload` walks a built provider payload, strips any field outside the mapped allowlist, and refuses (409) rather than sending when a remaining value still leaks an identifier. It runs in `invokeAgent` immediately before the provider call, for both the OpenAI and the HTTP Saha-agent shapes, so an unnecessary `name`, `abha` or any other field outside the contract is removed (BR-AI-08-B, BR-INT-09).
- **Additive only.** The existing allowlists (`FIELDS`, `OUTPUT_SCHEMA`, `INSTRUCTIONS`, the MIS/EHR field mappings) are unchanged; the existing free-text email/phone/name rejection in `prepareAgent` is left in place and the new check is layered after it.

## Evidence

- 38 contract assertions (`tests/agent-minimisation-contract.mjs`), running the real `agent-minimisation.ts`, `agent.ts` and `agent-provider.ts` with a mock transport and no provider credentials: the organisation-wide sensitive set (own and cross-patient names and villages, grouped and plain ABHA numbers, ABHA addresses, crosswalk identifiers, and the exclusion of internal record/visit ids); `checkAgentSource` refusing each category and passing a clean source, with the 422 status; `minimiseAgentPayload` passing a clean OpenAI and HTTP payload unchanged, stripping `patientId`/`notes`/`phone`/`village` from an OpenAI body and `name`/`abha` from an HTTP body, and refusing (rather than sending) a source that leaks a name for both shapes; `invokeAgent` sending a minimised body (no patient field) and refusing a leaking source with the transport never called; and `prepareAgent` refusing an external provider on a cross-patient name before anything is prepared, while a clean source prepares.
- `tsc --noEmit` passes over the whole tree on the slice's own branch.

## Limits

- The allowlist is a flat key set per provider shape, not path-aware; the OpenAI `name` key (the schema name `saha_evidence_v1`) is therefore allowed at any depth. The provider bodies are code-built, not user input, so the real protection is the source check plus the value walk, not the envelope itself.
- The source check is substring-based on lowercased names and villages (at least 3 characters) and on ABHA/crosswalk values, mirroring the existing free-text rejection; it is a safeguard, not a de-identification guarantee. A very short village or a name shared with ordinary words can still be refused.
- Live providers stay disabled; the HTTP provider path is covered with a mock transport, and the OpenAI path asserts the body shape without a network call.
- BR-AG-02, BR-AI-08 and BR-INT-09 stay partial: this adds minimisation of the AI provider payload and of the patient-level destination payload the agent carries, but enforceable provider retention/training/subprocessor/region compliance and live partner testing remain open.
