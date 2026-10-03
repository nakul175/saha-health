# Test slice 11c — browser UI tests: journeys, screenshot regression and accessibility

3 October 2026 (IST). Round 11 builds the testing ecosystem around the existing contract and HTTP suites. This slice adds the first suite that drives the real screens: Playwright with Chromium against the built Worker and a fresh local D1, with synthetic data only. It adds no application behaviour. `lib/`, `app/` and `worker/` are untouched.

Built by a builder agent from the round-11 base commit (slice 11a). No person has reviewed it, and no acceptance case in the test catalogue changes status because of it.

## What it tests

One command (`tests/ui/playwright.config.mjs`) runs 17 tests in two Chromium projects: `desktop` (1280x720) and `phone` (390x844). A global setup starts the built Worker once on port 8821 through `tests/lib/worker.mjs` and stops it at the end. Each test makes its own synthetic accounts (a random run id in every e-mail address), so tests share a Worker but not people.

| Spec | Journey |
|---|---|
| `owner-setup.spec.mjs` | An owner sees the six demonstration people, sets a display name, invites an ASHA by the ASHA's own account code, the ASHA joins with the invitation code in a second browser, the owner assigns one person, and the ASHA then sees that person and nobody else. The server's workspace answer is cross-checked. |
| `asha-visit.spec.mjs` | An ASHA starts a visit for the assigned person, uses the visit assistant on a note with a danger-sign blood pressure (152/114), reviews and applies the extracted fields, saves the draft, reads the urgent finding naming the CHC/FRU referral, confirms the visit, prepares, approves and runs the programme plan, finds one accepted and one uncertain receipt, looks the uncertain one up (no resend, still one attempt), and the server shows two accepted receipts with one attempt each. |
| `roles.spec.mjs` | The owner sees every menu entry; a supervisor sees Operations and its alert for the unconfirmed receipt and none of Clinical governance, Programmes, AI tools or Expansion; an ASHA menu is care work only; the server refuses an ASHA the operations read and answers the supervisor. |
| `governance.spec.mjs` | The owner opens Clinical governance and finds the demonstration protocols (marked not approved for real patients) and the source library. |
| `phone.spec.mjs` (2 tests) | At 390x844 the visit list, the menu sheet, the visit form (fields fit, accept input, save), the clinical review, the review step and the receipts of a sent visit have no sideways scroll, and what was typed reaches the server. |
| `hindi.spec.mjs` | Slice 10j: English by default, choose Hindi, My work and the patient page read Hindi inside `lang="hi"` while the page stays `lang="en"`, the draft-translation notice is shown, record values stay as recorded, the danger sign stays bilingual, the choice survives a reload and the server holds it, and English comes back. |
| `errors.spec.mjs` (3 tests) | A stranger who opens another organisation gets "Workspace unavailable" with no patient data and a working Try again; an unknown invitation code is refused with a message and the dialog stays open; an address that is not a page shows the not-found page with status 404. |
| `harness.spec.mjs` (7 tests) | Self-checks of the harness itself, below. |

Every journey also does these three things through the shared fixtures (`tests/ui/fixtures.mjs`):

- **No browser problems.** Uncaught page errors, console errors and HTTP 5xx answers are collected for every page. A test that otherwise passes fails if any is left over. The allow-list is empty by default. A test that provokes a refusal on purpose allows its own message with `lab.allow(regex, reason)`; the reason is mandatory and the allowed message appears in the report. Five messages were allowed in the final runs: the 403 for the stranger (twice, once for each attempt), the 404 for the unknown invitation code, the 404 for the unknown address (the browser reports each refused request as "Failed to load resource"), and one in the harness test that proves the allow-list works.
- **Accessibility.** `lab.scan` runs axe-core 4.13.0 with the WCAG 2.0 to 2.2 A and AA tags on the screen as it stands. Serious and critical violations fail the test (soft, so the remaining screens are still scanned). Every violation of any impact is recorded in the report. 25 screens are scanned: owner home, organisation page, invite dialog and assignment dialog; ASHA home, menu, visit form (empty and filled), assistant extraction, recorded-facts review, clinical review, programme plan, receipts, organisation page after a refused code; supervisor Operations; governance protocols and source library; ASHA My work and patient page in Hindi; the refusal screen; the not-found page; and phone My work, visit form, clinical review and receipts.
- **Screenshots.** Eight screens are compared against committed baselines (see below).

### Harness self-checks

A check that cannot fail is worse than none, so `harness.spec.mjs` proves the checks can fail. Five tests are marked `test.fail()` and pass only when the check under them really fails: axe finds missing labels and low contrast in a page written in place; an uncaught page error fails the journey; a console error fails it; an HTTP 5xx answer fails it; an allow-list entry that does not match does not hide the message. Two tests must pass: an allow-list entry with a reason lets exactly that message through and lists it; screenshot masks hide dates, receipt numbers and codes, and the same page unmasked differs. The Playwright list output prints the five `test.fail()` tests with a cross mark although they count as passed; read the summary line, not the marks. The reporter leaves their deliberate findings out of the accessibility results.

I also swapped one committed baseline for another by hand (the governance baseline replaced by the operations one), ran the governance spec and saw it fail with a size and pixel mismatch, then restored the file.

## Screenshot regression

Eight baselines, committed under `tests/ui/baselines/<project>/`:

- desktop: `owner-home`, `asha-home`, `visit-form`, `clinical-review`, `receipt-uncertain`, `operations-alerts`, `governance-protocols`
- phone: `phone-home`

Settings: `maxDiffPixelRatio` 0.02, animations disabled, caret hidden, CSS scale, and a 250 ms settle after the network is idle, fonts are loaded and toasts are gone. Dates, times, receipt numbers (`SIM-`, `AGG-`, `MIS-`, `EHR-`) and account codes are masked in grey by text pattern. `receipt-uncertain` is a screenshot of one receipt row. Two accepted choices keep it stable:

- Two receipts created in the same second are ordered by their random record id (`submissionList`), so which row is first changes from run to run. The test screenshots only the Community health MIS row.
- The last row of the list has no bottom border (`.receipt-row:last-child`), so the same row looks different in first and last position. `tests/ui/receipt-row.css` removes that border for this screenshot only. The row was re-baselined once after this was found, then the ASHA journey passed four times in a row (`--repeat-each=4`). I did not record which order each of those four runs happened to show, so the claim is that the border no longer matters, not that both orders were seen.

`governance-protocols` masks the sidebar content, because the sidebar's scroll position differed between runs.

### Font limitation, and how to regenerate

The baselines were rendered on the machine that built this slice, in headless Chromium, where Arial resolves to Liberation Sans and there is no Devanagari font. GitHub's hosted runners, or a developer machine, can render the same page with different fonts, and a 2 percent pixel budget may not absorb that. If the comparison fails on a clean checkout with no application change, regenerate the baselines on the machine that will run them and commit them with the reason:

```
npx playwright test -c tests/ui/playwright.config.mjs --update-snapshots
```

Use `--update-snapshots`, not `--update-snapshots=missing`; the latter writes missing files but fails that run by design. A screenshot failure leaves the expected, actual and diff images under `test-results/ui/` (git-ignored). No Hindi screenshot is compared at all: without a Devanagari font a Hindi baseline would be boxes. The Hindi journey checks text, `lang` attributes and the saved choice instead.

## How to run

From the repository root, after `npm run build` (the Worker is the built `dist/`):

```
npx playwright test -c tests/ui/playwright.config.mjs                     # whole suite; starts and stops its own Worker on port 8821
SAHA_UI_PORT=8831 npx playwright test -c tests/ui/playwright.config.mjs  # another port for the Worker it starts
npx playwright test -c tests/ui/playwright.config.mjs --project=phone    # one project
npx playwright test -c tests/ui/playwright.config.mjs asha-visit         # one spec
SAHA_UI_BASE=http://127.0.0.1:8787 npx playwright test -c tests/ui/playwright.config.mjs   # reuse a local Worker you started
```

`SAHA_UI_BASE` must be a local address; the config refuses anything else, because the journeys send the local dispatcher's identity headers and write data, which a hosted Site must never receive. The Worker needs a fresh local D1 for the run, which `tests/lib/worker.mjs` gives it. On the 2-core shared machine I ran it through the queue (`bash /tmp/claude-0/par/heavy.sh f npx playwright test ...`).

Chromium comes from the Playwright installation (version 1.56.1, Chromium build 1194). On a clean machine or in CI install it first with `npx playwright install --with-deps chromium`; that was not run here because the browser was already present, so the CI step is untested.

Configuration: Chromium only; one worker process; `retries` is 1 when `CI` is set and 0 otherwise; trace on first retry; a screenshot on failure; output in `test-results/ui/`; `forbidOnly` in CI. Locale en-IN and time zone Asia/Kolkata, as the workspace formats dates that way.

The reporter (`tests/ui/reporter.mjs`) writes `tests/reports/ui-result.json` (git-ignored) in the `tests/lib/report.mjs` shape (`suite`, `layer: "ui"`, `passed`, `failed`, `skipped`, `startedAt`, `completedAt`, `environment`, `limits`, `measures`, `checks`) plus `durationMs`, `flaky`, the accessibility scans with every violation, the allowed browser messages and the number of baselines. A flaky test (passed on retry) counts as passed and is listed in `flaky`. Playwright's own exit status is non-zero on any unexpected failure.

## Results

All four full runs were against the final code, through the queue, on the build of this branch.

| Date and run | Tests | Passed | Failed | Skipped | Flaky | Test time | Wall time | Screens scanned | Axe violations |
|---|---|---|---|---|---|---|---|---|---|
| 3 Oct 2026 03:07 UTC, run 1 | 17 | 17 | 0 | 0 | 0 | 107.2 s | 2 min 19 s | 25 | 0 |
| 3 Oct 2026 03:09 UTC, run 2 | 17 | 17 | 0 | 0 | 0 | 107.8 s | 2 min 20 s | 25 | 0 |

Earlier runs of the same suite before the last small changes (an option to pass a style file to the screenshot helper, and the local-only guard on `SAHA_UI_BASE`) also gave 17 of 17 twice, at 105.1 s and 107.2 s, and the ASHA journey alone passed 4 of 4 when repeated. The test time is Playwright's own; the wall time includes starting the Worker and waiting for the queue. The longest test is the ASHA visit (about 32 s), then the owner set-up (about 20 s).

No retry was used (retries are 0 locally), so a flaky test would have shown as a failure. Four runs and four repeats are a small sample; a flake rate cannot be read from them.

### Accessibility results

Axe found no violation of any impact on any of the 25 screens in the final runs. Nothing is hidden or excluded: no rule is disabled, no element is excluded, and the same findings would be listed in `ui-result.json` under `accessibility.violations`. The earlier audit (`tests/a11y-audit.mjs`, 81 screens at slice 10j) also found none. Axe checks a subset of WCAG failures; it does not check focus order, reading order, sensible labels, colour use beyond contrast, or screen-reader output.

## What this proves

- The main journeys work through the real screens, in a real browser, on the built Worker: set-up, invitation, assignment and scoping to the assigned person; a visit with a danger sign from assistant to receipts; the uncertain receipt resolved by lookup with no resend and one attempt; the role menus; governance protocols; Hindi switching and persistence; refusals shown as refusals.
- The screens named above have no axe violation at WCAG 2.0 to 2.2 A and AA, on desktop and phone width.
- No journey produced an uncaught page error, a console error or a 5xx answer beyond the four refusals each test allows by name and reason.
- The phone-width screens do not scroll sideways, and the controls sit inside the width.
- The harness itself can fail in each of the ways it claims to check.

## What it does not prove

- No acceptance criterion passes because of this. All 176 formal BRD acceptance criteria and the 364 catalogue cases stay as assessed; none is promoted. These tests are evidence for the screens, not a clinical or acceptance judgement.
- Chromium only, headless, two viewports. No Firefox, no Safari or WebKit, no real phone, no touch-only behaviour, no slow network, no offline field notebook.
- Screenshots are compared on one machine's fonts (above). A pass proves the rendering did not move by more than 2 percent of the pixels in the masked regions; it does not prove the design is right.
- The Hindi text is a draft translation. The test shows it is displayed and labelled, not that it is correct.
- Identity is the local dispatcher header model of a local Worker. The hosted staging Worker, real sign-in and real sessions are not exercised.
- The journeys use the demonstration programme simulator and demonstration protocols, not a real programme, EHR or protocol.
- Set-up goes through the HTTP API for the journeys other than the owner set-up, so those tests do not repeat the set-up through the screens.
- No keyboard walk, focus indicator check, zoom or reduced-motion test, and no screen-reader run.

## Application defects found

None. No journey was blocked and no application file was changed. Observations, none of which this slice asserts as a defect:

- A stranger who opens another organisation sees the full menu labels (Clinical governance, Programmes and so on) beside the "Workspace unavailable" message, with no data behind them. The server refuses every read; the menu is display only, as slice 9b states.
- The search placeholder on the phone visit list is cut off ("Search name or villag") at 390 px.
- Two receipts created in the same second appear in an order that depends on a random record id, so the first row can differ between loads of different runs. That follows from the sort in `submissionList` (creation time, then id).
- `GET /api/governance` is read by an ASHA, because the clinical review panel uses it for the visit's protocols and services. That is by design; the menu hiding is display only.

## For the integrator

- **Dependencies.** `package.json` gains exact-pinned dev dependencies `@playwright/test` 1.56.1, `playwright-core` 1.56.1 and `@axe-core/playwright` 4.13.0; `pnpm-lock.yaml` is updated (68 lines added, 7 removed) and adds `playwright`, `axe-core` and an optional macOS-only `fsevents`. Because Next and its wrappers declare `@playwright/test` as an optional peer, their lockfile keys now carry the suffix `(@playwright/test@1.56.1)` and the production SBOM now lists three Playwright components (`@playwright/test`, `playwright`, `playwright-core`) as required. They are not in `dist/`. After a build `node scripts/security-gate.mjs` passes: 226 production components, no critical or blocking advisory, 46 accepted advisories.
- **Documentation check.** `package.json` and `pnpm-lock.yaml` are files in the application baseline manifest (`docs/verification/`), so `python3 scripts/check-documentation.py` reports "Changed baseline file" for both until the integrator regenerates the manifest. `.gitignore` is reported too, but it already differed at the round's base commit (slice 11a), not because of this slice. I did not edit `docs/verification/`.
- **CI.** The workflow is not touched. A CI job needs the Chromium install above, `npm run build`, and then the one command. Browser traces and failure screenshots are under `test-results/ui/` for upload.
- **Runner.** The suite is a Playwright config rather than a single `.mjs` file; its exit status is Playwright's and its report is `tests/reports/ui-result.json`.
- **Install problem on the build machine.** The container's global pnpm is 10.28.0. Under `scripts/sites-env.sh` (which changes `HOME`), pnpm 10 tries to fetch pnpm 11.25.0 by running `pnpm add pnpm@11.25.0`, which starts the same bootstrap again, without end. I stopped my own processes and ran the pinned 11.25.0 binary directly. A different pnpm on the PATH avoids it; this is a note about this machine, not a repository defect.

## Limits

- Written and run by a builder agent. No person has reviewed the tests, the baselines or this document.
- Four full runs and four repeats of one journey; no soak, and no run on any machine other than the one that made the baselines.
- The new dependencies add 68 lines to the lockfile and three components to the SBOM. All three direct packages were published more than seven days before this slice (Playwright 1.56.1 on 17 October 2025, axe-core 4.13.0 on 5 August 2026, `@axe-core/playwright` 4.13.0 on 11 August 2026), so the `minimumReleaseAge` rule in `pnpm-workspace.yaml` needed no exception. `playwright-core` is pinned directly because `@axe-core/playwright` declares it only as a peer.
