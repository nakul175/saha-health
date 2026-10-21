# SAHA-101 local coding completion

Date: 16 October 2026. Scope: frozen APL-124 / BR-CARE-03 only.

The referral lifecycle now presents the existing `draft` record as **Proposed**, moves it to **Authorised** only when a current care worker accepts named ownership and a due date, and then permits dispatch. Receipt, scheduling, attendance and completion remain distinct evidence-bearing events. Completed care is refused until an attendance event exists and the recorder supplies one of the fixed service-outcome codes. Every event retains the evidence source, reference, occurrence time, recording time and actor. Unknown and not-attended remain open dispositions; declined and cancelled remain explicit terminal dispositions.

Local verification:

- `node tests/referral-contract.mjs`: 12/12 checks passed, including normal lifecycle, non-owner refusal, stale-version race refusal, premature completion refusal, missing-outcome refusal and attributed completion.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `node tests/field-contract.mjs`: not counted; the inherited standalone harness omits `installed-transition-authority.js` from its temporary module copy and fails before executing assertions. The failure is retained and the focused referral contract uses a complete temporary module inventory.

This record establishes local coding completion only. Formal TC-BR-CARE-03-A/B and TC-J10 execution, partner/facility verification, independent review, CI, merge and observed deployment remain pending.
