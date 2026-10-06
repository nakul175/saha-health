# Independent a408 hosted-failure investigation

5 October 2026. Isolated base `a40810fb86a840c7c02132436e9ab9ddf0c52707`; frozen-figure repair and canonical work are separate. Hosted engineering37284887081/job111681316304 failed source retrieval, reminder opt-out and work-burden anonymous transport. This batch does not claim that hosted engineering passes.

## Work-burden refusal transport

The attribution/support POST wrappers returned early identity refusals without consuming their request bodies. They are intentionally unmeasured: adding request metrics would change their metadata/privacy contract. Actual built Worker/D1 normal pooled fetch and streamed requests reproduce44 transport failures among320 requests, with276 correct401/403 responses. Failure kinds include EPIPE and socket errors; later cross-site requests can fail after an earlier unread same-origin refusal. All five diagnostic/audit/receipt/metric ledgers remain empty.

The narrow repair adds transport-only bounded discard in each POST wrapper's finally block. It never parses or retains discarded bytes, changes identity authority or widens the1,200/2,000-byte business schemas. The256 KiB cleanup bound matches the existing global cross-site refusal; it does not promise reuse of connections carrying arbitrary unbounded bodies. No mutation is retried and no Connection-close workaround is used.

The identical320-request sequence succeeds320/0 after repair. Five unchanged-table assertions yield325 checks. The original17-check anonymous auth-first regression also passes. `tests/work-burden-transport-http.mjs` is a new counted positive suite; it asserts zero transport failures after retaining its numeric report. Its diagnostic predecessor and original failing report are preserved separately.

## Source retrieval fixture

The original single peer configured a100ms acquisition deadline for every scenario, including an outbound callback that waits for an actual governance withdrawal command and D1 persistence. A controlled300ms callback delay reproduces the hosted502 timeout versus intended409 revision refusal at the same caller. The timeout can preempt the authority race rather than prove the final revision check.

The fixture now uses the existing normal10-second bounded acquisition deadline for success and real governance/member races. A separate worker retains exactly the100ms timeout scenario against a400ms controlled peer, and still requires502 and zero acquired-document rows. Production retrieval limits, server guards and assertion minimum41 are unchanged. The delayed real-command race passes the full41-check suite after the split, including the independent timeout-specific scenario.

## Reminder restart remains unresolved

The exact original reminder suite passes55 locally, and12 actual original-helper restarts plus first metadata/anonymous/foreign requests pass36. These results do not explain the repeated hosted503. No readiness helper change is shipped, no mutation retry is added, and the historical hosted failure remains a publication/CI investigation limit. Root retains the complete hosted log. More evidence is required before attributing it to the first Ready log or changing helper readiness.

## Evidence and integration

`tests/evidence/ci-transport-review/` retains matched before/after transport reports, controlled source-race drivers/logs, original reminder55 and restart36 observations, and fresh build/type evidence. Before/race/restart probes are diagnostic only; they are not positive catalogue entries. Parent owns the catalogue/CI declaration for the new325-check transport suite and combined canonical/hosted verification. This local batch does not promote clinical, device or external acceptance.
