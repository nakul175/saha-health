# Root testing rules — merge these five rules into the product root AGENTS.md
1. For a product change, read `docs/qa/workflow/TASK-ROUTING.md`, the relevant AC and local test conventions; load only the documents routed for the task.
2. Classify change risk. Use the Low-tier fast path when eligible; create no full hierarchy or release dossier merely for a small fix. Preserve existing canonical IDs and requirements.
3. Run meaningful authorized checks; retain failures and reruns. PASS requires observed evidence; blocked, skipped, not-run and stale checks never become passes. Use the scoped checker when registers are maintained.
4. Resolve only decision-dependent unknowns; stop that dependent action while continuing independent work. Follow approved environment/data/action boundaries and specialist controls.
5. Report actual checks, limitations and residual risks. Never self-approve release/exception/independent review, weaken gates or invent product facts/results. Read full instructions in `docs/qa/workflow/AGENT-DETAILS.md` only for planned QA work, high/critical changes or release work.

This file governs this package folder when used here. Root placement is an adoption action; the package does not replace other repository instructions.
