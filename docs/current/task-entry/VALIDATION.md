# Actual deterministic task-entry checks — 12 October 2026

Canonical SAHA-040/APL-63; ENG-BR-AG-01/APL-223. Development-only source from
main22a271033eaa57e124a235fc615744928f1ac106. Original BR-AG-01, CWO-007 clauses,
formal TC-BR-AG-01-A/B and full related APL-10 remain pending.

The new /task-entry page has two explicit navigation shortcuts and a closed,
bounded ASCII phrase parser. Both proposals point to the existing /today route.
The worker still explicitly chooses the assigned person, checks the record and
uses the existing Review routine visit control. No person/org is guessed, no
model/provider is called and no automatic command or persistent proposal is added.
Unsupported text, embedded instructions and patient-chat requests yield a clear
limitation. Correcting or cancelling removes the local proposal.

Final native execution: 36 parser checks and 25 real built-backend/mobile-browser
checks pass,0failed/0skipped, with fresh native build. Type checking and catalogue
classification pass. Original389 guard objects/criteria/source remain unchanged;
new36/25 minima and controller CI wiring still require additive reconciliation.

The actual browser verifies zero launcher API/provider calls; all60 native table
row-count/content hashes equal across launcher proposal/refusal/cancel/correction;
same visual/phrase route, correct assigned record/org in existing routine flow;
no navigation POST,visit or command receipt; changed assignment404 and ineligible
role403 refusal. Protected-read audit/metrics and deliberate synthetic setup and
revocation occur separately from the zero-write launcher comparison.

Mobile390x844: no horizontal overflow,44px control geometry, actual input1px solid
border rgb(84,121,104) against rgb(246,250,248) background; the typed/focused
screenshot visibly shows the field and focus. All718 observed app/lib,this-test
and compiled-file pins stay unchanged during final run; owned runtime disposed.
These are observations, not archived compiled bytes or complete dependency custody.

Failures retained: initial default sandbox loopback EPERM before any checks;
owned001 and002 each fail after2 checks because seven actual CSS/JS asset URLs
return404 in the Miniflare Worker-first fixture. Diagnostic003 retains console,
response,HTML and screenshot evidence. The final fixture uses the existing native
generated-assets-first option; missing/API routes still reach the real Worker,
without intercepting/substituting responses. An explicit mounted-ready gate keeps
SSR controls disabled until usable. No assertion,timeout or original minimum was
relaxed. Visual005 found the input invisible under the global reset; an explicit
border/background fixed it and final007 adds the actual computed-style check.

Author receipts remain in outputs/saha-next50-20261012/task-entry in the adopting
workspace. Final independent review, repository-wide native metadata/baseline/CI,
merge and observed staging are separate. No full story,live model,clinical/field,
qualified language,physical device,p95,UAT or hosted acceptance is claimed.
