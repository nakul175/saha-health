# Inbound conflict review repairs

Base: frozen author `2158e12a4e2ed5b0f83408ab1c620c5ebd5311f3`. Independent failure evidence remains unchanged in `cf9e2efe36289987335bfd30d7b85b927c2d3867` (the review tree). This commit repairs three grounded local defects; it does not complete the automatic EHR retrieval-to-conflict handoff.

A currently scoped care manager can assign an open conflict to a current scoped clinician after the former reviewer loses authority. The former reviewer is retained in assignment history. Assignment never approves stale evidence: only an unchanged comparison advances its basis for its own version movement. A stale or withdrawn source comparison remains stale. Decisions and saved-receipt reads retain current assigned reviewer checks.

Blood pressure has one shared provenance entry. Explicit draft merge therefore requires both readings to choose the same source. An incoming pair must contain both readings with one exact observation time. Local readings remain valid; mixed-source or mixed-time requests refuse before clinical mutation, receipt, or decision audit. The UI explains this constraint without silently selecting another field.

The new inbound-conflict POST disposes unread bytes in a bounded transport-only finally clause, using the existing canonical request-discard helper. Identity-first refusal, body caps, clinical authorization, and measurement behavior are unchanged. It neither retries nor parses refused bodies.

Evidence: `tests/evidence/inbound-conflicts-assignment-repair/`. Author gates: 85 contracts (48 unchanged baseline), 48 actual Worker/D1 checks, 41 actual pressure-provenance/regression checks, 325 transport assertions comprising all 320 no-retry responses plus five zero-ledger checks, and 13 normal phone checks. Types and build pass. The initial author-repair HTTP socket failure is retained as `http.log`; the subsequent run follows the grounded transport repair rather than a production retry.

These are synthetic local gates, not physical device, hosted load, authenticated partner, or clinical mapping acceptance. Existing first source version, accepted destination snapshot, confirmed visits and historical receipts are preserved. Root owns combined regression and publication.
