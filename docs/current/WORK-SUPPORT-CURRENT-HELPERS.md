# Current offered support helpers

5 October2026. After the durable support queue read audit and existing current requester/patient role/owner/scope check, offered helper candidates now derive from the freshly loaded members and patient. The bounded requester/helper workflow query, historical helper IDs/state, assignment authorization and append-only workflow history remain unchanged.

Eighteen actual local Worker/D1 checks pass on a fresh build. The original11 visibility/ordering/overflow/audit-failure/patient-withdrawal checks remain. Actual AFTER-audit helper suspension and patient-team removal each exclude that helper while keeping another current helper and the historical assigned helperId/state visible. Actual assignment to the withdrawn helper refuses403; historical completed workflow rows remain byte-identical. Current requester membership suspension refuses rows and helper choices entirely. Type check and build pass.

Before-fix evidence remains separately in WORK-SUPPORT-FIX-INDEPENDENT-REVIEW and tests/evidence/work-ledger-independent-review/support-visibility-race. This repair addresses offered helper choices only; workflow reassignment visibility across the audit window is independently being probed. Synthetic software checks do not close external helpdesk, physical device or pilot acceptance.
