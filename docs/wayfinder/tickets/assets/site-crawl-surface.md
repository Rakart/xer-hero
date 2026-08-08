# The site's crawl surface — per-route table, the files, the assertions, the sources

Working detail for [ticket 033](../033-site-crawl-surface.md). The decisions and their
reasoning are in that ticket's `## Resolution`; this file is the mechanical half — the
enumerated route table, the two files as they will actually ship, the OG templates, the
assertion keys, and every primary source the ticket leans on with the quote it leans on.

Everything is drafted against the closed set as of **2026-08-08**, on the apex
`https://xerhero.com` fixed by [025](../025-blob-host-and-domain.md).

---

## 1. Per-route table

The URL set is closed ([023](../023-signed-in-users-own-space.md), reopened by five routes
in [030](../030-static-pages.md)), so this is exhaustive rather than illustrative.

`robots meta` blank means the route emits **no** `<meta name="robots">` at all, which is
the same as `index, follow` and is one fewer tag to get wrong. Every indexable route emits
a **self-referential** canonical, per Google's *"Do include a `rel="canonical"` link on the
canonical page itself"* (§6.3).

| Route | In sitemap | robots meta | `<link rel="canonical">` | Cache | Note |
| --- | --- | --- | --- | --- | --- |
| `/` (bare) | **yes**, `lastmod` = newest published upload | — | self, `https://xerhero.com/` | unchanged | 030's lede renders here only |
| `/?page=N`, N ≥ 2 | no | — | **self, including `?page=N`** | unchanged | §6.4 — never canonicalise a page to page 1 |
| `/?page=1` | no | — | — | — | **308 → `/`**, per 009's omit-at-default rule |
| `/?page=N` past the last page | no | — | — | — | **404** (§6.5) |
| `/?…` any facet, `q` or `sort` param | no | **none, deliberately** | **none, deliberately** | unchanged | `Disallow`ed in `robots.txt`; a directive on a URL a crawler is told not to fetch is the trap in §2.2 |
| `/p/{slug}`, published | **yes**, `lastmod` = current revision's `uploaded_at` | — | self | **ISR ≤ 1 h** | |
| `/p/{slug}`, tombstoned (A or B) | **no** | **`noindex, follow`** | self | **ISR ≤ 1 h** | derived from `programme.status`; no column |
| `/p/{slug}`, no published revision | no | — | — | — | 404 to anyone but the owner; falls out of the shelf's own join |
| `/p/{slug}/r/{n}`, `n` = current | no | — | **`https://xerhero.com/p/{slug}`** | ISR ≤ 1 h | the one true duplicate pair in the estate |
| `/p/{slug}/r/{n}`, `n` superseded | no | **`noindex, follow`** | **self** | ISR ≤ 1 h | *not* canonicalised to `/p/{slug}` — different content |
| `/p/{slug}/r/{n}`, `n` tombstoned | no | **`noindex, follow`** | self | ISR ≤ 1 h | |
| `/u/{handle}`, listable under 016's gate | **yes** | — | self | unchanged | |
| `/u/{handle}`, not listable | no | **`noindex, follow`** | self | unchanged | same predicate 016 already computes |
| `/contributors` | **yes** | — | self | unchanged | |
| `/about` | **yes** | — | self | static (030) | |
| `/terms`, `/privacy` | **yes** | — | self | static (030) | |
| `/terms/v{n}`, `/privacy/v{n}` — current | no | **none** | **bare route** (030) | static | never *also* `noindex` — §2.3 |
| `/terms/v{n}`, `/privacy/v{n}` — superseded | no | **`noindex, follow`** (030) | **self** | static | never canonicalised to the current text — §2.3 |
| `/report` | **yes** | — | self | unchanged | |
| `/me/*` | no | — | — | — | Clerk middleware 302s; also `Disallow`ed |
| `/ops` | no | — | — | — | Clerk-id allowlist; also `Disallow`ed |
| `/api/*` | no | — | — | — | `Disallow`ed |
| `/robots.txt` | n/a | — | — | static | build output of `app/robots.ts` |
| `/sitemap.xml` | n/a | — | — | **ISR 1 h** | the only crawl artefact that reads Postgres |

### 1.1 The two instruments are mirror images, and swapping them is the bug

Two URL classes in this table are excluded from the index by opposite mechanisms, and the
reason each gets the one it gets is the whole of §2:

- **Facet URLs** — `Disallow`, and **no** `noindex`. There is an unbounded number of them,
  most will never be requested by a human, and the point is to stop them being *fetched*.
- **Superseded revisions and tombstones** — `noindex`, and **no** `Disallow`. There are few
  of them, each has an inbound link that must keep working, and the point is to stop them
  being *listed*.

Give the first class `noindex` and it is never read. Give the second class `Disallow` and
the `noindex` on it is never read either, and the URL can still be listed without a
snippet. Both errors produce the same symptom — a URL in the index that should not be —
which is why the mistake survives so long in the wild.

---

## 2. The three traps, stated with their sources

### 2.1 `robots.txt` is not an index-control mechanism

> *"A robots.txt file tells search engine crawlers which URLs the crawler can access on
> your site… it is not a mechanism for keeping a web page out of Google."*
> — Google, *Introduction to robots.txt* (§6.1)

> *"A page that's disallowed in robots.txt can still be indexed if linked to from other
> sites."* — same page

> *"Google can't index the content of pages which are disallowed for crawling, but it may
> still index the URL and show it in search results without a snippet."*
> — Google, *How Google interprets the robots.txt specification* (§6.2)

So `Disallow` on the facet space is a **crawl** decision, not an index decision, and it is
chosen knowing that a facet URL someone links to externally may appear as a bare, snippetless
result. That is acceptable — a facet URL is the shelf. The escape hatch, if it ever is not
acceptable, is in §7.

### 2.2 `noindex` requires the page to be crawlable

> *"For the `noindex` rule to be effective, the page or resource **must not** be blocked by
> a robots.txt file, and it has to be otherwise accessible to the crawler."*
> — Google, *Block Search indexing with noindex* (§6.6)

And the related historical trap, because it is still copied from blog posts written before
2019:

> Google retired all code handling unsupported rules in `robots.txt` — including `noindex`,
> `nofollow` and `crawl-delay` — on **1 September 2019**. (§6.7)

There is therefore **no `Noindex:` line in this site's `robots.txt`**, and never will be.

### 2.3 A URL emits a canonical pointing elsewhere, **or** a `noindex`, never both

`rel="canonical"` is documented as a hint:

> *"You can indicate your preference to Google using these techniques, but Google may
> choose a different page as canonical than you do, for various reasons. That is,
> **indicating a canonical preference is a hint, not a rule**."* — Google, *Canonicalization*
> (§6.3)

and duplicate pages are handled as a cluster:

> *"If Google finds multiple pages that seem to be the same or the primary content very
> similar, it clusters them together."* — same page

Putting *"this page is the same as that one"* and *"remove this page"* on the same URL is,
at best, an ambiguous instruction about a cluster whose other member is supposed to stay
indexed. This file does not assert that the `noindex` propagates — Google does not document
that either way — it asserts that the combination is ambiguous and that ambiguity is not
worth buying. Hence two rows in §1 that look asymmetric and are not:

- **current** `/terms/v{n}` → canonical at `/terms`, **no** `noindex`;
- **superseded** `/terms/v{n}` → `noindex`, **self**-canonical, and deliberately *not*
  canonicalised to `/terms` — because saying a superseded text is the same document as the
  current one contradicts the exact thing 003's audit trail depends on being false.

The same shape applies to revisions: `/p/{slug}/r/{current}` is a genuine byte-duplicate of
`/p/{slug}` and gets the canonical; `/p/{slug}/r/{7}` of a 24-revision series is a different
programme's worth of numbers and gets `noindex` with a self-canonical.

---

## 3. `app/robots.ts`

**A generated route, not a static `app/robots.txt`** — because the disallow list must be
derived from the same constant the shelf's URL builder uses, which a text file cannot do.
See `ci.robots.facets_disallowed` in §5.

```ts
// app/robots.ts
import type { MetadataRoute } from 'next'
import { SHELF_QUERY_PARAMS } from '@/lib/shelf/url'   // 009 §7's table, one source

// `page` is deliberately excluded: 009 chose numbered pages *because* they are
// the crawl path to every /p/{slug}.
const UNCRAWLABLE_PARAMS = SHELF_QUERY_PARAMS.filter((p) => p !== 'page')

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        ...UNCRAWLABLE_PARAMS.map((p) => `/*?*${p}=`),
        '/me/',
        '/ops',
        '/api/',
      ],
    },
    sitemap: 'https://xerhero.com/sitemap.xml',
  }
}
```

Rendered output — this is the file, in full:

```txt
User-Agent: *
Allow: /
Disallow: /*?*sector=
Disallow: /*?*size=
Disallow: /*?*p6=
Disallow: /*?*progressed=
Disallow: /*?*q=
Disallow: /*?*sort=
Disallow: /me/
Disallow: /ops
Disallow: /api/

Sitemap: https://xerhero.com/sitemap.xml
```

Notes:

- **`page=` is absent from the disallow list**, on purpose. `/?page=3` stays crawlable;
  `/?sector=rail&page=3` does not, because the `sector=` rule matches it.
- **The pattern shape is Google's own**, from its faceted-navigation guidance:
  `disallow: /*?*products=` … `disallow: /*?*color=` (§6.8).
- **Precedence**: `Allow: /` is one character of rule path; each `Disallow` line is longer,
  and *"crawlers use the most specific rule based on the length of the rule path"* (§6.2).
  The disallow wins on a facet URL and nothing else changes.
- **One `User-Agent: *` group. No per-agent rules, no AI-crawler block, no `Crawl-delay`**
  (unsupported by Google, §6.7). Reasoning in the ticket.
- **No comments in the file**, because `MetadataRoute.Robots` has no comment field. The
  reasoning lives here and in the code.
- The blob host's `robots.txt` — `User-agent: *` / `Disallow: /` — is a different origin
  and an object in a bucket ([024](../024-verifying-production-only-edges.md) §4). *"The
  rules listed in the robots.txt file apply only to the host, protocol, and port number
  where the robots.txt file is hosted"* (§6.2). Nothing here says anything about it and
  nothing there says anything about this.

---

## 4. `app/sitemap.ts`

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next'

export const revalidate = 3600           // one Postgres read per hour, not per crawl

const SITE = 'https://xerhero.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // One query. It is the shelf's own published join (009 §11) without the
  // limit/offset, selecting three columns instead of twelve.
  //
  //   select p.slug, p.display_name_snapshot as handle, r.uploaded_at
  //     from programme p
  //     join revision r on r.id = p.current_revision_id
  //    where p.status = 'published' and r.status = 'published'
  //    order by p.created_at desc
  //
  // pending  → current_revision_id is null   → excluded by the join (011)
  // tombstoned → status <> 'published'       → excluded by the predicate (003)
  const rows = await publishedProgrammes()

  const handles = [...new Set(rows.map((r) => r.handle))]

  return [
    { url: `${SITE}/`, lastModified: rows[0]?.uploaded_at },
    { url: `${SITE}/about` },
    { url: `${SITE}/terms` },
    { url: `${SITE}/privacy` },
    { url: `${SITE}/contributors` },
    { url: `${SITE}/report` },
    ...rows.map((r) => ({
      url: `${SITE}/p/${r.slug}`,
      lastModified: r.uploaded_at,
    })),
    ...handles.map((h) => ({ url: `${SITE}/u/${h}` })),
  ]
}
```

### 4.1 What is deliberately absent

| Absent | Why |
| --- | --- |
| `changeFrequency` | *"Google ignores `<priority>` and `<changefreq>` values"* (§6.9) |
| `priority` | same; and `0.8` is an unsubstantiable claim in a machine-readable file, which is 013's rule arriving in XML |
| `lastModified` on the static routes | those change by deploy. `<lastmod>` is used *"if it's consistently and verifiably accurate"* (§6.9) — an unverifiable one is worse than none |
| `/?page=N` | reachable by sequential link (§6.4); listing 400 of them is noise, and every programme is listed directly anyway |
| `/p/{slug}/r/{n}` | non-canonical. *"Sitemap inclusion: A weak signal that helps the URLs that are included in a sitemap become canonical"* (§6.3) — listing a URL you have canonicalised away sends the opposite signal |
| `/terms/v{n}`, `/privacy/v{n}` | `noindex` or canonicalised away |
| tombstoned and `pending` programmes | falls out of the join and the predicate; no exception written |
| `generateSitemaps` splitting | at the 10,000-programme design target this file is ~10,300 URLs against Google's *"50MB (uncompressed) or 50,000 URLs"* (§6.9) — 20% of the limit. Splitting is additive when it is needed |

### 4.2 `lastModified` is the current revision's `uploaded_at`, and the residue is stated

015 made sector owner-editable in place and 005 makes title editable too, so a Programme's
*metadata* can change without a new Revision. Those edits do **not** move `lastmod`. That is
correct rather than a gap: Google uses the value only when it is *"consistently and
verifiably accurate"*, and the primary content of the page — every number above the fold —
comes from the Revision. Buying an accurate `programme.updated_at` would be a column and a
write on three edit paths, to move a date on a signal Google treats as advisory.

### 4.3 The cost, against 010's meter

Vercel bills Hobby on **Active CPU (4 hours included)**, **Provisioned Memory (360 GB-hrs)**
and **Invocations (1 million)** (§6.10). Active CPU is *"the CPU time your code actively
consumes"* and *"You are only billed during actual code execution and not during I/O
operations"*.

At `revalidate = 3600`:

| Meter | Sitemap's share per month | Included | % |
| --- | --- | --- | --- |
| Invocations | ≤ 720 | 1,000,000 | 0.07% |
| Active CPU | 720 × ~30 ms of XML serialisation ≈ **22 CPU-seconds** | 14,400 s | **0.15%** |
| Provisioned Memory | 720 × ~0.5 s wall × 1 GB ≈ 0.1 GB-hr | 360 GB-hr | 0.03% |

The 30 ms is the honest upper end: it is string-building ~10,300 entries at the design
target, and the Neon query it waits on is I/O, which the meter explicitly does not bill.

**Crawler request volume does not appear in that table at all.** ISR decouples fetches from
renders — if Googlebot fetched `/sitemap.xml` ten thousand times an hour the arithmetic
above is unchanged, because 9,999 of them are served from cache. That is the whole reason a
route beats a build artefact here, and it is why the ticket's framing — *"the first public
thing reading Postgres on a crawler's schedule"* — is false of the thing that ships. It
reads Postgres on **our** schedule and serves bytes on the crawler's.

### 4.4 Why not static-at-build

Not on cost — the cost is 0.15% of one meter. On **freshness**. 010 deploys on push to
`main`; uploads arrive continuously and are the product. A sitemap frozen at deploy time
lists the catalogue as it was at the last commit, which for a site whose entire content is
user uploads is wrong on day two. 030's four static routes are static precisely because
*"they read no database and no blob"*; this one reads the shelf.

---

## 5. Assertions

Naming follows [024](../024-verifying-production-only-edges.md) §2 — assertions are referred
to by **key**, never by URL or value, because Actions logs on a public repo are
world-readable (019).

### 5.1 CI — added to 018's existing stack-up job, no secrets, blocking on `main`

| Key | Method | Expect |
| --- | --- | --- |
| `ci.robots.allows_root` | build, fetch `/robots.txt` | contains `Allow: /`; contains **no** bare `Disallow: /` line |
| `ci.robots.facets_disallowed` | compare the emitted disallow list against `SHELF_QUERY_PARAMS` **from the shelf's own module** | every shelf param except `page` has a matching `Disallow` |
| `ci.robots.page_param_crawlable` | same file | no rule matches `/?page=2` |
| `ci.robots.sitemap_pointer` | same file | exactly one `Sitemap:` line, on the apex |
| `ci.sitemap.excludes_hidden` | render `/sitemap.xml` against 018's dev catalogue | no tombstoned (either class) and no `pending` Programme appears |
| `ci.sitemap.no_priority_or_changefreq` | same output | neither element present |
| `ci.canonical.facet_url_emits_nothing` | render `/?sector=rail` | **no** `<link rel="canonical">` and **no** `<meta name="robots">` |
| `ci.canonical.revision_current` | render `/p/{slug}/r/{current}` | canonical is `https://xerhero.com/p/{slug}` |
| `ci.canonical.revision_superseded` | render `/p/{slug}/r/{n≠current}` | self-canonical **and** `noindex` |
| `ci.canonical.tombstone_noindex` | render a Class A and a Class B tombstone from the dev catalogue | `noindex` present on both |
| `ci.og.no_generated_images` | grep the repo | `next/og` and `ImageResponse` appear nowhere |
| `ci.og.description_is_templated` | render `/p/{slug}` for a programme whose `description` contains a marker string | the marker does **not** appear in `og:description` |

`ci.robots.facets_disallowed` is the one that earns the generated route. It is 024's own
best mechanism reused: 024 made CI's preflight derive its header list *from the presign's own
output* so that *"the presign changed"* and *"CORS is now wrong"* became one test failure.
Here, adding a fifth facet to 009's four without disallowing it becomes a test failure
rather than an unbounded crawl six months later.

`ci.canonical.tombstone_noindex` needs no new fixture: 018's dev catalogue already contains
*"both tombstone classes"*, listed in its own row-states inventory.

### 5.2 The sweep — one new key on 024's existing `edge_drift` rule

| Key | Method | Expect |
| --- | --- | --- |
| `edge.site.robots_txt` | unauthenticated `GET https://xerhero.com/robots.txt` | `200`, and the body contains no bare `Disallow: /` |

**No new rule, no new `alarm_state` row, no migration.** 024 established that
`sweep_run.breaches` is jsonb so a rule key needs nothing there, and this spends that
property one level down: a key on an existing rule costs an array entry.

Why this one key and not more, against 024's two-causes framework:

- **Cause 1, a commit.** Everything in §5.1. `robots.txt`, `sitemap.xml` and every canonical
  tag are build outputs of this repo — there is no vendor dashboard that can edit them, so
  the dashboard-edit cause 024's rule exists for does not apply.
- **Cause 2, something with no commit behind it.** There is exactly one: 025 put the site's
  DNS records **DNS-only** while the blob host is **proxied**, and `edge_drift`'s existing
  keys all point at `blobs.xerhero.com`. **Nothing in the estate has ever observed
  `xerhero.com` itself.** A detached Vercel domain, a broken apex record or a lapsed
  registration leaves every current assertion green. One GET closes it.

**Why `/sitemap.xml` gets no key, which is the sharper half.** With ISR, a failed
revalidation serves the last good cached bytes. A `200`-and-well-formed assertion would
therefore be green through precisely the failure it exists to catch — which is 024's own
finding about a hand-uploaded canary (*"a static canary is green in exactly the case that
matters"*) arriving in a new place. Rather than build a weaker instrument, the sitemap is
covered where it can be: in CI, against the dev catalogue, before merge.

Cost: one unauthenticated GET per run, ~2,900/month, no credential, no vendor.

### 5.3 Not asserted, and named

- **What Google actually does with any of it.** 030 decided no analytics of any kind, so
  there is no Search Console impressions dashboard being watched and no traffic data at all.
  Every decision in this ticket is unmeasurable by construction, exactly as the map's
  analytics patch already records.
- **Whether the sitemap was submitted.** It does not need to be — the `Sitemap:` line in
  `robots.txt` is the documented discovery path, and *"Submitting a sitemap is merely a
  hint"* (§6.9).

---

## 6. Sources

Every fact in this ticket that concerns crawler behaviour or platform capability, with the
quote it rests on.

**6.1** Google, *Introduction to robots.txt* —
https://developers.google.com/search/docs/crawling-indexing/robots/intro
> *"A robots.txt file tells search engine crawlers which URLs the crawler can access on your
> site… it is not a mechanism for keeping a web page out of Google."*
> *"A page that's disallowed in robots.txt can still be indexed if linked to from other
> sites. While Google won't crawl or index the content blocked by a robots.txt file, we
> might still find and index a disallowed URL if it is linked from other places on the web."*
> *"To keep a web page out of Google, block indexing with `noindex` or password-protect the
> page."*

**6.2** Google, *How Google interprets the robots.txt specification* —
https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt
> *"The rules listed in the robots.txt file apply only to the host, protocol, and port
> number where the robots.txt file is hosted."*
> *"Google enforces a robots.txt file size limit of 500 kibibytes (KiB)."*
> *"When matching robots.txt rules to URLs, crawlers use the most specific rule based on the
> length of the rule path. In case of conflicting rules, including those with wildcards,
> Google uses the least restrictive rule."*
> *"Google can't index the content of pages which are disallowed for crawling, but it may
> still index the URL and show it in search results without a snippet."*
> Supported fields: `user-agent`, `allow`, `disallow`, `sitemap`.

**6.3** Google, *Canonicalization* and *Consolidate duplicate URLs* —
https://developers.google.com/search/docs/crawling-indexing/canonicalization ·
https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
> *"You can indicate your preference to Google using these techniques, but Google may choose
> a different page as canonical than you do, for various reasons. That is, indicating a
> canonical preference is a hint, not a rule."*
> *"If Google finds multiple pages that seem to be the same or the primary content very
> similar, it clusters them together."*
> *"Redirects: A strong signal that the target of the redirect should become canonical.
> `rel="canonical"` link annotations: A strong signal that the specified URL should become
> canonical. Sitemap inclusion: A weak signal that helps the URLs that are included in a
> sitemap become canonical."*
> *"Do include a `rel="canonical"` link on the canonical page itself (also known as a
> self-referential canonical)."*

**6.4** Google, *Pagination and incremental page loading* —
https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading
> *"Don't use the first page of a paginated sequence as the canonical page. Instead, give
> each page its own canonical URL."*
> *"Include links from each page to the following page using `<a href>` tags."*
> *"Give each page a unique URL. For example, include a `?page=n` query parameter, as URLs
> in a paginated sequence are treated as separate pages."*
> *"Google no longer uses these tags"* — of `rel="next"` / `rel="prev"`.

**6.5** Google, *Managing crawling of faceted navigation URLs* —
https://developers.google.com/crawling/docs/faceted-navigation
> *"disallow crawling of faceted navigation URLs"*, allowing *"just the individual items'
> pages along with a dedicated listing page that shows all products without filters
> applied."*
> Example given: `disallow: /*?*products=` · `disallow: /*?*color=` · `disallow: /*?*size=`
> · `allow: /*?products=all$`
> *"Using `rel="canonical"` to specify which URL is the canonical version of a faceted
> navigation URL"* and `rel="nofollow"` are *"generally less effective in the long term than
> the previously mentioned methods."*
> Faceted navigation *"can generate infinite URL spaces"*.
> *"Return an HTTP 404 status code when a filter combination doesn't return results."*

**6.6** Google, *Block Search indexing with noindex* —
https://developers.google.com/search/docs/crawling-indexing/block-indexing
> *"For the `noindex` rule to be effective, the page or resource must not be blocked by a
> robots.txt file, and it has to be otherwise accessible to the crawler."*
> The `<meta>` tag and the `X-Robots-Tag` header *"have the same effect."*

**6.7** Google, *A note on unsupported rules in robots.txt* (July 2019) —
https://developers.google.com/search/blog/2019/07/a-note-on-unsupported-rules-in-robotstxt
Google retired handling of unsupported rules — `noindex`, `nofollow`, `crawl-delay` in
`robots.txt` — on **1 September 2019**, and lists `noindex` in `<meta>`, 404/410, password
protection, `Disallow`, and the Search Console removal tool as the alternatives. Confirmed
in §6.2, which lists only four supported fields.

**6.8** Same as §6.5 — the disallow-pattern shape is Google's own example.

**6.9** Google, *Build and submit a sitemap* —
https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
> *"All formats limit a single sitemap to 50MB (uncompressed) or 50,000 URLs."*
> *"Google uses the `<lastmod>` value if it's consistently and verifiably accurate."*
> *"Google ignores `<priority>` and `<changefreq>` values."*
> *"Submitting a sitemap is merely a hint: it doesn't guarantee that Google will download
> the sitemap or use the sitemap for crawling URLs on the site."*
> `robots.txt` discovery line: `Sitemap: https://example.com/my_sitemap.xml`

**6.10** Vercel, *Fluid compute pricing* — https://vercel.com/docs/functions/usage-and-pricing
> Hobby includes **Active CPU 4 hours**, **Provisioned Memory 360 GB-hrs**, **Invocations
> 1 million**.
> *"This is the CPU time your code actively consumes in milliseconds… You are only billed
> during actual code execution and not during I/O operations."*
> *"computationally intensive tasks (like image processing) will use more CPU time than
> I/O-heavy tasks (like making API calls)."*
> *"Vercel bills Active CPU only while your code is actually running. If the request is
> waiting on I/O, CPU billing pauses but memory billing continues."*

**6.11** Next.js, *robots.txt file convention* —
https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
Static `app/robots.txt` **or** generated `app/robots.ts`; the `Robots` object carries
`rules` (`userAgent`, `allow`, `disallow`, `crawlDelay`, `other`), `sitemap`, `host`.
> *"`robots.js` is a special Route Handler that is cached by default unless it uses a
> Request-time API or dynamic config option."*

**6.12** Next.js, *sitemap.xml file convention* —
https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
> *"`sitemap.js` is a special Route Handler that is cached by default unless it uses a
> Request-time API or dynamic config option."*
Return type is `{ url, lastModified?, changeFrequency?, priority?, alternates? }`;
`generateSitemaps` splits large sitemaps, with the code comment *"Google's limit is 50,000
URLs per sitemap"*.

**6.13** Next.js, *generateMetadata* —
https://nextjs.org/docs/app/api-reference/functions/generate-metadata
`alternates.canonical` emits `<link rel="canonical">`; `metadataBase` resolves relative
values; `robots: { index, follow }` emits `<meta name="robots">`; `openGraph` emits the
`og:*` properties. Metadata objects merge **shallowly** from root layout down, and *"All
`openGraph` fields from `app/layout.js` are inherited"* when a page sets none — which is how
one root-level OG block covers every route.

**6.14** Next.js, *opengraph-image* —
https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image
> *"By default, generated images are statically optimized (generated at build time and
> cached) unless they use Request-time APIs or uncached data."*
A per-programme card is by definition uncached per-row data, so it is neither.

**6.15** Google, *Dataset structured data* —
https://developers.google.com/search/docs/appearance/structured-data/dataset
Surfaces in **Dataset Search**, not standard Search results. Required `name` and
`description`; recommended `creator`, `license`, and `distribution` — *"where to get the
data and in what format"*.

---

## 7. Escape hatches, recorded so a reversal is a decision rather than a rediscovery

| If this becomes intolerable | The change |
| --- | --- |
| Facet URLs appear as bare snippetless results because someone linked one | Remove that param's `Disallow` **and** add `noindex, follow` to the facet render. Never both at once; §2.2 |
| A crawlable sector view is wanted | `/sector/{code}` as a **path** route — 8 URLs, not 30,600. 009 deferred the shape here; filed as its own ticket |
| The sitemap passes 50,000 URLs | `generateSitemaps`, additive (§6.12). At the 10,000-programme design target we are at 20% |
| A Class B removal needs to leave Google's index in hours rather than at Google's recrawl pace | Search Console **Removals**. The Domain property already exists — 027 created it at 025 step 4 for DNS verification |
| Someone wants OG images | They are the single most Active-CPU-expensive thing available to this estate (§6.10, §6.14). Cost it against the 4-hour meter *and* against 023/027's `user.imageUrl` rule before writing a line |

---

## 8. Open Graph — the templates, in full

**The rule: no OG string in this site is authored.** Every value is either a string a closed
ticket already fixed, or a template over columns 007's row already renders. That is what
makes 030's banned-phrase list unnecessary here rather than merely satisfied — there is no
new prose to police.

One static `app/opengraph-image.png` (1200×630, wordmark on a flat ground, no photograph, no
avatar, no data) sits in the root and is inherited by every route through Next's metadata
merging (§6.13). **No route ever overrides it, and nothing in the repo imports `next/og`.**

| Route | `og:title` | `og:description` |
| --- | --- | --- |
| root default | `xer-hero` | 009's strap, verbatim: *"Public Primavera P6 programmes. Browse, download, fork."* |
| `/p/{slug}` published | `{title} — xer-hero` | `{activity_count} activities · {sector_label} · P6 {p6_version} · {progress} · uploaded by {handle} · CC-BY 4.0` |
| `/p/{slug}` tombstoned | **root default** | **root default** |
| `/p/{slug}/r/{n}` | `{title} — rev {n} — xer-hero` | as published, from that revision's columns |
| `/u/{handle}` | `{handle} — xer-hero` | `{n} published programmes on xer-hero.` |
| `/about`, `/terms`, `/privacy`, `/report`, `/contributors` | page title | the page's own first sentence (030's copy) |

- `{sector_label}` is 015's label or `Unsectored` — 015 made blank *"plausibly the largest
  bucket"*, so the template must render it rather than omit it.
- `{progress}` is `{pct_complete}% complete`, or `Not started` at 0. Fixture B's shape.
- **The uploader's free-text `description` is never used.** It is optional and empty for the
  guaranteed state of an uncaring upload, and a snippet is where 030's rules are least
  enforceable if the words are someone else's. It stays on the page, in the FTS index and in
  the CC-BY publication — nothing is hidden, it is simply not put in our voice.
- **A tombstoned programme emits the site defaults and nothing else.** 003 keeps the title
  visible *on the page*, which is a URL someone already holds; an unfurl is the same title
  travelling *outward* into a channel nobody asked. One branch on `programme.status`, which
  the `noindex` already reads.
- `twitter.card` is `summary`, not `summary_large_image` — there is one small shared image
  and nothing to fill a wide frame with. *Overturnable taste.*

### 8.1 Structured data: none, and the reason is 013 rather than effort

| Candidate | Verdict |
| --- | --- |
| `Dataset` (schema.org) | **Blocked, not skipped.** It fits a programme page almost perfectly — `name`, `description`, `creator`, `license` are all present — but its point is `distribution`, *"where to get the data and in what format"* (§6.15), and the only answer is `original.xer.gz` on the blob host. That is the one object 013 confined all PI to, marked `noindex, noarchive`, put behind `Disallow: /` and linked with `rel="nofollow"`. Emitting a machine-readable pointer to it is the precise inverse of 013's entire mitigation. A `Dataset` without `distribution` is an entry saying a dataset exists with no way to get it |
| `AggregateRating` / `Review` over 016's votes | **Banned.** It converts a raw count into a rating, which is 013's computed-versus-endorsed line and the map's Out-of-scope entry on badges. A star rating in a SERP is a quality mark wearing a schema type |
| `BreadcrumbList` | Harmless and honest — 008 has a sector breadcrumb — and buys a breadcrumb line in a result nobody is competing for. Not worth the first block of JSON-LD in the codebase, because the first block is what makes the second one easy |
| `Organization`, `WebSite` + `SearchAction` | The sitelinks searchbox rich result no longer exists; `Organization` describes an organisation, and 030 already ruled that *"'we' invents an organisation"* |

Revisit `Dataset` only if `distribution` can ever point at something that is not the
PI-bearing object. Today it cannot.
