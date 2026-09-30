# Release 10 / v1.2-readiness — Requirements audit and care continuity

27 September 2026. Private synthetic engineering release.

The requirements baseline previously lacked a complete, explicit account of what was implemented and what remained. Registration could also create possible duplicates without review, visit confirmation lacked a server-bound positive patient check, and changing an assignment did not transfer all related open work. This release addresses those local workflow gaps and records the complete remaining scope.

## Changes

- All 176 BRD v1.1 requirements have an exact-source record, local implementation assessment, current behaviour, remaining work, primary target batch and related source/test context. JSON, CSV and Markdown are generated from the same checked inputs. Source document SHA-256 is retained.
- Registration searches only the signed-in account's permitted patients. Possible matches require an explicit decision and reason; candidate versions bind the review. Uncertain identity can retain a separate provisional record. Names preserve Hindi combining marks. No auto-merge or national identity claim is made.
- Provisional records permit draft capture while confirmation, patient-specific AI, referrals, programme delivery, EHR disclosure and reminder execution are blocked. Scoped clinician review records identity evidence.
- Visit confirmation now requires the current patient ID/version and a positive check, with actor/time stored. Earlier confirmed records remain unchanged.
- Patient assignment moves open follow-ups, referrals, outreach items and message-recovery tasks atomically, records effective assignment history, revokes field grants and cancels pending reminders. Receiving workers acknowledge the current handover. Supervisors can see tasks whose owners no longer have access.

## Validation

**1,107 automated assertions passed:** 756 built-Worker HTTP/D1 assertions, 29 new continuity contracts, 303 retained contracts/checkpoints and 19 encrypted restore checks. These are assertions at several layers, not 1,107 end-to-end workflows. TypeScript, production build, source whitespace and all-176 traceability consistency checks passed.

The restore drill verifies all 24 SQLite tables and confirms resolved identities, handover acknowledgements and positive patient-check metadata through the restarted built Worker. No new database migration is required; metadata uses existing versioned patient/visit storage. Matching and handover tests verify permission boundaries, stale review rejection, replay, completed-work preservation, receipt preservation and revoked owners.

Desktop preview exercised possible-match registration, a provisional synthetic record, saved draft capture, blocked confirmation and clinician review through Care handover. Earlier synthetic patients, confirmed visits and referral evidence remained available. Multi-account transfer/acknowledgement is covered by HTTP/D1, not browser account impersonation.

## Remaining scope

The audit identifies **14 implemented-local, 129 partial, 24 not-built and 9 unverified** requirements. **All 176 formal acceptance criteria remain pending.** Local code and synthetic tests are not clinical, field, regulatory, partner or production acceptance.

Six delivery batches remain planned, R11–R16; scope may expand with findings. Functional gaps include households/proxy authority, sensitive-data separation, clinical rules and content governance, media and fully disconnected registration, privacy controls and scale architecture. Live AI/programme/EHR/ABDM/messaging access and independent validation are also required. See [REMAINING-RELEASES.md](REMAINING-RELEASES.md), [REQUIREMENTS-TRACEABILITY.md](REQUIREMENTS-TRACEABILITY.md) and [CORE-CONTINUITY.md](CORE-CONTINUITY.md).
