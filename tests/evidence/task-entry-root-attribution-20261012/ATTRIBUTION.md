# Task-entry root repeat: corrected evidence attribution

The existing `tests/evidence/task-entry-20261012/root-native61-summary.json` is a byte-identical duplicate of the author's final007 summary (10:37:01–10:37:10 UTC). Its filename incorrectly suggests the later root repetition. Keep its bytes and original manifest unchanged as historical evidence; use the successor attribution folder for the root repeat.

The actual root summary is `tests/reports/summary-unit+integration+resilience+smoke+ui+nfr+uat+manual-only.json`, copied unchanged to `tests/evidence/task-entry-root-attribution-20261012/root-repeat-61.json`. It records 10:40:48.821–10:40:51.832 UTC, 36 parser and25 browser checks, zero failed/skipped, and `--update-baseline --fast`. The root repeat did not build. Its parser/browser raw reports and real console log already reside in the first evidence folder and match this actual repetition.

The earlier root attempt built successfully and then failed before browser execution because its local bind was restricted; that separate failure receipt remains. The later approved run used only its owned synthetic loopback backend and browser. Author and root repetitions are not additional acceptance cases, current dist is not declared equal to author007 dist, and no whole-story/formal/UAT/physical/hosting acceptance follows.

This correction changes evidence attribution only. Application source, assertions, original389 minimum records and the two observed new36/25 minimum records are unchanged. Independent metadata review remains required before publication.
