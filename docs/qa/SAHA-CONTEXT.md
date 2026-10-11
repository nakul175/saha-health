# Saha QA context

Adoption revision 1, 11 October 2026. Planning and scoped synthetic engineering only; not a release approval. See [adoption and commands](SAHA-ADOPTION.md). Canonical planning: [current product hub](https://linear.app/aplyd-sandbox/document/saha-current-product-plan-and-coding-start-8ae95cae358c).

| Context | Bound fact or unresolved decision |
| --- | --- |
| Product and user outcome | ASHA assigned-person routine work; canonical backlog covers governed community-health capture, programmes, oversight, optional AI/exchange and offline reliability. |
| Hierarchy | 1 vision, 1 strategy, 1 roadmap; 2 planned releases plus extension scope; 11 epics, 140 functional stories, 20 supporting items, 200 tasks. [Retained hierarchy](sources/hierarchy-index.json). |
| Sources | Planning edition 4.2 revision 4; [271 literal criteria](sources/criteria-source.json), [364 formal source cases](sources/formal-case-source.json), [95 separately proposed scenario contracts](sources/additional-scenario-drafts.json). Source authority is not authenticated by an offline hash. |
| Repository and architecture | github.com/nakul175/saha-health; existing React/Next-compatible presentation, Sites runtime/server identity, Worker/D1/SQLite and existing encrypted local storage. Use current repository contracts; no new framework or patient database. |
| Main/candidate | Observed main 7668a03d97c1ae62174f09e65ccd5a5717120be6; separate routine candidate PR192 at bf73fa61004855abd0651fae0cf5003a565a4f48. This adoption branch contains no candidate application changes. |
| Environment and users | Human confirmed existing health.aplyd.org is a synthetic sandbox/staging demonstration with no real users. No production claim. Existing main-following DigitalOcean staging and frozen older Worker remain as configured. |
| Authorized actions | Reversible source/docs work, synthetic local code/build/tests and qualified PRs under actual required checks/approval. No real patient/recipient, new service/provider/hosting/spend, secret or destructive migration. Fresh live write/role actions need applicable action authority. |
| Critical prohibited outcomes | Wrong-person/tenant disclosure or mutation, unaudited access, false saved/confirmed acknowledgement, duplicate uncertain retry, modification of confirmed records, invented values/authority or hidden legacy activation. |
| Personal data | Full product applicability YES because it handles person/health-record contracts. Current allowed test data synthetic only. Real-data jurisdiction, retention, consent, privacy review and clinical approval remain unresolved at their applicable gates. |
| AI | Full product has optional AI; current manual routine slice introduces no model/provider calls. AI authoring is separate. Reuse canonical assurance; no dataset metric or legal approval inferred. |
| Browser/device/network | Frozen routine spec requires 360x640/taller, keyboard/focus, 200% text, labelled 44px controls. Reference speed profile is a desktop/network surrogate; physical Android/R1/degraded acceptance pending. |
| Existing targets | Preserve local-save p95 <=500 ms and applicable connected p95 <=3000 ms; original NFR authorization minimum59/load minimum13. Do not substitute new package defaults. |
| Owners/approval | Sponsor/product owner Nakul Jain is sourced. Domain QA/security/privacy/clinical/release reviewers and their permissions are not appointed by this document. Authoring agent is not an independent approver. |
| Ready/Done and AI assurance | Reuse [shared Ready/Done](https://linear.app/aplyd-sandbox/document/saha-story-readiness-and-delivery-gates-3fbcfc7ee2e7) and [AI/discovery/learning](https://linear.app/aplyd-sandbox/document/saha-ai-assurance-discovery-and-release-learning-9e1b1616111e). Planning snapshots retain source pins; current revisions must be reread for a real decision. |
| Evidence | Confined portable `package:` root; checked-in redacted source/evidence summaries only. No credentials, local database, dependencies, build output or raw patient/provider material. Retention/access owner decision pending for real data. |
| Delivery endpoint | Human selected qualified merge as the coding endpoint; staging observation remains a separate status. This does not rewrite existing frozen acceptance contracts, mark a parent story Done or grant production release. |

## Risk and authority

Full-plan register uses a visibly provisional conservative Critical envelope (impact4, likelihood1) because identity/health-data/clinical contracts exist. This is an adoption author's risk recommendation, not a reviewed per-change risk score. Low-risk document work and future changes must follow actual task routing; do not make all changes Critical by association.

All271 full-plan criteria remain UNKNOWN for release applicability until actual scope/source review. No exclusions, NO classifications, reviewer identities, approvals or numerical targets were invented. The offline checker cannot independently establish the expected population.

## Existing engineering tools

Use repository `docs/current/TESTING.md`, `DEVELOPMENT-AND-CI.md`, `package.json`, `scripts/test-catalogue.mjs` and `tests/regression-baseline.json`. Existing unit, HTTP/D1, security, authorization, recovery, browser and NFR suites remain authoritative for their declared engineering scope. Map individual formal cases to actual automation only after reviewing their assertions and oracles; a unit assertion count is not a formal-case count.
