# Development slice 9b — screens ready for a presenter-led demonstration

2 October 2026 (IST). Before a presenter-led demonstration to a government audience, a walkthrough of the synthetic workspace in a browser found screens an outside audience would read as unfinished: an ASHA saw administration menus, the visit form sat below several panels, record tools rendered as an unstyled row, people appeared as email addresses under Cloudflare Access sign-in, internal release numbers showed on screens, the photo picker was the browser's raw control and the page had two `main` landmarks. This slice fixes those. No server authorisation changed; every honesty notice (the synthetic banner, demonstration labels, safety notices) stays. Synthetic data only; formal acceptance unchanged.

## What changed

- **Menu by role** (`lib/saha/navigation.ts`). Display only: the server still checks every read and command as before. Care work first, then oversight, then administration.

  | View | Owner | Supervisor | ASHA |
  | --- | --- | --- | --- |
  | My work, People, Submissions, Outreach, Care handover, Organisation & team | shown | shown | shown |
  | Pilot readiness | shown | shown | only while the current rehearsal lists a training record of the ASHA's own |
  | Operations | shown | shown | hidden (unchanged rule) |
  | Activity log, Connections | shown | shown | hidden |
  | Clinical governance, Programmes, AI tools | shown | hidden | hidden |
  | Expansion | shown | hidden (unchanged rule) | hidden (unchanged rule) |

- **Patient page order.** With a visit open, the visit (Capture / Review & act / Receipts and its rail) comes straight after the patient banner and safety notices, followed by the clinical review, the visit assistant and photos and voice notes; programme episodes, the action plan and the record tools follow.
- **Record tools** sit in their own card with a heading; "No open work for this patient" sits inside the action plan card.
- **Names.** The name an organisation shows for a member is, in order: a name the member set for themselves in that organisation; otherwise, when the sign-in identity carries only an email address, the label of the member's latest accepted invitation; otherwise the sign-in name. A member sets their own name under Organisation & team (command `setMyDisplayName`: self only, 1–80 characters, control and bidirectional-override characters refused, version-checked, audited). The sign-in name is kept as `accountName` so the account can still be identified. Identity verification is unchanged.
- **Labels.** "Release 8", "Release 11" and similar build numbers are gone from screen headings and the footer ("Synthetic demonstration · not for patient care"); "Deterministic demo" reads "Demonstration tool".
- **Photo and voice-note picker** styled like other inputs; the native file input stays focusable and named.
- **One `main` landmark**: the sidebar inset is a plain container.

## Evidence

- `tests/member-names-smoke.mjs` (HTTP): invitation label shown instead of an email; a member sets and changes their own name; stale version refused; another member's name cannot be set; control characters refused.
- Accessibility audit (`tests/a11y-audit.mjs`, 66 screens): 0 violation nodes after, as before. The same two pre-existing findings appear on `main` and on this slice: the owner's Organisation page tab-order check fails because a notification stays on screen during the walk, and the roster-preview screen times out. Results: `tests/evidence/slice-9b/a11y-audit-before.json` (main) and `a11y-audit-result.json`.
- Screenshots before and after in `tests/evidence/slice-9b/`.

## Limits

- Menu hiding is not access control and is not presented as such.
- An ASHA's Pilot readiness entry depends on one extra read of the pilot record per organisation revision.
- The clinical review appears below the visit form, so the presenter scrolls after saving to show a finding.
- Built by a builder agent that stopped at the account's usage limit (work saved on `wip-9b`); completed and checked by the integrator. Not independently reviewed.
