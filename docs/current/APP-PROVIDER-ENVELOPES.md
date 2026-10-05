# B18 provider envelope work

This work retains synthetic defaults, service-dispatch authority checkpoints, consent and purpose guards, immutable receipts and uncertain-outcome handling. No real provider is called or activated. Provider retention, training, hosting-region and licence assurances require external contract and acceptance evidence.

## Actual call-site inventory

| Family | Execution and final transport | Existing boundary / remaining software |
| --- | --- | --- |
| Governed AI | `executeAgent` → `invokeAgent` (OpenAI Responses or approved HTTP agent); fixed-corpus `executeEvaluation` also calls `invokeAgent` | R42 checks known identifiers before prepare/checkpoint/send. First batch adds path-aware contracts, exact trusted static schema/instructions, bounded scalar shapes and redacted refusals. |
| Legacy AI | Public `runAI` handler already refuses HTTP execution before `core.apply`; lower-level `core.apply` → `externalCall` remains exported | Defensive mapped projection at final transport; public refusal remains. The historical lower-level mock witness is not a reachable public disclosure claim. |
| Independent frontline | `frontline-server` run and fixed connection diagnostic → `frontline.invoke`; receipt lookup sends no observation body | Text-only current-person scan misses `evidence.engine`. Immediate strict contract/hash and complete evidence minimisation still required. |
| Independent image | `anaemia-server` reserve/diagnostic → `anaemia.invoke`; receipt lookup sends no image | Existing strict cropped RGB schema excludes identity/EXIF. Immediate request schema and reserved hash binding still required. |
| Programme MIS | `executeMis` → `misRequest` | Mapped patient fields plus current consent/connection/sign-off. Exact nested transport contract and refusal of unexpected saved payload extras still required. |
| EHR | `executeEhr` / `executeEhrProbe` → `fhirRequest` | Confirmed linked identity, scoped permission and provenance must remain. Structural FHIR checks are not a complete outbound resource-field allowlist; final path contract still required. |
| Aggregate / mock enrolment / mock ABDM | Existing specialised aggregate privacy guard and programme/mock transport contracts | Preserve suppressed counts and necessary authorized identifiers, audit all immediate transports for parity; no real destination activation. |

## First AI family batch

The mapped agent envelope now distinguishes root fields, HTTP limits, OpenAI text/format and static schema paths. A key valid at one depth cannot smuggle an extra narrative at another. Out-of-contract extras are stripped from newly constructed AI envelopes; malformed scalar/container contracts are refused. Actual `invokeAgent` pins `OUTPUT_SCHEMA` and `INSTRUCTIONS` by exact value immediately before the provider request. These constants were already server-constructed, so the historical static-bypass probe demonstrates a reusable guard gap rather than client-selected instruction injection into the active route.

Known sensitive values use NFKC, removal of zero-width presentation characters and normalized whitespace for comparison. No URL/base64 or arbitrary encoding guessing is performed. Short numeric identifiers require an explicit identifier label (`ABHA`, `RCH`, `Nikshay`, `identifier`, `record id`); otherwise a patient identifier such as 12 could falsely match a timestamp or ordinary measurement. The existing R42 corpus remains passing. This is a bounded safeguard, not a general de-identification guarantee. Errors omit actual sensitive values.

The active assistant checkpoint augments the original sensitive set with the fresh authorized state immediately before send. The fixed evaluation corpus remains server-owned and is not widened to patient input. Legacy external assistance is still publicly refused. Its defensive transport takes only the nine intended scalar facts; entered-unit metadata, override narratives and provenance objects are excluded from this newly constructed AI projection. Known patient identifiers, contact emails and phone-like notes refuse the request. This projection never changes an approved stored MIS/EHR body, its digest, its original key, a signed output or a confirmed visit.

## Historical corpus and current checks

`tests/evidence/provider-envelope/before-fix.json` records six synthetic observations from source bf35608e. The historical driver uses real minimisation/validation/core code with mock transport and no real provider. Its legacy and static observations have the narrower reachability limits described above. It must not be treated as a current regression suite.

`tests/provider-agent-envelope-contract.mjs` exercises correct paths, static binding, Unicode known-identifier variants, clinical numeric false positives, short identifier labels, redacted refusals, mapped legacy projection and actual immediate `invokeAgent` transport suppression. Other transport families remain required follow-up software work; this batch is not full B18 closure.

First author batch: new agent envelope corpus30, existing R42 corpus38, agent provider25, agent quality50 and service-dispatch100 checks pass. Fresh production build and typecheck pass. These are real module/injected-transport or injected-state tests; they do not claim a new actual Worker/Chromium envelope journey. Frontline/anaemia and patient-destination transport families remain active.
