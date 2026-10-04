# Development slice 14d — notice versions and permission expiry (R90)

4 October 2026 (IST). Requirement slice R90, "Notice versions and full consent expiry semantics" (BR-SEC-02). Built on a branch from `main` 2adfbde1, in parallel with slices 14a–14c, and offered as a draft pull request; not merged. Synthetic data only; formal acceptance unchanged.

## What was missing

Before this slice a person's permissions for optional AI assistance, external record sharing and automated contact were switches with a version counter and, since slice 6o, a consent history. Nobody was shown a notice that Saha recorded, no decision said which notice it was given under, and no permission ever ended on its own: once switched on it allowed its use until someone switched it off. The only expiry in the product was on mock ABDM consent artefacts and on EHR exchange permissions.

## What changed

- **Notice registry, owner-managed, never edited.** An organisation owner publishes the notice for AI assistance or for external record sharing (`publishConsentNotice`, `lib/saha/consent-notices.ts`). Each publication is the next version for that permission:
  - its text in English, Hindi or both (40–1,200 characters each);
  - the time it takes effect: now, or up to 90 days ahead, never before the previous version;
  - what changed, and who reviewed the text, with a reference;
  - whether the change is material.

  A stale or skipped version number is refused (409). Earlier versions are never changed or removed. The registry is a list in the organisation's operations document (`operations.consentNotices`, at most 20 versions), so no migration was needed and it is in the data exit with that document. Only an active owner may publish, checked again when a command is replayed (`authorizeConsent`). Each publication is audited (`publishConsentNotice`).
- **Each permission records its notice and its end.** A permission given with the Permissions switch (`setConsent`) must name the notice version in force for that permission and the language it was shown in, whenever the organisation has published one. A missing, older or unknown version is refused (409), so a newer notice is never skipped. A language the notice has no text in is refused (422). Without any published notice the permission is recorded with "no notice". The server sets the end date from the permission's period: AI assistance 365 days, external sharing 180 days, automated contact 365 days (`CONSENT_PERIOD_DAYS`, `lib/saha/core.ts`). The client cannot set it. All of this is written on the consent event (`notice`, `expiresAt`) and as its own audit event (`consentTerms`), next to the existing `setConsent` event: "given under notice version 2 (Hindi), in force since …; expires …".
- **Renewal.** Giving a permission again while the last decision for it was a grant renews it. The event records which grant it renews and whether that one had expired or needed renewal (`renews`); the audit text says so. Automated contact is renewed by saving the contact preferences with permission once it has lapsed. Saving other contact changes while the permission is in force does not extend it.
- **Standing decided when the permission is used, with no timer.** `consentStanding` in `lib/saha/core.ts` returns not given, in force, expired, or needs renewal. It is computed from the patient record and the registry at the moment of each check:
  - a permission stops allowing its use when its end has passed;
  - it also stops when a *material* version newer than the one it was given under has taken effect. It is not carried forward, and the person must be shown the new notice and agree again;
  - a version that is not material leaves earlier permissions in force;
  - a permission recorded before this slice has no recorded notice or end. It stays in force until it is withdrawn, or until a material notice takes effect for its permission.

  The history bound (100 events) now always keeps the latest decision of each permission, because that decision sets its standing.
- **Where it is enforced.** Every server check that used the switch alone now uses the standing. A lapsed permission is refused with a message that says it expired, or which notice change needs renewal:
  - AI assistance: `runAI`, the record assistant (`prepareAgent`, execution and applying results, through `agent.eligible`), the shadow runner, and the anaemia and frontline demonstration services;
  - external sharing: preparing a programme plan for an HTTP destination, queuing it, sending a queued delivery (`mis.deliveryCurrent`), granting an EHR permission and every EHR exchange under one (`ehr.ehrAccess`);
  - automated contact: preparing, reviewing and simulating a reminder.

  A withdrawal is always recorded, lapsed or not, and needs no notice.
- **On screen.**
  - The Permissions dialog shows, for each permission, whether it is in force and until when, and the notice version and language it was given under, or that it expired or needs renewal. Turning a permission on, or **Renew permission** (shown when lapsed or within 30 days of its end), first shows the notice in force in the chosen language. The worker confirms "I showed or read this notice to the person … and they agreed" before **Record permission**.
  - The patient screen shows an amber notice for any lapsed permission.
  - Consent history shows the notice and end recorded on each grant.
  - The record assistant explains why it is unavailable.
  - Organisation shows the registry: each version with its state (in force, scheduled, superseded), whether it is material, its languages, reviewer, publisher and text. Owners also get the form to publish the next version.
  - The new text is English only, marked as such on Hindi screens.

No migration, HTTP route or certified patient command was added. `publishConsentNotice` is an organisation-wide command, and `setConsent` and `setContactPreferences` stay patient-scoped. Their new check reads the registry from the operations document, which every load includes. Publishing moves the organisation revision, so a permission recorded concurrently on an older read is refused and retried.

## Tests

- `tests/consent-notices-contract.mjs` (unit, 26 checks, each with several assertions):
  - publishing: owner only, including a suspended owner and the replay check; schema refusals (purpose, empty, short, long or control-character text, short summary, missing reviewer, extra field, bad date); a past or more-than-90-days start; the clock allowance; next version only; a scheduled version that leaves version 1 unchanged and cannot start earlier; the 20-version bound;
  - giving: a missing, unknown, malformed or language-less notice choice; a stale record, a supervisor and an out-of-team clinician; the recorded notice, language and server-set end with its audit text (a client-supplied end is ignored); sharing with no notice and its 180-day period; a choice when no notice is in force; contact has no notice;
  - standing: not given; recorded before this slice, including a slice 6o grant with no end; exact expiry boundary; a material version from the moment it takes effect, also for older permissions; a non-material version; renewal under the material version and after expiry, each with its audit text; withdrawal of an expired permission; the history bound keeping each permission's latest decision;
  - enforcement: `runAI` (with and without the registry), `agent.eligible` expired and awaiting renewal, `mis.deliveryCurrent` with an expired sharing permission, and contact expiry, renewal and edits that do not extend it.

  The suite was checked to fail with the expiry test disabled and with the stale-notice check disabled.
- `tests/consent-notices-smoke.mjs` (HTTP/D1, imported by `tests/api-smoke.mjs`):
  - in the shared organisation, publishing is refused for an ASHA, a supervisor, an administrator, a non-owner clinician and a stranger, and for an empty text and the contact purpose; nothing is published there;
  - in its own organisation:
    - a permission given before any notice, with its audit order;
    - version 1 published, its replay, and stale, skipped and past versions refused;
    - the record assistant still accepting the earlier permission;
    - giving refused without the notice, with an unknown notice, an unknown language or no language, then accepted in Hindi;
    - a material version 2 stopping the assistant until renewal, the stale and missing-language choices refused, and renewal;
    - an expiry moved into the past in the database stopping the assistant until renewal, with the renewal's audit text;
    - sharing with its 180-day period, and an expired sharing permission stopping a new EHR permission until renewal;
    - permission and publishing refused for people outside the organisation;
    - an expired AI permission withdrawn;
  - in the shared organisation, an expired contact permission stopping a reminder until the preferences are saved again.

  Expiry is reached in the HTTP suite by moving one recorded end into the past in the local database; every decision after that is the Worker's own.
- Results are in `VALIDATION.md` and `tests/evidence/slice-14d/`.

## Merging with slice 14b

Slice 14b (draft pull request #153, representatives deciding consent) changes the same consent records. This slice was written against `main` so that the two merge mechanically:
- its fields on the consent event are additive;
- its code in `applyConsent` is one inserted line after the permission switch branch;
- its audit is a separate event, so it does not touch the lines 14b rewrote.

Expect textual conflicts where both add to the same line, resolved by keeping both additions:
- the `ConsentEvent` type in `lib/saha/consent.ts` and the `setConsent` schema line in `lib/saha/core.ts`, where each slice adds optional fields;
- the BR-SEC-02 rows in `requirements/assessment.tsv` and `requirements/evidence-map.json`;
- the shared documentation and generated files.

After the merge, 14b's "Record a permission given by a representative" form must also show the notice in force and name it in its `setConsent`. Until then, once an organisation has published a notice, the server refuses that form's grant with the "show the person the current notice" message, which fails safe.

## Limits

- Notices exist only for AI assistance and external sharing. Automated contact has an end date but no notice registry, because its permission is given in the contact preferences form, which this slice does not change.
- Saha holds no reviewed notice content. The text is whatever an owner publishes, and the reviewer field is the owner's statement. Nothing checks that the Hindi and English texts say the same thing, and the new screen text is English only.
- The periods (365, 180 and 365 days) are fixed in code. No privacy officer has approved them, and owners cannot change them.
- A permission recorded before this slice has no end. Only a material notice for its permission asks for its renewal.
- Nothing is written when a permission lapses: there is no timer, and the scheduled job is not used. The end is recorded when the permission is given, the history and screens derive "expired" from it, and the renewal records the lapse. A request refused because of a lapse is not audited, as with every other refusal.
- An owner sees no count of the people a material version will affect before publishing it. A scheduled version cannot be withdrawn; a later version replaces it, and it may not start earlier. The registry holds at most 20 versions.
- Representatives (slice 14b) are not wired to notices on this branch; see above.
- ABDM consent artefacts keep their own expiry. Linking ABDM care contexts is still not tied to the sharing permission. An EHR permission can outlive the sharing permission, but it cannot be used once that has lapsed.
- The anaemia and frontline demonstration panels still enable their buttons from the switch alone; the server refuses a lapsed permission. Screens use the device clock; the server decides.
- Built by one agent; no independent review.
