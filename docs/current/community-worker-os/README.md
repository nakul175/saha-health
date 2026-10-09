# Community Worker OS: execution backlog

9 October 2026. Source baseline: `43f445acf4c54352cd2084e0bcd88bfbf605d757`.

## Scope authority

[scope.tsv](scope.tsv) accounts for the 160 reconciled scope items. Every original ID resolves to the existing `requirements/brd-v1.1.json`; original requirements and acceptance text remain authoritative and unchanged. CWO aliases retain links to the newer scope. This is a normalised execution view, not 160 accepted or implementation-ready stories. The unchanged Saha_Deduplicated_Backlog_v0.2.zip remains the complete source narrative/crosswalk/criteria artifact; this first publication does not claim that all its narrative files are in Git.

Never count a source alias or delivery slice as another scope item. Preserve the original 364-case catalogue. Map the relevant original cases before accepting each delivery story; this publication is not a complete test remap.

## Confirmed design constraints

Standalone mobile-first Community Worker OS, ASHA first, state-agnostic (UP illustrative only). Conversation serves the worker; visual controls and manual alternatives remain usable. Routine work is offline-first and cannot depend on a cloud model. The ASHA controls routine scheduling herself. Do not invent worker duties, approval gates, supervisor visibility or organisation structures. Technical authorisation, record integrity and existing professional authority remain binding. Demonstrate first, then test with ASHAs. Git is source control; DigitalOcean is hosting, not proof of production readiness.

## First milestone

Today -> existing assigned person -> bounded guided capture -> review -> saved record. Extend that same path through interruption, offline persistence and duplicate-safe reconciliation. Add bounded conversational assistance to the functioning journey, not as a separate app catalogue.

[DELIVERY.md](DELIVERY.md) specifies eight initial slices. Refine only upcoming work. Each contains requirement/value, functional and UX behaviour, data/API changes, applicable NFRs, acceptance/refusal/rejection criteria, reuse, evidence and release boundaries. They do not add eight items to the 160 scope count.

## Decision register

- DEC-01: Original local-save p95 is 500 ms. The later one-second proposal is not approved; do not weaken the target or change a test profile after observing failure.
- DEC-02: Preserve the original competency requirement for applicability review, but do not turn optional Academy content into a new login/care gate.
- DEC-03: Offline grant duration/key recovery needs a declared policy. The old 24/72-hour proposal is not agreed and must not create daily supervisor approval.
- DEC-04: Map supervision, escalation, transfer acknowledgements and reporting only to existing authorised responsibilities. Unestablished practice remains unknown.
- DEC-05: Activity evidence, claim approval and payment are different. No fabricated rates, automatic payment promise or imported synthetic approval chain.
- DEC-06: Post-demo formative research is not formal acceptance. Preserve the original evaluation proposal separately.
- DEC-07: Synthetic DigitalOcean release identification and production-runtime qualification remain separate. No live host was inspected by the earlier review.
- DEC-08: Preserve technical controls without adding worker bureaucracy. Reuse existing confirmation where appropriate; do not add one to ordinary navigation.

## Progress and publication

Story files own specifications; GitHub issues own assignment, priority, discussion and current status. Track implementation, technical verification, release approval and worker validation separately. Code presence is not acceptance. Dispositions are retain-and-verify, adapt-existing, build-new, investigate or explicit defer; unreviewed scope is not silently deferred.

Use branches and draft PRs. No merge or deployment is authorised here. The documented DigitalOcean updater independently follows main; the Cloudflare freeze is not a general deployment freeze. Do not change timers, enable providers, contact real recipients, run provisioning or modify live data.

## Baseline execution

The native checkout attempt in this environment failed with `Could not resolve host: github.com`. Authenticated connector reads work. A dedicated pull-request workflow captures the unmodified baseline source and runs documented checks on a GitHub runner. It has read-only repository permissions, no environment/secrets/deploy step, pinned source, independent failure reporting and artifacts. A workflow being queued is not a passing baseline. See BASELINE.md for the procedure and limitations.
