# Development slice 13a — access scope everywhere

4 October 2026 (IST). At the sponsor's request ("fix all"), this slice closes the access findings left open by the integration of the 15 R-slices (#144) and adds a server-side backstop for the cross-origin answer Cloudflare Access gives on hosted staging. Synthetic data only; formal acceptance unchanged (BR-ID-02 and BR-DATA-10 stay partial).

## What changed

- **API requests another website started are refused, reads included.** `lib/saha/cross-site.ts`, called first in the Worker entry (`worker/index.ts`), refuses any request under `/api/` that the browser marks `Sec-Fetch-Site: cross-site` or `same-site`, or that carries an `Origin` other than the site's own (including `null`), with a 403 that carries no CORS header and no data. Changes were already refused cross-site (`server.ts` `parseRequest`); reads were not. Hosted staging showed Cloudflare Access reflecting a foreign `Origin` with credentials allowed on its anonymous answer (slice 11h); with this rule, and with the Access cookie now `SameSite=Lax` (set by the sponsor's agent in the Cloudflare dashboard on 4 October 2026), another site can read only a refusal. The three server-to-server endpoints that authenticate with their own signature or credential (`/api/mis/callback`, `/api/anaemia-connection-test`, `/api/frontline-connection-test`) are exempt. The refused request's body is drained first, as `measured()` does, because an unread body on a reused local connection turned the next request into a 503 (found by the HTTP suite during this slice).
- **Facility, locality and programme scope reach every check.** Slices R08 and R09 applied their policy only where a caller passed it (the workspace scope gate). `lib/saha/access.ts` now binds the organisation's policy to its members when the state is read (`store.readState`, `store.scope`, `bindAccessPolicy`), so `normallyAllowed` applies it in every check that uses it: the viewer's commands and reads, and judgements about other members (an eligible follow-up owner, a receiving worker). Checks that test team membership themselves (follow-up owners in `field.ts` and `programme-commands.ts`) call the new `withinPolicy`. An emergency-access grant is not narrowed, as in R08. A member not bound to a state (a hand-built test member) keeps the plain team scope.
- **The SQL pre-filter applies the same policy.** `store.viewerScope`, used by the viewer-scoped workspace read, the paged patient list and detail, the server work lists and identifier search, reads only the `accessScope` and `purposeGrants` keys of the operations row and adds `access.policySql`: facility membership, locality (the patient's own, else its facility's), and programme membership, failing closed when an enforced dimension has no assignment. A non-ASHA member of every team, previously read without a filter, is filtered when a policy narrows them. The emergency-access branch is no longer limited to patients outside the viewer's teams when a policy applies, because an in-team patient outside the policy may still be reached by a grant.
- **Purpose grants stop data flows at their checkpoint.** `purpose-scope.ts` maps the commands that start an outbound flow to a purpose (`COMMAND_PURPOSE`: plans, submissions, destination enrolment, identifier corrections and incentive claims → programme delivery; EHR publication, retrieval and import, EHR links and permissions, ABDM consent request, care-context link and fetch → care coordination; assistant prepare, execute and apply → AI assistance; aggregate reports → reporting; household membership, visit scheduling and proxy grants → household sharing). `server.ts` checks it right after the member is resolved; the routes outside the command path check theirs (anaemia and frontline runs: AI assistance; indicator figures: reporting; a household disclosure preview to another person: household sharing). A member whose active grant lists purposes is refused (403) any other purpose. Lookups that resolve an uncertain outcome are not stopped: they send no new data and refusing them could leave an outcome unknown.

## Tests

- `tests/access-scope-contract.mjs` (unit, 8 checks against the real transpiled modules):
  - which requests are refused and which endpoints are exempt;
  - the bound policy applies to any member of the state, is read live, never widens, and leaves emergency grants and unbound members alone;
  - `policySql` selects exactly the patients the JavaScript policy allows, on a real SQLite database, over 6 policies × 2 grant sets × 4 members and 45 synthetic patients;
  - purpose permits, and every mapped command exists with no lookup mapped.

  A mutation of either the SQL predicate or the JavaScript policy fails it.
- `tests/access-scope-smoke.mjs` (HTTP, through `tests/api-smoke.mjs`, in its own organisation), checking each of these over HTTP:
  - cross-site, same-site, foreign- and opaque-origin reads and commands are refused with no CORS header and no data;
  - same-origin reads, pages and the signed MIS callback are unaffected;
  - facility scope narrows the workspace read, the patient list, patient detail and commands, and lifts when turned off;
  - a programme grant narrows the same;
  - a purpose grant stops a plan and indicator figures, and leaves record scope unchanged.
- `tests/scheduled-job-contract.mjs`: the Worker-entry assertion now expects the cross-site gate in front of the application.

## Limits

- The Cloudflare Access answer to an anonymous cross-origin request still reflects the `Origin` with credentials allowed; that answer never reaches the Worker, so the hosted smoke check (slice 11h) may still fail. With `SameSite=Lax`, a cross-site request carries no Access cookie and receives only that anonymous answer; this has not been verified with a signed-in browser on the hosted site at the time of writing.
- `Sec-Fetch-Site` is sent by current browsers; a very old browser that sends neither it nor `Origin` on a cross-site read is not caught by this rule (the SameSite cookie still applies).
- A purpose is a label over the flows this release has, not a clinically approved data-use policy, and the mapping is by command; a new flow command must be added to `COMMAND_PURPOSE` (the contract checks only that every mapped command exists).
- Members added during a command, and states built without `readState` or `scope`, are not bound until the next read.
- Built and reviewed by one agent; no independent review.
