# SAHA-104 local coding completion — 20 October 2026

This record covers **SAHA-104 / APL-127, Safe communication preferences**, mapped to **BR-CARE-06**. It is local engineering evidence from synthetic data. It is not formal acceptance, clinical or domain approval, CI, merge, deployment, a live messaging integration, or proof that a real recipient was contacted.

## Frozen contract

- Contract: `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-127.md`
- Contract SHA-256: `b6fce2ab98d92c9a723e7056be0a56a615c6bd44551883213c4d94ced008a544`
- Base commit: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`
- Requirement: `BR-CARE-06`, including contact method, language, time, disclosure, explicit shared-phone ownership, preferences per person/purpose/channel, and refusal of revealing automated notification when private contact is requested.

## Identified gap and implementation

The existing software stored one global preference per person. It blocked private/shared automation and used fixed neutral templates, but it could not keep independent preferences for different purposes and channels. Updating that global record also cancelled unrelated pending reminders.

The local implementation now:

- stores current preference records by person, purpose and channel, while reading legacy single records as the default `care-follow-up` purpose;
- supports `care-follow-up`, `appointment-reminder` and `programme-support` as configurable non-clinical contact-purpose labels;
- records explicit `none` or `neutral-only` disclosure and keeps a bounded ordered preference history with before/after values;
- binds each reminder draft to its exact contact purpose and rechecks that purpose, channel, permission, ownership, disclosure, language and local hours at review and synthetic execution;
- refuses automated notification for private contact, unknown phone ownership, missing permission, missing purpose/channel preference or `none` disclosure;
- permits a shared phone only when the person has explicitly allowed the fixed neutral template for that exact purpose/channel; the fixed copy contains no name, condition, programme, result or care instruction;
- cancels unsent work only for the preference purpose that changed; other purpose records and messages remain intact;
- enforces current assignment, person version and `care-coordination` access-purpose authority before recording preferences; the existing patient compare-and-set persistence refuses assignment or record changes that race the commit;
- keeps imported contacts permission-free and compatible with the purpose/channel model; no external send or provider was added.

## Local verification

The exact logs and manifest are under `tests/evidence/saha104-local-coding-completion/`.

| Check | Result |
| --- | --- |
| Safe communication preference contract | 27 passed, 0 failed |
| Existing outreach contract (current-module inventory adapter) | 55 passed, 0 failed |
| Existing consent withdrawal contract (current-module inventory adapter) | 25 passed, 0 failed |
| Existing contact import contract | 18 passed, 0 failed |
| TypeScript | passed |
| Production build | passed |
| Test catalogue classification | passed; all test files classified |
| Requirement traceability regeneration and check | passed; 176 source requirements retained, 0 formally accepted |
| Generated documentation inventory | passed after regenerating the current command and test catalogues |
| Immutable baseline/evidence integrity checker | expected feature-branch failure retained: changed application sources and historic manifests still pin the base source |
| External provider calls / real contacts | 0 / 0 |

The focused contract covers schema migration defaults, preservation of a legacy contact record while adding a second purpose, two simultaneous purposes, exact-purpose message selection, private shared-phone refusal, explicitly permitted shared neutral copy, invalid disclosure combinations, purpose-isolated cancellation, preserved history, stale person version, lost assignment, and withdrawn access-purpose authority. The two existing contracts were run through a temporary inventory adapter because their older standalone transpile lists do not include a newer dependency already on the base commit; their assertions were unchanged. These are engineering tests, not executions of formal catalogue cases `TC-BR-CARE-06-A/B`.

The immutable baseline checker is intentionally not made green inside this isolated story: it correctly reports that application files differ from the current-main baseline and that historical evidence manifests still pin their original source. Updating those custody records belongs to qualified integration review; the exact failure output is retained as `documentation-baseline.log` rather than bypassed.

## Gates still open

- independent source review and required product/domain/clinical review;
- configured CI on the eventual exact source commit and branch-protection checks;
- formal `TC-BR-CARE-06-A/B` execution and representative worker/device acceptance;
- reviewed Hindi communication copy and any additional approved languages;
- an approved live channel/provider, its notice and permission process, delivery/opt-out evidence and operational ownership;
- merge and exact observed staging/production deployment.

Until those gates pass, the truthful status is **local coding complete for the frozen SAHA-104 application-code scope**, with formal acceptance, merge and observed deployment pending.
