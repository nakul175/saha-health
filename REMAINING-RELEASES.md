# Remaining delivery plan after Release 10

Six planned engineering batches remain: R11–R16. This is a planning estimate, not a guarantee of production completion in six releases. The BRD's R1/R2/R3 phases are different from these engineering release numbers. All 176 acceptance criteria remain pending. The audit records 14 implemented-local, 129 partial, 24 not-built and 9 unverified requirements; these labels are not percentages of completion.

| Batch | Primary work | Required evidence / dependencies |
| --- | --- | --- |
| R11 | Live AI integration and evaluation; governed clinical/programme content; bounded agent planning, clinical rules, escalation and referral directory; source/version provenance | Approved provider access, clinical owners, intended-use decisions, curated content and representative evaluation sets. Local extraction alone does not establish clinical quality. |
| R12 | Two independent real programme destinations and EHR exchange; workflow, question semantics, longitudinal data and correction gaps | Partner contracts, accounts, approved sandbox endpoints and mappings; representative payloads, receipt/reconciliation and correction evidence; independent partner acceptance. |
| R13 | ABHA linking, HIP/HIU flows and scoped ABDM consent/exchange; identity reconciliation needed for those flows | ABDM onboarding and credentials, approved profiles and test artefacts, authorised identity-linking decisions. Current local consent and generic FHIR contracts do not implement this. |
| R14 | Live messaging and opt-out recovery; households/proxy relationships; disconnected provisional capture and field reliability; media/voice and reviewed Hindi/English content | Messaging account and approved templates, authorised contact scope, device matrix, actual offline storage/reload tests and translated content. No real recipients are enabled yet. |
| R15 | Sensitive-data segmentation, rights/retention and privacy-safe reports; security/accessibility; measured performance and scale architecture; hosted recovery and operational controls | Reviewed policies and access matrix; independent security review, screen-reader and device testing, representative load/soak, authorised hosted backup/cutover drill. |
| R16 | Representative field pilot, remediation, effectiveness/usability review, formal requirement acceptance and controlled expansion | Named accountable reviewers, trained participants, approved real-world study scope and evidence, signed acceptance decisions. Sandbox rehearsals cannot substitute. |

## Functional work still needed

- Household membership, guardian/proxy authority and relationship expiry are absent. Shared-phone messaging preferences do not supply these controls.
- Sensitive episodes need explicit separation and audited access; general team/role scope is insufficient. Retention, deletion/rights requests, governed export and small-cell report suppression remain incomplete.
- Clinical protocols are illustrative packs. Approved triage logic, red-flag escalation, referral directory, contraindication/interaction scope and governed updates need clinical ownership and implementation.
- Fully disconnected registration, actual encrypted IndexedDB recovery on supported devices, attachments/media, speech playback/deletion and complete localisation need further work.
- Current persistence loads and rewrites an organisation-level state transaction. The small local concurrency smoke does not demonstrate the BRD's scale. Query/persistence architecture, bounded queues, indexes and representative workload measurements need review before rollout.
- Live adapters, callbacks, identity and consent exchange, connector version compatibility, reconciliation and operational ownership need partner-level evidence. Generic mock transport tests remain local engineering evidence.

## Acceptance and external inputs

No clinical sign-off, legal compliance finding, partner certification, live provider evaluation, production backup validation or field acceptance has been fabricated. Credentials and external decisions cannot be completed solely through code. Where these inputs are unavailable, continue implementing and testing local work, keep external functions gated, and record the blocker against the exact requirement.

The [complete traceability](REQUIREMENTS-TRACEABILITY.md) assigns each requirement a primary target batch and an explicit remaining-work statement. Related source/test paths are context, not a claim of full acceptance coverage. Regenerate the JSON/CSV/Markdown with `node scripts/audit-requirements.mjs`; verify consistency with `node scripts/audit-requirements.mjs --check`.
