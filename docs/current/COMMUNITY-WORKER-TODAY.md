# Community Worker OS: bounded Today entry

9 October 2026. D02 / issue #175; scope SAHA-001/002/007/011/102. Draft PR #183. This is a new opt-in read-only entry at `/worker-today/`, not a replacement of the existing default app.

## Implemented boundary

The entry reads the existing scoped `/api/workspace`, keeps assigned ASHA records for presentation, and navigates to the existing protected `/app?patient=...` path. That existing application resolves the current visit and retains its guided capture/review/save behaviour. No new write command, record store, clinical priority, approval, vendor interface or model call is added. Server authorisation remains unchanged; client preview restrictions are not server security controls.

The preview accepts only active synthetic/training ASHA unpaged responses it can represent. Other roles, production, maintenance, malformed data and paged responses receive a route to the existing workspace. Refresh clears previously displayed data before attempting a read. Errors are not represented as an empty caseload. Text is inserted with textContent; identifiers are encoded in fixed same-origin paths. No personal data is persisted by this entry.

Today, People and My Space are stable presentation surfaces. Device work links to the existing encrypted notebook. This entry is not itself offline-capable, does not unify the notebook yet and does not contain conversational assistance, Academy or earnings. Those limitations must remain visible in demonstrations.

## Observed evidence

Local browser navigation was refused by administrator policy; no bypass was attempted. An isolated DOM-only run with injected synthetic transport passed 22 presentation checks. It did not navigate to the actual application, test the API/save backend or verify browser persistence.

GitHub run `37921840916`, job `113791364265`, checked candidate source `84e8efb6c5ad498aaa1d43dde0f6ecff10a0046f`. Documentation/requirements, catalogue, pinned installation, typecheck, build and 22 real-Chromium tests with a mocked scoped API passed. The new minimum is 22 for `ui/worker-today`; all existing minimum entries are unchanged. Source metadata was generated with the repository's baseline script and its documentation/requirement checks passed. Metadata blobs were downloaded and independently matched by SHA-256 and Git blob identity before publication. The temporary blob-preparation workflow was removed in favour of a read-only test gate.

The tested assets and harness are pinned by the current source manifest. Evidence artifacts from that run: `worker-today-test-evidence`, `worker-today-prepared-metadata`, `worker-today-prepared-blobs`. The actual screenshot is a synthetic/mock-API screen, not a real patient or backend-save demonstration.

## Remaining acceptance

No built-backend new-entry-to-save journey, real keyboard, physical phone, offline restart, clinical validation, external partner or ASHA usability acceptance is established by these checks. Existing original requirements/formal cases retain their pending status. D03 next qualifies the actual entry-to-save path; D04/D05 extend continuity. Parent scope is not closed because the narrower entry tests pass.

## Release

No merge, deployment, provider activation or real patient use is authorised. The default `/app` and its data remain unchanged. Reverting the optional assets removes this surface without a data migration. The documented DigitalOcean updater follows main independently of the Cloudflare freeze; draft publication is not deployment permission.
