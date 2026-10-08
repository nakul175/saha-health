# AI features: model card, evaluation and limits

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: a change of model, agent version, provider, capability scope or evaluation corpus; a live-provider activation.

**Agent-drafted on 2026-10-08 from the cited documents and source. Not reviewed by a person. No clinical validity, regulatory approval or compliance is claimed.** Authoritative governance record: [AI-GOVERNANCE.md](../../AI-GOVERNANCE.md) (Release 11) and the [Security, privacy and clinical safety](../current/06_Security-Privacy-and-Clinical-Safety_v1.1.md) specification.

## Components

| Component | Identifier | Status |
| --- | --- | --- |
| Local record assistant | `structured-parser-v2`, agent `saha-agent-1.2.0` | Rules only; no language model, no external transfer. Default |
| OpenAI evidence adapter | `gpt-4.1-mini-2025-04-14` via Responses API (`lib/saha/agent-provider.ts`) | **Disabled.** Needs server key `OPENAI_API_KEY`, `SAHA_EXTERNAL_APIS_ENABLED=true` and a currently reviewed capability. No key has been provisioned; no live model was called for Release 11 |
| Registered HTTP providers | Per `SAHA_ALLOWED_ORIGINS` and agent contract | Disabled in synthetic deployments |

## Intended use

Documentary extraction of observations from a worker-reviewed source text and summaries, proposing values that a human accepts, rejects or overrides; application never confirms a visit. Protocol checks are model-independent declarative rules over recorded facts.

**Out of scope:** diagnosis, prescribing, triage decisions, autonomous action, real-patient use, contraindication or interaction checking, unattended alerts.

## Data and privacy

Direct patient identifiers are not included structurally; email/phone patterns and the current person's name/locality are rejected in external free text. This is a limited safeguard, not certified de-identification. Requests use `store:false`, a pinned snapshot, strict JSON schema, one call and a timeout; `store:false` is not a blanket zero-retention guarantee. A capability records hosting region, retention terms and training prohibition, which are recorded terms, not proof that a vendor honours them.

## Evaluation (engineering only)

Fixed corpus `saha-synthetic-evidence-1`: 18 hand-authored cases (16 English, 2 Hindi) covering history, negation, other subjects, uncertainty, prompt injection, conflicts, unsupported units, missing evidence and noise. Passing requires no provider or validation errors, no critical failures, and at least 95% precision and recall overall and per declared language.

Recorded result: the local parser passes the 16 English fixtures and **fails the Hindi capability evaluation**. These scores describe a tiny known set; they do not establish general-language quality, subgroup safety, calibration, clinical validity or acceptance of NFR-16. Passing evaluation alone cannot activate a capability.

## Controls

Independent review and different-clinician activation, scoped capabilities with dates and dependencies, per-capability call and token limits and optional USD budgets ([slice 5a](../current/SLICE-5A-AI-BUDGETS.md)), unable-to-assess outcomes, conflict flags, shadow operation and drift monitoring ([5f](../current/SLICE-5F-SHADOW-OPERATION.md), [5i](../current/SLICE-5I-DRIFT-MONITORING.md)), safety cases with a named clinical owner, and a stop-and-hold path.

## Limits and open work

Validation is lexical, not semantic. No representative annotated corpus, clinical-subgroup analysis, bias assessment, live-provider evaluation, vendor data-terms review, or independent clinical approval exists. Responsible clinical owner: TBD (owner: Nakul Jain).
