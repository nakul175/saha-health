# Development slice 3j — field notebook capacity of 200 visit drafts

30 September 2026 (IST). Field slice, stacked on slice 3i. Synthetic data only; formal acceptance unchanged. No migration and no server change.

## What changed

- **200 visit drafts.** The field notebook (`public/field/app.js`) now holds up to 200 prepared visit drafts (`DRAFT_MAX`), up from 10. The 201st is refused before any network call with a bilingual message to sync and remove synced copies first; the on-screen hint says 200. Each draft is still a server-signed, 24-hour visit grant prepared one patient at a time.
- **Sync all reads the workspace once per run.** Before, every draft in Sync all re-read the online workspace (and saved the notebook once more for it) before sending. Sync all now reads the workspace once per organisation per run and passes it to each draft's sync; the check that the signed-in worker prepared the draft is unchanged, and the server still authenticates and authorises every command. Syncing one draft on its own still reads the workspace first.
- **Unchanged.** Offline registrations stay at 10, the media queue at 4 items per draft and 1 MB per device (slice 3a), and the low-space pause (slice 3b) still applies before preparing. The notebook is still one encrypted record rewritten on every save.

## Evidence

- 15 client checks (`tests/field-capacity-client.mjs`, the slice 3a Node harness with real Web Crypto and vault sealing, injected storage and network): 200 drafts for 200 synthetic patients saved and sealed (no plaintext in the stored record); lock and unlock return all 200 with their notes; the 201st prepare is refused with no network call, while with 199 drafts the capacity check passes and the prepare reaches the network; Sync all sends exactly 200 `syncFieldVisit` commands in notebook order with 200 distinct keys, reads the workspace once, and marks all 200 synced; a draft whose response was lost is resent with its stored key and nothing else is sent.
- Measured in that harness on the build machine (Node, instant injected network; not a reference device or network): the sealed notebook with 200 drafts is 274,835 bytes of ciphertext, stored as a 0.98 million-character record because the vault keeps ciphertext as a number array; one save takes about 28 ms; unlocking takes about 101 ms; Sync all of 200 drafts takes about 9.1 s, almost all of it the two notebook saves each draft needs (the stable key before sending and the receipt after). Before the workspace-read change the same run took 21.4 s with 201 workspace reads. Report: `tests/evidence/slice-3j/field-capacity-client-result.json`.
- Browser check (headless Chromium at a 412 × 915 phone viewport, real IndexedDB and Web Crypto, built Worker): 200 drafts sealed with the notebook's own vault functions and a synthetic signing key (251,343 bytes of ciphertext; the browser reported 547 KB of site storage). After a reload, unlocking verified all 200 grant signatures and listed all 200 drafts in 328 ms on the build machine; the hint says 200; no console errors. `tests/evidence/slice-3j/3j-browser-check.json`.
- The other eight field client and contract suites passed unchanged.
- All suites: see `VALIDATION.md`.

## Limits

- No physical-device run: quota, eviction, rendering of a 200-draft list on a low-end phone, a full Sync all against a live server and battery use were not tested. The browser check seeds drafts directly rather than preparing 200 grants through the server. NFR-12 (95 percent of a 200-record queue within five minutes on a reference network) stays unverified.
- Saving rewrites and re-encrypts the whole notebook, so Sync all grows with the square of the number of drafts; a per-record vault and binary ciphertext storage are not built.
- Preparing is still one patient at a time; there is no "prepare all due visits" batch, and each grant still expires after 24 hours.
- 100 queued media items within an approved storage allowance (NFR-11) are not built; the media queue is unchanged.
