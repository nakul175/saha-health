# Acquired source validation at protocol governance checkpoints

A reviewed protocol could previously activate after its immutable acquired source cache was unavailable or corrupt. Independent pre-fix evidence is retained unchanged in review commit `bf2f4619` and `CLINICAL-SOURCE-INDEPENDENT-REVIEW.md`. The corruption witness explicitly removes an immutable UPDATE trigger only in synthetic fixture storage; it is a defensive storage scenario, not a permitted production API operation. Normal immutable elapsed source expiry already refused activation and is retained as a positive regression.

`checkSourceCommand` now checks every acquired source dependency at protocol independent review and transition-to-active. It reuses `verifiedSourceDocument` for the existing exact org/entry/document/manifest/reference, expiry, byte-count and SHA256 contract, and refuses an acquired dependency outside the current acting membership's source scope. Existing package authorisation and independent clinician review remain in their original caller. Citation-only references continue through existing governance checks without an acquired object; suspension/retirement remain available without requiring unavailable source bytes. Source cache rows, manifests, prior reviews, receipts and history are not rewritten.

Positive actual Worker/D1 regression31 proves:

* A healthy first acquired dependency does not hide a corrupted second dependency: both protocol review and activation refuse409; governance bytes, organisation revision and receipts remain unchanged.
* Restored valid acquired dependencies allow independent review and activation without altering document bytes. Separately named citation-only sources/protocols remain reviewable and activatable without creating cache rows.
* Ordinary immutable short-lived source expiry after protocol review refuses409 with zero governance/revision/receipt mutation; current clinician team withdrawal refuses403 without mutation.
* Audit failure503, membership/team withdrawal after read audit403, source suspension/version change403 for an ASHA reader, and post-audit byte corruption409 return no source content.

Injected domain contracts10 separately prove current acquired-dependency scope refusal before any byte lookup, verification at each review/activation checkpoint, citation-only compatibility and the ability to stop a protocol. These are not labelled HTTP checks. Original upload28 and controlled-peer retrieval41 regressions pass on the rebuilt source; build and TypeScript pass.110 focused checks in this repair batch.

An initial positive test fixture incorrectly activated the old citation-only edition under the same key as the acquired edition, correctly retiring the later read target. Its403 failure is preserved in `initial-fixture-failure.json`; the compatibility probe now uses a separate citation-only key. The original failing-behaviour diagnostic stays unchanged and must remain manual/direct-only after this repair.

Dedicated reports and hashes: `tests/evidence/clinical-source-dependency-fix/manifest.json`. No real publishers/providers, licensing approval, clinical approval or physical Android qualification is claimed. This repair is authored following an independent review; canonical integration requires the lead's independent rerun.
