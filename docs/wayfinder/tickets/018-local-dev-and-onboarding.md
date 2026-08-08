---
id: 018
title: Local development and contributor onboarding
type: grilling
status: closed
assignee: carlo
blocked_by: [010]
---

## Question

What does someone need to do to run xer-hero on their own machine, and how much of
the stack do they have to sign up for?

Surfaced by [Stack, hosting and auth provider](010-stack-hosting-auth.md), which
settled the stack as **four hosted accounts** — Vercel, Clerk, Neon, Cloudflare R2 —
and none of them is optional to the running app. The repo is Apache-2.0 and public
precisely so people can contribute; a `git clone` that cannot reach a working state
without four signups makes that mostly theoretical.

The tension is real, not stylistic: 003 fixed **one hosted instance, no self-hosting
promise, no portability tax**, which was a *production* decision. Whether it also
binds the *development* environment is this ticket's call, and answering "yes" and
"no" lead to genuinely different codebases — a dev blob adapter is an abstraction
layer the production decision was written to avoid.

Settle:

- **Does a contributor need a Cloudflare account at all?** 010 could not determine
  whether Cloudflare requires a payment method to enable R2 even within the free
  tier; the R2 pricing page is silent. **This is a fact to establish, not a decision
  to take** — check it first, because a card requirement changes the answer to
  everything below. If a card is required, a contributor without one cannot run the
  upload path, full stop.
- **Is there a filesystem blob adapter for dev?** The upload path is a presigned PUT
  from browser to R2, so faking it locally means a stub PUT endpoint and a local
  directory. That is a seam through the storage layer, which the no-portability-tax
  decision rules out for production. Dev-only is a defensible exception; it is still
  an abstraction someone has to keep honest, and a seam only exercised in dev rots.
- **What about Postgres?** A contributor can have their own Neon free project in
  minutes, or run Postgres in Docker. Neon-specific things in play: the `neon-http`
  driver, `citext` and `pg_trgm` extensions, and scale-to-zero behaviour. Decide
  whether local Docker Postgres is supported or whether Neon is simply required.
- **What about Clerk?** Clerk's dev instances use shared OAuth credentials, so a
  contributor needs no Google Cloud project — but they do need a Clerk account and
  their own publishable/secret key pair. Is that acceptable, or does the app need a
  no-auth dev mode with a stubbed session?
- **How much can be worked on with nothing provisioned?** Probably a lot: the parser
  is isomorphic TypeScript with no Node built-ins and tests against committed
  synthetic fixtures from
  [Get a large synthetic fixture for perf work](012-large-synthetic-fixture.md), so
  parser work needs zero accounts. Naming the tiers honestly in the README —
  *parser and tests: nothing; UI against seed data: Postgres; full upload path:
  everything* — may be worth more than any abstraction.
- **Seed data.** The shelf is meaningless empty and 007 designed it against 40
  programmes. A committed seed script that ingests the synthetic corpus is what makes
  a fresh clone show something. Decide whether seeding runs the real ingest path or
  writes rows directly.
- **What the README promises.** Whatever is decided, it is a documented contract with
  contributors, and an undocumented one is worse than a narrow one.

## Resolution

**Production takes four hosted accounts; development takes one. Every substitution is
an endpoint swap, not an adapter — so the abstraction this ticket was afraid of does
not get written.**

The ticket framed its central question as a trade: a dev blob adapter buys cardless
contributors at the price of the abstraction layer 003 ruled out. That trade is
false, and it is false for a reason neither 010 nor this ticket had checked — **the
production clients are already vendor-neutral**. R2 presigning is stock
`@aws-sdk/client-s3` plus `@aws-sdk/s3-request-presigner` pointed at
`<ACCOUNT_ID>.r2.cloudflarestorage.com`; Cloudflare documents no proprietary call in
the path. The Neon serverless driver takes a `neonConfig.fetchEndpoint`. Neither
vendor is named anywhere in product code — both are named in an environment
variable. So the seam this ticket worried about keeping honest already exists, at the
protocol layer, maintained by someone else, and using it costs a `docker-compose.yml`
rather than an interface.

That single observation decides four of the seven questions below, and the two places
it does *not* apply are exactly where the answer comes out the other way.

### 1. The fact that had to be established first: R2 requires a card

010 could not determine whether Cloudflare requires a payment method to enable R2
within the free tier, and this ticket correctly refused to decide anything until that
was known. **It does.** Cloudflare's billing policy states you must have a valid
payment method before enabling subscriptions; R2's own get-started page instructs you
to *"complete the checkout flow to add an R2 subscription"*, and the enable dialog
reads as a purchase — *"a continuous month-to-month subscription which will
automatically renew… billed to your designated payment method"*. Two long-running
community threads exist under the titles *"Why using R2 free tier involves giving
card info?"* and *"If I want to use Cloudflare R2, I have to link a payment method"*.

R2 is therefore **free in money and not free in friction**. 010's open question is
closed, and the consequence the ticket predicted holds: a contributor without a card
cannot touch real R2, so requiring R2 for development would gate the most interesting
half of a public Apache-2.0 repo behind a payment instrument.

The comparison that matters is with Clerk, checked for the same reason: **Clerk needs
no card**, and its free tier moved from 10,000 MAU to 50,000 monthly-retained users
on 5 February 2026. Two hosted dependencies, two different kinds of gate — which is
why they get different answers in §2 and §4 rather than one blanket policy.

### 2. Blobs: MinIO in Docker, swapped by `S3_ENDPOINT`

A local S3 implementation runs in a container, speaks the same protocol, and takes
the same presigned PUT from the same SDK. The upload path — browser → presigned PUT →
object — is exercised in full locally, including CORS, because CORS is a bucket rule
in both. One environment variable differs.

**The filesystem adapter is rejected, and not on principle.** It is the only one of
the three options that adds an interface, and it is also the only one whose dev path
can silently diverge from production: a stub PUT endpoint writing to a directory
shares no code with a presigned PUT to an S3 API, so every difference between them is
a bug waiting for deployment. 003's no-portability-tax rule was written to prevent
exactly this, and it turns out not to need a dev-only exception carved into it.

**Nothing external, and nobody pays, to develop.** That is the constraint this was
decided under, and MinIO meets it exactly.

### 3. Postgres: Docker Postgres behind the local Neon HTTP proxy

010 chose `drizzle-orm/neon-http`. That driver speaks HTTP to Neon's endpoint, not
the Postgres wire protocol, so "run Postgres in Docker" is not a drop-in. Neon's own
local-development guide documents the fix: a compose file running Postgres plus the
Neon proxy, with the driver pointed at it via `neonConfig.fetchEndpoint`. Two images
exist and the difference is decisive — the official `neondatabase/neon_local`
proxies to a *real* Neon project and needs an account and API key, while the local
Neon HTTP proxy image fronts a local Postgres container and needs nothing. We take
the latter, **pinned by digest** because it is community-maintained.

`citext` and `pg_trgm` are contrib extensions present in the stock `postgres` image,
so neither of 010's extension requirements is a Neon dependency.

**Swapping to `node-postgres` in dev was rejected on the direction of its
divergence.** It is not that dev would be less capable than production — it would be
*more*, and that is worse. `neon-http` cannot open an interactive transaction, and
three closed decisions rest on that limit: 011 rejected an advisory lock for dedup
and used a partial unique index on `content_hash` instead, 005's circular
`programme ↔ revision` insert is a batch of client-generated uuids for the same
reason, and 017 keeps the Class B cascade off a URL entirely *because* `neon-http`
structurally cannot wrap it in one transaction. Under a `node-postgres` dev mode, a
contributor writes a `BEGIN…COMMIT` that passes locally, passes review, and fails in
production — and the three tickets above quietly stop being self-enforcing. Keeping
one driver keeps the constraint that makes them correct.

### 4. Clerk: an account is required, and there is no stub

This is where the endpoint-swap logic runs out, and the answer flips. Clerk ships no
local emulator and no proxy, so there is no endpoint to point elsewhere; a dev
bypass would be a **second implementation of authentication**, which is the shape
rejected in §2 and §3 arriving under a friendlier name.

The failure modes are also asymmetric in a way that decides it. A storage or database
stub that leaks into production is broken and loud. **An auth bypass that leaks into
production is silent and total** — a `DEV_USER_ID` honoured in prod makes every
visitor that user. A boot-time hard-fail would mitigate it, but §2 and §3 don't need
mitigating, because they own no such hazard.

The cost is acceptable because Clerk's gate is a signup, not a card (§1), and because
**most of the app is signed out**. From closed work, the shelf, browse, search,
facets, the detail page, download, the contributor page and the leaderboard are all
anonymous surfaces; auth gates only upload and fork, votes, bookmarks, owner edits,
Class A self-withdrawal, and whatever
[The signed-in user's own space](023-signed-in-users-own-space.md) settles. A
contributor with no accounts at all can still work on the majority of the product.

Clerk dev instances use shared OAuth credentials, so 010's finding stands: **no
Google Cloud project is needed**, only a Clerk publishable/secret pair.

### 5. Seeding runs the real ingest path, server-side

The seed calls the **product parser, the product derive code and the product
persistence code**, and writes blobs with the same S3 client. It skips exactly one
thing: the browser parse and the presigned-PUT hop, which is a transport a script
cannot drive and which carries no logic worth seeding through — 011 already made
every server check a recomputation of something the client was shown, so the server
side is the whole of the meaning.

010 made the parser isomorphic so 013 could preview in the browser; the same property
makes this free, because the seed is Node calling the same module. **Committed
pre-computed JSON is rejected**: it would be a second producer of `derived.json`
against a contract 006 versioned specifically so there is one, and goldens drift
silently the first time that contract moves — which it already has, twice, to v2.
Running the real path also populates `content_hash` for real, so 011's partial unique
index and its tombstoned-hash reject are exercised rather than imagined.

The honest cost: **seeding cannot work before the parser and derive exist**, so a
fresh clone shows an empty shelf early in development. That is an ordering fact, and
the alternative buys past it with drift.

### 6. The dev corpus is generated, and kept apart from the test corpus

~40 programmes — 007's own design population — generated deterministically from
seeds and **not committed**, on the `perf-20k` precedent that `fixtures/generated/`
already establishes in `.gitignore`. Tuned to fill 009's facets: all eight sectors
plus blanks, all three size bands (500/2,000/5,000), both P6 versions, progressed and
not. Sector is assigned by the seed script rather than the generator, because 015
made sector declared metadata on the programme row and it appears nowhere in a `.xer`.

**Reusing the committed corpus is rejected, and the reason is about protecting the
corpus rather than the shelf.** Those 16 files exist to *fail* — mojibake, missing
calendars, no WBS, 20 activities each. The moment the test corpus is also the demo
corpus, someone tunes it to look presentable, and it stops being the only thing
standing between the parser and a regression CI can never otherwise catch, since
010 made real fixtures gitignored forever. Loading both was considered and dropped
for the same reason; degraded rendering is `sparse-150`'s job and `sparse-150`
already exists.

**The seed's real value is in the row states, not the files.** No generated `.xer`
can produce a fork, a revision series, a vote, a tombstone or a failed ingest — those
are arrangements the seed script makes, and without them every surface the closed
tickets fought hardest over is invisible on a fresh clone. The seed therefore stages:
a monthly revision series (Fixture A's shape), a set of fork siblings (Fixture B's
shape), tombstoned programmes under both 003 classes, a `failed` row with a
`failure_reason` from 011, unsectored programmes from 015, and vote and bookmark
counts from 016.

### 7. CI stands the whole stack up

Migrate, seed, smoke query, on every PR. Everything decided here is dev-only code — a
compose file, a seed script, two endpoint overrides — and this ticket's founding fear
was that dev-only seams rot. CI running them is the only thing that stops it, and it
catches migration drift, seed drift, contract drift and a rotted proxy pin together.

**The argument that makes this more than hygiene comes from 010:** fork PRs get CI
only, and Vercel does not expose environment variables to them, so a fork PR has no
secrets and can reach no hosted service. **An all-local stack is therefore the only
stack a fork PR can ever be tested against.** Every decision above happens to make
fork-PR CI meaningful; declining this one would leave it uncollected. It also closes
the loop on §5 — real-ingest seeding was justified partly as an integration test, and
a test that only runs on the maintainer's laptop is not one.

CI gets slower by the image pulls and a seed run. The job starts as migrate-only and
grows as the parser and derive land.

### 8. Docker is required; the hosted path is documented as a fallback

Everything routes through `docker compose`, so Docker is a hard prerequisite and the
README says so. The hosted fallback — point `S3_ENDPOINT` at R2 and `fetchEndpoint`
at a real Neon project — is documented because **it costs nothing to support: it is
the production configuration**. It is also not optional to have, since 017's takedown
CLI is a laptop tool pointed at production Neon and R2, so "local code, hosted
services" is a mode this repo must own regardless. The fallback states R2's card
requirement plainly, per §1.

**Podman is not supported.** Its compose compatibility is close but not identical,
and a narrow documented contract beats a broad vague one — which is this ticket's own
closing instinct.

### What the README promises

The documented contract, and the answer to the ticket's headline question:

| Tier | Prerequisites | What works |
|---|---|---|
| **0 — nothing** | Node | Parser, derive, unit tests against the committed synthetic corpus |
| **1 — `docker compose up`** | Docker | Every signed-out surface: shelf, browse, search, facets, detail page, download, contributor page, leaderboard — against ~40 seeded programmes |
| **2 — + Clerk dev keys** | Docker, a Clerk account (free, no card) | Upload, fork, votes, bookmarks, owner edits, Class A withdrawal |
| **Fallback** | Your own Neon and R2 (**R2 requires a card**) | Same as tier 2, against hosted services |

Compose runs three services: Postgres, the Neon HTTP proxy, MinIO. `.env.example`
ships with **working dev defaults committed** — the MinIO root credentials, the local
Postgres password, the proxy endpoint — because they guard nothing and every value a
contributor must invent is a step that can go wrong. The only value a human supplies
is a Clerk key pair, and only at tier 2.

### What this hands to other tickets

- **[Stack, hosting and auth provider](010-stack-hosting-auth.md)** — its one
  explicitly unresolved fact is answered: **R2 requires a payment method**. Its CI
  section grows from lint/typecheck/unit tests to a job that stands the stack up. Its
  Clerk free tier is now 50,000 monthly-retained users, widening the $0 headroom it
  costed.
- **[Get a large synthetic fixture for perf work](012-large-synthetic-fixture.md)** —
  the generator gains a second consumer and a third fixture class, a `dev` catalogue
  of ~40 plausible programmes, uncommitted like `perf-*`. Its three-way separation of
  corpus / rendering / perf is deliberately preserved rather than widened: the dev
  catalogue is a fourth kind, not a relaxation of the first.
- **Nothing is asked of the schema, `derived.json`, `activities.json` or `card`.**
  Zero backfill.

### Flagged

**The local stack reproduces the S3 API and the Neon wire faithfully, and reproduces
none of the CDN.** 013's `X-Robots-Tag: noindex, noarchive` on `original.xer.gz`,
017's verified purge and the 1-hour TTL that makes 003's "bytes hard-delete" true,
and R2's bucket CORS rules all exist only in production — and 017 downgraded *purge
must never fail* to *purge should not fail* on the assumption that someone verifies
it. No tier above can. Filed as
[Verifying the production-only edges](024-verifying-production-only-edges.md).
