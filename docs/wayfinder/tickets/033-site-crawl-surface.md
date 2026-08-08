---
id: 033
title: "The site's own crawl surface: robots.txt, sitemap and canonical URLs"
type: grilling
status: closed
assignee: carlo
blocked_by: []
---

## Question

Every hostname in this estate has a crawl policy except the one people visit.

013 required `Disallow: /` on the blob host and 024 found it was *an object in the bucket
nothing had ever written*, then made it an assertion running every fifteen minutes. 025
gave it a hostname. **Nothing has ever written a `robots.txt` for `xerhero.com`, there is
no sitemap, and no route emits `<link rel="canonical">`** — and three closed decisions now
depend on that gap being filled.

- 025 made the apex **canonical**, with `www` and `xer-hero.vercel.app` both 308ing to it,
  on the argument that two live hosts serving one path is how 009's immutable-slug promise
  breaks quietly in other people's bookmarks. A redirect handles the hosts; nothing yet
  handles the *paths*.
- 009 made numbered pages at 25 the way a crawler reaches every `/p/{slug}` at all, with
  strict canonicalisation rules for query-param URLs — omit at default, fixed order,
  sorted multi-select. Those rules describe the URL the site *should* emit; nothing
  declares which URL is canonical when a crawler arrives at a non-canonical variant.
- 030 fixed `/terms/v{n}` and `/privacy/v{n}` and specified that the current version
  canonicalises to the bare route while superseded versions are `noindex`. That is the
  first place in the effort where a canonical tag is a *decision* rather than hygiene.

The URL set is closed and therefore enumerable: `/`, `/p/{slug}`, `/p/{slug}/r/{n}`,
`/u/{handle}`, `/contributors`, `/about`, `/terms`, `/terms/v{n}`, `/privacy`,
`/privacy/v{n}`, `/report`, with everything private under `/me` behind Clerk middleware.

Settle:

- **What `robots.txt` on `xerhero.com` says**, and whether it says anything at all beyond a
  sitemap pointer. Note the asymmetry with the blob host, which is the one hostname
  deliberately excluded: 013's `Disallow: /` governs its own origin and says nothing here.
  Decide explicitly whether the filtered shelf (`/?sector=rail&page=3`) should be crawled,
  given 009 chose numbered pages *because* they are the crawl path to every programme page.
- **Whether there is a sitemap, and what generates it.** It is a database query over
  published Programmes plus a static list, which makes it the first thing on the public
  site that reads Postgres on a crawler's schedule rather than a user's. Price that against
  010's Active CPU meter and decide static-at-build versus a route.
- **Canonical tags: which routes emit one and pointing where.** At minimum `/p/{slug}/r/{n}`
  against `/p/{slug}` at the current revision, the shelf's non-canonical query variants, and
  030's version URLs. Decide whether a tombstoned programme's page stays indexable — 003
  keeps the row and the URL forever, and 017's Class B copy is deliberately neutral, but a
  crawler holding the page is a different exposure from a visitor finding it.
- **OG cards and structured data, or the explicit refusal of them.** 013 bans anything
  worded as a guarantee and 030 banned traction language; an OG card is where a description
  gets written by someone who has forgotten both. Decide whether a card is generated at all,
  and whether it is text-only — 010 removed avatars and 027 made *nothing renders
  `user.imageUrl`* structural, so any generated image is a new surface with its own rule.
- **Whether any of this is asserted.** 024's `edge_drift` watches the blob host's
  `robots.txt` every fifteen minutes precisely because it was certainly-absent rather than
  possibly-wrong. The same argument may or may not reach a file that costs nothing when it
  is missing.

This is the half of the map's **Discoverability outside the app** patch that has become
concrete; what stays foggy there is the part that needs traffic to answer.

## Resolution

**Two generated files, one head tag per route, and the sharp answer is that a tombstone stops
being indexable the instant its row commits.** `robots.txt` allows everything and disallows
exactly two families — 009's facet space and the authenticated surfaces. There is a sitemap,
it is a cached route, and it costs **0.15% of one Hobby meter**. Every indexable route emits a
self-referential canonical; three classes emit something else. OG cards are text-only and
carry **no authored prose at all**; structured data is refused, and the reason is 013 rather
than effort. **Zero schema demand — not even 024's one row.**

The per-route table, both files as they will ship, the OG templates, the assertion keys and
every source with the quote it rests on are [in the asset](assets/site-crawl-surface.md).

### The one thing to read first: the estate now contains two `robots.txt` files that mean opposite things

013 required `Disallow: /` on the blob host, 024 found nothing had ever written it, 025 gave
it a hostname. That file lives at `ops/bucket/robots.txt` **in this repo**, and this ticket
adds a second one, in the same repo, whose entire job is to say the opposite. Nothing
distinguishes them but a path.

That single observation decided the shape of most of what follows. It is why `robots.txt` for
the site is a **generated route rather than a static text file** (§2), why the one CI
assertion that matters is *the site's file does not contain a bare `Disallow: /`* (§6), and
why this ticket's failure mode is different in kind from 024's. 024 was defending against
**absence**. This ticket is defending against a **copy-paste**, which is louder in
consequence and quieter in appearance: a site with `Disallow: /` looks completely normal and
is completely invisible.

### 1. `robots.txt`: the facets lose, and 009's own argument is what settles it

**Facet, `q` and `sort` params are `Disallow`ed. `page` is not.** The whole file is in the
asset §3; the rule shape is Google's own from its faceted-navigation guidance
(`disallow: /*?*color=`), and `Allow: /` sits above it, losing on every facet URL because
*"crawlers use the most specific rule based on the length of the rule path."*

The ticket frames this as a tension between 009's crawl-path argument and the combinatorial
trap. **It is not a tension, because 009's argument was never about the facets.** 009's words
were that *"the shelf is how a crawler reaches `/p/{slug}` pages at all"*, and the thing that
does that reaching is the **unfiltered** numbered sequence — bare `/`, then `?page=2`,
`?page=3`. Not one programme page is reachable only through a filtered view; a filter is by
construction a *subset* of a page that is already crawlable. So disallowing `?sector=` removes
nothing from the crawl graph, and Google's own recommendation for this exact shape is to
allow *"just the individual items' pages along with a dedicated listing page that shows all
products without filters applied"* — which is a description of what 009 built two months
before anyone asked.

What is on the other side of the trade is worse than the ticket suggests. The four facets are
multi-select (009 §7: comma-separated, sorted), so eight sector codes alone give 255 non-empty
subsets, times 15 size subsets, times the P6 versions, times `progressed`, times four sorts —
**over 30,000 filter states before pagination** — and then `q` is free text, which makes the
space not large but *unbounded*. Google's term for it is *"infinite URL spaces"*.

Two things make the cost concrete rather than theoretical:

- **009's live conjunctive facet counts are two Postgres queries per shelf render**, not one.
  They were bought for a specific good reason — a sparse launch catalogue dead-ends without
  them — and the facet space is precisely where a crawler would spend all of them.
- **`q` on a crawlable URL is an internal search-results page**, and an external link to
  `/?q=<anything>` mints a new thin one.

The rejected alternative was to allow the facets and canonicalise them to `/`. It loses on
Google's own comparison — canonical and `nofollow` are *"generally less effective in the long
term than the previously mentioned methods"* — and on this site's arithmetic, since a hint
about 30,000 URLs is still 30,000 fetches.

**Stated rather than hidden: a `Disallow`ed URL is not a hidden URL.** Google *"may still
index the URL and show it in search results without a snippet"* if someone links it. A facet
URL appearing as a bare link in a result is a cosmetic outcome on a page that is the shelf,
and the escape hatch — remove that param's `Disallow`, add `noindex, follow`, never both — is
recorded in the asset §7.

Also disallowed: `/me/`, `/ops`, `/api/`. `/me` already 302s behind Clerk middleware and a
crawler never sees a link to it, so this is one line of defence against a code bug in 023's
viewer-independence property, which is the only way such a link could ever render.

**One `User-agent: *` group. No per-agent rules, no AI-crawler block, no `Crawl-delay`.**
Crawl-delay is not a field Google supports. The AI block is refused on 003's own grounds: this
site publishes every uploaded programme under **CC-BY 4.0**, which is a licence to reuse with
attribution, and a `robots.txt` saying *anyone may reuse this except you* is incoherent
against the licence in the footer. It is also a list that is wrong the week after it ships,
and the one object carrying personal data is on a different origin already saying `Disallow: /`
to everybody. *That the block is refused rather than merely unbuilt is overturnable taste; it
is one line either way.*

### 2. The sitemap exists, it is a route, and the cost question the ticket asked turns out not to be a cost question

**`app/sitemap.ts` with `export const revalidate = 3600`.** One query — the shelf's own
published join without the limit — emitting `/`, every published `/p/{slug}`, every listable
`/u/{handle}`, and the six static routes. `lastModified` only. **No `changeFrequency` and no
`priority`**, because *"Google ignores `<priority>` and `<changefreq>` values"*, and because
`priority: 0.8` is an unsubstantiable claim in a machine-readable file — 013's rule arriving
in XML.

**The ticket's premise inverts.** It says the sitemap *"is the first thing on the public site
that reads Postgres on a crawler's schedule rather than a user's"*. With ISR it does not: it
reads Postgres on **our** schedule, once an hour, and serves cached bytes on the crawler's. If
Googlebot fetched it ten thousand times an hour the arithmetic below would not move.

| Meter (Hobby) | This route's share | Included | % |
| --- | --- | --- | --- |
| Invocations | ≤ 720/month | 1,000,000 | 0.07% |
| **Active CPU** | ~22 CPU-seconds/month | 4 hours | **0.15%** |
| Provisioned Memory | ~0.1 GB-hr | 360 GB-hr | 0.03% |

The 22 seconds is the honest ceiling — string-building ~10,300 entries at the 10,000-programme
design target, 720 times. The Neon query it waits on is I/O, and Vercel is explicit that *"You
are only billed during actual code execution and not during I/O operations."*

**So static-at-build loses on freshness, not on money**, which is the opposite of how the
ticket framed the choice. 010 deploys on push to `main`; uploads arrive continuously and *are*
the product, so a sitemap frozen at deploy time lists the catalogue as it stood at the last
commit and is wrong on day two. 030's four static routes are static because *"they read no
database and no blob"* — this one reads the shelf, and that is the whole difference.

Three things fall out that nobody asked for:

- **The sitemap query is the shelf query minus pagination**, so `pending` (null
  `current_revision_id`, 011) and tombstoned (`status <> 'published'`, 003) fall out of it for
  free. No exception is written anywhere, which is 011's *"hides pending programmes from the
  shelf with no status predicate"* paying a second time.
- **It demotes 009's numbered pages from load-bearing to redundant.** 009 made pagination the
  *only* crawl path to a programme page, which is a single point of failure sitting on a UI
  decision. Every programme is now listed directly, so the numbered pages become the second
  path rather than the only one — and redundancy is what you want under a signal Google calls
  *"merely a hint"*.
- **`/?page=N` is deliberately *not* in the sitemap**, and neither is any
  `/p/{slug}/r/{n}`. Sitemap inclusion is *"a weak signal that helps the URLs that are
  included in a sitemap become canonical"*, so listing a URL you have just canonicalised away
  argues against yourself.

At the design target this file is ~10,300 URLs against a limit of *"50MB (uncompressed) or
50,000 URLs"* — 20% — so **one sitemap, no `generateSitemaps` split**, and splitting is
additive when it is needed. `lastModified` is the current revision's `uploaded_at`; an owner
editing title or sector in place (015) does **not** move it, which is correct rather than a
gap, because Google uses the value only *"if it's consistently and verifiably accurate"* and
every number above the fold comes from the Revision.

### 3. Canonicals: three classes get something other than a self-reference, and the ticket's minimum was wrong about one of them

Full table in the asset §1. The interesting rows:

**`/p/{slug}/r/{n}` where `n` is the current revision → `/p/{slug}`.** This is the ticket's
stated minimum and it is right, because it is the estate's **only true duplicate pair** —
byte-identical HTML at two URLs.

**`/p/{slug}/r/{n}` where `n` is superseded → self-canonical, plus `noindex, follow`.** Here
the ticket's minimum is wrong, and the correction is the substantive canonical decision. Rev 7
of Fixture A's two-year monthly series is not a duplicate of rev 24; it is a different
programme's worth of dates, floats and DCMA marks. Canonicalising it to `/p/{slug}` asserts
they are the same page, which is false, and Google clusters *"pages that seem to be the same
or the primary content very similar"* on its own evidence regardless of what we claim. So the
duplicate claim is dropped and a **`noindex` takes its place**, on 030's precedent from one
ticket ago — superseded legal texts are `noindex` because *"stale legal text is not what a
search for 'xerhero terms' returns"*. A search for a programme should return the state it is
in, not the state it was in fourteen months ago, and a 24-revision series otherwise puts 24
near-identical pages in the index for one job, at a design target of 10,000 × 3.

`follow`, not `nofollow` — the pages stay crawlable, linked, shareable and live. `noindex`
removes them from results and nothing else.

**`/?page=N` self-canonicalises, including the page number.** Google is explicit: *"Don't use
the first page of a paginated sequence as the canonical page. Instead, give each page its own
canonical URL."* `/?page=1` is not a canonical spelling under 009's own omit-at-default rule,
so it **308s to `/`** — a `next.config` redirect with a query matcher, handled in Vercel's
routing layer with no Function invocation. And `/?page=N` past the last page **404s**, per
Google's *"Return an HTTP 404 status code when a filter combination doesn't return results"*,
which closes the one unbounded space `page` would otherwise open.

**Facet URLs emit no canonical and no robots meta at all** — the deliberate blank in the
table. A directive on a URL that `robots.txt` forbids fetching is the classic contradiction,
and asserting its absence is a CI check (§6).

**030's version URLs gain the half it did not write.** 030 fixed that the current
`/terms/v{n}` canonicalises to `/terms` and superseded ones are `noindex`. What it did not say
is what a *superseded* version canonicalises to, and the answer is **itself** — pointing it at
`/terms` would claim the superseded text and the current text are the same document, which is
exactly what 003's audit trail depends on being false. Symmetrically, the **current**
`/terms/v{n}` gets its canonical and **never also a `noindex`**: a URL emits a canonical
pointing elsewhere, or a `noindex`, never both, because that is *"this page is the same as
that one"* and *"remove this page"* about one cluster. Whether the directive propagates is not
documented by Google and is not asserted here; the ambiguity alone is not worth buying.

### 4. The sharpest one: a tombstone is `noindex` from the moment its row commits — in both classes

**Decided: yes, `noindex, follow`, and out of the sitemap, for Class A and Class B alike.**

The framing that settles it is not about exposure at all, it is about what a tombstone is
*for*. 003 keeps the row and the URL forever for one stated reason — *"deleting the row would
punch a hole in the ancestry chain"* — so the tombstone exists **so an inbound link does not
rot**, never so anybody can find it. A page whose entire job is to answer a link somebody
already holds has no business being a search result. `noindex` therefore costs nothing 003
asked for, and it buys the whole of 013's asymmetry: the gap between *a person who has the
link sees a title* and *the title is a search result for that title*.

That asymmetry is real here even though the page is PI-free. 013 proved PI is confined to
`original.xer.gz`, and after 017 step 2 that object and both derived objects are destroyed — so
a tombstone renders from the Postgres row alone, which is title plus uploader Handle plus one
of 017's three neutral lines. **But for a Class B the title can itself be the violation.** A
confidential contract's name, a client's name, a job that should never have been published: 003
kept the title visible for ancestry integrity, and an indexed, snippeted title is that decision
leaking into a channel 003 was not reasoning about. Google's own advice for keeping a URL out is
*"block indexing with `noindex`"*, and `noindex` *"must not be blocked by a robots.txt file"* —
which a tombstone is not, so the instrument is available and correct.

**Uniform across classes, deliberately.** A Class A owner who withdrew their programme did not
withdraw it in order to keep it in Google, and branching a head tag on `removal_class` puts one
more thing in the takedown path to get right for no benefit. 013's own lesson applies: one rule
about the removed object beats three exceptions.

**Checked against 017's four steps, which is where the real finding is.** The `noindex` is a
predicate over `programme.status`, so it is emitted the instant **step 1 commits** — the row
half, the reversible half, before a single byte is deleted. That is the correct ordering and it
costs zero schema. But running the check against step 3 surfaces a defect of exactly the family
017 found in 004:

> 017 discovered that **deleting the R2 object did not make 003's "bytes hard-delete" true**,
> because 004's year-long immutable cache kept a public URL live for up to twelve months. The
> identical defect exists one layer up for the **HTML page**: if `/p/{slug}` is cached with a
> long or unbounded TTL, tombstoning the row does not take the page down either — a crawler
> and a visitor both keep getting the pre-tombstone render, with every number and the download
> button on it.

Nothing in the closed set has ever fixed a cache TTL for any page. 023 called the public path
*"cacheable"* and left it there. So this ticket fixes exactly one, for exactly 017's reason and
with exactly 017's number: **the signed-out render of `/p/{slug}` and `/p/{slug}/r/{n}` carries
a TTL of at most one hour.** The page and the object it links to now expire on the same clock
because the argument is the same argument, and *purge should not fail* becomes true of the page
as well as the blob.

**No fifth step, and one dividend nobody had.** Adding a page purge to the CLI would need a
Vercel credential on the laptop, and 025 put the site's DNS records **DNS-only** in Cloudflare
precisely so Cloudflare is not in front of the site — so there is no Cloudflare purge to reuse
either. The one-hour TTL replaces it for free. Where speed genuinely matters — an urgent Class
B — the instrument already exists and was provisioned for something else: **027 created a
Search Console Domain property at 025 step 4 for DNS verification**, and that property carries
Google's Removals tool, which is the documented fast path for getting a URL out of results. It
becomes a per-incident line in `docs/operating.md` for Class B only, deliberately not code —
automating it would buy a Search Console API credential to do what a free UI does in a minute,
which is 024's rule about credentials, verbatim.

Two smaller rows fall out of the same predicate work, both free:

- **`/p/{slug}` with no published revision** (011's `pending`) is not in the sitemap by
  construction and 404s to anyone but its owner, so it needs no directive.
- **`/u/{handle}` is indexable exactly when 016's eligibility gate says the contributor is
  listable.** Zero published non-tombstoned Programmes already delists you from the
  leaderboard; the same predicate now also drops you from the sitemap and adds `noindex`. One
  gate, two consumers, no new query and no new column — and it covers the cascaded-tombstone
  case and the account-deletion case without either being reasoned about separately.

### 5. OG cards and structured data: the card carries no authored prose, and the schema is blocked by 013

**Text-only OG and Twitter cards, one committed static image site-wide, and no generated image
ever.** Templates in the asset §8.

The ticket's worry — *"an OG card is where a description gets written by someone who has
forgotten both"* — is answered structurally rather than by care. **No OG string in this site is
authored.** Every value is either a string a closed ticket already fixed (the site-level
description is 009's strap, verbatim) or a fixed template over columns 007's row already
renders: activities, sector, P6 version, progress, uploader, CC-BY. There is no new sentence,
so there is nothing for 030's banned-phrase list to catch and nothing for a future editor to
soften. The uploader's free-text `description` is deliberately **not** used — it is optional
and empty for the guaranteed state of an uncaring upload, and a snippet is where 030's rules
are least enforceable when the words are somebody else's. It stays on the page, in the FTS
index and in the CC-BY publication; it is simply never put in our voice.

**A tombstoned programme emits the site defaults and nothing else.** 003 keeps the title
visible *on the page*, which is a URL somebody already holds. An unfurl is the same title
travelling *outward* into a Slack channel nobody asked. One branch on `programme.status` — the
same one the `noindex` reads.

**Generated images are refused on the meter, and the number is not close.** Vercel's own
pricing doc singles out the failure mode: *"computationally intensive tasks (like image
processing) will use more CPU time than I/O-heavy tasks"*, and Next's OG images are
*"statically optimized… unless they use Request-time APIs or uncached data"* — a per-programme
card is uncached per-row data by definition, so it is a Function invocation and a rasterisation
per request. It would be an unauthenticated, enumerable, CPU-bound public endpoint fetched by
every link unfurler in existence, against a **4 CPU-hour** monthly allowance shared with the
sweep, the presign, ingest and every page regeneration. **This is the first thing in the
estate that could move 010's CPU trigger**, which 024 examined and found does not fire for its
own work. It is also a new image surface with its own rule, one designer's afternoon from an
avatar, against 027's structural *nothing renders `user.imageUrl`*. The ban is a CI grep:
`next/og` and `ImageResponse` appear nowhere in the repo.

*The single static wordmark card is overturnable taste* — a bare no-image unfurl is arguably
cleaner; the ban on generated ones is not taste.

**Structured data: none in v1, and the reason inverts the question.** This was expected to be
a *should we bother* trade and it is not:

- **`Dataset` is blocked, not skipped.** It fits a programme page almost perfectly — `name`,
  `description`, `creator`, `license` all exist — but the property that makes it a Dataset
  entry is `distribution`, *"where to get the data and in what format"*, and the only honest
  answer is `original.xer.gz` on the blob host. **That is the one object 013 confined all PI
  to**, marked `noindex, noarchive`, put behind `Disallow: /` and linked `rel="nofollow"`.
  Emitting a machine-readable pointer to it is the precise inverse of 013's entire mitigation,
  and a `Dataset` without `distribution` announces that a dataset exists with no way to reach
  it. Revisit only if `distribution` can ever name something that is not the PI-bearing
  object; today it cannot.
- **`AggregateRating` over 016's votes is banned outright** — it converts a raw count into a
  rating, which is 013's computed-versus-endorsed line and the map's Out-of-scope entry on
  badges. A star rating in a result is a quality mark wearing a schema type.
- **`BreadcrumbList`** is the only harmless candidate and is refused on a smaller argument:
  the first block of JSON-LD in a codebase is what makes the second one easy, and it buys a
  breadcrumb line in a result nobody is competing for.

### 6. Asserted: eleven CI keys, **one** new sweep key, and no migration

024's precedent does not transfer whole, and saying why is the point. 024 asserted the blob
host's `robots.txt` because it was **certainly-absent** — an object in a bucket that no code
path wrote. This site's `robots.txt` is a build output of a file in the repo: if the file
exists the route exists, and a build that ships cannot fail to serve it. Certainly-absent does
not apply.

**Possibly-wrong does**, in one direction that is silent: `Disallow: /` shipped by accident,
from the file two directories away that is supposed to say exactly that. So the instrument
follows 024's own split by *cause*:

**Cause 1, a commit → CI**, on 018's existing stack-up job, no secrets, blocking on `main`.
Eleven keys in the asset §5.1. The one that earns the generated `robots.ts` is
**`ci.robots.facets_disallowed`**, which derives its expected disallow list from
`SHELF_QUERY_PARAMS` — the same constant the shelf's URL builder uses. This is 024's best
mechanism reused verbatim: 024 made CI's preflight derive its header list *from the presign's
own output* so *"the presign changed"* and *"CORS is now wrong"* became one failure. Here,
**adding a fifth facet to 009's four without disallowing it is a test failure rather than an
unbounded crawl discovered six months later.** A static `app/robots.txt` cannot do that, which
is the whole reason the file is generated. `ci.canonical.tombstone_noindex` needs no new
fixture either — 018's dev catalogue already contains *both tombstone classes*.

**Cause 2, something with no commit behind it → one key on 024's existing rule.**
`edge.site.robots_txt`: an unauthenticated GET of `https://xerhero.com/robots.txt`, asserting
200 and no bare `Disallow: /`. **No new rule, no `alarm_state` row, no migration** — 024
established `sweep_run.breaches` is jsonb so a rule key needs nothing there, and this spends
that property one level down.

It earns its place on a gap nobody had noticed: **025 put the site's records DNS-only and the
blob host proxied, and every one of `edge_drift`'s existing keys points at
`blobs.xerhero.com`. Nothing in this estate has ever observed `xerhero.com` itself.** A
detached Vercel domain or a broken apex record leaves every current assertion green. One GET
closes it, and it also makes 025's *"`edge_drift` is already the expiry alarm"* true of both
hostnames rather than one.

**`/sitemap.xml` deliberately gets no key**, and that is the sharper half. Under ISR a failed
revalidation serves the last good cached bytes, so a 200-and-well-formed assertion would be
**green through precisely the failure it exists to catch** — which is 024's own static-canary
finding (*"a static canary is green in exactly the case that matters"*) arriving in a new
place. Rather than ship a weaker instrument, the sitemap is covered where it can be: in CI,
against 018's dev catalogue, before merge.

### 7. What this hands to other tickets

- **[Browse, search, filter and ranking](009-browse-search-ranking.md)** — its facets, `q` and
  `sort` become uncrawlable while `?page=N` stays the crawl path exactly as designed; its
  canonicalisation rules gain the arriving-request half they never had; `/sector/{code}`,
  which it deferred here, is now filed as its own ticket.
- **[The site's static pages](030-static-pages.md)** — its version-URL rule gains its missing
  half (a superseded version self-canonicalises) and a rule that keeps its two instruments
  apart.
- **[Personal data in published .xer files](013-personal-data-in-published-files.md)** — its
  `noindex` mitigation reaches the site for the first time, on tombstones, and its confinement
  of PI to one object is what blocks `Dataset` structured data.
- **[What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md)** —
  its four steps are unchanged and gain no fifth; its 004-cache defect is found to exist one
  layer up and is closed with its own one-hour number; Search Console Removals becomes a
  documented per-incident line for Class B.
- **[Licensing, attribution and takedown](003-licensing-attribution-takedown.md)** — the
  tombstone stays at its URL forever, and stops being findable.
- **[The project detail page](008-project-detail-page.md)** — its server-rendered fold is what
  makes all of this work, and it gains a cache TTL and three head tags.
- **[Verifying the production-only edges](024-verifying-production-only-edges.md)** — one key
  on `edge_drift`, and its own instrument is extended to the one hostname it never watched.
- **[The blob host and the site's domain](025-blob-host-and-domain.md)** — its `.vercel.app`
  308 is upgraded from a bookmark concern to a crawl requirement.
- **Build work, not a decision:** `docs/operating.md` gains the Search Console line;
  `next.config` gains the `?page=1` redirect.

### 8. Schema, backfill, and the derived contracts

- **Schema demand: zero.** No table, no column, no index, **no migration** — notably not even
  024's single seeded row, because `edge_drift` already exists and its breach payload is jsonb.
  Every predicate here is an existing column: `programme.status` (003), `current_revision_id`
  (011), `revision.rev_no` against the current (005), and 016's eligibility gate.
- **Backfill demand: none.** Nothing is recomputed and nothing existing is invalidated. Every
  tag is derived at render time from a row that already holds the answer.
- **`derived.json`, `activities.json`, `card`: nothing enters any of them.** The contracts stay
  at v2 and v2. This is deliberate rather than incidental — the OG description is a template
  over **Postgres columns** and never over `derived.json`, precisely so it renders for a
  `pending` or tombstoned Programme whose blobs do not exist. A crawl surface that depended on
  a blob would break in exactly the state it most needs to be correct.

### Flagged

- **`/sector/{code}` is now the only shape a crawlable sector view could take**, because
  `?sector=` is disallowed. It is 8 URLs rather than 30,000, single-valued, stable and the one
  facet 015 called the shelf's organising idea — so the combinatorial objection does not
  apply to it. It is not built in v1 because at launch the catalogue is a handful of
  programmes and eight near-empty landing pages is thin content. 009 deferred the shape here;
  filed as its own ticket.
- **Only one page in the estate has a cache TTL, and it got one for a takedown reason.**
  `/p/{slug}` and `/p/{slug}/r/{n}` are fixed at one hour here. The shelf, `/u/{handle}` and
  `/contributors` still have no fixed caching strategy and nothing in the closed set owns one.
  Recorded rather than resolved, because those three pages carry no takedown property — a
  stale shelf row links to a page that is itself tombstoned.
- **Every decision here is unmeasurable by construction.** 030 chose no analytics of any kind,
  so nobody will ever know whether the sitemap was crawled, whether a programme page was
  entered from search, or whether disallowing the facets helped or hurt. That is the map's
  existing analytics trade, restated at the one place where it bites hardest.
- **A `Disallow`ed facet URL can still be listed without a snippet** if someone links to it.
  Accepted; the escape hatch is recorded in the asset §7 and the important part of it is that
  the fix is *remove the `Disallow` and add `noindex`*, never both at once.
- **The `.vercel.app` 308 is now crawl-critical, not just bookmark-critical.** 025 required it
  so bookmarks would not rot. It is also the only thing stopping `xer-hero.vercel.app` serving
  its own `Allow: /` and a `Sitemap:` pointer at a different host, which is a second indexable
  origin for every path. Once the 308 exists the second host serves a redirect for
  `/robots.txt` too and the problem does not arise — but the window between the first
  production deploy and the domain being attached is real, and it is a provisioning-order
  note for 026 rather than anything code can fix.
