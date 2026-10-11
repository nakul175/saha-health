# Typed status model
`statuses.json` is the canonical vocabulary. These are separate dimensions, not one interchangeable list. The checker loads execution, freshness, applicability, defect, exception and run-purpose values from that file. Narrative template fields use the corresponding dimension; freeform Markdown is not parsed by the checker.

Execution: PASS, FAIL, BLOCKED, NOT_RUN, SKIPPED, NOT_APPLICABLE.
Freshness: CURRENT, STALE, UNASSESSED. STALE and UNASSESSED never establish current validated coverage.
Quality, approval, readiness, delivery and learning each have their own lists in the JSON. PENDING and NOT_ESTABLISHED are legitimate approval/delivery values, not execution statuses.

Blank run fields are not NOT_RUN results: absent runs produce derived NOT_RUN counts. NOT_APPLICABLE needs a reviewed rationale and scope evidence. A previous PASS can be STALE. A case designed but unexecuted has no run; template display status remains NOT_RUN.

Source protection uses NOT_CONFIGURED/VERIFIED/FAILED from source_protection in statuses.json. It describes externally verified repository/source controls, not a test execution result; qa_lint.py does not authenticate this governance state.
