# Security and privacy validation
Establish assets, trust boundaries, tenants, roles, data flows, external dependencies and credible abuse cases. Select scoped verification requirements from a pinned security standard and threat model; scanning alone is insufficient.

Security cases: authentication/session lifecycle and recovery; role/object/tenant authorization; input injection and output encoding; file handling; secrets and configuration; dependency vulnerabilities; transport/storage controls; rate limiting and abuse; audit integrity; error/log leakage; supply-chain provenance; privileged operations and safe defaults. Reproduce scanner findings, assess exploitability and affected scope, and verify fixes. An unresolved credible critical vulnerability blocks release; numeric severity alone does not settle applicability.

Privacy cases: data inventory and purpose, minimization, consent/other applicable basis as established by qualified review, access/correction/deletion, retention expiry, export, vendor transfers and telemetry redaction. Verify deletion propagation through indexes, caches and processors where required; identify backup restoration exceptions and expiry policy. Test using synthetic identities. Confirm no sensitive payloads enter analytics, CI logs or AI providers outside approved boundaries.

Applicability depends on jurisdiction, people, data and release date. Record current primary legal sources and responsible qualified reviewer in the product context; this package is not a legal certification. Invasive scans, penetration tests and production probes require an explicit authorized target and boundary.

Evidence: threat model version, selected standard requirement IDs, test/run/build, findings and remediation, residual risks, reviewer and data controls. Keep sensitive exploit details restricted while retaining enough information for release assessment.
