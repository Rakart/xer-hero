---
id: 034
title: "Do sector landing pages exist, now that ?sector= is uncrawlable?"
type: grilling
status: closed
assignee: carlo
blocked_by: []
---

## Question

009 deferred `/sector/{code}` to the discoverability patch and named the shape it should
take — *"a rewrite onto the canonical query URL, not a second route with its own
duplicate-content problem"*. 033 has now made the query form **uncrawlable**:
`Disallow: /*?*sector=` is in the site's `robots.txt`, so there is no crawlable sector view
of the shelf at all.

That changes the question rather than answering it. The combinatorial objection 033 used
against the facet space **does not apply to sector alone**: it is single-valued in a path
form, the code list is **eight and seeded by migration** (015), the codes are stable because
merging them *"rewrites rows and breaks shared `?sector=` URLs"*, and 015 called sector *"the
shelf's organising idea"* while 009 found it is **the only facet doing real work at launch**.
Eight URLs is not thirty thousand.

Against that: at launch the catalogue is a handful of authored templates, 015 refused a
per-code quota, and Google's own faceted-navigation guidance says to *"Return an HTTP 404
status code when a filter combination doesn't return results"* — so several of the eight
would be empty pages on day one, which is thin content on a site whose whole first impression
is honesty about being small.

Settle:

- **Does the route exist in v1, later, or never?** If later, name the trigger — a catalogue
  size, a number of occupied codes, or a specific observation. Note that 030 chose **no
  analytics of any kind**, so no observation about search traffic will ever be available; the
  trigger has to be something the operator can see in Postgres.
- **If it exists, which is canonical** — `/sector/rail` or `/?sector=rail`? 033's rule is
  that a URL emits a canonical pointing elsewhere or a `noindex`, never both, and that a
  `Disallow`ed URL must emit neither. So the path form has to be the canonical and the query
  form has to stay disallowed, or the pair contradicts itself. Check that against 009's
  rejection of path-segment schemes, which was about **multi-select** (`rail` *and*
  `highways`) and may not survive contact with a single-valued route.
- **What an empty sector code does.** 015 chose *"greys out under 009's zero-disabled rule"*
  for the facet chip, which is a UI answer; a route needs an HTTP answer. 404, or a page that
  says nothing is here yet — and 013's no-warranty prose rules apply to whichever sentence
  that is.
- **Whether it goes in the sitemap**, and what its `lastmod` would be.
- **Whether anything else in 009's facet set deserves the same treatment** — size bands, P6
  version and `progressed` are all small closed sets too, and the answer is presumably no,
  but it should be a decision rather than an omission.

Zero schema demand is expected — `programme.sector` is an existing indexed column and the
code list is already seeded from the repo.

## Resolution

**Not in v1, and the trigger is a fact about the catalogue rather than a fact about demand —
because a fact about demand is the one thing this estate has permanently given up.** The route
is right and the shape is right; only the catalogue is wrong. When it ships, `/sector/{code}`
is the **canonical** form and `?sector=` stays `Disallow`ed emitting nothing; an unoccupied or
unknown code **404s**; occupied codes go in the sitemap with `lastmod` = the newest published
upload in that code, off rows the sitemap already selects. **No other facet gets this
treatment**, and the rule that says so is written rather than assumed. **Zero schema demand,
zero backfill, nothing enters `derived.json`, `activities.json` or `card`** — and no asset,
because the working is four quotes and one `having` clause.

### 1. The route buys exactly one thing, and it is the thing that cannot be measured

Worth establishing before the trigger, because it decides how much the deferral costs.

033 made the sitemap list **every published `/p/{slug}` directly**, which demoted 009's
numbered pages from the only crawl path to the second one. A sector page is a subset of a page
that is already crawlable, whose members are already listed individually — so `/sector/rail`
adds **zero URLs to the crawl graph**. That is 033's own argument against the facet space,
arriving on the other side of the trade and pointing the same way: nothing becomes reachable.

What the route actually buys is a **ranking target** — one page whose title, heading and
content are about rail, for a person typing *rail programme* into Google. That is a real thing
to want and it is not a crawl question at all. It is also, under 030's no-analytics decision,
**permanently unverifiable**: nobody will ever know whether `/sector/rail` was entered from
search, or ranked, or was crawled. So deferring it costs nothing observable, and building it
can never be justified after the fact either. The justification has to be structural and known
in advance, which is what §2 sets.

### 2. Not in v1: half the list at a page each, and the operator already has the instrument

**Trigger: at least four of the eight codes each hold ≥ 25 published Programmes.**

Both numbers come from closed tickets rather than from feel. **25 is 009's page size** — the
point at which a sector view is a full page in its own right rather than a short excerpt of
one, and 009 already noted that at launch *"page 1 holds everything and no pagination chrome
renders"*. **Four is half of 015's list**, which is what makes the route a set of pages instead
of one page and seven 404s. The two together imply ≥ 100 published Programmes, so the
unfiltered shelf is at least four pages deep and a sector page is a genuine subset rather than
a re-render of `/`.

One query, and it goes in `docs/operating.md`:

```sql
select p.sector, count(*)
  from programme p join revision r on r.id = p.current_revision_id
 where p.status = 'published' and p.sector is not null
 group by p.sector having count(*) >= 25;
```

**But the sharper answer to the ticket's own warning is that the operator does not have to run
it.** 030 removed every instrument that could see a visitor, and the ticket is right that no
observation about search traffic will ever exist. It does not follow that nothing is
observable: **009's live conjunctive facet counts render the per-sector count on the filter bar
of the homepage, on every load, for every viewer.** They were bought so a sparse catalogue does
not dead-end, and they turn out to be the estate's only visitor-independent measuring
instrument — they measure the *catalogue*, which is exactly the class of fact 030 left intact.
The trigger is therefore printed on the front page in v1, at zero cost, before anything is
built. No new alarm rule, no fifth `alarm_state` row, no migration; 019's rules stay four and
024's `edge_drift` gains nothing.

**The known false negative, stated:** a catalogue that piles up in one code never trips this —
4,500 rail against 100 highways is two codes over the bar, not four. That is the correct
outcome rather than a gap, because when one code dominates, `/sector/rail` *is* the shelf, and
009's frozen newest-first order already serves that page at `/`.

**Rejected: ship the route now and 404 any code under the bar.** It is self-managing and it
ships today, and it loses on the primary source. Google's instruction is to 404 *"when a filter
combination doesn't return results"* (§Sources 1) — not when it returns few. A 404 on a URL
that has content is a lie at the HTTP level, and it would 404 a page a visitor can reach from
the breadcrumb of a Programme that is sitting on it.

### 3. When it ships: the path form is canonical, and 009's rejection half-survives

**`/sector/{code}` self-canonicalises. `?sector=rail` stays `Disallow`ed and emits neither a
canonical nor a `noindex`, exactly as 033's table has it.** No row changes; one row is added.

This is not a contradiction of 033, it is 033's §1.1 mirror rule applied: the query form is
stopped from being **fetched**, so it never carries a directive; the path form is the one that
is **listed**. Emitting a canonical on the query form pointing at the path form is specifically
wrong, and Google says so — *"Don't use the robots.txt file for canonicalization purposes"*
(§Sources 3). The two instruments stay on opposite URLs.

The route also never needs `noindex`: it either 200s and is indexable with a self-canonical, or
it 404s. There is no third state, so *"a canonical pointing elsewhere or a `noindex`, never
both"* is satisfied by construction rather than by care. Checked against a source 033 did not
have: Google's own words are *"We don't recommend using noindex to prevent selection of a
canonical page within a single site, because it will completely block the page from Search"*
(§Sources 3) — 033's rule was derived from ambiguity, and it is documented.

**009's rejection of path-segment schemes splits in two, and only one half dies.**

- *"`/sector/rail` has no natural expression for rail and highways"* — **survives, and becomes
  the route's shape.** The path route is **single-valued only**. `/sector/rail,highways` does
  not exist and 404s; adding a second sector, or any other facet, moves the visitor onto the
  query form. The route is an **entry point**, not a filter state, and that is the whole of
  what 009's objection permits.
- *"a `/sector/rail` + `/?sector=rail` pair is duplicate content needing a canonical tag from
  day one"* — **dead, killed by 033.** Google clusters *"pages that seem to be the same"* from
  pages it has crawled; one member of this pair is never fetched. The duplicate pair 009 feared
  cannot form.

009's stated shape — *"a rewrite onto the canonical query URL"* — therefore **inverts**. The
path form is canonical and the query form is the uncrawlable one. Implementation is either a
`next.config` rewrite or one `app/sector/[code]/page.tsx` calling the shelf with `sector` fixed;
the second is chosen because the page wants its own `<h1>` and canonical anyway, and a rewrite
saves nothing. *Overturnable taste.*

Two properties fall out free. **033's `Disallow` rules are param-matched, not path-matched**, so
`/sector/rail?size=l` is already disallowed the day the route ships, with no edit to
`robots.txt` and no change to `ci.robots.facets_disallowed`. And `page` is deliberately not
disallowed there either, so 033's pagination contract applies unchanged one level down:
`/sector/rail?page=N` self-canonicalises including the page number, `?page=1` 308s to
`/sector/rail`, and a page past the last 404s.

**Guard rail, because it is the obvious wrong move:** shipping the route must not remove
`sector` from `SHELF_QUERY_PARAMS`. The query form stays a working multi-select filter for
humans and stays disallowed; the path route is purely additive.

### 4. An empty code 404s — and so does an unknown one, and so does the largest bucket

**404, on Google's own instruction for this exact case:** *"Return an HTTP 404 status code when
a filter combination doesn't return results"* (§Sources 1).

The 200-with-a-sentence option loses twice. Google treats it as a 404 anyway — *"If the content
suggests an error for Google Search, an empty page or an error message, Search Console will show
a `soft 404` error"* (§Sources 2) — so it buys the outcome it was trying to avoid, **plus** a
sentence about the state of the catalogue that 013's wording rules then have to police. 404 is
cheaper in both directions and needs no prose at all, which is the strongest form of complying
with 013.

Three consequences, all one branch rather than three:

- **An unknown code 404s by the same predicate.** `/sector/tunnelling` — which 015 explicitly
  refused as a sector — and `/sector/nuclear`, which is on 015's reachable-by-insert list, are
  the same case as an occupied-nowhere code. The route's condition is *code exists in the
  `sector` table **and** has ≥ 1 published Programme*, one query, one 404.
- **There is no `/sector/unsectored` and no `/sector/none`.** 015 gave blank no facet chip
  because it is *"plausibly the largest bucket"* and advertising it tops the counts with the
  catalogue's own untidiness. That decision now has an HTTP consequence: **the largest bucket in
  the catalogue is the one with no landing page**, which is a second reason this route is a
  discoverability nicety rather than a browsing necessity.
- **No internal link ever points at a 404.** 009 greys out zero-count chips, and the only other
  link is 008's breadcrumb `shelf / {sector} / {title}` — whose sector segment renders only on a
  Programme that is itself in that sector, so the target has ≥ 1 member by construction. The one
  edge is a tombstoned Programme, whose breadcrumb sector segment renders **unlinked**, reading
  the same `programme.status` branch 033's `noindex` and OG defaults already read.

### 5. In the sitemap, off rows it already holds

**Yes, occupied codes only, `lastmod` = the newest published `uploaded_at` in that code.**

It costs no second query. 033's sitemap already selects the shelf's published join without the
limit; adding `p.sector` to that select makes the sector entries a `groupBy` over an array
already in memory. Inclusion and the 200/404 boundary are then the **same predicate**, which is
033's own pattern — its sitemap excludes `pending` and tombstoned rows with no exception written
anywhere, because the join already does it.

`lastmod` is the shelf's rule filtered: 033 gives `/` the newest published upload, and a sector
page is `/` with a predicate. It satisfies *"if it's consistently and verifiably accurate"*
(033 §Sources 6.9) for the same reason `/p/{slug}`'s does — the page's content comes from
Revisions.

**One residue, and it is 033 §4.2's residue with one extra edge.** 015 made sector
owner-editable in place, so a re-classification moves a row between two sector pages without
moving any `uploaded_at` — a stale `lastmod` on both, and, at the boundary, a page that appears
or disappears. Under ISR it resolves within the revalidate window, and buying accuracy still
costs `programme.updated_at`, a column and a write on three edit paths, to move a date on a
signal Google calls advisory. Not bought, for the second time.

**Caching is not decided here.** The sector page is a shelf and takes whatever the shelf takes;
033 fixed a TTL only for `/p/{slug}` and recorded that `/`, `/u/{handle}` and `/contributors`
have no owner. This adds a fourth page to that unowned question and no new property — a
tombstoned Programme leaving a stale sector shelf links to a page that is itself tombstoned,
which is exactly 033's reason for leaving the shelf alone.

### 6. No other facet earns a path route, and here is the rule

**Decided no, per facet, not omitted.** A facet earns a path route only when it is (i) a
**closed set we seed**, (ii) **single-valued**, (iii) a **noun somebody would type**, and (iv)
**stable enough that a URL minted today means the same thing in a year**. Sector is the only one
of 009's four that scores on all of them, and each of the others fails a different one:

- **Size bands** fail (iv), hardest. `s`/`m`/`l`/`xl` are *our* bucketing of
  `revision.activity_count`, and 009 already moved the `xl` edge once, from 10,000 down to
  5,000. `/size/xl` would freeze a tuning constant into a public URL — 015's argument that
  merging codes *"rewrites rows and breaks shared `?sector=` URLs"*, applied to a boundary that
  is a number in our source rather than a row in a table. They also fail (iii): nobody searches
  for *a package or sub-contract*.
- **P6 version** fails (i). The values come out of the file, and every future P6 release adds
  one — it is an open set we do not control, which is the exact property that makes sector safe.
  009 also calls it *"a can I use this filter"*: a constraint applied to a set you already have,
  not a subject.
- **`progressed`** fails (ii) and (iii). It is presence-only, two-valued, and a boolean is not a
  topic. 009 expects it to read 0% across the board at launch anyway.

This is deliberately a rule rather than three verdicts, because a fifth facet will be proposed
eventually and `ci.robots.facets_disallowed` already forces it to be reasoned about on the
robots side. It should be reasoned about here too, and now there is something to reason against.

### 7. Schema, backfill, and the derived contracts

- **Schema demand: zero**, as the ticket expected. `programme.sector` is 005's nullable FK to
  the `sector` lookup, 009 already requires it indexed as a facet column, and 015's eight rows
  are seed data applied by migration. No table, no column, no index, no migration, and — as in
  033 — not even a seeded row.
- **Backfill: none.** Nothing is recomputed and nothing is invalidated.
- **`derived.json`, `activities.json`, `card`: nothing enters any of them.** The contracts stay
  at v2 and v2. The sector page is the shelf with a predicate, and 006 fixed that the grid
  renders from Postgres alone with zero blob reads; that property is what makes this route free
  when it is eventually built.
- **v1 build cost: nothing at all.** Nothing in v1's UI changes. The facet chip keeps linking to
  `?sector=rail` and 008's breadcrumb keeps linking to the query form until the route exists.

### Sources

1. Google, *Managing crawling of faceted navigation URLs* —
   https://developers.google.com/crawling/docs/faceted-navigation
   > *"Return an HTTP 404 status code when a filter combination doesn't return results."*
   > Faceted navigation *"can generate infinite URL spaces"*; `rel="canonical"` and
   > `rel="nofollow"` are *"generally less effective in the long term than the previously
   > mentioned methods."*
2. Google, *HTTP status codes, network and DNS errors, and Google Search* —
   https://developers.google.com/search/docs/crawling-indexing/http-network-errors
   > *"If the content suggests an error for Google Search, an empty page or an error message,
   > Search Console will show a `soft 404` error."*
3. Google, *Consolidate duplicate URLs* —
   https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
   > *"We don't recommend using noindex to prevent selection of a canonical page within a single
   > site, because it will completely block the page from Search."*
   > *"Don't use the robots.txt file for canonicalization purposes. Google may still index URLs
   > that are disallowed in robots.txt without their content."*
   > *"Add a self-referential `rel="canonical"` link element to the canonical page itself."*
4. Google, *Block Search indexing with noindex* —
   https://developers.google.com/search/docs/crawling-indexing/block-indexing
   > *"For the `noindex` rule to be effective, the page or resource must not be blocked by a
   > robots.txt file, and it has to be otherwise accessible to the crawler."*

### Flagged

- **The trigger is deliberately out of reach of authored launch stock.** 015 refused a
  per-code quota and the map's *how authored sector templates get made* patch inherited a free
  choice from it. Four codes at 25 Programmes each is ~100 hand-built P6 programmes, which
  nobody is going to author to unlock a route — so the quota cannot come back through this door.
- **A `Disallow`ed `?sector=rail` can still be listed as a bare snippetless result** if someone
  links it, which 033 accepted for the whole facet space. Once `/sector/rail` exists that
  becomes marginally worse — there is now a better page for the same rows that Google was not
  shown. It is still not worth reversing the `Disallow`, and 033's escape hatch is unchanged:
  remove the param's `Disallow` **and** add `noindex, follow`, never both.
- **Nothing here is measurable, including whether the trigger was the right one.** 030's
  no-analytics decision means the operator will never learn whether `/sector/rail` ranked, was
  crawled, or was ever entered from search. What is new is the narrower claim underneath it:
  **catalogue facts are still observable and 009 already renders them**, so a decision keyed on
  the catalogue survives 030 while a decision keyed on traffic cannot be made at all. That
  distinction is worth more than this route is.
