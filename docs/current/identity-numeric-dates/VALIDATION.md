# Actual bounded authentication verification

12 October 2026, local synthetic environment. Parent SAHA-012 / APL-35; task ENG-BR-ID-03 / APL-195. [Frozen contract](CONTRACT.md) hash `0da76d34de7141cab5f63ed3186dfa4b3db48fd2d0ee6d4488076ada293aa334`. [Raw reports and manifest](../../../tests/evidence/identity-numeric-dates-20261012/manifest.json).

| Execution | Before main22a | Repaired source |
| --- | --- | --- |
| New cryptographic validity contract | 13 pass / 7 fail, exit1 | 20 pass / 0 fail, exit0 |
| New built Worker checks | 24 pass / 23 fail, exit1 | 47 pass / 0 fail, exit0 |
| Unchanged identity contract | Not repeated before | 19 pass, exit0 |
| Unchanged full identity security suite | Not repeated before | 29 pass / 0 fail / 0 skip, exit0 |
| Unchanged membership contract | Not repeated before | 30 pass / 0 fail, exit0 |
| Existing current-root service identity fixture | Not repeated before | 10 pass / 0 fail / 0 skip, exit0 |
| Fresh application build | exit0 | exit0 |
| TypeScript check | Not repeated before | exit0 |
| Current catalogue check | Not repeated before | exit0, 1,000 suites / 97 components / 41 support files |

The unrepaired application accepted seven malformed signed credential variants. They reached the workspace and patient-list responses; an overflowed expiry also created a synthetic account, organisation and team. This is a signed malformed claim defect, not a forged-signature or real-provider compromise demonstration. The before-run refusal checks correctly failed the complete table/state and refused-account checks. Those failed reports remain intact.

The repair preserves the existing provider, cryptographic checks, 60-second allowance, equality boundaries, fractional dates and absent optional activation. All 42 actual malformed-token route requests return401 after repair. The complete 47-table native D1 comparison is unchanged across those refusals, including accounts, organisations, clinical records, audit and command receipts. The separate refused principal has no account. All three positive API controls still sign in as the Access subject rather than the supplied Sites header identity.

The first default HTTP launch failed before any application checks because the sandbox refused loopback binding (`EPERM`). A separately approved narrow owned local-test execution ran the actual before/after Workers. Each completed runtime was disposed and its unique disposable synthetic database removed; this does not assert inspection of unrelated processes or physical/hosted capacity.

The historical direct `tests/service-identity-contract.mjs` attempt failed before assertions because its transpile list omitted `installed-transition-authority.js`. Its failure log is retained. The already existing `tests/root-verification-current-service-identity-contract.mjs` adapter then ran the unchanged original service identity assertions,10 pass. No original fixture, assertion or regression minimum was modified.

These counts are bounded checks, not newly delivered stories. Full BR-ID-03 recovery/MFA and formal TC-BR-ID-03-A/B remain pending. No new provider, live request, hosting inspection, merge, independent approval or whole-story acceptance is claimed. Central implementation/assessment/next-delivery/baseline reconciliation and separate final review remain controller integration work before source publication qualification.
