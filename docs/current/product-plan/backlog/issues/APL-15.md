# APL-15 — \[Epic WP03\] Encounter and shared data

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-15](https://linear.app/aplyd-sandbox/issue/APL-15/epic-wp03-encounter-and-shared-data)  
Stable UUID: `917f296b-e469-4033-babe-dce24e5510aa`  
Hierarchy kind: `epic`  
Native parent: Not returned in source snapshot; epic container  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T09:54:22.344Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `8fff36c374ef96b8b6d2df8c2253f8156cd64fe59823065a380fe581704a2c5c`  
Source plus v4.2 refinement SHA-256: `a3ea5e9c4b15fdf230fd6a55d28d14c5080cf65596e927626068047de84a5e9a`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## Product outcome

Local person and encounter model, draft capture, typed observations and revisions

## Source and scope

Preserved engineering plan work package WP03; original release label: R1. This epic groups the full reconciled SAHA scope, not just D01–D08. Individual stories retain original requirement priorities/releases and acceptance text. Cross-package requirements keep related work-package references in their technical tasks.

## Dependencies

WP01 WP02. These are sequencing/design dependencies, not evidence that upstream scope is complete. No blanket all-epic dependency may dispatch work or erase the already-delivered D02 boundary.

## Ownership

Accountable source role: Workflow lead. No named executor/clinical approver or delivery date is invented.

## Completion gate

All applicable child scope requirements and original acceptance criteria are qualified on exact source/configuration, with prerequisite policy/partner/device approvals. Bounded delivery slices can pass while this epic remains open. Formal UAT and production acceptance remain separate.

## Execution hold

Coding held by sponsor pending full planning setup. GitHub #188 remains sole delivery controller; D03 is the sole existing candidate. Synthetic-only current work; no providers, paid services, new hosting, clinical policies or destructive migrations.

[Source engineering plan](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/08_Engineering-Implementation-Plan_v1.0.md>) · [reconciled scope](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>)

## Full planning links

Primary-owned scope count: 21; release groups: R1, R2. Epics span releases; canonical children retain their exact source milestone/criteria. Native related-epic links represent the source design dependency graph, not an assertion that whole upstream epics are complete.
[Planning hub](<https://linear.app/aplyd-sandbox/document/saha-full-product-planning-hub-and-operating-rules-a94ec8f76c24>) · [Roadmap/release goals](<https://linear.app/aplyd-sandbox/document/saha-roadmap-and-release-goals-b710e5c7276c>) · [Full scope mapping](<https://linear.app/aplyd-sandbox/document/saha-full-scope-and-requirement-mapping-99faedfc92c7>) · [Technical task register](<https://linear.app/aplyd-sandbox/document/saha-full-technical-task-register-ab4f929db6d4>).

## v4.2 planning refinement — source preserved

Author recommendation; the preserved work-package contract and child source acceptance remain authoritative. Do not weaken criteria to obtain a pass. This does not close or approve the epic.

### Discovery test and falsification

* Riskiest assumption: A single bounded encounter preserves person context, missingness and distinct programme facts while reducing avoidable repeated entry.
* Population/context: Assigned ASHA archetype reviewing permitted synthetic routine encounters.
* Test: Run D03 frozen review/correct/save plus person switch, uncertainty, shared/distinct questions and dropped acknowledgement; compare source facts, UI and stored receipts.
* Falsification: Wrong-person association, fabricated fact, collapsed distinct question, lost acknowledged value or duplicate committed save falsifies the design.
* Decision: If falsified, hold the affected capability/slice, repair the boundary and repeat before further scope. If supported, qualify only the evidenced slice; full epic, formal UAT and live approval remain separate.

### Priority, sequence and forecast

Resume the preserved D03 candidate after its predecessor gate and planning handoff; measure reuse after correctness, rather than starting another monolithic journey.

Source dependency packages: WP01, WP02. Inspect current slice-specific controls rather than require whole upstream epics to be complete. Original child priority/release labels remain unchanged.

Recommended size: 54–129 gross engineering effort days across 21 canonical children, low confidence. Sum of owned-child forecast ranges before unknown shared-reuse savings; excludes external approval/recruitment/observation wait. Do not add child-task estimates to this total or treat it as calendar duration.

### Learning and exit evidence

Recommended formative window: the first two weeks after an authorised bounded release, then each material config change. Compare exact eligible opportunities/completions, avoidable re-entry, correction burden, denied unsafe actions, sync failures and support load with the declared release baseline and source targets. Until a representative observed run exists, retain results as unmeasured. Feed the evidence-backed continue/improve/narrow/hold recommendation into strategy/roadmap; no care/provider/production authority is conferred.

Use shared [SAHA-READY-1.0/SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7) for each bounded story/task; epic completion still requires all applicable unchanged child criteria and source/domain gates.