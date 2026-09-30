# Development slice 3c — media queue hardening after independent review

30 September 2026 (IST). Follows slices 3a, 3b and 6g. Synthetic data only; formal acceptance unchanged.

An independent review of the night's changes, by a separate agent that had not written them, reported six findings. All six were fixed or tightened here.

## Findings and fixes

| Finding | Severity | Fix |
| --- | --- | --- |
| Any 2xx upload response counted as confirmed, so a same-origin sign-in page returning 200 could delete the only device copy | Medium | Redirects are refused (`redirect: 'error'`). An upload counts only when the response names the stored media; otherwise the item stays pending with its key and bytes |
| Locking the notebook while a copy was being opened could still send it, without recording the pending key | Low | The epoch is checked after opening the copy and after saving the pending mark; a lock stops the send |
| "Remove synced copy" deleted queued media that had never been sent | Medium | Removal is refused while any item is pending, queued or in review; the worker uploads or explicitly discards each item first |
| Sealed copies could stay on the device after a failed device delete or a failed notebook save | Low | A failed save removes the new copy; a sweep deletes any sealed copy no queued or review item references, on unlock and before each upload |
| The HTTP check for supervisor alert scope ran before any incident existed | Low | A supervisor read is now checked while an incident is open |
| The receipt alert told operators to look up receipts for queued and retryable submissions | Low | Retitled "not yet confirmed by the destination"; the action distinguishes uncertain submissions (look up before resend) from queued and retryable ones (retry with the original key) |

## Evidence

- Field media queue checks: 70 → 90. New cases: a 200 response without a media id stays pending with redirects refused, then a retry with the same key completes; a lock while opening the copy sends nothing; a failed device delete and an orphan left by a failed save are both swept; a failed save removes the new copy; removal is refused while an item is queued and allowed after discard. The first new check fails on the slice 6g code.
- The slice 3a check that removal deletes queued media was replaced, because that behaviour was the defect.
- Operations HTTP suite: a supervisor read with an open incident raises no incident alert.
- Browser check with real IndexedDB repeated: offline queue, sync, one upload, device copy removed, no console errors. `tests/evidence/slice-3c/offline-media-browser.json`.
- All suites: 1,495 HTTP/D1, 774 contract/checkpoint and 21 restore assertions. Reports in `tests/evidence/slice-3c/`.

## Limits

The limits of slices 3a, 3b and 6g still apply. The review covered the changes made after slice 2b only.
