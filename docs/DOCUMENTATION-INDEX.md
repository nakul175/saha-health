# Current product and coding documentation 10 October 2026

Start with [the 11 October engineering handover](current/engineering-handoff/START-HERE.md). It links the current v4.2 product direction, recommended defaults, actual runtime map, existing D01/D03 packet, exact criterion traceability, test/recovery plan and D04/D05 preparation. Main was independently read at 7668a03d97c1ae62174f09e65ccd5a5717120be6; the original edition index below retains its historical source baseline.

Use [Linear's current product-plan entry](https://linear.app/aplyd-sandbox/document/saha-current-product-plan-and-coding-start-8ae95cae358c) for vision → strategy → roadmap → product release goal → epic → story/support item → acceptance criterion → technical task. The source-backed engineering supplement and original acceptance documents remain separate from full-product certification.

| Current engineering document | Purpose |
| --- | --- |
| [Coding start](current/engineering-handoff/START-HERE.md) | Select the correct source and first morning task. |
| [Product decisions](current/engineering-handoff/PRODUCT-DECISIONS.md) | Scope, recommended defaults, authority gaps and learning. |
| [Engineering baseline](current/engineering-handoff/CURRENT-ENGINEERING-BASELINE.md) | Current architecture, hosting, identity, API/data source pins. |
| [D01 and D03 packet](current/engineering-handoff/D01-D03-CODING-PACKET.md) | Existing candidate, unchanged contract and qualification tasks. |
| [D03 traceability](current/engineering-handoff/D03-TRACEABILITY.csv) | A1–A10 source and evidence mapping. |
| [Exact frozen D03 copy](current/engineering-handoff/source/frozen-d03.md) | Immutable original revision 1 acceptance oracle. |
| [Test and recovery plan](current/engineering-handoff/TEST-AND-RECOVERY-PLAN.md) | Proposed cases, fixtures, commands and results boundary. |
| [D04 and D05 preparation](current/engineering-handoff/D04-D05-PREPARATION.md) | Subsequent offline contracts and prerequisite gates. |
| [Documentation quality status](current/engineering-handoff/QUALITY-STATUS.md) | Actual source/check results and open execution gates. |


# Saha documentation and developer handover

Edition 1.1 · 28 September 2026 · application R11 / v1.3-readiness.

This pack follows the TolaData handover approach: current implementation, preserved design, requirement traceability, qualification evidence and a concrete next delivery. It is a documentation update, not another application release. Start with the four documents below.

1. [Implementation boundary](IMPLEMENTATION.md): delivered behavior and its limits.
2. [Next delivery](NEXT-DELIVERY.md): the next coding slice and outstanding dependencies.
3. [Qualification](QUALIFICATION.md): historical engineering evidence and unpassed acceptance gates.
4. [Current document index](current/DOCUMENTATION-INDEX.md): specifications, operating guides and registers.

The [governance documents](governance/README.md) map the 27 standard documents (security policy, runbooks, backup and DR, privacy, threat model, SBOM, accessibility, AI model card, compliance mapping), added 8 October 2026 and agent-drafted.

[HANDOVER.md](../HANDOVER.md) is the entry point for a developer or coding agent (written 3 October 2026 for the hand-over to the next agent); [CLAUDE.md](../CLAUDE.md) carries the same rules for Claude. [AGENTS.md](../AGENTS.md) remains the repository workflow authority.

The source baseline is GitHub commit `c60c717a3b9ed48df1b918606e33e35412e1b373` on `release-11-ai-clinical-governance`, with tree `230f0744a621891c057b53118eab5d39c0c54ee7`. The equivalent Sites checkout commit is `f7f834524a9dc4a6f0388f5d82f313d2e4ef9bce`. Commit IDs differ because the two repositories have different histories. The documentation publication does not redeploy the application.

All 176 BRD acceptance criteria remain pending. The audited implementation counts were 14 implemented-local, 134 partial, 19 not-built and 9 unverified at R11; after development slice 10k they are 14, 151, 2 and 9. The remaining plan contains five future engineering batches, R12–R16, plus open R11 provider and clinical follow-through. Counts are not completion percentages.

## Document authority

| Source | Meaning |
| --- | --- |
| [BRD v1.1 original](history/v1.0/source/Health-AI-Orchestration-Platform-BRD-v1.1.docx) | Original product requirements; preserved without editing |
| [Current BRD record](current/BRD-IMPLEMENTATION-RECORD.md) and [traceability](../REQUIREMENTS-TRACEABILITY.md) | Exact requirements, current evidence context and remaining work |
| [Current specifications](current/DOCUMENTATION-INDEX.md) | R11 behavior and explicit differences from the target design |
| [Reference transcriptions](reference/README.md) | Searchable transcription of the original ten design documents; not current implementation claims |
| [Original pack](history/README.md) | Unchanged Office files, interactive prototype, engineering assets and ZIP archives |
| [QA record](current/DOCUMENTATION-QA.md) | Integrity checks for this documentation edition; separate from product tests |

Current specifications use Markdown and registers use CSV/JSON for GitHub review and maintenance. The original editable Word and Excel files remain available in history. Their original statuses have not been silently rewritten or presented as current execution results.

- [D02 frozen specification](current/d02/SPECIFICATION.md) — isolated assigned-list/read-only identity-context delivery.
