# B18 provider envelope work

This work retains synthetic defaults, service-dispatch authority checkpoints, consent and purpose guards, immutable receipts and uncertain-outcome handling. No real provider is called or activated. Provider retention, training, hosting-region and licence assurances require external contract and acceptance evidence.

## Actual call-site inventory

| Family | Execution and final transport | Existing boundary / remaining software |
| --- | --- | --- |
| Governed AI | `executeAgent` → `invokeAgent` (OpenAI Responses or approved HTTP agent); fixed-corpus `executeEvaluation` also calls `invokeAgent` | R42 checks known identifiers before prepare/checkpoint/send. First batch adds path-aware contracts, exact trusted static schema/instructions, bounded scalar shapes and redacted refusals. |
| Legacy AI | Public `runAI` handler already refuses HTTP execution before `core.apply`; lower-level `core.apply` → `externalCall` remains exported | Defensive mapped projection at final transport; public refusal remains. The historical lower-level mock witness is not a reachable public disclosure claim. |
| Independent frontline | `frontline-server` run and fixed connection diagnostic → `frontline.invoke`; receipt lookup sends no observation body | Text-only current-person scan misses `evidence.engine`. Second batch checks both evidence text and engine against known sensitive values and contact safeguards, and validates the strict request/hash immediately before transport. |
| Independent image | `anaemia-server` reserve/diagnostic → `anaemia.invoke`; receipt lookup sends no image | Existing strict cropped RGB schema excludes identity/EXIF. Second batch validates the strict cropped RGB request and original request/hash immediately before transport. |
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

First author batch: new agent envelope corpus 30, existing R42 corpus 38, agent provider 25, agent quality 50 and service-dispatch 100 checks pass. Fresh production build and typecheck pass. These are real module/injected-transport or injected-state tests; they do not claim a new actual Worker/Chromium envelope journey. Frontline/anaemia and patient-destination transport families remain active.

## Independent frontline/image family batch

The preserved `frontline-before-fix.json` witness used the actual Saha handler, checkpoint/receipt persistence, SQLite and a synthetic independent provider Worker: a known patient name in `evidence.engine` reached one provider call and returned a review receipt. This was an active route-input gap, unlike the lower-level legacy/static guard observations.

Known-name, Unicode presentation and contact checks now cover both engine and evidence text before any run/receipt checkpoint. The fresh service-dispatch callback augments the sensitive set and checks the original strict input and reserved digest; `frontline.invoke` repeats that immediate contract/hash/value check before sending. Malformed observations are refused rather than edited after approval. Image transport independently requires its existing exact cropped RGB request schema, original request ID and reserved input digest; new guard checks do not change pixels, metadata, hash, original key or receipt lookup. The diagnostic uses the same immediate contracts. Receipt lookups remain body-free and preserve legacy lookup compatibility.

New frontline envelope checks 21 and image checks 12 pass with actual Saha handlers/SQLite and injected synthetic transports; unchanged eight-provider 109 and anaemia 58 checkpoint/receipt/withdrawal/review checks pass. The complete build passes. No real provider, browser inference, physical image collection or clinical acceptance is claimed. MIS/EHR and specialised destination parity remain active required work.

## Programme MIS family

The preserved `destination-before-fix.json` witness shows a lower-level synthetic MIS transport forwarding unexpected root and field values; ordinary mapping does not author those extras. Every send now requires the exact operation-specific wire shape, configured target fields, required values and original digest. Checkpoint and fresh dispatch also compare the saved body to the current authorized mapping. Known unrelated patient identities in mapped notes refuse delivery, including Unicode presentation variants; authorized subject identifiers and ordinary numeric clinical values remain permitted. Invalid saved envelopes require review/cancellation and fresh preparation; the original body, key and receipt are never repaired silently. An uncertain delivery retains metadata-only receipt lookup even when its saved clinical body is malformed.

New MIS checks 39, existing transport contract 45 and delivery/CAS checks 16 pass, with typecheck. These use actual modules and injected transports/state boundaries; no real destination or new end-to-end Worker proof is claimed. EHR and specialised transports remain required work.

## EHR and mock ABDM document family

Outbound FHIR now has a path-specific mapped resource contract distinct from the permissive inbound structural reader. It retains linked patient ID/name, observations, recorded sources, author/reviewer/sign-off Provenance and structured unusual-value confirmation extensions. Unmapped contact/address fields, objects in scalar note fields and active narrative markup refuse the original saved envelope; the document is never stripped or rewritten. Publication authority recomputes the original bundle digest before checkpoint and at fresh dispatch. Immediate transport permits only fixed metadata, linked resource reads, bounded identifier receipt search and conditional Bundle create with its exact approved headers. No arbitrary path/header/credential forwarding is accepted. New mock ABDM outbound generation receives the same check before encryption; prior signed/received documents retain their original structural stamp and evidence.

New EHR envelope checks 45 and existing EHR48, provenance51, structural20, resolution13, actual suspended-probe20 and mock ABDM transfer21 pass. New checks cover actual builder/transport and publication authority modules; they do not claim a real external EHR or full FHIR/ABDM profile validation. No mandatory patient identity or clinical provenance was removed.

## Patient narrative follow-up

Known unrelated patient names and identifiers also refuse new EHR/mock ABDM clinical narrative at preparation and fresh publication authority. The subject and named current care authors remain permitted. Unicode presentation normalization uses explicit alphanumeric boundaries: a known person named Ray does not reject a clinical Xray note, and short numeric identifiers do not reject measurements. MIS notes use the same boundary principle. This remains a representative known-identity safeguard rather than guaranteed free-text anonymisation. Existing Organization resources with omitted optional names remain readable; object-valued names remain refused. New EHR checks now50 and MIS41; mock transfer21 and clinical provenance51 remain passing.

## Aggregate and mock enrolment family

Aggregate report envelopes now require the exact report/manifest/definition/block/cell paths and original canonical content digest immediately before the injected or default demonstration transport. Existing population freshness, differencing and cell suppression guards remain. Unexpected field names and matching patient values are not echoed into diagnostic problems. Known-value normalization covers Unicode presentation variants without rejecting ordinary numeric aggregates. The receipt search carries only original key/hash. Mock enrolment immediately validates its exact episode identity/pack/version contract and original digest, with a fresh episode-digest check at dispatch. It retains the authorized person/episode identifiers required by that destination; no clinical or name extras are added. These paths remain synthetic/local and never activate a real service.

New specialised checks33, existing aggregate12, checkpoint-population4 and destination-enrolment45 pass. Build/typecheck pass. Across the family batches, the software guards have been exercised with representative adversarial cases and existing lifecycle tests; independent review and integrated full-suite acceptance remain required. Actual provider retention, training use, region, licence and clinical acceptance require external evidence and are not represented as implemented guarantees. No real providers or new AI calls were made.

Aggregate boundary follow-up: malformed block/cell containers now produce a controlled review refusal, and the immediate transport independently repeats intrinsic suppression even when a changed small-cell payload has a valid recomputed digest. New specialised corpus41, aggregate12 and population4 pass; final build/typecheck pass. No approved report is rewritten.
