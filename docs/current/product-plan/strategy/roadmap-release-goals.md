# SAHA — Roadmap and release goals

[Current plan and coding start](https://linear.app/aplyd-sandbox/document/saha-current-product-plan-and-coding-start-8ae95cae358c) · [Vision/strategy](https://linear.app/aplyd-sandbox/document/saha-product-vision-and-strategy-dbc1026736ea) · [Roadmap/releases](https://linear.app/aplyd-sandbox/document/saha-roadmap-and-release-goals-b710e5c7276c) · [Shared Ready/Done](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7) · [AI/discovery/learning](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e)

Working baseline v2 · 10 October 2026 · Framework v4.2 planning application. Replaces the working narrative of Linear document `5f178e44-9cd4-4eab-9afc-1fdd32f0818d`. Original BRD release assignments, priorities, acceptance text and historical evidence remain protected; this document clarifies sequencing and gates.

## 1. At a glance

**Next executable package:** fresh bounded D01 baseline decision, then qualify the **existing D03** review/save candidate. D02's isolated assigned-Today/read-only task has historical 10/10 delivery evidence. D04 waits for D03's full delivery gate. Documentation improvement is authorised now; tomorrow's implementation start must still satisfy current-code readiness, native review/check requirements and applicable live synthetic authority.

| Planning level | Actual inventory | Meaning |
| --- | --- | --- |
| Source requirements | 176 BRD requirements | 167 R1 and nine R2; original text/priorities/releases retained |
| Functional product stories | 140 | R1 127; R2 eight; CWO five |
| Supporting product items | 20 | R1 14; R2 one; CWO five; NFRs, guardrails, enablers and spikes |
| Canonical product items | 160 | 150 BRD owners plus 10 existing CWO-only items |
| Epics | 11 | Source WP01–WP11; can span releases |
| Native tasks | 200 | 192 engineering/qualification plus eight D01–D08 implementation/qualification tasks |
| Formal source cases | 364 distinct | 352 requirement-specific and 12 shared journeys; shared cases count once |
| Additional published CWO clauses | 95 | Preserved positive/refusal/error/authorization source criteria |

D01–D08 are included in the 200 tasks and excluded from the 140 story count. Completing D02 does not fully accept its wider owning product items. The inspected checkpoint is **0/160 canonical items accepted; 0/364 formal cases accepted; tasks 1 Done, 1 held In Progress, 198 Backlog**. These are source checkpoint counts, not fresh CI or automatically current live results.

Primary navigation: [Product stories](https://linear.app/aplyd-sandbox/project/saha-community-worker-os-23d61552362d/view/product-stories-5c5e0d28c3fe) · [Supporting work](https://linear.app/aplyd-sandbox/project/saha-community-worker-os-23d61552362d/view/supporting-work-e6f9885668b0) · [Tasks](https://linear.app/aplyd-sandbox/project/saha-community-worker-os-23d61552362d/view/tasks-fd49b187c465). The [scope mapping](https://linear.app/aplyd-sandbox/document/saha-full-scope-and-requirement-mapping-99faedfc92c7) and [unified task register](https://linear.app/aplyd-sandbox/document/saha-unified-task-register-ab4f929db6d4) retain exact source IDs, parents, release allocation and test references.

## 2. Distinguish product releases and implementation phases

The three existing product groupings remain **R1 authorised multi-programme pilot**, **R2 controlled expansion** and **CWO decision-gated extensions**. The four first-queue milestones are implementation organisation within that scope: Now routine mobile visit, Next offline/reconnect, Later assistance/field qualification, and Release evidence/recovery. They are not four additional product releases. Historical R11–R16 implementation rounds are engineering checkpoints; they do not rename BRD R1/R2.

| Existing milestone | Stable native ID | Scope / dependency |
| --- | --- | --- |
| Now — routine mobile visit | `aef0015c-566e-4b15-9020-c27e7072f79b` | D01–D03; baseline, assigned work, bounded review/save |
| Next — offline and reconnect | `d01a1192-6e89-4a5b-a33e-7afc415aa3bf` | D04–D05 after qualified manual save |
| Later — assistance and field qualification | `2184fa6a-d3f1-461c-9d85-a1413b3ed98d` | D06 and D08, each with its own authority/evidence boundary |
| Release evidence and recovery | `14e22fa7-2282-440e-80e4-722ee71bca54` | D07 supports each release; exact identity and recovery are separate checks |
| Product R1 — authorised multi-programme pilot | `c1b16578-cd76-4598-837b-af20bc793744` | Original 167 requirement scope and applicable G0–G6 |
| Product R2 — controlled expansion | `82061bb2-42ab-4ce5-9aa1-2dbbda534d81` | Original nine requirement scope, prerequisites and G7 |
| Community Worker extensions — decision-gated | `7939ee4f-07ef-4a2c-b1ae-f43fc5239272` | Existing SAHA-151–160; original published source/DEC boundaries |

No milestone date or whole-product capacity estimate is invented. This is an evidence-gated horizon plan. A release date is forecast only after ready scoped work, actual resources and external lead times are understood.

## 3. Now, next and later execution sequence

| Order / horizon | Intended output and owning record | Why before the alternative | Required predecessor / exit evidence | Confidence and timing |
| --- | --- | --- | --- | --- |
| 1 · Now | [D01 / #174 / APL-5](https://linear.app/aplyd-sandbox/issue/APL-5/d01-reproduce-the-current-application-baseline): fresh bounded baseline-readiness decision for D03 | Current-source defects can invalidate candidate tests; advancing immediately from old receipts would obscure the baseline | Fresh main/candidate inspection, exact affected failure evidence for #185/#186, retained failed checks, documented regression impact and explicit dependency decision. Full D01 stays open if broader scope remains | Required next prerequisite; no claim that documentation closes it |
| 2 · Now | [D03 / #176 / APL-7](https://linear.app/aplyd-sandbox/issue/APL-7/d03-review-and-save-a-bounded-routine-visit): existing manual review/save candidate | Completes the core permitted person→routine review/save chain before extending offline or assistance | Existing frozen revision 1; source/docs integrity; current API/UI and integrated tests; exact published SHA; native required CI/review/approval; qualified isolated merge; separately observed hosted identity and authorised synthetic smoke | Local author evidence exists; final qualification and release evidence absent at snapshot; estimate remaining work after inspection |
| 3 · Next | [D04 / #177 / APL-8](https://linear.app/aplyd-sandbox/issue/APL-8/d04-retain-routine-work-through-offline-interruption): prepared-work retention | Establishes what survives interruption before testing external replay or conversational preparation | D03 full declared gate; current persistence contract; synthetic restart/storage/fault evidence; no implied production lease or device acceptance | Mechanics can be developed within synthetic scope; DEC-03 blocks production authority/key-recovery claims |
| 4 · Next | [D05 / #178 / APL-9](https://linear.app/aplyd-sandbox/issue/APL-9/d05-reconnect-without-duplication-or-false-completion): safe reconnect/reconciliation | Protects against duplicate effects and false completion after acknowledged/uncertain writes | Qualified retention path; current operation/version/receipt contracts; acknowledgement-drop, replay, conflict and changed-authority cases | Current-code inspection and frozen scenario contract still required |
| Supporting each release | [D07 / #180 / APL-11](https://linear.app/aplyd-sandbox/issue/APL-11/d07-identify-and-recover-the-synthetic-digitalocean-release): exact release identity and authorised recovery | Release claims need an observed running identity; recovery needs different authority and evidence | Exact tested/published/merged/observed identities; existing authorised topology, target and recovery plan; actual permitted recovery evidence before recovery pass | D02 identity witness historical; broad D07 recovery remains open |
| Later on stable manual path | [D06 / #179 / APL-10](https://linear.app/aplyd-sandbox/issue/APL-10/d06-open-or-prepare-bounded-tasks-conversationally): bounded assistance | Meaningful only over allowed working actions with a manual fallback | Qualified manual actions; applicable capability assurance record; exact typed intent/authority/refusal/fallback tests; model/provider use only when separately authorised | No new provider, clinical advice or patient-data transfer implied |
| Later / claim-specific | [D08 / #181 / APL-12](https://linear.app/aplyd-sandbox/issue/APL-12/d08-qualify-compact-phone-usability-and-persistence): actual device/frontline qualification | Checks the environment underlying usability and persistence claims | Declared actual handset/browser/language and permission/access; current builds; physical keyboard/restart/memory/battery evidence; authorised formative observation | Viewport testing may proceed earlier; physical-phone/frontline gate remains evidence-dependent |

[D02 / #175 / APL-6](https://linear.app/aplyd-sandbox/issue/APL-6/d02-open-assigned-work-from-mobile-today) is the historical completed task: frozen 10/10, PR #189, merged/observed hosted `7668a03d97c1ae62174f09e65ccd5a5717120be6`. Preserve its regression checks in affected work. D02 is not reimplemented, bulk-merged from PR #184 or counted again as a new story.

The unresolved D01→D03 native dependency is real. Record any legitimate bounded prerequisite decision with evidence and impact; do not delete the link or declare D01 Done to make D03 look Ready. Complete one declared gate before advancing to its successor. Discovery/source reconciliation can proceed independently without competing code dispatch.

## 4. Whole-product epic roadmap

Preserve the source design dependency sequence. It describes target outcomes, not already delivered increments, and does not require activating all upstream optional providers before a bounded synthetic slice can reuse proven components.

| Epic | Preserved outcome | Design predecessors | Discovery / acceptance focus |
| --- | --- | --- | --- |
| [WP01 · APL-13](https://linear.app/aplyd-sandbox/issue/APL-13/epic-wp01-identity-and-assignments) | Verified workforce login, role context, caseload and identity correction | None | Correct assigned-person selection, authority changes and identity ambiguity; discovery hypothesis H-WP01 |
| [WP02 · APL-14](https://linear.app/aplyd-sandbox/issue/APL-14/epic-wp02-policy-audit-and-invariants) | Purpose-bound policy, audit atomicity, approval binding and environment isolation | WP01 | No mutation without required authority/audit; H-WP02 |
| [WP03 · APL-15](https://linear.app/aplyd-sandbox/issue/APL-15/epic-wp03-encounter-and-shared-data) | Existing person/encounter model, draft capture, typed observations and revisions | WP01, WP02 | Truthful review/save/confirmation and repeated-entry baseline; H-WP03 |
| [WP04 · APL-16](https://linear.app/aplyd-sandbox/issue/APL-16/epic-wp04-programme-configuration) | Versioned questions, schedules, approved clinical rule interface and mappings | WP03 | Approved pack semantics, reuse eligibility and change isolation; H-WP04 |
| [WP05 · APL-17](https://linear.app/aplyd-sandbox/issue/APL-17/epic-wp05-agent-and-ai-broker) | Typed bounded plans, model manifests, request lifecycle and budget accounting | WP02, WP03, WP04 | Per-capability AI accuracy/safety/fallback/authority proof, no generic benchmark substitution; H-WP05 |
| [WP06 · APL-18](https://linear.app/aplyd-sandbox/issue/APL-18/epic-wp06-clinical-oversight) | Review, escalation, composition controls and safety case handling | WP02, WP04 | Real clinical accountability and safe unavailable-reviewer behavior; H-WP06 |
| [WP07 · APL-19](https://linear.app/aplyd-sandbox/issue/APL-19/epic-wp07-external-exchange) | MIS/EHR adapters, ABDM role paths, receipts and reconciliation | WP02, WP03, WP04 | Owner-approved destination contract and independent receipt; H-WP07 |
| [WP08 · APL-20](https://linear.app/aplyd-sandbox/issue/APL-20/epic-wp08-offline-client-and-sync) | Encrypted storage, signed lease, durable queue and ordered sync recovery | WP01, WP02, WP03 | Acknowledged-work retention, replay/conflict, actual device and policy boundary; H-WP08 |
| [WP09 · APL-21](https://linear.app/aplyd-sandbox/issue/APL-21/epic-wp09-care-coordination) | Referrals, directory, tasks, assignment and evidence-backed outcomes | WP03, WP04, WP06, WP07 | Existing responsibilities, transfer acknowledgement and outcome evidence; H-WP09 |
| [WP10 · APL-22](https://linear.app/aplyd-sandbox/issue/APL-22/epic-wp10-operational-measures) | Versioned reporting definitions, projections, privacy controls and exports | WP03, WP07, WP09 | Measures reconcile with underlying permitted evidence and denominators; H-WP10 |
| [WP11 · APL-23](https://linear.app/aplyd-sandbox/issue/APL-23/epic-wp11-release-and-support) | Release configuration, training, monitoring, backup, incident and exit processes | WP02, WP05, WP07, WP08, WP09, WP10 | Exact candidate-to-operation identity, tested response/recovery and measured learning; H-WP11 |

Whole-product horizons remain: **(1) identity and safe records WP01–03; (2) programme reuse WP04; (3) bounded AI/clinical oversight WP05–06; (4) exchange WP07; (5) continuity/coordination WP08–09; (6) operations/pilot WP10–11**. Each implementation freeze identifies the actual current-code prerequisites needed for its scope. A demonstration does not close the full epic or a broader release gate.

The linked AI assurance/discovery/learning contract defines H-WP01–H-WP11, disconfirmation evidence and scope-safe experiment defaults. Priority rationale follows PM-PRIORITY-01; sizing follows PM-SIZE-01. Recommended low-confidence triage/engineering ranges in backlog descriptions remain planning assumptions, distinct from inspected estimates; they do not set actual estimate fields, capacity, assignees or dates. The roadmap is refreshed after actual discovery, delivery failures and release-learning decisions; original source requirements remain unchanged unless a legitimate versioned decision changes them.

## 5. Product release goal R1 — authorised multi-programme pilot

**Identity:** Original BRD v1.1 R1, 167 requirements; 141 canonical product items (127 functional, 14 supporting). **Intended usable outcome:** approved maternal/TB/hypertension routine workflows with reusable capture, scoped identity, governed clinical/AI capabilities, independent programme receipts, selected owner-authorised EHR/ABDM route, offline/security and support controls. The original target includes two approved AI providers and two owner-authorised programme destinations. Proposed district, cohort and languages remain open source decisions, not accepted pilot facts.

**Alignment:** Implements the vision's routine-work value across programmes while preserving authorised responsibilities and truthful records. A manual synthetic demonstration contributes evidence to narrow behaviours; it is not the R1 pilot.

| Release contract | Required detail and current state |
| --- | --- |
| Included scope | Exact R1 owners/requirements and original criteria in the source mapping; shared epics keep each item's source release label. No compression into D01–D08. |
| Measures and targets | Original BRD proposed targets and D15 status retained; define denominator/baseline/window using SAHA-MEASUREMENT-01. Obtain accountable target/baseline decisions before benefit acceptance. No measured pilot results currently supplied. |
| Applicable NFRs | Original security, isolation, audit, offline, performance, recovery, accessibility and operating requirements stay in their owning source records. Preserve applicable local-save p95 ≤500 ms; no acceptance waiver inferred from smaller story tests. |
| Entry | Actual named buyer/site/programme/clinical/system/privacy/security/operations roles and relevant G0–G4 evidence; permitted forms/data flows/providers/destinations; accepted measurement/evaluation contracts; actual devices and viable support. Missing required institutional decisions block pilot activation, not bounded synthetic preparation. |
| Exit to pilot readiness | Original mandatory R1 requirement/adverse-case selection on exact candidate; current required AI/security/integration/offline/operations tests; applicable signed G0–G5 gates; actual release authority. No imported item or unit test alone closes formal acceptance. |
| Pilot exit | Separate G6 review of original outcomes, failures/exclusions, cost and safety with actual sponsor/buyer/clinical authority; learning actions traced back to roadmap. |
| Exclusions / deferrals | Source R2 and decision-gated CWO inclusion remain separate. No live provider, destination, recipient or patient activation from planning; no claim that optional future scope was removed. |
| Rollout / recovery | Require approved population/exposure and actual topology; exact qualified release identity; tested authorised fallback/rollback and records/queue preservation with applicable RPO/RTO decision. Current synthetic DigitalOcean identity witness is not production-runtime or broad recovery qualification. |
| Artifact / operating evidence | Exact final tests and separate review, published candidate, merged identity if applicable, actual observed operating identity and scoped live smoke, each separately recorded. No new R1 accepted candidate or available operating release is supplied by this document. |
| Learning | First permitted pilot observation window fixed before rollout; compare baseline/target/observed denominator and costly failures; actual owners choose continue/improve/narrow/rollback/retire. Inconclusive data cannot close G6. |

Accountable source roles remain those in the decision register; unnamed external owners are not assigned to the agent. R1 currently remains a target goal with open institutional and formal acceptance gates.

## 6. Product release goal R2 — controlled expansion

**Identity:** Original BRD v1.1 R2, nine requirements; nine canonical items (eight functional, one supporting). **Usable outcome:** organisational federation, controlled migration, additional programme packs, programme manager analysis, provider self-service in a controlled environment, external messaging/scheduling, population prioritisation, repeatable deployment packaging and scale readiness.

Keep the original individual requirement/adverse criteria and NFRs. Entry requires the relevant R1/pilot learning evidence, explicit target population/jurisdiction, approved scope and current system/clinical/privacy dependencies; broad “R1 done” is not enough if the expansion changes risk. Exit requires current tests for each retained R2 criterion, exact candidate/release evidence, applicable G7 expansion approval and actual operating/support/recovery readiness. R1 outcomes, expansion targets and actual capacity remain evidence questions; do not invent expansion dates or promise automatic patient messaging.

Roll out only within the actual approved expansion decision, retain safe fallbacks and migration/reconciliation proof, and compare outcomes/incident burden/cost to the permitted baseline. The first complete declared expansion learning window produces a decision linked to strategy and roadmap. This planning document records no accepted R2 candidate, deployed release or measured expansion result.

## 7. CWO extensions — decision-gated source scope

**Identity:** Existing SAHA-151–160, ten items (five functional, five supporting). The scope retains baseline/release/device qualification, optional paid assignment, contextual Academy/help, production-runtime spike, purpose-limited geotags, worker-controlled routes and the schedule-rule candidate. The published CWO acceptance/refusal clauses and DEC-01–08 remain authoritative where mapped.

**Material source gap:** SAHA-153–160 have mapped outcome/reference IDs but no original acceptance narrative or assigned published CWO clauses in the inspected pinned baseline. Their proposed positive/refusal/error/authorization refinements remain proposals. A versioned source-reconciliation/product decision and applicable institutional/runtime/device inputs are needed before their execution freeze; Backlog cannot become Ready merely because draft criteria exist. User permission to make reasonable planning assumptions does not manufacture original source acceptance, paid-service permission or privacy policy.

Entry is item-specific source/criterion readiness and current-code/authority inspection. Exit is that exact item's approved contract and adverse cases with actual artifact/operating evidence, separate approvals and learning handoff. Release inclusion is a product decision, not an automatic new “CWO release.” Scope requiring payments, geolocation, real external recipients or new runtime authority remains held until its actual approvals. No accepted operating release or new CWO delivery is claimed here.

## 8. Gate matrix and blocker-to-action map

| Source gate | Actual authority required | Resume condition / evidence |
| --- | --- | --- |
| G0 business baseline | Sponsor / product owner | Actual accepted scope and proposed-measure review |
| G1 workflow readiness | Programme / clinical owners | Approved forms, role scope, languages and escalation; actual observed context |
| G2 integration readiness | System owners / integration lead | Owner-authorised destinations and selected EHR/ABDM role/module, receipts and reconciliation proof |
| G3 AI readiness | AI governance / clinical lead | Each live capability's versioned evidence/authority/data-use contract and accepted results; original two-provider scope retained |
| G4 production controls | Security / operations | Current isolation, audit, offline, backup/restore and incident evidence with independent assessment |
| G5 pilot readiness | Deployment owner | Devices, training, support, baseline and patient-facing material within real permissions |
| G6 pilot exit | Sponsor / buyer / clinical owner | Original outcomes with failures/exclusions/cost/safety and actual decision |
| G7 expansion approval | Buyer / jurisdiction owners | New population, scale/jurisdiction and deployment-specific accepted evidence |

Current critical execution blocker: D01 bounded current-baseline decision and D03 final qualification. Production offline blocker: DEC-03 plus actual device/privacy/recovery policy. Full R1 blockers: source D01–D21/G0–G5 institutional, provider, clinical, destination, privacy and operations evidence. CWO future blockers: eight approved-source gaps. Record each blocker's affected scope, exact missing evidence, source role and next independent preparation step; do not ask the sponsor to answer operational facts that only current code or actual evidence can establish.

Recommended working defaults for unknown planning choices are retained in a separate assumption register with rationale, downside and review trigger. Where the question is an authority, legal basis, clinical rule, participant or measured result, mark it unresolved and keep the affected gate closed. Continue authorised synthetic preparation that does not depend on it.

## 9. Delivery, learning and change control

Every isolated story records frozen scope/criteria, current-code prerequisites, exact candidate and test selection, all failures, final required checks, separate diff/evidence review and actual required approval. Merge identity, available operating identity and authorised live smoke are distinct. If main-following staging is documented, observe it rather than infer deployment from the merge. Stop at the precise blocker and retain the permitted next action. Do not lower required test minima, waive observed failures, create local reviewer authority, or claim formal UAT from related unit tests.

After each bounded release perform an engineering retrospective on identity, regressions, incidents and recovery. After the declared permitted outcome window perform the product-learning review: baseline and target versus observed numerator/denominator, relevant slices, exclusions/confounders, costly errors, support effort and unexpected outcomes. The actual product or institutional owner makes a versioned decision and links resulting actions to strategy, roadmap, release goal and owning product/task IDs. Go-live and measured user improvement remain separate. No new background automation is created by this review policy.

Framework working order remains **check → summary → next → fix → check again**. **Do not weaken criteria to obtain a pass.** Preserve source/frozen criteria; any real product-scope change requires explicit versioned rationale, impact analysis and actual authority. Changed source/artifact/checklist/assurance pins invalidate affected old evidence and reviews. Use one team Ready definition and one Done definition by reference; outcome criteria remain on each owning story.

The proposed shared engineering versions are `SAHA-READY-1.0` and `SAHA-DONE-1.0`. Link the applicable version and actual evidence from each selected story/task. A checklist reference does not certify the entire backlog Ready or turn a planning recommendation into an approval.

## 10. Current source checkpoint and maintenance

D02 PR #189 delivered 10/10 on tested head `b261a3990c728ff38f08726c1999e1ec5be2f317`, merged/recorded observed hosted `7668a03d97c1ae62174f09e65ccd5a5717120be6`. D03 is the existing local candidate, final gates pending; no new code/PR/merge/deployment claimed by this plan. Open D01 and #185/#186 remain visible. Tomorrow re-read main, #188, candidate and protections before beginning the specific qualification package.

Sponsor/product owner: Nakul Jain. GitHub [#188](https://github.com/nakul175/saha-health/issues/188) retains sole execution ownership; [#190](https://github.com/nakul175/saha-health/issues/190) holds broader controller handoff/failure-resume qualification. Five old schedules remain disabled. Linear is the mapped planning view. Preserve old PR #173/#184/#187, archive and history; do not treat the stale ops D02 seed, old #175 body or pre-merge HANDOVER as a fresh instruction to reimplement/merge old work.

Sources: [vision/strategy](https://linear.app/aplyd-sandbox/document/saha-product-vision-and-strategy-dbc1026736ea), [previous roadmap](https://linear.app/aplyd-sandbox/document/saha-roadmap-and-release-goals-b710e5c7276c), [decision register](https://linear.app/aplyd-sandbox/document/saha-decisions-and-validation-register-1293df5cd202), [readiness contract](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7), [quality checkpoint](https://linear.app/aplyd-sandbox/document/saha-quality-review-and-remaining-readiness-gaps-b4358efd7fea), [project/hub](https://linear.app/aplyd-sandbox/document/saha-full-product-planning-hub-and-operating-rules-a94ec8f76c24), BRD v1.1/engineering plan/workbook preserved in planning PR [#173](https://github.com/nakul175/saha-health/pull/173), source `9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1`. Counts and historical results above are inherited from those inspected records, not new application test execution.
