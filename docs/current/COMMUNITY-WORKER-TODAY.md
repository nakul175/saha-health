# Community Worker OS: bounded Today entry

9 October 2026. D02 / issue #175; scope SAHA-001/002/007/011/102. This is a new opt-in read-only entry at `/worker-today/`, not a replacement of the existing default app.

The entry reads the existing scoped `/api/workspace`, keeps only assigned ASHA records for presentation, and navigates to the existing protected `/app?patient=...` path. That existing application resolves the current visit and retains its guided capture/review/save behaviour. No new write command, record store, clinical priority, approval, vendor interface or model call is added. Server authorisation remains unchanged; client preview restrictions are not server security controls.

The preview accepts only active synthetic/training ASHA unpaged responses it can represent. Other roles, production, maintenance, malformed data and paged responses receive a route to the existing workspace. Refresh clears previously displayed data before attempting a new read. Errors are not represented as an empty caseload. Text is inserted with textContent; identifiers are encoded in fixed same-origin paths. No personal data is persisted by this entry.

Today, People and My Space are stable presentation surfaces. Device work links to the existing encrypted notebook. This entry is not itself offline-capable, does not unify the notebook yet and does not contain conversational assistance, Academy or earnings. These limitations must not be hidden in a demonstration.

Local evidence: the initial localhost browser-navigation attempt was refused by administrator policy; no bypass was attempted. An isolated DOM-only run with injected synthetic transport passed 22 presentation checks on 9 October 2026. It did not navigate to the application, test the actual API/save backend, verify browser storage durability, qualify a physical phone or establish ASHA usability. A runner-based real-browser/mock-API check is separate. Exact-source evidence and source-manifest refresh remain part of the draft qualification before merge.

Original formal requirements and 364-case acceptance remain pending. No merge/deployment, external service or real patient use is authorised. Revert the optional entry assets to remove this surface without changing data or the default `/app` route.
