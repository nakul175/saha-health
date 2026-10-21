# SAHA-029 local coding completion — 20 October 2026

## Frozen scope

This record assesses **SAHA-029 / APL-52 / BR-DATA-10, Selective permitted reuse** against the frozen APL-52 product contract. The original acceptance remains unchanged: a fact approved for one task must be excluded from a second provider payload when that second destination or purpose lacks permission.

The source contract is pinned in [`tests/evidence/saha029-local-coding-completion/manifest.json`](../../tests/evidence/saha029-local-coding-completion/manifest.json). This is a local engineering completion record. It does not change the Linear status, approve the purpose vocabulary or destination policy, execute the formal catalogue cases with named participants, merge source, or establish deployment.

## Implemented behaviour

- `/selective-reuse` and its GET-only API expose a read-only review for one exact current person, confirmed original encounter, destination and purpose.
- The selected destination's current mapping creates the field allowlist. Unmapped facts, other destinations' fields and unsupported free text are absent from the response.
- A purpose-limited access grant is evaluated independently from ordinary record-read authority. Programme-delivery permission never authorises AI reuse.
- Current care role, organisation, team/assignment, consent, destination status, programme compatibility, operation policy, mapping test, mapping lifecycle, exact original plan digest and exact original prepare receipt are rechecked.
- Permission, consent, mapping, record, membership and receipt races fail closed. The client clears previously displayed protected values when the page hides, goes offline, changes account or reaches a known authority deadline.
- `sendSubmission` independently rechecks the original approving actor, patient scope, consent, purpose, connector mapping and approved payload immediately before egress. Withdrawing programme-delivery permission after prepare/approve/queue leaves the submission unchanged and sends zero bytes externally.
- Malformed legacy destination or patient programme membership data is now treated as unavailable authority and produces a withheld response. It cannot throw through the projection or retain an earlier permitted payload.

No new purpose, clinical rule, provider, database, migration or external send was added.

## Verification

| Check | Actual result | Scope |
| --- | ---: | --- |
| Selective reuse contract | 46 passed, 0 failed, 0 skipped | Positive destination allowlists; other-purpose refusal; malformed policy data; consent, role, assignment, mapping, receipt and deadline errors |
| Owned native Worker/D1/browser | 60 passed, 0 failed, 0 skipped | Actual synthetic migrations, API, dispatch-time permission withdrawal, audit/authority races, 390 px UI, zero AXE violations, zero external requests, owned cleanup |
| Service-dispatch contract | 100 passed | Fresh actor, patient, purpose, service and audit checkpoint authority |
| TypeScript | Exit 0 | Current source |
| Production build | Exit 0 | Current Vinext application |

The owned runtime was disposed and its loopback port was confirmed free. The machine-readable result, cleanup receipt, accessibility result, source pins and limits are under [`tests/evidence/saha029-local-coding-completion/`](../../tests/evidence/saha029-local-coding-completion/).

Two broader existing contract commands were also attempted and their failures are retained in the manifest: `tests/purpose-scope-contract.mjs` and `tests/mis-contract.mjs` stop before assertions because their standalone transpilation lists omit the already imported `installed-transition-authority` module. The focused selective-reuse, dispatch, typecheck, build and owned native tests do not have that harness omission. This story record does not convert those failed commands to passes.

## Coding assessment and remaining gates

No identified **application-code** gap remains against the frozen SAHA-029 behaviour. SAHA-029 can be counted as **locally coding complete** at this source once this batch is reviewed. BR-DATA-10 stays `partial` and formal cases stay `Not run` because the following are separate gates:

1. independent final source and evidence review;
2. exact-source GitHub CI, including disposition of the two existing standalone harness omissions;
3. programme-data-owner approval of the purpose vocabulary and destination policy content;
4. named frontline-worker/programme-owner execution of TC-BR-DATA-10-A and TC-BR-DATA-10-B;
5. protected merge; and
6. observation of the exact deployed synthetic commit and journey.

This record uses synthetic data only and establishes no clinical, policy, provider, production or deployment acceptance.
