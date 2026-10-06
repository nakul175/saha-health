# Touch capture: six-unit parity

5 October 2026. This is the first A04 batch, not completion of the population-range protocol.

Online capture and the encrypted shared notebook now expose every alternative unit the server already accepts: pounds, Fahrenheit, cough weeks, systolic/diastolic kPa and gestational weeks plus days (`20+3`). Canonical previews use the existing conversions: `16 kPa → 120 mmHg`, `10 kPa → 75 mmHg`, `20+3 → 20.43 weeks`. The original entered value and unit remain alongside the canonical quantity. Weeks-plus-days uses a text keyboard and example so the `+` is available. Online canonical controls become read-only while an original-unit entry is selected; switching to the base unit restores direct editing. No unit is inferred from a number.

The notebook previously mirrored only the three older units and would blank unsupported entered quantities before sync. It now preserves all six units and updates canonical device facts before encryption. Invalid entries are held before sync. Existing context, consent, lease, visit-version, packet hash, encrypted-write revision and unconfirmed-sync semantics stay in force. Override review includes the stored range version and exact applied expected/confirmation intervals, recorder, entered units and original reason; earlier override history remains available. Source remains explicitly measured/reported, independent of conversion, and existing import evidence is not restamped by a presentation read.

Both presentations retain progressive disclosure for extra units and reasons. An unusual value opens its reason and confirmation warning. Review keeps current clinician requirements visible; earlier override history, unused alternative-value inputs and the empty app media panel are collapsed. Queued media and recording open their panel; the original field layout stays compatible. Existing clinical quantities, thresholds, programme fields, protocol gates and imported/source distinctions are unchanged.

The server helper now checks an unknown entered-field key before dereferencing its definition and returns a controlled validation problem/422 instead of a runtime error. Existing facts schema also rejects that key.

## Evidence

`tests/touch-units-browser.mjs` runs actual 390px Chromium against isolated synthetic Worker/D1: 20 checks pass for online kPa and weeks-plus-days pickers, canonical read-only preview, reported source, original quantities, range version and override author, review and patient confirmation gate, unknown-key 422, six notebook controls, encrypted canonical/original reload, and sync preserving quantities/source and appending override history. A beyond-confirmation-range capture remains an unconfirmed draft and is refused by `confirmVisit` without an independent clinician confirmation. Screenshots and reports are in `tests/evidence/touch-units/`.

Existing range/context contracts pass 26 (two added unknown-field checks); override contracts pass 53; assistant override contracts pass four. Typecheck and build pass with the existing large client bundle warning. The existing notebook VM fixture assertions are updated for six pickers and canonical device facts; its fixture-loader compatibility fix matches independent A02 review commit `1f6ee5eb`. All 14 existing notebook unit checks pass with the updated six-unit assertions.

Physical phone use, clinical thresholds, real records and formal acceptance remain unverified. No real providers or messages were enabled. All ranges remain labelled engineering placeholders, not clinically approved.

## Required next batch: explicit population protocol

Population helpers exist but current save/stamp/confirm/import/assistant callers still use default `saha-value-ranges-0.1.0`. This batch exposes that active default honestly; it does not apply the illustrative `0.2.0` population groups silently.

The next required software batch will introduce an immutable owner-staged manifest selecting the existing compiled default or demonstration population groups, independent clinician governance review of its hash, owner publication/activation and append-only supersession history. Clinical approval remains pending; population demonstration activation is permitted only in synthetic/training environments. New visits and signed field packets must pin the selected protocol ID/hash/version, patient context, group and actual applied intervals. Activation must preserve existing visits and confirmed history. Save, field registration/sync, import, assistant application, override stamping, confirmation and exported evidence must use that pinned selection. Unknown/stale references must fail closed. Actual clinical publication remains an external approval, not an agent assertion.

The integrator owns shared validation, requirement assessment, implementation and test catalogue changes. No acceptance criterion is promoted by this first batch, and no dependency or migration change is needed for six-unit parity.
