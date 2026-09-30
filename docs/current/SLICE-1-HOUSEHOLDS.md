# Development slice 1 — households and proxy authority

30 September 2026 (IST). First functional slice of the development-completion plan. Synthetic data only; formal acceptance unchanged.

## What changed

- **Households.** Migration `0007_households.sql` adds an organisation-keyed `households` table. A household has a label, a care team and dated members with a relationship. A person can belong to one current household; ending a membership keeps the history. Commands: `householdCreate`, `householdAddMember`, `householdEndMember` (care roles with access to the person; version-checked; audited; person revisions record the change).
- **Proxy authority.** `proxyGrant` and `proxyRevoke` record, on the person whose information it is: the proxy (a registered person), relationship, purposes (appointments, care coordination, medicines, referral follow-up), the sensitive classes the proxy may receive, an evidence reference, and an expiry within 365 days. One current grant per proxy; up to 20 current grants per person.
- **Sensitive classes.** Derived per person: maternal (maternal programme or episode), TB, adolescent (10–17) and child (under 10). Referral items carry every class the person has, because a referral reason can reveal any condition.
- **Disclosure rule.** Anything prepared for one household member about another includes a member only when a current grant on that member names the recipient and the purpose, and includes an item only when the grant names every sensitive class the item reveals. Members without such a grant are omitted entirely, so the recipient cannot infer pending care. The recipient's own items are always included.
- **Staff scope is unchanged.** Household membership never grants staff access: an ASHA sees only assigned members and a count of others. `GET /api/household` loads only the household's members.
- **Workspace.** A "Household & proxies" dialog on the patient page shows the household, adds and ends members, records and revokes proxy grants, and previews what can be shared with a chosen member for a chosen purpose.

## Evidence

- 51 new HTTP/D1 assertions (`tests/household-smoke.mjs`): household creation and membership versions; duplicate membership refused; sensitive classes; a maternal follow-up withheld from a grant without the maternal class and shown once the class is granted; purpose mismatch, duplicate grant, self-proxy, over-long expiry and unregistered proxy refused; revocation; guardian grant for a child; admin and supervisor refused; ASHA scope showing one member plus a count; ending a membership; audit and revision records.
- 12 contract assertions (`tests/household-contract.mjs`) cover class derivation, referral class inheritance, expiry, revocation, grants to someone else, adolescent class withholding and former members.
- Browser check (headless Chromium, built Worker, synthetic owner): created a household, added a member, recorded a proxy grant, and previewed sharing for the Appointments purpose; the pregnant member's sensitive items stayed hidden and only the general home visit was shown. No console errors.
- All suites: 1,001 HTTP/D1, 410 contract/checkpoint and 21 restore assertions (the restore drill now covers 26 tables including households). Reports in `tests/evidence/slice-1/`.

## Limits

- Sensitivity rules are a local default, not jurisdiction-approved policy. They are applied to household sharing previews only; notifications, exports, reports and model payloads do not yet evaluate proxy grants (BR-SEC-04 remains partial).
- Household changes use the organisation-wide commit guard; very busy organisations may see more retries on household edits.
- No household scheduling engine, bulk caseload transfer by household, or household-level outreach yet (BR-PROG-05, BR-ID-04).
- Grants record an evidence reference; the software cannot verify that consent was actually given.
