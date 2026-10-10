# APL-19 — \[Epic WP07\] External exchange

[Backlog index](../README.md) · [Current product plan](../../START-HERE.md)

Canonical record: [APL-19](https://linear.app/aplyd-sandbox/issue/APL-19/epic-wp07-external-exchange)  
Stable UUID: `97a15577-72c1-44e3-a375-4752ae13e19a`  
Hierarchy kind: `epic`  
Native parent: No native parent (epic container)  
Native blockers: None recorded in source snapshot  
Recorded native status: **Backlog** at source revision `2026-10-10T09:54:28.637Z`; this documentation snapshot does not change native state.  
Original description SHA-256: `90bcdfe8f9c720ba077a9255723e87a08ac61ed652151cb1c7bb61c4a06dc1ea`  
Source plus v4.2 refinement SHA-256: `8e9acead1bb4d467662d3643a5fdba7f277d810e0508d88db24c3b92fc839b66`

The body below retains the entire original description followed by the final reviewed planning refinement. Original acceptance, source targets and frozen specifications retain their authority; added assumptions, scenarios and forecasts retain their proposed status. Protected native metadata is stored in the sanitized records; creator/profile/contact data is omitted.

<!-- Exact original-description + final-append body begins after this line. -->
## Product outcome

MIS and EHR adapters, ABDM role paths, receipts and reconciliation

## Source and scope

Preserved engineering plan work package WP07; original release label: R1. This epic groups the full reconciled SAHA scope, not just D01–D08. Individual stories retain original requirement priorities/releases and acceptance text. Cross-package requirements keep related work-package references in their technical tasks.

## Dependencies

WP02 WP03 WP04. These are sequencing/design dependencies, not evidence that upstream scope is complete. No blanket all-epic dependency may dispatch work or erase the already-delivered D02 boundary.

## Ownership

Accountable source role: Integration lead. No named executor/clinical approver or delivery date is invented.

## Completion gate

All applicable child scope requirements and original acceptance criteria are qualified on exact source/configuration, with prerequisite policy/partner/device approvals. Bounded delivery slices can pass while this epic remains open. Formal UAT and production acceptance remain separate.

## Execution hold

Coding held by sponsor pending full planning setup. GitHub #188 remains sole delivery controller; D03 is the sole existing candidate. Synthetic-only current work; no providers, paid services, new hosting, clinical policies or destructive migrations.

[Source engineering plan](<https://github.com/nakul175/saha-health/blob/7668a03d97c1ae62174f09e65ccd5a5717120be6/docs/reference/08_Engineering-Implementation-Plan_v1.0.md>) · [reconciled scope](<https://github.com/nakul175/saha-health/blob/9e74b6a4648aa0a0a9e3fa32474cb4c943f1aea1/docs/current/community-worker-os/scope.tsv>)

## Full planning links

Primary-owned scope count: 19; release groups: R1. Epics span releases; canonical children retain their exact source milestone/criteria. Native related-epic links represent the source design dependency graph, not an assertion that whole upstream epics are complete.
[Planning hub](<https://linear.app/aplyd-sandbox/document/saha-full-product-planning-hub-and-operating-rules-a94ec8f76c24>) · [Roadmap/release goals](<https://linear.app/aplyd-sandbox/document/saha-roadmap-and-release-goals-b710e5c7276c>) · [Full scope mapping](<https://linear.app/aplyd-sandbox/document/saha-full-scope-and-requirement-mapping-99faedfc92c7>) · [Technical task register](<https://linear.app/aplyd-sandbox/document/saha-full-technical-task-register-ab4f929db6d4>).

## v4.2 planning refinement — source preserved

Author recommendation; the preserved work-package contract and child source acceptance remain authoritative. Do not weaken criteria to obtain a pass. This does not close or approve the epic.

### Discovery test and falsification

* Riskiest assumption: Each destination supports a declared, permissioned and reconcilable exchange contract including uncertain outcomes and incompatible upgrades.
* Population/context: Integration/receiving-owner archetypes and declared synthetic adapter profiles.
* Test: Run version-pinned invalid bundles, read-only writes, business rejection, accepted-then-timeout replay, partial destinations and breaking upgrades using test adapters.
* Falsification: Duplicate accepted activity, wrong-person disclosure, guessed mandatory value or test-only connector labelled live falsifies interoperability readiness.
* Decision: If falsified, hold the affected capability/slice, repair the boundary and repeat before further scope. If supported, qualify only the evidenced slice; full epic, formal UAT and live approval remain separate.

### Priority, sequence and forecast

Keep exchanges synthetic during current scope; acquire each real receiving-owner contract separately before introducing external dependencies into core workflow delivery.

Source dependency packages: WP02, WP03, WP04. Inspect current slice-specific controls rather than require whole upstream epics to be complete. Original child priority/release labels remain unchanged.

Recommended size: 88–214 gross engineering effort days across 19 canonical children, low confidence. Sum of owned-child forecast ranges before unknown shared-reuse savings; excludes external approval/recruitment/observation wait. Do not add child-task estimates to this total or treat it as calendar duration.

### Learning and exit evidence

Recommended formative window: the first two weeks after an authorised bounded release, then each material config change. Compare exact eligible opportunities/completions, avoidable re-entry, correction burden, denied unsafe actions, sync failures and support load with the declared release baseline and source targets. Until a representative observed run exists, retain results as unmeasured. Feed the evidence-backed continue/improve/narrow/hold recommendation into strategy/roadmap; no care/provider/production authority is conferred.

Use shared [SAHA-READY-1.0/SAHA-DONE-1.0](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7) for each bounded story/task; epic completion still requires all applicable unchanged child criteria and source/domain gates.