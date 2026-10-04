# Development slice 14b — proxy authority

4 October 2026 (IST). Round 14, privacy and safety batch. Requirement slice R12 of the remaining-work list, with the part of R11 it needs: "purpose-limited, expiring proxy authority with relationship/authority/expiry enforcement and representative authority on notices" (BR-ID-07, BR-SEC-04, BR-SEC-02). Builds on slice 1 (households and proxy grants), slice 6r (household sharing scope), slice 6b (rights requests) and slice 6o (consent history). Synthetic data only; formal acceptance unchanged. One command is added (`capacityRecord`, organisation-wide guard, not a certified patient command); no route and no migration.

## What was already there

- Slice 1 recorded a proxy grant on the person: the proxy (a registered person), a relationship, purposes (appointments, care coordination, medicines, referral follow-up), the sensitive classes the proxy may receive, an evidence reference and an expiry within 365 days. The household sharing preview honoured it.
- Slice 6b accepted a rights request "by a representative" when the grant was not revoked or expired. It did not check the purpose or the start, and the request did not record who the representative was.
- Consent decisions (slice 6o) recorded the staff member who entered them, never whether the person or someone else decided.
- Nothing recorded the authority a grant rests on, or the person's capacity to decide. The relationship field accepted household roles such as "head".

## What changed

- **Authority, relationship and period on every grant** (`lib/saha/household.ts`, `lib/saha/household-constants.ts`).
  - A grant now needs an **authority**, recorded separately from the relationship:
    - parent of a person under 18;
    - legal guardian (court order or law; the evidence reference names it);
    - nominated by the person (an adult not recorded as lacking capacity when they nominate);
    - representative of an adult a clinician recorded as lacking capacity.
  - The **relationship** is between the two people (the representative is the person's spouse, parent, child and so on). Household roles such as "head" are refused.
  - A grant has a **start** (today or up to 90 days ahead) and an **expiry** within 365 days of the start. One grant per proxy at a time; a renewal may start when the current one ends.
  - Two **acting purposes**, consent decisions and rights requests, sit beside the four sharing purposes. A grant with an acting purpose needs a representative aged 18 or older.
- **Checked at every use, on the server** (`grantState`, `requireProxy`). A grant is relied on only if it is in force at the time of the action and covers its purpose. It is refused when it is:
  - revoked, not started yet, or expired;
  - out of purpose, or names a different representative;
  - without a relationship or an authority. This includes every grant recorded before this slice.
  - under a parent's authority once the person's recorded age is 18;
  - under a nomination for a person under 18;
  - under a capacity representative when the latest capacity record does not say the person lacks capacity, or after a clinician recorded that they have capacity. Regaining capacity ends such a grant for good; a later finding of incapacity needs a new grant.
- **Where it is enforced.**
  - Household sharing preview: only grants in force count. A grant without authority, or a parent's grant once the child is 18, discloses nothing. The preview accepts only the four sharing purposes.
  - Consent decisions: `setConsent` and `withdrawConsent` take an optional `representative` (grant and the representative's record). The grant must be in force and cover consent decisions.
  - Rights requests: `rightsCreate` by a representative needs a grant in force that covers rights requests.
- **Capacity records** (`capacityRecord`). A clinician with access to the person records "lacks capacity" or "has capacity" for an adult, with an evidence reference and a note. Rules:
  - append-only, at most 50 per person, refused on merged records and under emergency access;
  - the result lists the capacity representative grants the record ended;
  - while the latest record says the person lacks capacity, a permission cannot be recorded as the person's own, so a representative must give it. A withdrawal is always recorded, because stopping is the safe direction.
- **The record of the act names the representative's authority.**
  - Consent events record `decidedBy` (person or representative). For a representative they also record the grant, the representative's record, the relationship, the authority and the grant period. The command result carries the same.
  - Rights requests record the same `representative`.
  - The audit text of the consent or rights event says who decided.
  - Each reliance on a grant is also its own `proxyUse` audit event on the person's record, naming the grant, the purpose, the action and the act it supported.
  - Audit text holds the representative's record reference, relationship and authority, never their name. On screen the name is shown only to a viewer who may see the representative's own record (the slice 6r rule); others see the relationship, the authority and a record reference.
- **Screens** (`app/household-panel.tsx`, `app/consent-panel.tsx`, `app/rights-panel.tsx`):
  - Household & proxies: the grant form takes the authority and an optional start. Each grant shows its authority, period and state (for example "not in force: the person is 18 or older"). A clinician can record capacity.
  - Consent history: a withdrawal can be recorded as decided by a representative. There is a form for a permission given by a representative, and each event says who decided.
  - Rights requests: the representative picker lists only grants in force for rights requests. Each request shows the representative's relationship and authority.

## Tests

- `tests/proxy-authority-contract.mjs` (new, 22 checks). It runs on the real transpiled modules and covers:
  - every grant state;
  - `requireProxy` refusals;
  - grant validation: schema, role, scope, version, start, expiry, authority, representative age, overlap and renewal;
  - capacity records: role, adult only, version, append-only, a grant ended by regained capacity;
  - consent by a representative: purpose, representative, not started, capacity, withdrawal, the recorded event and audit;
  - a parent's authority ending at 18;
  - rights requests by a representative and the rights view;
  - household sharing under each rule;
  - grant states in the household view;
  - the merged-record block.
  Removing the age-18 rule from `grantState` fails it.
- `tests/proxy-authority-smoke.mjs` (new HTTP module, 84 assertions through the built Worker and local D1), with negative cases for each new or changed command:
  - wrong role (supervisor, administrator, ASHA), a patient outside the worker's scope and stale versions;
  - schema refusals;
  - replay of a representative's consent decision (same key and body returns the saved result and adds no audit event; a different body is refused);
  - grants without authority, with a household role, a past start, a start beyond 90 days, a minor representative for an acting purpose, a parent's authority for an adult, a capacity representative without a capacity record;
  - consent and rights refused out of purpose, for a different representative, before the start, after capacity was regained, after the child's recorded age became 18, and after revocation;
  - the recorded representative and authority on consent events, rights requests and their audit text, with no representative name in audit text; one `proxyUse` event per accepted reliance and none for a refused one or a replay.
- Existing tests whose fixtures needed an authority (grants without one are no longer in force): `tests/household-contract.mjs`, `tests/household-smoke.mjs`, `tests/rights-contract.mjs`, `tests/rights-smoke.mjs` (also the rights-requests purpose) and `tests/main-review-fixes-contract.mjs`. No assertion was removed and no expected count changed.
- A headless Chrome check (one-off script, not a committed suite; built Worker, fresh local D1, synthetic owner) opened the three changed dialogs, recorded a representative's permission and read back the event: 8 checks, no console errors, page errors or 5xx (`tests/evidence/slice-14b/browser-check.json`).
- Totals on this branch:
  - unit: 131 suites, 8,066 checks;
  - HTTP/D1: 4,842; scheduled check 8;
  - restore drill 21; smoke 36 passed, 1 skipped;
  - NFR security suites 80.
  - Not run: UI journeys, performance, memory and load.
- Results are in `VALIDATION.md` and `tests/evidence/slice-14b/`.

## Limits

- **Built by one agent; no independent review.** No person has reviewed it.
- **Local defaults, not jurisdiction-approved policy.** The age of majority (18), the four authorities, the representative's minimum age, the 90-day start and the 365-day period are local defaults. Saha does not handle mature minors, does not verify the evidence behind a guardianship or nomination, and does not require a representative for a minor's own consent decision.
- **Age is the recorded age in years.** There is no date of birth, so a parent's authority ends when the recorded age is corrected to 18, not on the birthday.
- **Grants recorded before this slice are not in force.** They carry no authority and must be recorded again. On the hosted synthetic copy, such grants stop counting after a deploy.
- **No relationship register between people (R11 beyond what R12 needs).** The typed relationship lives on each grant; household membership still records a household role.
- **Uses only, not refusals.** A refused attempt to rely on a grant is answered with the reason but is not audited, like other refused commands.
- **Not covered:**
  - a representative for contact-preference permissions, EHR permissions or ABDM consents;
  - proxy rules in notifications, exports, reports and model payloads (BR-SEC-04 stays partial);
  - a representative acting through their own account or channel;
  - notice versions and notice language (R90, BR-SEC-02 stays partial).
- **Representative's record is not loaded with a consent decision.** Consent commands load only the person's record (patient partition). The check rests on the grant held on that record and the representative's record reference; a merge of the representative's own record is not detected.
- **Capacity under 18 is not recorded.** For a minor, a parent or legal guardian is recorded instead.

## Shared-file edits for the integrator

- `lib/saha/household.ts` and `household-constants.ts`: new exports. `activeGrant` was removed (no other user). `householdView` takes an optional `now`.
- `lib/saha/consent.ts` and `lib/saha/rights.ts`: they import from `household.ts`, and `ConsentEvent` and `RightsRequest` gain optional fields.
- `lib/saha/core.ts`: the `setConsent` schema accepts an optional `representative`.
- `lib/saha/types.ts`: `Person.capacity`.
- `lib/saha/merge.ts`: `capacityRecord` added to `BLOCKED_WHEN_MERGED`.
- `lib/saha/household-server.ts`: the preview accepts sharing purposes only.
- `tests/api-smoke.mjs`: one import line and one coverage entry.
- `requirements/assessment.tsv` (BR-ID-07, BR-SEC-02, BR-SEC-04, all still partial) and `requirements/evidence-map.json`.
