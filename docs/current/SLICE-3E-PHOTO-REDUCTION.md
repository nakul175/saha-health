# Development slice 3e — on-device photo reduction

30 September 2026 (IST). Builds on slices 3a–3d. Synthetic data only; formal acceptance unchanged.

## Why

Phone camera photos are usually several megabytes. The media limit is 256 KB, so before this slice the field notebook refused almost every real camera photo.

## What changed

- **Re-encode every photo on the device.** A chosen or camera photo of any image type the browser can decode is scaled to at most 1280 px on its long edge and saved as JPEG. If it is still too large, the notebook steps down through six size and quality settings (to 480 px at quality 0.5) until it is under 248 KB. If nothing fits, or the image cannot be decoded, it is refused with a plain message.
- **Location metadata removed.** Re-encoding keeps only the pixels, so metadata embedded by the camera, such as where the photo was taken, is not queued or uploaded.
- The photo chooser now accepts any image type, so phones offer the camera directly; audio types are unchanged. The queued item is always `image/jpeg`, and the server's existing checks still apply.

## Evidence

- Field media queue checks 90 → 97: the device keeps and uploads the re-encoded JPEG, not the original; the first attempt is 1280 px at quality 0.8 and later attempts step down until the result fits; an image that can never fit is refused; an unreadable image is refused. Image-signature and size cases in the earlier checks were moved to audio, because images are now decoded rather than signature-checked on the device.
- Browser check (headless Chromium, real IndexedDB, built Worker): a 5,724,852-byte, 3000 × 2000 JPEG carrying a synthetic metadata segment with a location string was queued offline, reduced to 226,943 bytes, uploaded after sync, and the file served back by the server was a JPEG without the location string. No console errors. `tests/evidence/slice-3e/photo-browser.json`.
- All suites: 1,500 HTTP/D1, 820 contract/checkpoint and 21 restore assertions. Reports in `tests/evidence/slice-3e/`.

## Limits

- The online workspace's photo upload (slice 2b) still refuses photos over 256 KB; only the field notebook reduces them.
- A noisy test image is a worst case for JPEG; real clinical photos were not tested, and no one has judged whether 1280 px at these qualities is clinically adequate for wounds or documents.
- Tested in Chromium only; decoding of HEIC photos depends on the browser.
