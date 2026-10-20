# SAHA-105 external messaging and scheduling — local coding completion

Date: 20 October 2026. Base source: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`. Frozen contract: APL-128 / SAHA-105 / BR-CARE-07, SHA-256 `814db697baccf910c80bee41ef4e54351f63649405ed57c3e7ccf23054e876ad`.

## Implemented local boundary

The outreach surface now supports a complete synthetic-only application path for the frozen requirement:

- An operations member stages each SMS, IVR, messaging or appointment channel independently. The record contains only a fixed `synthetic-receipt-simulator` adapter and the three required readiness capabilities: delivery evidence, opt-out handling and recovery work. It has no endpoint, secret, credential name or live-send switch.
- A different active operations member must approve a complete channel record. Self-approval and incomplete readiness are refused. Suspension preserves the record and prevents new preparation or execution.
- A worker prepares a neutral reminder only against an active scheduled outreach item, current patient contact permission, an independently approved template and an independently ready SMS simulator record. The exact patient identity, assignment, outreach purpose/context, contact preferences, template, channel review and schedule are bound into the approval hash.
- Current application/API preparation refuses a message without that reviewed channel. Historical channel-less records remain readable, but server execution refuses them outside the retained direct legacy-test harness so they cannot bypass the runtime channel gate.
- A different clinician or supervisor approves the exact prepared context. Changed patient assignment, member authority, contact, plan, template or channel review refuses execution before a receipt is added.
- Synthetic execution is available only in synthetic or training environments. It never invokes an external provider. A stored attempt records provider delivery as `delivered` or `failed` and always records patient acknowledgement as `unconfirmed`.
- Failed delivery creates or retains worker-owned recovery work. A later delivery receipt does not close it. Retries use the same message history, require fresh review, are version-bound and remain limited to three attempts.
- Direct patient acknowledgement is a separate, versioned, scoped worker action with its own evidence reference. It does not change the outreach item to completed care and does not close delivery-failure recovery.
- The existing signed synthetic STOP callback remains the opt-out path. It revokes contact permission, appends consent/audit evidence and cancels unsent reminders without granting consent or sending a message.

The UI exposes channel readiness, exact channel selection, delivery state, patient-acknowledgement state and recovery ownership separately. It continues to state that no live message is sent.

## Verification

| Check | Actual result |
| --- | --- |
| Focused SAHA-105 contract | 20 passed, 0 failed, 0 skipped; positive, missing-channel refusal, invalid readiness, changed proposer authority, changed channel context, production-environment refusal, version race, failure recovery and separate acknowledgement |
| Full synthetic HTTP/D1 integration | 5,030 passed, 0 failed, 0 skipped through the repository-owned disposable fixture runner |
| Current reminder opt-out HTTP fixture | 57 passed, 0 failed |
| Current household outreach HTTP fixture | 107 passed, 0 failed |
| Existing reminder opt-out contract | 39 passed, 0 failed |
| TypeScript | `tsc --noEmit` passed |
| Production build | passed; 641 client-reference, 479 server-reference, 638 RSC, 2,243 client and 485 SSR modules transformed |
| Lint baseline | passed at the unchanged 1,392-error baseline; 632 warnings were reported against the stored 618-warning baseline, which the existing gate does not fail |

Machine-readable focused evidence is in `tests/evidence/saha-105-external-messaging/contract-result.json`; the integration runner report is in `tests/evidence/saha-105-external-messaging/http-report.json`.

Retained diagnostics: the first focused invocations could not load TypeScript because this fresh worktree had no dependency link. After using the existing workspace dependency tree, two pre-existing direct legacy contract runners (`outreach-contract.mjs` and `notification-channel-contract.mjs`) still failed before assertions because their static transpile lists omit the newer `installed-transition-authority` dependency. A direct API entry invocation also correctly failed without its disposable database fixture. One final integration attempt was blocked before tests because the sandbox denied the local listener; the authorised local runner then executed. Its first strict-channel run exposed a stale fixture channel after an operations-authority version change, correctly refusing with 409. The fixture now suspends that historical readiness record and obtains a fresh independent readiness review; the final 5,030-check run passed. The first lint run found four newly added explicit-`any` annotations; those were removed and the final error count returned to the unchanged baseline.

## Separate gates still pending

This is local application coding completion only. It does not establish an approved live SMS, IVR, messaging or appointment provider; provider credentials; real incoming events or receipts; sender or channel qualification; language/domain approval; execution of formal `TC-BR-CARE-07-A` or `TC-BR-CARE-07-B`; independent final source review; CI on a published commit; merge; observed deployment; or production/clinical acceptance. Formal BRD acceptance remains pending, and no real recipient was contacted.
