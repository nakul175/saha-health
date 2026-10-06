# Empty reporting recipient hold repair

6 October 2026 (IST). Narrow author repair from the independent frozen failure `78d38ac0fad3b04bbd42ef0b45c0b589b3d345fb`. Original alert author `be4b0cc4`, its29-assertion before, the reviewer before driver/log/preimage/actual rows and all original source/evidence remain immutable. This repair awaits another independent review; it does not clear the original author or complete B28.

## Grounded problem and corrected behavior

The independent reviewer copied the real original one-person D1 state, suspended every membership and invoked the actual scheduled Worker entry. It returned `ok` but changed the original aggregate clinical notification to `cleared_reason: resolved` and set the original occurrence `closed_at`. There was no authorised reporting view demonstrating resolution. `views.every(...)` was true for an empty list. An administrator-only candidate list also supplied no clinical reporting evidence.

Only `lib/saha/alert-delivery-server.ts` changes in production. The clinical-family planner now requires a nonempty list of nonadministrator reporting candidates and an available current protected context for every such candidate. With no such candidate, the original clinical occurrence family is excluded from closing/clearing/restoring/escalating. The remaining nonclinical planner and current-authority/source/atomic batch guards are unchanged. No new migration, historical rewrite, clinical rule, external notification or source normalization is introduced.

## Actual evidence

`tests/alert-recipient-hold-http.mjs` passes39 actual Worker/scheduled assertions. It copies the unchanged original retained D1 into two separate states. The no-recipient scenario exactly matches the reviewer's adversarial all-suspended state; the current inbox refuses403 and scheduled execution preserves original clinical notification/occurrence/message, confirmed visit and receipt rows. The admin-only scenario uses supported `updateMember` commands to suspend ordinary other members and convert the owner to an administrator. Protected demonstration clinicians are retained; they have no aggregate reporting authority and are not aggregate alert candidates. Inbox/channel show unavailable current clinical sidecars, operations has a null clinical report, and the original raw clinical count never enters those result lists. Current and actual scheduled handlers preserve the original clinical rows exactly. A supported `opsUpdateIncident` still resolves the existing ordinary nonclinical incident and notification, proving that the hold does not freeze unrelated operations.

The first additional fixture tried to edit a protected demonstration clinician and correctly received409. Its driver/log are retained; the corrected supported fixture leaves that unrelated clinician unchanged and retains every history assertion. No guard was relaxed.

Named `alert-recipient-current-*.mjs` adapters retain all755 original author assertions with separate output folders/ports. Focused145HTTP/26retainedD1/16scheduled/19phone, affected225pure/79operationalHTTP/245operationalAdverse pass. They are overlapping/setup assertions, not755 unique acceptance cases. Together with39 new assertions the reported total is794 overlapping. Original adapter source/evidence is unchanged; the new adapters change only output/port locations. Ports20891–20893 avoid the independent root review's20720–20724.

Fresh build/types pass. Shared documentation/catalogue checks are diagnostics retained in the dedicated evidence folder; shared registration/baseline/inventory edits belong to the root. Runtime source is frozen for independent review, not self-certified.

## Reproduction and custody

Build using the bundled Node runtime with `node scripts/run-framework.mjs build`; typecheck with `node node_modules/typescript/bin/tsc --noEmit`. Run `node tests/alert-recipient-hold-http.mjs` with `SAHA_ALERT_LEGACY_STATE` pointing at an unchanged copy of the original `.wrangler/alert-disclosure-before-state`. Never run mutable reviewer tests against the author's original database. The original actual before must not be replaced by a fresh invented fixture. The driver copies its input before changing membership.

Run the current HTTP adapter first, then its scheduled/browser adapters against that generated current state. The browser uses the existing Playwright-core/Chromium environment. The retained/current scheduled legacy controls also require a copied `.wrangler/alert-disclosure-before-state` in this checkout. Operational adapters select dedicated folders through `SAHA_PRIVACY_OUT` and `SAHA_PRIVACY_ADVERSE_OUT`. The manifest pins new source/drivers, all retained author/reviewer evidence and the exact archived original changed source. Original generated before bundle custody remains in the original immutable author manifest; this repair never rewrites that manifest or promotes generated diagnostic source to current runtime authority.

Historical aggregate export purpose/scope/download protections, cross-destination and wider report-submission requirements remain separate open software work. Individual clinical care behavior is not changed by this scheduler repair.
