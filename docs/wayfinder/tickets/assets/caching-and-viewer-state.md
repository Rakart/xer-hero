# Caching and per-viewer state — the per-route table, the viewer request, the arithmetic, the sources

Working detail for [ticket 035](../035-caching-per-viewer-state.md). The decisions and their
reasoning are in that ticket's `## Resolution`; this file is the mechanical half — the
exhaustive route table, the one endpoint this design adds, the cost arithmetic at both
scales and both ways, the assertion keys, and every primary source with the quote it rests
on.

Drafted against the closed set as of **2026-08-08**, on the apex `https://xerhero.com`
([025](../025-blob-host-and-domain.md)) and against **Next.js 16.3.0** documentation
(§6.1–6.9) and Vercel's docs as of the same date (§6.10–6.16).

---

## 1. The rule, stated once

> **A public route renders one artefact, and that artefact is the signed-out render.
> Nothing on a public route reads the session on the server. Everything that depends on
> who is looking arrives in the browser, from one request, after paint.**

Three things follow mechanically and are the whole of this ticket:

1. The cached artefact is **whole HTML**, not a shell plus a hole.
2. `clerkMiddleware` must **not** run on a public route, or the cache is worthless (§3).
3. `auth()` cannot work on a public route once (2) is true, so the rule is enforced by
   **configuration** rather than by discipline (§3.2).

---

## 2. Per-route table

Exhaustive against the URL set closed by [023](../023-signed-in-users-own-space.md),
reopened by five routes in [030](../030-static-pages.md), and enumerated by
[033](../033-site-crawl-surface.md) in [its own asset](site-crawl-surface.md) §1. One column
is added here that 033's table left as "unchanged".

**Render** is `static` (built once at deploy), `ISR` (prerendered, revalidated on request
after the TTL), or `dynamic` (a Function invocation per request, never stored in the CDN).

| Route | Render | TTL | Function runs on a hit? | Viewer state | Why this render |
| --- | --- | --- | --- | --- | --- |
| `/` (bare) | **dynamic** | — | yes, every request | client | the page reads `searchParams`, a Request-time API (§6.2) |
| `/?page=N` | **dynamic** | — | yes | client | same route, same reason |
| `/?sector=…` and every facet/`q`/`sort` variant | **dynamic** | — | yes | client | same route; `Disallow`ed to crawlers (033) so the volume is human |
| `/p/{slug}` — published | **ISR** | **3600 s** | **no** | client | 033's number for 017's reason; content is a pure function of the path |
| `/p/{slug}` — tombstoned (A or B) | **ISR** | **3600 s** | no | client | the `noindex` and the tombstone render are in the cached bytes |
| `/p/{slug}` — no published revision | **ISR 404** | 3600 s **+ `revalidatePath` on publish** | no | — | §5.3 — a cached 404 is a cached page |
| `/p/{slug}/r/{n}` — all three classes | **ISR** | **3600 s** | no | client | same artefact rules as the parent |
| `/u/{handle}` — listable and not | **dynamic** | — | yes | client | paginates on 009's `?page=N`; and see §5.2 |
| `/contributors` | **ISR** | **3600 s** | no | client | one page, no query params in v1 (016 keeps the board short) |
| `/about` | static | deploy | no | none | 030 — reads no database and no blob |
| `/terms`, `/terms/v{n}`, `/privacy`, `/privacy/v{n}` | static | deploy | no | none | 030, unchanged |
| `/report` | static shell | deploy | no | none | Turnstile is client-side; submission is a Server Function |
| `/robots.txt` | static (build output of `app/robots.ts`) | deploy | no | — | 033, unchanged |
| `/sitemap.xml` | ISR | 3600 s | no | — | 033, unchanged |
| **`/api/viewer`** | dynamic | **never cached** (`private, no-store`) | n/a | **is** the viewer state | §4 |
| `/me/*` | dynamic, behind `clerkMiddleware` | never | n/a | server-side | 023 — middleware runs here, so `auth()` works here |
| `/ops` | dynamic, behind `clerkMiddleware` | never | n/a | server-side | 019 |

### 2.1 The one-line summary of the table

**A public route is cached exactly when its content is a pure function of its path.**
`/p/{slug}` and `/p/{slug}/r/{n}` are — and they are 10,300 of the estate's ~10,310 public
URLs, they carry the entire crawl surface and the only takedown property, and they are
where every scaling risk lives. `/`, its query variants and `/u/{handle}` are not, because
they read `searchParams`, and that is a framework fact rather than a preference (§6.2).

### 2.2 The correctness property this buys, stated as an invariant

> Every route to which 033 gave a **status-derived head tag** is either cached with a
> bounded TTL or not cached at all. No route in this estate can serve a stale `index`
> after a tombstone commits for longer than one hour.

033 gave status-derived tags to exactly three families: `/p/{slug}` (both classes),
`/p/{slug}/r/{n}` (superseded and tombstoned), and `/u/{handle}` (016's eligibility gate).
The first two are ISR at one hour. The third is dynamic, so its predicate is live.

---

## 3. The middleware matcher is the load-bearing line

### 3.1 The fact

> *"Routing Middleware **executes code before a request is processed on a site**… Because it
> runs globally **before the cache**, Routing Middleware is an effective way of providing
> personalization to statically generated content."* — Vercel, *Routing Middleware* (§6.13)

> *"Routing Middleware is priced using the fluid compute model, which means you are charged
> by the amount of compute resources used by your Routing Middleware."* — same page

Middleware runs **before** the cache, on **every** request that its matcher covers, and it
is billed on the same three meters as everything else. Clerk's quickstart matcher covers
every page route. **Left at its default, every CDN hit on this site would be preceded by a
Function invocation, and the whole of §2 would be worth nothing.**

### 3.2 The matcher that ships

```ts
// middleware.ts
import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware()

export const config = {
  matcher: [
    '/me/:path*',
    '/ops/:path*',
    '/api/:path*',
    '/__clerk/(.*)',   // Clerk's own frontend API proxy routes
  ],
}
```

Nothing public is in that list. Clerk's own documentation supports the narrowing rather
than merely permitting it:

> *"Middleware is not the best place to protect routes"* — protect access *"as close to
> the resource as possible, in the code that reads or mutates the data."* — Clerk,
> *clerkMiddleware()* (§6.15)

### 3.3 The rule enforces itself

- `auth()` *"Requires `clerkMiddleware()` to be configured"* (§6.16). Middleware is not
  configured on public routes. **So `auth()` cannot work on a public route** — a developer
  who reaches for it gets an error at the first request rather than a silently
  uncacheable page six weeks later.
- *"using `auth()` will opt your entire route into dynamic rendering"* (§6.14). Even if
  middleware were widened, the session read would take the route out of the cache, which
  is the failure this arrangement is designed to make loud.
- `<ClerkProvider>` stays in the root layout **without** the `dynamic` prop. Clerk v6:
  *"Starting with v6, `<ClerkProvider>` will no longer opt your entire application into
  dynamic rendering by default"*, and *"It is not recommended and not optimal to wrap your
  entire application with `<ClerkProvider dynamic>` as this opts all routes into dynamic
  rendering"* (§6.14).

### 3.4 The second reason, which is the CDN's own rule

Vercel's cacheable-response criteria include:

> *"Response doesn't contain the `set-cookie` header."* — Vercel, *CDN Cache* (§6.11)

Clerk's middleware refreshes the session cookie. A public route that ran it would produce
responses carrying `Set-Cookie` and would be structurally uncacheable even if nothing in
the page body varied. The matcher answers this and the invocation cost with one line.

---

## 4. `/api/viewer` — the one endpoint this design adds

### 4.1 Contract

```
GET /api/viewer?p=<uuid>,<uuid>,…       (≤ 25 ids; 1 on a detail page; 0 on a static page)

200 application/json
Cache-Control: private, no-store

{
  "handle":    "planner-a3f92c" | null,
  "notices":   { "failed": false, "removal": false },
  "voted":     ["<uuid>", …],
  "bookmarked":["<uuid>", …]
}
```

- **Fired only when a Clerk session cookie is present.** A signed-out visitor, a crawler
  and an unfurler make **zero** extra requests. That is what makes the split free for the
  majority of traffic.
- `null` handle means signed in but no `app_user` row yet — 023's "reads create nothing"
  rule, unchanged. The client renders the signed-out control states.
- 033 already `Disallow`s `/api/` in `robots.txt`. No change there.

### 4.2 One `neon-http` batch, which is 005/010's finding paying again

```sql
-- statement 1: the header. 023's two exists, verbatim from own-space.md §2, plus the Handle.
select u.display_name as handle,
       exists (select 1 from revision r join programme p on p.id = r.programme_id
               where p.owner_user_id = u.id and r.status = 'failed')                  as has_failed,
       exists (select 1 from revision r join programme p on p.id = r.programme_id
               where p.owner_user_id = u.id and r.removal_class = 'B'
                 and r.removed_at > now() - interval '30 days')                       as has_removal
from app_user u where u.clerk_user_id = $clerk;

-- statement 2: 016's combined viewer join, verbatim, over the visible page's ids.
select p.id,
       (v.programme_id is not null) as voted,
       (b.programme_id is not null) as bookmarked
from unnest($ids::uuid[]) as p(id)
left join programme_vote v on v.programme_id = p.id and v.voter_user_id = $me
left join bookmark       b on b.programme_id = p.id and b.user_id       = $me;
```

Two statements, **one `neon-http` batch, one HTTP round trip**. 005 established that
client-generatable uuids make the circular `programme ↔ revision` insert a batch so that
`neon-http` suffices with no WebSocket pool; the same property makes the viewer request a
single round trip here.

### 4.3 What renders from it, and where

| Element | Fixed by | Signed-out (cached) state | What the response changes |
| --- | --- | --- | --- |
| upvote pill, shelf row | 007 §3, 009 §11 | drawn, unpressed, click → sign-in | pressed fill |
| bookmark control, shelf row | 016 §6 / 007 amendment | drawn, unpressed, click → sign-in | pressed fill |
| action cluster, `/p/{slug}` | 008 amendment | drawn, unpressed | pressed fill |
| header cluster | 023 §4 | `Sign in` | → `Upload · {handle}` |
| header notice line | 023 §6 | absent | appears (see §4.4) |
| owner link on `/u/{handle}` | 023 §1 | absent | appears when `handle` matches |
| owner controls on `/p/{slug}` — 015's edit, 017's Class A withdraw | 015, 017 | absent | appear when the owner is looking |

The last two rows are the generalisation worth naming: **every owner-conditional element
on a public page is a client-side mount driven by the same one request.** 023 already chose
this shape for the header (`<SignedIn>`/`<SignedOut>` are client components) without naming
it as a rule; here it becomes the rule and covers four tickets' worth of controls with one
mechanism.

### 4.4 Layout shift: none, and 007 is why

007's rule was that **a fact must not land at a different x on every row**. Both controls
are in **fixed slots** and 009 §11 already fixed that the signed-out render draws the pill
*unpressed*. So the viewer response changes a **fill inside a box that is already there**.
Nothing appears, nothing disappears, nothing reflows.

Two places where a box genuinely has two states, and what is done about each:

- **The header cluster.** `Sign in` and `Upload · {handle}` are different widths. The slot
  is right-aligned with a `min-width`, so the swap moves nothing to its left. It renders
  `Sign in` until the response lands. *Overturnable taste:* render an empty slot for the
  first ~100 ms instead; rejected because `Sign in` is correct for the modal visitor
  (018: *"most of the app is signed out"*) and wrong for nobody who cannot fix it in one
  click.
- **The header notice** (023's undismissable line). It is a block that appears above the
  fold and pushes the page down. It is reserved with no height when absent, so it *does*
  shift — for the ≤1 signed-in viewer in a hundred page views who has a `failed` upload or
  a Class B tombstone inside its window. Accepted rather than reserved permanently:
  reserving a blank strip on every page for every viewer to avoid a shift for a rare one
  is 007's relief rule spent on nothing.

---

## 5. Freshness: three questions, three different answers, one rule

**The rule: invalidate where the write already runs inside the app; rely on the TTL where
the write runs on the laptop.**

`revalidatePath` and `revalidateTag` are Next.js server functions — *"can be called in
Server Functions and Route Handlers"*, and *"cannot be called in Client Components or
Proxy, as it only works in server environments"* (§6.5). They are free from inside the app
and cost a public endpoint plus a shared secret from outside it.

### 5.1 A new upload on the shelf — 60 seconds, and it would not matter at an hour

The shelf is dynamic, so there is no page cache to go stale. Its two Postgres queries —
009's grid query and 009 §9's separate facet-count query — are wrapped in `unstable_cache`
at **60 s**, so the render is CPU-only and the database sees at most one shelf query a
minute at any traffic.

**No tag, and no call in the ingest path.** Two reasons:

- **The uploader's path to their own upload never goes through the shelf.** 011's null
  `current_revision_id` and 019 make the row the channel, 023 built `/me` as the index, and
  the upload flow polls the row and lands on `/p/{slug}`. The shelf's freshness is a
  courtesy to everybody *else*, and 009's frozen newest-first order means a minute's lag
  moves one row.
- A tag would not buy what it looks like it buys. `revalidateTag(tag, 'max')` is documented
  as *"the tag entry is marked as stale, and the next time a resource with that tag is
  visited, it will use stale-while-revalidate semantics"* (§6.5) — the visitor who triggers
  it gets the **stale** copy. Immediacy needs `{ expire: 0 }`, which is a blocking
  revalidate, which is exactly the query the 60-second TTL already pays for less often.

*The 60 s is overturnable taste.* 300 s is equally defensible and one fewer Neon query per
five minutes.

### 5.2 A tombstone — no active invalidation, and 017's posture transfers verbatim

- **Class B** runs on the **laptop**. 017 put the cascade there because *"`neon-http` is
  batched and non-interactive, so an in-app admin route structurally cannot wrap a cascade
  in one transaction"*. A laptop CLI cannot call `revalidatePath`; reaching it would need a
  public Route Handler, a shared secret in the CLI's environment and retry semantics —
  precisely what 023 refused for the Clerk webhook (*"a public endpoint, a signing secret,
  svix and retry semantics"*) and what 024 refused for reading a number Vercel already
  mails. **033's one hour stands, and *purge should not fail* becomes true of the page for
  the same reason it is true of the blob.** The fast path for an urgent Class B is the one
  033 already documented: Search Console Removals, on the property 027 created at 025 step 4.
- **Class A** is **self-service in the app** (017). That path is a Server Function, so it
  calls `revalidatePath('/p/{slug}')` in-process, for free, with no endpoint and no secret.
  It does.
- **Owner edits** to title and sector (015) are Server Functions too, and do the same.
- **Votes deliberately invalidate nothing.** `programme.vote_count` on a cached row may be
  up to an hour behind. 009 froze the default order so a stale count reorders nothing, and
  a global purge per vote would be the most expensive write in the system.
- `/u/{handle}` needs nothing at all: it is dynamic, so 016's eligibility gate and 033's
  `noindex` predicate over it are evaluated on every request.

### 5.3 Publish — the one invalidation this design **requires**, and nobody had noticed

005 makes the slug immutable and 011 creates the Programme at the moment of intent, so
**`/p/{slug}` is a live URL that 404s before the bytes are parsed.** Under ISR that 404 is
cacheable — Vercel's ISR revalidation treats *"200, 301, 302, 307, 308, 404, or 410"* as
valid statuses (§6.12) — so a visitor who opens the link during the pending window can pin
a 404 into the cache for up to an hour **after** the programme goes live.

So the publish step of ingest — the same Function that writes `current_revision_id` —
calls `revalidatePath('/p/[slug]', 'page')`. One line, in the app, no credential.

**This is the inversion in the ticket.** It asked whether a *tombstone* needs active
invalidation. It does not. **Publish does**, and it does because 011's Programme-at-intent
and 005's immutable slug together make the page exist before its content does.

---

## 6. Cost, both ways, at both scales

### 6.0 The meters

Vercel Hobby's published usage summary has **five** rows, not the three this effort has
been reasoning about (§6.10, §6.17):

| Meter | Hobby included |
| --- | --- |
| Active CPU | **4 CPU-hrs** = 14,400 CPU-seconds |
| Provisioned Memory | 360 GB-hrs |
| Invocations | 1,000,000 |
| **Fast Data Transfer** | **100 GB** |
| **Fast Origin Transfer** | **up to 10 GB** |

010 named Active CPU; 033 named Invocations and Provisioned Memory. **The two transfer
meters have never been named in this effort.** ISR reads and writes are *not* in the Hobby
usage summary at all; they appear only on Pro's on-demand table ($0.0004/1K reads,
$0.004/1K writes), and *"CDN cache reads and writes are free"* (§6.12).

> *"This is the CPU time your code actively consumes in milliseconds… **You are only billed
> during actual code execution and not during I/O operations** (database queries, like AI
> model calls, etc.)"* — Vercel, *Fluid compute pricing* (§6.10)

So the Neon query and the server-side `derived.json` GET from R2 are **not billed** on the
CPU meter — 033's finding, reused.

### 6.1 Per-render estimates

Anchored on the only render in the estate anyone has costed: 033 put the sitemap at ~30 ms
of Active CPU for string-building ~10,300 entries. These are **estimates, not
measurements**, and they are the softest numbers in this ticket.

| Work | Active CPU | Notes |
| --- | --- | --- |
| `/p/{slug}` render | **~50 ms** | parse a 40–60 KB `derived.json`, render fold + verdict + 14-row DCMA scorecard + hand-rolled SVG, serialise |
| shelf render (25 rows) | **~40 ms** | 25 × 12 fixed slots, 50 inline SVGs, facet bar |
| `/api/viewer` | **~3 ms** | JSON of ≤ 25 booleans |
| middleware, if it ran on a public route | ~1–3 ms | **× every request, before the cache** — the number §3 exists to avoid |

At 50 ms a render, **Active CPU is the binding meter and it binds at ~288,000 uncached
programme renders a month.** Invocations bind 3.5× later, at 1,000,000. So the whole
question is *how many renders happen*, and Invocations never decide anything.

### 6.2 Launch scale

~40 programmes (018's dev catalogue is the shape). Assume 2,000 human page views, 1,500
bot fetches, 15% of human views signed in.

| | Split + ISR (chosen) | Fully dynamic |
| --- | --- | --- |
| programme renders | ~900 (distinct page-hours touched) | ~2,400 |
| shelf renders | ~1,100 | ~1,100 |
| viewer requests | ~300 | 0 |
| **Active CPU** | **~90 s = 0.6%** | **~160 s = 1.1%** |
| Invocations | ~2,300 = 0.23% | ~3,500 = 0.35% |

**At launch the two strategies differ by seventy CPU-seconds.** The meter does not decide
this ticket at launch, and pretending otherwise would be dishonest. What decides it at
launch is that one of the two is also the shape that works at the target.

### 6.3 The 10,000-programme target

10,300 sitemap URLs. Assume bots (Google, Bing, unfurlers, and the AI crawlers 033
deliberately declined to block) at ~60,000 fetches/month; humans at 30,000 programme views
and 10,000 shelf views; 10% of human views signed in.

| | Split + ISR (chosen) | Fully dynamic |
| --- | --- | --- |
| programme fetches | 90,000 | 90,000 |
| programme **renders** | ≤ 80,000 | 90,000 |
| shelf renders | 10,000 | 10,000 |
| viewer requests | 3,000 | 0 |
| **Active CPU** | **~4,400 s = 31%** | **~4,900 s = 34%** |
| Invocations | ~93,000 = 9% | ~100,000 = 10% |
| Fast Origin Transfer (~30 KB/response) | ~2.8 GB = 28% | ~3.2 GB = 32% |
| Neon queries **on the critical path** | ~13,000 | ~100,000 |
| R2 `derived.json` GETs | ≤ 80,000, off the critical path | 90,000, on it |

### 6.4 The finding: the TTL does not save CPU, and that is fine

ISR revalidation is **request-triggered**, not scheduled:

> *"After 60 seconds has passed, the next request will still return the cached (now stale)
> page. The cache is invalidated and a new version of the page begins generating in the
> background."* — Next.js, *ISR* (§6.4)

So a page fetched **less often than once an hour regenerates on nearly every fetch**, and
at 10,300 URLs almost every page is in exactly that state. The one-hour TTL therefore
delivers only a few percent of one meter at the design target. **It was never bought for
CPU** — 033 bought it for takedown, and that is precisely what it delivers.

What the split delivers instead, none of which the meter prices:

1. **The visitor never waits on Neon or R2.** A hit is CDN bytes; a stale hit is CDN bytes
   plus a background render (*"visitors continue to get the cached version while Vercel
   generates the new content"*, §6.12).
2. **A hard per-URL ceiling of 720 renders a month, whatever happens.** It is the only cost
   in this estate with an upper bound per unit, and it is what makes an unfurl storm or a
   badly-behaved crawler a non-event instead of a bill. Under the dynamic strategy the same
   storm is unbounded.
3. **Request collapsing**, which exists *only* for ISR routes: *"When multiple requests hit
   the same uncached path at once, Vercel collapses them into a single invocation"*, and
   *"With `Cache-Control` headers alone, Vercel doesn't know a path is cacheable until it
   receives the response, so these features aren't available"* (§6.12).
4. **Failure containment.** *"If revalidation fails, Vercel keeps serving the existing
   cached content"*, with a 30-second retry TTL (§6.12). A Neon incident degrades to stale
   pages rather than to a dead site — which matters on a database chosen (004) for a free
   tier that autosuspends.
5. It removes the per-request database read at exactly the moment the catalogue is largest,
   which is the only component of load that scales with **corpus size** rather than with
   popularity.

### 6.5 Two things this does *not* cost

- **Vercel's Fast Data Transfer is untouched by the big object.** `activities.json` is 340 KB
  and is fetched by the browser **from R2**, not from Vercel — so 004's blob decision and
  025's custom domain keep the site's largest per-open payload off Vercel's 100 GB meter
  entirely. That is 004 paying a fourth time.
- **010's five Pro triggers gain no sixth, and the Active CPU trigger does not fire.** But
  the honest residue is that this is the **first decision in the effort where the CPU
  trigger is within one order of magnitude of firing** — 31% at the design target against
  033's 0.15% for the sitemap — and the variable that moves it is traffic, which 030 made
  permanently unmeasurable.

---

## 7. Cache Components: examined, refused, with the trigger for revisiting written down

Next.js 16 ships **Cache Components** behind `cacheComponents: true`, and it is the
textbook answer to this ticket's literal question: a prerendered static shell with
per-viewer holes streamed at request time behind `<Suspense>`, so the pressed states could
be **server-rendered** with no client fetch and no flash.

> *"During prerendering, the header (static) and blog posts (cached with `use cache`) become
> part of the static shell, along with the fallback UI for user preferences. The UI
> preferences stored in cookies stream in at request time. Reading `cookies()` here doesn't
> opt-in the whole route into dynamic rendering, the way the previous rendering model
> did."* — Next.js, *Caching* (§6.3)

It is refused, on one number and one hazard.

**The number.** With Cache Components, a crawler stops being a cache client:

> *"With Cache Components, visitors and DOM-capable crawlers receive the prerendered shell
> immediately… **HTML-limited bots skip the prerendered shell and render the page
> dynamically** so metadata can be placed in the `<head>`."* — Next.js, *Streaming* (§6.6)

Every crawler fetch of every one of 10,300 sitemap URLs would become a Function invocation,
a Neon query and an R2 GET. And a PPR page costs an invocation per request from a human
too, because the hole has to be filled by the server whether or not there is a session in
the cookie. So the estate's *largest and fastest-growing* traffic class — machines walking
a sitemap that grows with the catalogue — moves from free to billed. **This is the same
argument 033 used to refuse generated OG images**, applied to the page instead of the image:
an unauthenticated, enumerable endpoint fetched by machines, against a 4-hour allowance
shared with the sweep, the presign and ingest.

**The hazard.** Two render paths for one page, in a project that chose (030) to have no
analytics at all:

> *"Keep this in mind when your prerendered shell depends on inputs that only exist while
> prerendering… **a page that loads for a person can fail to render for a crawler.**"* —
> same source

**Revisit when the ratio inverts.** Cache Components is the right answer for a site whose
signed-in surface is bigger than its crawl surface. Here, 033 built a crawl surface of
10,300 URLs and 016 built a signed-in surface of two booleans per row. If that ever
reverses — a logged-in-heavy product, or a crawl surface that stops growing — this decision
is one config flag and a rewrite of §4, and the migration is documented (`unstable_cache`
→ `use cache` + `cacheLife`, `revalidateTag` → `updateTag`).

`cacheComponents` being **off** is therefore a decision, not a default, and it gets an
assertion (§8).

---

## 8. Assertions

Naming follows [024](../024-verifying-production-only-edges.md) §2 — assertions are referred
to by **key**, never by URL or value, because Actions logs on a public repo are
world-readable (019).

### 8.1 CI — added to 018's existing stack-up job, no secrets, blocking on `main`

| Key | Method | Expect |
| --- | --- | --- |
| `ci.middleware.public_routes_excluded` | evaluate the exported `config.matcher` against `PUBLIC_ROUTES`, the same constant the sitemap and the footer build from | **no** public route matches |
| `ci.render.no_server_session_read` | grep the public route tree | `auth(`, `currentUser(`, `clerkClient`, `<SignedIn`, `<SignedOut` appear nowhere under it |
| `ci.cache.programme_page_is_isr` | read the build output for `/p/[slug]` | route is prerendered with `revalidate: 3600` |
| `ci.cache.no_set_cookie_on_public_render` | render each public route in the built app | no `Set-Cookie` on any response (§6.11's criteria) |
| `ci.cache.publish_revalidates_slug` | unit test over the ingest publish path | `revalidatePath` is called with the published slug (§5.3) |
| `ci.viewer.private_no_store` | `GET /api/viewer` | `Cache-Control: private, no-store` |
| `ci.viewer.signed_out_is_zero_requests` | render a shelf page with no session cookie, in a headless browser | **no** request to `/api/viewer` is issued |
| `ci.cachecomponents.disabled` | read `next.config` | `cacheComponents` is absent or `false` (§7) |

`ci.middleware.public_routes_excluded` is the one that earns its place, and it is 033's and
024's best mechanism reused for the third time. 024 made CI's preflight derive its header
list *from the presign's own output*; 033 made `ci.robots.facets_disallowed` derive its
disallow list *from the shelf's own `SHELF_QUERY_PARAMS`*. Here, **adding a public route
without excluding it from the matcher is a test failure rather than a silently uncached
site discovered by a bill.**

`ci.viewer.signed_out_is_zero_requests` is the one that protects the *economics* rather than
the correctness: the entire cost case in §6 rests on a signed-out visitor and a crawler
making one request, and a stray unconditional `fetch` would erase it without changing a
pixel.

### 8.2 The sweep — one new key on 024's existing `edge_drift` rule

| Key | Method | Expect |
| --- | --- | --- |
| `edge.site.programme_cached` | two unauthenticated GETs of a known-published `/p/{slug}` on the apex | the second returns `x-vercel-cache` in `{HIT, STALE, PRERENDER}`, and neither carries `Set-Cookie` |

**No new rule, no `alarm_state` row, no migration** — 024 established `sweep_run.breaches`
is jsonb, 033 spent that property once, and this spends it again.

**Why this one is not the instrument 033 refused.** 033 gave `/sitemap.xml` no key because
*"under ISR a failed revalidation serves the last good cached bytes, so a 200 assertion
would be green through precisely the failure it exists to catch."* That objection does not
reach here, because this key asserts the **cache status**, not the body. The failure it
exists to catch — middleware widened, a Request-time API introduced, `Set-Cookie` leaking
onto a public route — presents as `MISS` or `BYPASS` on *every* request, which is the most
observable thing on the response (§6.11). It is also the estate's second observation of
`xerhero.com` itself; before 033 there were none.

### 8.3 Not asserted, and named

- **The per-render CPU estimates in §6.1.** 030 chose no analytics and Hobby keeps runtime
  logs for one hour (019), so nothing in the estate can measure a render. The numbers are
  reasoned, like every threshold 019 flagged.
- **Whether the cache hit rate is any good.** Vercel's ISR observability lives behind
  Observability+, which is a Pro feature. The hit rate is unknowable and the design is
  deliberately correct at a hit rate of zero.

---

## 9. Sources

**6.1** Next.js, *Caching and Revalidating (Previous Model)* — version 16.3.0 —
https://nextjs.org/docs/app/guides/caching-without-cache-components
> *"This guide assumes you are **not** using Cache Components which was introduced in
> version 16 under the `cacheComponents` flag."*
> `unstable_cache` third argument accepts *"`tags`: an array of tags for on-demand cache
> invalidation with `revalidateTag`"* and *"`revalidate`: the number of seconds before the
> cache is revalidated."*
> Route segment `revalidate`: *"`number`: (in seconds) Set the default revalidation
> frequency of a layout or page to `n` seconds."*

**6.2** Next.js, *page.js* — https://nextjs.org/docs/app/api-reference/file-conventions/page
> *"`searchParams` is a **Request-time API** whose values cannot be known ahead of time.
> **Using it will opt the page into dynamic rendering at request time.**"*

**6.3** Next.js, *Caching* (Cache Components) —
https://nextjs.org/docs/app/getting-started/caching
> *"This page covers caching with Cache Components, enabled by setting
> `cacheComponents: true` in your `next.config.ts` file."*
> *"This rendering approach is called **Partial Prerendering (PPR)**, the default behavior
> with Cache Components."*
> *"Reading `cookies()` here doesn't opt-in the whole route into dynamic rendering, the way
> the previous rendering model did."*
> *"Bots and crawlers are detected by their user agent and handled differently: because they
> need a complete document, Next.js skips the shell and renders the entire page dynamically
> at request time."*

**6.4** Next.js, *How to implement Incremental Static Regeneration (ISR)* —
https://nextjs.org/docs/app/guides/incremental-static-regeneration
> *"After 60 seconds has passed, the next request will still return the cached (now stale)
> page. The cache is invalidated and a new version of the page begins generating in the
> background."*
> *"We recommend setting a high revalidation time. For instance, 1 hour instead of 1
> second."*
> *"If an error is thrown while attempting to revalidate data, the last successfully
> generated data will continue to be served from the cache."*
> *"Background regeneration (stale-while-revalidate) runs on the instance that receives the
> triggering request. On platforms with per-request billing, this background work counts as
> additional compute."*
> *"You can use the `x-nextjs-cache` response header to observe cache behavior. Values are
> `HIT`… `STALE`… `MISS`… or `REVALIDATED`."*

**6.5** Next.js, *revalidateTag* —
https://nextjs.org/docs/app/api-reference/functions/revalidateTag
> *"`revalidateTag` can be called in Server Functions and Route Handlers."*
> *"`revalidateTag` cannot be called in Client Components or Proxy, as it only works in
> server environments."*
> *"**With `profile="max"` (recommended)**: The tag entry is marked as stale, and the next
> time a resource with that tag is visited, it will use stale-while-revalidate semantics.
> This means the stale content is served while fresh content is fetched in the background."*
> *"For webhooks or third-party services that need immediate expiration, you can pass
> `{ expire: 0 }` as the second argument."*

**6.6** Next.js, *Streaming* — https://nextjs.org/docs/app/guides/streaming
> *"HTML-limited bots and crawlers need metadata to be available in the `<head>` of the
> initial HTML. Next.js detects them by their user agent and waits for `generateMetadata` to
> resolve before streaming the page content."*
> *"With Cache Components, visitors and DOM-capable crawlers receive the prerendered shell
> immediately, and dynamic content streams in as it resolves. HTML-limited bots skip the
> prerendered shell and render the page dynamically so metadata can be placed in the
> `<head>`."*
> *"Visitors and DOM-capable crawlers receive the shell without re-running that code, but an
> HTML-limited bot re-renders it dynamically, so a page that loads for a person can fail to
> render for a crawler."*

**6.7** Next.js, *use cache* / *cacheLife* / *use cache: private* — linked from §6.3.
Recorded here only as the migration target named in §7.

**6.8** Next.js, *revalidatePath* — linked from §6.4.
> *"`revalidatePath` invalidates the cache entries but regeneration happens on the next
> request."*

**6.9** Next.js, *generateMetadata* —
https://nextjs.org/docs/app/api-reference/functions/generate-metadata
`alternates.canonical` and `robots: { index, follow }` are what 033's head tags are emitted
from; on an ISR route they are part of the cached HTML, which is why 033's `noindex` for a
tombstone is bounded by the same one hour as the page it sits on.

**6.10** Vercel, *Fluid compute pricing* — https://vercel.com/docs/functions/usage-and-pricing
> Hobby includes **Active CPU 4 hours**, **Provisioned Memory 360 GB-hrs**, **Invocations
> 1 million**.
> *"This is the CPU time your code actively consumes in milliseconds… You are only billed
> during actual code execution and not during I/O operations."*
> *"Counts each request to your function… Counts regardless of request success or failure."*
> *"Vercel bills Active CPU only while your code is actually running. If the request is
> waiting on I/O, CPU billing pauses but memory billing continues."*

**6.11** Vercel, *Vercel CDN Cache* — https://vercel.com/docs/caching/cdn-cache
> *"To cache the response of Functions on Vercel's CDN, you must include `Cache-Control`
> headers with **any** of the following directives: `s-maxage=N`…"*
> Cacheable response criteria: *"Request uses `GET` or `HEAD` method… Response doesn't
> contain the `set-cookie` header. Response doesn't contain the `private`, `no-cache` or
> `no-store` directives in the `Cache-Control` header."*
> *"CDN Cache isn't the right fit when: You need user-specific content without the `Vary`
> header… Responses include sensitive user data."*
> `x-vercel-cache` values: `HIT`, `MISS`, `STALE`, `PRERENDER`, `REVALIDATED`, `BYPASS`
> (from *Response headers*, https://vercel.com/docs/headers/response-headers).

**6.12** Vercel, *Incremental Static Regeneration* —
https://vercel.com/docs/incremental-static-regeneration
> *"**At request time (cache hit)**: A request arrives at the nearest CDN region… If the
> content is cached and its tags are still valid, Vercel serves the response immediately
> from the CDN. **Your function doesn't run.**"*
> *"**Cache shielding**: On a CDN miss, Vercel reads from the ISR cache before invoking your
> function."*
> *"**Automatic request collapsing**: When multiple requests hit the same uncached path,
> Vercel collapses them into one function invocation per region."*
> *"**Globally consistent purging**: When you revalidate content, all caches across all
> regions update within 300ms."*
> *"**Durable storage**: The ISR cache lives alongside your Function region and persists
> content for 31 days, or until you revalidate it."*
> *"If revalidation fails, Vercel keeps serving the existing cached content… **Invalid HTTP
> status codes**: Any status code other than 200, 301, 302, 307, 308, 404, or 410… When a
> failure occurs, Vercel preserves the stale content and sets a 30-second Time-To-Live
> (TTL)."*
> *"With ISR, Vercel knows a path is cacheable before the first request arrives. That's what
> enables request collapsing, durable storage, 300ms global purges, instant rollbacks, and
> path grouping. With `Cache-Control` headers alone, Vercel doesn't know a path is cacheable
> until it receives the response, so these features aren't available."*
> *"**Selective pre-rendering**: You can pre-render popular pages at build time and generate
> the rest on demand as visitors request them."*
> ISR usage and pricing: *"CDN cache reads and writes are free, but reads and writes from
> durable storage incur costs."*

**6.13** Vercel, *Routing Middleware* — https://vercel.com/docs/routing-middleware
> *"Routing Middleware **executes code before a request is processed on a site**, and are
> built on top of fluid compute."*
> *"Because it runs globally **before the cache**, Routing Middleware is an effective way of
> providing personalization to statically generated content."*
> *"Routing Middleware is priced using the fluid compute model, which means you are charged
> by the amount of compute resources used by your Routing Middleware."*

**6.14** Clerk, *Next.js rendering modes* —
https://clerk.com/docs/guides/development/rendering-modes
> *"Starting with v6, `<ClerkProvider>` will no longer opt your entire application into
> dynamic rendering by default."*
> *"It is not recommended and not optimal to wrap your entire application with
> `<ClerkProvider dynamic>` as this opts all routes into dynamic rendering, when some routes
> may be better suited for static rendering."*
> *"using `auth()` will opt your entire route into dynamic rendering."*

**6.15** Clerk, *clerkMiddleware()* — https://clerk.com/docs/reference/nextjs/clerk-middleware
> *"integrates Clerk authentication into your Next.js application through Middleware."*
> *"Middleware is not the best place to protect routes"*; protect access *"as close to the
> resource as possible, in the code that reads or mutates the data."*
> The published matcher skips Next.js internals and static files, always runs for API routes,
> and always runs for Clerk's own `/__clerk/(.*)` routes.

**6.16** Clerk, *auth()* — https://clerk.com/docs/reference/nextjs/app-router/auth
> *"Requires `clerkMiddleware()` to be configured."*

**6.17** Vercel, *Limits* — https://vercel.com/docs/limits
> Usage summary, Hobby: *"Active CPU 4 CPU-hrs · Provisioned Memory 360 GB-hrs · Invocations
> 1 million · **Fast Data Transfer 100 GB** · **Fast Origin Transfer Up to 10 GB**"*.
> ISR Reads and ISR Writes appear only in the Pro on-demand table
> ($0.0004 per 1K reads; $0.004 per 1K writes).

---

## 10. Escape hatches, recorded so a reversal is a decision rather than a rediscovery

| If this becomes intolerable | The change |
| --- | --- |
| The unpressed flash on the shelf is judged unacceptable | Put the pressed states in the HTML by adopting Cache Components (§7) and pay the crawler cost, **or** render the controls with `visibility: hidden` until the viewer response lands for signed-in viewers only — one class, no request, and it costs a blank slot rather than a wrong one |
| The header's `Sign in` → `Upload · {handle}` swap is judged too slow | Put the Handle in a Clerk **session token claim**, so the client has it with zero requests. Costs a token refresh on rename (023's `/me/account`), which is one Clerk call on a path that already writes |
| Class B needs the page out of the cache in minutes rather than an hour | Search Console **Removals** first (033, free, documented). Only if that is insufficient: a `POST /api/revalidate` Route Handler with a shared secret in the CLI's environment — a public endpoint and a credential, refused here on 023's and 024's precedent |
| The shelf is measured slow, or Neon's compute hours bind | Lengthen the `unstable_cache` window from 60 s; it is one number and the freshness argument in §5.1 tolerates 300 s without changing |
| Active CPU passes ~50% of the 4-hour allowance | This is 010's fifth Pro trigger, and 024 already decided such triggers are **watched by Vercel's own billing mail**, not by us. The first lever is the shelf: promote `/` to `generateStaticParams`-free ISR by moving the filtered views to a second route — which breaks 009's canonical URL scheme, so it is a real cost and is named here rather than assumed available |
| A sixth public route family is added | It must be added to `PUBLIC_ROUTES`, or `ci.middleware.public_routes_excluded` fails. That is the point of deriving the assertion from the constant |
