# SAHA-133 / APL-769 audit availability — frozen revision 1

Frozen 11 October 2026 before changing the production gate. Base: `7668a03d97c1ae62174f09e65ccd5a5717120be6`; isolated branch: `story/saha-133-audit-failclosed-20261011`. This is a bounded engineering prerequisite under [SAHA-133 / APL-156](https://linear.app/aplyd-sandbox/issue/APL-156/saha-133-provider-and-supply-chain-assurance), child [ENG-BR-SEC-12 / APL-769](https://linear.app/aplyd-sandbox/issue/APL-769/eng-br-sec-12-provider-and-supply-chain-assurance). It does not replace the full provider/supplier inventory or original acceptance.

## Problem and unchanged rule

The existing gate states: “The gate needs registry access for the audit. Without it the gate fails closed.”

The actual unavailable pnpm response is retained byte-for-byte in `tests/fixtures/security-audit-error-response.json`, SHA256 `1cf39c12597e369266d82ea7fd9caac58ad95be4d2ff4c51fa76359466424061`. Its JSON contains an error object and no advisory map or vulnerability counters. Current source `scripts/security-gate.mjs`, SHA256 `3878e45cba01125729261e77516d3eb67444121ec9ac2e90d6007d85dc285139`, substitutes empty defaults and reports `passed:true`. The retained actual incomplete report is source evidence; repeat the defect through the unchanged command with controlled subprocess output before editing.

An unresolved critical finding continues to block regardless of development status. High findings continue to use the original shipped-package decision. The separate observed bundle-provenance/RSC classification defect is outside this repair and remains a release blocker until separately qualified. This repair must not make that decision more permissive or change dependency versions.

## Frozen checks

| ID | Required observable result |
| --- | --- |
| G1 | A complete supported audit with zero advisory entries and five zero counters may pass. A valid supported report retains its real counters and findings. Extra unused fields remain tolerated. |
| G2 | Original critical and high-shipped findings block; original development/build-only reporting and dependency inventory behavior are preserved. No severity or shipped-package policy changes. |
| G3 | Error-shaped JSON, malformed JSON, null/array top-level or required objects, missing/non-integer/negative counters, unsupported severity, malformed consumed advisory fields, missing/empty findings or non-boolean development flags fail nonzero. In the declared pnpm map format, five severity counters match the tallies of advisory objects, rather than finding/path occurrences; contradictory or incomplete maps fail. |
| G4 | Complete validated JSON from a successful audit or pnpm's expected exit1 for findings remains usable. Unexpected exit codes, spawn failure, signal interruption and absent output fail; valid stdout cannot turn an interrupted/unsupported tool execution into a pass. |
| G5 | Invalidate the selected current report before any dependency subprocess. After an unavailable/malformed response the report is explicitly `passed:false`, so a prior successful report cannot masquerade as current success. Diagnostics use fixed text and do not echo raw tool/error payloads. |
| G6 | Retain original severity/shipped/dependency policy, app/runtime/source criteria and all original regression minima. Run the actual command entrypoint against controlled subprocess fixtures, record before/after failures and source hashes, affected source/documentation checks, separate source review and exact published-head CI. |

## Actual command test boundary

The test invokes the production `scripts/security-gate.mjs` entrypoint in fresh disposable filesystem fixtures. A test-only executable named `corepack` supplies the declared stdout/exit for the existing `pnpm list --prod --json --depth Infinity` and `pnpm audit --json` calls. The fixture has a synthetic dependency inventory and a small declared `dist/` marker to exercise the unchanged original shipped predicate. This is controlled tool-response testing, not a real registry read, actual production bundle-provenance validation or hosted qualification. No app hook, browser, backend, patient store or provider is added.

Cover complete empty output; actual supported nonzero findings; critical even development-only; high declared-shipped and high declared-unshipped; exact actual fetch-error JSON; unsupported and contradictory envelopes; malformed consumed nested fields; raw diagnostic marker; no-output; interrupted child with valid stdout; unexpected exit with valid stdout; and prior-passed-report invalidation. Inspect actual process exits and written report bytes, not just a helper return value. Keep the same driver and case labels before and after.

## Authorization and preservation

The current human authorization and fenced lease permit this isolated synthetic engineering prerequisite; root alone updates Linear/controller/release state. Canonical WP01 is an inspection prerequisite, not a claim of completion. No new provider, paid service, secret, hosting, database, patient data, clinical writer, migration, severity exception or policy approval is authorized. The task does not grant any deployment or runtime identity authority.

Original BR-SEC-12 and formal TC-BR-SEC-12-A/B remain unchanged and Not run. Formal UAT remains separate. Parent SAHA-133 stays partial/unqualified for supplier inventory, controls/subprocessors, incident/update obligations, vulnerable-component remedy, human review and hosted acceptance. Published-head CI/review, main integration, merge and observed hosting are separate gates. If another qualified change updates the same gate, reconcile exact source and repeat affected contracts before release.

Do not weaken criteria to obtain a pass.
