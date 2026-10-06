# B19 independent acquisition/retrieval review

Isolated review of author commits `6e2574dc`, `4b81ab20`, `25d6a181` on canonical `87e1eba8`. No canonical source edits or real source/provider calls. Local cherry conflict resolutions preserve the protected0021 workload/support tables and registration0022/0024 tables; additive source0025 remains the latest export marker. Existing stored history is untouched.

## Grounded P2: acquired dependency integrity omitted at protocol review/activation

`lib/saha/clinical-source.ts:21` verifies the acquired document for direct source review or activation, but does not verify a protocol's acquired source dependencies when reviewing or activating that protocol. `applyGovernance` checks source governance state/version/expiry through `entryIssues`; byte availability/digest binding resides separately in `verifiedSourceDocument`.

The actual Worker/D1 witness uses authorised source upload, independent clinician source review, owner activation, reviewed service and protocol creation/review. Only then does the synthetic fixture explicitly drop the immutable cache UPDATE trigger and corrupt acquired bytes. Protocol activation returns200 and persists active state. Immediately afterwards the library reports that protocol unusable; direct source retrieval and source review refuse409. This is a defensive corrupted-storage scenario, not a claim that an authorised production API can alter immutable source content. Existing protocol-use gates still refuse the unavailable content. Preserve review and deployment consistency by validating each acquired source dependency on protocol review and transition-to-active, retaining citation-only behaviour and all existing authority checks.

A separate normal lifecycle witness uses an unmodified short-lived acquired source: source and protocol are reviewed while current, then a bounded8s expiry elapses. Activation already refuses409 with byte-identical governance data, unchanged organisation revision and no operation receipt. Normal elapsed expiry is not the reported defect.

## Actual independent checks

* Author upload28, controlled-peer retrieval41, phone9, strict anonymous7, upload contract16, fetch contract25 passed on freshly built source.
* Additional diagnostic26 includes the defensive finding, normal expiry, access-audit fault503, membership/team withdrawal after the source-read audit403, suspension/version change after audit403 for an ASHA reader, and post-audit byte corruption409. No newly unauthorised bytes are returned.
* Export contract42 passed: 1000-person export reimports41 organisation tables, preserving the audit chain and protected workload/registration table union. Build and TypeScript passed.
* Retrieval exercises512KiB text and PDF, exact encoded/body boundaries, digest binding, fresh member/source race refusals, default-off configured origin, no redirects and no forwarded identity/cookie credentials. Actual lost ACK reuses exact body/key and creates one document/revision; accepted receipt replay makes no second fetch.

Dedicated hashed evidence is under `tests/evidence/clinical-source-independent/manifest.json`. Author evidence directories are preserved; independently generated reports/screenshots live separately. `tests/clinical-source-adversarial-review.mjs` deliberately asserts the pre-fix defect and must be classified direct-only/manual, not a production positive regression after repair.

## Limits

All identities, bytes and upstream peers are synthetic.390px Chromium is not a physical Android test. Marker checks and download sandboxing do not establish arbitrary PDF sanitization. Exact approved-origin validation does not resolve DNS to attest public addresses; operators must control permitted origins. No live clinical source approval, licensing approval, publisher acceptance or hosted-provider qualification is inferred.
