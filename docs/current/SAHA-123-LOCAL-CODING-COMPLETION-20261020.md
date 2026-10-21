# SAHA-123 local coding completion — understandable notice and consent

## Frozen contract

- Story: SAHA-123 / APL-146
- Exact base: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`
- Frozen contract: `outputs/saha-product-plan-v4.2/plan/backlog/issues/APL-146.md`
- Contract SHA-256: `f0f4ffc8d1a2035d5a7cb880973e935ecf46e355a24d823d0b2de370f29cafdc`
- Original requirement: BR-SEC-02

## Application behavior implemented

- Owners can propose immutable, bounded, purpose-specific English or Hindi notice versions. A different owner or administrator must retain an approval or changes decision before care staff can use the notice.
- The current notice is selected by highest approved numeric version for each purpose and language. Care staff can record a decision only against the current reviewed notice in their patient-facing language.
- AI assistance, optional audio recording, and external record sharing remain separate scopes. A notice cannot silently combine external sharing with AI or recording.
- Care staff can record the person's own decision or a representative decision backed by a current care-coordination proxy grant. Invalid, expired, missing, or mismatched representative authority is refused.
- The decision record retains purpose, scopes, notice/version/language, person or representative authority, decision, recorder, channel, time, and required expiry. Histories are append-only and fail closed at their bounds.
- Permission consumers use the latest non-expired scoped decision. A rich decision cannot be bypassed through the legacy switch.
- Declining the optional AI use withdraws dependent permission while ordinary visit start remains available. Optional audio transfer is refused before reading a new request body and rechecked immediately before and after object-store transfer.
- Notice governance and each recorded decision produce an audit entry. Patient partition and merged-record guards cover the new command.

## Verification performed on the exact worktree

- Focused and adjacent contract selection: **84/84 passed** (`notice-consent` 17, `mapping-lifecycle` 23, `selective-reuse` 44).
- Current root verification selection: **158/158 passed** (`agent` 25, `consent` 25, `ehr` 48, `media` 5, `shadow` 55).
- TypeScript typecheck: passed.
- Production build: passed.
- Test catalogue: passed; **1,045** suites classified. Catalogue citations are context rather than formal acceptance.
- Requirements audit: passed with the repository's resulting assessment counts (`implemented-local` 14, `partial` 151, `not-built` 2, `unverified` 9).
- Generated documentation was rebuilt. Its checker reported the expected changed baseline/current-integration files for this isolated story branch, so that checker is retained as a non-green result rather than relabelled.
- `sources/` is unchanged. Tests use synthetic records only.

## Retained limits and separate gates

- Formal TC-BR-SEC-02-A and TC-BR-SEC-02-B are not run and are not passed by these engineering checks.
- Formal privacy, language, clinical, and representative-authority acceptance remain pending.
- Independent source review, exact-source CI, merge, and observed deployment remain pending.
- No real patient, external provider, paid service, hosting change, new database, or destructive migration was used.
- Older direct manual harnesses for agent/EHR/shadow retain their stale fixed-transpile-inventory failure before assertions; the current root-verification variants above passed. The unrelated full API smoke operations patient-count fixture failure is not reclassified.

Within the current application boundary, no identified SAHA-123 application-code gap remains against the frozen story contract. This is a local coding-complete statement only.
