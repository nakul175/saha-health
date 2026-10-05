# Current reporting alerts and protected delivery history

6 October 2026 (IST). Bounded author software on operational privacy `75c0f3e5`, with immutable actual before `c8e03108`. This is awaiting independent review and integrated qualification; it does not close B28 or BR-REP-04/05.

The actual before witness in [ALERT-AGGREGATE-DISCLOSURE-BEFORE.md](ALERT-AGGREGATE-DISCLOSURE-BEFORE.md) proves one-person `referrals-undated` counts in `/api/alerts`, the normal phone inbox, the real scheduled Worker entry and the local-only simulator message log. A supported care-only supervisor still received that count. The original manifest, rows, observations, phone screenshot and drivers are retained unchanged.

## Runtime contract

The six patient-derived aggregate kinds (`destination-uncertain`, `ehr-uncertain`, `referrals-overdue`, `followups-overdue`, `referrals-undated`, `provider-usage-missing`) use the existing current reporting purpose, normally permitted reporting reach and shared operational/indicator contribution ledger. Owner status does not supply patient access. A current projection is available only when the full existing operational contribution profile can be released; no new thresholds or clinical defaults are introduced.

Inbox and channel reads expose a fixed explanation independent of protected history and a separately labelled `currentAggregateAlerts` sidecar. It carries current protected alert ID/title/severity/count/action, without historical notification IDs, occurrence timestamps, delivered/read/cleared state or unread totals. The phone calls this **Current reporting alerts** and explicitly says it is freshly regenerated, not historical delivered notifications. A failed current read removes cached current clinical counts while preserving the existing visible nonclinical list and error notice. Explicit reload is a read; it never retries Mark read or creates a new mutation key.

Historical aggregate delivery rows have no immutable original per-person contribution proof. They cannot be certified by a current projection. Their internal raw bodies, counts, original dates and receipts remain unchanged, but these aggregate kinds are excluded before inbox/log limits, unread totals, escalation results, channel totals and open-occurrence lists. Direct Mark read of such a historical ID is refused without rewriting its original row. The fixed notice and “available entries” labels do not claim that excluded history is absent.

The scheduler and evaluation capture current protected reporting context for every nonadmin aggregate recipient. If one is unavailable or uncertain, aggregate clinical occurrences are not created, closed, cleared, restored or escalated. Existing rows are preserved. Individual clinical care/action-plan/referral routes remain available under their original permissions; unrelated nonclinical operations and source-notification kinds retain their existing handlers. This conservative hold may delay aggregate reporting notifications even when another recipient is permitted. It is deliberately not a clinical work completion decision.

When a current aggregate notification is permissible, fresh context checks precede planning and commit. Read-only exact organisation/patient revision, active membership version/role/owner and stored purpose/access-policy assertions surround each notification batch. A late inside-batch authority change rolls back both the injected change and notification creation. Protected simulator commits use the same guard around existing atomic access-audit persistence. Current inbox and channel reads record their own existing aggregate access audit and recheck authority and source after audit, before releasing any sidecar values. Disclosure ledger storage uncertainty yields the same constant unavailable state, without closing clinical history.

There is no external delivery. The existing simulator is synthetic only. This repair does not certify old events, add a migration, alter confirmed care, provide new uncertainty semantics for existing mutations, or change data export/official submission/drilldown/download revocation requirements. Those broader privacy and full B28 clauses remain open.

## Ownership and evidence

Production ownership is exactly `lib/saha/aggregate-alert-disclosure.ts`, `lib/saha/alert-delivery-server.ts`, `lib/saha/notification-channel-server.ts`, `app/alert-inbox.tsx`, `app/notification-channel-panel.tsx`. No schema/migration, care command, reporting expression, data exit or shared catalogue/assessment source is changed.

Final focused evidence under `tests/evidence/alert-disclosure-author`:

| Driver | Assertions | Meaning |
| --- | ---: | --- |
| `alert-disclosure-http.mjs` | 145 | Real Worker/D1 small/safe cohorts, same and independent viewer/CSV, supported purpose withdrawal, original care, native final inbox/channel member/source audit races, ledger write fault, notification transaction rollback |
| `alert-disclosure-retained-http.mjs` | 26 | Actual unchanged before D1 upgrade; historical rows/source/receipts exact, hidden raw count, rejected historical Mark read, final read suspension |
| `alert-disclosure-scheduled.mjs` | 16 | Actual scheduled entry on both unchanged legacy and current one-person D1; no new/closed/escalated protected rows, no clinical/receipt rewrites |
| `alert-disclosure-browser.mjs` | 19 | Normal Chromium phone at390/320px, explicit current/historical labels, nonclinical control, one Mark read POST and lost subsequent GET acknowledgement, explicit read-only reload |

Named current-contract compatibility drivers preserve original test files and dedicated output paths: alerts25, alert-delivery23, notification-channel24, notification-sources19, sixth-review41, read-audit52, operational-privacy41, operational HTTP79 and adverse HTTP245. The sum is549, with overlap and setup assertions; focused206 plus compatibility549 gives755 overlapping assertions, not755 unique acceptance cases. Earlier138/26/16/19 positives are also retained, not added again to that total.

The sixth-review adapter preserves all41 original assertions. Its old one-person synthetic race fixture is correctly withheld under the new guard. Its current fixture stores six homogeneous per-person contributions and actual memberships/source in migrated SQLite, then runs the same original escalation/closed-notification races without a disclosure bypass. The operational adverse adapter retains245 assertions; its one explicit old count1 residual assertion now checks absent historical count and unavailable current projection. The original source, leaked before output and driver remain unchanged.

Initial failures are retained: optional privacy type access, an incorrect command-receipt sorting column, an invalid transfer with no responsible clinician, and the now-protected one-person legacy race fixture. Corrected fixtures retain original assertions and care authority; none is classified as a passed original attempt.

Fresh build and types pass. Shared documentation/catalogue qualification is run diagnostically and retained; the root owns registration/baselines and integration. No broad-suite, hosted, clinical, physical/device or formal acceptance is claimed.

## Reproduction

Use the bundled Node runtime on PATH. Build with `node scripts/run-framework.mjs build` and typecheck with `node node_modules/typescript/bin/tsc --noEmit`. Run `node tests/alert-disclosure-http.mjs` first, creating `.wrangler/alert-disclosure-current-state`. Then run the scheduled and browser drivers with `SAHA_ALERT_HTTP_PROOF` pointing at that run's `observed.json`; optional `SAHA_ALERT_OUT`, `SAHA_ALERT_SCHEDULED_OUT` and `SAHA_ALERT_PHONE_OUT` choose fresh evidence folders. Browser uses the existing bundled Playwright-core/Chromium variables. Ports20720–20724 are reserved for this isolated batch. The retained driver and legacy scheduled/phone segment require the original actual before D1 state, never a newly invented reconstruction. The immutable before driver must run on its original source/build if recreating the original gap.

Current operational compatibility drivers use `SAHA_PRIVACY_OUT` / `SAHA_PRIVACY_ADVERSE_OUT` for new result folders, ports20720/20723 and distinct fresh Workers. Original tests/evidence remain unchanged.

## Generated diagnostic preimage custody

The original before manifest pins generated `dist/server/index.js` SHA256 `8e6333f2a66113268e350e9c88cefeb6b4948e9ddcc33cfaf2a348b5c1a039c2`,312532 bytes. The exact lossless original is retained as `tests/evidence/alert-disclosure-author/before-built-entry.js.gz`, with decompressed digest/bytes, compressed artifact digest and original manifest binding in the new manifest. It is generated diagnostic evidence from the before build, not current authoritative runtime source. The original manifest is unchanged; its generated diagnostic pin must not be replaced with the current build digest or treated as a general reports/evidence fallback.
