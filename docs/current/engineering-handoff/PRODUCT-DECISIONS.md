# SAHA product decisions for the next coding session

The next engineering goal is to qualify the existing manual routine-visit review/save path for an individually signed-in ASHA working with her assigned existing person. A correct identity and a truthful save outcome take priority because every later programme, offline and assistance workflow depends on them.

The full v4.2 [vision and strategy](https://linear.app/aplyd-sandbox/document/saha-product-vision-and-strategy-dbc1026736ea) and [roadmap](https://linear.app/aplyd-sandbox/document/saha-roadmap-and-release-goals-b710e5c7276c) remain the product direction. This supplement resolves routine planning choices with recommended defaults under Nakul's instruction to proceed without questions. Source requirements and action-specific authority take precedence.

## Recommended release goal and scope

For the next bounded demonstration, an authorised synthetic ASHA selects the correct assigned existing person, explicitly starts or resumes the permitted routine visit, reviews/corrects its bounded fields, saves through the existing server workflow and sees an accurate success, refusal, conflict or uncertain outcome. The unchanged [D03 contract](source/frozen-d03.md) supplies the acceptance oracle; the [coding packet](D01-D03-CODING-PACKET.md) maps it to the candidate.

Use existing identity, assignment, purpose, visit, revision, audit and receipt components. Opening a record must not create a visit. A saved draft, a confirmed record and a destination's independent acceptance remain separate states. No provider is needed to prove the manual path.

This is an engineering demonstration within the original R1 direction. The full R1 authorised multi-programme pilot still requires its actual institutional, clinical, privacy, provider, device and formal acceptance gates. R2 expansion and source-decision-gated CWO features follow their own scope and evidence.

## Defaults to use without another product question

| Decision | Recommended default | Reason and revisit trigger |
| --- | --- | --- |
| First user and environment | Existing individually signed-in ASHA, assigned existing person, synthetic/training data | Matches the frozen D02/D03 boundary. Change only through a versioned scope/authority decision. |
| Coding order | Fresh bounded D01 decision, then sole existing D03 candidate; D04/D05 contract preparation can proceed separately | Prevents inherited defects or unqualified retention being hidden by a new feature. Revisit after D03's complete declared gate. |
| UI entry | Preserve the minimal Today journey and explicit start/resume/review/save; no hidden activation of the legacy workspace | The first task must stay understandable and reviewable. Revisit with observed permitted frontline findings. |
| Unknown fields and errors | Preserve unknown/missing values, unsaved intent and the distinction between refusal and uncertain outcome | No guessed health facts, last-write-wins conflict repair or blind external retry. Revisit only with an approved revised contract. |
| AI in the immediate path | Manual path works without model/provider execution; later assistance is optional, bounded and compared to the same manual task | Avoids a provider dependency in the first qualification. Platform-level AI applicability remains yes; this decision does not exempt AI assurance for future capabilities. |
| Product hypotheses | Treat less repeated entry and clearer save states as hypotheses to measure after a technically qualified demonstration | No observed baseline or benefit is supplied. Revisit after a permitted, predeclared observation window. |
| Performance targets | Retain source local encrypted-save p95 <=500 ms and each original applicable replay, network and UI target | No threshold relaxation after a failed run. Distinguish local persistence from server acknowledgement. |
| Forecast | Size the remaining qualification after candidate/baseline inspection; use a range, confidence and named dependencies | No staffing, delivery date or external review wait is inferred from a documentation count. |
| Record ownership | Reuse the original native epic/story/task and controller #188 | No duplicate stories, owner assignments or reordered dependency edges. |

## Decisions that recommendations cannot supply

Production offline lease, expiry, device/key recovery and DEC-03 are unresolved institutional choices. Physical handset and frontline evidence require actual access and permitted participants. Clinical rules, dataset rights, personal-data processing, providers/partners, live recipients, hosting and financial permissions require the responsible actual authority before the dependent action. Keep each as a precise action-specific gate; continue independent synthetic preparation.

SAHA-153–160 retain their source/adoption gaps. Their proposed scenario expansions do not silently become approved source criteria. Shared SAHA-READY-1.0 and SAHA-DONE-1.0 remain the versioned proposed engineering checklists in the current product plan; using a reference does not create approval or remove frozen story gates.

## Traceability and learning

Vision → strategy → product release goal → owning epic → existing story/support item → unchanged criterion → existing technical task → observed evidence → learning decision. A technical task produces a bounded output; it does not replace the parent outcome or formal acceptance. Preserve original priorities, source releases, estimates and statuses unless an actual versioned decision changes them.

For the first permitted ASHA evaluation, predeclare the same task and person-context conditions for current workflow and candidate, language/device context, denominators and interruption conditions. Observe correct-person selection, task completion, understanding of save/refusal/uncertainty, repeated entry and serious failures separately. These are recommended measures, not measured results or empirical success thresholds. Any participant contact or real-data research needs its own authority.

Review observed results at the end of the declared learning window and choose continue, improve, narrow, roll back or retire through the actual product/release decision owner. A successful build or merge cannot establish user benefit.
