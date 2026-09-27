# AI, clinical content and service governance — Release 11

This release adds a local governance workflow for **synthetic rehearsal**. It does not authorise real clinical deployment, establish clinical accuracy, verify professional registration, or supply approved clinical protocols. No live model was called for this release.

## Registered content and independent decisions

Clinical governance holds immutable revisions of four package types: source metadata, referral services, bounded protocols and documentary AI capabilities. Each has an accountable clinician, care teams, effective date, review deadline and change summary. A new revision keeps earlier content and decisions. A different current clinician covering every selected team records evidence and findings; an organisation owner then activates the reviewed revision. Activation retires the previous active revision of the same package. Retired content cannot be reactivated. Suspending and re-reviewing an unchanged revision is supported.

Use-time checks cover current owner, author and reviewer membership versions; review dates; dependency versions; model/agent versions; and patient/team/role/context scope. Changed authority or source/service status invalidates use. An old review cannot be reused silently. Earlier encounter findings and directory snapshots remain unchanged.

Sources record publisher, edition, HTTPS link, applicability and reviewed summary. This is a metadata catalogue: it does not fetch, verify, ingest or retrieve the source document itself. Services record location, offered services, contact route, availability constraints, verification reference/date and review deadline. Actual directory verification is still a human responsibility.

## Provider boundaries

The bounded assistant is `saha-agent-1.1.0`; local parsing is `structured-parser-v2`. Existing extraction proposals, exact source excerpts and selected-field application remain separate from visit confirmation. Accept/reject/override decisions preserve original output and reasons; an unapplied rejected or overridden result cannot be applied. A decision on already applied evidence does not silently rewrite facts: use the existing correction workflow.

External documentary extraction or summary requires a technically available provider plus a current, independently reviewed capability. The capability pins model and agent versions, permitted tasks, ages, care roles/teams, languages, setting and browser device. It records excluded uses, support, hosting region, retention terms, training prohibition and agreement reference. These recorded terms are not proof that a vendor honours them. No diagnostic, prescribing or autonomous clinical capability is enabled. Legacy HTTP `runAI` is blocked; external work must use the governed assistant. Older demonstration results remain historical.

Workers review the exact source before one invocation. Direct patient identifiers are not included structurally. Common email/phone identifiers and the current person's name/locality are rejected in external free text; this is a limited safeguard, not certified de-identification. Field/value alignment and full-clause negation/history/subject checks reject evidence that cherry-picks a number. Unsupported language and sentence forms can be withheld; manual capture remains available.

Each capability limits calls and reserves 6,000 tokens per pending or unknown-use invocation. Confirmed usage replaces the reservation. Expired unsent requests free their reservation; calls spanning midnight count on the execution day. Current usage is checked before invocation, not during later human application. Reservations are conservative engineering quotas, not monetary billing limits. Evaluation has a separate ceiling of ten runs per organisation/day and 100 retained runs. There is no invoice reconciliation, currency budget, provider substitution or automatic provider retry.

## Reproducible engineering evaluation

The fixed `saha-synthetic-evidence-1` corpus contains 18 hand-authored cases: 16 English and two Hindi. It covers current facts, history, negation, other subjects, uncertainty, prompt injection, conflicts, unsupported units, missing evidence and transcription noise. A manifest selects its declared languages. Every result binds the manifest, corpus hash, model/provider version, agent version and requesting member version.

The runner durably reserves each case before one invocation. It can resume only unattempted cases. An interrupted running case is not resent; close the evaluation and investigate. Cancellation prevents accepting a later result but cannot recall an external call already sent. Changed membership, corpus, model or manifest prevents accepting the result. Each result retains outcome, latency and reported token usage. A passing evaluation requires no provider/validation errors, no critical-case failures, and at least 95% precision and recall overall and for every declared language. Unestimable metrics never become 100%.

The local parser passes the 16 English fixtures and fails the Hindi capability evaluation. **Those scores describe this tiny known fixture set only.** They do not establish general-language quality, subgroup safety, confidence calibration, clinical validity or BRD NFR-16 acceptance. The corpus currently evaluates extraction, not the independent usefulness of source summaries. Representative annotated corpora, clinical scenarios, independent reviewers and live-provider evaluation remain required. Passing evaluation alone cannot activate a capability.

## Model-independent clinical review

Protocols use a bounded declarative rule set over recorded numeric facts or an explicitly recorded worker concern. They require current cited sources and services and specify programme, age, role and maximum observation age. Unknown, absent, future-dated and stale evidence remain unknown; missing-evidence rules can request review. Matching rules display priority, a human-reviewed action, citations and the service contact without calling a model. No matching rule is not an all-clear result.

Saved evaluations bind facts, patient versions and current source/service/protocol versions. Clinicians record accept/reject/override decisions with reasons and evidence. A changed context requires a new evaluation. New protocol revisions apply to new reviews; historical findings keep original provenance. This is additive to existing illustrative programme packs, not a complete replacement for their question/episode engine. It does not implement contraindication/interaction checking, multi-model composition, approved clinical escalation pathways, unattended alerts or offline clinical caching.

Directory referrals require a current confirmed visit, resolved identity and an exact active service revision. They retain the verified service snapshot. No facility is contacted. Legacy free-text referrals remain visible with an explicit unverified-directory label.

## Clinical safety follow-up

Encounter-linked safety cases record misleading output, wrong-patient concerns, missed escalation or potential harm; named clinical ownership; and original visit/agent/protocol references. A scoped clinician can suspend an associated capability/protocol as part of the report. The current clinical owner records resolution evidence; closed cases are immutable. Unavailable owners are visible in the safety queue and another scoped clinician can reassign them. Patient handover does not automatically transfer these clinical responsibilities to an ASHA. Administrators cannot read patient-linked safety cases or affected-encounter lists.

## Persistence and remaining activation work

Migration `0005_breezy_killraven.sql` adds one organisation-keyed governance document table under the existing D1 transaction/revision guard. Patient concerns, rule checks and review decisions use existing versioned visit storage. No approval or clinical-content seed is installed. The organisation-wide state model and bounded retention limits remain unsuitable as proof of production scale.

The Site currently has no provider environment entries. Live OpenAI activation remains blocked on the supported secure key setup flow; no secret was requested in chat, committed or invented. After secure setup, provider data terms, accountable clinical owners, intended use, representative evaluation and independent approval are still prerequisites. Synthetic UI/API reviews performed during testing are labelled test evidence and are not human clinical sign-off.

OpenAI technical references checked 27 September 2026: [GPT-4.1 mini model snapshots](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), and [API data controls](https://developers.openai.com/api/docs/guides/your-data). The adapter retains the pinned snapshot, strict Responses JSON schema, `store:false`, one-call limit and timeout. `store:false` is not a blanket zero-retention guarantee.
