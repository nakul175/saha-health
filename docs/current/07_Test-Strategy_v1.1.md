# Test strategy

Since round 11 (3 October 2026) the layers, commands and CI tiers are described in [Testing Saha](TESTING.md); this page keeps the evidence rules.

Maintain three separate evidence layers: the original acceptance definitions, executed engineering assertions and formal requirement decisions. Their counts cannot be substituted for one another. The [original strategy](../reference/07_Test-Strategy_v1.0.md) retains all 28 BRD quality requirement methods and twelve journey definitions.

| Layer | Current evidence | Required interpretation |
| --- | --- | --- |
| Target acceptance catalogue | 364 unchanged definitions | All formally Not run; related source paths are context only |
| HTTP and D1 integration | 902 saved R11 assertions; 4,599 on 3 October 2026 | Real local built Worker and isolated synthetic database |
| Contracts/checkpoints/client policy | 361 saved assertions; 7,193 on 3 October 2026 | Includes injected HTTP/CAS and minimal DOM/storage/service-worker stubs |
| Local encrypted recovery | 21 saved assertions | Fresh local restore, complete schema/table digests and restarted Worker reads |
| Browser observations | Release narratives in VALIDATION; since round 11, 17 automated Playwright journeys with screenshots and axe | Chromium only, synthetic local Worker; not real devices |
| Smoke, security, performance, memory, load (round 11) | Local smoke, hosted smoke, authorisation matrix, identity hardening, performance budgets, memory growth, load burst | Local Worker on a shared machine; not Cloudflare numbers; see [Testing Saha](TESTING.md) |
| External and field qualification | Open | Live partners, providers, devices, clinical/security/accessibility/scale evidence required |
| Formal BRD acceptance | 176 pending | Named decisions against exact criteria, not inferred from test totals |

## Tests for the next code change

Choose tests from the changed invariant. For external execution, cover checkpoint-before-send, stale/revoked authority, a confirmed outcome, timeout/uncertainty, receipt-only lookup, proven nonacceptance, exact-key retry, payload mismatch, interrupted final persistence and correction linkage. For scope changes, cover another organisation, another team, direct worker assignment, supervisor write denial and administrator PHI denial.

For migrations, test a populated database upgrade, immutable historical evidence, rollback on a failed guarded write, subsequent reads and restore. For field changes, use actual supported devices and IndexedDB/service workers before claiming device durability; Node stubs alone are insufficient. For clinical/model changes, pin data and model/content versions and evaluate by language, population, missingness and failure type with accountable review.

A formal catalogue execution record should include case ID, build/configuration, fixture/protocol, environment, preconditions, observed steps, actual result, evidence URI/digest, defect, executor and reviewer. Mark blocked/skipped honestly. Do not update every test linked to a requirement to Pass after one bounded assertion passes.

## Reproducibility and fixtures

Use synthetic fixture constructors in `tests/` and exact local setup from [Development and CI](DEVELOPMENT-AND-CI.md). Test identity headers model the trusted dispatcher only in the isolated local process. Never send those fixture headers or run test-reset commands against the hosted Site. Do not add real records to a fixture.

The original `engineering/reference_model.py` and its saved checks are archived design evidence. They are not the running application, and their passing totals are excluded from R11's 1,284. Documentation integrity checks likewise do not increase product assertion counts.

See [test catalogue](TEST-CATALOGUE.csv), [execution register](EXECUTION-REGISTER.csv), [Qualification](../QUALIFICATION.md) and [release gates](10_Pilot-and-Release-Acceptance_v1.1.md).
