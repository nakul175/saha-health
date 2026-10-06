# App-first frontline UI

5 October 2026 (IST). Additive Android/browser presentation foundation. Synthetic demonstrations only; no formal acceptance is promoted.

`/app` opens the same authenticated Saha workspace in a compact touch interface. At desktop widths it presents a 460px phone frame for demonstrations. `/` remains the full web workspace. The page declares `/app-manifest.webmanifest`; the Android packaging workstream supplies that manifest and its icons.

## Journey and reuse

Today and People use the existing assigned work and patient directory. Today explicitly includes overdue and upcoming work and is not a calendar filter. Referrals reuses the scoped tracker or the existing paged referral route. More uses `shownViews` for role-scoped navigation and retains organisation/language choices and sign-out.

Opening a patient, starting a visit, entering observations, saving a draft, reviewing and confirming use the existing `WorkspaceApp` and `VisitWorkspace` code paths. Server authorisation, read-audit refusal, idempotency keys, version checks, conflict review, unsaved navigation guards, consent and submission approval remain in those existing paths. No API command, migration, provider enablement or clinical rule was added.

Sync explicitly separates device drafts from programme submissions. It does not read the encrypted notebook and does not invent a device queue count. “Open device drafts” navigates to the existing `/field/index.html` notebook, which requires unlocking. Notebook sync retains its existing distinction: registrations, drafts and media upload separately; syncing creates an unconfirmed server draft and does not execute a programme submission.

## Evidence

- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node scripts/run-framework.mjs build`: passed; existing large client bundle warning remains.
- `node tests/app-first-ui.cjs`: 15 rendered React policy/status checks passed.
- `node tests/app-first-browser.mjs`: 16 checks passed against real cached Chromium and an isolated local synthetic Worker/D1. It covers ASHA role tabs, honest Sync, programme submissions, More visibility, audited patient opening, draft capture, unsaved navigation guard, save/readback, blocked confirmation without explicit patient check, no sideways scroll at 390px and a desktop phone frame.
- `tests/evidence/app-first-ui/` contains dated results and actual phone/desktop screenshots.
- `tests/ui/app-first-phone.spec.mjs` adds the corresponding Playwright suite journey. The package `@playwright/test` was absent from the linked local dependency set, so this wrapper was not run locally; the direct real-browser harness above was run.

The direct browser harness defaults to `playwright-core`. In this environment `SAHA_BROWSER_PACKAGE` pointed to the bundled runtime package and `SAHA_CHROMIUM` to cached Chromium. Localhost listener access required sandbox escalation; the initial restricted run failed before migration and was then rerun successfully with authorised local listener access.

## Remaining boundary

This is a shared web presentation ready for Android packaging, not proof of an installed APK, Android speech/camera integration, offline reload of `/app`, security certification, clinical approval, field usability or production readiness. The offline notebook remains a separate encrypted application; no vault contents are copied into the React app. App navigation and the new Sync/More explanatory copy are English; existing Hindi clinical translations remain draft.

The comprehensive patient record still includes lower-priority panels after the core visit flow. Future touch usability work should progressively disclose those panels while preserving clinical notices and record controls. Existing client bundle size and backend memory/audit contention risks remain outside this UI patch.
