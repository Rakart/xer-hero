# xer-hero

**A public shelf of Primavera P6 programmes.** Planners upload a `.xer`, and it becomes a page
anyone can read without opening P6 — the shape of the programme, its dates, its logic, and an
honest verdict on its quality against a standard planners are already audited by. Upload is
publish. Everything on the shelf is CC-BY 4.0.

This README **is the specification**. Every decision below was settled before a line of code was
written, and each is traceable to the ticket that settled it. The application is now being built
against it — see [Running it locally](#running-it-locally).

---

## Status

| | |
|---|---|
| **Phase** | Spec complete. Build in progress — see [Running it locally](#running-it-locally). |
| **Decisions closed** | 51, over 61 tickets |
| **Open questions** | none |
| **Gate to starting the build** | provisioning the production estate ([the day-one runbook](#4-stack-hosting-storage-auth-and-cost), §4.10) |
| **Code licence** | Apache-2.0 |
| **Uploaded programmes** | CC-BY 4.0 |

## Running it locally

Production takes four hosted accounts; development takes one. The full contract is
[§4.9](#49-local-development-clone-to-running-app); this is the short form.

```bash
pnpm install

# Tier 0 — needs nothing but Node. Parser, calendars, tracer, derive, and the
# golden-file corpus that is the only test data CI will ever have.
pnpm test
node tools/fixture-gen/measure.mjs --verify

# Tier 1 — needs Docker. Every signed-out surface, against ~40 seeded programmes.
cp .env.example .env.local
docker compose up -d --wait          # Postgres + the Neon HTTP proxy + MinIO
pnpm db:migrate
node tools/dev-catalogue/generate.mjs   # writes the dev catalogue; not committed
pnpm db:seed                            # runs the real ingest path, server-side
pnpm dev                                # http://localhost:3000
```

**Tier 2** — upload, fork, votes, bookmarks and `/me` — additionally needs a free Clerk
account with no card. Put `pk_test_…` and `sk_test_…` in `.env.local`. Every signed-out
surface keeps working without them, which is the state a fresh clone starts in.

`docker compose` is a hard prerequisite for tier 1 and **Podman is not supported**. On WSL,
Docker Desktop's *Settings → Resources → WSL Integration* has to be enabled for the distro
you are working in, or `docker` is simply not on the path.

Seeding runs the **product** parser, the **product** derive code and the **product**
persistence code — it skips only the browser parse and the presigned-PUT hop — so it cannot
work before those exist, and a fresh clone shows an empty shelf until it does.

## How this spec was made

It was charted as a [wayfinder map](docs/wayfinder/map.md) — a shared index of investigation
tickets on the repo's own file-based issue tracker, worked one decision at a time until the way to
a buildable spec was clear. The map is the audit trail: every claim in this document links to the
ticket that established it, and every ticket carries the measurement or the argument underneath.

Two things are worth knowing before reading:

**The evidence base is real programmes, not opinion.** The parser rules, the cost model, the DCMA
thresholds and the critical-path algorithm were all settled against a set of real P6 exports —
139 files, 67 distinct, across four P6 export versions — plus a synthetic corpus built to fail a
parser that gets a rule wrong. Those real files are commercially sensitive and are **not in this
repo**; only measurements taken from them are. Where a rule rests on inference rather than
observation, §8 says so and names the sample size either way.

**Two fixtures are named throughout.** *Fixture A* is a progressed monthly update — 41% complete,
negative float everywhere. *Fixture B* is a pristine-looking tender with no WBS breakdown at all.
They fail in opposite directions, which is why a contract validated against either alone would have
been wrong.

## Reading it

Sections are ordered so that each one only depends on those before it.

| | Section | Read it for |
|---|---|---|
| 1 | [What xer-hero is, and the v1 cut](#1-what-xer-hero-is-and-the-v1-cut) | the product, the route list, and what is deliberately not being built |
| 2 | [The domain, the `.xer` format, and the database schema](#2-the-domain-the-xer-format-and-the-database-schema) | the vocabulary, the file format, and the full SQL DDL |
| 3 | [The payload contracts](#3-the-payload-contracts-derivedjson-and-activitiesjson) | `derived.json` and `activities.json` field by field |
| 4 | [Stack, hosting, storage, auth and cost](#4-stack-hosting-storage-auth-and-cost) | what to install, what to buy, and what it costs at scale |
| 5 | [Upload, ingest, and operations](#5-upload-ingest-and-operations) | the pipeline end to end, and how it is operated and observed |
| 6 | [The site](#6-the-site-routes-storefront-programme-page-and-the-signed-in-space) | every page, its contents, and its interactions |
| 7 | [Licensing, personal data, static pages and the crawl surface](#7-licensing-personal-data-static-pages-and-the-crawl-surface) | the legal posture, the privacy position, and SEO |
| 8 | [The compute engine](#8-the-compute-engine-what-the-server-derives-from-a-xer) | the P6 forensics — the hardest section, and the one that cannot be re-derived |
| 9 | [The test corpus, the fixture generator, and CI](#9-the-test-corpus-the-fixture-generator-and-ci) | what already exists in `tools/` and `fixtures/` |
| 10 | [Decisions taken while assembling this spec](#10-decisions-taken-while-assembling-this-spec) | ten gaps closed at integration, all marked overturnable |

**Section 8 is the one to read slowly.** Seventeen tickets of P6 forensics settled rules a builder
must reproduce exactly and could never re-derive from documentation — how `clndr_data` is actually
shaped, where P6 writes a milestone's instant, what its Longest Path flag really spans. Every rule
there is marked *observed* with its sample size, or *engineered* with the authority it stands on.

## Repo layout

```
README.md              this spec
src/
  app/                 the Next.js App Router routes
  components/          site chrome, the shelf row, the programme page's blocks
  lib/
    contracts/         the shared types: derived.json, activities.json, the card, the parser's output
    xer/               the isomorphic .xer parser and the pre-upload scan
    derive/            the compute engine: calendars, the tracer, DCMA, the payload assembly
    db/                the Drizzle schema and the read queries
    blob/              the S3 client, the presign and the object headers
    ingest/            the ingest job and its failure classes
  scripts/             migrate, seed, and the two CI assertions
drizzle/               generated migration SQL
ops/bucket/            the CORS document, applied to MinIO and to R2 alike
docs/
  domain-model.md      the ubiquitous language, maintained as it firms up
  build-backlog.md     work that is real but is not spec — see below
  wayfinder/
    map.md             the decision index: 51 decisions, each linking its ticket
    tickets/           61 tickets, each carrying its question and its resolution
    tickets/assets/    the measurements, prototypes and research notes behind them
tools/
  fixture-gen/         the synthetic corpus generator and its measurement harness
  dev-catalogue/       the ~40-programme dev catalogue generator
  scan-bench/          the client-side scan benchmark
fixtures/
  synthetic/corpus/    the committed test corpus — CI's only test data
  generated/           perf fixtures, regenerable from a seed, never committed
  dev-catalogue/       the dev catalogue, regenerable from a seed, never committed
```

The real `.xer` files are outside the repo and stay there. `.gitignore` enforces it.

## What is not here

[`docs/build-backlog.md`](docs/build-backlog.md) holds the work that is real but is not a
decision this spec was waiting on: provisioning, two questions that need a P6 licence, one that
needs an iPhone, and six corrections to the development corpus. Ten tickets, ruled out of scope in
one act on the day the spec was finished. Exactly one of them — provisioning — gates a launch.

---

---

## 1. What xer-hero is, and the v1 cut

### 1.1 The product in one paragraph

xer-hero is a public shelf of Oracle Primavera P6 project programmes. A planner exports a
programme from P6 as an `.xer` file — a tab-delimited dump of P6's internal tables — signs in
with Google, and uploads it; the site parses it, publishes it at a permanent URL under
CC-BY 4.0, and serves the original bytes for download. Anyone, signed in or not, can browse
the catalogue, filter it, read a programme's computed statistics and quality checks online,
download the file, and take a copy of somebody else's programme as the starting point of their
own (a **fork**, which keeps a visible link to its parent). It is free, run by one person, and
guarantees nothing. There is one hosted instance at `xerhero.com`; the code is Apache-2.0 in a
public repo, and blobs are served from `blobs.xerhero.com`.

Launch stock is **authored sector templates, not real jobs** — zero legal risk, narrower
usefulness, accepted trade. The ~40-programme generated dev catalogue used for local
development and CI is **dev-only and never published**.

_Source: map standing decisions ([`wayfinder/map.md`](docs/wayfinder/map.md) § Destination, § Notes), [Licensing, attribution and takedown](docs/wayfinder/tickets/003-licensing-attribution-takedown.md), [The blob host and the site's domain](docs/wayfinder/tickets/025-blob-host-and-domain.md), [Local development and contributor onboarding](docs/wayfinder/tickets/018-local-dev-and-onboarding.md)_

### 1.2 Who the users are

| Audience | What they do here | Consequences for the build |
| --- | --- | --- |
| **Construction and infrastructure planners** (the whole audience) | Browse, filter, read, download, fork; a minority upload | Terms of art are theirs — programme, activity, WBS, logic, float, data date, longest path, calendar. Use them; do not invent synonyms |
| **The download-only planner** | Signs in, votes, bookmarks, never uploads | The **modal signed-in user**. Every private surface must work for an account with zero uploads |
| **The uploader / Owner** | Publishes a programme, adds revisions to it, forks others' | Only the Owner adds Revisions to their own Programme; everyone else forks |
| **The operator** (one person) | Adjudicates takedowns, watches ingest | Best effort, **no SLA promised**, stated honestly rather than pretending there is a process |

There is no organisation, team, or role model beyond these. No anonymous uploads: every
Programme has someone to credit.

_Source: map standing decisions ([`wayfinder/map.md`](docs/wayfinder/map.md) § Notes), [Licensing, attribution and takedown](docs/wayfinder/tickets/003-licensing-attribution-takedown.md), [Credit, upvotes and the contributor leaderboard](docs/wayfinder/tickets/016-credit-upvotes-leaderboard.md), [The signed-in user's own space](docs/wayfinder/tickets/023-signed-in-users-own-space.md)_

### 1.3 Programme, Revision, Fork, Contributor — the product-level vocabulary

| Term | Definition at product level | Rules the build must honour |
| --- | --- | --- |
| **Programme** | One P6 schedule as published — the thing with a URL (`/p/{slug}`), a title, a description, an optional sector, an Owner and a place in the fork tree. **Identity, not content.** | `slug` is unique and **immutable**, so links never rot. Title, description and sector are owner-editable in place; a sector correction is never a new Revision |
| **Revision** | One **immutable** published state of a Programme, created by a single upload: the `.xer` bytes, the computed statistics, and the rights assertion made at upload. Numbered from 1. | Owner-only. URL `/p/{slug}/r/{n}`. Content never changes after publication; corrections are new Revisions |
| **Current Revision** | The newest non-tombstoned Revision. What the shelf row renders and what `/p/{slug}` shows. | A Programme with no published Revision is invisible everywhere public |
| **Fork** | A **new Programme** created from another Programme's Revision, keeping a visible link to it. Made by **uploading a file**, never by a server-side copy — planners edit in P6, not on the site. | Metadata (title, description, sector) prefills from the parent as **defaults that may diverge**; a `change_note` is **required** on a fork's first Revision, which is what satisfies CC-BY's "indicate changes". Votes reset — a fork is a new Programme. Strict tree, **no merge** |
| **Root** | The Programme at the top of a fork tree. Every Programme names its Root. | "The other variants of this job" is one query |
| **Contributor** | An account with a public **Handle** — a pseudonym, unique site-wide, never reassigned once published. Google sign-in is authentication, never public identity. | The Google name, email and profile picture are **never shown anywhere**; the site stores no email at all. A published Handle survives account deletion |
| **Uploader display name** | The Handle **frozen onto each Revision at upload**, deliberately duplicated rather than joined. | Renaming an account never rewrites past credit; deleting one never blanks it |
| **Tombstone** | A Revision whose bytes are destroyed but whose row survives, so the fork tree has no holes. | Bytes hard-delete; **rows never do**. Granularity is the Revision, not the Programme |

Terminology to avoid, because it means something else to a planner: *project* (a P6 `PROJECT`
row), *version* (reserved for the `derived.json` contract version and the P6 export version),
*series*, *category*, *tag*, *username*.

_Source: [Domain model and schema](docs/wayfinder/tickets/005-domain-model-and-schema.md), [Licensing, attribution and takedown](docs/wayfinder/tickets/003-licensing-attribution-takedown.md), [Where does a programme's sector come from?](docs/wayfinder/tickets/015-sector-classification.md), [Upload and ingest pipeline](docs/wayfinder/tickets/011-upload-ingest-pipeline.md), [The signed-in user's own space](docs/wayfinder/tickets/023-signed-in-users-own-space.md), glossary at [`domain-model.md`](domain-model.md)_

### 1.4 Upload is publish, and public by default

**There is no draft state, no private tier, no organisations and no per-row access control.**
Choosing the file and completing the metadata screen *is* publication. The only interval
between upload and publication is asynchronous ingest, during which `/p/{slug}` **404s to
everyone including the owner** (a cached public route cannot serve a 404 to one viewer and a
page to another); the owner watches that upload at `/me` instead. Blobs are public, unsigned
and CDN-cacheable, fetched directly by the browser with no app-server proxy and no auth.

The licence is fixed site-wide with **no per-upload choice**, so the fork button never reasons
about compatibility:

| What | Licence |
| --- | --- |
| Uploaded programmes | **CC-BY 4.0**, granted **irrevocably** |
| The code | **Apache-2.0** |

One checkbox per upload (not per account), three claims in one label — I hold the rights; it
contains no confidential third-party information; I licence it under CC-BY 4.0 irrevocably,
and the file may name people and is published exactly as uploaded with nothing stripped. The
row snapshots `terms_version` and `asserted_at`, never a boolean.

**Three amendments to public-by-default, all of them about one object.** `original.xer.gz` is
the only artefact in the estate carrying personal data — the Postgres row, `derived.json`,
`activities.json` and the server-rendered page were all cut free of it for payload reasons — so
the posture is one rule about one URL rather than three exceptions:

| Amendment | Rule | Why |
| --- | --- | --- |
| **Public ≠ indexable** (013) | `original.xer.gz` is served with `X-Robots-Tag: noindex, noarchive` set at PUT, the blob host's `robots.txt` says `Disallow: /`, and the download link carries `rel="nofollow"` | A `.xer` is plain text a crawler will happily index; this closes the gap between "a planner who downloaded a programme sees a name" and "a labourer's name is their own top search hit". Stated as mitigation against well-behaved crawlers, **never as protection** |
| **Public must also mean un-publishable** (017) | `original.xer.gz` drops from a year-long immutable cache to a **1-hour TTL**, and every takedown ends in a **verified CDN purge** (a plain GET of the purged URL must return non-200 before `bytes_deleted_at` is written) | Deleting the R2 object under `max-age=31536000, immutable` left the file downloadable for up to a year, so "bytes hard-delete" was not true as written |
| **Class B bytes are quarantined 30 days** (017) | Only `original.xer.gz` is held; everything else is rebuildable | Anyone can report with no account, so an unauthenticated stranger can trigger the destruction of a stranger's work. After 30 days a mistaken Class B is genuinely unrecoverable, stated plainly |

Private things exist, and are not exceptions to publishing because they are never about a
published artefact: **bookmarks are private throughout**, **votes are public in aggregate and
private in attribution**, and `/me/*` and `/ops` sit behind Clerk middleware. On the site's own
pages, a tombstone is `noindex, follow` in both removal classes and leaves the sitemap, and a
superseded revision page is `noindex, follow`.

**No warranty, opt-in, at the user's own risk.** The terms carry a *service-level* as-is
disclaimer, not only Apache-2.0's source-level one — no warranty of accuracy, availability,
fitness, or that any file is safe to rely on. Nothing on the site is ever worded as a
guarantee: the pre-publish panel warns and does not certify, DCMA is computed and not endorsed,
`noindex` is mitigation and not protection. The test the copy is held to is **could this
sentence become false without anyone changing the code?** — if yes it is a promise and it is
banned. This does **not** waive statutory duties: an erasure request still gets a Class B
takedown.

_Source: [Licensing, attribution and takedown](docs/wayfinder/tickets/003-licensing-attribution-takedown.md), [Personal data in published .xer files](docs/wayfinder/tickets/013-personal-data-in-published-files.md), [What tooling does the operator need to run a takedown?](docs/wayfinder/tickets/017-operator-takedown-tooling.md), [The site's static pages](docs/wayfinder/tickets/030-static-pages.md), [The site's own crawl surface](docs/wayfinder/tickets/033-site-crawl-surface.md), [How is a public page with per-viewer state cached?](docs/wayfinder/tickets/035-caching-per-viewer-state.md)_

### 1.5 The v1 feature list

Every route in v1, and nothing else is a route. Public routes are readable signed-out and are
byte-identical for every viewer; **no public route reads the session on the server** — the
Clerk middleware matcher covers only `/me`, `/ops`, `/api` and `/__clerk`, so `auth()`
structurally cannot work on a public page, and everything viewer-dependent arrives in the
browser from a single `GET /api/viewer` request.

| Route | Who | What it is |
| --- | --- | --- |
| `/` | public | **The shelf, and the homepage.** A row list (not cards), one row per published Programme at its current revision, twelve facts per row in fixed slots, ordered `programme.created_at desc, programme.id desc` — **frozen, never vote-weighted**. Top filter bar (never a left rail), sort control, result count, active-filter chips, numbered pages at **25**. A ~95-word three-paragraph lede renders at the **bare URL only**, never on a filtered variant |
| `/?sector=…&size=…&p6=…&progressed=1&q=…&sort=…&page=N` | public | The same shelf. Four facets — **sector**, **size band** (`s` <500, `m` 500–2,000, `l` 2,000–5,000, `xl` >5,000 activities), **P6 version** (a *can I use this* filter), **progressed** (`pct_complete > 0`); OR within a facet, AND across facets. Live conjunctive facet counts, zero-count chips **disabled not hidden**. Sorts: **Newest** (default) · **Most upvoted** · **Largest** · **DCMA checks passed** (on the ratio `checks_passed / checks_applicable`, tiebreak `checks_applicable desc`, labelled literally). Search is Postgres FTS over **title + description only**, with a `pg_trgm` fallback when full-text returns zero rows; relevance takes over while `q` is set. Canonicalised: omit defaults, fixed param order, lowercase, comma lists sorted |
| `/p/{slug}` | public | **The programme page**: one scrolling document at the current revision. Everything above the activity table is server-rendered from `derived.json` — headline numbers, the window S-curve, float band bar and exact table, computed longest path with provenance, the DCMA scorecard (each row carrying mark, word, value and threshold), the WBS summary, breadcrumb `shelf / {sector} / {title}` (collapsing to `shelf / {title}` when unsectored), rendered full-ancestry attribution and a **"Cite this programme"** block. The activity table is a client-side fetch of `activities.json` (~340 KB gzipped at the 20,000-activity cap), sortable and filterable in memory with no further requests. Action cluster: **upvote · bookmark · Fork · Download**. A `Compare…` control exists and is **deliberately inert** in v1 |
| `/p/{slug}/r/{n}` | public | A specific Revision's page, same document. At the current revision it canonicalises to `/p/{slug}`; a superseded revision self-canonicalises and takes `noindex, follow` |
| `/u/{handle}` | public | **Contributor page**: the Handle, its uploader-vote pill and count, the leaderboard rank line, a programme count, a joined date, a live fork-count fact, and the contributor's published Programmes as shelf rows. **No badges of any kind.** One owner-conditional element: a link to `/me` carrying no data |
| `/contributors` | public | **The leaderboard**, footer-linked, one page, no query params in v1 |
| `/about` | public | Long-form description of the site. Its longest section is *"What this site does not do"* |
| `/terms`, `/privacy` | public | Current legal texts, rendered from versioned markdown in `docs/legal/` at build time |
| `/terms/v{n}`, `/privacy/v{n}` | public | Every superseded version, permanently addressable, `noindex`. One version number names **both** files; a bump ships both even when one is byte-identical; **a shipped file is never edited, not even for a typo** |
| `/report` | public, no account | Takedown / complaint intake. Writes a `takedown_report` row (the system of record), Cloudflare Turnstile spam control, rate-limited. The operator's published mailbox is printed **on this page only**, never in the footer |
| `/robots.txt`, `/sitemap.xml` | public | Generated routes. `robots.txt` allows everything except the facet params (`sector`, `size`, `p6`, `progressed`, `q`, `sort` — `page` is deliberately allowed) and the authenticated surfaces; one `User-agent: *` group, **no AI-crawler block**. The sitemap is an ISR route listing `/`, every published `/p/{slug}`, every listable `/u/{handle}` and the six static routes |
| Upload flow | signed in | Reached from the header `Upload` control (new Programme), from your own programme page (new Revision), or from another programme's page (Fork). See below |
| `/me` | signed in, owner-only | Index of your uploads, **one line each** (title, state chip, clause, rev, sector, age) — not a shelf row. Renders `pending`, `failed` with its `failure_reason` inline, tombstoned (017's copy verbatim) and published |
| `/me/bookmarks` | signed in | Your bookmarks as shelf rows, ordered `bookmark.created_at desc`. Un-bookmarking greys the row in place until reload |
| `/me/votes` | signed in | Programmes you upvoted as shelf rows, then a flat list of Handles you upvoted |
| `/me/account` | signed in | Rename the Handle, sign out, delete the account (typed confirmation, the facts nobody expects, and a pointer to withdrawing your programmes first) |
| `/ops` | operator | Read-only ingest and takedown dashboard, gated by an env-var Clerk-id allowlist |

Capabilities that are not routes:

- **Site chrome.** The header is a wordmark plus a permanent one-line strap — *"Public
  Primavera P6 programmes. Browse, download, fork."* — and the signed-in cluster; it does not
  grow. Below every page, including `/me/*`, sits one site-wide footer: **About · Terms ·
  Privacy · Contributors · Report a problem · Source**, then *"Programmes are published by
  their uploaders under CC-BY 4.0. This site's code is Apache-2.0. Run by one person, best
  effort, with no warranty — see the terms."* It is static and viewer-independent. No `mailto:`
  in the footer, no licence badge image, no catalogue count, no cookie link — there is nothing
  to consent to.
- **Upload and ingest.** The file is **scanned in the browser before a byte is uploaded** —
  hash, scan and gzip in one pass — so every rejection costs a file-picker click rather than a
  60 MB upload. Caps are **20,000 activities / 60 MB**, rejected rather than degraded.
  Multi-project exports are rejected (discriminator: distinct `TASK.proj_id`). A content-hash
  match cannot become a new root — it is offered as a fork instead. Whether an upload is a new
  Programme, a new Revision or a Fork is **declared by route and never detected** (a matching
  P6 project id produces an advisory *"add it there as rev N instead?"* hint, never a reroute).
  The metadata screen prefills from the scan and carries 013's PI panel above 003's checkbox.
  Bytes go **browser → R2 by presigned PUT**, gzipped client-side; ingest is asynchronous from
  day one; publish sets `current_revision_id` and revalidates the slug. **Nothing the client
  computes is persisted** — every server check recomputes what the user was already shown.
- **The pre-publish personal-data panel.** Enumerates **values, not counts** for the closed
  fields (exporter, `create_user`/`update_user` as one line with a count, `PROJECT.add_by_name`,
  every `rsrc_name` with its type, resource and activity notes), reports free text as a count
  plus its labels marked *not reviewed*, lists capped at 500 values. **Advisory: it blocks
  nothing, and there is no server-side PI detector anywhere in the ingest path.**
- **Takedown.** **Class A** — voluntary withdrawal, self-service from the owner's own programme
  page at both granularities, tombstones and leaves forks intact. **Class B** — rights,
  confidentiality or personal-data complaint, adjudicated by the operator, **cascades down the
  fork subtree**. Order is always **rows → bytes → verified purge**. Executed from a repo CLI on
  the operator's laptop with a plan/apply split (`apply` re-derives and refuses on any diff), not
  from a URL.
- **Operating.** A GitHub Actions schedule runs a **15-minute sweep** that reaps abandoned
  intents and `failed` rows, reconciles takedowns, evaluates the alarm rules and exits non-zero
  to mail the operator. Observability is Postgres rows, not log lines.
- **Failure surfacing.** A `failed` upload keeps its row for **24 hours** with a
  `failure_reason` the uploader can read at `/me`; operator-only `failure_detail` renders at
  `/ops` and nowhere else.

_Source: [Browse, search, filter and ranking](docs/wayfinder/tickets/009-browse-search-ranking.md), [The storefront card and browse grid](docs/wayfinder/tickets/007-storefront-card-and-grid.md), [The project detail page](docs/wayfinder/tickets/008-project-detail-page.md), [Upload and ingest pipeline](docs/wayfinder/tickets/011-upload-ingest-pipeline.md), [The client-side parse budget](docs/wayfinder/tickets/020-client-parse-budget.md), [Personal data in published .xer files](docs/wayfinder/tickets/013-personal-data-in-published-files.md), [What tooling does the operator need to run a takedown?](docs/wayfinder/tickets/017-operator-takedown-tooling.md), [Operating and observing ingest](docs/wayfinder/tickets/019-ingest-observability.md), [The signed-in user's own space](docs/wayfinder/tickets/023-signed-in-users-own-space.md), [The site's static pages](docs/wayfinder/tickets/030-static-pages.md), [The site's own crawl surface](docs/wayfinder/tickets/033-site-crawl-surface.md), [How is a public page with per-viewer state cached?](docs/wayfinder/tickets/035-caching-per-viewer-state.md)_

> **GAP:** The upload flow has no fixed URL. `011` fixes three entry points ("shelf upload
> button", "your own programme page", "another programme's page") and `023` closed the URL set
> without one; `/upload` appears once, in passing, in 030's asset. The route(s) for new
> Programme / new Revision / Fork, and how the parent id is carried, are unspecified — and so is
> their auth gate, since 035's Clerk middleware matcher covers `/me`, `/ops`, `/api` and
> `/__clerk` and no upload path.

### 1.6 The sector taxonomy

**Declared by the uploader, single-valued, one axis — asset class (what is being built or
maintained). Nothing is inferred, in v1 not even as a prefill.** The control is a dropdown over
the `sector` lookup table on the metadata screen, and it needs no server round trip.

| `code` | `label` | `sort_order` |
| --- | --- | --- |
| `rail` | Rail | 10 |
| `highways` | Highways & roads | 20 |
| `aviation` | Aviation | 30 |
| `marine` | Marine & ports | 40 |
| `building` | Buildings | 50 |
| `water` | Water & wastewater | 60 |
| `power` | Power & energy | 70 |
| `process` | Oil, gas & process | 80 |

Ordered transport → vertical → utilities → process, **not alphabetically**, so the chip row
reads as related things sitting together.

Rules:

- **Work-type and method words are not sectors** — tunnelling, fitout, shutdown, turnaround,
  design phase, framework, look-ahead. They go in the title and description, where FTS finds
  them. A tunnel is rail, or highway, or water.
- **Lean, grown by insert.** Adding a code is a seeded row applied by migration from a
  versioned file in the repo (a PR and a deploy, never a hand-written `INSERT` on production);
  merging or renaming after programmes are filed under a code is the expensive move.
  Deliberately not shipped and reachable the day a real upload needs one: `industrial`,
  `telecoms`/`data-centre`, `nuclear`, `mining`, `defence`.
- **Optional at upload**, and blank is the guaranteed state of every upload by someone who did
  not care — plausibly the largest bucket at launch.
- **Absent renders as `unsectored`** in the row's fixed slot, and the detail-page breadcrumb
  drops the sector segment rather than printing a placeholder. There is **no `unsectored` code,
  no ninth chip and no `sector=none`** — blank programmes are fully reachable in the default
  shelf and in search, and absent only when a sector filter is applied.
- **Mutable in place by the owner**, like the title; sector lives on Programme (identity), so a
  correction is never a new Revision. No audit table. A fork may legitimately carry a different
  sector from its parent.
- **No launch-stock quota.** The list is designed for the eventual corpus, not for launch-day
  symmetry; an uncovered code greys out and reads as *nothing here yet*, which is true.

_Source: [Where does a programme's sector come from?](docs/wayfinder/tickets/015-sector-classification.md)_

### 1.7 Credit: upvotes, bookmarks and the leaderboard

**Two votable objects, two counters, two boards — and therefore no standing formula.** Nothing
is summed, weighted, blended or tuned; a raw count reports, a weighted score endorses.

| Object | Votable? | Counter | Where it is cast | What it ranks |
| --- | --- | --- | --- | --- |
| **Programme** | yes | `programme.vote_count`, denormalised, maintained on write | The shelf row's upvote pill and the detail page's action cluster | Programmes, under the **opt-in** `sort=votes` only |
| **Uploader (Handle)** | yes | a per-account counter, denormalised | **Only** from that contributor's page at `/u/{handle}` — never from a row, never from the detail page | Contributors, on `/contributors` |
| **Revision** | **no** | — | — | — |

- **Signed-in only. One vote per user per target, toggleable.** Signed-out renders the pill
  unpressed and routes a click to sign-in.
- **Self-votes are permitted** — one vote, once, a constant offset that reorders nothing.
- **The leaderboard is `order by uploader vote count desc`, tiebroken by published Programme
  count then Handle**, so it is deterministic. **No blend and no second sort key.**
- **Eligibility gate:** a contributor whose published, non-tombstoned Programme count reaches
  **zero** is delisted (votes retained, simply not ranked) and relisted on publishing again.
  Partial takedown deliberately does nothing — 1-of-5 tombstoned changes no rank. This is what
  makes takedown reach the board, and it also drives `/u/{handle}`'s `noindex` and its exclusion
  from the sitemap.
- **Votes never feed the default shelf order**, which is frozen at newest-first.
- **Bookmarks are a separate object and private throughout** — no count, no public rendering,
  no ranking input, no gaming surface. Control in a fixed slot beside the upvote pill on the
  row and in the detail page's action cluster.
- **Anti-gaming is manual, by design.** No rate limits, no minimum account age, no vote decay,
  no earned franchise. The operator voids votes on complaint (the machinery already exists,
  because Class B voids a Programme's votes anyway). The structural defence is keeping the prize
  small: the board is **footer-linked**, never a shelf rail or a nav item. Stated plainly:
  someone with 20 Gmail accounts can top the board on day one. The named cheapest escalation, if
  it ever becomes intolerable, is a rolling window (`where voted_at > now() - 90d`), no new UI.
- **No badges, quality marks or "verified"/"trusted" labels** anywhere, on a programme or a
  contributor. The board may rank and may never endorse.
- Nothing here enters `derived.json`, `activities.json` or `card`, so credit **never incurs a
  backfill** and cannot be invalidated by a recompute.

_Source: [Credit, upvotes and the contributor leaderboard](docs/wayfinder/tickets/016-credit-upvotes-leaderboard.md), [Browse, search, filter and ranking](docs/wayfinder/tickets/009-browse-search-ranking.md), [The site's own crawl surface](docs/wayfinder/tickets/033-site-crawl-surface.md)_

### 1.8 What a signed-in user gets

Sign-in is **Google only, through Clerk**. The site never sees the Google identity: no email
column, no `google_sub`, one `clerk_user_id`. **Nothing in this site renders `user.imageUrl`** —
Clerk's `<UserButton>` is refused because it would reintroduce the Google profile image, and
`<SignedIn>`/`<SignedOut>` plus a plain link is the whole implementation.

| On sign-in | Detail |
| --- | --- |
| **An `app_user` row** | Created on the **first authenticated write of any kind** — vote, bookmark or presign — with a **generated Handle** (shape `planner-a3f92c`). Reads create nothing. The generated Handle is invisible until publication, and is **confirmed** on the metadata screen at first upload, prefilled and required like the title |
| **Header cluster** | `Upload · {Handle}`, the Handle linking to `/me`; signed out it is `Sign in`. Sign-out lives on `/me/account`, not behind a popover |
| **Header notice line** | One undismissable line, signed-in only, for exactly as long as the condition holds: a Class B tombstone for **30 days** (017's quarantine — the window in which the bytes can still be restored) and a `failed` upload for **24 hours** (011's reap). No storage, no table, no column, no acknowledgement |
| **Upload, revise, fork** | New Programme from the header; new Revision only from your own programme page; fork from anyone's |
| **Edit your own Programme metadata** | Title, description and sector, in place. The slug never changes |
| **Withdraw your own work** | Class A, self-service from your own programme page, at Programme or Revision granularity, behind a typed-confirmation guard rail |
| **Vote and bookmark** | Programme upvote and bookmark on every row and every detail page; uploader upvote only on `/u/{handle}` |
| **Four private pages** | `/me`, `/me/bookmarks`, `/me/votes`, `/me/account` — server-rendered, one tab strip of four links, `?page=N` at 25, no client state |
| **Account deletion** | Self-service at `/me/account`. Order: our rows in one batch first (reserve the Handle, delete `app_user`; bookmarks cascade, votes null their voter and keep the row), **then** Clerk. Uploads stay published under the snapshotted pseudonym; the Handle is never reassigned |

Two rules that shape all of it:

1. **`/me` writes nothing about a Programme.** Every Programme-scoped write stays on that
   Programme's page — no bulk actions, no withdraw control, no delete in a list of your own
   work. The bookmark toggle is the apparent exception and is not one: it is a write about you.
2. **The public surface never learns who is looking on the server.** Pressed states, the
   header cluster, the notice line, the owner's edit affordance and the Class A button all
   arrive from one `GET /api/viewer` response and fill controls that already exist in the cached
   HTML. Between paint and that response, a signed-in viewer's own votes and bookmarks read as
   unset — a wrong picture, briefly, rather than a moving one; a client dirty set stops a
   mid-flight click being reverted by a snapshot taken before it.

Honest cost, stated rather than discovered: **the site cannot mail anyone.** A person who does
not sign in for 31 days never learns from the site that their fork was destroyed.

_Source: [The signed-in user's own space](docs/wayfinder/tickets/023-signed-in-users-own-space.md), [Stack, hosting and auth provider](docs/wayfinder/tickets/010-stack-hosting-auth.md), [Google OAuth in production](docs/wayfinder/tickets/027-google-oauth-in-production.md), [How is a public page with per-viewer state cached?](docs/wayfinder/tickets/035-caching-per-viewer-state.md), [Does a late-arriving pressed state read as a bug?](docs/wayfinder/tickets/037-late-pressed-state.md), [Licensing, attribution and takedown](docs/wayfinder/tickets/003-licensing-attribution-takedown.md)_

### 1.9 Not in v1

#### (a) Deferred but intended — the schema and the contracts must not preclude these

| Not in v1 | One-line reason |
| --- | --- |
| **Revision diff / schedule comparison** | Probably the feature planners care most about, and versions exist to make it possible; the contracts already support it (two `derived.json` whose fixed buckets subtract, two `activities.json` keyed on `task_code`, including the per-activity driving-path boolean). What a diff *shows* is undesigned, and two `activities.json` fetches is 680 KB — fine for a button, not for a default. `Compare…` ships inert |
| **The resource-units S-curve** | It would compute (86% of Fixture B activities are resource-loaded), but the page has exactly one time series and a second in different units is the dual-axis mistake — and nobody has defined what a resource unit *means* across programmes measuring different things |
| **A time-scaled Gantt viewer** | Standing decision: the project page is charts and tables. Priced rather than hand-waved — the Gantt needs the v1 cut plus exactly one more table, `TASKPRED`, at **+181 KB gzipped**, so the contract is Gantt-compatible and one named block short |
| **Near-duplicate programme detection** | Exact content-hash blocks byte-identical re-uploads; the same programme re-exported from P6 has different bytes and slips through. Needs a similarity model nobody has specified. Now a shelf-tidiness and takedown-evasion question only — bulk uploads move no ranking |
| **Curation** — featured programmes, thematic collections | No featured strip, no `curation_rank`, no editorial ordering: a rank column invites hand-ordering the whole catalogue, and every curated surface needs signals that do not exist at launch. Only the claims-nothing half (one person's picks, presented plainly) survives as fog |
| **A public read API for programme metadata** | A scope question about what the site offers; nobody has decided it |
| **Analytics and traffic measurement** | Decided **none** in v1 — no GA, no Vercel Web Analytics, no Plausible, no pixel, no beacon — which is what buys no cookie banner and no consent management. Adding any reopens the cookie question and costs a new version of **both** legal documents |
| **Cross-project querying** ("every programme with >30d float on concrete") **and activity-name search** | Priced and refused for now: full relational ingest is ~1.9 billion rows and ~190 GB at 10,000 programmes × 3 revisions, about **$66/month in Neon storage alone**, against the hybrid model's ~150 MB and $0. Buys in or out as one thing |
| **Sector inference** from activity codes and WBS names | Rejected for want of an evaluation corpus, **not** for cost — real fixtures are gitignored forever, and half the available evidence (Fixture B, `PROJWBS = 1`) has no text to mine. The plumbing already exists; what is missing is programmes to validate against |
| **Tags** as a second classification axis | Sector is the only classification axis in v1; a second before the first has evidence is building on fog, and free tags need normalisation from day one. Purely retrofittable (`tags text[]` + GIN) |
| **Search over WBS node names** | Needs a denormalised column fed by ingest and backfilled on every contract bump, and it is empty for exactly the tender-shaped programmes that are launch stock |
| **`/sector/{code}` landing pages** | Deferred **with a trigger**: four of the eight sector codes each holding ≥ 25 published Programmes (~100 programmes). It adds zero URLs to the crawl graph — it is a ranking target, not a crawl path — and zero v1 build cost |
| **How authored sector templates get made** | Generation is demonstrated (the dev catalogue is the launch catalogue's exact shape and size, for free) but dev-only; whether a *generated* programme may be presented as launch stock at all is a disclosure question nobody has answered. There is **no quota of one template per sector code** |

#### (b) Permanently ruled out — never graduates

| Ruled out | One-line reason |
| --- | --- |
| **Private programmes, organisations, per-row access control** | Ruled out by public-by-default: upload is publish |
| **Self-hosting and a portable stack** | One hosted instance, so no portability tax — no vendor-neutral abstraction layers and no self-hosting promise |
| **Billing, paid tiers, monetisation** | Free; nothing in v1 depends on a payment path |
| **Sanitising real commercial programmes on ingest** | Launch stock is authored templates, so no scrubber is needed and its considerable risk is avoided |
| **Verified badges, quality marks, any "reviewed"/"checked" state** — on programmes or contributors | The maintainer guarantees nothing, and a badge is a guarantee wearing a different word. Distinct from raw counts and computed scores (upvotes, DCMA), which report rather than endorse and stay in scope |
| **Screening uploads for personal data**, by blocking detector or by stripping | Measured across 143 real files: the detectable fields are empty in every one and the populated ones are undetectable, so a screen would fire on nothing while creating a promise the site cannot keep. Disclosure replaces it |
| **Sourcing a corpus of real public `.xer` files** (tender packs, teaching sets) | Superseded by authored templates. Distinct from getting a handful of real files as parser *fixtures*, which is in scope and necessary |
| **Notifications, an inbox, read state, any feed** | The site cannot mail anyone, and both things it could ever need to tell an owner already have a reaper attached, so a notice is a predicate over rows that delete themselves. (The one-line header notice is in scope and costs no storage) |
| **External synthetic monitoring and uptime services** | Refused twice: every production-only behaviour is reachable from instruments already in the estate — CI, the sweep, the operator's CLI — for $0 and no fifth vendor |
| **A marketing surface** — hero pages, feature tours, testimonials, customer logos, a blog, a changelog, a roadmap, a `/status` page, a newsletter, social accounts | The shelf is the homepage and the no-warranty rule bans the register most of these are written in. The site's whole self-description is one lede, one `/about` and a six-link footer |
| **Generated Open Graph images**, and any image rendered from row data | An unauthenticated, enumerable, rasterising endpoint fetched by every link unfurler is the first thing in this effort that could genuinely move the Active CPU trigger, and it would be a new image surface against *nothing renders `user.imageUrl`*. One committed static wordmark card is in scope; the ban is a CI grep for `next/og` and `ImageResponse` |
| **A CPM scheduling engine** (forward pass, backward pass, calendar arithmetic) | We compute, but we do not schedule: the driving chain is *traced* over the dates P6 already wrote, testing ordering rather than equality, so no scheduler is needed and `driving_path_flag` stays worth more as a permanent oracle than as an output |

_Source: map § Not yet specified and § Out of scope ([`wayfinder/map.md`](docs/wayfinder/map.md)), [The project detail page](docs/wayfinder/tickets/008-project-detail-page.md), [The derived.json contract](docs/wayfinder/tickets/006-derived-json-contract.md), [Personal data in published .xer files](docs/wayfinder/tickets/013-personal-data-in-published-files.md), [Where does a programme's sector come from?](docs/wayfinder/tickets/015-sector-classification.md), [Credit, upvotes and the contributor leaderboard](docs/wayfinder/tickets/016-credit-upvotes-leaderboard.md), [Browse, search, filter and ranking](docs/wayfinder/tickets/009-browse-search-ranking.md), [The site's static pages](docs/wayfinder/tickets/030-static-pages.md), [The site's own crawl surface](docs/wayfinder/tickets/033-site-crawl-surface.md), [Do sector landing pages exist, now that ?sector= is uncrawlable?](docs/wayfinder/tickets/034-sector-landing-pages.md), [Do we compute the critical path ourselves?](docs/wayfinder/tickets/014-compute-critical-path.md), [What does storage actually cost?](docs/wayfinder/tickets/004-storage-cost-model.md)_

---

## 2. The domain, the .xer format, and the database schema

Everything in this section is fixed by evidence from real Oracle Primavera P6 exports and by
closed decisions. Field names, table names, types and thresholds below are the ones to build
against; where a needed decision does not exist it is marked `GAP` rather than filled in.

### 2.1 The vocabulary

These are the users' words — construction and infrastructure planners. Use them; do not coin
synonyms. The schema names follow directly from them.

| Term | Definition | Where it lives |
|---|---|---|
| **Programme** | One P6 schedule as published on the site — the thing with a URL, a title, an Owner and a place in the fork tree. **Identity, not content.** | `programme` row |
| **Revision** | One immutable published state of a Programme, created by a single upload. Holds the `.xer` bytes, the computed statistics and the rights assertion. A Programme is a series of Revisions numbered from 1. | `revision` row |
| **Current Revision** | The newest Revision of a Programme that has not been Tombstoned. What the browse grid renders and what the Programme's page shows by default. | `programme.current_revision_id` |
| **Fork** | A Programme created from another Programme's **Revision**, keeping a visible link to it. A Revision continues the same Programme; a Fork starts a new one. Created by uploading a file, never by a server-side copy. | `programme.parent_revision_id` (+ denormalised `parent_programme_id`) |
| **Root** | The Programme at the top of a fork tree — never forked from anything. Every Programme names its Root, so "the other variants of this job" is one indexed equality. | `programme.root_programme_id` (self on roots) |
| **Change note** | The uploader's sentence describing what a Revision changed. Required on a Fork's first Revision (CC-BY's "indicate changes"), optional afterwards. | `revision.change_note` |
| **Sector** | The **asset class** — what is being built or maintained. One per Programme, **declared by the uploader**, never inferred, from a fixed list of eight. Optional; a Programme without one renders as *unsectored*, which is a rendering and not a sector. Owner-editable in place; never a Revision. | `programme.sector` → `sector.code` |
| **Owner** | The account a Programme belongs to. Only the Owner adds Revisions; everyone else Forks. No ownership transfer in v1. | `programme.owner_user_id` |
| **Handle** | A contributor's public pseudonym, unique across the site case-insensitively. Google sign-in is the authentication mechanism, never the public identity. A published Handle is never reassigned, even after the account is deleted. | `app_user.display_name`, `reserved_handle` |
| **Uploader display name** | The Handle as it stood when a Revision was uploaded, frozen onto that Revision. Deliberately duplicated rather than joined, so renaming never rewrites past credit and deletion never blanks it. | `revision.uploader_display_name` |
| **Upvote** | A signed-in visitor's endorsement of a **Programme** — one per person, toggleable, self-votes permitted. Public in aggregate, private in attribution. | `programme_vote`, `programme.vote_count` |
| **Uploader vote** | The same act aimed at a **Handle**. A wholly separate counter, castable only from that contributor's page. The one and only input to the Leaderboard. | `uploader_vote` |
| **Bookmark** | A private mark on a Programme, visible only to its maker. No count, never rendered to anyone else, no bearing on any ranking. | `bookmark` |
| **Tombstone** | A Revision whose bytes have been deleted but whose row survives, so the fork tree has no holes. **Class A** = uploader withdrawal, Forks untouched. **Class B** = rights/confidentiality/personal-data complaint, cascades down the Fork subtree. | `revision.status`, `revision.removal_class` |

Avoid, because each already means something else: *project* (a P6 `PROJECT` row), *version*
(the `derived.json` contract version and the P6 version), *tag*, *category*, *username*,
*delete*.

The eight sector codes are seed rows, not an enum — adding one is an insert, not a migration:

| `code` | `label` | `sort_order` |
|---|---|---|
| `rail` | Rail | 10 |
| `highways` | Highways & roads | 20 |
| `aviation` | Aviation | 30 |
| `marine` | Marine & ports | 40 |
| `building` | Buildings | 50 |
| `water` | Water & wastewater | 60 |
| `power` | Power & energy | 70 |
| `process` | Oil, gas & process | 80 |

_Source: [Domain model and schema](docs/wayfinder/tickets/005-domain-model-and-schema.md) · [Where does a programme's sector come from?](docs/wayfinder/tickets/015-sector-classification.md) · [Credit, upvotes and the contributor leaderboard](docs/wayfinder/tickets/016-credit-upvotes-leaderboard.md) · [Licensing, attribution and takedown](docs/wayfinder/tickets/003-licensing-attribution-takedown.md)_

### 2.2 Terms inherited from P6, and the exact fields they resolve to

Defined by Oracle, not by this project. Each one has exactly one source field; the traps are
named because two of them have been mis-read in this repo already.

| Term | Field | Rule |
|---|---|---|
| **Activity** | a `TASK` row | `task_code` is the Activity ID a planner quotes; `task_id` is P6's internal key |
| **WBS** | `PROJWBS`, tree via `parent_wbs_id`, root marked `proj_node_flag` | **Not guaranteed to exist**: a real tender programme carries a single node over 3,344 activities, so depth 1 is a correct answer, not an error |
| **Logic** | `TASKPRED` rows: `pred_task_id` → `task_id`, `pred_type`, `lag_hr_cnt` | `pred_proj_id != proj_id` marks an **external relationship**; the referenced activity may be absent from the file. Legitimate, not corruption |
| **Total float** | `TASK.total_float_hr_cnt` | Integer **hours**, may be negative (−800 observed), may be **empty** — empty float is not zero float, and completed activities carry empty |
| **Free float** | `TASK.free_float_hr_cnt` | Same units and same null rule |
| **Data date** | `PROJECT.last_recalc_date` | **Not** `scd_end_date`, **not** `sum_data_date`; both were mis-read during fixture profiling. Everything before it is actual, everything after is planned |
| **Longest path** | `TASK.driving_path_flag` (`Y` / empty) | **Not** the same as critical. Only populated when the scheduler was last run with that option on — the corpus carries a fixture (`logic-no-longest-path`) for the common case where it is empty on every row |
| **Critical** | derived from `total_float_hr_cnt` against `PROJECT.critical_drtn_hr_cnt` / `critical_path_type` | Conflating this with Longest Path is the classic P6 reporting error. Across 67 distinct real files `critical_path_type` is `FT_FF` on 67 of 67 — critical defined by total float, never by Longest Path |
| **Calendar** | `CALENDAR.clndr_data`, referenced by `TASK.clndr_id` and `PROJECT.clndr_id` | The shift pattern inside the blob is the only trustworthy statement of working time — see §2.6 |
| **Baseline** | baseline tables absent from every real fixture; `PROJECT.sum_base_proj_id` names one | Whether a Revision is a baseline decides which other statistics can exist at all |
| **Milestone** | `task_type` = `TT_Mile` (start) / `TT_FinMile` (finish) | Ordinary activities are `TT_Task`; `TT_LOE`, `TT_WBS`, `TT_Rsrc` exist in the format and are absent from the real set |
| **Activity code** | `TASKACTV` assignments resolving against `ACTVTYPE` (definitions) and `ACTVCODE` (values, hierarchical via `parent_actv_code_id`) | The largest table in a real file — see §2.5 |

_Source: [How is a .xer file structured?](docs/wayfinder/tickets/002-xer-file-structure.md) · [Domain model and schema](docs/wayfinder/tickets/005-domain-model-and-schema.md) · [Which flagged set does the ship gate score against?](docs/wayfinder/tickets/050-ship-gate-flagged-set.md)_

### 2.3 The `.xer` physical format

A `.xer` is a tab-delimited dump of P6's internal tables. **Oracle documents the field
mappings, not the file grammar** — there is no official statement of the record structure, no
encoding declaration, no escaping rules and no enumeration of coded values. Everything in this
subsection is observed from real exports.

```
<file>    ::= <header> <table>+ "%E"
<header>  ::= "ERMHDR" TAB <version> TAB <date> TAB "Project" TAB <user_login>
                     TAB <user_name> TAB <db_name> TAB <module> TAB <currency>
<table>   ::= "%T" TAB <table_name>
              "%F" TAB <field_name> (TAB <field_name>)*
              ("%R" TAB <value> (TAB <value>)*)*
```

| Marker | Meaning |
|---|---|
| `ERMHDR` | File header, first line only. **Does not start with `%`** — a parser matching `^%` misses it |
| `%T` | Begins a table. One field: the table name |
| `%F` | Field-name header for the current table |
| `%R` | One data row |
| `%E` | End of file |

Rules a parser must implement:

- **Arity.** Every `%R` row has exactly the arity of its table's `%F` line, across every
  fixture measured. Zip `%F` names to `%R` values positionally *within a table*, never across
  files or versions (§2.7).
- **Nulls.** A null is the empty string between two tabs. There is no sentinel, so null and
  empty string are indistinguishable from the file alone and must be decided per field by
  type. Sparse rows are normal: 20 of 60 fields are empty in the first `TASK` row of a real
  progressed export.
- **Encoding: Windows-1252 (CP1252), and the decode is lossy, never strict.** `file -bi`
  reports `charset=binary`. High bytes appear as currency symbols in `CURRTYPE` (`0xA3` £,
  `0xA5` ¥, `0xD8` Ø). Byte `0x81` is undefined in CP1252 and strict decoders throw on it:
  28,774 occurrences in Fixture A progressed, 31,485 in Fixture B, **zero** in Fixture A
  baseline. **Never reject an upload on encoding** — a file that trips the decoder is a file
  we mis-decoded.
- **Line endings are CRLF.** Strip `\r` before splitting on tabs, or the last field of every
  row carries a trailing carriage return.
- **`0x7F` (DEL)** appears in quantity inside `CALENDAR`, `TASK` and `SCHEDOPTIONS`. Inside
  `clndr_data` it is layout, not structure, and may be absent altogether (§2.6).
- **Dates** are `YYYY-MM-DD HH:MM` — no seconds, **no timezone recorded anywhere in the
  format**. Treat as naive local wall-clock; do not parse to UTC. The header's export date is
  date-only.
- **Durations and float are integer hours**, in fields suffixed `_hr_cnt`.
  `target_drtn_hr_cnt = 224` is 28 days at an 8-hour day.
- **Escaping does not exist, and free text may still break lines.** No fixture contains a
  field with an embedded tab or newline, but nothing in the format prevents one in
  `task_name`, `wbs_name`, `task_memo`, `rsrc_notes`, `comments` or a UDF text value. A parser
  must treat a line not beginning with a known marker as a **continuation of the previous
  `%R`**, joining until `%F` arity is satisfied, and log when it does. This is the single most
  likely place a naive parser silently corrupts real data; `text-multiline.xer` pins it.
- **Readability guard.** A `.xer` is readable only if its **last record is `%E`** and it
  carries **no `NUL` byte anywhere**. Failing either is one rejection — `unreadable` — an
  incomplete or corrupt copy, not an empty or invalid programme. Both halves are byte facts,
  both were measured against all 139 real exports, and together they catch a wholly zeroed
  file (one real file in 139 is 397,781 bytes of pure `NUL`) and a truncated export, while
  leaving legitimately sparse files acceptable. No count can be the discriminator: a scan of a
  zeroed file returns zero of everything and is indistinguishable from a very small programme.

The header, positionally:

| Position | Meaning | Observed |
|---|---|---|
| 1 | Marker | `ERMHDR` |
| 2 | **P6 version** | `6.0`, `6.2`, `7.0`, `8.3` |
| 3 | Export date | `2015-04-22` (date only) |
| 4 | Export type | `Project` |
| 5 | User login | `admin` |
| 6 | User display name | `Adminstrator` (Oracle's own misspelling, verbatim in the data) |
| 7 | Database name | `dbxDatabaseNoName` |
| 8 | Module | `Project Management` |
| 9 | Base currency | `USD` |

Fields 5 and 6 carry a real person's name in the general case.

_Source: [How is a .xer file structured?](docs/wayfinder/tickets/002-xer-file-structure.md) · [A zeroed .xer is a real shape — what does the scan do with it?](docs/wayfinder/tickets/040-zeroed-xer-file.md) · [Upload and ingest pipeline](docs/wayfinder/tickets/011-upload-ingest-pipeline.md)_

### 2.4 Enumerations, and why they may never be treated as closed

Oracle documents none of these. Observed values, with real-file frequencies:

| Field | Values seen |
|---|---|
| `task_type` | `TT_Task` (1690), `TT_FinMile` (35), `TT_Mile` (26). `TT_LOE`, `TT_WBS`, `TT_Rsrc` exist and are absent |
| `status_code` (`TASK`) | `TK_NotStart` (1493), `TK_Complete` (192), `TK_Active` (66) |
| `pred_type` | `PR_FS` (2813), `PR_SS` (9), `PR_FF` (3). `PR_SF` absent but certainly exists |
| `duration_type` | `DT_FixedDUR2` (1690), `DT_FixedDrtn` (61) |
| `complete_pct_type` | `CP_Drtn` (1750), `CP_Units` (1). `CP_Phys` expected |
| `cstr_type` | empty (1696), `CS_MEO` (35), `CS_MSO` (14), `CS_MSOA` (6). Many more exist |
| `clndr_type` | `CA_Base` (3), `CA_Project` (2). `CA_Rsrc` expected |
| `rsrc_type` | `RT_Labor` (13), `RT_Equip` (1), `RT_Mat` (1) |
| `status_code` (`PROJWBS`) | `WS_Open` (164) |

**These lists are incomplete by construction** — one programme cannot exhibit every code. An
unknown code is never an error: store the raw string, map to a display label where known, fall
back to the raw code otherwise. `unknown-table-and-enum.xer` pins this with an undocumented
table plus `TT_LOE` / `TT_WBS` / `PR_SF` / `CS_MANDFIN`.

_Source: [How is a .xer file structured?](docs/wayfinder/tickets/002-xer-file-structure.md)_

### 2.5 The table set — what matters, what is ignored

Oracle's V24 guide documents **73 tables**; a real file carries **17–20**. Every table is
optional and unknown tables are normal — `POBS` appears in real files and is **not** in
Oracle's documented list at all.

Observed row counts, largest first (real Fixture A, the same programme ten months apart):

| Table | 6.0 rows | 8.3 rows | Note |
|---|---|---|---|
| `TASKACTV` | 25,779 | 28,291 | **Largest table.** ~14 per activity |
| `UDFVALUE` | 10,725 | 14,234 | |
| `TASKPRED` | 2,789 | 2,825 | ~1.6 per activity |
| `TASKRSRC` | 2,674 | 3,061 | |
| `TASK` | 1,746 | 1,751 | |
| `ACTVCODE` | 395 | — | |
| `PROJWBS` | 164 | 164 | |
| `POBS`, `ACTVTYPE`, `UDFTYPE`, `CURRTYPE`, `RSRC`, `RSRCRATE`, `CALENDAR`, `SCHEDOPTIONS`, `PROJECT`, `OBS` | small | small | |
| `PCATTYPE`, `PCATVAL`, `PROJPCAT` | absent | present | 8.3 only |

**Size ingest on `TASKACTV`, not on `TASK`.** Anything sized on activity count is wrong by an
order of magnitude, and code density is not stable: ~14 assignments per activity on Fixture A
against ~6.1 on Fixture B.

Which tables the product actually reads:

| Table | Read by | Fields that matter |
|---|---|---|
| `PROJECT` | every derived statistic; ingest guards | `proj_id`, `last_recalc_date` (data date), `plan_start_date`, `plan_end_date`, `scd_end_date`, `clndr_id`, `critical_drtn_hr_cnt`, `critical_path_type`, `sum_base_proj_id` |
| `TASK` | statistics, `activities.json`, both caps | `task_id`, `proj_id`, `wbs_id`, `clndr_id`, `task_code`, `task_name`, `task_type`, `status_code`, `target_drtn_hr_cnt`, `remain_drtn_hr_cnt`, `target_*`/`early_*`/`late_*`/`act_*` dates, `total_float_hr_cnt`, `free_float_hr_cnt`, `cstr_type`/`cstr_date`, `driving_path_flag`, `float_path`/`float_path_order` |
| `TASKPRED` | logic statistics, the driving walk | all 8 fields: `task_pred_id`, `task_id`, `pred_task_id`, `proj_id`, `pred_proj_id`, `pred_type`, `lag_hr_cnt`, `comments` |
| `PROJWBS` | WBS tree in `activities.json`, capped top-level summary in `derived.json` | `wbs_id`, `parent_wbs_id`, `wbs_short_name`, `wbs_name`, `seq_num`, `proj_node_flag` |
| `CALENDAR` | working-day conversion | `clndr_id`, `clndr_name`, `clndr_type`, `base_clndr_id`, `default_flag`, `clndr_data` |
| `TASKACTV` + `ACTVTYPE` + `ACTVCODE` | the fuller `activities.json` cut | `task_id`, `actv_code_id`, `actv_code_type_id` |
| `RSRC`, `TASKMEMO`, `TASKUSER`, `DOCUMENT`, `UDFVALUE`, `ERMHDR` | the pre-publish personal-data panel only | `rsrc_name`, `email_addr`, `office_phone`, `other_phone`, `employee_code`, `user_id`, `rsrc_notes`, `task_memo`, `author_name`, `add_by_name`, `create_user`/`update_user`, export login/name |

Everything else — `POBS` (13,876 rows in Fixture B, read by nothing), `SCHEDOPTIONS`, `OBS`,
the project-code tables, the remaining 50-odd documented tables — is **not parsed into any
product artefact and not discarded either**: it survives verbatim in the archived
`original.xer.gz`. That is deliberate. Because the field set is version-dependent, re-parsing
the archived blob under a newer parser is the only way to recover data that was present all
along, so unknown fields are preserved rather than dropped.

_Source: [How is a .xer file structured?](docs/wayfinder/tickets/002-xer-file-structure.md) · [Get real .xer files to work against](docs/wayfinder/tickets/001-get-real-xer-files.md) · [Personal data in published .xer files](docs/wayfinder/tickets/013-personal-data-in-published-files.md) · [The client-side parse budget](docs/wayfinder/tickets/020-client-parse-budget.md)_

### 2.6 `clndr_data`, decoded

The hardest part of the format. Oracle documents nothing beyond "Data".

The structure is nested parenthesised nodes of the form
`(0||<name>(<attributes>)(<children>))`, and **only the parentheses carry structure**. `0x7F`
and whitespace are layout: strip them before parsing without changing meaning.

- **Layout varies inside one file.** Base calendars (`clndr_type = CA_Base`) are written
  indented with runs of `0x7F 0x7F` — 34 to 352 DEL bytes apiece — and are what make `file`
  report the document as binary. The `CA_Project` calendars beside them carry **zero** `0x7F`
  and sit on one flat unindented line. Both decode to the same tree. Splitting on `0x7F` as a
  record separator loses every project calendar in the file.
- **`DaysOfWeek`** holds seven children keyed `1`–`7`; **day 1 is Sunday**. A day with no
  shift children is non-working. Days routinely hold **more than one shift** — the lunch break
  (`s|08:00|f|12:00` plus `s|13:00|f|17:00`) is the common real shape, and three-shift days
  occur.
- **Shift attributes are an order-free key-value bag, not a tuple.** Base calendars emit
  `s|08:00|f|16:00`; project calendars in the same file emit `f|12:00|s|8:00`, finish first.
  Read by key, never by position — the `%F` lesson one level down.
- **Hours are not zero-padded.** `s|8:00` occurs — six of 24 time values in one real calendar.
  A `\d\d:\d\d` pattern silently drops most of a day's shifts and reports a shorter day.
- **A shift whose finish is `00:00` runs to the end of the day.** `s|00:00|f|00:00` is a
  24-hour day; `s|08:00|f|00:00` is 16 hours. Keyed on the **finish**, never on
  `finish == start` — `s|08:00|f|08:00` is zero. 137 of 563 real `CALENDAR` rows carry it, in
  three serialisations. `24:00` and `23:59` never occur; `00:00` is the format's only spelling
  of end-of-day.
- **`Exceptions`** holds entries keyed `d|<serial>`, and the node is **optional** — 271 of 563
  real calendars have none. An exception with no children is a non-working date; an exception
  **with** shift children is a working day bought back
  (`(0||33(d|39633)((0||0(s|08:00|f|16:00)())))`), and one real six-day-week calendar carries
  80 of them.
- **The serial epoch is 1899-12-30** (Excel / OLE). Verified by decoding all 94 distinct
  exception serials in a real file: `07-04` ×11, `12-25` ×10, `01-01` ×9 and a floating
  late-November Thanksgiving. The 1899-12-31 epoch gives 5 July, 26 December, 2 January —
  meaningless.
- **`(0||VIEW(ShowTotal|N)())`** is a display setting, not working time. `ShowTotal|Y` also
  occurs. Ignore it; do not choke on it.
- **`day_hr_cnt` / `week_hr_cnt` / `month_hr_cnt` / `year_hr_cnt` cannot feed a computed
  figure.** They may be empty, and may be **absent from `CALENDAR`'s `%F` list entirely**.
  Oracle documents all four as conversion factors for entering and displaying durations,
  defaulting to 8 hours a day whatever the shifts say. Measured over real rows: `day_hr_cnt`
  agrees with the decoded pattern on 561 of 561 populated rows, `week_hr_cnt` disagrees on 290
  of 561. The rule stands on what the columns *are*, not on how often they happen to agree:
  **the day pattern in `clndr_data` is the only trustworthy statement of what a calendar
  means.** Where shifts are unavailable, report unavailable.

An incidental finding worth keeping: a real non-US rail contract runs P6's stock **US** holiday
calendar unmodified. Unlocalised default calendars are routine, and a project's geography
cannot be inferred from its calendar.

_Source: [How is a .xer file structured?](docs/wayfinder/tickets/002-xer-file-structure.md) · [Correct the clndr_data rules and calendar goldens against real P6 evidence](docs/wayfinder/tickets/038-calendar-shapes-and-0x7f.md) · [What does `f|00:00|s|00:00` mean?](docs/wayfinder/tickets/048-elapsed-calendar-semantics.md)_

### 2.7 Version drift, and the one rule that survives it

**Never index fields by position. Build a `Map<fieldName, index>` from each table's `%F` line,
per table, per file.**

This is not a style preference. Between the 6.0 and 8.3 exports of the *same programme ten
months apart*:

| Table | 6.0 | 8.3 | Delta |
|---|---|---|---|
| `TASK` | 61 fields | 60 fields | 8.3 **adds** `location_id`; 6.0 has `review_end_date`, `review_type` |
| `PROJECT` | 71 fields | 66 fields | 8.3 adds `location_id`, `sum_refresh_date`; drops `chng_eff_cmp_pct_flag`, `intg_proj_type`, `risk_level`, `sum_data_date`, `sum_only_flag`, and two `ts_rsrc_*` flags |
| `CALENDAR` | 12 fields | 13 fields | 8.3 adds `rsrc_private` |
| `TASKPRED` | 10 | 10 | identical, same order |
| `PROJWBS` | 26 | 26 | identical, same order |
| tables | — | +3 | 8.3 adds `PCATTYPE`, `PCATVAL`, `PROJPCAT` |

**Field order differs, not merely the field set.** A positional parser reads correct data from
one file and wrong data from the other, *silently*, with no error and no arity mismatch — this
actually happened during fixture profiling, returning `status_code` from the 6.0 file and an
activity-code string from the 8.3 file.

- The real set carries **four export versions, not two**: 6.0 × 127, 6.2 × 2, 7.0 × 4,
  8.3 × 5, across 139 files.
- **Never reject on P6 version.** Name-mapping makes the parser version-agnostic by
  construction; rejecting a P6 25 file because no fixture exists would reject files that parse
  perfectly. Record `p6_version` (it is a facet column) and reject only when a required table
  or field is missing.
- The rule ships as a test, not a note: `ver-60-fieldset.xer` and `ver-83-fieldset.xer` are the
  same programme under both `%F` contracts with different field order, and read by name they
  produce a **byte-identical `derived.json`** (3,780 bytes each). Any positional parser fails
  that comparison loudly.

_Source: [How is a .xer file structured?](docs/wayfinder/tickets/002-xer-file-structure.md) · [Get real .xer files to work against](docs/wayfinder/tickets/001-get-real-xer-files.md) · [Does the tracer seed where P6 seeds?](docs/wayfinder/tickets/044-tracer-seed-tie-break.md) · [Get a large synthetic fixture for perf work](docs/wayfinder/tickets/012-large-synthetic-fixture.md)_

### 2.8 Size distribution, compression, and the caps

Measured, real and synthetic:

| File | Activities | Bytes | gzip | Ratio | B / activity |
|---|---|---|---|---|---|
| `sparse-150` (synthetic) | 150 | 246,647 | 38,657 | 6.4 : 1 | 1,644 |
| `perf-2k` (synthetic) | 2,000 | 3,285,815 | 464,769 | 7.1 : 1 | 1,643 |
| `perf-20k` (synthetic) | 20,000 | 30,657,204 | 4,334,704 | 7.1 : 1 | 1,533 |
| `perf-20k-dense` (synthetic) | 20,000 | 35,009,843 | 4,781,196 | 7.3 : 1 | 1,750 |
| Fixture A baseline (real) | 1,746 | 2,874,706 | 416,370 | 6.9 : 1 | 1,646 |
| Fixture A progressed (real) | 1,751 | 4,987,677 | 649,661 | 7.7 : 1 | 2,848 |
| Fixture B (real) | 3,344 | 6,810,660 | 898,019 | 7.6 : 1 | 2,036 |

- Real files run **2.9–6.8 MB**; the baseline is smallest because it carries no actuals.
- **Gzip holds at 6.4–7.7 : 1** across programmes *and* across a 6× range of activity count.
  It is the one ratio that is stable. Store and serve gzipped.
- **Byte density is not stable** — 1,533 to 2,848 bytes per activity — because progress and
  activity-code density each vary by more than 2×.
- Server-side parse peaks at **12–13× the raw file size** in Node (398 MB for a 30.7 MB file);
  a 50.5 MB file peaks at 562 MiB against a Function's 2 GB. Parse CPU is a non-issue: 560 ms
  for the largest legal file.

**The caps, as one rule:**

> A `.xer` is accepted when it contains **at least 1 and at most 20,000 activities** and the
> **raw file is at most 60 MB**. Both are evaluated from the one client-side scan and both are
> re-evaluated at ingest. A rejection names the guard that fired, with the measured value
> beside the limit.

- The byte cap is **60 MB, not 50**. At the worst real density observed (2,848 B/activity) a
  20,000-activity programme is 56.96 MB, so a 50 MB cap bit first at ~17,500 activities and a
  planner who trimmed activities to clear one limit would be rejected by the other. 60 MB is
  the smallest round number above that, so **any file inside the activity cap at any density
  ever observed is inside the byte cap**, and the byte guard now fires only on a file that is
  not mostly activities.
- Ordering: `File.size` is checked first because it is free, but a file **between the cap and
  twice the cap is still scanned**, so the byte rejection can also name the activity count.
  Above **120 MB** the file is rejected on size alone with no read.
- The presigned PUT carries an **exact** content-length (the client already holds the
  compressed blob), so the cap does not rest on client honesty; ingest **decompresses with a
  hard byte limit** of the raw cap and aborts past it, because a 12 MB gzip member can expand
  to gigabytes.
- **Multi-project files are rejected**, and the discriminator is **distinct `TASK.proj_id` > 1,
  never `PROJECT` row count** — a baseline-bearing export carries several `PROJECT` rows and
  must stay legal.
- Rejection, never degradation: the storefront row has fixed slots and no way to render a
  half-computed programme.

_Source: [Get a large synthetic fixture for perf work](docs/wayfinder/tickets/012-large-synthetic-fixture.md) · [The client-side parse budget](docs/wayfinder/tickets/020-client-parse-budget.md) · [Upload and ingest pipeline](docs/wayfinder/tickets/011-upload-ingest-pipeline.md)_

### 2.9 The hybrid ingest boundary: what is in Postgres, what stays in blob storage

**Parse on upload into a small indexed Postgres row per Programme and per Revision, plus
precomputed JSON in blob storage. The original `.xer` is fetched only when a programme is
opened.**

| Artefact | Where | Size | Read by |
|---|---|---|---|
| `programme` + `revision` rows | Postgres | ~2 KB per revision including indexes | The browse grid, search, facets, sorts — **zero blob reads** |
| `p/{programme_id}/r/{revision_id}/original.xer.gz` | Blob | 416–898 KB gzipped real; 4.3–4.8 MB at 20,000 activities | The download button; a re-parse under a newer parser |
| `p/{programme_id}/r/{revision_id}/activities.json.gz` | Blob | 40–75 KB gzipped real; 342 KB (lean) to 788 KB (with codes and logic) at 20,000 activities | The detail page's activity table and WBS tree |
| `p/{programme_id}/r/{revision_id}/derived.v{N}.json` | Blob | 8.5–17.5 KB measured; ~40–60 KB expected with full exemplars; **150 KB ceiling** | The detail page, on open |

- **Blob keys are id-addressed, not content-addressed.** Content addressing collides with
  hard-delete: two Programmes legitimately hold identical bytes (an exact-hash re-upload
  becomes a Fork), and a Class A withdrawal hard-deletes the parent's bytes while leaving the
  Fork intact — under content addressing that delete destroys the Fork's file. It also makes
  a tombstone **one prefix delete** and the CDN purge list exactly **three deterministic URLs
  per Revision**, with no bucket listing.
- `derived.json` is version-stamped in the path and recomputed lazily on open; `derived_version`
  on the row is the staleness marker. The contract is at **v3**.
- `original.xer.gz` is the one object holding personal data and carries three special
  properties: `X-Robots-Tag: noindex, noarchive`, a **1-hour TTL** (so a takedown can be
  purged), and a 30-day Class B quarantine.
- **Blob is not the binding cost.** At 10,000 programmes × 3 revisions the whole blob estate
  is ~25.5 GB — $0.23/month on R2 — and Postgres is ~60 MB of rows, ~150 MB with indexes and
  bloat, inside a free plan.

**Why the relational alternative was priced out.** Storing the parsed file as rows means
~63,000 activity-and-related rows per revision — **~1.9 billion rows and ~$66/month** at the
10,000 × 3 ceiling, against a database that is otherwise a rounding error. The intermediate
step is no better: WBS alone would be ~10k programmes × ~3 revisions × ~200 nodes ≈ **6M rows
for a tree only ever read one programme at a time**, so **WBS is not relational** — the full
tree goes in `activities.json` and a capped top-level-children summary (name plus activity
count per first-level node, capped at 20, flagged when truncated) goes in `derived.json` so a
breakdown chart renders on first paint. The same arithmetic kills activity-name search for v1.

A third artefact was considered and dropped: a fuller `parsed.json`. Gzipped it measures the
same size as the `.xer` it was parsed from, so it would double the corpus for zero benefit.

_Source: [What does storage actually cost?](docs/wayfinder/tickets/004-storage-cost-model.md) · [Domain model and schema](docs/wayfinder/tickets/005-domain-model-and-schema.md) · [The derived.json contract](docs/wayfinder/tickets/006-derived-json-contract.md) · [Browse, search, filter and ranking](docs/wayfinder/tickets/009-browse-search-ranking.md) · [What tooling does the operator need to run a takedown?](docs/wayfinder/tickets/017-operator-takedown-tooling.md)_

### 2.10 The persisted schema

One split underlies all of it: **Programme is identity, Revision is content.** Derived
statistics live on Revision only; `programme.current_revision_id` is what makes the grid one
query (a PK join satisfies the one-query rule — the constraint was one query, not zero joins).

```sql
create extension if not exists citext;
create extension if not exists pg_trgm;

-- identity ---------------------------------------------------------------
create table programme (
  id                   uuid primary key,
  slug                 text not null unique,          -- immutable, public handle
  title                text not null,
  description          text,
  sector               text references sector(code),  -- nullable; declared, never inferred
  owner_user_id        uuid references app_user(id) on delete set null,
  licence              text not null default 'CC-BY-4.0',

  parent_revision_id   uuid references revision(id),  -- authoritative fork edge
  parent_programme_id  uuid references programme(id), -- denormalised from it
  root_programme_id    uuid not null references programme(id),  -- self, if root

  current_revision_id  uuid references revision(id),  -- newest non-tombstoned; null until publish
  status               text not null,                 -- published | tombstoned
  vote_count           integer not null default 0,    -- denormalised, maintained on write
  created_at           timestamptz not null
);

-- full-text search over title + description only
alter table programme add column search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')),       'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;

-- content ----------------------------------------------------------------
create table revision (
  id                      uuid primary key,
  programme_id            uuid not null references programme(id),
  rev_no                  integer not null,           -- from 1
  uploaded_at             timestamptz not null,

  uploader_display_name   citext not null,            -- snapshot, never a join
  change_note             text,                       -- required on a fork's rev 1
  content_hash            text,                       -- SHA-256; null until ingest writes it
  is_root_rev             boolean not null default false,  -- programme is a root and rev_no = 1
  terms_version           text not null,
  asserted_at             timestamptz not null,

  status                  text not null,              -- pending | failed | published | tombstoned
  ingest_attempts         smallint not null default 0,
  failure_reason          text,                       -- shown to the uploader
  failure_detail          text,                       -- operator-only; position, never file bytes
  removal_class           char(1),                    -- A | B
  removed_at              timestamptz,
  bytes_deleted_at        timestamptz,                -- bytes destroyed and CDN purge confirmed
  quarantine_purged_at    timestamptz,                -- Class B 30-day quarantine destroyed

  -- written by ingest, therefore all nullable: the row exists before the parse
  p6_version              text,                       -- facet
  activity_count          integer,                    -- sort, range facet
  start_date              date,
  finish_date             date,
  data_date               date,
  pct_complete            numeric(5,2),
  is_baseline             boolean,
  checks_passed           smallint,                   -- DCMA
  checks_applicable       smallint,                   -- DCMA
  card                    jsonb,                      -- display-only payload for the grid row
  derived_version         smallint,                   -- staleness marker; contract is at v3

  unique (programme_id, rev_no)
);

-- accounts ---------------------------------------------------------------
create table app_user (
  id                  uuid primary key,
  clerk_user_id       text not null unique,   -- the only link to the Google identity
  display_name        citext not null unique, -- the Handle
  uploader_vote_count integer not null default 0,
  created_at          timestamptz not null
);

create table reserved_handle ( name citext primary key, released_at timestamptz not null );
create table sector ( code text primary key, label text not null, sort_order int not null );

-- credit -----------------------------------------------------------------
create table programme_vote (
  voter_user_id  uuid references app_user(id) on delete set null,
  programme_id   uuid not null references programme(id),
  created_at     timestamptz not null,
  unique (voter_user_id, programme_id)
);

create table uploader_vote (
  voter_user_id    uuid references app_user(id) on delete set null,
  subject_user_id  uuid not null references app_user(id),
  created_at       timestamptz not null,
  unique (voter_user_id, subject_user_id)
);

create table bookmark (                        -- private; no counter anywhere
  user_id       uuid not null references app_user(id) on delete cascade,
  programme_id  uuid not null references programme(id),
  created_at    timestamptz not null,
  unique (user_id, programme_id)
);

-- upload ------------------------------------------------------------------
create table upload_intent (                   -- written at presign; makes abandoned bytes findable
  revision_id   uuid primary key,
  programme_id  uuid not null,
  user_id       uuid not null references app_user(id) on delete cascade,
  created_at    timestamptz not null
);

-- takedown ----------------------------------------------------------------
create table takedown_report (
  id                  uuid primary key,      -- the case reference
  created_at          timestamptz not null,
  reporter_contact    text,                  -- purged 90 days after close
  contact_purged_at   timestamptz,
  subject_ref         text,
  name_as_it_appears  text,                  -- PI cases; feeds the corpus scan
  reported_reason     text not null,
  class               char(1),               -- operator-assigned, not reporter-declared
  status              text not null,         -- open | awaiting_owner | actioned | rejected
  resolution_note     text,
  plan_ref            text,
  actioned_at         timestamptz
);

-- operations ---------------------------------------------------------------
create table sweep_run (                     -- append-only history and heartbeat
  id            uuid primary key,
  started_at    timestamptz not null,
  finished_at   timestamptz,
  ok            boolean,                     -- the verdict the workflow asserts on
  actions       jsonb not null default '{}', -- retried, reaped, tombstones_completed, quarantines_destroyed
  breaches      jsonb not null default '[]', -- rule key + count per breaching rule
  error         text
);

create table alarm_state (                   -- exactly 5 rows, seeded by migration
  rule            text primary key,          -- takedown_open | deterministic_failure
                                             -- | transient_burst | reconciler_stuck | edge_drift
  breaching       boolean not null default false,
  breaching_since timestamptz,
  last_alarmed_at timestamptz
);

-- indexes -------------------------------------------------------------------
create unique index revision_root_content_hash_uq
  on revision (content_hash) where is_root_rev;   -- dedup: one root per byte-identical file
create index on revision (content_hash);          -- lookups; deliberately not unique
create index on programme using gin (search_tsv);
create index on programme using gin (title gin_trgm_ops);  -- zero-result fallback
create index on programme (created_at desc, id desc);      -- the frozen default sort
```

Notes that are load-bearing:

- **`programme` ↔ `revision` FKs are circular.** Insert the Programme with a null
  `current_revision_id`, insert the Revision, update later. Because ids are uuids the client
  can generate, the pair is a *batch* rather than an interactive transaction, which is what
  lets the HTTP Postgres driver suffice with no WebSocket pool.
- **`root_programme_id` self-references on roots**, so family queries need no null branch.
- **`current_revision_id` stays null until ingest publishes.** The grid is
  `programme join revision on current_revision_id`, and an inner join drops nulls — so a
  pending Programme is invisible to the shelf for free, with no status predicate anywhere.
- **`content_hash` is deliberately non-unique in general** (two Programmes legitimately hold
  identical bytes) and unique **only** among root revisions, via the partial index. A partial
  index cannot span two tables, which is why `is_root_rev` exists as a stored flag.
- **No per-column indexes on the Revision facets.** At a 10,000-row ceiling a filter on
  `sector` while sorting on `checks_passed` is a sub-millisecond scan; indexes are added when
  something is measured slow, not before. `card` is annotated `GIN` in the source DDL, but no
  query in the closed set reads `card` by predicate.
- **No `tags`, no `checks_ratio`, no denormalised fork counter.** A fork count exists only on
  the contributor page, live-joined. The leaderboard's eligibility gate (published,
  non-tombstoned Programme count per contributor) is a live subquery, not a maintained column.
- Foreign-key actions, and why each: `owner_user_id` and both `voter_user_id` columns are
  `on delete set null` so rows survive account deletion — the vote rows keep the denormalised
  totals reconcilable by `count(*)` while the personal reference is erased. `bookmark.user_id`
  and `upload_intent.user_id` are `on delete cascade`: bookmarks carry nobody's credit, and an
  intent without a cascade raises a foreign-key violation at account deletion.

> **GAP:** the per-account uploader-vote counter is fixed as a denormalised column maintained
> on write, but no ticket names it or gives its type. `app_user.uploader_vote_count integer not
> null default 0` above is this spec's rendering of that decision, matching
> `programme.vote_count`, whose type and default are likewise unstated.

_Source: [Domain model and schema](docs/wayfinder/tickets/005-domain-model-and-schema.md) · [Stack, hosting and auth provider](docs/wayfinder/tickets/010-stack-hosting-auth.md) · [Upload and ingest pipeline](docs/wayfinder/tickets/011-upload-ingest-pipeline.md) · [Credit, upvotes and the contributor leaderboard](docs/wayfinder/tickets/016-credit-upvotes-leaderboard.md) · [What tooling does the operator need to run a takedown?](docs/wayfinder/tickets/017-operator-takedown-tooling.md) · [Operating and observing ingest](docs/wayfinder/tickets/019-ingest-observability.md) · [The signed-in user's own space](docs/wayfinder/tickets/023-signed-in-users-own-space.md) · [Verifying the production-only edges](docs/wayfinder/tickets/024-verifying-production-only-edges.md) · [Browse, search, filter and ranking](docs/wayfinder/tickets/009-browse-search-ranking.md)_

### 2.11 Identity rules

**Content hash.**

- **SHA-256.** The browser computes one with `crypto.subtle.digest` over the file's bytes, but
  that value drives a lookup and nothing else — **nothing the client computes is persisted**.
  The stored `content_hash` is computed by ingest from the decompressed bytes, so enforcement
  lands on the write that carries trusted bytes.
- Null on a `pending` row; written once by ingest.
- An exact content-hash match against a live root does not create a new root — the upload
  **becomes a Fork instead**. That is why the column is non-unique in general.
- A hash matching a **Class B** tombstoned Revision is a **hard reject, permanently** — rows
  never delete, so the block outlives the 30-day quarantine and takedown-evasion stays shut.
  **Class A tombstones do not block re-upload**: withdrawal is voluntary and the owner holds
  their own copy.
- Duplicate uploads are a mainline case, not an edge case: of 139 real files only **67 are
  distinct by SHA-256**, the same export appearing at identical byte size in two folder trees
  plus P6 export-suffix variants of identical content.

**Slug.**

- `programme.slug` is **unique and immutable**, generated from the title at creation with a
  numeric suffix on collision. `/p/riverside-depot-3`.
- Immutable is load-bearing: titles are editable, so a frozen slug means no redirect table, no
  link rot and no alias history. A slug drifting from a renamed title is cosmetic.
- Collision suffixes are the normal case, not a failure — Forks prefill their title from the
  parent, so a shelf reading `riverside-depot`, `riverside-depot-2` is honest about what those
  are.
- The uuid stays the primary key and never appears in a link.

**Revision numbering.**

- `rev_no` counts from 1 per Programme, `unique (programme_id, rev_no)`. A planner says
  "rev 12", not a uuid.
- URLs are `/p/{slug}/r/{rev_no}`; a Programme's bare URL renders its Current Revision.
- **`current_revision_id` is the newest non-tombstoned Revision**, repointed when a Revision is
  added and when the current one is tombstoned. When every Revision is tombstoned, the
  Programme is tombstoned too.
- Fork numbering resets: a Fork's first upload is its own rev 1, and slug, uploader display
  name, terms snapshot and votes all reset with it. Title, description and sector are prefilled
  from the parent as **form defaults, then owned outright** — never live references, because
  editing the parent would silently rewrite the child.

**Lineage.**

- The fork edge points at a **Revision**, with the parent Programme denormalised beside it. The
  revision pointer is the truth and the two can never disagree, because Revisions are immutable
  and each belongs to exactly one Programme. It is what makes a revision-granular Class B
  cascade correct: if revision 17 is tainted and someone forked revision 3, a programme-only
  pointer would tombstone a Fork that never contained the tainted content.
- **Strictly a tree, no merge in v1.** A merge node has two ancestries, so subtree taint stops
  being a subtree and CC-BY attribution becomes a lattice. Re-forking is unbounded.
- Ancestry is a parent pointer plus a **recursive CTE** — no materialised path, no closure
  table. Forks never re-parent, so a materialised path would be write-once and is a safe pure
  cache to add later if lineage ever gets hot.
- `root_programme_id` is denormalised anyway: one indexed equality returns the whole fork
  family, which a CTE on a grid could not do inside the one-query rule.

**Tombstones.**

- Two classes: **Class A** (uploader withdrawal, Forks untouched) and **Class B**
  (rights/confidentiality/personal-data, cascades down the Fork subtree, unconditionally below
  a tainted Fork — a Fork's first Revision *is* a copy of tainted bytes).
- Cascade closure is operator-scoped and broad by default (the whole parent Programme and every
  descendant); the adjudicator may narrow to named Revisions, which is the only reason the
  revision pointer exists.
- Forking *from* a tombstoned Revision is impossible (the bytes are gone); a Fork whose ancestor
  was later tombstoned keeps existing and renders "withdrawn by uploader" in its chain.
- `bytes_deleted_at` means *public bytes destroyed and CDN purge confirmed* — it exists so the
  reconciler is a pure SQL predicate (`status = 'tombstoned' and bytes_deleted_at is null`)
  rather than an R2 listing. Quarantine expiry needs no column: it is
  `removed_at + interval '30 days'` where `removal_class = 'B'`.
- The tombstoned page stays at its URL forever and stops being findable (`noindex, follow`),
  uniformly for both classes.

**Bytes hard-delete, rows never:**

| Thing | On takedown | On account deletion |
|---|---|---|
| Blob bytes | hard-deleted | untouched |
| Revision row | tombstoned, never deleted | untouched |
| Programme row | tombstoned, never deleted | `owner_user_id` → null |
| `uploader_display_name` | retained | **retained** — the pseudonym is what makes this work |
| Handle | retained | moved to `reserved_handle`, never reassigned |
| `app_user` row | untouched | **hard-deleted** |

**Accounts.** An `app_user` row is created on the **first authenticated write** — a vote, a
bookmark or a presign — with a generated Handle, and the Handle is *confirmed* at first upload.
Reads create nothing. Handles are unique case-insensitively (`citext`) and a Handle is written
to `reserved_handle` on rename and on deletion and never reassigned, even one generated but
never published: a wasted row is cheaper than a conditional.

_Source: [Domain model and schema](docs/wayfinder/tickets/005-domain-model-and-schema.md) · [Licensing, attribution and takedown](docs/wayfinder/tickets/003-licensing-attribution-takedown.md) · [Upload and ingest pipeline](docs/wayfinder/tickets/011-upload-ingest-pipeline.md) · [The signed-in user's own space](docs/wayfinder/tickets/023-signed-in-users-own-space.md) · [What tooling does the operator need to run a takedown?](docs/wayfinder/tickets/017-operator-takedown-tooling.md) · [The site's own crawl surface](docs/wayfinder/tickets/033-site-crawl-surface.md) · [Does the tracer seed where P6 seeds?](docs/wayfinder/tickets/044-tracer-seed-tie-break.md)_

### 2.12 The fixture corpus: the format's evidence base

Two corpora, with different jobs and opposite visibility.

**The real set — 143 files, gitignored forever, measurements only.** No public document names
the client, the contract or a file path; the register is local. Public docs say *Fixture A* and
*Fixture B*.

| | Fixture A | Fixture B |
|---|---|---|
| What it is | Monthly submissions of a live infrastructure contract, 2015–2017, four revision lines | Four tender variants of one job, exported within a day of each other |
| Relationship | a **revision series** | **fork siblings** — the only real evidence of what sibling variants look like |
| Files | 139 | 4 |
| Activities | 543–1,751 across the set; 1,746–1,751 in the profiled revisions | 3,332–3,344 |
| P6 versions | 6.0 × 127, 6.2 × 2, 7.0 × 4, 8.3 × 5 (across the 139) | 8.3 |
| WBS | 164 nodes | **`PROJWBS` = 1** — no WBS at all |
| Progress | baseline, then progressing to 722 complete | 100% `TK_NotStart` |
| `TASKACTV` per activity | ~14 | ~6.1 |
| `TASKPRED` per activity | ~1.6 | ~1.76 |
| Bytes / activity | 1,646 (baseline) to 2,848 (progressed) | 2,036 |

Corpus-wide facts that only fall out of reading all of them at once: **138 of 139 readable**
(one file is pure `NUL`), **67 distinct by SHA-256**, clustering by task-code overlap into
**six programmes** — one of 58 files, one of 5, four singletons — of which only **three** carry
a usable `driving_path_flag`. Eleven distinct activity counts from 543 to 1,751. So the set is
a **population**, not a series, and every measurement scored on "Fixture A" is one revision of
one of those programmes. Sibling variants differ by ~0.4% of rows at 99.97% of the byte size,
so content-hash dedup will never catch them.

Known gaps in the real set, recorded rather than papered over: no programme above ~1,750
activities or below 200 (before Fixture B), no multi-project export, no notebook topics
(`TASKMEMO` absent entirely — the likeliest home for multi-line text), no baseline tables, no
LOE activities, and one domain only.

**The synthetic corpus — committed, and the only test corpus CI will ever have.** Because real
files are permanently gitignored, GitHub Actions can never see one, and fork PRs get no
secrets, so the corpus must need none.

| Path | Kind | Job |
|---|---|---|
| `fixtures/synthetic/corpus/*.xer` | correctness | 29 files, ~20 activities each, one known landmine per file |
| `fixtures/synthetic/corpus/*.expected.json` | golden | what a parser must report for that file |
| `fixtures/synthetic/sparse-150.xer` | rendering | 150 activities — does the row look broken with barely any data |
| `fixtures/generated/perf-{2k,20k,20k-dense}.xer` | perf | **not committed**; a pure function of a seed, regenerated in 419 ms |

Generator: `tools/fixture-gen` (`generate.mjs`, `measure.mjs`). `node tools/fixture-gen/measure.mjs --verify`
round-trips the whole corpus against its goldens.

**A golden is written from what the generator *intended to emit*, never from parsing the
result** — a golden produced by our own parser asserts nothing. Realism comes from a real CPM
forward and backward pass: early/late dates, total float, free float and the driving path are
computed over the logic network, because random dates would produce a meaningless float
histogram and a quality score that measures noise.

The landmines, and what each one pins:

| Fixture | Landmine |
|---|---|
| `ver-60-fieldset` / `ver-83-fieldset` | The same programme in both `%F` field sets, different field **order**. Must produce identical stats |
| `enc-mojibake-0x81` | `0x81` plus UTF-8 bytes inside a CP1252 file — strict decoding throws, as it does on real Fixture B |
| `enc-cp1252-currency` | `£ ¥ Ø` in `CURRTYPE` plus the CP1252 `0x80–0x9F` block in activity names |
| `enc-zeroed-file` | **Must reject as unreadable**: 397,781 bytes of pure `NUL`, one real file's actual shape |
| `enc-truncated-export` | **Must reject as unreadable**: perfect header, whole tables, correct arity, no `%E` |
| `text-multiline` | An embedded CRLF inside `task_name`, and a lone CR in another |
| `cal-clndr-data` | The indented `CA_Base` form: `0x7F` runs, multi-shift days, exception working days, the `VIEW` node |
| `cal-flat-no-0x7f` | One calendar written **twice**, indented and flat — no `0x7F`, finish-first attributes, unpadded hours; both must decode to the same calendar |
| `cal-default-unused` | Three calendars, `default_flag = Y` on one nothing uses; reading `default_flag` as the programme calendar converts a span wrongly |
| `cal-project-clndr-absent` | `PROJECT.clndr_id` names a calendar not in the file; must report unavailable rather than substitute |
| `missing-taskpred` / `missing-calendar` | Whole tables absent — legitimately sparse, must stay acceptable |
| `wbs-flat` | `PROJWBS = 1`, Fixture B's real shape: WBS depth is legitimately 1 |
| `progress-none` / `progress-full` | The two poles: a pure baseline (a third of the stats inapplicable) and a fully progressed file where completed activities carry **empty** float |
| `float-negative` | Negative float and null float in the same file |
| `multiproj-two-proj-id` / `multiproj-baseline-rows` | **Must reject** (two distinct `TASK.proj_id`) versus **must ingest** (three `PROJECT` rows, one owning `proj_id`) |
| `unknown-table-and-enum` | An undocumented table plus `TT_LOE` / `TT_WBS` / `PR_SF` / `CS_MANDFIN` |
| `external-relationship` | `pred_proj_id` pointing outside the file — legitimate, not corruption |
| `logic-driving-branch`, `logic-cycle`, `logic-external-driver`, `logic-complete-no-remaining`, `logic-lag-nonworking`, `logic-nonfs-drivers`, `logic-no-longest-path`, `logic-float-path` | The Longest Path landmines: a branching driving set, a logic loop, an out-of-file chain tail, a 100%-complete programme, lags spanning non-working time, non-FS relationships *on* the chain, an export where P6 never ran Longest Path, and populated `float_path` / `float_path_order` as a second oracle |

**Parser choice, and why the corpus carries the weight.** Write our own tokenizer in
TypeScript: `xerparser` is GPL-3.0-only (unusable in a permissive public repo), MPXJ is LGPL
and Java-only, and the JS ecosystem has nothing mature. The tokenizer is ~150 lines; the real
work — calendar decoding, working-day conversion, float and Longest Path semantics — is not
provided by any library in TypeScript anyway. MPXJ stays a **dev-harness cross-check oracle**,
which links nothing into the product precisely because we did not adopt it.

**One success criterion is unmet and stated plainly: the synthetic files have never been opened
in P6.** No licence was available and no free tool imports XER. For now they are parser
fixtures, not proof of P6 compatibility. That affects exactly two claims — whether invented
`clndr_data` shapes match what P6 emits, and whether a generated file could be round-tripped
through P6 into a better fixture — and none of the measurements above, which depend on
structure transcribed from real exports.

_Source: [Get real .xer files to work against](docs/wayfinder/tickets/001-get-real-xer-files.md) · [Get a large synthetic fixture for perf work](docs/wayfinder/tickets/012-large-synthetic-fixture.md) · [How is a .xer file structured?](docs/wayfinder/tickets/002-xer-file-structure.md) · [Verify the synthetic fixtures import into P6](docs/wayfinder/tickets/021-verify-fixtures-in-p6.md) · [A zeroed .xer is a real shape — what does the scan do with it?](docs/wayfinder/tickets/040-zeroed-xer-file.md) · [Does the tracer seed where P6 seeds?](docs/wayfinder/tickets/044-tracer-seed-tie-break.md) · [Which flagged set does the ship gate score against?](docs/wayfinder/tickets/050-ship-gate-flagged-set.md)_

---

## 3. The payload contracts: `derived.json` and `activities.json`

Three tiers hold a programme, split by how often each is read. This is the whole hybrid-ingest
bet: a programme is legible without opening it, and nothing recomputes on render.

| Tier | Read when | Size | Holds |
|---|---|---|---|
| Postgres row | every grid render | ~1 KB | sort/filter keys + card display fields |
| `derived.json` | programme opened | 40–60 KB typical, **150 KB hard ceiling** | everything above the activity table |
| `activities.json` | visitor reaches the activity table | **340 KB gzipped** at the 20,000-activity cap | the columnar activity cut + WBS tree |
| `original.xer.gz` | recompute, download | 400–870 KB gzipped | the file as uploaded |

The load-bearing constraint: **the browse grid does zero blob reads.** A 24-card page is one
Postgres query. Had the grid fetched `derived.json` per card, the size ceiling would have been
~5 KB of scalars and none of what follows would fit.

A full parse of a `.xer` gzips to roughly the size of the `.xer` itself, so **nothing stores a
full parse**. `activities.json` is a deliberate columnar cut.

_Source: [The derived.json contract](docs/wayfinder/tickets/006-derived-json-contract.md), [What does storage actually cost?](docs/wayfinder/tickets/004-storage-cost-model.md)_

### 3.1 Current versions

| Object | Version | What moved it |
|---|---|---|
| `derived.json` | **v4** | v1 → v2: `logic.longest_path` became computed, plus `cycle_count` and `path_continuous` (014). v2 → v3: `time.duration_working_days` gained its calendar object (045). v3 → v4: `span_calendar_days` renamed `duration_calendar_days` and made an inclusive count (058). |
| `activities.json` | **v2** | v1 → v2: a 14th field, the per-activity driving-path boolean (014). |

v4 is the **first version bump that moves a number an earlier version already emitted** rather than a shape. That is why it carries a rename: the JSON shape does not move, so an integer changing by one is the one change a version stamp has to announce, because nothing else would.

_Source: [Do we compute the critical path ourselves?](docs/wayfinder/tickets/014-compute-critical-path.md), [What calendar is duration_working_days measured on?](docs/wayfinder/tickets/045-duration-working-days-calendar.md), [span_calendar_days is a difference and duration_working_days is a count](docs/wayfinder/tickets/058-span-difference-versus-count.md)_

### 3.2 `derived.json` — top-level shape

```jsonc
{
  "version": 4,
  "programme_id": "…",
  "revision_id": "…",
  "computed_at": "2026-08-07T09:14:00Z",
  "parser_version": "0.1.0",

  "shape":   { … },
  "time":    { … },
  "progress":{ … },
  "logic":   { … },
  "quality": { … },
  "distributions": { … },
  "codes":   { … },

  "issues": [ … ]
}
```

Six stat groups plus `issues[]`. Cut as *merely true* and not present: mean/median duration, UDF
inventory, resource cost totals, activity-id length statistics, raw `TASKACTV` row count. Cut to
the deferred list: the resource-units S-curve.

The admission test for every stat was **does it change a browsing decision, or is it merely
true?**

### 3.3 `shape`

```jsonc
{
  "activity_count": 3344,
  "relationship_count": 5883,
  "milestone_count": 233,              // TT_Mile + TT_FinMile
  "wbs_depth": 1,
  "wbs_node_count": 1,
  "wbs_summary": [                     // first-level nodes only, cap 20
    { "name": "…", "activity_count": 812 }
  ],
  "wbs_summary_truncated": false,
  "calendar_count": 3,
  "calendars_in_use": 1,
  "resource_count": 37,
  "resource_assignment_count": 6256,
  "activity_code_type_count": 12
}
```

**`wbs_depth: 1` is a correct answer, not an error.** Fixture B is a real, professionally
produced tender programme with 3,344 activities under a single node and no breakdown at all.
Every card and chart keyed on WBS must render sensibly at depth 1, and **nothing may promise a
WBS treemap.**

`wbs_summary` lets the detail page render a breakdown on first paint without fetching
`activities.json`, which is where the full tree lives. Capped at 20 first-level nodes with
truncation flagged — the same discipline as the 50-exemplar cap.

`calendars_in_use` sits beside `calendar_count` because the first is a fact about the programme
and the second is a fact about the file.

_Source: [The derived.json contract](docs/wayfinder/tickets/006-derived-json-contract.md), [Domain model and schema](docs/wayfinder/tickets/005-domain-model-and-schema.md)_

### 3.4 `time`

```jsonc
{
  "start_date": "2017-04-24",
  "finish_date": "2023-08-11",
  "data_date": "2017-09-29T16:00",       // PROJECT.last_recalc_date
  "duration_calendar_days": 2301,        // v4 — inclusive count, replaces span_calendar_days
  "duration_working_days": {
    "days": 328,
    "calendar": { "clndr_id": 42, "name": "5-Day Week", "working_days_per_week": 5 },
    "activity_share_pct": 50.0
  }
}
```

**Dates are naive local wall-clock.** The `.xer` records no timezone anywhere; converting to UTC
would invent information. Store and render as written.

`duration_working_days` is the span measured on the **programme calendar** — `PROJECT.clndr_id`,
which named the right calendar on 14 of 14 real files, against `default_flag`, which is absent
from 12 of those 14 and on one of the remaining two names a calendar holding 0 of 1,746
activities. The calendar travels **inside the object with the number**, which is the same rule
`critical_count` / `critical_threshold_hr` follows one field along.

It carries **no hours**. A stock elapsed calendar in 10 of the 14 real files decodes to seven
working days of zero hours, and a working-day span never divides by a day length.

Its failure states follow `logic.longest_path` exactly: `unavailable` where there is no
`CALENDAR` table or `PROJECT.clndr_id` is absent or dangling; `error` plus an `issues[]` **warn**
where the named calendar will not decode.

**Both window fields are counts of one window, on one convention.** Each counts the dates in
`[start_date, finish_date]` with **both ends in it**:

| Field | Definition | `null` when |
|---|---|---|
| `duration_calendar_days` | `(finish − start) / 86400000 + 1` over the two naive local dates | either date is absent, and only then |
| `duration_working_days.days` | the **working** dates in the same window, walked over the programme calendar's decoded week plus exceptions | never — the object goes to `{state, reason}` instead |

A programme starting and finishing on one date is `1`, never `0`.

Invariants, now assertable by the corpus:

- `duration_calendar_days >= 1` wherever non-null.
- `0 <= duration_working_days.days <= duration_calendar_days` wherever the working field reports,
  with **equality exactly when** the programme calendar has no non-working date inside the window.
- `days = 0` is reachable and correct — a window falling entirely on non-working dates.

The earlier difference convention was not merely awkward, it was **false on 14 of 14 real files**:
on a seven-day programme the working-day count exceeded the programme's own calendar-day span by
one. The synthetic corpus hid it because its programme calendar is five-day. Every span figure
this effort has published for the real set was already the inclusive count, so the rename makes
the field agree with the numbers rather than moving them.

_Source: [span_calendar_days is a difference and duration_working_days is a count](docs/wayfinder/tickets/058-span-difference-versus-count.md)_

_Source: [What calendar is duration_working_days measured on?](docs/wayfinder/tickets/045-duration-working-days-calendar.md), [Report duration_working_days on the programme calendar](docs/wayfinder/tickets/047-report-duration-working-days.md)_

### 3.5 `progress`

```jsonc
{
  "pct_complete": 0.0,
  "is_baseline": true,
  "status_mix": { "TK_NotStart": 3344, "TK_Active": 0, "TK_Complete": 0 }
}
```

**`is_baseline` decides which quality checks apply**, so it is derived from the data — no
activity carries an actual start — and never from a label the uploader chose.

### 3.6 `logic`

```jsonc
{
  "relationship_type_mix": { "PR_FS": 5267, "PR_SS": 576, "PR_FF": 39, "PR_SF": 1 },
  "open_ends": { "no_predecessor": 42, "no_successor": 110 },
  "external_relationship_count": 0,
  "critical_count": 131,
  "critical_threshold_hr": 0,
  "cycle_count": 0,
  "path_continuous": true,
  "longest_path": {
    "state": "ok",
    "count": 214,
    "duration_days": 1180,
    "share_of_remaining_pct": 12.2,
    "provenance": "computed"
  }
}
```

Three rules, each confirmed against the real fixtures:

**`critical_count` must never ship without `critical_threshold_hr`.** The threshold is
`PROJECT.critical_drtn_hr_cnt` and it is **0 on Fixture B and 168 (21 days) on Fixture A**.
"131 critical activities" and "1,265 critical activities" are answers to different questions.
Rendering either without its threshold is a lie; comparing them across programmes without
normalising is a worse one.

**Longest Path is not Critical.** Different concepts, separate fields, separate provenance.
Conflating them is the classic P6 reporting error and the product must not commit it.

**`longest_path` is always computed, even when the file carries `driving_path_flag`** — a stat
whose method flips per file cannot be compared across programmes. The flag is retained as a
*validation oracle*; disagreement emits an `info` entry in `issues[]`. The algorithm and its
measured agreement are section 8's.

`cycle_count` is a bare stat with members under the 50-exemplar cap. It is deliberately **not** a
15th DCMA check: browse sorts on `checks_passed / checks_applicable`, and a non-standard check
makes that ratio incomparable between programmes.

`path_continuous` — whether the driving chain runs unbroken from the data date to the finish —
carries what DCMA check 12 was for, outside the ratio, because 12 is permanently skipped.

State vocabulary for `longest_path`: `skip` on a 100%-complete programme; `unavailable` where
remaining dates are absent; `ok` with `truncated: true` where the chain reaches an external
predecessor (**never exercised by a real export** — all 67 distinct real files carry zero
external relationships); `error` plus an `issues[]` entry on a cycle.

_Source: [Do we compute the critical path ourselves?](docs/wayfinder/tickets/014-compute-critical-path.md), [Which flagged set does the ship gate score against?](docs/wayfinder/tickets/050-ship-gate-flagged-set.md)_

### 3.7 `quality` — DCMA 14-point

The differentiator: nobody else surfaces schedule quality at a glance.

**Quality surfaces as checks passed / applicable, never a composite score.** A score we invented
would be both contestable and uncomparable between a baseline and a progressed update. DCMA
14-point is adopted **by name** — planners are already audited against it, the thresholds are
external and defensible, and it costs no credibility to say "this fails DCMA check 4."

```jsonc
{
  "standard": "DCMA-14",
  "passed": 5,
  "applicable": 10,
  "skipped": 4,
  "checks": [
    { "id": "logic", "num": 1, "state": "pass",
      "no_predecessor": 42, "no_successor": 110, "pct": 3.3, "threshold": "<=5%" },

    { "id": "leads", "num": 2, "state": "fail",
      "count": 362, "pct": 6.2, "threshold": "0",
      "truncated": true, "shown": 50,
      "examples": [ { "code": "…", "name": "…", "value_hr": -240 } ] },

    { "id": "out_of_sequence", "num": 11, "state": "skip",
      "reason": "programme has no progress" }
  ]
}
```

| # | Check | Threshold | Computable from a lone `.xer`? |
|---|---|---|---|
| 1 | Logic (open ends) | ≤5% | yes |
| 2 | Leads (negative lag) | 0 | yes |
| 3 | Lags | ≤5% | yes |
| 4 | Relationship types (FS) | ≥90% | yes |
| 5 | Hard constraints | ≤5% | yes |
| 6 | High float (>44d) | ≤5% | yes |
| 7 | Negative float | 0 | yes |
| 8 | High duration (>44d) | ≤5% | yes |
| 9 | Invalid dates | 0 | yes |
| 10 | Resources assigned | — | yes |
| 11 | Missed tasks | ≤5% | **needs baseline tables — skip** |
| 12 | Critical path test | — | **needs a scheduling engine — permanently skipped** |
| 13 | CPLI | ≥0.95 | **needs baseline tables — skip** |
| 14 | BEI | ≥0.95 | **needs baseline tables — skip** |

The 44-day thresholds for checks 6 and 8 convert at **8 hours per day**. This is safe on the real
evidence: of 54 real `CALENDAR` rows, 44 decode to an eight-hour day and the other 10 are a stock
elapsed calendar no activity is assigned to.

**Skip is not fail.** A skipped check leaves both numerator and denominator, so a tender baseline
runs 10 applicable checks rather than being reported as "5/14" and penalised for being a
baseline. Check 12 is stated as `skip` with its reason rather than quietly omitted.

**Failing checks carry the exact count plus up to 50 worst-first exemplars**, `truncated: true`
when there are more. This bounds the file: the worst programme in the corpus produces the same
~25 KB of exemplars as a mediocre one. Uncapped lists would make the *worst* programmes generate
the *biggest* files, which is backwards. The page shows "2,530 activities — here are the 50
worst" and links to the full list, which is an `activities.json` fetch.

**The check set discriminates**, in opposite directions on two programmes that both look
respectable — which is what makes it worth shipping:

| # | Check | Fixture B (tender) | Fixture A (update) |
|---|---|---|---|
| 1 | Logic | 1.3% / 3.3% ✅ | 1.1% / 2.1% ✅ |
| 2 | Leads | **6.2%** ❌ | 0% ✅ |
| 3 | Lags | **8.8%** ❌ | 0.3% ✅ |
| 4 | Relationship types | **89.5% FS** ❌ | 99.6% ✅ |
| 5 | Hard constraints | 4.2% ✅ | 3.1% ✅ |
| 6 | High float | **75.7%** ❌ | 4.2% ✅ |
| 7 | Negative float | 0% ✅ | **69.0%** ❌ |
| 8 | High duration | **42.2%** ❌ | **18.8%** ❌ |
| 10 | Resourced | 86.4% | 83.4% |

Fixture B misses check 4 by half a percentage point — 89.5% against a 90% floor. A threshold that
fine is exactly why every check ships with its raw value and its threshold visible, **never as a
naked verdict**.

_Source: [The derived.json contract](docs/wayfinder/tickets/006-derived-json-contract.md)_

### 3.8 `distributions`

**Buckets are fixed, never adaptive.** Two histograms are only comparable if they share bucket
edges, and revision diff — the feature planners are most likely to want next — is a histogram
comparison. Adaptive buckets would make it impossible and the damage would not surface until v2.

```jsonc
{
  "s_curve": {
    "bucket": "month",
    "from": "2017-04", "to": "2023-08",
    "starts":     [12, 47, 91, …],
    "finishes":   [0, 3, 22, …],
    "cumulative": [12, 59, 150, …]
  },
  "float_histogram": {
    "unit": "days",
    "edges": [null, -20, 0, 5, 10, 20, 44, 100, 200, null],
    "counts": [0, 0, 131, 96, 210, 377, 2530, …],
    "null_count": 0
  },
  "duration_histogram": {
    "unit": "days",
    "edges": [0, 1, 5, 10, 20, 44, 100, 200, null],
    "counts": [233, 412, 601, …]
  },
  "activity_type_mix": { "TT_Task": 3111, "TT_FinMile": 213, "TT_Mile": 20 }
}
```

Monthly S-curve buckets: Fixture A spans 6.4 years → 77 points. Weekly would be 334 and buys
nothing at detail-page scale.

**`float_histogram.null_count` is its own field because empty float is not zero float.** Fixture
A has 345 null-float activities and exactly 345 completed ones — float is absent precisely
because the work is done. Coercing those to zero would report 345 spurious critical activities.

`float_histogram` stays in the contract because it is what makes revision diff a subtraction, but
**it is a stat, not a chart** — it draws as a single spike on every programme that exists, and a
different spike each time. The page renders it as a table. That is section 6's business.

_Source: [The derived.json contract](docs/wayfinder/tickets/006-derived-json-contract.md), [The project detail page](docs/wayfinder/tickets/008-project-detail-page.md)_

### 3.9 `codes`

```jsonc
{
  "types": [
    { "name": "Discipline", "value_count": 14, "assigned_pct": 99.1 },
    { "name": "Area",       "value_count": 31, "assigned_pct": 97.4 }
  ],
  "truncated": false
}
```

Activity codes are how planners actually slice a programme: `TASKACTV` is the largest table in
both real fixtures, at ~14 assignments per activity in Fixture A and ~6.1 in Fixture B. **Values
themselves are not enumerated** — a code type with hundreds of values would dominate the file.
This is why the page's codes panel enumerates types but not values.

### 3.10 `issues[]` and the four kinds of missing

```jsonc
[
  { "stat": "logic.longest_path", "severity": "info",
    "reason": "driving_path_flag set on 1 of 3344 activities" },
  { "stat": "time.duration_working_days", "severity": "warn",
    "reason": "clndr_data parse failed for clndr_id 42" }
]
```

`issues[]` lets the detail page render its *partially analysed* banner without walking the whole
tree. Only `error`-state stats reach the banner.

A bare `null` would conflate four genuinely different situations, all of which occur in the real
fixtures:

| Situation | Example | Representation |
|---|---|---|
| **Degenerate but real** | Fixture B's `wbs_depth` genuinely is 1 | bare value `1` |
| **Inapplicable** | out-of-sequence on a 0%-progress tender | `state: "skip"` + reason |
| **Absent from source** | `driving_path_flag` unpopulated by P6 | `state: "unavailable"` + reason |
| **Computation failed** | undecodable `clndr_data`, cyclic logic | `state: "error"` + reason, plus `issues[]` |

The rule: **stats that always compute stay bare scalars; only stats that can fail are tagged.**
Wrapping `activity_count` in `{value, state}` would triple the file and force every consumer to
unwrap a value that never fails.

**Ingest never fails on a stat error.** Only tokenizer failure rejects an upload — if
`%T`/`%F`/`%R` cannot be read there is nothing to publish. Every stat-level failure is recorded
in `issues[]` and the programme publishes anyway. A half-analysed programme is still worth having
on the shelf, and silent upload rejection is the worst failure mode for a warehouse: the uploader
has no idea what went wrong and no way to fix it.

### 3.11 Size budget

| Component | Typical | Worst realistic |
|---|---|---|
| scalars (`shape`/`time`/`progress`/`logic`) | 2 KB | 3 KB |
| quality verdicts | 4 KB | 6 KB |
| quality exemplars (10 × 50 capped) | 25 KB | 25 KB |
| distributions | 5 KB | 12 KB |
| codes | 2 KB | 8 KB |
| **total** | **~40–60 KB** | **~55 KB** |

**Hard ceiling 150 KB.** Ingest logs a warning above 100 KB and fails the *stat computation* —
not the upload — above 150 KB, emitting a minimal `derived.json` plus an `issues[]` entry.

Every capped list exists to keep this figure flat as programme size grows: a 20,000-activity file
must produce a `derived.json` of the same order as a 3,000-activity one. For scale, Fixture B's
`.xer` is 6.81 MB raw and 911 KB gzipped — a 60 KB `derived.json` is ~15× smaller than the
gzipped file it summarises.

### 3.12 `activities.json`

Columnar — parallel arrays, one entry per activity — because that is what compresses and what a
virtualised table wants.

```jsonc
{
  "version": 2,
  "activities": {
    "task_id": [], "task_code": [], "task_name": [], "wbs_id": [],
    "task_type": [], "status_code": [],
    "target_drtn_hr_cnt": [], "remain_drtn_hr_cnt": [], "total_float_hr_cnt": [],
    "early_start_date": [], "early_end_date": [], "act_start_date": [], "act_end_date": [],
    "driving_path": []                      // v2: boolean per activity
  },
  "wbs": [ ["wbs_id", "parent_wbs_id", "wbs_short_name", "wbs_name"] ]
}
```

**`TASKPRED` and `TASKACTV` are out of the cut.** Including both doubles the file, and v1 has no
relationship view and no code-value filter — the codes panel renders from `derived.json`'s
counts.

Measured at the 20,000-activity cap:

| Cut | raw | gzip | brotli |
|---|---|---|---|
| **lean — shipped** | 2.98 MB | **340 KB** | 212 KB |
| lean + relationships | 4.01 MB | 521 KB | 305 KB |
| lean + codes | 5.74 MB | 469 KB | 300 KB |
| lean + both | 6.77 MB | 652 KB | 395 KB |

The v2 boolean array over 20,000 rows is noise against 340 KB, so the fetch budget, the 25 ms
parse and the one-object-not-shards decision all stand.

**The cut is Gantt-compatible, one named table short.** A virtualised time-scaled Gantt needs
bars, rows and colour — all already present — plus `TASKPRED` for dependency lines, priced at
**+181 KB gzipped**. Adding a Gantt later is an additive block on the same object rather than a
re-cut.

`activities.json` is fetched **lazily on approach** to the activity table; a visitor who never
reaches the table never fetches it. Everything above the table is server-rendered from
`derived.json`.

_Source: [The project detail page](docs/wayfinder/tickets/008-project-detail-page.md)_

### 3.13 Versioning, staleness and backfill

The blob path carries the version, so **a new version writes a new object**:

```
p/{programme_id}/r/{revision_id}/derived.v3.json
```

Nothing is overwritten. There is no CDN purge, old versions age out naturally, and rollback is
changing a number.

The Postgres `revision` row carries `derived_version` as its staleness marker. On programme open:

```
row.derived_version < CURRENT_VERSION
  → fetch the retained original .xer
  → reparse under the current parser
  → write derived.v<N>.json
  → update the row and its derived_version
```

One slow open, then hot forever. Recompute cost is spread across real traffic, and programmes
nobody opens cost nothing — which matters because *cheap* is a founding constraint and a
corpus-wide reprocess would re-read every blob.

**Card columns are the exception.** The grid reads them for programmes that are never opened, so
laziness would leave them permanently stale. A version bump touching a typed column or a `card`
JSONB key requires an **explicit backfill job** over rows below the current version. Bumps that
touch only `derived.json` do not — which is why the v2 and v3 bumps above carried no backfill
obligation.

Recompute is always possible because the original `.xer` is retained. Re-parsing the archived
blob is the only recovery path for fields an older parser dropped.

### 3.14 Promoting a stat to a facet

Typed Postgres columns are for values that are **sorted, ranged or faceted**; everything the card
merely prints lives in the `card` JSONB column. Adding a printed stat is free. **Promoting a
JSONB key to a typed column costs an `ALTER TABLE` plus a backfill**, and that price is paid only
when browse asks for a new facet. The full schema is section 2's.

---

## 4. Stack, hosting, storage, auth and cost

Everything in this section is fixed. The estate is **four hosted accounts plus a Google
console and GitHub**, costs **$0/month plus about $11/year**, and is designed so that the
first bill is a decision the operator takes rather than an event that happens to them.

### 4.1 The stack

| Layer | Choice | Version / plan tier | Cost at launch |
| --- | --- | --- | --- |
| Framework | **Next.js**, App Router | **16** — every caching decision was taken against 16.3.0 docs; the `cacheComponents` flag is **off** (§4.6) | — |
| Language | **TypeScript** | — | — |
| Parser | **isomorphic TypeScript**, no Node built-ins, no runtime dependencies | runs authoritatively in a Vercel Function; the same module runs in the browser, advisory only | — |
| Hosting | **Vercel**, **Hobby** plan | 300 s max duration, 2 GB / 1 vCPU, **4.5 MB request body cap on every plan**, 1 seat, 1 h runtime log retention, no log drains, 100 deployments/day, 50 custom domains/project, cron limited to 1 run/day ±59 min | **$0** → $20/seat/mo on a trigger (§4.5) |
| Blob store | **Cloudflare R2** | Free tier: 10 GB-month, 1M Class A, 10M Class B; **egress is not a line item**. A payment method is required even inside the free tier | $0 at launch, **$0.23/mo** at 10,000 programmes |
| Database | **Neon Postgres**, Free plan | 0.5 GB storage, 100 CU-hr, 5 GB egress, 10 branches/project; **scale-to-zero after 5 min idle**, restart in a few hundred ms, not disableable on Free | **$0** |
| DB access | **Drizzle ORM + drizzle-kit** over `drizzle-orm/neon-http` | HTTP driver — **batched, non-interactive transactions only**; no WebSocket pool | — |
| Auth | **Clerk**, Free (Hobby) tier | 50,000 monthly-retained users, then $0.02/MRU. Custom domain and webhooks included; MFA, passkeys, SMS and custom session lifetime are not | **$0** |
| Charts | **hand-rolled inline SVG in server components**, no library | rule: any chart whose data is known at request time renders as server-generated SVG; a runtime library enters only when interaction is the requirement | — |
| Upload transport | browser gzips (`CompressionStream`) and **PUTs presigned directly to R2** | forced by the 4.5 MB body cap against 4.8 MB and 6.8 MB real fixtures. Upload page requires `CompressionStream`, `Blob.stream()`, `crypto.subtle` **and a secure origin**; no fallback | — |
| CI | **GitHub Actions** | free on a public repo; also runs the 15-minute sweep schedule | $0 |
| Registrar + DNS + CDN | **Cloudflare Registrar** and a **Cloudflare Free zone** | sold at cost; Free zone gives 10 Cache Rules, 10 Response Header Transform Rules, purge-by-URL at 800 URLs/s and 100 URLs/request | **~$11/yr** |
| Google OAuth | one **Google Cloud project** + one Web-application OAuth client | free; no billing account attached, no API enabled | $0 |

Deliberately rejected, so nobody re-opens them: **Cloudflare Workers + Pages** (Next.js only
via the OpenNext adapter — a permanent adapter-lag tax to save $0.23/month); **Supabase**
Postgres and Auth (Free *pauses* the project after a week idle, which takes auth down with
it); **Auth.js** (maintenance-only; its own team points at Better Auth); **Better Auth**
(equal on cost, but the Google identity would live in our Postgres); **Prisma / Kysely /
plain `pg`**; **Recharts** (client-only). Observable Plot is named as the default *if* the
detail page ever needs interaction, with visx as fallback — that choice belongs to the
detail-page section, not here.

> **GAP:** No ticket fixes the package manager or the Node version the application targets.
> `pnpm` is the only manager ever named in the closed set, and only incidentally
> (`pnpm test:edge-contract`, `pnpm update` in 024's asset); the *"Node ≥ 18, no
> dependencies"* posture is stated for `tools/fixture-gen`, not for the app.

> **GAP:** No ticket fixes which Vercel Function runtime the app uses (Node.js vs Edge).
> Nothing in the stack forces it — the Neon HTTP driver, the AWS S3 presigner and the
> isomorphic parser all run on either — but it is a build-time choice with no owner.

_Source: [Stack, hosting and auth provider](docs/wayfinder/tickets/010-stack-hosting-auth.md), [What does storage actually cost?](docs/wayfinder/tickets/004-storage-cost-model.md), [The client-side parse budget](docs/wayfinder/tickets/020-client-parse-budget.md), [Confirm the pre-upload scan on mobile Safari](docs/wayfinder/tickets/029-confirm-scan-on-safari.md), [How is a public page with per-viewer state cached?](docs/wayfinder/tickets/035-caching-per-viewer-state.md)_

### 4.2 The hosting estate: every account required

| Account | Who needs it | Payment method | What it holds |
| --- | --- | --- | --- |
| **Vercel** | operator | not required on Hobby | the app, its env vars, the custom domains, the daily backstop cron |
| **Cloudflare** | operator | **required** — R2 cannot be enabled without one, even inside the free tier | the registered domain, the DNS zone, the R2 bucket, the CDN cache, the purge API |
| **Neon** | operator; contributors only in the hosted fallback | not required on Free | Postgres, plus one branch per preview deploy via the Neon–Vercel integration |
| **Clerk** | operator **and every contributor at dev tier 2** | not required | the Google identity, sessions, the Google client id and secret |
| **Google Cloud + Google Search Console** | operator only — **one Google account must own both**, as GCP Project Owner and Search Console verifier | not required (whether a billing account is demanded at project creation is unverified; nothing depends on it) | the OAuth client, the consent screen, the domain verification |
| **GitHub** | operator and contributors | not required | the public repo, CI, the 15-minute sweep schedule, branch protection, the estate's only outbound mail path |

The operator's **laptop** is a fifth location and holds three things that are never in Vercel
and never in the repo: the production Neon connection string, an R2 **admin** token, and a
**purge-scoped** Cloudflare API token. The takedown CLI and `ops bucket check` run there.

Deploys come from Vercel's Git integration; there is no deploy step in CI. Preview deploys
run for branches, and **fork PRs get CI only** — Vercel does not expose environment
variables to forked-PR builds, and here that default is the intended policy. "Deploy-blocking"
means a **required GitHub status check on `main`**, because Hobby's build runs before the
deployment exists and has no promotion gate; the honest residue is that the operator is the
repo admin and can push past their own branch protection.

_Source: [Stack, hosting and auth provider](docs/wayfinder/tickets/010-stack-hosting-auth.md), [Local development and contributor onboarding](docs/wayfinder/tickets/018-local-dev-and-onboarding.md), [The blob host and the site's domain](docs/wayfinder/tickets/025-blob-host-and-domain.md), [Google OAuth in production](docs/wayfinder/tickets/027-google-oauth-in-production.md), [Verifying the production-only edges](docs/wayfinder/tickets/024-verifying-production-only-edges.md)_

### 4.3 The domain and the hostname map

**One registrable domain, four hostname families, no second registration.** The recommended
name is **`xerhero.com`** (unhyphenated; `.dev` and `.org` were the alternatives and any of
the three works — this is the one line that is the dev's taste). Do **not** defensively
register variants: a second registration doubles the estate's only recurring cost.

The domain is not a takedown expense. It is the **first item on the launch runway**, because
Clerk cannot run a production instance without a domain you own — *"You will need to have a
domain you own"* — and development instances are capped at 100 users. It gates sign-in →
presign → upload, not merely purge.

| Hostname | Serves | DNS record | Cloudflare proxy | Notes |
| --- | --- | --- | --- | --- |
| `xerhero.com` (apex) | the site on Vercel — **canonical** | `A @ → 76.76.21.21` | **DNS only** (grey) | Vercel *"do not recommend using a reverse proxy in front of Vercel"* |
| `www.xerhero.com` | **308 redirect → apex** | `CNAME → cname.vercel-dns-*.com` (project-specific; read it from `vercel domains inspect`) | **DNS only** | one canonical host, so an immutable `/p/{slug}` has exactly one prefix |
| `xer-hero.vercel.app` | **redirect → apex** | — | — | must be made to redirect, not merely deprecated: two live hosts serving the same path mints a second URL for every programme, and it breaks quietly in other people's bookmarks |
| `blobs.xerhero.com` | the R2 bucket (custom domain) | created by R2 when the domain is connected | **proxied** (orange) | Cloudflare must be in path for cache, purge, Cache Rules and Transform Rules. This is the first place in the estate where two hostnames on one zone are configured in opposite ways |
| `clerk.`, `accounts.`, `clkmail.`, `clk._domainkey`, `clk2._domainkey` | Clerk production | per the Clerk dashboard | **DNS only** | Clerk: *"If this subdomain is reverse proxied behind a service that points to generic hostnames, such as Cloudflare, the DNS check will fail"* |
| `pub-….r2.dev` | **nothing — must stay disabled** | — | — | if it is live alongside the custom domain the bucket has two public origins, a purge hits one, and a takedown reports success while the bytes are still fetchable. Asserted by `ops.r2dev.disabled`, a config read run from the laptop |

`robots.txt` governs its own origin and nothing else, which is the whole argument for one
registrable domain: `blobs.xerhero.com/robots.txt` carrying `Disallow: /` says nothing about
`xerhero.com`. A separate *hostname* was required; a separate *domain* never was.

**One Cloudflare Cache Rule is required, not optional.** Cloudflare's default cached-extension
list includes `GZ` but *"does not cache HTML or JSON by default"*, so `derived.v{N}.json` —
the object read most — would miss the cache entirely:

```
When  hostname eq "blobs.xerhero.com"
Then  Cache eligibility: Eligible for cache
      Edge TTL: Use cache-control header from origin
```

Deliberately **not** "Cache Everything with an Edge TTL override": the one-hour TTL on
`original.xer.gz` has to reach the edge from the object's own header, or the takedown story
breaks invisibly until a takedown. Confirm also that **no Response Header Transform Rule
touches the blob host**.

Two recorded hazards, neither engineered away. A cookie scoped to `.xerhero.com` would reach
`blobs.xerhero.com`; the `activities.json.gz` fetch is cross-origin and credential-less and
`derived.json` is fetched server-side, so the only cookie-bearing request is the user's own
download navigation, terminating at Cloudflare — **confirm Clerk's session-cookie `Domain`
attribute at provisioning; if it is host-scoped the hazard does not exist.** And the domain
renewal gets **no rule**: auto-renew is on by default, the registrar mails about expiry, and
a lapsed domain stops resolving, which reddens `edge_drift` within fifteen minutes. It is the
one clock in the estate that alarms *after* it fires rather than before.

> **GAP:** The `www` → apex redirect is fixed at **308**; the status code for the
> `*.vercel.app` → apex redirect is never stated. Only that it must be a redirect is decided.

_Source: [The blob host and the site's domain](docs/wayfinder/tickets/025-blob-host-and-domain.md), [Verifying the production-only edges](docs/wayfinder/tickets/024-verifying-production-only-edges.md), [Personal data in published .xer files](docs/wayfinder/tickets/013-personal-data-in-published-files.md)_

### 4.4 Storage: what is stored, what it weighs, what it costs

**The founding premise was wrong: there is no dangerous egress cost.** At 10,000 programmes
and busy traffic the entire blob bill is under $1/month on every provider priced, S3 included.
A gzipped `.xer` is ~600 KB, so 1 TB of egress is ~1.75 million downloads a month — a volume
this project does not reach without becoming something else.

**Three objects per revision, id-addressed**, at `p/{programme_id}/r/{revision_id}/`:

| Object | Gzipped size (measured on three real fixtures) | `Cache-Control` | Other headers | Read when |
| --- | --- | --- | --- | --- |
| `original.xer.gz` | 403 / 584 / 872 KB → **400–870 KB** | `public, max-age=3600` — **no `immutable`** | `Content-Encoding: gzip`, `X-Robots-Tag: noindex, noarchive` | someone clicks Download |
| `activities.json.gz` | 185 / 194 / 277 KB → **185–277 KB** | `public, max-age=31536000, immutable` | `Content-Encoding: gzip` | the detail page opens (fetched by the browser, from R2) |
| `derived.v{N}.json` | **~15 KB** (from the contract's 40–60 KB typical at ~3.5:1) | `public, max-age=31536000, immutable` | — | the detail page opens (fetched server-side) |
| **total** | **~0.85 MB per revision** (low 0.60, high 1.16) | | | |

`original.xer.gz` is the one object holding personal data, and it carries three special
properties as one coherent rule rather than three exceptions: **noindex, a 1-hour TTL, and a
30-day Class B quarantine.** The year-long immutable cache the other two keep is what makes
"bytes hard-delete" untrue for a PI-bearing file, so it drops.

Everything is **stored already compressed** and served with `Content-Encoding: gzip` — never
compressed on the fly, because then the stored bytes are billed uncompressed too. Measured
ratios: 7.1:1, 8.3:1, 7.8:1. Serving gzipped moves the egress cliff out **8×** (218,000
downloads per TB → 1,750,000) and is worth more than any provider switch short of R2.
**Forks are stored as full copies**; delta-compressing Fixture B's near-identical siblings
would save ~$0.30/month at the 10,000-programme mark.

**A full `parsed.json` is not stored.** Measured, it gzips to the same size as the `.xer` it
came from — 919 KB against 872 KB on Fixture B, i.e. *larger* — so it doubles the footprint
and buys no transfer saving over re-parsing.

**Corpus scale**, at the base model of 3 revisions per programme:

| Programmes | Revisions | Blob at 0.85 MB/rev | Postgres (rows) | Postgres (with indexes) |
| --- | --- | --- | --- | --- |
| 100 | 300 | 255 MB | 0.6 MB | — |
| 1,000 | 3,000 | 2.6 GB | 6 MB | — |
| **10,000** | **30,000** | **25.5 GB** | **60 MB** | **~150 MB** |

Sensitivity at 10,000 programmes: 8.5 GB at 1 revision each, 85 GB at 10. **Postgres size
never binds** — ~2 KB per revision, comfortably inside Neon's free 0.5 GB. Postgres *uptime*
is what binds.

**Traffic and the bill.** The grid renders from Postgres with zero blob reads, so page views
barely enter. An open costs ~245 KB (`activities.json` + `derived.json`); a download costs
~600 KB.

| Tier | page views | opens | downloads | blob egress |
| --- | --- | --- | --- | --- |
| Quiet | 5,000 | 500 | 200 | 0.24 GB/mo |
| Modest | 50,000 | 5,000 | 2,000 | 2.4 GB/mo |
| Busy | 500,000 | 50,000 | 20,000 | **24 GB/mo** |

At 10,000 programmes and Busy traffic, R2 bills **$0.23/month**: 15.5 GB over the free 10 GB
at $0.015/GB-month, **$0 egress**, and both operation classes inside the free allowance. For
reference at a volume this project will not see — 1 TB/month of egress — the providers finally
diverge: R2 **$0**, Backblaze B2 $9.24, Vercel Blob $47.70, Supabase $67.50, S3 $81.00. S3
and Supabase Storage were ruled out on the *shape* of a $0.09/GB egress line, not its size.

**The cliff is the platform floor, not the bytes.** Below it, **$0/month plus ~$11/year**;
the free tiers carry roughly **4,000 programmes** (10 GB ÷ 0.85 MB ÷ 3 revisions). It is
crossed the day the database may no longer sleep, or a second seat is needed, or Hobby stops
fitting — and above it the bill is **~$20–45/month, flat in corpus size**: Vercel Pro $20/seat
+ always-on Neon (0.25 CU × 730 h × $0.106 ≈ $19) + R2 ~$0.25.

**The domain is the only cost that responds to no variable at all** — not corpus, not traffic,
not users, not plan. Cloudflare Registrar sells at cost, so a `.com` is Verisign's registry
price plus ICANN's fee: **≈$10.46/year today, ≈$11.17/year from 1 November 2026** when
Verisign's 7% increase lands. Call it **$0.93/month**. It is better described as a subscription
to the project existing than as a floor, and it is what makes the estate *cheap* rather than
*free*.

_Source: [What does storage actually cost?](docs/wayfinder/tickets/004-storage-cost-model.md), [What tooling does the operator need to run a takedown?](docs/wayfinder/tickets/017-operator-takedown-tooling.md), [The blob host and the site's domain](docs/wayfinder/tickets/025-blob-host-and-domain.md), [Domain model and schema](docs/wayfinder/tickets/005-domain-model-and-schema.md)_

### 4.5 Free-tier meters and the fraction each is projected to consume

**Vercel Hobby publishes five metered resources.** Projections are at the design target of
10,000 programmes (≈10,300 public URLs, ~60,000 bot fetches, 30,000 programme views and
10,000 shelf views a month) under the chosen caching strategy.

| Meter | Hobby allowance | Projected at 10,000 programmes | Note |
| --- | --- | --- | --- |
| **Active CPU** | 4 CPU-hr = 14,400 CPU-s | ~4,400 s = **31%** (0.6% at launch) | the **binding meter for renders**; binds at ~288,000 uncached programme renders/month. I/O is not billed — Neon queries and R2 GETs cost nothing here |
| **Fast Origin Transfer** | up to 10 GB | ~2.8 GB = **28%** | **the tightest of the five against this design**, and the one that responds to *page weight* — the number that moves the next time something is added above the fold |
| Invocations | 1,000,000 | ~93,000 = **9%** | binds 3.5× later than Active CPU, so it never decides anything |
| Fast Data Transfer | 100 GB | not projected; 500,000 page views at a ~50 KB warm payload is 25 GB | `activities.json` never touches it — the browser fetches it from R2 |
| Provisioned Memory | 360 GB-hr | not projected | — |
| Image transformations | 5,000 | **0** | there are no avatars in v1 |
| ISR reads/writes | not metered on Hobby | — | they appear only on Pro's on-demand table; *"CDN cache reads and writes are free"* |

| Other tier | Allowance | Projected |
| --- | --- | --- |
| **R2** storage | 10 GB-month | 25.5 GB at the target → over, at **$0.23/mo** |
| R2 Class A (writes) | 1,000,000/mo | ~7,500 = 0.75% |
| R2 Class B (reads) | 10,000,000/mo | ~70,000 = 0.7% |
| R2 egress | no line item | — |
| **Neon** storage | 0.5 GB | ~150 MB = **30%** |
| Neon compute | 100 CU-hr, shared across branches | not projected; scale-to-zero at 5 min |
| Neon branches | 10 per project | one per open preview PR, deleted when the PR closes |
| **Clerk** | 50,000 monthly-retained users | *"this project will not approach it"*. The dev instance's 100-user cap is the only Clerk limit that ever binds |
| **Google** OAuth | Testing's 100-user cap and the unverified-published cap both **exempt** these scopes | no cap applies |
| **GitHub Actions** | free on a public repo | CI plus a 15-minute sweep schedule |

**Hobby → Pro is taken on a trigger, not a date.** $20/seat/month.

| # | Trigger | Status |
| --- | --- | --- |
| 1 | Log drains needed | does not fire — observability is Postgres rows, not log lines |
| 2 | Runtime log retention beyond 1 hour | does not fire, same reason |
| 3 | A second collaborator seat | operator's choice |
| 4 | Active CPU crossing 4 CPU-hr/month | does not fire, but this is the first decision in the effort where it is **within one order of magnitude** — 31% against the sitemap's 0.15% |
| 5 | GitHub Actions schedule drift making the retry cadence unreliable | Pro's once-per-minute cron is the fix |

**None of the five is watched, deliberately.** A trigger is a budget decision rather than a
correctness event; three of the five are things the operator chooses, Active CPU is the only
one that arrives unbidden and Vercel already mails the account owner about usage thresholds.
Watching any of them would put a Vercel API token in the app to read a number the vendor
already sends.

Hobby's non-commercial restriction was **checked, not assumed**: Vercel defines commercial as
deployment for the financial gain of anyone involved in production — payments, advertising,
affiliate linking, ad platforms and explicitly donations. This site has none, so Hobby is
legal for it and the $0 left-hand side holds.

Every per-render CPU figure above is an **estimate**, anchored on the only render anyone has
costed (~30 ms for the sitemap). There are no analytics and one hour of runtime logs, so
nothing in the estate can measure a render, and the cache hit rate is unknowable (Vercel's
ISR observability is behind a Pro feature). The design is deliberately correct at a hit rate
of zero.

_Source: [Stack, hosting and auth provider](docs/wayfinder/tickets/010-stack-hosting-auth.md), [How is a public page with per-viewer state cached?](docs/wayfinder/tickets/035-caching-per-viewer-state.md), [What does storage actually cost?](docs/wayfinder/tickets/004-storage-cost-model.md), [Verifying the production-only edges](docs/wayfinder/tickets/024-verifying-production-only-edges.md), [Operating and observing ingest](docs/wayfinder/tickets/019-ingest-observability.md)_

### 4.6 Caching a public page that carries per-viewer state

**The rule, and it is one sentence:**

> A public route renders one artefact, and that artefact is the **signed-out render**. Nothing
> on a public route reads the session on the server. Everything that depends on who is looking
> arrives in the browser, from one request, after paint.

Which gives the routing rule: **a public route is cached exactly when its content is a pure
function of its path.**

#### 4.6.1 The middleware matcher, which is the load-bearing line

Vercel's Routing Middleware *"runs globally **before the cache**"* and is billed on the same
fluid-compute meters as everything else. Clerk's quickstart matcher covers every page route —
installed as documented, it would put a billed invocation in front of every CDN hit, and the
whole caching strategy would be worth nothing, *invisibly*. So the matcher is scoped:

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

Nothing public is in that list, and Clerk's own documentation argues for the narrowing:
*"Middleware is not the best place to protect routes"*. The narrowing pays twice, because
`auth()` *"Requires `clerkMiddleware()` to be configured"* — so **`auth()` structurally cannot
work on a public page.** A developer who reaches for the session on `/p/{slug}` gets an error
on the first request instead of an uncacheable page discovered by a bill. Clerk's middleware
also refreshes the session cookie, and a response carrying `Set-Cookie` is uncacheable by
Vercel's own criteria — the matcher answers the cost and the correctness with one line.

`<ClerkProvider>` stays in the root layout **without** the `dynamic` prop.

#### 4.6.2 Per-route class

| Route class | Render | Cache directive | Function runs on a hit? |
| --- | --- | --- | --- |
| `/p/{slug}`, `/p/{slug}/r/{n}` — published, tombstoned, or 404 | **ISR** | `export const revalidate = 3600` | **no** — *"Vercel serves the response immediately from the CDN. Your function doesn't run."* |
| `/contributors` | **ISR** | `export const revalidate = 3600` | no |
| `/sitemap.xml` | ISR | `revalidate = 3600` | no |
| `/`, `/?page=N`, every facet / `q` / `sort` variant, `/u/{handle}` | **dynamic, and not by choice** | no TTL is available; the two Postgres queries behind the shelf are wrapped in `unstable_cache` at **60 s** | yes, every request |
| `/about`, `/terms`, `/terms/v{n}`, `/privacy`, `/privacy/v{n}`, `/report` (shell), `/robots.txt` | **static**, at deploy | — | no |
| `/api/viewer` | dynamic | **`Cache-Control: private, no-store`** | n/a |
| `/me/*`, `/ops` | dynamic, behind `clerkMiddleware` | never cached | n/a |

The dynamic set is dynamic because `searchParams` is *"a Request-time API whose values cannot
be known ahead of time. Using it will opt the page into dynamic rendering at request time"* —
a framework fact, not a preference, and there is no per-parameter split available. The 60-second
`unstable_cache` window means the render is CPU-only and the database sees at most one shelf
query a minute at any traffic. A new upload therefore reaches the shelf within 60 s, which does
not matter: the uploader's path to their own upload never goes through the shelf, and under a
frozen newest-first order a minute's lag moves one row. (60 s is overturnable taste; 300 s is
equally defensible.)

The invariant this buys: **no route in this estate can serve a stale `index` after a tombstone
commits for longer than one hour.** Every route with a status-derived head tag is either cached
with a bounded TTL or not cached at all.

#### 4.6.3 The per-viewer request

```
GET /api/viewer?p=<uuid>,<uuid>,…       (≤ 25 ids; 1 on a detail page; 0 on a static page)

200 application/json
Cache-Control: private, no-store

{ "handle": "planner-a3f92c" | null,
  "notices": { "failed": false, "removal": false },
  "voted": ["<uuid>", …],
  "bookmarked": ["<uuid>", …] }
```

Two SQL statements in **one `neon-http` batch, one HTTP round trip**, ~3 ms of Active CPU. It
is **fired only when a Clerk session cookie is present** — a signed-out visitor, a crawler and
a link unfurler issue **zero** extra requests, which is what makes the split free for the large
majority of traffic and is the property the whole cost case rests on.

Every owner-conditional element on a public page is a client-side mount driven by that same
request: both pressed states, the header's `Sign in` → `Upload · {handle}` swap, the owner link,
the in-place edit affordance and the Class A withdraw button. There is **no layout shift**,
because both controls are already drawn unpressed at their fixed x in the cached HTML and the
response changes only a fill. Two accepted residues: a brief unpressed flash for a signed-in
viewer between paint and the response, and the rare header notice, which does push the page down.

#### 4.6.4 Invalidation

> **Invalidate where the write already runs inside the app; rely on the TTL where the write
> runs on the laptop.**

| Event | Action |
| --- | --- |
| **Publish** (ingest writes `current_revision_id`) | **`revalidatePath('/p/[slug]', 'page')`** — required. The slug is immutable and the Programme is created at intent, so `/p/{slug}` 404s before the bytes are parsed, and a cached 404 would outlive the publish by up to an hour |
| Class A self-withdrawal, owner title/sector edits | `revalidatePath('/p/{slug}')` — in-process Server Functions, free, no endpoint, no secret |
| Class B cascade (runs on the laptop) | **nothing.** Reaching `revalidatePath` from a CLI would need a public Route Handler, a shared secret and retry semantics. The one-hour TTL stands; the fast path for an urgent case is Search Console Removals |
| A vote | **nothing**, deliberately. A stale `vote_count` reorders nothing under a frozen default order, and a purge per vote would be the most expensive write in the system |

One consequence, paid: a route cannot serve a 404 to one viewer and a page to another, so
`/p/{slug}` **404s to everyone until publish**, and the owner's view of an unpublished upload
is `/me`.

#### 4.6.5 Cache Components: examined and refused, with a dated revisit condition

Next.js 16's Cache Components (`cacheComponents: true`) is the textbook answer to this question
and is **off**. *"HTML-limited bots skip the prerendered shell and render the page dynamically"*
— so every crawler fetch of every one of 10,300 sitemap URLs becomes a Function invocation, a
Neon query and an R2 GET, converting the estate's largest and fastest-growing traffic class from
free to billed. Second reason: it gives one page two render paths, and *"a page that loads for a
person can fail to render for a crawler"* — with no analytics and one hour of logs, nothing here
could notice. The refusal is **dated, not principled**: revisit if the signed-in surface ever
outgrows the crawl surface. Because the flag being off is a decision rather than a default, it
gets a CI assertion.

#### 4.6.6 What is asserted

| Key | Where | Expect |
| --- | --- | --- |
| `ci.middleware.public_routes_excluded` | CI | evaluate the exported `config.matcher` against the `PUBLIC_ROUTES` constant — no public route matches |
| `ci.render.no_server_session_read` | CI | `auth(`, `currentUser(`, `clerkClient`, `<SignedIn`, `<SignedOut` appear nowhere under the public route tree |
| `ci.cache.programme_page_is_isr` | CI | the build output for `/p/[slug]` is prerendered with `revalidate: 3600` |
| `ci.cache.no_set_cookie_on_public_render` | CI | no `Set-Cookie` on any public response |
| `ci.cache.publish_revalidates_slug` | CI | the ingest publish path calls `revalidatePath` with the published slug |
| `ci.viewer.private_no_store` | CI | `GET /api/viewer` returns `Cache-Control: private, no-store` |
| `ci.viewer.signed_out_is_zero_requests` | CI | a shelf page rendered with no session cookie issues **no** request to `/api/viewer` |
| `ci.cachecomponents.disabled` | CI | `cacheComponents` is absent or `false` in `next.config` |
| `edge.site.programme_cached` | the 15-minute sweep, on `edge_drift` | two unauthenticated GETs of a known-published `/p/{slug}`: the second returns `x-vercel-cache` in `{HIT, STALE, PRERENDER}`, and neither carries `Set-Cookie` |

_Source: [How is a public page with per-viewer state cached?](docs/wayfinder/tickets/035-caching-per-viewer-state.md), [The site's own crawl surface](docs/wayfinder/tickets/033-site-crawl-surface.md), [What tooling does the operator need to run a takedown?](docs/wayfinder/tickets/017-operator-takedown-tooling.md), [Upload and ingest pipeline](docs/wayfinder/tickets/011-upload-ingest-pipeline.md)_

### 4.7 Auth

**Clerk, Free plan, and free is the steady state rather than a runway.** Clerk was not chosen
on cost — Better Auth is $0 too — but because **the Google identity never enters our schema**,
which turns the erasure position from a routine we must write correctly into a structural fact.
Under direct OAuth, Neon's point-in-time recovery would keep a "deleted" email restorable for
days; under Clerk there is nothing to erase, because the email was never written.

| Concern | Decision |
| --- | --- |
| What the app stores | `app_user` holds `clerk_user_id` (text, unique), `display_name` (the Handle) and `created_at`. **No `google_sub`, no `email`.** The Handle is authoritative in our Postgres, never Clerk's `username` |
| Account deletion | two acts: delete the Clerk user, write the Handle to `reserved_handle`. Our rows first, then Clerk — the reversible half commits first |
| Consequences accepted | **the app can never send email** (no fork notifications, no deletion confirmations); takedown correspondence is a Clerk dashboard lookup, so Clerk is load-bearing for a legal process; migrating off Clerk requires a user export first or every `clerk_user_id` points at nothing |
| Session | Clerk's session cookie, **fixed 7-day lifetime** (custom lifetime is a paid feature and is not bought). Refreshed by `clerkMiddleware`, which is why the middleware must not run on public routes. Confirm the cookie's `Domain` attribute at provisioning (§4.3) |
| Middleware-protected paths | `/me/:path*`, `/ops/:path*`, `/api/:path*`, `/__clerk/(.*)` — and **nothing else** |
| Components | `<SignedIn>` / `<SignedOut>` plus a plain Handle link. **Clerk's `<UserButton>` is refused** — it renders the Google profile image |
| Avatars | none in v1; an identicon derived from the Handle. `picture` arrives with the non-removable `profile` scope, so **the only thing standing between a Google profile image and a page on this site is the rule that nothing renders `user.imageUrl`** |
| Webhooks | declined. `user.created` would cost a public endpoint, a signing secret, svix and retry semantics to move a row creation off a path that already needs it |
| `/ops` authorisation | an **env-var allowlist of Clerk user ids**, checked as one equality against the session. No role in a vendor UI, no column, no grant UI; changing it is a redeploy |
| Branding | "Secured by Clerk" stays. Removing it is $25/month and was declined |

**Two OAuth clients, in two different worlds.**

| Instance | Google credentials | User cap |
| --- | --- | --- |
| **Development** (every contributor, and the operator locally) | **Clerk's own shared, pre-configured credentials — no Google Cloud project is ever needed by a contributor** | 100 users; irrelevant |
| **Production** | **our own** Web-application OAuth client, in our own Google Cloud project, with *Use custom credentials* enabled in Clerk and the app swapped to `pk_live_` / `sk_live_` | none applies |

The consent screen a contributor sees in development is Clerk's, and **predicts nothing** about
what a user sees in production.

**Scopes: `openid`, `email`, `profile` — exactly three, all non-sensitive.** They return `sub`;
`email` and `email_verified`; `name`, `given_name`, `family_name`, `picture`, `locale`. All of
it stops at Clerk. Requesting `email` is not optional — Clerk pre-configures these as essential
scopes with no documented way to remove them — and dropping it would move no limit and remove
no warning. **Adding anything sensitive converts the whole story below into a review.**

**Publishing the consent screen: no review, no queue, no fee, no interstitial.** Verification is
triggered by sensitive or restricted scopes and by nothing else; *"If your app utilizes only
non-sensitive scopes, it is not mandatory for your app to complete the app verification
process."* Moving Testing → In production is a state change, not a submission. The
*"Google hasn't verified this app"* Danger UI and the 100-user cap are both conditioned on the
same sensitive/restricted clause, so a planner signing in sees a plain consent screen. (Clerk's
own documentation misstates this — it claims a verification process gates the switch. Follow
Clerk's instruction, ignore its stated reason.)

**What is actually broken without action is a name, not a warning.** *"The app name will be
displayed on the OAuth consent screen only if your app has been verified."* An unverified
published app is anonymous on its own consent screen, and with Clerk in the flow the substitute
string is plausibly `clerk.xerhero.com` — a hostname that appears in no address bar. So **brand
verification is done, and the app is branded `xer-hero`**: free, automated, *"typically takes a
few minutes"*, with a 2–3 business-day manual fallback. **No logo in v1.** It requires a
**published** status and a homepage that is on the verified domain, reachable without login,
fully describes the app's functionality and explains why it requests user data, with a privacy
policy hosted on the same domain — so it **cannot run until the site is live**, and it is
post-launch work that costs a wrong name until it is done, not a launch blocker.

**Domain authorization is a DNS record and can happen before anything serves.** Google requires
a Search Console **Domain property** (DNS-level; URL-prefix, HTML file, tag, Analytics and Tag
Manager are all ruled out), verified by **the same Google account that is a Project Owner of the
Google Cloud project**. One authorized domain covers `clerk.`, `accounts.`, `www.` and the apex.
Authorized domains must be added **before** any redirect URI, origin, homepage, terms or privacy
URL. Two single points of failure are recorded rather than solved: that one Google account, and
that TXT record — a zone rebuild that drops it silently un-verifies the domain, and `edge_drift`
cannot catch it because an already-verified app keeps working.

**Nothing Google-related enters our environment.** The Client ID and Secret are pasted into
Clerk's dashboard, not into Vercel env vars, not into `.env.example`, not into the repo. The
estate's secret inventory grows by **zero values**; it grows by one console and one DNS record.

_Source: [Stack, hosting and auth provider](docs/wayfinder/tickets/010-stack-hosting-auth.md), [Google OAuth in production](docs/wayfinder/tickets/027-google-oauth-in-production.md), [The blob host and the site's domain](docs/wayfinder/tickets/025-blob-host-and-domain.md), [The signed-in user's own space](docs/wayfinder/tickets/023-signed-in-users-own-space.md), [Operating and observing ingest](docs/wayfinder/tickets/019-ingest-observability.md), [Licensing, attribution and takedown](docs/wayfinder/tickets/003-licensing-attribution-takedown.md)_

### 4.8 Environment variables and secrets

**Secrets live only in Vercel env vars, GitHub Actions secrets, the operator's local `.env`,
or Clerk's dashboard — never in the repo.** `.env.example` is committed with names and, for
the local stack only, **working dev defaults** (the MinIO root credentials, the local Postgres
password, the proxy endpoint) because they guard nothing and every value a contributor has to
invent is a step that can go wrong. `.env.local` is gitignored. Fork PRs receive no environment
variables at all, which is why the whole local stack has to run without any.

| Value | Lives in | Secret? | Notes |
| --- | --- | --- | --- |
| `S3_ENDPOINT` | Vercel env (production: R2's `<ACCOUNT_ID>.r2.cloudflarestorage.com`) / `.env.example` (dev: MinIO) | no | **the only env var name fixed by a closed ticket.** It is the entire dev↔prod blob swap |
| R2 object read/write token (access key id + secret) | **Vercel env** | **yes** | object read/write **only**; minted at provisioning step 10 |
| Blob host base URL (`https://blobs.xerhero.com`) | Vercel env + `.env.example` | no | never a literal in code, so CI can point the same code at MinIO |
| Neon connection string / HTTP fetch endpoint (`neonConfig.fetchEndpoint`) | Vercel env (prod) / `.env.example` (local proxy) | **yes** in prod | the second endpoint swap; Docker Postgres is not a drop-in for `neon-http` without it |
| Clerk publishable key | Vercel env, `NEXT_PUBLIC_`-style client exposure | no | `pk_test_` in dev, **`pk_live_`** in production |
| Clerk secret key | Vercel env | **yes** | `sk_test_` in dev, **`sk_live_`** in production. The one value a contributor must supply themselves, at dev tier 2 |
| Sweep bearer secret | **Vercel env *and* GitHub Actions secrets** | **yes** | the scheduled workflow POSTs `/api/sweep` with it every 15 minutes |
| `/ops` operator allowlist (Clerk user ids) | Vercel env | no, but privileged | one greppable equality; changing it is a redeploy |
| Google OAuth Client ID + Client Secret | **Clerk's dashboard only** | secret (the secret half) | never in Vercel, never in `.env.example`, never in the repo |
| R2 **admin** token | operator's local `.env` | **yes** | `ops bucket apply` / `ops bucket check` |
| Purge-scoped Cloudflare API token (Zone → Cache Purge) | operator's local `.env` | **yes** | takedown step 3 |
| Production Neon connection string (CLI) | operator's local `.env` | **yes** | the Class B cascade needs an interactive transaction, which `neon-http` cannot open |

> **GAP:** Beyond `S3_ENDPOINT`, no ticket fixes the *names* of any environment variable. The
> roles above are all decided; the identifiers are not, so `.env.example` has no authoritative
> key list.

_Source: [Stack, hosting and auth provider](docs/wayfinder/tickets/010-stack-hosting-auth.md), [Local development and contributor onboarding](docs/wayfinder/tickets/018-local-dev-and-onboarding.md), [The blob host and the site's domain](docs/wayfinder/tickets/025-blob-host-and-domain.md), [What tooling does the operator need to run a takedown?](docs/wayfinder/tickets/017-operator-takedown-tooling.md), [Operating and observing ingest](docs/wayfinder/tickets/019-ingest-observability.md), [Upload and ingest pipeline](docs/wayfinder/tickets/011-upload-ingest-pipeline.md), [Google OAuth in production](docs/wayfinder/tickets/027-google-oauth-in-production.md)_

### 4.9 Local development: clone to running app

**Production takes four hosted accounts; development takes one.** Every substitution is an
**endpoint swap, not an adapter**, because the production clients are already vendor-neutral:
R2 presigning is stock `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` pointed at an
endpoint, and the Neon serverless driver takes a `neonConfig.fetchEndpoint`. Neither vendor is
named anywhere in product code — both are named in an environment variable.

**The README's documented contract:**

| Tier | Prerequisites | What works |
| --- | --- | --- |
| **0 — nothing** | Node | Parser, derive, unit tests against the committed synthetic corpus |
| **1 — `docker compose up`** | Docker | Every signed-out surface: shelf, browse, search, facets, detail page, download, contributor page, leaderboard — against ~40 seeded programmes |
| **2 — + Clerk dev keys** | Docker, a Clerk account (free, **no card**) | Upload, fork, votes, bookmarks, owner edits, Class A withdrawal |
| **Fallback** | your own Neon and R2 (**R2 requires a card**) | Same as tier 2, against hosted services. This is the production configuration, so it costs nothing to support — and it is required anyway, because the takedown CLI is a laptop tool pointed at production |

**`docker compose` runs three services:** Postgres (stock image — `citext` and `pg_trgm` are
contrib extensions, so neither is a Neon dependency), the **local Neon HTTP proxy** in front of
it (**pinned by digest**, because it is community-maintained; *not* `neondatabase/neon_local`,
which proxies to a real Neon project and needs an account and API key), and **MinIO** for blobs.
The presigned-PUT upload path is exercised in full locally, CORS included, because CORS is a
bucket rule in both.

Three rejections that matter:

- **A filesystem blob adapter is rejected.** It is the only option that adds an interface, and
  the only one whose dev path can silently diverge from production — a stub PUT endpoint writing
  to a directory shares no code with a presigned PUT to an S3 API.
- **`node-postgres` in dev is rejected on the *direction* of its divergence.** Dev would be
  *more* capable than production: `neon-http` cannot open an interactive transaction, and three
  closed decisions rest on that limit. Under a `node-postgres` dev mode someone writes a
  `BEGIN…COMMIT` that passes locally, passes review, and fails in production.
- **A no-auth dev mode is rejected.** Clerk ships no emulator, so a bypass would be a second
  implementation of authentication — and its failure mode is asymmetric: a `DEV_USER_ID` honoured
  in production makes every visitor that user, silently.

**Docker is a hard prerequisite. Podman is not supported.**

**Seeding runs the real ingest path, server-side** — the product parser, the product derive code,
the product persistence code, the same S3 client. It skips only the browser parse and the
presigned-PUT hop. Committed pre-computed JSON is rejected: it would be a second producer of
`derived.json` against a contract that has already moved twice. The honest cost is ordering —
seeding cannot work before the parser and derive exist, so a fresh clone shows an empty shelf
early in development.

**The dev catalogue** is ~40 programmes, generated deterministically from seeds and **not
committed** (like `perf-*` fixtures). It is tuned to fill the facets — all eight sectors plus
blanks, all three size bands, both P6 versions, progressed and not — with sector assigned by the
seed script rather than the generator. **Reusing the committed test corpus is rejected to protect
the corpus**: those 16 files exist to *fail* (mojibake, missing calendars, no WBS, 20 activities
each), and the moment the test corpus is also the demo corpus, someone tunes it to look
presentable. The seed's real value is in the row states no generated `.xer` can produce: a
monthly revision series, a set of fork siblings, tombstoned programmes under both classes, a
`failed` row with its `failure_reason`, unsectored programmes, and vote and bookmark counts.

**CI stands the whole stack up** — migrate, seed, smoke query — on every PR including forks,
alongside lint, typecheck and unit tests. That is the only thing that stops these dev-only seams
rotting, and it is meaningful precisely because a fork PR has no secrets and can reach no hosted
service, so an all-local stack is the only stack it can ever be tested against.

**The local stack reproduces the S3 API and the Neon wire faithfully, and reproduces none of the
CDN** — the `X-Robots-Tag`, the TTL split, the verified purge and R2's bucket CORS exist only in
production, which is what the sweep's `edge_drift` assertions are for.

_Source: [Local development and contributor onboarding](docs/wayfinder/tickets/018-local-dev-and-onboarding.md), [Stack, hosting and auth provider](docs/wayfinder/tickets/010-stack-hosting-auth.md), [Get a large synthetic fixture for perf work](docs/wayfinder/tickets/012-large-synthetic-fixture.md), [Verifying the production-only edges](docs/wayfinder/tickets/024-verifying-production-only-edges.md)_

### 4.10 Prerequisites checklist — the build's day-one runbook

> **Status: NOT DONE.** Every step below needs a card, a browser session or an account holder;
> none of it can be done by an agent, and nothing in it is a decision — every choice is already
> made above. It blocks nothing in this spec, but it blocks the running site. The record it
> leaves is `docs/operating.md`.

**Unimplementable until this is complete** — as a matter of capability, not quality: the verified
CDN purge and therefore "bytes hard-delete"; the `edge_drift` sweep rule in its entirety and its
`takedown.purge.landed` definition; the edge half of `X-Robots-Tag` enforcement; the CORS document,
which contains the literal string `<site-origin>`; and — the one that reorders the runway —
**Clerk production, and therefore sign-in, presign, upload, votes, bookmarks and `/me`**.

| # | Step | Unblocks |
| --- | --- | --- |
| 1 | **Choose the name.** Recommended `xerhero.com` | everything below |
| 2 | Create or sign in to a **Cloudflare account**. The zone and the R2 bucket must live in the **same account** | 3–9 |
| 3 | **Register the name at Cloudflare Registrar.** Confirm auto-renew is on (it is by default) and note the renewal date in `docs/operating.md`. *Fallback if Registrar refuses a fresh registration without an existing zone: register anywhere cheap, then Cloudflare → Add a site → Free plan → point the registrar's nameservers at Cloudflare. Partial/CNAME setup is Business+, so full setup is the only free path* | the zone |
| 4 | Wait for the zone to read **Active**, on the **Free** plan | 5–9, and 14.2 |
| 5 | Add a **payment method** to Cloudflare — R2 requires one even inside the free tier — and create the **R2 bucket** | the bucket |
| 6 | R2 → bucket → Settings → **Custom Domains → add `blobs.xerhero.com`**; confirm the DNS record, wait for the certificate | the purge path; edge enforcement of `X-Robots-Tag`; every `edge.*` assertion |
| 7 | **Leave the `r2.dev` development URL disabled** (or disable it if setup enabled it) | the honesty of `takedown.purge.landed` |
| 8 | Add the **Cache Rule** from §4.3 — hostname `blobs.xerhero.com`, eligible for cache, edge TTL from origin | `edge.canary.derived_cache_control`; the caching assumption in the cost model |
| 9 | Confirm the zone has **no Response Header Transform Rule** touching the blob host. A fresh zone has none; the step is to check, and to check again after any future rule | `edge.canary.x_robots_tag` |
| 10 | Mint **three tokens**: R2 object read/write (→ Vercel env), R2 admin (→ local `.env` only), Cloudflare API token scoped Zone → Cache Purge (→ local `.env` only) | `edge.canary.minted`; `ops.cors.matches_repo`; `takedown.purge.landed` |
| 11 | Vercel → project → Settings → Domains: add `xerhero.com` and `www.xerhero.com`, adding the records Vercel shows **as DNS-only (grey cloud)** in Cloudflare. Set `www` → apex (308), and set the `*.vercel.app` domain to redirect to the apex | the site's identity; the CORS `AllowedOrigins` value |
| 12 | Fill `<site-origin>` in `ops/bucket/cors.json` with `https://xerhero.com` and run **`ops bucket apply`** against production | `edge.cors.preflight`, `edge.robots_txt` |
| 13 | Set the **blob-host base URL as an env var** in Vercel and in `.env.example`, so no hostname is ever a literal in code | CI's ability to point the same code at MinIO |
| **14** | **Google Cloud and Clerk — eleven sub-steps, interleaved (below)** | Clerk production |
| 15 | *(absorbed into 14.6 and 14.9 — Clerk's production instance is created mid-way through the Google sequence, not after it)* | — |
| 16 | GitHub: **branch protection on `main` requiring the CI job**, and **Actions failure notifications on**. Nothing in the estate can assert either | deploy-blocking; the estate's only alarm channel |

**Step 14, expanded and reordered.** Domain verification comes *first* (it needs only the zone,
not a live site); the OAuth client cannot be created until Clerk's production instance has shown
its redirect URI; and brand verification is a tail that runs after a production deploy.

| # | Step | Prerequisite |
| --- | --- | --- |
| 14.1 | **Google Cloud console → create a project** (`xer-hero`) with the account that will own this permanently. Attach **no billing account**. Enable **no API** | a Google account |
| 14.2 | **Search Console → Add property → Domain** → `xerhero.com`. Add the TXT record in the Cloudflare zone, click Verify. Must be the **same Google account** as 14.1, and must be the **Domain** property, not URL-prefix | step 4 (zone Active). **Not** a live site |
| 14.3 | **Google Auth Platform → Get started.** App name **`xer-hero`**, user support email, Audience **External**, developer contact email, accept the User Data Policy | 14.1 |
| 14.4 | **Branding → Authorized domains → add `xerhero.com`**, *before* any URI is entered anywhere — Google fixes that ordering itself | 14.2, 14.3 |
| 14.5 | **Data access →** confirm the scope list is exactly `openid`, `email`, `profile` and that all three read **Non-sensitive**. Add nothing — anything sensitive converts this into a review | 14.3 |
| 14.6 | **Clerk → create the production instance for `xerhero.com`**, add its DNS records **DNS-only**, copy the **Authorized Redirect URI** | steps 3–4 |
| 14.7 | **Google → Clients → Create OAuth client → Web application.** Authorized JavaScript origin `https://xerhero.com`; redirect URI = the value from 14.6. Save the **Client ID** and **Client Secret** | 14.4, 14.6 |
| 14.8 | **Audience → Publish app.** Confirm it reads *In production*. No review, no queue, no wait | 14.7 |
| 14.9 | **Clerk → Google connection →** enable *Use custom credentials*, paste the Client ID and Secret, swap the app to `pk_live_` / `sk_live_` | 14.7, 14.8 |
| 14.10 | *(after step 11 and a production deploy serving `/privacy` and `/terms` on the apex)* Branding → App domain → homepage, privacy policy, terms of service. Optional 120×120 logo — **none in v1**. Click **Verify Branding**. Minutes if automated, 2–3 business days if manual | a live site with legal pages |
| 14.11 | From a **signed-out** browser, run a real sign-in and read the consent screen. It must say `xer-hero`, not a hostname | 14.10 |

**Steps 1–13 and 14.1–14.9 are the launch path. 14.10–14.11 are post-launch**, because sign-in
works throughout — an unverified published app with these scopes has no cap, no warning and no
expiry. Also unverified and worth two minutes at the console when it comes up: whether Google
demands a billing account to create the project at all, and whether the **Publish** click itself
requires the privacy and terms links (if it does, 14.8 moves after the deploy and the launch path
gets one step longer — no other consequence).

_Source: [Register the domain and provision the production estate](docs/wayfinder/tickets/026-register-domain-and-provision.md), [The blob host and the site's domain](docs/wayfinder/tickets/025-blob-host-and-domain.md), [Google OAuth in production](docs/wayfinder/tickets/027-google-oauth-in-production.md), [Verifying the production-only edges](docs/wayfinder/tickets/024-verifying-production-only-edges.md)_

---

## 5. Upload, ingest, and operations

The governing rule for this whole section: **the file is scanned in the browser before a
byte is uploaded, and every server check is a recomputation of something the user was
already shown.** That ordering is what makes a rejection cost a file-picker click instead
of a 50 MB upload and a wait. Nothing the client computes is ever persisted — not the
counts, not the content hash — so a client that lies gains nothing; the stored values are
all recomputed server-side from the decompressed bytes.

### 5.1 The end-to-end flow

| # | Step | Where | What happens |
|---|---|---|---|
| 1 | **Scan** | browser | One pass over the picked file produces the SHA-256 content hash, the `ScanResult` (§5.2), and the gzipped blob for the PUT. Every rejection in §5.3 fires here, with nothing uploaded. The hash goes to `GET /api/hash-check` for the dedup lookup. The screen shows activity count, P6 version, date range, WBS shape, the personal-data panel, the dedup match, and the same-P6-project advisory hint. |
| 2 | **Presign** | `POST /api/presign` | Mints `revision_id` (and `programme_id` for a new programme or a fork), writes an `upload_intent` row, returns a presigned PUT URL carrying an **exact** content-length and the signed response headers. Creates the `app_user` row if this is the account's first authenticated write. |
| 3 | **PUT** | browser → R2 | The gzipped blob is PUT directly to `p/{programme_id}/r/{revision_id}/original.xer.gz`. Runs in the background while step 4 is on screen. |
| 4 | **Metadata** | browser | Five fields (§5.4), filled while step 3 uploads. |
| 5 | **Submit** | `POST` to the app | One batch insert: `programme` with `current_revision_id` **null**, plus `revision` with `status = 'pending'` and `content_hash` **null**, `on conflict (id) do nothing`. Responds, then `after()` runs ingest in the same invocation. |
| 6 | **Ingest** | Vercel Function | Reads the object from R2, gunzips under a hard byte limit, hashes, parses, computes derived stats, writes `activities.json.gz` and `derived.v{N}.json`, then updates the revision to `published` and sets `programme.current_revision_id`. |
| 7 | **Poll** | browser | The client polls the revision's status for ~15 s, then redirects to `/p/{slug}`. |

Steps 5–7 make the normal case *feel* synchronous — the authoritative parse is 1–2 s.
Ingest is asynchronous anyway, because a closed tab still needs an outcome and a retry
needs somewhere to retry from.

Route decides shape; **the file never does**:

| Entry point | Mints | Rules |
|---|---|---|
| **New programme** — shelf upload button | `programme_id` + `revision_id`, `rev_no = 1`, `root_programme_id` = self, `is_root_rev = true` | the default |
| **New revision** — only from your own programme page | `revision_id`, `rev_no = max + 1` | owner-only; the parent comes from the URL |
| **Fork** — from another programme's page, or forced by a hash match | both ids, `parent_revision_id` set | `change_note` required on the fork's rev 1 |

Auto-detection is refused: the four Fixture B tender variants are fork *siblings* that any
detector keyed on the P6 project id would collapse into one revision series, and no
property of a file distinguishes a fork from a revision — only the uploader's intent does.
The file gets one advisory job: if the scan sees a P6 project id matching a programme the
signed-in user already owns, the screen offers *"this looks like the same P6 project as
**X** — add it there as rev N instead?"* with a link. A hint, never a reroute. The accepted
cost is that someone uploading a monthly series may create eight programmes instead of one
series of eight revisions, and the tree is strict with no merge, so that is unfixable
without deleting and re-uploading.

_Source: [Upload and ingest pipeline](docs/wayfinder/tickets/011-upload-ingest-pipeline.md)_

### 5.2 The client-side pre-upload scan

**It is a scan, not a parse.** The pre-upload screen needs activity count, P6 version, date
range, WBS shape, the multi-project check, the dedup hash, the metadata prefill, the
advisory hint and the personal-data panel — and not one of those needs a table held whole.
The scan reads the file as a byte stream and, per record, either increments a counter and
moves on **without splitting the row at all**, or walks it once slicing only the columns the
`%F` header says it wants. On a 20,000-activity export **92.9% of records have no field
extracted** and only 7.1% have more than one; `TASKACTV`, `UDFVALUE`, `TASKRSRC` and
`TASKPRED` — the tables that make a `.xer` big — are exactly the tables the screen has no
use for, and `clndr_data` is never materialised on the client at all.

**One pass produces everything.** Hash, scan and gzip run over the same read of the file.
The hash is `crypto.subtle.digest` over the file's bytes (WebCrypto has no streaming digest;
a hand-written streaming SHA-256 peaks lower but is 2.2× slower and ~120 lines of crypto to
own forever). The gzipped blob — 7.1–7.4 MB at the cap — is the only thing retained at any
size, because the PUT needs it and S3 signing needs its exact length.

**`ScanResult` also carries `reaches_end_marker: boolean` and `nul_byte_count: number`**,
because a scan that counts what it recognises counts zero of everything on a wholly zeroed
file without anything going wrong, and reports success. Both are O(1) — a four-byte
comparison at a known offset and one byte compare inside the loop that already runs for the
hash and the gzip.

**Platform requirements, no fallback.** The upload page requires `Blob.stream()`,
`CompressionStream` and `crypto.subtle.digest`, **and a secure origin** — `crypto.subtle` is
the only one of the three gated on it, so a plain-http origin (a LAN IP) removes the hash and
nothing else, which reads as "this browser has no WebCrypto" and is a false negative.
A browser lacking any of the three cannot complete the upload transport regardless, so this
is not a new gate. A blind-upload fallback is buildable — the server path is complete on its
own — and is deliberately **not** shipped: an official blind-upload path would make
deterministic ingest failures routine, which would force the rate rule §5.10 rejects and
cost the estate its sharpest alarm.

**Measured budget** (`cap-33k`, 50.55 MB / 33,000 activities):

| Measurement | Value |
|---|---|
| Whole client step (hash + scan + gzip), Chrome 149 | **661 ms** — hash 155 ms, scan + gzip 506 ms |
| Peak JS heap | 73.8 MiB |
| **Retained after settling** | **3.1 MiB** |
| Renderer RSS | 214.5 MiB (floor 89.4 MiB) |
| Under a capped 16 MiB V8 old space | **completes**, peak heap 15.8–18.4 MiB, 0.84–1.35 s |
| Under a capped 8 MiB old space | dies |
| Retaining **full parse** of the same file, capped heap | survives 512 MiB, **dies at 256 MiB** |
| Full parse cost, uncapped | 5.1× the raw file in JS heap, 6.8–7.7× in renderer RSS |
| Server-side full ingest pipeline, same file | **562.1 MiB** peak against a Function's 2 GB, 1,223 ms |

**Cross-engine** (`cap-33k`, 5 repeats each, 2026-08-08):

| | WebKit 26.5 | Gecko 153 | Blink 151 |
|---|---|---|---|
| Completes | 5/5 | 5/5 | 5/5 |
| Wall, median | **535 ms** | 678 ms | 634 ms |
| Peak process growth | 360 MiB | 190 MiB | 234 MiB |
| `ScanResult` vs the goldens | 27/27 | 27/27 | 27/27 |
| Gzipped length of the identical file | 7,383,836 B | 7,192,108 B | 7,155,680 B |

The three APIs are present and correct in all three engines, checked **by use**:
`crypto.subtle.digest` returns the published SHA-256 of `"abc"`; `CompressionStream('gzip')`
emits output beginning `1f 8b`, which rules out an engine accepting `'gzip'` and producing
bare deflate — an object R2 would store happily and ingest could not read. `TextDecoder`'s
`windows-1252` label decodes `0x97` to an em dash in all three. The serialised `ScanResult`
is **byte-identical across the three engines** on all 27 corpus fixtures, and `cap-33k`'s
content hash is the same string from WebKit, Gecko, Blink and Node.

Two consequences of the gzip spread, both load-bearing: **the compressed length is not a
function of the file** (Gecko is not even deterministic across runs of itself — one of five
came out 235 bytes longer), so it cannot be predicted server-side, and **a retry must PUT
the same retained blob or fetch a new presigned URL**, because re-gzipping can produce a
length the presigned URL rejects.

**One tokenizer, two drivers.** The `%T`/`%F`/`%R` grammar, the per-file per-table
name→index mapping, the CP1252 decode and the continuation-line rule are **one module**
emitting records to a visitor. There are two visitors: a **retaining** one that builds
tables (server) and a **discarding** one that updates counters and bounded value lists
(client). The validation rules — every reject in §5.3, the distinct-`TASK.proj_id`
discriminator, both caps — are functions over one `ScanResult` shape, and the server
computes that same shape as a by-product of its full parse. So the rules are written once
and run twice; only the collection strategy differs. **CI asserts that the scan and the full
parse agree on every corpus fixture**, which is what stops the two drivers drifting.

_Source: [The client-side parse budget](docs/wayfinder/tickets/020-client-parse-budget.md),
[Confirm the pre-upload scan on mobile Safari](docs/wayfinder/tickets/029-confirm-scan-on-safari.md)_

### 5.3 The caps and the rejections

> A `.xer` is accepted when it contains **at least 1 and at most 20,000 activities** and the
> **raw file is at most 60 MB**. Both are evaluated from the one client-side scan and both
> are re-evaluated at ingest. A rejection names the guard that fired, with the measured value
> beside the limit.

The byte cap is 60 MB rather than 50 because at the worst byte density observed across 143
real files (2,848 bytes per activity) a 20,000-activity programme is 56.96 MB — so at 50 MB
the byte cap bit first at ~17,500 activities and a planner who trimmed activities to clear
one limit would be rejected by the other. At 60 MB, **any file inside the activity cap at any
density ever observed is inside the byte cap**, and the byte guard fires only on a file that
is *not mostly activities* — a true and different thing to tell the uploader. Both numbers
are v1 floors set to be raised as configuration, not as a reversal.

**Reject, never degrade.** A programme too big is refused rather than stored with reduced
derived data: the shelf row is twelve facts in fixed slots with nothing allowed to flow, a
row with half its stats missing is exactly the noise that rule exists to prevent, and a
degraded row would be permanently unfixable because raising the cap later computes nothing
without a backfill nobody has specified.

**Order of guards**, so "which fired" is never ambiguous:

1. `File.size` first, because it is free. **Above 120 MB (twice the cap) the file is rejected
   on size alone with no read** — nothing that large is a single-project P6 export and
   scanning it is unbounded work. A file between 60 and 120 MB **is still scanned**, so the
   byte rejection can name the activity count too.
2. Then the content guards, in the order below. Readability is decided **on the bytes, before
   anything is derived from them**, because by the time a count exists the question has
   already been answered wrongly.

| # | Reject | Condition | What the planner is told |
|---|---|---|---|
| 1 | **Unreadable** | the file's last record is not `%E`, **or** it carries any `NUL` byte | one of the two messages below |
| 2 | **Not a `.xer`** | no `ERMHDR` on line 1 (and no zero padding) | *"This is not a Primavera XER export."* |
| 3 | **Tokenizer failure** | missing `%T`/`%F`, irreconcilable field count | *"This file is corrupt or truncated — re-export it from P6."* |
| 4 | **Zero activities** | `TASK` absent or empty | *"This export contains no activities."* |
| 5 | **Multi-project** | more than one distinct `TASK.proj_id` | *"This export contains N projects — export a single project and upload again."* |
| 6a | **Over the activity cap** | activities > 20,000 | *"This export has 24,310 activities. xer-hero accepts up to 20,000."* |
| 6b | **Over the byte cap** | raw size > 60 MB | *"This file is 71.4 MB. xer-hero accepts `.xer` exports up to 60 MB. It has 12,400 activities, which is inside the limit — the size is in the other tables (activity codes, resource assignments, user-defined text)."* |

**Reject 1 has two messages, chosen by whether an `ERMHDR` was ever seen.**

*Nothing readable — no `ERMHDR`, and the file is zero-padded:*

> This file is not a complete P6 export. Every one of its 397,781 bytes is zero — there is no
> header, no data and no end-of-file marker in it at all. That is what an interrupted download
> or a file-sync error leaves behind, not anything P6 wrote. Download or re-export the file,
> then try again.

*Stops partway — a valid `ERMHDR`, then nothing:*

> This file is not a complete P6 export. It reads correctly for its first 33,422 bytes and then
> stops — no end-of-file marker, and 3,442 zero bytes on the end. There is no way to tell how
> much of the programme is missing, so the 20 activities it does show cannot be taken as the
> whole of it. Download or re-export the file, then try again.

Both end on the same instruction because both have the same fix, and neither calls the
planner's data invalid.

**Why both arms of reject 1 are needed.** A wholly zeroed `.xer` — one real file in 139 is
397,781 bytes of pure `NUL` — fails reject 4 as well, so it was never *accepted*; it was
rejected with *"This export contains no activities"*, which blames the planner's programme
for a fault in their copy of the file. A **truncated export that stops on a table boundary
fails none of rejects 2–6 at all**: perfect header, zero tokenizer problems, correct arity on
every row, right activity count, one owning project — and it publishes. Worse, the
continuation rule swallows the zero padding into the last record, so `UDFVALUE.udf_code_id`
on the final row arrives as a 3,443-character value of which 3,442 are `NUL`, at the correct
arity, with nothing reporting a problem. Neither arm alone catches both: `NUL`-anywhere
misses an interrupted HTTP transfer that simply stops with no padding behind it, and
no-`%E`-alone misses a file zeroed in the middle whose tail survived and cannot choose
between the two messages.

Both arms are measured, not assumed: **the 138 readable real exports contain not one `NUL`
byte between them and all 138 end with `%E\r\n`**; the 139th is 100% `NUL`, has no `ERMHDR`
and no `%E`. **Being unacceptable and being unreadable are different verdicts** —
`missing-taskpred`, `missing-calendar`, `sparse-150`, `text-multiline`, the logic cycle, the
`0x81` mojibake and the multi-project file are all `readable`, and the multi-project file is
the one that proves the guard keeps the two apart: it is rejected, and it is rejected as
readable.

**Two things must never reject.** *Never on P6 version* — the parser maps `%F` names →
indices per table per file, so it is version-agnostic by construction; record `p6_version`
and reject only when a required table or field is missing. *Never on encoding* — CP1252
decoding is lossy, not strict (28,774 `0x81` bytes were measured in one real fixture, and
strict decoding throws on them); a file that trips the decoder is a file we mis-decoded.

**The multi-project discriminator is `TASK.proj_id`, not `PROJECT` row count.** A P6 export
carrying baselines has several `PROJECT` rows and is not multi-project; rejecting on
`PROJECT` row count would forbid exactly the baseline-bearing file the derived contract left
the door open for. Exactly one project owning activities → ingest, with extra `PROJECT` rows
left in the raw bytes and ignored by v1 stats; more than one → reject.

_Source: [The client-side parse budget](docs/wayfinder/tickets/020-client-parse-budget.md),
[A zeroed .xer is a real shape — what does the scan do with it?](docs/wayfinder/tickets/040-zeroed-xer-file.md),
[Upload and ingest pipeline](docs/wayfinder/tickets/011-upload-ingest-pipeline.md)_

### 5.4 Presign, the PUT, and the metadata screen

Uploads go **browser → R2 by presigned PUT**, gzipped client-side, because Vercel's request
body cap is 4.5 MB against 4.8 and 6.8 MB real fixtures — the app server is not a viable
path for the bytes at any size that matters.

**The presigned URL carries an exact content-length, not a range**, because the client has
already produced the compressed blob and knows its byte count, and because §5.2 established
that length cannot be predicted from anywhere else. R2 rejects anything else, so the cap does
not rest on client honesty. **Ingest decompresses with a hard byte limit of the 60 MB raw cap
and aborts past it** — a 12 MB gzip member can expand to gigabytes, and without the limit the
byte cap is being enforced on the wrong number.

**Presign is the abuse surface.** Any signed-in user could otherwise mint unlimited PUT URLs.
Two caps, both counted against `upload_intent`: **3 unsubmitted intents at a time** (an intent
with no matching revision) and **20 presigns per user per day**. Presign requires a Clerk
session, so this is per-account and an abuser burns Google accounts to continue.

The metadata screen is one screen, five fields:

| Field | Prefill | Required |
|---|---|---|
| Title | root `PROJWBS.wbs_name`, falling back to `PROJECT.proj_short_name` | **yes** |
| Description | empty; the parent's on a fork | no |
| Sector | the parent's on a fork; otherwise empty | no |
| `change_note` | empty | **yes on a fork's rev 1**, optional later |
| Rights checkbox | always unticked | **yes** — snapshots `terms_version` + `asserted_at` |

The personal-data panel sits directly above the checkbox, fed by the scan at zero server
cost. Title is required *despite* prefilling, or the shelf fills with rows named `C1042` —
`PROJECT.proj_short_name` is the P6 *Project ID*, a code, and the human-readable name lives
in the root `PROJWBS` node's `wbs_name`. Sector is optional so an upload is never blocked on
a dropdown the uploader cannot answer. Everything except the checkbox is editable later; the
checkbox is a per-revision assertion, so re-stating it means uploading again. `slug` is
immutable, so a title edit never moves the URL.

_Source: [Upload and ingest pipeline](docs/wayfinder/tickets/011-upload-ingest-pipeline.md),
[The client-side parse budget](docs/wayfinder/tickets/020-client-parse-budget.md)_

### 5.5 What is written where: blob keys and headers

Blobs are **id-addressed, not content-addressed**, so every object has a deterministic key
computable from two uuids and a version integer. No URL is stored in Postgres.

```
p/{programme_id}/r/{revision_id}/original.xer.gz
p/{programme_id}/r/{revision_id}/activities.json.gz
p/{programme_id}/r/{revision_id}/derived.v{N}.json
```

That layout pays three times: a tombstone is **one prefix delete**, a Class B cascade is N
prefix deletes with no cross-referencing first, and **the purge list is a constant 3 URLs per
revision** rather than 3 × attempts — which matters because Cloudflare purge-by-prefix and
purge-by-tag are Enterprise-only and purge by explicit URL is available on every plan.

| Object | `Cache-Control` | `X-Robots-Tag` | Written by | Notes |
|---|---|---|---|---|
| `original.xer.gz` | `public, max-age=3600` — **no `immutable`** | `noindex, noarchive` | the browser's presigned PUT (step 3) | the sole carrier of personal data; stored pre-gzipped and served `Content-Encoding: gzip` |
| `activities.json.gz` | `public, max-age=31536000, immutable` | — | server-side PUT during ingest | stored pre-gzipped, served `Content-Encoding: gzip` |
| `derived.v{N}.json` | `public, max-age=31536000, immutable` | — | server-side PUT during ingest | version-stamped in the key, so a contract bump writes a new object rather than mutating a live one |
| `robots.txt` at the bucket root | `public, max-age=31536000, immutable` | — | `ops bucket apply` (§5.12) | `content-type: text/plain`, body `User-agent: *\nDisallow: /` |

**The TTL split is one rule, not an exception.** `original.xer.gz` is the object that already
carried different header treatment for being the PI carrier; giving it a short TTL makes one
coherent rule — *the PI-bearing object is served under different terms* — expressed by three
properties on one object (`noindex`, 1-hour TTL, 30-day Class B quarantine). It costs
nothing: R2 egress is structurally free and the object is fetched only when someone
deliberately clicks Download. What it buys is a **failure-mode downgrade**: at a year-long
immutable TTL, purge is the only thing between a rights holder and their file, and a silent
purge failure looks exactly like success; at an hour, purge is the fast path and the TTL is
the backstop, so *purge must never fail* becomes *purge should not fail* — the right posture
for one operator with no SLA. Not one day (a confidential programme still downloadable a day
after the operator confirmed removal generates the second, angrier email); not sixty seconds
(purge already covers that window).

> **GAP:** the exact `Content-Type` for `original.xer.gz`, `activities.json.gz` and
> `derived.v{N}.json`, and whether `derived.v{N}.json` is stored gzipped with
> `Content-Encoding: gzip` — its key has no `.gz` suffix while the storage model names
> `derived.json.gz`. `content-type` is already in the bucket's CORS `AllowedHeaders`, so
> whatever is chosen must also be in the presign's signed header set.

Postgres writes, by step:

| Step | Postgres | R2 |
|---|---|---|
| 1 scan | none (`GET /api/hash-check` is a read) | none |
| 2 presign | `app_user` if this is the account's first authenticated write; one `upload_intent` row (`revision_id` PK, `programme_id`, `user_id`, `created_at`) | none |
| 3 PUT | none | `original.xer.gz` with the signed `Cache-Control` and `X-Robots-Tag` |
| 4 metadata | none | none |
| 5 submit | batch insert `programme` (`current_revision_id` null) + `revision` (`status='pending'`, `content_hash` null, `is_root_rev` set), `on conflict (id) do nothing` | none |
| 6 ingest | update `revision`: `content_hash`, `p6_version`, `activity_count`, `is_baseline`, `checks_passed`, `checks_applicable`, `card`, `derived_version`, `status='published'`; then `programme.current_revision_id` | `activities.json.gz` + `derived.v{N}.json` |
| 7 poll | none | none |

`upload_intent` exists because a user who PUTs and then closes the form leaves an R2 object
with no row, and hunting it by listing the bucket is O(objects) forever.

_Source: [Domain model and schema](docs/wayfinder/tickets/005-domain-model-and-schema.md),
[What tooling does the operator need to run a takedown?](docs/wayfinder/tickets/017-operator-takedown-tooling.md),
[What does storage actually cost?](docs/wayfinder/tickets/004-storage-cost-model.md),
[Upload and ingest pipeline](docs/wayfinder/tickets/011-upload-ingest-pipeline.md)_

### 5.6 The CORS document and the bucket document

CORS lives at `ops/bucket/` in the repo as a document applied by `ops bucket apply` against
whatever `S3_ENDPOINT` it is pointed at — CI and the local compose stack point it at MinIO,
the operator points it at R2. **The same document applied twice** is what makes local CORS
and production CORS the same artefact rather than two things that resemble each other. This
is cheaper than the alternative even before anyone verifies anything: the alternative was one
hand-written dashboard click-path for R2 *plus* one hand-written `mc` incantation for MinIO,
against one JSON file applied twice by stock `@aws-sdk/client-s3`.

`ops/bucket/cors.json`:

```json
[
  {
    "AllowedOrigins": ["https://<site-origin>", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "cache-control", "x-robots-tag", "x-amz-*"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

`cache-control` and `x-robots-tag` are in `AllowedHeaders` **because the presign signs
them**: a SigV4 presigned PUT requires the client to send every header in `SignedHeaders`,
and a browser sending an author-set header needs it allowed at preflight. So the `noindex`
header and the 1-hour TTL are not merely checked alongside CORS — they are the reason two of
these lines exist. `content-length` is deliberately absent: browsers set it themselves and
forbid authors from setting it, so it never appears in `Access-Control-Request-Headers`.
`x-amz-*` covers a live hazard rather than a hypothetical one — **AWS SDK v3 computes a
request checksum by default** (`requestChecksumCalculation: "WHEN_SUPPORTED"`), adding
`x-amz-checksum-crc32` to PUTs, which on a presigned browser PUT silently becomes a required
signed header the browser must send and CORS must allow. It has broken R2 and MinIO
presigned PUTs widely since early 2025. **The set of signed headers is a dependency's
decision as much as ours.**

**There are no bucket lifecycle rules, on purpose.** Every clock in this system is a Postgres
predicate the sweep evaluates — the 24 h reap, the 30-day quarantine, every alarm window — and
a bucket lifecycle rule would be a second scheduler with its own state, drifting silently
against the rows. **The bucket carries no policy at all beyond CORS.**

Everything Cloudflare-shaped — custom domain, public access, Cache Rules, Response Header
Transform Rules, WAF — is unreachable through the S3 API and stays a dashboard step in
`docs/operating.md`, each one backed by a runtime assertion (§5.13).

_Source: [Verifying the production-only edges](docs/wayfinder/tickets/024-verifying-production-only-edges.md)_

### 5.7 The ingest job and its states

The revision status enum is **`pending | failed | published | tombstoned`**, with
`ingest_attempts smallint not null default 0`, `failure_reason text` (the uploader's
explanation) and `failure_detail text` (operator-only).

| State | Entered when | Invariants | Exits |
|---|---|---|---|
| `pending` | submit (step 5) | `content_hash` null; `current_revision_id` null, so the programme is invisible to the shelf **for free** via the grid's inner join, with no status predicate anywhere. Seven ingest-written columns are nullable precisely so a `pending` row is insertable | → `published` on success; retried by the sweep while pending; → `failed` after 3 attempts or on a deterministic fault |
| `published` | ingest success | `content_hash` written from decompressed bytes; `programme.current_revision_id` set | → `tombstoned` |
| `failed` | ingest, on a deterministic fault, or the sweep after the 3rd attempt | `failure_reason` + `failure_detail` set; `content_hash` still null | reaped — row, R2 prefix and `upload_intent` — at **24 h** |
| `tombstoned` | Class A self-service button, or `takedown apply` | the row is kept **forever**; bytes hard-delete | terminal; a Class B case is reversible inside the 30-day quarantine |

**A partial ingest is overwritten, not cleaned up.** Because keys are deterministic, a retry
PUTs over whatever is there; R2 PUTs are atomic per object, so no reader sees half an object,
and **no reader exists at all until publish**. A half-written prefix is therefore unreachable
by construction. Deleting the prefix before retrying was rejected on a detail: it would
delete the `original.xer.gz` the browser uploaded and the server has not necessarily
re-fetched, so it would need a scope exception in precisely the place an exception is
dangerous. Attempt-scoped subprefixes were rejected because they would make the purge list
3 × attempts instead of a constant 3.

**`failure_detail` must never quote file bytes.** It carries the exception name, message and
the **parse position** (table, row index, field index). The natural instinct of a tokenizer
error is to echo the offending line, and that line can carry a resource name — a person. This
is the one place in the design where a careless implementation would rebuild, inside an error
string, exactly the personal-data surface the design refused to build on purpose.

`failure_reason` is a class, not a cause, and is rendered to the owner at `/p/{slug}` (§5.9).

_Source: [Upload and ingest pipeline](docs/wayfinder/tickets/011-upload-ingest-pipeline.md),
[Operating and observing ingest](docs/wayfinder/tickets/019-ingest-observability.md)_

### 5.8 Idempotency, duplicates and tombstone hashes

**Idempotency is structural.** The `revision_id` uuid minted at presign *is* the primary key,
so submit is `on conflict (id) do nothing` and returns the existing row. A double-submit
cannot create two programmes. No dedupe token, no request hashing.

**Dedup is enforced by a partial unique index, not a lock:**

```sql
alter table revision add column is_root_rev boolean not null default false;
create unique index revision_root_content_hash_uq
  on revision (content_hash) where is_root_rev;
```

`is_root_rev` is true when the programme is a root and `rev_no = 1`; the flag exists because
the predicate spans two tables and a partial index cannot reach across. An advisory lock was
ruled out by the driver choice: `pg_advisory_xact_lock` needs read → branch in app code →
write inside one session, which is an interactive transaction, and `neon-http` is batched
non-interactive only — taking the lock means adding a WebSocket pool for this one path.

**Enforcement lands on the write that carries trusted bytes.** `content_hash` is null on the
`pending` row and written once, by ingest, from the decompressed bytes — so the index fires on
the authoritative update, never on client-supplied data.

| Match against | Outcome |
|---|---|
| A published root, seen at the **pre-upload check** | offered as a fork of the match — or as a new revision if it is the user's own programme |
| A published root, seen only at **ingest** (the true race) | **reject with the offer** — *"identical file was just published as X, fork it there"* |
| A **`removal_class = 'B'`** tombstoned revision | **hard reject** — *"this file has been removed from xer-hero"* |
| A **Class A** tombstoned revision | **no block** — the owner withdrew voluntarily and may re-upload |

The race loser is rejected rather than silently converted, because auto-forking attaches a
stranger's programme to their upload as a parent they never chose, and a fork carries an
attribution obligation plus a required `change_note`.

**The Class B block is cheap, permanent takedown enforcement**: rows never delete, so a
tombstoned revision's `content_hash` survives after its bytes are gone, outlives the 30-day
quarantine, and means the exact file that was taken down cannot be re-uploaded by anyone,
including under a fresh account. It does **not** catch the same job re-exported from P6
(different bytes) and must not pretend to. Scoping the block to Class B is what fixes the
defect the rule originally had: an owner who withdrew their own programme by mistake could
otherwise never re-upload that file.

**The uploader's retry is the file picker.** A `failed` revision has `content_hash` null, so
the partial unique index does not block re-uploading the same bytes, and re-upload rebuilds
from a file the reap may already have deleted from R2 — which a retry button would not. No
uploader-facing retry control is built.

_Source: [Upload and ingest pipeline](docs/wayfinder/tickets/011-upload-ingest-pipeline.md),
[What tooling does the operator need to run a takedown?](docs/wayfinder/tickets/017-operator-takedown-tooling.md)_

### 5.9 Failure modes and their reapers — the sweep

Failures split by kind:

- **Deterministic** — tokenizer, multi-project, over-limit, the §5.8 hash violation. Row →
  `failed` with a reason. These should be **near-extinct**, because the client scan catches
  all of them before a byte moves, so one reaching ingest means a bypassed client or a bug —
  which is worth *seeing*, not merely counting.
- **Transient** — R2 read, DB blip, function timeout. The row stays `pending` and the sweep
  retries it.
- **Reap** — `failed` and stale `pending` rows, plus their R2 prefixes and their intents.

The **24 h window is the whole argument for having a `failed` state at all**: deleting on
failure is tidier and destroys the only explanation the user will ever get, because the app
cannot send mail, so if the tab was closed an in-app row is the only channel left. The
surface needs nothing built — the programme and its immutable slug exist from the moment of
intent and a pending programme is unlisted, so **`/p/{slug}` renders `pending` or `failed`
plus `failure_reason` to the owner and 404s to everyone else**, and the upload flow polls the
same row while the tab is open. One truth rendered in two places.

**The sweep runs from a GitHub Actions schedule every 15 minutes**, POSTing `/api/sweep` with
a bearer secret, with a Vercel daily cron as a backstop that suits the 24 h reap exactly. It
is not a Vercel cron because **Hobby allows one cron run per day with ±59 minutes of slop and
a more frequent expression fails at deployment** — a transient failure would wait up to 24 h
for its retry, which makes the retry path decorative. Actions is free on a public repo and its
scheduler is best-effort, so 15 minutes is the honest cadence rather than 5. The secret lives
in Actions secrets and Vercel env; forked-PR builds get no env vars, so a fork cannot call it.
Badly drifting Actions scheduling is a named Hobby → Pro trigger, fixed by Pro's
once-per-minute cron for $20 rather than by any code.

| Sweep query | Predicate | Action |
|---|---|---|
| Retry transient | `status = 'pending'` and pending for **> 2 min**, `ingest_attempts < 3` | re-run ingest; on the 3rd failure → `failed` |
| Reap stranded uploads | `upload_intent` rows **older than 24 h with no matching revision** | delete the R2 prefix and the intent |
| Reap failures | `status = 'failed'` (and stale `pending`) **older than 24 h** | delete row, R2 prefix and intent |
| Finish tombstones | `status = 'tombstoned' and bytes_deleted_at is null` | complete the R2 delete and the CDN purge |
| Destroy expired quarantine | `removal_class = 'B' and removed_at < now() - interval '30 days' and quarantine_purged_at is null` | destroy the quarantined bytes |

Those last two make both the Class A self-service button and a crashed `takedown apply`
**self-healing**, and demote the CLI's `--resume` from a requirement to a convenience.

_Source: [Upload and ingest pipeline](docs/wayfinder/tickets/011-upload-ingest-pipeline.md),
[What tooling does the operator need to run a takedown?](docs/wayfinder/tickets/017-operator-takedown-tooling.md),
[Operating and observing ingest](docs/wayfinder/tickets/019-ingest-observability.md)_

### 5.10 Observability: the operator's view, the alarms, and the sweep's verdict

**The sweep is the reporter, the in-app dashboard is the record, and the alarm is a red
GitHub Actions run.** The app cannot mail anyone — no address is stored and no mail vendor
exists — but the app is not the only thing running: a scheduled Actions workflow that exits
non-zero **mails the repo owner by default, free, forever**. The push channel was provisioned
three tickets earlier for an unrelated reason; the sweep merely had to be allowed to fail.

**The 1-hour log window is dodged rather than paid for.** Hobby retains one hour of runtime
logs and offers no drains, which was a candidate forced-$20. It is not, because **every
durable fact in this design is a Postgres row, never a log line** — counts, verdicts,
failures, heartbeats and reasons all outlive any retention policy, and logs become a
debugging convenience, which is what a one-hour window is adequate for. The log-drain Pro
trigger is examined and explicitly **does not fire**.

Two tables and one column:

```sql
create table sweep_run (
  id            uuid primary key,
  started_at    timestamptz not null,
  finished_at   timestamptz,
  ok            boolean,                      -- the verdict the workflow asserts on
  actions       jsonb not null default '{}',  -- retried, reaped, tombstones_completed, quarantines_destroyed
  breaches      jsonb not null default '[]',  -- rule key + count per breaching rule
  error         text
);

create table alarm_state (                    -- exactly 5 rows, seeded by migration
  rule            text primary key,
  breaching       boolean not null default false,
  breaching_since timestamptz,
  last_alarmed_at timestamptz
);

alter table revision add column failure_detail text;  -- operator-only; position, never file bytes
```

`alarm_state` is separate from `sweep_run` because `sweep_run` is append-only history and
suppression is mutable current state; conflating them means reading the last row to write the
next one. There is **no reaper on `sweep_run`** — 96 rows a day is ~35,000 a year against a
~150 MB database, and the history is worth more than the bytes. `alarm_state` being seeded by
migration means **every future rule is a migration**, kept deliberately: the seeded set is an
inventory the dashboard renders, not a log, so upsert-on-first-run would hide a rule from
`/ops` until it had successfully run once — the wrong behaviour in exactly the case where you
want to see it.

**`/ops`** is the dashboard. Authorisation is an **env-var allowlist of Clerk user ids**,
checked as one equality against the session — zero schema, no grant UI, no role in a vendor
dashboard, the entire authz rule one greppable line a contributor can audit, and changing it
is a redeploy, which is correct friction for the only privileged surface in the system. It is
covered by the `clerkMiddleware` matcher (`/me`, `/ops`, `/api`, `/__clerk`), which covers no
public path. **It is strictly read-only** — every operator *write* is in the CLI, which
already holds production credentials and has a plan/apply discipline — so there is no
write-authz reasoning, no CSRF surface and no misclick story.

| Panel | Source | Predicate / rule |
|---|---|---|
| `last sweep: N minutes ago` | `sweep_run` | latest `finished_at`; **red past an hour** |
| The five rule states | the **latest `sweep_run` verdict**, not recomputed | so the page and the alarm can never disagree |
| Failed and stale-pending revisions | `revision` | `status = 'failed'`, plus `status = 'pending'` older than 2 min — showing `failure_reason`, `ingest_attempts`, age and `failure_detail` |
| Takedown cases | `takedown_report` | `status in ('open','awaiting_owner')` — id, status, age, target, complaint body. **Never `reporter_contact`** |

**Five asymmetric rules, because two singletons carry more information than any rate:**

| Rule | Breach condition | Why this shape |
|---|---|---|
| `takedown_open` | a `takedown_report` in `open` for **> 12 h**; `awaiting_owner` gets a separate **7-day** clock | one is enough — nobody else is watching, and the person on the other end is a rights holder or a named individual. `awaiting_owner` is deliberately the owner's ball, so a 12-hour rule would nag about a case behaving correctly; a case parked forever is still a case |
| `deterministic_failure` | **any** deterministic failure in the last **24 h** | these are near-extinct by construction, so a rate threshold on an event that should never happen guarantees the first occurrence is invisible |
| `transient_burst` | **≥ 5 transient failures in an hour**, or **> 50% of at least 4 attempts in an hour** | the sweep already retries these, so a singleton is genuine noise; the minimum-attempts floor stops one failure out of one attempt reading as a 100% failure rate |
| `reconciler_stuck` | a tombstoned revision with `bytes_deleted_at` null for **> 1 h**, or a Class B quarantine **> 24 h past its 30 days** | the rule nobody asked for and the one that matters most: it is "bytes hard-delete" quietly not being true. A stranded tombstone is a public unsigned URL that a takedown believes it destroyed |
| `edge_drift` | any assertion in §5.13 failing | catches the vendor-dashboard edit, which has no commit behind it |

**Cadence: red on transition, then daily.** The sweep runs 96 times a day; a rule that goes
red on every run while a condition persists produces 96 mails a day for one unactioned
report, and a channel that cries every 15 minutes is one you filter to a folder within a week
— at which point the alarm is decorative and the system is back to pull without anyone
deciding that. So a rule alarms when it breaches for the first time since it last cleared,
and **once per 24 h** while it stays breached. A mail deleted half-asleep at 2 a.m. returns
tomorrow, which is why "transition only, once ever" was rejected.

**The endpoint decides; the workflow asserts one boolean.** `/api/sweep` evaluates all five
rules, writes the verdict, and returns **`{ok, breaches[]}`**; the workflow step is one line
that fails when `ok` is false. Rules live in app code rather than in YAML because they are
time-windowed and joined (miserable in `jq`), because CI stands the whole stack up on every
PR so rules can be tested with seeded rows that drive each one red on purpose, and because
the dashboard and the alarm then read one evaluated verdict instead of two implementations
that drift. **Actions logs on a public repo are world-readable, so the workflow prints the
boolean and nothing else** — breach detail (counts, revision ids, case ids, assertion keys)
stays in the response body and on the gated dashboard.

**Who watches the watchman.** Every run writes a `sweep_run` heartbeat — start, finish, what
it did, the verdict — and the dashboard's staleness line is the detector. A rotated bearer
secret, a 500 from `/api/sweep`, a dead deployment or a Neon outage all make runs red, which
is the alarm working. **GitHub disables scheduled workflows in a public repo after 60 days
without repo activity and mails the owner when it does.** What remains genuinely
undetected-until-you-look is a disabled schedule whose disable notice was missed; that is
accepted rather than solved, because an external dead-man's switch costs a fifth hosted
account and a monthly keep-alive commit puts permanent junk in the history of a public
artefact. The sweep's jobs are all reconciliation, so a dead sweep degrades slowly — retries
stall, reaps stall, tombstones strand — and `reconciler_stuck` catches the last of those the
moment it resumes.

**Manual retry is the operator's alone.** After three attempts a row is `failed`; only
*transient* rows are retryable at all, since a deterministic failure will fail identically
forever, and the case that justifies a manual path is not one row but an R2 outage that
burned three attempts across forty of them. So the CLI gains a bulk-filterable requeue
(`status → pending`, `ingest_attempts → 0`) that **refuses deterministic rows** rather than
merely discouraging them. It is not a dashboard button, because that would cost the
read-only property for a case that happens during outages, when the operator is at a laptop
anyway.

**Every threshold here is a guess** — 12 h, 7 d, 5-per-hour, 50%, 1 h and 24 h are reasoned
but unevidenced against zero traffic and no incident history. They are constants in app code
with tests, so retuning is a reviewed commit; expect the first month of real uploads to move
at least one. And the alarm depends on **one GitHub account setting nothing in the repo can
enforce** — notifications for failed Actions runs must be on for the repo owner. It is on by
default and it is a one-time check, but it is the single point of failure in the push path.

_Source: [Operating and observing ingest](docs/wayfinder/tickets/019-ingest-observability.md),
[Verifying the production-only edges](docs/wayfinder/tickets/024-verifying-production-only-edges.md)_

### 5.11 The takedown pipeline

**Two classes.** Class A is voluntary withdrawal by the uploader: it tombstones one programme
or one revision and **leaves forks intact**. Class B covers rights complaints and personal-data
complaints, including third-party erasure requests, and **cascades down the fork subtree,
unconditionally, below a tainted fork**.

**Class A is self-service — a button on the owner's own programme, no operator involved.**
Withdrawal is the uploader's own act and the CC-BY grant is irrevocable, so there is nothing
to adjudicate: the outcome is identical whoever presses it, and queueing the one class with
zero legal ambiguity behind one operator with no SLA would make it the slowest. It touches
one programme and does not cascade, so the row work is a bounded single-programme batch that
`neon-http` handles. Both granularities are offered — whole programme, or a single revision,
because an owner who posted the wrong file as rev 7 should not destroy a two-year series to
fix it. Withdrawing the current revision repoints `current_revision_id` to the newest
survivor; withdrawing the last tombstones the programme. Guard rails, since this is a
non-expert firing an irreversible action with no plan/apply in front of them: **typed
confirmation naming the programme**, and the two facts nobody expects stated plainly — the
bytes are destroyed permanently, and existing forks stay published. Accepted risk: a
compromised account can mass-withdraw, and there is no undo by design.

**Class B runs from the CLI, in four steps, and the order is load-bearing.**

1. **Rows, in one interactive transaction.** Tombstone every affected revision, repoint every
   `current_revision_id`, tombstone every programme left with no live revision, void the
   programme's votes. Commits whole or rolls back whole.
2. **Bytes.** Copy `original.xer.gz` to quarantine, then delete the public objects, prefix by
   prefix, **idempotently** — a delete of a missing key is a success.
3. **Purge, verified.** Cloudflare single-file purge by explicit URL, batched. Not
   fire-and-forget.
4. **`bytes_deleted_at` is written only on a confirmed non-200** from a plain `GET` of the
   purged public URL, with no cache-buster. That is the definition of "verified purge".

Rows first because rows are the reversible half and bytes are never destroyed until the
recoverable work is known-committed; it also closes every path a user actually takes — the
page, the shelf, the download button — in one atomic commit, leaving as residual exposure
only someone who already holds the direct blob URL, which is strictly smaller than the page
staying up. Purge strictly *after* delete, because purging a live origin only makes the edge
refetch and re-cache. A crash between steps is detectable and resumable: rows never delete,
so a half-applied cascade leaves the fork tree structurally intact and a tombstoned revision
with undeleted bytes is a plain SQL predicate — the same one the sweep reconciles on.

**Quarantine, and the reason for it.** Nothing authenticates a complainant — anyone can
report, no account required, correctly, since a rights holder will not sign in with Google to
complain — which means an unauthenticated stranger can trigger the permanent destruction of
someone else's published programme and every fork of it, adjudicated by one tired person.
That is a griefing vector, and for a solo operator the only affordable defence is an undo
window. **Class B `original.xer.gz` goes to a private prefix for 30 days**: no public access,
not served, not CDN-fronted. **Only `original.xer.gz` is quarantined** — the other two objects
are rebuilt lazily from the raw file on reversal, so they are destroyed immediately. Class A
gets no quarantine, because the owner holds their own copy and may simply re-upload it.
**After 30 days a mistaken Class B is not recoverable**, stated plainly rather than implied.

**Intake.** The public form at `/report` writes a `takedown_report` row, and **that row is the
system of record**; the published mailbox stays as a second channel, and anything arriving by
mail is transcribed into a row by the operator before adjudication. No mail is sent by the
app, so nothing depends on infrastructure the stack does not have. Three jobs only the row
can do: the plan file needs a case reference to point at, `name_as_it_appears` is the
structured input `takedown find` consumes (a free-text email gives the operator a paragraph
to interpret at 2 a.m.), and it carries the disposition including the softener's hold state.
Spam control on an unauthenticated public write is **Cloudflare Turnstile** — free, and
Cloudflare is already in the estate — plus a per-IP rate limit. **`reporter_contact` is purged
90 days after the case closes**; the rest of the row is kept forever. The dashboard renders
everything needed to *decide* and **never renders the contact**; the CLI prints it when the
operator goes to act, on the same machine they reply from — so the only page that could leak
a complainant's address does not have it to leak.

**Tombstone copy — three lines, and the third exists so a blameless owner is never rendered
as accused:**

| Case | Copy |
|---|---|
| Class A | *withdrawn by uploader* — the uploader's own act, safe to attribute |
| Class B, complained-about | *removed following a rights or personal-data complaint* — **no case reference and no complainant**. Publishing the case id invites correlation across takedowns; naming the complainant in a personal-data complaint would republish the exact data the takedown was for |
| Class B, cascaded fork | *removed because a programme it was forked from was removed following a complaint*, with the ancestry link intact — the cascade is unconditional and knowingly destroys innocent people's published work, so the complained-about line would read as an accusation against someone who is not accused |

The tombstone **stays at its URL forever and stops being findable** — `noindex, follow`,
applied to both classes uniformly.

**The blameless fork owner is not notified in v1.** They learn by visiting. There is no
operator correspondence anywhere in the Class B flow — a deliberate call, because a
one-operator site that owes manual emails on every cascade will not send them.

**The softener** is operator correspondence, not a product flow: the owner may upload a
cleaned revision and the operator tombstones only the tainted ones, using
`takedown plan --revisions` to narrow and `takedown find` scoped to one programme to verify
the new revision is clean. Owner contact is a Clerk lookup, mailed by hand at the operator's
discretion. Deliberately **not** built: an in-app "your programme has a complaint" notice,
which would automatically disclose an unadjudicated complaint to the person complained about.
Cost: one status value, `awaiting_owner`.

**Finding a name is an on-demand corpus scan with no index and nothing persisted.** Personal
data is confined to `original.xer.gz` by construction — Postgres holds no name and neither
derived object does — so there is nothing to search. Indexing `rsrc_name` into Postgres is
**refused outright**: it would build a searchable index of every person named across the
entire corpus, a far larger personal-data liability than the files themselves, needing its own
lawful basis. `takedown find "<name>"` fetches each `original.xer.gz`, decompresses, and
**greps the whole plain-text file case-insensitively** — no parsing, no field list to drift out
of sync with Oracle's schema, catching a name wherever it lands including memos and UDF free
text. It parses only to *render* a hit: table, field, matched value, programme slug, `rev_no`.
Scale is fine because R2 egress is structurally free, so a full scan costs only time —
~30k objects at the 10,000-programme ceiling, minutes on a parallel fetch.

_Source: [What tooling does the operator need to run a takedown?](docs/wayfinder/tickets/017-operator-takedown-tooling.md),
[Verifying the production-only edges](docs/wayfinder/tickets/024-verifying-production-only-edges.md),
[The site's static pages](docs/wayfinder/tickets/030-static-pages.md)_

### 5.12 The operator CLI

**A CLI in the repo, run from the operator's machine against production.** Not an admin
route, not `psql`, not SQL scripts. The deciding argument is a capability rather than a
preference: `drizzle-orm/neon-http` is batched and non-interactive only, so an in-app admin
route *structurally cannot* wrap a cascade in one transaction and would execute N independent
batches with no rollback. A laptop has no Function runtime constraint, so the CLI opens an
interactive session and the row half commits or rolls back whole — **the tool that needs a
transaction most is the one place in this system that can have one.** Three consequences fall
out: the most destructive operation in the system **never has a URL**; an in-app admin UI
would be built for a user base of exactly one, who already has a terminal; and bare `psql`
plus a runbook is out, because the cascade is a recursive CTE plus correlated writes plus N R2
prefix deletes plus a purge API, and the operator would be hand-copying uuids into an
object-store command at 2 a.m. **Accepted cost: no takedown from a phone.**

Credentials live in a local `.env`, never in the repo and never in Vercel: a Neon connection
string, an R2 token with delete on the bucket, an R2 **admin** token for bucket
configuration, and a **purge-scoped** Cloudflare API token.

| Command | What it does |
|---|---|
| `takedown find "<name>" [--programme\|--uploader\|--sector\|--since]` | on-demand grep of every `original.xer.gz`; prints table, field, matched value, slug, `rev_no`; output feeds `takedown plan` |
| `takedown plan --case <id> --class B --programme <slug> [--revisions 4,5,6] -o plan.json` | writes the JSON plan — preview, ledger and resume point in one artifact |
| `takedown apply plan.json [--resume]` | re-derives the affected set, **diffs it against the plan and aborts on any difference**, then runs steps 1–4 |
| `takedown reverse <case-id>` | inside the 30-day window: un-tombstones the rows, restores `original.xer.gz` from quarantine, repoints `current_revision_id`, leaves the derived objects absent for lazy rebuild |
| `ingest requeue` | bulk-filterable; `status → pending`, `ingest_attempts → 0`; **refuses deterministic rows** |
| `report show <case-id>` | the sole reader of `reporter_contact` |
| `ops bucket apply` | `PutBucketCors` + PUT `/robots.txt` against `$S3_ENDPOINT` |
| `ops bucket check` | `GetBucketCors` + GET `/robots.txt`, diffed against the repo, non-zero on drift; plus `ops.r2dev.disabled` |

**Why apply diffs rather than pins or re-derives.** Pinning alone leaks — a fork taken in the
plan→apply window survives, and a fork's first revision *is* a copy of the tainted bytes.
Re-deriving alone means the operator authorised set X and the tool destroyed set Y, which for
an irreversible delete defeats the point of a preview. Diff-and-refuse gives both: **the
executed set is always the reviewed set**, and a moved graph is surfaced rather than absorbed.
It is cheap because it almost never fires — one operator, and creating a fork means uploading
a multi-megabyte file into a minutes-long window. **It resumes for free**, because the diff
compares membership rather than status and rows never delete, so a partially-applied cascade
re-derives to the same set with some of it already tombstoned. A `pending_takedown` flag
freezing the subtree against new forks was rejected: a column plus an upload-path predicate to
defend a window diff-and-refuse already covers.

**What the plan carries:** case reference, class, selection, and a headline led by the number
the operator should hesitate over — **N revisions across M programmes, of which K belong to
other people** — because a resource dictionary is stable across a two-year series, so the
default selection is series-wide and the summary must show what that costs. Then the
per-programme breakdown, every blob key and every purge URL. **Plan files stay local and are
never committed**: they name programmes, owners and, in a personal-data case, the searched
name, and a durable store of who complained about what beyond the report row is exactly what
the no-index rule refuses to build.

**`ops.r2dev.disabled` is not optional.** If the R2 custom domain is attached *and* the
`r2.dev` development URL is left enabled, the bucket has **two public origins for the same
bytes**, step 3 purges one of them, the purge verification GETs the blob-host URL, gets its
non-200, writes `bytes_deleted_at` and reports **a verified purge that is not true** — a worse
failure than the one the instrument was built to catch, because it is silent *and* reports
success. The check is a config read (`GET /accounts/{id}/r2/buckets/{bucket}/domains/managed`
returns `{bucketId, domain, enabled}`), which is banned in the app and permitted on the
laptop, and it cannot be done from the sweep: if the URL is disabled there is no hostname to
probe, so behaviour-observation has nothing to observe. Pointing a CNAME at the `r2.dev`
subdomain is documented by Cloudflare as an unsupported access path, so there is no version of
this where a domain is owned and a zone is skipped.

_Source: [What tooling does the operator need to run a takedown?](docs/wayfinder/tickets/017-operator-takedown-tooling.md),
[Operating and observing ingest](docs/wayfinder/tickets/019-ingest-observability.md),
[Verifying the production-only edges](docs/wayfinder/tickets/024-verifying-production-only-edges.md),
[The blob host and the site's domain](docs/wayfinder/tickets/025-blob-host-and-domain.md)_

### 5.13 Verifying the production-only edges without a staging environment

There is no staging environment, and the local stack (MinIO for R2, a local Neon HTTP proxy)
reproduces the S3 API and the Neon wire faithfully and **no part of Cloudflare's CDN**. Three
things live in that gap: does R2 store the signed header, does the edge serve it, and is the
live bucket document the one we meant.

**Three layers, each with exactly one verifier:**

| Layer | What can be wrong | Who can prove it right |
|---|---|---|
| **Our code** | the presign stops signing `Cache-Control` / `X-Robots-Tag`; the repo's CORS document is wrong | a PUT through the product presign into MinIO, then HEAD the object back |
| **R2** | R2 stops storing a signed `x-robots-tag`; the live bucket CORS is not the repo's document | a PUT through the product presign into real R2; `GetBucketCors` diff |
| **The edge** | Cloudflare strips a header, overrides the TTL with a Cache Rule, or a purge does not take | HEAD the public blob-host URL and read what the edge served |

There are exactly two ways any of this goes wrong — **a commit** changes what the presign
signs, or **a hand-edit in a vendor dashboard** changes what the bucket or the edge does, with
no commit anywhere to hang a check off — so no single instrument catches both at the right
moment. Three instruments, each catching something the others structurally cannot:

**1. CI, on every PR including forks, no secrets.** `pnpm test:edge-contract` against the
compose stack, a **required GitHub status check on `main`**.

| Key | Method | Expect |
|---|---|---|
| `ci.presign.original.cache_control` | call the product presign for the `original.xer.gz` role | `cache-control: public, max-age=3600`, **no** `immutable` |
| `ci.presign.original.x_robots_tag` | same call | `x-robots-tag: noindex, noarchive` |
| `ci.presign.derived.cache_control` | server-side PUT helper for `derived.v{N}.json` | `public, max-age=31536000, immutable` |
| `ci.presign.activities.cache_control` | same, `activities.json.gz` | `public, max-age=31536000, immutable` |
| `ci.roundtrip.original` | execute the presigned PUT into MinIO, then `HeadObject` | both headers returned byte-identical to what was signed |
| `ci.roundtrip.derived` | server-side PUT then `HeadObject` | year-long `immutable` returned |
| `ci.cors.document_applies` | `ops bucket apply` against MinIO | exits 0 |
| `ci.cors.preflight` | `OPTIONS` with `Origin: http://localhost:3000`, `Access-Control-Request-Method: PUT`, and `Access-Control-Request-Headers` = **the exact list the presign signed** | origin echoed, `PUT` allowed, every signed header allowed |
| `ci.cors.foreign_origin_refused` | same with `Origin: https://evil.example` | not allowed |
| `ci.robots.object_written` | `ops bucket apply` then `GetObject /robots.txt` | body is `User-agent: *\nDisallow: /` |
| `ci.download_link.nofollow` | render the detail page download link | `rel="nofollow"` present |

Deriving the preflight's request-header list **from the presign's own output rather than from
a constant** is the point of it: it makes "the presign changed" and "CORS is now wrong" one
test failure instead of two unrelated incidents six weeks apart.

**2. The `edge_drift` sweep rule, every 15 minutes**, using the app's existing object-scoped
R2 token — no new secret anywhere.

| Key | Method | Expect |
|---|---|---|
| `edge.canary.minted` | presign + PUT the canary through the product code path | PUT succeeds |
| `edge.canary.cache_control` | HEAD the canary's **public blob-host URL** | `public, max-age=3600`, no `immutable` |
| `edge.canary.x_robots_tag` | same response | `noindex, noarchive` |
| `edge.canary.derived_cache_control` | HEAD the canary's `derived.v{N}.json` | `public, max-age=31536000, immutable` |
| `edge.canary.not_stale_beyond_ttl` | same response's `age` / `date` | freshness consistent with a 3600 TTL — catches a Cache Rule overriding Edge TTL upward |
| `edge.cors.preflight` | unauthenticated `OPTIONS` to the S3 API endpoint with the **production** origin and the presign's signed-header list | allowed |
| `edge.robots_txt` | HEAD `https://<blob-host>/robots.txt` | `200` |

The breach payload is `{rule: "edge_drift", failed: ["edge.canary.x_robots_tag", …]}` — **keys
only**, no URLs, no header values, no object ids, because Actions logs on a public repo are
world-readable. `/ops` renders the key list from the last `sweep_run`; the operator reproduces
the detail from a laptop.

**3. The laptop**, for the two things that structurally need an R2 admin token:
`ops.cors.matches_repo`, `ops.robots.matches_repo` and `ops.r2dev.disabled` (§5.12), plus
`takedown.purge.landed` — the plain `GET` returning non-200 that defines a verified purge.

**The canary is a verb, not an object.** A canary uploaded once by hand is a monument to a
header that was correct on the day it was created, and it stays green through precisely the
failure it was built to catch — **a static canary is green in exactly the case that matters**.
So the rule re-mints it through the production presign on every sweep run. Details that keep
it free:

- **A reserved uuid, not a reserved prefix**, so it is built by the same key-construction code
  every real revision uses — a branch in the presign being the very thing the canary exists to
  watch.
- **No Postgres row**, so it is invisible to the shelf, to `/ops` counts, to the purge list
  (computed from revision rows) and to the other four rules. Nothing has to learn to ignore it.
- **Synthetic bytes** — the smallest correctness-corpus fixture, ~1 KB gzipped, zero personal
  data — because the repo is public and names the uuid, so the URL is guessable by
  construction.
- **Overwritten, never appended**, so storage stays ~1 KB forever.
- **Three objects, not one**: the rule also writes the canary's `derived.v{N}.json` and
  `activities.json.gz` through the same server-side PUT helper ingest uses, so the year-long
  `immutable` on the other two writers is asserted rather than assumed.
- It goes through the presign **module**, not the route, so there is no Clerk session, no
  `upload_intent` row and no interaction with the presign rate limits.

The three subjects that were rejected: **the most recent real upload** is `original.xer.gz` —
the one object all personal data is confined to — so the checker must never GET it, and it does
not exist on day one, which is precisely when provisioning is most likely to be wrong; **a
sample** carries no more information than one object, because the headers come from one call
site so drift is total rather than per-object.

> **GAP:** the canary's blob key. It is specified as a reserved revision uuid
> (`{CANARY_REVISION_UUID}/original.xer.gz`) built by the same key-construction code as every
> real revision, but that code's template is
> `p/{programme_id}/r/{revision_id}/original.xer.gz` — so whether a **reserved programme uuid**
> is also minted, or the key construction takes a different shape for the canary, is unfixed.

**Deploy-blocking or an alert: both, and each half is caught where it belongs.** The code half
is caught **before merge**; the production-state half is an alert; and the takedown urgency is
honoured at the moment it becomes urgent, because a `takedown apply` that cannot confirm its
own purge does not write `bytes_deleted_at` and therefore does not report success. There are no
severity levels — one operator, one channel. "Deploy-blocking" means **a required GitHub
status check on `main`**, not a Vercel check: the build step runs before the deployment exists
and cannot fetch its own URL, and on Hobby production deploys on push to `main` with no
promotion gate between "build succeeded" and "this is public". Getting a real gate would need
Vercel's paid promotion controls or abandoning Git-integration deploys for a CI-driven
`vercel deploy --prebuilt --prod`; both are a new deployment model bought to defend a header.
The residue is stated rather than hidden: **the operator is the repo admin and can push past
their own branch protection.**

**Provisioning checklist → assertion map** (`docs/operating.md`). Every manual step has a
runtime assertion that fails if the step was skipped, mis-done, or later undone.

| # | Manual step | Backed by |
|---|---|---|
| 1 | Create the R2 bucket | every assertion |
| 2 | Attach a **custom domain** on a Cloudflare zone you control | `edge.robots_txt`, `takedown.purge.landed` |
| 3 | Confirm no Cache Rule overrides Edge TTL for the blob host | `edge.canary.cache_control`, `edge.canary.not_stale_beyond_ttl` |
| 4 | Confirm no Response Header Transform Rule strips or adds headers on the blob host | `edge.canary.x_robots_tag` |
| 5 | Mint the app's R2 token — **object read/write only** | `edge.canary.minted` |
| 6 | Mint the operator's R2 **admin** token (local `.env` only) | `ops.cors.matches_repo` |
| 7 | Mint the purge-scoped Cloudflare API token | `takedown.purge.landed` |
| 8 | `ops bucket apply` against production | `edge.cors.preflight`, `edge.robots_txt` |
| 9 | GitHub: branch protection on `main` requiring the CI job | **nothing can assert this** |
| 10 | GitHub: Actions failure notifications on | **nothing can assert this** |

The one required Cloudflare Cache Rule is not the obvious one. Cloudflare's default cached
extension list includes `GZ` but does not cache HTML or JSON, so two of the three objects per
revision are cached and `derived.v{N}.json` is not — leaving every programme page open an R2
Class B operation and `edge.canary.derived_cache_control` asserting a pass-through header
rather than a cached response, green and measuring nothing. The rule is:

```
When  hostname eq "<blob-host>"
Then  Cache eligibility: Eligible for cache
      Edge TTL: Use cache-control header from origin
```

Deliberately **not** "Cache Everything with an Edge TTL override" — overriding Edge TTL is
precisely the failure `edge.canary.not_stale_beyond_ttl` exists to catch, and the 1-hour TTL
must arrive at the edge from the object's own header or the takedown story breaks in the way
that is invisible until a takedown.

**Accepted costs.** The HEAD reads the **edge**, so it reads a response up to one TTL old: a
fixed header takes up to an hour plus one run to go green and a broken one the same to go red.
That is what a one-hour TTL means, and cache-busting the fetch would test the wrong layer. If
Cloudflare's HEAD handling on an R2 custom domain turns out not to return the cached response's
headers faithfully, use `GET` with `Range: bytes=0-0` and assert the same keys — never add a
cache-buster. **The canary cannot exercise the browser**, but a browser that fails to send a
signed header gets a SigV4 mismatch and a 403 — loud, at the uploader, immediately — so the
uncovered case is the one that cannot be silent.

**Cost: $0/month.** Actions minutes are free on a public repo; the canary is ~1 KB and
overwritten; the rule's writes are ~96 Class A operations a day against R2's free 1M/month and
its reads ~8,600 Class B a month against 10M. No new hosted account, no fifth vendor, and the
Active CPU trigger does not fire because the added work is network wait, which Vercel's Active
CPU meter does not bill.

**Clerk and Vercel are deliberately excluded.** A Pro trigger is a budget decision, not a
correctness event; watching one would cost a Vercel API token in the app to read a number the
vendor already mails about; Clerk's failure mode is loud (broken production config means nobody
can sign in, which surfaces in minutes); and the failure modes are different in kind — this
section's failures are *a file that should not be indexable being indexable* and *bytes that
should be gone being downloadable*, which is the only kind that justifies standing machinery.

_Source: [Verifying the production-only edges](docs/wayfinder/tickets/024-verifying-production-only-edges.md),
[The blob host and the site's domain](docs/wayfinder/tickets/025-blob-host-and-domain.md)_

### 5.14 Residual risk

**iOS Safari has never run the scan.** The claim that a cap-sized scan does not kill a mobile
Safari tab is reasoned rather than measured — iOS enforces a per-tab process-memory ceiling no
desktop engine reproduces, and the capped-heap device proxy that evidences "the remedy wins by
never producing the condition" is a **no-op outside Chromium**, so that argument stands in
Blink alone. It is ten minutes on a borrowed handset served over `https://` (never a plain-http
LAN address, which removes `crypto.subtle` and nothing else and produces a false negative
reading as *"Safari has no WebCrypto"*); if the tab dies, the blind-upload fallback §5.2
declines is back on the table, against the alarm objection recorded there. Nothing in this
section waits on it.

_Source: [Does mobile Safari survive the cap-sized scan?](docs/wayfinder/tickets/046-ios-safari-scan.md)_

---

## 6. The site: routes, storefront, programme page, and the signed-in space

The site is small on purpose: one shelf, one programme page, one contributor page, one
leaderboard, four private pages, five static pages. Two rules run through all of it and are
worth reading before the tables.

1. **No public route reads the session on the server.** Every public page renders exactly
   one artefact — the signed-out render — and everything that depends on who is looking
   arrives in the browser from a single later request. This is enforced by configuration,
   not by discipline: `clerkMiddleware` is scoped to `/me`, `/ops`, `/api` and `/__clerk`,
   and Clerk's `auth()` requires that middleware, so `auth()` **structurally cannot work**
   on a public route.
2. **Nothing in a browse row may flow.** Every fact on the shelf row occupies a fixed slot
   at a fixed x, so the eye compares down a column. This rule, written for legibility, is
   also what makes rule 1 free of layout shift.

---

### 6.1 The complete URL set

| Route | Renders | Access | Rendering | Cache behaviour |
|---|---|---|---|---|
| `/` (bare) | the shelf: home lede, filter bar, 25 rows, footer | public | dynamic — the page reads `searchParams`, a Request-time API | no page TTL; its two Postgres queries are wrapped in `unstable_cache` at **60 s** |
| `/?page=N` | shelf, page N at 25 rows | public | dynamic | as above. `?page=1` **308s** to `/`; a page past the last **404s** |
| `/?sector=…&size=…&p6=…&progressed=1&q=…&sort=…` | filtered/searched shelf | public | dynamic | as above. `Disallow`ed in `robots.txt`, so this volume is human |
| `/p/{slug}` — published | the programme page at `current_revision_id` | public | **ISR** | **3600 s** |
| `/p/{slug}` — tombstoned (Class A or B) | the tombstone at its own URL | public | ISR | 3600 s; the `noindex` is in the cached bytes |
| `/p/{slug}` — no published revision | **404 to everyone**, including the owner | public | ISR 404 | 3600 s **plus `revalidatePath` at publish** |
| `/p/{slug}/r/{n}` | that revision, all three classes | public | ISR | 3600 s. `n` = current canonicalises to `/p/{slug}`; superseded `n` self-canonicalises and is `noindex, follow` |
| `/u/{handle}` | contributor page (§6.10) | public | dynamic — paginates on `?page=N` | none |
| `/contributors` | the leaderboard (§6.11) | public | ISR | **3600 s** (one page, no query params in v1) |
| `/sector/{code}` | **not in v1** — see §6.6 | — | — | — |
| `/upload` | the upload flow | signed-in | dynamic | never cached |
| `/me` | index of every Programme you own (§6.12) | signed-in | dynamic, server-rendered | never cached |
| `/me/bookmarks` | your bookmarks as shelf rows | signed-in | dynamic, server-rendered | never |
| `/me/votes` | Programmes you upvoted, then Handles you upvoted | signed-in | dynamic, server-rendered | never |
| `/me/account` | Handle, rename, sign out, delete account | signed-in | dynamic, server-rendered | never |
| `/ops` | read-only operator dashboard | operator (env-var Clerk-id allowlist) | dynamic | never |
| `/api/viewer` | per-viewer state (§6.13) | signed-in only in practice | dynamic | **`Cache-Control: private, no-store`** |
| `/about` | long-form description | public | static | until next deploy |
| `/terms`, `/privacy` | current legal text | public | static | until deploy |
| `/terms/v{n}`, `/privacy/v{n}` | a specific version; superseded ones `noindex` | public | static | until deploy |
| `/report` | 017's intake form (Turnstile client-side, Server Function submit) | public | static shell | until deploy |
| `/robots.txt` | build output of `app/robots.ts` | public | static | until deploy |
| `/sitemap.xml` | `/`, every published `/p/{slug}`, every listable `/u/{handle}`, the six static routes | public | ISR | 3600 s |

Mechanics that go with the table:

- **The middleware matcher is the load-bearing line.** Routing Middleware runs globally
  *before* the CDN, so Clerk's documented catch-all matcher would put a billed Function
  invocation in front of every cache hit and quietly cost the whole caching design. What
  ships is `['/me/:path*', '/ops/:path*', '/api/:path*', '/__clerk/(.*)']` and nothing else.
- **`PUBLIC_ROUTES` is a real constant.** The sitemap and the footer build from it, and CI
  evaluates the exported matcher against it — adding a public route without excluding it
  from the matcher is a test failure, not a silently uncached page.
- **A public route must never emit `Set-Cookie`**; Vercel will not cache a response that
  does, and Clerk's middleware refreshes the session cookie. Same one line answers it.
- **Invalidate where the write runs inside the app; rely on the TTL where it runs on the
  laptop.** Publish calls `revalidatePath('/p/{slug}')` (a live URL 404s during the pending
  window and that 404 is cacheable). Class A withdrawal and 015's in-place edits revalidate,
  because they are Server Functions. Class B does **not** — its row work runs on the
  operator's laptop, and the one-hour TTL is the bound. Votes deliberately do not
  revalidate anything.
- **Next.js 16 Cache Components (`cacheComponents: true`) is refused**, dated rather than on
  principle: HTML-limited bots skip the prerendered shell and render dynamically, which
  turns every crawler fetch of ~10,300 sitemap URLs into an invocation plus a Neon query
  plus an R2 GET. CI asserts the flag is absent or false. The reopen trigger is in §6.13.

> **GAP:** the URLs of the *new revision* and *fork* upload entry points are never fixed —
> 011 declares upload shape by route ("only from your own programme page", "from another
> programme's page") and only `/upload` is ever named. Nor does any ticket say how `/upload`
> is protected, since the `clerkMiddleware` matcher covers only `/me`, `/ops`, `/api` and
> `/__clerk`.

_Source: [How is a public page with per-viewer state cached?](docs/wayfinder/tickets/035-caching-per-viewer-state.md) · [The site's own crawl surface](docs/wayfinder/tickets/033-site-crawl-surface.md) · [The signed-in user's own space](docs/wayfinder/tickets/023-signed-in-users-own-space.md)_

---

### 6.2 The storefront: there is no card, the shelf is a row list

Four structurally different layouts were built against 40 programmes — poster grid (S-curve
as hero art), row list, verdict-first card (DCMA as a hero number), and a time-rail grid on
one shared calendar axis. **The row list won both jobs asked of it — the one you scan and
the one you click from — so the grid ships one density and no card.** A card that leads with
a picture spends its best real estate on the fact planners judge last; a row carries twelve
facts without crowding and lets the eye compare down a column.

**A shared calendar axis is rejected.** Vintage is not a browsing signal and a 14-month job
smears to ~6% of a 17-year axis. Each row's window curve gets a **local axis** normalised to
its own column, and the absolute dates print as text at the ends — the reader compares
*shape*.

#### The row, left to right

```
┌──────────┬────────────────────────┬──────┬────┬──────┬──┬──┬──────┬──────────────────────────┬────┬──────────┬───┐
│ float    │ programme              │sector│ P6 │upvote│sv│rv│activs│ window & data date       │cmpl│ DCMA     │age│
├──────────┼────────────────────────┼──────┼────┼──────┼──┼──┼──────┼──────────────────────────┼────┼──────────┼───┤
│ ███▌░░▏  │ Station remodelling —  │ Rail │6.0 │ ▲214 │🔖│r23│ 1,751│      ╭──────╮            │41% │▮▮▮▮▮▮▯▯▯▯│3mo│
│ 69 27  4 │  Stage 3               │      │    │ ▁▃▅▇ │  │   │▮▮░░░░│  ╭───╯      ▼ data date  │▰▰▱▱│┄┄┄┄ 6/10 │   │
│          │ planner_dave · forked  │      │    │      │  │   │      │{start}  {data date} {fin}│    │          │   │
│          │  from Depot resignal…  │      │    │      │  │   │      │                          │    │          │   │
└──────────┴────────────────────────┴──────┴────┴──────┴──┴──┴──────┴──────────────────────────┴────┴──────────┴───┘
```

Twelve slots, in this order. CSS grid, `gap: 12px`, row padding `10px 14px`; the header row
is sticky and labels every slot:

| # | Header label | Width | Contents | Source |
|---|---|---|---|---|
| 1 | `float` / `neg` `0–44d` `>44d` | 128px | 30px float distribution sliver + **three fixed numeric slots** under it (percentages, sum 100) | `card.float_mix` |
| 2 | `programme` | `minmax(150px, 1fr)` | title (13.5px/600) + warning badges, then a sub-line: handle · `forked from X` | typed columns |
| 3 | `sector` | 84px | sector badge, or a ghost badge reading `unsectored` | `programme.sector` |
| 4 | `P6` | 58px | version string, own column | `revision.p6_version` |
| 5 | `upvotes` | 88px | votable pill `▲ {n}` + a √-scaled magnitude bar beneath | `programme.vote_count` |
| 6 | `save` | 32px | bookmark control, a fixed 26×26 icon-only box | `bookmark` (per-viewer) |
| 7 | `rev` | 40px, right-aligned | `r23` | `revision.rev_no` |
| 8 | `activities` | 108px | count, then a **fixed 10-slot track**, one slot per 1,000 | `revision.activity_count` |
| 9 | `window & data date` | 262px | S-curve on a **local axis**, elapsed portion filled heavier, 2px data-date rule with a marker; captions `{start}` / `▼ data date {date}` / `{finish}` as month-year | `card.s_curve` + dates |
| 10 | `complete` | 88px | `41%` over a progress bar | `revision.pct_complete` |
| 11 | `DCMA` | 112px | 14 cells (pass / fail / dashed skip) + printed `6/10` | `checks_passed`, `checks_applicable` |
| 12 | `age` | 52px, right-aligned | `3mo` | `revision.uploaded_at` |

Rules the prototype settled, each of which is a constraint on the build:

- **Nothing in a row may flow.** Rev, P6 and the float percentages were originally a prose
  sub-line and read as noise, because the same fact landed at a different x on every row.
  Only two variable-length strings survive, both in slot 2: the handle and the fork parent.
- **Empty activity slots stay drawn.** Free-floating blocks of 1,000 render a
  310-activity programme as a blank cell, and a blank cell reads as missing data rather than
  "small". Over 10,000 activities the count gets a `+` and the track's fill darkens.
- **The three float numbers are relief, not decoration.** The sliver's fills are `#d03b3b`
  (negative), `#2a78d6` (0–44 days), `#eda100` (over 44 days); light-mode amber measures
  2.11:1 against the surface, below the 3:1 floor, so the printed percentages are what make
  the band legible and **may not be dropped for density**.
- **The DCMA strip always rides beside its printed ratio.** Pass-green ↔ fail-red is ΔE 4.1
  under deuteranopia (an all-pairs FAIL), so colour is never the only channel; the strip
  also carries its own denominator, so a 10-check programme is never mistaken for a failing
  14-check one.
- **One S-curve line, never two.** Planned-versus-actual needs baseline tables no v1 file
  carries — the same absence that skips DCMA 11, 13 and 14 — so progress is a marker on one
  curve and nothing more.
- **Badges in slot 2:** `⚠ partial` when `card.issues_count > 0`, `no WBS` when
  `card.wbs_depth == 1`.
- **Baseline is cut from the shelf entirely.** No `is_baseline` badge, no
  "baseline · not started" caption; an unprogressed tender simply reads `0%`.
- **No fork count on the row.** `forked from X` stays because it names a programme you may
  already know; the fork *family* is a detail-page concern and the fork *count* exists only
  on the contributor page.

#### What the row needs from the row payload

The grid reads **zero blobs**. Every graphic comes from the `card` JSONB column, ~200 bytes:

```jsonc
{ "s_curve": [16 floats, 0→1],                        // window curve, normalised
  "float_mix": { "neg": 69, "ok": 27, "high": 4 },    // percentages, sum 100
  "wbs_depth": 4,                                     // renders the "no WBS" badge at 1
  "issues_count": 2 }                                 // renders the "partial" badge
```

The curve is normalised rather than stored as absolute counts, so it renders without knowing
the activity count and stays comparable between revisions. Because these are card fields, a
version bump that changes them requires an **explicit backfill**, not lazy recompute.

#### Empty and single-result states

- **Empty** names the filters that produced it, explains the reason when the data model makes
  the combination inevitable, offers the one filter worth clearing, and falls back to
  uploading. Prototype copy: *"Nothing on the shelf for 'negative float | Marine | P6 19.12'.
  Three filters are on. Marine has 2 programmes and neither is progressed — negative float
  can only appear on a programme with progress."* → **Clear the progress filter**, with
  *"or upload a programme — it publishes under CC-BY 4.0 and appears here immediately."*
- **Single result** keeps the row and adds a line pointing at the fork family, since one
  result usually means you have found a variant of something.

_Source: [The storefront card and browse grid](docs/wayfinder/tickets/007-storefront-card-and-grid.md)_

---

### 6.3 Browse: ordering, sorting, facets, pagination

**The shelf is the homepage.** `/` renders the row grid directly — full catalogue, filter
bar, sort control. No hero, no curated strips, no separate `/browse` route. The
composed-homepage alternative (Featured / Newest / Most-forked strips) was rejected because
launch stock is authored sector templates: the whole shelf is two or three screens, and a
strip of five is a worse view of the same rows.

#### Default order, frozen

```sql
order by programme.created_at desc, programme.id desc
```

**Newest Programme first, and the order never becomes vote-weighted.** Recently-updated
loses because a Programme is new once and updated forever (a two-year monthly series would
hold the top permanently). Quality loses because DCMA inverts — the real live contract fails
check 7 at 69% negative float while a clean authored template passes by construction.
Operator-set rank loses because it is curation. A vote-weighted default is a popularity
ratchet and makes the front page unexplainable.

#### Sort menu

| Option | `sort=` | Orders by |
|---|---|---|
| **Newest** (default) | omitted | `programme.created_at desc, programme.id desc` |
| Most upvoted | `votes` | `programme.vote_count desc` (the denormalised column) |
| Largest | `size` | `revision.activity_count desc` on the current revision |
| DCMA checks passed | `dcma` | ratio `checks_passed / checks_applicable desc`, tiebreak `checks_applicable desc` |
| *Relevance* | — | appears in the control **only while `q` is set**, and is the active option then |

- The DCMA option is **labelled literally** — never "Quality", never "Best".
- Sorting on the ratio rather than the raw count is mandatory: applicable varies (10 without
  a baseline, up to 14 with), so counts compare different denominators. The tiebreak means a
  10/10 out of 14 applicable outranks a 10/10 out of 10, because more was actually tested.
- *Most viewed* is cut: nothing counts views, it would mean a write per render, and it is
  the most gameable signal on the shelf.
- **Self-votes are permitted**, so every Programme may carry one vote cast by its own owner.
  A constant offset reorders nothing.

#### The four facets, and the zero-count rule

Every facet is an existing indexed Postgres column; **no facet column is added**.

| Facet | Column | Values |
|---|---|---|
| **Sector** | `programme.sector` | the eight seeded codes (§6.5) |
| **Size band** | `revision.activity_count` | `s` < 500 · `m` 500–2,000 · `l` 2,000–5,000 · `xl` > 5,000 |
| **P6 version** | `revision.p6_version` | the version strings present in the catalogue — a *can I use this* filter, since a newer `.xer` will not import into an older P6 |
| **Progressed** | `revision.pct_complete > 0` | presence-only |

- **Combination: OR within a facet, AND across facets.** Rail-or-highways, sized-large *and*
  progressed.
- **Layout is a top filter bar, never a left rail.** A rail costs ~20% of viewport
  permanently and the columns that compress are the drawn ones, whose legibility is a relief
  rule rather than decoration. Four facets cost four clicks; twelve would not be acceptable.
- **Live conjunctive facet counts.** Each value shows a count computed against the current
  WHERE clause **minus that facet's own predicate** — otherwise selecting "rail" makes every
  other sector read zero. One extra query per shelf render: four `FILTER`-aggregate passes
  over a ≤10k-row table returning ~20 numbers. It is a separate query and does not touch the
  grid's one-query rule.
- **Zero-count values render disabled, not hidden.** A control list that shrinks as you
  filter jumps under the cursor, and a greyed `Highways (0)` is information. Static
  whole-catalogue counts were the trap option: `Rail (12)` that yields zero rows once size is
  applied is worse than no number.
- **The `xl` edge was pulled down from 10,000 to 5,000** so the band stays plausibly
  occupied rather than always empty.
- Cut facets, with the reason each fails: **licence** (one value site-wide), **has-forks**
  (needs a counter nobody else wants, or an `exists` per row), **has-resources**
  (measured: 86.4% vs 83.4% across the fixtures — discriminates nothing), **has-costs**
  (computed nowhere), **duration band** (needs an expression index and drops dateless
  programmes out of the filter entirely). **No tags in v1** — sector is the only
  classification axis; `tags text[]` + GIN is purely additive if it is ever wanted.

#### URL scheme and canonicalisation

One route, query parameters:
`/?sector=rail,highways&size=l&q=depot&sort=votes&page=2`

| Param | Values | Notes |
|---|---|---|
| `sector` | comma list of sector codes | OR within |
| `size` | comma list of `s`,`m`,`l`,`xl` | OR within |
| `p6` | comma list of version strings | OR within |
| `progressed` | `1` | presence-only; absent means no constraint |
| `q` | free text | triggers relevance ordering |
| `sort` | `new`,`votes`,`size`,`dcma` | omitted at default |
| `page` | integer ≥ 2 | omitted at page 1 |

**One filter state has exactly one URL:** omit any param at its default; fixed param order as
tabled; lowercase values; comma-separated multi-select (never repeated keys); multi-select
values sorted. Bare `/` is the default shelf.

#### Pagination

**Numbered pages, 25 per page, offset pagination**, with `rel=next`/`rel=prev` and the
result count rendered (`142 programmes · page 1 of 6` is itself a fact the browser wants).
Infinite scroll is rejected: it breaks the back button, and it is invisible to a crawler.
Offset rather than keyset is deliberate — `offset 9975 limit 25` is trivial at the 10k
ceiling, and offset is what makes `page=3` a real URL. **At launch page 1 holds everything
and no pagination chrome renders.**

#### Search: what it covers, and what it does not

A generated `tsvector` column on `programme` over **title and description only**, GIN
indexed, queried with `websearch_to_tsquery`; `setweight('A')` on title, `'B'` on
description. When `q` is set, ordering switches to `ts_rank desc`; an explicit `sort` param
still overrides. A **`pg_trgm` similarity fallback on `title`** runs when full-text returns
zero rows, so one stemmed miss ("depot" vs "depots") gives a "did you mean" instead of an
empty shelf.

Search does **not** cover:

| Not searched | Why |
|---|---|
| **Activity names** | ~63,000 rows per revision → ~1.9 billion rows and ~$66/month at the 10k × 3 ceiling. Dead for v1. |
| **WBS node names** | they live in `derived.json`, so indexing them means a new denormalised column fed by ingest and backfilled on every contract bump — and Fixture B has exactly one WBS node, so the field is empty for precisely the tender-shaped programmes that are launch stock |
| **Activity codes / code values** | not a facet and not indexed; code density is not even stable across programmes (~14 assignments per activity in Fixture A, ~6 in Fixture B) |
| **The uploader Handle** | "programmes by *dave_planner*" is a contributor page, not a text match, and stemming a pseudonym produces noise |
| **Tags** | none exist in v1 |
| **File contents** | never |

A dedicated search service is rejected on the cost model: it is an entire extra platform
floor plus a sync path that can silently drift, to index ~10k rows that fit in Postgres's
memory.

#### What the shelf never shows

One row per Programme, at its current revision, with `programme.status = 'published'` and
the joined revision `published`. **Tombstoned and `pending` never appear** — a null
`current_revision_id` keeps unpublished Programmes out of the inner join with no status
predicate. Result count and active-filter chips sit above the grid, chips individually
clearable.

#### Page furniture

- **Header:** wordmark + a permanent one-line strap, *"Public Primavera P6 programmes.
  Browse, download, fork."* Right-hand cluster is `Sign in` signed-out, `Upload · {Handle}`
  signed-in, the Handle linking to `/me`. No avatar, no Clerk `<UserButton>` (it renders the
  Google profile image). A one-line notice may appear under the header for signed-in viewers
  only (§6.12).
- **Home lede:** three paragraphs, ~95 words, rendered **only at the canonical bare `/`** —
  never at `/?sector=rail`, and identical for every viewer signed in or out. What the site
  is; what you can do with it and that nothing here is reviewed; why it asks for a Google
  identity. A dismissible intro band was rejected because it costs a state flag and produces
  two different first screens.
- **Footer, site-wide:** exactly six links — **About · Terms · Privacy · Contributors ·
  Report a problem · Source** — plus one sentence: *"Programmes are published by their
  uploaders under CC-BY 4.0. This site's code is Apache-2.0. Run by one person, best effort,
  with no warranty."* It is site-wide because most arrivals are a shared `/p/{slug}`, and the
  privacy policy must be reachable without logging in from any entry point.

_Source: [Browse, search, filter and ranking](docs/wayfinder/tickets/009-browse-search-ranking.md) · [The site's static pages](docs/wayfinder/tickets/030-static-pages.md)_

---

### 6.4 Rendering and cost of the shelf

- The shelf render issues **two Postgres queries**: the grid's one query (25 rows × 12 fixed
  slots, zero blob reads, no per-row aggregate) and the facet-count query. Both are wrapped
  in `unstable_cache` at **60 s**, so the render is CPU-only and the database sees at most
  one shelf query a minute at any traffic.
- **The per-viewer join is not one of them.** It moved off the shelf's request onto
  `GET /api/viewer` (§6.13), which restores the one-query rule rather than bending it.
- A new upload reaches the shelf within **60 seconds**. That lag is a courtesy to everybody
  else: the uploader's own path never goes through the shelf (the upload flow polls the row
  and lands them on `/p/{slug}`, and `/me` is the index). Under a frozen newest-first order,
  a minute's lag moves exactly one row.
- Estimated Active CPU: **~40 ms per shelf render**, ~50 ms per programme render, ~3 ms per
  viewer request. Every per-render CPU figure in this estate is an estimate — there are no
  analytics and runtime logs are kept for one hour, so nothing can measure a render.

_Source: [How is a public page with per-viewer state cached?](docs/wayfinder/tickets/035-caching-per-viewer-state.md)_

---

### 6.5 Sector: the value behind the shelf's organising facet

**Declared by the uploader, single-valued, asset class, eight codes. Nothing is inferred.**

| `code` | `label` | `sort_order` |
|---|---|---|
| `rail` | Rail | 10 |
| `highways` | Highways & roads | 20 |
| `aviation` | Aviation | 30 |
| `marine` | Marine & ports | 40 |
| `building` | Buildings | 50 |
| `water` | Water & wastewater | 60 |
| `power` | Power & energy | 70 |
| `process` | Oil, gas & process | 80 |

Ordered transport → vertical → utilities → process, not alphabetically, so the chip row
reads as related things sitting together. Rows are **seeded from a versioned file in the repo
and applied by migration**; adding a code is a PR and a deploy, never a hand-written insert
on production.

- **The axis is asset class** — what is being built or maintained. Work-type words
  (tunnelling, fitout, shutdown, turnaround, look-ahead, framework) are **not sectors** and
  go in the title and description, where the FTS finds them.
- **Sector is optional at upload and nullable.** Blank is the guaranteed state of every
  upload by someone who did not care, and at launch is plausibly the largest bucket.
- **Absent renders as follows:** the shelf row shows an `unsectored` ghost badge in its fixed
  slot; the facet lists the eight codes only, with **no `sector=none` chip and no ninth
  chip**; the detail-page breadcrumb collapses from `shelf / {sector} / {title}` to
  `shelf / {title}` and the byline drops the sector segment rather than printing a
  placeholder. Blank programmes stay fully reachable in the default unfiltered shelf and in
  search — they are absent only when a sector filter is applied.
- **The owner edits sector in place**, alongside title and description, on the Programme —
  it is identity, not content, so it is never a new revision. A fork may carry a different
  sector from its parent.

_Source: [Where does a programme's sector come from?](docs/wayfinder/tickets/015-sector-classification.md)_

---

### 6.6 `/sector/{code}` — specified, deliberately not built in v1

The route is right and only the catalogue is wrong, so it is deferred with a written trigger
rather than left open.

- **Trigger: at least four of the eight codes each hold ≥ 25 published Programmes.** 25 is
  the page size (the point at which a sector view is a page in its own right); four is half
  the list, which is what makes the route a set of pages rather than one page and seven
  404s. Together they imply ≥ 100 published Programmes.
- **The trigger is already printed on the front page.** The live conjunctive facet counts on
  the filter bar are the estate's only visitor-independent measuring instrument — they
  measure the catalogue, and the catalogue is the one class of fact that stays observable
  with no analytics.
- **When it ships:** `/sector/{code}` is the **canonical** form and self-canonicalises;
  `?sector=rail` stays `Disallow`ed and emits neither a canonical nor a `noindex`. The path
  route is **single-valued only** — `/sector/rail,highways` does not exist — so it is an
  entry point, not a filter state; adding a second sector or any other facet moves the
  visitor onto the query form. `/sector/rail?page=N` inherits the pagination contract
  unchanged.
- **An empty code 404s, and so does an unknown one.** The condition is *code exists in the
  `sector` table **and** has ≥ 1 published Programme*. A 200-with-a-sentence is treated as a
  soft 404 anyway and additionally needs prose the no-warranty rules must police.
- **There is no `/sector/unsectored`** — the largest bucket in the catalogue is the one with
  no landing page.
- Occupied codes go in the sitemap with `lastmod` = the newest published upload in that code.
- **No other facet earns a path route.** A facet qualifies only if it is (i) a closed set we
  seed, (ii) single-valued, (iii) a noun somebody would type, and (iv) stable enough that a
  URL minted today means the same thing in a year. Size bands fail (iv) — the `xl` edge has
  already moved once; P6 version fails (i) — the values come out of the files; `progressed`
  fails (ii) and (iii).
- **v1 build cost is nothing at all**: the facet chip keeps linking to `?sector=rail` and the
  breadcrumb keeps linking to the query form until the route exists.

_Source: [Do sector landing pages exist, now that ?sector= is uncrawlable?](docs/wayfinder/tickets/034-sector-landing-pages.md)_

---

### 6.7 The programme page: `/p/{slug}`

**One scrolling document — a dossier — and the activity table reads the whole blob.**

Three rivals were built and lost. *Workbench* (viewport-filling table) fails because the
activity table is the least differentiated thing on the page: P6 renders tables better and
anyone wanting rows can download the file. *Tabbed* fails because splitting Structure from
Activities puts the page's one real interaction across two tabs. *Verdict* (DCMA scorecard as
hero) is the closest rival and loses because DCMA inverts, so a quality-first page teaches
visitors to prefer templates — but it contributes its verdict sentence, and Tabbed
contributes one rule: **a visitor who never reaches the table never fetches
`activities.json`.**

#### The page, top to bottom

```
 shelf / Rail / Station remodelling — Stage 3
 ┌──────────────────────────────────────────────────────────┬────────────────────────────┐
 │ {title}                         [no WBS] [⚠ partially…]  │  ▲{n}  [🔖 Save]  [Fork]   │
 │ {handle} · [{sector}] · [CC BY 4.0] · P6 {v} · {age}     │  [Download .xer  {gz size}]│
 │ lineage  forked from {X} at r{n}, by {handle} ·          │  ( r{n} — current ▾ ) [Compare…]│
 │          {n} revisions · {n} forks of this · {n} in family│                           │
 └──────────────────────────────────────────────────────────┴────────────────────────────┘
 │ ⚠ Partially analysed. {issues[]}. Everything else on this page computed normally.    │
 ┌──────────┬──────────┬──────────┬──────────────┬──────┬───────────┬──────────┬────────┐
 │Activities│ Complete │  Window  │ Relationships│ WBS  │ Resources │Calendars │DCMA 14 │
 │  {n}     │   {n}%   │{yr}–{yr} │     {n}      │ {n}  │    {n}    │   {n}    │ {p}/{a}│
 │{n} milest│at {date} │{n} days ·│ {p}% finish- │{n}   │ {n} as-   │{n} in use│▮▮▮▮▮▮▯▯│
 │ones      │          │{n} workin│  to-start    │levels│ signments │{n} code  │┄┄┄┄    │
 │          │          │g ({k}-day)│             │deep  │           │ types    │        │
 └──────────┴──────────┴──────────┴──────────────┴──────┴───────────┴──────────┴────────┘
   "This programme fails 4 of the 10 checks that apply to it: leads at 2.1%, high float
    at 35.6%, negative float at 0.1%, high duration at 5.8%."   ← the verdict sentence,
    shown here with the prototype's measured values for the 20,000-activity fixture
 ── the fold ───────────────────────────────────────────────────────────────────────────
```

1. Breadcrumb `shelf / {sector} / {title}` — the sector segment drops when null, and renders
   **unlinked** on a tombstoned Programme.
2. `h1` + degenerate badges: `no WBS`, `⚠ partially analysed`.
3. Byline: handle · sector badge · `CC BY 4.0` · P6 version · age.
4. **Lineage line**: *forked from X at rN, by {handle} · N revisions · N forks of this ·
   N in the family*; a root reads *"root — nothing was forked to make it"*.
5. **Action cluster**: upvote pill · **bookmark** · `Fork` · `Download .xer` with the
   **gzipped** size printed (that is what the user waits for). No uploader vote pill here —
   the uploader is votable only from the contributor page, because a person-pill beside a
   programme-pill is two upvote buttons on one screen meaning different things.
6. Revision selector `r23 — current` + an inert `Compare…`.
7. `issues[]` banner when the programme is partially analysed.
8. **Eight fact tiles**, the last being DCMA.
9. **The verdict sentence.**
10. **Charts** — S-curve full width, then float and duration side by side.
11. **Quality** — hero ratio, FS meter, the 14 checks, exemplars on expand.
12. The critical / longest-path callout.
13. **Activities** — WBS tree (270px rail) beside the virtualised table.
14. Activity codes.

#### The eight fact tiles — exact labels, values and sub-lines

| # | Label | Value | Sub-line |
|---|---|---|---|
| 1 | `Activities` | count, thousands-separated | `{n} milestones` |
| 2 | `Complete` | `41%` (the `%` set smaller) | `at {data date}`, or `no data date` |
| 3 | `Window` | `{start year}–{finish year}` | `{n} days · {n} working ({k}-day week)`; appends `· the calendar {p}% of activities use` below 100% activity share; where the working-days state is `unavailable`, **the calendar-day span alone** |
| 4 | `Relationships` | count | `{p}% finish-to-start` |
| 5 | `WBS` | node count, or `none` | `{n} levels deep`, or `single node` |
| 6 | `Resources` | count | `{n} assignments` |
| 7 | `Calendars` | `calendar_count` (a fact about the file) | `{shape.calendars_in_use} in use` · `{n} code types` |
| 8 | `DCMA 14-point` | `6/10` (denominator set smaller) | the compact 14-cell strip |

Tile 3 is the one stat that does **not** follow the print-the-reason-verbatim rule used for
`longest_path`: `longest_path` owns a callout with room for a sentence and this owns half a
tile. The calendar clause is never dropped, even where the working count equals the span —
on a seven-day programme that identity *is* the summary. Only an `error` state reaches the
*partially analysed* banner.

#### The charts

Hand-rolled SVG, ~120 lines total, no charting library — every chart here needed behaviour a
library would have fought (a data-date rule, a threshold mark, fixed contract buckets, and a
form switch from chart to table). Marks: 2px lines, ≤24px columns with 4px rounded caps, 2px
surface gaps between fills, 10% area washes, hairline grids, ticks on round numbers,
`tabular-nums` only in columns. Every chart has a hover layer, and **a tooltip is never the
only way to read a value**.

| Block | Form | X axis | Y axis | Notes |
|---|---|---|---|---|
| *Activities finished, cumulative* | single-series line + 10% area wash | time, monthly buckets (40 at 20k activities, 45 on Fixture B) | cumulative count of activities finished | **one line, never two** — no baseline exists. 2px data-date rule; the elapsed portion is weighted heavier. Hover crosshair shows started / finished / cumulative. No legend (single series). No second y-axis, ever. |
| *Total float* | **band bar + a nine-row table** | — | — | The 9-bucket histogram draws as a single spike on **every** programme and a different spike each time (`perf-20k` 99.2% over-44-days; Fixture B 75.7% over-44-days; Fixture A 69% negative), and the bucket a reader most needs — negative — is 27 activities beside 7,117. The band bar keeps continuity with the shelf's sliver (same three fills, same thresholds); the table carries exact counts, percentages, band colour as a *secondary* channel. `float_histogram` stays in `derived.json` unchanged, but it is **a stat, not a chart**. |
| *Original duration* | histogram, 8 fixed buckets | duration band | activity count | Spreads properly across every bucket on the same file — which is how we know float's failure is its distribution, not the form. DCMA 8 flags anything over 44 days. |
| *Status mix* | ordered scale — one hue in three steps, direct-labelled with counts | — | — | Not-started / in-progress / complete. |
| *Finish-to-start ratio* | **meter**, single ratio against a limit | — | — | The DCMA-4 90% threshold is marked on the track. Fixture B's 89.5% renders as a bar stopping just short of the mark. |

Deliberately absent: **no resource-units S-curve in v1** (a second series in different units
beside the first is the dual-axis mistake waiting to happen, and it needs its own decision
about units and cost semantics); **no treemap and no WBS chart** (`wbs_depth: 1` is a real
shape); **no time-scaled Gantt**.

**Charts are programme-level and do not respond to the table's filters.** They could —
re-bucketing 20,000 rows costs ~2 ms — but that would make the client a second source of
truth for a published statistic, which is ruled out everywhere else. So the filter row sits
with the table it scopes, not above the page, and each chart is labelled as
programme-level.

Callouts that sit with the charts:

- **Float null count** — *"12,829 activities have no float at all — they are complete, so P6
  stopped calculating it. They are excluded from the histogram and from every float check;
  an empty float is not a zero float."*
- **One line, not two** — states that planned-versus-actual needs baseline tables the file
  does not carry, the same absence that skips DCMA 11, 13 and 14.

#### The quality section

- Hero ratio `6/10` with *checks passed*, and a sentence saying how many of the 14 are not
  applicable and that they are excluded from **both** sides of the ratio — a baseline scored
  out of 14 would be punished for being a baseline.
- The FS meter (above).
- **Fourteen check rows, each carrying mark + word + value + threshold**, with colour as the
  third channel:

```
✓  1  Logic — open ends            PASS                5%    target ≤5%
✗  2  Leads — negative lag         FAIL              2.1%    target 0        ▸
–  11 Missed tasks                 NOT APPLICABLE      —     target ≤5%
```

  Each row also carries a plain-English line saying what the check measures, because "DCMA 4"
  means nothing to a planner who has not been audited recently — and being explicable is the
  whole reason the standard was adopted.
- **Exemplars are the seam between the panel and the table.** A failing check expands to the
  50 worst exemplars `derived.json` carries, and *"Open all 2,530 in the activity table →"*
  applies that check's predicate to the table below. That is what makes the 50-cap
  acceptable: the full list is one client-side filter away, because the client holds every
  row.
- **The critical / longest-path callout** prints `critical_count` **only** with
  `critical_threshold_hr` beside it and a sentence saying the threshold is per-programme and
  the counts are not comparable across programmes. `longest_path` prints its value with a
  provenance line — *"computed by this site from the file's own dates — P6 did not export a
  Longest Path"* — and the page states that **longest path is not the same thing as
  critical**. The method and its known lag limitation live in the tracer's doc in the repo,
  not on the page.

#### The WBS tree and the activity table

- **Tree**: a fixed 270px rail, `text-overflow: ellipsis` on node labels — the one place on
  the page where a variable-length string may be cut. It opens with the **root expanded and
  everything else collapsed** (the real tree is 1,800 nodes with 450 siblings at depth 2, and
  a flat 450-child level cannot be navigated by scrolling). Counts on each node are **rolled
  up from the subtree**, or every branch node reads 0 and the tree looks broken. Selecting a
  node filters the table to its whole subtree — 72 rows out of 20,000, instant, no request.
- **At `wbs_depth: 1` the panel is replaced, not emptied**: *"No work breakdown structure.
  All 3,344 activities sit under a single node. This is a real shape, not a parse failure"* —
  plus the file's activity code types as grouping buttons, the fallback axis a tender
  programme actually has.
- **The table** is virtualised (23 DOM rows for 20,000) with eight columns:

| Column | Alignment | Notes |
|---|---|---|
| `Activity ID` | left | `task_code` |
| `Activity name` | left | milestones prefixed `◆` |
| `WBS` | left | the node's short code |
| `Status` | left | `Done` / `Active` / `—` with a state dot |
| `Dur` | right | days; `—` for non-task types |
| `Total float` | right | `{n}d`, coloured negative / over-44; `—` where null |
| `Start` | right | |
| `Finish` | right | |

- **Toolbar above the table**: a search box (*"Search 20,000 activities"*), status pills
  `All` · `Not started` · `In progress` · `Complete`, a `Float ≤ 0` pill, a
  **`Longest path (N)`** chip over the driving-path boolean, the selected WBS node as a
  clearable chip, and a row count (`1,222 rows of 20,000`). Every one of these is a
  client-side predicate.

#### `Compare…`, and why it is inert

The revision selector carries a `Compare…` button that is **present and deliberately does
nothing in v1**. It is a seam, not a stub with a missing backend:

- **The diff needs nothing added to either contract.** It reads two `derived.json` files —
  whose histogram buckets are fixed precisely so they subtract — and, for per-activity
  comparison, two `activities.json` files keyed on `task_code`, which is in the lean cut.
  That closes the open question about whether `derived.json` needs per-activity
  fingerprints: **it does not**, because the diff has the activity rows themselves.
- **It is a button rather than a tab because of its weight**: two `activities.json` fetches
  is **680 KB gzipped**, acceptable for an explicit compare action and unacceptable as a
  default.
- The URLs a diff would mount over already exist (`/p/{slug}` and `/p/{slug}/r/{n}`); a diff
  is a third shape over the same data, so this page does not have to be rebuilt to add one.

#### Revisions, lineage and tombstones

- `/p/{slug}` follows `current_revision_id`, which is repointed past a tombstone.
- `/p/{slug}/r/{n}` for a tombstoned revision renders the tombstone at its own URL.
- The revision selector lists tombstoned revisions as **disabled entries carrying their
  removal class** — a gap in a numbered series is more alarming than a labelled one.
- A **Lineage surface** lists the fork family and the revision history, one row per revision
  with activity count, % complete and age. It re-opens no schema demand:
  `root_programme_id` already makes "the family" one query and the fork edge's revision
  pointer already names the exact fork point.

_Source: [The project detail page](docs/wayfinder/tickets/008-project-detail-page.md)_

---

### 6.8 What the programme page fetches, and what it costs

| Layer | Where | Size |
|---|---|---|
| Postgres row | already loaded | free |
| `derived.json` | **server-side fetch, server-rendered** | 15,854 bytes raw / 3,659 gzipped on the 20,000-activity fixture; the contract budgets ~40–60 KB typical with a 150 KB ceiling |
| `activities.json` | **client-side, lazy**, when the activities section nears the viewport | **340 KB gzipped** (2.98 MB raw, 212 KB brotli) at 20,000 activities |

- **First paint carries every number, every chart and every check.** No skeletons above the
  table. The table is virtualised and hydrates on approach.
- **The blob-versus-API question was decided by measurement.** Against the real
  20,000-activity cut in Chrome: transfer 340 KB, fetch 8 ms on localhost, `JSON.parse`
  15–19 ms, build 20,000 row objects 2 ms → **25 ms from request to a sortable in-memory
  table**. Then sort 1.8 ms, substring search over 20,000 names 1.1 ms (1,222 hits),
  virtualised scroll frame 0.35 ms, under 10 MB of tab heap. An API pays a round trip per
  sort and per keystroke, 50–150 ms each, forever.
- **One object, not shards.** Sharding was only ever justified by paging, and there is no
  paging. **After the two fetches the page issues no further requests** — sort, filter,
  search, WBS selection and the exemplar deep-links are all local.
- **Serve brotli**: 212 KB against 340 KB is a 38% cut on the largest object the site serves
  per programme open, for a config flag.
- **`activities.json` is a columnar cut**: 13 parallel `TASK` field arrays (`task_id`,
  `task_code`, `task_name`, `wbs_id`, `task_type`, `status_code`, `target_drtn_hr_cnt`,
  `remain_drtn_hr_cnt`, `total_float_hr_cnt`, `early_start_date`, `early_end_date`,
  `act_start_date`, `act_end_date`) plus the WBS tree, and a per-activity driving-path
  boolean added for the `Longest path (N)` chip — a boolean array over 20,000 rows is noise
  against 340 KB, so the fetch budget, the 25 ms parse and the one-object decision all stand.
- **`TASKPRED` and `TASKACTV` are excluded.** Including both doubles the file to 652 KB
  gzipped, and v1 has no relationship view and no code-value filter. The Gantt sanity check:
  a virtualised Gantt needs bars, rows and colour — all already in the cut — plus exactly one
  missing table, `TASKPRED`, priced at **+181 KB gzipped** (340 → 521 KB). The cut is
  Gantt-compatible, one named block short, and adding it later is additive rather than a
  re-cut.
- `derived_version < CURRENT_VERSION` triggers the contract's lazy recompute on the
  server-side fetch, so "one slow open, then hot forever" sits on this page's critical path
  and nowhere else.
- **`activities.json` never touches Vercel's transfer meters** — the browser fetches it and
  it lives on R2. The largest per-open object in the estate is invisible to the platform that
  meters transfer. HTML responses are budgeted at ~30 KB each against Fast Origin Transfer.

_Source: [The project detail page](docs/wayfinder/tickets/008-project-detail-page.md) · [How is a public page with per-viewer state cached?](docs/wayfinder/tickets/035-caching-per-viewer-state.md)_

---

### 6.9 The upvote and the bookmark: two objects, two behaviours

| | Upvote | Bookmark |
|---|---|---|
| Meaning | an **endorsement**, public | **save for later**, private |
| Objects | a Programme, and separately an uploader | a Programme |
| Counter | `programme.vote_count`, denormalised and maintained on write; a per-account uploader counter | **none, anywhere** |
| Public rendering | count on the row and on the detail page | never — owner-only |
| Where the control lives | shelf row + detail page (Programme); **contributor page only** (uploader) | shelf row + detail page |
| Signed-out | drawn **unpressed**, click routes to sign-in | identical |
| Mechanics | signed-in only; **one vote per user per target, toggleable**; **self-votes allowed** | one row per user per Programme, toggleable |
| Account deletion | rows kept, voter reference nulled, so `count(*)` still reconciles with the denormalised total | **cascade-deleted** |

- The Revision is **not** votable: a revision-granular vote would smear a two-year monthly
  series across rows nobody reads and would still need a rollup counter.
- Votes reset on fork, because a fork is a new Programme.
- Bookmarks are private throughout — no count, no public rendering, no board input, nothing
  to farm. "Most-bookmarked" stays available as a `count(*)` if there is ever a reason.
- **Un-bookmarking leaves the row in place, greyed, until reload** on `/me/bookmarks`, on the
  same reasoning as the disabled facet chips: a list that shrinks under the cursor jumps.
- Anti-gaming is **manual, not algorithmic**: no rate limits, no minimum account age, no vote
  decay. The operator voids votes on complaint, using machinery a Class B takedown already
  needs. The structural defence is keeping the prize small — the leaderboard is
  footer-linked. If it is ever insufficient, the named cheapest escalation is a rolling
  window on the board (`where voted_at > now() - 90d`), no new UI.

_Source: [Credit, upvotes and the contributor leaderboard](docs/wayfinder/tickets/016-credit-upvotes-leaderboard.md)_

---

### 6.10 `/u/{handle}` — the public contributor page

Public, identical for every viewer, and it carries:

1. The **Handle**.
2. An **uploader upvote pill and count** — the only place an uploader vote can be cast.
3. A **leaderboard rank line**.
4. The contributor's **published Programmes as shelf rows** (§6.2), in the shelf's order,
   paginated with `?page=N` at 25.
5. A **programme count** and a **joined date**.
6. A **fork-count fact** — a live `count(*)` over Programmes whose parent Revision belongs
   to this user, never denormalised and never ranked on. The grid refused a fork counter
   because it needs every number denormalised for its one-query rule; a single-contributor
   page does not pay that cost.
7. **No badges of any kind** — no verified mark, no quality mark, no "checked" state. A badge
   is a guarantee wearing a different word, and the site guarantees nothing.
8. **Exactly one owner-conditional element**: a link to `/me`, carrying no data, mounted
   client-side from the viewer response like every other owner-conditional element.

The page has **no owner-only tabs**. Bookmarks and the voting record were originally put
here and moved to `/me`, because the Handle exists only from first upload — so the
download-only planner, who is the modal signed-in user, has no contributor page at all and
would have been unreachable. Two further reasons: branching a public render on viewer
identity is the shape of bug that leaks private data into a shared path, and the two pages
have different visibility regimes.

**Indexability**: `/u/{handle}` is indexable exactly when the eligibility gate says the
contributor is listable — zero published non-tombstoned Programmes drops you from the
sitemap and adds `noindex`. One gate, two consumers, covering the cascaded-tombstone and
account-deletion cases without either being reasoned about separately.

_Source: [Credit, upvotes and the contributor leaderboard](docs/wayfinder/tickets/016-credit-upvotes-leaderboard.md) · [The signed-in user's own space](docs/wayfinder/tickets/023-signed-in-users-own-space.md)_

---

### 6.11 `/contributors` — the leaderboard

**Its own page, linked only from the footer**, with a rank line on each contributor page.
Never a rail on the shelf — the left rail was rejected for the shelf and the same reasoning
applies here — and never in the main nav, which would invert what the site is and start
routing upload decisions through "does this help my rank".

**The ranking rule, in full:**

```
order by uploader_vote_count desc,
         published_programme_count desc,
         handle
```

Nothing is summed, weighted, blended or tuned. There is **no standing formula**: a Programme
is votable and an uploader is votable, separately, and the board reads the uploader counter
alone. People vote for a person; the board reports it. A blend would have the site asserting
a quality model, and weights need a corpus to tune against that does not exist.

**The eligibility gate:** an uploader whose published, non-tombstoned Programme count is
**zero** is delisted. Votes are retained on the row, simply not ranked; publishing again
relists. Partial takedown deliberately does nothing — 1-of-5 tombstoned changes no rank; only
total removal delists. This gate — not the tombstone rule — is what makes takedown reach the
board, since standing no longer flows through Programmes. On a footer-linked board the gate
is a live subquery, not a maintained column.

**Being forked is never a board column**, and no second sort key is admitted.

Footer placement is itself the anti-gaming answer: farming 20 accounts to top a footer-linked
page is a bad trade. The cost — that the board motivates less because most visitors never
see it — is the intent.

> **GAP:** how many contributors `/contributors` lists. It is fixed as one page with no query
> parameters in v1, but no ticket fixes the row limit or what the page does when the number
> of listable contributors exceeds it.

_Source: [Credit, upvotes and the contributor leaderboard](docs/wayfinder/tickets/016-credit-upvotes-leaderboard.md)_

---

### 6.12 `/me` — the signed-in user's own space

Four plain server-rendered pages, one tab strip of four plain links, `?page=N` at 25, no
facets, no search, no sort control, no client state, no tab component. Bare `/me` is the
default tab and there is no redirect. Signed-out requests to `/me*` are handled by Clerk
middleware and never render, so no `noindex` header is needed and no crawler ever sees a
private list.

| Route | Renders | Order |
|---|---|---|
| `/me` | every Programme you own, one line each, published and not | `programme.created_at desc, programme.id desc` |
| `/me/bookmarks` | shelf rows | `bookmark.created_at desc` |
| `/me/votes` | shelf rows for Programmes you upvoted, then a short flat list of Handles from `uploader_vote` | `programme_vote.created_at desc` / `uploader_vote.created_at desc` |
| `/me/account` | Handle, rename, sign out, delete account | — |

Reached from **one header control** — the signed-in cluster `Upload · {Handle}`, the Handle
linking to `/me` — plus the one owner link on `/u/{handle}`. There is no third entry point
and no nav item. Sign-out lives on `/me/account` rather than behind a popover, which costs
one extra click on a two-item menu that would otherwise need focus management and a client
component.

#### `/me` is an index, and it is **not** the shelf row

One line per Programme, fixed left to right: **title · state chip · clause · rev · sector ·
age**. The clause slot is empty for an ordinary published Programme, which is the common
case.

```
{title}                                                    r23   Rail    3mo
{title}                      [Processing]  Usually a few seconds.        2m
{title}                      [Failed]  {failure_reason}   Upload again →  r8    1h
{title}                      [Removed]  Removed because a programme it was
                                        forked from was removed following
                                        a complaint.                r2   Highways  8d
```

| State | Chip | Clause | Trailing link |
|---|---|---|---|
| published | — | — | — |
| pending (newest rev) | `Processing` | *Usually a few seconds.* | — |
| failed (newest rev) | `Failed` | `{failure_reason}`, verbatim | *Upload again →* |
| tombstoned, Class A | `Withdrawn` | *Withdrawn by you.* | — |
| tombstoned, Class B, complained-about | `Removed` | *Removed following a rights or personal-data complaint.* | — |
| tombstoned, Class B, cascaded fork | `Removed` | *Removed because a programme it was forked from was removed following a complaint.* | — |

Why not the shelf row: the row exists to be compared down a column, and **nobody compares
their own uploads to each other** — they are looking for one. A `pending` Programme also has
no float sliver, no S-curve, no DCMA strip and no activity count, so the row would render it
as nine empty slots, which reads as missing data rather than as a state. **The bookmark and
vote lists do keep the shelf row**, because those genuinely are comparison surfaces.

- **`failure_reason` renders inline**, not behind a click: an index that says `Failed` and
  makes you click for the only sentence you wanted is worse than no index.
- **`revision.failure_detail` never renders here.** It carries the exception and parse
  position and `/ops` is its sole reader.
- Every title links to `/p/{slug}` **only when the Programme is published** — an unpublished
  `/p/{slug}` 404s to everyone, owner included, because a cached route cannot serve a 404 to
  one viewer and a page to another. **`/me` is therefore the only owner-visible surface for
  an unpublished upload.**
- Two stated limits: `/me` is Programme-granular, so a tombstoned revision inside a live
  series shows on that Programme's own revision list and not here; and `/me` is not a
  history — a `failed` row is reaped at 24 h, after which the upload is gone from this page
  with no trace.

#### The header notice

One line under the header, **signed-in only, not dismissible, no storage, no table, no
column**, for as long as the condition holds, linking to `/me`:

- `A programme you uploaded has been removed. See your uploads →`
- `An upload didn't finish. See your uploads →`

When both hold, the removal line wins. Neither needs an acknowledgement flag because both
conditions expire on their own: a Class B tombstone matters for exactly **30 days** (the
quarantine window in which the bytes can still be restored) and a `failed` upload for exactly
**24 hours** (the reap). Storage buys nothing when the fact deletes itself. It is one
`exists`-pair query per signed-in page render and runs only when there is a session, so
signed-out rendering is untouched.

Honest cost, stated rather than softened: **a person who does not sign in for 31 days never
learns from the site that their fork was destroyed.** With no email there is no channel that
reaches someone who does not visit.

#### Empty states

- `/me` — *You haven't uploaded a programme yet.* → **Upload a programme**
- `/me/bookmarks` — *Nothing saved yet. The bookmark control on any programme saves it here.*
  → **Browse the shelf**
- `/me/votes` — *You haven't upvoted anything yet.* → **Browse the shelf**

No facets, search or sort on any of these lists: conjunctive counts earn their place because
a sparse catalogue dead-ends, and a list you assembled yourself has no dead ends. No bookmark
notes, folders or collections.

#### What a user can edit or delete

The rule is not "read-only", it is: **`/me` writes nothing about a Programme. Every
Programme-scoped write lives on that Programme's page.**

| Write | Where | Notes |
|---|---|---|
| Title, description, **sector** | `/p/{slug}`, in place | Programme is identity, so an edit is never a new revision; the slug stays frozen. No audit table. Revalidates the path. |
| **Withdraw** (Class A takedown) | `/p/{slug}`, owner-only button | Whole Programme **or** a single Revision. Withdrawing the current Revision repoints `current_revision_id` to the newest survivor; withdrawing the last tombstones the Programme. Guard rails: typed confirmation naming the programme, plus the two facts nobody expects — **the bytes are destroyed permanently** and **existing forks stay published**. No operator involved, no undo. |
| New revision | upload, from your own programme page | owner-only; everyone else forks |
| Fork | upload, from another programme's page | `change_note` required |
| Bookmark toggle | any row, any programme page | The apparent exception that is not one: it is a write about *you*, not about the Programme — which is exactly why it can sit on a public row. |
| Upvote toggle | any row, any programme page (Programme); `/u/{handle}` (uploader) | |
| **Rename Handle** | `/me/account` | *"Changing your Handle retires the old one permanently. Nobody can claim it afterwards, including you. Programmes you have already published keep the Handle they were uploaded under."* |
| **Delete account** | `/me/account` | Typed confirmation of the Handle, plus: uploaded programmes **stay published** credited to the Handle; the Handle is retired forever; bookmarks are deleted; upvotes stay counted but stop being linked to you; this cannot be undone; *"To remove your programmes as well, **withdraw them first** — then delete your account."* Order is **our rows first, then Clerk** — the reversible half commits first, so a failure after step 1 means the user signs in again and gets a fresh account, which is what they asked for. |

There is **no** withdraw control, bulk action, edit or delete on `/me`: a list of your own
work with a row-level destructive control is one misclick from an irreversible byte deletion.

#### The `app_user` lifecycle behind all of this

`app_user` is created on the **first authenticated write of any kind — vote, bookmark or
presign** — with a generated Handle (`planner-` + 6 hex characters, checked against
`app_user.display_name` and `reserved_handle`, regenerated on collision). It is **confirmed**
at first upload, where the metadata screen carries a Handle field prefilled with the
generated value and required like the title. **Reads create nothing**: `/me` for a signed-in
user who has never written renders three empty states rather than a row. No Clerk webhook —
`user.created` would cost a public endpoint, a signing secret, svix and retry semantics to
move a row creation off the path that already needs it.

_Source: [The signed-in user's own space](docs/wayfinder/tickets/023-signed-in-users-own-space.md)_

---

### 6.13 Per-viewer state: `GET /api/viewer`, and the late-pressed rule

Every public page ships the **signed-out render** to the CDN. Everything viewer-dependent —
two pressed states per row, the header cluster, the header notice, the owner link on
`/u/{handle}`, the owner's edit and withdraw controls on `/p/{slug}` — is a client-side mount
driven by **one** request.

```
GET /api/viewer?p=<uuid>,<uuid>,…        (≤ 25 ids; 1 on a detail page; 0 on a static page)

200 application/json
Cache-Control: private, no-store

{ "handle":     "planner-a3f92c" | null,
  "notices":    { "failed": false, "removal": false },
  "voted":      ["<uuid>", …],
  "bookmarked": ["<uuid>", …] }
```

- **Fired only when a Clerk session cookie is present.** A signed-out visitor, a crawler and
  a link unfurler issue **zero** extra requests — the property the whole cost case rests on,
  and it has its own CI assertion.
- **Two statements, one `neon-http` batch, one HTTP round trip**, ~3 ms of Active CPU: the
  header statement (Handle + the two `exists` notices) and the combined viewer join returning
  vote-flag and bookmark-flag over the visible page's ids.
- `null` handle means signed in but with no `app_user` row yet; the client renders the
  signed-out control states.
- `/api/` is `Disallow`ed in `robots.txt`.
- **The response reads only Postgres and never a blob**, so it renders for a `pending` or
  tombstoned Programme whose blobs do not exist and cannot be invalidated by a contract
  recompute.

#### Layout shift: none, measured

Both controls are already drawn, at their fixed x, in the cached HTML — the signed-out render
draws the upvote pill unpressed and the bookmark identically — so the response changes **a
fill inside a box that already exists**. The prototype measures the left edge, width and
document-absolute top of ~300 probes on the first painted frame and again after the response
lands: **`Δx 0.00 · Δw 0.00 · Δy 0.00`**, on both pages, in both themes.

Two boxes genuinely have two states:

- **The header cluster.** `Sign in` and `Upload · {handle}` are different widths; the slot is
  right-aligned with a `min-width`, so the swap moves nothing to its left (the label's own
  left edge moves 115px inside it). It renders `Sign in` until the response lands.
- **The header notice** appears and pushes the page down, for the rare signed-in viewer
  inside a 24-hour or 30-day window. Accepted rather than reserving a blank strip on every
  page for every viewer.
- On the detail page the bookmark carries a **label** (`Save` → `Saved`), so its button is
  pinned with `min-width: 96px`; without it, `Fork` and `Download` would be pushed sideways.
  That pin is load-bearing, not cosmetic — the shelf's fixed-slot rule covers an icon-only
  control for free and has nothing to say about a labelled one.

#### The judged interaction rule

Judged against a prototype driving the delay at 0 / 150 / 400 / 1200 / 3000 ms, on the shelf
(25 control clusters down a column) and the detail page (one cluster above the fold):

1. **The plain version ships.** At **400 ms the fill-in reads as the page completing itself**;
   at **1200 ms it does not**. The detail page reads no worse than the shelf at the same
   delay, so there is no second rule for it.
2. **`visibility: hidden` until the response lands is rejected.** The **public upvote count
   lives inside the pill**, so hiding the control costs a signed-in viewer every vote count on
   the shelf for the whole delay, while the magnitude bar beneath it — not a control, so not
   hidden — stays drawn. That is a worse picture than the one it fixes, and worse in the
   direction that matters, since the count is a fact about the catalogue rather than about
   the viewer. The Clerk session-claim fix for the header is not needed either; the header was
   never what read wrong.
3. **400 ms is a target and can never be a guarantee.** The endpoint is ~3 ms of CPU, but the
   wall time is browser → Function → Neon, and Neon's free tier **autosuspends** — so the tail
   is a property of the database and is longest on exactly the pages a returning visitor opens
   first after a quiet hour. The bad frame is one nobody will ever report: there are no
   analytics and logs are kept for one hour.
4. **The optimistic / late-pressed rule — merge, never overwrite.** The controls are live
   before the response lands. A click during the window *does* write, and a response that is
   a snapshot taken *before* the click would overwrite the control back to unset — the viewer
   sees their own action undone, clicks again, and toggles the true state off. So: **the
   client keeps a dirty set of controls the viewer has touched since paint, and the viewer
   response fills only untouched ones.** No extra request, no schema, no change to the
   endpoint's contract — roughly ten lines. Generalised: **any late-arriving snapshot must
   merge against local intent.**
5. **The reopen trigger for Cache Components is 800 ms, breached on three consecutive daily
   sweeps.** The instrument is the daily sweep timing its own first Neon statement — it runs
   after a long idle and so hits the autosuspend resume case by construction. It costs one
   seeded `alarm_state` row (`viewer_latency`); `sweep_run.breaches` is jsonb, so a further
   rule key is free. A breach means Cache Components is **re-costed, not adopted**. The honest
   residue: the sweep measures the server leg only, so it *floors* the number — a breach is
   certainly real, a non-breach proves nothing about what a planner on a train sees.

_Source: [How is a public page with per-viewer state cached?](docs/wayfinder/tickets/035-caching-per-viewer-state.md) · [Does a late-arriving pressed state read as a bug?](docs/wayfinder/tickets/037-late-pressed-state.md)_

---

## 7. Licensing, personal data, static pages and the crawl surface

This section fixes the terms under which content is published, what happens to personal
data inside published files, the public prose and legal routes, and everything a crawler
sees. The operator-side *tooling* for takedown (the `takedown` CLI, plan/apply, quarantine
mechanics, the reconciler sweep) belongs to §5 and is cross-referenced, never repeated:
what is here is the **policy** those tools execute.

Site apex throughout: `https://xerhero.com`.

---

### 7.1 The two licences

**Code: Apache-2.0. Uploaded programmes: CC-BY 4.0. Both fixed; neither is a choice.**

- **Content — CC-BY 4.0, site-wide, with no per-upload licence picker.** Every v1 row stores
  `licence = 'CC-BY-4.0'`. The column exists so that a future licence change applies to new
  uploads only and never retroactively rewrites what a past uploader agreed to.
  - A per-upload list (CC0 / CC-BY / CC-BY-SA) would force the fork button to reason about
    licence compatibility — an SA parent forcing an SA fork, a CC0 fork being relicensable —
    which is a feature, not a dropdown. Fixed site-wide, forking is unambiguous.
  - `.xer` is closer to a **database** than to prose, and CC-BY 4.0 covers sui generis
    database rights explicitly. CC0 drops credit, which fights the fork graph and the
    contributor board; CC-BY-SA deters the commercial reuse that is most of this audience.
- **The site takes no separate licence grant from uploaders.** CC-BY 4.0 already permits
  storing, serving and producing derivatives, so `derived.json`, `activities.json` and every
  computed stat are covered. There is deliberately **no** "you grant xer-hero a worldwide
  royalty-free licence to…" clause anywhere in the terms.
- **Code — Apache-2.0.** Chosen for its express patent grant (MIT has none and the grant is
  free) and for §5, which makes contributions inbound under the same licence, so **no CLA is
  needed to accept a pull request**. Not copyleft: the moat is the corpus, not the parser.
  There is no contamination risk because the `.xer` parser is written from scratch precisely
  because `xerparser` is GPL-3.0 and MPXJ is LGPL/Java.
- The README states both licences plainly so there is no ambiguity about which covers what,
  and the footer repeats the pair on every page (§7.14).

_Source: [Licensing, attribution and takedown](docs/wayfinder/tickets/003-licensing-attribution-takedown.md)_

---

### 7.2 What an uploader asserts

**One checkbox per upload, carrying three claims, snapshotted against a versioned text.**

The checkbox label is the short form of terms §9.3; the long form is the rendered document
at `/terms`. The three claims:

1. **I own this programme, or I have permission from whoever does to publish it.**
2. **It contains no confidential or commercially sensitive third-party information** — *and
   I understand that the file may name people, that it is published exactly as uploaded, and
   that nothing is stripped from it.* (The second clause is mandatory wording, added when
   verbatim publication was decided; it makes the warranty and the pre-publish disclosure
   panel of §7.8 **the same claim**.)
3. **I licence it to everyone under CC-BY 4.0, irrevocably.**

Rules:

- **Per upload, never per account.** Each upload is a distinct rights claim about a distinct
  file. Every revision and every fork upload re-asserts all three.
- **One checkbox, not three.** Three reads as legalese theatre and gets clicked just as
  thoughtlessly; the honest work happens in the disclosure panel directly above it (§7.8).
  A second checkbox for the personal-data wording was considered and rejected — friction
  without a detector behind it.
- **The row snapshots `terms_version` (the string `'v{n}'`) and `asserted_at`, not a
  boolean.** This is the only artefact that matters if an upload is ever disputed, and it
  resolves to two live URLs (§7.10).
- Claim 3's irrevocability is load-bearing: it is what makes Class A withdrawal defensible
  when an uploader later objects that forks of their work survive.
- **There is no acceptance checkbox for the privacy policy.** It is a disclosure, not an
  agreement, and claim 2's checkbox stays the only one on the site.

_Source: [Licensing, attribution and takedown](docs/wayfinder/tickets/003-licensing-attribution-takedown.md) · [Personal data in published .xer files](docs/wayfinder/tickets/013-personal-data-in-published-files.md)_

---

### 7.3 Attribution and forks

**The site generates attribution from lineage it already holds. The `.xer` file is never
modified.**

- The format has exactly five record markers (`ERMHDR`, `%T`, `%F`, `%R`, `%E`) and **no
  comment mechanism**, so there is nowhere safe to inject an attribution line and doing so
  would break byte-identical round-tripping. **Downloads serve original bytes.**
- **On-site forks satisfy CC-BY automatically.** The fork page renders, from the schema:
  the original uploader's Handle, a link to the parent, `CC-BY-4.0`, and "modified from"
  (CC-BY 4.0 requires indicating changes — a fork upload also carries a required
  `change_note`). The uploader never types a credit line, so cannot get it wrong.
- **The full ancestry chain renders, not just the immediate parent** — A → B → C.
- **Every programme page carries a "Cite this programme" block**: a copy-paste attribution
  string in the CC-BY-recommended shape. Off-site reuse obligations are the reuser's, as
  with any CC-BY work; the site's job is making the correct string one click away, not
  policing it.
- **Identity is pseudonymous by design, and there are no anonymous uploads.** Google is the
  auth mechanism, never the public name. The public name is a **Handle**, generated at first
  authenticated write and confirmed at first upload, and it is **snapshotted onto each
  programme row** (`uploader_display_name`) rather than joined live — so renaming an account
  never silently rewrites credit on past uploads, and deleting an account never blanks it.
- CC-BY permits a licensor to request not to be credited; that is **not supported**, because
  it would put a ghost entry on the contributor board and a hole in the fork chain.

_Source: [Licensing, attribution and takedown](docs/wayfinder/tickets/003-licensing-attribution-takedown.md)_

---

### 7.4 No warranty, and what it forbids anywhere in the product

This is a standing constraint on the whole build, not only on the legal pages. **The
maintainer guarantees nothing.** The platform is free, open-source, opt-in and at the user's
own risk.

**The formal expression** lives in terms §9.9 and is a **service-level** as-is disclaimer,
*separate from and additional to* Apache-2.0's source-level one (Apache §7/§8 disclaims the
source code; the hosted service and the content on it need their own). It states: no
warranty of accuracy, availability, fitness, or that any file is safe to rely on; computed
values including DCMA, float and the longest path are **computed and reported, not
endorsed**; nothing on the site is professional advice and nothing here is checked by
anyone. It does **not** waive statutory duties — an erasure request still gets a Class B
takedown (§7.5).

**The product-wide rule.** Nothing on the site is ever worded as a guarantee. The
pre-publish panel warns but does not certify. DCMA is computed but not endorsed. `noindex`
is mitigation but not protection. This rules out **screening promises, verification badges
and any "checked" state anywhere in the effort.**

**The applicable test, which is what makes this enforceable rather than tasteful:**

> Describe mechanism and behaviour in the present tense. Never characterise outcome, quality
> or safety. **Could the sentence become false without anyone changing the code?** If yes it
> is a promise and it is banned. If it can only become false by someone shipping different
> software, it is a description.

**Banned, on every page and in every string in the product:**

- *About programmes or contributors:* verified, checked, reviewed, approved, validated,
  certified, vetted, trusted, curated, quality-assured, screened, moderated, "safe to use",
  "ready to use".
- *About the service:* secure, safe, protected, guaranteed, reliable, robust, always,
  uptime, any percentage attached to availability, "your data is safe".
- *In the first person:* "we ensure", "we make sure", "we guarantee", "you can be
  confident", "rest assured", "don't worry".
- *Future tense:* "free forever", "we will never", "we'll always", "coming soon" with a
  date. The site may state what it **does**; it may not state what it **will** do.
- *Traction and superlatives:* best, leading, definitive, largest, fastest, "the only",
  "trusted by", "join thousands", testimonials, logos. Counts may be **reported** and may
  not be **celebrated** — `142 programmes · page 1 of 6` on the shelf is the correct
  register; `/about` carries no count at all, because a count on an About page is traction
  dressed as a fact and it is wrong the day after it is written.

**Three rewrites the rest of the spec forces, because writers reach for all three:**

| Never write | Write instead |
| --- | --- |
| "we check your file for personal data" | "the upload screen lists the names and free text it finds in your file" |
| "downloads are excluded from search engines" / "`noindex` prevents indexing" | "the download URL asks search engines not to index it — a request to well-behaved crawlers, not a barrier" |
| "programmes here are high quality" | "DCMA checks are computed and reported for every programme" |

**Voice:** second person for the reader; "this site" and "the operator", never "we" — there
is one person and "we" invents an organisation. The legal pages say "the site" and "the
operator", never "the Company". *(Overturnable taste.)*

**Two sentences that read like assurance and are required**, both surviving the test above
because they describe the software rather than warrant an outcome, and both demanded by
Google's brand verification: *"Your Google name, email and profile picture are never shown
on this site"* and *"Signing in with Google is used only to sign you in."*

_Source: [Personal data in published .xer files](docs/wayfinder/tickets/013-personal-data-in-published-files.md) · [The site's static pages](docs/wayfinder/tickets/030-static-pages.md) · [Google OAuth in production](docs/wayfinder/tickets/027-google-oauth-in-production.md)_

---

### 7.5 The takedown policy

Two classes, split by **reason**, because the downstream answer differs and conflating them
is the classic mistake.

**Class A — voluntary withdrawal.** The uploader wants their own programme off.

- The programme (or a single revision) is **tombstoned**: the page stays at its URL, the
  blob bytes are deleted, the row is retained.
- **Title and uploader Handle stay visible** on the tombstone page.
- **Forks are untouched.** The grant was valid when taken and CC-BY is irrevocable.
- **Self-service** — a button on the owner's own programme, no operator involved, at either
  granularity (one revision, or the series). There is nothing to adjudicate: the outcome is
  identical whoever presses it. Guard rails, since a non-expert is firing an irreversible
  action: typed confirmation naming the programme, plus the two facts nobody expects stated
  plainly — **the bytes are destroyed permanently**, and **existing forks stay published**.
- **No quarantine**, and — the correction that matters — a Class A tombstone **does not
  block re-upload of the same bytes**. The content-hash block is scoped to Class B only, so
  an owner who withdraws by mistake can re-upload their own file.

**Class B — rights, confidentiality or personal-data complaint.** Someone says it should
never have been published.

- The grant was **never valid**, so every fork carries the same tainted content: removal
  **cascades down the whole fork subtree**, each descendant tombstoned and its bytes
  deleted. The cascade is operator-scoped, broad by default, and unconditional below a
  tainted fork.
- The **hash block is permanent** for Class B: an upload whose `content_hash` matches a
  Class B tombstoned revision is a **hard reject**, which makes takedown self-enforcing
  against the exact bytes.
- **Class B bytes are quarantined 30 days before destruction** (only `original.xer.gz`; the
  derived objects are destroyed immediately and rebuilt on reversal). This buys an undo
  window against griefing, because nothing authenticates a complainant. **After 30 days a
  mistaken Class B is genuinely unrecoverable, and the terms say so.**
- Class B additionally voids the programme's votes (near-inert, since contributor standing
  does not flow through programmes; executed for consistency).

**Shared mechanics:**

- **Bytes hard-delete; rows never do.** The blob and the derived objects are destroyed; the
  row survives as a tombstone carrying `status`, `removal_class` (`A` | `B`) and
  `removed_at`. Deleting the row would punch a hole in the ancestry chain.
- **Granularity is the revision, not the programme.** If revision 5 is tainted, revision 5
  goes and the series survives; the cascade follows forks taken from that revision.
- **Anyone can report; no account is required.** A rights holder finding their programme
  here will not sign in with Google to complain.
- **One operator adjudicates, best effort, no SLA is promised** — stated honestly rather
  than pretending there is a process. **Appeal is to the same operator.**
- **Deleting bytes is not enough on its own**: the takedown path is rows → bytes → **verified
  CDN purge**, and the page and the blob both carry a one-hour TTL so a failed purge
  self-heals. Mechanics in §5.
- **There is no operator correspondence anywhere in the Class B flow.** Blameless fork
  owners are not notified; they learn by visiting. This is deliberate — a one-operator site
  that owes manual emails on every cascade will not send them.
- The one optional exception: the **cleaned-revision softener**. The owner may re-export
  with resources renamed and upload a clean revision, and the operator tombstones only the
  tainted ones; programme identity, slug and fork lineage survive. Contact is a Clerk
  lookup, mailed by hand, entirely at the operator's discretion. There is **no** in-app "your
  programme has a complaint" notice, because that automatically discloses an *unadjudicated*
  complaint to the person complained about.

**Tombstone copy — three fixed variants, and the third exists so a blameless owner is never
rendered as accused:**

| Case | Line |
| --- | --- |
| Class A | *withdrawn by uploader* |
| Class B, complained-about | *removed following a rights or personal-data complaint* — **no case reference and no complainant named** |
| Class B, cascaded fork | *removed because a programme it was forked from was removed following a complaint*, ancestry link intact |

Publishing the case id invites correlation across takedowns; naming a complainant in a
personal-data case would republish the exact data the takedown was for. The case id lives
operator-side only.

_Source: [Licensing, attribution and takedown](docs/wayfinder/tickets/003-licensing-attribution-takedown.md) · [What tooling does the operator need to run a takedown?](docs/wayfinder/tickets/017-operator-takedown-tooling.md)_

---

### 7.6 `/report` — the intake route

**Route: `/report`.** Public, no account, linked from the site-wide footer as *Report a
problem*, and linked from the privacy policy's third-party-personal-data section.

- **The form writes a `takedown_report` row, and that row is the system of record.** The app
  sends no mail — there is no mail vendor in the estate — so a form that emails the operator
  is not buildable and is not built.
- **The published mailbox is printed on this page and nowhere else.** It is a *second*
  channel; anything arriving by mail is transcribed into a row by the operator before
  adjudication. It is deliberately **not** a `mailto:` in the footer, because that would
  publish the operator's address on every page of a public site to every scraper.
- **Fields the form collects** (they are the columns the row carries): what is being
  reported (`subject_ref` — a URL or slug, as given), the reason (`reported_reason`), **the
  name as it appears** (`name_as_it_appears`, for personal-data cases — this is the field the
  operator's corpus scan consumes, and a free-text paragraph is what it exists to avoid), and
  the reporter's contact details (`reporter_contact`).
- **`class` is operator-assigned, never reporter-declared.**
- **Spam control: Cloudflare Turnstile plus a per-IP rate limit.** Turnstile is free and
  Cloudflare is already in the estate; it runs in the browser on this one form only.
- **Reporter contact is deleted 90 days after the case closes.** The rest of the row is kept
  permanently as the record of a decision. This is disclosed explicitly in the privacy
  policy (§7.11, privacy §7).
- The page is indexable and self-canonical, and it is listed in the sitemap (§7.16).

Operator-side handling — plan/apply, the corpus scan, the reconciler, notification of new
report rows — is §5.

_Source: [What tooling does the operator need to run a takedown?](docs/wayfinder/tickets/017-operator-takedown-tooling.md) · [The site's static pages](docs/wayfinder/tickets/030-static-pages.md)_

---

### 7.7 What a real `.xer` actually contains

Measured against **143 real files · 243,225 `TASK` rows · 2,051 `RSRC` rows**. These numbers
are the argument for everything in §7.8 and §7.9, so they are recorded rather than
paraphrased.

| Field the vendor's PI caution names | Rows populated | Files |
| --- | --- | --- |
| `RSRC.email_addr` | **0** | 0 / 143 |
| `RSRC.office_phone` | **0** | 0 / 143 |
| `RSRC.other_phone` | **0** | 0 / 143 |
| `RSRC.employee_code` | **0** | 0 / 143 |
| `RSRC.user_id` | **0** | 0 / 143 |
| `TASKUSER` (whole table) | **absent** | 0 / 143 |
| `DOCUMENT` (whole table) | **absent** | 0 / 143 |
| `TASK.create_user` | 243,225 (**100%**) | 143 / 143 |
| `TASK.update_user` | 243,225 (**100%**) | 143 / 143 |
| `PROJECT.add_by_name` | 1 per file | 143 / 143 |
| `PROJWBS.create_user` / `update_user` | 100% of WBS rows | 143 / 143 |
| `RSRC.rsrc_name` | 2,051 (100% of rows) | 143 / 143 |
| `RSRC.rsrc_notes` | 133 (max 1 per file) | ~133 |
| `TASKMEMO.task_memo` | 813 rows / 105,867 bytes | 55 / 143 |
| `UDFVALUE.udf_text` | 1,020,501 values / 12,523,806 bytes | 143 / 143 |
| `ERMHDR` field 5 (export login) | present | `admin` in **142 / 143** |

Three findings decide the policy:

1. **The audit fields are one name, not many.** Across all 143 files the count of *distinct*
   `TASK.create_user` values is **1**, and of `TASK.update_user` also **1** — one, in every
   file, with zero files carrying two. A P6 export flattens the whole activity table's
   authorship to a single login.
2. **The resource dictionary is the real surface and is undetectable.** 80% of `RSRC` rows
   are `RT_Labor` (1,639 of 2,051; `RT_Mat` 279, `RT_Equip` 133), names run 1–4 whitespace
   tokens, and **no automatable rule separates a crew member from a trade** — a `RT_Mat` name
   like `Concrete Grade` matches any person-name heuristic you can write.
3. **Free text is enormous and is not prose.** `udf_text` is 12.5 MB corpus-wide, but grouped
   by label it is chainages, zones, quantities and BOQ references at 1–41 characters average.
   The only prose-shaped labels are `Remarks` (2,053 values, 32,500 bytes) and
   `PROJECT.Comments` (4 values) — together **under 0.3% of the free-text bytes**.

Per-file sizing, which is what the disclosure panel must render:

| | min | median | p90 | max |
| --- | --- | --- | --- | --- |
| `RSRC` rows per file | 0 | **15** | 15 | **37** |
| `TASKMEMO` rows per file | 0 | 0 | 20 | **27** |
| `RSRC.rsrc_notes` per file | 0 | 1 | 1 | 1 |

The entire named-entity surface of the worst real file is **37 resources plus 27 memos** —
one screen.

The uncomfortable residue, recorded plainly: 1,639 labour resource rows and 32 KB of
`Remarks` are published as-is, and some of them name real people who never agreed to it. The
position is that this is **disclosed, not screened**.

_Source: [Personal data in published .xer files](docs/wayfinder/tickets/013-personal-data-in-published-files.md)_

---

### 7.8 Verbatim publication, the refusal to screen, and the disclosure that replaces it

**Publish verbatim, disclose before publishing, strip nothing, screen nothing, promise
nothing.** No stripper is built. **No server-side PI detector exists anywhere in the ingest
path.** Nothing blocks. This adds **zero schema columns**.

**Why stripping was refused.** The fields a stripper could reliably detect are empty in every
real file, so a detector fires on nothing; the fields that are populated are either
meaningless (one `admin`-shaped audit login) or undetectable (`rsrc_name`, `rsrc_notes`,
`task_memo`, `Remarks`). Any stripper therefore ships a file that is **changed** — no longer
a clean P6 round-trip — while still carrying the personal data it claims to have removed.
That is false assurance, which is a weaker position than honest publication.

**Why blocking was refused.** A blocker would fire only on the measured-empty fields and
never on the populated ones, and it would constitute a **screening promise** the site then
fails on every free-text field. Advisory-only claims nothing, so it cannot fail. (It also
keeps the "nothing the client computes is trusted" rule intact by making it moot: nothing
here is enforced, so nothing needs recomputing server-side.)

**The disclosure panel.** Position is fixed: on the upload metadata screen, **directly above
the rights checkbox** of §7.2. Its data source is the client-side parse that already runs
before a byte is uploaded, so it costs one render and zero server work. It enumerates
**values, not counts**, for the closed sets — nobody acts on "15 resources"; they act on
recognising a colleague's name.

```
This file names people. It will be published exactly as uploaded.

Exported by            admin — Primavera Admin              [ERMHDR 5–6]
Activities created by  <one name>  (1,751 activities)       [TASK.create_user]
Activities updated by  <one name>  (1,751 activities)       [TASK.update_user]
Project added by       <one name>                           [PROJECT.add_by_name]
Resources (15)         8 labour, 6 material, 1 equipment
                       <every rsrc_name listed, with type>  [RSRC.rsrc_name]
Resource notes (1)     <preview>                            [RSRC.rsrc_notes]
Activity notes (0)                                          [TASKMEMO.task_memo]
Free text              5,805 values across: Remarks, Gang, Quantities,
                       Start Chainage, …  — published as-is, not reviewed
                                                            [UDFVALUE.udf_text]
— sections with nothing in them do not render —
```

Rules the panel encodes:

- **`create_user` / `update_user` render as one line with a count, never a list** — the
  distinct-value measurement says a list would always have length 1.
- **The measured-empty fields are still scanned** (`email_addr`, both phones,
  `employee_code`, `user_id`, `TASKUSER`, `DOCUMENT.author_name`). Free when empty, and the
  fixtures are two clients rather than the world — a P6 database wired to HR fills exactly
  those columns, and that upload is the one where the panel earns itself.
- **`UDFVALUE` is not excluded from publication.** It is reported as a count plus its labels
  and explicitly marked *not reviewed*. Excluding the table would delete the densest
  engineering payload in the corpus to remove 32 KB of prose.
- The panel's register is bound by §7.4: it **lists what it finds**; it never *checks*.

**Third-party erasure is Class B, unchanged** — no new class, no new field, no new operator
route. And the consequence is recorded rather than softened: because publication is verbatim
and the file is never rewritten, **there is no partial remedy**. A resource dictionary is
stable across a series (median 15 rows per file, near-identical across a two-year monthly
run), so one crew member's request tombstones **the whole series and every fork of it**. The
only softener is the cleaned-revision path of §7.5.

_Source: [Personal data in published .xer files](docs/wayfinder/tickets/013-personal-data-in-published-files.md)_

---

### 7.9 Object-level controls: the one PI-bearing blob

Personal data is confined to **exactly one object**, and this was not designed for — it falls
out of payload cuts made elsewhere for size. It is the single most important fact here,
because it converts "is the site safe" into "what is the posture of one URL".

| Object | Carries PI? | Why |
| --- | --- | --- |
| Postgres row (~11 typed columns + `card`) | **no** | no author and no resource fields exist on it |
| `derived.v{N}.json` | **no** | `resource_count` is an integer |
| `activities.json` | **no** | v1 is 13 `TASK` columns + the WBS tree; `TASKRSRC`, `TASKACTV`, `TASKPRED` are all cut, so no resource ever reaches the client |
| Server-rendered programme page | **no** | renders from `derived.json` |
| **`original.xer.gz`** | **yes — all of it** | served byte-identical on download |

**`original.xer.gz` is served under different terms from every other object, and that is one
rule expressed by three properties — not three exceptions.** Verbatim:

| Property | `original.xer.gz` | `activities.json.gz`, `derived.v{N}.json` |
| --- | --- | --- |
| `Cache-Control` | `public, max-age=3600` — **no `immutable`** | `public, max-age=31536000, immutable` |
| `X-Robots-Tag` | `noindex, noarchive` | *(none)* |
| Class B takedown | copied to a private quarantine prefix for **30 days** before destruction | destroyed immediately, rebuilt lazily on reversal |

Both headers are **set at PUT time**, signed into the presigned upload, and stored as R2
object metadata that is returned on GET.

Supporting controls on the same object:

- The blob host serves its own `robots.txt` at the bucket root — body exactly
  `User-agent: *` / `Disallow: /` — written from `ops/bucket/robots.txt` by the bucket-apply
  tool. It is a **different origin** from the site's file (§7.16) and says nothing about it.
- The download link on the programme page carries **`rel="nofollow"`**.
- **The blob stays public, unsigned and CDN-cached.** There is no auth and no app-server
  proxy on the download path; the economics are untouched.

**Why the short TTL.** With a year-long immutable cache, deleting the R2 object does not make
"bytes hard-delete" true — the file stays downloadable from a public unsigned URL for up to
twelve months. At one hour, the verified purge is the fast path and the TTL is the backstop,
so *should not fail* replaces *must never fail*. Not one day (a confidential programme still
downloadable a day after the operator confirmed removal generates the second, angrier email);
not sixty seconds (purge already covers that window).

**What `noindex` is and is not.** It is stated in the product as **mitigation against
well-behaved crawlers, not protection against a scraper**. A `.xer` is plain text and search
engines index text files; the gap this closes is between *a planner who downloaded a programme
sees a name* and *a labourer's name is the top hit for their name*. It closes for the price of
one header, and §7.4 forbids describing it as anything stronger.

**Not built, deliberately: an index of `rsrc_name` in Postgres.** Making names queryable
would build a searchable index of every person named across the whole corpus — a far larger
liability than the files themselves. **The absence of that index is a privacy property, not a
gap**, and it is why the operator's name search is an on-demand corpus scan (§5).

_Source: [Personal data in published .xer files](docs/wayfinder/tickets/013-personal-data-in-published-files.md) · [What tooling does the operator need to run a takedown?](docs/wayfinder/tickets/017-operator-takedown-tooling.md)_

---

### 7.10 The legal texts: files, routes, version scheme, immutability

**Routes.** `/terms` and `/privacy` render the **current** version and are canonical.
`/terms/v{n}` and `/privacy/v{n}` render version `n`. Every superseded version stays
addressable forever.

**Files.** `docs/legal/terms-v{n}.md` and `docs/legal/privacy-v{n}.md`, in the repo. These
files **have never been written**; writing v1 of both is build work on the launch critical
path. Markdown → HTML **at build time**: one dependency, no MDX, no CMS, no runtime file
read, no client JavaScript on the page. Headings get anchor ids so a paragraph can be linked
to. The pages read neither Postgres nor a blob, so after the build they cost nothing at
runtime.

**One version number covers both documents.** `terms_version` is one column, so it resolves
to one coordinate. **A bump ships both files even when one is byte-identical** to its
predecessor — a few duplicated kilobytes buys `terms_version = 'v3'` resolving to exactly two
URLs that both exist:

```
https://xerhero.com/terms/{revision.terms_version}
https://xerhero.com/privacy/{revision.terms_version}
```

The value stored is the string `'v{n}'` — not a git SHA, not a date — so rendering "the
version you agreed to" anywhere is string concatenation and never a lookup. The current
version is a single repo constant, `CURRENT_TERMS_VERSION`.

**A shipped legal file is never edited — not for substance, not for a typo, not for a broken
link.** Repo history is the audit trail, and an in-place edit is exactly the case history
cannot distinguish at a glance. A typo in v1 costs a v2; that is the correct price.

**CI asserts** that both files named by `CURRENT_TERMS_VERSION` exist, and that **no
previously-shipped legal file changed** in a diff.

**Crawl handling** (details in §7.16): the current numbered URL canonicalises to the bare
route and carries no `noindex`; a superseded version carries `noindex, follow` and a **self**
canonical, never a canonical pointing at the current text.

**Launch dependency.** Without `/terms` there is no lawful first upload, because the checkbox
of §7.2 snapshots a version of a text the uploader was shown. `/terms`, `/privacy` and
`/about` are therefore v1 build work on the critical path. They do **not** block provisioning
of the domain, bucket, OAuth client or Clerk production instance.

_Source: [The site's static pages](docs/wayfinder/tickets/030-static-pages.md) · [Licensing, attribution and takedown](docs/wayfinder/tickets/003-licensing-attribution-takedown.md)_

---

### 7.11 `/privacy` — content outline

Twelve sections. Register is bound by §7.4 throughout. Page header block, above section 1:

> **Privacy policy — version 1.** Last changed: *(date of the commit that shipped it)*.
> Earlier versions stay published at `/privacy/v1`, `/privacy/v2`, …

**§1 Who runs this site.** One person, named, operating `xerhero.com`. No company. Contact is
`/report` and the published mailbox. Best effort, no service level.

**§2 Signing in with Google.** *This is the section with an external reader* — Google's brand
verification requires the policy to "disclose how your app accesses, uses, stores, or shares
Google user data" and to be reachable on the verified domain without login. Required content,
in this order:

- Sign-in is Google only, through **Clerk**, the site's authentication provider.
- Google returns to Clerk: a stable account identifier (`sub`), the email address and whether
  it is verified, the name (`name`, `given_name`, `family_name`), the profile picture URL
  (`picture`) and the locale. The site asks for the **`openid`, `email` and `profile`** scopes
  and nothing else; the latter two are required by Clerk and cannot be narrowed.
- **This site stores none of it.** Its own database holds a Clerk user id and a Handle, and
  nothing else about a person.
- The Google name, email and profile picture are **never displayed anywhere on this site**, to
  anyone, including the account holder. (`picture` arrives with a scope that cannot be dropped,
  so the only thing keeping it off the site is that nothing renders `user.imageUrl`.)
- What the identity is used for: signing you in, attaching uploads, votes and bookmarks to an
  account, and letting the operator contact you about a takedown affecting your own programme.
  Nothing else — no profiling, no advertising, no sale, no sharing.
- Google's own handling of the sign-in is Google's; link their policy.

**§3 What this site stores about you.** A table, because a list of columns is the honest form:

| Stored | Where | Kept until |
| --- | --- | --- |
| A sign-in id issued by Clerk | this site's database | you delete your account |
| Your Handle | this site's database | retired permanently on deletion or rename; never reassigned |
| Programmes and revisions you upload, and their metadata | database and file storage | published permanently unless withdrawn or removed |
| The Handle as it stood at each upload | on the programme row | permanently — it is the credit |
| Your upvotes | database | kept if you delete your account, unlinked from you |
| Your bookmarks | database | deleted with your account |
| Unfinished uploads | database | deleted with your account; swept after 24 hours regardless |

Plus the explicit negatives: **no IP address log, no analytics profile, no device
fingerprint, no email address.**

**§4 Your Handle, and what other people see.** The Handle is the only name anyone else sees
and you choose it; it appears on your programmes, your contributor page and the leaderboard.
**Vote totals are public; who voted is not** (operator-visible only). **Bookmarks are private
throughout** — no count, never shown to anyone. Renaming retires the old Handle permanently
and nobody can claim it, including you; programmes keep the Handle they were published under.

**§5 Programmes you upload are public and permanent.** Upload is publish. CC-BY 4.0,
irrevocably granted, so forks and copies survive anything you do afterwards. Files are served
publicly and cached by a CDN. Deleting your account does not unpublish them; withdrawing them
does — and even then, forks taken while they were published stay.

**§6 If you are named in a programme someone else uploaded.** `.xer` files carry resource
names, activity notes, free-text fields and the name of the exporting user; files are
published exactly as uploaded and **nothing is removed from them**. Anyone named may ask for
removal via `/report`. **The remedy is removal of the revision, not editing of the file** — if
the name appears across a series, which is usual, the whole series and everything forked from
it is removed. Download URLs carry a header asking search engines not to index or archive
them, and the file host tells crawlers to stay out; that is a request to well-behaved
crawlers, not a barrier.

**§7 Reporting a programme.** Anyone can report, no account. What the form stores: what was
reported, the name as it appears if that is the subject, and contact details. **Contact
details are deleted 90 days after the case is closed**; the rest of the report is kept as the
record of a decision.

**§8 Deleting your account.** The order and the consequences, stated before anyone gets
there: (1) this site's rows go first — account record deleted, bookmarks deleted, votes kept
but unlinked, Handle retired; (2) then Clerk deletes the Google identity. Uploaded programmes
**stay published**, credited to a Handle that by then belongs to nobody. To remove them,
**withdraw first, then delete** — two acts, both available, in that order.

**§9 Cookies, analytics and third parties.** See §7.15.

**§10 Where your data is held, and who else touches it.** Named rather than glossed, one
sentence each: **Clerk** (identity), **Neon** (database), **Cloudflare R2 and CDN** (files and
delivery), **Vercel** (hosting), **Google** (sign-in), **GitHub** (source code, and the
scheduled job that mails the operator when something breaks). No data is sold or shared with
anyone else.

**§11 Your rights.** How to ask what is held, how to ask for deletion, and that both go to
`/report` because there is no other channel. Carries two inline `LAWYER` blocks (§7.18).

**§12 Changes to this policy.** Every version stays published at its own URL; changes ship as
a new numbered version alongside a new version of the terms; the version accepted at each
upload is recorded on that upload; nothing is edited in place.

_Source: [The site's static pages](docs/wayfinder/tickets/030-static-pages.md) · [Google OAuth in production](docs/wayfinder/tickets/027-google-oauth-in-production.md)_

---

### 7.12 `/terms` — content outline

Thirteen sections. Everything operative is settled above; nothing new is decided in the
drafting. Where legal phrasing matters rather than substance, the substance is fixed and the
phrasing is the drafter's.

Page header block:

> **Terms of use — version 1.** Last changed: *(commit date)*. Earlier versions stay published
> at `/terms/v1`, `/terms/v2`, …
> If you have published a programme here, the version you accepted is recorded against that
> upload and linked from it.

1. **What this site is, and who runs it** — a public library of Primavera P6 programmes, run
   by one person, free to use, best effort, no service level. Using it means accepting these
   terms.
2. **Your account** — Google sign-in only, one account per person, you are responsible for
   what is published from your account, and the operator may suspend an account or remove any
   programme at their discretion.
3. **What you promise when you upload** — the long form of §7.2's three claims, plus the
   sentence that matters when someone changes their mind: **the licence cannot be withdrawn**;
   you may withdraw the programme, you cannot withdraw the licence from copies and forks
   already taken. Every upload re-asserts all three, and the version accepted is recorded.
4. **The licence you grant** — CC-BY 4.0 site-wide, no per-upload choice, covering the file
   and everything the site computes from it; **the site takes no separate licence of its own**.
5. **Attribution, forks and revisions** — §7.3, in prose: the site renders attribution from
   lineage, the `.xer` is never modified, on-site forking satisfies CC-BY automatically,
   off-site reuse is the reuser's obligation with a citation line provided, and revisions are
   owner-only (everyone else forks).
6. **Withdrawing your own programme** — §7.5 Class A: self-service, either granularity, page
   stays at its URL, file deleted, title and Handle stay visible, **forks untouched**.
7. **Reports and removals** — anyone may report with no account; rights/confidentiality/PI
   removals **cascade to everything forked from the removed content**, whose owners are not
   accused of anything and whose pages say so; removed files are held **30 days** before
   destruction so a mistake can be undone; one person adjudicates, best effort, **no service
   level**, appeal to the same person; bytes are deleted, rows are not.
8. **Acceptable use** — do not upload what you have no right to publish; do not upload
   confidential or personal information that is not yours to publish; do not create accounts
   to inflate votes; do not attempt to overload the site. The operator may remove anything and
   void votes, by hand, without notice.
9. **No warranty** — §7.4's clause, in its formal home. **The one clause that must not be
   softened in drafting.** Carries a drafting note that this is a service-level disclaimer
   *separate from* the Apache-2.0 disclaimer in the repository; both exist, neither substitutes
   for the other.
10. **Limits on liability** — `LAWYER` block (§7.18). Substance intended: limited to the
    maximum extent the law allows, nothing excluded that cannot lawfully be excluded, and no
    attempt to disclaim statutory duties.
11. **The site's code** — Apache-2.0, public repository, contributions inbound under the same
    licence so there is no contributor agreement to sign; link the repo and the licence.
12. **Changes to these terms** — new numbered versions, old versions stay published, **an
    upload stays pinned to the version accepted when it was made**, continued use means
    accepting the current version.
13. **Governing law** — `LAWYER` block (§7.18); jurisdiction and governing law stated in the
    final text.

_Source: [The site's static pages](docs/wayfinder/tickets/030-static-pages.md) · [Licensing, attribution and takedown](docs/wayfinder/tickets/003-licensing-attribution-takedown.md)_

---

### 7.13 The home lede and `/about`

**The homepage carries the description; `/about` carries the long form.** `https://xerhero.com/`
is what goes in Google's branding form as the **App home page**, and the automated check is a
fetch of that exact URL — nominating `/about` would bet a 2–3 business-day manual review on a
reviewer's reading of the word *home*, to save four sentences.

#### The lede on `/`

Renders **only when the URL is the canonical bare `/`** — no `q`, `sector`, `size`, `p6`,
`progressed`, `sort` or `page`. Identical for every viewer, signed in or out; it therefore
costs no state flag and does not produce two different first screens. It sits between the
header and the filter bar, above the grid: body type, left-aligned, no background, no image,
no button, **no dismiss control**. Three paragraphs and a link row, ~95 words — about two shelf
rows of height above the fold, on one URL, and no horizontal space from any row.

> ### Public Primavera P6 programmes, shared as `.xer` files.
>
> Planners upload programmes here and they are published in full, under CC-BY 4.0. Browse the
> shelf below, open one to read its structure, logic and DCMA checks, download the original
> `.xer`, or fork it and upload your own version. Nothing here is reviewed — every programme is
> another planner's work, published exactly as they uploaded it.
>
> Browsing and downloading need no account. Signing in with Google is used only to sign you in,
> so that you can upload, upvote and bookmark. Your Google name, email and profile picture stay
> with the sign-in provider; this site stores a sign-in id and the Handle you choose, and shows
> neither your name nor your email anywhere.
>
> [About this site](/about) · [Terms](/terms) · [Privacy](/privacy)

Paragraph 2 is what satisfies "fully describe your app's functionality"; paragraph 3 is the
purpose statement for the Google identity. **The header strap does not grow** — it stays at one
line and renders on every page, including `/p/{slug}`, where a sign-in disclosure has no
business.

#### `/about`

Title: **About xer-hero**. Static at build, no data reads, no client JavaScript. Sections in
this order, because it is the order a stranger asks the questions in:

1. **What this is** — a public library of P6 programmes; what the site does with an uploaded
   file; why it exists (programmes are how the work is actually planned and almost none are
   public); the CC-BY 4.0 grant and the ready-made citation line on every programme page.
2. **What you can do without an account** — browse, filter, search, open, read, download. None
   of it asks you to sign in.
3. **What you can do signed in** — upload, upload a revision of your own programme, fork
   someone else's, upvote a programme or a contributor, bookmark privately.
4. **What happens when you upload** — the browser reads the file before anything is sent; it
   reports activity count, P6 version, date range and acceptability, and shows the panel of
   §7.8. **Nothing is removed from your file**; the download is the same bytes you sent; there
   is no way to publish part of a file and no way to edit one after publication (a correction
   is a new revision; a programme that should not have been published is removed rather than
   edited). Publishing is immediate and public — no private tier, no drafts, no unlisted
   programmes.
5. **Signing in with Google** — Google sign-in is the only way in and is used only to sign you
   in; the Google name, email and picture are held by Clerk and never stored or displayed here;
   what is stored is a sign-in id and a Handle; the Handle is snapshotted at publication so
   renaming never rewrites past credit; account deletion, with the **withdraw-first-then-delete**
   order stated in the copy rather than discovered at deletion time; link to `/privacy`.
6. **What this site does not do** — **the load-bearing section, and deliberately the longest.**
   Five bullets: it does not review anything; it does not screen files for personal data (the
   upload screen lists what it finds, removes nothing, blocks nothing — with the measurement
   reasoning stated); DCMA checks are computed, not endorsed, and a real live contract can fail
   several while a template built to pass will pass all of them; it does not schedule (no
   forward or backward pass, nothing recalculated); it makes no promise about any file here.
   *An About page whose biggest block is a list of refusals cannot drift into a landing page
   without someone noticing. Its existence and its bluntness are overturnable taste; its content
   is not.*
7. **Who runs it** — one person, in their own time, best effort; no company, no support desk,
   no service level; reports and questions go to `/report`, which is read; the site is free and
   nothing on it is for sale.
8. **Licences and source** — programmes under CC-BY 4.0 by their uploaders, code Apache-2.0,
   public repository linked, issues and pull requests welcome.

`/about` carries **no catalogue count** (§7.4).

_Source: [The site's static pages](docs/wayfinder/tickets/030-static-pages.md)_

---

### 7.14 The site-wide footer

In the **root layout, on every route**, including `/p/{slug}` and everything under `/me`. It
is static and viewer-independent, so it does not touch the cacheability of a signed-out public
render. **Exactly six links and one sentence.** No columns, no newsletter, no social icons, no
copyright line.

> ---
> [About](/about) · [Terms](/terms) · [Privacy](/privacy) · [Contributors](/contributors) · [Report a problem](/report) · [Source](https://github.com/…)
>
> Programmes are published by their uploaders under [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).
> This site's code is Apache-2.0. Run by one person, best effort, with no warranty — see
> [the terms](/terms).

| Link | Target | Why it is there |
| --- | --- | --- |
| About | `/about` | the long description |
| Terms | `/terms` | linked from the upload checkbox too |
| Privacy | `/privacy` | **required on every page**, so it is reachable without login from any entry point — and most arrivals are a shared `/p/{slug}`, not `/` |
| Contributors | `/contributors` | the leaderboard, footer-linked by its own anti-gaming argument |
| Report a problem | `/report` | the intake form; the mailbox is printed **on that page** so it is not harvested off every page |
| Source | the public GitHub repo | Apache-2.0, and where `docs/legal/*.md` history lives |

**Refused, with reasons:** a raw `mailto:` in the footer (publishes the operator's address to
every scraper, for a channel that is secondary to the form); repeats of `/`, `/upload` and
`/me` (the header already carries them; a footer that repeats the nav is a sitemap nobody
reads); a cookie/consent link (nothing to consent to, §7.15); a licence badge image (an image
asset for a sentence that fits in a sentence); the catalogue count (§7.4).

**Also deliberately absent from the site entirely:** `/faq`, `/pricing`, `/contact`, `/docs`,
`/blog`, `/changelog`, `/roadmap`, a `/status` page (nothing measures uptime, and a
hand-edited status page is a guarantee wearing a different word), a version-picker widget on
`/terms` (a client component on a page with no JavaScript), and any logo or wordmark image.

_Source: [The site's static pages](docs/wayfinder/tickets/030-static-pages.md)_

---

### 7.15 Analytics, cookies, and why there is no banner

**No analytics in v1, of any kind.** No Google Analytics, no Vercel Web Analytics, no
Plausible, no pixel, no beacon. **No advertising, no trackers, no third-party embeds, no
remotely-loaded fonts.** The requirement that analytics be *named rather than glossed* is met
with the cheapest honest name: **none**.

**Cookies: the Clerk session cookie only**, set at sign-in, strictly necessary for staying
signed in. **A signed-out visitor receives no cookie from this site at all.**

**Consequence — there is no cookie banner and no consent management**, because nothing is set
that needs consent. That is a page nobody has to build.

**The two remaining third parties in a browser are named honestly** in the privacy policy:
**Cloudflare Turnstile**, which runs only on submission of the `/report` form, and
**Cloudflare**, which serves the blob host.

**What this costs, recorded as a decision rather than discovered later:** the operator will
have **no traffic data at all** — never knowing whether anyone reads `/about`, which pages are
entered from search, whether a programme page is ever opened, whether the sitemap was crawled,
or whether disallowing the facets helped or hurt. Every crawl decision in §7.16 is therefore
**unmeasurable by construction**.

The narrower claim that survives, and it is load-bearing for §7.17: **catalogue facts are
still observable.** The shelf's live conjunctive facet counts render per-sector counts on the
front page on every load — they measure the *catalogue*, not the traffic — which is the one
class of fact the no-analytics decision left intact.

**Adding any analytics later reopens this and costs a new version of both legal documents**,
which is the right friction.

_Source: [The site's static pages](docs/wayfinder/tickets/030-static-pages.md)_

---

### 7.16 The crawl surface

Two generated files, one head-tag rule per route class, and no schema demand of any kind —
every predicate is a column that already exists.

#### 7.16.1 `robots.txt`

**A generated route (`app/robots.ts`), not a static text file**, because the disallow list is
derived from `SHELF_QUERY_PARAMS` — the same constant the shelf's URL builder uses — so adding
a fifth facet without disallowing it is a **test failure** rather than an unbounded crawl
discovered six months later.

The file, in full:

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

- **`page=` is absent from the disallow list, on purpose.** `/?page=3` stays crawlable;
  `/?sector=rail&page=3` does not, because the `sector=` rule matches it.
- **Precedence:** `Allow: /` is one character of rule path and each `Disallow` line is longer,
  and crawlers use the most specific rule by rule-path length — so the disallow wins on a facet
  URL and nothing else changes.
- **One `User-agent: *` group. No per-agent rules, no AI-crawler block, no `Crawl-delay`.**
  Crawl-delay is unsupported. The AI block is refused on the licence: this site publishes every
  programme under CC-BY 4.0, and a `robots.txt` saying *anyone may reuse this except you* is
  incoherent against the licence in the footer — and the one object carrying personal data is on
  a different origin already saying `Disallow: /` to everybody. *(That the block is refused
  rather than merely unbuilt is overturnable taste; it is one line either way.)*
- **There is no `Noindex:` line and never will be** — that rule was retired from `robots.txt`
  handling in 2019.
- **Why the facets lose:** the shelf's crawl-path argument was always about the **unfiltered**
  numbered sequence, and a filter is by construction a subset of a page that is already
  crawlable, so disallowing `?sector=` removes nothing from the crawl graph. On the other side
  is a facet space of **over 30,000 states before pagination** (four multi-select facets — eight
  sector codes alone give 255 non-empty subsets — times four sorts) and **unbounded** once `q` is
  free text, against a shelf render that costs **two Postgres queries** because of the live
  facet counts.
- **Stated rather than hidden:** a `Disallow`ed URL is not a hidden URL — it may still be listed
  without a snippet if someone links it. Accepted. **The escape hatch, if it ever is not: remove
  that param's `Disallow` *and* add `noindex, follow`. Never both at once.**
- **The blob host's `robots.txt` is a different origin** and says the opposite (`Disallow: /`,
  §7.9). Rules apply only to the host, protocol and port where the file is served; neither file
  says anything about the other. **The failure mode this design defends against is a
  copy-paste** — a site serving `Disallow: /` looks completely normal and is completely
  invisible — which is why CI asserts the site's file contains **no bare `Disallow: /`**, and why
  the same assertion runs against production every 15 minutes as an unauthenticated
  `GET https://xerhero.com/robots.txt`.

#### 7.16.2 The sitemap

**Route `app/sitemap.ts` with `export const revalidate = 3600`.** One query — the shelf's own
published join without the limit — reading Postgres on **our** schedule once an hour and serving
cached bytes on the crawler's. Crawler volume does not enter the arithmetic at all; the route
costs ~22 CPU-seconds a month, **0.15% of the Hobby Active-CPU allowance**.

It lists, with `lastModified` only:

- `/` — `lastmod` = the newest published upload;
- the six static routes: `/about`, `/terms`, `/privacy`, `/contributors`, `/report` (and `/`
  above) — **with no `lastModified`**, because those change by deploy and an unverifiable value
  is worse than none;
- **every published `/p/{slug}`** — `lastmod` = the current revision's `uploaded_at`;
- **every listable `/u/{handle}`** — listable being exactly the contributor-board eligibility
  predicate (zero published non-tombstoned programmes delists you).

**No `changeFrequency` and no `priority`** — both are ignored by Google, and `priority: 0.8` is
an unsubstantiable claim in a machine-readable file, which is §7.4's rule arriving in XML.

**Deliberately absent:** `/?page=N` (reachable by sequential link, and every programme is listed
directly anyway); every `/p/{slug}/r/{n}` and every `/terms/v{n}` / `/privacy/v{n}` (listing a
URL you have canonicalised or `noindex`ed away argues against yourself); **tombstoned and
pending programmes**, which fall out of the join and the published predicate with no exception
written anywhere.

One sitemap, no splitting: ~10,300 URLs at the 10,000-programme design target against a limit of
50,000 URLs / 50 MB. Splitting is additive when it is needed.

A metadata-only edit (title, sector) does **not** move `lastmod`; that is correct rather than a
gap, because every number above the fold comes from the Revision.

**Static-at-build loses on freshness, not on cost:** deploys happen on push, uploads arrive
continuously and *are* the product, so a build-time sitemap is wrong on day two.

**`/sitemap.xml` gets no production assertion**, deliberately: under ISR a failed revalidation
serves the last good cached bytes, so a 200-and-well-formed check would be green through
precisely the failure it exists to catch. It is covered in CI, against the dev catalogue, before
merge.

#### 7.16.3 Canonical tags, per route class

**Every indexable route emits a self-referential `<link rel="canonical">`.** Three classes emit
something other than a self-reference — those are the only exceptions:

1. **`/p/{slug}/r/{n}` where `n` is the current revision → canonical `https://xerhero.com/p/{slug}`.**
   The estate's only true duplicate pair: byte-identical HTML at two URLs.
2. **`/terms/v{n}` and `/privacy/v{n}` where `n` is the current version → canonical the bare
   route** (`/terms`, `/privacy`), and **never also a `noindex`**.
3. **Facet, `q` and `sort` URLs → no canonical and no robots meta at all.** A directive on a URL
   `robots.txt` forbids fetching is the classic contradiction; the absence is a CI assertion.

Everything else self-canonicalises, and the ones that should not be listed carry `noindex,
follow` **in addition to** a self-canonical:

| Route class | In sitemap | robots meta | canonical |
| --- | --- | --- | --- |
| `/` (bare) | yes | — | self |
| `/?page=N`, N ≥ 2 | no | — | **self, including `?page=N`** |
| `/?page=1` | — | — | **308 → `/`** (a `next.config` redirect with a query matcher; no Function invocation) |
| `/?page=N` past the last page | — | — | **404** |
| `/?…` any facet, `q` or `sort` | no | **none, deliberately** | **none, deliberately** |
| `/p/{slug}` published | yes | — | self |
| `/p/{slug}` tombstoned (A or B) | **no** | **`noindex, follow`** | self |
| `/p/{slug}` with no published revision | no | — | — (404 to anyone but the owner) |
| `/p/{slug}/r/{n}`, `n` current | no | — | **`/p/{slug}`** |
| `/p/{slug}/r/{n}`, `n` superseded | no | **`noindex, follow`** | **self** |
| `/p/{slug}/r/{n}`, `n` tombstoned | no | **`noindex, follow`** | self |
| `/u/{handle}` listable | yes | — | self |
| `/u/{handle}` not listable | no | **`noindex, follow`** | self |
| `/contributors`, `/about`, `/terms`, `/privacy`, `/report` | yes | — | self |
| `/terms/v{n}`, `/privacy/v{n}` — current | no | **none** | **bare route** |
| `/terms/v{n}`, `/privacy/v{n}` — superseded | no | **`noindex, follow`** | **self** |
| `/me/*`, `/ops`, `/api/*` | no | — | — (also `Disallow`ed) |

**The two governing rules, and swapping them is the bug:**

- **A URL emits a canonical pointing elsewhere, *or* a `noindex`, never both.** That combination
  says "this page is the same as that one" and "remove this page" about one cluster.
- **`Disallow` and `noindex` are mirror instruments and are never used together.** Facet URLs get
  `Disallow` and no `noindex` — there is an unbounded number of them and the point is to stop
  them being *fetched*. Superseded revisions, superseded legal versions and tombstones get
  `noindex` and no `Disallow` — there are few of them, each has an inbound link that must keep
  working, and the point is to stop them being *listed*. **A `noindex` on a `Disallow`ed URL is
  never read.**

Two reasoned corrections worth carrying: a **superseded revision is not a duplicate** of the
current one (rev 7 of a two-year monthly series is a different programme's worth of dates, floats
and DCMA marks), so it gets `noindex` with a self-canonical rather than a false duplicate claim;
and a **superseded legal version self-canonicalises** rather than pointing at the current text,
because saying they are the same document contradicts the exact thing the audit trail depends on
being false.

#### 7.16.4 Tombstones: `noindex` timing

**A tombstone is `noindex, follow` and out of the sitemap from the moment its row commits — in
both classes, uniformly.**

- The directive is a **predicate over `programme.status`**, so it is emitted the instant the
  takedown's **step 1 (the row transaction) commits** — the reversible half, **before a single
  byte is deleted**. No column, no branch on `removal_class`.
- The reasoning is about what a tombstone is *for*: the row and the URL are kept forever so that
  **an inbound link does not rot**, never so anybody can find it. A page whose entire job is to
  answer a link somebody already holds has no business being a search result.
- **Uniform across classes deliberately.** A Class A owner who withdrew did not withdraw in order
  to stay in Google, and branching a head tag on `removal_class` puts one more thing in the
  takedown path to get right. Title and uploader stay visible **on the page**, unchanged; what is
  narrowed is discovery off it — and for a Class B the title can itself be the violation.
- **The page needs a TTL for the same reason the blob did.** If `/p/{slug}` were cached
  long, tombstoning the row would not take the page down either — a crawler and a visitor would
  both keep getting the pre-tombstone render, with every number and the download button on it.
  So **the signed-out render of `/p/{slug}` and `/p/{slug}/r/{n}` carries a TTL of at most one
  hour**, the same clock as `original.xer.gz`.
- **No fifth takedown step.** There is no page purge — the site's DNS records are DNS-only, so
  there is no CDN in front of the site to purge, and adding one would need a hosting credential
  on the operator's laptop. The one-hour TTL replaces it for free. Where speed genuinely matters
  (an urgent Class B), **Google Search Console's Removals tool** is the documented fast path; the
  Domain property already exists from DNS verification. It is a **per-incident manual line in
  `docs/operating.md`, for Class B only, deliberately not code.**

#### 7.16.5 Open Graph cards

**Text-only cards, one committed static image site-wide, and no generated image ever.**

**The rule: no OG string in this site is authored.** Every value is either a string already
fixed elsewhere or a fixed template over Postgres columns the shelf row already renders — so
there is no new prose for §7.4's banned list to police and nothing for a future editor to soften.

One static `app/opengraph-image.png` (1200×630, wordmark on a flat ground, no photograph, no
avatar, no data) sits in the root and is inherited by every route through metadata merging. **No
route ever overrides it.** `twitter.card` is `summary`, not `summary_large_image` — there is one
small shared image and nothing to fill a wide frame with. *(Overturnable taste.)*

| Route | `og:title` | `og:description` |
| --- | --- | --- |
| root default | `xer-hero` | the header strap, verbatim: *"Public Primavera P6 programmes. Browse, download, fork."* |
| `/p/{slug}` published | `{title} — xer-hero` | `{activity_count} activities · {sector_label} · P6 {p6_version} · {progress} · uploaded by {handle} · CC-BY 4.0` |
| `/p/{slug}` tombstoned | **root default** | **root default** |
| `/p/{slug}/r/{n}` | `{title} — rev {n} — xer-hero` | as published, from that revision's columns |
| `/u/{handle}` | `{handle} — xer-hero` | `{n} published programmes on xer-hero.` |
| `/about`, `/terms`, `/privacy`, `/report`, `/contributors` | page title | the page's own first sentence |

- `{sector_label}` is the sector label or **`Unsectored`** — blank is plausibly the largest
  bucket, so the template renders it rather than omitting it. `{progress}` is
  `{pct_complete}% complete`, or `Not started` at 0.
- **The uploader's free-text `description` is never used** in an OG string. It is optional and
  empty for the guaranteed state of an uncaring upload, and a snippet is where the wording rules
  are least enforceable when the words are somebody else's. It stays on the page, in the search
  index and in the CC-BY publication; it is simply never put in the site's voice.
- **A tombstoned programme emits the site defaults and nothing else** — one branch on
  `programme.status`, the same one the `noindex` reads. The title stays visible *on the page*, a
  URL somebody already holds; an unfurl is the same title travelling *outward* into a channel
  nobody asked.
- **Generated OG images are banned**, and the ban is a CI grep: **`next/og` and `ImageResponse`
  appear nowhere in the repo.** A per-programme card is uncached per-row data by definition, so it
  is a Function invocation and a rasterisation per request — an unauthenticated, enumerable,
  CPU-bound public endpoint fetched by every link unfurler, against a 4 CPU-hour monthly allowance
  shared with the sweep, the presign, ingest and every page regeneration. It is also a new image
  surface one designer's afternoon away from an avatar, against the structural rule that nothing
  renders `user.imageUrl`. Anything OG is derived from **Postgres columns and never from
  `derived.json`**, precisely so it still renders for a pending or tombstoned programme whose
  blobs do not exist.

#### 7.16.6 Structured data: none in v1

Refused rather than skipped, and the reason is the personal-data posture rather than effort.

| Candidate | Verdict |
| --- | --- |
| `Dataset` | **Blocked.** It fits a programme page almost perfectly — `name`, `description`, `creator`, `license` all exist — but the property that makes it a Dataset entry is `distribution`, *where to get the data and in what format*, and the only honest answer is `original.xer.gz`: the one object all PI is confined to, marked `noindex, noarchive`, behind `Disallow: /` and linked `rel="nofollow"`. Emitting a machine-readable pointer to it is the precise inverse of the entire mitigation, and a `Dataset` without `distribution` announces that a dataset exists with no way to reach it. **Revisit only if `distribution` can ever name something that is not the PI-bearing object; today it cannot.** |
| `AggregateRating` / `Review` over votes | **Banned outright.** It converts a raw count into a rating, which is the computed-versus-endorsed line and the ban on badges. A star rating in a result is a quality mark wearing a schema type. |
| `BreadcrumbList` | Harmless and honest, and refused on a smaller argument: **the first block of JSON-LD in a codebase is what makes the second one easy**, and it buys a breadcrumb line in a result nobody is competing for. |
| `Organization`, `WebSite` + `SearchAction` | The sitelinks searchbox result no longer exists, and `Organization` describes an organisation — which the voice rule refuses to invent. |

_Source: [The site's own crawl surface](docs/wayfinder/tickets/033-site-crawl-surface.md) · [Personal data in published .xer files](docs/wayfinder/tickets/013-personal-data-in-published-files.md)_

---

### 7.17 Sector landing pages: the trigger condition

**`/sector/{code}` is not built in v1.** The route is right and its shape is right; only the
catalogue is wrong — at launch, eight near-empty landing pages is thin content on a site whose
whole first impression is honesty about being small.

**Trigger, exact: at least four of the eight seeded sector codes each hold ≥ 25 published
Programmes.** Both numbers come from existing decisions — **25 is the shelf's page size**, the
point at which a sector view is a full page in its own right rather than a short excerpt of one,
and **four is half the code list**, which is what makes the route a set of pages instead of one
page and seven 404s. Together they imply **≥ 100 published Programmes**, so the unfiltered shelf
is at least four pages deep and a sector page is a genuine subset rather than a re-render of `/`.

The operator's query, which lives in `docs/operating.md`:

```sql
select p.sector, count(*)
  from programme p join revision r on r.id = p.current_revision_id
 where p.status = 'published' and p.sector is not null
 group by p.sector having count(*) >= 25;
```

**But the operator does not have to run it.** With no analytics, no observation about search
traffic will ever exist — yet the shelf's **live conjunctive facet counts render the per-sector
count on the filter bar of the homepage, on every load, for every viewer**. They measure the
catalogue rather than the traffic, so **the trigger is printed on the front page in v1, at zero
cost, before anything is built.** No new alarm rule, no migration.

**Known false negative, accepted:** a catalogue that piles up in one code never trips this —
4,500 rail against 100 highways is two codes over the bar, not four. That is the correct outcome,
because when one code dominates, `/sector/rail` *is* the shelf and the frozen newest-first order
already serves it at `/`.

**Rejected: ship the route now and 404 any code under the bar.** The instruction is to 404 when a
filter combination *returns no results*, not when it returns few; a 404 on a URL that has content
is a lie at the HTTP level, and it would 404 a page a visitor can reach from a breadcrumb.

**When it does ship** (recorded so the shape is not re-decided):

- **The path form is canonical and self-canonicalises. `?sector=rail` stays `Disallow`ed and
  emits neither a canonical nor a `noindex`** — the two instruments stay on opposite URLs, and
  `robots.txt` is never used for canonicalisation.
- **Single-valued only.** `/sector/rail,highways` does not exist and 404s; adding a second sector,
  or any other facet, moves the visitor onto the query form. **The route is an entry point, not a
  filter state.**
- **An unoccupied or unknown code 404s** — one predicate: *the code exists in the `sector` table
  **and** has ≥ 1 published Programme*. A 200-with-a-sentence page would be treated as a soft 404
  anyway **and** would add a sentence about the state of the catalogue that the wording rules then
  have to police; 404 needs no prose at all. **There is no `/sector/unsectored` and no
  `/sector/none`**, so the largest bucket in the catalogue is the one with no landing page.
- **No internal link ever points at a 404**: zero-count facet chips are greyed out, and the
  programme-page breadcrumb's sector segment renders only on a programme that is itself in that
  sector. The one edge — a tombstoned programme — renders that segment **unlinked**, reading the
  same `programme.status` branch the `noindex` and OG defaults already read.
- **In the sitemap, occupied codes only**, `lastmod` = the newest published `uploaded_at` in that
  code, computed as a group-by over rows the sitemap query already holds. Inclusion and the
  200/404 boundary are the same predicate.
- **`robots.txt` needs no edit**: the disallow rules are param-matched rather than path-matched,
  so `/sector/rail?size=l` is already disallowed the day the route ships, and `page` is not, so
  `/sector/rail?page=N` self-canonicalises including the page number, `?page=1` 308s to
  `/sector/rail`, and a page past the last 404s.
- **Guard rail:** shipping the route must **not** remove `sector` from `SHELF_QUERY_PARAMS`. The
  query form stays a working multi-select filter for humans and stays disallowed; the path route
  is purely additive.
- **Caching is not decided**: the sector page is a shelf and takes whatever the shelf takes.

**No other facet earns a path route, and this is the rule rather than three verdicts.** A facet
qualifies only when it is (i) a **closed set we seed**, (ii) **single-valued**, (iii) **a noun
somebody would type**, and (iv) **stable enough that a URL minted today means the same thing in a
year**. Sector is the only one that scores on all four: **size bands** fail (iv) hardest — they
are our bucketing of `activity_count` and one band edge has already moved once, so `/size/xl`
would freeze a tuning constant into a public URL — and also (iii); **P6 version** fails (i),
because the values come out of the file and every future release adds one; **`progressed`** fails
(ii) and (iii), being a boolean.

_Source: [Do sector landing pages exist, now that ?sector= is uncrawlable?](docs/wayfinder/tickets/034-sector-landing-pages.md)_

---

### 7.18 The three lawyer questions, shipped unreviewed

**v1 ships without legal review and says so.** None of these blocks anything. Each is marked
**inline in the drafted document as a `LAWYER` block** so a drafter cannot lose it:

1. **Hosting-provider liability** — whether the site qualifies for hosting-provider liability
   protection in the UK/EU, and whether publishing a formal notice-and-takedown procedure is a
   condition of keeping it. → **terms §7 and §13.** §7 is written as a procedure partly in case
   the answer is yes; whether it is *the* procedure a statute requires is not established.
2. **Erasure vs. the CC-BY grant** — whether the grant survives a UK GDPR erasure request in the
   form described (account data erased, pseudonymous credit left behind on the theory that a
   Handle is not personal data). → **privacy §5 and §8.** The position is defensible and has not
   been reviewed.
3. **Lawful basis for third-party personal data** — whether an uploader warranty plus an advisory
   panel is a lawful basis for publishing third-party personal data, and whether the site is
   controller or joint controller at publication. → **privacy §6.**

Separately recorded as a note rather than a fourth question: holding erasure-requested content
30 days in a private store before destruction is ordinary operational practice — a retention
mechanic rather than a lawful-basis question.

_Source: [Licensing, attribution and takedown](docs/wayfinder/tickets/003-licensing-attribution-takedown.md) · [Personal data in published .xer files](docs/wayfinder/tickets/013-personal-data-in-published-files.md) · [The site's static pages](docs/wayfinder/tickets/030-static-pages.md)_

---

### 7.19 The published mailbox

**`carlos.greblo@gmail.com`**, decided by the operator 2026-08-08.

It is printed on `/report` and named in `/privacy` and `/terms` as the contact route. It appears
**nowhere else** — not in the footer, not on `/about`, not in any page's markup — so it is not
harvested off every page. Mail arriving there is transcribed into a `takedown_report` row by hand;
the application still stores no address, sends no mail and holds no mail credential, so this adds
no dependency, no secret and no cost.

Two consequences, stated so neither is discovered later:

- **It is a personal address and it will be public and permanent.** It carries the operator's own
  name, and `/privacy` and `/terms` are versioned documents whose shipped versions are immutable —
  so an address published in v1 stays readable at `/privacy/v1` even after a later version changes
  it. Replacing it later means a new version of both documents, which is the friction the legal
  design deliberately built in.
- **A `report@` alias on the domain is the cheap escape.** Once the domain is registered, an email
  routing rule forwarding `report@` to this inbox costs nothing on the free plan and needs no
  mailbox provider. Taking it would change one string in three documents and nothing else. Left
  as the operator's call rather than assumed, because it is a preference about their own name.

**Overturnable**, at the price of one version bump to both legal documents.

_Source: [Licensing, attribution and takedown](docs/wayfinder/tickets/003-licensing-attribution-takedown.md) · [The site's static pages](docs/wayfinder/tickets/030-static-pages.md) · operator decision, 2026-08-08_

---

## 8. The compute engine: what the server derives from a .xer

Everything in this section runs once, at ingest, over the parsed tables of a single
`.xer`. There is no scheduler. The engine does four things — it **traces** a driving
path from dates P6 already wrote, it **decodes** calendars, it **converts** a span to
working days, and it **reads** float — and a fifth thing gates the first: a ship gate
scored against P6's own answer on real exports.

The rules below were settled by seventeen tickets of forensics against a real corpus of
139 P6 exports (one live contract's monthly revisions plus siblings, gitignored forever)
and a 29-file synthetic corpus in `fixtures/synthetic/`. **A builder cannot re-derive
them**: the real files are not in the repo and never will be. Reproduce them exactly.

Every rule below carries its footing:

- **[observed]** — measured, with `n` and the corpus it was measured over.
- **[inferred]** — deduced from measurements plus an external authority (Oracle docs,
  MPXJ), not directly measured.
- **[engineered]** — a considered choice, not forced by evidence. Overturnable on
  evidence, not on taste.

**Where prose and code disagree, the code in `tools/fixture-gen/` is the authority** —
but four rules below are *decided and not yet built*, and those are called out
individually. `tools/fixture-gen/measure.mjs` is a **measurement harness, not the
product parser**; the product parser is isomorphic TypeScript and is written from this
spec.

---

### 8.1 Critical path: we trace, we do not schedule

**The rule.** Walk P6's own dates backwards from the project finish. There is no forward
pass, no backward pass, no calendar arithmetic and no CPM engine. A CPM engine is **out
of scope**, not deferred.

The gap this closes was mis-stated for a long time. We were never missing the critical
path — `critical_count` already ships from `total_float_hr_cnt` against
`PROJECT.critical_drtn_hr_cnt`, which is P6's own arithmetic. What is missing when
`driving_path_flag` is empty is the **chain**: which activities are driving the finish.
A chain is reachable from dates already in the file; a re-schedule is needed only to
second-guess it.

Two consequences a builder must hold on to:

- **The trace always runs.** Where P6 populated `driving_path_flag` we do **not** defer
  to it; we compare against it. Provenance on the output is **always `computed`**, never
  `from-file`. A stat whose method flips depending on how the planner happened to export
  is not comparable across programmes, and the flag is the only ground truth this
  project will ever have — spending it as an output would spend it forever.
  **[engineered]**
- **The accepted cost, stated plainly:** on a file where P6 gave an answer, we may
  publish a different one. Divergence lands as an `info` entry in `issues[]`.

**DCMA check 12 stays `skip`.** The 600-day-delay test needs a scheduler. What check 12
is *for* — whether a driving chain runs unbroken from the data date to the finish — is
answered by `logic.path_continuous`, which ships as its own stat **outside**
`checks_applicable`. A fifteenth check would make `checks_passed / checks_applicable`
incomparable with every published DCMA number. Same rule keeps `logic.cycle_count` out.
**[engineered]**

**Placement: ingest-time.** The trace is an O(V+E) walk over ≤20,000 activities and
~35,000 relationships — negligible beside the parse that just happened. Lazy-on-open
would mean re-fetching and re-parsing `original.xer.gz` to save microseconds. The browse
row's `card` payload gains **nothing** from this feature, so it never incurs a backfill.
**[engineered]**

_Source: [Do we compute the critical path ourselves?](docs/wayfinder/tickets/014-compute-critical-path.md)_

---

### 8.2 `driving_path_flag`: what it is, and when it is trustworthy

`TASK.driving_path_flag` is **P6's Longest Path**, not P6's Critical set. Conflating the
two is the classic P6 reporting error. It is `'Y'` or empty. P6 populates it only when
the scheduler was run with the Longest Path option enabled.

**How often it is there** **[observed, n = 139 real exports; 67 distinct by SHA-256]**:

| | files |
|---|---|
| `driving_path_flag` on **> 1 row** — the usable oracle set | **48** |
| on exactly 1 row | 19 |
| on 0 rows | 0 |
| unreadable (an all-`NUL` file) | 1 of the 139 |

On the 48 oracle files there are **5,180 flagged rows**. Fixture B — four tender
variants of a different job, 3,344 activities each — carries the flag on **1 activity**,
which is why the contract originally shipped `logic.longest_path` as
`state: "unavailable"`.

Three properties of the flag a builder must know before treating it as truth:

1. **It spans different work from ours.** **1,733 of the 5,180 flagged rows (33.5%) are
   `TK_Complete`.** P6's Longest Path runs back *through* completed work and terminates
   at the start of the programme, not at the data date. **[observed]**
2. **That is P6's current answer, not residue.** Across 16 revisions whose flagged set
   had never appeared before in the corpus, the runs **added 494 rows and removed 416**,
   and **276 of the 494 added (55.9%) were already `TK_Complete` in the revision exported
   before the run**. Back-tracing every flagged completed row in the set:
   **1,669 of 1,733 (96.3%) were already complete when their flag was written**; only 62
   (3.6%) are residue. The chain's tails are `TK_Complete` on **45 of 48 files** (99 of
   105 tails), with the oldest flagged finish **341–1,376 days** before the data date —
   3.8 years on the worst file. **[observed]**
3. **Byte-identity across revisions does not prove staleness.** 22 of the 48 oracle files
   carry a flagged set byte-identical to an earlier revision's at an earlier data date,
   across eight runs; the longest is **nine consecutive revisions over eight months while
   236 activities complete and not one activity and not one relationship is added or
   removed**. A retained chain yields the same set at every data date, so identity is
   consistent with a fresh recomputation. **16 of those 22 files score exactly 100%**
   against our trace. The honest statement is *byte-identical to an earlier revision's,
   and nothing in the file says whether that is an old mark or an unchanged answer*.
   **[observed]**

**Nothing in the file dates or licenses the flag.** Enumerated over all 67 distinct
files: `PROJECT.last_tasksum_date`, `sum_data_date`, `last_baseline_update_date`,
`apply_actuals_date` and `next_data_date` are **empty on all 67**; `last_recalc_date` is
the data date and `add_date` is when the project was created.
`SCHEDOPTIONS.sched_float_type` is **`FT_FF` on 67 of 67** — critical defined by total
float, never Longest Path — identically on fresh files and four-month-stale ones, and
`enable_multiple_longest_path_calc` is `N` on 65 of 67 while `float_path` is populated
anyway. **A file's scheduler settings do not describe the run that wrote its marks.**
**[observed]**

**The `sched_progress_override` caveat.** Exactly one export in 67 carries
`sched_progress_override = Y` with `sched_retained_logic = N` — the two singleton values
in the whole `SCHEDOPTIONS` census, on the same file. That file is 11.6% complete (203 of
1,751 activities, 66 in progress) and its **70 flagged rows are every one `TK_NotStart`,
none starting before the data date** — which is our span exactly, written by P6. Six days
later the same project exported with retained logic and the chain had extended backwards
through the completed predecessor of that file's own tail. **This is a correlation at
n = 1 on two settings that move together and cannot be separated by this file set.** It
is named, not adopted: the reading it supports would have to explain 1,669 rows it does
not touch. **Nothing in the engine branches on it.** **[observed, n = 1]**

_Source: [Do we compute the critical path ourselves?](docs/wayfinder/tickets/014-compute-critical-path.md), [Does a freshly-run Longest Path include completed activities?](docs/wayfinder/tickets/053-longest-path-includes-complete.md), [Which flagged set does the ship gate score against?](docs/wayfinder/tickets/050-ship-gate-flagged-set.md)_

---

### 8.3 The span, the seed and the walk

**The span is remaining work as of the data date**, walked back from the latest remaining
finish. This is a deliberate **restriction** of P6's answer, not a reproduction of it —
§8.2 measured that P6's own span reaches back through completed work to the start of the
programme. The restriction is the right one: everything downstream spends remaining work
(`logic.longest_path` reports *share of remaining activities*; the `skip` case is
*programme 100% complete*), and a span reaching 3.8 years behind the data date would
report a critical path most of which is already built. **[engineered, on measured
evidence]**

**The output shape is a per-activity boolean set, not an ordered chain.** Driving paths
**branch**; P6's flag marks every branch; an array of `task_code` cannot represent that.
A driving set is also **not time-ordered** — an `SF` predecessor can start *after* the
activity it drives — so no client-side render may reconstruct the path by sorting the set
by date. **[observed: a corpus fixture, `logic-nonfs-drivers`, contains two `SF`
predecessors that start and finish after their successor]**

```
trace(tasks, rels, dataDate):
  remaining := { t in tasks : t.status_code != 'TK_Complete' }
  if remaining is empty:
      return { state: 'skip', reason: 'no remaining work at the data date' }

  latest := max over remaining of t.early_end_date        # wall-clock instant
  seeds  := { t in remaining : t.early_end_date == latest }   # ALL of them, ties kept

  # DFS with three colours; the visited set is needed anyway, so cycles are free
  members, branches, cycles, tails, truncated := walk_back(seeds, driversOf)
  return { state: cycles ? 'error' : 'ok', seeds, members, branches, cycles,
           tails, truncated }

walk_back(seeds, driversOf):        # iterative, WHITE/GREY/BLACK colouring
  for each seed: push
  on first visit of t:
      mark GREY, add t to members
      d := driversOf(t)
      truncated |= d.truncated
      if d.rels is empty:      tails += t          # chain tail
      if |d.rels| > 1:         branches += (t, d.rels)
      push each d.rels[i].pred
  revisiting a GREY node:  cycles += the path slice from that node   # back edge
  revisiting a BLACK node: skip
```

**Seeding: argmax on `early_end_date`, all ties kept. No tie-break.** **[observed, n = 67
distinct real files]** This was priced against alternatives and the alternatives buy
nothing:

| seed rule | seeds | marked | correct | recall | precision |
|---|---|---|---|---|---|
| **argmax `early_end_date` — adopted** | **102** | **3,402** | **3,400** | **98.6%** | **99.9%** |
| + P6's own dropped seeds (the ceiling) | 102 | 3,402 | 3,400 | 98.6% | 99.9% |
| within one shift (8 h) of the latest | 102 | 3,402 | 3,400 | 98.6% | 99.9% |
| within 16 / 24 / 64 / 72 h | 114 | 3,405 | 3,400 | 98.6% | 99.9% |
| every remaining activity with no live successor | 2,113 | 21,408 | 3,415 | 99.1% | **16.0%** |

The last row fails on its own number — +15 activities of recall for +18,006 marks, 74
points below the gate's precision floor. A "longest path" of 21,408 activities across 48
programmes is a list of everything with a dangling end.

Why the naive rule is safe: **47 of the 67 distinct files tie on the latest
`early_end_date`, and 47 of 47 ties are mixed** (a milestone row beside a task row).
Every one of the 67 files carries **exactly one milestone row in its seed set** (66
`TT_FinMile`, one `TT_Mile`) and **no file seeds on a task alone**. A programme ending in
a finish milestone is not the commonest shape in the domain, it is the *only* one. All
**102** seeds across the 48 oracle files carry `driving_path_flag = Y`, and **P6's own
seed — the sink of the flagged subgraph — is inside our seed set on 48 of 48 files, 0
dropped, 0 activities lost.** **[observed]**

This works only because P6 writes a finish milestone at **its driver's finish instant**,
so a milestone and the tasks that finish with it write the *same* `early_end_date` and
the tie is exact. See §8.14; the magnitude of that asymmetry is _(pending 057)_.

What would reopen the no-tie-break decision, and nothing else: **a real programme whose
finish milestone is written a working gap after the tasks that drive it, where one of
those tasks is not a driving predecessor of the milestone.**

_Source: [Do we compute the critical path ourselves?](docs/wayfinder/tickets/014-compute-critical-path.md), [Does the tracer seed where P6 seeds?](docs/wayfinder/tickets/044-tracer-seed-tie-break.md), [The two walks can disagree about the seed, and `why` cannot say so](docs/wayfinder/tickets/042-seed-divergence-unnamed.md)_

---

### 8.4 The driving test, per relationship type

**Ordering, not equality — and this is what keeps calendars out of the tracer.** The
obvious test is `pred.EF + lag == succ.ES`, and it is the one that breaks: a zero-gap FS
across a weekend is Friday 17:00 → Monday 08:00, which is not a date match. Deciding it
needs `clndr_data` working-time arithmetic, which produces confidently wrong dates when
it is wrong. So the test **compares** rather than computes: every quantity is a timestamp
P6 already wrote or an hour count already in the row, and the comparison is a subtraction
of two numbers in the file. **[engineered]**

**The compared quantity is type-specific.** `EF + lag` is exact for FS and simply wrong
for the other three types — an `SS` constrains the successor's *start* from the
predecessor's *start*, `FF`/`SF` constrain the successor's *finish*.

| `TASKPRED.pred_type` | demand | measured against |
|---|---|---|
| `PR_FS` | `pred.early_end_date + lag` | `succ.early_start_date` |
| `PR_SS` | `pred.early_start_date + lag` | `succ.early_start_date` |
| `PR_FF` | `pred.early_end_date + lag` | `succ.early_end_date` |
| `PR_SF` | `pred.early_start_date + lag` | `succ.early_end_date` |

`lag` is `TASKPRED.lag_hr_cnt`, treated as **elapsed** hours (see the residues below).

This is a **strict generalisation**, not a replacement: on an all-FS successor the
reference is a constant that cancels and the rule reduces to `EF + lag` argmax exactly.
21 of the 24 corpus goldens do not move by a single activity under it. **[observed]**

```
driversOf(t):
  visible    := t.preds where the TASKPRED row exists in this file
  live       := visible where pred.status_code != 'TK_Complete'
  resolvable := live where pred is a TASK row in this file
  truncated  := |resolvable| != |live|          # an external predecessor was dropped

  pool := resolvable minus { rel :
              rel.lag == 0
          and sameKind(rel, t)
          and demand(rel) < reference(rel, t) }          # the floor, §8.5

  if pool is empty: return { rels: [], truncated }       # chain tail
  best := max over pool of (demand(rel) - reference(rel, t))
  return { rels: every rel in pool scoring exactly best, truncated }   # ties ALL kept
```

**Minimum float was rejected outright.** "The critical set is the longest path" is the
conflation this whole section exists to avoid; a `tf <= 0` tracer marks 23 activities
against a truth of 10 on the corpus fixture built to catch it. See §8.15.

**Measured on the synthetic corpus** (24 files at the time, generator's own driving
relation as truth) **[observed]**:

| rule | recall | precision | files exact on all six fields |
|---|---|---|---|
| `EF + lag` for every type | 95.1% (155/163) | 96.3% (161 marked) | 17/24 |
| per relationship type | 96.3% (157/163) | 97.5% (161 marked) | 18/24 |
| **per type + the same-kind zero-lag floor** | **96.3%** | **98.1%** (160 marked) | **19/24** |

An independently written reader that tokenizes the committed `.xer` bytes and walks
`TASK`/`TASKPRED` alone scores **24/24** under the adopted rule and **22/24** under
FS-only (3 marked in error, 2 missed) — which is what says the rule is reachable from the
file rather than merely recorded beside it. Post-047 the corpus is 29 files and the
aggregate is **197 truth / 195 read / 191 common — 97.0% recall at 97.9% precision, 22 of
28 exact**, with `measure.mjs --verify` at **29/29**. **[observed]**

**Two named residues, both deliberately unfixed.**

- **Lag as elapsed hours.** Which calendar converts a lag is a `SCHEDOPTIONS` setting;
  the tracer ignores it. Exposure: **8.8% of Fixture B's relationships and 0.3% of
  Fixture A's** (about eight relationships in 2,825); **0.5% across the 67 distinct real
  files** (845 lagged of 175,524). *Both* of these percentages were transposed in three
  earlier documents and the source of record is the DCMA table headed
  `| # | Check | Fixture B tender | Fixture A update |`. **[observed]**
- **Mixed anchor kinds on one successor.** A finish instant scored against a start
  instant on a **zero-lag** relationship: two candidates that tie in *working* time can
  sit 64 elapsed hours apart. Each type makes one of four comparisons
  (`finish-vs-start`, `start-vs-start`, `finish-vs-finish`, `start-vs-finish`), and two
  candidates order the same way in elapsed time as in working time **only when they make
  the same comparison**. Where a successor's candidate pool mixes them, this is the
  residue. **[observed: 32 corpus activities have live predecessors of mixed anchor kind,
  11 on a driving set, exactly one gets a different answer]**

  **The repair was built, measured and rejected.** Reconstructing the shift boundary from
  the file's own dates — mapping a finish-anchored demand to the earliest activity start
  instant at or after it — recovers the lost branch and costs five other files: precision
  98.1% → 92.9%, exact files 19/24 → 16/24. It is a working-time model inferred rather
  than read, and it breaks on a seven-day calendar and on any programme sparse enough
  that nothing starts on the day the chain needs. **Do not implement it.**

Neither residue is measured in quantity by the ship gate: across the 67 distinct real
files, non-FS logic is **0.6%** (`PR_FS` 174,458, `PR_SS` 641, `PR_FF` 420, `PR_SF` 5)
and lagged relationships **0.5%**. Both are Fixture-B-shaped and Fixture B's oracle is one
flagged activity in 3,344. There is no remedy and none is pretended.

_Source: [Does the driving test need to distinguish relationship types?](docs/wayfinder/tickets/028-driving-test-relationship-types.md), [Bring the corpus's readable walk onto the per-type driving test](docs/wayfinder/tickets/031-readable-walk-per-type.md), [Recheck the lag and non-FS exposure figures against their source](docs/wayfinder/tickets/036-recheck-lag-exposure-figures.md)_

---

### 8.5 The same-kind zero-lag floor, and the written-anchor-kind test

> Drop a candidate whose demand is strictly earlier than its reference, where the two are
> the same kind of instant and the lag is zero. If the pool empties, the activity is a
> chain tail — held by a constraint or the project start, not by logic.

This can only ever remove a false positive: a candidate strictly below its own reference
cannot be the argmax unless the argmax is itself below the successor's date, which is the
case the truth already reports as *no driving predecessor*. Worth **+0.6pp precision and
one more exact file** on the corpus, and it takes the `external-relationship` fixture from
62.5% precision to 100%. **[observed]**

It applies only where demand and reference are the same kind of instant — which is `SS`
(start against start) and `FF` (finish against finish), never `FS` or `SF`. The
precondition is stated on **what each column writes**, not on whether the row has zero
span:

```
writtenKind(row, column):
    row.task_type == 'TT_FinMile'  ->  'finish'    # both date columns
    row.task_type == 'TT_Mile'     ->  'start'     # both date columns
    otherwise                      ->  the column's own kind

sameKind(rel, succ):
    writtenKind(pred, demandColumn) == writtenKind(succ, referenceColumn)
```

Net effect: the floor applies to `PR_SS` and `PR_FF` **minus** `PR_FF` touching a
`TT_Mile` and `PR_SS` touching a `TT_FinMile`, and **plus** every `PR_FF` milestone pair
that occurs in reality. Cost: one enum lookup on a column the parser already reads, so
the calendar-free stance is untouched.

**Why this replaced an earlier `PR_FF` milestone exclusion.** The predecessor rule
excluded any `FF` pair with a milestone on exactly one side, keyed on
`early_start_date == early_end_date`. It was **inverted**: across the 67 distinct real
exports, **124 of the 420 `PR_FF` relationships have a milestone on exactly one side and
124 of 124 are an `FF` into a `TT_FinMile`** — finish against finish, exactly like-for-like
— while **not one `PR_FF` in either real fixture touches a `TT_Mile`** (0 of 565 across
both sets), which is the only shape the exclusion would have been right about. It declined
the exact case and admitted the inexact one. **[observed]**

The old clause was also live rather than inert: it rescued **117** floored candidates
across **62 of 67** Fixture A files (plus 10 across 4 of 4 Fixture B files). None of them
matters — the nearest rescued candidate demands a finish **170.4 hours** (seven working
days) below the finish it is supposed to have set, the median is **936 hours**, and on
**0 of 72** affected successors is a rescued candidate the argmax or does the pool empty
without it. Scored end to end on the 48 oracle files with the clause and without:
**98.6% recall at 99.9% precision, identical to the decimal, 0 of 48 files differing.**
The score cannot decide this; the rule does. **[observed]**

**Oracle documents no `FF`-into-a-milestone semantics for P6** — thirteen searches and
sixteen fetches returned nothing, and there is no published forward-pass formula at all.
The rule does exist in Oracle text for a *different product*: Oracle Primavera Cloud's
error reference forbids an `FF` successor that is a **Start** Milestone (PRM-003015125)
and an `SS` predecessor that is a **Finish** Milestone (PRM-003015126), and forbids
neither `FF` into a Finish Milestone. Oracle's own validation encodes the anchor-kind
argument and names the two pairs the replacement excludes. **[inferred, on Oracle
Primavera Cloud validation grammar]**

**Second hole closed on the way:** the floor previously applied to `PR_SS` with no guard
at all, and an `SS` touching a `TT_FinMile` compares a start against a written finish.
Zero instances in 2,938 real `PR_SS` relationships, and Oracle forbids it — closed by
construction.

> **Code/prose disagreement.** `makeReadableDrivers`'s `sameKind` in
> `tools/fixture-gen/lib/programme.mjs` still keys on `milestoneRow`
> (`early_start_date === early_end_date`), the withdrawn test. The corpus does not move
> either way (its single milestone `FF` is on an activity no walk reaches), and the
> generator is scheduled to be brought onto `writtenKind`. **Build the `writtenKind`
> test, not the code as it currently stands.**

**Neither branch of the floor is executed by any real file or by the corpus**, because
the missing ingredient is topology rather than the relationship: a floored candidate only
changes an answer when it wins the argmax of the surviving pool, which in practice means
being the sole live resolvable predecessor, and **0 of 72** real successors carrying a
rescued `FF` have one. The oracle is silent here at n = 143: **not one of the 143 `PR_FF`
relationships on the 48 oracle files touches a flagged row on either side, nor does one of
the 386 `PR_SS`.** P6's Longest Path across these programmes is `FS` logic end to end.
**[observed]**

_Source: [028's `FF` milestone guard has lost its reason](docs/wayfinder/tickets/054-ff-milestone-guard.md), [Does the driving test need to distinguish relationship types?](docs/wayfinder/tickets/028-driving-test-relationship-types.md)_

---

### 8.6 Degradation, cycles and continuity

**Cycles are a finding, not just a failure.** P6 will not schedule a cyclic network, so a
cyclic file is one that was never successfully scheduled — a fact about the programme,
and on a broken file the most interesting thing on the page. The visited set the walk
already needs makes detection free. `logic.cycle_count` ships as a bare stat with its
members under the contract's 50-exemplar cap. **[engineered]**

Degradation maps onto the existing contract vocabulary — **no new states**:

| Case | `logic.longest_path` |
|---|---|
| Programme 100% complete, no remaining work | `state: "skip"` |
| Never scheduled, remaining dates absent | `state: "unavailable"` + reason |
| Chain reaches a predecessor not in the file | `state: "ok"`, `truncated: true`, `info` issue |
| Chain hits a logic loop | `state: "error"` + issue, **ingest still succeeds** |

**Ingest never fails on a stat error.**

**Continuity.** `logic.path_continuous` is a stat *about the programme*, not a check:

```
continuous := no cycles
          and not truncated
          and every chain tail is grounded

grounded(t) := t.status_code == 'TK_Active'
            or t.early_start_date <= PROJECT.last_recalc_date      # the data date
            or t has a predecessor in this file with status_code == 'TK_Complete'
```

Measured over the real set: our traced chain is continuous on **46 of 48** oracle files
(47 of 67 distinct), P6's own flagged chain is continuous under the same test on **43 of
48**, the two verdicts agree on 45, and **our chain is broken where P6's is whole on 0 of
48**. The two files where ours is discontinuous are 100%-not-started programmes whose walk
ends on activities with no predecessors starting 2,258 and 2,321 days after the data date
— and on both, our marked set is *identical to P6's*, 100% recall at 100% precision. A
hole in someone else's schedule is not our defect. **[observed]**

**`truncated` is never exercised by a real file.** The 67 distinct real files carry
**zero** external relationships (predecessor not in the file). It is a corpus-only shape,
so build it from the fixtures and do not expect production traffic to test it.
**[observed]**

_Source: [Do we compute the critical path ourselves?](docs/wayfinder/tickets/014-compute-critical-path.md), [Which flagged set does the ship gate score against?](docs/wayfinder/tickets/050-ship-gate-flagged-set.md)_

---

### 8.7 What the trace produces

- **`activities.json` gains a 14th field**: a boolean array, one entry per activity, in
  the same order as the other columnar arrays.
- **`derived.json` gains `logic.longest_path` as a real value** — count, duration in
  days, share of remaining activities, and provenance — or `{state, reason}`.
  Provenance is **always `computed`**.
- **`logic.cycle_count`** and **`logic.path_continuous`** join it as their own stats,
  both outside `checks_applicable`.
- **`derived.json` goes to v2** for this. `card` gains nothing and no typed column moves,
  so **no backfill**: `derived_version` already drives lazy recompute on open.
- The detail page prints one provenance sentence — *"computed by this site from the
  file's own dates — P6 did not export a Longest Path"* — and a `Longest path (N)` filter
  chip over the boolean array. The method lives in the tracer's own repo doc, not on the
  page.

> **GAP:** `logic.longest_path`'s "duration in days" is named in the contract and never
> defined. Is it calendar days or working days; between which two instants (the earliest
> `early_start_date` and the latest `early_end_date` among the marked set?); and if
> working days, on which calendar — the programme calendar of §8.13, or each activity's
> own?

> **Code/prose disagreement.** `measure.mjs` still emits the pre-v2 form,
> `logic.longest_path: { count: <driving_path_flag count> }` read straight off the file's
> flag. That is correct *for a fixture measurement harness*, which is measuring what the
> file says. The product must emit the computed value with provenance.

_Source: [Do we compute the critical path ourselves?](docs/wayfinder/tickets/014-compute-critical-path.md), [The derived.json contract](docs/wayfinder/tickets/006-derived-json-contract.md)_

---

### 8.8 Agreement with P6, measured

Pooled over the 48 real exports carrying `driving_path_flag` on more than one row, with
the rule of §8.3–§8.5 transcribed onto the columns a real export writes:

| | value |
|---|---|
| flagged rows | 5,180 |
| flagged rows that are **not** `TK_Complete` (the span-consistent oracle) | **3,447** |
| activities we marked | **3,402** |
| correct marks | **3,400** |
| **recall** (against the 3,447) | **98.6%** |
| **precision** (against every flagged row) | **99.9%** |
| missed rows | 47 |
| false positives | 2 — both on one file, both `TK_Active` |

**The choice of recall denominator was the only ambiguity, and it is one-sided.**
Precision is **99.9% under both readings, to the decimal**, and the correct count is
3,400 under both, because the walk drops `TK_Complete` from its candidate pool before it
scores anything and therefore *cannot* mark a completed row. Scored against every flagged
row, recall is **65.6%** and 10 of 48 files clear the thresholds; scored against the
remaining-flagged set, **98.6%** and 46 of 48. A diagnostic run with the span removed
entirely recovers **99.5% of every flagged row at 98.2% precision** (5,152 of 5,249
marked), so the 33.9-point gap is the **span and nothing else**. **[observed]**

**What predicts every recall loss: out-of-sequence progress on the flagged chain.** Count
the relationships where a `TK_Complete` flagged row has a flagged predecessor that is
*not* complete — an activity on P6's Longest Path that finished before the activity
driving it did. Three columns (`driving_path_flag`, `status_code`, `TASKPRED`), no dates,
no `clndr_data`, no second file. Call it `oosPairs`:

| `oosPairs` | files | recall | rows missed |
|---|---|---|---|
| **0** | **37** | **100% on every one** | **0** |
| 1 | 7 | 97.2 – 98.7% | 1–2 each |
| 2 | 3 | 94.3 – 96.4% | 2–4 each |
| 3 | 1 | **40.4%** | 31 |

**`oosPairs == 0` ⟺ `recall == 100%`, on 48 of 48 files**, and all 47 missed rows in the
set sit on the 11 files with at least one. The structural equivalent: the
flagged-and-remaining subgraph is one weakly-connected component on exactly those 37
files, while the **whole** flagged set is one component on 48 of 48. An out-of-sequence
pair is a **fracture** — a remaining flagged activity whose only route back to the seed
runs through a completed one, so our span cannot reach it by construction rather than by
defect. **[observed]**

**What this measurement does not prove.** Clustering the 67 distinct files by task-code
overlap (Jaccard ≥ 0.5) gives **six programmes**, and the oracle is **46 revisions of one
of them plus two single-shot programmes**. **98.3% of the oracle is one programme sampled
46 times.** The effective n for an accuracy claim is **three**, not 48. The measurement
says we agree with P6 about remaining work on this contract; it does not say P6's Longest
Path and our longest path are the same object, and it does not say we are right.

_Source: [Which flagged set does the ship gate score against?](docs/wayfinder/tickets/050-ship-gate-flagged-set.md), [Does the tracer seed where P6 seeds?](docs/wayfinder/tickets/044-tracer-seed-tie-break.md)_

---

### 8.9 Calendars: the `clndr_data` grammar as observed

`CALENDAR.clndr_data` is a packed structure and decoding it is the hardest part of the
format. **Oracle documents nothing beyond the field name "Data".** Everything here is
observed against 563 real `CALENDAR` rows in 138 calendar-bearing files, plus the
synthetic corpus.

**The grammar is nested parenthesised nodes:**

```
node    ::= '(' head '(' attrs ')' '(' children ')' ')'
head    ::= '0||' NAME
attrs   ::= key '|' value ( '|' key '|' value )*        # order-free, may be empty
children::= node*                                        # may be empty
```

**Only the parentheses carry structure. `0x7F` (DEL) and whitespace are layout** — they
can be stripped before parsing without changing the meaning, and they may be absent
entirely. This is the rule that was stated backwards for a long time and cost a parser
data: `0x7F 0x7F` looks like a record separator and is not. **[observed]**

| | `clndr_type = CA_Base` | `clndr_type = CA_Project` |
|---|---|---|
| layout | indented, multi-line | one flat line |
| `0x7F` bytes | **34 – 352** per calendar | **zero** |
| shift attribute order | typically `s\|08:00\|f\|16:00` | `f\|12:00\|s\|8:00` observed |
| hour padding | zero-padded | **not** zero-padded (`s\|8:00`) |

Both decode to the same tree. **A parser that treats `0x7F 0x7F` as a required record
separator reads every real project calendar as one unparseable record.** The DEL runs are
also why `file(1)` calls a `.xer` binary. **[observed]**

Base-calendar form, with `0x7F` rendered as a newline:

```
(0||CalendarData()(
  (0||DaysOfWeek()(
    (0||1()(
      (0||0(s|08:00|f|16:00)())))
    (0||2()(
      (0||0(s|08:00|f|16:00)())))
    ...
    (0||7()(
      (0||0(s|08:00|f|16:00)())))))
  (0||Exceptions()(
    (0||0(d|36525)())
    (0||1(d|36675)())
    ...))))
```

Project-calendar form — same tree, one line, no break of any kind in the field:

```
(0||CalendarData()((0||DaysOfWeek()((0||1()())(0||2()((0||0(f|12:00|s|8:00)())
(0||1(f|17:00|s|13:00)())))(0||3()(...
```

**Node semantics:**

- `CalendarData` is the root. `DaysOfWeek` holds seven children keyed `1`–`7`; **day 1 is
  Sunday**.
- Each day holds **zero or more shift children**. A day with no shift children is a
  non-working day.
- **Days routinely hold more than one shift.** The common real shape is the lunch break —
  `s|08:00|f|12:00` and `s|13:00|f|17:00` as two children of one weekday — and
  **three-shift days occur** across the wider file set. The synthetic corpus emits at most
  two; `buildClndrData` takes any number.
- `Exceptions` holds entries keyed `d|<serial>`. An exception with **no** children is a
  non-working date. An exception **with** shift children is a **working day bought back** —
  `(0||33(d|39633)((0||0(s|08:00|f|16:00)())))` — and it is not exotic: one real six-day-week
  calendar carries 80 of them, Sundays worked on a weekly cadence. Across the real set there
  are **10,584 exception entries, of which 306 are worked**. **[observed]**
- **The `Exceptions` node is optional**: **271 of 563** real calendars carry none at all.
  Do not require it.
- `(0||VIEW(ShowTotal|N)())` is a display setting, not working time. **273 of 563**
  calendars carry no `VIEW` node, and `ShowTotal|Y` occurs as well as `N`. Ignore it; do
  not choke on it.
- Exception dates are **day serials with epoch 1899-12-30** (the Excel/OLE serial).
  Verified by decoding all 94 distinct exception serials in one fixture: the month-day
  distribution under 1899-12-30 gives `07-04` ×11, `12-25` ×10, `01-01` ×9 and a floating
  late-November cluster of 13 — Independence Day, Christmas, New Year, Thanksgiving. Under
  1899-12-31 they are all off by one and meaningless. **[observed]**
- **Exceptions are not sorted.** One fixture lists serials 46023, 46381, 46025 in that
  order, which is the emission order a real reader found. Never assume date order.

Incidental and worth keeping: the base calendar in a **non-US** rail contract is P6's
stock **US** holiday calendar, shipped unmodified. Real programmes routinely carry
unlocalised default calendars — a plausible quality signal, and a caution against
inferring a project's geography from its calendar.

_Source: [Correct the clndr_data rules and calendar goldens against real P6 evidence](docs/wayfinder/tickets/038-calendar-shapes-and-0x7f.md), [What does `f|00:00|s|00:00` mean?](docs/wayfinder/tickets/048-elapsed-calendar-semantics.md)_

---

### 8.10 Decoding `clndr_data`: the rules, and what each one costs to get wrong

```
parse(blob):
  skip '\x7f', ' ', '\t', '\r', '\n' wherever they fall — everywhere, always
  a node is '(' head [ '(' attrs ')' [ '(' children ')' ] ] ')'
  strip the leading '0||' from head to get the node name

attrBag(attrs):                       # 's|08:00|f|16:00', 'f|12:00|s|8:00',
  split on '|', take pairs            # 'd|46023', 'ShowTotal|N' — all the same shape
  return { key -> value }             # ORDER-FREE. Never read by position.

hhmm(t):  h, m = split t on ':' ; return h + m/60      # tolerate an unpadded hour

shiftHours(s, f):                     # decimal hours
  return (f == 0) ? 24 - s : f - s    # a finish of 00:00 runs to the END OF THE DAY
  # result <= 0 is a decode ERROR naming the shift, not a negative day
```

Four rules, and each one has a measured cost when it is dropped. Measured by mutating a
decoder one rule at a time and re-verifying the whole synthetic corpus **[observed,
n = 27 files at the time; the same mutations post-047 over 29 files give 28/29, 28/29 and
2/29]**:

| rule dropped | corpus | what a user gets |
|---|---|---|
| shift attributes read **positionally** | 26/27 | a `12:00-08:00` shift, a **−8 hour** working day, −40 a week, and two rows of one calendar no longer decoding alike |
| time matched `\d\d:\d\d` (unpadded hour dropped) | 26/27 | the same calendar works **4 hours** a day, 20 a week, and an exception working day comes back **not worked** |
| `0x7F 0x7F` treated as a **record separator** | **2/27** | **every calendar in the corpus fails to decode**; the only survivors are the two files with no `CALENDAR` table |
| a shift finish of `00:00` subtracted naively | — | a real stock calendar in 136 of 138 files reads as **seven working days of zero hours** |

The positional read is the dangerous one because it **does not throw**: an earlier reader
built to the corrected `0x7F` rule but still reading attributes positionally reported a
five-day working week with **zero working hours in it**, which reaches a user as a
duration and not as an error.

**The end-of-day rule, in full.** A shift whose **finish** is `00:00` runs to the end of
the day. The discriminator is the finish, **not** `finish == start`:

| shift | hours |
|---|---|
| `s\|00:00\|f\|00:00` | **24** |
| `s\|08:00\|f\|00:00` | **16** |
| `s\|08:00\|f\|08:00` | **0** — a degenerate shift, and *not* a day |

**[inferred, on MPXJ + five converging measurements]**. MPXJ — an independent
implementation reading real P6 exports — has done exactly this since **6.0.0, 2017-07-22**,
whose changelog reads *"Fix `00:00` calendar finish times to parse as end of day when
reading from P6."* Its `LocalTimeHelper.getMillisecondsInRange` branches on
`rangeEnd == LocalTime.MIDNIGHT`, never on start-equals-finish. The five supporting
measurements over 563 real calendars:

1. **`day_hr_cnt` agrees with the decoded pattern on 561 of 561 populated rows under this
   reading and on 424 under the naive one, and the 137 disagreements are *exactly* the 137
   zero-length calendars.** No other class of `day_hr_cnt` disagreement exists anywhere in
   139 exports across four P6 versions. Not circular: Oracle documents the column as a
   units-*conversion* factor never validated against the shifts, and new calendars default
   to 8 hours a day whatever their shifts say.
2. Those rows carry `24 / 168 / 744 / 8784` and `24 / 168 / 720 / 8760` — `24 ×` 1/7/31/366
   and 1/7/30/365, coherent to four relationships in two variants.
3. **P6 already has two cheaper ways to write "no working time" and uses neither here**: a
   day node with no shift children, **182 times**; a day node with empty shift slots,
   **twice**; `00:00`→`00:00`, **zero times**. In one file both forms sit in the same
   `CALENDAR` table from the same exporter in the same run.
4. One exception entry of 10,584 carries a zero-length shift on an ordinary working day —
   under the naive reading, a planner added an exception to make a working day work *zero*
   hours, which is what the 10,278 childless exceptions already mean, written the long way.
5. **`24:00` is not representable.** Every clock value in 563 real calendars is one of
   `00:00 07:00 08:00 09:00 12:00 13:00 15:00 16:00 17:00 19:00`. `23:59` never occurs;
   `24:00` never occurs. `00:00` is the only spelling of end-of-day P6 has.

`f < s` **after** the end-of-day transform stays a **decode error**, not a wrap to the
next day. Unobserved in 563 calendars, and a negative day length is the signature of a
positional read rather than a night shift. **[engineered, marked overturnable]**

One adjacent trap, for anyone who later meets **PMXML** (a different format, not `.xer`):
there, a lone work-time of `00:00–23:59` is P6's sentinel for a **non-working** day while
`00:00–00:00` still means 24 hours worked. A one-minute difference inverts the meaning.

> **Code/prose disagreement.** `decodeClndrData`'s `shiftHours` in `measure.mjs` is still
> a plain `hhmm(finish) - hhmm(start)`, and `WorkCalendar.hoursPerDay` /
> `recordMeaning`'s `hoursOf` in `lib/calendar.mjs` are too. The end-of-day rule is
> **decided and not yet built**. Build the rule above. When you do: the decoder and the
> generator's own record **must not share an expression**, or the fixture asserts the same
> mistake twice.

_Source: [Correct the clndr_data rules and calendar goldens against real P6 evidence](docs/wayfinder/tickets/038-calendar-shapes-and-0x7f.md), [The goldens assert calendar meaning in prose only](docs/wayfinder/tickets/043-calendar-golden-block.md), [What does `f|00:00|s|00:00` mean?](docs/wayfinder/tickets/048-elapsed-calendar-semantics.md)_

---

### 8.11 Working days, exceptions, and hours per day

**Working-day semantics.** A weekday works if its `DaysOfWeek` node has at least one
populated shift child. An **exception overrides the weekday pattern for that date**, in
both directions: a childless exception makes a working weekday non-working, and an
exception with shift children makes a non-working weekday work.

**Hours-per-day derivation** — the decoder's output contract:

```
hours_per_working_day :=
    null   if no day works at all
    null   if the worked days are not all the same length   # a ragged week
    otherwise the common day length, from shiftHours over that day's shifts

working_days_per_week := count of days that work
hours_per_week        := sum of shiftHours over the worked days
```

`null` rather than a first-day guess, because guessing is exactly what `day_hr_cnt` does.
Consumers guard the `null`. After the end-of-day rule, `hours_per_working_day` **can no
longer be `0`** — a day that works has a shift, and a shift has positive length or the
decode fails — so the `null` check is the only guard anyone needs. **[engineered]**

**`day_hr_cnt` and `week_hr_cnt` are not a day length, and the two behave nothing alike.**
Oracle's Calendar dialog help: *"Time Periods … enables you to define the calendar's
default number of hours per timeperiod. For activities and resources to which the calendar
is assigned, **these values are used as conversion factors when users enter or display
units and durations**"* — a display setting, never validated against the shifts, and new
calendars default to 8 hours a day even 24-hour ones. Measured over 563 real rows
**[observed]**:

- **`week_hr_cnt` contradicts the decoded pattern on 290 of 561 populated rows** — 154
  seven-day eight-hour base calendars declaring a 40-hour week over a pattern working 56,
  and 135 six-day calendars declaring 40 over 48.
- **`day_hr_cnt` contradicts it on none** — 561 of 561 — once the end-of-day rule is
  applied.
- Both columns can be **absent from the `CALENDAR` `%F` list entirely**, not merely empty:
  one P6 6.2 export omits all four hour-count columns.

**Neither may feed a computed day length, and neither may sanity-check the other.** Take
the day length from the shifts; where the shifts are unavailable, report `unavailable`.

**The elapsed-duration calendar.** A stock 24×7 calendar appears in **137 `CALENDAR` rows
across 136 files — 98.6% of every real file carrying a calendar table** — seven days, one
shift each, `f|00:00|s|00:00`, `day_hr_cnt = 24`, `week_hr_cnt = 168`. It is written
**three ways**, so the zero-length shift is a property of the calendar rather than of the
flat writer:

| serialisation | n | type | bytes | `0x7F` | attrs | `VIEW` | `Exceptions` node |
|---|---|---|---|---|---|---|---|
| flat | **135** | `CA_Project` | 285 | 0 | `f\|00:00\|s\|00:00` | absent | **absent** |
| indented, wrapped | 1 | `CA_Project` | 400 | 32 | `s\|00:00\|f\|00:00` | absent | absent |
| indented | 1 | `CA_Base` | 438 | 34 | `s\|00:00\|f\|00:00` | `ShowTotal\|Y` | present, empty |

**No real activity is on one**: `TASK.clndr_id` names an elapsed calendar **0 times in 139
files**, `PROJECT.clndr_id` **0 times**, and the only reference from any table is one
`RT_Mat` resource. So nothing breaks today — structurally rather than luckily — and the
first 24×7 job uploaded changes that. Do not branch on `clndr_name`: **"Elapsed Duration
Calendar" appears in no Oracle source at all** (five PDFs, the HTML help, a code search).
One of the 137 is a planner's own `CA_Base` calendar whose name ends `-24x7`, carrying
`default_flag = Y`. **[observed]**

**The whole real population of decoded calendars**, for calibration **[observed, n = 563]**:

| decoded shape | rows |
|---|---|
| 8 hours × 7 days | 266 |
| **24 hours × 7 days** (elapsed) | **137** |
| 8 hours × 6 days | 136 |
| 8 hours × 5 days | 24 |

**Not one real calendar has a ragged week**, and **no calendar mixes zero-length shifts
with real ones** (0 of 563) — the question is per-calendar and all-or-nothing. So every
calendar any real activity sits on is an **eight-hour** day.

> **GAP:** the DCMA 6 (high float) and DCMA 8 (long duration) thresholds are *44 days*,
> currently converted at a hard-coded 8 hours to **352 hours** (`HIGH_FLOAT_HR` in
> `measure.mjs`). On a 24-hour calendar the same threshold is **1,056**, and a hard-coded
> 352 would fail every activity over a fortnight. The decision to remove the constant is
> recorded; the replacement is not. Which day length converts the 44 days — the
> activity's own calendar, the programme calendar of §8.13, or a documented fixed 8 with
> the limitation stated on the page?

_Source: [Correct the clndr_data rules and calendar goldens against real P6 evidence](docs/wayfinder/tickets/038-calendar-shapes-and-0x7f.md), [What does `f|00:00|s|00:00` mean?](docs/wayfinder/tickets/048-elapsed-calendar-semantics.md), [What calendar is `duration_working_days` measured on?](docs/wayfinder/tickets/045-duration-working-days-calendar.md)_

---

### 8.12 `clndr_data` shapes known NOT to decode

Four shapes exist in real exports that the current decoder gets wrong. Three are live
defects; the fourth is a deliberate error. **A builder must handle all four.**
**[observed, from a sweep of 563 real `CALENDAR` rows]**

1. **An anonymous root wrapper.** Two `CA_Project` calendars in two files are written
   `(0||()( (0||CalendarData()()) (0||DaysOfWeek()(…)) (0||Exceptions()()) ))` — so
   `CalendarData` is an **empty sibling marker**, not the parent of anything. A decoder
   that looks for `CalendarData` among the top-level nodes and takes its children finds
   the unnamed wrapper instead and throws `no CalendarData node`. **These are the only 2
   of 563 real rows that fail to decode outright.**
2. **Twelve-hour clock times.** One calendar writes `s|8:00 AM|f|12:00 PM` and
   `s|1:00 PM|f|5:00 PM`. A naive `split(':')` + `Number` reads `1:00 PM` as `01:00` —
   silently, because `Number('00 PM')` is `NaN` and `m || 0` swallows it. It happens to
   give the right answer for that file's morning/afternoon pair and would not for
   `s|8:00 AM|f|5:00 PM`. MPXJ discriminates the two formats on whether the string
   contains a space.
3. **Empty shift nodes.** `(0||2()())` — a shift node with an empty attribute group.
   Eleven of them in one file, where they are **how a non-working day is written**: days 1
   and 7 of a five-day calendar carry three empty slots each. The current rule throws on a
   shift node with no `s`/`f` pair — a rule chosen against a shape nobody had then seen.
   **It must become a skip**, and a day's `works` must mean *has at least one populated
   shift*, not *has children*.
4. **`f < s` after the end-of-day transform** is a decode **error** by decision, not a
   wrap to a night shift (§8.10).

When a calendar does not decode, the contract already has somewhere for it to go:
`duration_working_days` returns `{state: "error", reason}` plus an `issues[]` **warn**
(§8.13). Nothing else in the engine reads calendars.

> **Code/prose disagreement.** `measure.mjs` implements none of 1–3 today; they are
> decided and not yet built. The synthetic corpus contains no fixture for any of them, so
> **nothing will fail if you get these wrong** — write them from this list.

Two further shapes are tolerated but were never documented: **`Exceptions` is optional**
(271 of 563) and **`VIEW` carries `ShowTotal|Y`** as well as `N` (273 of 563 carry no
`VIEW` at all). **`CA_Rsrc` calendars remain unobserved anywhere.**

_Source: [What does `f|00:00|s|00:00` mean?](docs/wayfinder/tickets/048-elapsed-calendar-semantics.md), [The goldens assert calendar meaning in prose only](docs/wayfinder/tickets/043-calendar-golden-block.md)_

---

### 8.13 Durations and dates: `duration_working_days`

**The stat is the programme's span converted on the calendar the file names as the
programme's own — `PROJECT.clndr_id`** — reported with that calendar inside the same
object and with the share of activities actually on it. **[observed]**

```jsonc
"duration_working_days": {
  "days": 328,
  "calendar": { "clndr_id": "6600", "name": "5 Day Working Week", "working_days_per_week": 5 },
  "activity_share_pct": 50.0
}
```

— or `{state, reason}`, following `logic.longest_path`'s idiom exactly. The calendar rides
in the same object as the number for the same reason `critical_count` never ships without
`critical_threshold_hr`: a working-day count without its calendar is the same species of
lie.

**Why `PROJECT.clndr_id` and not `default_flag` or the first `CALENDAR` row.** Measured
over 14 real files (ten revisions of one programme, four variants of another): they carry
**3–5 `CALENDAR` rows and use exactly one** — distinct `TASK.clndr_id` is **1 on 14 of
14**, and on **14 of 14** it is the calendar `PROJECT.clndr_id` names. `default_flag` is
**absent from 12 of the 14**, and on one of the two that carry it, it names a calendar
holding **0 of 1,746 activities**. It marks what *new activities inherit*, not what a
programme is measured on. **[observed]**

The synthetic corpus can now fail all three readings, which it could not before — before
the two fixtures added for it, `PROJECT.clndr_id`, `default_flag` and *the first `CALENDAR`
row* all named the same calendar on all 27 files **[observed]**:

| wrong rule | corpus | what it reports |
|---|---|---|
| corrected | **29/29** | — |
| programme calendar off **`default_flag`** | 27/29 | one fixture converts on a seven-day week and reports **213 days at `activity_share_pct: 0`** against a true **153 at 100** |
| absent `clndr_id` **falls back to the first `CALENDAR` row** | 28/29 | reports **162 days** off a calendar the file never named |
| window counted **exclusive** of its finish | **4/29** | all 25 reporting files, each low by one working day |
| `activity_share_pct` **assumed 100** | **5/29** | 24 files |

**The arithmetic: whole days, both ends counted.**

```
days := count of dates d in [time.start_date, time.finish_date]        # INCLUSIVE
        where (d is in exceptions ? exceptions[d].works
                                  : decoded.week[weekday(d)].works)
```

Two questions were open and only one was asked. **Days, not timestamps**: the alternative
is working-hour arithmetic between the earliest start instant and the latest finish
instant, which has to **divide by a day length** — the one operation this field exists to
avoid, because a real stock calendar decoded to zero hours a day until §8.10's rule fixed
it. The cost is ±1 day on a 2,595-day number on a progressed revision, and it buys immunity
from that division. A whole-day counter reproduces P6's own duration arithmetic on **1,685
of 1,685** not-started activities in one real baseline and **3,110 of 3,111** in the other.
**[observed]** **Both ends counted**: an activity that starts and finishes on one working
day is one day, not zero.

**The states** — four `unavailable` branches and one `error`, checked in this order:

| condition | field | `issues[]` |
|---|---|---|
| no `CALENDAR` table | `{state:"unavailable", reason:"no CALENDAR table, so there is no shift pattern to convert on"}` | — |
| activities span more than one `proj_id` | `{state:"unavailable", reason:"activities span N projects, so there is no single programme calendar"}` | — |
| the owning `PROJECT` row names no calendar | `{state:"unavailable", reason:"the PROJECT row for proj_id X names no calendar"}` | — |
| `PROJECT.clndr_id` names a calendar the file does not carry | `{state:"unavailable", reason:"PROJECT.clndr_id 841 is not in the file's CALENDAR table"}` | — |
| the named calendar's `clndr_data` does not decode | `{state:"error", reason:"clndr_data for calendar 42 did not decode: …"}` | **warn** |
| otherwise | the object above | — |

**Only `error` raises an `issues[]` entry**, because `unavailable` is *absent from source*
and `error` is *computation failed*; lighting the "partially analysed" banner on every
calendar-less programme would be a lie about which happened. On the page, `unavailable`
prints the calendar-day span and nothing else — the one place this diverges from
`longest_path`, which prints its reason verbatim because it owns a callout and this owns
half a tile. **[engineered]**

**Coverage: a value on 25 of 29 corpus files (4 `unavailable`, 0 `error`) and 14 of 14
real ones.** On both real programmes the answer is **identical to the calendar-day span**,
because both are seven-day jobs — so the field's whole range lives on five-day programmes
nobody has uploaded yet (corpus ratio band **71.1–72.7%**). Rendered *with its calendar*
the identity still says something true and currently invisible: this programme is planned
on a seven-day week. **[observed]**

`shape.calendars_in_use` joins it as a bare scalar — the count of **distinct
`TASK.clndr_id`**, which is what makes the page's `Calendars` tile honest (one real
programme declares four calendars and uses one). Taken literally it can exceed
`shape.calendar_count`: a file whose `CALENDAR` table was deleted still has `TASK` rows
naming calendars, and reports `calendars_in_use: 2` against `calendar_count: 0`.

Cost: **+141 bytes** in `derived.json`. `derived.json` goes to **v3**; `card` and the typed
columns are untouched, so **no backfill**.

**Rejected alternatives, with their numbers.** *(a) delete the field* — it reports on 25 of
29 and 14 of 14. *(c) a per-calendar breakdown* — most rows would be spans converted on
calendars no activity is on. *(d) summed activity working duration* — **262,524
activity-days against a 3,319-day span** on one real programme (79×), 63,966 against 2,595
on the other (25×); it is not a duration of anything, and it has to divide by a day length.

> `span_calendar_days` is a **difference** (`finish − start`) while `days` is a **count**,
> so on a seven-day calendar the second is the first **plus one**. Which of the two moves,
> and what the Window tile prints, is _(pending 058)_.

_Source: [What calendar is `duration_working_days` measured on?](docs/wayfinder/tickets/045-duration-working-days-calendar.md), [Report `duration_working_days` on the programme calendar](docs/wayfinder/tickets/047-report-duration-working-days.md), [The goldens assert calendar meaning in prose only](docs/wayfinder/tickets/043-calendar-golden-block.md)_

---

### 8.14 Milestones and anchor instants

**What P6 writes.** A zero-duration row writes **one instant into both date columns** —
`early_start_date == early_end_date` — and *which* instant depends on the milestone type:

```
finishAt(h) := the END of working hour h-1        # a finish instant
startAt(h)  := the BEGINNING of working hour h    # a start instant

a TT_FinMile writes a FINISH instant into both columns
a TT_Mile    writes a START  instant into both columns
a TT_Task    writes startAt(es) and finishAt(ef)
```

The two differ by one working-hour boundary, and at a day boundary they are
`2026-03-25 16:00` and `2026-03-26 08:00` — one working moment written two ways, 16
elapsed hours apart. Getting this backwards is what makes a finish milestone rank strictly
later than the tasks it finishes with, which breaks the seed tie of §8.3.

**P6 writes a finish milestone at its driver's finish instant**, and it is the *task's
start* that a non-working gap displaces. Measured on typed, live rows with live zero-lag
`PR_FS` predecessors — the share whose written instant sits at the predecessor's finish
rather than one shift later **[observed]**:

| `task_type` | Fixture A | n | Fixture B |
|---|---|---|---|
| `TT_FinMile` | **98.3%** | 1,879 | **100%** |
| `TT_Mile` | 46.4% | 400 | 1.3% |
| `TT_Task` | 44.6% | 75,518 | 0.0% |

**A Start Milestone behaves like a task's start; a Finish Milestone is the outlier.** An
earlier, coarser measurement of the same asymmetry (96.4% of 28,695 "milestone" rows
against 54.1% of 77,853 "non-milestone" rows) was taken over a selector that is not a
milestone test, and its corrected magnitude is _(pending 057)_. The **direction** is
confirmed by the table above and nothing downstream depends on the older figures.

**The selector rule, which is the operative rule for a builder.**

> **On a progressed programme, `early_start_date == early_end_date` is not a milestone
> test.** Use `task_type`.

A completed activity has no remaining span, so P6 collapses its early dates to a point:
**26,325 of one real programme's 105,028 `TT_Task` rows (25.1%) carry equal early dates,
and 26,307 of those are `TK_Complete`.** Over the 81,848 live rows a walk can reach, the
date-equality test disagrees with `task_type` on **18** — nearly harmless *where the walk
uses it* — and over all rows on **26,325**. **[observed]**

_Source: [028's `FF` milestone guard has lost its reason](docs/wayfinder/tickets/054-ff-milestone-guard.md), [Does the tracer seed where P6 seeds?](docs/wayfinder/tickets/044-tracer-seed-tie-break.md), [The two walks can disagree about the seed, and `why` cannot say so](docs/wayfinder/tickets/042-seed-divergence-unnamed.md)_

---

### 8.15 Float

**Total float.** `TASK.total_float_hr_cnt`, as P6 wrote it. `critical_count` is the count
of activities whose total float is **at or below `PROJECT.critical_drtn_hr_cnt`**, and
**it must never ship without that threshold beside it**: the threshold is **0 on one real
fixture and 168 hours (21 days) on the other**, so "131 critical activities" and "1,265
critical activities" are answers to different questions. **[observed]**

**Total float is not the Longest Path.** They are different concepts and conflating them
is the classic P6 reporting error — a `tf <= 0` tracer marks **23** activities against a
truth of **10** on the fixture built to catch it. Separate fields, separate provenance.

**Free float, by relationship type.** `TASK.free_float_hr_cnt` is defined against successor
starts, so it is silently FS-shaped. Three measurements over the synthetic corpus
**[observed, n = 24 files]**:

- As a **driving test on its own**: 96.9% recall at **73.5% precision**, 3 of 24 files
  exact. It is not a driving test.
- As a **filter over the per-type rule**: changes **nothing on any of the 24 files** — all
  148 driving relationships have a predecessor carrying zero free float, including the
  `FF` and `SF` ones.
- **That second result could not be trusted when it was taken**, because the generator
  computed free float with the FS formula for every type and clamped negatives to zero —
  wrong on 8 of 429 rows. That defect is now fixed (free float is computed in the frame
  each relationship constrains, still clamped at zero), and reverting it scores **24/29**
  on the corpus, with 9 of 529 float-carrying rows wrong, eight of them a spurious zero.

**The rule: the corroboration is kept, demoted, and scoped.** **[engineered]**

> `free_float_hr_cnt == 0` **never promotes** a candidate, and it **never demotes** one on
> a **non-FS** relationship — because nothing has established how P6 computes free float on
> non-FS logic, and a false veto punches a hole in the chain, which the ship gate is
> asymmetric against.

> **Code/prose disagreement, and it matters for the gate figures.** `makeReadableDrivers`
> implements **no free-float filter at all**, and the ship-gate measurement in §8.8 was
> transcribed from that code. So **98.6% / 99.9% is the score of a tracer with the
> corroboration switched off**. The corroboration is decided policy; it is not what was
> measured. If you implement it, re-run the gate.

**Float paths.** `TASK.float_path` and `TASK.float_path_order` are P6's **Multiple Float
Paths** output. Populated in real exports — **1,570 of 1,751 activities on one revision,
384 distinct paths, 3,321 rows across the 139-file set** — even though
`SCHEDOPTIONS.enable_multiple_longest_path_calc` is `N` on 65 of 67 files. **[observed]**

What it actually is:

- **Path 1 is the lowest-total-float chain**, not the Longest Path. In the measured real
  file, path 1's 79 members are 79 of the 86 activities at the file's minimum total float,
  and they share **no member at all** with the 75 activities P6 flagged
  `driving_path_flag = Y` (whose total float runs −862 to −502).
- **`float_path_order` runs 1..n contiguously along a path** — 1..79 there. That is the
  half that is trustworthy.
- **Not every activity carries one.** Multiple Float Paths is asked for a *number* of
  paths and stops; in the corpus fixture 30 of 40 activities carry a path and 10 carry
  none.

The mechanism, so the disjointness is not a surprise: total float is measured against the
nearest **binding** late date; the Longest Path is the logic driving the project
**finish**. Those are the same chain only while the project finish is the only thing
setting late dates. An interim contractual deadline in delay puts the lowest-float chain
somewhere else entirely.

**The rule:**

> `float_path` is a **validation-time oracle for ORDER only. Never an output, never a
> fallback source, never in the contract.** It **must not** be read as membership of the
> driving path, and **agreement on membership is evidence of a bug**, not of correctness —
> a tracer whose driving set matches `float_path = 1` has reached for minimum float. The
> corpus enforces it: one fixture's path 1 (9 activities at −160 h) and its flagged set
> (10 activities at 0 h) are **disjoint**, and a conflating tracer scores **0% recall at 0%
> precision** on it. **[observed]**

_Source: [Correct logic-float-path to what P6's Multiple Float Paths output actually is](docs/wayfinder/tickets/039-float-path-semantics.md), [Does the driving test need to distinguish relationship types?](docs/wayfinder/tickets/028-driving-test-relationship-types.md), [Do we compute the critical path ourselves?](docs/wayfinder/tickets/014-compute-critical-path.md)_

---

### 8.16 The ship gate

`logic.longest_path` ships as a computed value **only** if the tracer clears this gate.
Below any clause of it, the field stays `state: "unavailable"` and the tracer is v2 work.

> **The ship gate, and it is asymmetric.** Ship only if, pooled over every real export
> carrying `driving_path_flag` on more than one row — **48 files today** — the tracer
> reaches **≥ 95% of the flagged activities that are not `TK_Complete`**, which is our span
> and **not P6's whole flagged set**, at **≥ 90% precision against every flagged row**,
> **breaking no chain P6 keeps whole**. Two floors keep the pooling honest: **no file below
> 90% precision**, and **no file below 90% recall unless it carries an out-of-sequence
> flagged pair**. **The synthetic corpus must be green.**

**Which flagged set.** The **flagged rows that are not `TK_Complete`** — 3,447 of 5,180.
This is the reading our span implies, and it is stated rather than assumed: **we grade
ourselves against the part of P6's answer we elected to reproduce, and the gate can never
argue against that election.** What licenses it is that the counterfactual is *measured*
— with the span removed the same walk recovers 99.5% of every flagged row, so the gap is
the span and not the tracer, and a broken tracer would fail both readings.

**Pooled over a corpus, not scored on a file.** A single file is an arbitrary choice among
48 and the two obvious picks give opposite answers. **Micro-averaged over flagged rows**,
because every-file hands the veto to the worst oracle in the set (every-file at 95/90
gives 46 of 48; at 90/90, 47 of 48). **Not a median** — 37 of 48 files sit at exactly
100%, so a median is 100% by construction and cannot fail. **Two floors**, because pooling
can hide one file: a 105-row file collapsing to zero costs three points of pooled recall
and would still pass.

**The recall floor's carve-out is not an exclusion.** A file with `oosPairs > 0` stays in
the pooled numerator and denominator — the worst one costs 0.9 points — and loses only its
individual veto. The predicate is measured *before* the score and does not depend on our
answer. `oosPairs` deliberately does **not** exclude anything, and the reason is the
sharpest constraint here: **it predicts every recall loss in the set perfectly, so a gate
that excluded on it would score 100% at 100% and could not fail.** That is the one property
a ship gate may not have.

**Continuity is an agreement clause, not an absolute one.** Read absolutely it fails 2 of
48 files on which our marked set is *identical to P6's* and P6's own chain stops in the
same place — refusing to ship because someone else's schedule has a dangling end. Read as
*our traced chain is discontinuous on no file where P6's flagged chain is continuous*, it
passes 48 of 48 and remains **the clause that bites**: it is the only one a hole-punching
tracer fails without a compensating gain anywhere else.

**Scored today [observed]:**

| # | clause | today | |
|---|---|---|---|
| 1 | pooled **recall ≥ 95%** of the flagged rows that are not `TK_Complete` | **98.6%** — 3,400 of 3,447 | pass |
| 2 | pooled **precision ≥ 90%** against every flagged row | **99.9%** — 3,400 of 3,402 | pass |
| 3 | no file below **90% precision** | min **97.1%**; 47 of 48 at exactly 100% | pass |
| 4 | no file below **90% recall** unless it carries an out-of-sequence flagged pair | 47 of 48 ≥ 94.3%; the 48th carries 3 | pass |
| 5 | our chain **discontinuous on no file where P6's is continuous** | **0 of 48** | pass |
| 6 | the synthetic corpus is green (`measure.mjs --verify`) | **29/29** | pass |

**Verdict: pass.** `logic.longest_path` ships as a computed value with provenance
`computed`.

**Two conditions on that verdict, neither a hedge.**

1. **What passed is the rule, not the implementation.** The figures were produced by
   transcribing the rule onto the columns a real export writes, from an independently
   written reader that reproduces the earlier per-file table to the decimal. **The gate
   must be re-run against the product tracer before ship, on these numbers, with no
   re-litigating of the thresholds.**
2. **A red synthetic corpus blocks the ship regardless of what the real files score.**
   `measure.mjs --verify` must be clean.

**What fails a build**, concretely: pooled recall below 95%; pooled precision below 90%;
any file below 90% precision; any file below 90% recall without an out-of-sequence flagged
pair; our chain discontinuous on any file where P6's is continuous; any synthetic fixture
failing `--verify`. In particular the corpus fails a tracer that reverts to `EF + lag` for
every relationship type (22/24 on the byte-reading check), one that conflates `float_path = 1`
with the driving path (0% recall at 0% precision on one fixture), one that reads shift
attributes positionally (28/29), one that matches times `\d\d:\d\d` (28/29), one that treats
`0x7F` as a record separator (2/29), one that reads the programme calendar off `default_flag`
(27/29) and one that counts the window exclusive of its finish (4/29).

**What the gate does not measure**, stated so nobody over-claims it:

- **Effective n is three.** The 48 oracle files are **46 revisions of one programme plus
  two single-shot programmes**; 98.3% of the oracle is one programme sampled 46 times, and
  all of it is one contract. The gate says we are **not broken**; it does not say we are
  **right**.
- **Neither of the driving test's residues in quantity** — 0.6% non-FS logic and 0.5%
  lagged relationships across the 67 distinct files. Both are Fixture-B-shaped and Fixture
  B's oracle is one flagged activity in 3,344.
- **`truncated` is never exercised**: zero external relationships in the whole real set.
- **The oracle's provenance.** Every recall figure is agreement with a mark whose age the
  file does not state, on a set where 22 of 48 files carry one byte-identical to an earlier
  revision's.

**What would reopen it is evidence, not preference:** a real export from a **second
contract** whose flagged set is fresh and whose recall lands under 95% — that would say
98.6% is a property of this contract rather than of the rule.

_Source: [Which flagged set does the ship gate score against?](docs/wayfinder/tickets/050-ship-gate-flagged-set.md), [Do we compute the critical path ourselves?](docs/wayfinder/tickets/014-compute-critical-path.md), [Does the driving test need to distinguish relationship types?](docs/wayfinder/tickets/028-driving-test-relationship-types.md), [Report `duration_working_days` on the programme calendar](docs/wayfinder/tickets/047-report-duration-working-days.md)_

---

## 9. The test corpus, the fixture generator, and CI

This section is the handover for `tools/` and `fixtures/`. Unlike the sections around it, almost
everything here **already exists on disk and runs** — the generator, the corpus, the goldens and the
round-trip harness are the only executable artefacts in the repository. The one thing in this
section that does *not* exist is CI itself. Read §9.5 before assuming a green build protects you.

Everything in `tools/` is plain Node ESM, **Node ≥ 18, zero dependencies**, run directly from the
repo root with no install step. (`tools/scan-bench/` is the single deliberate exception: it carries
`playwright` in its own `package.json` and belongs to the client-parse work, not to this section.)
There is no root `package.json`, no lockfile, and no build.

---

### 9.1 The real-export set

Two sets of real P6 exports back every format claim in this repository. **143 files in total**, and
not one of them is in the repo or ever can be.

| | Fixture A | Fixture B |
|---|---|---|
| Files | 139 (138 readable) | 4 |
| What they are | Monthly programme submissions for a live infrastructure contract, 2015–2017, across four revision lines | Four tender variants of one job, exported within a day of each other, ~99% identical |
| Distinct by SHA-256 | 67 of 138 | 4 |
| P6 versions | **6.0 × 127, 6.2 × 2, 7.0 × 4, 8.3 × 5** | 8.3 × 4 |
| Activity counts | 543 – 1,751 | 3,344 / 3,343 / 3,332 / 3,334 |
| Raw bytes | ~2.9 MB (baseline) – 5.0 MB (progressed) | 6.79 – 6.81 MB |
| gzip ratio | 6.8 – 7.7 : 1 | 7.3 – 7.5 : 1 |
| Progress | Baseline through 722-complete | 100% `TK_NotStart` on all four |

Two facts about Fixture A are load-bearing and were both discovered late. It is **not one
programme's revision series**: clustering the 67 distinct files by task-code overlap gives **six
programmes** — one of 58 files, one of 5, and four singletons — and only three carry a usable
`driving_path_flag`. And its version drift is **four versions wide, not two**, which is the evidence
behind the never-read-by-position rule. Aggregated over the 67 distinct files: **109,584 activities,
175,524 relationships**, of which `PR_FS` 174,458, `PR_SS` 641, `PR_FF` 420, `PR_SF` 5 — **0.6%
non-FS**, 845 lagged (0.5%), zero external relationships, zero multi-project files.

One of the 139 is **397,781 bytes of pure `NUL`** with a `.xer` extension and an ordinary size. It is
the origin of the `enc-zeroed-file` fixture, and MPXJ reads it as `null` with no exception and no
message.

**Where they live, and why this document does not say.** Both sets sit on a local Windows drive
outside the repository, read through WSL. The exact paths, the client, the contract numbers and the
contractor are recorded **only** in `docs/wayfinder/tickets/assets/xer-fixtures.local.md`, which is
gitignored by the `*.local.md` rule precisely so those identifiers never reach a public repo. This
section deliberately reproduces none of them. If you have inherited the repo without the drive, you
have not lost any decision — every conclusion drawn from these files travels as a measurement in
`docs/wayfinder/tickets/assets/` — but you cannot re-run a real-file measurement, and the ship gate
in §9.5 is exactly such a measurement.

**Licence and privacy status.** The files are **commercially sensitive and not licensed for
publication**. The rules, in force and enforced by `.gitignore`:

- `*.xer` is gitignored repo-wide, with one negation: `!fixtures/synthetic/**/*.xer`. Real fixtures
  are gitignored **forever** — this is not a temporary posture, and §9.5 depends on it.
- `*.local.md` is gitignored repo-wide.
- **Only measurements travel.** Counts, ratios, distributions and per-file scores under anonymised
  labels are publishable. Bytes, field values, file paths, client, contract and contractor are not.
- They must **never be uploaded to the app**. The site-wide CC-BY-4.0 content licence therefore does
  not and cannot apply to them.

A personal-data audit over all 143 files found the format's PI-bearing columns effectively empty:
`RSRC.email_addr`, `office_phone`, `other_phone`, `employee_code` and `user_id` populated in **0
rows of 0 files**; `TASKUSER` and `DOCUMENT` absent from every export; `TASK.create_user` /
`update_user` populated on 100% of 243,225 rows but carrying **exactly one distinct value per file**
in all 143; the header login is `admin` in 142 of 143. `RSRC.rsrc_name` is populated on 2,051 rows,
`task_memo` on 813 rows across 55 files, `rsrc_notes` on 133. The sensitivity is commercial, not
personal.

_Source: [Get real .xer files to work against](docs/wayfinder/tickets/001-get-real-xer-files.md)_
_Source: [Personal data in published .xer files](docs/wayfinder/tickets/013-personal-data-in-published-files.md)_
_Source: [Licensing, attribution and takedown](docs/wayfinder/tickets/003-licensing-attribution-takedown.md)_

---

### 9.2 The synthetic corpus

Because the real files can never be committed, **the synthetic corpus is the only test corpus this
project will ever have.** That is not a limitation to be worked around later; it is the premise the
generator was built on. Fork PRs get no secrets, so the corpus must need none, and it needs none.

Counted on disk today:

| Path | Contents | Committed? |
|---|---|---|
| `fixtures/synthetic/corpus/` | **29 `.xer` + 29 `.expected.json`** — 1,386,236 bytes of fixture, 709,331 bytes of golden | yes |
| `fixtures/synthetic/sparse-150.xer` (+ golden) | 150 activities, 246,648 bytes — a *rendering* fixture, not a correctness one | yes |
| `fixtures/generated/` | `perf-2k` 3,285,815 B, `perf-20k` 30,657,200 B, `perf-20k-dense` 35,009,838 B | **no** — gitignored, regenerate from seed |

The three classes are kept apart on purpose. The correctness corpus exists **to fail**; a corpus
that also had to look presentable, or to be large, would stop being one.

#### The landmine convention

Every file in `corpus/` isolates **exactly one** known trap, so a failing fixture points at one
cause. Each catalogue entry carries a `landmine` string saying *what would break without this file*,
and that string is **copied verbatim into the golden**. Two rules follow from that, and both were
learned the hard way:

1. **A `mutate` hook may bend rows, never logic.** The golden is written from the model, so a hook
   that rewrites `TASKPRED` behind the model's back makes the golden assert a driving path the file
   cannot show. Anything the walk must know about is a model option instead — `externalRels`,
   `hideRelationships`, `externalDrivingPred`, `injectCycle`, `forceDrivingBranch`, `relTypes`,
   `floatPaths`.
2. **A number in a `landmine` string must be a number its golden carries.** Nothing compares the
   two, so a stale figure ships as part of the assertion. One string was wrong for two tickets —
   `logic-no-longest-path` claimed "25 … and 7" against a golden saying 19 and 4 — and it was found
   by reading, not by a test. A mechanical sweep of every numeral in all 24 strings then in the
   catalogue found that one and no other.

The corpus deliberately keeps its hostile bytes rare and localised: high bytes appear only in the
two encoding fixtures, a lone `CR` only in `text-multiline`, and a `NUL` byte only in the two
unreadable fixtures — which are the only two files here that are *damage* rather than programme.

#### The 29 corpus fixtures

Every file also carries a `driving_path` block and a `calendars` block, because the walk and the
calendar model run on all of them; the table says what each file is *about*.

| Fixture | Shape it pins | What breaks if a parser gets it wrong |
|---|---|---|
| `enc-mojibake-0x81` | `0x81` in `POBS`, and UTF-8 bytes inside a CP1252 file (2 occurrences) | Strict CP1252 decoding **throws** — as it does on real Fixture B, which carries 31,485 of them |
| `enc-cp1252-currency` | `£ ¥ Ø` in `CURRTYPE`, plus the CP1252 `0x80–0x9F` block (em dash, curly quotes) in activity names | UTF-8 decoding mangles or throws; `0x80–0x9F` is the part of CP1252 that is *not* Latin-1 and needs a real mapping table |
| `cal-clndr-data` | The indented `CA_Base` `clndr_data`: 82 `0x7F` bytes, multi-shift days, exception **working** days, a `VIEW` node | All four shapes are real. Treat `0x7F` as structure and the calendar is unreadable |
| `cal-flat-no-0x7f` | One calendar written **twice** — indented `CA_Base`, and the flat `CA_Project` form real files carry beside it. Row 2 has **no `0x7F`**, writes shift attributes **finish-first** (`f\|12:00\|s\|8:00`), and does not pad the hour | Three ways to fail: split on `0x7F` and row 2 is one unparseable record; read attributes positionally and start/finish swap; match time with `\d\d` and every shift before 10:00 is lost. Both rows **must decode to the same calendar** |
| `cal-default-unused` | The shape both real programmes have: 3 calendars declared, all 20 activities on the one `PROJECT.clndr_id` names, `default_flag = Y` on a seven-day calendar **nothing uses** | Read `default_flag` as the programme calendar and the span converts to 100% of itself instead of 71%. `calendars_in_use` is 1 against `calendar_count` 3 |
| `cal-project-clndr-absent` | `PROJECT.clndr_id` names calendar **841**, absent from the file | `duration_working_days` must report `unavailable` **naming the id** — not fall back to `default_flag`, to the first `CALENDAR` row, or to the calendar most activities are on. All three are present and all three give a plausible number |
| `ver-60-fieldset` / `ver-83-fieldset` | The same programme under both `%F` field sets (seed 42) | Field **order** differs across seven tables, so a positional parser reads one of the pair wrong **silently, with no arity error**. Name-mapped reads must give identical stats |
| `missing-taskpred` | No `TASKPRED` table at all | Every table is optional. Open-ends and DCMA-1 must not divide by zero. Dates were scheduled *with* logic, as a real activity-list export's are |
| `missing-calendar` | No `CALENDAR` table | No shift pattern, so working-day conversion has no basis and must report `unavailable`. `day_hr_cnt` is not a fallback. `calendars_in_use` is **2 against a `calendar_count` of 0** — the rows still name calendars the file no longer carries |
| `wbs-flat` | `PROJWBS = 1` — Fixture B's real shape | `wbs_depth` is legitimately 1. Any card or chart keyed on WBS must render at depth 1 |
| `progress-none` | 100% `TK_NotStart`, no actuals | A pure baseline: a third of the derived stats are inapplicable and DCMA 11/13/14 **skip**. Skip is not fail |
| `progress-full` | Fully progressed, with actual dates | Completed activities carry **empty** float, not zero — coercing empty to zero invents critical activities |
| `float-negative` | Negative and null float in one file (deadline pulled in 60 days) | Float is an integer count of **hours** and may be negative; empty float on completed work is a different claim from zero |
| `multiproj-two-proj-id` | Activities under two distinct `TASK.proj_id` | **Must reject.** The discriminator is distinct `TASK.proj_id > 1` |
| `multiproj-baseline-rows` | Three `PROJECT` rows, one owning `proj_id` | **Must ingest.** This is why `PROJECT` row count is the *wrong* discriminator — a legal baseline-bearing export has several |
| `text-multiline` | An embedded CRLF inside `task_name`, and a lone CR in another | The format has no escaping. A naive line-splitter silently corrupts the row. Recovery rule: a line not starting with a known marker is a continuation, and the joined row must match the `%F` arity |
| `unknown-table-and-enum` | An undocumented table (`ZZUNKNOWN`), plus `TT_LOE` / `TT_WBS` / `PR_SF` / `CS_MANDFIN` / `CP_Phys` | Unknown tables and enum values are **normal** and must not error — store the raw string. `POBS` is in real files and not in Oracle's 73-table list |
| `external-relationship` | `pred_proj_id` pointing outside the file (3 rows) | A dangling predecessor is **legitimate, not corruption** |
| `enc-zeroed-file` | **397,781 bytes of pure `NUL`** — the shape one real file in 139 actually has | **Must reject as unreadable.** Every count in its golden is zero, which is exactly why no *count* can be the discriminator: a scan of all zeros is indistinguishable from a very small programme |
| `enc-truncated-export` | A perfect header, whole tables, correct arity — and **no `%E`**, tail zero-padded to a 4,096-byte block (33,422 good bytes + 3,442 `NUL`) | **Must reject as unreadable**, and this is the file that says why "no `ERMHDR`" cannot be the rule. Pair it with `missing-taskpred`: same shape, legitimate. A sparse file ends with `%E`; a truncated one does not |
| `logic-driving-branch` | Three activities with **two** driving predecessors each | The Longest Path **branches** — it is a set, not a chain. A tracer keeping one predecessor per activity yields a subset indistinguishable from a correct answer on any file where nothing ties |
| `logic-cycle` | A logic loop **on the driving chain** | The walk must terminate and report: `state: "error"`, `cycle_count: 1`, and **ingest still succeeds**. Dates are deliberately incoherent — a cyclic file was never successfully scheduled |
| `logic-external-driver` | The chain's tail is an activity in another project, absent from the file | `truncated: true`, **not** a broken chain |
| `logic-complete-no-remaining` | 100% complete | The walk spans *remaining* work, so there is none: `state: "skip"` — neither error nor zero |
| `logic-lag-nonworking` | Multi-day FS lags on a five-day calendar | The approximation knowingly accepted: lag read as elapsed hours is wrong across non-working time. The golden **names** the activity where a date-reading tracer diverges — those are allowed; any other disagreement is a bug |
| `logic-nonfs-drivers` | `SS`, `FF`, `SF` **on** the driving chain (chain runs FF FF SS FF FS FS SF+SF FS), no lags, no leads | An `EF + lag` reader **misses two activities, loses a branch and invents two**. Relationship type is the only possible cause, so this file fails any tracer that reverts. Also where the FS free-float formula was most wrong — 5 of the 8 corrected rows |
| `logic-no-longest-path` | 40 activities, behind deadline, `driving_path_flag` empty on **every** row — how most real exports arrive | There is no oracle in the file, so the golden **is** the oracle. **19 activities carry total float ≤ 0 and 4 are actually driving** — verified against the golden |
| `logic-float-path` | `float_path` / `float_path_order` populated across 6 paths | Path 1 is the **lowest-total-float** chain (9 activities at −160 h); the 10 activities flagged `driving_path_flag = Y` are **path 3**, at zero float; **the two sets share nothing**. A tracer reading `float_path = 1` as the Longest Path scores 0% recall at 0% precision. `float_path_order` is contiguous 1..n within every path — that is all this oracle validates |

**One fixture is still speculative.** `text-multiline` alone carries `"speculative": true`: the
format permits multi-line free text and **no real file in hand exercises it** — 139 real exports
contain not one embedded newline. It asserts that a parser survives and reports what it saw, not
that this is what P6 means by it. Two fixtures left this category once real exports settled them,
and in both cases the *shapes* had been guessed right while the **rule** around them was wrong.

#### `declared` vs decoded, and `same_meaning_as` / `identical_bytes`

These three golden fields will not be guessable from their names, and they carry the corpus's
sharpest calendar claims.

A `CALENDAR` row states its working time twice, and the two statements disagree in real files.
`clndr_data` is a packed blob describing the actual shift pattern; `day_hr_cnt` and `week_hr_cnt`
are plain columns *claiming* a day length and a week length. **Only the blob is trustworthy.** So
every golden calendar carries:

- **the decoded meaning** — all seven days with `works` and shifts written `HH:MM-HH:MM`,
  `hours_per_working_day`, `working_days_per_week`, `hours_per_week`, and `exceptions` in **emission
  order** (which is *not* date order) each with its decoded date, its `1899-12-30` day serial,
  whether it is **worked**, and its shifts;
- **`declared`** — `day_hr_cnt` and `week_hr_cnt` exactly as the row states them. Recorded *beside*
  the meaning so the contradiction is a fixed comparison rather than prose. On `cal-flat-no-0x7f`
  row 2 they read `null` and **56** over a pattern decoding to **8** and **40**;
- **`serialisation`** — `layout`, `shift_attrs`, `pad_hours`, `view_node`, `has_0x7f`. **None of
  this is meaning; all of it is what a parser trips over.** Recording it beside the meaning is what
  lets a golden say *these two rows differ here, here and here, and mean the same thing*;
- **`same_meaning_as`** — "this row decodes to the same calendar as that one" — with
  **`identical_bytes`** saying whether it does so in *different* bytes.

`same_meaning_as` is the one assertion no per-row comparison against intent can make, because two
rows can each match their own golden while a parser still reads different calendars out of them. It
is the only place in the corpus where **a decode is scored against another decode** rather than
against the generator. The corpus carries exactly two pairs, and they are complementary:

| Pair | `identical_bytes` | Why it exists |
|---|---|---|
| `cal-flat-no-0x7f` 6601 → 6600 | `false` | Same calendar, **different serialisations**. The whole reason the file exists |
| `cal-default-unused` 6602 → 6600 | `true` | A byte-identical project copy — the case `cal-flat-no-0x7f` cannot show |

Verified across the 29 goldens today: **55 calendars, 385 day entries of which 327 are worked, and
633 exceptions of which 3 are working days.** Naming the file `cal-flat-no-0x7f` is a mild trap —
the *file* contains 50 `0x7F` bytes; it is the **second calendar row** that has none.

_Source: [Get a large synthetic fixture for perf work](docs/wayfinder/tickets/012-large-synthetic-fixture.md)_
_Source: [Fix the generator's Longest Path flag and add tracer landmines](docs/wayfinder/tickets/022-generator-longest-path-and-landmines.md)_
_Source: [Correct the clndr_data rules and calendar goldens against real P6 evidence](docs/wayfinder/tickets/038-calendar-shapes-and-0x7f.md)_
_Source: [The goldens assert calendar meaning in prose only](docs/wayfinder/tickets/043-calendar-golden-block.md)_
_Source: [Correct logic-float-path to what P6's Multiple Float Paths output actually is](docs/wayfinder/tickets/039-float-path-semantics.md)_
_Source: [A zeroed .xer is a real shape — what does the scan do with it?](docs/wayfinder/tickets/040-zeroed-xer-file.md)_

---

### 9.3 The generator

```bash
node tools/fixture-gen/generate.mjs              # corpus + sparse-150 (the committed set)
node tools/fixture-gen/generate.mjs --list       # what exists, and why
node tools/fixture-gen/generate.mjs --only perf-20k
node tools/fixture-gen/generate.mjs --all        # perf files too (~69 MB on disk)

node tools/fixture-gen/measure.mjs <file.xer>    # bytes, gzip, parse time, heap, json sizes
node tools/fixture-gen/measure.mjs --json <file.xer>
node tools/fixture-gen/measure.mjs --verify      # round-trip the corpus against its goldens
```

Those are **all** the flags. `generate.mjs` has no `--help` and does not validate its arguments: an
unrecognised flag is silently ignored and the tool **regenerates the committed set**. That is
harmless only because of the determinism guarantee below — but it means a typo produces a full
rewrite rather than an error.

| File | What it holds |
|---|---|
| `catalogue.mjs` | The fixture list — what exists and why each one exists |
| `generate.mjs` | CLI; writes the `.xer` **and** its `.expected.json` golden |
| `measure.mjs` | Measurement harness and corpus round-trip. **Not the product parser** |
| `lib/schema.mjs` | The `%F` field-name contracts for P6 6.0 and 8.3, transcribed from real exports |
| `lib/programme.mjs` | Synthesises WBS, activities, logic, progress, codes, resources; runs the CPM and the driving-path walk |
| `lib/tables.mjs` | Model → `%R` rows |
| `lib/emit.mjs` | Streaming writer: `ERMHDR`, `%T`/`%F`/`%R`, `%E`, CRLF, CP1252 |
| `lib/calendar.mjs` | Working-time model, the packed `clndr_data` blob, and the single statement of how a row writes a working hour as an instant |
| `lib/cp1252.mjs` | Output encoding, including deliberately invalid bytes |
| `lib/rng.mjs` | Seeded PRNG |

**Determinism.** Each fixture's seed is the first four bytes of `SHA-256(fixture name)`, so a fixture
is a pure function of its catalogue entry and its own name. Two consequences: regenerating gives
byte-identical output, and **adding a fixture never reshuffles another**. Verified for this
document — the committed corpus was regenerated and every file hashed identical. Generation is fast
enough to make *regenerate and diff* a viable CI check: under 40 ms for the whole committed corpus,
a few hundred ms for `perf-20k`.

**What it models.** A genuine **CPM forward and backward pass**, so early/late dates, total float,
free float and the critical path mean something — random dates would give a meaningless float
histogram and a DCMA score that measures nothing. Then a **backward walk for the Longest Path**,
from which `driving_path_flag` is written and from nothing else. Free float is computed **per
relationship type** (`FS: succ.ES − pred.EF − lag`; `SS: succ.ES − pred.ES − lag`;
`FF: succ.EF − pred.EF − lag`; `SF: succ.EF − pred.ES − lag`), minimised over successors and clamped
at zero. Calendars are packed as real `clndr_data`, and `buildClndrData` records what it packed *as
it packs it* (`meaningOf`), keyed by the blob it returns — so a golden records intent without ever
parsing the generator's own output.

**What it does not model.** It does not model P6. `lib/schema.mjs` carries field names and their
order, transcribed verbatim from real exports — those are format facts — but **no value from any
source programme is reproduced anywhere**: every id, name, date and quantity is generated. It emits
no three-shift days, no `CA_Rsrc` calendars, no shift finishing at `00:00`, and no ragged working
week. Every activity is laid out on **one** five-day calendar whatever `TASK.clndr_id` says, which
is why the corpus's ten-and-ten calendar split is a shape **no real export produced** — distinct
`TASK.clndr_id` is 1 on 14 of 14 real files. `cal-default-unused` is the only corpus file shaped
like a real programme.

**The independence rule, which is the single most important thing in this section.** A golden is
written from what the generator **intended to emit — never from parsing the result.** A golden
produced by our own parser would assert nothing: it would agree with the parser by construction and
fail only when the parser was self-inconsistent. A parser has to agree with the golden; the golden
does not have to agree with a parser.

The rule generalises: **the two sides of any assertion must share no code.** Where the repo has
broken that, it has paid for it, and where it holds it the assertion is worth something:

- Both driving-path walks come from the model; neither reads the `.xer` back in.
- `measure.mjs`'s `clndr_data` decoder **shares not one line** with the `buildClndrData` that wrote
  the bytes. That is the only reason decoding a blob and comparing it to the recorded meaning means
  anything.
- `duration_working_days` is computed twice by two implementations sharing no line: `generate.mjs`
  walks `Date`s against the packed week, `measure.mjs` walks `1899-12-30` day serials against the
  decoded one.

Concretely: **the same person must not write both sides of a golden in one pass.** The failure mode
is not carelessness, it is a shared assumption — a rule written out twice, in the emitter and in the
reader, and wrong identically in both copies. That happened here: the rule for how a zero-duration
row writes its instant lived in two places and was wrong in both for six tickets, surviving every
regeneration in between because nothing read the emitted dates back.

_Source: [Get a large synthetic fixture for perf work](docs/wayfinder/tickets/012-large-synthetic-fixture.md)_
_Source: [The generator computes free float with the FS formula for every relationship type](docs/wayfinder/tickets/032-generator-free-float-by-type.md)_
_Source: [Report `duration_working_days` on the programme calendar](docs/wayfinder/tickets/047-report-duration-working-days.md)_

---

### 9.4 The goldens and `--verify`

```bash
node tools/fixture-gen/measure.mjs --verify
```

**Current state, run for this document: `29/29 corpus fixtures round-trip`.** Exit code is 0 on a
clean run and 1 on any failure, so it is directly usable as a CI step.

#### What a golden asserts

`<fixture>.expected.json` carries the fixture's own `description` and `landmine` verbatim, the P6
version, the generator seed and options, the emitted file's byte count and SHA-256, row counts per
table, a `calendars` block (§9.2), an `assertions` block, a `driving_path` block, an `ingest`
verdict, and — for files of 60 activities or fewer, which is all of them — a **full name-mapped dump
of every activity**. That dump is the strongest golden available: it is what catches a parser
reading the right column by luck. The two corrupt fixtures additionally carry a `readability` block
measured **off the bytes** rather than written from intent, because there is nothing in a corrupt
file to have intended.

The `driving_path` block records the walk **twice**, and the difference between them is the point:

| Field | What it is |
|---|---|
| `members` | The truth — the driving set the generator walked over its own logic network. `driving_path_flag` in the `.xer` is written from this, so it plays the oracle role P6's own flag plays on a real file |
| `as_read_from_the_file` | What a tracer can reach **from the emitted bytes alone** — per-type demand scored against the successor timestamp it constrains, lag as elapsed hours, absent relationships absent, external predecessors unresolvable |
| `as_read_from_the_file.why` | Every activity where the two walks disagree, and which cause did it |
| `float_based_tracer` | What `total_float_hr_cnt <= 0` would mark instead. **This is not the Longest Path** and the corpus exists to say so |

Score a tracer against `as_read_from_the_file`; the gap to `members` is the approximation knowingly
accepted. Measured across the goldens today: **97.0% recall (191 of 197) and 97.9% precision (191 of
195 marked)**, with **22 of the 28** files that have a readable walk reproduced exactly on all six
fields — membership, `state`, `branches`, `truncated`, `cycle_count`, `path_continuous`.
`enc-zeroed-file` is the twenty-ninth and has no readable walk at all. **10 activities across six
files** differ: 6 missed, 4 marked in error, and two of the six files differ in *structure* rather
than membership. Every one is stated rather than tuned away.

#### What `--verify` actually reads back

This list matters, because the repo's recurring defect is **a value written into every golden that
nothing ever reads**. It has been found four times: `driving_path_flag`, `free_float_hr_cnt`,
`float_path`, and the activity dates. In each case the failing files were already in the corpus with
the true answer beside them, and what was missing was a reader.

`verifyCorpus` re-reads the emitted bytes and compares, per fixture: P6 version; row counts for every
table; activity count; `calendars_in_use`; data date; null-float count; external relationship count;
WBS node count and depth; status mix; the **`driving_path_flag` set by name**; `float_path` 1
membership, `float_path_order` contiguity within every path, and path 1's disjointness from the
flagged set; **`free_float_hr_cnt` by name** against the dump; **`early_start_date`,
`early_end_date`, `act_start_date` and `act_end_date` by name** against the dump; the decoded
`clndr_data` of every calendar against the recorded meaning, including `same_meaning_as`;
`duration_working_days` in full — day count, the calendar it converted on, and the activity share;
tokenizer problems (allowed only where the golden says so); and the **readability guard** checked
off the bytes rather than off the tokenizer, because `enc-truncated-export` reports zero tokenizer
problems and correct arity on every row.

One assertion is golden-internal rather than a byte comparison: a fixture whose `misses` or
`marks_in_error` is non-empty while `why` is empty **fails**. That is the corpus's central honesty
claim enforced — a disagreement must be *explained*. It does not require every named activity to
carry its own entry: 4 of the 10 appear in `why` by name, the other six being downstream of a
divergence named elsewhere on the same file.

#### How to regenerate, and how to read a golden move

```bash
node tools/fixture-gen/generate.mjs     # rewrites every committed .xer and .expected.json
node tools/fixture-gen/measure.mjs --verify
```

`--verify` passing after a regeneration proves only that the generator agrees with itself. **The
diff is the evidence.** Read it against these rules:

- **A `.xer` byte that moved is a claim about the fixture.** If a change was meant to touch only
  goldens or only the reader, and an `.xer` moved, that is a regression until explained. Precedents
  are precise: correcting the free-float formula moved bytes on exactly four corpus files and
  nowhere else, and every byte delta was accounted for by the digits of the changed numbers.
- **A golden that moved only in a prose field is not a regression.** `driving_path.definition` and
  `as_read_from_the_file.note` describe the rule; 22 of 25 goldens once moved in those two strings
  alone.
- **A `landmine` string that moved must be checked against the golden beside it** (§9.2 rule 2).
- **A golden that grew a block is expected once; a golden that lost one fails.** A golden without a
  `calendars` block now reports `CALENDAR rows 2 != golden calendars 0` rather than skipping.
- **Legitimate moves are announced by the thing that caused them.** Every ticket that moved this
  corpus recorded which files moved and by how many bytes before it moved them.

The strongest signal available is a **mutation score**: break a rule deliberately and count how many
fixtures notice. These are the recorded measurements, each against the corpus size at the time —
note the two decoder rows were measured at 27 fixtures and the free-float row at 29:

| Deliberate defect | Score | What it reports |
|---|---|---|
| Free float reverted to the FS formula for every type | **24/29** | `free_float_hr_cnt` wrong on 8 rows across 4 files |
| Readable walk reverted to `EF + lag` for every type | **22/24** (as measured) | 3 activities marked in error, 2 missed |
| Shift attributes read **positionally** | **26/27** | `cal-flat-no-0x7f` decodes to **−8 hours** a day, and the two rows stop matching |
| Time matched `\d\d:\d\d`, unpadded hour dropped | **26/27** | The same calendar works **4 hours** a day and its exception working day comes back *not worked* |
| `0x7F 0x7F` treated as a record separator | **2/27** | **Every** calendar fails to decode; the only survivors are the two files with no `CALENDAR` table |
| Zero-duration instant reverted | **28/29** | Activity dates disagree with the golden dump. The rule it protects is a `TT_FinMile` sitting at its driver's finish instant on **98.3%** of live rows (n = 1,879), against a `TT_Task`'s 44.6% — see §8.14 |

Two of those fail on **one file**, and that is the design rather than a weakness:
`cal-flat-no-0x7f` exists precisely because `cal-clndr-data` parses identically under the wrong rule
and could never have failed it.

_Source: [Fix the generator's Longest Path flag and add tracer landmines](docs/wayfinder/tickets/022-generator-longest-path-and-landmines.md)_
_Source: [Bring the corpus's readable walk onto the per-type driving test](docs/wayfinder/tickets/031-readable-walk-per-type.md)_
_Source: [The generator computes free float with the FS formula for every relationship type](docs/wayfinder/tickets/032-generator-free-float-by-type.md)_
_Source: [The goldens assert calendar meaning in prose only](docs/wayfinder/tickets/043-calendar-golden-block.md)_

---

### 9.5 CI

> **CI is fully decided and entirely unbuilt.** Verified on disk: there is **no `.git` directory**,
> **no `.github/workflows`**, and no root `package.json`. Nothing described below runs today. This
> is the intended state — no product code is written while the map is open — but do not inherit this
> repo believing a build protects you.

**Provider: GitHub Actions.** No deploy step — Vercel's Git integration owns deploys. Cost is $0 on
a public repo.

The toolchain those three jobs run was chosen at integration rather than left to whoever writes the
first workflow — see §10.12. In short: **Biome** for lint and format, **`tsc --noEmit`** for
typecheck, **Vitest** for tests.

**What runs on a push / PR**, in the order it was decided:

1. **Lint, typecheck, test.**
2. **Golden-file tests against the synthetic corpus**, on **every PR including forks**. This is
   `tools/fixture-gen/measure.mjs --verify` and it is the reason the corpus exists. Fork PRs get no
   secrets and no env vars, so this job must need none — and needs none.
3. **A full local stack, stood up on every PR**: `docker compose` bringing up Postgres, the Neon
   HTTP proxy (community image, **pinned by digest**), and MinIO; then migrate, seed, smoke query.
   An all-local stack is the only stack a fork PR can ever be tested against. It catches migration
   drift, seed drift, `derived.json` contract drift and a rotted proxy pin together. The job
   **starts as migrate-only and grows as the parser and derive land**.
4. **An `edge-contract` suite** on the same job: assert what the presign signs, execute the
   presigned PUT into MinIO, HEAD the object back, apply the bucket document to MinIO, and issue a
   real `OPTIONS` preflight whose `Access-Control-Request-Headers` list is **derived from the
   presign's own output rather than from a constant**. This makes the presign's signed header set
   and the bucket's `AllowedHeaders` formally one decision: **changing either alone is a CI
   failure.**
5. **A scheduled workflow**, separate from the PR job, POSTing `/api/sweep` with a bearer secret
   every **15 minutes** — because Vercel Hobby cron allows one invocation per day and a more
   frequent expression fails at deployment. Actions' scheduler is best-effort, so 15 minutes is the
   honest cadence rather than 5.

**Branch protection** is a **required GitHub status check on `main`** — free on a public repo, on
the CI job above. It is not a deploy gate, and cannot be: on Hobby, production deploys on push to
`main` with nothing between "build succeeded" and "this is public", so there is no promotion gate to
hang a check on. The honest residue is recorded rather than hidden: **the operator is the repo admin
and can push past their own branch protection.** It blocks a contributor and reminds the maintainer,
which is the truth about a one-person repo.

**What a red build means**, by job:

| Red | Meaning |
|---|---|
| Corpus round-trip | The parser disagrees with a committed golden. This is the one component where a silent regression corrupts every row it touches |
| Stack-up | Migration drift, seed drift, `derived.json` contract drift, or a rotted proxy digest pin |
| `edge-contract` | The presign and the bucket CORS policy have been changed apart. One test failure instead of two unrelated incidents six weeks apart |
| Scheduled sweep | **This is also the alert channel.** The run exits non-zero on breach and GitHub mails the repo owner free. It is the estate's only outbound mail path — the app sends no email at all |

One standing constraint on everything CI prints: **Actions logs on a public repo are
world-readable**, so jobs print assertions, never object URLs or response bodies.

**The ship gate is not a CI job and structurally cannot be one.** It scores the driving-path tracer
against the **real exports**, which are gitignored forever and never enter CI. Five of its six
clauses are therefore a **maintainer-run measurement**, run locally against the drive described in
§9.1:

> Ship only if, pooled over every real export carrying `driving_path_flag` on more than one row —
> 48 files today — the tracer reaches **≥ 95%** of the flagged activities that are not
> `TK_Complete`, at **≥ 90% precision** against every flagged row, **breaking no chain P6 keeps
> whole**; with no file below **90% precision** and none below **90% recall** unless it carries an
> out-of-sequence flagged pair; **and the synthetic corpus green.**

Only that last clause is CI-shaped, and it is satisfied by `--verify` returning 29/29. The gate's
recorded verdict is **Pass** — pooled recall 98.6% (3,400 of 3,447), pooled precision 99.9% (3,400
of 3,402), minimum per-file precision 97.1% with 47 of 48 files at exactly 100%, and a chain broken
on 0 of 48. Two cautions travel with it: **what passed is the rule, not an implementation** — the
product tracer is not written, and the gate must be re-run against it before ship, on those numbers,
with no re-litigating of the thresholds; and the oracle is thin, being 46 revisions of one programme
plus two single-shot programmes, so its **effective n is three**.

_Source: [Stack, hosting and auth provider](docs/wayfinder/tickets/010-stack-hosting-auth.md)_
_Source: [Upload and ingest pipeline](docs/wayfinder/tickets/011-upload-ingest-pipeline.md)_
_Source: [Local development and contributor onboarding](docs/wayfinder/tickets/018-local-dev-and-onboarding.md)_
_Source: [Verifying the production-only edges](docs/wayfinder/tickets/024-verifying-production-only-edges.md)_
_Source: [Which flagged set does the ship gate score against?](docs/wayfinder/tickets/050-ship-gate-flagged-set.md)_

---

### 9.6 Known residue

Verification work that is open. **This is a build backlog, not a list of blockers** — nothing here
stops the parser being written, and every item is a known-unasserted claim with its risk named. Each
was filed deliberately rather than discovered.

**Build it before you trust the net**

- **CI does not exist.** No git repository, no workflow, no `package.json`. Every claim in §9.5 is a
  decision, not a running job. Risk: the corpus protects nothing until something runs it.
- **The `dev` fixture class is decided and unbuilt** — a fourth catalogue of ~40 plausible
  programmes, uncommitted like `perf-*`, to fill the browse facets. Risk: a fresh clone shows an
  empty shelf, which is an ordering fact rather than a defect.
- **The product parser is not written.** `measure.mjs` is explicitly a throwaway sizing harness, not
  it. Risk: everything the corpus asserts is asserted against a tool that will be deleted.

**Claims no fixture can currently fail**

- **`hours_per_working_day: null`** — the ragged-week branch, where a calendar's worked days are not
  all the same length. Verified: **0 of 55** corpus calendars produce one. Risk: the branch is
  asserted by nothing, which is the exact defect the calendar block was filed to fix, one level
  smaller. Ticket [048](docs/wayfinder/tickets/048-elapsed-calendar-semantics.md)'s fixture would close
  it.
- **`duration_working_days: { state: "error" }`** — the named calendar exists but will not decode.
  Verified: the four `unavailable` fixtures cover three distinct reasons and none produces `error`.
  Risk: `--verify` compares this branch on `state` alone, so a decoder that reports the wrong
  diagnostic is invisible. Filed as
  [059](docs/wayfinder/tickets/059-undecodable-calendar-fixture.md).
- **No corpus *programme* contains an exception working day inside its own window.** Three exist
  across 633 exceptions, none where a span conversion would meet one. Risk: the working-day count
  never exercises the shape it would most plausibly get wrong. Filed as
  [060](docs/wayfinder/tickets/060-exception-working-day-in-window.md).
- **The `PR_FF` milestone-guard clause has never executed on the corpus** — 25 `PR_FF`
  relationships, exactly one with a milestone on a side, on an activity no walk reaches. Removing it
  regenerates a byte-identical corpus. Risk: it is live on the *real* files, rescuing 117 floored
  candidates across 62 of 67 exports, so the corpus cannot see the thing the real set depends on.

**Decoder rules known wrong or missing**

- **A shift finishing at `00:00` must run to the end of the day.** Verified absent from
  `measure.mjs`: no midnight rule exists, so `shiftHours` returns 0 where P6 means 24 — on the
  calendar shape appearing in 136 of 138 real calendar-bearing files. Filed as
  [051](docs/wayfinder/tickets/051-unparsed-clndr-shapes.md) /
  [052](docs/wayfinder/tickets/052-end-of-day-shift-rule.md).
- **An empty shift slot must be a *skip*, not an error.** Verified at `measure.mjs:172`, which still
  throws `carries no s/f pair`. One real export writes `(0||2()())` eleven times, using empty slots
  to mean a **non-working day**. Risk: two of 563 real calendar rows cannot be read at all.
- **Three-shift days and `CA_Rsrc` calendars are unemitted and unobserved.** `buildClndrData` accepts
  any number of shifts and both golden and decoder handle them; no fixture asks. Risk: low, and a
  one-line catalogue change when one does.

**Claims about P6 that only P6 can settle**

- **No fixture has ever been opened in P6.** They have been read end to end by **MPXJ 16.6.0** — an
  independent third-party implementation — with zero failures, agreeing with the goldens exactly on
  20 of the 24 files that existed at the time and differing only where a landmine says it should.
  **A reader accepting a file is not the importer accepting it.** Filed as
  [041](docs/wayfinder/tickets/041-p6-importer-acceptance.md), which nothing waits on.
- **That MPXJ run is stale in two ways.** Five fixtures added since — `cal-flat-no-0x7f`,
  `enc-zeroed-file`, `enc-truncated-export`, `cal-default-unused`, `cal-project-clndr-absent` — were
  never in it; and the bytes that were in it have since moved — **370 date values across 23 files**,
  with no table, column, arity or field width changed. What it proved about the *shape* of these
  files still holds; what it proved about these exact bytes no longer has them.
- **`PR_SF` free float is unmeasured against real data.** The entire 143-file corpus contains **one**
  SF relationship and it cannot be isolated. Risk: the SF row of the per-type table is reasoned, not
  measured.
- **The v24/v25 field sets are unread**, because no v24/v25 file exists in either set. Risk: the
  never-by-position rule is evidenced four versions wide (6.0, 6.2, 7.0, 8.3) rather than across the
  whole supported range.

**Shapes the corpus asserts that no real file has produced**

- **The ten-and-ten calendar split.** Every corpus programme but `cal-default-unused` puts half its
  activities on a five-day calendar and half on a seven-day one; distinct `TASK.clndr_id` is **1 on
  14 of 14** real files. It stays only because it is the only thing exercising
  `activity_share_pct` at all. Risk: `activity_share_pct` is validated against a fiction.
- **`text-multiline` is speculative** — 139 real exports contain not one embedded newline. Risk:
  none to correctness; it is a defensive fixture, honestly labelled.
- **`span_calendar_days` is a difference and `duration_working_days` is a count with both ends in
  it**, so on a calendar working every day the second is the first plus one. **Settled and unbuilt:**
  the field becomes an inclusive count and is renamed `duration_calendar_days`, taking
  `derived.json` to v4 (§3.4). `measure.mjs` must emit `(finish − start) / 86400000 + 1`, each
  golden's `assertions` block gains the field, and the mutation *span counted exclusive of its
  finish* — which scores **29/29 today**, because no golden carries the field at all — must be made
  to fail **28 of 29**. No `.xer` byte moves.

**Provisioning steps nothing can assert**

- **Branch protection on `main`** and **GitHub Actions failure notifications** are GitHub account
  settings outside the estate. Risk: the alert channel and the merge gate are both unverifiable by
  any test, and the operator can bypass the latter.

_Source: [Verify the synthetic fixtures import into P6](docs/wayfinder/tickets/021-verify-fixtures-in-p6.md)_
_Source: [What does `f|00:00|s|00:00` mean?](docs/wayfinder/tickets/048-elapsed-calendar-semantics.md)_
_Source: [Does P6's importer accept the fixtures? (needs a P6 licence — nothing waits on it)](docs/wayfinder/tickets/041-p6-importer-acceptance.md)_
_Source: [What calendar is `duration_working_days` measured on?](docs/wayfinder/tickets/045-duration-working-days-calendar.md)_
_Source: [028's `FF` milestone guard has lost its reason](docs/wayfinder/tickets/054-ff-milestone-guard.md)_

---

## 10. Decisions taken while assembling this spec

Writing the spec surfaced ten questions no ticket had settled. Nine are purely technical and were
decided here rather than left as holes, under the effort's standing delegation and its one
tiebreak: **cheap or free, and easy to use.** Each is marked **overturnable** — none is load-bearing
on evidence, and any can be flipped in one line without moving another decision.

The tenth needs a human and is stated as the one open question.

### 10.1 The upload routes

Three entry points existed in the ingest design and none had a URL. The closed URL set omitted
them, and the auth middleware matcher covered no upload path.

| Route | Intent | Auth |
|---|---|---|
| `/upload` | a new programme, no lineage | signed in |
| `/p/{slug}/upload` | a new revision of a programme you own | signed in, owner |
| `/p/{slug}/fork` | a fork of any published programme | signed in |

One route per intent, each carrying its context in the path rather than in a query parameter —
which keeps them out of the facet query space the crawl surface disallows.

All three join the `clerkMiddleware` matcher, so a crawler is redirected exactly as it is on `/me`
and no `noindex` header is needed. They are the fourth, fifth and sixth authenticated prefixes.

**Overturnable.** Nothing else reads these paths.

### 10.2 Runtime and toolchain

| | Choice | Why |
|---|---|---|
| Package manager | **pnpm 9**, pinned via `packageManager` in `package.json` | fastest cold install on CI, free, first-class on Vercel |
| Node | **22 LTS**, pinned via `engines` | Next.js 16 needs ≥ 20.9; 22 is the current LTS and Vercel's default |
| Function runtime | **Node.js, not Edge**, everywhere | ingest needs Node built-ins for gzip and parsing; the driver works on both; Edge buys nothing for ISR pages, and the whole cost model was measured on Node |

**Overturnable**, with one caveat: moving to the Edge runtime would invalidate the Active CPU
figures in §4, which is the meter closest to firing.

### 10.3 `*.vercel.app` → apex redirect status

**308**, matching the `www` redirect. Permanent and method-preserving. The hostname decision named
the redirect but not its code, and using anything weaker on one of two identical redirects would be
an accident rather than a distinction.

**Overturnable.**

### 10.4 Blob `Content-Type` and encoding

Every object is stored gzipped. The `Content-Type` describes the object *inside* the encoding.

| Key | `Content-Type` | `Content-Encoding` |
|---|---|---|
| `p/{pid}/r/{rid}/original.xer.gz` | `text/plain; charset=windows-1252` | `gzip` |
| `p/{pid}/r/{rid}/activities.json.gz` | `application/json` | `gzip` |
| `p/{pid}/r/{rid}/derived.v{N}.json` | `application/json` | `gzip` |

`windows-1252` because that is what a `.xer` actually is — the format research established the
encoding is CP1252 and lossy, and serving it as `utf-8` would mis-render the very bytes the
disclosure panel is about.

Both headers join the presign's **signed** header set, since `content-type` is already in the
bucket's CORS `AllowedHeaders`.

**One cosmetic inconsistency is accepted rather than fixed:** `derived.v{N}.json` is stored gzipped
but its key carries no `.gz`, unlike the other two. The key was fixed by the contract, the version
stamp is its identity, and renaming a decided path to tidy a suffix is not worth a contract
amendment. Encoding is a header, not a filename.

**Overturnable.**

### 10.5 The canary's blob key

The production-edge canary is built by the same key-construction code as every real revision — that
identity is the point of it, since a canary written by different code tests different code. So a
**reserved programme uuid is minted alongside the reserved revision uuid**, and the key is
`p/{CANARY_PROGRAMME_UUID}/r/{CANARY_REVISION_UUID}/original.xer.gz` with the template unchanged.

Both uuids are committed constants, not generated per environment, so the sweep can assert the key
without reading it back from configuration.

**Overturnable.**

### 10.6 Vote counter column types

Both denormalised counters are `integer not null default 0`:

```sql
programme.vote_count            integer not null default 0
app_user.uploader_vote_count    integer not null default 0
```

Maintained on write, as decided. `integer` rather than `bigint` because two billion upvotes on one
programme is not the failure mode this site has.

**Overturnable.**

### 10.7 `/contributors` row limit

The leaderboard is **one page, top 100**, by the decided ranking rule, with a plain line stating how
many contributors exist in total. No pagination and no query parameters — which is what the closed
URL set requires of it.

100 rows is one cached query at any catalogue size, and a leaderboard's tail carries no information
at launch. If the tail ever matters, it is a paginated route and a fresh decision.

**Overturnable.**

### 10.8 `.env.example`

No ticket named an environment variable beyond the S3 endpoint, so the repo had no authoritative key
list. This is it — the file is committed with working local-dev defaults, and every production value
comes from the provisioning runbook in §4.

```bash
# --- site -------------------------------------------------------------------
SITE_ORIGIN=http://localhost:3000

# --- database ---------------------------------------------------------------
DATABASE_URL=postgres://postgres:postgres@localhost:5432/xerhero

# --- blob storage (S3-compatible; MinIO locally, R2 in production) ----------
S3_ENDPOINT=http://localhost:9000
S3_REGION=auto
S3_BUCKET=xerhero
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
BLOB_PUBLIC_ORIGIN=http://localhost:9000/xerhero

# --- auth (Clerk) -----------------------------------------------------------
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# --- abuse control (Cloudflare Turnstile, /report only) ---------------------
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# --- operator ---------------------------------------------------------------
OPS_ALLOWED_USER_IDS=
```

The committed MinIO root credentials are the decided dev default and are not secrets — they are
identical on every contributor's machine by design.

**Overturnable**, name by name.

### 10.9 `logic.longest_path`'s duration

The contract names a "duration in days" and never defines it. It is:

```jsonc
"longest_path": { "duration_calendar_days": 1180, … }
```

**Calendar days, counted inclusively**, from the earliest `early_start_date` on the chain to the
latest `early_end_date` on it — the same convention and the same name as `time.duration_calendar_days`,
one field along.

Not working days. A chain crosses many activities, and a working-day count needs *one* calendar to
be measured on. The programme-calendar rule that solves this for `time.duration_working_days`
solves it for the programme's whole window, not for an arbitrary subset of its activities, so
importing it here would assert more than the evidence supports.

**Overturnable**, but the rename is not: two adjacent fields both called a duration in days must
not use two conventions. That was exactly the defect corrected in the contract's v4.

### 10.10 The DCMA 6 and 8 hour-to-day conversion

Checks 6 (high float) and 8 (high duration) have a 44-**day** threshold, while the fields they read
are in hours. The hard-coded 352 hours was removed and no replacement was recorded.

**Convert on the programme calendar** — `PROJECT.clndr_id`, decoded to `hours_per_working_day` —
falling back to a documented fixed **8 hours** where that calendar will not decode or reports no
hours. Which of the two was used is recorded on the check.

This is the same calendar rule `time.duration_working_days` already uses, so the spec carries one
calendar-selection rule rather than two. It is right on all the real evidence: distinct
`TASK.clndr_id` is 1 on 14 of 14 real files, so an activity's own calendar and the programme's are
the same calendar on every real programme measured. The fallback is safe for the same reason the
original constant was tolerable — 44 of 54 real calendars decode to an eight-hour day, and the ten
that do not are a stock elapsed calendar no activity is assigned to.

**Overturnable** toward the stricter reading (each activity converted on its own calendar), which
costs a per-activity calendar lookup and changes no number on any file yet observed.

### 10.11 The `/report` mailbox

The one question here that needed a human, answered by the operator on 2026-08-08:
**`carlos.greblo@gmail.com`**. It costs nothing, needs no provider and adds no secret to the
estate. Full treatment, including the `report@` alias that would replace it and what replacing it
would cost, is §7.19.

### 10.12 Lint, format, typecheck, test

CI was decided down to *what runs on a push* and no tool was ever named — no config file,
`tsconfig.json` or root `package.json` exists on disk. Whoever wrote the first workflow would have
chosen by default, so it is chosen here instead.

| Job | Tool | Command | Why |
|---|---|---|---|
| Lint + format | **Biome** | `pnpm biome ci .` | one tool and one config for both jobs, no plugin ecosystem to maintain, Rust-fast on a solo-maintainer repo. Replaces the ESLint + Prettier pair outright. |
| Typecheck | **`tsc --noEmit`** | `pnpm tsc --noEmit` | the only real answer; TypeScript is already the language |
| Test | **Vitest** | `pnpm vitest run` | ESM-native, no transform config, and the parser is isomorphic TypeScript with no Node built-ins, so the same tests run unchanged |
| Corpus verification | the harness itself | `node tools/fixture-gen/measure.mjs --verify` | already exists and already returns 29/29 |

One GitHub Actions workflow runs all four on push and pull request. Biome's formatter is the
formatter — there is no separate Prettier step and no format-on-commit hook, because `biome ci`
fails the build on a formatting diff and that is sufficient.

`tools/fixture-gen` stays **dependency-free plain Node ESM**, as it already is. It is not migrated
into the app's toolchain: it runs on `node` with no build step, which is what makes it usable as an
independent measurement instrument against the app's own parser.

**Overturnable**, tool by tool.

### 10.13 Nothing else is open

Every question this spec raised is now answered. The remaining work is building it, and the jobs
that are not decisions are in [the build backlog](docs/build-backlog.md).
