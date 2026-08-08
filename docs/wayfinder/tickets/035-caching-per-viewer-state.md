---
id: 035
title: How is a public page with per-viewer state cached?
type: grilling
status: closed
assignee: carlo
blocked_by: []
---

## Question

Nothing in the closed set has ever fixed a caching strategy for a page, and 033 has just made
one page's TTL load-bearing for takedown correctness.

033 fixed `/p/{slug}` and `/p/{slug}/r/{n}` at **one hour**, on 017's number and for 017's
reason: without a bounded TTL, tombstoning a row does not take the page down, which is
exactly the defect 017 found in 004's year-long blob cache, one layer up. It deliberately
fixed nothing else, because the shelf, `/u/{handle}` and `/contributors` carry no takedown
property — a stale shelf row links to a page that is itself tombstoned.

But the mechanism underneath was never specified, and two closed tickets lean on it:

- 023 argued that its header addition is safe because *"the public cacheable path is
  untouched"*, and 030 reused the same property for the home lede. Both treat "cacheable" as
  a fact about the design; no ticket says what caches it or for how long.
- 007 and 016 put **per-viewer state on every row** — the upvote pill's pressed state and the
  private bookmark control — and 008 put the same cluster on the detail page. A page carrying
  a per-viewer boolean is not a page a shared cache can serve unchanged, so either the cached
  artefact is the signed-out render and the pressed states arrive some other way, or the page
  is not cached at all.

Settle:

- **What is actually cached, per public route** — the whole HTML, a signed-out shell with the
  viewer state fetched separately, or nothing. Check the answer against 016's *"one combined
  viewer join"*, which was costed as part of the grid's single query.
- **The TTLs**, if any, for `/`, `/?page=N`, `/u/{handle}` and `/contributors`. 033 fixed
  only the two programme routes and said so.
- **What a crawler gets.** 033's whole surface assumes the crawler receives the signed-out
  render; confirm that is what happens rather than assume it.
- **Whether a new upload appears on the shelf promptly enough**, given 009's default order is
  newest-first and the uploader is the first person to look.
- **The cost, both ways, against 010's Active CPU and Invocations.** A fully dynamic
  `/p/{slug}` at the 10,000-programme target is a Function invocation plus a Neon query plus
  an R2 GET per view; a cached one is neither, and 033 measured that the sitemap's I/O is not
  billed on the CPU meter.

Expected to be zero schema and zero backfill; this is a rendering-strategy decision, not a
data one.

## Resolution

**The whole signed-out HTML is the cached artefact, no public route reads the session on the
server, and the per-viewer state arrives from one request in the browser.** 016's combined
join survives verbatim as SQL and stops being part of the grid's query — **that is the closed
decision that bends, and it bends on placement rather than on content**. 007's one-query rule
is not merely survived, it is *restored*. `/p/{slug}` and `/p/{slug}/r/{n}` are ISR at 033's
one hour; `/`, its query variants and `/u/{handle}` are dynamic, and not by preference —
`searchParams` is a Request-time API and using it *"will opt the page into dynamic rendering
at request time"*. **Zero schema demand, zero backfill, and nothing enters `derived.json`,
`activities.json` or `card`.**

The per-route table, the endpoint's contract and queries, the arithmetic both ways at both
scales, the assertion keys and every source with the quote it rests on are
[in the asset](assets/caching-and-viewer-state.md).

The ticket asked whether a **tombstone** needs active invalidation. It does not. **Publish
does**, and nobody had noticed (§5).

### The one thing to read first: the decision is a matcher, not a rendering strategy

Everything below rests on one configuration line, and it is not in the ticket's list.

> *"Routing Middleware **executes code before a request is processed on a site**… Because it
> runs globally **before the cache**, Routing Middleware is an effective way of providing
> personalization to statically generated content."* — Vercel, *Routing Middleware*

Clerk's quickstart matcher covers every page route. Installed as documented, **`clerkMiddleware`
would run before every CDN hit on this site**, on the same fluid-compute meters as everything
else — so every "free" cache hit costed below would carry a Function invocation in front of it,
and the entire caching decision would be worth nothing. Worse, it would be worth nothing
*invisibly*: the pages would still be fast, the cache would still report hits, and the only
symptom would be a meter.

So the matcher is scoped to `/me/:path*`, `/ops/:path*`, `/api/:path*` and Clerk's own
`/__clerk/(.*)`, and nothing else. Clerk's own documentation argues for the narrowing rather
than merely permitting it — *"Middleware is not the best place to protect routes"*, protect
*"as close to the resource as possible"*.

And the narrowing turns the whole ticket's rule into something enforced rather than observed.
`auth()` *"Requires `clerkMiddleware()` to be configured"*, and middleware is not configured on
public routes, so **`auth()` structurally cannot work on a public page.** A developer who
reaches for the session on `/p/{slug}` gets an error on the first request instead of an
uncacheable page discovered by a bill. This is 023's `<UserButton>` refusal and 027's
*nothing renders `user.imageUrl`* in a third form: the safest version of a rule is the one the
configuration will not let you break.

### 1. The central tension: 016 bends, and 007 is restored

016 delivered 007's two debts as *"one combined viewer join"* returning vote-flag and
bookmark-flag *"over the visible page's programme ids"*, and 007's own amendment recorded that
*"the one-query rule holds"* because that join came back **in the same query** as the grid. 023
then argued its header addition was safe because *"the public cacheable path is untouched"*, and
030 reused the property for the home lede. Both cannot be true: a page carrying a per-viewer
boolean is not a page a shared cache can serve unchanged.

**016 bends.** The SQL is unchanged — one join, both flags, keyed on the same id list, and it is
in the asset §4.2 in the shape 016 wrote it. What is false is *where it runs*. It moves off the
shelf's request onto a request of its own, `GET /api/viewer`.

Naming what this does to 007 is the useful part. **007's one-query rule is restored rather than
bent.** 007 asked for a grid that renders from Postgres in one query, with no per-row aggregate
and zero blob reads, because *"the grid's one-query rule cannot afford an aggregate per row"*.
016's amendment added a second concern to that one request; this ticket takes it off again. What
the shelf's server render issues is 009's grid query plus 009 §9's facet-count query — and 009
already ruled that the second *"does not touch the grid's one-query rule, being a separate
query"*. The viewer join is now a third query on a fourth request, and it touches the rule even
less.

**023 is upgraded rather than corrected.** *"The public cacheable path is untouched"* was an
observation about one addition; it becomes **the rule the entire public surface is built on**.
And 023 had already chosen the mechanism without naming it: it refused Clerk's `<UserButton>`
and specified *"`<SignedIn>`/`<SignedOut>` plus a plain Handle link"*, which are client
components deciding in the browser. It shipped the pattern and described it as a component
preference. **030 is untouched** — its lede is *"identical for every viewer signed in or out"*
and keyed on the canonical URL, which is exactly what a cached artefact requires; 030 was right
for a reason it stated correctly.

### 2. The second request, and why it moves nothing on 007's row

One endpoint, `GET /api/viewer?p=<ids>`, returning the Handle, 023's two notice booleans and
016's two flag arrays. **One `neon-http` batch, one HTTP round trip** — 005's client-generatable
uuids made the circular insert a batch so `neon-http` would suffice; the same property makes
this a single trip. ~3 ms of Active CPU. It is `private, no-store`, and 033 already `Disallow`s
`/api/`.

**It is fired only when a Clerk session cookie is present.** A signed-out visitor, a crawler and
an unfurler issue **zero** extra requests, which is what makes the split free for the large
majority of traffic and is the property the whole cost case rests on. It gets its own CI
assertion for that reason.

**Layout shift: none, and 007 is the reason rather than the obstacle.** The ticket is right that
a control popping in late would be a layout shift on a row design whose whole rule is that
nothing moves — and the design that would do that is unavailable, because 009 §11 already fixed
that *"signed-out renders the upvote pill unpressed and routes a click to sign-in"*, and 016 gave
the bookmark *"identical"* behaviour. **Both controls are already drawn, at their fixed x, in the
cached HTML.** The viewer response changes a fill inside a box that exists. 007 banned *a fact
landing at a different x on every row*; a pressed state is the opposite of what it banned, and
007 forbade the dangerous design two tickets before anyone needed it.

The generalisation is worth more than the two controls. **Every owner-conditional element on a
public page becomes a client-side mount driven by that same one request** — 015's in-place edit
affordance, 017's Class A withdraw button, 023's one owner link on `/u/{handle}`, and 016's two
pressed states. Four tickets' worth of conditionals, one mechanism, and it is the mechanism 023
had already picked.

Two honest residues, both in the asset §4.4: the header's `Sign in` → `Upload · {handle}` swap
is a real two-state box, right-aligned with a `min-width` so nothing to its left moves; and 023's
header notice *does* push the page down, for the rare signed-in viewer inside a 24-hour or 30-day
window, because reserving a blank strip on every page for every viewer to prevent it would be
007's relief rule spent on nothing.

### 3. What is cached, per route: one property decides the whole table

**A public route is cached exactly when its content is a pure function of its path.**

- **`/p/{slug}` and `/p/{slug}/r/{n}`: ISR, one hour**, 033's number for 017's reason.
  `generateStaticParams` returns nothing and `dynamicParams` stays on — Vercel's own *"selective
  pre-rendering"* — so 10,000 pages are never built. On a hit, *"Vercel serves the response
  immediately from the CDN. **Your function doesn't run.**"*
- **`/`, `/?page=N`, every facet variant, and `/u/{handle}`: dynamic, and not by choice.** Next's
  own reference is explicit: *"`searchParams` is a Request-time API whose values cannot be known
  ahead of time. Using it will opt the page into dynamic rendering at request time."* 009's
  numbered pages and multi-select facets are query parameters by 009's own decision, and
  `/u/{handle}` paginates on the same mechanism. There is no per-param split available: a route
  is dynamic or it is not.
- **`/contributors`: ISR, one hour** — one page, no query params in v1, because 016 deliberately
  keeps the board short.
- 030's static pages, 033's `robots.txt` and `sitemap.xml`: unchanged.

**So three of the ticket's four TTL questions have no TTL, and the honest answer is that they
cannot have one under the model chosen and do not need one.** The shelf's two Postgres queries
are wrapped in `unstable_cache` at 60 s so the render is CPU-only and the database sees at most
one shelf query a minute at any traffic; the page itself is rendered fresh every time.

**One invariant falls out and it is the answer 033 was actually reaching for:**

> Every route to which 033 gave a **status-derived head tag** is either cached with a bounded TTL
> or not cached at all. No route in this estate can serve a stale `index` after a tombstone
> commits for longer than one hour.

**And that corrects 033's own flag.** 033 recorded that the shelf, `/u/{handle}` and
`/contributors` *"carry no takedown property — a stale shelf row links to a page that is itself
tombstoned."* That was true when 033 was filed and **false by the time 033 closed**, because 033
itself gave `/u/{handle}` a `noindex` predicate over 016's eligibility gate — so a cached
`/u/{handle}` would have kept serving `index` and the delisted contributor's rows after a
cascade. The defect closes here for a reason that has nothing to do with takedown: the page
paginates, so it was never going to be cached. Getting the right answer by accident is worth
writing down, because the next such page might not paginate.

### 4. The crawler: confirmed, not assumed — and the confirmation is what refuses Cache Components

**A crawler is an ordinary CDN client.** It receives the cached signed-out HTML — byte-identical
to what a signed-out human gets, with 008's server-rendered fold, 033's canonical and 033's
`noindex` predicate already in the `<head>` — and **no function runs**. The one framework
behaviour that touches crawlers in this model is that Next *"detects them by their user agent and
waits for `generateMetadata` to resolve before streaming the page content"*, which is about
blocking metadata rather than bypassing a cache, and on a cache hit there is nothing left to
resolve. 033's assumption holds, and it holds for free.

**It would not have held under Cache Components, and that is what decides against them.** Next.js
16 ships Cache Components behind `cacheComponents: true`, and it is the textbook answer to this
ticket's literal question — a prerendered shell with per-viewer holes streamed behind
`<Suspense>`, server-rendered pressed states, no client fetch, no flash. It is refused on one
sentence:

> *"HTML-limited bots **skip the prerendered shell and render the page dynamically** so metadata
> can be placed in the `<head>`."* — Next.js, *Streaming*

Every crawler fetch of every one of 10,300 sitemap URLs becomes a Function invocation, a Neon
query and an R2 GET — and a PPR page costs an invocation per human request too, because the hole
must be filled by the server whether or not there is a session in the cookie. **This is 033's
argument against generated OG images applied to the page instead of the image**: an
unauthenticated, enumerable endpoint fetched by machines, against an allowance shared with the
sweep, the presign and ingest. The estate's fastest-growing traffic class is machines walking a
sitemap that grows with the catalogue, and Cache Components moves it from free to billed.

There is a second reason, and 030 owns it. Cache Components gives one page two render paths, and
Next names the failure: *"a page that loads for a person can fail to render for a crawler."* With
no analytics of any kind (030) and one hour of runtime logs (010/019), nothing in this estate
could ever notice.

**The refusal is dated rather than permanent, and the revisit condition is written down.** Cache
Components is right for a site whose signed-in surface is larger than its crawl surface. Here 033
built a crawl surface of 10,300 URLs and 016 built a signed-in surface of two booleans per row. If
that ratio ever inverts, the change is one flag plus a rewrite of the viewer request, and the
migration path (`unstable_cache` → `use cache`, `revalidateTag` → `updateTag`) is in the asset §7.
Because the flag being **off** is now a decision rather than a default, it gets a CI assertion,
exactly as 033's ban on `next/og` did.

### 5. The inversion: a tombstone needs nothing, and **publish** needs the one invalidation

**Tombstone: no active invalidation, and 017's posture transfers verbatim.**

The rows-half of a Class B runs on the **laptop** — 017 put it there because *"`neon-http` is
batched and non-interactive, so an in-app admin route structurally cannot wrap a cascade in one
transaction"*. `revalidatePath` and `revalidateTag` are Next.js server functions that *"cannot be
called in Client Components or Proxy"*; reaching them from a laptop means a public Route Handler,
a shared secret in the CLI's environment and retry semantics — precisely what 023 refused for the
Clerk webhook and 024 refused for reading a number Vercel already mails. And it would buy less
than it looks: `revalidateTag(tag, 'max')` is documented as marking the entry stale so that *"the
stale content is served while fresh content is fetched in the background"*, so the credential
would purchase the difference between *up to an hour stale* and *one more stale render*, against
a fast path 033 already documented for free (Search Console Removals, on the property 027 created
at 025 step 4). **033's hour suffices, and *purge should not fail* becomes true of the page for
the same reason it is true of the blob.**

But the posture is not the whole rule, and the asymmetry that produces it is sharper than
"best effort":

> **Invalidate where the write already runs inside the app; rely on the TTL where the write runs
> on the laptop.**

So **Class A does** revalidate — 017 made it self-service, which means it is a Server Function,
which means `revalidatePath('/p/{slug}')` is an in-process call with no endpoint and no secret.
015's in-place title and sector edits do the same. **Votes deliberately do not**: a stale
`vote_count` reorders nothing because 009 froze the default order, and a global purge per vote
would be the most expensive write in the system.

**And now the thing nobody had.** 005 makes the slug immutable and 011 creates the Programme at
the moment of *intent*, so **`/p/{slug}` is a live URL that 404s before the bytes are parsed**.
Under ISR that 404 is cacheable — Vercel treats *"200, 301, 302, 307, 308, 404, or 410"* as valid
statuses to preserve — so a visitor who opens the link during the pending window can pin a 404
into the cache for up to an hour *after* the programme goes live. The publish step of ingest —
the same Function that writes `current_revision_id` — therefore calls `revalidatePath` for that
slug. One line, in the app, no credential. **The ticket asked about takedown and the answer was
publish**, because 011's Programme-at-intent and 005's immutable slug together make the page
exist before its content does.

**One consequence has to be paid, and 023 had already paid it.** A route cannot serve a 404 to
one viewer and a page to another, so 011/019/023's *"`/p/{slug}` renders `pending` and `failed` to
the owner and 404s to everyone else"* cannot survive a cached route. It 404s to everyone until
publish, and **the owner's view of an unpublished upload is `/me`** — which loses nothing,
because 023 already renders the whole of it there: the `Processing` and `Failed` chips, 011's
`failure_reason` verbatim, and *"Upload again →"*. 023 put the sentence on the index deliberately,
on the argument that *"an index that says `Failed` and makes you click for the only sentence you
wanted is worse than no index"* — which is exactly what makes the link it also carried redundant.
The title on `/me` links only when the Programme is published. 019's *"the uploader's channel
needed nothing built"* stays true; the channel is `/me`, not `/p/{slug}`.

### 6. Does a new upload reach the shelf promptly? Yes — and the ticket is right that it does not matter

Sixty seconds, from the `unstable_cache` window on the shelf query. No tag, no call in ingest, no
coupling.

The bullet's own hint is the whole answer: **the uploader's path to their own upload never goes
through the shelf.** 011's null `current_revision_id` makes the row the channel, 019 confirmed the
surface needed nothing built, 023 built `/me` as the index, and the upload flow polls the row and
lands the uploader on `/p/{slug}`. The shelf's freshness is a courtesy to everybody else, and
under 009's frozen newest-first order a minute's lag moves one row. *The 60 s is overturnable
taste* — 300 s is equally defensible and one fewer query per five minutes.

### 7. Cost: the meter does not decide this, and saying so is the finding

Full arithmetic in the asset §6. Three things came out of it that were not expected.

**First, Hobby has five metered resources and this effort has been reasoning about three.** 010
named Active CPU; 033 named Invocations and Provisioned Memory. Vercel's usage summary also lists
**Fast Data Transfer (100 GB)** and **Fast Origin Transfer (up to 10 GB)**, and the second is the
tightest of the five relative to this design (~28% at the design target). It is named here rather
than discovered. Vercel's Hobby summary does **not** list ISR reads and writes at all; they are
priced only on Pro's on-demand table, and *"CDN cache reads and writes are free"*.

**Second, Active CPU is the binding meter and it binds at ~288,000 uncached programme renders a
month.** Invocations bind 3.5× later. So the entire question is how many *renders* happen, and
Invocations never decide anything — which is worth stating because the ticket framed the cost as
"a Function invocation plus a Neon query plus an R2 GET per view", and two of those three are not
billed on the meter that binds. The Neon query and the server-side `derived.json` GET are I/O, and
*"You are only billed during actual code execution and not during I/O operations."* 033's finding,
reused.

**Third, and this is the uncomfortable one: at the design target the two strategies cost the same
to within a few percent of one meter** — ~31% of Active CPU cached against ~34% dynamic — and at
launch they differ by seventy CPU-seconds. The reason is the long tail. ISR revalidation is
**request-triggered**: *"After 60 seconds has passed, the next request will still return the cached
(now stale) page. The cache is invalidated and a new version of the page begins generating in the
background."* A page fetched less often than once an hour regenerates on nearly every fetch, and at
10,300 URLs almost every page is exactly that. **The one-hour TTL does not save CPU, and it was
never bought for CPU** — 033 bought it for takedown, and takedown is what it delivers.

What the split delivers instead is not on the meter, and is worth more:

- **The visitor never waits on Neon or R2.** A hit is CDN bytes; a stale hit is CDN bytes plus a
  background render.
- **A hard ceiling of 720 renders per URL per month, whatever happens.** It is the only cost in
  this estate with an upper bound per unit, and it is what makes an unfurl storm or a
  badly-behaved crawler a non-event rather than a bill. Under the dynamic strategy the same storm
  is unbounded.
- **Request collapsing**, which exists *only* for declared-cacheable routes: *"With `Cache-Control`
  headers alone, Vercel doesn't know a path is cacheable until it receives the response, so these
  features aren't available."*
- **Failure containment.** *"If revalidation fails, Vercel keeps serving the existing cached
  content"*, with a 30-second retry. A Neon incident degrades to stale pages rather than a dead
  site — which matters on a database chosen (004) for a free tier that autosuspends.
- It removes the per-request database read at exactly the moment the catalogue is largest, which
  is the only component of load that scales with **corpus size** rather than with popularity.

One thing this does *not* cost, and 004 is why: **`activities.json`'s 340 KB never touches
Vercel's transfer meters**, because 008 made the browser fetch it and 004/025 put it on R2. The
largest per-open object in the estate is invisible to the platform that meters transfer.

**010's five Pro triggers gain no sixth and the CPU trigger does not fire** — but the residue is
that this is **the first decision in the effort where the CPU trigger is within one order of
magnitude of firing**, 31% against 033's 0.15%, and the variable that moves it is traffic, which
030 made permanently unmeasurable.

### 8. Asserted: eight CI keys, **one** new sweep key, no migration

Full table in the asset §8. The split by cause is 024's, reused for the third time.

**Cause 1, a commit → CI**, on 018's existing stack-up job, no secrets, blocking on `main`. The
one that earns its place is **`ci.middleware.public_routes_excluded`**, which evaluates the
exported matcher against `PUBLIC_ROUTES` — the same constant the sitemap and the footer build
from. This is 024's mechanism (CI's preflight derives its header list *from the presign's own
output*) and 033's (`ci.robots.facets_disallowed` derives from *the shelf's own
`SHELF_QUERY_PARAMS`*) arriving a third time: **adding a public route without excluding it from
the matcher is a test failure rather than a silently uncached site.** The second that matters is
**`ci.viewer.signed_out_is_zero_requests`**, which protects the *economics* rather than the
correctness — the whole cost case rests on a signed-out visitor making one request, and a stray
unconditional `fetch` would erase it without changing a pixel.

**Cause 2, something with no commit behind it → one key on 024's existing `edge_drift` rule.**
`edge.site.programme_cached`: two unauthenticated GETs of a known-published `/p/{slug}`, asserting
the second returns `x-vercel-cache` in `{HIT, STALE, PRERENDER}` and that neither carries
`Set-Cookie`. **No new rule, no `alarm_state` row, no migration** — 024 established
`sweep_run.breaches` is jsonb and 033 spent that property once; this spends it again.

It is deliberately *not* the instrument 033 refused. 033 gave `/sitemap.xml` no key because
*"under ISR a failed revalidation serves the last good cached bytes, so a 200 assertion would be
green through precisely the failure it exists to catch."* That objection does not reach here,
because this key reads the **cache status**, not the body: the failure it exists to catch —
middleware widened, a Request-time API introduced, `Set-Cookie` leaking onto a public route —
presents as `MISS` or `BYPASS` on *every* request. It is also only the estate's second observation
of `xerhero.com` itself; before 033 there were none.

### 9. What this hands to other tickets

- **[Credit, upvotes and the contributor leaderboard](016-credit-upvotes-leaderboard.md)** — its
  combined viewer join survives verbatim and moves off the grid's request onto `/api/viewer`.
- **[The storefront card and browse grid](007-storefront-card-and-grid.md)** — its one-query rule
  is restored, and its no-flow rule turns out to be what makes the split shift-free.
- **[The signed-in user's own space](023-signed-in-users-own-space.md)** — *"the public cacheable
  path is untouched"* becomes the rule the public surface is built on; its `/me` index becomes the
  **only** owner-visible surface for an unpublished upload.
- **[Upload and ingest pipeline](011-upload-ingest-pipeline.md)** and
  **[Operating and observing ingest](019-ingest-observability.md)** — `/p/{slug}` 404s to everyone
  until publish, and publish gains a `revalidatePath` call it did not have.
- **[The site's own crawl surface](033-site-crawl-surface.md)** — its crawler assumption is
  confirmed and priced; its "no takedown property" flag is corrected on `/u/{handle}`; its one-hour
  TTL gains a mechanism, a scope and an honest account of what it does and does not save.
- **[Stack, hosting and auth provider](010-stack-hosting-auth.md)** — the middleware matcher, the
  refusal of Cache Components, and two Hobby meters nobody had named.
- **[Browse, search, filter and ranking](009-browse-search-ranking.md)** — its query-param URL
  scheme is what makes the shelf dynamic; its signed-out pill behaviour is what makes the split
  free of layout shift.
- **[What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md)** —
  four steps, no fifth; Class A revalidates for free and Class B does not, on the laptop/app line
  017 itself drew.
- **Build work, not a decision:** `middleware.ts`'s matcher; `export const revalidate = 3600` on
  three route files; the `PUBLIC_ROUTES` constant.

### 10. Schema, backfill, and the derived contracts

- **Schema demand: zero.** No table, no column, no index, no migration — not even 024's single
  seeded row, because `edge_drift` already exists and its breach payload is jsonb. Every predicate
  is an existing column: `programme.status` (003), `current_revision_id` (011),
  `programme_vote` / `bookmark` (016), `revision.status` and `removal_class` (011/017).
- **Backfill demand: none.** Nothing is recomputed and nothing existing is invalidated. This is a
  rendering-strategy decision, exactly as the ticket predicted.
- **`derived.json`, `activities.json`, `card`: nothing enters any of them**, and the contracts stay
  at v2 and v2. Deliberately, on 033's own reasoning: **the viewer request reads only Postgres and
  never a blob**, because per-viewer state is Programme-level mutable state and the derived contract
  is Revision-level immutable content (016's division). So it renders for a `pending` or tombstoned
  Programme whose blobs do not exist, and it cannot be invalidated by a contract recompute.

### Flagged

- **Every per-render CPU figure in this ticket is an estimate**, anchored on the only render anyone
  has costed (033's ~30 ms sitemap). 030 chose no analytics and Hobby keeps runtime logs for one
  hour, so nothing in the estate can measure a render. This inherits 019's flag verbatim: every
  threshold here is reasoned and unevidenced. The design is deliberately correct at a cache hit
  rate of zero, which is what makes the softness affordable.
- **The cache hit rate is unknowable.** Vercel's ISR observability sits behind Observability+, a
  Pro feature, and 024 already refused to buy a credential to read what the vendor reports.
- **Cache Components is refused on today's ratio, not on principle.** It is the better answer to
  the question as asked, and it is one flag away if the crawl surface stops growing or the
  signed-in surface starts.
- **An unpressed flash exists and is accepted.** Between paint and the viewer response, a signed-in
  viewer's own votes and bookmarks read as un-voted and un-bookmarked. It cannot cause a wrong
  write — the controls toggle against the server — but it is briefly a wrong picture, on the two
  pages a signed-in planner uses most. *Overturnable taste*; the two cheaper fixes are in the
  asset §10.
- **`unstable_cache` is named unstable.** It is the documented tool for the non-Cache-Components
  model in 16.3.0 and its successor (`use cache`) is behind the flag this ticket refuses, so the
  shelf's 60-second window rides on an API whose name is a warning. It is five lines and its
  removal costs two Neon queries per shelf render.
- **Fast Origin Transfer is the meter to watch, not Active CPU.** At 10 GB on Hobby and ~28% used
  at the design target, it is the tightest of the five, and it is the one that responds to *page
  weight* — so the next time someone adds a chart above the fold, this is the number that moves,
  and nobody in this effort has ever looked at it.
