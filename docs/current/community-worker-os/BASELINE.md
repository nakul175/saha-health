# Baseline qualification

Baseline commit: 43f445acf4c54352cd2084e0bcd88bfbf605d757. This is an engineering qualification, not clinical, handset, government or production acceptance.

The community-worker-baseline workflow checks out that exact original source, not the proposed product code. Before installation it records the commit and archives the tracked source and current baseline manifest. It runs the existing documentation/requirements checks, catalogue, pinned dependency installation, lint ratchet, typecheck, build, security gate, unit selection and HTTP/recovery selection. Node 24 is used in accordance with the repository development guide for the complete recovery tooling; this is a declared environment difference from existing Node-22 CI.

Every step has a reported outcome. Continue-on-error allows independent evidence collection; the final result fails if a required step failed or was skipped. Existing tests/minima are not changed. Logs and artifacts retain failed results. No new clinical fixtures, real recipients, provider secrets or live databases are used.

The first source snapshot artifact is provided for authorised repository inspection in an environment where native Git DNS failed. It is generated from git archive of the already accessible repository; no ignored secrets, local databases, .git credentials or dependency directories are included. It does not modify repository contents.

A baseline run does not exercise every browser workflow. The existing regression job is reported as red in the current engineering guide; its cause is not assumed. Relevant full browser/device checks remain necessary before new worker-journey acceptance. No baseline pass is implied by this document.
