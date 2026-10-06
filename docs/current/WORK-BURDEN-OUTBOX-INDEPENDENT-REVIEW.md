# Independent B26 outbox review

Reviewed isolated f284f325 with a fresh build and typecheck. Existing contract20, checkpoint13, HTTP11 and Chromium10 checks pass (54 total).

## P2: account transition between policy and event write

`public/field/burden.js` validates original notebook owner on the policy response, then POSTs only key/code. `lib/saha/work-burden-server.ts` accepts the newly authenticated care actor without comparing the originating notebook owner. Actual Chromium/Worker/D1 reproduction changes the trusted session to a second active care member of the same organisation after fetching the original policy, before event POST. The server records one capture-2m event, responds sent:1 and the original encrypted queue becomes empty.

The intentionally failing `tests/work-burden-account-transition-review-browser.mjs` preserves the original observation in `tests/evidence/work-burden-outbox-independent-review/account-transition-observed.json`. No source fix is included. Bind expected originating actor to the trusted request identity before persistence; an acknowledgement-only guard cannot undo the incorrect actor attribution.

This affects aggregate attribution, not patient facts or clinical command dispatch. Physical device acceptance and lifecycle hooks beyond the exercised standalone module remain outside this review.
