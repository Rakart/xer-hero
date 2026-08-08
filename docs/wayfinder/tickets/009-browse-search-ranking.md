---
id: 009
title: Browse, search, filter and ranking
type: grilling
status: closed
assignee: carlo
blocked_by: [006]
---

## Question

How does someone find a programme worth opening?

A store is a browsing experience, not a search box. With authored sector templates
as launch stock and a small catalogue at first, discovery is mostly *navigation*
— and it has to degrade gracefully as the catalogue grows.

Settle:

- **The landing view.** What does a signed-out visitor see first? Featured,
  newest, most-forked, by sector? The first screen is the pitch.
- **The facets.** Which fields can you filter on — sector, size band, duration
  band, has-resources, has-costs, P6 version, licence, has-forks. Every facet must
  be an indexed Postgres column, so this ticket feeds back into
  [Domain model and schema](005-domain-model-and-schema.md); if a facet is only in
  `derived.json`, it cannot be filtered on cheaply.
- **Sorting.** Newest, most-forked, most-viewed, largest, longest. What is the
  default and why.
- **Search.** Full text over what — programme name, description, tags, WBS node
  names, activity names? Activity-name search is powerful and expensive; decide
  whether it is v1. Postgres full-text or a dedicated index?
- **Ranking.** With no engagement data at launch, what orders the default view?
  Avoid a ranking that needs traffic to work.
- **URL structure.** Filters and facets should be linkable and shareable — a
  planner sending a colleague "all rail templates over 2 years" is free
  distribution. Decide the URL scheme now; it constrains the routing.
- **Pagination.** Infinite scroll or pages. Pages are shareable and crawlable;
  infinite scroll browses better. Pick, with the reason.

## Resolution

**The shelf is the homepage, it is ordered newest-first, and nothing traffic-fed is
ever allowed to touch that order.**

Discovery in v1 is navigation over a small, honest catalogue: four facets, a text
search over metadata only, numbered pages, and a default sort that works on day one
with zero engagement data and keeps working at the 10k-programme ceiling.

### 1. The shelf is the homepage

`/` renders the row grid directly — full catalogue, filter bar, sort control. No hero,
no curated strips, no separate `/browse` route.

The composed-homepage alternative (Featured / Newest / Most-forked strips, each with a
"see all") was rejected on the launch condition: the stock is authored sector templates,
so the whole shelf is two or three screens and a strip of five is a worse view of the
same rows. Strips also need curation and engagement signals, which are exactly the two
things this map has parked in fog — and they halve the rows per screen to buy chrome.

The cost is real and is paid in §10: a cold visitor sees twelve columns of planner
jargon and no statement of what the site is.

### 2. Default order: newest Programme, frozen

`order by programme.created_at desc, programme.id desc`.

Three candidates were beaten, and the reasons matter more than the winner:

**Recently updated** (`current revision.uploaded_at desc`) loses because a Programme is
new once but updated forever. Fixture A is a two-year monthly series — 24 revisions of
one contract — so bumping on revision hands the top of the shelf permanently to whoever
maintains a live job most diligently. Routine maintenance is not news.

**Quality** (`checks_passed / checks_applicable desc`) loses because DCMA is a
compliance audit, not a quality score, and the fixtures prove it inverts: Fixture A is a
real live contract that fails check 7 at 69% negative float, while a clean authored
template passes by construction. Leading with it shelves real work beneath synthetic
work and teaches uploaders to game ten checks. DCMA stays where 007 put it — a cell
strip you read *after* choosing a row — and is available as an opt-in sort (§6).

**Operator-set rank** (`curation_rank`) loses because it is curation, which the map has
in fog pending this decision, and a rank column invites hand-ordering the entire shelf.

**The default is frozen: it never becomes upvote-weighted.** Once
[016](016-credit-upvotes-leaderboard.md) lands a denormalised total, votes reorder the
shelf only when a visitor explicitly picks that sort. A vote-weighted default is a
popularity ratchet — early uploads accrue votes, hold the top, accrue more — and it
makes the front page unexplainable the first time someone asks why their programme
moved.

Honest cost: at launch every authored template lands the same day, so `created_at desc`
is effectively insertion order. Arbitrary, but stable, explainable, and it needs no
traffic to work.

### 3. Four facets

Every facet must be an indexed Postgres column or it is unaffordable. All four already
exist in the [005](005-domain-model-and-schema.md) DDL — **this ticket adds no facet
columns.**

| Facet | Column | Why it survives |
|---|---|---|
| **Sector** | `programme.sector` | The shelf's organising idea. Fixed list, already FK'd. |
| **Size band** | `revision.activity_count` | "Is this my size of job" — 310 vs 3,344 is a real question. |
| **P6 version** | `revision.p6_version` | Not cosmetic: a newer `.xer` will not import into an older P6. A *can I use this* filter. |
| **Progressed** | `revision.pct_complete > 0` | The sharpest split in the corpus — Fixture B is a 0% tender, Fixture A a 41% live job. Different things to want. |

Cut, with reasons worth keeping:

- **Licence** — dead facet. [003](003-licensing-attribution-takedown.md) fixed CC-BY-4.0
  site-wide with no per-upload choice, so the column has one value.
- **Has-forks** — 007 took the fork counter off the row and withdrew the schema demand
  with it. As a filter it is either a denormalised counter nobody else wants, or an
  `exists` subquery per row, which breaks the grid's one-query rule.
- **Has-resources** — **measured, it does not discriminate**: DCMA check 10 reads 86.4%
  on Fixture B and 83.4% on Fixture A. Nearly everything is resourced, so the filter
  removes nothing.
- **Has-costs** — computed nowhere in the derived contract. A new stat *and* a new column,
  for a question nobody has been observed asking.
- **Duration band** — needs an expression index on `finish_date - start_date`, and
  dateless programmes (a seeded degenerate case in 007's prototype) fall out of the
  filter entirely rather than reading as "unknown". The window curve already conveys
  length while browsing.

**Combination: OR within a facet, AND across facets.** Rail-or-highways, sized-large
*and* progressed. It is the conventional reading and the only one whose empty state can
be explained.

Stated plainly: **at launch, sector is the only facet doing real work.** Size will
cluster, P6 version will hold one value, progressed will read 0% across the board. That
is an argument for the counts in §9, not for cutting the other three — they earn their
keep the moment real uploads arrive.

#### Size bands

| Band | Activities | Reads as |
|---|---|---|
| `s` | < 500 | a package or sub-contract |
| `m` | 500 – 2,000 | a typical single job |
| `l` | 2,000 – 5,000 | a major contract |
| `xl` | > 5,000 | a programme of works |

The `xl` edge was pulled down from a first-draft 10,000. A >10k-activity programme is a
megaproject or a multi-project export, and multi-project exports sit in the map's
*format areas with no fixture* patch — a v1 that rejects them would leave `xl` returning
zero rows forever, and an always-empty band reads as a broken site rather than as
"nothing that big". At 5,000 the band stays plausibly occupied and Fixture B's 3,344
activities still land in `l`.

### 4. No tags in v1

**Sector is the only classification axis.** This also settles a live contradiction: 005's
prose said a Fork prefills "title, description, sector and **tags**", but the DDL it
shipped has no tags column. The prose was wrong and is corrected there.

[015](015-sector-classification.md) has not yet settled where the *first* classification
axis gets its value; adding a second before that lands is building on fog. Free tags need
normalisation from day one (`rail` / `railway` / `Rail` are three facets for one idea)
and render a sparse, mostly-empty rail at small catalogue size.

Safe because it is retrofittable: `tags text[]` plus a GIN index is purely additive,
unlike the Programme/Revision split. Cost: cross-cutting attributes sector cannot hold —
"design phase", "look-ahead", "framework contract" — become description prose, findable
only by search.

### 5. Search: Postgres full-text over metadata only

A generated `tsvector` column on `programme` over **title and description**, GIN indexed,
queried with `websearch_to_tsquery`.

**A dedicated search service is rejected on the cost model's own finding.**
[004](004-storage-cost-model.md) established that the real cliff is the *platform floor*
— ~$20–45/month flat, driven by service count rather than corpus size. A search service
is an entire extra floor plus a sync path that can silently drift, to index ~10k rows
that fit comfortably in Postgres's memory.

**WBS node names are out**, though they are the closest thing to "what is actually in
this programme" that is not a blob read. They live in `derived.json`, so indexing them
means a new denormalised column on `revision` fed by ingest and explicitly backfilled on
every contract version bump — and **Fixture B has exactly one WBS node**, so the field is
empty for precisely the tender-shaped programmes that are launch stock. Retrofittable.

**Activity-name search is dead for v1, on a price already established.** It requires
activity rows in Postgres: ~63,000 rows per revision, so ~1.9 billion rows and ~$66/month
at the 10k × 3 ceiling. It belongs to the existing **cross-project querying** fog patch,
not to a new question.

Two riders:

- **The Handle is not in the tsvector.** "Programmes by *dave_planner*" is a contributor
  page or an owner filter, not a text match, and stemming a pseudonym produces noise.
- **`pg_trgm` fallback on `title` when full-text returns zero rows.** At a small
  catalogue one stemmed miss ("depot" vs "depots") empties the whole shelf, which reads
  as "site is empty" rather than "no match". Trigram similarity gives a "did you mean".

### 6. Sort menu

**Newest** (default) · **Most upvoted** · **Largest** · **DCMA checks passed**.

*Most viewed* is cut: nothing counts views, adding it means a write per render, and a
view count is the most gameable and least meaningful signal on the shelf. 016 owns the
social signal.

Including DCMA as an option does not contradict §2. The objection there was to a
compliance audit being the site's *opening statement*, where it silently demotes real
progressed work. Opt-in, it answers a question planners genuinely have of a template
shelf: *show me a well-formed exemplar to copy*. **Labelled literally — "DCMA checks
passed", never "Quality" or "Best".**

Two mechanics:

- Sort on the **ratio** `checks_passed / checks_applicable`, not the raw count —
  applicable varies (10 without a baseline, up to 14 with), so counts compare different
  denominators.
- **Tiebreak `checks_applicable desc`**: a 10/10 measured against 14 applicable outranks
  a 10/10 against 10, because more checks survived means more was actually tested.

**Largest** sorts `revision.activity_count desc` on the current revision. **Most upvoted**
depends on the denormalised total 007 already demanded of 016; if 016 lands later, the
option renders disabled rather than blocking launch.

### 7. URL scheme

**One route, query parameters.** `/?sector=rail,highways&size=l&q=depot&sort=votes&page=2`

Path-segment schemes lose on multi-select — `/sector/rail` has no natural expression for
rail *and* highways — and a `/sector/rail` + `/?sector=rail` pair is duplicate content
needing a canonical tag from day one. The SEO argument for sector landing pages is real
but is not this ticket's to spend: they can be added later as a rewrite onto the
canonical query URL, which is the **discoverability outside the app** patch's call.

| Param | Values | Notes |
|---|---|---|
| `sector` | comma list of sector codes | OR within |
| `size` | comma list of `s`,`m`,`l`,`xl` | OR within |
| `p6` | comma list of version strings | OR within |
| `progressed` | `1` | presence-only; absent means no constraint |
| `q` | free text | triggers relevance sort (§13) |
| `sort` | `new`,`votes`,`size`,`dcma` | omitted at default |
| `page` | integer ≥ 2 | omitted at page 1 |

**Canonicalisation, so one filter state has exactly one URL:** omit any param at its
default, fixed param order as tabled, lowercase values, comma-separated multi-select
(never repeated keys), multi-select values sorted. Bare `/` is the default shelf.

### 8. Pagination: numbered pages, 25 per page

Offset pagination, `rel=next`/`rel=prev`, result count rendered.

Infinite scroll destroys the two things this shelf is for. The row grid is a *scanning*
surface, and "142 programmes · page 1 of 6" is itself a fact the browser wants — at
launch the catalogue's size is the site's most honest signal. It also breaks the back
button (open a row, return, lose your place) and is invisible to a crawler, which matters
because **the shelf is how a crawler reaches `/p/{slug}` pages at all**; hiding every
programme behind a scroll event would make the discoverability patch far harder to
resolve later. A "load more" button is better — deliberate, no scroll hijack — but
inherits the crawl problem and still cannot express "page 3 of rail" in a link.

Offset rather than keyset is deliberate: at the 10k ceiling `offset 9975 limit 25` is
trivial, and offset is what makes `page=3` a real URL. Keyset would produce a cursor
nobody can type or share.

At launch, page 1 holds everything and no pagination chrome renders.

### 9. Live conjunctive facet counts

Each facet value shows a count reflecting **the other active facets** — "Rail (12)" means
twelve *given* your current size and P6 selection. Zero-count values render **disabled,
not hidden**.

Mechanically: one extra query per shelf render, computing each facet's counts against the
current WHERE clause **minus that facet's own predicate** — otherwise selecting "rail"
makes every other sector read zero. Four `FILTER`-aggregate passes over a ≤10k-row table,
returning ~20 numbers. It does not touch the grid's one-query rule, being a separate
query.

This earns its place *at launch specifically*: the catalogue is small and sparse, so most
facet combinations are empty, and without counts browsing is a series of dead-end clicks
into 007's empty state. Counts turn the filter bar into a map of what exists — the
ticket's "degrade gracefully as the catalogue grows" property, running in reverse.

Static whole-catalogue counts were the trap option: cheaper, and they lie. "Rail (12)"
that yields zero rows once size is applied is worse than no number at all. Disabled
rather than hidden because a control list that shrinks as you filter jumps under the
cursor, and a greyed "Highways (0)" is information.

### 10. Layout: top filter bar, and a strap

**Facets sit in a horizontal bar above the grid, not a left rail.** This is where the
shelf defers to 007: the row carries twelve facts in fixed slots under an explicit rule
that **nothing in a row may flow**, and two of those slots are graphics needing real
width — the 30px float sliver with its three numeric slots, and the window S-curve on a
local axis. A left rail costs ~20% of viewport permanently, and the columns that compress
are the drawn ones, whose legibility 007 called a *relief rule* rather than decoration.
The fair counter — a rail shows all four facets and their counts open at once — costs
four clicks here, which is acceptable at four facets and would not be at twelve.

**Header carries the wordmark plus a one-line strap**, permanent, roughly *"Public
Primavera P6 programmes. Browse, download, fork."* Exact wording is not a map decision;
the slot is. A dismissible intro band was rejected: it costs a state flag and produces two
different first screens, so the page you describe to someone is not the page they get — a
dismissible band is a hero that lost an argument.

### 11. What the shelf never shows

One row per Programme, at its current revision, with `programme.status = 'published'` and
the joined revision `published`. **Tombstoned and `pending` never appear** — the `pending`
status 005 reserved for async ingest means a row can exist before it is renderable.

Result count and active-filter chips sit above the grid, chips individually clearable.

Signed-out renders the upvote pill unpressed and routes a click to sign-in; the pressed
state is 007's one join against the viewer's own votes. The Handle in the title cell links
to a contributor page — a demand on [016](016-credit-upvotes-leaderboard.md), not a new
surface invented here.

### 12. What this asks of the schema

Additive only. **No new facet columns** — all four facets are existing columns.

```sql
-- search
alter table programme add column search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')),       'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;
create index on programme using gin (search_tsv);

create extension if not exists pg_trgm;                      -- zero-result fallback
create index on programme using gin (title gin_trgm_ops);

-- the default sort, on every render
create index on programme (created_at desc, id desc);
```

Deliberately **not** added: a generated `checks_ratio` column for the DCMA sort, and
per-column indexes on `activity_count`, `p6_version` and `pct_complete`. 005 already
accepted that filtering across the Programme/Revision join cannot use a composite index
and is a sub-millisecond scan at the 10k ceiling; the same reasoning says these indexes
are speculative until something is measured.

One correction to 005's prose: **the tags mention in fork inheritance is deleted** (§4).

### 13. Relevance takes over when `q` is set

`q` present → ordering switches to `ts_rank` desc; an explicit `sort` param still
overrides. Typing a query is a statement of intent, and newest-first over matches buries
the best one. A blended rank-plus-recency score was rejected outright: it cannot be
explained to the person asking why their programme ranks where it does, and its weights
would be a permanent open question with no data to tune against.

- **`setweight('A')` on title, `'B'` on description**, so a title match outranks a
  passing mention in a long description.
- **Relevance appears in the sort control only while `q` is set**, shown as the active
  option; clearing the search returns the shelf to Newest.

`ts_rank` is weak at a small corpus — term statistics are noise across tens of documents,
so ranking is roughly "matched in the title" versus "matched somewhere". That is
acceptable, and it is why the trigram fallback does real work early on.

### 14. Fog this clears

- **Activity codes as a browsing facet** — resolved **no** for v1. The patch was waiting
  on this ticket's ranking model; the facet set is closed at four, and code density is not
  even stable across programmes (~14 assignments per activity in Fixture A, ~6 in Fixture
  B), so a code facet would compare unlike things.
- **Curation** — its stated dependency is now settled and v1 ships no curation surface:
  no featured strip, no `curation_rank`, no editorial ordering. Still fog, with the
  dependency cleared.
- **Discoverability outside the app** — gains fixed inputs: a canonical query-param shelf,
  crawlable numbered pages as the path to every `/p/{slug}`, and `/sector/{code}` landing
  pages explicitly deferred to it as a rewrite onto the canonical URL.

### Amendment 2026-08-08 — [Credit, upvotes and the contributor leaderboard](016-credit-upvotes-leaderboard.md)

The two tickets were coupled without a blocking edge and had to agree on whether votes feed
the default sort. **They agree: they do not.** The frozen newest-Programme-first default is
untouched, and `sort=votes` reads the denormalised `programme.vote_count` 016 delivers.

**The contributor page this ticket demanded is now specified.** It carries the Handle, an
uploader upvote pill and count, a leaderboard rank line, the contributor's published
Programmes as rows from this shelf, a programme count, a joined date and a live fork-count
fact — plus owner-only tabs for bookmarks and the owner's own voting record. No badges, under
013.

Two additions to surfaces this ticket fixed. The row gains a **bookmark control** in a fixed
slot (see the amendment on 007); signed-out behaviour is identical to the upvote pill's —
unpressed, click routes to sign-in — so §11's rule needs no new clause. And the **leaderboard
lives on its own footer-linked page**, never as a rail: this ticket's rejection of a left rail
was cited directly, and a footer link is also 016's structural anti-gaming answer, since it
keeps the prize too small to farm.

`sort=votes` now has a documented sharp edge worth stating: **self-votes are permitted**, so
every Programme can carry one vote cast by its own owner. A constant offset reorders nothing,
and 016 shows the bulk-upload attack does not reach the contributor board at all.
