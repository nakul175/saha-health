# Functional specification

R11 implements a bounded synthetic subset of the product. This specification gives developers the current journey and its guards. The complete original 148 functional expansions, twelve journeys and screen contracts remain in the [target specification](../reference/01_Functional-Specification_v1.0.md), with all 176 source requirements tracked separately.

| Journey | Current path | Guard or remaining work |
| --- | --- | --- |
| Join a care organisation | Site access, sign-in, account code, owner invitation, membership/team selection | Site sharing and app membership are separate; no external invitation delivery |
| Register and confirm identity | People → scoped matching → existing or explicit provisional/distinct record → clinician review | Hidden records cannot affect matching; provisional identity blocks consequential actions; no automatic merge |
| Capture a visit | Select assigned person, start visit, save shared facts and programme evidence, review, positive patient check, confirm | Unsaved and saved states differ; current versions required; confirmed facts are immutable |
| Continue programme work | Programme episode, pinned pack and conditional answers; named follow-up owner/date; explicit closure | Packs are illustrative; full approved clinical semantics and cross-programme reuse remain incomplete |
| Use documentary assistance | Prepare bounded task, approve disclosure, execute, inspect quotations/uncertainty, select fields to apply | Draft remains unconfirmed; omitted fields stay omitted; old or unauthorized context blocks apply |
| Review clinical content | Clinical governance draft/version → evaluation where required → independent review → owner activation | Model/source/service dependencies, dates and current membership rechecked; live professional acceptance absent |
| Submit to a programme | Review mapped payload and recipients, approve exact plan, queue, explicit send, inspect separate receipts | No global success tick; uncertain destination requires lookup; live partner acceptance absent |
| Exchange EHR history | Explicit external patient link and scoped permission, staged document retrieval/review or approved publish | Imported history is external evidence, not silently copied current measurement; ABHA/HIP/HIU absent |
| Work in the field | Prepare signed visit grant online, encrypted notebook capture, reconnect, explicit sync and conflict handling | Separate browser notebook; ordinary form memory is not durable offline storage; device acceptance open |
| Coordinate care | Referral draft with owner/date and evidence-backed transitions; Care handover moves open responsibilities | Worker-entered sent/received/completed evidence does not prove a facility was contacted |
| Plan outreach | Human-selected scoped plan, contact preferences, independent reminder approval and simulation | No real message sent; household/proxy authority and live opt-out recovery remain future work |
| Rehearse a pilot | Configure synthetic scope, training, measurements, four distinct reviewers and stage decisions | In-app evidence records do not establish actual training, real-world study approval or pilot acceptance |

## Interaction rules

Keep the active patient and visit visible. Save shared facts before changing programme context. Patient and visit version changes invalidate bound approvals. Users resolve conflicts deliberately; never overwrite another worker's facts through last-write-wins. Unknown or missing data remains unknown, and an unable-to-assess AI result is not a negative clinical finding.

A demographic correction keeps the original revision and reason. A confirmed-visit amendment creates a linked draft; wrong-person marking quarantines further use while retaining evidence. Neither action recalls already delivered external data. Those copies require destination-specific reconciliation.

The server authorizes every action independently of the interface. Supervisors oversee scoped care work without writing clinical facts; administrators have no patient-record scope; an owner flag grants organisational management without universal clinical access.

See [User guide](USER-GUIDE.md), [screen coverage](UI-COVERAGE.md), [continuity](../../CORE-CONTINUITY.md) and [implementation boundary](../IMPLEMENTATION.md). The original prototype demonstrates target interactions and cannot be used as proof that a current screen or permission exists.
