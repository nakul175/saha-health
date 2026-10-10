# SAHA current task register — planning edition 4.2

[Current plan and coding start](https://linear.app/aplyd-sandbox/document/saha-current-product-plan-and-coding-start-8ae95cae358c) · [Vision/strategy](https://linear.app/aplyd-sandbox/document/saha-product-vision-and-strategy-dbc1026736ea) · [Roadmap/releases](https://linear.app/aplyd-sandbox/document/saha-roadmap-and-release-goals-b710e5c7276c) · [Shared Ready/Done](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7) · [AI/discovery/learning](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e)

All existing IDs, parents, release groups, original source clauses, case references and native task status are preserved. New planning refinements are explicitly proposed addenda on existing items. The original mapping below remains authoritative; a draft forecast or completed child does not accept its parent.

Current inventory: 140 functional stories + 20 supporting items; 11 epics; 200 tasks (including 8 D01–D08). The current records link the v4.2 shared Ready/Done versions and specific discovery, priority, sizing, scenario and verification details. Refinement creates no additional story, task or scope.

## Preserved complete register

# SAHA — Unified task register

## One task inventory

**200 tasks =192 existing engineering/qualification tasks +8 existing implementation tasks (D01–D08).** All200 use the common SAHA Technical label and [Tasks board](<https://linear.app/aplyd-sandbox/project/saha-community-worker-os-23d61552362d/view/tasks-fd49b187c465>). No new issue or duplicate task was created by this alignment. The140 planned functional product stories and20 supporting product items remain separate hierarchy levels.

**Progress:1 Done (D02),1 In Progress on planning hold (D03),198 Backlog.** D02 passed its bounded10/10 synthetic delivery gate; parent acceptance remains pending. D03 has local code/test evidence but no published PR/SHA, qualified merge or observed deployment. All statuses, criteria, relation IDs and evidence are preserved.

The192 engineering/qualification tasks consist of176 original ENG tasks,10 ENG-SAHA tasks for CWO extensions and6 D03-T qualification subtasks. Their earlier100 checklist-to-native migration remains complete, with zero fallback checklists. Source outcomes, owner roles, dependencies, milestones and test IDs remain unchanged. The6 D03-T items remain children of implementation task D03; each native issue counts once in200 even when it is a subtask. Completing a child does not automatically complete the parent.

## Implementation tasks — included in200

| Task | Primary owning product item | Native record |
| -- | -- | -- |
| \[Task D01\] Reproduce the current application baseline | <issue id="5a8799cb-e19a-4d8c-98a2-1604e6b225ee" href="https://linear.app/aplyd-sandbox/issue/APL-174/saha-151-establish-a-reproducible-reuse-baseline">APL-174</issue> | [APL-5](<https://linear.app/aplyd-sandbox/issue/APL-5/delivery-step-d01-reproduce-the-current-application-baseline>) |
| \[Task D02\] Open assigned work from mobile Today | <issue id="0ff208dd-5356-4283-8387-80f33d99d121" href="https://linear.app/aplyd-sandbox/issue/APL-24/saha-001-one-task-entry-point">APL-24</issue> | [APL-6](<https://linear.app/aplyd-sandbox/issue/APL-6/delivery-step-d02-open-assigned-work-from-mobile-today>) |
| \[Task D03\] Review and save a bounded routine visit | <issue id="4be325c9-7301-488b-8159-ac0746d41185" href="https://linear.app/aplyd-sandbox/issue/APL-27/saha-004-structured-encounter-summary">APL-27</issue> | [APL-7](<https://linear.app/aplyd-sandbox/issue/APL-7/delivery-step-d03-review-and-save-a-bounded-routine-visit>) |
| \[Task D04\] Retain routine work through offline interruption | <issue id="b0b465a7-4f4f-4339-a600-0e9aab21156a" href="https://linear.app/aplyd-sandbox/issue/APL-115/saha-092-durable-acknowledged-local-saves">APL-115</issue> | [APL-8](<https://linear.app/aplyd-sandbox/issue/APL-8/delivery-step-d04-retain-routine-work-through-offline-interruption>) |
| \[Task D05\] Reconnect without duplication or false completion | <issue id="17a4351a-1c30-4e0d-93e3-7f94e5173e3d" href="https://linear.app/aplyd-sandbox/issue/APL-118/saha-095-ordered-synchronisation-and-measured-queue-recovery">APL-118</issue> | [APL-9](<https://linear.app/aplyd-sandbox/issue/APL-9/delivery-step-d05-reconnect-without-duplication-or-false-completion>) |
| \[Task D06\] Open or prepare bounded tasks conversationally | <issue id="eaa19e49-57c5-440f-8a54-858448bca063" href="https://linear.app/aplyd-sandbox/issue/APL-63/saha-040-bounded-task-planning">APL-63</issue> | [APL-10](<https://linear.app/aplyd-sandbox/issue/APL-10/delivery-step-d06-open-or-prepare-bounded-tasks-conversationally>) |
| \[Task D07\] Identify and recover the synthetic DigitalOcean release | <issue id="2c0f4831-dfe1-4ac0-bb42-4452cb4ce36d" href="https://linear.app/aplyd-sandbox/issue/APL-175/saha-152-identify-and-safely-promote-the-synthetic-digitalocean">APL-175</issue> | [APL-11](<https://linear.app/aplyd-sandbox/issue/APL-11/delivery-step-d07-identify-and-recover-the-synthetic-digitalocean>) |
| \[Task D08\] Qualify compact-phone usability and persistence | <issue id="cb9c430f-f75d-43af-a4fb-1c9451dce709" href="https://linear.app/aplyd-sandbox/issue/APL-162/saha-139-responsive-field-interface">APL-162</issue> | [APL-12](<https://linear.app/aplyd-sandbox/issue/APL-12/delivery-step-d08-qualify-compact-phone-usability-and-persistence>) |

## Engineering and qualification tasks —192 included in200

| Task ID and outcome | Parent product/task | Tracking location |
| -- | -- | -- |
| ENG-BR-UX-01 — One task entry point | SAHA-001 | [Child issue APL-184](<https://linear.app/aplyd-sandbox/issue/APL-184/eng-br-ux-01-one-task-entry-point>) |
| ENG-BR-UX-02 — Clear patient and visit context | SAHA-002 | [Child issue APL-185](<https://linear.app/aplyd-sandbox/issue/APL-185/eng-br-ux-02-clear-patient-and-visit-context>) |
| ENG-BR-UX-03 — Voice text and guided entry | SAHA-003 | [Child issue APL-186](<https://linear.app/aplyd-sandbox/issue/APL-186/eng-br-ux-03-voice-text-and-guided-entry>) |
| ENG-BR-UX-04 — Structured encounter summary | SAHA-004 | [Child issue APL-187](<https://linear.app/aplyd-sandbox/issue/APL-187/eng-br-ux-04-structured-encounter-summary>) |
| ENG-BR-UX-05 — Language and accessibility | SAHA-005 | [Child issue APL-188](<https://linear.app/aplyd-sandbox/issue/APL-188/eng-br-ux-05-language-and-accessibility>) |
| ENG-BR-UX-06 — Status that reflects reality | SAHA-006 | [Child issue APL-189](<https://linear.app/aplyd-sandbox/issue/APL-189/eng-br-ux-06-status-that-reflects-reality>) |
| ENG-BR-UX-07 — Resume interrupted work | SAHA-007 | [Child issue APL-190](<https://linear.app/aplyd-sandbox/issue/APL-190/eng-br-ux-07-resume-interrupted-work>) |
| ENG-BR-UX-08 — Low literacy and field use | SAHA-008 | [Child issue APL-191](<https://linear.app/aplyd-sandbox/issue/APL-191/eng-br-ux-08-low-literacy-and-field-use>) |
| ENG-BR-UX-09 — Explainable action review | SAHA-009 | [Child issue APL-192](<https://linear.app/aplyd-sandbox/issue/APL-192/eng-br-ux-09-explainable-action-review>) |
| ENG-BR-ID-01 — Workforce lifecycle | SAHA-010 | [Child issue APL-193](<https://linear.app/aplyd-sandbox/issue/APL-193/eng-br-id-01-workforce-lifecycle>) |
| ENG-BR-ID-02 — Scoped permissions | SAHA-011 | [Child issue APL-194](<https://linear.app/aplyd-sandbox/issue/APL-194/eng-br-id-02-scoped-permissions>) |
| ENG-BR-ID-03 — Authentication and recovery | SAHA-012 | [Child issue APL-195](<https://linear.app/aplyd-sandbox/issue/APL-195/eng-br-id-03-authentication-and-recovery>) |
| ENG-BR-ID-04 — Caseload assignment and transfer | SAHA-013 | [Child issue APL-196](<https://linear.app/aplyd-sandbox/issue/APL-196/eng-br-id-04-caseload-assignment-and-transfer>) |
| ENG-BR-ID-05 — Patient matching with human resolution | SAHA-014 | [Child issue APL-197](<https://linear.app/aplyd-sandbox/issue/APL-197/eng-br-id-05-patient-matching-with-human-resolution>) |
| ENG-BR-ID-06 — Local registration without national identifier | SAHA-015 | [Child issue APL-198](<https://linear.app/aplyd-sandbox/issue/APL-198/eng-br-id-06-local-registration-without-national-identifier>) |
| ENG-BR-ID-07 — Household and proxy boundaries | SAHA-016 | [Child issue APL-199](<https://linear.app/aplyd-sandbox/issue/APL-199/eng-br-id-07-household-and-proxy-boundaries>) |
| ENG-BR-ID-08 — Correctable identity links | SAHA-017 | [Child issue APL-200](<https://linear.app/aplyd-sandbox/issue/APL-200/eng-br-id-08-correctable-identity-links>) |
| ENG-BR-ID-09 — Service accounts and delegation | SAHA-018 | [Child issue APL-201](<https://linear.app/aplyd-sandbox/issue/APL-201/eng-br-id-09-service-accounts-and-delegation>) |
| ENG-BR-ID-10 — Organisational federation | SAHA-019 | [Child issue APL-202](<https://linear.app/aplyd-sandbox/issue/APL-202/eng-br-id-10-organisational-federation>) |
| ENG-BR-DATA-01 — Shared question assembly | SAHA-020 | [Child issue APL-203](<https://linear.app/aplyd-sandbox/issue/APL-203/eng-br-data-01-shared-question-assembly>) |
| ENG-BR-DATA-02 — Source and timing for every fact | SAHA-021 | [Child issue APL-204](<https://linear.app/aplyd-sandbox/issue/APL-204/eng-br-data-02-source-and-timing-for-every-fact>) |
| ENG-BR-DATA-03 — Speech extraction as a draft | SAHA-022 | [Child issue APL-205](<https://linear.app/aplyd-sandbox/issue/APL-205/eng-br-data-03-speech-extraction-as-a-draft>) |
| ENG-BR-DATA-04 — Freshness and relevance | SAHA-023 | [Child issue APL-206](<https://linear.app/aplyd-sandbox/issue/APL-206/eng-br-data-04-freshness-and-relevance>) |
| ENG-BR-DATA-05 — Validation without fabrication | SAHA-024 | [Child issue APL-207](<https://linear.app/aplyd-sandbox/issue/APL-207/eng-br-data-05-validation-without-fabrication>) |
| ENG-BR-DATA-06 — Traceable amendments | SAHA-025 | [Child issue APL-208](<https://linear.app/aplyd-sandbox/issue/APL-208/eng-br-data-06-traceable-amendments>) |
| ENG-BR-DATA-07 — Concurrent edits | SAHA-026 | [Child issue APL-209](<https://linear.app/aplyd-sandbox/issue/APL-209/eng-br-data-07-concurrent-edits>) |
| ENG-BR-DATA-08 — Documents and media | SAHA-027 | [Child issue APL-210](<https://linear.app/aplyd-sandbox/issue/APL-210/eng-br-data-08-documents-and-media>) |
| ENG-BR-DATA-09 — Authoritative field mapping | SAHA-028 | [Child issue APL-211](<https://linear.app/aplyd-sandbox/issue/APL-211/eng-br-data-09-authoritative-field-mapping>) |
| ENG-BR-DATA-10 — Selective permitted reuse | SAHA-029 | [Child issue APL-212](<https://linear.app/aplyd-sandbox/issue/APL-212/eng-br-data-10-selective-permitted-reuse>) |
| ENG-BR-DATA-11 — Controlled migration | SAHA-030 | [Child issue APL-213](<https://linear.app/aplyd-sandbox/issue/APL-213/eng-br-data-11-controlled-migration>) |
| ENG-BR-DATA-12 — Measurement of actual reuse | SAHA-031 | [Child issue APL-214](<https://linear.app/aplyd-sandbox/issue/APL-214/eng-br-data-12-measurement-of-actual-reuse>) |
| ENG-BR-PROG-01 — Versioned programme packs | SAHA-032 | [Child issue APL-215](<https://linear.app/aplyd-sandbox/issue/APL-215/eng-br-prog-01-versioned-programme-packs>) |
| ENG-BR-PROG-02 — Maternal health workflow | SAHA-033 | [Child issue APL-216](<https://linear.app/aplyd-sandbox/issue/APL-216/eng-br-prog-02-maternal-health-workflow>) |
| ENG-BR-PROG-03 — TB screening workflow | SAHA-034 | [Child issue APL-217](<https://linear.app/aplyd-sandbox/issue/APL-217/eng-br-prog-03-tb-screening-workflow>) |
| ENG-BR-PROG-04 — Hypertension follow-up workflow | SAHA-035 | [Child issue APL-218](<https://linear.app/aplyd-sandbox/issue/APL-218/eng-br-prog-04-hypertension-follow-up-workflow>) |
| ENG-BR-PROG-05 — Cross-programme scheduling | SAHA-036 | [Child issue APL-219](<https://linear.app/aplyd-sandbox/issue/APL-219/eng-br-prog-05-cross-programme-scheduling>) |
| ENG-BR-PROG-06 — Eligibility and enrolment distinction | SAHA-037 | [Child issue APL-220](<https://linear.app/aplyd-sandbox/issue/APL-220/eng-br-prog-06-eligibility-and-enrolment-distinction>) |
| ENG-BR-PROG-07 — Protocol change and case continuity | SAHA-038 | [Child issue APL-221](<https://linear.app/aplyd-sandbox/issue/APL-221/eng-br-prog-07-protocol-change-and-case-continuity>) |
| ENG-BR-PROG-08 — Additional programme packs | SAHA-039 | [Child issue APL-222](<https://linear.app/aplyd-sandbox/issue/APL-222/eng-br-prog-08-additional-programme-packs>) |
| ENG-BR-AG-01 — Bounded task planning | SAHA-040 | [Child issue APL-223](<https://linear.app/aplyd-sandbox/issue/APL-223/eng-br-ag-01-bounded-task-planning>) |
| ENG-BR-AG-02 — Context restricted to the task | SAHA-041 | [Child issue APL-224](<https://linear.app/aplyd-sandbox/issue/APL-224/eng-br-ag-02-context-restricted-to-the-task>) |
| ENG-BR-AG-03 — Eligibility before tool selection | SAHA-042 | [Child issue APL-225](<https://linear.app/aplyd-sandbox/issue/APL-225/eng-br-ag-03-eligibility-before-tool-selection>) |
| ENG-BR-AG-04 — Approved execution paths | SAHA-043 | [Child issue APL-226](<https://linear.app/aplyd-sandbox/issue/APL-226/eng-br-ag-04-approved-execution-paths>) |
| ENG-BR-AG-05 — Human authority at action boundaries | SAHA-044 | [Child issue APL-227](<https://linear.app/aplyd-sandbox/issue/APL-227/eng-br-ag-05-human-authority-at-action-boundaries>) |
| ENG-BR-AG-06 — Durable progress and recovery | SAHA-045 | [Child issue APL-228](<https://linear.app/aplyd-sandbox/issue/APL-228/eng-br-ag-06-durable-progress-and-recovery>) |
| ENG-BR-AG-07 — Limits and cancellation | SAHA-046 | [Child issue APL-229](<https://linear.app/aplyd-sandbox/issue/APL-229/eng-br-ag-07-limits-and-cancellation>) |
| ENG-BR-AG-08 — Conflicting outputs | SAHA-047 | [Child issue APL-230](<https://linear.app/aplyd-sandbox/issue/APL-230/eng-br-ag-08-conflicting-outputs>) |
| ENG-BR-AG-09 — Evidence behind explanations | SAHA-048 | [Child issue APL-231](<https://linear.app/aplyd-sandbox/issue/APL-231/eng-br-ag-09-evidence-behind-explanations>) |
| ENG-BR-AG-10 — Clinical workflow continuity without an LLM | SAHA-049 | [Child issue APL-232](<https://linear.app/aplyd-sandbox/issue/APL-232/eng-br-ag-10-clinical-workflow-continuity-without-an-llm>) |
| ENG-BR-AG-11 — Programme manager analysis | SAHA-050 | [Child issue APL-233](<https://linear.app/aplyd-sandbox/issue/APL-233/eng-br-ag-11-programme-manager-analysis>) |
| ENG-BR-AG-12 — Change control for the agent | SAHA-051 | [Child issue APL-234](<https://linear.app/aplyd-sandbox/issue/APL-234/eng-br-ag-12-change-control-for-the-agent>) |
| ENG-BR-AI-01 — Capability registration | SAHA-052 | [Child issue APL-235](<https://linear.app/aplyd-sandbox/issue/APL-235/eng-br-ai-01-capability-registration>) |
| ENG-BR-AI-02 — Intended use and excluded use | SAHA-053 | [Child issue APL-236](<https://linear.app/aplyd-sandbox/issue/APL-236/eng-br-ai-02-intended-use-and-excluded-use>) |
| ENG-BR-AI-03 — Evidence and deployment authorisation | SAHA-054 | [Child issue APL-237](<https://linear.app/aplyd-sandbox/issue/APL-237/eng-br-ai-03-evidence-and-deployment-authorisation>) |
| ENG-BR-AI-04 — Capability lifecycle | SAHA-055 | [Child issue APL-238](<https://linear.app/aplyd-sandbox/issue/APL-238/eng-br-ai-04-capability-lifecycle>) |
| ENG-BR-AI-05 — Contract validation | SAHA-056 | [Child issue APL-239](<https://linear.app/aplyd-sandbox/issue/APL-239/eng-br-ai-05-contract-validation>) |
| ENG-BR-AI-06 — Input quality and inability to assess | SAHA-057 | [Child issue APL-240](<https://linear.app/aplyd-sandbox/issue/APL-240/eng-br-ai-06-input-quality-and-inability-to-assess>) |
| ENG-BR-AI-07 — Version pinning | SAHA-058 | [Child issue APL-241](<https://linear.app/aplyd-sandbox/issue/APL-241/eng-br-ai-07-version-pinning>) |
| ENG-BR-AI-08 — Least-data provider invocation | SAHA-059 | [Child issue APL-242](<https://linear.app/aplyd-sandbox/issue/APL-242/eng-br-ai-08-least-data-provider-invocation>) |
| ENG-BR-AI-09 — Multi-provider result history | SAHA-060 | [Child issue APL-243](<https://linear.app/aplyd-sandbox/issue/APL-243/eng-br-ai-09-multi-provider-result-history>) |
| ENG-BR-AI-10 — Monitoring and safety suspension | SAHA-061 | [Child issue APL-244](<https://linear.app/aplyd-sandbox/issue/APL-244/eng-br-ai-10-monitoring-and-safety-suspension>) |
| ENG-BR-AI-11 — Provider self-service in a controlled environment | SAHA-062 | [Child issue APL-245](<https://linear.app/aplyd-sandbox/issue/APL-245/eng-br-ai-11-provider-self-service-in-a-controlled-environment>) |
| ENG-BR-AI-12 — Cost and contractual limits | SAHA-063 | [Child issue APL-246](<https://linear.app/aplyd-sandbox/issue/APL-246/eng-br-ai-12-cost-and-contractual-limits>) |
| ENG-BR-CLIN-01 — Approved source library | SAHA-064 | [Child issue APL-247](<https://linear.app/aplyd-sandbox/issue/APL-247/eng-br-clin-01-approved-source-library>) |
| ENG-BR-CLIN-02 — Controlled clinical logic | SAHA-065 | [Child issue APL-248](<https://linear.app/aplyd-sandbox/issue/APL-248/eng-br-clin-02-controlled-clinical-logic>) |
| ENG-BR-CLIN-03 — Escalation without model dependence | SAHA-066 | [Child issue APL-249](<https://linear.app/aplyd-sandbox/issue/APL-249/eng-br-clin-03-escalation-without-model-dependence>) |
| ENG-BR-CLIN-04 — Scope of practice | SAHA-067 | [Child issue APL-250](<https://linear.app/aplyd-sandbox/issue/APL-250/eng-br-clin-04-scope-of-practice>) |
| ENG-BR-CLIN-05 — Review and override | SAHA-068 | [Child issue APL-251](<https://linear.app/aplyd-sandbox/issue/APL-251/eng-br-clin-05-review-and-override>) |
| ENG-BR-CLIN-06 — Model-specific quality requirements | SAHA-069 | [Child issue APL-252](<https://linear.app/aplyd-sandbox/issue/APL-252/eng-br-clin-06-model-specific-quality-requirements>) |
| ENG-BR-CLIN-07 — Composition safety | SAHA-070 | [Child issue APL-253](<https://linear.app/aplyd-sandbox/issue/APL-253/eng-br-clin-07-composition-safety>) |
| ENG-BR-CLIN-08 — Harm reporting and review | SAHA-071 | [Child issue APL-254](<https://linear.app/aplyd-sandbox/issue/APL-254/eng-br-clin-08-harm-reporting-and-review>) |
| ENG-BR-INT-01 — Integration readiness contract | SAHA-072 | [Child issue APL-255](<https://linear.app/aplyd-sandbox/issue/APL-255/eng-br-int-01-integration-readiness-contract>) |
| ENG-BR-INT-02 — Independent read and write permissions | SAHA-073 | [Child issue APL-256](<https://linear.app/aplyd-sandbox/issue/APL-256/eng-br-int-02-independent-read-and-write-permissions>) |
| ENG-BR-INT-03 — Confirmed submission receipts | SAHA-074 | [Child issue APL-257](<https://linear.app/aplyd-sandbox/issue/APL-257/eng-br-int-03-confirmed-submission-receipts>) |
| ENG-BR-INT-04 — Duplicate prevention and uncertain outcomes | SAHA-075 | [Child issue APL-258](<https://linear.app/aplyd-sandbox/issue/APL-258/eng-br-int-04-duplicate-prevention-and-uncertain-outcomes>) |
| ENG-BR-INT-05 — Partial completion across systems | SAHA-076 | [Child issue APL-259](<https://linear.app/aplyd-sandbox/issue/APL-259/eng-br-int-05-partial-completion-across-systems>) |
| ENG-BR-INT-06 — Inbound changes and reconciliation | SAHA-077 | [Child issue APL-260](<https://linear.app/aplyd-sandbox/issue/APL-260/eng-br-int-06-inbound-changes-and-reconciliation>) |
| ENG-BR-INT-07 — Schema and mapping change control | SAHA-078 | [Child issue APL-261](<https://linear.app/aplyd-sandbox/issue/APL-261/eng-br-int-07-schema-and-mapping-change-control>) |
| ENG-BR-INT-08 — Limited integration alternatives | SAHA-079 | [Child issue APL-262](<https://linear.app/aplyd-sandbox/issue/APL-262/eng-br-int-08-limited-integration-alternatives>) |
| ENG-BR-INT-09 — Per-destination data minimisation | SAHA-080 | [Child issue APL-263](<https://linear.app/aplyd-sandbox/issue/APL-263/eng-br-int-09-per-destination-data-minimisation>) |
| ENG-BR-INT-10 — Standards-based exchange | SAHA-081 | [Child issue APL-264](<https://linear.app/aplyd-sandbox/issue/APL-264/eng-br-int-10-standards-based-exchange>) |
| ENG-BR-INT-11 — Canonical exchange representation | SAHA-082 | [Child issue APL-265](<https://linear.app/aplyd-sandbox/issue/APL-265/eng-br-int-11-canonical-exchange-representation>) |
| ENG-BR-INT-12 — Source and destination provenance | SAHA-021 | [Child issue APL-266](<https://linear.app/aplyd-sandbox/issue/APL-266/eng-br-int-12-source-and-destination-provenance>) |
| ENG-BR-INT-13 — ABDM participation scope | SAHA-083 | [Child issue APL-267](<https://linear.app/aplyd-sandbox/issue/APL-267/eng-br-int-13-abdm-participation-scope>) |
| ENG-BR-INT-14 — ABHA identity and record linking | SAHA-084 | [Child issue APL-268](<https://linear.app/aplyd-sandbox/issue/APL-268/eng-br-int-14-abha-identity-and-record-linking>) |
| ENG-BR-INT-15 — ABDM consent enforcement | SAHA-085 | [Child issue APL-269](<https://linear.app/aplyd-sandbox/issue/APL-269/eng-br-int-15-abdm-consent-enforcement>) |
| ENG-BR-INT-16 — Facility and professional attribution | SAHA-086 | [Child issue APL-270](<https://linear.app/aplyd-sandbox/issue/APL-270/eng-br-int-16-facility-and-professional-attribution>) |
| ENG-BR-INT-17 — ABDM FHIR conformance and version control | SAHA-081 | [Child issue APL-271](<https://linear.app/aplyd-sandbox/issue/APL-271/eng-br-int-17-abdm-fhir-conformance-and-version-control>) |
| ENG-BR-INT-18 — Health Information Provider operation | SAHA-087 | [Child issue APL-272](<https://linear.app/aplyd-sandbox/issue/APL-272/eng-br-int-18-health-information-provider-operation>) |
| ENG-BR-INT-19 — Health Information User operation | SAHA-088 | [Child issue APL-273](<https://linear.app/aplyd-sandbox/issue/APL-273/eng-br-int-19-health-information-user-operation>) |
| ENG-BR-INT-20 — EHR connector capability profile | SAHA-072 | [Child issue APL-274](<https://linear.app/aplyd-sandbox/issue/APL-274/eng-br-int-20-ehr-connector-capability-profile>) |
| ENG-BR-INT-21 — EHR writeback and conflict handling | SAHA-089 | [Child issue APL-275](<https://linear.app/aplyd-sandbox/issue/APL-275/eng-br-int-21-ehr-writeback-and-conflict-handling>) |
| ENG-BR-INT-22 — Legacy and document exchange | SAHA-079 | [Child issue APL-724](<https://linear.app/aplyd-sandbox/issue/APL-724/eng-br-int-22-legacy-and-document-exchange>) |
| ENG-BR-INT-23 — Terminology and mapping governance | SAHA-028 | [Child issue APL-725](<https://linear.app/aplyd-sandbox/issue/APL-725/eng-br-int-23-terminology-and-mapping-governance>) |
| ENG-BR-INT-24 — Conformance and production claims | SAHA-090 | [Child issue APL-726](<https://linear.app/aplyd-sandbox/issue/APL-726/eng-br-int-24-conformance-and-production-claims>) |
| ENG-BR-OFF-01 — Defined offline capability | SAHA-091 | [Child issue APL-727](<https://linear.app/aplyd-sandbox/issue/APL-727/eng-br-off-01-defined-offline-capability>) |
| ENG-BR-OFF-02 — Durable local capture | SAHA-092 | [Child issue APL-728](<https://linear.app/aplyd-sandbox/issue/APL-728/eng-br-off-02-durable-local-capture>) |
| ENG-BR-OFF-03 — Controlled offline authority | SAHA-093 | [Child issue APL-729](<https://linear.app/aplyd-sandbox/issue/APL-729/eng-br-off-03-controlled-offline-authority>) |
| ENG-BR-OFF-04 — Pending media and AI work | SAHA-094 | [Child issue APL-730](<https://linear.app/aplyd-sandbox/issue/APL-730/eng-br-off-04-pending-media-and-ai-work>) |
| ENG-BR-OFF-05 — Safe synchronisation ordering | SAHA-095 | [Child issue APL-731](<https://linear.app/aplyd-sandbox/issue/APL-731/eng-br-off-05-safe-synchronisation-ordering>) |
| ENG-BR-OFF-06 — Revalidation of delayed actions | SAHA-096 | [Child issue APL-732](<https://linear.app/aplyd-sandbox/issue/APL-732/eng-br-off-06-revalidation-of-delayed-actions>) |
| ENG-BR-OFF-07 — Shared and lost devices | SAHA-097 | [Child issue APL-733](<https://linear.app/aplyd-sandbox/issue/APL-733/eng-br-off-07-shared-and-lost-devices>) |
| ENG-BR-OFF-08 — Offline workflow capacity | SAHA-098 | [Child issue APL-734](<https://linear.app/aplyd-sandbox/issue/APL-734/eng-br-off-08-offline-workflow-capacity>) |
| ENG-BR-CARE-01 — Action ownership | SAHA-099 | [Child issue APL-735](<https://linear.app/aplyd-sandbox/issue/APL-735/eng-br-care-01-action-ownership>) |
| ENG-BR-CARE-02 — Service directory | SAHA-100 | [Child issue APL-736](<https://linear.app/aplyd-sandbox/issue/APL-736/eng-br-care-02-service-directory>) |
| ENG-BR-CARE-03 — Referral lifecycle | SAHA-101 | [Child issue APL-737](<https://linear.app/aplyd-sandbox/issue/APL-737/eng-br-care-03-referral-lifecycle>) |
| ENG-BR-CARE-04 — Due work and escalation | SAHA-102 | [Child issue APL-738](<https://linear.app/aplyd-sandbox/issue/APL-738/eng-br-care-04-due-work-and-escalation>) |
| ENG-BR-CARE-05 — Unified action plan | SAHA-103 | [Child issue APL-739](<https://linear.app/aplyd-sandbox/issue/APL-739/eng-br-care-05-unified-action-plan>) |
| ENG-BR-CARE-06 — Safe communication preferences | SAHA-104 | [Child issue APL-740](<https://linear.app/aplyd-sandbox/issue/APL-740/eng-br-care-06-safe-communication-preferences>) |
| ENG-BR-CARE-07 — External messaging and scheduling | SAHA-105 | [Child issue APL-741](<https://linear.app/aplyd-sandbox/issue/APL-741/eng-br-care-07-external-messaging-and-scheduling>) |
| ENG-BR-CARE-08 — Worker activity evidence | SAHA-106 | [Child issue APL-742](<https://linear.app/aplyd-sandbox/issue/APL-742/eng-br-care-08-worker-activity-evidence>) |
| ENG-BR-REP-01 — Operational exception queues | SAHA-107 | [Child issue APL-743](<https://linear.app/aplyd-sandbox/issue/APL-743/eng-br-rep-01-operational-exception-queues>) |
| ENG-BR-REP-02 — Governed indicator definitions | SAHA-108 | [Child issue APL-744](<https://linear.app/aplyd-sandbox/issue/APL-744/eng-br-rep-02-governed-indicator-definitions>) |
| ENG-BR-REP-03 — Data freshness and completeness | SAHA-109 | [Child issue APL-745](<https://linear.app/aplyd-sandbox/issue/APL-745/eng-br-rep-03-data-freshness-and-completeness>) |
| ENG-BR-REP-04 — Privacy-preserving aggregation | SAHA-110 | [Child issue APL-746](<https://linear.app/aplyd-sandbox/issue/APL-746/eng-br-rep-04-privacy-preserving-aggregation>) |
| ENG-BR-REP-05 — Reconciled exports | SAHA-111 | [Child issue APL-747](<https://linear.app/aplyd-sandbox/issue/APL-747/eng-br-rep-05-reconciled-exports>) |
| ENG-BR-REP-06 — Population prioritisation | SAHA-112 | [Child issue APL-748](<https://linear.app/aplyd-sandbox/issue/APL-748/eng-br-rep-06-population-prioritisation>) |
| ENG-BR-REP-07 — Product performance metrics | SAHA-113 | [Child issue APL-749](<https://linear.app/aplyd-sandbox/issue/APL-749/eng-br-rep-07-product-performance-metrics>) |
| ENG-BR-OPS-01 — Deployment configuration | SAHA-114 | [Child issue APL-750](<https://linear.app/aplyd-sandbox/issue/APL-750/eng-br-ops-01-deployment-configuration>) |
| ENG-BR-OPS-02 — Separation of environments | SAHA-115 | [Child issue APL-751](<https://linear.app/aplyd-sandbox/issue/APL-751/eng-br-ops-02-separation-of-environments>) |
| ENG-BR-OPS-03 — Controlled publishing and rollback | SAHA-116 | [Child issue APL-752](<https://linear.app/aplyd-sandbox/issue/APL-752/eng-br-ops-03-controlled-publishing-and-rollback>) |
| ENG-BR-OPS-04 — Operational monitoring | SAHA-117 | [Child issue APL-753](<https://linear.app/aplyd-sandbox/issue/APL-753/eng-br-ops-04-operational-monitoring>) |
| ENG-BR-OPS-05 — Support without unnecessary disclosure | SAHA-118 | [Child issue APL-754](<https://linear.app/aplyd-sandbox/issue/APL-754/eng-br-ops-05-support-without-unnecessary-disclosure>) |
| ENG-BR-OPS-06 — Training and competency | SAHA-119 | [Child issue APL-755](<https://linear.app/aplyd-sandbox/issue/APL-755/eng-br-ops-06-training-and-competency>) |
| ENG-BR-OPS-07 — Data exit and continuity | SAHA-120 | [Child issue APL-756](<https://linear.app/aplyd-sandbox/issue/APL-756/eng-br-ops-07-data-exit-and-continuity>) |
| ENG-BR-OPS-08 — Repeatable deployment packaging | SAHA-121 | [Child issue APL-757](<https://linear.app/aplyd-sandbox/issue/APL-757/eng-br-ops-08-repeatable-deployment-packaging>) |
| ENG-BR-SEC-01 — Purpose and lawful authority | SAHA-122 | [Child issue APL-758](<https://linear.app/aplyd-sandbox/issue/APL-758/eng-br-sec-01-purpose-and-lawful-authority>) |
| ENG-BR-SEC-02 — Understandable notice and consent | SAHA-123 | [Child issue APL-759](<https://linear.app/aplyd-sandbox/issue/APL-759/eng-br-sec-02-understandable-notice-and-consent>) |
| ENG-BR-SEC-03 — Withdrawal and downstream effects | SAHA-124 | [Child issue APL-760](<https://linear.app/aplyd-sandbox/issue/APL-760/eng-br-sec-03-withdrawal-and-downstream-effects>) |
| ENG-BR-SEC-04 — Sensitive data and proxy handling | SAHA-125 | [Child issue APL-761](<https://linear.app/aplyd-sandbox/issue/APL-761/eng-br-sec-04-sensitive-data-and-proxy-handling>) |
| ENG-BR-SEC-05 — Encryption and secrets | SAHA-126 | [Child issue APL-762](<https://linear.app/aplyd-sandbox/issue/APL-762/eng-br-sec-05-encryption-and-secrets>) |
| ENG-BR-SEC-06 — Tenant and record isolation | SAHA-127 | [Child issue APL-763](<https://linear.app/aplyd-sandbox/issue/APL-763/eng-br-sec-06-tenant-and-record-isolation>) |
| ENG-BR-SEC-07 — Safe logs and analytics | SAHA-128 | [Child issue APL-764](<https://linear.app/aplyd-sandbox/issue/APL-764/eng-br-sec-07-safe-logs-and-analytics>) |
| ENG-BR-SEC-08 — Audit evidence | SAHA-129 | [Child issue APL-765](<https://linear.app/aplyd-sandbox/issue/APL-765/eng-br-sec-08-audit-evidence>) |
| ENG-BR-SEC-09 — Controlled retention and disposal | SAHA-130 | [Child issue APL-766](<https://linear.app/aplyd-sandbox/issue/APL-766/eng-br-sec-09-controlled-retention-and-disposal>) |
| ENG-BR-SEC-10 — Rights and correction workflow | SAHA-131 | [Child issue APL-767](<https://linear.app/aplyd-sandbox/issue/APL-767/eng-br-sec-10-rights-and-correction-workflow>) |
| ENG-BR-SEC-11 — Emergency and support access | SAHA-132 | [Child issue APL-768](<https://linear.app/aplyd-sandbox/issue/APL-768/eng-br-sec-11-emergency-and-support-access>) |
| ENG-BR-SEC-12 — Provider and supply-chain assurance | SAHA-133 | [Child issue APL-769](<https://linear.app/aplyd-sandbox/issue/APL-769/eng-br-sec-12-provider-and-supply-chain-assurance>) |
| ENG-BR-SEC-13 — Incident response | SAHA-134 | [Child issue APL-770](<https://linear.app/aplyd-sandbox/issue/APL-770/eng-br-sec-13-incident-response>) |
| ENG-BR-SEC-14 — Hosting and cross-border controls | SAHA-135 | [Child issue APL-771](<https://linear.app/aplyd-sandbox/issue/APL-771/eng-br-sec-14-hosting-and-cross-border-controls>) |
| ENG-BR-RULE-01 — No invented facts | SAHA-024 | [Child issue APL-772](<https://linear.app/aplyd-sandbox/issue/APL-772/eng-br-rule-01-no-invented-facts>) |
| ENG-BR-RULE-02 — Patient confirmation before commitment | SAHA-136 | [Child issue APL-773](<https://linear.app/aplyd-sandbox/issue/APL-773/eng-br-rule-02-patient-confirmation-before-commitment>) |
| ENG-BR-RULE-03 — Review depends on unchanged evidence | SAHA-044 | [Child issue APL-774](<https://linear.app/aplyd-sandbox/issue/APL-774/eng-br-rule-03-review-depends-on-unchanged-evidence>) |
| ENG-BR-RULE-04 — Honest completion and cancellation | SAHA-006 | [Child issue APL-775](<https://linear.app/aplyd-sandbox/issue/APL-775/eng-br-rule-04-honest-completion-and-cancellation>) |
| ENG-BR-RULE-05 — No false model equivalence | SAHA-047 | [Child issue APL-776](<https://linear.app/aplyd-sandbox/issue/APL-776/eng-br-rule-05-no-false-model-equivalence>) |
| ENG-BR-RULE-06 — Rechecks at execution time | SAHA-096 | [Child issue APL-777](<https://linear.app/aplyd-sandbox/issue/APL-777/eng-br-rule-06-rechecks-at-execution-time>) |
| ENG-BR-RULE-07 — No experimental output in care | SAHA-055 | [Child issue APL-778](<https://linear.app/aplyd-sandbox/issue/APL-778/eng-br-rule-07-no-experimental-output-in-care>) |
| ENG-BR-RULE-08 — No silent adverse allocation | SAHA-137 | [Child issue APL-779](<https://linear.app/aplyd-sandbox/issue/APL-779/eng-br-rule-08-no-silent-adverse-allocation>) |
| ENG-NFR-01 — Core availability | SAHA-138 | [Child issue APL-780](<https://linear.app/aplyd-sandbox/issue/APL-780/eng-nfr-01-core-availability>) |
| ENG-NFR-02 — Responsive field interface | SAHA-139 | [Child issue APL-781](<https://linear.app/aplyd-sandbox/issue/APL-781/eng-nfr-02-responsive-field-interface>) |
| ENG-NFR-03 — Visible AI progress | SAHA-140 | [Child issue APL-782](<https://linear.app/aplyd-sandbox/issue/APL-782/eng-nfr-03-visible-ai-progress>) |
| ENG-NFR-04 — No loss of acknowledged local work | SAHA-092 | [Child issue APL-783](<https://linear.app/aplyd-sandbox/issue/APL-783/eng-nfr-04-no-loss-of-acknowledged-local-work>) |
| ENG-NFR-05 — Duplicate-safe execution | SAHA-075 | [Child issue APL-784](<https://linear.app/aplyd-sandbox/issue/APL-784/eng-nfr-05-duplicate-safe-execution>) |
| ENG-NFR-06 — Server recovery | SAHA-141 | [Child issue APL-785](<https://linear.app/aplyd-sandbox/issue/APL-785/eng-nfr-06-server-recovery>) |
| ENG-NFR-07 — Data integrity | SAHA-142 | [Child issue APL-786](<https://linear.app/aplyd-sandbox/issue/APL-786/eng-nfr-07-data-integrity>) |
| ENG-NFR-08 — Security release posture | SAHA-143 | [Child issue APL-787](<https://linear.app/aplyd-sandbox/issue/APL-787/eng-nfr-08-security-release-posture>) |
| ENG-NFR-09 — Online revocation | SAHA-010 | [Child issue APL-788](<https://linear.app/aplyd-sandbox/issue/APL-788/eng-nfr-09-online-revocation>) |
| ENG-NFR-10 — Audit completeness and timing | SAHA-129 | [Child issue APL-789](<https://linear.app/aplyd-sandbox/issue/APL-789/eng-nfr-10-audit-completeness-and-timing>) |
| ENG-NFR-11 — Offline capacity and controlled storage | SAHA-098 | [Child issue APL-790](<https://linear.app/aplyd-sandbox/issue/APL-790/eng-nfr-11-offline-capacity-and-controlled-storage>) |
| ENG-NFR-12 — Synchronisation recovery | SAHA-095 | [Child issue APL-791](<https://linear.app/aplyd-sandbox/issue/APL-791/eng-nfr-12-synchronisation-recovery>) |
| ENG-NFR-13 — Accessibility | SAHA-144 | [Child issue APL-792](<https://linear.app/aplyd-sandbox/issue/APL-792/eng-nfr-13-accessibility>) |
| ENG-NFR-14 — Usability and training burden | SAHA-145 | [Child issue APL-793](<https://linear.app/aplyd-sandbox/issue/APL-793/eng-nfr-14-usability-and-training-burden>) |
| ENG-NFR-15 — Language quality | SAHA-005 | [Child issue APL-794](<https://linear.app/aplyd-sandbox/issue/APL-794/eng-nfr-15-language-quality>) |
| ENG-NFR-16 — AI extraction quality | SAHA-022 | [Child issue APL-795](<https://linear.app/aplyd-sandbox/issue/APL-795/eng-nfr-16-ai-extraction-quality>) |
| ENG-NFR-17 — Clinical and agent safety evaluation | SAHA-146 | [Child issue APL-796](<https://linear.app/aplyd-sandbox/issue/APL-796/eng-nfr-17-clinical-and-agent-safety-evaluation>) |
| ENG-NFR-18 — Operational observability | SAHA-117 | [Child issue APL-797](<https://linear.app/aplyd-sandbox/issue/APL-797/eng-nfr-18-operational-observability>) |
| ENG-NFR-19 — Maintainable configuration | SAHA-116 | [Child issue APL-798](<https://linear.app/aplyd-sandbox/issue/APL-798/eng-nfr-19-maintainable-configuration>) |
| ENG-NFR-20 — Integration conformance | SAHA-147 | [Child issue APL-799](<https://linear.app/aplyd-sandbox/issue/APL-799/eng-nfr-20-integration-conformance>) |
| ENG-NFR-21 — Cost transparency | SAHA-063 | [Child issue APL-800](<https://linear.app/aplyd-sandbox/issue/APL-800/eng-nfr-21-cost-transparency>) |
| ENG-NFR-22 — Data portability and export integrity | SAHA-120 | [Child issue APL-801](<https://linear.app/aplyd-sandbox/issue/APL-801/eng-nfr-22-data-portability-and-export-integrity>) |
| ENG-NFR-23 — Disaster and downtime readiness | SAHA-148 | [Child issue APL-802](<https://linear.app/aplyd-sandbox/issue/APL-802/eng-nfr-23-disaster-and-downtime-readiness>) |
| ENG-NFR-24 — Scale readiness | SAHA-149 | [Child issue APL-803](<https://linear.app/aplyd-sandbox/issue/APL-803/eng-nfr-24-scale-readiness>) |
| ENG-NFR-25 — Clinical exchange validation | SAHA-081 | [Child issue APL-804](<https://linear.app/aplyd-sandbox/issue/APL-804/eng-nfr-25-clinical-exchange-validation>) |
| ENG-NFR-26 — Consent and exchange traceability | SAHA-129 | [Child issue APL-805](<https://linear.app/aplyd-sandbox/issue/APL-805/eng-nfr-26-consent-and-exchange-traceability>) |
| ENG-NFR-27 — Connector upgrade compatibility | SAHA-078 | [Child issue APL-806](<https://linear.app/aplyd-sandbox/issue/APL-806/eng-nfr-27-connector-upgrade-compatibility>) |
| ENG-NFR-28 — Interoperability performance | SAHA-150 | [Child issue APL-807](<https://linear.app/aplyd-sandbox/issue/APL-807/eng-nfr-28-interoperability-performance>) |
| ENG-SAHA-151 — Qualify \[SAHA-151\] Establish a reproducible reuse baseline | SAHA-151 | [Child issue APL-808](<https://linear.app/aplyd-sandbox/issue/APL-808/eng-saha-151-qualify-saha-151-establish-a-reproducible-reuse-baseline>) |
| ENG-SAHA-152 — Qualify \[SAHA-152\] Identify and safely promote the synthetic DigitalOcean release | SAHA-152 | [Child issue APL-809](<https://linear.app/aplyd-sandbox/issue/APL-809/eng-saha-152-qualify-saha-152-identify-and-safely-promote-the>) |
| ENG-SAHA-153 — Qualify \[SAHA-153\] Qualify phone memory and battery endurance | SAHA-153 | [Child issue APL-810](<https://linear.app/aplyd-sandbox/issue/APL-810/eng-saha-153-qualify-saha-153-qualify-phone-memory-and-battery>) |
| ENG-SAHA-154 — Qualify \[SAHA-154\] Add an optional paid assignment within routine work | SAHA-154 | [Child issue APL-811](<https://linear.app/aplyd-sandbox/issue/APL-811/eng-saha-154-qualify-saha-154-add-an-optional-paid-assignment-within>) |
| ENG-SAHA-155 — Qualify \[SAHA-155\] Bring contextual Aplyd Academy learning into the task | SAHA-155 | [Child issue APL-812](<https://linear.app/aplyd-sandbox/issue/APL-812/eng-saha-155-qualify-saha-155-bring-contextual-aplyd-academy-learning>) |
| ENG-SAHA-156 — Qualify \[SAHA-156\] Discover optional help at the point of need | SAHA-156 | [Child issue APL-813](<https://linear.app/aplyd-sandbox/issue/APL-813/eng-saha-156-qualify-saha-156-discover-optional-help-at-the-point-of>) |
| ENG-SAHA-157 — Qualify \[SAHA-157\] Prove a production-capable DigitalOcean runtime and storage choice | SAHA-157 | [Child issue APL-814](<https://linear.app/aplyd-sandbox/issue/APL-814/eng-saha-157-qualify-saha-157-prove-a-production-capable-digitalocean>) |
| ENG-SAHA-158 — Qualify \[SAHA-158\] Capture purpose-limited event geotags with a no-GPS path | SAHA-158 | [Child issue APL-815](<https://linear.app/aplyd-sandbox/issue/APL-815/eng-saha-158-qualify-saha-158-capture-purpose-limited-event-geotags>) |
| ENG-SAHA-159 — Qualify \[SAHA-159\] Offer worker-controlled route suggestions | SAHA-159 | [Child issue APL-816](<https://linear.app/aplyd-sandbox/issue/APL-816/eng-saha-159-qualify-saha-159-offer-worker-controlled-route>) |
| ENG-SAHA-160 — Qualify \[SAHA-160\] Qualify the unmerged schedule-rule candidate | SAHA-160 | [Child issue APL-817](<https://linear.app/aplyd-sandbox/issue/APL-817/eng-saha-160-qualify-saha-160-qualify-the-unmerged-schedule-rule>) |
| D03-T01 — Bounded current-identity API and exact-person audited commands | D03 | [Child issue APL-818](<https://linear.app/aplyd-sandbox/issue/APL-818/d03-t01-bounded-current-identity-api-and-exact-person-audited-commands>) |
| D03-T02 — Guided routine UI and truthful save/recovery states | D03 | [Child issue APL-819](<https://linear.app/aplyd-sandbox/issue/APL-819/d03-t02-guided-routine-ui-and-truthful-saverecovery-states>) |
| D03-T03 — Real synthetic backend/browser, authorization and NFR qualification | D03 | [Child issue APL-820](<https://linear.app/aplyd-sandbox/issue/APL-820/d03-t03-real-synthetic-backendbrowser-authorization-and-nfr>) |
| D03-T04 — Source/document integrity and isolated candidate publication | D03 | [Child issue APL-821](<https://linear.app/aplyd-sandbox/issue/APL-821/d03-t04-sourcedocument-integrity-and-isolated-candidate-publication>) |
| D03-T05 — Final-head CI and separate final diff/evidence review | D03 | [Child issue APL-822](<https://linear.app/aplyd-sandbox/issue/APL-822/d03-t05-final-head-ci-and-separate-final-diffevidence-review>) |
| D03-T06 — Qualified isolated release and observed live synthetic gate | D03 | [Child issue APL-823](<https://linear.app/aplyd-sandbox/issue/APL-823/d03-t06-qualified-isolated-release-and-observed-live-synthetic-gate>) |

## Task input and completion contract

Each engineering task keeps its source outcome, parent criterion and test references. The 176 original ENG tasks carry 352 requirement-specific A/B case references. The full source catalogue also contains 12 shared cross-journey cases, which can link to multiple affected product items; these are shared acceptance coverage, not extra tasks or multiple catalogue cases. Engineering completion evidence identifies the exact original cases and applicable shared journeys selected from the inspected change/impact, plus the actual source/configuration, results and limitations. A task's local tests or A/B result cannot automatically accept a shared journey, another task or its whole parent. Formal source acceptance remains 0/364. Before execution, identify the inspected existing component/API, exact intended change or qualification output, synthetic fixture, adverse paths and evidence needed to close only that task. Owner roles from the source are planning roles; named execution and estimates require actual assignment/inspection.

The eight ENG-SAHA-153–160 tasks depend on resolving their parent criteria-source gap: recover/reconcile the original CWO narrative or record a versioned reviewed product decision adopting explicitly proposed refinement criteria, then freeze a current-code contract. They remain Backlog; a draft test list is not approved acceptance or permission to activate a service, paid assignment, policy or runtime.

D03 qualification completion follows the declared sequence: T03 requires the T01 API and T02 UI outputs; T04 verifies source/document integrity and publication after qualification; T05 qualifies the exact published final head with CI and separate diff/evidence review; T06 requires that review and applicable native approvals before isolated merge and observed live synthetic verification. Preliminary inspection may run in parallel, but a later completion cannot substitute for its required output. D03 and all six child tasks retain the planning hold. Neither child closure nor this sequence accepts the full parent product item.

## Execution

[Planning hub](<https://linear.app/aplyd-sandbox/document/saha-full-product-planning-hub-and-operating-rules-a94ec8f76c24>) · [Story readiness](<https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7>) · [Full scope map](<https://linear.app/aplyd-sandbox/document/saha-full-scope-and-requirement-mapping-99faedfc92c7>).
GitHub188 owns single-story execution. D03 is the sole existing candidate, coding held for planning. A technical-task output never closes its full parent requirement; exact current-code checks/review/CI/native approvals and applicable observed-host evidence remain required.