---
id: 010
title: Stack, hosting and auth provider
type: grilling
status: closed
assignee: carlo
blocked_by: [004]
---

## Question

What is this actually built and run on?

Blocked on [What does storage actually cost?](004-storage-cost-model.md) because
the storage and database verdict lands first — the rest of the stack arranges
itself around it, not the other way round.

Constraints already fixed: public repo, one hosted instance, managed services
allowed, no self-hosting promise, free to start.

Settle:

- **Framework and hosting.** Next.js App Router on Vercel is the presumed default
  given the storefront is content-heavy and wants server rendering and caching.
  Confirm or reject it — and if confirmed, say what it costs when the free tier
  ends, in the same terms as the storage cliff.
- **Auth provider.** Google sign-in is a given; the provider is not. Clerk (fast,
  Marketplace-native, has a free tier with a ceiling), Auth.js (free, more wiring,
  no vendor account), Supabase Auth (free if Supabase already won the database
  question). Decide against real numbers, and check the free-tier user cap against
  what "free to start" has to survive.
- **What identity the app stores.** Which Google claims are persisted, and what
  the public profile shows. Feeds
  [Licensing, attribution and takedown](003-licensing-attribution-takedown.md)
  and account deletion in
  [Domain model and schema](005-domain-model-and-schema.md).
- **Database access.** ORM or query builder or raw SQL — Drizzle, Prisma,
  Kysely, plain `pg`. Migration tooling.
- **Charting library.** Consult `/dataviz`. It must handle a sparkline at
  thumbnail size, an S-curve, and a histogram, render server-side or at least
  fast, and not dominate the bundle.
- **The parser's home.** Does `.xer` parsing run in a Vercel Function, a
  background job, or the browser? Bounded by function timeout and memory against
  the largest fixture from
  [Get real .xer files to work against](001-get-real-xer-files.md). This one
  constrains [Upload and ingest pipeline](011-upload-ingest-pipeline.md).
- **CI and the public-repo posture.** Tests, lint, preview deploys, what a
  contributor needs to run it locally, and how secrets stay out of a public repo.

## Resolution

**Next.js App Router on Vercel Hobby, Clerk for auth, Drizzle over Neon HTTP, no
charting library, and the parser is isomorphic TypeScript that runs authoritatively
in a Function.** Every figure below was read off a vendor page on **2026-08-07** and
is sourced at the bottom.

Two measured limits did most of the deciding, and neither was in the ticket's own
list of things to settle:

1. **Vercel's request body cap is 4.5 MB on every plan.** Fixture A progressed is
   4.8 MB and Fixture B is 6.8 MB, so an upload through a Function body **fails on
   both real fixtures today**. Direct-to-blob is not an optimisation here, it is the
   only door.
2. **Hobby's Active CPU allowance is 4 CPU-hr/month.** That, not duration or memory,
   is the meter the ingest path runs against.

### Framework and hosting

**Next.js App Router on Vercel, starting on the Hobby plan, budget $0/month.**

004 flagged that Hobby is "intended for non-commercial use" and asked for the
question to be checked rather than assumed. **Checked: Hobby is legal for this
project.** Vercel's fair-use guidelines define commercial usage as any deployment
"used for the purpose of financial gain of *anyone* involved in *any part of the
production* of the project" — payments, advertising the sale of a product, affiliate
linking as the primary purpose, ad platforms, and explicitly **donations**. xer-hero
has none of these, and 003 put monetisation out of scope. The definition is about
financial gain, not about scale, user accounts, or uploads. So 004's "if Hobby is
out, the floor is $20/month from day one" branch does not fire.

**What Hobby actually costs is not money, it is these ceilings:**

| Hobby limit | Bites when |
| --- | --- |
| **Active CPU 4 CPU-hr/month** | ~7,000–14,000 parses at 1–2 CPU-s each, *shared with SSR* — at 004's "Busy" tier, SSR alone at ~30 ms CPU × 500k views is 4.2 CPU-hr and already over |
| Fast Data Transfer ~100 GB (fair use) | app shell only; comfortable warm, tight on cold payloads |
| Function Invocations 1M/month | not close |
| 1 seat, no log drains, 1 h runtime log retention | a second collaborator, or debugging a failed ingest after the hour is up |
| 300 s duration, 2 GB / 1 vCPU | never — parse is ~1–2 s |
| Deployments 100/day | never |

**Hobby → Pro is taken on a trigger, not a date.** The triggers, in the order they
are likely to fire: log drains or >1 h log retention needed to debug ingest; a second
collaborator seat; Active CPU crossing 4 CPU-hr. Pro is $20/seat/month, which lands
exactly on 004's "~$20–45/month" platform floor — Vercel Pro $20 + always-on Neon
~$19 + R2 ~$0.25. **004's cost model is unchanged by this ticket**; it just now has a
confirmed $0 left-hand side.

**Cloudflare Workers + Pages was considered and rejected.** R2 already won blobs, so
one-vendor consolidation is superficially attractive — but Next.js runs there through
the OpenNext adapter rather than natively, which is a permanent tax of adapter lag on
every Next release, and Neon keeps the stack multi-vendor regardless. The bill it
would save is the R2 egress line, which 004 measured at **$0.23/month**. Not worth an
adapter.

### Auth provider

**Clerk.** Free plan, and free is not a runway here — it is the steady state.

The ticket's three-way framing is stale, and two of the three options are gone:

- **Auth.js is out.** Its maintainers handed stewardship to the Better Auth team in
  2026 and now state: *"we strongly recommend new projects to start with Better Auth
  unless there are some very specific feature gaps."* v5 gets security and urgent
  fixes only, with *"no immediate plans for v5"* stable. Choosing it for a new project
  in August 2026 is choosing a maintenance-mode dependency.
- **Supabase Auth is out, twice.** 004 already disqualified Supabase's free Postgres
  for the week-idle project pause, and a paused project takes auth down with it —
  which is strictly worse than a paused database, because it locks out the operator
  too. Paying Supabase Pro $25/month purely for auth while Neon holds the data is the
  worst of both.

So the real contest was **Clerk vs Better Auth** (MIT, 29.5k stars, the successor the
Auth.js team itself points at), and it was **not decided on cost** — both are $0.

| | Clerk | Better Auth |
| --- | --- | --- |
| Cost at this project's scale | **$0** — free plan is 50,000 MRU, then $0.02/MRU | $0, MIT |
| Google identity lives | in Clerk | in **our Neon Postgres** — `user` + `account` rows, OAuth tokens |
| Account deletion (003) | delete the Clerk user; our schema never held an email | we own erasure, token encryption at rest, and backup scrubbing |
| Contributor local dev | Clerk dev instance with shared OAuth credentials — no Google Cloud project needed | contributor registers their own Google OAuth client |
| Costs you | "Secured by Clerk" branding ($25/mo to remove), second vendor, hosted dependency in a public repo | you operate it |

**The deciding argument is 003's account-deletion position, not convenience.** 003
committed to *erase the person, keep the pseudonym*, and staked the whole GDPR
posture on the public identity being pseudonymous. Clerk is the option where the
personal data never enters our schema at all, so that boundary is structural rather
than procedural — see the next section, which is where this actually bites.

The 50,000 MRU free ceiling is worth stating plainly because the ticket asked whether
"free to start" survives: **this project will not approach it.** Clerk raised the free
allotment from 10,000 to 50,000 in February 2026 and bills MRU (monthly *retained*
users), a narrower unit than MAU. Free-plan omissions that could have mattered and
do not: MFA, passkeys, custom session lifetime (fixed 7 days), SMS. Custom domain and
webhooks **are** included on Free.

### What identity the app stores

**Minimal. `google_sub` and `email` come off the schema entirely.**

This **amends 005's `app_user` DDL**, which was written for direct Google OAuth:

```sql
-- 005 as written                    -- amended by this ticket
create table app_user (              create table app_user (
  id            uuid primary key,      id             uuid primary key,
  google_sub    text not null unique,  clerk_user_id  text not null unique,
  email         citext not null,
  display_name  citext not null unique,display_name   citext not null unique,
  created_at    timestamptz not null   created_at     timestamptz not null
);                                   );
```

Why this is more than data minimisation hygiene: under 005 as written, "erase the
account" means deleting a row from Neon — and **Neon's point-in-time recovery keeps
that row restorable for days**, so an email you have "deleted" is still on disk in a
snapshot whose retention you do not control. Under the amendment there is nothing to
erase, because the email was never written. Deletion collapses to two acts: delete
the Clerk user, write the Handle to `reserved_handle`. That is the difference between
a position that is defensible and one that is **provably complete** — and 003 already
flagged "whether the CC-BY grant survives a UK GDPR erasure request" as needing a
lawyer, so the cheaper the erasure story is to defend, the better.

**What this costs, recorded so nobody rediscovers it as a surprise:**

- **The app can never send email.** No fork notifications, no deletion confirmation,
  no "your programme was tombstoned". Nothing in the map asks for this today; this
  closes the door, and reopening it means storing an email again.
- **Takedown correspondence becomes a Clerk dashboard lookup.** 003 said email is
  used for "account identity and takedown correspondence only". Correspondence
  survives — it is a manual, rare, operator-initiated lookup on a Class B complaint,
  which is exactly the case where a dashboard is fine and a stored column is a
  liability. But **Clerk is now load-bearing for a legal process.**
- **Migrating off Clerk requires a Clerk user export first**, or every
  `clerk_user_id` points at nothing and no user can re-link.

**Also fixed:**

- **The Handle stays authoritative in our Postgres**, not Clerk's `username` field.
  005's `reserved_handle` never-reassign rule needs a table Clerk does not have, and
  splitting the uniqueness constraint across two systems would be a race.
- **No avatars in v1.** Identicon derived from the Handle. No Google profile image to
  copy, hotlink or expire, no personal data in an `<img src>`, and nothing charged
  against Hobby's 5,000 image transformations.
- **This amends 003's privacy policy section**, which names "the Google account id,
  email and chosen display name are stored" as the exact disclosure. That is no
  longer true and the replacement is a *stronger* claim: Clerk stores the Google
  identity; xer-hero stores an opaque provider id, a Handle and a display name.

### Database access

**Drizzle + drizzle-kit, over `drizzle-orm/neon-http`.**

005's schema is full of things an ORM fights and a thin SQL layer does not: the
deferrable circular `programme ↔ revision` FK, `citext`, a recursive CTE for the
Class B fork subtree, 009's tsvector and `pg_trgm` indexes, and 009's live
conjunctive facet counts. Every one of those is hand-written SQL under any tool.
Drizzle lets it sit inline in a `` sql`` `` template beside the typed query builder
instead of leaving the abstraction, and drizzle-kit emits plain `.sql` files that can
be hand-edited — which migration one requires anyway for `create extension citext`
and `pg_trgm`.

- **Prisma rejected**: you would drop to `$queryRaw` for every interesting query
  here, paying the client weight and a migration engine hostile to hand-written DDL
  for nothing.
- **Kysely rejected, narrowly**: arguably better query types, but no schema as source
  of truth and all DDL hand-written. A defensible choice for someone who would rather
  own the SQL outright.
- **Plain `pg` rejected**: no typing, no migration story.

**Driver: HTTP only, no WebSocket pool.** Neon's HTTP driver (`neon()`) supports
**batched, non-interactive transactions only**; interactive session transactions need
the WebSocket `Pool`. **Ingest does not need interactive.** 005 made ids
client-generatable `uuid`s, so the circular insert is a known three-statement
sequence — insert programme with null `current_revision_id`, insert revision, update
— which is a batch. So there is no pool lifecycle to get wrong inside a Function, and
no WebSocket that "can't outlive a single request".

**Carried to [Upload and ingest pipeline](011-upload-ingest-pipeline.md):** the
content-hash check is read-then-write across two round trips, so two simultaneous
uploads of byte-identical files could both become roots, defeating 003's
hash-blocks-a-new-root rule. 005 made `content_hash` deliberately non-unique, so
nothing in the schema stops it. Needs an advisory lock or a partial unique index on
roots.

### Charting library

**None for the shelf. None chosen for the detail page, and that is deliberate.**

**Shelf: hand-rolled inline SVG in a server component.** 007's row graphics are ~200
bytes of pre-normalised numbers in the `card` JSONB; turning that into a `<path d>`
is a ~20-line polyline function. Server-rendered, zero JavaScript shipped, zero
hydration, and 25 rows per page (009) cost nothing. A charting library here would be
the single heaviest thing on the page *and* client-only — ~100 KB shipped to draw 25
glyphs from data already computed at ingest. `/dataviz` reaches the same place
independently: its form table classifies value-plus-sparkline as a **stat tile, not a
chart**, the one form that does not owe the default hover layer. So the shelf's
no-JS, no-hover treatment is the *recommended* form, not a compromise made for
budget.

**Detail page: the rule is fixed, the library is not.**

> Any chart whose data is fully known at request time renders as server-generated
> SVG. A runtime charting library enters only when interaction is the requirement,
> and it must justify its bundle.

[The project detail page](008-project-detail-page.md) is still open and it decides
what those charts are *for*; choosing Recharts today would pre-commit a client bundle
to charts nobody has specified. A default is named so 008 does not start cold:
**Observable Plot**, because it has a documented `document` option specifically for
server-side rendering under a virtual DOM, so it can stay zero-JS until interaction
is actually needed. **Unverified caveat: Plot's docs acknowledge the option but
endorse no specific vdom library**, so the linkedom/jsdom pairing must be spiked
before 008 relies on it. Fallback is **visx** (modular, pay-per-import). **Recharts
is ruled out** — client-only, and it fights the render-server-side constraint this
ticket set.

### The parser's home

**Browser uploads straight to R2; the authoritative parse runs in a Vercel Function;
the parser module is isomorphic.**

1. **Upload is a presigned PUT from the browser directly to R2.** Forced by the
   4.5 MB body cap against 4.8 MB and 6.8 MB fixtures. Bonus: those bytes never touch
   Vercel's Fast Origin Transfer meter.
2. **The browser gzips before PUT** (`CompressionStream`). 7–8:1 measured, so the
   uploader sends ~600 KB instead of 4.8 MB, and what lands in R2 is exactly the
   `raw.xer.gz` object 004 specified. The server decompresses to hash, because
   `content_hash` is over **raw** bytes and a client-computed hash is worthless.
3. **The authoritative parse is a Vercel Function**, invoked once the PUT completes,
   reading the object back from R2. ~1–2 s CPU against 300 s / 2 GB / 1 vCPU is
   ~150× headroom; the binding meter is Hobby's 4 CPU-hr/month, not the timeout.
4. **Async from day one**, using the `pending` status 005 already reserved in the
   Revision enum. PUT completes → row inserted `pending` → ingest invoked → row goes
   `published`. Not for speed. For the tab closed mid-upload, and because a retry
   needs somewhere to retry *from*. A cron sweep collects stranded `pending` rows.

**The constraint that falls out, and the reason this ticket fixes it rather than
011: the parser is isomorphic TypeScript with no Node built-ins.**
[Personal data in published .xer files](013-personal-data-in-published-files.md) will
almost certainly want a pre-publish screen showing what is actually in the file
before the user commits — that is a parse before publish, and in the browser it is
free and instant. Same module, both environments. **The browser parse is advisory
only; nothing a client computes is ever persisted.** Client-supplied stats would
poison the shelf and the leaderboard, which 003 established people already have a
motive to game.

> **Amended 2026-08-08** by
> [Confirm the pre-upload scan on mobile Safari](029-confirm-scan-on-safari.md). The browser
> requirements 020 wrote onto this ticket — `CompressionStream`, `Blob.stream()` and
> `crypto.subtle` — are **measured present and correct in WebKit 26.5 and Gecko 153**, not only in
> Chromium, so decision 2's browser-side gzip is a cross-engine fact. Two corrections to how the
> requirement has to be stated. **`CompressionStream('gzip')` output length is engine-dependent**
> (7.38 MB in WebKit against 7.16 MB in Blink on the same file) **and in Gecko not stable across runs
> of itself**, so nothing may predict the compressed length except the blob in hand — which is why
> 020's exact-content-length presign is required rather than tidy, and why a retry must reuse the
> blob. And **`crypto.subtle` is the only one of the three gated on a secure context**: on an
> insecure origin the other two work and the hash silently disappears, so the upload page's
> requirement is not "three APIs" but "three APIs **and** a secure origin", and a plain-http origin
> fails it in a way no feature-detection of the other two will catch.
>
> This ticket's *"Node ≥ 18, no dependencies"* posture also acquires its first exception, deliberately
> scoped: `tools/scan-bench` carries `playwright` in its **own** `package.json`, so the dependency is
> a measurement-harness fact and `tools/fixture-gen` — the thing CI runs — is unchanged.

**Vercel Workflows not adopted.** At 1–2 s this does not need durable execution, and
`pending` plus a cron sweep is far less machinery. It is the upgrade if
[Get a large synthetic fixture for perf work](012-large-synthetic-fixture.md) shows a
20,000-activity file takes minutes rather than seconds — 004 already extrapolates
that file to ~1.2 MB gzipped, so the possibility is live.

### CI and the public-repo posture

**The finding: the test corpus is gitignored, so CI has no fixtures.**

`.gitignore` excludes `*.xer` and the fixtures directory because they are commercial
data — correctly, and that will not change. So CI cannot test the parser against any
real file, and the parser is the one component where a silent regression corrupts
every row it touches.

**Commit a small synthetic `.xer` corpus.** Hand-built, tens of rows, deliberately
exercising the landmines 002 and 004 already named: the `0x81` bytes that make strict
CP1252 decoding throw (28,774 occurrences in one fixture), the `0x7F` calendar
layout runs, both P6 6.0 and 8.3 field sets, a missing-table case, and Fixture B's
`PROJWBS = 1` no-WBS shape. Golden-file tests against those, running on every PR
including forks. **Real fixtures stay a local-only check** the maintainer runs; they
never enter CI.

This **widens [Get a large synthetic fixture for perf work](012-large-synthetic-fixture.md)**
beyond its title — synthetic fixture authoring is not just perf work, it is the only
test corpus CI will ever have, and the small correctness corpus and the large perf
file are the same machinery.

**The rest:**

- **GitHub Actions for lint, typecheck and test.** No deploy step — Vercel's Git
  integration owns deploys.
- **Preview deploys for branches; fork PRs get CI only.** Vercel does not expose env
  vars to forked-PR builds by default, and here that default *is* the correct policy
  rather than an obstacle to work around.
- **A Neon branch per preview** via the Neon–Vercel integration, so a preview never
  touches production rows. Free plan allows **10 branches per project**, sharing one
  **100 CU-hr** and **0.5 GB** project pool; the integration deletes the branch when
  the PR closes. Prune if it bites.
- **Secrets live only in Vercel env vars.** `.env.example` committed with names and
  no values; `.env.local` is already gitignored.

**Open and deliberately not guessed:** whether Cloudflare requires a payment method
to enable R2 at all, even within the free tier — the R2 pricing page does not say. It
matters only for contributor onboarding: if a card is required, a contributor cannot
run the full upload path locally without one, and a filesystem blob adapter for dev
becomes necessary. Handed to
[Local development and contributor onboarding](018-local-dev-and-onboarding.md).

### The stack, in one table

| Layer | Choice | Cost at launch |
| --- | --- | --- |
| Framework | Next.js App Router | — |
| Hosting | Vercel **Hobby** | $0 → $20/mo on trigger |
| Blobs | Cloudflare R2 (from 004) | ~$0.23/mo at 10k programmes |
| Database | Neon Postgres Free (from 004) | $0 → ~$19/mo always-on |
| Auth | **Clerk** Free | $0 to 50k MRU |
| DB access | **Drizzle** + drizzle-kit, `neon-http` | — |
| Charts | **inline SVG**, no library | — |
| Parser | isomorphic TS, authoritative in a Function | — |
| Upload | presigned PUT browser → R2, gzipped client-side | — |
| CI | GitHub Actions + synthetic fixture corpus | $0 |

### What this hands to other tickets

- **[Domain model and schema](005-domain-model-and-schema.md)** — `app_user` amended:
  `google_sub` and `email` dropped, `clerk_user_id` added.
- **[Licensing, attribution and takedown](003-licensing-attribution-takedown.md)** —
  the privacy policy's personal-data disclosure must be rewritten; the site does not
  store an email. Takedown correspondence is a Clerk lookup.
- **[Upload and ingest pipeline](011-upload-ingest-pipeline.md)** — presigned PUT,
  client-side gzip, server-side hash of decompressed bytes, `pending` → `published`
  transition, cron sweep for stranded rows, and the read-then-write content-hash race.
- **[The project detail page](008-project-detail-page.md)** — the server-SVG rule, and
  the Observable Plot spike if interaction is needed.
- **[Personal data in published .xer files](013-personal-data-in-published-files.md)** —
  an isomorphic parser is available in the browser for a pre-publish preview.
- **[Get a large synthetic fixture for perf work](012-large-synthetic-fixture.md)** —
  widened to own the CI correctness corpus as well as the perf file.
- **[What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md)** —
  unblocked. Note it inherits Hobby's 1-hour runtime log retention and absence of log
  drains.

### Sources

- [Vercel fair use guidelines — commercial usage](https://vercel.com/docs/limits/fair-use-guidelines)
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations) — 4.5 MB
  body, 300 s, 2 GB/1 vCPU on Hobby
- [Clerk pricing](https://clerk.com/pricing) — 50,000 MRU free, Pro $25/mo ($20
  annual), $0.02/MRU overage
- [Auth.js is now part of Better Auth](https://github.com/nextauthjs/next-auth/discussions/13252)
- [Better Auth](https://github.com/better-auth/better-auth) — MIT
- [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver) — HTTP
  batched vs WebSocket interactive transactions
- [Neon plans](https://neon.com/docs/introduction/plans) — Free: 10 branches/project,
  100 CU-hr, 0.5 GB
- [Observable Plot — the `document` option](https://observablehq.com/plot/features/plots)

### Amendment 2026-08-07 — [Upload and ingest pipeline](011-upload-ingest-pipeline.md)

**The cron sweep this ticket specified cannot run on Vercel.** Hobby is limited to
**one cron invocation per day, with ±59 minutes of scheduling slop**, and a more
frequent expression *fails at deployment* rather than degrading. The "cron sweep
collects stranded `pending` rows" line above therefore does not describe anything
Hobby can execute at a useful cadence — a transient ingest failure would wait up to
24 h for its first retry.

011 resolves it **without leaving Hobby**: the sweep is a **GitHub Actions scheduled
workflow** POSTing `/api/sweep` with a bearer secret every 15 minutes. GitHub Actions
is already this ticket's CI choice, it is free on a public repo, and its scheduler is
best-effort — hence 15 minutes rather than 5. A Vercel daily cron is retained as a
backstop, which fits the 24 h reap exactly. Fork PRs get no env vars (fixed above), so
a fork cannot call the endpoint.

**One addition to the Hobby → Pro trigger list:** *GitHub Actions schedule drift makes
the retry cadence unreliable* — Pro's once-per-minute cron is the fix, and it costs
$20 rather than any code. It joins log drains, a second seat and Active CPU. Note that
trigger and the log-retention trigger are likely to fire together, both being about
operating ingest — see [Operating and observing ingest](019-ingest-observability.md).

Source: [Vercel cron jobs — usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
(read 2026-08-07).
