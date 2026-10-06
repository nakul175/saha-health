# Decoded AI source and Unicode contact guard repair

Grounded pre-fix evidence remains unchanged in `95ff3ea9` and `PROVIDER-ENVELOPE-INDEPENDENT-REVIEW.md`. This authored repair follows that independent review; the lead independently verifies integration.

OpenAI envelope validation already parses the exact source/task JSON contract. It now scans the parsed source with the existing known-sensitive canonical comparison, as well as retaining existing envelope checks. It returns the original encoded input string, so no wire, key, hash or source quotation changes. JSON escapes defined by the actual envelope format are parsed; arbitrary encodings in clinical notes are not guessed. Existing preparation and checkpoint source guards remain.

The defensive legacy projection checks each of its nine mapped scalar strings rather than their encoded JSON representation. Notes use the existing canonical presentation normalizer for contact comparisons, while original strings remain intact. Public legacy HTTP runAI remains hard409; this repair does not enable a route or provider.

Frontline `identifierIn` normalizes presentation before existing email/phone and patient name/village comparisons. It refuses fullwidth contacts and zero-width insertion without rewriting approved evidence, reserved digest, request ID or receipt body. All three frontline checks (before checkpoint, fresh service checkpoint and immediate invoke) use the same safeguard. This is bounded contact/known-value detection, not general de-identification.

## Verification

459 focused checks pass; fresh build and TypeScript pass. New agent39 proves immediate known-name tab/newline/zero-width refusal before transport, strict JSON Unicode-escaped source refusal, mapped legacy/contact defense, and exact clean multiline date/measurements wire/key. New actual-handler/SQLite/provider frontline29 proves fullwidth email/phone and zero-width contact refusal before checkpoint with byte-identical visit and unchanged receipts/provider counts; immediate invoke also refuses. Clean signed receipt transport still succeeds. Actual JSON Unicode-escaped known name is decoded and refused before transport.

Original R4238, agent30/frontline21/image12 corpora, full independent frontline109/anaemia58 checkpoint/receipt/withdrawal/review suites, provider25/quality50 and EHR48 identity/document/provenance contracts pass. EHR mandatory identities and lineage are retained; no general AI minimizer is applied to an approved stored EHR body. Pixel and source/hash envelopes remain unchanged.

Dedicated reports/hashes: `tests/evidence/provider-envelope-decoded-fix/manifest.json`. Historical diagnostics intentionally assert before-fix behaviour and remain manual/direct-only. No real provider, hosted acceptance, physical image/Android qualification, clinical approval or B18 closure is claimed; MIS/EHR family deltas are reviewed separately.
