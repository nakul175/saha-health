# Independent review of mapping conformance

5 October 2026. Exact author source `c7d31835231b39bd885f955c986eb6b249a10c16`, reviewed in isolated `saha-mapping-conformance-review`. This reviewer authored the earlier lifecycle baseline; this review covers the other author's conformance changes and their use of existing guards, and does not claim a new independent approval of the reviewer's own earlier baseline. No production repairs, canonical changes, provider activation or native/clinical acceptance.

## Conclusion

No new blocking runtime defect was grounded in the bounded conformance follow-on. Actual current owner and membership checks protect saved publication receipt reads. Restoring membership permits a historical receipt read without republishing or changing the current integration. Different input with the same key refuses. The existing publication audit fault rolls back the integration and receipt; queued/uncertain bodies, mapping references and attempts are retained through publication and governed rollback.

The source-version guard binds approved governed requirements/examples, mapping semantics and terminology. New governed drafts cannot remove the conformance contract or quietly reinterpret a reviewed source/version. Closed unit/rule pairs, exact named expected outputs/rejections, missing-value behavior, explicit code states, coverage, per-field affected-work counts and current-owner publication are enforced on the server. Source fixture object order is not clinically meaningful. Unapproved native/clinical semantics remain clearly outside this evidence.

## Required field versus required valid code: actual observation

An adversarial candidate was preserved on the author's exact commit before any interpretation or repair. Actual Worker/D1 shows:

- A `terminologyCode` row with `required: true` and a target in `requiredTargets`, but absent from `codeTargets`, can deliberately publish a field containing the literal `unmapped` when its declared state and exact passing example say so.
- Adding that target to `codeTargets` while it remains unmapped makes the same example fail, leaves its field uncovered and refuses review with409. No publication occurs.

These are separate configured requirements. **Optional** in the author's “optional unmapped code” wording refers to whether an **active valid code is required**, not whether the wire field itself must be present. A destination can require a field that explicitly reports unavailable coding while not requiring a valid code. Conversely, an explicit valid-code requirement needs an active declared code. The observed distinction agrees with the author's stated design; it is not classified as a forged-authority, automatic replacement or unsafe-send defect. The feature document should state this distinction directly when root updates it, because “optional” alone could be read as `row.required: false`.

This owner-declared contract does not establish native issuer validity or clinical coding correctness. Whether a real destination permits `unmapped` remains external partner acceptance; software must not infer a replacement code.

## Actual checks

Fresh exact-commit build/type check pass. Unchanged author suites repeated:50 conformance contract checks,91 actual Worker/D1 checks and21 normal authenticated390×844 Chromium checks. These cover actual unit/null/state/code wires, future/due guard behavior, failed examples, field coverage, source-version refusal, atomic publication failure, stable receipt replay, publication suspension, prior wire retention, unknown outcomes and governed rollback. Normal phone controls show failed examples preventing review, declared units and code examples, inspectable conformance, count-only impact and explicit publication; there are no page errors or enabled live-provider controls.

The new `tests/mapping-conformance-independent-http.mjs` reuses the exact committed author fixture driver and adds17 current-authority and contract-semantics checks, yielding108 total. This is **91 repeated checks +17 additional checks**, not108 wholly independent cases. Additional actual probes remove current owner status and suspend current trusted membership before saved publication receipt reads (both403), restore authority and prove current integration bytes unchanged, refuse changed same-key input409, and exercise the precise required-field/code distinction above. The generated temporary driver is removed after execution; its original source SHA is recorded. All test Workers and browser processes stopped normally.

Evidence: `tests/evidence/mapping-conformance-independent-review/`, with original author rerun results, real adversarial observation, logs, actual phone screenshots, build/type logs and driver-source hash. Source files are unchanged. No whole-CI, full-unit, hosted, physical-device or external terminology acceptance is claimed. Root owns shared catalogue, assessments, combined regression and publication.
