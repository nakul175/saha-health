# Development slice 3b — field notebook storage warnings

30 September 2026 (IST). Second part of slice 3 (offline). Synthetic data only; formal acceptance unchanged.

## What changed

- **Keep-data request.** When the notebook is unlocked it asks the browser, once per session, to keep this site's data (`navigator.storage.persist()`). The page says whether the browser agreed; if not, it warns that saved drafts may be cleared when space runs low.
- **Usage display.** After every action the notebook reads the browser's storage estimate and shows how much is used of the space available to it.
- **Low-space pause.** Space counts as low when under 50 MB is free or more than 80% of the browser's allowance is used. While low, preparing a new visit and queueing media are refused before any network call or device write, with a message to sync and remove synced copies. Editing, syncing, uploading and discarding continue, since they free space. When space frees, both resume.
- **Unknown space.** If the browser does not report storage, or the estimate fails, the page says so and does not block work.

## Evidence

- 28 client assertions (`tests/field-storage-client.mjs`) with an injected storage manager: one persistence request per session; usage text; low space by free bytes and by share of the allowance; preparing and queueing refused with no network call or device write; resumption; unknown and failing estimates; refused persistence reported.
- Browser check (headless Chromium, built Worker, synthetic account): after unlock the page showed usage against a 408 MB allowance and reported that the browser had not agreed to keep the data. Headless Chromium refuses the request; installed or frequently used browsers may decide differently. No console errors. `tests/evidence/slice-3b/storage-browser.json`.
- All suites: 1,487 HTTP/D1, 716 contract/checkpoint (688 plus 28) and 21 restore assertions. Reports in `tests/evidence/slice-3b/`.

## Limits

- The thresholds (50 MB free, 80% used) are engineering defaults, not measured on target devices.
- Browsers report estimates, not exact figures, and may still evict data. No eviction, low-storage fault injection or real-device testing was done. BR-OFF-08 and BR-OFF-02 remain partial.
- The ten-draft limit is unchanged; the 200-encounter capacity in the requirement is not built.

## Follow-up

A self-review after this slice found that a late storage estimate re-rendered the whole editor and could move keyboard focus. It now updates only the storage line; see the slice 3b follow-up in `VALIDATION.md` and `tests/evidence/slice-3b-followup/`.
