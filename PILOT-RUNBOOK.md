# Release 8: synthetic pilot rehearsal

This release adds the preparation, measurement and review workflow for a controlled pilot. It does **not** establish a clinically accepted v1.0 deployment. The environment remains synthetic, and no command promotes it to live operation. Real deployment requires implementation and evidence listed under External acceptance below.

## Set up a bounded exercise

1. An organisation owner opens **Pilot readiness → Set up rehearsal**. Name a synthetic site, select up to five teams and twenty active participants, choose versioned programme packs, and optionally choose active demonstration connections. A date window lasts at most 31 UTC calendar days. The programme cohort is limited to 1–100 records.
2. Appoint four different active accounts: programme owner/supervisor, clinical reviewer with a clinician role, security reviewer with operations access, and deployment reviewer with organisation ownership. Saha records who submitted each decision. Do not invite real users or claim professional authority solely to satisfy a checklist.
3. Write a concrete stop rule and escalation route. Example for synthetic practice: pause if identity cannot be confirmed, a device loses access, or a destination receipt is uncertain; contact the named operator; look up the existing receipt before retrying.
4. Enrol synthetic records in the selected programme packs. The measured cohort consists of current patients in selected teams with at least one **active selected programme episode**. General-care-only records and closed episodes are excluded.
5. Assess the training below. A different clinician, supervisor or operations member records the result. Team-scoped assessors can assess only participants in their selected teams. Each participant personally acknowledges a passed assessment from their own account. There is no auto-completion or owner acknowledgement on behalf of another person.
6. An owner with care access or supervisor covering all selected teams captures a seven- or thirty-day baseline. Administrators cannot capture or retrieve clinical aggregates. Existing patient assignment restrictions remain in force.
7. Record relevant evidence references, then have all four named reviewers accept the exact rehearsal dossier from their own accounts. Acceptance requires a baseline and every required training acknowledgement. **Accept** always means accept the synthetic rehearsal, not approve clinical deployment.

## Training exercises

| Module | Exercise | Expected observation and assessment evidence |
| --- | --- | --- |
| Consent and privacy | With two synthetic accounts, open an assigned record, deny access from an unassigned account, withdraw a permission, and lock a field notebook. | The assessor observes scoped access, blocked later use after withdrawal, and cleared unlocked notebook memory. Record the synthetic case reference and any unresolved finding. All roles require this module. |
| Capture and review | Open a programme episode, record measured facts and explicit missing answers, confirm the visit, inspect an AI suggestion, and create a correction. | Missing/uncertain facts are not invented; the worker reviews suggestions before applying; confirmed history and earlier receipts remain available. Care and supervisor roles require this module. |
| Offline and receipt recovery | On an approved HTTPS test device, download a signed visit packet, capture while disconnected, restart the browser, reconnect, and handle a deliberately stale sync. Reconcile an uncertain synthetic receipt. | Encrypted recovery requires the passphrase; expired or changed grants fail; conflicts retain the local draft; retries reuse the original frozen payload and operation key. HTTP preview cannot establish this result. Care and supervisor roles require this module. |
| Escalation and stop procedure | Assign a synthetic referral, record the source and evidence of a status change, create an incident in Operations, then pause/resume the organisation with an owner. | Care staff distinguish worker-entered evidence from an independently verified facility outcome. The operator records responsibility, findings and resolution evidence; receipt lookup and withdrawal remain available during maintenance. All roles require this module. |

A **needs practice** result cannot be acknowledged. The latest assessment for the module and current scope supersedes earlier training. User-entered references are not inspected, fetched, authenticated or accredited by Saha. Keep patient details, credentials and secret-bearing URLs out of all notes.

## Run and stop

- An owner starts a rehearsal only within the configured dates, with a nonempty cohort below the limit, current training, baseline, four accepted decisions, no maintenance pause and no unresolved high/critical incident.
- Readiness is recalculated from current membership, role, team scope, programme definitions and selected connection configuration. A change invalidates prior evidence/training context or dossier acceptance. The displayed effective stage becomes **paused** if an active rehearsal loses readiness. The persisted stage and original history remain available for investigation.
- Scope edits require an explicit owner pause first. New baseline measurements, training assessments and evidence references change the dossier and require fresh reviewer decisions. A decision requesting changes blocks progress.
- Rehearsal stage controls govern this review process. They are **not** per-patient traffic admission controls and do not pause unrelated sandbox work. For an organisation-wide stop, use **Operations → maintenance**. The record cap is evaluated at readiness and stage transitions, not as a database-wide patient quota.
- Resuming is a new rehearsal interval with a new start time. Earlier measurements remain historical; an outcome from an earlier interval cannot complete the resumed rehearsal.
- A supervisor/owner with all pilot care-team access records outcome counts from the active interval. Completion requires a current accepted rehearsal, an outcome for that interval, and every incident resolved. A completed cycle cannot be edited through pilot commands; an owner may save a new scope revision, retaining prior history.

## Measurement definitions

Baseline uses the last 7 or 30 **UTC calendar days**, including today up to capture time. Outcome uses rehearsal start through capture time. Both use current cohort membership and record state, not a fixed longitudinal cohort.

- Patients: current selected programme cohort.
- Confirmed visits: current confirmed visits in the selected period, excluding voided and superseded visits. Visits need not have captured the selected programme specifically; the cohort is patient based.
- Follow-ups: selected programme tasks currently open; overdue means due before today's UTC date.
- Referrals: any incomplete referral for a cohort patient.
- Submissions: cohort records queued, sending, uncertain or retryable.

Backlog is a point-in-time measure. Different baseline/outcome windows and changing cohort composition prevent causal interpretation or direct improvement claims. These metrics are not evidence of clinical effectiveness. Prior-context aggregates are excluded from the API so a changed scope cannot expose measurements from teams the reader no longer covers.

## Evidence, exports and recovery

**Evidence & decisions** retains evidence reference, findings, author and timestamp. Decisions retain the role, author and fingerprint of the reviewed dossier. Historical records remain visible as earlier scope/dossier rather than being silently relabelled current. Organisation audit records every successful mutation and export; versions and idempotency keys protect concurrent writes and lost responses.

**Export dossier** downloads the current authorised view as JSON. It contains staff identifiers and user-entered notes; keep it within the authorised team. Admin exports omit clinical measurements. Care workers receive only their own training and cannot export the management dossier. This is not a full database backup. The encrypted recovery utility in OPERATIONS.md covers the new pilot table; browser-only field drafts remain separate.

## External acceptance still required

| Area | Still outstanding |
| --- | --- |
| Clinical/programme | Named accountable clinical and programme authorities, approved programme content, intended-use safety evidence and real deployment acceptance. |
| MIS | Two actual programme partner connections, credentials, grants, callback/receipt acceptance and delivery operations. |
| EHR | Selected EHR partner tests, identity matching and independent ingestion evidence. |
| ABDM | ABHA, HIP and HIU implementation and official conformance validation. |
| AI | Approved live credentials, intended-use/language/accuracy validation and service acceptance. |
| Devices | Disconnected HTTPS physical-device restart/sync and on-device speech/language testing. |
| Security/accessibility | Independent penetration review, access/privacy assessment and assistive-technology/physical-device testing. |
| Hosted recovery/scale | Scheduled retained backups, actual cutover restore, agreed RPO/RTO, representative load and capacity, operational alerting. |

All eight remain unresolved in the product. Adding evidence or completing a synthetic rehearsal never changes `liveReady: false` and does not enable live integrations. The existing runtime credential and allowlist gates are unchanged.

## API and persistence

`GET /api/pilot` returns the authorised view, readiness and choices. `?format=export` performs an audited, permission-filtered download. `x-saha-organisation` selects an active organisation. The routes are authenticated and no-store.

Commands use `POST /api/commands`, the organisation header, JSON, an `Idempotency-Key` and current pilot `version`. Supported commands: `pilotConfigure`, `pilotAssessTraining`, `pilotAcknowledgeTraining`, `pilotMeasure`, `pilotEvidence`, `pilotDecision`, `pilotTransition`. Strict schemas, 20 KB request limit and existing origin checks apply. Stored receipt replay rechecks current membership and pilot authority. `pilotTransition` with `stage: live` is always refused.

Migration 0003 adds one organisation-keyed `pilot` table. Writes share the organisation CAS transaction with append-only audit and command receipts. Pilot data is bounded (500 training, 200 evidence, 200 decisions and 100 measurement records); there is no archival/purge workflow in this release. Programme/configuration fingerprints include selected members and connections. Config revision increments invalidate prior evidence; normal pilot version increments prevent stale writes. Existing full-organisation state loading remains a scalability limitation.
