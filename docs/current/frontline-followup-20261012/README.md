# Frontline planned follow-ups — bounded local software qualification

12 October 2026. Canonical user story **SAHA-036 / APL-59**; technical task **ENG-BR-PROG-05 / APL-219**; original requirement **BR-PROG-05** remains **partial**. Tested application/test source is local commit `045eb8694cb93a506bc69894caae08673e04b05c`, based on main `22a271033eaa57e124a235fc615744928f1ac106`. Publication metadata is a later control-only batch; final composed review and exact-head CI are pending.

The signed-in assigned ASHA opens **Today → assigned record → View planned follow-ups**. The dedicated `/follow-ups` screen verifies the existing authoritative Today org/person response before and after the scoped household read. It shows only the selected record’s planned item content, clinical due dates, owner and overdue state. A missing/invalid plan is unavailable, not empty. Offline, hidden/pagehide, refused or revoked access clears protected content. Every server endpoint/command authenticates the current actor; no new full-chain actor pin is claimed.

An eligible existing planned slot offers an explicit date/window proposal, cancel and confirm. The original `householdVisitReschedule` command receives the current household and covered-person versions and a unique idempotency key. No new approval, clinical timing rule, database, provider or external message is introduced. Actual linked server readback confirms success; an uncertain reply stays uncertain and is never automatically resent. Shared counts explicitly mean people within the worker’s access; outside-scope metadata is reduced to a boolean limitation, including a shared slot with only one visible person. Hidden identities and exact hidden counts are not displayed. Existing server eligibility remains decisive.

| Actual local check | Result |
| --- | ---: |
| New helper unit groups | 33 passed, 0 failed/skipped |
| Existing canonical household contract | 19 passed |
| Existing canonical reschedule contract | 35 passed |
| Fresh build / TypeScript / affected lint | All exit 0; lint 0 warnings |
| Selected real Worker/D1 browser cases | 7 first-attempt passes; 0 failed/skipped/flaky |
| Actual Chromium accessibility scans (7 phone390×844; 1 desktop1280×720) | 8 scans; 0 axe violations |
| Owned runtime cleanup | Recorded groups empty; port21451 free |

Cases cover the real Today entry; cancellation without writes; explicit linked reschedule; stale version409 atomic refusal; assignment-revoked403 protected clearing; anonymous401/foreign-org403; offline clearing/recovery; genuine committed200 reply discarded before browser delivery and reconciled by read only; and a real three-person shared slot with two visible then one visible person. Patient and encounter rows are unchanged by rescheduling; only household planned/cancelled linked slots and one receipt change. Shared read-only phases compare whole selected-organisation rows in patients, visits, households and command_receipts separately; owner reassignment between phases is declared setup, and audited reads are not asserted to leave audits/metrics unchanged.

The initial five-case run failed because the observer selected metadata/cache SQLite and the shared stylesheet import exposed a real generated missing-JavaScript asset. Both were fixed using actual application-D1 schema discovery and an owned route stylesheet. Initial strict-type and two new lint failures are retained. The first source review held the misleading total-count label; its corrected separate review passes at045. No historical failure is relabeled passed.

[Portable reports, raw browser result, exact source snapshots and separate review](../../../tests/evidence/frontline-followup-20261012/manifest.json) retain provenance. Larger actual source/dependency/290 compiled-byte archives stay in the local execution packet named by the manifest. The seven-case subset is not the original fullUI guard: original389 records/minima and min26/ninegoldens remain, with only the observed new unit33 entry added. Full current-source CI should execute original29 plus new7 browser cases. No screenshots were updated.

**Remaining:** root final composed/source/metadata review, current-head CI, qualified PR/main integration and any authorized exact hosted/live observation. Canonical TC-BR-PROG-05/TC-J01, clinical/privacy/timing/physical/formal UAT and NFR/whole-story acceptance remain separate. All176 formal requirements and364 original cases retain their existing pending/Not run states. No hosted release or deployed story is claimed.

The first metadata documentation check refused an attempted extension of the historically pinned source-snapshot index. That index was restored byte-for-byte; the prepared first source manifest is retained as historical evidence, and only `current-baseline.json` selects the corrected final source manifest. No checker exception or integrity weakening was added. Failed browser/lint logs are stored losslessly as gzip, with original byte hashes recorded in the new evidence manifest.
