# APL-22 — \[Epic WP10\] Operational measures

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-22](https://linear.app/aplyd-sandbox/issue/APL-22/epic-wp10-operational-measures)  
Stable UUID: `1432b0c2-ced5-4642-be67-fbee853dbbe6`  
Hierarchy kind: `epic`  
Native parent: No native parent (epic container)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T09:54:28.654Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `6da441b86fb2b5712c80f9686707014eb235526847d0ae1f7976400245d0449e`  
Source plus v4.2 refinement SHA-256: `7a98354618842c3edb59746869453ae2ad15232bd2c61faf91f304059f5f8dcb`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## Product outcome

Versioned report definitions, projections, privacy controls and exports

## Source and scope

Preserved engineering plan work package WP10; original release label: R1 and R2. This epic groups the full reconciled SAHA scope, not just D01–D08. Individual stories retain original requirement priorities/releases and acceptance text. Cross-package requirements keep related work-package references in their technical tasks.

## Dependencies

WP03 WP07 WP09. These are sequencing/design dependencies, not evidence that upstream scope is complete. No blanket all-epic dependency may dispatch work or erase the already-delivered D02 boundary.

## Ownership

Accountable source role: Data lead. No named executor/clinical approver or delivery date is invented.

## Completion gate

All applicable child scope requirements and original acceptance criteria are qualified on exact source/configuration, with prerequisite policy/partner/device approvals. Bounded delivery slices can pass while this epic remains open. Formal UAT and production acceptance remain separate.

## Execution hold

Coding held by sponsor pending full planning setup. GitHub #188 remains sole delivery controller; D03 is the sole existing candidate. Synthetic-only current work; no providers, paid services, new hosting, clinical policies or destructive migrations.

[Source engineering plan](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/08_Engineering-Implementation-Plan_v1.0.md>) · [reconciled scope](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>)

## Full planning links

Primary-owned scope count: 7; release groups: R1, R2. Epics span releases; canonical children retain their exact source milestone/criteria. Native related-epic links represent the source design dependency graph, not an assertion that whole upstream epics are complete.
[Planning hub](<https://linear.app/aplyd-sandbox/document/saha-full-product-planning-hub-and-operating-rules-a94ec8f76c24>) · [Roadmap/release goals](<https://linear.app/aplyd-sandbox/document/saha-roadmap-and-release-goals-b710e5c7276c>) · [Full scope mapping](<https://linear.app/aplyd-sandbox/document/saha-full-scope-and-requirement-mapping-99faedfc92c7>) · [Technical task register](<https://linear.app/aplyd-sandbox/document/saha-full-technical-task-register-ab4f929db6d4>).

## v4.2 planning refinement — source preserved

Author recommendation; the preserved work-package contract and child source acceptance remain authoritative. Do not weaken criteria to obtain a pass. This does not close or approve the epic.

### Discovery test and falsification

* Riskiest assumption: Governed reports are reproducible from permitted source events with truthful denominators and privacy-preserving aggregation.
* Population/context: Programme-manager, analyst and restricted-report archetypes in synthetic cohorts.
* Test: Recalculate pinned indicators/exports, disconnect one feed, change historical definition and attempt small-cohort reconstruction and hidden person-list retrieval.
* Falsification: Incorrect denominator, silent incomplete period, historical reinterpretation or suppressed-cohort/person disclosure falsifies the analytics approach.
* Decision: If falsified, hold the affected capability/slice, repair the boundary and repeat before further scope. If supported, qualify only the evidenced slice; full epic, formal UAT and live approval remain separate.

### Priority, sequence and forecast

Instrument the minimum outcome/quality events first; sequence population prioritisation after governance and source freshness are qualified.

Source dependency packages: WP03, WP07, WP09. Inspect current slice-specific controls rather than require whole upstream epics to be complete. Original child priority/release labels remain unchanged.

Recommended size: 14–35 gross engineering effort days across 7 canonical children, low confidence. Sum of owned-child forecast ranges before unknown shared-reuse savings; excludes external approval/recruitment/observation wait. Do not add child-task estimates to this total or treat it as calendar duration.

### Learning and exit evidence

Recommended formative window: the first two weeks after an authorised bounded release, then each material config change. Compare exact eligible opportunities/completions, avoidable re-entry, correction burden, denied unsafe actions, sync failures and support load with the declared release baseline and source targets. Until a representative observed run exists, retain results as unmeasured. Feed the evidence-backed continue/improve/narrow/hold recommendation into strategy/roadmap; no care/provider/production authority is conferred.

Use shared [SAHA-READY-1.0/SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7) for each bounded story/task; epic completion still requires all applicable unchanged child criteria and source/domain gates.