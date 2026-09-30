# Development slice 7b — care contexts and encrypted consent-bound transfer (mock gateway)

30 September 2026 (IST). Second part of slice 7. Synthetic data only; formal acceptance unchanged. **Nothing in this slice talks to ABDM**, and the encryption is not tested against ABDM's libraries or any partner.

## What changed

- **Care contexts (HIP side, BR-INT-18).** `abdmCareContextLink` (clinicians, HIP module enabled with approval, ABHA linked) links a patient's current confirmed visits as OP consultation care contexts under the current ABHA. Each keeps its record date and the ABHA it was linked under.
- **Consent-bound transfer (BR-INT-18, BR-INT-19).** `abdmFetch` (clinicians, HIU module, granted and current consent) runs a mock HIP inside Saha: for each care context the consent covers (status, ABHA link, purpose, type and record date via slice 7a's checks) and still linked under the current ABHA, it builds the visit's synthetic FHIR bundle, encrypts it for the requester's one-time public key (X25519 key agreement, HKDF-SHA-256 with both sides' nonces, AES-256-GCM) and returns it with a SHA-256 checksum. The HIU side decrypts, verifies every checksum and that each entry is a FHIR Bundle; any failure stores nothing. The transfer is recorded as delivered with its entry count and acknowledgement time.
- **Received-record review (BR-INT-19).** Received entries are held as "review" and are not added to the record. `abdmReceivedReview` (clinicians) accepts or rejects each with a note.
- **Privacy.** Workspace snapshots omit decrypted bundles and mask ABHA numbers on care contexts; the ABDM view shows a resource summary.
- **Workspace.** The patient's "ABHA & consent" dialog gains care-context linking, fetch under a granted consent, and review of received records.

## Evidence

- 29 new HTTP/D1 assertions (`tests/abdm-transfer-smoke.mjs`): care contexts refused before an ABHA and to an ASHA, linked once and refused twice; fetch refused before grant and to an ASHA; one entry received; snapshot without bundles and with masked numbers; review once; revocation refused to an admin and allowed to the owner; fetch refused after revocation.
- 19 contract assertions (`tests/abdm-transfer-contract.mjs`) cover module and ABHA prerequisites, draft visits refused, date-range filtering, the decrypted bundle equalling the HIP bundle apart from its generation time, ciphertext not containing the patient's name, a different key failing to decrypt, flipped ciphertext and a wrong checksum refused, review rules, revocation and relinking stopping transfers, and redaction.
- Browser check (headless Chromium, built Worker, synthetic owner): linked a visit as a care context, fetched under a mock-granted consent and accepted the received record. No console errors.
- All suites: 1,452 HTTP/D1, 613 contract/checkpoint and 21 restore assertions. Reports in `tests/evidence/slice-7b/`.

## Limits

- The HIP and HIU are the same Saha organisation; there is no gateway routing, callback, data-push URL or partner HIP.
- The key-agreement and encryption parameters are Saha's choice and have not been compared with ABDM's specification or libraries.
- Only OP consultation bundles from Saha visits are produced; no discharge summaries, prescriptions or diagnostic reports. Accepted records are marked, not merged into visits. NRCeS profile validation (BR-INT-17) is not built.
