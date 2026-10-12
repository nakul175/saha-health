# Assigned-worker assistance status and explicit local cancellation

This bounded SAHA046/APL69 software increment gives an ASHA a visible `/assistance-control` screen for her own requests in an assigned person's existing local visit. Its exact technical child is APL229/ENG-BR-AG07. The original whole story, provider-loop acceptance, domain approvals and delivery gates remain open.

## User journey and authority

1. Fresh Today assignment list, explicit assigned person and existing current local visit selection. Reads and navigation create no visit or assistance request.
2. Own request states distinguish pending, unresolved running/uncertain, human review, applied locally, cancelled locally, failed and blocked. Applied locally does not assert acceptance by an external destination. Counter reservations do not prove processing.
3. Captured capability/version/hash and time/attempt bounds are read from the original run. Original maximum default unsent expiry remains 15 minutes and reserved-token assumption remains 6000. Absent captured bounds are not interpreted as unlimited or approved. Other step/tool bounds are explicitly not claimed by this view.
4. Request cost is an existing-rule estimate only. Missing/nonfinite assumptions are unavailable; the configured monthly limit is displayed only if the capability's captured identity/version/hash matches. No billed or total spend/remaining balance is invented. Local rules exclude other hosting charges.
5. Explicit choose, review and final stop use the existing `cancelAgent` writer exclusively. Cancelling the selection changes no persistent record. Stop blocks future local application, never recalls a sent request, reverses an accepted external action or removes saved facts. Applied/terminal requests are not newly cancellable.
6. Genuine committed-but-lost cancellation recovery retains the original exact key/body/account/organisation/person/visit/run in memory. Only explicit same-attempt recovery is offered under current authority. Reload durability is not claimed. No automatic provider retry or second cancellation is issued while this attempt is unresolved.

The bounded API checks trusted identity, active ASHA membership, explicit organisation, assigned person, current local nonimported/nonvoided/nonsuperseded visit and own run. Original normal care purpose/facility checks remain in the reused load/final-read guard and command dispatcher. The read is audited, recomputed at the same observation time, and finally reauthorized before disclosure. A context changed during the audit is refused. The original cancellation command is versionless; this feature does not invent an atomic displayed-version gate, AI invocation approval or provider send for cancellation.

Protected records and actions clear on failed refresh, audit failure, changed account/assignment, offline and page visibility loss. Read projection omits source text, proposals, output payloads, provider credentials and other workers' records. The latest fifty current visits are explicitly a bounded list, not an external activity archive. Reads in this increment are synthetic/training only.

## Actual qualification

- New pure projection/intent/original budget refusals: **46 passed**.
- Fresh build plus real disposable D1 and 390px Chromium qualification: **46 passed**, zero external calls/runtime errors, runtime disposed and owned port free.
- Original agent, minimisation, budget, task-limits and read-guard suites: **177 passed**, existing minima unchanged.
- Types, affected-source lint and catalogue pass. All original 389 guard records and existing CI workflows remain byte unchanged. New checks are not yet registered in shared publication metadata by this author.

Native checks exercise assigned status/configured captures, foreign actor/person/org/owner-clinician role/refusal, strict selector/body/origin inputs, terminal protection, explicit cancellation, real lost-success-response recovery with exact original key/body and no duplicate receipt/state, six before/after-audit scope changes, POST prerequisite revocation, changed stored-context refusal, audit errors and offline clearing. Saved all-sixty-table digest maps prove read/select/cancel-input changes only audit/metrics. Cancellation changes only the original visit, its single append-only cancelAgent revision, original organisation CAS columns, audit, command receipt and metrics; old history, completed receipts/result and clinical facts remain unchanged.

Recorded-state fixtures explicitly seed existing-schema five-minute/two-attempt capability captures and running/uncertain/review/failed/blocked/cancelled states. They do **not** prove genuine capability activation, provider dispatch, recursive loop enforcement or approval. The one actual local rules-only prepare/execute/apply operation is synthetic fixture preparation before the tested UI; the UI and new API never invoke it.

## Retained failures and corrections

The default local run failed to bind the sandbox port; actual zero-pass failure is retained. Preparation type errors (unsupported metric tag) and two JSX apostrophe lint errors were fixed and recorded. An added visual check proved closed disclosures were still rendering their contents; scoped CSS now hides those paragraphs until explicitly opened, with real expansion/collapse and 44px summaries tested. The original forty native checks remained intact.

An added author all-table expected-change list initially omitted the unchanged writer's organisation CAS and append-only record revision. Two failed runs retain that diagnosis. Existing store source was individually inspected before adding stronger exact owned-organisation-column and single own-visit cancelAgent revision controls. No source writer, original threshold or oracle was relaxed.

Raw reports, actual requests/lost-response packet, source/build before-after custody, table/history/organisation readbacks, readable phone screenshots and historical preimages are in `tests/evidence/assistance-control-20261012/author-history`. Its manifest seals author's bytes; it is not independent approval.

## Remaining gates and limitations

Independent source review and exact final CI remain pending. No story, technical task or requirement is marked Done by this source-only author handoff. Recursive real-provider limits, model accuracy/safety, genuine capability activation/clinical/domain governance, real billing/outage reconciliation, physical device and field testing, load targets, formal UAT and hosting remain unqualified. A facility-specific native race was not rerun here; its existing guard is covered by the retained original read-guard suite. Source publication, main merge and observed hosting are separate future gates.
