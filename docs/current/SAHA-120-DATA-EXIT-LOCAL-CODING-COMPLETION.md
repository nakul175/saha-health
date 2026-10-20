# SAHA-120 data exit, portable records and continuity — local coding completion

Date: 20 October 2026
Frozen story: SAHA-120 / APL-143
Contract SHA-256: `a2723dcb12d61887ad1ae9ab4046af1d2dc8a92f5fd03e7fb5050ad50b8c88af`
Base source: `af2a9cd6866e3cd5c7c10094d781ff7623d413b0`

## Implemented boundary

The existing organisation archive, checksums, relationship checks, audit-chain verification, media, open-care ownership and unresolved MIS/EHR actions remain intact. This successor closes the identified application-code gaps without granting new care authority or changing a provider:

- `full=1` refuses unless the active owner's existing normal patient authority covers every current person. Owner status never overrides care scope.
- `plan=1&stageSize=N` creates a value-free staged-export plan. Each numbered part is tied to one digest over clinical/configuration/queue source rows. A changed source, authority or basis refuses before download; the export's own audit and receipt do not invalidate later parts.
- Every archive contains `handover/provider-disposition.jsonl`, one non-executing termination rehearsal row per configured connection. It counts unresolved actions and instructs the receiving operator to retain accepted local records, reconcile receipts and never resend blindly.
- Every archive contains `schema/fields.json`, generated only from already-scoped JSON. It records every observed path, value type, explicit unit (or `null` for dimensionless/not applicable), provenance and dictionary version without copying record values.
- `scripts/reimport-export.mjs` verifies one complete archive or all parts of a staged plan and imports them into a **new** local SQLite validation database. Patient-scoped fragments inside repeated organisation/team JSON rows are unioned by identity; duplicate entries are removed and any scalar conflict refuses instead of choosing a winner. It refuses an existing output, a partial-authority archive, missing/duplicate stages, incomplete or overlapping patient coverage, digest-only protected rows, unsupported columns, missing required placeholders, archive integrity failure and foreign-key failure. It does not connect to a Saha runtime.
- The owner screen exposes authorised-scope, full-exit and staged-exit actions. Staged parts remain explicit user downloads; the browser does not silently bulk-download or send anything.

## Authorization, refusal, error and race behavior

- Authorization: the route still requires an active organisation owner and the same server-derived identity. Full/staged export adds the unchanged `normallyAllowed` requirement for every person.
- Refusal: invalid FHIR/full/stage options, stage size outside 1–5,000, incomplete patient authority, a missing/stale basis and an out-of-range part fail without an archive.
- Error: media resolution, byte/row bounds, malformed protected evidence, re-import schema gaps and foreign-key errors remain explicit failures. The re-import tool never overwrites a database.
- Race: the existing patient/media/completeness and post-audit checks remain. Staged parts additionally compare a source digest before and after the audit write; any clinical, configuration, queue or membership change requires a new plan.
- No real provider is terminated, no external action is retried, no recipient is contacted and no credential or real patient record is used.

## Actual local checks

- `unit/data-exit-portability-contract`: **12/12 passed**. Covers staged planning, current-authority refusal, invalid size, source-race invalidation, provider disposition, units/provenance, dictionary tamper refusal, every part of a real migrated multi-part archive, shared JSON-fragment reconstruction, exact patient partitioning, foreign keys and non-destructive output.
- Current source-adapted inherited data-exit contract: **44/44 passed**. The adaptation only refreshes the stale hard-coded transpile closure/table/check-name inventory; it changes no product oracle. Its real migrated 1,000-person run exported 1,000 patients, 1,000 visits and 4,118 rows in a 4,801,024-byte archive, re-imported 55 tables and verified an intact audit chain.
- The unmodified historical `tests/data-exit-contract.mjs` currently stops before product assertions because its fixed transpile list omits a current transitive module and its fixed table/check inventories predate migrations 0030–0032. That harness failure is retained and is not counted as a product failure or a pass.
- TypeScript, production build, documentation integrity and requirement audit are recorded in `VALIDATION.md` at the local commit checkpoint.

## Separate gates still pending

Local application coding can be marked complete for SAHA-120. Exact-source CI, independent review, merge, observed deployment, an independently operated 1,000-person rehearsal, representative large-tenant capacity, buyer acceptance of the format and formal TC-BR-OPS-07 / TC-NFR-22 acceptance remain pending. Protected report reconstruction remains governed separately and is still explicitly excluded from the ordinary archive.
