# Eight independent community-health apps

3 October 2026. Synthetic engineering demonstration; no clinical activation or BRD acceptance.

The eight fictional organisations each have a private Site, source repository, independent D1 receipt store, service secret, app UI, API and provider console. Saha is a customer and retains its care-role, assignment, permission, current-visit and review controls.

| App | ASHA workflow | Open model function |
| --- | --- | --- |
| Oral Saathi | Persistent mouth sore documentation and clinical review | Whisper speech transcription |
| Skin Saathi | Skin concern documentation for ANM/clinician assessment | Whisper speech transcription |
| Shishu Breath | Infant breathing checklist and manually counted respiratory rate | Whisper speech transcription |
| Matri Check | Pregnancy/postnatal danger-sign checklist | Whisper speech transcription |
| Poshan Check | Child MUAC and oedema observations | Whisper speech transcription |
| Teeka Reader | Printed vaccination-card text verification | Tesseract LSTM OCR |
| Dawa Follow | Printed medicine list and follow-up barriers | Tesseract LSTM OCR |
| Report Reader | Printed laboratory-report verification | Tesseract LSTM OCR |

The independent apps offer English/Hindi model input; the embedded Saha capture currently offers English. Model inference is client-side using Transformers.js 3.5.2 / onnx-community/whisper-tiny q8 or Tesseract.js 5.1.1. Models require an initial network download. No open cancer, skin, video breathing or image nutrition classifier is deployed. Clinical referral prompts use explicit demonstration rules and are not AI diagnoses. No treatment or measured value is automatically written.

Model sources: https://huggingface.co/onnx-community/whisper-tiny and https://github.com/naptha/tesseract.js . Indian programme relevance comes from ASHA home-visit tasks; it does not establish model validation for Indian populations, dialects, devices or programme policy.

## Saha integration

Connections lists the eight provider cards and separate consoles. In a confirmed current visit for an explicitly synthetic patient, an assigned ASHA or clinician can choose an app, stage a fictional example or read a fictional upload, correct the text, answer every observation and explicitly approve sending. Only the corrected text and observations leave Saha; no raw image/audio, patient identifier or visit identifier is sent. Free text can contain identifiers if a user enters them: minimisation is not a complete free-text identifier filter.

Three routes add four method/route handlers: GET/POST `/api/frontline-providers`, POST `/api/frontline-assessments`, POST `/api/frontline-connection-test`. No migration or certified patient command is added. JSON contracts are bounded and strict; pinned public HTTPS origins, server-only credentials, private dispatch, no redirects, synthetic-only configuration, AI permission, restrictions, assignment, maintenance, disputes and provider revisions are checked. Agreements are synthetic bootstrap defaults and owner suspend/activate actions are revisioned.

Saha persists the request checkpoint before one provider attempt. Each provider binds request ID to customer and input hash in its own D1 store. Duplicate keys cannot change input. Timeouts, malformed or unverified results remain uncertain; recovery looks up the same receipt using GET and never repeats inference. A changed person, visit, permission or agreement withholds output. Human acknowledgement/rejection needs a reason. Signed receipts attest provider validation and rule processing; browser inference provenance is a client assertion, not remotely attested inference. HMAC is a shared-secret demonstration, not independent third-party verification.

The connection diagnostic accepts only a fixed built-in synthetic fixture plus app ID and the selected provider credential. It reads/writes no patient context and verifies the returned receipt. It is for deployment checks, not patient assessment.

## Configuration and publication

The default `.env.example` keeps `SAHA_FRONTLINE_DEMO_ENABLED=false` and an empty `SAHA_FRONTLINE_PROVIDERS_JSON`. Only the existing owner-private Sites synthetic demonstration is configured. The hosted staging deployment remains disabled by its existing external-services switch. The JSON secret maps exact app IDs to `{origin,key,dispatch}`. The independent apps have separate `PARTNER_KEY` secrets. Secrets and databases are excluded from source.

The providers are independently built and published before Saha. Their source is retained in separate Sites repositories. `tests/fixtures/frontline-providers/worker.mjs` is the exact provider handler snapshot used by the consumer contract suite; assets are supplied per app and eight separate SQLite stores exercise the service contract. It is test material, not a combined production provider.

## Evidence and remaining work

199 provider handler/SQLite checks and 82 Saha-to-provider contract checks passed. Type checking and the Saha production build passed. The existing anaemia contract passed 58 checks. Eight affected governance/access/identity contract suites passed. All eight deployed Saha-to-provider connections passed 72 live checks for signed results, independent persisted receipt lookup and invalid-credential refusal; no patient records were affected. Reproduction uses `scripts/check-frontline-connections.mjs` with server-only configuration through secure stdin.

Browser access was refused because the computer-use tool could not verify its admin-enforced security policy. No bypass was attempted. Real-browser upload/model execution, model accuracy, Hindi in the embedded Saha capture, handset performance, accessibility review, representative clinical evaluation, approved clinical content, retention administration and real provider agreements remain pending. Documentation integrity and the 176-requirement audit passed after restoring unchanged source and screenshot baselines from current GitHub main. Formal acceptance remains unchanged.

## Integration with main (pull request #145) — 3 October 2026 IST

At the sponsor's instruction ("merge all") this work was merged into `main` without independent human review, after an agent review. Hosted staging cannot reach any provider: its configuration forces the external-services switch off, and the demonstration flag and provider settings are unset. Fixed during the integration (each with a check in `tests/frontline-provider-contract.mjs` that fails without the fix):

- **One open request no longer blocks every app on a visit for ever.** An outstanding request blocks only its own app. When a lookup finds the patient, visit, permission, agreement or provider configuration changed (409), the request is ended as blocked, its result withheld, without contacting the provider; the caller still needs the care role and patient scope, and a paused organisation (423) is not ended this way.
- **Identifiers in the evidence text are refused (422) before the checkpoint**, with the same safeguard as other external AI sources: e-mail addresses, phone-like numbers of 10 or more digits, and the patient's name or village. It is a safeguard, not de-identification.
- **A receipt lookup is recorded as an external request** (access audit) before the provider is contacted, as for the anaemia provider.
- **The connection diagnostic answers 401 before it reveals whether an app is configured**, and is measured under its own route name.
- **The contract suite writes its result to `tests/frontline-provider-contract-result.json`**; the dated files in `tests/evidence/frontline-eight/` are no longer rewritten by a run.
- **The visit panel is hidden** for roles that cannot use it, and where no provider is configured (hosted staging), unless the visit already has requests.
- Three historical `VALIDATION.md` headings whose dashes had been corrupted were restored.

Still open: the browser loads Transformers.js and Tesseract.js from a CDN at run time with no integrity check, outside the SBOM and audit gate, and Saha sends no Content-Security-Policy (reachable only when the demonstration is enabled; pin them as dependencies or run inference on the provider's origin); a receipt's fields are not compared with what was sent and one HMAC key serves as credential, receipt signer and diagnostic credential; the 199 provider-side checks cannot be reproduced from this repository; the code is written on very long lines that are hard to review.
