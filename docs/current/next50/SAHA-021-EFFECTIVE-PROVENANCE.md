# Effective measurement provenance attribution — 12 October 2026

Canonical story SAHA-021 / APL-44, requirement BR-DATA-02. This is a bounded
development slice from main `22a271033eaa57e124a235fc615744928f1ac106`.

A measurement can inherit its observation time or source from the visit. The
previous attribution comparison inspected only the value and optional own
provenance entry. Correcting an inherited time/source therefore left the earlier
author credited for a changed fact. The predecessor regression fails with the
earlier ASHA identity where the actual correcting actor is expected.

The comparison now includes effective source/time for present measurement values.
Fully explicit unchanged provenance keeps its author. A missing reason has no
observation timestamp and keeps its author across unrelated visit edits. Existing
server identity, care scope, review, save and revision paths are unchanged. No
route, database, provider, dependency, migration or clinical rule is added.

Actual local verification:

- Additive contract: 16 checks, 0 failures, 0 skips. It executes the current pure
  helper, actual server attribution hook and strict facts/save schemas; correction
  predecessor, reviews and audit history remain unchanged.
- Unchanged original fact-provenance and fact-verification suites: 41 and 37
  checks, both existing regression guards pass. Their original source/minima stay
  unchanged.
- Type checking and canonical application build exit 0.
- Catalogue classification passes; the original 389 baseline records remain.

Source output and failed predecessor receipts are in the author handoff under
`outputs/saha-next50-20261012/programme` in the adopting workspace. The added suite
is selected by the native unit catalogue; its new baseline minimum and requirement
evidence citation need root reconciliation before publication.

Independent review, full final CI, canonical task/case binding, merge and observed
staging remain separate. No parent story acceptance or clinical/field/external
qualification is claimed. Formal acceptance and original criteria remain pending.

## Chronology and current qualification

Independent review found that the author's recorded freeze time09:44UTC was
later than the initial reports. Those earlier reports remain exploratory, and
the original receipt is retained unchanged. A new actual-clock freeze at09:51:38UTC
pins the same source and unchanged criteria. Independent qualification002 then
reran94 checks (16 new,41 provenance,37 verification) after that freeze; both
original guards pass. This closes chronology prospectively without backdating.
Canonical technical owner is ENG-BR-DATA-02/APL-204 under SAHA-021/APL-44.
The native runner subsequently registered the new16-check minimum without
altering any original389 record. Final-head CI and full-story acceptance remain pending.
