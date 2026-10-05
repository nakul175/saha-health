# Offline sync signal-order independent review

Reviewed the lead's corrected `tests/app-offline-review-browser.mjs` against integrated product source `6dd7d0b6`, in an isolated checkout. The original CI assertion waited for pending UI text, then compared the durable key with a variable assigned by the outgoing sync POST route observer. The correction first waits for `requestfailed` on that actual `syncFieldVisit` POST, then compares the entire persisted body with the actual outgoing body, as well as the exact key and expected weight. The existing retry assertion still requires one same-key retry and no new server visit revision. No product code or receipt policy was changed.

## Actual controlled reproduction

An actual Chromium/Worker/D1 synthetic experiment held only the authenticated workspace preflight read initiated by sync. It inspected the already-visible pending text and decrypted local pending operation before releasing that read, then executed the actual POST, received server status 200, delayed 250 milliseconds and aborted the reply. No fabricated pending state or mocked server receipt was used.

Measured events (`signal-order.json`, monotonic milliseconds):

- Preflight read held: 2413.43.
- Pending UI text visible: 2415.00; POST observer had not captured a key.
- Durable pending operation read: 2435.48; old assertion false because outgoing key was not yet assigned.
- Actual sync POST captured: 2446.57.
- Server committed response 200: 2464.91.
- Client reply aborted: 2716.14; actual requestfailed: 2721.41.
- Corrected exact persisted key and whole-body check passed: 2770.16.

The early persisted key/body matched the eventual outgoing POST exactly and also matched the post-failure durable operation. This experiment found no pending overwrite. It proves the old UI signal can precede transport capture, consistent with the CI symptom; it does **not** retrospectively prove the failing GitHub job's event timing, which was not captured. `run()` invokes sync and immediately renders while sync has set pending but is awaiting persistence and its fresh-authentication read, so the UI warning describes a pending operation rather than certifying transport failure.

The timing-injected copy passed sync lost-response/same-key replay checks and accumulated 16 checks before a later account-switch reopen timed out. That failure is retained separately in `delayed-broader-run-failure.json`; its cause was not established and this run is not reported as a full pass. An independent unmodified corrected suite then passed all 22 checks, including account transitions, exact payload retention, same-key replay with no duplicate mutation, expiry and original field compatibility (`corrected-baseline-result.json`). Only the isolated port and evidence destination differed.

The correction strengthens the persisted payload assertion and chooses an appropriate transport signal; it does not weaken replay or receipt requirements. Evidence is local synthetic browser/Worker/D1 execution, not physical Android or hosted CI qualification. Source and test files in the lead checkout were not edited by this review.
