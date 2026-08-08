# What storage actually costs

Working for [What does storage actually cost?](../004-storage-cost-model.md).
Prices checked **2026-08-07** against vendor pricing pages; every figure is sourced
at the bottom. Byte figures are **measured**, not estimated, from the fixtures in
[Get real .xer files to work against](../001-get-real-xer-files.md).

---

## Headline

**Bytes are not the cost. The always-on database is.**

At 10,000 programmes and busy traffic the entire blob bill is **under $1/month on
every provider priced here**, including S3. A gzipped `.xer` is ~600 KB, so it
takes **~1.75 million downloads a month** to move 1 TB — and 1 TB is where the
providers finally diverge ($0 on R2, ~$48 on Vercel Blob, ~$81 on S3).

The bill this project will actually pay is the **fixed platform floor**: a Postgres
that does not sleep, and a host that permits a public site. That is **$0/month**
while a free tier is tolerable and **~$20–45/month** the moment it is not.

Two design decisions move real money, and neither is a provider choice:

1. **Serve gzipped.** 7–8:1 measured. Worth 8× the traffic before the same bill.
2. **Do not store a full `parsed.json`.** Measured: gzipped it is the *same size as
   the gzipped `.xer` it was parsed from* — it doubles the footprint and buys
   nothing. See [The `parsed.json` trap](#the-parsedjson-trap).

---

## What was measured

Three real files, parsed with a `%F`-name-mapped reader (per the rule fixed in
[How is a .xer file structured?](../002-xer-file-structure.md)), serialised to
candidate JSON shapes, and gzipped at level 9. Script:
`scratchpad/size.py`, reproduced in [Method](#method).

| | Fixture A baseline | Fixture A progressed | Fixture B variant 1 |
|---|---|---|---|
| activities (`TASK`) | 1,746 | 1,751 | 3,344 |
| total rows, all tables | 44,390 | 58,648 | 63,623 |
| raw `.xer` | 2,874,706 | 4,835,280 | 6,810,660 |
| **`.xer` gzipped** | **402,845** | **584,027** | **872,104** |
| gzip ratio | 7.1:1 | 8.3:1 | 7.8:1 |
| `parsed.json` verbose (all tables, objects) | 8,424,856 | 12,695,234 | 18,120,178 |
| — gzipped | 508,164 | 722,238 | 1,083,888 |
| `parsed.json` columnar (all tables) | 3,896,902 | 7,062,174 | 9,686,860 |
| — gzipped | **419,133** | **623,261** | **918,608** |
| activity subset + codes, columnar | 1,726,946 | 1,666,861 | 2,335,779 |
| — gzipped | **184,929** | **193,773** | **277,023** |
| activity subset only, columnar | 853,334 | 872,448 | 1,620,829 |
| — gzipped | 106,275 | 119,880 | 208,696 |

"Columnar" is `{table: {fields: [...], rows: [[...]]}}` — field names written once
per table instead of once per row. "Activity subset" is `PROJECT`, `PROJWBS`,
`CALENDAR`, `TASKPRED` and a 24-field cut of `TASK` (identity, WBS, calendar,
dates, durations, float, status, `driving_path_flag`, `float_path`).

`derived.json` is **not** measured — it does not exist yet. Its contract fixes it
at **40–60 KB typical, 150 KB ceiling**
([the derived.json contract](derived-json-contract.md)); JSON that dense gzips
around 3.5:1, so **~15 KB stored** is the working figure.

### The `parsed.json` trap

The single most useful measurement here:

```
Fixture B      .xer gzipped              872 KB
               parsed.json gzipped       919 KB    ← larger than the input
```

The same holds on both Fixture A files. Gzip already exploits the repetition that
made the `.xer` verbose, so a full JSON parse of it compresses to the same size —
and if serialised as objects rather than columns, it is **24% larger**.

So a stored full `parsed.json` **doubles the per-revision blob footprint and offers
no transfer saving over re-parsing the `.xer`**. Its only justification is CPU on
open, and re-parsing 6.8 MB of tab-delimited text is on the order of a second.

The shape that *does* pay is the **activity subset**: 185–277 KB gzipped, a **3.2×
saving** over shipping the whole `.xer` to a browser that only wants to draw the
activity table. That is the artifact worth writing at ingest.

**Recommended stored set per revision:**

| Object | Gzipped | Read when |
|---|---|---|
| `raw.xer.gz` | 400–870 KB | someone downloads the programme |
| `activities.json.gz` (subset + codes, columnar) | 185–277 KB | detail page opens |
| `derived.json.gz` | ~15 KB | detail page opens |
| **total** | **~600 KB – 1.16 MB** | |

**Working figure: 0.85 MB per revision.** (Mean of the three fixtures; low 0.60,
high 1.16.)

---

## Corpus scale

Revisions per programme is the multiplier and there is real evidence on both
sides: Fixture A is one programme with 139 files over two years, Fixture B is one
job with 4 sibling variants. Neither is the public case — most uploads to a public
warehouse are one-shot. **Base model: 3 revisions per programme**, with 1 and 10
as sensitivity.

| Programmes | Revisions (×3) | Blob at 0.85 MB/rev | Postgres |
|---|---|---|---|
| 100 | 300 | 255 MB | 0.6 MB |
| 1,000 | 3,000 | 2.6 GB | 6 MB |
| 10,000 | 30,000 | **25.5 GB** | 60 MB |

Sensitivity at 10,000 programmes: **8.5 GB** at 1 revision each, **85 GB** at 10.

If a full `parsed.json` were stored as well, add ~0.65 MB/revision — the 10,000-
programme corpus goes from 25.5 GB to **45 GB**, for zero benefit.

### Postgres is a rounding error

The row is ~11 typed columns plus a JSONB `card`, budgeted at ~1 KB
([the derived.json contract](derived-json-contract.md)). Doubling for indexes gives
**~2 KB per revision**. At 10,000 programmes that is **60 MB of rows, ~150 MB with
indexes and bloat**.

That fits inside **Neon's 0.5 GB free plan** and **Supabase's 500 MB free plan**
with room to spare. Postgres *size* never becomes the binding constraint on this
project. Postgres *uptime* does — see [The cliffs](#the-cliffs).

---

## Traffic model

Three monthly tiers. Blob egress only — the app shell is CDN-cached static assets
and is counted separately.

| | page views | programme opens | `.xer` downloads |
|---|---|---|---|
| Quiet | 5,000 | 500 | 200 |
| Modest | 50,000 | 5,000 | 2,000 |
| Busy | 500,000 | 50,000 | 20,000 |

The grid renders from Postgres alone with **zero blob reads** — that is the
hybrid-ingest decision doing its job, and it is why page views barely enter this
table. An open costs `activities.json` + `derived.json` = **~245 KB**. A download
costs **~600 KB**.

| | blob egress / month |
|---|---|
| Quiet | 0.24 GB |
| Modest | 2.4 GB |
| Busy | **24 GB** |

**24 GB/month is nothing.** Every free tier priced below absorbs it or comes close.

---

## Provider pricing, 2026-08-07

### Blob storage

| | Storage | Egress | Writes | Reads | Free tier |
|---|---|---|---|---|---|
| **Cloudflare R2** | $0.015/GB-mo | **$0** | $4.50/M (Class A) | $0.36/M (Class B) | 10 GB, 1M A, 10M B — monthly, permanent |
| **Vercel Blob** (sin1) | $0.025/GB-mo | $0.053/GB | $5.00/M (advanced) | $0.40/M (simple) | Pro: 5 GB, 100 GB transfer, 10K adv, 100K simple |
| **Supabase Storage** | Pro: $0.0213/GB-mo over 100 GB | $0.09/GB over 250 GB ($0.03 cached) | — | — | Free: 1 GB storage, 5 GB egress |
| **Backblaze B2** | $6.95/TB-mo (=$0.00695/GB) | **free to 3× stored**, then $0.01/GB | free (Class A/B/C) | free | 10 GB storage always free |
| **AWS S3 Standard** | $0.023/GB-mo | $0.09/GB after 100 GB/mo free | $0.005/1,000 | $0.0004/1,000 | 100 GB/mo egress free; $200 credits, 6 months |

R2 charges no egress at all — not a free allowance, an absent line item. That is
the structural difference the ticket was worried about, and it is real.

### Postgres

| | Free plan | Sleeps? | Paid |
|---|---|---|---|
| **Neon** | 0.5 GB storage, 100 CU-hr, 5 GB egress | **yes — scale-to-zero after 5 min**, restart "within a few hundred milliseconds"; not disableable on Free | Launch $0.106/CU-hr + $0.35/GB-mo, no monthly minimum; scale-to-zero can be disabled |
| **Supabase** | 500 MB db, 1 GB storage, 5 GB egress | **yes — project paused after 1 week of inactivity** | Pro from $25/mo, no pausing, includes $10 compute credits; 8 GB disk then $0.125/GB |

The two free tiers sleep in materially different ways. Neon's is a **cold query**
— a few hundred ms on the first storefront render after idle, invisible to almost
everyone. Supabase's is a **paused project** — the site is down until someone
restores it from the dashboard. For a public storefront that may sit idle for days
between visitors, Supabase Free is not viable and Neon Free is.

---

## Bills at scale

**10,000 programmes (25.5 GB stored), Busy traffic (24 GB egress, ~70K reads,
~7.5K writes/month):**

| Provider | Storage | Egress | Ops | **Marginal total** |
|---|---|---|---|---|
| Cloudflare R2 | 15.5 GB over free × $0.015 = $0.23 | $0 | $0 (inside free ops) | **$0.23** |
| Backblaze B2 | 15.5 GB × $0.00695 = $0.11 | $0 (76 GB allowance) | $0 | **$0.11** |
| Vercel Blob (sin1) | 20.5 GB × $0.025 = $0.51 | $0 (inside 100 GB) | $0 (inside included) | **$0.51** + Pro base |
| AWS S3 | 25.5 GB × $0.023 = $0.59 | $0 (inside 100 GB free) | $0.07 | **$0.66** |
| Supabase Storage | $0 (inside 100 GB) | $0 (inside 250 GB) | — | **$0** + Pro base |

Every provider, including the one the ticket was afraid of, lands under a dollar.
**At this project's plausible scale the blob provider choice is not a cost
decision.**

**Where they diverge — 1 TB/month egress:**

| Provider | Bill at 1 TB egress |
|---|---|
| Cloudflare R2 | **$0** |
| Backblaze B2 | $9.24 (924 GB over the 3× allowance) |
| Supabase | $67.50 ($22.50 if fully CDN-cached) |
| Vercel Blob | $47.70 |
| AWS S3 | $81.00 |

**1 TB = ~1,750,000 gzipped `.xer` downloads in a month.** Ten times the "Busy"
tier's downloads is still only 12 GB. This project does not reach 1 TB without
becoming something other than what it is.

---

## The CDN path

Every stored object is immutable — the versioned blob path from
[the derived.json contract](derived-json-contract.md) means an object is never
rewritten, only superseded. So everything ships
`Cache-Control: public, max-age=31536000, immutable` and the CDN can hold it
forever.

What that saves depends on the provider's billing shape:

- **R2 behind Cloudflare's CDN**: cache hits skip Class B operations entirely, and
  egress was already free. The CDN saves an already-zero bill.
- **Vercel Blob**: a cache HIT avoids the Simple Operation *and* Fast Origin
  Transfer, but **Blob Data Transfer is still billed** — it is charged whenever a
  blob is downloaded or viewed. The CDN cuts ops, not bytes.

Hit rate on a warehouse like this is structurally **poor for the tail and good for
the head**: most programmes are fetched once ever, a handful repeatedly. Assume
~50% and stop modelling it — at 24 GB/month the difference between 0% and 100% is
under a dollar on every provider.

The one place caching genuinely matters is the **app shell**, billed as Vercel Fast
Data Transfer: first 1 TB included, then $0.16/GB in sin1. 500,000 page views at a
~50 KB warm-cache payload is 25 GB — comfortably inside. Even a 300 KB cold
payload on every one of those views is 150 GB, still inside.

---

## The cliffs

There are two, and only one of them is real.

### Cliff 1 — the platform floor (real, hits at ~zero traffic)

Nothing to do with bytes. It is crossed the day one of these becomes intolerable:

- the database sleeping,
- the host's free plan forbidding what the site is,
- needing more than one collaborator seat.

Below it: **$0/month.** Vercel Hobby + Neon Free + R2 free tier carries roughly
**4,000 programmes** (10 GB ÷ 0.85 MB ÷ 3 revisions) at Quiet-to-Modest traffic
with a few-hundred-ms cold query after idle.

Above it: **~$20–45/month.** Vercel Pro ($20/seat) + always-on Neon (0.25 CU ×
730 h × $0.106 ≈ **$19/month**) + R2 (~$0.25). Supabase Pro at $25/month is the
same money in one line item instead of two.

> **Flagged for [Stack, hosting and auth provider](../010-stack-hosting-auth.md):**
> Vercel's Hobby plan is intended for non-commercial use. This site is free and
> monetisation is explicitly out of scope, but "public site with user accounts and
> uploads" is close enough to the line that it should be checked, not assumed.
> If Hobby is out, the floor is $20/month from day one.

### Cliff 2 — egress (theoretical)

1 TB/month, i.e. ~1.75M downloads. Reachable only if the site becomes genuinely
popular *and* serves uncompressed. On R2 the cliff does not exist at any volume.

---

## Compression

Confirmed and quantified: **7.1:1, 8.3:1, 7.8:1** on the three fixtures. `.xer` is
verbose repetitive tab-delimited text and gzip eats it.

The lever, stated as the ticket asked — as a change in where the cliff sits:

| | bytes per download | downloads to reach 1 TB |
|---|---|---|
| raw `.xer` | ~4.8 MB | **~218,000** |
| gzipped `.xer` | ~600 KB | **~1,750,000** |

**Serving gzipped moves the egress cliff out by 8×.** Switching from S3 to R2 moves
it to infinity, but the compression decision is the one that also makes the site
feel fast, and it costs nothing.

Store the object already compressed and serve it with
`Content-Encoding: gzip` — do not rely on the CDN to compress on the fly, because
the stored bytes are then billed uncompressed too. Zstandard or Brotli would
likely beat gzip by another 15–20% here, but neither was measured and gzip is the
one every browser and every `curl` handles without thought.

---

## Forks cost full price

Fixture B's four tender siblings differ by **under 0.4% of rows at 99.97% of the
byte size**. Content-hash deduplication (fixed in
[Licensing, attribution and takedown](../003-licensing-attribution-takedown.md))
catches byte-identical re-uploads — which Fixture A shows are genuinely common —
but catches none of these.

So a fork costs a full ~0.85 MB. Delta-compressing near-identical siblings would
recover ~99% of that, and it is **not worth building**: it would save ~20 GB at the
10,000-programme mark, which is **$0.30/month on R2**. Store full copies.

---

## Recommendation

1. **Cloudflare R2 for blobs.** $0.23/month at 10,000 programmes, and its zero-
   egress structure removes the only line item that scales with success. It wins on
   risk, not on price — at realistic scale every option here is under a dollar, so
   if the stack ticket prefers Vercel Blob for one-vendor simplicity, that costs
   ~$0.30/month more and is a defensible trade. **Do not use S3 or Supabase
   Storage**: both bill egress at $0.09/GB, which is the shape this project should
   not sign up for even if it never pays it.
2. **Neon for Postgres.** Free plan holds the whole corpus; scale-to-zero costs a
   few hundred ms on the first query after idle, which is acceptable at launch and
   is a paid setting to switch off later. Supabase Free's week-long inactivity
   pause is disqualifying for a public storefront; Supabase Pro at $25/month is a
   fine alternative if its auth and storage are wanted as one bundle — that is
   [Stack, hosting and auth provider](../010-stack-hosting-auth.md)'s call, not
   this ticket's.
3. **Store `.xer.gz` + `activities.json.gz` + `derived.json.gz`. Do not store a
   full `parsed.json`.** Measured: it is the same size gzipped as the `.xer` it
   came from.
4. **Serve everything gzipped, immutable, CDN-cached.**
5. **Budget $0/month to ~4,000 programmes, ~$20–45/month after that**, effectively
   flat in the corpus size. Blob cost stays under $1/month to 10,000 programmes.

---

## What this does not answer

- **The 20,000-activity file.** Every figure scales from files of 1,746 and 3,344
  activities. [Get a large synthetic fixture for perf work](../012-large-synthetic-fixture.md)
  is what tests whether `activities.json` stays ~250 KB at 6× the activity count.
  Linear extrapolation says ~1.2 MB gzipped, which would make the "don't ship the
  whole thing to the browser" argument stronger, not weaker.
- **`derived.json`'s real gzipped size**, which is estimated at ~15 KB from a
  contract, not measured from an artifact.
- **Whether the detail page fetches `activities.json` at all**, or pages the
  activity table through an API instead. That is
  [The project detail page](../008-project-detail-page.md)'s decision and it swings
  per-open egress by 16× (245 KB vs 15 KB). It does not change the recommendation —
  even the expensive branch is 24 GB/month at Busy — but it is the largest single
  factor left in the model.
- **Bandwidth for the app shell itself** beyond the observation that 500K page
  views fits inside Vercel's included 1 TB.

## Incidental finding

Strict CP1252 decoding **throws** on these files: byte `0x81` — undefined in
CP1252 — appears **28,774** times in Fixture A progressed and **31,485** times in
Fixture B, though not at all in the Fixture A baseline. This is the same class of
artifact as the `0x7F` runs already recorded in
[the .xer format long form](xer-format.md). A parser must decode with a
replacement or passthrough policy (`latin-1`, or `cp1252` with `errors="replace"`),
never strict. Carried to
[Upload and ingest pipeline](../011-upload-ingest-pipeline.md).

---

## Method

Fixtures were copied to local disk first — reading them repeatedly across the
mounted Windows drive is slow enough to matter. Parsing follows the `%T`/`%F`/`%R`
grammar, building a field-name→index map per table per file. Sizes are
`json.dumps(..., separators=(",",":"))` UTF-8 bytes; gzip is level 9 with a zeroed
mtime.

```python
TASK_KEEP = [
    "task_id","proj_id","wbs_id","clndr_id","task_code","task_name","task_type",
    "status_code","complete_pct_type","phys_complete_pct",
    "target_start_date","target_end_date","act_start_date","act_end_date",
    "early_start_date","early_end_date","late_start_date","late_end_date",
    "target_drtn_hr_cnt","remain_drtn_hr_cnt","total_float_hr_cnt",
    "free_float_hr_cnt","driving_path_flag","float_path","float_path_order",
]
GANTT       = {"PROJECT","PROJWBS","CALENDAR","TASK","TASKPRED"}
GANTT_CODES = GANTT | {"ACTVTYPE","ACTVCODE","TASKACTV"}

def parse(path):
    tables, tbl = {}, None
    with open(path, "rb") as fh:
        for raw in fh:
            line = raw.decode("cp1252", errors="replace").rstrip("\r\n")
            if not line:
                continue
            parts = line.split("\t")
            if parts[0] == "%T":
                tbl = parts[1]; tables[tbl] = ([], [])
            elif parts[0] == "%F":
                tables[tbl] = (parts[1:], [])
            elif parts[0] == "%R":
                tables[tbl][1].append(parts[1:])
    return tables

def columnar(tables, only=None, keep=None):
    out = {}
    for t, (fields, rows) in tables.items():
        if only and t not in only:
            continue
        idx = [i for i, f in enumerate(fields)
               if not (keep and t in keep) or f in keep[t]]
        out[t] = {"fields": [fields[i] for i in idx],
                  "rows": [[(r[i] if i < len(r) and r[i] != "" else None)
                            for i in idx] for r in rows]}
    return out
```

## Sources

- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Vercel Blob usage and pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing)
- [Vercel regional pricing](https://vercel.com/docs/pricing/regional-pricing) and
  [Singapore (sin1)](https://vercel.com/docs/pricing/regional-pricing/sin1)
- [Supabase pricing](https://supabase.com/pricing)
- [Backblaze B2 pricing](https://www.backblaze.com/cloud-storage/pricing)
- [Neon pricing](https://neon.com/pricing) and
  [scale to zero](https://neon.com/docs/introduction/scale-to-zero)
- [Amazon S3 pricing](https://aws.amazon.com/s3/pricing/) — request rates and the
  100 GB/month free egress allowance are quoted from the page. **The $0.023/GB-month
  Standard storage rate and the $0.09/GB internet egress rate are the long-standing
  us-east-1 figures and could not be read off the page**, which renders its tables
  dynamically; verify in the AWS calculator before relying on them. Neither changes
  a conclusion here — S3 is ruled out for its egress *shape*, not its exact rate.
