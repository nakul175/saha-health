# B19 guarded source acquisition and immutable cache

The Source library now provides upload and exact approved-origin retrieval of a new immutable acquired-document revision. The existing independent clinician review and owner activation gates remain mandatory. This is synthetic/training software validation; actual licensed clinical acquisition and clinical acceptance are pending. No live publisher was contacted or enabled.

## Authority and retrieval

Trusted identity, original organisation and current manager membership are checked before reading the large body. The requested URL must equal the edition URL already held by the scoped source package. `SAHA_CLINICAL_SOURCE_FETCH_ENABLED=true` is a dedicated acquisition switch; it is absent/off by default. `SAHA_CLINICAL_SOURCE_ORIGINS` must contain the exact HTTPS origin. It cannot enable AI, messaging or other external providers. Credentials, cookies, identity headers and patient data are never forwarded. No redirects, credential URLs, fragments, nonstandard ports, localhost/private literal addresses or unapproved origins are accepted. Configuration must not allow origins that resolve to private infrastructure; no dynamic user-selected origin is authorized.

The caller supplies an expected SHA256 and a licence-evidence reference. These are integrity and review inputs, not evidence of approved rights or clinical correctness. GET has a bounded timeout (default 10 seconds, configurable 100–10000ms), MIME/UTF8 checks, Content-Length validation and a stream byte cap. Successful acquisition records exact URL/origin, expected/actual SHA, acquisition time and method in the immutable package manifest. Membership role/version, source version/manifest and expiry are rechecked after retrieval. A changed authority or edition cannot commit a cached object or successful receipt. Exact accepted-key replay returns the original acquisition outcome without another external fetch.

## Practical size and presentation

Decoded content is limited to 512 KiB. Both UTF8 bytes and PDF decoded bytes count; character counts cannot bypass the limit. Canonical PDF base64 is about 699 KiB at this boundary. Incoming JSON is separately limited to 1,100,000 encoded bytes while streaming. Highly escaped text may therefore hit the encoded-body cap before the decoded cap. The text UI accepts up to 700,000 characters, with the server enforcing the byte caps.

Content uses bound D1 parameters and the existing immutable `clinical_source_documents` table. The official [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/) specify a 2,000,000-byte maximum row/string/BLOB and 100,000-byte maximum SQL statement; the 512 KiB decoded cap leaves room for base64, the metadata and row fields without embedding content in SQL text. Migration 0025 had no SQL byte constraint, so its applied schema is unchanged and no 0027 migration is necessary. Existing valid 8 KiB content references remain valid and unchanged.

Text is displayed as escaped text. PDF requires strict MIME/base64/magic and refuses known active markers, but this is not a general PDF sanitizer. PDFs are download-only with attachment disposition, `nosniff` and a sandbox/default-src-none response policy. Arbitrary HTML is unsupported. Scoped reads require current permission, exact digest, unexpired content and a durable read audit. API responses are private/no-store and never added to the public service-worker cache. Historical citations and signed outputs keep their previous shape; acquired findings add the exact immutable source document reference.

## Evidence and external limits

`tests/clinical-source-fetch-contract.mjs` covers disabled configuration, exact origin/URL, credentials/redirects, MIME/encoding/length/digest, hung-fetch and hung-stream timeout, BOM preservation, 512 KiB UTF8/PDF base64 and active-marker rejection.

`tests/clinical-source-retrieval-http.mjs` exercises the built Worker and D1 with a controlled synthetic HTTPS peer: real 512 KiB text/PDF storage and download, encoded cap, replay without refetch, independent review/activation, redirect/MIME/size/timeout/digest failures, source change and membership removal while fetching, plus default-off no-outbound behavior. The phone harness exercises reachable acquisition controls, accepted-but-lost acknowledgement recovery and exact source view without clinical/licence approval.

All checks use synthetic fixtures. Actual publisher origin configuration, licence evidence validation, clinician acceptance, deployment acceptance and physical-device acceptance remain external. No native storage claim is made. This cache is governed server content; it is not an offline encrypted field-vault content distribution implementation.

Validated author results: 25 retrieval contract checks, 41 actual Worker/D1 controlled-peer checks, 9 real Chromium phone checks, and unchanged 16 source contract, 28 upload/cache HTTP and 7 identity HTTP checks. Fresh typecheck and production build pass. The phone test serves assets through wrangler and relays only source requests to the same built Miniflare handler sharing actual D1 state; its port-bound Origin is adjusted by the local fixture relay without relaxing production guards.
