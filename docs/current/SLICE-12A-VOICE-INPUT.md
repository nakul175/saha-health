# Development slice 12a — voice input on every text and number field

3 October 2026 (IST). At the sponsor's request ("I want all fields to be voice to text enabled", as a Saha feature), every text box, number box and text area in the workspace and in the field notebook gets a microphone. Synthetic data only; formal acceptance unchanged (BR-UX-03, BR-DATA-03 and BR-UX-08 stay partial).

## What a worker sees

- **Workspace.** When a text or number box has focus, a microphone appears inside it at the right edge (`app/voice-input.tsx`, mounted once for the whole workspace, dialogs included). One tap listens once; there is no background listening. What was heard is shown in an editable box. For a measurement box the review shows the number that will be used (the first number heard, Devanagari digits and spoken decimal points understood) and names any other numbers heard; for an identifier or phone box every digit heard is used; for words, the text is added after what the box already holds. Nothing reaches the box until the worker taps **Insert**, and nothing is saved until the form is saved as before. The worker can switch the language they will speak between English and Hindi for each dictation.
- **Field notebook.** Every text box and the notes box has a **Speak** button (`public/field/app.js`). The review box at the bottom of the screen works the same way and the value is used only on **Use this**. The separate on-device "Dictate on device" button for notes is replaced by the button on the notes box; a transcript saved by the old button in an existing draft is still shown for review.
- **Excluded fields.** Passwords, email addresses, one-time codes, dates, files, check boxes, read-only and disabled boxes, and any box marked `data-voice="off"`.

## Where speech becomes text (the sponsor's decision, 3 October 2026)

On-device browser speech (`SpeechRecognition.processLocally`, `available()`) exists only in desktop Chrome 139 and later; MDN's compatibility data lists it as unsupported in Chrome on Android, Safari and Firefox (checked 3 October 2026). Under the earlier rule (on-device only, `FIELD-CONTINUITY.md`), the microphone could never work on an ASHA worker's phone. The sponsor chose: on-device speech whenever the browser has it for the language, otherwise the browser's own speech service only if an organisation owner allows it.

- `setSpeechPolicy` (owner only, version-checked, reason of at least 10 characters, audited, at most 200 changes; `lib/saha/speech.ts`) stores `operations.speechPolicy`. Off by default.
- It can be turned on only in the `synthetic` and `training` environments, where every record is practice data; turning it off is always allowed, and a stored "allowed" is ignored outside those environments (server and client). Using the browser speech service with real patients needs a data-protection decision this slice does not make.
- Every member's workspace carries `speechPolicy: {cloudAllowed, version}`. The first use of the browser speech service in a session shows a notice that the audio goes to the browser's speech service (Google on Android phones), and nothing listens until the worker taps Continue.
- The notebook uses the browser speech service only when the workspace loaded in that unlocked session allows it and the phone is online; offline it uses on-device speech or says that voice input needs a network.
- Organisation & team shows the setting to every member; an owner changes it there.

## Tests

- `tests/speech-contract.mjs` (unit): the setting (owner only, versions, no-op, reason, change limit, the environment rule, audit), the choice of recognizer, how heard text becomes a value for each kind of field, which fields get a microphone, and that the notebook's own functions give the same values as the workspace and use the browser speech service only as the loaded workspace allows (the notebook runs in a Node `vm` as in the other field suites).
- `tests/speech-smoke.mjs` (HTTP, through `tests/api-smoke.mjs`): owner-only, strict schema, versions, every member's workspace carries the setting, audit rows; leaves it off.
- `tests/ui/voice.spec.mjs` (browser, desktop and phone): a stand-in recognizer installed before the page loads. The notice comes before any listening; a number from speech; words added after existing notes; nothing saved until Save draft; the setting off means the microphone says so and never listens; on-device speech needs no setting or notice; Hindi; inside the Add person dialog; the review panel and microphone stay on screen at 390 px; axe finds no serious or critical violation on the review panel.

## Limits

- No real recognizer ran in any test: Chromium in a test has no microphone. Recognition quality in Hindi and English, noisy homes, accents, and the browser service's behaviour on real Android phones are untested; that is field acceptance work (BR-UX-03, BR-DATA-03, BR-UX-08).
- Number words ("one fifty two", "एक सौ बावन") are not converted; recognizers usually write numbers as digits, and when no digit is heard the review says so and nothing is inserted.
- The record does not store which values were dictated. A dictated measurement is the worker's own entry, reviewed before insertion and again before confirmation.
- The browser speech service is a third-party processor (Google on Android). Allowing it for real patient data needs a data-protection decision and is blocked outside the synthetic and training environments.
- Built and reviewed by one agent; no independent review.
