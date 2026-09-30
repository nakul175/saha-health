# Development slice 3f — photo reduction in the online workspace

30 September 2026 (IST). Completes slice 3e for the online visit screen. Synthetic data only; formal acceptance unchanged.

## What changed

- `lib/saha/photo.ts` applies the field notebook's photo reduction in the online workspace: decode, scale to at most 1280 px on the long edge, save as JPEG, and step down through six size and quality settings until under 248 KB. Embedded metadata, such as the camera's location, is not uploaded.
- The visit screen's "Photos and voice notes" panel now accepts any image type, reduces the photo before upload, and states this beside the size limit. Voice notes and the server's checks are unchanged. A photo that cannot be read or reduced is refused on the screen with a plain message; nothing is sent.

## Evidence

- 10 contract assertions (`tests/photo-contract.mjs`) with an injected decoder and canvas: JPEG output under the target; first attempt 1280 px at quality 0.8; stepping down; the decoded image is released; small photos are re-encoded without upscaling; refusals when nothing fits, when the photo is unreadable, and when the browser has no off-screen canvas.
- Browser check (headless Chromium, built Worker, synthetic owner): a 5,724,216-byte camera-sized JPEG with a synthetic location string in its metadata, attached on a draft visit, was stored as a 226,584-byte JPEG, rendered on the page (1,024 px wide), and served back without the location string. No console errors. `tests/evidence/slice-3f/workspace-photo-browser.json`.
- All suites: 1,500 HTTP/D1, 830 contract/checkpoint and 21 restore assertions. Reports in `tests/evidence/slice-3f/`.

## Limits

The limits of slice 3e apply: clinical adequacy of reduced photos is unassessed, real clinical photos were not tested, and HEIC decoding depends on the browser.
