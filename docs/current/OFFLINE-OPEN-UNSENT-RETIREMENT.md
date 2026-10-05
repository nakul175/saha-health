# Acknowledged unsent local-copy retirement

This repairs the independently reproduced local link-capacity leak in `OFFLINE-OPEN-LINK-CAPACITY-REVIEW.md`. Historical server reports remain append-only. Only a local correlation link for an explicitly cleared or discarded, never-dispatched copy may retire.

New acknowledged local-registration links retain the original fixed `unsent` or `unknown` status. An explicit Clear form or never-sent registration Discard stages an opaque organisation/local-copy marker inside the existing encrypted notebook chain. The latest staged notebook must contain no current form, registration, draft, pending registration command, registration deletion, accepted mapping or unknown presentation proof for that copy. Pending unsent presentation events remain intact until an exact original-account acknowledgement. The marker then permits removal of acknowledged `unsent` links through guarded sealed compare-and-swap persistence. Empty-reference staged changes also require persistence before the UI applies their result.

Legacy links without status and every unknown link remain retained. Accepted receipt mappings still require exact protected receipt correlation and use count zero. Accepted-copy discard retention is outside this narrowly grounded repair. No pending clinical body, idempotency key, receipt reference or server history is deleted. The separate mandatory original-actor binding repair remains required.

## Validation

- 20 focused contract checks cover explicit abandonment, latest-copy/proof guards, legacy/unknown retention, lost acknowledgement with stable report UUID, failed storage, and exact accepted receipt mapping.
- 3 production-writer checks cover account/epoch changes before or during the guarded write and preservation of concurrently added optional metadata and pending clinical proof.
- 13 real Chromium/Worker/D1 checks exercise three reachable Clear/Load cycles (acknowledged link counts 1, 1, 1), never-dispatched registration Discard, bounded capacity recovery, new-form entry and exact prior ciphertext after an IndexedDB write abort. All 2,008 received historical reports remain stored.
- Existing offline-open contract 64, phone 49 and original-account transition 8 checks pass. Eleven existing field fixtures pass 417 assertions. Type checking and production build pass.

The capacity witness combines actual UI clear/discard transitions with a module-filled bounded pending queue; it does not claim 2,000 UI cycles, physical-device acceptance or removal of unresolved legacy/unknown evidence. The initial phone fixture selector failure is retained separately; its selector was corrected without changing product assertions. Before-fix evidence and its reproduction remain unchanged.

No database migration, clinical permission change or external delivery is involved. Public cache versions are app v11 and field v12; integration must preserve all current fixed public-resource whitelist entries, including the separately delivered burden modules.
