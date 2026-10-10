# Bounded D01 baseline impact decision — 11 October 2026

The latest product-plan edition4.2 calls for a fresh baseline/defect-impact decision before advancing the existing D03 candidate. GitHub main was freshly observed at `7668a03d97c1ae62174f09e65ccd5a5717120be6`, tree `dba0dc9184374d23f31b8ec8e1b8db1556b41ccc`. A separate exact-main copy reused the installed compatible dependencies, built265 files and ran the two unchanged stable suites with their original guards.

| Inherited issue | Fresh current-main observation | Decision boundary |
| --- | --- | --- |
| #185: composite meaningful safe viewer output | Original composite driver133 passed; stable minimum133 retained | The earlier43f445a failure is not reproduced in this bounded current-main run. Its original cause and issue acceptance are not closed. |
| #186: reminder refusal received a runtime restart503 | Original reminder driver55 passed, including two actual browser observations; stable minimum55 retained | No new restart refusal failure occurred here. The unchanged browser viewport is1280×900; this is not phone qualification or a historical cause diagnosis. |

Together:2 suites/188 assertions/0 failures/0 skips; guard passed with zero quarantine. All16637 source and265 build-file pins remained unchanged during execution. [The compact receipt](EVIDENCE-20261011-BASELINE.json) binds the separately saved raw source/build/test evidence.

**Bounded dependency decision:** continue qualification of the one existing D03/#176 candidate under its unchanged revision1A1–A10. Require the final compatible candidate to repeat both stable suites in its wider guarded runtime run before release. This decision does not mark D01, either inherited issue, any product item or formal UAT Done. Preserve the native prerequisite, source43f445a, original failing CI run37920175529 and its evidence. No GitHub issue, dashboard#188 or Linear state is changed by this document.

The current D03 shared-membership metadata repair has its own retained real failure: an audit AFTER trigger changes account home while membership remains active, native metadata counts the side write, and the earlier strict-count candidate incorrectly returns access-audit503. That is a distinct diagnosed candidate compatibility defect; it is not a reclassification of #186's historical Worker restart message. Its reviewed repair and complete candidate qualification remain separate required work.

This is synthetic local source/environment/test evidence. It supplies no new live smoke, historical-root-cause finding, final-head hosted CI, clinical/physical-device acceptance, paid-action permission, sponsor main-merge permission or live account-role authority. Product planning is independently published in draftPR193; the coding lane does not edit its documents or the delivery dashboard.
