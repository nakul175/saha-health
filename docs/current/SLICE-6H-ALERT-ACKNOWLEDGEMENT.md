# Development slice 6h — alert acknowledgement

30 September 2026 (IST). Builds on slice 6g. Synthetic data only; formal acceptance unchanged.

## What changed

- **Command.** `opsAcknowledgeAlert` (alert id, the count the person saw, a note of 5–300 characters) records who is handling an alert. It is audited.
- **Who may acknowledge.** Operations-owned alerts: an owner or administrator. Supervisor-owned alerts (overdue referrals and follow-ups, undated referrals): a supervisor, or an owner who is not an administrator. The same rule is applied when an idempotent request is replayed.
- **Scope.** Operations acknowledgements are shared across the organisation. Supervisor acknowledgements are kept per person, because each supervisor sees counts for their own teams. A person's newer acknowledgement of the same alert replaces their older one; at most 200 are kept.
- **Lifetime.** An acknowledgement applies only while the alert's count equals the count acknowledged, and for at most 24 hours. A new occurrence, or a day passing, reopens the alert.
- **Display.** Acknowledged alerts move below unacknowledged ones and show who acknowledged them, when, and the note. Each unacknowledged alert the viewer may own has a note field and an Acknowledge button.
- Acknowledging does not change the operations version, so it cannot collide with an incident or maintenance edit. It remains available during maintenance.

## Evidence

- 11 more contract assertions (`tests/alerts-contract.mjs`, now 25): matching count applies; changed count and a 24-hour lapse reopen; one supervisor's acknowledgement does not apply to another; role checks for operations and supervisor alerts, including administrator and ASHA refusals; one record per person; invalid alert ids and short notes refused; audit line; operations version unchanged.
- 5 more HTTP/D1 assertions: a supervisor cannot acknowledge an operations alert; an administrator's acknowledgement is stored, replays with the same key, and shows with its note; the operations version is unchanged.
- Browser check (headless Chromium): an owner acknowledged a critical incident alert from the page and saw it marked with the note; no console errors. The accessibility audit still reports no violations on 24 screens. `tests/evidence/slice-6h/`.
- All suites: 1,500 HTTP/D1, 785 contract/checkpoint and 21 restore assertions.

## Limits

- Still no delivery: nothing is pushed, paged, emailed or messaged, so an alert is seen only when someone opens Operations. BR-OPS-04 and NFR-18 remain partial.
- The 24-hour lifetime is an engineering default. There is no escalation when an acknowledged alert stays open.
- Slice 6v later adds in-app delivery to the owning role, clearing on acknowledgement and once-only escalation to owners inside the organisation (see [slice 6v](SLICE-6V-ALERT-DELIVERY.md)).
