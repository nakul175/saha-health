# Support queue visibility repair

Non-owner workers could lose their own pending support request when51 newer unrelated requests existed for the same visit. The query limited the global latest-request set before applying requester/helper visibility.

Visibility now belongs inside SQL before the bound. Current operators retain all current visit workflows; other current scoped care users receive only requests where they are the requester or current helper. Stable ordering and51-row sentinel retain a50-row response with overflow derived from the authorized set. Durable aggregate read audit and fresh role/owner/patient checks remain unchanged.

Eleven actual local Worker/D1 checks passed: an older care request survives51 unrelated owner requests, its assigned helper can find and attest it, and the requester can acknowledge it. Unrelated care users see no entries or false overflow. More than50 genuinely visible requests set overflow and repeated reads preserve order. Faulted read audit returns503 without rows; patient-scope withdrawal returns403; the audit chain stays intact. Production build passed. This is internal fixed-category support metadata, not external helpdesk acceptance.
