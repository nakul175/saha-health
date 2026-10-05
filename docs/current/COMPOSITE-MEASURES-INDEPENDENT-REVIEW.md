# Independent composite review — clearance held

Cold source: `ee8c70a85fa40a0f38439d8730ba600bcd32d9a0`. Original author source/evidence and before privacy witnesses are unchanged. This review changes only independent tests, reports and this document.

All 478 original positive assertions independently pass: 57 composite expression/fixture contracts; 131 actual Worker/D1 combined live/CSV/destination/frozen/edition assertions; 24 Chromium phone assertions; 194 unchanged legacy unit assertions; and 72 unchanged legacy immutable-figure Worker assertions. Fresh framework build and TypeScript pass. Wrappers change only evidence custody and isolated runtime ports/names, not the original assertions. These results are a baseline, not final clearance.

The source inspection confirms strict bounded expression leaves/operators/examples, commutative reference identity, immutable pinned full definitions/fixtures, real per-person live/frozen evaluation and protected primitive dependency candidates. The original actual all/any complement and destination zero-contribution repairs pass; the current joint profiles count in-scope zero-valued contributions. Original primitive operators and coverage V3 stay intact. Cross-viewer concurrent edition tests each allow only one incompatible safe disclosure. No provider was enabled or called.

## P2: current membership withdrawn during audit still receives live and CSV cells

Both independent probes use supported commands to create six confirmed visits and independently reviewed/released expressions. A synthetic D1 AFTER INSERT trigger withdraws the acting current membership at the required final access-audit commit. This is a deterministic concurrent-authority fixture; it neither changes patient facts nor supplies client identity. Membership is durably suspended, version 2, when each response arrives.

* `tests/composite-independent-live-race.mjs`: `/api/indicators` returns 200 with composite-sum=12 after the `viewAggregate` / `indicator results` audit inserts. Expected current-authority refusal 403 fails.
* `tests/composite-independent-csv-race.mjs`: the CSV path returns 200 and the actual `All,12,12` row after the `indicatorExport` audit inserts. Expected 403 fails.

Exact output and initial failing assertions are preserved in `live-scope-race.json/.log` and `csv-scope-race.json/.log`; their accepted assertion count is zero. These failures are not included in the 478 positives. No retries, exception masking or production repairs were applied.

Affected code is the existing `lib/saha/indicators-server.ts` `indicatorsFor` return boundary (around lines 67–79) and CSV `recordRelease` audit (around lines 116–118). It computes and releases from initial state, then awaits the access audit, and returns without revalidating current reporting membership/authority/purpose and original cohort. The gap is inherited by primitive live queries as well as the new composites. A narrow repair should fail closed against fresh current original-cohort reporting authority before returning either cells or a CSV file; historical/audit/ledger evidence must stay intact. Root owns that repair separately.

Clearance remains held until an independently reviewed repair makes both unchanged intended refusal assertions pass and preserves normal expressions, legacy primitives, protected frozen publication and destination behavior. This is synthetic software evidence, not clinical denominator approval, partner acceptance or physical device acceptance.
