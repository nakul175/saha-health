# B18 independent transport guard review

Author stacks `36b4ba8c` + `a09d41fa` reviewed in an isolated checkout from canonical `e89cf6b7`. Build/typecheck pass.449 synthetic checks pass, including historical drivers which deliberately assert the newly found behaviour. Original38R42, new30AI/21frontline/12image, actual Saha-handler/SQLite/provider109frontline and58anaemia, agent provider25/quality50 and EHR48 pass. Source/clinical key/body/hash, raw registration wire receipts, support guards, and the existing public legacy HTTP runAI409 are preserved. No canonical edits or real providers.

## P2: OpenAI immediate check scans serialized source

`lib/saha/agent-minimisation.ts:49` parses the built input's strict source/task shape, but then scans the encoded string rather than decoded source. Actual `invokeAgent` with `synthetic\tprivate subject` (a real tab) and known sensitive value `synthetic private subject` makes one injected transport call. JSON parsing the actual outgoing input recovers a source that the existing canonical sensitive comparison rejects. A reusable built-input witness with JSON Unicode escapes similarly passes the guard even though parsing yields the exact known name. Existing prepare/checkpoint `checkAgentSource` rejects the tab-separated note; this is missing independent final-transport parity, not an asserted end-to-end bypass through the normal public route. Static/wrong-depth author witnesses also retain their narrower reusable-guard reachability.

The lower-level legacy facts projection has the same encoded scan issue: tab-separated known notes are returned by `minimiseLegacyAiPayload`. Public HTTP legacy runAI is still hard409. This is defensive lower-level projection coverage, not a publicly permitted disclosure.

Minimal repair: scan the parsed OpenAI input source after strict schema checks; inspect each mapped legacy fact string, preserving original values/wire. Do not guess URL/base64 or arbitrary encodings.

## P2: active frontline Unicode contact presentation

`lib/saha/frontline.ts:37` applies contact regexes to raw text, whereas known-sensitive comparison normalizes Unicode. Actual Saha handler, receipt/checkpoint persistence, SQLite and the independent synthetic provider accept engine `ｃｏｎｔａｃｔ＠ｅｘａｍｐｌｅ．ｉｎｖａｌｉｄ`, return a review receipt and make one provider call. The same plain ASCII email is refused. Normalize presentation for the existing email/phone comparisons; preserve original evidence, hash and request body. This is an actual permitted-input handler witness.

A separate real Request containing JSON Unicode escapes for the known patient name decodes correctly and refuses before checkpoint/provider: run and receipt counts unchanged. Existing malformed/hash-mutated envelopes refuse before transport. Clean observations and exact cropped RGB input remain accepted. EHR48 preserves mandatory identity, document lineage and publisher binding; do not apply general patient-identifier removal to authorised EHR payloads.

## Evidence and limits

Hashed reports: `tests/evidence/provider-envelope-independent/manifest.json`. `tests/provider-agent-escape-review.mjs` and `tests/provider-frontline-escape-review.mjs` intentionally assert historical defects; classify manual/direct-only after repairs. Author historical evidence is untouched. Existing handler suites use SQLite D1 shims and synthetic injected transport/provider Workers, not hosted provider or physical inference qualification. No general de-identification, clinical acceptance or B18 closure is inferred. MIS/EHR family delta review follows separately; this evidence precedes any repair.
