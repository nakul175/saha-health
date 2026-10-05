# Opt-in synthetic availability ledger (R05 / NFR-01 software batch)

This batch adds fixed five-minute synthetic checks and a UTC monthly coverage report under Operations → Service & incidents. Disabled is the default. Only the current organisation owner can enable, reconfigure or disable the policy; current owners and administrators can inspect the audited report or run the fixed HTTP probe. Clinical roles, other organisations and anonymous callers cannot use these routes.

## What is measured

The scheduled job calls the same bounded internal sampler as the fixed `/api/availability` POST. The sampler reads the organisation database, validates a fixed public synthetic accepted receipt through the actual MIS receipt schema, checks the selected current active **demo** MIS destination, and atomically stores the sample and chained audit. It never reads patient facts, creates a clinical submission, delivers a message, fetches an external URL, activates a provider or sends to a live destination. All HTTP/live integrations are ineligible for this policy.

- **Core**: the database check plus a successfully committed, audited sample. A database failure that later permits recording is stored as `failed`; an outage preventing the sample is an explicit missing/unknown slot.
- **Local synthetic end-to-end contract**: the fixed local receipt-schema check, current synthetic destination readiness and audited persistence. This is a bounded local software diagnostic; it does **not** exercise a full capture/consent/clinical dispatch pipeline or independent destination receipt.
- **Manual HTTP**: an authenticated request that reached this handler. Its samples are separate from the scheduler denominator. No independently scheduled external observer exists in this batch.

The notice accompanies every report. The 99.5% hosted availability target is always `unmeasured`. Internal scheduler successes cannot establish platform, DNS, TLS, identity-provider, pre-authentication or independent HTTP availability. No averaged observed-only percentage is presented as uptime.

## Deterministic coverage and history

Cadence is fixed at 300 seconds, aligned to UTC. A configuration starts at the next aligned boundary. Reconfiguration, disable and maintenance transitions close the previous activation window and increment a dedicated policy version. The sampler only records a current open window; it cannot fill a closed old version. Reports retain historical configuration versions and maintenance intent. No sample history is overwritten or deleted.

The report counts **completed intended slots**, not the number of received samples. A current incomplete slot is excluded until the next boundary. Disabled intervals are excluded from the intended schedule. Missing slots remain unknown and reduce confirmed healthy coverage. A transition can leave a partial old slot unknown; a sample is an observation within a slot, not proof the service was healthy for every millisecond. Core and configured local-workflow denominators are separate; core-only periods explicitly say `not-configured` for the local workflow. Maintenance remains visible and never becomes a healthy local delivery outcome.

`(org_id, slot, source)` is the primary key. Concurrent or repeated same-source probes append once, including one chained audit; scheduler and manual HTTP samples never overwrite each other. SQL constraints bound the enums, latency and fingerprint; update/delete triggers make history immutable. Sample rows contain no patient IDs, names, actor/contact data, URLs, credentials, payloads or raw error strings. Ordinary audit events retain their initiating human or scheduled system actor.

Reports accept one `month=YYYY-MM` filter only, covering the current or previous eleven UTC months. Reads use the organisation/slot index and an explicit maximum of 17,856 rows plus an overflow sentinel (31 days × 288 slots × two sources). Configuration history is capped at 240 windows. At the cap an enable/reconfigure is refused; a maintenance safety transition still proceeds and disables further checks rather than growing history. Existing evidence remains stored; archival policy requires an operator-reviewed future migration and is not silently implemented as pruning.

## Authority and atomic recording

Before recording, the sampler reloads configuration, maintenance and current member authority. Its atomic SQL guard checks them again at the write, together with current destination version, kind, status and mode. A revocation, role change, policy change, maintenance transition or destination change racing the audit-head read refuses stale evidence. Samples and chained audit events commit together or roll back together. Neither organisation nor patient revision is moved, so the scheduled diagnostic cannot create clinical edit conflicts. Existing audit-chain contention retry rules apply; no provider request exists to retry.

The GET is a current operator-scoped aggregate read, audited before return and followed by a fresh authority check. POST reads at most two bytes, takes an empty body or `{}` only, rejects query parameters and URLs, and uses the server clock. Existing maintenance, support export and operations query behavior is preserved. Config commands also retain owner-only replay authorization and synthetic/training environment restrictions. Existing default scheduled paths issue no availability queries.

## Validation and integration

- `tests/availability-contract.mjs`: 20 checks against actual migrations, store, chained audit, operations configuration and scheduled-job code on a SQLite-backed D1 shim. Includes concurrent duplicates; audit rollback; actual atomic append races for membership, owner flag, config, maintenance and destination status/version; UTC leap month/missing slots; separate core-only denominator; disabled zero-query behavior; and a scheduler that fails any attempted network call.
- `tests/ui/availability.mjs`: 11 actual isolated Worker/D1 and cached Chromium checks. Covers reachable owner enable/check/disable, anonymous/nonoperator/other-org rejection, administrator read but no configuration authority, audited privacy-safe reports, strict query/body validation, duplicate HTTP probe, maintenance/support behavior, current revocation and zero browser page errors. The test explicitly backdates its synthetic activation fixture to create completed slots without waiting five real minutes; this is not production or hosted evidence.
- Full unit regression: 142 suites, 8,308 counted assertions, zero failures (using the explicitly described temporary lead fixture corrections below). Type check and framework build pass. Dedicated evidence is under `tests/evidence/availability/`.

The full-unit validation uses the lead's already-corrected catalogue and paired field-shell, speech and test-runner fixtures temporarily, because this worktree's 6e085201 baseline predates those fixture corrections. Those duplicate source changes are excluded from this commit. Integration must retain the lead's current fixture fixes. The existing suite catalogue discovers the new contract as unit and `tests/ui/availability.mjs` as UI without a new classifier rule.

Migration **0019_availability_samples** and the schema table are included. The organisation data-exit migration marker advances to 0019 and the ledger is exported as operational organisation rows; the existing export table-count assertion advances to 33 with its remaining checks intact. The Operations panel insertion is limited to one import and one component under its existing service tab. No shared generated assessment, requirements ledger, VALIDATION document, package lock or read-audit helper is edited.

## Remaining acceptance

An independent external scheduled HTTP/platform observer, deployment-specific intended observation windows, outage sampling and notifications, externally attested end-to-end clinical/provider delivery, retained hosted operations evidence and a real 99.5% measurement period remain acceptance/software-integration work. This batch must not mark NFR-01 fully accepted or the product production-ready. It creates a safe local diagnostic and an honest ledger/report for the demo.
