# SAHA-159 local implementation acceptance contract

Date frozen for local implementation: 20 October 2026

Canonical story: APL-182 / SAHA-159 / CWO-029

Pinned source: `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-182.md`
Pinned source SHA-256: `f05a056c1a77aaa8976321e9abd252b7734b3643ec540829988820388227e64e`

The human product owner explicitly approved the proposed APL-182 criteria in the current delivery conversation. That decision freezes the following local application contract. It does not change the historical Linear status, supply a missing original CWO narrative, approve a mapping provider, or satisfy independent review, CI, merge, formal acceptance, or observed deployment.

## Frozen behavior

1. A current ASHA can create an optional route suggestion only from work currently assigned to that worker and inside current team, facility, locality and programme scope. Inputs are limited to the assigned task identifier, due date and existing locality label. No coordinates are collected.
2. A suggestion is stored separately from patient assignment and completion. Creating, inspecting, ignoring, reordering, overriding or declining it cannot change assignment, completion, ordinary service access, pay or sanctions.
3. The worker can inspect an ordered suggestion, move available tasks, replace the selected tasks with other current assigned work, or decline it. Every mutation is version checked and audited.
4. A wrong role, wrong worker, unassigned task, completed task, missing task, changed membership or changed assignment is refused or returned only as an unavailable placeholder. Restricted record and location fields are withheld.
5. When an existing locality label, task or approved local capability is unavailable or stale, the suggestion is marked unavailable and the ordinary permitted work list remains usable. The release makes no external mapping/navigation call and enables no continuous or background tracking.

## Frozen non-goals

- No routing provider, live maps, navigation, coordinates, travel-time claim, GPS collection or tracking.
- No clinical prioritisation policy, automatic allocation, assignment mutation, completion mutation, service denial, payment decision or sanction.
- No real patient data, provider credential, paid service, database or hosting change.

The canonical APL-182 text remains preserved in the product-plan output. This local contract is the approved source-bound implementation decision requested by that record; the original acceptance-source gap remains documented rather than rewritten.
