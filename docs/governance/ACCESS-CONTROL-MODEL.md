# Access-control model

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update trigger: a change to roles, `lib/saha/access.ts`, `lib/saha/identity.ts` or the hosting sign-in gateway.

Status: summary of the implemented model, drawn from the documents cited. Not independently reviewed; no access-control certification is claimed. Detail: [06 Security, privacy and clinical safety](../current/06_Security-Privacy-and-Clinical-Safety_v1.1.md), [Administrator guide](../current/ADMINISTRATOR-GUIDE.md).

## Principles

- Authorisation is enforced on the server. A visible button grants nothing.
- Owner authority does not override patient scope. Administrators have no patient-record scope.
- Hidden patients are not revealed by refusals; a stale or revoked authority is rechecked on replay.

## Authentication (who is the caller)

`lib/saha/identity.ts` trusts exactly one provider per deployment, chosen by `SAHA_IDENTITY_PROVIDER`; headers of the other provider are ignored. Ids beginning `fixture:` or `system` are reserved and cannot sign in.

| Deployment | Provider | How |
| --- | --- | --- |
| DigitalOcean droplet (current) | `sites-chatgpt` headers set by Caddy | Caddy checks an email and bcrypt-hashed password from `/etc/saha/saha-health.users`, then sets the headers itself, overriding the browser's. No sign-out, lockout or multi-factor step ([deploy/README.md](../../deploy/README.md)) |
| Cloudflare staging (frozen) | `cloudflare-access` | Signed `Cf-Access-Jwt-Assertion` verified (RS256, team keys, issuer, audience, expiry); account ids namespaced `access:` |
| Machine callers | Service identities (slice R13) | Owner-managed, named owner, expiry, single connector/agent scope; never signs in |

## Authorisation (what may the caller do)

| Role | Patient scope | Limit |
| --- | --- | --- |
| ASHA | Directly assigned patients in current teams | Capture and bounded reviewed actions |
| Clinician | Patients in current teams | Care and designated clinical review |
| Supervisor | Patients in current teams | Oversight, assignment, reconciliation; no clinical fact writes |
| Administrator | None | Configuration and operational metadata; no clinical export |
| Owner flag | Per membership role and teams | Organisation, membership, configuration |

Narrowing and exceptions (all additive or time-bound, all audited):

- Facility, locality and programme scope reach every check ([slice 13a](../current/SLICE-13A-ACCESS-SCOPE.md)); purpose/programme grants only narrow access ([slice R09](../current/SLICE-R09-PURPOSE-SCOPE.md)).
- Household proxy authority ([slice 1](../current/SLICE-1-HOUSEHOLDS.md)); time-limited delegation of supervision ([slice 1e](../current/SLICE-1E-DELEGATION.md)).
- Exceptional (break-glass) access: 15 minutes to 4 hours, reason of at least 20 characters, urgent-care actions only, independent after-the-fact review ([slice 6a](../current/SLICE-6A-EXCEPTIONAL-ACCESS.md)).
- Invitations are single-use, account-bound and expire after 72 hours; the app sends no email.
- Role removal or suspension should stop online access within 5 minutes (NFR-09, proposed; not measured in production).

## Request-level controls

Cross-site API requests are refused, reads included ([slice 13a](../current/SLICE-13A-ACCESS-SCOPE.md)); commands carry CSRF and idempotency controls and are version-bound. Reading material records (history, media, FHIR download, searches) is audited and fails closed if the audit cannot be written ([slice 6t](../current/SLICE-6T-ACCESS-AUDIT.md), [10h](../current/SLICE-10H-READ-AUDIT-COMPLETION.md)). Audit is append-only with a per-organisation hash chain ([slice 6j](../current/SLICE-6J-AUDIT-CHAIN.md)).

## Authorisation matrix evidence

`tests/nfr/authorisation-matrix.mjs` ran every GET route by eight principals (336 requests) with no defect found, locally, on 2026-10-03 ([slice 11d](../current/SLICE-11D-NON-FUNCTIONAL.md)). Not a penetration test.

## Gaps

No multi-factor or lockout on the droplet; no independent security test; separate target roles (programme owner, AI governance, integration operator, auditor/privacy, support) are not all implemented; periodic access review procedure: TBD (owner: Nakul Jain).
