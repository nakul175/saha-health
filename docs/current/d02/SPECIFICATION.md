# D02 / issue #175 — frozen specification, revision 1

Frozen before implementation on 10 October 2026. Base: 43f445acf4c54352cd2084e0bcd88bfbf605d757.
Scope owners: SAHA-001,002,007,011,102; wider scheduling, capture, Hindi, offline and parent acceptance remain pending.

## Outcome and UX

An active signed-in synthetic/training ASHA opens `/today`, sees only her current assigned,
authorised, unmerged records and opens exactly the selected existing person's read-only identity
context. Heading Today; list label Assigned records. Explicit copy says this is not a dated daily
schedule. Preserve database source order, with the first row labelled Next in your list; no priority,
new task or completion inference. Show name, village and complete stable record ID (wrapping), so
duplicate names and shared short-ID suffixes cannot be confused. Context shows name, village,
record ID, age and sex, with Back to Today. This minimal identity context does not promise a full
clinical chart. Open, back and refresh are the only actions. English only.

Loading, zero assignments, failed source, permission refusal and unsupported workspace are
distinct. A failed refresh clears content. Every open rechecks live identity, assignment and audit.
No stored list/detail, service worker, offline preparation, browser storage, speech or provider.
Going offline clears content; returning/focusing/visibility restoration clears then reloads it.
Abort outstanding requests and reject late responses after navigation or visibility loss. Account
changes are detected on the next server request or browser focus; no push session revocation is
promised. Back reloads the authorised list instead of reusing a previously cached record.

## Runtime/data boundary

New `/today` page imports a dedicated client, never WorkspaceApp or its editor. New GET-only
`/api/today` accepts either no query (list) or exactly one validated `personId` (context); extra,
duplicate or malformed query fields are refused. Other verbs have no handler. No command dispatch,
provider routes, administration or links to legacy surfaces exist in this experience. Existing
`/app` and legacy authorised APIs remain separately preserved; this is not a global revocation of
their existing capabilities. Direct probing of new route descendants and mutation verbs must fail.

Reuse `identity`, `loadFor`, `scope`, `environmentOf`, `recordPatientList`, `recordAccess` and
`accessRoute`. Never read raw public identity headers. `loadFor` retains current assignment and
policy enforcement and scheduled-caseload processing. Check role/environment before returning
any record, then select only server-permitted unmerged records directly assigned to this ASHA.
List response projects ID/name/village only; detail adds age/sex only. No full snapshot reaches
the client. Audit must durably succeed before any response. Read-only means no new visit or
clinical fact: existing account bootstrap and due-caseload housekeeping retain their existing
semantics and are not a new patient store. No schema/API provider/migration changes.

ASHA source is unpaged (`patient-directory.ts` preserves full ASHA caseload); a detected paging
shape is refused explicitly, never silently truncated. This version inherits whole-caseload
load cost; no performance or scale acceptance beyond measured synthetic fixture is claimed.

## Gate: nine pre-merge criteria and one post-deployment criterion

| ID | Required evidence |
|---|---|
| A1 | Real built Worker/D1 list contains only current assigned unmerged records, truthful labels/order; ASHA role/environment gating. |
| A2 | Duplicate-name rows distinguishable by village/full ID; each opens its own current context; back works. |
| A3 | Before/after patient/visit facts unchanged by list/open; durable list and viewPatientRecord audits tied to actor/person. Audit failure returns no content. |
| A4 | Browser loading, empty, source failure, refusal and unsupported states distinct; failed refresh removes old content. |
| A5 | Anonymous, inactive/non-ASHA, cross-tenant, unassigned, revoked assignment, malformed/extra/tampered ID requests refused without disclosure. |
| A6 | Independent client has no monolithic import; no mutation handler/action/descendant route; network probes verify boundary; legacy remains intact. |
| A7 | 360x640 and 390x844, 200% text, no horizontal overflow, 44px action targets, labelled keyboard open/back/refresh and focus after navigation. |
| A8 | Offline/unavailable clears old content and makes no successful/offline-ready claim; no plaintext persistent browser data or AI dependency. Late responses cannot restore cleared data. |
| A9 | Real types/build, focused scope/identity/audit regressions, repository documentation/catalogue/security gates and current-head CI; separate QA/review receipts on final diff with unresolved findings blocking merge. |
| A10 | Existing authorised host reports exact merged/deployed SHA and live synthetic list/open/back/refusal smoke. No delivery claim or next story until this passes. |

Release rejects unmatched records, client-only authority, accidental clinical writes, fabricated
priorities, silent partial lists, audit bypass, activated excluded workflows or missing evidence.
Keep failures; fix code and rerun affected gates without weakening criteria. Record current-head
CI/protections and independent human approval requirements; no bypass. Merge only this PR under
standing sponsor authority. Existing DigitalOcean follows main if confirmed; retain freeze and
provider-off settings. Missing host access/build evidence is an explicit deployment blocker.
Rollback is a reviewed source revert, never a database/history rollback. Old #173/#184/#187 remain
reference only. No old code/test passes qualify this path.
