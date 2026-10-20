# SAHA-156 — point-of-need help evidence

This evidence qualifies the user-approved source-bound CWO-023 refinement for local application coding only.

- Approved source: fixed internal `Saha routine-task guidance` version 1.0.
- Eligible context: an authenticated ASHA using the existing assigned routine-visit journey.
- Behavior: help is optional, tied to the current guided step, identifies its source and version, preserves the current form, and always leaves a manual/Today return path.
- Refusals: other actors, tasks and unapproved steps receive no help catalogue content.
- Failure: an unavailable source produces no replacement content, clinical fact, completion state, external call or write.
- Boundaries: the guidance is procedural and carries no person or organisation identifiers. It does not diagnose, escalate, save, confirm, assign, send, or invoke a provider.

Generated `contract-result.json` records the actual local contract execution. Typecheck and production-build results are recorded in `LOCAL-COMPLETION.json` after execution. Formal product, clinical, privacy, field, CI, merge and hosting acceptance remain separate.
