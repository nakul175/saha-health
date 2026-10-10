# SAHA — AI assurance, discovery and release learning

[Current plan and coding start](https://linear.app/aplyd-sandbox/document/saha-current-product-plan-and-coding-start-8ae95cae358c) · [Vision/strategy](https://linear.app/aplyd-sandbox/document/saha-product-vision-and-strategy-dbc1026736ea) · [Roadmap/releases](https://linear.app/aplyd-sandbox/document/saha-roadmap-and-release-goals-b710e5c7276c) · [Shared Ready/Done](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7) · [AI/discovery/learning](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e)

Record `SAHA-ASSURANCE-DISCOVERY-LEARNING-01` · revision 1 · 10 October 2026 · planning design under the unmodified generic PM framework v4.2 / `3.0-generic`. This supplements the existing source hierarchy; it creates no new scope issue, provider, data collection, clinical policy or observed evaluation result.

## 1. Applicability and present boundary

**Full SAHA product AI: yes.** The existing R1 target includes governed AI capabilities, model evidence, a bounded broker and two approved providers; WP05/WP06 and source D05/D14/D17/G3 govern them. **Full product personal-data applicability: yes.** Workforce identity and the eventual health-record/recipient flows require purpose, permission and privacy controls. Those scope facts do not establish production data-use authority.

**Immediate D02/D03 bounded implementation:** manual synthetic assigned-person list/open/review/save. No new AI inference, model output, provider activation, clinical advice or external recipient is needed. Do not claim a whole-product AI exclusion from this narrow path. AI used to author or review documentation is separate from AI used in the delivered feature. Limit authoring context to authorised project material; do not include credentials or real patient data.

**D06 applicability:** resolve against the actual implementation. If AI interpretation, ranking or output affects the permitted task, link a capability-specific assurance record even if the final effect is server-authorised. A deterministic scoped intent prototype can test mechanics without a model, but cannot prove future model accuracy or the full R1 AI gate.

Planning defaults: use synthetic fixtures and existing local interfaces; retain manual fallback; no new services or actual participants; do not assume permission to train, evaluate or infer on real records. These defaults let preparation move without waiting on avoidable questions. Missing real data rights, legal basis, clinical thresholds, external contracts or approval authority remains a genuine unresolved gate, not an assumption that grants permission.

## 2. One assurance record per exact capability

Use shared record ID `SAHA-AI-[capability]-[revision]`, scoped to release, environment, intended users and effects. Link it from the owning epic/story/criterion/task and reuse current shared evidence by ID/version/hash. Do not require a new seven-verdict tree for every child issue. A changed prompt, model, retrieval, tool permission, relevant data population or release config invalidates affected assurance evidence.

| Field group | Required filled detail | Present evidence status |
| --- | --- | --- |
| Identity / scope | Capability ID, intended task, AI versus manual rationale, allowed environment, affected users, included/excluded effects, source owner IDs and release boundary | Source target exists; exact future capability freezes remain item-specific |
| Authority / risk | Normal server permission boundary, output-versus-decision-versus-action separation, actual clinical/nonclinical accountability, prohibited effects, harmful outcomes and safe response | Existing scope/control principles sourced; institutional owners and live scopes remain open where required |
| Dataset / permissions | Version/hash, N, provenance, permitted uses, slice/label/leakage bars, rights, access/retention, development/test separation | Design below; no actual approved evaluation set asserted |
| Acceptance / results | Exact metric/operator/target, denominators, exclusions, slices, uncertainty, baseline, run/config pins and raw or permitted protected row outcomes | No observed AI acceptance run is supplied by this document |
| Safety / fallback | Positive, refusal, error, authority, uncertainty, malicious-input and unavailable-dependency cases; actual fallback path and stop conditions | Required scenario contract below; actual tests must execute on the candidate |
| Version / release | Model revision, prompt/retrieval/tool/runtime/config/data/rubric pins, regression decision, promotion authority, rollback/halt path | No new qualified model/provider or operating release claimed |
| Privacy / operation / learning | Data-flow/permission/current-duty record, drift signals, alerts, response owner/authority, review window and roadmap links | Planning design; actual institutional approvals, monitoring and learning evidence remain separate |

Mark each group `proposed`, `current_satisfied`, `failed`, `needs_input` or `stale`, with evidence and limitation. A failing must-pass subrequirement fails the group; no average can hide it. The offline checker validates supplied claims and pins, not real reviewer identity or external approval. Local author-created reviewer accounts cannot confer independence.

The applicable shared engineering checklist versions are proposed `SAHA-READY-1.0` and `SAHA-DONE-1.0`. Link the assurance record from their relevant risk/authority/evidence checks and from the owning item; do not create a duplicate checklist per AI child. Actual clinical, data-use, system-owner and release approvals remain separately required.

### Protected requirement links

| Assurance concern | Existing owning scope / source IDs |
| --- | --- |
| Registration, intended use and deployment authority | SAHA-052 / BR-AI-01; SAHA-053 / BR-AI-02; SAHA-054 / BR-AI-03 |
| Experimental isolation, contract/input validity and inability to assess | SAHA-055 / BR-AI-04, BR-RULE-07; SAHA-056 / BR-AI-05; SAHA-057 / BR-AI-06 |
| Version and original result history | SAHA-058 / BR-AI-07; SAHA-060 / BR-AI-09 |
| Minimal provider data and compatible terms | SAHA-059 / BR-AI-08; SAHA-094 / BR-OFF-04 for pending media authority |
| Monitoring/suspension, provider isolation and cost | SAHA-061 / BR-AI-10; SAHA-062 / BR-AI-11; SAHA-063 / BR-AI-12, NFR-21 |
| Disagreement and consequential action review | SAHA-047 / BR-AG-08, BR-RULE-05; SAHA-009 / BR-UX-09 |
| Duplicate-safe external uncertainty | SAHA-075 / BR-INT-04, NFR-05; source requires at least 10,000 replay/timeout test events in supported connector fixtures |

These original item criteria stay authoritative. The proposed 200-utterance intent design below neither replaces the 10,000-event duplicate-safe source target nor qualifies external or clinical behavior. Preserve every original source case and gate in the owning item; this record adds the stage-appropriate evidence organisation.

## 3. AI-01 — Intended use, authority and risk

For bounded assistance, recommended first design is translating a user's request into a typed allowed intent or draft preparation over a currently permitted action. Record exact allowed intents and their parameters from inspected current APIs. A model may propose; normal server identity/assignment/purpose/version/audit decides whether an effect may occur. Model text, retrieved text, public identity headers, client role claims or hidden prompt instructions cannot enlarge authority. Opening a record must not silently create a visit. Never present a prepared draft as saved, a local acknowledgement as remote acceptance, or an assistance output as a clinical decision.

List a trigger, affected party, consequence, severity rationale, control and evidence for wrong-person selection; plausible unsupported content; ambiguous or unsupported intent; stale context; changed role/assignment; duplicate effects after uncertainty; delayed/unavailable dependency; privacy leakage; malicious prompt/retrieval/tool content; misleading completion; unusable false refusal; clinical reliance and unqualified override. Clinical capability risk classification and acceptable residual risk require actual clinical governance; an agent must not assign itself that authority.

For each effect define permitted inputs, scope, confirmation where already required, reversibility, actual approval/override point, operator competence and response when no qualified reviewer is available. An “Approve” button alone does not prove effective oversight. Keep routine manual work usable within its actual authority when AI is unavailable. A clinical action without required authority must halt or enter the established qualified route; no new clinical protocol is invented here.

## 4. AI-02 — Dataset quality contract

Before a model-based acceptance run, freeze a manifest with dataset ID/version/hash, source/collection range, synthetic/transformed/real distinction, intended task/population, record count, selection method, exclusions, rights and permitted use, access/retention and record-level provenance references. Do not put raw personal data into Linear or the product docs. Synthetic data validates declared mechanics and adversarial behaviors; it cannot prove real-population accuracy, local clinical performance or adoption.

**Recommended planning bar for a bounded nonclinical intent dataset:**

1. Every declared supported intent, unsupported-intent class, role/assignment refusal and material failure class has labelled cases and boundary variants. The coverage matrix includes only languages/input modes actually claimed. A missing declared slice is a gap.
2. Every case has a permitted source/provenance category, complete gold expected intent/parameters or refusal, source boundary and severity label. Missing required labels/provenance is zero-tolerance for the acceptance set; unresolved ambiguity stays out of deterministic scoring and is reported separately, not deleted from the inventory.
3. Split development/tuning/retrieval-building from protected acceptance evaluation by appropriate entity/time/source boundary; perform exact and near-duplicate overlap checks. No known duplicate or source leakage between development and acceptance splits is accepted. Unknown vendor training contamination is disclosed and mitigated; do not claim it has been disproved.
4. Freeze an annotation rubric with positive, refusal, ambiguous and boundary examples; document label qualifications, disagreement/adjudication and an independently selected label audit. Author-generated labels alone are not clinically qualified truth. An AI judge needs its own validated version, human calibration and failure analysis.
5. Declare per-slice minimum N and statistical adequacy before seeing results. Recommended initial design exercise uses at least 200 synthetic utterance cases and at least 20 per declared supported action family, plus dedicated authority/safety/adversarial suites. These are planning sample defaults, not a validated power calculation or real-use acceptance. Increase or redesign the set when capability/slice/risk coverage demands it.
6. If an acceptance case is used to repair a prompt/model, move it to development, retain it as a regression witness and create a fresh protected test set. Do not repeatedly tune on the same secret-labelled set and call the final score independent.

No dataset currently meets these bars merely because this manifest template exists. Dataset rights, real-world slice adequacy and clinical labels remain approved source/evidence inputs for the affected gate.

## 5. AI-03 — Accuracy and measurable acceptance

Each capability freezes a statement in this form: **On dataset ID/version/hash, candidate model/prompt/retrieval/tool/configuration manifest achieves metric operator target over eligible N, for each mandatory slice, with the declared uncertainty rule and costly-error/safety limits.** Values are capability-specific. No universal “accuracy ≥X%” can qualify both conversational navigation and clinical image screening.

| Capability / concern | Metric and denominator | Planning target / gate |
| --- | --- | --- |
| Bounded nonclinical intent interpretation | Exact supported intent **and required parameter** matches / all eligible supported-intent cases; unsupported/ambiguous cases scored separately | Recommend ≥95% on the frozen synthetic nonclinical set as an initial utility hypothesis, alongside per-family/slice bars set before execution. This is an unapproved proposed refinement, not a substitute for original D06 criteria or clinical evidence. |
| Refusal usefulness | False refusals / valid permitted attempts; failures to refuse / disallowed attempts | Predeclare both bars. Safety cannot be improved by refusing all valid work; aggregate accuracy cannot hide disallowed effects. |
| Authorised effect control | Actual unauthorised effects / attempted disallowed effects; exact-person effects / supported permitted cases | All mandatory server-authority scenarios must pass with zero observed unauthorised effects in the declared suite; any leak blocks advancement. Finite tests do not establish a population rate of zero. |
| Action reliability | Correct declared outcome / all eligible action attempts; duplicate effects and unresolved outcomes separately | Required replay/partial-failure/version/acknowledgement cases pass the original operation contract. An uncertain response must not become an uncontrolled new effect. |
| Generated information | Supported correctness, completeness and grounding under frozen rubric; costly unsupported statements / all evaluated outputs | Per intended task and risk; exact threshold and required qualified reviewer remain source D14 decisions where not established. No fabricated source/citation or false claim of clinical authority is permissible. |
| Clinical capability | Appropriate task-specific sensitivity/specificity/precision/recall/calibration or adjudicated outcome metrics, plus adverse-case severity and relevant local slices | Actual clinical safety/AI governance threshold, dataset and use permission required. Synthetic nonclinical ≥95% proposal does not apply. |
| Manual fallback | Completed permitted manual tasks / all fallback attempts; lost input and misleading states separately | Existing declared manual acceptance and authority invariants remain intact under model timeout/unavailability/invalid output. |

Report per-slice numerator/denominator, failures, exclusions, confidence interval or justified uncertainty treatment, stochastic settings/repeats, raw protected outcome references, baseline comparison, latency/resource/cost where material and exact candidate pins. An empty denominator is inconclusive. A mandatory failed slice fails acceptance even if aggregate ≥95%. No lowering threshold or changing dataset/profile after observing a failure to obtain a pass. A legitimate changed target requires a versioned decision and affected review, preserving old results.

Source D14 model thresholds and D15 outcomes remain open where institutional acceptance is needed. The proposed nonclinical planning bar makes the next dataset/evaluation design concrete without claiming it is source-approved, clinically meaningful or already passed.

## 6. AI-04 — Safety, fallback and adversarial cases

| Scenario class | Observable expected result |
| --- | --- |
| Valid permitted supported intent | Exact typed target/parameters; correct existing person; normal permissions, audit and version checks; no extra effect |
| Wrong/unassigned/nonexistent person or duplicated selector | Existing declared refusal/error-only response; no private record projection or mutation |
| Role/assignment/purpose revoked between preparation and action | Fresh server refusal; private UI cleared where contract requires; unsaved input handled within authorised retention rules |
| Ambiguous person/intent, incomplete input or unsupported action | Clarify within the bounded interface, offer existing safe manual path or refuse; no guessed consequential effect |
| Model timeout, unavailable provider, malformed/unsupported schema or ungrounded output | Preserve authorised prepared work; truthful degraded state and usable manual path; no fabricated success or silent remote retry |
| Prompt injection in user text, retrieved material or tool result | Treat untrusted content as data; no privilege/schema expansion, secret disclosure, cross-user retrieval or disallowed tool call |
| Acknowledgement drop, partial completion, repeated/replayed request | Original operation identity and existing reconciliation rules; no duplicate effect or blind external retry |
| Stale pack/record/version, conflict or confirmed record | Preserve source pin/current version/immutability contract; explicit permitted comparison/recovery, no silent overwrite |
| Audit failure or unavailable required reviewer | No success or mutation without required evidence/authority; declared error and safe established recovery/escalation |
| Invalid clinical inference/request or unqualified override | No invented recommendation or policy; remain within approved capability and actual clinical authority |
| Valid work wrongly blocked by guard | Record false refusal; evaluate usability alongside safety; correct without weakening authority or prohibited effects |

Freeze case IDs, setup, expected outputs/no-mutation state, evidence and severity before candidate execution. Test fallback end to end, including operator unavailability, cancellation and recovery. Preserve all failures and coverage limitations. Passing nominal accuracy cannot replace these must-pass assertions.

## 7. AI-05 — Versioning, regression and promotion

Release manifest pins model/provider capability and immutable revision where available; system/prompt/template hashes; preprocessing/postprocessing; retrieval corpus/index/embedding/ranking versions; tool schemas/code/permissions; policy/guardrails; runtime/dependencies/settings; dataset/rubric/judge/evaluation version; and candidate configuration. Exclude secrets. A mutable alias is an explicit reproducibility limitation with change detection and bounded promotion policy, not an immutable version merely because it has a name.

For a material change record affected uses/risks/slices, rerun the current frozen required regression selection, retain exact results and compare against the prior qualified baseline. Prompt-only and permission-only changes can alter behavior and need their affected evidence. The actual promotion authority approves the exact manifest after required current tests and reviews; independent human approval and native protections cannot be substituted by an agent's own review.

Record candidate approval separately from published artifact, merge and observed operating manifest. Test authorised rollback/halt to a genuinely available qualified version or safe manual state without corrupting records/queues. No new provider is activated to fill this template. Current D02/D03 manual evidence cannot qualify a future model configuration.

## 8. AI-06 — Data use, privacy and India applicability

Build a flow inventory for collection, evaluation/annotation, training/tuning, retrieval, inference, tool effects, output, telemetry and human review. For each flow identify source/category, people affected, purpose, actual permission or legal basis, recipient/processor, location, access/security, retention, withdrawal/erasure, reuse/training policy and deletion propagation. Service permission is not automatically training permission. Pseudonymisation is not proof of irreversible anonymity. For children or people with lawful guardians, obtain the qualified applicable decision before real collection/evaluation.

Use actual contracts and qualified decisions for provider reuse/training, subprocessors, cross-border processing, logs, rights/breach response and legally required retention exceptions. Do not infer “consent always required” or “consent sufficient” across every flow; record the applicable basis and current duties for the real organisation, purpose and release date. No production compliance certificate is supplied by this document.

**India primary source review, 10 October 2026:** The DPDP Act's applicability is factual and jurisdictional; read the enacted text with commencement and subsequent amendments/orders. [DPDP Act 2023](https://www.indiacode.nic.in/bitstream/123456789/22037/2/a2023-22.pdf). The commencement notification stages specified provisions on publication, after one year and after eighteen months; do not label all main processing obligations effective on this document's date. [G.S.R. 843(E)](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf). Rules likewise have phased commencement and must be read with the December corrigendum. [G.S.R. 846(E)](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf), [G.S.R. 892(E)](https://www.meity.gov.in/static/uploads/2025/12/3c7ebbae0e5456f493f486e6845df86b.pdf). The October 2026 order makes textual corrections in sections 9(1) and 10(2)(c)(ii), starting on Gazette publication; it does not itself accelerate all processing duties. [S.O. 5458(E)](https://www.meity.gov.in/static/uploads/2026/10/daf495a7b5798a3dfa72a944b51fc176.pdf).

The qualified privacy/legal reviewer must record exact current text, commencement, factual applicability, other presently applicable privacy/security/sectoral/contractual duties and the real release date. Future DPDP commencement does not authorise otherwise impermissible data use. The primary-source links above were actually checked for this planning update; SAHA's actual institutional applicability/approval remains unresolved where not sourced. No exact compliance deadline or blanket exemption is assumed from a copied generic date.

## 9. AI-07 — Monitoring, incidents and learning

Before an authorised AI release define monitored population/version, baseline, permitted telemetry, sample/cadence, useful minimum N, thresholds, lag, dashboard/report, actual response owner and authority. Cover input/missingness shifts; task outcome and costly error; false refusals/abstention; safety/privacy/security incidents; slice disparities relevant to authorised scope; overrides/complaints; latency/availability/resource cost. No unnecessary raw sensitive inputs are logged. Missing targets, disabled telemetry, absent owners or inadequate samples stay visible pending states.

Statistical drift is a warning signal, not automatically performance loss; stable inputs do not prove stable quality. Delayed labels and proxy measures carry explicit limitations. Select permitted audited samples, correlate failures with exact manifest and test alert/response delivery including operator absence. Define warning, escalation, narrowed exposure, fallback, rollback/halt and response time from actual risk/authority. Any observed unauthorised effect, prohibited clinical reliance or material privacy leak blocks continued qualification of the affected capability and invokes the established authorised response.

After the declared permitted observation window complete the learning review in section 12. Add new failures to the authorised regression set, revise hypotheses/risk controls and link actual decisions/actions to roadmap. Do not tune on a protected acceptance set or relabel a dashboard as evidence that user outcomes improved.

## 10. Epic discovery contracts

Each row identifies a **hypothesis**, not an observed fact. Recommended initial tests start with source/code/synthetic work that is authorised now. Where real users, organisational workflow, clinical judgement or external systems are needed, prepare the protocol and preserve the genuine permission/evidence prerequisite. Actual quantitative acceptance thresholds remain the owning source contract; do not invent research participants or quietly weaken it.

| ID / epic | Riskiest material assumption | Disconfirmation test and minimum useful evidence | Decision if disproved |
| --- | --- | --- | --- |
| H-WP01 | Workers can select the correct assigned existing person despite identity ambiguity and changes | Synthetic duplicate-name/assignment-change/unknown-ID/role tests on actual list/open, then authorised observed selection tasks on declared handset/language; record all wrong selections and comprehension failures | Repair identifiers, scope and selection before expanding capture; any wrong-record access fails the affected gate |
| H-WP02 | Permission, version and audit controls stay atomic across supported failure paths | Existing server contract inspection plus audit failure, authority revocation, concurrency and error/no-mutation tests; demonstrate durable evidence for supported effects | Fix the invariant before downstream mutation; do not add a client bypass |
| H-WP03 | Workers understand review/save/confirmation and can reuse eligible observations without losing intent | Real local synthetic backend/UI D03 conflict/drop-ack/retained-answer/readback cases; prepare comparable observed baseline protocol distinguishing duplicate from time-specific entry | Simplify states or capture, repair lost/misleading work, revise reuse hypothesis; no parent benefit acceptance yet |
| H-WP04 | Approved programme definitions can reuse capture without silently changing required semantics | Compare versioned source packs and eligible question mappings; test differing units, attestations, versions and unsupported rules; programme-owner review before real workflow claims | Narrow reuse or explicit per-programme capture; preserve original questions/clinical rule authority |
| H-WP05 | Bounded assistance improves a permitted task without expanding authority or degrading fallback | Frozen capability dataset/configuration and exact intent/parameter outcomes, ambiguity/refusal/injection/fallback comparisons against manual path | Narrow intent scope, improve parser/model within permission or retain manual-only path; no provider activation to chase a score |
| H-WP06 | Established qualified review/escalation is feasible when needed | Source responsibility mapping and synthetic absent-reviewer/misroute/unsafe-override tests; actual qualified workflow/capacity evidence for clinical release | Hold affected clinical capability or narrow scope; do not assign the agent clinical authority |
| H-WP07 | Owner-approved independent receipts establish destination acceptance/reconciliation | Inspect permitted contract/receipt semantics; synthetic timeout/duplicate/partial/stale-receipt tests; actual owner-authorised sandbox evidence when separately allowed | Keep pending state and manual reconciliation; never equate HTTP success with programme acceptance |
| H-WP08 | Declared acknowledged work survives interruption and safe reconnect on supported devices | Synthetic storage/restart/drop-ack/replay/conflict/authority tests on exact implementation; actual handset endurance and approved lease/key-recovery evidence for production claim | Repair retention/replay or narrow offline boundary; retain DEC-03 and original ≤500 ms target |
| H-WP09 | Coordination maps to actual responsibilities and acknowledgements rather than invented workflow bureaucracy | Source role/transfer/evidence mapping and synthetic wrong-recipient/unacknowledged/changed-assignment/refusal cases; actual approved coordination process for field claim | Narrow routes or expose unresolved transfer truthfully; no new supervisor gate inferred |
| H-WP10 | Operational measures mean what decision-makers think they mean and reconcile with underlying evidence | Frozen report definitions and denominator fixtures; repeated/late/excluded/unaccepted-source records; privacy-scoped export/refusal tests; authorised user interpretation study later | Correct definition/projection, disclose limitation and revisit decisions before scaling reports |
| H-WP11 | A qualified candidate can be identified, supported and safely recovered in the actual operating environment | Exact candidate→merge→observed operating identity; permitted incident/alert/fallback/recovery exercise with record/queue preservation; source support/exit ownership | Hold release or narrow exposure until actual operating/recovery control exists; retain precise access blocker |

For every executed experiment record source/version, hypothesis, target population, permission boundary, method, baseline/control, predeclared success/failure/inconclusive rule, sample/slices, observation window, data minimisation, result and uncertainty, actual reviewer/owner decision and affected items. An insufficient or synthetic-only sample cannot be promoted to real-user benefit. A disconfirmation changes the recommended roadmap through a versioned product decision without deleting original scope/evidence.

## 11. Operating assumptions and unresolved decisions

| Planning default / recommendation | Rationale and downside | Review trigger / actual blocked claim |
| --- | --- | --- |
| Continue documentation/source preparation without more sponsor questions | Latest request authorises best assumptions; useful work need not wait on avoidable prose choices | Do not substitute assumptions for observed evidence or external authority |
| Manual existing D03 is next; do not create a competing candidate | Prior delivered D02 and preserved local D03 reduce unnecessary duplicate work | Fresh baseline/branch inspection and required readiness still govern execution |
| Use synthetic local evidence and existing systems only | Preserves current data/service/hosting boundary | Real participants, provider/destination calls, payments and production data remain separately gated |
| Keep original targets/source criteria and source release labels | Prevents a paper pass from concealing scope loss | Legitimate versioned source decision and impact analysis required for any real change |
| Use recommended PM priority/sizing methods, record unestimated work honestly | Produces an actionable order without false precision or invented capacity | Actual estimator/inspection and delivery resources required for execution forecasts |
| Plan measurable learning on the first permitted observation window | Establishes feedback without inventing research/automation | No user-benefit/learning pass until baseline/target/actual denominator and authority exist |
| Adopt a proposed nonclinical dataset/accuracy design as a reviewable option | Gives WP05/D06 a concrete starting point while preserving frozen original criteria | Freeze actual capability/slices/rights/threshold decision before AI readiness; clinical gate remains separate |

Unresolved institutional facts retain source IDs: D01–D21 buyer/site/programmes/languages/providers/destinations/privacy/device/retention/cost/ABDM/EHR/standards; DEC-03 offline authority/key recovery; actual handset/frontline access; eight SAHA-153–160 criterion-source gaps; D07 recovery authority/topology/RPO/RTO; D01 defect impact and D03 final qualification. The documentation loop can refine choices/protocols now, but must return the exact affected `needs_input` gate where only actual authority or evidence can resolve it. No open question requires inventing a favourable answer.

## 12. Release-learning record and feedback loop

Use record `SAHA-LEARNING-[release]-[window]`, revisioned and linked from the release goal. A measured review contains:

1. Exact intended outcome, source target, baseline version, declared population/slices, window and release/configuration manifest.
2. Observed numerator/denominator, exclusions and failed/incomplete attempts; confidence/uncertainty, confounders and sample adequacy; raw or appropriately protected source references.
3. Comparison of baseline, target and actual for task completion, repeated entry, time, truthful/durable saving, assistance where applicable, safety/privacy incidents and support/resource cost. Do not replace original BRD measures with convenient proxies.
4. Unexpected harms/benefits, disagreements, near misses, uncovered failure modes, operational incidents and unresolved defects with disposition.
5. Actual owner decision: continue, improve, narrow, roll back or retire; rationale, scope, residual risk and actual decision authority. Product owner cannot supply missing clinical/legal/system-owner authority.
6. Updated hypothesis and risk record; exact strategy/roadmap/release/item/task links; proposed next experiment or repair, its readiness gate and later review trigger.

**Recommended review cadence:** engineering review after each bounded qualified release; product learning after the first complete permitted baseline/candidate observation window; extra immediate review on material safety/privacy/authority/acknowledged-work-loss or false-success signals. Establish actual calendar windows and response deadlines before the corresponding rollout; no new automation or participant research is activated by this policy. Delayed/empty/undersized observations remain `insufficient_evidence` and do not produce an outcome pass.

Loop: **inspect current evidence → compare with frozen target/baseline → classify result and uncertainty → make authorised decision → revise hypothesis/strategy/roadmap and owning work → check affected readiness → run the next permitted experiment/release → review again**. Content/source/configuration changes make affected reviews stale. Retain old evidence and thresholds; do not weaken the criteria to obtain a pass. A release can be technically delivered while its intended benefit is unproved or disproved.

## 13. Stage-specific exit and source boundary

| Stage | Required now | Cannot be claimed from a filled document |
| --- | --- | --- |
| Discovery | Exact scope/applicability, riskiest hypothesis, source/risk boundary and permitted test with unresolved decisions visible | Real-world accuracy, clinical benefit or approval |
| Planning | Concrete capability/data/metric/control/version/privacy/monitoring/learning design; source traceability and actual unresolved prerequisites | Executed evaluation, Ready, G3, provider activation or accepted clinical threshold |
| Ready | Frozen actual dataset/rubric/targets/config/test/response contract, required rights and genuine owners/review authority, feasible execution inputs | Passing observed results or release permission merely because the plan is complete |
| Delivery | Current measured must-pass results, actual safety/fallback/regression/privacy/monitoring proof, exact release identity and required separate approvals | Future measured user benefit or accepted R1/pilot merely from a small synthetic feature |
| Learning | Actual complete observation window, target/baseline comparison and authorised feedback decision/actions | Green from an empty sample, silence or a fixed number of iterations |

Current state of this record is **planning design with explicit source/evidence prerequisites**. No actual AI evaluation, clinical review, institutional permission, research observation, new code test, release or outcome pass is invented. Applicable original source acceptance/frozen D02/D03 criteria remain protected.

Source alignment: [vision/strategy](https://linear.app/aplyd-sandbox/document/saha-product-vision-and-strategy-dbc1026736ea), [roadmap/release goals](https://linear.app/aplyd-sandbox/document/saha-roadmap-and-release-goals-b710e5c7276c), [decisions/validation](https://linear.app/aplyd-sandbox/document/saha-decisions-and-validation-register-1293df5cd202), [readiness gates](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7), [scope mapping](https://linear.app/aplyd-sandbox/document/saha-full-scope-and-requirement-mapping-99faedfc92c7), [delivery controller #188](https://github.com/nakul175/saha-health/issues/188). Assurance groups and stage/sampling/identity safeguards follow generic v4.2 `AI-ASSURANCE.md`, `PRODUCT-CONTEXT.md` and the unchanged `3.0-generic` catalogue; they are framework planning policy, not claims that every rule is a statutory requirement.
