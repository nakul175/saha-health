# App-first baseline and local memory investigation

5 October 2026 IST. Source started from GitHub main `2adfbde1369b854d71962918bad3b81fdac746fe`, including the merged 13a–13f fixes. This record does not change formal acceptance.

## Baseline findings and corrections

The initial 130-suite unit run passed 127 suites and exposed three failures. The synthetic transport suite needed permission to start its loopback server; its rerun passed seven checks. The EHR resolution suite exposed a real equal-millisecond ordering defect: a new publication prepared in the same millisecond did not suppress an already resolved not-stored exception. The queue now uses append order only to break equal timestamps. Different links, earlier timestamps and unresolved conflicts retain their existing handling. The 13-check EHR suite now passes with explicit tie, other-link and earlier-time scenarios.

The report receiver recipe depended on GNU `head -n -2`, which fails on macOS. The recipe and its seven-check suite now use portable `sed` and `shasum`, preserving exact CSV bytes. TypeScript and the original production build passed. Combined feature validation remains a separate integration gate.

## Memory measurement

The memory suite previously skipped macOS entirely. It now reads a process ancestry snapshot using `ps`, samples only the Miniflare instance's own workerd descendants, and reports RSS. Missing processes are errors, not zero-memory observations. Anonymous, file-backed and shared memory are unknown on macOS and recorded as null. Linux retains `/proc` sampling. Six checks using actual allocated child processes verify ownership, real resident memory, unknown breakdown values, invalid IDs, cyclic ancestry and disappearance handling.

An initial local run used three rounds of 500 workspace loads at concurrency four, after 100 warm-up loads. All 1,601 requests returned 200. Resident growth per load slowed from 400.80 to 169.15 to 86.66 KiB, and final process RSS was approximately 504 MiB. The suite's loose regression threshold passed; its plateau criterion did not. This is evidence to continue the O-2 investigation, not proof that memory growth is fixed. A longer follow-up is recorded separately after it finishes.

This measures the local workerd process, including runtime and native memory, not the hosted Cloudflare isolate's 128 MiB heap limit. The synthetic organisation is small and there is only one identity and route. Hosted and representative-scale qualification remain pending.

Evidence: `tests/evidence/app-first-baseline/`; dated reports preserve both initial failures and focused follow-ups. No real patient records, messages or partner calls were used.

The extended run used eight rounds of 1,000 loads after 100 warm-up requests. All 8,101 requests returned 200. Growth per round was 264.93, 67.47, 48.99, 32.80, 43.34, 17.65, 13.89 and -1.15 KiB per load. Final RSS was 661.8 MiB; the seven post-first rounds averaged 31.86 KiB per load, above the 10 KiB plateau criterion. Growth slows and the final round falls, but this does not prove a plateau or close O-2. Evidence: `memory-growth-extended.json`.
