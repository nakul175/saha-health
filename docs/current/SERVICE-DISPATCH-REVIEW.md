# Independent service-dispatch agreement review

5 October 2026 (IST). Closes the independently reproduced P1 agreement suspension bypass in the opted-in dispatch gate. It does not close the separately reproduced clinical domain checkpoint findings below.

The gate sliced `frontline:` at index nine, although the prefix is ten characters. It checked `:oral-saathi` while the actual stored agreement uses `oral-saathi`. Its tests constructed the same wrong key. It also checked agreement changes only when a prepared stored agreement existed, ignoring a legitimate bootstrap agreement that became explicitly suspended before transport.

Clinical preparation and dispatch now share one effective frontline agreement function. The existing public `frontline.agreement` API re-exports this function, so defaults remain the actual clinical defaults. Dispatch extracts the app ID using the prefix's length, checks effective agreement active/version before and after its authority audit, and refuses removal of a previously stored agreement. No provider is enabled and no credentials or identity bypass is introduced.

`tests/service-dispatch-contract.mjs` passes 85 checks, including all eight real catalogue IDs with an implicit active agreement, suspension before the first fresh read, suspension during the audit window and stored-agreement removal. Tests now use catalogue IDs for agreement keys. The new suspension case failed before the prefix fix. These tests run the actual gate with injected fresh state and audit storage, then verify no transport continuation when refused. Existing EHR execution checks (12) and independent frontline handler checks (109) pass; build and TypeScript pass. The existing client bundle warning remains. Evidence: `tests/evidence/service-dispatch-review/`. No hosted or live-provider acceptance is claimed.

## Separately open domain checkpoint findings

Actual `executeEhr`, `publishAuthority` and bundle construction with injected CAS persistence/transport reproduced two additional gaps. At the second service authority audit (the POST boundary after Patient GET and EHR's fresh domain check), changing the saved organisation to maintenance or withdrawing exchange permission and advancing person/consent versions still allowed one clinical POST and stored an accepted publication. This is recorded in `open-domain-findings.json`; it is a finding, not passing safety evidence.

The proposed follow-up is an explicit transport intent plus a caller-owned domain authorization callback, checked on both fresh reads around service audit. New clinical sends must repeat permission, version, purpose, visit and operating checks. Receipt-only lookups must retain their uncertainty semantics and maintenance availability, and must never resubmit a payload. The application must not globally block receipt resolution as a shortcut.
