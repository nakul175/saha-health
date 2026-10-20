# SAHA-134 local coding completion — incident response

## Frozen contract

- Canonical story: SAHA-134 / APL-157, Incident response.
- Contract SHA-256: `5c13dbea7b87ce614b9d789d6ede65521d347d060d745a058cf0cfdbf03bf804`.
- Original requirement retained: BR-SEC-13.
- Scope retained: accountable triage, containment, evidence preservation, impact assessment, affected-record discovery and deployment-specific notification decisions. No universal legal or contractual deadline is encoded.

## Implemented local behaviour

- An organisation owner binds an open incident to an active accountable lead, an explicit triage plan, an affected-record discovery method and one or more named deployment policy/contract rules.
- Each deployment rule records jurisdiction, authority, contract reference and its configured window. The product does not supply a default legal rule and does not send notifications.
- The lead or organisation owner appends an immutable response timeline for triage, containment, evidence preservation, impact, notification decisions and recovery. Containment entries must name the account, service or access class revoked. Every entry requires an evidence reference.
- Notification decisions bind to a configured jurisdiction and retain `notify`, `do-not-notify` or `pending` with rationale. A later decision supersedes an earlier pending decision for the same jurisdiction without deleting history.
- Every incident is explicitly classified as operational, security, privacy, or security-and-privacy when created. Security and privacy incidents cannot bypass the response workflow by resolving before response configuration.
- Closure remains blocked while the exercise is incomplete or not independently verified. Verification requires triage, containment, evidence, impact, recovery and a resolved latest notification decision for every configured deployment policy.
- Duplicate jurisdiction rules are refused case-insensitively, so separate notification obligations cannot collapse into one latest decision.
- The accountable lead and anyone who wrote response events cannot self-verify. A different organisation owner records verification evidence and findings. Later response evidence invalidates the prior verification.
- Global operations and incident-response versions reject stale concurrent saves with no side effect. Resolved incidents remain immutable.
- The Operations UI displays the accountable lead, affected-scope method, deployment-specific rules and complete evidence timeline, and exposes configuration, event capture and independent verification workflows.

## Local verification

- `node tests/incident-response-contract.mjs`: **24/24 passed**. Covers operator/ordinary-worker authorization, explicit incident classification, response-free closure refusal, deployment-rule validation, duplicate-jurisdiction refusal, versioned configuration, missing and whitespace-only containment-target refusal, recovery requirement, unresolved-notification refusal, later notification decision, closure-before-verification refusal, self-verification refusal, retained verifier findings, independent verification, stale race refusal, closure and resolved-record immutability. Stable machine-readable output is retained under `tests/evidence/saha-134-incident-response/`.
- On the semantic-union successor based on qualified integration head `b970711bfa917668d9193852949bcb0242bd766d`, `npm run typecheck` and `npm run build` passed.
- `npm run test:catalogue` remains blocked by three files already present on the integration parent (`configuration-publication-http.mjs`, `governed-report-export-http.mjs`, and `withdrawal-disposition-http.mjs`) that are not classified by the current catalogue. SAHA-134 does not change those files or the catalogue and does not claim that repository-wide gate.

## Gate status

- Local application-code gap against the frozen SAHA-134 scope: none identified.
- Local coding completion and focused synthetic testing: complete.
- Independent source review, exact-source CI, TC-BR-SEC-13-A/B tabletop execution by the named QA/privacy/security roles, approved deployment notification rules, formal acceptance, merge and observed deployment: pending.
- The synthetic contract test is engineering evidence only. It does not claim that a real incident procedure was exercised or that any legal notification decision was made.
