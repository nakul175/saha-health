# Case template
Status: DRAFT / UNCONFIGURED. ID: TBD. Version: TBD. Owner: TBD.
Authoritative sources and revisions: TBD. Scope/build: TBD. Created/reviewed: TBD.
Replace TBD with source-backed facts. Do not convert planned expectations into observed results.

Case ID/version: TC-TBD/v1. Scenario: TBD. Hierarchy/AC revision/task: TBD.
Risk/tier/domain/level: TBD. Required gate: TBD. Automation code locator: TBD.
Preconditions: TBD. Environment/configuration: TBD. Dataset/seed: TBD.

| Step | Action/input | Expected observable outcome |
|---|---|---|
| 1 | TBD | TBD |

Oracle/threshold/source/version: TBD. Boundary and failure variants: TBD.
Cleanup and side-effect controls: TBD. Dependencies/authorization: TBD.
Execution result: NOT_RUN. Actual observed outcome: None. Run/evidence: None.
A design record can link multiple immutable runs; do not replace its oracle after seeing results without versioning and rationale.

## Register binding (v1.1)
Use standards/register-schema.json for exact CSV fields. Case identity is (case_id, case_version); AC identity is (ac_id, ac_version). Runs are immutable and select scope pins, purpose QUALIFICATION/DIAGNOSTIC, protocol_ref, execution status and CURRENT/STALE/UNASSESSED freshness. Coverage selection is a separate record. Defect changes append event IDs/predecessors; no history is overwritten. See CODE-IDS-AND-CONCURRENCY.md.
