# Support queue context isolation — 11 October 2026

This is a bounded privacy prerequisite under [ENG-BR-OPS-05 / APL-754](https://linear.app/aplyd-sandbox/issue/APL-754/eng-br-ops-05-support-without-unnecessary-disclosure), whose parent is [SAHA-118 / APL-141](https://linear.app/aplyd-sandbox/issue/APL-141/saha-118-support-without-unnecessary-disclosure). It fixes the current component's metadata and recovery controls. It does not complete either canonical item, create support tickets, or approve exceptional patient access.

## Source and current qualification

Base is current inspected main `7668a03d97c1ae62174f09e65ccd5a5717120be6`. The isolated branch is `fix/support-context-isolation-20261011`. Before component SHA-256 is `9c7dd4097c2ed61dd7b3c98a51762b6b2da832ea32328abe717a7d010bc798e6`; fixed component SHA-256 is `879f25a5a5092df79cdb8863abe560aed6a8703f74f69d9d61f5b6a6c3ad804b`. Final published source, fresh build/types/lint, server support regression, CI, independent review, merge and observed hosting remain pending at this author checkpoint.

The original component kept its previous queue, helper list and pending/error state through a new context's first commit. Passive `useEffect` cleanup happened later. Person, role, owner authority and measurement-version changes also did not trigger a fresh queue read. The actual React parent layout observer independently captured the committed DOM before passive cleanup.

The fixed wrapper replaces a keyed child when actor, organisation, visit, person, membership version/role/status/team scope, owner authority or measurement configuration changes. Old UI state disappears in that commit. Pending reads check both request sequence and captured context. Unmount invalidates the old context, so an old action acknowledgement cannot launch another former-context refresh. Same-context uncertain support metadata retry preserves the entire action and stable UUID. No clinical work is retried.

## Preserved checks and actual outcomes

| Run | Passed checks | Failed checks | Skipped checks | Exit |
| --- | ---: | ---: | ---: | ---: |
| Original main component | 20 | 14 | 0 | 1 |
| Fixed isolated component | 34 | 0 | 0 | 0 |

The [frozen 34-check list](support-context-evidence-20261011/FROZEN-CRITERIA.json) and test bytes are identical in both runs. Preserved [before](support-context-evidence-20261011/before/result.json) and [after](support-context-evidence-20261011/after/result.json) results include every verdict; raw DOM/request observations and a [SHA-256 manifest](support-context-evidence-20261011/MANIFEST.json) are retained beside them. Both owned ephemeral servers and browsers were closed. These are assertion counts, not 34 formal acceptance cases.

Coverage includes first-commit actor/organisation/visit/person/member-version/role/owner/measurement-version transitions, disabled and re-enabled measurement, late former-context GET/POST success/failure, current queue retention, exact same-context metadata retry, manual refresh, fixed request metadata and browser runtime errors. Team/status are included in the key based on authoritative membership context; they are not independently executed transition cases in this initial 34-check fixture.

The new positive suite is `integration/work-support-context-component-browser` in the ordinary catalogue, with a minimum of 34 actual passed checks. It bundles the real source component and Button; no application backend build is required for this component suite. Its API responses are explicit deterministic doubles. Existing `integration/work-support-visibility-http` and its original minimum 23 are retained for actual Worker/D1 authorization, requester/helper visibility, audit failure and changed-scope races. That suite still requires a fresh candidate build and separate execution.

## Unchanged authority and remaining gates

Identity, patient/tenant/assignment/purpose checks, server response audit, append-only support events, confirmed clinical records and stable metadata keys remain in existing `lib/saha/work-support-server.ts` and related modules. There is no schema, database, provider, paid service, recipient, hosting or clinical-policy change.

BR-OPS-05 remains partial. Task-linked redacted support cases and purpose/time-limited exceptional support access remain open. Original TC-BR-OPS-05-A and TC-BR-OPS-05-B remain **Not run**. This component fixture does not verify server authorization, integrated hosted transitions, physical devices, clinical decisions, formal UAT or delivery.

Before release, complete fresh candidate build/types/lint, the original actual-server support regression, preserved whole-CI gates and genuine separate final source/evidence review. Root serializes shared integration, native Linear and GitHub controller updates. A qualified source merge is distinct from an observed exact hosted commit and live synthetic smoke; neither is claimed here.

The registered project-runner integration-only execution also reports34/0/0, exit0, with one additive observed minimum and zero raised/lowered/removed existing minima. All374 original `#/suites` objects are independently byte-value equal; support23 is unchanged. [Preservation proof](support-context-evidence-20261011/PRESERVATION-PROOF.json) and [runner receipt](support-context-evidence-20261011/REGISTERED-RUNNER-RESULT.json) are retained.
