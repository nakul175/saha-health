# Defect template
Status: DRAFT / UNCONFIGURED. ID: TBD. Version: TBD. Owner: TBD.
Authoritative sources and revisions: TBD. Scope/build: TBD. Created/reviewed: TBD.
Replace TBD with source-backed facts. Do not convert planned expectations into observed results.

Defect ID: BUG-TBD. Title: concrete failed behavior.
Linked release/epic/story/AC revision/task/case/run: TBD.
Build/environment/config/data: TBD. Severity (D1–D4): TBD. Priority: TBD. Risk/blast radius: TBD.
Steps to reproduce: TBD. Expected: TBD. Actual: TBD. Frequency/denominator: TBD.
Redacted evidence: TBD. User impact and workaround: TBD.
Owner/status: TBD. Suspected cause (label hypothesis): TBD.
Fix PR/build: TBD. Retest run/result: NOT_RUN. Regression scope/result: NOT_RUN.
Close authority/evidence: TBD. Reopen trigger: TBD.
Severity guide: D4 severe harm/critical outage or disclosure; D3 major function impaired; D2 recoverable material issue; D1 minor issue. Priority depends on urgency/exposure/dependencies, not severity alone.

## Register binding (v1.1)
Use standards/register-schema.json for exact CSV fields. Case identity is (case_id, case_version); AC identity is (ac_id, ac_version). Runs are immutable and select scope pins, purpose QUALIFICATION/DIAGNOSTIC, protocol_ref, execution status and CURRENT/STALE/UNASSESSED freshness. Coverage selection is a separate record. Defect changes append event IDs/predecessors; no history is overwritten. See CODE-IDS-AND-CONCURRENCY.md.

## Severity change and closure fields (v1.2)
When decreasing severity, supply `severity_change_rationale` and `severity_review_ref` in the new event; preserve the previous event and case ID. The review reference must resolve and its authority must be established externally. Retest must run the defect's case ID on the closed event's build; release closure additionally matches candidate scope/config/data/artifact. An unrelated passing case is not closure evidence.
