---
id: 004
title: What does storage actually cost?
type: research
status: closed
assignee: carlo
blocked_by: [002]
---

## Question

"Cheap" was a founding constraint. Put numbers on it.

The dangerous cost here is **egress**, not storage. A public warehouse whose whole
point is downloading files, on a provider that bills per GB out, has a bill that
scales with success. Some providers charge zero egress; that difference dominates
every other line item.

Using real byte sizes from
[Get real .xer files to work against](001-get-real-xer-files.md) and the parse
output shape from [How is a .xer file structured?](002-xer-file-structure.md):

- **Model the per-programme footprint.** Raw `.xer`, gzipped `.xer`,
  `parsed.json`, `derived.json`, one Postgres row plus its indexes. Then model
  three scales: 100, 1,000 and 10,000 programmes, at a plausible revisions-per-
  programme multiple.
- **Price blob storage.** Cloudflare R2, Vercel Blob, Supabase Storage,
  Backblaze B2, plain S3. Storage, writes, reads, and egress separately — and note
  which of them have a genuinely free tier and what happens the moment it is
  exceeded.
- **Price Postgres.** Neon, Supabase, and anything else worth a look. Free tier
  limits, what triggers the first bill, and whether the instance sleeps (which
  would show up as a cold first page load on the storefront).
- **Price the CDN path.** Public blobs should be cacheable; work out what
  fraction of reads actually reach origin and whether the CDN is free.
- **Find the cliff.** At what traffic level does this stop being free, and what is
  the monthly bill on either side of that line? That number, not the per-GB rate,
  is the decision.
- **Compression.** `.xer` is verbose text and compresses hard. Quantify it —
  serving gzipped may move the cliff more than switching provider does.

Produce `docs/wayfinder/tickets/assets/storage-cost-model.md` with the working, and
put the recommendation plus the cliff number in the resolution.

## Resolution

Full working, with measured byte sizes and sourced 2026-08-07 vendor prices:
[`assets/storage-cost-model.md`](assets/storage-cost-model.md).

**The premise was wrong in a useful way. Egress is not the dangerous cost — there
isn't one.** At 10,000 programmes and busy traffic the entire blob bill is **under
$1/month on every provider priced**, S3 included. A gzipped `.xer` is ~600 KB, so
1 TB of egress is **~1.75 million downloads a month**; that is where providers
finally diverge ($0 R2 / $9 B2 / $48 Vercel Blob / $68 Supabase / $81 S3) and this
project does not get there without becoming something else.

**The cliff is the platform floor, not the bytes.** It is crossed when the database
may no longer sleep, or the host's free plan no longer permits what the site is —
both at essentially zero traffic. Below it **$0/month**, carrying ~4,000 programmes
on R2's free 10 GB. Above it **~$20–45/month** (Vercel Pro $20 + always-on Neon
~$19 + R2 ~$0.25), and that number is **flat in corpus size**.

**Measured footprint**, from three real fixtures parsed and re-serialised:

| | Fixture A baseline | Fixture A progressed | Fixture B variant 1 |
|---|---|---|---|
| `.xer` gzipped | 403 KB | 584 KB | 872 KB |
| full `parsed.json` gzipped (columnar) | 419 KB | 623 KB | **919 KB** |
| activity subset + codes gzipped | 185 KB | 194 KB | 277 KB |

**A full `parsed.json` gzips to the same size as — on Fixture B, larger than — the
`.xer` it was parsed from.** Gzip already exploits the repetition that made the
`.xer` verbose. Storing one doubles the blob footprint and buys no transfer saving
over re-parsing. This is **evidence against the standing hybrid-ingest decision**,
which named a "fuller `parsed.json`" as a stored artifact; the map's Notes are
updated. What replaces it is an **`activities.json`** — a columnar cut of
`PROJECT`/`PROJWBS`/`CALENDAR`/`TASKPRED` plus 24 `TASK` fields, at 185–277 KB
gzipped, a **3.2× saving** over shipping the whole file to a browser.

**Store per revision: `raw.xer.gz` + `activities.json.gz` + `derived.json.gz` ≈
0.85 MB.** 10,000 programmes at 3 revisions each = **25.5 GB**.

**Postgres is a rounding error** — ~2 KB per revision, **~150 MB with indexes at
10,000 programmes**, inside both Neon's and Supabase's free 500 MB. Postgres *size*
never binds; Postgres *uptime* does.

**Recommendations:**

1. **Cloudflare R2** for blobs — $0.23/month at 10,000 programmes, and zero egress
   as a structural property rather than an allowance. It wins on risk, not price.
   **Not S3, not Supabase Storage** — both bill egress at $0.09/GB.
2. **Neon** for Postgres. Free plan holds the whole corpus; scale-to-zero costs a
   few hundred ms on the first query after idle. **Supabase Free pauses the project
   after a week of inactivity — disqualifying for a public storefront.**
3. **Serve gzipped**, stored pre-compressed, immutable, CDN-cached. Measured
   7.1–8.3:1. This moves the egress cliff out **8×** (218K downloads/TB → 1.75M)
   and is worth more than any provider switch short of R2.
4. **Store forks as full copies.** Fixture B's siblings differ by <0.4% of rows at
   99.97% of the bytes; delta-compression would save ~$0.30/month on R2.

**Flagged for [Stack, hosting and auth provider](010-stack-hosting-auth.md):**
Vercel's Hobby plan is intended for non-commercial use. Monetisation is out of
scope so the site may qualify, but a public site with accounts and uploads is close
enough to the line to check rather than assume — if Hobby is out, the floor is $20
from day one.

**Incidental parser finding**, carried to
[Upload and ingest pipeline](011-upload-ingest-pipeline.md): byte `0x81`, undefined
in CP1252, appears **28,774** times in Fixture A progressed and **31,485** times in
Fixture B, and none at all in the Fixture A baseline. Strict CP1252 decoding
**throws**. Decode with a replacement or passthrough policy, never strict.

**Largest remaining unknown:** whether the detail page fetches `activities.json` at
all or pages the activity table through an API. That swings per-open egress 16×
(245 KB vs 15 KB) and belongs to
[The project detail page](008-project-detail-page.md). It does not change the
recommendation — even the expensive branch is 24 GB/month at busy traffic.

### Amendment 2026-08-08 — [What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md)

**The cache header was priced for reads and never for un-publishing.** This ticket fixed
`Cache-Control: public, max-age=31536000, immutable` on every blob, which is correct for
cost and wrong for takedown: against a year-long immutable edge cache, deleting the R2
object does not make 003's *bytes hard-delete* true. The file stays downloadable from a
public, unsigned URL for up to twelve months, and 013 established `original.xer.gz` is the
sole carrier of personal data.

Two changes, neither disturbing the cost model:

- **`original.xer.gz` drops to `max-age=3600`, no `immutable`.** `activities.json.gz` and
  `derived.v{N}.json` keep the year — version-stamped, hot, and PI-free by construction.
  This costs extra Class B reads at $0.36/million on a file fetched only when someone
  deliberately clicks Download; the shelf is Postgres and the detail page pulls
  `activities.json`. It joins `X-Robots-Tag: noindex, noarchive` on the same object, so the
  PI-bearing blob is now served under one coherent set of different terms.
- **A verified Cloudflare purge becomes step 3 of every takedown**, after the origin delete
  and never before it. Purge-by-prefix and purge-by-tag are Enterprise-only; **purge by
  explicit URL is available on every plan**, and 005's id-addressed keys make the URL list
  computable exactly — three deterministic URLs per Revision, no bucket listing.

This ticket's own finding that "the CDN cuts ops, not bytes" is what makes the TTL change
free — and its sub-$1/month blob bill is what makes 017's 30-day Class B quarantine cost
nothing worth measuring.
