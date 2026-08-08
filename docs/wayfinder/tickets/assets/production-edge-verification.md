# Verifying the production-only edges — assertions, bucket document, checklist

Working notes for
[Verifying the production-only edges](../024-verifying-production-only-edges.md).
The decisions are in that ticket's `## Resolution`; this file is the enumerated
detail it links to rather than pastes.

---

## 1. Three layers, and what each one can vouch for

The four behaviours 018 flagged are not one gap. They sit at three layers, and
each layer has exactly one verifier that can speak for it.

| Layer | What can be wrong | Who can prove it right | Where that runs |
|---|---|---|---|
| **Our code** | the presign stops signing `Cache-Control` / `X-Robots-Tag`; the CORS document in the repo is wrong | a PUT through the product presign into MinIO, then HEAD the object back | CI, every PR, no secrets |
| **R2** | R2 stops storing a signed `x-robots-tag` as object metadata; the live bucket CORS is not the repo's document | a PUT through the product presign into real R2; `GetBucketCors` diff | sweep (PUT); laptop (`ops bucket check`) |
| **The edge** | Cloudflare strips a header, overrides the TTL with a Cache Rule, or a purge does not take | HEAD the public blob-host URL and read what the edge served | sweep; and `takedown apply` step 3 |

MinIO can prove our code signs the header. Only R2 can prove R2 stores it. Only
the CDN can prove the edge serves it. That is why the canary is re-minted through
the production presign on every sweep run rather than uploaded once by hand — a
static canary passes through all three layers exactly once, on the day it was
created, and is green forever afterwards regardless of what any of them do next.

---

## 2. Assertion list

Naming convention: assertions are referred to by key, never by URL or value. Keys
are safe to print; subjects are not (019 — public repo, world-readable Actions
logs).

### 2.1 CI — `pnpm test:edge-contract`, on every PR including forks

Runs against the 018 compose stack (MinIO). No secrets, no hosted accounts, no
network beyond localhost. Blocking: this job is a required status check on `main`.

| Key | Method | Expect |
|---|---|---|
| `ci.presign.original.cache_control` | call the product presign for the `original.xer.gz` role | signed headers include `cache-control: public, max-age=3600` and **no** `immutable` |
| `ci.presign.original.x_robots_tag` | same call | signed headers include `x-robots-tag: noindex, noarchive` |
| `ci.presign.derived.cache_control` | product server-side PUT helper for `derived.v{N}.json` | `cache-control: public, max-age=31536000, immutable` |
| `ci.presign.activities.cache_control` | same, `activities.json.gz` | `cache-control: public, max-age=31536000, immutable` |
| `ci.roundtrip.original` | execute the presigned PUT against MinIO, then `HeadObject` | response carries both headers back, byte-identical to what was signed |
| `ci.roundtrip.derived` | server-side PUT then `HeadObject` | year-long `immutable` returned |
| `ci.cors.document_applies` | `ops bucket apply` against MinIO | exits 0 |
| `ci.cors.preflight` | `OPTIONS` the object endpoint with `Origin: http://localhost:3000`, `Access-Control-Request-Method: PUT`, `Access-Control-Request-Headers:` **the exact list the presign signed** | `Access-Control-Allow-Origin` echoes, `PUT` allowed, every signed header allowed |
| `ci.cors.foreign_origin_refused` | same with `Origin: https://evil.example` | not allowed |
| `ci.robots.object_written` | `ops bucket apply` then `GetObject /robots.txt` | body is `User-agent: *\nDisallow: /` |
| `ci.download_link.nofollow` | render the detail page download link | `rel="nofollow"` present (013) |

`ci.cors.preflight` deriving its request-header list **from the presign's own
output** rather than from a constant is the point of it: it is what makes "the
presign changed" and "CORS is now wrong" the same test failure instead of two
unrelated ones discovered six weeks apart.

### 2.2 The sweep — rule `edge_drift`, every 15 minutes

Runs inside `/api/sweep` on Vercel, with the R2 credentials the app already holds
for ingest. Adds no secret anywhere. Returns breaches into 019's existing
`{ok, breaches[]}`; the workflow still prints one boolean.

| Key | Method | Expect |
|---|---|---|
| `edge.canary.minted` | presign + PUT the canary (§3) through the product code path | PUT succeeds |
| `edge.canary.cache_control` | HEAD the canary's **public blob-host URL** | `public, max-age=3600`, no `immutable` |
| `edge.canary.x_robots_tag` | same response | `noindex, noarchive` |
| `edge.canary.derived_cache_control` | HEAD the canary's `derived.v{N}.json` | `public, max-age=31536000, immutable` |
| `edge.canary.not_stale_beyond_ttl` | same response `age` / `date` | freshness consistent with a 3600 TTL — catches a Cache Rule overriding Edge TTL upward |
| `edge.cors.preflight` | unauthenticated `OPTIONS` to the S3 API endpoint with the **production** origin and the presign's signed-header list | allowed |
| `edge.robots_txt` | HEAD `https://<blob-host>/robots.txt` | `200` |

Breach payload is `{rule: "edge_drift", failed: ["edge.canary.x_robots_tag", …]}`
— keys only. No URLs, no header values, no object ids. `/ops` renders the key
list from the last `sweep_run`; the operator reproduces the detail from a laptop.

**Why every run rather than throttled.** Two HEADs, one OPTIONS and three PUTs per
run is ~96 Class A and ~8,600 Class B operations a month against free tiers of 1M
and 10M. Throttling would need a `last_checked_at` column on `alarm_state` to
avoid re-evaluating, i.e. a schema change bought to save nothing. 019's
transition-then-daily suppression already solves the only real cost of frequent
evaluation, which was mail volume, not requests.

**Accepted lag.** The HEAD reads the edge, so it reads a cached response up to one
TTL old. A fixed header therefore takes up to an hour plus one run to go green,
and a broken one up to the same to go red. That is not a defect in the check; it
is what a one-hour TTL means, and asserting against a cache-busted origin fetch
would test the wrong layer.

### 2.3 The laptop — `ops bucket check` and `takedown apply`

Needs the R2 **admin** token, which is why it is not in the app or in Actions.

| Key | Method | Expect |
|---|---|---|
| `ops.cors.matches_repo` | `GetBucketCors` against production, diff against `ops/bucket/cors.json` | identical |
| `ops.robots.matches_repo` | `GetObject /robots.txt` | identical to `ops/bucket/robots.txt` |
| `takedown.purge.landed` | after step 2 delete + step 3 purge, plain `GET` the purged public URL (no cache-buster) | **non-200** — this is the definition of "verified purge" 017 owed, and only when it holds does `bytes_deleted_at` get written |

`takedown.purge.landed` is the whole of the purge answer. 019's rule 4
(`reconciler_stuck`) already alarms on `bytes_deleted_at` staying null for an
hour, so an unverified purge was already alarmed — what was missing was a
definition of what "verified" writes that column.

---

## 3. The canary

- **A reserved uuid, not a reserved prefix.** The key is
  `{CANARY_REVISION_UUID}/original.xer.gz`, built by the same key-construction
  code every real revision uses. A reserved prefix would need a branch in the
  presign, and a branch in the presign is the thing the canary exists to watch.
- **No Postgres row.** So it is invisible to the shelf, to `/ops` counts, to
  017's purge list (computed from Revision rows) and to every one of 019's four
  rules. Nothing has to learn to ignore it.
- **The bytes are a committed synthetic fixture** — smallest file from 012's
  correctness corpus, ~1 KB gzipped, generated, zero PI. It must be synthetic
  rather than real precisely because the repo is public and names the uuid, so
  the URL is guessable by construction.
- **Overwritten, never appended.** Same idempotent-overwrite property 019 fixed
  for partial ingest; storage stays ~1 KB forever.
- **Three objects, not one.** The rule also writes the canary's
  `derived.v{N}.json` and `activities.json.gz` through the same server-side PUT
  helper ingest uses, so the year-long `immutable` on the other two writers is
  asserted too rather than assumed.
- **It does not exercise the browser.** A browser that fails to send a signed
  header gets a SigV4 mismatch and a 403 — loud, at the uploader, immediately —
  so the uncovered case is the one that cannot be silent.

Residual lie, stated: the canary proves the presign is correct *for the canary's
key*, and real objects differ from it only in the uuid. Anything that branches on
the key defeats it. Nothing does, and nothing should.

---

## 4. The bucket document

Lives at `ops/bucket/` in the repo. Applied by `ops bucket apply`, which is
endpoint-agnostic: compose and CI point it at MinIO, the operator points it at
R2. The same document, applied twice, is what makes 018's local CORS and
production CORS the same object rather than two things that resemble each other.

### `ops/bucket/cors.json`

```json
[
  {
    "AllowedOrigins": ["https://<site-origin>", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": [
      "content-type",
      "cache-control",
      "x-robots-tag",
      "x-amz-*"
    ],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

`cache-control` and `x-robots-tag` are in `AllowedHeaders` **because the presign
signs them**: a SigV4 presigned PUT requires the client to send every header in
`SignedHeaders`, and a browser sending an author-set header needs it allowed at
preflight. So 013's header and 017's TTL are not merely *checked* alongside CORS
— they are the reason two of these lines exist. `content-length` is deliberately
absent: browsers set it themselves and forbid authors from setting it, so it
never appears in `Access-Control-Request-Headers`.

### `ops/bucket/robots.txt`

```
User-agent: *
Disallow: /
```

PUT to the bucket root with `content-type: text/plain` and the year-long
`immutable` header. 013 asked for this and no code path has ever written it —
it is the fifth production-only artefact, and 018's flag listed four.

### `ops bucket`

```
ops bucket apply    # PutBucketCors + PUT /robots.txt against $S3_ENDPOINT
ops bucket check    # GetBucketCors + GET /robots.txt, diff vs repo, non-zero on drift
```

Two verbs on 017's existing CLI, which already carries `takedown`, `ingest` and
`report` noun-spaces. No new tool.

### What deliberately does **not** become code

- **Custom domain, public access, Cache Rules, Transform Rules, WAF** — all
  Cloudflare-shaped, none reachable through the S3 API. They stay dashboard steps
  in `docs/operating.md`, and §5 gives each one a runtime assertion so the
  checklist's known weakness (done once, never again) is covered by something
  that runs every fifteen minutes.
- **Lifecycle rules — there are none, on purpose.** Every clock in this system is
  a Postgres predicate the sweep evaluates: 011's 24 h reap, 017's 30-day
  quarantine, 019's windows. A bucket lifecycle rule would be a second scheduler
  with its own state, drifting silently against the rows. The bucket holds no
  policy at all beyond CORS.

---

## 5. Provisioning checklist → assertion map

For `docs/operating.md`. Every manual step has a runtime assertion that fails if
the step was skipped, mis-done, or later undone.

| # | Manual step (Cloudflare dashboard) | Backed by |
|---|---|---|
| 1 | Create the R2 bucket | every assertion |
| 2 | Attach a **custom domain** on a Cloudflare zone you control | `edge.robots_txt`, `takedown.purge.landed` |
| 3 | Confirm no Cache Rule overrides Edge TTL for the blob host | `edge.canary.cache_control`, `edge.canary.not_stale_beyond_ttl` |
| 4 | Confirm no Response Header Transform Rule strips or adds headers on the blob host | `edge.canary.x_robots_tag` |
| 5 | Mint the app's R2 token — **object read/write only** | `edge.canary.minted` |
| 6 | Mint the operator's R2 **admin** token (local `.env`, never in Vercel or Actions) | `ops.cors.matches_repo` |
| 7 | Mint the purge-scoped Cloudflare API token (017) | `takedown.purge.landed` |
| 8 | `ops bucket apply` against production | `edge.cors.preflight`, `edge.robots_txt` |
| 9 | GitHub: branch protection on `main` requiring the CI job | — nothing can assert this; it is the same class as 019's flagged "notifications must be on" |
| 10 | GitHub: Actions failure notifications on (019) | — same |

Steps 9 and 10 are the two that no code can check, and they are both GitHub
account settings rather than anything in the estate. They join 019's existing
flag rather than starting a new category.

---

## 6. Implementation hazards

1. **AWS SDK v3 default checksums.** SDK releases from early 2025 compute a
   request checksum by default (`requestChecksumCalculation: "WHEN_SUPPORTED"`),
   adding `x-amz-checksum-crc32` to PUTs. On a presigned browser PUT this
   silently becomes a required signed header the browser must send and CORS must
   allow, and it has broken R2 and MinIO integrations widely. `x-amz-*` in
   `AllowedHeaders` covers it; `ci.cors.preflight` deriving its list from the
   presign's own output catches it the day a `pnpm update` changes the default.
   This is the concrete reason the CI half is not paranoia: **the set of signed
   headers is a dependency's decision as much as ours.**
2. **`HEAD` versus ranged `GET` at the edge.** If Cloudflare's HEAD handling on
   an R2 custom domain turns out not to return the cached response's headers
   faithfully, use `GET` with `Range: bytes=0-0` instead. Assert the same keys
   either way; do not add a cache-buster, which would test the origin.
3. **`X-Robots-Tag` must survive as object metadata.** S3 stores it and returns
   it on GET; R2 documents the same. This is the one assertion where MinIO's
   agreement proves nothing about production, and it is why the canary PUT
   happens against real R2 rather than only in CI.
4. **The preflight is unauthenticated.** `OPTIONS` needs no credentials — it is
   exactly what a browser sends — so `edge.cors.preflight` costs the sweep no
   secret and could in principle run from anywhere. Confirm R2 answers preflight
   on the S3 API endpoint at provisioning time; if it only answers on the custom
   domain, point the assertion there and note that the presign target and the
   preflight target then differ.
5. **`r2.dev` cannot be purged.** The public `r2.dev` URL is not in the
   operator's zone, so the Cloudflare purge API cannot touch it — which makes a
   custom domain a hard requirement of 017's step 3 rather than a nicety. Filed
   as its own ticket; see the resolution.
