# SAHA-132 / APL-155 — emergency and support access

Local coding-completion record, 20 October 2026. This is synthetic engineering evidence for the exact frozen contract `APL-155.md`, SHA-256 `577839665fb284904c71e0f0637b992353de02b172fe7af200cb500729b113f9`. It does not record independent approval, CI, merge, deployment, clinical approval or formal acceptance.

## Frozen outcome and current boundary

An active clinician may open a personal break-glass grant to one out-of-scope patient by record reference, for 15–240 minutes, with a reason. The grant permits record reads and urgent-care recording only. It expires automatically, can be closed early only by its clinician, and is reviewed once after ending by a different normally-authorised supervisor or care-role owner in the patient's team. An ordinary worker, administrator, wrong-team reviewer, removed or suspended member cannot use the path. The grant does not change normal assignment or clinical authority.

The existing implementation already enforced those source acceptance clauses, including multi-reference commands and outreach plans. The identified application gap was the emergency register itself: `GET /api/exceptional` discloses patient name, grant reason and review outcome, but that material read had no dedicated access event.

## Application change

- The emergency register uses the existing `viewRecordHistory` material-read action, with a fixed emergency-register detail, and is covered by the same append-only hash chain as other record/history disclosures.
- Before any emergency register response, Saha writes one patient-linked event for every grant disclosed. An empty personal/reviewer queue writes an organisation-level event, so inspection is still visible without inventing a patient reference.
- Audit details contain grant identifier, own/pending/completed category, active/ended status and current authority. They do not repeat the typed emergency reason or clinical content. A clinician's event records the emergency grant route.
- After the audit commit Saha re-reads membership and the register with the same observation time. A membership or grant/review change refuses the stale response with `409`; a revoked membership fails closed. The audit append never advances patient or organisation clinical revisions.
- The current root-verification adapter supplies the 19-check exceptional-access fixture with its `installed-transition-authority` dependency without changing the immutable original or any oracle.

## Executed evidence

| Check | Outcome | Scope and limit |
| --- | --- | --- |
| First direct exceptional contract attempt | Failed before assertions | Retained fixture failure: `ERR_MODULE_NOT_FOUND` for `installed-transition-authority.js`; no product pass inferred. |
| Current root-verification exceptional contract adapter | 19 passed, 0 failed | Reference resolution/ambiguity, role and schema refusals, personal grant and expiry, urgent-only purpose, active/daily caps, close/review and reviewer views. The first direct original fixture attempt is retained as a stale missing-module failure before assertions; the immutable original is not edited. |
| Current root-verification access-audit contract adapter | 35 passed, 0 failed | Append-only/fail-closed access commits, current-membership postcheck, content minimisation and read-cost controls. The immutable original fixture remains unchanged. |
| `npm run typecheck` | passed | Current source TypeScript only. |
| `npm run build` | passed | Production vinext build; existing chunk-size advisory only. |
| Guarded built Worker + fresh local D1 integration | 5,023 passed, 0 failed | Synthetic local runtime on port 8872. Includes one-winner/two-fresh-key race for the same patient, ordinary-role/admin/wrong-team/self/duplicate refusals, invalid reference/reason/duration, emergency urgent-care success, sharing/identity/consent/assignment/household/FHIR refusals, closure/expiry effect, single retrospective review, patient-linked read audits, empty-queue audit and typed-reason minimisation. Regression minimum remained 5,020. |

The first sandboxed integration start was retained as blocked before execution (`listen EPERM 127.0.0.1`). The permitted local rerun created a fresh D1 database, completed the suite, disposed the Worker and passed its existing guard. Neither result is hosted evidence.

## Separate pending gates

- A production-approved eligibility/default-limit policy is not supplied by this repository.
- No support-staff role is enabled unless an approved policy explicitly authorises one; the frozen acceptance requires ordinary workers to remain refused by default.
- Production identity-provider step-up and proactive team notification need approved identity/channel policy and provider capability. The in-app designated reviewer queue is implemented and audited.
- Independent source review, exact-source CI, merge, observed deployment, formal TC-BR-SEC-11-A/B execution and clinical/domain acceptance remain pending.

Within those explicit external gates, no application-code gap remains identified against the frozen SAHA-132 acceptance clauses.
