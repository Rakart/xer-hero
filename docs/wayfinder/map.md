---
id: 000
title: xer-hero build spec
type: map
status: open
---

# xer-hero build spec

## Destination

> **REACHED 2026-08-08.** The spec is [`README.md`](../../README.md) — the repo root rather than
> `docs/spec.md`, so that the repository's front page *is* the specification for as long as there is
> no product. Ten sections, ~7,500 lines, every claim linking the ticket that settled it, plus a
> tenth section recording the ten gaps closed while assembling it. **Zero open questions.**
>
> The map closed with **51 decisions** over 61 tickets. Ten remaining tickets were ruled out of
> scope in one act — see the dated entry at the end of **Out of scope** — and collected as jobs in
> [the build backlog](../build-backlog.md). Only one of them, provisioning, gates a launch.
>
> This map is now the audit trail rather than the work queue. It is not resumed; work past this
> point is the build.

`docs/spec.md` — a spec buildable without further decisions: v1 scope, the `.xer`
domain model and schema, storage and its cost model, auth, the storefront and
detail-page UX, and the stack. No product code is written while working this map;
the pull to start building is the signal the map is done.

## Notes

**Domain.** Oracle Primavera P6 project programmes, exchanged as `.xer` files —
a tab-delimited dump of P6's internal tables. Users are construction and
infrastructure planners. Terms of art (programme, activity, WBS, logic, float,
data date, longest path, calendar) are the users' own; use them, don't invent
synonyms. Keep the domain model in `docs/domain-model.md` as it firms up.

**Skills every session should consult.** `/grilling` and `/domain-modeling` are
the default working mode for a `grilling` ticket. `/research` for `research`
tickets. `/prototype` for `prototype` tickets. `/dataviz` before designing any
chart that lands on a card or the detail page. Vercel's `vercel-storage`,
`nextjs` and `auth` skills for the stack ticket.

**Standing decisions from the charting session.** These are scope constraints,
not tickets — treat them as settled unless a ticket surfaces evidence against one:

- **Public by default.** Upload is publish. No private tier, no organisations, no
  per-row access control in v1. Blobs are public and CDN-cacheable. **Amended
  2026-08-08** by [Personal data in published .xer files](tickets/013-personal-data-in-published-files.md):
  public and cacheable but **not indexable** — `original.xer.gz` carries
  `X-Robots-Tag: noindex, noarchive`, because it is the one object holding personal
  data and a `.xer` is plain text a crawler will happily index. **Amended again
  2026-08-08** by [What tooling does the operator need to run a takedown?](tickets/017-operator-takedown-tooling.md):
  public also has to mean *un*-publishable, and 004's year-long immutable cache meant
  it was not. `original.xer.gz` drops to a **1-hour TTL** and every takedown ends in a
  **verified CDN purge**. That object now carries three special properties — noindex,
  short TTL, and 30-day Class B quarantine — which is one rule about the PI-bearing
  blob rather than three exceptions.
- **No warranty, opt-in, at the user's own risk.** This is a free, open-source
  platform for sharing data; the maintainer guarantees nothing. Terms carry a
  **service-level** as-is disclaimer, not only Apache-2.0's source-level one — no
  warranty of accuracy, availability, fitness, or that any file is safe to rely on.
  Nothing on the site is ever worded as a guarantee: the pre-publish panel warns
  but does not certify, DCMA is computed but not endorsed, `noindex` is mitigation
  but not protection. This rules out screening promises, verification badges and
  any "checked" state anywhere in the effort. It does **not** waive statutory
  duties — an erasure request still gets a Class B takedown.
- **Hybrid ingest.** Parse on upload into: a small indexed Postgres row per
  programme, plus a `derived.json` of precomputed stats — that pair powers the
  storefront. The original `.xer` lives in blob storage and is fetched only when a
  programme is opened. **Amended 2026-08-07** by
  [What does storage actually cost?](tickets/004-storage-cost-model.md): the
  "fuller `parsed.json`" this decision originally named is **not stored**, because
  gzipped it measures the same size as the `.xer` it was parsed from. Its
  replacement is an **`activities.json`** — a columnar cut of the tables a detail
  page needs, 185–277 KB gzipped against the whole file's 400–870 KB.
- **No time-scaled Gantt in v1.** The project page is charts and tables. A Gantt
  is fog, not scope.
- **Versions and fork lineage from day one.** A programme is a series of
  revisions; a fork keeps a visible link to its parent. This is schema-critical
  and cannot be retrofitted cheaply.
- **Public repo, one hosted instance.** Managed platform services are fair game;
  there is no self-hosting promise, so no portability tax.
- **Launch stock is authored sector templates**, not real jobs. Zero legal risk,
  narrower usefulness — accepted trade.

**No public route reads the session on the server (2026-08-08,
[035](tickets/035-caching-per-viewer-state.md)).** Every public page renders one artefact — the
signed-out render — and everything that depends on who is looking arrives in the browser from one
request. Enforced by the `clerkMiddleware` matcher, which does not cover any public path, so
`auth()` structurally cannot work on one. Any future public surface inherits this without
re-deciding it, and a new public route that forgets it is a CI failure rather than a bill.

**Plan, don't do.** Tickets resolve decisions. The one exception is
`type: task`, which does manual work only where a decision is blocked without it.

**Technical decisions are delegated (2026-08-08).** The dev has handed the purely
technical questions to the agent, with one standing preference to decide them by:
**cheap or free, and easy to use**. So a `grilling` ticket whose question is technical
runs **AFK** — the agent decides under that preference, states the decision plainly, and
the dev may overturn any of them later. What still needs the human is anything the agent
physically cannot do (a P6 licence, a hosted account, a card) and anything that is a
matter of the dev's own taste rather than a technical trade. Tickets may be worked
**in parallel**, one ticket per agent session; the agent that resolves a ticket writes
only that ticket's file and its assets, and the map and any cross-ticket amendments are
written afterwards by the integrating session, so concurrent sessions never contend on
`map.md`.

## Decisions so far

<!-- one line per closed ticket -->

- [Get real .xer files to work against](tickets/001-get-real-xer-files.md) — 139
  real `.xer` files secured: one live contract programme, monthly revisions over
  two years, P6 6.0 **and** 8.3. Positional field parsing is unsafe across
  versions, encoding is CP1252, files compress ~7:1, `TASKACTV` outnumbers `TASK`
  ~14:1, and duplicate uploads are normal. Sensitive — gitignored, measurements
  only. **Extended 2026-08-07** with a second real set (**Fixture B**) — four tender
  variants of one job, P6 8.3, 3,344 activities, 6.8 MB each. These are **fork
  siblings**, not revisions, and they differ from Fixture A in every way that
  matters: `PROJWBS = 1` (no WBS at all), 100% not-started, code density 6:1 rather
  than 14:1. Having two real programmes that fail in opposite directions is what
  made the derived contract testable. **Public docs say Fixture A / Fixture B only**
  — client, contract and file paths live solely in the gitignored register.
  **Extended 2026-08-08** by
  [Does the tracer seed where P6 seeds?](tickets/044-tracer-seed-tie-break.md), the first ticket to
  read all 139 at once, with three corrections of fact. **Four export versions, not two** — 6.0 ×
  127, 6.2 × 2, 7.0 × 4, 8.3 × 5 — so this bullet undercounts the very drift its own headline rule
  exists for. **67 distinct files by SHA-256** of the 138 readable, which puts a number on
  *duplicate uploads are normal*. And it is **not one programme's revision series**: eleven distinct
  activity counts, 543 to 1,751, say several distinct programmes sit in the tree beside the monthly
  revisions — so every measurement in this effort scored on "Fixture A" has been one revision of one
  of them, and the set is a **population** rather than a series. That last one is what lets
  [050](tickets/050-ship-gate-flagged-set.md) ask whether the ship gate runs over a file or a corpus.
- [How is a .xer file structured?](tickets/002-xer-file-structure.md) — format
  charted against Oracle's v24/v25 guides and both fixture versions
  ([long form](tickets/assets/xer-format.md)). Oracle documents field mappings,
  **not** the grammar. Rule: map `%F` names → indices per table per file, never by
  position. `clndr_data` decoded (parenthesised nodes, `0x7F` layout only, epoch
  1899-12-30). `driving_path_flag` is Longest Path, not Critical; data date is
  `PROJECT.last_recalc_date`. Write our own TS parser — xerparser is GPL-3.0,
  MPXJ is LGPL/Java. **Amended 2026-08-08** by
  [Verify the synthetic fixtures import into P6](tickets/021-verify-fixtures-in-p6.md): this
  ticket's headline rule survives and its **gotcha 4 is false**. `0x7F` was charted as a
  *separator* — *"structural inside `clndr_data`, not text"* — from base calendars, which do
  carry it. Real **`CA_Project` calendars in the same files carry zero `0x7F` bytes**, are one
  flat unindented string, and parse to the same tree, so `0x7F` is **formatting and only the
  parentheses carry structure**. The same evidence extends this ticket's own never-by-position
  rule one level down, where nothing had looked: **shift attributes are order-free** (`f|12:00|s|8:00`
  occurs beside `s|08:00|f|16:00`) and **hours are not zero-padded** (`s|8:00`), so the attrs
  group is a key-value bag read exactly the way `%F` taught. `day_hr_cnt`/`week_hr_cnt` join the
  list of fields that cannot be trusted — empty on some real calendars, and contradicting the day
  pattern where populated. Its licence survey also gains its practical corollary: **MPXJ is fine
  as a dev-harness oracle** precisely because the decision was to write our own parser, so reading
  a file with it links nothing into the product. Corrections filed as
  [038](tickets/038-calendar-shapes-and-0x7f.md).
- [The derived.json contract](tickets/006-derived-json-contract.md) — contract fixed
  ([long form](tickets/assets/derived-json-contract.md)). `derived.json` is the
  **detail-page** payload; the grid renders from Postgres alone with zero blob reads.
  Quality ships as **DCMA 14-point, checks passed / applicable** (1–10 computed,
  11–14 skipped without a baseline), with exact counts plus 50 capped exemplars.
  Row = ~11 typed columns + JSONB `card`. Versioned blob path, lazy recompute on
  open, explicit backfill only for card columns. Bare scalars where a stat always
  computes, tagged `{state, reason}` where it can fail; **ingest never fails on a
  stat error**. ~40–60 KB typical, 150 KB ceiling. **Amended 2026-08-07** by
  [Domain model and schema](tickets/005-domain-model-and-schema.md): the Tier 1 table
  splits into `programme` + `revision`, `sector` moves to `programme`, stored blob URLs
  are dropped, and a capped **WBS top-level summary** is added. **Amended 2026-08-08** by
  [Do we compute the critical path ourselves?](tickets/014-compute-critical-path.md):
  `derived.json` goes to **v2** — `logic.longest_path` stops being usually-unavailable and
  becomes a computed value with provenance, joined by `logic.cycle_count` and
  `logic.path_continuous`; DCMA 12 stays `skip` and `card` gains nothing, so no backfill.
  **Amended 2026-08-08** by
  [The goldens assert calendar meaning in prose only](tickets/043-calendar-golden-block.md):
  `time.duration_working_days` keeps its `unavailable` tag and **loses its stated reason**, which had
  expired in both halves — the shapes are verified (021) and `clndr_data` decodes, all 50 calendars
  in the corpus. Decoding cleanly turns out **not to be sufficient**: the conversion needs *one*
  calendar and a programme has several, the same span landing **37–41% apart** depending which is
  asked, and `default_flag` marks what new activities inherit rather than what a programme is
  measured on. The tag stands on calendar ambiguity instead, and what shape the stat should have is
  [its own ticket](tickets/045-duration-working-days-calendar.md). **Amended 2026-08-08** by that
  ticket: **the tag comes off and `derived.json` goes to v3**, because the obstacle above was measured
  on the wrong field. Distinct `TASK.clndr_id` is **1 on 14 of 14 real files** and equals
  `PROJECT.clndr_id` on 14 of 14, while `default_flag` is absent from 12 of the 14; the 37–41% spread
  is the corpus's own ten-and-ten split and no real programme splits at all. The field becomes
  `{ days, calendar: { clndr_id, name, working_days_per_week }, activity_share_pct }` or
  `{state, reason}`, following `logic.longest_path` exactly, and carries **no hours** — a stock
  elapsed calendar in 10 of the 14 files decodes to seven working days of zero hours, and a
  working-day span never divides by a day length. `card` and the typed columns are untouched, so **no
  backfill**, and the field grows by ~160 bytes.
- [Licensing, attribution and takedown](tickets/003-licensing-attribution-takedown.md) —
  **code Apache-2.0, uploaded programmes CC-BY 4.0**, fixed site-wide with no
  per-upload choice, so the fork button never reasons about compatibility. Uploader
  identity is a **pseudonym snapshotted per programme** — Google is auth, never the
  public name — which is what lets account deletion erase the personal data while
  uploads stay published. One checkbox per upload (rights, no confidential data,
  irrevocable CC-BY) with `terms_version` snapshotted against versioned in-repo legal
  pages. **Amended 2026-08-07** by
  [Stack, hosting and auth provider](tickets/010-stack-hosting-auth.md): the privacy
  policy's disclosure — "the Google account id, email and chosen display name are
  stored" — is no longer true and becomes a *stronger* claim, because Clerk holds the
  Google identity and the site stores no email; takedown correspondence is a Clerk
  lookup. Attribution is rendered by the site from the full ancestry chain; **the
  `.xer` is never modified** — the format has no comment mechanism. Takedown splits by
  reason: **Class A** voluntary withdrawal tombstones one programme and leaves forks
  intact, **Class B** rights/PI complaints **cascade down the fork subtree**. **Bytes
  hard-delete, rows never do.** Exact content-hash blocks a re-upload from becoming a
  new root — it becomes a fork instead. Nine schema fields fixed; two questions
  flagged for a lawyer. **Amended 2026-08-08** by
  [Personal data in published .xer files](tickets/013-personal-data-in-published-files.md):
  the privacy policy gains a **third-party personal data** section (files publish as
  uploaded; a person named in someone else's upload may request removal; the remedy
  is removal of the revision, never editing of the file), the upload checkbox's
  wording hardens to say the file may name people and nothing is stripped — so the
  warranty and the pre-publish panel become the same claim under one `terms_version`
  — and a **third lawyer question** joins the two: whether an uploader warranty plus
  an advisory panel is a lawful basis for publishing third-party personal data, and
  whether the site is controller or joint controller at publication. Class B itself
  is **unchanged**, and absorbs third-party erasure with no new class or field.
  **Amended 2026-08-08** by
  [Credit, upvotes and the contributor leaderboard](tickets/016-credit-upvotes-leaderboard.md):
  "a tombstoned programme stops contributing to standing" is **superseded by a mechanism** —
  standing no longer flows through Programmes at all, so an **eligibility gate** (zero published
  non-tombstoned Programmes delists you) is what makes takedown reach the board. Class B's
  vote-voiding is unchanged and becomes the whole of the manual anti-gaming lever.
  **Amended 2026-08-08** by [The signed-in user's own space](tickets/023-signed-in-users-own-space.md):
  **"the Handle is chosen at first upload" becomes generated at first authenticated write and
  *confirmed* at first upload**, because a bookmark and a vote both need an `app_user` row and this
  ticket's rule minted one only at publication. Pseudonymity is unaffected — a generated Handle is
  invisible until publication, votes being private in attribution and bookmarks private throughout.
  Account deletion, which this ticket promised in the privacy policy and left without a mechanism,
  gains a surface (`/me/account`, reusing 017's typed-confirmation guard rails), an order (our rows
  first, then Clerk — the reversible half commits first) and a failure story. This ticket's
  "withdraw first, then delete" position is rendered in the confirmation copy rather than
  discovered at deletion time, and the privacy policy gains bookmarks and votes. **Amended
  2026-08-08** by [Google OAuth in production](tickets/027-google-oauth-in-production.md): the
  privacy policy takes a **fourth amendment, and the first one with an external enforcer**. Google
  requires it to *"Disclose how your app accesses, uses, stores, or shares Google user data"* and to
  be reachable on the verified domain without login, as a condition of the consent screen naming the
  site — so where this ticket, 010, 013 and 017 all revised the policy by internal decision, it now
  has a reader who is not us. Pseudonymity itself is **confirmed rather than changed**: everything
  Google returns stops at Clerk, and erasure is still 010's two acts. The gap exposed is elsewhere —
  this ticket versioned the legal *texts* as `docs/legal/terms-v1.md` and `docs/legal/privacy-v1.md`
  and **nothing has ever fixed the routes that serve them**, which Google's brand verification is
  the first thing in the effort to require. **Amended 2026-08-08** by
  [The site's static pages](tickets/030-static-pages.md): this ticket's closing line — that drafting
  the two documents is *"build work, not a decision"* — had two decisions inside it, and its texts
  had a worse problem than being unrendered. **`docs/legal/` has never existed**, so `terms_version`
  points at nothing an uploader could be shown. The routes are `/terms` and `/privacy` for the
  current text, with **every superseded version addressable** at `/terms/v{n}` and `/privacy/v{n}` —
  because this ticket made the snapshot *"the only thing that matters if an upload is ever
  disputed"*, and a snapshot resolving only to a git blame is unreadable by the person who agreed to
  it. **One version number covers both documents**, so a bump ships both files even when one is
  byte-identical: `terms_version` is one column, and 013 had already fused the checkbox wording and
  the privacy section into a single claim under it. **A shipped file is never edited, not for
  substance and not for a typo** — repo history is this ticket's stated audit trail, and an in-place
  edit is exactly the case history cannot distinguish, so a typo costs a version. Its requirement
  that analytics be *"named rather than glossed"* is met with the cheapest honest name — **none**.
  The three lawyer questions are unchanged and unanswered, but each now points at a numbered section
  rather than at an intention. **Amended 2026-08-08** by
  [The site's own crawl surface](tickets/033-site-crawl-surface.md): the tombstone **stays at its URL
  forever and stops being findable**. This ticket kept the row for one stated reason — *"deleting the
  row would punch a hole in the ancestry chain"* — which makes the tombstone a device for keeping an
  inbound link from rotting, never a device for being discovered, so `noindex, follow` costs nothing
  it asked for. It applies to **both classes uniformly**: a Class A owner who withdrew did not
  withdraw in order to stay in Google, and branching a head tag on `removal_class` puts one more
  thing in the takedown path to get right. Its rule that **title and uploader stay visible** is
  unchanged on the page and narrowed off it. Its CC-BY-4.0 site-wide decision also settles a question
  nobody had asked: **there is no AI-crawler block and no per-agent `robots.txt` rules**, because a
  licence to reuse with attribution and a file saying *anyone may reuse this except you* cannot both
  be true.
- [What does storage actually cost?](tickets/004-storage-cost-model.md) — **the
  premise was wrong: there is no dangerous egress cost**
  ([working](tickets/assets/storage-cost-model.md)). At 10,000 programmes and busy
  traffic the whole blob bill is **under $1/month on every provider priced**, S3
  included; a gzipped `.xer` is ~600 KB, so 1 TB of egress is ~1.75M downloads/month.
  **The cliff is the platform floor** — $0/month until the database may no longer
  sleep or the host's free plan no longer fits, then **~$20–45/month, flat in corpus
  size**. **R2** for blobs ($0.23/mo at 10k programmes, zero egress structurally),
  **Neon** for Postgres (Supabase Free *pauses* after a week idle — disqualifying).
  Postgres is a rounding error at ~150 MB. Serve gzipped (7–8:1 measured, moves the
  cliff 8×) and store forks as full copies. Headline finding: **a full `parsed.json`
  gzips no smaller than the `.xer` itself**, so it is dropped for a 185–277 KB
  `activities.json` — this amended the hybrid-ingest note above. **Amended 2026-08-08** by
  [Verifying the production-only edges](tickets/024-verifying-production-only-edges.md): the TTL
  split introduced by 017 now has something asserting it in production, at $0 — and the cost model
  acquires an asterisk it did not have. **`r2.dev` cannot be purged** (it is not in the operator's
  zone), so 017's step 3 requires an R2 custom domain, which requires a **registered domain** — the
  first line item in this effort that is not free. It is ~$10/year rather than a platform floor, so
  the "$0 until the database may no longer sleep" finding stands in substance, but the left-hand
  side is no longer exactly zero and the choice was never actually made. Filed as
  [The blob host and the site's domain](tickets/025-blob-host-and-domain.md). **Amended
  2026-08-08** by that ticket: the asterisk gets a number. **$0/month plus ~$11/year** —
  Cloudflare Registrar sells at cost, so a `.com` is Verisign's registry price ($10.26/yr, rising
  7% to $10.97 on 1 November 2026) plus ICANN's transaction fee, about **$0.93 a month**. The
  headline survives in substance and needs one correction of *kind* rather than size: this line is
  **flat in every variable** — corpus, traffic, users, plan — so it is better described as a
  subscription to the project existing than as a floor, and neither the cliff nor the $20–45 step
  moves. R2 stays inside its free tier at launch and under $1/month at 10,000 programmes, exactly as
  costed. The change that is real is that the estate **stops being free and becomes cheap**, on the
  card 018 already established R2 requires — same account, same payment method, one more line.

- [Domain model and schema](tickets/005-domain-model-and-schema.md) — **Programme is
  identity, Revision is content** ([glossary](../domain-model.md)); the derived
  contract's flat table carried `series_id` *and* `parent_id`, so it was really a
  revision. The **fork edge points at a Revision** (parent programme denormalised) —
  that pointer is what keeps 003's revision-granular Class B cascade from tombstoning a
  fork taken from a clean revision. Cascade is **operator-scoped, broad by default,
  unconditional below a tainted fork**. **Strict tree, no merge**; parent pointer plus
  recursive CTE, `root_programme_id` denormalised for fork families. Forks are made by
  **uploading**, inherit metadata as **prefilled defaults** and carry a new required
  `change_note` (CC-BY "indicate changes"). **Owner-only revisions**, everyone else
  forks; Handles are **unique and never reassigned** via `reserved_handle`. Stats on
  `revision`, `current_revision_id` on `programme`, grid still one query. Blobs
  **id-addressed** — content addressing collides with hard-delete — so a tombstone is
  one prefix delete. **WBS is not relational.** `slug` unique and **immutable**;
  `pending` reserved in the Revision status enum so ingest can go async without a
  migration — **and 010 spends that reservation immediately: ingest is async from day
  one.** **Amended 2026-08-07** by
  [Stack, hosting and auth provider](tickets/010-stack-hosting-auth.md): `app_user`
  drops `google_sub` and `email` for a single `clerk_user_id`, because an email never
  written cannot survive in a Neon PITR snapshot. Client-generatable `uuid` ids turn
  out to be load-bearing beyond the schema — they make the circular
  `programme ↔ revision` insert a *batch*, so Neon's HTTP driver suffices and no
  WebSocket pool is needed inside a Function. **Amended again 2026-08-07** by
  [Upload and ingest pipeline](tickets/011-upload-ingest-pipeline.md), which spends the
  `pending` reservation and so must describe the interval before bytes are parsed:
  `is_root_rev` plus a partial unique index on `content_hash`, `content_hash` nullable
  until publish, a `failed` status with `ingest_attempts` and `failure_reason`, a new
  `upload_intent` table, and `current_revision_id` deferred to publish time.
  **Amended 2026-08-08** by
  [Credit, upvotes and the contributor leaderboard](tickets/016-credit-upvotes-leaderboard.md):
  this ticket's "no columns added here for it" no longer holds — the uploader became a second
  votable object, so `programme.vote_count`, a per-account uploader counter, `programme_vote`,
  `uploader_vote` (both `on delete set null`, rows kept so `count(*)` stays reconcilable) and a
  private `bookmark` table (`on delete cascade`, no counter) all land. The Revision stays
  unvotable — this ticket's identity/content split doing its job. **Amended 2026-08-08** by
  [Operating and observing ingest](tickets/019-ingest-observability.md): two tables and one column —
  `sweep_run` (append-only history and heartbeat) and `alarm_state` (four seeded rows of mutable
  suppression state, kept separate precisely because conflating history with current state means
  reading the last row to write the next), plus `revision.failure_detail`. This ticket's
  **id-addressed blobs** paid again: deterministic keys are what make a retry a plain overwrite
  and keep the purge list a constant three URLs per revision. **Amended 2026-08-08** by
  [The signed-in user's own space](tickets/023-signed-in-users-own-space.md): two DDL corrections
  and one lifecycle nobody had written. Seven `not null` constraints drop on `revision` so a
  `pending` row is insertable, and `upload_intent.user_id` gains `on delete cascade`. The lifecycle
  is the substantive part: **`app_user` is created on the first authenticated write — vote,
  bookmark or presign — not at first upload**, with a generated Handle, because `display_name` is
  `not null unique` and 003 only ever minted one at publication. Reads create nothing. Everything
  else this ticket fixed for account deletion holds unchanged, and the `reserved_handle`
  never-reassign rule stays unconditional even for a generated Handle that was never published — a
  wasted row is cheaper than a conditional. **Amended 2026-08-08** by
  [Verifying the production-only edges](tickets/024-verifying-production-only-edges.md): one row, in
  one migration — a fifth `alarm_state` row, `edge_drift`. No table, no column, and
  `sweep_run.breaches` being jsonb means a fifth rule key needs nothing there. This ticket's
  **id-addressed blobs** pay once more: the verification canary is a **reserved uuid rather than a
  reserved prefix**, so it is built by the same key-construction code as every real revision and
  needs no branch in the presign — and because it has no Revision row, it is invisible to 017's
  purge list, to the reconciler and to all four of 019's rules without anything learning to ignore
  it.

- [The storefront card and browse grid](tickets/007-storefront-card-and-grid.md) — **there
  is no card; the shelf is a row list**
  ([prototype](tickets/assets/prototypes/007-storefront-grid.html)). Four layouts were built
  against 40 programmes; the row won both jobs — scanning and clicking — so the grid needs
  only one density. A **shared calendar axis is rejected**: vintage is not a browsing signal
  and a short job smears to nothing, so each row's window curve gets a **local axis** and
  compares *shape*. Twelve facts per row, and **nothing in a row may flow** — rev, P6 and the
  float percentages are fixed slots the header labels, because a fact landing at a different
  x on every row reads as noise. Activity count is a **fixed 10-slot track** with empty slots
  drawn. **Baseline is cut from the shelf entirely** — load-bearing inside the derived
  contract, meaningless to a browser. **Fork count came off the row**, withdrawing the demand
  for a fork counter; `forked from X` stays. The grid's graphics put ~200 bytes in `card`
  (normalised `s_curve`, `float_mix`, `wbs_depth`, `issues_count`), making it a payload under
  the explicit-backfill rule. The **planned-vs-actual S-curve planners expect cannot be
  drawn** from v1 data — the same missing baseline tables that skip DCMA 11/13/14 — so
  progress is a marker on one curve, never a second line. **Amended 2026-08-08** by
  [Credit, upvotes and the contributor leaderboard](tickets/016-credit-upvotes-leaderboard.md):
  the row gains a **second control**, a private bookmark in a fixed slot beside the upvote pill.
  The flow rule survives — it banned facts landing at a different x per row, and a fixed x is
  what it asks for — and the one-query rule survives too, the per-viewer join now returning
  vote-flag and bookmark-flag together. The debts this ticket recorded are paid, and its
  **fork-counter withdrawal stands for the grid**: a fork count exists only on the contributor
  page, live-joined, because the denormalisation this ticket refused is not a cost one
  single-contributor page pays. **Amended 2026-08-08** by
  [The signed-in user's own space](tickets/023-signed-in-users-own-space.md): the row is reused on
  the bookmark and vote lists and deliberately **not** on the owner's upload index, which sharpens
  what the row is for. It exists to be compared down a column, and nobody compares their own
  uploads to each other; a `pending` Programme would also render as nine empty slots, which this
  ticket established "reads as missing data". So `/me` is one line per Programme and the row keeps
  its job. Un-bookmarking leaves the row in place, greyed, until reload. **Amended 2026-08-08** by
  [How is a public page with per-viewer state cached?](tickets/035-caching-per-viewer-state.md):
  **the one-query rule is restored rather than bent**. 016's amendment put the per-viewer join inside
  the grid's request; it moves back off, so what the shelf renders is this ticket's one query plus
  009's facet-count query, which 009 had already ruled a separate query. And this ticket's no-flow
  rule turns out to be **what makes the split safe rather than what threatens it**: it banned a fact
  landing at a different x on every row, 009 already drew the pill unpressed in the signed-out render,
  and 016 gave the bookmark identical behaviour — so both controls exist in the cached HTML at their
  fixed x and the viewer response changes only a fill. The design the ticket feared, a control
  popping in late, was forbidden two tickets before anyone needed it. The residue is honest and
  small: between paint and the response a signed-in viewer's own votes and bookmarks read as unset,
  which is a wrong picture rather than a moving one.

- [Browse, search, filter and ranking](tickets/009-browse-search-ranking.md) — **the shelf
  is the homepage, ordered newest-Programme-first, and that order is frozen** — never
  vote-weighted, because a popularity ratchet makes the front page unexplainable. Quality
  was rejected as the default on the fixtures' own evidence: **DCMA inverts**, failing the
  real live contract (69% negative float) and passing templates built to pass, so it ships
  as an opt-in sort labelled literally, on the **ratio** with `checks_applicable desc` as
  tiebreak. **Four facets, and none of them is a new column** — sector, size band
  (500/2,000/5,000), P6 version (a *can I use this* filter), and progressed. Has-resources
  was cut on measurement: 86.4% vs 83.4% across the fixtures discriminates nothing.
  **No tags in v1**, which corrects a contradiction in 005's own prose. Search is
  **Postgres FTS over title + description only** — a search service would be a second
  platform floor under 004's cost model — with a `pg_trgm` zero-result fallback; relevance
  takes over when `q` is set. **Activity-name search stays dead** at 1.9B rows. Query-param
  URLs with canonicalisation rules, **numbered pages at 25** because the shelf is how a
  crawler reaches every `/p/{slug}`, **live conjunctive facet counts** (zeros disabled) so a
  sparse launch catalogue never dead-ends, and a **top filter bar** rather than a left rail —
  the rail would compress exactly the drawn columns 007 called a relief rule. **Amended
  2026-08-08** by
  [Credit, upvotes and the contributor leaderboard](tickets/016-credit-upvotes-leaderboard.md),
  the ticket this one was coupled to without a blocking edge: **they agree votes never feed the
  default sort**, `sort=votes` reads the delivered `programme.vote_count`, and the contributor
  page this ticket demanded is now specified. The row gains a bookmark control on the
  signed-out rules this ticket already fixed, and the leaderboard is a **footer-linked page** —
  this ticket's rejection of a left rail was cited directly. One sharp edge: **self-votes are
  permitted**, so every Programme may carry one vote cast by its own owner. **Amended 2026-08-08**
  by [The signed-in user's own space](tickets/023-signed-in-users-own-space.md): the header gains
  its first addition since this ticket fixed it — a signed-in cluster (`Upload · {Handle}`) and a
  one-line notice that renders **only for a signed-in viewer**, so the public cacheable path is
  untouched. The left-rail rejection and the permanent strap stand, and `?page=N` at 25 is reused
  unchanged. This ticket's "disabled, not hidden" reasoning is borrowed for un-bookmarking, and its
  live conjunctive facet counts are explicitly **not** carried onto the private lists — counts earn
  their place because a sparse catalogue dead-ends, and a list you assembled yourself has no dead
  ends. **Amended 2026-08-08** by [The site's static pages](tickets/030-static-pages.md): `/` gains
  its first prose, and it survives on this ticket's own reasoning rather than despite it. The
  dismissible intro band was rejected for **state** — *"it costs a state flag and produces two
  different first screens"* — and a lede keyed on the **canonical bare URL** has none: it renders at
  `/`, never at `/?sector=rail`, and is identical for every viewer signed in or out, which is the
  same mechanism this ticket used for relevance-only-while-`q` and for pagination chrome that does
  not render when page 1 holds everything. 007's relief rule is likewise untouched, because it bans
  stealing **width** from the drawn columns and a lede costs **height** — about two rows above the
  fold, on one URL. The frozen newest-first order, the four facets, the canonicalisation rules and
  the left-rail rejection are all unchanged, and **the strap does not grow**: it renders on
  `/p/{slug}` too, where a sign-in disclosure has no business. What the lede pays is the cost this
  ticket recorded as unpaid in its own §1 — *"a cold visitor sees twelve columns of planner jargon
  and no statement of what the site is"* — in 95 words, of which the third paragraph is the
  Google-required purpose statement nothing in the closed set had ever written. The shelf also gains
  a **site-wide footer** below the grid, which this ticket never specified and 016 assumed. **Amended
  2026-08-08** by [The site's own crawl surface](tickets/033-site-crawl-surface.md): this ticket's §7
  canonicalisation rules described the URL the site *emits*; they now have the arriving-request half
  they never had, and the facets and the numbered pages are split apart. `sector`, `size`, `p6`,
  `progressed`, `q` and `sort` are **`Disallow`ed in `robots.txt`**; **`page` is deliberately not**.
  The tension is resolved by this ticket's own words rather than against them — *"the shelf is how a
  crawler reaches `/p/{slug}` pages at all"* was always about the **unfiltered** sequence, and a
  filter is by construction a subset of a page that is already crawlable, so disallowing `?sector=`
  removes nothing from the crawl graph. What lost is a facet space of **over 30,000 states before
  pagination** and unbounded once `q` is free text — and the cost is this ticket's own: its **live
  conjunctive facet counts are two Postgres queries per shelf render**, and the facet space is exactly
  where a crawler would have spent all of them. Its pagination decision gains a concrete crawl
  contract: `/?page=N` **self-canonicalises including the page number**, `/?page=1` **308s to `/`**,
  and a page past the last **404s**. It is also **demoted from being load-bearing**: the sitemap lists
  every programme directly, so the numbered sequence becomes the second crawl path rather than the
  only one. `/sector/{code}`, deferred here to the discoverability patch, is now the **only** shape a
  crawlable sector view could take and is filed as
  [its own ticket](tickets/034-sector-landing-pages.md). **Amended 2026-08-08** by that ticket: this
  ticket's rejection of path-segment schemes **splits, and only one half dies**. *"`/sector/rail` has
  no natural expression for rail and highways"* survives and becomes the route's shape — the path
  route is **single-valued only**, so it is an **entry point rather than a filter state**. *"a
  `/sector/rail` + `/?sector=rail` pair is duplicate content"* is dead, killed by 033: Google clusters
  pages it has crawled and one member of that pair is never fetched. The shape this ticket named — *"a
  rewrite onto the canonical query URL"* — therefore **inverts**. Its **page size of 25 becomes the
  unit of the trigger**, and its **live conjunctive facet counts turn out to be the estate's only
  visitor-independent measuring instrument** — they measure the *catalogue* rather than the traffic,
  which is the one class of fact 030 left intact, so the trigger is printed on the front page before
  anything is built. Its four facets gain a rule for which of them could ever earn a path route —
  closed set we seed, single-valued, a noun somebody would type, stable for a year — and **sector is
  the only one that scores on all four**: size bands would freeze a band edge this ticket has already
  moved once, `p6` is an open set the uploaded files decide, and `progressed` is a boolean. **Amended
  2026-08-08** by
  [How is a public page with per-viewer state cached?](tickets/035-caching-per-viewer-state.md): its
  query-parameter URL scheme, chosen for shareability and multi-select, decides the shelf's rendering
  strategy — *"`searchParams` is a Request-time API… Using it will opt the page into dynamic rendering
  at request time"* — so `/`, every facet variant and `/?page=N` are **dynamic and cannot have a
  TTL**, and neither can `/u/{handle}`, which paginates on the same mechanism. Its two Postgres
  queries are wrapped at 60 s instead, so the render is CPU-only and the database sees at most one
  shelf query a minute at any traffic. Its signed-out rule — *"renders the upvote pill unpressed and
  routes a click to sign-in"* — turns out to be the load-bearing sentence of that entire ticket,
  because it is what makes the cached artefact a complete and clickable page rather than a shell. Its
  frozen newest-first order is what makes a 60-second shelf lag move exactly one row.

- [Stack, hosting and auth provider](tickets/010-stack-hosting-auth.md) — **Next.js on
  Vercel Hobby, Clerk, Drizzle over `neon-http`, no charting library, isomorphic parser.**
  Two measured limits decided most of it, neither of them in the ticket's own list.
  **Vercel's request body cap is 4.5 MB against 4.8 and 6.8 MB fixtures**, so uploads
  *must* go browser → R2 by presigned PUT, gzipped client-side; and **Hobby's meter is
  Active CPU (4 CPU-hr/mo)**, not duration or memory. 004's Hobby-ToS flag is **cleared** —
  Vercel defines commercial as financial gain, which this has none of — so the $0 floor
  holds and Pro is a $20 step taken on a *trigger* (log drains, second seat, CPU), not a
  date. Auth was **not decided on cost** (Clerk and Better Auth are both $0; Auth.js is
  maintenance-only and its own team points at Better Auth; Supabase Auth's pause takes auth
  down with it): Clerk wins because **the Google identity never enters our schema**, so
  003's erasure position stops being a routine we have to write correctly — under 005 as
  written, Neon's PITR would keep a "deleted" email restorable for days. Charts are
  **hand-rolled SVG, no library** — `/dataviz` files a sparkline as a *stat tile, not a
  chart* — with the detail-page library deliberately left to 008. **The parser is
  isomorphic TS** so 013 can preview in the browser, but a client parse is *advisory
  only*. CI's binding constraint: **real fixtures are gitignored forever, so the synthetic
  corpus is the only test corpus that will ever exist**. **Amended 2026-08-07** by
  [Upload and ingest pipeline](tickets/011-upload-ingest-pipeline.md): the cron sweep this
  ticket specified **cannot run on Vercel Hobby**, which allows one cron run per day ±59
  minutes and *fails deployment* on anything more frequent — the sweep moves to a GitHub
  Actions schedule, and schedule drift becomes a fifth named Pro trigger. **Amended
  2026-08-08** by [Local development and contributor onboarding](tickets/018-local-dev-and-onboarding.md):
  this ticket's one explicitly unresolved fact is answered — **R2 does require a payment
  method**, even within the free tier, so a card gates the upload path for anyone using
  real R2. Clerk needs none and its free tier moved to **50,000 monthly-retained users**
  in February 2026, widening the $0 headroom costed here. CI grows from lint, typecheck
  and unit tests to a job that stands the whole local stack up — which is what makes this
  ticket's *fork PRs get CI only, with no env vars* posture testable rather than merely
  safe. **Amended 2026-08-08** by
  [Operating and observing ingest](tickets/019-ingest-observability.md): the **log-drain trigger
  is examined and explicitly does not fire** — observability is built out of Postgres rows rather
  than log lines, so the 1-hour window is a debugging inconvenience and not a forced $20. The five
  triggers stand unchanged and gain no sixth. This ticket's GitHub Actions schedule acquires a
  second job it was not chosen for: **it is the only thing in the estate that can mail the
  operator**, which is what lets this ticket's removal of email survive contact with a system that
  has to raise alarms. **Amended 2026-08-08** by
  [The signed-in user's own space](tickets/023-signed-in-users-own-space.md): **Clerk's
  `<UserButton>` is refused** — the vendor's own drop-in renders the Google profile image, quietly
  reintroducing the `<img src>` personal data this ticket removed when it ruled out avatars in v1.
  `<SignedIn>`/`<SignedOut>` plus a plain Handle link is the whole implementation. This ticket's
  "deletion collapses to two acts" gains the mechanism, order and failure story it was left
  without, and a Clerk webhook is explicitly declined — `user.created` would cost a public
  endpoint, a signing secret, svix and retry semantics to move a row creation off the path that
  already needs it. **Amended 2026-08-08** by
  [Verifying the production-only edges](tickets/024-verifying-production-only-edges.md): the five
  Pro triggers are examined and **deliberately left unwatched**. A trigger is a budget decision
  rather than a correctness event; three of the five are things the operator chooses, Active CPU is
  the only one that arrives unbidden and Vercel already mails the account owner about it, and
  watching any of them would put a Vercel API token in the app to read a number the vendor already
  sends. The **CPU trigger does not fire** for this work either — the added sweep work is network
  wait, which the Active CPU meter does not bill. This ticket's Hobby deployment model is also
  priced for the first time: the build step runs **before the deployment exists** and there is no
  promotion gate between a green build and production, so "deploy-blocking" cannot mean a Vercel
  check without either Pro's promotion controls or abandoning Git-integration deploys for a
  CI-driven `vercel deploy --prebuilt --prod`. Both were refused, and blocking means a required
  GitHub status check on `main` instead — with the honest residue that **the operator is the repo
  admin and can push past their own branch protection**. **Amended 2026-08-08** by
  [The blob host and the site's domain](tickets/025-blob-host-and-domain.md): this ticket's
  Clerk-on-Free finding is confirmed — *"Custom domain and webhooks are included on Free"* is
  correct and 025's own filing sentence contradicting it was wrong — and then **extended in the
  direction nobody checked**. Clerk's production guide opens *"You will need to have a domain you
  own"*, development instances are capped at **100 users**, and no Clerk-hosted production hostname
  is documented at any price. So the free tier was never the constraint on going live; **a
  registered domain is**, and it gates sign-in rather than takedown. Two smaller confirmations:
  Vercel charges nothing to attach a custom domain on Hobby (50 per project, TLS automatic) so **no
  sixth Pro trigger appears**, and Vercel *"do not recommend using a reverse proxy in front of
  Vercel"* — so the site's records sit **DNS-only** in Cloudflare while the blob host is proxied,
  the first place in the estate where two hostnames on one zone are deliberately configured in
  opposite ways. One cost this ticket did not price: **Clerk production requires our own Google
  OAuth client** — its contributor-convenience argument (shared credentials, no Google Cloud
  project) holds in development and is false in production. **Amended 2026-08-08** by
  [The client-side parse budget](tickets/020-client-parse-budget.md): *"same module, both
  environments"* narrows to **same tokenizer and same rules, two drivers** — a retaining one that
  builds tables in a Function, a discarding one that counts in the tab. The property this ticket
  actually needed (isomorphic, no Node built-ins) is untouched, and the browser parse stays
  advisory. `CompressionStream`, `Blob.stream()` and `crypto.subtle` become **stated browser
  requirements of the upload page**, with no fallback: they are the transport this ticket already
  chose, so a browser lacking them could not upload regardless. **Amended 2026-08-08** by
  [Google OAuth in production](tickets/027-google-oauth-in-production.md): this ticket's
  contributor-convenience line — *"Clerk dev instance with shared OAuth credentials — no Google
  Cloud project needed"* — **survives intact, and 025's flag against it was aimed at an extension
  this ticket never wrote**. It is a claim about contributors, and contributors still need no Google
  project ever; what needed pricing was the *operator's* share, which is one free console, one DNS
  TXT record and eleven clicks once, with no card, no renewal and no fifth vendor in the request
  path. Two of this ticket's own arguments extend cleanly: **the Google credential never enters our
  environment either**, because the Client ID and Secret are pasted into Clerk's dashboard rather
  than Vercel's env, so the estate's secret inventory grows by zero values; and **this ticket's
  removal of avatars becomes load-bearing rather than tidy**, because `picture` is returned by the
  `profile` scope, `profile` is one of Clerk's non-removable essential scopes, and so the *only*
  thing standing between a Google profile image and a page in this site is 023's rule that nothing
  renders `user.imageUrl`. Requesting `email` is likewise not optional and dropping it would buy
  nothing. **Amended 2026-08-08** by
  [The site's own crawl surface](tickets/033-site-crawl-surface.md): the Active CPU meter decides two
  things and **is examined rather than invoked**. The sitemap, as an ISR route at
  `revalidate = 3600`, costs ~22 CPU-seconds a month — **0.15% of the 4-hour allowance** — because
  the Neon query it waits on is I/O and Vercel bills *"only during actual code execution"*, and
  because ISR decouples fetches from renders, so crawler volume does not enter the arithmetic at all.
  That makes static-versus-route a **freshness** decision rather than a cost one. In the other
  direction, **generated Open Graph images are the first thing in this effort that could genuinely
  move the CPU trigger** — an unauthenticated, enumerable, rasterising endpoint fetched by every link
  unfurler, against an allowance shared with the sweep, the presign, ingest and every page
  regeneration — so they are refused, and the ban is a CI grep for `next/og` and `ImageResponse`. The
  five Pro triggers gain no sixth. **Amended 2026-08-08** by
  [How is a public page with per-viewer state cached?](tickets/035-caching-per-viewer-state.md):
  Clerk gains the configuration line that makes the whole estate's caching work, and the Hobby meter
  list grows. Vercel's Routing Middleware *"runs globally **before the cache**"*, so Clerk's
  documented matcher — which covers every page route — would put a billed invocation in front of
  every CDN hit; the matcher is scoped to `/me`, `/ops`, `/api` and `/__clerk`, on Clerk's own advice
  that *"Middleware is not the best place to protect routes"*. That narrowing pays twice: `auth()`
  *"Requires `clerkMiddleware()` to be configured"*, so it **structurally cannot work on a public
  page**. **Next.js 16's Cache Components is examined and refused**, dated rather than on principle,
  because it converts the crawl surface from free to billed. And Hobby turns out to publish **five**
  metered resources, not the three this effort has reasoned about: Fast Data Transfer (100 GB) and
  **Fast Origin Transfer (up to 10 GB)** have never been named, and the second is the tightest of the
  five against this design. The CPU trigger does not fire — but this is the first decision in the
  effort where it is within one order of magnitude of firing, at ~31% of the allowance against 033's
  0.15%. **Amended 2026-08-08** by
  [Confirm the pre-upload scan on mobile Safari](tickets/029-confirm-scan-on-safari.md): the browser
  requirements 020 wrote onto this ticket are **measured in WebKit and Gecko, not only documented**,
  so the browser-side gzip this ticket forced is a cross-engine fact. Two restatements: the gzipped
  length is **engine-dependent and not run-stable in Gecko**, so nothing may predict it but the blob
  in hand; and **`crypto.subtle` is the only one of the three gated on a secure context**, so the
  requirement is not "three APIs" but "three APIs **and** a secure origin" — a plain-http origin
  fails it in a way no feature-detection of the other two catches. This ticket's *no dependencies*
  posture also takes its first, deliberately scoped exception: `tools/scan-bench` carries
  `playwright` in its own `package.json`, and `tools/fixture-gen` — the thing CI runs — is unchanged.

- [Upload and ingest pipeline](tickets/011-upload-ingest-pipeline.md) — **the file is
  parsed in the browser before a byte is uploaded, and every server check is a
  recomputation of something the user was already shown.** That ordering answers most of
  the ticket at once: validation, limits, dedup and metadata prefill all happen with the
  file open in the tab, so a rejection costs a file-picker click rather than a 6.8 MB
  upload. **Nothing the client computes is persisted** — 010's rule for stats, extended to
  the content hash. **Fork-vs-revision is declared by route, never detected**, on Fixture
  B's evidence: its four tender variants are *fork siblings*, and any detector keyed on the
  P6 project id collapses them into one series, so the file gets an advisory hint and
  nothing more. Dedup is enforced by a **partial unique index** on `content_hash` where
  `is_root_rev` — the advisory lock 010 suggested needs an interactive transaction that
  `neon-http` cannot open — and a hash matching a **tombstoned** revision is a **hard
  reject**, which quietly makes takedown self-enforcing against the exact bytes.
  **Multi-project is rejected**, with the discriminator being distinct `TASK.proj_id`
  rather than `PROJECT` row count, so baseline-bearing exports stay legal. Caps are
  **20,000 activities / 50 MB**, rejected rather than degraded, because 007's fixed-slot
  row has no way to render a half-computed programme. The presign uuid **is** the
  idempotency key; `upload_intent` makes abandoned bytes findable; `current_revision_id`
  null until publish hides pending programmes from the shelf with no status predicate; and
  a `failed` row survives 24 h because 010 removed email, so an in-app row is the only way
  a user with a closed tab ever learns why. Five 005 amendments fall out. **Amended 2026-08-08**
  by [Operating and observing ingest](tickets/019-ingest-observability.md): the sweep gains a
  heartbeat write, four rule evaluations and a verdict, so its response body becomes a contract
  (`{ok, breaches[]}`) rather than a status code — and the workflow that calls it now **fails on
  purpose**, which is the whole of this effort's push channel. Two of this ticket's decisions
  turned out to have already answered questions 019 was expected to build for: null
  `current_revision_id` makes `/p/{slug}` an unlisted owner-visible page, so the failed-ingest
  surface needed nothing built, and nullable `content_hash` means re-uploading the same bytes is
  never blocked, so the uploader's retry is the file picker. `failure_reason` gains an
  operator-only sibling, `failure_detail`. **Amended 2026-08-08** by
  [The signed-in user's own space](tickets/023-signed-in-users-own-space.md): the first surface to
  render a `pending` row found that **005 cannot store one**. Seven ingest-written columns —
  `p6_version`, `activity_count`, `is_baseline`, `checks_passed`, `checks_applicable`, `card`,
  `derived_version` — are `not null`, and by this ticket's own design ingest runs *after* the row
  exists; the amendment list here caught `content_hash` and the status enum and missed these. All
  seven drop `not null`, invisibly, because null `current_revision_id` already keeps unpublished
  Revisions out of the shelf's inner join. `upload_intent.user_id` gains **`on delete cascade`** or
  account deletion raises a foreign-key violation. The metadata screen gains a **Handle
  confirmation field on first upload only**, prefilled from the generated Handle and required like
  the title. And `failure_reason` renders **inline in the `/me` index** as well as at `/p/{slug}` —
  one already-selected column, on 019's own "one truth rendered in two places" principle.
  **Amended 2026-08-08** by
  [Verifying the production-only edges](tickets/024-verifying-production-only-edges.md): the
  presign's signed header set and the bucket's CORS `AllowedHeaders` are now formally **one
  decision, not two** — a SigV4 presigned PUT requires the browser to send every header in
  `SignedHeaders`, so `cache-control` and `x-robots-tag` are in the CORS document *because* the
  presign signs them, and CI's preflight assertion derives its request-header list from the
  presign's own output rather than from a constant. Changing either alone is a test failure rather
  than an incident six weeks later. One dependency hazard is recorded against this ticket's
  transport: **AWS SDK v3 releases from early 2025 compute request checksums by default**, adding a
  signed `x-amz-checksum-*` header that CORS must allow, which has broken R2 and MinIO presigned
  PUTs widely — so the set of signed headers is a dependency's decision as much as ours, and a
  routine `pnpm update` is a live cause of an upload outage. **Amended 2026-08-08** by
  [The client-side parse budget](tickets/020-client-parse-budget.md): step 1 of the flow is a
  **scan, not a parse**. Nothing on the screen this ticket specified — activity count, P6 version,
  date range, WBS shape, multi-project, dedup hash, prefill, the same-project hint, 013's panel —
  needs a table held whole; a parse was specified because a parse was what existed. Hash, scan and
  010's gzip become **one pass**, which makes the presigned content-length **exact rather than a
  range**, and the client hash is `crypto.subtle.digest` rather than anything hand-written. The caps
  become **20,000 activities / 60 MB** as one rule, and ingest gains a decompression byte limit
  because the cap now lives on the far side of a gzip. This ticket's *"validation is written once
  and run twice"* is preserved by putting the seam at the collection strategy — **one tokenizer and
  one rule set, two drivers** — and made testable: scan and parse must agree on every corpus
  fixture. The ordering, the advisory-only rule, the partial unique index, the distinct-`TASK.proj_id`
  discriminator and the metadata prefill are all unchanged, and the ordering is *strengthened*,
  because a scan is cheap enough to always run rather than quietly stopping at large files. **Amended
  2026-08-08** by
  [How is a public page with per-viewer state cached?](tickets/035-caching-per-viewer-state.md):
  **publish gains the only active cache invalidation in the design, and the reason is this ticket's
  own ordering.** Because 005's slug is immutable and this ticket creates the Programme at the moment
  of *intent*, `/p/{slug}` is a live URL that 404s before the bytes are parsed — and under ISR a 404
  is cacheable. So a visitor who opens the link during the pending window could pin a 404 into the
  cache for up to an hour after the programme went live. The publish step, in the same Function that
  writes `current_revision_id`, calls `revalidatePath` for that slug: one line, in the app, no
  credential. The consequence is that this ticket's *"null `current_revision_id` makes `/p/{slug}` an
  unlisted owner-visible page"* **cannot survive a cached route** — a route serves one artefact to
  everyone, including a 404 — so `/p/{slug}` 404s until publish and the owner's view moves to `/me`,
  which 023 already renders in full including this ticket's `failure_reason` verbatim.

- [Get a large synthetic fixture for perf work](tickets/012-large-synthetic-fixture.md) —
  **synthesised, and the generator is the deliverable**
  ([measurements](tickets/assets/synthetic-fixtures.md), code in `tools/fixture-gen`,
  fixtures in `fixtures/synthetic`). Sourcing a real large programme was rejected on an
  argument this ticket did not anticipate: 010 made real fixtures gitignored *forever*, so
  a sourced file could never be the CI corpus either — only a generator can be both. Ships a
  **16-file correctness corpus** (one landmine per file, goldens written from the
  generator's *intent*, never from parsing its own output), `sparse-150` for rendering,
  and 20,000-activity perf files **generated from a seed rather than committed**. Realism
  came from running a **real CPM pass**, so float and the critical path mean something.
  Four findings land on closed tickets: **the 20,000-activity and 50 MB caps do not line
  up** — at Fixture A's progressed byte density a 20k programme is ~57 MB, so the byte cap
  bites first at ~17,500 activities; **006's 150 KB ceiling holds and is flat** (15.9 KB at
  20k against 17.5 KB at 3,344); **`activities.json` is 342 KB gzipped at 20k**, a third
  under 004's extrapolation; and **the client-side parse peaks at 12–13× the raw file
  size**, projecting ~600 MB of tab memory at the 50 MB cap — 011's parse-before-upload
  ordering has a memory ceiling below its own caps, which opens
  [The client-side parse budget](tickets/020-client-parse-budget.md). The 6.0/8.3 pair now
  produces a **byte-identical `derived.json`**, making the never-index-by-position rule a
  test rather than a note. **The files have never been opened in P6** — stated plainly as
  the ticket required, and carried by
  [Verify the synthetic fixtures import into P6](tickets/021-verify-fixtures-in-p6.md).
  **Amended 2026-08-08** by
  [Do we compute the critical path ourselves?](tickets/014-compute-critical-path.md), which
  found a defect in the delivered generator: `driving_path_flag` is emitted from `tf <= 0` —
  the float/Longest-Path conflation 002 warns about. Harmless while nothing read the flag,
  blocking now that 014 makes it the validation oracle, because the corpus as committed would
  **pass a float-based tracer and fail a correct one**. Fix plus five tracer landmines are
  [Fix the generator's Longest Path flag and add tracer landmines](tickets/022-generator-longest-path-and-landmines.md).
  **Amended 2026-08-08** by [Local development and contributor onboarding](tickets/018-local-dev-and-onboarding.md):
  the generator gains a second consumer and a **fourth fixture class** — a `dev` catalogue
  of ~40 plausible programmes, uncommitted like `perf-*`, tuned to fill 009's facets. This
  ticket's three-way corpus / rendering / perf separation is deliberately *preserved* rather
  than widened, because the correctness corpus exists to fail and a corpus that also has to
  look presentable stops being one. **Amended 2026-08-08** by
  [Fix the generator's Longest Path flag and add tracer landmines](tickets/022-generator-longest-path-and-landmines.md):
  fixed, and the corpus grows from **16 files to 23**. Two of this ticket's own deliverables turned
  out to be quietly untrue. The corpus's discriminating power was **accidental** — with the deadline
  equal to the computed finish, `tf <= 0` and the Longest Path coincide by construction, and still
  do on 19 of 23 files, so the old flag was right on every file that could not tell the difference.
  And **`mutate(tables)` was producing goldens that lie**: `missing-taskpred` and
  `external-relationship` both rewrote `TASKPRED` after the model had run, so the golden asserted
  logic the file did not carry. Both moved onto model options with their emitted bytes unchanged,
  and this ticket's golden-from-intent rule gains a sharper form — **a `mutate` hook may bend rows,
  never logic**. Every perf, gzip, parse and memory figure above is unaffected: `derived.json` at
  20,000 activities is still byte-for-byte 15,854, and `perf-20k` is 17 bytes smaller because there
  are 17 fewer `Y`s. **Amended 2026-08-08** by
  [The client-side parse budget](tickets/020-client-parse-budget.md): finding 4's **12–13× is not
  the client's work**. `measure.mjs` reports a *process* peak, and by the time it is read the
  process has also derived every statistic, built both `activities.json` cuts, stringified three
  times and gzipped four. Split by stage, the tokenizer alone is **10.4×** in Node, and Chrome does
  the identical tokenize at **5.1× heap / 6.8–7.7× renderer RSS** — so the "~600 MB projected at the
  cap" measures **~256 MB heap / ~344 MB renderer RSS** on a purpose-built 50.5 MB fixture. The
  harness is not wrong; it is a *pipeline* harness that was read as a parser one. Finding 1 is
  settled rather than merely recorded — the byte cap rises to 60 MB so the two caps stop
  contradicting. Findings 2, 3, 5, 6 and the corpus are untouched, and finding 6 gains a second
  demonstration: `ver-60`/`ver-83` produce identical *scan* output too. **Amended 2026-08-08** by
  [Does the driving test need to distinguish relationship types?](tickets/028-driving-test-relationship-types.md):
  the corpus grows from 23 files to **24**, adding `logic-nonfs-drivers` — SS, FF and SF
  relationships *on* the driving chain rather than merely present in the file, which nothing in the
  corpus carried. It cost one catalogue entry and no generator library code, and every other
  committed fixture is byte-identical; `measure.mjs --verify` is **24/24**, and every perf, gzip,
  parse and memory figure this ticket recorded stands. It also found a live defect of the same family
  as the `tf <= 0` flag: **free float is computed with the FS formula for every relationship type**
  (`programme.mjs:405`, wrong on 8 of 429 rows with float), a value written by the wrong rule that
  nothing has ever read. **Amended 2026-08-08** by
  [Bring the corpus's readable walk onto the per-type driving test](tickets/031-readable-walk-per-type.md):
  the corpus stays at **24 files** and every perf, gzip, parse and memory figure this ticket recorded
  stands untouched for the third time — `perf-20k` re-generates byte-for-byte at 30,657,187 and its
  `derived.json` at 15,854 — because the change is confined to a golden block. What moves is the
  corpus's own accuracy instrument: **96.3% recall at 98.1% precision, 19 of 24 files exact**, and
  this ticket's golden-from-intent rule pays again, since the goldens' second walk being computed
  from the model is exactly what let an independent tracer over the emitted bytes act as a check on
  it (24/24) rather than as a tautology. **Amended 2026-08-08** by
  [The generator computes free float with the FS formula for every relationship type](tickets/032-generator-free-float-by-type.md):
  the corpus stays at **24 files** and, for the first time since 022, **bytes move** — four `.xer`
  files, on one column. Correcting free float to the relationship's own frame changes
  `free_float_hr_cnt` on **8 of the corpus's 429 float-carrying rows**, and **the other twenty are
  byte-identical**. This ticket's perf figures survive a fourth time: `perf-20k` is **30,657,200**
  bytes and its `derived.json` is **15,854 byte-for-byte**, because free float is not one of the
  stats 006 carries. Its golden-from-intent rule pays again in an unflattering direction: the
  goldens had carried the wrong value **since this ticket shipped it**, and survived 022, 028 and 031
  editing the same file, because `measure.mjs --verify` walked straight past `free_float_hr_cnt`. A
  golden written from intent is only an assertion where something reads it, so the corpus gains **one
  `--verify` assertion and no fixture** — pre-fix bytes against corrected goldens score **20/24**.
  Its `landmine` convention gains a rule of the same family as 022's *a `mutate` hook may bend rows,
  never logic*: **a number in a `landmine` string must be a number its golden carries.** Swept in
  full, **one of the 24 was wrong**. **Amended 2026-08-08** by
  [Verify the synthetic fixtures import into P6](tickets/021-verify-fixtures-in-p6.md): *"the files
  have never been opened in P6"* stands and **stops being the only thing that could be said**. All
  24 corpus files, `sparse-150` and all three perf fixtures read cleanly under **MPXJ**, an
  independent 20-year-old reader — every hostile one included — and against the goldens **20 of 24
  agree exactly**, with all four differences being the fixture's own landmine firing. This ticket's
  golden-from-intent rule is what made that test worth running: a third party agreeing with what the
  generator *intended* is evidence, where agreement with our own parser would have been none. Two of
  its three `speculative: true` fixtures are also settled — the calendar shapes **confirmed real**,
  `logic-float-path` **half refuted** — and `text-multiline` is confirmed **unobserved** in all 139
  real files, which is a defensible reason to keep it rather than a reason to doubt it.

- [The project detail page](tickets/008-project-detail-page.md) — **one scrolling document,
  and the activity table reads the whole blob** ([spec](tickets/assets/detail-page.md),
  [prototype](tickets/assets/prototypes/008-detail-page.html)). Four arrangements were built
  against the real 20,000-activity fixture; the dossier won, taking the *verdict sentence* from
  the quality-first variant and the *lazy per-surface fetch* from the tabbed one. Quality-first
  was rejected on 009's own finding that **DCMA inverts** — a page led by the scorecard teaches
  visitors to prefer templates. The ticket's largest open question was settled by measurement
  rather than feel: **340 KB gzipped, 25 ms to a sortable in-memory table**, then sort 1.8 ms and
  search 1.1 ms with **no further requests** — so `activities.json` is fetched whole, as **one
  object, not shards**, sharding having been justified only by paging that no longer exists.
  `activities.json` v1 is fixed at **13 columnar `TASK` fields plus the WBS tree**, with
  `TASKPRED` and `TASKACTV` cut; the required Gantt check came back with a **price rather than a
  deferral** — a Gantt needs the lean cut plus exactly one table, `TASKPRED`, at **+181 KB
  gzipped**. Two findings landed on closed tickets: **float is not a histogram** — it draws as a
  single spike on all three programmes available, in a different band each time, so the page
  ships a band bar plus an exact table and `float_histogram` becomes a stat that exists for
  revision diff; and **007's colour-only DCMA strip does not survive enlargement**, because
  pass-green against fail-red measures **ΔE 4.1 under deuteranopia**, so every scorecard row
  carries mark, word, value and threshold. The 50-exemplar cap is vindicated in passing: the full
  list is a client-side filter away because the client holds every row. Charts stay
  **programme-level and do not answer the table's filters**, on the same rule that keeps the
  client from being a second source of truth anywhere else. 006's open question about
  per-activity fingerprints closes — **the diff needs nothing added to either contract** — and
  **007's fork-family handover is closed** with no new schema demand. **Amended 2026-08-08** by
  [Do we compute the critical path ourselves?](tickets/014-compute-critical-path.md):
  `activities.json` goes to **v2** for a per-activity driving-path boolean, the callout that
  used to print an `unavailable` reason now prints a value plus one provenance line, and the
  table gains a `Longest path (N)` chip on the existing DCMA predicate mechanism. **Amended
  2026-08-08** by
  [Credit, upvotes and the contributor leaderboard](tickets/016-credit-upvotes-leaderboard.md):
  the action cluster becomes **upvote · bookmark · Fork · Download**, and there is deliberately
  **no uploader vote pill** here — a person-pill beside a programme-pill is two upvote buttons on
  one screen meaning different things, so uploader votes are castable only from the contributor
  page. Neither contract moves. **Amended 2026-08-08** by
  [The site's own crawl surface](tickets/033-site-crawl-surface.md): this page's *"everything above
  the activity table is server-rendered"* is what made the whole crawl surface free — a crawler sees
  the title, sector, licence, every headline number and the DCMA verdict with no JavaScript — and it
  now gains three head tags and, for the first time in the estate, a **cache TTL**. `/p/{slug}`
  self-canonicalises; `/p/{slug}/r/{n}` at the **current** revision canonicalises to `/p/{slug}` and
  is the estate's only genuine duplicate pair; a **superseded** revision self-canonicalises and takes
  `noindex, follow`, because rev 7 of Fixture A's two-year monthly series is a different programme's
  worth of numbers rather than a duplicate of rev 24, and a 24-revision series would otherwise put 24
  near-identical pages in the index for one job. The signed-out render carries a **one-hour TTL**,
  which is 017's number for 017's reason. Its lazy `activities.json` fetch is confirmed irrelevant to
  a crawler and unchanged. **Amended 2026-08-08** by
  [How is a public page with per-viewer state cached?](tickets/035-caching-per-viewer-state.md): its
  *"everything above the activity table is server-rendered"* pays for the third time — it is what
  makes the page a **pure function of its path**, the exact property that decides it is cacheable, so
  `/p/{slug}` and `/p/{slug}/r/{n}` are ISR at one hour and a hit runs no function at all. Its action
  cluster's two pressed states arrive from the viewer request with one id rather than twenty-five;
  its lazy `activities.json` fetch is untouched and, being a browser GET against R2, keeps the
  estate's largest per-open object off Vercel's transfer meters entirely. `derived.json`, which this
  ticket fetches **server-side**, is read once per hour per programme instead of once per view.
  **Amended 2026-08-08** by
  [Does a late-arriving pressed state read as a bug?](tickets/037-late-pressed-state.md): the action
  cluster is judged against the shelf and **reads no worse**, so it ships the same treatment with no
  second rule — 035's untested assumption that 25 rows down a column is the harder case holds. What
  the judgement promotes is a choice this ticket made for looks: because the cluster is a flex row of
  **labelled** buttons, a bookmark going `Save` → `Saved` would shove `Fork` and `Download` sideways,
  so its **`min-width` is load-bearing rather than cosmetic** — 007's fixed-slot rule covers the
  shelf's icon-only control for free and has nothing to say about a label that changes width.

- [Personal data in published .xer files](tickets/013-personal-data-in-published-files.md) —
  **publish verbatim, disclose before publishing, strip nothing, screen nothing, promise
  nothing** ([corpus audit](tickets/assets/pi-audit.md)). The ticket's premise inverted under
  measurement of all 143 real files: the fields Oracle warns loudest about — `email_addr`,
  both phones, `employee_code`, `user_id`, and the whole `TASKUSER` and `DOCUMENT` tables —
  are populated in **zero rows of zero files**, and those are exactly the ones a regex could
  catch. What *is* populated is undetectable or meaningless: `create_user`/`update_user` at
  100% of 243,225 rows but **one distinct value per file** (`admin` in the header of 142/143),
  and `rsrc_name` at 80% `RT_Labor` where **no rule separates a crew member from a trade**. So
  a stripper fires on nothing, stays silent on everything, and ships a file that no longer
  round-trips — false assurance, weaker than honest publication. The audit's most useful
  finding was unplanned: **PI is confined to one object**, `original.xer.gz`, because 006 and
  008 had already cut every resource, memo and UDF field from `derived.json` and
  `activities.json` for payload reasons — so the page, the row and the JSON are PI-free *by
  construction*, and the exposure question is about one URL. **That URL is now `noindex,
  noarchive`** — still public, unsigned and CDN-cached, so 004's economics are untouched —
  which shuts the gap between a planner downloading a file and a labourer's name becoming
  their top search hit, for the price of one PUT-time header. The pre-publish panel 011 paid
  for is **advisory and blocks nothing**, a deliberate refusal to make a screening promise the
  free-text fields would break; it enumerates **values not counts** (worst real file: 37
  resources + 27 memos, one screen), renders `create_user` as one line because a list would
  always have length 1, still scans the measured-empty fields since two clients are not the
  world, and reports `UDFVALUE` rather than excluding it — 12.5 MB of chainages and quantities
  where prose is **under 0.3%**. Third-party erasure is **003 Class B unchanged**, with the
  consequence stated rather than softened: resource dictionaries are stable across a series,
  so one crew member's request tombstones the whole series and its forks. **Zero schema
  demand**, and a new map-level standing decision — no warranty, opt-in, at the user's own
  risk — which pre-settles verification badges and "checked" states out of the effort.
  **Amended 2026-08-08** by
  [Verifying the production-only edges](tickets/024-verifying-production-only-edges.md): the one
  PUT-time header this ticket made the whole of its mitigation now has a verifier at **three
  layers** — CI proves our presign signs it, a canary PUT proves R2 stores it as object metadata,
  and a HEAD of the blob host proves the edge serves it back — because MinIO's agreement proves
  nothing about a vendor's handling of a non-standard metadata header. More usefully, this ticket's
  *other* requirement had no implementation at all: **`Disallow: /` in the blob host's `robots.txt`
  is an object in the bucket**, and no code path in the design had ever written it, so it was not
  possibly-wrong but certainly-absent. It is now written by `ops bucket apply` and asserted every 15
  minutes. `rel="nofollow"` on the download link becomes a CI assertion. Nothing about the posture
  changes: still mitigation against well-behaved crawlers, still not protection — and the check
  prints assertion **keys**, never the URL of the one object this ticket confined all PI to.
  **Amended 2026-08-08** by [The blob host and the site's domain](tickets/025-blob-host-and-domain.md):
  `Disallow: /` finally has a hostname — `blobs.xerhero.com` — and the rule that gives it one is why
  the estate needs only **one** registered domain. A `robots.txt` governs its own origin and nothing
  else, so the blob host's `Disallow: /` says nothing about the indexable site; this ticket needed a
  separate **hostname**, never a separate registrable domain, and a second registration would have
  bought a second renewal for nothing. The mitigation's edge half is also stated as what it is until
  the purchase happens: **unimplementable**, not degraded — the PUT-time header is testable in CI
  against MinIO and the `robots.txt` object works anywhere, but *the edge serves it back* cannot be
  asserted where there is no edge we control and no Response Header Transform Rule to repair it
  with. **Amended 2026-08-08** by
  [The client-side parse budget](tickets/020-client-parse-budget.md): the panel is fed by a **scan**
  rather than a full parse, and its content is unchanged. It was the constraint that nearly blocked
  the change — it enumerates *values, not counts* — and this ticket's own audit is what cleared it:
  every enumerated value already lives in a table that is small by nature (worst real file 37
  resources + 27 memos, `rsrc_notes` at most one, `create_user` at one distinct value across 143
  files), and the one enormous surface, `UDFVALUE`, this ticket had already reduced to a count plus
  labels. So the readability cut made here three tickets early turned out to be the affordability
  cut too. Lists are capped at 500 values so a pathological export cannot make the panel unbounded,
  and the measured-empty probes stay, still free. **Amended 2026-08-08** by
  [The site's static pages](tickets/030-static-pages.md): the standing decision this ticket escalated
  becomes **applicable prose rules rather than a principle**, on one test — *could this sentence
  become false without anyone changing the code?* If yes it is a promise and it is banned; if it can
  only become false by shipping different software it is a description, and 027 established Google
  requires exactly those. That yields banned-phrase lists and three forced rewrites straight out of
  this ticket: the pre-publish panel **lists what it finds** and never *checks your file for personal
  data*, `noindex` **asks** search engines not to index and never *prevents*, and DCMA is **computed
  and reported, not endorsed**. The safeguard is structural rather than editorial — `/about`'s
  longest section is *"What this site does not do"*, so the page cannot drift into a landing page
  unnoticed. This ticket's privacy section finally has a heading, a route and a reader, and its third
  lawyer question is marked inline against it. **Amended 2026-08-08** by
  [The site's own crawl surface](tickets/033-site-crawl-surface.md): this ticket's `noindex`
  mitigation reaches **the site** for the first time, and its confinement of PI to one object turns
  out to block a whole class of markup. The asymmetry it named is found to exist one level up, on
  **tombstones**: after 017 step 2 the page renders from the Postgres row alone and is PI-free, but
  **for a Class B the title can itself be the violation**, and 003 kept the title visible for
  ancestry integrity without reasoning about search. So a tombstoned programme is `noindex, follow`
  in both classes and leaves the sitemap. The blob host's `Disallow: /` is confirmed as saying
  nothing here, with a hazard 025 did not have: **both files now live in one repo and one says
  `Disallow: /`**, so the site's file is defended by CI against a copy-paste rather than against
  absence. And this ticket's best finding blocks the obvious structured data: `Dataset` markup fits a
  programme page almost perfectly, but its point is `distribution` — *"where to get the data and in
  what format"* — and the only honest answer is `original.xer.gz`, the one object this ticket marked
  `noindex, noarchive`. **A machine-readable pointer to it is the precise inverse of this ticket's
  entire mitigation**, so structured data is refused rather than deferred.

- [Do we compute the critical path ourselves?](tickets/014-compute-critical-path.md) — **we
  compute, but we do not schedule.** The ticket's compute-or-accept framing had a false
  premise: critical-by-float already ships from P6's own numbers, so what was missing was
  never the critical path but the **chain** — and a chain can be *traced* over the dates P6
  already wrote, with no forward pass, no backward pass and **no calendar arithmetic**. The
  CPM engine is ruled **out of scope**, and both of its best arguments die on inspection:
  DCMA 12's informative half (does a driving chain reach the finish unbroken) ships as
  `logic.path_continuous` without one, and the accuracy argument inverts — `driving_path_flag`
  is worth more as a **permanent oracle** than as an output, because with no P6 licence
  Fixture A's 138 flagged activities are the only ground truth this project will ever have.
  So the trace runs **always**, provenance always `computed`, one definition site-wide.
  Calendars stay out by testing **ordering rather than equality** — driving predecessors are
  those maximising `EF + lag`, ties kept because paths *branch*, corroborated by
  `free_float_hr_cnt == 0`, which borrows the calendar work P6 already did; the residue is
  lag treated as elapsed hours, wrong across non-working time on 8.8% of Fixture B's
  relationships and 0.3% of Fixture A's (**corrected 2026-08-08** by 036, which also withdrew
  this ticket's claim that the residue is left visible as oracle disagreement — it is not, on
  Fixture A). Output is a **set, not a chain** — a chain cannot
  represent branching, which the oracle marks. Cycles become a **finding** rather than only a
  failure (`logic.cycle_count`), and like `path_continuous` stay **outside** the DCMA ratio
  009 sorts on. The shelf is untouched — nothing enters `card`, so an acknowledged
  approximation never gets frozen into the one payload that cannot be lazily recomputed, and
  this feature incurs **no backfill ever**. It ships only against a named gate: **recall ≥
  95%, precision ≥ 90%, chain continuous** on Fixture A, else `longest_path` stays
  `unavailable` and this is v2 work. Zero schema demand. Found a live defect in the committed
  fixture generator on the way through. **Amended 2026-08-08** by
  [Fix the generator's Longest Path flag and add tracer landmines](tickets/022-generator-longest-path-and-landmines.md),
  which built decision 4 twice and found it has **a second approximation this ticket did not name**.
  "Driving predecessors are those maximising `EF + lag`" is true for FS and false for SS, FF and SF,
  where the constraining quantity is the predecessor's *start* or the successor's *finish*. On the
  corpus it costs a whole branch. The exposure compounds this ticket's own lag measurement: non-FS
  logic is **0.4% of Fixture A's relationships and 10.5% of Fixture B's**, against the lag
  limitation's 8.8% of B and 0.3% of A (**corrected 2026-08-08** by 036; 022 read that row
  transposed and wrote *opposite fixtures*) — both approximations sit on **Fixture B**, and
  decision 9's gate measures **Fixture A only**, so it will pass whether or not the tracer
  distinguishes relationship types. Filed as
  [Does the driving test need to distinguish relationship types?](tickets/028-driving-test-relationship-types.md).
  Decision 11 is **acted on** rather than left as a check to run: `logic-float-path` carries
  `float_path` / `float_path_order`, marked speculative. What the corpus gains is decision 9's own
  instrument: the goldens record the truth *and* what decision 4's rules can reach from the bytes,
  so recall and precision are measurable **in CI, forever** — currently **96.1% / 96.1%** — on
  shapes Fixture A does not contain. **Amended 2026-08-08** by
  [Does the driving test need to distinguish relationship types?](tickets/028-driving-test-relationship-types.md):
  decision 4's second approximation is measured and **closed as an under-specification rather than a
  trade** — comparing per relationship type (SS against the successor's start, FF/SF against
  finishes, FS unchanged) is exactly as calendar-free as `EF + lag`, since every quantity is a
  timestamp already in the file, and it takes the corpus from 95.1%/96.3% to **96.3%/98.1%** with
  exact files 17/24 → 19/24. Decision 4's rejected equality test returns for half the types: **SS and
  FF compare like with like**, so a candidate demanding strictly less than the successor's own
  timestamp can be dropped exactly, which is what takes `external-relationship` to 100% precision —
  with a guard nothing in the corpus could have found, that a **milestone writes its finish as a
  start instant**. The named lag limitation is **wider than stated**: on a mixed-anchor successor a
  finish instant is compared against a start instant, so the elapsed-vs-working residue lands on
  **zero-lag** relationships too — this is what actually costs the `text-multiline` branch, not the
  relationship type — and the repair that would close it, inferring shift boundaries from the file's
  own instants, was built and rejected at 98.1% → 92.9%. Decision 4's free-float corroboration is
  confirmed **silently FS-shaped** and demoted: never promoting, and never demoting a non-FS
  candidate until 021 can say how P6 computes it. **Decision 3 gains a second reason** — an SF
  predecessor can start *after* the activity it drives, so a driving set is not time-ordered and
  decision 10's client-side path-as-a-story must not assume it is. **Decision 9 is unchanged and
  needs no second fixture**: Fixture B's oracle is one flagged activity in 3,344, so it cannot
  measure recall, and promoting the synthetic corpus into the accuracy gate would break decision 8's
  split to measure our own generator's opinion; what the gate gains is the precondition it always
  implied, that a red corpus blocks the ship whatever Fixture A scores. **Amended 2026-08-08** by
  [The generator computes free float with the FS formula for every relationship type](tickets/032-generator-free-float-by-type.md)
  — and the amendment is that **decision 4 does not move**, stated rather than assumed. 028 scoped
  the free-float corroboration to FS because the corpus could not exercise it; that is fixed, the
  corroboration is measured **never to veto a correct driving relationship of any type** (zero vetoes
  over 142, 8 of them non-FS), and the scoping **still stands**, because on any acyclic file the veto
  cannot fire by construction — the forward pass takes the max over exactly the four per-type
  quantities free float now measures, so zero free float and *drives something* are one predicate
  inside our own CPM. The corpus can therefore say the corroboration is *consistent*, and can never
  say it is *P6's*, which is what the scoping was always about — that remains 021's. Decision 4's
  other half acquires a flag: its named lag limitation, *"8.8% of Fixture A's relationships, 0.3% of
  Fixture B's"*, reads its source table's columns transposed, and the correction would put decision
  4's two approximations on the **same** fixture rather than opposite ones. Filed as
  [Recheck the lag and non-FS exposure figures](tickets/036-recheck-lag-exposure-figures.md).
  **Amended 2026-08-08** by that ticket: the flag is **upheld against the source**, three ways that
  do not rely on the header — lags are **8.8% of Fixture B and 0.3% of Fixture A**. So decision 4's
  two approximations sit on the same fixture and **Fixture A carries neither in quantity**, roughly
  twelve non-FS and eight lagged relationships in 2,825. Decision 4's closing claim that the residue
  *"surfaces as oracle disagreement under decision 9 rather than hiding"* was load-bearing on the
  transposed figure and is **withdrawn**; what does reach Fixture A is 028's wider zero-lag
  mixed-anchor form, which the percentage never counted and which is unquantified there. Decision 9
  is **unchanged** — there is no available remedy — but it is now described honestly as a **weaker
  instrument than 028 believed** when it decided the gate needed no second fixture. **Amended
  2026-08-08** by
  [The two walks can disagree about the seed, and `why` cannot say so](tickets/042-seed-divergence-unnamed.md):
  **decision 3 has an approximation inside it and named none**, and it is the only one of decision
  4's three residues that can move the whole answer rather than one activity's drivers. *Latest
  remaining finish* is a working-time quantity and a file-reader has only wall-clock instants; a
  zero-duration milestone writes its finish **as** a start instant, so a finish milestone and the
  tasks that finish with it are one working moment written two ways, and the reader ranks the
  milestone strictly later. Where P6 seeds on the tie we seed on the milestone alone, and every chain
  reaching the finish only through a tied task is **absent rather than approximated**. Measured: two
  of the 26 walkable fixtures tie, both ties are milestone-against-task, **both diverge**, and one
  costs four activities. The repair needs the `clndr_data` arithmetic decision 4 exists to avoid, so
  it is stated rather than closed — decisions 2, 4 and 9 are untouched, and the seed is now a fifth
  `why` cause so a disagreement about it can never again present as a clean bill. **Measured
  2026-08-08** by [Does the tracer seed where P6 seeds?](tickets/044-tracer-seed-tie-break.md): that
  residue is **real in the corpus and absent from real exports**, and the amendment's physics is
  right while its premise is false. P6 writes a finish milestone at **its driver's finish instant**
  (a `TT_FinMile` at gap 0 on **98.3%** of live rows, n = 1,879, against a `TT_Task`'s 44.6% —
  [057](tickets/057-correct-milestone-instant-figures.md)) and it is the *task's start* a
  non-working gap displaces, so the seed set ties **exactly** — 47 of 67 files tie, 47 of 47 mixed,
  and the rule already seeds on the whole tie. Decision 3's shape claim is **strengthened** (all 67
  files carry exactly one milestone in the seed set, none seeds on a task alone) and its cost claim
  **withdrawn** (P6's own seed inside ours 48 of 48, 0 dropped, 0 activities lost). Decision 2 gains
  two caveats it never carried — the flag **spans different work** (33.5% `TK_Complete`) and can be
  **stale**. And decision 9 is **run for the first time and found ambiguous in the place that decides
  its verdict**: 65.6% recall against every flagged row, 98.6% at 99.9% against the rows inside
  decision 3's span — [050](tickets/050-ship-gate-flagged-set.md). The corpus divergence is the
  generator's milestone instant: [049](tickets/049-generator-milestone-instant.md).

- [Where does a programme's sector come from?](tickets/015-sector-classification.md) —
  **declared, single-valued, asset class, eight seeded codes, and nothing is inferred.**
  The cross-check the ticket demanded settled the drop-it option first: 009 found sector is
  **the only facet doing real work at launch**, so it is the shelf's organising idea rather
  than decoration. Inference died on corpus rather than difficulty — 010 made real fixtures
  gitignored *forever*, so a lexicon could be tuned on two same-sector programmes and
  regression-tested on none, and Fixture B's `PROJWBS = 1` means the degraded case is **half
  the available evidence**. Worth recording that the ticket's own cost objection was
  **false**: the isomorphic parser already runs over the whole file in the browser, so
  inference would have been free — it was rejected as untestable, which is what leaves it
  revisitable post-launch. The draft list **mixed two axes** (asset class + work type), which
  is what made a rail depot fitout unanswerable; the axis is now asset class alone, so
  tunnelling, fitout and shutdown are **not sectors** and fall to title/description under
  009's FTS. Eight codes (`rail`, `highways`, `aviation`, `marine`, `building`, `water`,
  `power`, `process`), **lean because growing is an insert and merging rewrites rows and
  breaks shared `?sector=` URLs**; the list is **seeded from the repo and applied by
  migration**, so 018's local shelf cannot drift from the live one. Sector is **owner-editable
  in place like the title** — Programme is identity, Revisions are immutable content, so a
  correction is never a revision — and a fork may legitimately diverge from its parent.
  Blank **inverts the ticket's fear**: 011 makes it the guaranteed state of every uncaring
  upload, so it is plausibly the *largest* bucket, which is precisely why it gets **no facet
  chip** — 007's `unsectored` badge and a collapsed 008 breadcrumb instead. **No launch-stock
  quota**: uncovered codes grey out under 009's zero-disabled rule rather than forcing eight
  hand-built templates. **Zero schema demand, zero blob bytes, no backfill.** **Amended 2026-08-08**
  by [The client-side parse budget](tickets/020-client-parse-budget.md): this ticket's recorded note
  that inference "would run client-side for free" **mostly survives** the move from parse to scan —
  `PROJWBS.wbs_name` is retained and `ACTVCODE` is tens of rows, so a WBS-and-code-name lexicon is
  still free. A lexicon over 20,000 *activity* names is no longer free, but this ticket never
  proposed one, and the rejection stands on untestability regardless. **Amended 2026-08-08** by
  [Do sector landing pages exist, now that ?sector= is uncrawlable?](tickets/034-sector-landing-pages.md):
  the eight codes become a **URL namespace**, later rather than at launch. This ticket's *"merging
  rewrites rows and breaks shared `?sector=` URLs"* argument for a lean list gets **stronger**,
  because a merge would break `/sector/{code}` as well. Its refusal of a `sector=none` chip — blank
  being *"plausibly the largest bucket"* — means **the largest bucket in the catalogue has no landing
  page at all**, a second reason the route is a discoverability nicety rather than a browsing
  necessity. Its *"greys out under 009's zero-disabled rule"* was a UI answer and now has the HTTP one
  it lacked: an unoccupied **or unknown** code **404s**, on Google's *"Return an HTTP 404 status code
  when a filter combination doesn't return results"*. And its **no-launch-stock-quota** decision is
  protected rather than merely preserved: the trigger is four codes at 25 Programmes each, ~100
  programmes, deliberately out of reach of authored stock so the quota cannot return through this
  door.

- [Credit, upvotes and the contributor leaderboard](tickets/016-credit-upvotes-leaderboard.md) —
  **the Programme and the uploader are votable separately, so there is no standing formula.**
  The ticket's hardest question — sum of votes vs programme count vs forks vs downloads vs a
  blend — is *dissolved* rather than answered: programme votes rank programmes (009's opt-in
  `sort=votes`), uploader votes rank contributors, and the board reads that one column. A blend
  would have needed weights, weights need a corpus that at launch is a handful of templates, and
  under 013 a weighted score endorses where a raw count reports. The split **rewrote the threat
  model on the way through**: bulk uploads no longer move the board, so the only live attack is
  sockpuppets voting a Handle, and **self-votes turn out to be safe** — one vote once on your own
  Handle, +1 on your own Programme, zero board movement from 200 generated uploads. It also opened
  a hole 003 assumed shut — standing no longer flows through Programmes, so a takedown could not
  reach the board — closed by an **eligibility gate**: zero published non-tombstoned Programmes
  delists you, votes retained; partial takedown does nothing. v1 **defends nothing
  algorithmically** (manual void, on 003's one-operator/no-SLA posture; an earned franchise was
  rejected as disenfranchising the download-only planners whose votes carry the information), and
  the real defence is structural — **the board is a footer-linked page**, too small a prize to
  farm. A rolling window is named as the cheapest escalation if that fails. **The bookmark is a
  separate object and private throughout** — no count, never rendered to anyone else — which keeps
  it out of the gaming surface entirely and yields the division the rest leans on: **votes are
  public in aggregate and private in attribution, bookmarks are private throughout**. It costs
  007 a fixed control slot on the row (the flow rule survives — a fixed x is what that rule asks
  for) and one combined viewer join. **Being forked is a fact on the contributor page and nowhere
  else**, live-joined, never ranked on — 007 refused a fork counter because *the grid* needs
  denormalisation, and a single-contributor page does not pay that cost. Five tickets amended;
  three tables and two counters added; **nothing enters `derived.json`, `activities.json` or
  `card`, so no backfill ever**. **Amended 2026-08-08** by
  [The signed-in user's own space](tickets/023-signed-in-users-own-space.md): the **two owner-only
  tabs move off the contributor page**, because this ticket's own decision 8 wrote the argument
  against them — the Handle is chosen at first upload (003), so the download-only planner whose
  votes "carry the information" has no contributor page to mount them on. Worse, they cannot
  bookmark either: `bookmark` cascade-deletes with `app_user`, whose Handle is `not null`. 023 fixes
  it by creating `app_user` on the first authenticated **write** with a generated Handle, and moves
  the tabs to `/me`. `/u/{handle}` — a URL this ticket left unfixed — keeps everything else and
  gains **one owner-conditional element, a link with no data in it**, so the public page never
  learns anything about its viewer beyond the pressed states 016 already put on every row. The
  bookmark list is confirmed to need **nothing 007's row does not already give**: no notes, no
  folders, only `bookmark.created_at desc` and the rule that un-bookmarking leaves the row in place
  until reload. **Amended 2026-08-08** by [The site's static pages](tickets/030-static-pages.md): the
  footer this ticket invented as an **anti-gaming device** turns out to be the only site-wide
  container in the design, and it is now enumerated. Google requires the privacy policy reachable
  without login from wherever a visitor lands, and most arrivals are a shared `/p/{slug}` rather than
  `/` — so a structural choice made to keep the leaderboard prize small is what makes the legal pages
  reachable at all. Six links: About · Terms · Privacy · **Contributors** · Report a problem ·
  Source, plus one sentence carrying CC-BY, Apache-2.0 and the no-warranty line. The board gets the
  URL this ticket never fixed — **`/contributors`** — with its contents, its rank line and its
  eligibility gate unchanged. This ticket's *"votes are public in aggregate and private in
  attribution, bookmarks are private throughout"* is rendered as a paragraph of the privacy policy
  rather than left as an internal rule. **Amended 2026-08-08** by
  [The site's own crawl surface](tickets/033-site-crawl-surface.md): the **eligibility gate gains a
  second consumer at zero cost**. `/u/{handle}` is indexable exactly when this ticket's gate says the
  contributor is listable — zero published non-tombstoned Programmes drops you from the leaderboard,
  and now also from the sitemap and into `noindex, follow`. One predicate, two surfaces, no new query
  and no new column, covering the cascaded-tombstone case and the account-deletion case without
  either being reasoned about separately. Its votes are also the subject of one refusal:
  `AggregateRating` structured data over `programme.vote_count` is **banned outright**, because it
  converts this ticket's deliberately raw count into a rating — 013's computed-versus-endorsed line
  and the map's badge entry wearing a schema type. **Amended 2026-08-08** by
  [How is a public page with per-viewer state cached?](tickets/035-caching-per-viewer-state.md): this
  ticket's *"one combined viewer join"* is **the closed decision that bends, and it bends on placement
  rather than on content**. The SQL is unchanged — one join, vote-flag and bookmark-flag together —
  but it was costed as part of the grid's single query, and a page carrying a per-viewer boolean is
  not a page a shared cache can serve unchanged. It moves onto its own request, `GET /api/viewer`,
  one `neon-http` batch, fired only when a session cookie is present. Its decision 5 — the bookmark
  being private throughout — is what makes the move cheap, and its reuse of 009's signed-out pill
  behaviour is what makes it invisible: both controls are already drawn unpressed at their fixed x in
  the cached HTML, so the response changes a fill rather than a layout. Its eligibility gate gains a
  third consumer for free — `/u/{handle}` is dynamic, so the gate and 033's `noindex` over it are
  evaluated on every request rather than cached.

- [What tooling does the operator need to run a takedown?](tickets/017-operator-takedown-tooling.md) —
  **a repo CLI with a plan/apply split, and takedown has four steps, not three.** The surface
  was decided by a capability rather than a preference: 010's `neon-http` is batched and
  non-interactive, so an in-app admin route *structurally cannot* wrap a cascade in one
  transaction, while a laptop can — the most destructive operation in the system therefore
  never gets a URL. The unanticipated finding is that the hazard was not only in the rows:
  004's `max-age=31536000, immutable` means **deleting the R2 object does not make 003's
  "bytes hard-delete" true**, leaving a public unsigned URL live for up to a year, so a
  **verified CDN purge** becomes step 3 and `original.xer.gz` drops to a 1-hour TTL — turning
  *purge must never fail* into *purge should not fail*, the right posture for one operator.
  Order is **rows → bytes → purge**: the reversible half commits first, and 005's id-addressed
  keys make the purge list computable exactly where content addressing would have made it a
  search. `apply` **re-derives and refuses on any diff** against the plan, so the executed set
  is always the reviewed set; it resumes for free because rows never delete, so membership is
  stable under partial application. **Class A is self-service at both granularities** — nothing
  to adjudicate, and no cascade means no CTE, so `neon-http` suffices. Two findings landed on
  closed tickets: **nothing authenticates a complainant**, making a Class B a griefing vector,
  answered with a **30-day quarantine** of `original.xer.gz` alone (006 rebuilds the rest);
  and **011's tombstoned-hash reject applied to both classes**, so an owner who withdrew by
  mistake could never re-upload their own file — now scoped to Class B. Intake is a
  `takedown_report` row plus the published mailbox transcribed in, with contact purged 90 days
  after close; **notification is handed to 019 rather than duplicated**. There is **no operator
  correspondence in the Class B flow at all** — blameless fork owners get their own tombstone
  wording and learn by visiting, a gap recorded against
  [The signed-in user's own space](tickets/023-signed-in-users-own-space.md) rather than solved
  with a mailbox. Finding a name is an **on-demand corpus grep with no index**, because an
  `rsrc_name` index would build the standing PI apparatus 013 refused. One table, two columns.
  **Amended 2026-08-08** by [Operating and observing ingest](tickets/019-ingest-observability.md):
  this ticket's refusal to invent a second notification path is **vindicated rather than merely
  deferred** — the channel it declined to build was already in the repo, as the schedule that runs
  its own reconciler. The CLI gains `ingest requeue` (bulk, transient-only, refuses deterministic
  rows) and a `report show` that is the **sole reader of `reporter_contact`**: the dashboard
  adjudicates and the laptop corresponds, so the 90-day contact purge has one reader to audit
  rather than two. Its purge-by-explicit-URL constraint decided the retry question elsewhere —
  attempt-scoped blob prefixes would have multiplied a purge list that must stay enumerable.
  **Amended 2026-08-08** by [The signed-in user's own space](tickets/023-signed-in-users-own-space.md):
  the gap this ticket recorded rather than solved is **closed without correspondence and without a
  mailbox**. A blameless fork owner gets a one-line header notice for the length of this ticket's
  own **30-day quarantine** — chosen because it is exactly the window in which `takedown reverse`
  still works, so the notice is up precisely while something can be done — and `/me` renders
  **017's two Class B tombstone lines verbatim**. No fourth copy variant is written, since a fourth
  wording is operator correspondence wearing a list item; only Class A shifts to second person,
  restating the owner's own act. 017's Class A guard-rail pattern is reused unchanged for account
  deletion, and its rows-before-bytes ordering rule decides the deletion sequence. **Amended
  2026-08-08** by [Verifying the production-only edges](tickets/024-verifying-production-only-edges.md):
  this ticket's "**Purge, verified. Not fire-and-forget**" finally says what *verified* means —
  after step 2's delete and step 3's purge, a plain GET of the purged public URL (no cache-buster)
  must return **non-200**, and only then does `bytes_deleted_at` get written. That closes the loop
  this ticket opened and 019 unknowingly alarmed on, and it is where the TTL's asymmetry is
  honoured: a wrong `Cache-Control` is dormant until a takedown, and a takedown that cannot confirm
  its own purge now refuses to report success, rather than the alarm being made louder. The CLI
  gains a **fourth noun-space** after `takedown`, `ingest` and `report` — `ops bucket apply` and
  `ops bucket check`, which apply and diff the repo's CORS document and `robots.txt` against
  whatever `S3_ENDPOINT` they are pointed at. They live on the laptop for the same reason the
  cascade does: bucket configuration needs an **admin** R2 token, and the app's token stays
  object-read/write. One hard constraint falls out of this ticket's purge-by-explicit-URL finding:
  **`r2.dev` is not in the operator's zone and cannot be purged**, so step 3 requires a custom
  domain on a Cloudflare zone — filed as
  [The blob host and the site's domain](tickets/025-blob-host-and-domain.md). **Amended 2026-08-08**
  by that ticket: this ticket's purge assumption is **verified against the plan table** — URL,
  hostname, tag, prefix and purge-everything are offered identically on Free, Pro, Business and
  Enterprise, and Free's limits (800 URLs/second, 100 URLs per request) are not limits against a
  purge list 019 fixed at three URLs per revision. Step 3 is therefore reachable for $11/year rather
  than $20/month. It also acquires a way of being silently untrue that nobody had written down: if
  the bucket's `r2.dev` development URL is left enabled alongside the custom domain, **the same
  bytes have two public origins and step 3 purges one**, so 024's verified-purge GET returns its
  non-200 and writes `bytes_deleted_at` against an object still fetchable elsewhere.
  `ops bucket check` gains a third assertion, **`ops.r2dev.disabled`**, reading the R2 managed-domain
  endpoint with the admin token it already holds — a config read, permitted on the laptop by this
  ticket's own precedent and impossible from the sweep, because a correctly disabled URL has no
  hostname to probe. **Amended 2026-08-08** by
  [The site's static pages](tickets/030-static-pages.md): the intake form gets the URL it never had —
  **`/report`** — and the published mailbox gets a home that is not every page. A `mailto:` in the
  root layout would publish the operator's address to every scraper visiting any page of a public
  site, for a channel this ticket deliberately made **secondary** to the row; the footer links
  `/report` and `/report` prints the address. The form's fields, its Turnstile spam control and its
  rate limit are unchanged. The **90-day contact purge** this ticket said *"goes in the privacy
  policy explicitly"* is now a named section, and Turnstile is named as a third party running in the
  reporter's browser — one of only two the whole site has. **Amended 2026-08-08** by
  [The site's own crawl surface](tickets/033-site-crawl-surface.md): the four steps are unchanged and
  gain no fifth, but this ticket's own best finding is found to have a twin one layer up. It
  discovered that **deleting the R2 object did not make 003's "bytes hard-delete" true** because of a
  year-long cache; the identical defect exists for the **HTML page** — a cached `/p/{slug}` keeps
  serving the pre-tombstone render, with every number and the download button, after the row has
  committed. Nothing in the closed set had ever fixed a cache TTL for any page. So `/p/{slug}` and
  `/p/{slug}/r/{n}` take **this ticket's own one-hour number for this ticket's own reason**. The
  `noindex` is a predicate over `programme.status`, so it is emitted the instant **step 1 commits** —
  the reversible half, before a byte is deleted — and it costs zero schema. A page purge is refused:
  it would need a Vercel credential on the laptop, and 025 put the site's records DNS-only so there
  is no Cloudflare purge to reuse. Where speed matters for a Class B, the instrument already exists
  and was provisioned for something else — **027 created a Search Console Domain property at 025 step
  4, and that property carries Google's Removals tool** — so it becomes a per-incident line in
  `docs/operating.md`. A tombstoned programme also emits the **site-default OG card**, so a removed
  title stops travelling outward into an unfurl. **Amended 2026-08-08** by
  [How is a public page with per-viewer state cached?](tickets/035-caching-per-viewer-state.md): its
  *"purge should not fail"* posture transfers to the page verbatim, and the **asymmetry underneath it
  is named**. `revalidatePath` and `revalidateTag` *"cannot be called in Client Components or Proxy"*
  — they run inside the app — so the laptop could reach them only through a public Route Handler and
  a shared secret, which is what 023 refused for the Clerk webhook and 024 for reading Vercel's own
  numbers; and it would buy less than it looks, since `revalidateTag(tag, 'max')` serves the stale
  copy to the visitor who triggers it. So the rule is **invalidate where the write already runs
  inside the app, rely on the TTL where the write runs on the laptop**: Class A, which this ticket
  made self-service, revalidates in-process for free, and Class B waits out 033's hour with Search
  Console Removals as the documented fast path. Four steps, still no fifth.



- [Local development and contributor onboarding](tickets/018-local-dev-and-onboarding.md) —
  **production takes four hosted accounts; development takes one, and every substitution is
  an endpoint swap rather than an adapter.** The ticket's central trade was false: it feared a
  dev blob adapter would be the portability tax 003 banned, but **the production clients are
  already vendor-neutral** — R2 presigning is stock `@aws-sdk/*` against an S3 endpoint and the
  Neon driver takes a `fetchEndpoint`, so neither vendor is named anywhere but an env var. That
  one observation decides four questions: **MinIO** for blobs, **Docker Postgres behind the
  local Neon HTTP proxy** (digest-pinned) for the database, and no interface written either
  time. `node-postgres`-in-dev was rejected on the *direction* of its divergence — it would make
  dev **more** capable than prod, and `neon-http`'s missing interactive transaction is exactly
  what makes 011's dedup index, 005's batched circular insert and 017's laptop-only cascade
  correct. **The card question 010 left open is answered: R2 requires one** (Clerk does not, and
  its free tier is now 50k MRU) — which is why Clerk gets the opposite answer: **an account is
  required and no stub is written**, because there is no endpoint to swap so a bypass would be a
  second implementation of auth, and an auth bypass leaking to prod fails silently and totally
  where a storage stub fails loudly. It costs little because **most of the app is signed out**.
  Seeding **runs the real ingest path server-side** — product parser, derive and persistence,
  skipping only the browser hop — so no golden `derived.json` is ever committed against a
  contract already at v2; the dev corpus is a **separate generated catalogue** of ~40
  programmes, kept apart from the 16-file test corpus so nobody ever tunes the thing whose job
  is to fail, and its real payload is the **row states** no `.xer` can carry (revision series,
  fork siblings, both tombstone classes, a `failed` row, unsectored programmes, votes,
  bookmarks). **CI stands the whole stack up on every PR**, collecting an argument 010 left on
  the table: fork PRs get no env vars, so an all-local stack is the only stack they can ever be
  tested against. Docker is required; the hosted path is documented as a fallback because it is
  the production configuration and 017's CLI needs it anyway. **Zero schema demand, zero
  backfill.** Left one gap behind, filed as
  [Verifying the production-only edges](tickets/024-verifying-production-only-edges.md): the
  local stack reproduces the S3 API and the Neon wire and **none of the CDN**. **Amended
  2026-08-08** by [Verifying the production-only edges](tickets/024-verifying-production-only-edges.md):
  the gap this ticket flagged is **narrower than it stated, and its own §2 is the evidence** — *"the
  upload path is exercised in full locally, including CORS, because CORS is a bucket rule in both"*.
  MinIO also stores and returns object metadata as S3 does, so the PUT-time half of 013's header and
  017's TTL is locally testable too; what is genuinely CDN-only is whether R2 stores a signed
  `x-robots-tag` and whether the edge serves it. The compose stack **stops needing a hand-set MinIO
  CORS step**: bucket configuration becomes one JSON document applied by `ops bucket apply` to MinIO
  and R2 alike, which is this ticket's vendor-neutral-clients finding paying a second time —
  `PutBucketCors` is the same stock client, so config-as-code was cheaper than the documented manual
  step even before anyone verified anything. Its CI job grows an `edge-contract` suite that runs with
  **no secrets**, so it survives this ticket's own fork-PR constraint. **Amended 2026-08-08** by
  [The client-side parse budget](tickets/020-client-parse-budget.md): the CI job that stands the
  whole stack up gains one assertion — **the pre-upload scan and the full parse must produce the
  same answers on every corpus fixture**. It is the check that stops the two drivers of one
  tokenizer drifting, and it is a stronger test than either driver's golden alone. **Amended
  2026-08-08** by [Google OAuth in production](tickets/027-google-oauth-in-production.md): the
  four-tier README contract is **unchanged and confirmed** — tier 2 is a Clerk key pair and nothing
  else, forever, because Clerk supplies the Google credentials in development and none of the
  production Google work needs a card. One note is added for anyone debugging: **the consent screen
  a contributor sees at tier 2 is Clerk's shared app, not ours**, so nothing observed in development
  predicts what a user sees in production — which is why the provisioning checklist ends with a
  human signing in from a signed-out browser rather than assuming. **Amended 2026-08-08** by
  [The site's own crawl surface](tickets/033-site-crawl-surface.md): the CI job grows an eleven-key
  crawl-contract suite, still with **no secrets** and still fork-PR-safe. Its dev catalogue pays a
  second time without changing: the row-states it already carries — both tombstone classes, a
  `failed` row, unsectored programmes — are exactly the fixtures `ci.canonical.tombstone_noindex` and
  `ci.sitemap.excludes_hidden` need, so nothing is added to it.

- [Operating and observing ingest](tickets/019-ingest-observability.md) — **the sweep becomes
  the reporter, an in-app dashboard is the record, and the alarm is a red GitHub Actions run.**
  The ticket's premise — 010 removed email, so the app can tell nobody anything — is true and
  turns out not to be the binding constraint: **the app is not the only thing running**, and
  011's 15-minute scheduled workflow **mails the repo owner for free whenever it exits
  non-zero**. The notification path was provisioned three tickets ago for an unrelated reason;
  the sweep merely had to be allowed to fail. So the question became *what is worth going red
  about* — thresholds, not infrastructure — and **010's log-drain Pro trigger does not fire**,
  because every durable fact is a Postgres row rather than a log line, which makes Hobby's
  1-hour window a debugging inconvenience instead of the problem. Four **asymmetric** rules,
  keeping both singletons the closed tickets had earned: any `open` takedown report past 12 h
  (`awaiting_owner` gets its own 7-day clock), **any** deterministic ingest failure at all
  (011 says near-extinct, so one means a bug or a bypassed client, and a rate rule would hide
  the first), transient failures only on burst, and — the rule nobody asked for — a **stranded
  tombstone**, which is 003's "bytes hard-delete" quietly not being true. Red **on transition
  then daily**, because 96 runs a day of the same complaint is a channel you filter to a folder
  within a week. The endpoint evaluates and the workflow asserts one boolean, so the dashboard
  and the alarm cannot drift and 018's CI can drive each rule red on purpose; the run log stays
  boolean-only because **a public repo's Actions logs are world-readable**. The dashboard is
  **read-only** behind an env-var Clerk-id allowlist — every operator *write* stays in 017's
  CLI, which gains a bulk transient-only `ingest requeue`. Partial ingest is **idempotent
  overwrite on deterministic keys**, unreachable before publish and keeping 017's purge list a
  constant 3 URLs. The uploader's channel needed nothing built: `/p/{slug}` is **already** an
  unlisted owner-visible page via 011's null `current_revision_id`, and re-upload already works
  because a `failed` row's `content_hash` is null. Contact splits from case — **adjudicate on
  the web, correspond from the laptop** — so the only page that could leak a complainant's
  address does not have it. Two tables, one column, and the column carries **parse position,
  never file bytes**, or it would rebuild inside an error string the exact PI surface 013
  refused to build. **Amended 2026-08-08** by
  [Verifying the production-only edges](tickets/024-verifying-production-only-edges.md): the rule
  engine gains a fifth rule, `edge_drift`, and `alarm_state` a fifth seeded row — which is the whole
  of that ticket's schema demand and which surfaces the coupling this ticket created, that **a
  seeded suppression table makes every future rule a migration**. That coupling is examined and
  kept: self-seeding on first evaluation would remove it, but the seeded set is an **inventory
  `/ops` renders**, not a log, and under upsert-on-first-run a rule appears on the dashboard only
  after it has successfully run once. This ticket's stated reason for deferring — *a 15-minute poll
  is the wrong instrument for a value that changes twice a year* — is **overturned on cost rather
  than argued with**: the poll is ~96 Class A and ~8,600 Class B operations a month against free
  tiers of 1M and 10M, transition-then-daily already solves the only real cost of frequent
  evaluation, and throttling would have needed a `last_checked_at` column bought to save nothing.
  The objection that survives is *lateness*, not cadence, which is why the rule is one of three
  instruments rather than the only one. And **rule 4 turns out to have been the purge alarm all
  along** — `reconciler_stuck` reddens on `bytes_deleted_at` staying null, so an unverified purge
  already alarmed; 024 supplies the missing definition of what writes that column. **Amended
  2026-08-08** by [The site's own crawl surface](tickets/033-site-crawl-surface.md): the coupling 024
  named and kept — **a seeded `alarm_state` table makes every future rule a migration** — is
  deliberately **not paid** there. The site's crawl surface gets a *key* on 024's existing
  `edge_drift` rather than a sixth rule, so it costs an array entry in `sweep_run.breaches` and no DDL
  at all, which is the first demonstration that the coupling only bites at rule granularity. The
  key-not-URL printing convention is kept unchanged. **Amended 2026-08-08** by
  [How is a public page with per-viewer state cached?](tickets/035-caching-per-viewer-state.md): its
  finding that *"the uploader's channel needed nothing built"* **stays true and changes address**.
  The channel is `/me`, not `/p/{slug}`, because a cached public route cannot serve a 404 to one
  viewer and a page to another. Its own *"one truth rendered in two places"* principle survives as
  one place, which is what it was defending in the first place. `revision.failure_detail` stays
  operator-only and `/ops` stays its sole reader, now additionally because `/ops` is one of only four
  paths where middleware runs at all. **Amended 2026-08-08** by
  [Does a late-arriving pressed state read as a bug?](tickets/037-late-pressed-state.md): the rule
  engine gains a **sixth rule, `viewer_latency`**, and `alarm_state` a sixth seeded row — the first
  time since 024 named the coupling that anything actually **pays** it, 033 and 035 having both
  escaped with a key on `edge_drift`. The escape is unavailable here for a reason worth recording:
  `edge_drift`'s keys are booleans about production-only edges being *presently wrong*, and this is a
  **trend over runs** — >800 ms on three consecutive sweeps — so it needs the consecutive counter to
  survive between runs, which is mutable current state and therefore exactly the thing this ticket
  separated `alarm_state` from `sweep_run` to hold. It costs nothing in `sweep_run`, whose `breaches`
  jsonb takes a sixth key free. The instrument is the sweep **timing its own first Neon statement**,
  which is this ticket's Postgres-rows-not-log-lines posture reaching one class of fact it was never
  built for — a duration rather than a count — and doing it without a log drain, so the 1-hour window
  stays dodged and the fifth Pro trigger still does not fire.

- [The signed-in user's own space](tickets/023-signed-in-users-own-space.md) — **four plain pages
  under `/me`, one header line, and the only schema this writes is the *removal* of seven `not null`
  constraints** ([routes, queries and copy](tickets/assets/own-space.md)). The four demands needed no
  table, no column and no job — but assembling the index found four defects in the closed set, three
  of them blocking, and the largest is not about this surface at all: **under 005 as written the most
  common signed-in user cannot exist.** `bookmark` cascade-deletes with `app_user`, whose
  `display_name` is `not null` and is chosen *at first upload* (003) — so the download-only planner
  016 defended in decision 8 cannot bookmark or vote, and the two owner-only tabs 016 mounted on the
  contributor page are unreachable for exactly that person. Fixed with **`app_user` created on first
  authenticated *write*** with a generated Handle confirmed at first upload — one upsert, three call
  sites, zero schema — and by moving the tabs to separate routes, leaving `/u/{handle}` with **one
  owner-conditional element, a link carrying no data**. The second blocker: a `pending` Revision
  **cannot be inserted**, because seven ingest-written columns are `not null` and ingest runs after
  the row exists — 011's amendment list caught `content_hash` and missed these. **The acknowledgement
  question dissolves** rather than being answered: "persists until seen" is the wrong axis, because
  both notices this site can raise already have a reaper — a Class B tombstone matters for **exactly
  017's 30-day quarantine** (the window `takedown reverse` still works in) and a `failed` upload for
  **exactly 011's 24-hour reap** — so the notice is one undismissable header line with no storage at
  all, and `alarm_state` is examined and found *unnecessary* rather than merely unusable, because its
  four rules have no natural expiry and these two delete themselves. **`/me` is an index, not a
  shelf**: 007's row is a comparison surface and nobody compares their own uploads, so uploads are
  one line each while bookmarks and votes keep the row. 019's read-only posture is **examined and
  declined** — the site already writes everywhere (015, 016, 017) — and replaced with a sharper rule:
  **`/me` writes nothing about a Programme**, every Programme-scoped write staying on that
  Programme's page, so no destructive control ever sits in a list of your own work. Account deletion
  is confirmed against 003/005/016 and would have **failed twice**: `upload_intent.user_id` had no
  delete action, and 010's "two acts" had no owner, order or failure story. Clerk's `<UserButton>` is
  refused because it renders the Google profile image — the `<img src>` personal data 010 removed on
  purpose. **Zero tables, zero columns, zero indexes, no backfill, and nothing enters `derived.json`,
  `activities.json` or `card`.** **Amended 2026-08-08** by
  [Google OAuth in production](tickets/027-google-oauth-in-production.md): this ticket's refusal of
  Clerk's `<UserButton>` is **promoted from a component preference to a structural rule**. It
  refused the drop-in because it renders the Google profile image 010 removed; 027 establishes that
  `picture` is returned by the `profile` scope, that `profile` is one of the essential scopes Clerk
  pre-configures with no documented way to remove, and therefore that the claim cannot be
  un-requested at the source. The rule is not *avoid `<UserButton>`* but **nothing in this site
  renders `user.imageUrl`**, and it is the only line of defence there is. **Amended 2026-08-08** by
  [The site's static pages](tickets/030-static-pages.md): the URL set this ticket closed **reopens by
  five public routes** — `/about`, `/terms`, `/terms/v{n}`, `/privacy`, `/privacy/v{n}` — plus two
  fixings for URLs earlier tickets specified without addresses, `/contributors` (016) and `/report`
  (017). The **header is untouched**. What is added below is a **site-wide footer** in the root
  layout, including on `/me/*` — a static, viewer-independent block, so this ticket's argument that
  the public cacheable path stays viewer-independent is unaffected, and the same property is why the
  home lede renders identically for signed-in and signed-out visitors. The account-deletion facts
  this ticket wrote into `/me/account` confirmation copy are restated in the privacy policy, which is
  where 003 required them stated **before** anyone reaches the confirmation. **Amended 2026-08-08**
  by [How is a public page with per-viewer state cached?](tickets/035-caching-per-viewer-state.md):
  *"the public cacheable path is untouched"* was an observation about one addition and becomes **the
  rule the entire public surface is built on** — no public route reads the session on the server,
  enforced by a middleware matcher rather than by discipline. This ticket had already chosen the
  mechanism without naming it: refusing Clerk's `<UserButton>` for `<SignedIn>`/`<SignedOut>` plus a
  plain link put the decision in the browser. Its header cluster, its undismissable notice line and
  its one owner-conditional link on `/u/{handle}` now all render from the same one request, alongside
  015's edit affordance and 017's Class A button — **every owner-conditional element on a public page
  is one mechanism**. One thing it owns absorbs a change: a route cannot serve a 404 to one viewer
  and a page to another, so `/p/{slug}` 404s to everyone until publish and **`/me` becomes the only
  owner-visible surface for an unpublished upload**. Nothing is lost, because this ticket's §5 already
  renders the whole of it — the `Processing` and `Failed` chips and 011's `failure_reason` verbatim.

- [Verifying the production-only edges](tickets/024-verifying-production-only-edges.md) — **three of
  the four gaps were smaller than 018 thought, the fourth was already closed, and the canary is not
  an object but a run of the production upload path**
  ([assertions, bucket document, checklist](tickets/assets/production-edge-verification.md)). 018
  filed four CDN-only behaviours; taken against what 018 itself built, **CORS is not in the gap at
  all** (its own §2 says MinIO answers preflight the way R2 does — what was production-only was the
  *document*, hand-set in both places with nothing to compare against), the PUT-time half of
  `X-Robots-Tag` and the TTL are origin behaviours MinIO reproduces exactly, and **the verified purge
  already had both a verifier and an alarm** — 017 wrote "not fire-and-forget" and 019's rule 4
  reddens on `bytes_deleted_at` staying null, so what was missing was a **definition** (a plain GET
  of the purged URL returning non-200 is what writes the column) rather than a mechanism. A **fifth
  artefact nobody listed** surfaced instead: 013's `robots.txt` on the blob host is *an object in the
  bucket*, and no code path had ever written it. The shape is **three instruments for two causes plus
  one credential** — CI catches the commit before merge (its preflight assertion derives its header
  list **from the presign's own output**, so "the presign changed" and "CORS is wrong" become one
  test failure), a fifth sweep rule `edge_drift` catches the dashboard edit that has no commit, and
  two verbs on 017's CLI hold what needs an admin token. The sharpest question is answered by
  correcting its framing: the canary's dangerous lie is **temporal, not spatial** — 013's header and
  017's TTL are set per-PUT by our own code, so a hand-uploaded canary is a monument that **stays
  green through precisely the failure it exists to catch**, so it is **re-minted through the
  production presign every run**, on a reserved uuid with no Postgres row, on the argument that
  **MinIO can prove our code signs the header, only R2 can prove R2 stores it, and only the CDN can
  prove the edge serves it**. Bucket config **becomes code and the reason is 018's, not this
  ticket's** — MinIO needs its CORS set too, so one JSON file applied twice by the already-
  vendor-neutral S3 client beats a dashboard click-path plus an `mc` incantation — which makes CORS a
  **test** while the Cloudflare settings stay an **audit automated as behaviour assertions, never
  config reads**, because reading them would put a Cloudflare token in the app where observing output
  needs no credential at all. **No lifecycle rules on purpose**: every clock in this system is a
  Postgres predicate, and a bucket rule would be a second scheduler drifting against the rows.
  Deploy-blocking is priced honestly — Vercel's build runs before the deployment exists and Hobby has
  no promotion gate, so "blocking" means a **required GitHub status check on `main`**, and the
  operator can push past their own branch protection, which is a second reason the alert exists.
  **Strictly R2 and the CDN**: 010's five Pro triggers stay unwatched on purpose, because a trigger
  is a budget decision and a decision does not need an alarm. **One seeded `alarm_state` row, one
  migration line, $0/month** — and the flag is that `r2.dev` cannot be purged, so 017's step 3 needs
  a custom domain, which needs a registered domain, which is the effort's first non-free line item.
  **Amended 2026-08-08** by [The blob host and the site's domain](tickets/025-blob-host-and-domain.md):
  the flag is priced and settled, and the checklist grows from ten steps to **sixteen**. Two
  corrections land on the assertions themselves. **A Cache Rule is required, not optional**:
  Cloudflare's default cached extensions include `GZ` but *"does not cache HTML or JSON by
  default"*, so `derived.v{N}.json` was never going to be edge-cached and
  `edge.canary.derived_cache_control` would have been asserting a pass-through header — green,
  measuring nothing. The rule is *eligible for cache, edge TTL **from origin***, deliberately not an
  Edge TTL override, because an override is exactly what `edge.canary.not_stale_beyond_ttl` exists
  to catch. And this ticket's **observe behaviour, never read config** rule meets the one case it
  cannot express: whether the `r2.dev` URL is off has no observable output when the answer is
  correct, so `ops.r2dev.disabled` is a config read on the laptop, following `ops.cors.matches_repo`
  rather than eroding the rule. Its refusal to watch 010's five Pro triggers is reused verbatim to
  refuse a domain-expiry rule — and **`edge_drift` turns out to already be the expiry alarm**, since
  a lapsed domain fails `edge.robots_txt` and every `edge.canary.*` key within fifteen minutes.
  **Amended 2026-08-08** by [The site's own crawl surface](tickets/033-site-crawl-surface.md): its
  precedent is examined and **deliberately does not transfer whole**. It asserted the blob host's
  `robots.txt` because that file was *certainly-absent*. The site's is a build output of a file in
  the repo, so certainly-absent does not apply — **possibly-wrong does**, in one silent direction:
  `Disallow: /` shipped by copy-paste from `ops/bucket/robots.txt`, two directories away in the same
  repo. So the split by *cause* is reused rather than the instrument. Cause 1, a commit, is eleven CI
  keys on 018's job, and the one that earns a generated `robots.ts` over a static file is this
  ticket's own best mechanism reused verbatim: **`ci.robots.facets_disallowed` derives its expected
  list from the shelf's own `SHELF_QUERY_PARAMS`**, exactly as its preflight derives its header list
  from the presign's own output. Cause 2 gets **one key on the existing `edge_drift` rule and nothing
  else** — `edge.site.robots_txt`, an unauthenticated GET of the apex — spending the property this
  ticket established (`sweep_run.breaches` is jsonb) and therefore needing **no rule, no seeded
  `alarm_state` row and no migration**. It earns its place on a blind spot nobody had noticed: **every
  one of `edge_drift`'s keys points at `blobs.xerhero.com`**, so a detached Vercel domain leaves the
  whole instrument green. `/sitemap.xml` deliberately gets **no** key, because under ISR a failed
  revalidation serves the last good bytes, so a 200 assertion would be green through precisely the
  failure it exists to catch. **Amended 2026-08-08** by
  [Does a late-arriving pressed state read as a bug?](tickets/037-late-pressed-state.md): the sweep
  becomes a **measuring instrument as well as an asserting one**, timing its own first Neon statement
  so that 035's dated Cache Components refusal has a trigger rather than a feeling. It sits inside
  this ticket's **observe behaviour, never read config** rule rather than against it — a duration is
  behaviour — and inside its refusal to watch 010's Pro triggers too, because that refusal was about
  *budget* decisions the vendor already mails about, and this is a correctness threshold no vendor
  will ever mention. The choice of instrument is this ticket's cost posture applied again: an
  authenticated `/api/viewer` canary was proposed and refused, since it would put a Clerk session and
  its rotation into GitHub Actions to measure the one leg with no variance in it, while the sweep's
  daily schedule reaches Neon after a long idle and therefore hits 004's autosuspend resume **by
  construction**. The residue is named in this ticket's own register: it measures the **server leg
  only**, so it floors the number — a breach is certainly real, a non-breach proves nothing about a
  planner on a bad connection.

- [The blob host and the site's domain](tickets/025-blob-host-and-domain.md) — **buy one `.com`, put
  the zone on Cloudflare Free, run four hostname families off it — and the domain turns out to be a
  launch prerequisite rather than a takedown expense**
  ([facts, prices, checklist](tickets/assets/blob-host-and-domain.md)). The ticket's own Clerk
  sentence is wrong and **010 already said so** (*"Custom domain and webhooks **are** included on
  Free"*); correcting it uncovers the harder fact underneath — Clerk's production guide opens *"You
  will need to have a domain you own"*, development instances cap at **100 users**, and there is no
  Clerk-hosted production path at any price. So *does the site move off `vercel.app`* is not a
  preference weighed against 009's immutable slugs: **the site cannot stay there and have anyone
  sign in**, and the purchase gates sign-in → presign → upload → 011, 016, 023, not merely 017's
  step 3. 017's assumption is **verified**: purge by URL is offered identically on every plan (Free:
  800 URLs/s, 100 per request, against a purge list of three), and Cache Rules (10), Response Header
  Transform Rules (10) and the R2 custom domain all sit on Free — the docs impose a same-account
  **zone** requirement with no plan condition. A genuinely free path exists and is **rejected on cost
  that is not dollars**: Cloudflare's own API reference calls `r2.dev` *"not intended for production
  usage"* with a **variable** rate limit; subdomain zones are **Enterprise**, so only a PSL child
  survives and of `eu.org`/`js.org`/`is-a.dev` only `eu.org` delegates NS — putting a volunteer,
  no-SLA namespace in the path of 003's *bytes hard-delete*; and a `workers.dev` Worker nearly wins
  (no cache means purge is *unnecessary*, a delete gives 024 its non-200) but dies on **100,000
  requests/day**, a fifth deployable, and hand-written code in front of the one object 013 confined
  all PI to. **One domain, because `robots.txt` is per-origin** — 013 needed a separate *hostname*,
  never a separate registrable domain. Two findings nobody had: the **`r2.dev` URL must be switched
  off**, or the bucket has two public origins and `takedown.purge.landed` reports a verified purge
  that is a lie — so `ops bucket check` gains `ops.r2dev.disabled`, the one assertion 024's *observe
  behaviour, never read config* rule structurally cannot express; and **JSON is not cached by
  default**, so `derived.v{N}.json` needs a Cache Rule (eligible for cache, edge TTL **from origin**,
  never an override — the override is what 024's `not_stale_beyond_ttl` exists to catch). **The new
  number is $0/month plus ~$11/year** (Cloudflare at cost: Verisign $10.26 → $10.97 on 1 Nov 2026,
  plus ICANN's fee) — flat in corpus size, traffic, users and plan, the only cost in the estate that
  responds to no variable at all. **The renewal gets no sweep rule**, on 024's own precedent that a
  credential bought to read what the vendor already mails is a worse channel: auto-renew is on by
  default, the registrar mails, and **`edge_drift` already alarms on a lapsed domain within fifteen
  minutes** — with the residue named, that this is the one clock in the estate that alarms *after* it
  fires. Recommends **`xerhero.com`** from three verified-available names, with no defensive
  registrations. Hands the dev a sixteen-step provisioning checklist as
  [Register the domain and provision the production estate](tickets/026-register-domain-and-provision.md).
  **Amended 2026-08-08** by [Google OAuth in production](tickets/027-google-oauth-in-production.md):
  the flag this ticket filed rather than guessed is answered, and **the review it could not cost does
  not exist** — for `openid email profile` there is no verification requirement, no unverified-app
  interstitial, no user cap and no fee, publishing being a self-service click. Its single step 14 was
  also wrong in three ways and becomes eleven: **domain verification moves to step 4**, because a
  Search Console Domain property is a DNS TXT record that needs the zone rather than the site — this
  ticket's own one-registrable-domain finding paying a second time, since one Top Private Domain
  covers `clerk.`, `accounts.` and `www.`; **step 14 interleaves with step 15** rather than preceding
  it, because the OAuth client cannot be created until Clerk's production instance has shown its
  redirect URI; and **brand verification moves past step 11**, because Google requires a homepage and
  privacy policy live on the verified domain. That last is the one real defect found: unverified, the
  consent screen does not name the site, and because this ticket put Clerk on `clerk.xerhero.com`,
  the substitute string is plausibly a vendor subdomain. **Amended 2026-08-08** by
  [The site's own crawl surface](tickets/033-site-crawl-surface.md): the `.vercel.app` 308 this ticket
  flagged is **upgraded from a bookmark concern to a crawl requirement** — it is also the only thing
  stopping `xer-hero.vercel.app` serving its own `Allow: /` plus a `Sitemap:` pointer, i.e. a second
  indexable origin for every path in the estate. The window between the first production deploy and
  the domain being attached is real, and becomes a provisioning-order note on 026. Its per-origin
  `robots.txt` finding is what lets the site's file be written without reference to the blob host's,
  and it now has a hazard attached: **both files live in one repo and one of them says
  `Disallow: /`**. And its DNS-only/proxied asymmetry left a blind spot: `edge_drift` watches only
  the proxied one, so **nothing in the estate had ever observed `xerhero.com`**. One key closes it.

- [Fix the generator's Longest Path flag and add tracer landmines](tickets/022-generator-longest-path-and-landmines.md) —
  **the defect was accidentally right, and that is the finding**
  ([working](tickets/assets/driving-path-corpus.md)). `driving_path_flag` now comes from a backward
  walk over the generated logic, but the reason nobody caught `tf <= 0` by inspection is structural:
  the generator's backward pass runs with `projectFinish = deadline` and `deadlineSlipDays` defaults
  to 0, so `tf == 0` holds exactly when an activity lies on *some* chain achieving the finish — the
  same set the walk recovers. On **19 of 23 files the two rules still agree**, so discrimination had
  to be built on purpose rather than found, and the lever is a deadline pulled in behind the
  computed finish — Fixture A's shape, reproduced by `logic-no-longest-path` at **19 float-negative
  activities against 4 actually driving**. The goldens now record the walk **twice**: `members` is
  the truth and `driving_path_flag` is written from it, so the corpus *reproduces* 014 decision 2's
  oracle relationship instead of describing it; `as_read_from_the_file` is what decision 4's rules
  can reach from the bytes alone. The gap between them is 014's accepted approximation as a
  **measured number** — **96.1% recall at 96.1% precision** across the corpus, with all ten
  divergent activities named and caused — which is the ship-gate figure 014 could only get from
  Fixture A by hand, now available in CI forever on shapes Fixture A does not contain. Proved by two
  throwaway tracers: **correct 23/23, float-based 12/23**, the float rule failing in five distinct
  ways (membership, `state`, branches, truncation, continuity) and **the twelve files it passes
  being exactly the ones that cannot tell the difference**. Seven `logic-*` landmines added —
  branch, cycle, external driver, complete, lagged FS, no-Longest-Path, and
  `float_path`/`float_path_order` (item 4 acted on, marked `speculative`). Two surprises: **014
  decision 4 has a second approximation it did not name**, filed as
  [Does the driving test need to distinguish relationship types?](tickets/028-driving-test-relationship-types.md);
  and **`mutate(tables)` was quietly producing goldens that lie**, two committed fixtures having
  rewritten `TASKPRED` after the model ran. 012's perf, gzip and size figures are all untouched. The
  durable check is `measure.mjs --verify` (23/23); the correct-vs-float tracer comparison was run
  from throwaway scripts and is reproducible only from the asset's description. **Amended
  2026-08-08** by
  [Does the driving test need to distinguish relationship types?](tickets/028-driving-test-relationship-types.md):
  the corpus grows from 23 files to **24** and this ticket's headline figures move with it — a
  decision-4 read now scores **95.1% recall at 96.3% precision** (155 of 163), because
  `logic-nonfs-drivers` measures something the old 23 could not. Two of this ticket's own findings
  are corrected. Its filing sentence — that `EF + lag` costs a whole branch on `text-multiline`
  because the rule is FS-only — is **wrong about the cause**: the per-type rule loses the same
  branch, because the FS demand is a finish instant compared against a start instant across a
  weekend, so it is this ticket's *other* documented residue arriving on a zero-lag relationship. And
  the corpus it delivered **could not have answered the question it filed**: 38 non-FS relationships
  and not one FF or SF driving anything, so the per-type branches were unexecutable — discrimination
  had to be built on purpose here exactly as this ticket found for the flag itself. What survives
  untouched is the method: `members` as truth, goldens from the model, and the two-walk record that
  made the approximation a number instead of an argument. **Amended 2026-08-08** by
  [Bring the corpus's readable walk onto the per-type driving test](tickets/031-readable-walk-per-type.md):
  this ticket's headline gap figure moves for the second time and for the opposite reason. 028 moved
  it *down* by adding a file the old 23 could not measure; 031 moves it **up by fixing the rule** — a
  read of the bytes now recovers **157 of 163, 96.3% recall at 98.1% precision, 19 of 24 files
  exact**. Two of its records are corrected in place. Its divergence table's third cause — *non-FS
  relationship* — was **right about `external-relationship` and wrong about `text-multiline`**, and is
  replaced by **mixed anchor kinds**, the same elapsed-vs-working-hours physics as its second cause
  arriving without a lag. And its acceptance proof gains a second reverting tracer: alongside *float
  tracer 12/23*, an **FS-only tracer now scores 22/24** where it scored 24/24 before, so the corpus
  can fail a rule that reverts to decision 4 as written — which it could not do while the golden *was*
  that rule. "What did not change" holds a third time: `perf-20k` is 30,657,187 bytes, `derived.json`
  at 20,000 activities is 15,854, and **all 24 committed `.xer` files are byte-identical**. **Amended
  2026-08-08** by
  [The generator computes free float with the FS formula for every relationship type](tickets/032-generator-free-float-by-type.md).
  Every driving-path figure this ticket published stands untouched for the second time — 163 / 160 /
  157, **96.3% recall at 98.1% precision, 19 of 24 exact** — because free float feeds neither walk.
  What this ticket's method did not cover is now visible: it made `driving_path_flag` an assertion by
  having `--verify` read the emitted column back, and **free float was in the same golden with no
  reader**, which is the whole of why 028's defect survived three tickets. `logic-no-longest-path`'s
  `landmine` string is corrected to the **19 and 4** this ticket's own asset has always said, and the
  other 23 were swept the same way, of which **none was wrong**. Its *a `mutate` hook may bend rows,
  never logic* gains a sibling: **a number in a `landmine` string must be a number its golden
  carries.** One correction is owed to this ticket's own asset and is **filed rather than made** — its
  lag/non-FS exposure table reads its source from the wrong column, which would put both
  approximations on the same fixture rather than opposite ones.

- [The client-side parse budget](tickets/020-client-parse-budget.md) — **the pre-upload pass is a
  scan, not a parse, and that collapses the memory question rather than trading against it**
  ([measurements](tickets/assets/client-parse-budget.md)). Measured in a real browser: the whole
  client step — content hash, every check 011 needs, every value 013's panel enumerates, and 010's
  gzip for the PUT — completes on a **50.5 MB file inside a 16 MB V8 old space**, retaining **3 MB**,
  while the full parse of a file two thirds that size **dies at four times that budget**. So the
  budget cuts at *the client parse gets cheaper*, by ~20× rather than the 2× a tuning exercise would
  have bought; dropping the caps would have capped on **the browser's** budget rather than on
  anything true about programmes, and skipping the parse for big files is **regressive** — the
  biggest files are likeliest to be rejected and would pay the upload first. Two corrections to the
  number that opened the ticket, **both pointing the same way**: 012's 12–13× is the whole
  `measure.mjs` pipeline rather than the tokenizer, which is 10.4×; and **Chrome does the same
  tokenize at 5.1×**, so the ~600 MB projection at the cap measures ~256 MB heap / ~344 MB renderer
  RSS. **013's panel was the real constraint and it proved the case rather than blocking it** — it
  enumerates *values, not counts*, but 013's own audit had already confined every one of them to a
  table small by nature, so **92.9% of records in a 20,000-activity export have no field extracted
  at all** and `clndr_data`, the format's largest string, is never materialised. The hash is
  **WebCrypto over the file's bytes, not a hand-rolled streaming SHA-256** — the streaming version
  was written and measured and is 2.2× slower for ~120 lines of crypto to own forever. **Firefox and
  Safari were not measured and could not be** — only Chromium exists on this machine — so the device
  proxy is a **capped V8 old space**, which reproduces the uncatchable-kill failure shape on demand;
  the remedy is chosen to win on every engine by never producing the condition, and the gap is
  carried as [Confirm the pre-upload scan on mobile Safari](tickets/029-confirm-scan-on-safari.md).
  **There is deliberately no blind-upload fallback**, although the server path would run correctly
  with no client having gone first: 019's sharpest rule is *any deterministic ingest failure at
  all*, and an official blind path makes those routine and forces the rate rule 019 explicitly
  rejected. The caps become **one rule — 1–20,000 activities and ≤ 60 MB raw** — the byte cap raised
  from 50 so the two stop contradicting (20,000 × Fixture A progressed's 2,848 B/activity =
  56.96 MB), free because the server's full parse of 50.5 MB peaks at **562 MiB against a Function's
  2 GB**. **The multiplier did not go away; it moved to the side of the wire that has memory.** 011's
  write-once-run-twice survives as **one tokenizer, two drivers** over a single `ScanResult`, with a
  new CI assertion that scan and parse must agree — which is what produced **23/23 on the
  correctness corpus**, `ver-60`/`ver-83` equivalence included. **Amended 2026-08-08** by
  [Confirm the pre-upload scan on mobile Safari](tickets/029-confirm-scan-on-safari.md): the two
  engines this ticket could not reach are measured, the verdict holds and **the method is corrected**.
  All three APIs are present and correct *by use* in WebKit 26.5 and Gecko 153, the scan completes in
  **535 ms in WebKit** — faster than Blink — and the `ScanResult` is byte-identical across engines on
  27/27. But §3's capped-heap device proxy is a **no-op outside Chromium**, so *"the remedy wins by
  never producing the condition"* is evidenced in Blink alone; and §4's presign note goes from
  prudent to **required**, because `CompressionStream('gzip')` output length differs by engine and is
  not run-stable in Gecko — the compressed length is not a function of the file, so a retry must PUT
  the same blob or re-presign. Mobile Safari stays unmeasured: [046](tickets/046-ios-safari-scan.md).

- [Google OAuth in production](tickets/027-google-oauth-in-production.md) — **there is no review, no
  fee and no interstitial; the thing that is broken without action is the app's name**
  ([facts, sources, console checklist](tickets/assets/google-oauth-production.md)). The ticket was
  filed to price a review and found none exists: *"If your app utilizes only **non-sensitive**
  scopes, it is not mandatory for your app to complete the app verification process"*, verification
  is triggered by **sensitive or restricted** scopes and nothing else, and Testing → In production is
  a self-service state change with no queue and no cost. The *"Google hasn't verified this app"*
  Danger UI inverts the same way: Google's app-state table conditions it, **and the 100-total-user
  cap that travels with it**, on the same sensitive/restricted clause. **The two hundreds do not
  compound** — Google's Testing-mode allowlist and its 7-day refresh-token expiry both carry an
  explicit exception naming *"basic identity scopes (`openid`, `email`, `profile`)"*, so of four caps
  in the estate only **Clerk's** development 100 ever binds. What is genuinely wrong unverified is
  that *"the app name will be displayed on the OAuth consent screen only if your app has been
  verified"*, and because Clerk puts the OAuth callback on its own Frontend API subdomain, the
  substitute string is plausibly **`clerk.xerhero.com`** — a vendor hostname on the one screen whose
  job is letting a stranger check who they are trusting. So the decision is **brand-verify and brand
  it `xer-hero`, no logo** — free, automated, *"typically takes a few minutes"* — with the sequencing
  cost that brand verification needs a **deployed site serving `/privacy` and `/terms`**, making it
  post-launch work rather than a launch blocker. The authorized domain moves the other way: it is a
  Search Console **Domain property**, DNS-level only, so **it can be verified the moment the zone
  reads Active and before anything serves** — 025 step 4, not step 14 — and one Top Private Domain
  covers `clerk.`, `accounts.` and `www.`, 025's one-domain finding paying twice. **Not a fifth
  vendor and not a cost:** Google is already in the request path, and the Client ID and Secret are
  pasted into **Clerk's dashboard**, so 010's *the Google identity never enters our schema* extends
  to *the Google credential never enters our environment* — the estate's secret inventory grows by
  **zero values**. `$0/month plus ~$11/year` is unchanged. **010's contributor-convenience argument
  survives intact**; what was false was an extension 010 never wrote, and the operator's actual share
  is eleven clicks once. Step 14 splits, reorders and **interleaves with step 15**, because the
  OAuth client cannot exist until Clerk's production instance has shown its redirect URI. Clerk's own
  documentation is wrong about all of this and 025's flag inherited the error. **Amended 2026-08-08**
  by [The site's static pages](tickets/030-static-pages.md): the flag it filed rather than solved is
  resolved, and its own assumption is confirmed on a sharper argument than it had. Step 14.10 already
  wrote `https://xerhero.com` into the *App home page* field; nobody had checked whether the page
  underneath could carry the requirement, and the answer is that it must — because the automated
  check this ticket priced at *"a few minutes"* is a **fetch** that `/about` would pass, while the
  fallback is a **manual review at 2–3 business days** by a human typing the address they were given.
  So `/` carries the description and `/about` becomes free. The privacy policy's §2 is drafted
  directly to *"Disclose how your app accesses, uses, stores, or shares Google user data"* —
  including this ticket's own finding that `picture` cannot be un-requested, so **nothing renders
  `user.imageUrl`** is a sentence a user reads rather than only a rule. One of its UNVERIFIED flags
  is **defused by ordering rather than answered**: both URLs are now fixed strings on a known apex.
  Its sequencing verdict is unchanged.

- [Does the driving test need to distinguish relationship types?](tickets/028-driving-test-relationship-types.md) —
  **yes, and it is free: the per-type comparison is exactly as calendar-free as `EF + lag`, so 014
  decision 4 was an under-specification rather than a trade**
  ([measurements](tickets/assets/driving-test-relationship-types.md)). Comparing the quantity each
  type actually constrains against the successor timestamp it constrains — SS on starts, FF/SF on
  finishes, FS unchanged — takes recall **95.1% → 96.3%** and precision **96.3% → 98.1%**, with files
  reproduced exactly on all six fields going **17/24 → 19/24**; every quantity is a timestamp P6
  already wrote, so no `clndr_data` and no working-time arithmetic, and on an all-FS successor the
  reference cancels and the rule *is* decision 4 — which is why seventeen files do not move an
  activity. Decision 4's rejected equality test comes back in half: for **SS and FF demand and
  reference are the same kind of instant**, so a candidate demanding strictly less than what happened
  is droppable exactly, worth +0.6pp precision and one more exact file and taking
  `external-relationship` from 62.5% precision to **100%**. What inverted is the ticket's own
  headline: **`text-multiline` does not lose its branch to the relationship type**, because the FS
  demand is a *finish* instant read against a *start* instant with a weekend between it, so 014's
  named lag residue arrives on a **zero-lag** relationship and no rule reading only timestamps can
  close it (32 mixed-anchor candidate pools, 11 on driving sets, one wrong); the calendar-free repair
  — reconstructing shift boundaries from the file's own instants — was **built and rejected on
  measurement**, buying that one branch for five other files (98.1% → 92.9%). The corpus could not
  answer the question at all — 38 non-FS relationships across 23 files and **no FF or SF ever driving
  anything** — so `logic-nonfs-drivers` was added (one catalogue entry, no library change), whose
  chain the FS-only rule **misses two activities of, loses a branch of, and invents two branches
  in**. The corpus is now **24 files at 9.3% non-FS, a point off Fixture B's 10.5%**,
  `measure.mjs --verify` **24/24**, every other fixture byte-identical. `free_float_hr_cnt == 0` is
  confirmed **silently FS-shaped** — 73.5% precision as a test on its own, inert as a filter on all
  24 files, and untestable in the direction that matters because the generator computes free float
  with the FS formula for every type — so it is kept but never demotes a non-FS candidate until 021.
  Two things fall out that 014 did not know: **a driving set is not time-ordered** (an SF predecessor
  starts *after* the activity it drives), which gives decision 3's set-not-chain a second reason and
  constrains decision 10's client render; and **the ship gate needs no second fixture**. Two tooling
  tickets fall out, deliberately serialised because both regenerate the corpus:
  [Bring the corpus's readable walk onto the per-type driving test](tickets/031-readable-walk-per-type.md)
  and
  [The generator computes free float with the FS formula for every relationship type](tickets/032-generator-free-float-by-type.md).
  **Zero schema demand, zero contract change, no backfill.** **Amended 2026-08-08** by
  [Bring the corpus's readable walk onto the per-type driving test](tickets/031-readable-walk-per-type.md),
  which built what this ticket decided and **returned every number to the decimal** — so a rule
  measured by a throwaway tracer and a rule implemented inside the generator turn out to be the same
  rule. Two of this ticket's own statements needed correcting. Its *"17 of the 24 corpus files do not
  move a byte"* conflated the claim with its own exact-file count: regenerating moves **three**
  goldens and **21 of 24 do not move an activity**. And its promise that `logic-nonfs-drivers`
  *"fails any tracer that reverts to `EF + lag` — in CI, forever"* was true of `members` and **false
  of the golden anyone scores against** — `as_read_from_the_file` *was* the reverting rule, so a
  reverting tracer matched 24/24. It is true now: an independent tracer over the emitted bytes scores
  **per-type 24/24, FS-only 22/24**. The **milestone guard is implemented and confirmed unexercised**
  on stronger evidence than this ticket had — the corpus carries exactly one `FF` with a milestone on
  one side, *from* a milestone rather than into one, on an activity no walk reaches, and removing the
  clause gives byte-identical goldens. **Amended 2026-08-08** by
  [The generator computes free float with the FS formula for every relationship type](tickets/032-generator-free-float-by-type.md),
  which fixed the defect this ticket filed rather than fixed. **The 8 of 429 is confirmed to the row**
  — same eight rows, same four files — and the picture underneath is sharper: seven of the eight were
  the clamp turning an under-computed slack into a **spurious zero**, and the clamp fired on **31 of
  429 rows before and 1 after**. Measurement 3 — *this cannot be trusted* — is retired with its
  conclusion intact and a mechanism instead of a suspicion: **no vetoes at all**, over 142 in-file
  driving relationships of which 8 are non-FS. But this ticket's decision is **confirmed rather than
  relaxed**, on an argument it could not have made: on any acyclic file the corroboration *cannot*
  fail, because the forward pass takes the max over exactly the four per-type quantities free float
  now measures, so `free_float_hr_cnt == 0` and *drives something* are one predicate inside this
  generator. That is a fact about our CPM, so the scoping to FS until 021 stands untouched. Two of
  this ticket's figures are re-counted rather than contradicted: *exact on 3 of 24* scored all six
  fields where the re-run scores membership alone, and its driving-relationship type census was
  counted over the FS-only read walk 031 replaced — the per-type walk marks **143: 135 FS, 3 SS, 3
  FF, 2 SF**. Its own framing acquires a flag — the lag exposure table it opens with reads its
  source's columns transposed, filed as
  [Recheck the lag and non-FS exposure figures](tickets/036-recheck-lag-exposure-figures.md).
  **Amended 2026-08-08** by that ticket: the flag is upheld and this ticket's opening table is
  corrected to **0.4% / 0.3% on Fixture A and 10.5% / 8.8% on Fixture B**. Its decision is untouched
  and its filing argument survives — the operative half, that non-FS logic is 0.4% of Fixture A, was
  read from the column that was right — so only the *opposite fixtures* framing dies. Its
  **ship-gate section does move**: of the three grounds for needing no second fixture, the first
  **strengthens** (the one real programme carrying both residues is the one whose oracle is a single
  flagged activity in 3,344), the second is **unaffected**, and the third **covers the non-FS hole
  only** — that hole is closed by construction and held closed by `logic-nonfs-drivers` in CI, while
  the lag residue is the one this ticket built a repair for and rejected at 98.1% → 92.9%.
  **Amended 2026-08-08** by
  [Verify the synthetic fixtures import into P6](tickets/021-verify-fixtures-in-p6.md), which
  answers the question this ticket deferred and **lifts its scoping**: P6 computes
  `free_float_hr_cnt` **per relationship type**, not with the FS formula throughout. Measured on
  real exports against activities whose successors are exclusively one non-FS type — `PR_SS`
  **280 of 281** matching per-type and **none** matching FS-throughout, `PR_FF` 41 of 48 and none —
  with the arithmetic licensed by a working-hour function that reproduced P6's own
  `total_float_hr_cnt` on every activity of all seven files sampled. The gap is ~600 hours on a
  typical case, not a rounding difference. So `free_float_hr_cnt == 0` **corroborates a driving
  candidate on every relationship type**, and this ticket's *"never demotes a non-FS candidate until
  021"* is retired rather than merely satisfied. Two riders: **P6 floors free float at zero**, which
  is a difference from total float this effort has not needed before and which 032's FS-formula
  generator does not reproduce; and **`PR_SF` stays unmeasured**, because the entire 143-file real
  corpus contains **one** SF relationship and its predecessor has other successors. This ticket's
  own reading of that corroboration as *"silently FS-shaped"* was right about the generator and
  wrong about P6 — the two had been indistinguishable because 032 made our CPM compute what this
  ticket suspected P6 of computing.

- [The site's static pages](tickets/030-static-pages.md) — **five public routes, a site-wide footer,
  one version number that names a *pair* of files, and a 95-word lede on the shelf**
  ([routes, wording rules and the actual copy](tickets/assets/static-pages.md)). The first finding is
  that the problem was worse than filed: 027 said four amendments had accumulated against a file
  nobody renders, and in fact **`docs/legal/` does not exist** — 003 named a path in July, 010, 013,
  017 and 027 amended it, and `terms_version` has been pointing at nothing an uploader could be
  shown. The homepage question then inverts from a layout trade into a **reading** one: `/about`
  would pass Google's automated brand check, which is a fetch, but the fallback is a **manual review
  at 2–3 business days** and a human typing `xerhero.com` must find the description there — so `/`
  carries the description and `/about` becomes free rather than load-bearing. **009's shelf survives
  untouched** on 009's own reasoning: the dismissible intro band was rejected for **state**, not for
  prose, and a block keyed on the canonical URL has none, while 007's relief rule bans stealing
  **width** and a lede costs **height**. On the legal texts: **old versions are addressable**
  (`/terms/v{n}`, `/privacy/v{n}`, superseded ones `noindex`) because 003 made the snapshot *"the
  only thing that matters if an upload is ever disputed"*; **one number covers both documents**; and
  **a shipped file is never edited, not even for a typo**, because repo history is the audit trail
  and an in-place edit is the one case history cannot distinguish. Static, built at deploy, still in
  `docs/legal/` — the only routes in the estate reading neither Postgres nor a blob. **016 built the
  footer without knowing it**: a container invented to keep the leaderboard prize small turns out to
  be the only site-wide slot for the privacy link Google requires reachable from every entry point,
  and it carries exactly six links, fixing two URLs that a footer cannot be enumerated without —
  **`/contributors`** (016) and **`/report`** (017), whose mailbox is printed on that page rather
  than in a root-layout `mailto:`. The no-warranty line becomes applicable rather than tasteful via
  one test — **could this sentence become false without anyone changing the code?** — plus
  banned-phrase lists, and a structural safeguard: `/about`'s longest section is *"What this site
  does not do"*. One decision the privacy policy could not be written without: **no analytics of any
  kind in v1**, Clerk's session cookie only, which buys a page nobody builds — **no cookie banner**.
  Provisioning is **not blocked**; **launch is blocked, by 003 rather than by Google**, because
  without `/terms` there is no lawful first upload; brand verification stays 027's post-launch tail
  costing a wrong name. **Zero schema demand, zero backfill, and nothing enters `derived.json`,
  `activities.json` or `card`** — these pages read no programme data at all. **Amended 2026-08-08**
  by [The site's own crawl surface](tickets/033-site-crawl-surface.md): the first canonical-tag
  decision in the effort gains the half it did not write. This ticket fixed that a current
  `/terms/v{n}` canonicalises to `/terms` and that superseded versions are `noindex`; it never said
  what a **superseded** version canonicalises to, and the answer is **itself** — pointing it at
  `/terms` would claim the superseded text and the current text are the same document, which is
  exactly what 003's audit trail depends on being false. The mirror rule is that a URL emits a
  canonical pointing elsewhere, **or** a `noindex`, never both. Its `noindex`-for-superseded
  reasoning is then **borrowed wholesale for programme revisions**. Its **no-analytics decision** is
  restated as the residue that matters: every crawl decision in the effort is now unmeasurable by
  construction. And its banned-phrase list turns out **not to be needed** on the one surface it was
  most likely to be broken on, because 033 rules that **no OG string in this site is authored**.
  **Amended 2026-08-08** by
  [Do sector landing pages exist, now that ?sector= is uncrawlable?](tickets/034-sector-landing-pages.md):
  its no-analytics residue — *every discoverability decision is unmeasurable by construction* — is
  **narrowed rather than softened**. Traffic facts are gone permanently; **catalogue facts are not**,
  and 009's live facet counts already render them on the front page for free. So a decision keyed on
  the catalogue survives this ticket's choice while a decision keyed on demand cannot be made at all.
  The trade itself is unchanged and nothing is added back.

- [Bring the corpus's readable walk onto the per-type driving test](tickets/031-readable-walk-per-type.md) —
  **96.3% recall at 98.1% precision, 19 of 24 files exact, `measure.mjs --verify` 24/24, and not one
  `.xer` byte moved.** 028 decided the rule and deliberately did not write it; implementing it
  returned **every figure 028 predicted to the decimal, including which files move and which do
  not**, so the throwaway tracer and the generator's own second walk agree line for line.
  `logic-nonfs-drivers` goes 77.8% → **100%** recall and reproduces all six fields,
  `external-relationship` 62.5% → **100%** precision, and `text-multiline` **still loses its
  branch**, deliberately: the rejected instant-lattice repair was not implemented, and a version
  that recovered that branch would have shipped it by accident at 92.9%/16-of-24. Three findings the
  ticket did not ask for. **028's promise that the corpus "fails any tracer that reverts to
  `EF + lag`, in CI, forever" was true of `members` and false of the golden anyone scores against** —
  a third throwaway tracer reading only the emitted bytes now scores **per-type 24/24 and FS-only
  22/24**, and the 24/24 is the independent proof that the amended rule is *reachable from the file*
  rather than merely recorded beside it. **The milestone guard has never executed**: the corpus
  carries one `FF` with a milestone on one side, *from* a milestone rather than into one, on an
  activity no walk reaches, and regenerating with the clause removed gives byte-identical goldens —
  it stays because it is right, not because a fixture forced it. And relationship type stops being a
  *cause* at all: `divergenceCauses` now tests the four comparison kinds exactly and names the
  residue **mixed anchor kinds**, leaving four honest causes over nine disagreements on five files.
  **Zero schema demand, zero contract change, no backfill.** **Amended 2026-08-08** by
  [The generator computes free float with the FS formula for every relationship type](tickets/032-generator-free-float-by-type.md),
  which resolves the one thing this ticket filed rather than fixed and finds it was **the only one of
  its kind**: sweeping every numeral in all 24 landmine strings returns **exactly one wrong string**,
  the one this ticket found by reading. Its "not one `.xer` byte moved" is deliberately not repeated —
  free float is an emitted column, so four files move and twenty do not. What does repeat is this
  ticket's own pattern one layer down: it made the corpus able to fail a tracer reverting to
  `EF + lag` (**22/24**), and 032 makes it able to fail a *generator* reverting to the FS free-float
  formula (**20/24**) — by adding the reader that never existed rather than the fixture that would
  have been a third corpus expansion.

- [The site's own crawl surface](tickets/033-site-crawl-surface.md) — **two generated files, one head
  tag per route, and a tombstone stops being indexable the instant its row commits**
  ([route table, files, assertions, sources](tickets/assets/site-crawl-surface.md)). The first finding
  is that the estate now holds **two `robots.txt` files that mean opposite things** — 013/024's
  `Disallow: /` for the blob host lives at `ops/bucket/robots.txt` in this same repo — so the site's
  file is defended against a **copy-paste** rather than against absence, which is 024's case inverted
  and is why the file is a **generated route rather than static text**:
  `ci.robots.facets_disallowed` derives its expected disallow list from the shelf's own
  `SHELF_QUERY_PARAMS`, making a fifth facet added without a `Disallow` a test failure rather than an
  unbounded crawl six months later. **The facets lose, and 009's own argument is what settles it**:
  009's crawl path was always the *unfiltered* numbered sequence, and a filter is by construction a
  subset of a page already crawlable, so `sector`, `size`, `p6`, `progressed`, `q` and `sort` are
  `Disallow`ed while **`page` is not** — against a facet space of 30,000+ states before pagination,
  unbounded once `q` is free text. **The sitemap's cost question turns out not to be a cost
  question**: as an ISR route at `revalidate = 3600` it reads Postgres on *our* schedule and serves
  cached bytes on the crawler's — **0.15% of Hobby's 4 CPU-hours** — and static-at-build loses on
  **freshness**, not money, because uploads are the product and a deploy is not an upload. It is the
  shelf's own published join without the limit, so `pending` and tombstoned fall out for free, and it
  **demotes 009's numbered pages from load-bearing to redundant**. On canonicals,
  `/p/{slug}/r/{current}` → `/p/{slug}` is the estate's only true duplicate pair, but the ticket's
  stated minimum was **wrong about superseded revisions** — rev 7 of a 24-revision series is not a
  duplicate of rev 24 — so it self-canonicalises and takes `noindex, follow`, and **a URL emits a
  canonical pointing elsewhere or a `noindex`, never both**. **The sharpest answer is that a tombstone
  is `noindex` in both classes**, because 003 keeps the URL so an inbound link does not rot and never
  so anyone could find it — and checking that against 017's four steps found 017's own cache defect
  **one layer up**: a cached `/p/{slug}` keeps serving the pre-tombstone render with every number and
  the download button on it, so the page takes **017's one-hour TTL for 017's reason**, takedown gains
  **no fifth step**, and the fast path for an urgent Class B is Search Console **Removals** — a
  property 027 already created at 025 step 4. **OG cards carry no authored prose at all**, one static
  wordmark image, and **generated images are refused on the meter**. **Structured data is blocked
  rather than skipped**: `Dataset` needs `distribution`, and the only honest answer is the one object
  013 confined all PI to. Asserted as eleven CI keys plus **one key on 024's existing `edge_drift`** —
  no rule, no seeded row, no migration — closing a blind spot 025's DNS-only/proxied split left
  behind: **nothing in the estate had ever observed `xerhero.com` itself**. `/sitemap.xml`
  deliberately gets no key, because under ISR a 200 assertion is green through precisely the failure
  it exists to catch. **Zero schema demand, zero backfill, and nothing enters `derived.json`,
  `activities.json` or `card`.** **Amended 2026-08-08** by
  [Do sector landing pages exist, now that ?sector= is uncrawlable?](tickets/034-sector-landing-pages.md):
  its flagged `/sector/{code}` item is settled as **deferred with a trigger**, and its own instruments
  cover the route for free. Its `Disallow` rules are **param-matched rather than path-matched**, so
  `/sector/rail?size=l` is disallowed the day the route ships with no edit to `robots.txt`; its
  pagination contract applies one level down unchanged; and its sitemap gains a class of URL **off
  rows it already selects**. Its canonical rule holds with a row added rather than changed:
  **`/sector/{code}` self-canonicalises while `?sector=` keeps emitting neither a canonical nor a
  `noindex`** — the mirror rule rather than an exception to it. The rule it derived from ambiguity —
  a canonical pointing elsewhere **or** a `noindex`, never both — is now **documented** by Google's
  own *"We don't recommend using noindex to prevent selection of a canonical page within a single
  site"*. And its central argument returns pointing the same way from the other side: because its
  sitemap lists every published programme directly, **a sector page adds zero URLs to the crawl
  graph** — what it buys is a ranking target, not a crawl path. **Amended 2026-08-08** by
  [How is a public page with per-viewer state cached?](tickets/035-caching-per-viewer-state.md): its
  crawler assumption is **confirmed rather than inherited**, and its own flag is corrected. A crawler
  is an ordinary CDN client receiving byte-identical signed-out HTML with the canonical and the
  `noindex` already in the `<head>`, and **no function runs** — which is only true because Cache
  Components is refused: under `cacheComponents: true`, *"HTML-limited bots skip the prerendered shell
  and render the page dynamically"*, turning every fetch of 10,300 sitemap URLs into an invocation
  plus a Neon query plus an R2 GET, which is this ticket's own OG-image argument applied to the page.
  Its final flag — that the shelf, `/u/{handle}` and `/contributors` *"carry no takedown property"* —
  was true when filed and **false by the time it closed**, because it gave `/u/{handle}` a `noindex`
  predicate over 016's eligibility gate; a cached contributor page would have kept serving `index`
  after a cascade. The defect closes by accident (the page paginates, so it was never cacheable),
  worth recording because the next such page might not. Its one-hour TTL gains a mechanism and an
  honest account: because ISR revalidation is request-triggered it saves almost no CPU on a
  10,300-URL long tail — **it was bought for takedown and delivers takedown**.

- [Do sector landing pages exist, now that ?sector= is uncrawlable?](tickets/034-sector-landing-pages.md) —
  **not in v1, and the trigger is a fact about the catalogue rather than about demand, because a fact
  about demand is what this estate has permanently given up.** The route is right and the shape is
  right; only the catalogue is wrong. The first finding is what it would actually buy: 033's sitemap
  lists every published `/p/{slug}` directly, so `/sector/rail` adds **zero URLs to the crawl graph**
  — it is a *ranking target*, not a crawl path, and under 030 a ranking target is permanently
  unverifiable, so the case for it has to be structural and known in advance. **Trigger: four of 015's
  eight codes each holding ≥ 25 published Programmes** — 25 is 009's page size, four is half the list,
  and together they imply a shelf at least four pages deep so the sector view is a subset rather than
  a re-render of `/`. The ticket's own warning about 030 is answered rather than accepted: **009's
  live conjunctive facet counts are the estate's one visitor-independent instrument**, bought so a
  sparse catalogue does not dead-end and printing the trigger on the front page in v1 at zero cost —
  no fifth rule, no `alarm_state` row, no migration. When it ships, **`/sector/{code}` is canonical
  and `?sector=` stays `Disallow`ed emitting nothing**, which is 033's mirror rule rather than an
  exception to it; 009's path-segment rejection **splits**, the multi-select half surviving as the
  route's shape and the duplicate-content half dying. An empty **or unknown** code **404s** on
  Google's own faceted-navigation instruction, and the 200-with-a-sentence option loses twice — Google
  calls an empty page a soft 404 anyway, and it buys a sentence 013 then has to police. Sitemap
  inclusion is the same predicate as the 404, `lastmod` = the newest published upload in that code.
  **No other facet earns this**, on a written rule (closed set we seed, single-valued, a noun somebody
  types, stable for a year). **Zero schema demand, zero backfill, nothing enters `derived.json`,
  `activities.json` or `card`**, and zero v1 build cost — nothing in v1's UI changes. **Amended
  2026-08-08** by
  [How is a public page with per-viewer state cached?](tickets/035-caching-per-viewer-state.md),
  which hands this ticket an argument it did not have: `/sector/{code}` is a **path** route, so under
  035's rule it is the only shelf-shaped view in the estate that *can* be cached — 009's query-param
  scheme makes `/` and every facet variant dynamic by construction. That strengthens the case on a
  dimension this ticket was not arguing about, and does not move the trigger.

- [The generator computes free float with the FS formula for every relationship type](tickets/032-generator-free-float-by-type.md) —
  **8 of 429 confirmed to the row and fixed, but the number that explains the defect is the other
  one: the clamp fired on 31 of 429 rows before and 1 after.** 028's count reproduces exactly, and
  seven of the eight were **spurious zeros** — the FS formula went negative, the clamp made it zero,
  and zero is the value 014 decision 4 reads as corroboration that a relationship is driving, so the
  error hid in the one direction that looks correct. Free float is now the slack each successor
  leaves **in the frame its own relationship constrains**, which is 028's per-type correction applied
  to the one quantity in `backwardPass` still computed with one type's rule. **028's third
  measurement is answerable at last and the answer is no**: `free_float_hr_cnt == 0` never vetoes a
  correct non-FS driving relationship, zero vetoes over 142 in-file driving relationships. The honest
  reading is stronger and less useful than *the corroboration works*: on any acyclic file it
  **cannot** fail, because the forward pass takes the max over exactly these four quantities — a fact
  about our CPM and not P6's, which is why **014 decision 4's FS-only scoping is unchanged and this
  ticket does not ask it to move**. **Bytes move for the first time since 022** — four corpus `.xer`
  files, **twenty byte-identical** — while `driving_path`, `members`, the 96.3%/98.1% aggregate and
  `derived.json` at **15,854** are untouched for the fourth ticket running. The defect's real cause
  is recorded rather than the defect: `free_float_hr_cnt` was written into every golden and
  **`--verify` never read it back**, so the fix that earns its place is one assertion rather than a
  fixture, and a generator reverting to the FS formula now scores **20/24**. The folded-in landmine
  sweep returns the most useful negative in the effort: every numeral in all 24 strings extracted
  mechanically, and **exactly one was wrong**, the one 031 had already found by reading — so the
  species is real but not endemic. The generator README gains the rule that produced it, in 022's
  shape: **a number in a `landmine` string must be a number its golden carries.** One transposition
  found and filed rather than fixed — the lag exposure figures behind 028's own framing are read from
  the wrong column of their source.

- [How is a public page with per-viewer state cached?](tickets/035-caching-per-viewer-state.md) —
  **the whole signed-out HTML is the cached artefact, nothing public reads the session on the server,
  and the decision turns out to be a middleware matcher rather than a rendering strategy**
  ([route table, endpoint, arithmetic, sources](tickets/assets/caching-and-viewer-state.md)).
  Vercel's Routing Middleware *"runs globally **before the cache**"*, so Clerk's documented matcher —
  which covers every page route — would put a billed invocation in front of every CDN hit and cost
  nothing visible but a meter; scoping it to `/me`, `/ops`, `/api` and `/__clerk` also makes the rule
  **enforce itself**, because `auth()` requires that middleware and therefore structurally cannot
  work on a public page. **016 is the closed decision that bends, on placement rather than content**:
  its combined viewer join survives verbatim as SQL and moves onto `GET /api/viewer`, one `neon-http`
  batch fired only when a session cookie exists — so **007's one-query rule is restored rather than
  bent**, and 023's *"the public cacheable path is untouched"* becomes the rule the whole public
  surface is built on. **Zero layout shift, and 007 is the reason**: 009 already drew the pill
  unpressed in the signed-out render, so the response changes a fill inside a box that exists. The
  per-route table reduces to one property — **a public route is cached exactly when its content is a
  pure function of its path** — so the programme pages are ISR at 033's hour while `/`, its query
  variants and `/u/{handle}` are **dynamic, not by preference**: `searchParams` is a request-time API
  that opts a page into dynamic rendering. That yields the invariant 033 was reaching for — every
  route with a status-derived head tag is either bounded at an hour or not cached at all — and
  corrects 033's own flag, since `/u/{handle}` acquired a takedown property the moment 033 put a
  `noindex` on it. **A crawler is confirmed to be an ordinary CDN client**, and that confirmation is
  what **refuses Cache Components**, under which HTML-limited bots render dynamically and every fetch
  of 10,300 sitemap URLs becomes an invocation. **The sharpest inversion: a tombstone needs no active
  invalidation and *publish* does**, because 005's immutable slug and 011's Programme-at-intent make
  `/p/{slug}` a live URL that 404s before its content exists, and ISR caches a 404. The rule is
  **invalidate where the write already runs in the app, rely on the TTL where it runs on the
  laptop**. **The cost arithmetic refuses to decide it**: ~31% of Active CPU cached against ~34%
  dynamic at the design target, because ISR revalidation is request-triggered — **the hour was never
  bought for CPU**; what the split buys is a hard 720-renders-per-URL ceiling, request collapsing,
  stale-on-failure, and a visitor who never waits on Neon. Two Hobby meters nobody had named surface
  on the way: **Fast Data Transfer (100 GB) and Fast Origin Transfer (10 GB)**, the second the
  tightest of the five. Asserted as eight CI keys plus **one key on 024's existing `edge_drift`**.
  **Zero schema demand, zero backfill, and nothing enters `derived.json`, `activities.json` or
  `card`.** **Amended 2026-08-08** by
  [Does a late-arriving pressed state read as a bug?](tickets/037-late-pressed-state.md): the
  unpressed flash is **judged tolerable and ships**, and this ticket's zero-layout-shift claim is
  measured rather than argued — but its Flagged line *"cannot cause a wrong write — the controls
  toggle against the server"* is **half wrong**. The controls are live before the response lands, so
  a mid-flight click writes and is then **reverted by a snapshot taken before it**, and the human
  answer to watching your own action undone is to click again — which toggles the true state off. So
  a client **dirty set** is added and the response fills only untouched controls, which generalises
  to every owner-conditional element in §4.3. Its §10 escape hatch `hidden` is **rejected on a fact
  only a build could surface** — the public vote count lives inside the pill, so hiding the control
  hides a catalogue fact from signed-in viewers alone — and `header-only`'s Clerk session claim is
  left unspent. Its **zero schema demand** no longer quite holds: the Cache Components refusal, dated
  here rather than made permanent, gains an observable trigger (**>800 ms on three consecutive
  sweeps**) and therefore **one seeded `alarm_state` row**. And its 400 ms working assumption is
  demoted from a budget to an aim, because 004's Neon autosuspends and nothing in the estate can
  hold it.

- [Recheck the lag and non-FS exposure figures against their source](tickets/036-recheck-lag-exposure-figures.md) —
  **transposed, and the casualty is a sentence rather than a number.** The DCMA table in the derived
  contract is headed `| Fixture B tender | Fixture A update |` and its row 3 is
  `Lags | 8.8% | 0.3%`, so lagged relationships are **8.8% of Fixture B and 0.3% of Fixture A** —
  confirmed three ways without the header (022's `PR_FS` counts reproduce row 4 to the decimal in the
  printed order, 009's 69% negative float fixes column 4 as the live contract, and leads and lags are
  the sign of one column). The non-FS row was always read correctly. So both of 014 decision 4's
  named approximations sit on **Fixture B**, and Fixture A — the only fixture decision 9's gate
  measures — carries **neither in quantity**, about twelve non-FS and eight lagged relationships in
  2,825. 028's answer that the gate needs no second fixture **stands**: ground 1 strengthens, ground 2
  is untouched, and ground 3 turns out to cover the non-FS hole only, because that hole is closed by
  construction while the lag residue is the one 028 built a repair for and rejected. What is
  withdrawn is decision 4's own claim that the lag limitation *"surfaces as oracle disagreement under
  decision 9 rather than hiding"* — true only under the transposed reading. The gate does not change
  and is now honestly described as **weaker than 028 believed**. Also names the trap: the source
  asset carries two fixture tables in **opposite column orders**.

- [Does a late-arriving pressed state read as a bug?](tickets/037-late-pressed-state.md) — **no, and
  the flash was never the hazard: the controls are live while the response is in flight, and 035
  examined that and got it wrong**
  ([prototype](tickets/assets/prototypes/037-viewer-state-delay.html)). Judged against a signed-out
  control: at **400 ms the fill-in reads as the page completing itself, at 1200 ms it does not**, so
  `plain` ships and 035 §4.4's zero-layout-shift claim is confirmed by measurement — ~300 probes,
  `Δx 0.00 · Δw 0.00 · Δy 0.00`, three variants, both pages, both themes. **`hidden` is rejected on
  something only a build could show**: the *public* vote count lives inside the upvote pill, so
  §10's *"a blank slot rather than a wrong one"* costs a signed-in viewer every count on the shelf
  while the magnitude bar beneath, not being a control, stays drawn. The **detail page passes** —
  035's guess that the shelf is the harder case holds — and 008's `min-width` on its labelled
  action cluster is **promoted from cosmetic to load-bearing**, since 007's fixed-slot rule covers
  an icon and says nothing about a `Save` → `Saved` label. The real finding is that 035's
  *"cannot cause a wrong write — the controls toggle against the server"* is **half wrong**: the
  write lands, then the response, a snapshot taken *before* the click, reverts the control, and the
  obvious human answer is to click again and toggle the true state **off**. So the fix is
  **merge, don't overwrite** — a client dirty set the response fills around, ten lines, no request,
  no contract change — and it generalises to every late-arriving snapshot in 035 §4.3. **400 ms is
  a target that can never be a guarantee**, because 004's Neon autosuspends and the tail is the
  database rather than the network; it becomes a **trigger instead of a requirement**, which is the
  only honest form left. Cache Components reopens at **>800 ms on three consecutive daily sweeps**,
  instrumented by 024's sweep timing **its own first Neon statement** — not the authenticated
  `/api/viewer` canary first proposed, which would have put a Clerk session in GitHub Actions to
  measure the leg with no variance in it. The residue is named: the sweep measures the **server leg
  only**, so it **floors** the number — a breach is certainly real, a non-breach proves nothing.
  Costs **one seeded `alarm_state` row**, exactly what 024 spent; no column, no backfill, no
  contract touched.

- [Verify the synthetic fixtures import into P6](tickets/021-verify-fixtures-in-p6.md) — **resolved
  without a licence, because the ticket's premise was wrong**
  ([working notes](tickets/assets/p6-substitute-validation.md)). It assumed P6 is the only instrument
  that can answer any of it; three substitutes reach most of it. **MPXJ 16.6.0** — an independent
  20-year-old reader — takes all 24 corpus files, `sparse-150` and all three perf fixtures with zero
  failures, agrees with the goldens exactly on **20 of 24**, and every one of the four differences is
  the fixture's own landmine firing. The **143 real exports are P6 artifacts already**, so the two
  exports the ticket asked somebody to *make* did not need making. And a **working-hour function
  validated against P6's own `total_float_hr_cnt`** — exact on every activity of all seven files
  sampled — is what licenses the arithmetic rather than asserting it. Four results land on closed
  tickets. **Both speculative calendar shapes are real** and the rule written around them is not:
  `0x7F` is **formatting, not structure**, real project calendars carrying none of it, which amends
  002 along with two shapes nothing emits (order-free shift attributes, unpadded hours). **Free float
  is per relationship type**, 280 of 281 SS cases against **zero** for the FS formula, which retires
  028's FS-only scope on 014 decision 4 and adds a floor at zero. **MPXJ silently returns one project
  of two** from the multi-project fixture, which is third-party evidence for 011's decision to reject
  rather than degrade. And `logic-float-path` is **half refuted**: order semantics confirmed, but path
  1 is the lowest-total-float chain and shares **no members at all** with the driving set — 014's
  central claim arriving unprompted in real data, and a sharper example than the corpus's own. Two
  robustness facts nothing had: multi-line free text is **unobserved** across all 139 real files, and
  **one of those 139 is 397,781 bytes of pure `NUL`** which MPXJ reads as `null` with no error at all.
  Corpus corrections are deliberately **not** made here, in the shape 028 used for 031/032 —
  [038](tickets/038-calendar-shapes-and-0x7f.md), [039](tickets/039-float-path-semantics.md),
  [040](tickets/040-zeroed-xer-file.md). What genuinely needs a licence is now a **small, sharp
  residue** — whether Oracle's *importer* accepts the files, the ~30 MB import time, and the v24/v25
  field sets — filed as [041](tickets/041-p6-importer-acceptance.md), which nothing waits on.

- [Correct the clndr_data rules and calendar goldens against real P6 evidence](tickets/038-calendar-shapes-and-0x7f.md)
  — the mechanical half of 021. `xer-format.md` gotcha 4 is corrected in all three places it was
  stated: **only the parentheses carry structure inside `clndr_data`; `0x7F` and whitespace are
  insignificant**. Two shapes nothing emitted are now written down and fixtured — **order-free shift
  attributes** and the **unpadded hour** — as is the trap that `day_hr_cnt`/`week_hr_cnt` cannot
  supply a day length. `buildClndrData` learned to emit either serialisation, and the new fixture
  **`cal-flat-no-0x7f`** carries one calendar written twice, `CA_Base` indented and `CA_Project`
  flat, which must decode identically. That fixture was needed because the old one was not enough:
  a reader built to the wrong rule reproduces the right answer on **every** calendar in
  `cal-clndr-data`, throws on the flat row of the new one, and — with only the separator claim fixed
  and the attributes still positional — returns a five-day week with **no working hours in it**,
  silently. `cal-clndr-data` drops `speculative: true`. Its residue, that the goldens assert calendar
  meaning in prose and nothing reads it back, is
  [043](tickets/043-calendar-golden-block.md). **Amended 2026-08-08** by that ticket: the residue is
  **closed and this ticket's own measurement becomes the corpus's**. A `calendars` block written from
  the packed working-time model, a `--verify` decoder sharing not one line with the generator, and
  `cal-flat-no-0x7f`'s two-rows-one-meaning claim asserted as the only decode-against-decode check in
  the corpus. The wrong-reader scores this ticket took with a throwaway harness are now reproducible
  from the committed goldens: positional attributes **26/27**, padded-hour matching **26/27**, `0x7F`
  as a record separator **2/27**. One of this ticket's own amendments is **itself falsified** — it
  required `measure.mjs`'s reason to read *"no calendar decoder in the measurement harness"*, and
  there is now a decoder, so the reason names the calendar ambiguity instead. The `state` never moved.

- [Correct logic-float-path to what P6's Multiple Float Paths output actually is](tickets/039-float-path-semantics.md)
  — **`float_path` ranks chains by total float, and path 1 is disjoint from the Longest Path.** The
  fixture built the two as the same chain, so a tracer conflating the two marks scored 100% on both;
  it now scores **0% recall at 0% precision**. Path 1 is 9 activities at −160 h, the
  `driving_path_flag = Y` set is a disjoint 10 at zero float and is **path 3**, and the intersection
  is empty read off the emitted bytes rather than off the model. The correction needed a mechanism
  rather than a relabelling: total float is measured against the nearest *binding* late date and the
  Longest Path drives the *finish*, so the two coincide unless something other than the project
  finish sets late dates — the file now carries a **`CS_MEOB` 20 working days inside a non-driving
  chain's own finish**, which is the ordinary way a real programme ends up this way. 014 decision 11
  is **restated, not overturned**: `float_path` validates **order** and never membership, so a second
  oracle agreeing on membership is now evidence of a **bug** rather than of correctness.

- [A zeroed .xer is a real shape — what does the scan do with it?](tickets/040-zeroed-xer-file.md) —
  **a `.xer` is readable only if its last record is `%E` and it carries no `NUL` byte anywhere;
  failing either is one guard, `unreadable`, and the file is rejected as a corrupt copy rather than
  as an empty or invalid programme.** Both arms are byte facts the scan already holds, and both were
  measured before being chosen: across the 139 real exports the **138 readable files contain not one
  `NUL` between them** and all 138 end `%E\r\n`. Neither arm is redundant — `%E` alone misses
  mid-file zeroing and cannot choose the message, `NUL` alone misses a clean interrupted transfer
  that simply stops. The ticket found the estate wrong in **both** directions. The zeroed file was
  never accepted, but 011's reject 3 fired and told the planner *"This export contains no
  activities"* — blaming their programme for a fault in their copy. And a **truncated export is
  accepted today**: perfect `ERMHDR`, whole tables, **zero** tokenizer problems, correct arity, right
  activity count, one owning project — and the continuation rule swallows the padding, so
  `UDFVALUE.udf_code_id` arrives as a 3,443-character value of which 3,442 are `NUL` with nothing
  reporting a problem. That is 021's MPXJ failure mode one level up: not *no error and no project*
  but **no error and half a project**. Two fixtures pin it, and `missing-taskpred` and
  `missing-calendar` stay acceptable — a sparse file ends with `%E`, a truncated one does not.

- [The two walks can disagree about the seed, and `why` cannot say so](tickets/042-seed-divergence-unnamed.md)
  — **the fifth cause is where the walk *starts*, and it is determined rather than incidental: it
  fires exactly where the truth's seed set ties across a finish milestone, the corpus holds two such
  ties, and both diverge — 2 of 2.** Both walks span remaining work back from the latest remaining
  finish ([014](tickets/014-compute-critical-path.md) decision 3); the truth reads *latest* in
  working hours and a file-reader can only read it in elapsed time, where a zero-duration milestone
  writes its finish **as** a start instant and so beats the tasks it finishes with by a night it does
  not own. Where that happens the readable walk begins somewhere else entirely, every activity both
  walks reach still agrees on its drivers, and `divergenceCauses` — which compares driving
  predecessor *sets* — has nothing to report: four real misses on `cal-flat-no-0x7f` with `why: []`.
  The reason it went unseen is the harmless one: `multiproj-two-proj-id` has seeded differently since
  the day it was written and costs nothing, because the seed it loses is the driving predecessor of
  the seed it keeps. Named as a fifth cause outranking the four, both seed sets stated against each
  other in a new `seed_agreement` block, and the corpus's central honesty claim is now **enforced
  rather than asserted** — a non-empty `misses` or `marks_in_error` beside an empty `why` fails
  `--verify`, and reverting the causes scores **26/27**. That is the **third** golden field written
  and never read ([032](tickets/032-generator-free-float-by-type.md)'s `free_float_hr_cnt`,
  [039](tickets/039-float-path-semantics.md)'s `float_path`), and the pattern is now a rule in the
  generator README. Nothing is repaired: a reader can see which rows are milestones and still cannot
  order 16:00 against the next morning's 08:00 without `clndr_data` arithmetic, which is the thing
  decision 4 exists to avoid — so this is
  [028](tickets/028-driving-test-relationship-types.md)'s residue arriving at the start of the walk
  instead of inside it. `why` goes from 9 entries across 5 files to **12 across 7**, not one `.xer`
  byte moves, and the corpus aggregate holds at 94.5% recall / 98.3% precision, 20 of 26 exact.
  Whether the tracer should seed where P6 seeds is measurable against the 139 real exports and is
  filed as [Does the tracer seed where P6 seeds?](tickets/044-tracer-seed-tie-break.md). **Answered
  2026-08-08** by that ticket, and the answer **inverts this one's expectation**: the seed rule loses
  nothing on any real file, because the tie it feared is exact. Everything built here survives — the
  fifth cause, `seed_agreement` and the `verifyCorpus` invariant are all correct *about the corpus*,
  which is what they describe — but the divergence they explain is `lib/tables.mjs`'s milestone
  instant rather than a property of a P6 export, so after
  [049](tickets/049-generator-milestone-instant.md) this ticket's fifth cause may have **no corpus
  instance at all**, and whether to keep it unexercised is a decision that ticket takes.

- [The goldens assert calendar meaning in prose only](tickets/043-calendar-golden-block.md) —
  **50 calendars now assert what they mean rather than that there are two of them, and the corpus can
  fail all three of 038's corrected rules for the first time.** Every golden carries a `calendars`
  block — the worked days, the shifts on each, hours per working day, and the exceptions with their
  decoded dates and whether each is worked: **350 day entries, 561 exceptions, 3 of them worked
  days**, plus `declared` (`day_hr_cnt`/`week_hr_cnt` as the row states them, empty and 56 against a
  decoded 40 on `cal-flat-no-0x7f`) and `serialisation`, which is a parser trap rather than a
  meaning. Written from intent by a route the obvious one did not allow: a `mutate` hook hands
  `tables.CALENDAR` a finished blob and leaves the model stale, so **`buildClndrData` records what it
  packed as it packs it** and `describe()` looks the emitted string up. `--verify` gained a
  `clndr_data` decoder sharing not one line with the generator, and each of 038's rules removed from
  it in turn scores **26/27 positional attributes** (a **minus eight-hour** day), **26/27 padded-hour
  matching** (four hours, and the exception working day gone), **2/27 with `0x7F` treated as
  structural** — both silent failures land on `cal-flat-no-0x7f` alone, which is exactly why 038
  built it. That file's own claim is asserted directly at last: `same_meaning_as` decodes **both**
  rows and compares them to each other, the only decode-against-decode check in the corpus.
  **`duration_working_days` stays `unavailable` and its reason was the thing that was wrong** — the
  decoder can convert a span but cannot choose the calendar, and every corpus programme splits its
  activities ten and ten across two whose answers sit **37–41% apart** (`wbs-flat`: 459 calendar days
  is **328** working days or **460**), with `default_flag` naming the calendar new activities inherit
  rather than the one a programme is measured on. `missing-calendar` keeps a reason of its own and is
  now a test rather than a promise. **27/27, no `.xer` byte moved, goldens +38.5% (453,769 →
  628,689).** What shape the stat should take is filed as
  [What calendar is `duration_working_days` measured on?](tickets/045-duration-working-days-calendar.md).
  **Amended 2026-08-08** by that ticket: **the measurement stands and the conclusion drawn from it
  does not.** Both instruments used here were the wrong ones — `default_flag` is absent from 12 of 14
  real files and names a **0-activity** calendar on one of the two that carry it, and the field that
  does name a programme's calendar, `PROJECT.clndr_id`, is right on **14 of 14**. The 37–41% spread is
  arithmetic on a shape the catalogue manufactures: every corpus programme splits ten and ten, and
  **no real programme in either set splits at all**. So *"the conversion needs one calendar and a
  programme has several"* holds for `CALENDAR` rows and fails for programmes. The state moves to a
  value on **25 of 27** corpus files; `missing-calendar` keeps this ticket's reason string and its pin
  unchanged, and the `--verify` assertion strengthens from *empty block ⇒ unavailable* to that plus
  *non-empty block ⇒ a value matching the golden*. This ticket's own `f|00:00|s|00:00` fixture shape
  turns out to be a **real** serialisation carried by 10 of the 14 files, and what it means is
  [048](tickets/048-elapsed-calendar-semantics.md).

- [Confirm the pre-upload scan on mobile Safari](tickets/029-confirm-scan-on-safari.md) —
  [020](tickets/020-client-parse-budget.md)'s three platform APIs measured in the two engines it
  could not reach: `Blob.stream()`, `CompressionStream` and `crypto.subtle.digest` are all present
  and **correct by use** in **WebKit 26.5** and **Gecko 153**, and the scan completes a 50.5 MB
  `.xer` in **535 ms in WebKit — faster than Blink's 634 ms** — at 360 / 190 / 234 MiB of process
  growth ([the measurements](tickets/assets/safari-gecko-scan.md)). The `ScanResult` is
  **byte-identical across all three engines on 27/27 corpus fixtures** and agrees with 012's goldens
  in each, so 011's multi-project discriminator and 040's readability guard are now cross-engine
  facts rather than Chromium ones. Three things fell out that nobody asked for: an **insecure origin
  deletes `crypto.subtle` and nothing else** — the exact false negative waiting for anyone testing on
  a phone over a LAN address; **`CompressionStream` output length differs by engine and in Gecko
  across runs of the same engine** (7,383,836 / 7,192,108 / 7,155,680 bytes on one file), which turns
  020's exact-content-length presign from prudent into **required** and adds the condition that a
  retry PUTs the same blob or re-presigns; and **020's capped-heap device proxy is a no-op outside
  Chromium** — measured by allocating 512 MiB under a nominal 16 MiB ceiling — so its "never produces
  the condition" argument is evidenced in Blink alone, where the scan survives 16 MiB and the
  retaining parse of the same file dies at 256, the ≥16× gap 020 claimed. **iOS Safari remains
  unmeasured and unmeasurable here**: the per-tab ceiling is enforced by the OS and no desktop engine
  has it, so it is filed as [046](tickets/046-ios-safari-scan.md), ten minutes on a borrowed handset.
  Harness committed as `tools/scan-bench/`, which 020's was not — and it is the estate's **first
  third-party dependency**, `playwright`, scoped to its own `package.json` so `tools/fixture-gen`
  keeps its Node-and-nothing-else promise.

- [What calendar is `duration_working_days` measured on?](tickets/045-duration-working-days-calendar.md)
  — **a programme has several calendar rows and exactly one programme calendar, and the file names
  it.** Across **14 real files** — ten Fixture A revisions and all four Fixture B variants — three to
  five `CALENDAR` rows apiece and the number of distinct `TASK.clndr_id` values is **1 on 14 of 14**,
  equal to `PROJECT.clndr_id` on **14 of 14**. 043's obstacle was measured on `default_flag`, which is
  **absent from 12 of the 14** and on one of the remaining two names a calendar holding **0 of 1,746
  activities**; and its 37–41% spread is the generator's own ten-and-ten split, a shape **no real
  programme produced**. So `time.duration_working_days` becomes the span on `PROJECT.clndr_id`'s
  calendar, carrying that calendar and `activity_share_pct` in the same object — the
  `critical_count`/`critical_threshold_hr` rule one field along — reporting on **25 of 27** corpus
  files at **71.1–72.8%** of span and on 14 of 14 real ones at **100%**, because both real programmes
  are seven-day jobs and the stat reports the number beside it. `unavailable` keeps 043's reason where
  there is no `CALENDAR` table and stays silent on the page; only `error` raises an `issues[]` warn,
  which finally makes the contract's own worked example reachable. **No hours in the field**: ten of
  the fourteen files carry a stock elapsed calendar written `f|00:00|s|00:00` that decodes to **seven
  working days of zero hours**, and `day_hr_cnt = 24` is the field 038 forbade trusting — while the
  other **44 of 54** real calendar rows are eight-hour, so DCMA 6/8's 44-days-at-8-hours holds after
  all. `derived.json` **v3**, `card` untouched, no backfill, +160 bytes. Working in
  [assets/duration-working-days.md](tickets/assets/duration-working-days.md); the build is
  [047](tickets/047-report-duration-working-days.md) and the one calendar nobody can read is
  [048](tickets/048-elapsed-calendar-semantics.md).

- [Does the tracer seed where P6 seeds?](tickets/044-tracer-seed-tie-break.md) — **yes, on 67 of 67
  real files, and the seed divergence is the generator's rather than P6's**
  ([working](tickets/assets/seed-tie-break.md)).
  [042](tickets/042-seed-divergence-unnamed.md)'s physics is right and its premise is false: P6
  writes a finish milestone at **its driver's finish instant** — a `TT_FinMile` sits at gap 0 on
  **98.3%** of live rows (n = 1,879) against a `TT_Mile`'s **46.4%** and a `TT_Task`'s **44.6%**,
  Fixture B 100% / 1.3% / 0.0% — and it is the *task's start*, and a Start Milestone's with it, that
  a non-working gap displaces. (This ticket's own headline was 96.4% of 28,695 over a selector that
  is not a milestone test; corrected by
  [057](tickets/057-correct-milestone-instant-figures.md), decision unchanged.) So the seed set ties
  **exactly**: 47 of 67 files tie, **47 of 47 mixed**, every file carries
  exactly one milestone row in its seed set and none seeds on a task alone. All 102 seeds on the 48
  files with a usable oracle are flagged, P6's own seed is inside our set **48 of 48**, and **0
  activities are lost**. Both candidates are priced and neither buys one: a one-shift window adds 12
  seeds, **3 marked and 0 correct**; seeding every remaining activity with no successor buys +15
  recall for +18,006 marked, precision 99.9% → **16.0%**. Not one line of `tools/fixture-gen`
  changed, `--verify` 27/27. The gate got run for the first time on the way, and **it is ambiguous in
  the place that decides its verdict**: a third of `driving_path_flag` is `TK_Complete`, so the
  tracer scores **65.6% recall against every flagged row and 98.6% at 99.9% against the rows inside
  decision 3's span** (10 of 48 files clear it against 46 of 48) — filed as
  [050](tickets/050-ship-gate-flagged-set.md). The flag can also be **stale**: five consecutive
  revisions carry a byte-identical 156-row flagged set while the data date advances five months and
  180 more activities complete. The generator's milestone instant is
  [049](tickets/049-generator-milestone-instant.md).

- [What does `f|00:00|s|00:00` mean?](tickets/048-elapsed-calendar-semantics.md) — 24 hours, and the
  rule is on the **finish**: **a shift finishing at `00:00` runs to the end of the day**. So
  `s|00:00|f|00:00` is 24 h, `s|08:00|f|00:00` is 16, and `s|08:00|f|08:00` is **zero and not a
  day** — the case a `finish == start` rule gets wrong. Not invented here: it is **MPXJ**'s, from a
  2017 release whose changelog names P6 as the cause. Swept over all **139** exports rather than
  fourteen, the shape is **137 `CALENDAR` rows in 136 files — 98.6% of every calendar-bearing
  file** — in **three** serialisations, and **no activity, project or resource** sits on one
  anywhere, so the arithmetic settlement genuinely does not exist and five other things decide it.
  The strongest: **`day_hr_cnt` agrees with the decoded shift pattern on 561 of 561 rows under this
  reading and 424 under the other, and the 137 disagreements are exactly the 137 zero-length
  calendars** — evidence rather than circularity, because Oracle documents that column as an
  unvalidated **conversion factor** that defaults to 8. `hours_per_working_day` is **24** and can no
  longer be `0`, so **no consumer gains a guard**, 043's `null` check now covers both cases and 045's
  division hazard stops existing; DCMA 6/8's hard-coded 352 hours is the one live constant to remove.
  Fixture **`cal-elapsed-24h`**, three rows — the real shape, the same calendar written the `CA_Base`
  way, and one `s|08:00|f|00:00` day which is the **only** thing separating the adopted rule from
  `f == s` and which incidentally gives the corpus its first ragged week, closing 043's `null`
  residue for free. Nothing in the corpus moves. The same sweep found **three real `clndr_data`
  shapes nothing in the estate parses** ([051](tickets/051-unparsed-clndr-shapes.md)), two of them
  silent; the build is [052](tickets/052-end-of-day-shift-rule.md).

- [Which flagged set does the ship gate score against?](tickets/050-ship-gate-flagged-set.md) — **the
  flagged rows that are not `TK_Complete`, pooled over the corpus, and the gate passes:
  `logic.longest_path` ships as a computed value** ([working](tickets/assets/ship-gate.md)).
  [014](tickets/014-compute-critical-path.md) decision 9 never had two gates — precision is **99.9%
  under both readings** because the walk marks no completed row by construction, so the ambiguity was
  a recall denominator and 1,733 rows of it. Scored: **98.6% recall at 99.9% precision, 47 missed
  rows in 3,447, 2 false positives in 3,402, and no chain broken that P6 keeps whole on 48 of 48**.
  The span-consistent choice is stated with its cost — the gate **can never argue against decision
  3's span** — and licensed by the counterfactual, which is measured: span removed, the same walk
  recovers **99.5% of every flagged row**. **Staleness is not the failure mode.** There are **eight**
  stale runs and not one — **22 of 48 oracle files** carry a flag written at an earlier data date,
  the longest run **nine revisions over eight months while 236 activities complete** — and **16 of
  the 22 score exactly 100%**; the set's one real failure carries a **recomputed** flagged set (5
  rows added, 5 removed), not the stale one. What costs recall is **out-of-sequence progress on the
  flagged chain**, a three-column test on the file: **`oosPairs == 0` ⟺ `recall == 100%`, 48 of
  48**, and it is a reported diagnostic rather than an exclusion because excluding on it would give a
  gate that scores 100% and cannot fail. **Nothing in the file dates the flag** — five `PROJECT` date
  fields empty on all 67, and `SCHEDOPTIONS.sched_float_type` is `FT_FF` on **67 of 67**, fresh and
  stale alike. Continuity is **run for the first time** and becomes an **agreement** clause: read
  absolutely it fails 2 of 48 not-started programmes where our answer is identical to P6's, read as
  *no hole we introduce* it passes 48 of 48. And the population is smaller than 044's file count
  suggests — the 67 files are **six programmes**, the oracle is **46 revisions of one plus two
  others**, so **98.3% of it is one programme sampled 46 times** and decision 9's *"one fixture, one
  contractor"* is nearly right about the evidence while wrong about the files. Clause 6 — a green
  corpus — **is satisfied**: [049](tickets/049-generator-milestone-instant.md) landed at 27/27 and
  improved the aggregate, so the only condition left on the verdict is the product tracer re-running
  these numbers. Whether a fresh Longest Path even contains completed work is
  [053](tickets/053-longest-path-includes-complete.md).

- [The generator writes a finish milestone where P6 does not](tickets/049-generator-milestone-instant.md)
  — **the corpus's seed divergence was ours, and it is gone: a zero-duration row now writes its
  finish where every other row does, at the end of the working hour it occupies.** `lib/tables.mjs`
  had emitted it as a *start* instant since
  [022](tickets/022-generator-longest-path-and-landmines.md), so a finish milestone landed at the
  next morning's `08:00` while the task it finished with sat at the previous afternoon's `16:00` —
  the opposite asymmetry to P6's, which [044](tickets/044-tracer-seed-tie-break.md) measured on
  **98.3% of 1,879 live `TT_FinMile` rows** (100% of 541 in Fixture B; the 96.4% of 28,695 this
  entry carried is corrected by
  [057](tickets/057-correct-milestone-instant-figures.md)). Both divergent fixtures stop:
  `cal-flat-no-0x7f` goes from four
  missed activities to **100% recall at 100% precision** and `multiproj-two-proj-id` keeps its ten
  members, taking the corpus from **181 / 174 / 171 to 181 / 178 / 175 — 94.5% → 96.7% recall at
  98.3% precision, 21 of 26 exact, and `why` back to
  [031](tickets/031-readable-walk-per-type.md)'s nine entries across five files**, with no rule in
  the readable walk touched. **370 date values on 41 rows across 23 files and not one file changed
  length**, `YYYY-MM-DD HH:MM` being fixed width; the four programme files that did not move are the
  four carrying no milestone. The ticket's own item 1 was **half a fix** — the start dates had to
  move with the ends, because `early_start_date == early_end_date` is what a milestone carries in a
  real export and splitting them emits a row finishing before it starts.
  [042](tickets/042-seed-divergence-unnamed.md)'s fifth `why` cause is **kept unexercised and is now
  unreachable rather than merely absent** — the emitted finish is strictly monotone in the working
  hour, so the two seed argmaxes coincide by construction (0 disagreements over 7,388 ordered
  pairs), and the only fixtures that could revive it are a per-activity-calendar CPM or a
  re-emission of the defect, which would assert a shape 044's 0.8% residue does not establish; what
  that costs is 042's own demonstration, since a corpus reverted to four causes now scores 27/27.
  And the reason a wrong rule survived six tickets is the one
  [032](tickets/032-generator-free-float-by-type.md),
  [039](tickets/039-float-path-semantics.md) and 042 each found once — **`early_start_date` and
  `early_end_date` sat in every golden and nothing read them back**, so a generator reverting to the
  old instant scored **27/27**; `--verify` now reads all four activity dates back by name and the
  same revert scores **6/27**.

- [028's `FF` milestone guard has lost its reason](tickets/054-ff-milestone-guard.md) — the exclusion
  is **inverted, not merely unjustified**, and [014](tickets/014-compute-critical-path.md) decision
  4's amended rule drops it. All **124** Fixture A `PR_FF` relationships with a milestone on exactly
  one side are an `FF` **into** a `TT_FinMile` — finish against finish, exact — and **not one
  `PR_FF` in 565 touches a `TT_Mile`**, the only shape the clause was right about. Oracle documents
  **no** `FF`-into-a-milestone semantics for P6 (no published forward-pass formula; *"milestones with
  invalid relationships"* flagged but never defined); the nearest text is a **Primavera Cloud**
  validation forbidding `FF` into a *Start* Milestone and `SS` out of a *Finish* Milestone, which
  acquits every real pair here. The floor's same-kind test is restated on **`task_type`** rather than
  zero span — a `TT_FinMile` writes a finish instant into both date columns (98.3% / 100%), a
  `TT_Mile` writes a start (46.4% / 1.3%, tracking tasks at 44.6% / 0.0%) — closing an `SS` hole
  nobody had looked at. Three things the corpus could not say: the clause is **live**, rescuing
  **117** candidates across **62 of 67** files, all dead weight (median 936 h slack, argmax on 0);
  **`early_start_date == early_end_date` is not a milestone test**, matching **26,325 `TT_Task`**
  rows of which 26,307 are complete; and the **oracle is silent** — **0 of 143** `PR_FF` on the 48
  oracle files touch a flagged row, so P6's Longest Path here is `FS` end to end. Score identical
  either way (102 seeds, 3,402 marked, 98.6% / 99.9%, 0 of 48 files differ), so it was decided on the
  rule rather than the number. Fixture specified, not built —
  [056](tickets/056-written-anchor-kind-floor.md); and the selector finding puts 044's headline
  figures into [057](tickets/057-correct-milestone-instant-figures.md).

- [Report `duration_working_days` on the programme calendar](tickets/047-report-duration-working-days.md)
  — **the field reports on 25 of 29 files, and the corpus can now fail four ways of getting it wrong
  that it could not fail before, because `PROJECT.clndr_id`, `default_flag` and the first `CALENDAR`
  row named the same calendar on all 27 files.** `measure.mjs` converts the
  `time.start_date`..`finish_date` window on the calendar the `PROJECT` row matching the activities'
  `proj_id` names, reporting `{ days, calendar, activity_share_pct }` beside a new
  `shape.calendars_in_use`; `--verify`'s calendar check inverts from *empty block ⇒ `unavailable`*
  (true of 2 files, silent on 25) to the **whole value compared field by field on every file**.
  Scored by removing each rule in turn: `default_flag` as the programme calendar **27/29** —
  `cal-default-unused` reports **213 days at `activity_share_pct: 0`** against a true **153 at
  100**, which is 045's real-file failure reproduced — first-row fallback **28/29**, window
  exclusive of its finish **4/29**, share assumed 100 **5/29** (the ten-and-ten split earning its
  keep on 24 files). Two fixtures: **`cal-default-unused`**, the shape both real sets have and
  nothing here could build — three calendars, all 20 activities on one, `default_flag` on a
  seven-day calendar carrying nothing — which also gives the corpus its only `same_meaning_as` pair
  with `identical_bytes: true`; and **`cal-project-clndr-absent`**, one field set to `841` with all
  three plausible fallbacks present and plausible. **The convention is whole days with both ends
  counted** — P6's own duration arithmetic, and the one 043 and 045 already used without saying so,
  reproducing 043's `wbs-flat` **328/460** exactly — which makes `span_calendar_days`, a
  *difference*, one short of the count beside it on the same tile
  ([058](tickets/058-span-difference-versus-count.md)). 045's *"a value on 25 of 27"* was **24 of
  27**: its own multi-project branch catches `multiproj-two-proj-id`. **29/29, no `.xer` byte
  moved**, corpus aggregate **197 / 195 / 191 — 97.0% at 97.9%, 22 of 28 exact** as the corpus grew
  by two files.

- [Does a freshly-run Longest Path include completed activities?](tickets/053-longest-path-includes-complete.md)
  — **yes, and it does not stop at the data date but at the start of the programme, so the completed
  third of the oracle is P6's current answer rather than residue**
  ([working](tickets/assets/longest-path-completed.md)). Filed as needing a P6 licence; **it needed
  none**. The instrument was [050](tickets/050-ship-gate-flagged-set.md)'s own count — the oracle is
  **46 monthly revisions of one in-progress programme** — and a revision whose flagged set is new to
  the corpus is a schedule run caught in the act. **Sixteen such runs added 494 rows and removed 416,
  and 276 of the added (55.9%) were already `TK_Complete` in the revision exported before the run**;
  A28 and A21 removed nothing and added **only** completed activities, 57 of 57 and 6 of 6. The case
  with no degrees of freedom left is **two exports of the same P6 project, six days apart at one data
  date**: +14 −2, ten of the fourteen already complete, finishing up to fifteen months earlier.
  Back-traced over all **1,733** flagged completed rows, **1,669 (96.3%) were already complete when
  the flag was written** and **62 (3.6%)** are residue. Two file-local tests agree: the **whole**
  flagged set is one component on **48 of 48** while flagged-remaining alone is one on 37 — the
  completed rows are the connective tissue on exactly 050's eleven `oosPairs` files — and the chain's
  tails are `TK_Complete` on **45 of 48**, the oldest flagged finish up to **1,376 days** before the
  data date. So [014](tickets/014-compute-critical-path.md) decision 3's span stands as a deliberate
  **restriction** of P6's answer and its clause *"which is what P6's Longest Path is"* is measured
  **false**, while 050's 65.6%-versus-98.6% gap is a difference between **two live answers** rather
  than stale marks. **The one file that runs the other way names its own cause**: A09 is 11.6%
  complete with 70 flagged rows all `TK_NotStart`, and it is the only export in 67 with
  `sched_progress_override = Y` / `sched_retained_logic = N` — six days later, retained logic
  restored, the chain had extended back through the completed predecessor of its own tail; n = 1,
  named and not adopted, and the only residue a licence would still settle
  ([061](tickets/061-progress-override-longest-path.md)). And **050's staleness reading loses its
  warrant**: byte-identity no longer implies an unrecomputed flag, because a retained chain yields
  the same set at every data date and **the nine-revision, eight-month run adds and removes not one
  activity and not one relationship** while 236 complete. Nothing 050 decided moves and no score
  anywhere changes.

- [044's milestone-instant figures are measured over a selector that is not a milestone test](tickets/057-correct-milestone-instant-figures.md)
  — corrected in four files, and **the map now carries the split rather than the pooled figure**:
  `TT_FinMile` **98.3%** (n = 1,879) against `TT_Mile` **46.4%** (n = 400) and `TT_Task` **44.6%**
  (n = 75,518). 044's *96.4% of 28,695* was a correct count over the wrong population —
  `early_start_date == early_end_date` with no status restriction admits 26,325 of Fixture A's
  105,028 `TT_Task` rows, 26,307 of them `TK_Complete` — so it was never a milestone-versus-task
  comparison. **044's decision, 049's change and every seed number are untouched**: `TT_FinMile` is
  the outlier under either measurement. Pooling is refused because it repeats the finding's own
  error — a `TT_Mile` behaves like a task. The standing selector rule (**`early_start_date ==
  early_end_date` is not a milestone test on a progressed programme; `task_type` is** — safe as a
  discriminator inside the walk, 18 disagreements in 81,848 live rows, unsafe as a population
  filter) is written into [014](tickets/014-compute-critical-path.md) decision 4, where it is used.
  Re-measured from the real exports by a fourth independently written reader. Seven further
  occurrences survive in six documents outside this map, four of them beside code — build backlog.

- [`span_calendar_days` is a difference and `duration_working_days` is a count](tickets/058-span-difference-versus-count.md)
  — **both fields become counts of one window and the calendar one is renamed to say so**:
  `time.span_calendar_days` → **`time.duration_calendar_days`**, the dates in
  `[start_date, finish_date]` with both ends in it, and `derived.json` goes to **v4**. The
  difference convention was not merely awkward but **false on 14 of 14 real files**, where a
  seven-day programme's working-day count exceeds its own calendar-day span by one; the corpus hid
  it because its programme calendar is five-day, and 043's table carries the contradiction inside a
  single row. Every span figure this effort has published for the real set was **already** the
  inclusive count, so the rename makes the field agree with the numbers rather than moving them.
  The rename carries the change because the JSON shape does not move — this is the first amendment
  to move a number an earlier version already emitted, and a version stamp is all a machine would
  see. Printing `span + 1` in the tile was refused (it makes the page a second source of truth for
  a published statistic); keeping both conventions was refused (043 quoted the contradiction three
  times without catching it). Zero backfill, one smallint, and 006 decision 6's lazy recompute runs
  for the first time. The corpus has never been able to fail this — asserted, the exclusive count
  fails 28 of 29.

## Not yet specified

- **Revision diff / schedule comparison.** Comparing two revisions — added and
  removed activities, duration and logic changes, date slip, critical path shift
  — is probably the feature planners care most about, and versions exist to make
  it possible. Can't be specified until the domain model and `derived.json`
  contract exist. Likely a v2 headline rather than v1 scope, but the schema
  should not preclude it. Both fixture shapes are now available to design against:
  Fixture A is a two-year monthly revision series, and Fixture B gives four **fork siblings**
  of one tender differing by under 0.4% of rows. The derived contract took one
  decision in advance for this — histogram buckets are **fixed, never adaptive**, so
  two revisions' distributions stay comparable. **Sharpened considerably by 008**, which
  built the seam it mounts into: `Compare…` exists and is deliberately inert, the URLs are
  already `/p/{slug}/r/{n}`, and the per-activity-fingerprint question is **answered — no**.
  A diff reads two `derived.json` files (whose buckets subtract) and, for per-activity work,
  two `activities.json` files keyed on `task_code`, which is in the v1 cut. What is left is
  genuinely a design question rather than a contract one: what a diff *shows*. The one
  constraint 008 leaves is a cost — two `activities.json` fetches is 680 KB gzipped, fine for
  an explicit compare action and not fine as a default, which is why compare is a button.
  **014 hands this patch the one comparison it could not previously make**: critical-path
  shift was in this list from the start and was undeliverable, because `longest_path` was
  usually `unavailable` and a diff needs the answer on *both* revisions. A computed trace is
  available on every scheduled file, so the driving path subtracts like the histograms do —
  and because the marking is a per-activity boolean in `activities.json` keyed on `task_code`,
  path-in / path-out is the same join the per-activity diff already does. What remains foggy
  is unchanged: what a diff *shows*.
- **The resource-units S-curve.** Cut from the derived contract v1 as a second chart
  with its own units and cost semantics. It would compute — 86% of Fixture B activities
  are resource-loaded — but it belongs with the detail-page design rather than the
  contract. **008 has now had its say and kept it out of v1**, on a sharper reason than
  scope: the page has exactly one time series, and putting a second one in different units
  beside it is the dual-axis mistake waiting to happen. So what remains here is not "should
  the page draw it" but the question that was always underneath — **what a resource unit on
  this site means** when it is a count of hours from one contractor's rate card, next to
  another programme measuring something else entirely. Nobody owns that question yet, and it
  has to be answered before the chart can be honest rather than merely drawable.
- **The Gantt viewer.** Deliberately out of v1, but not out of the effort. **The check this
  patch was waiting for has been done**: 008 froze `activities.json` v1 and priced the Gantt
  against it. A virtualised, time-scaled Gantt needs bars, rows and colour — **all already in
  the v1 cut** — plus exactly one table the cut does not carry, `TASKPRED` for dependency
  lines, measured at **+181 KB gzipped** over the lean cut's 340 KB at the 20,000-activity
  cap. So the contract is **Gantt-compatible, one named block short**, and adding a Gantt
  later is an additive fetch on the same object rather than a re-cut. What stays foggy is the
  Gantt itself — whether 521 KB before a pixel is drawn is acceptable, and what a Gantt over
  20,000 activities and 1,800 WBS rows even looks like when the shelf's own row-list finding
  was that planners judge shape rather than dates.
- **Near-duplicate programme detection.** Exact content-hash blocks byte-identical
  re-uploads from becoming new roots, but the same programme re-exported from P6 has
  different bytes and slips through. Accepted for v1. Needs a
  similarity model nobody has specified — plausibly the same machinery revision diff
  would want. **Sharper on one edge since 011:** a hash matching a *tombstoned*
  revision is now a hard reject, so exact bytes that were taken down cannot return —
  which means the gap this patch describes is exactly "a re-export of removed content",
  and that is a takedown-evasion question, not only a tidiness one. **016 removed this
  patch's other stated motivation outright**: it said near-duplicates would matter more
  once the leaderboard gave people a reason to bulk-upload templates, and under a split
  board bulk uploads move no ranking at all — 200 uploads buy 200 programmes with one
  self-vote each. So what is left here is shelf tidiness and takedown evasion, and the
  reputation argument is gone rather than deferred.
- **Curation.** Featured programmes, collections, verified/quality signals,
  whether anyone reviews uploads. The dependency it was waiting on — the ranking model —
  is now settled, and settled *against* curation for v1: the shelf ships no featured
  strip, no `curation_rank` column and no editorial ordering, because a rank column
  invites hand-ordering the whole catalogue and every curated surface needs signals that
  do not exist at launch. Still fog, but now fog with a floor: anything here is an
  addition to a shelf whose default order is frozen at newest-first. **Narrowed again by
  013's no-warranty standing decision**, which removes a whole branch rather than
  deferring it: **verified badges, quality marks and any "reviewed/checked" state are out
  of the effort entirely**, because the maintainer guarantees nothing and a badge is a
  guarantee wearing a different word. What remains foggy is the part that claims nothing —
  featured or thematic collections presented plainly as one person's picks.
- **Discoverability outside the app.** SEO for programme pages, OG cards, whether
  programme metadata should be crawlable or exposed as an API. Depends on the
  detail page and the derived contract. Several inputs are now fixed: URLs are
  `/p/{slug}` and `/p/{slug}/r/{rev_no}`, with the slug **immutable**, so links never
  rot and there is no alias history to canonicalise; the shelf is a **single canonical
  query-param route** with numbered, crawlable pages, chosen partly so a crawler has a
  path to every programme page at all; and **`/sector/{code}` landing pages are
  explicitly deferred here** — the shape to add is a rewrite onto the canonical query
  URL, not a second route with its own duplicate-content problem. **008 adds the input that
  mattered most**: everything above the activity table is **server-rendered from
  `derived.json`**, so a crawler sees the title, sector, licence, every headline number and
  the DCMA verdict without executing JavaScript — the programme page is crawlable by
  construction rather than by a later retrofit. The 340 KB `activities.json` is the only
  client-side fetch, and it carries nothing a crawler needs. **023 closes the URL set.** The
  crawlable surfaces are now fully enumerated — `/`, `/p/{slug}`, `/p/{slug}/r/{n}`, `/u/{handle}`
  (fixed there, having been demanded by 009 and specified by 016 without a URL) and the
  footer-linked leaderboard. Everything private sits under `/me`, behind Clerk middleware, so it
  302s for a crawler and needs no `noindex` header — the private surface adds nothing to this patch
  rather than complicating it. **024 adds the blob host**, which is the one hostname deliberately
  *not* crawlable: `Disallow: /` plus `X-Robots-Tag`, now written and asserted rather than assumed.
  **025 fixes the other half of every URL.** This patch has been accumulating path decisions —
  immutable slugs, `/p/{slug}/r/{n}`, canonical query-param shelf pages, the closed URL set 023
  delivered — while the **host** was never chosen. It is now `xerhero.com`, apex-canonical, with
  `www` and the `.vercel.app` hostname both **308ing to it** rather than merely deprecated: 009's
  immutable slugs promise a path that never rots, and two live hosts serving the same path is the
  only way that promise breaks, quietly, in other people's bookmarks. So OG cards,
  `<link rel="canonical">` and any sitemap have exactly one origin to name, and the blob host
  `blobs.xerhero.com` is the one hostname deliberately outside all of it. **027 reopens the URL set
  by exactly one class.** 023 closed it and 025 fixed the host; what neither enumerated is the
  site's **static pages** — 003's legal texts have never had routes, and Google's brand verification
  now requires a homepage that describes the app plus a privacy policy and terms of service
  reachable without login on the verified domain. These are crawlable surfaces by construction, so
  the sitemap and canonical-URL story this patch is accumulating has an unlisted member. Filed as
  [The site's static pages](tickets/030-static-pages.md). **030 closes that class and graduates half
  of this patch into a ticket.** The static pages are now enumerated members of the URL set,
  alongside `/contributors` (016) and `/report` (017). Google's *App home page* field takes the
  **apex, not `/about`**, because the automated brand check is a fetch that either page would pass
  while the manual fallback is a human typing the address they were given. 030 also produced the
  first canonical-tag *decision* in the effort (a current version's numbered URL canonicalises to the
  bare route; superseded versions are `noindex`), which is what made it visible that **nothing in
  this estate emits a `robots.txt`, a sitemap or a canonical tag for `xerhero.com` at all** — 013 and
  024 built both for the blob host, and a `robots.txt` governs only its own origin. That half is now
  concrete enough to be a ticket rather than fog:
  [The site's own crawl surface](tickets/033-site-crawl-surface.md). What stays foggy here is what it
  always was — whether programme metadata is exposed as an API, and everything that needs traffic to
  answer, of which there will be none. **033 closes this patch.** The concrete half is settled:
  `robots.txt` allows everything and disallows 009's facet space plus the authenticated surfaces; a
  cached sitemap route lists every published programme and every listable contributor; every
  indexable route emits a self-referential canonical, with three classes emitting something else; OG
  cards are text-only and carry no authored prose; structured data is refused because `Dataset`
  cannot name a `distribution` that is not the object 013 confined all PI to; and a tombstoned
  programme is `noindex` in both classes from the moment its row commits. The one path decision this
  patch had been carrying — `/sector/{code}` — graduates out of fog into
  [its own ticket](tickets/034-sector-landing-pages.md), sharpened rather than merely moved: 033 made
  the query form uncrawlable, so a path route is now the *only* shape a crawlable sector view could
  take. **What is left under this heading is not a discoverability question at all** — it is whether
  programme metadata is exposed as a public read API, which is a scope question about what the site
  offers rather than about how it is found, and it belongs beside the cross-project-querying patch
  rather than here. The traffic-dependent half is permanently unanswerable by 030's own choice.
- **Analytics and traffic measurement.** [The site's static pages](tickets/030-static-pages.md)
  decided **none in v1** — no Google Analytics, no Vercel Web Analytics, no Plausible, no pixel, no
  beacon — because the privacy policy could not be written without deciding it and 003 required
  analytics *"named rather than glossed"*. It is the cheapest honest name and it buys a page nobody
  has to build: with only Clerk's strictly-necessary session cookie, **there is no cookie banner and
  no consent management**, and a signed-out visitor receives no cookie from the site at all. The
  consequence is stated as a trade rather than discovered later: the operator will never know
  whether anyone reads `/about`, which pages are entered from search, or whether a programme page is
  ever opened — so every discoverability decision this map makes is unmeasurable by construction,
  and 019's Postgres-row observability covers ingest and takedown but nothing a visitor does. What
  is foggy is whether that ever becomes intolerable and what the cheapest instrument would be if it
  does. The floor is set: anything added here reopens the cookie question and costs a new version of
  **both** legal documents, which is the right friction and is why it is not free. **035 gives this
  patch its first cost consequence.** Every per-render Active CPU figure in the caching decision is
  an *estimate*, anchored on the only render anyone has ever costed, because 030 chose no analytics
  and Hobby keeps runtime logs for one hour — so nothing in the estate can measure a render. More
  sharply: 035 is the first decision in the effort where 010's **Active CPU** Pro trigger is within
  one order of magnitude of firing (~31% of the allowance at the 10,000-programme target, against
  033's 0.15% for the sitemap), and the variable that moves it is **traffic**, which is exactly the
  variable this patch made permanently unmeasurable. 024's refusal to watch the triggers still holds
  — Vercel mails the account owner — but the residue is that the operator will learn the number from
  a billing mail rather than from anything the estate can see. 035 also names **two Hobby meters
  nobody had looked at**, Fast Data Transfer (100 GB) and Fast Origin Transfer (10 GB), the second of
  which responds to *page weight* rather than to traffic and is the tightest of the five. **037 puts
  the first crack in this patch, and it is a narrow one.** The estate acquires its first *measured
  duration* — 024's sweep timing its own first Neon statement, against an 800 ms threshold — so the
  claim that nothing here can measure anything is no longer flatly true. But it measures the
  **server leg of a request nobody made**, on a schedule, which keeps it on the safe side of 030's
  line for the same reason 034's facet counts are: it is **visitor-independent**, so it needs no
  cookie, no beacon and no new version of either legal document. That is also its limit — it can
  tell the operator the database has gone slow, and can never tell them whether anyone was there to
  notice.
- **Cross-project querying.** "Every programme with more than 30d float on
  concrete." Excluded from v1 by the hybrid-ingest decision, and the cost check it
  was waiting on has now come back **negative**: the fixtures carry ~63,000 rows per
  revision, so full relational ingest at 10,000 programmes × 3 revisions is **~1.9
  billion rows, ~190 GB — about $66/month in Neon storage alone** against the hybrid
  model's ~150 MB and $0. Not settled as out of scope, because the feature may still
  be worth that price later, but it is now a priced choice rather than an open
  question. The domain model held the same line one level down: **the WBS tree is not
  relational either** — ~6M rows for a tree only ever read one programme at a time.
  **Full-text search over activity names now sits inside this patch too**: the browse
  ticket ruled it out of v1 for the same reason and at the same price, so it buys in or
  out with cross-project querying rather than as a separate question.
- **How authored sector templates get made.** Someone has to build them in P6 and
  export. Which sectors, how many, to what depth, by whom. Sharpens once the
  domain model shows what a template needs to contain. **012 put a third option on the
  table without meaning to**: the fixture generator authors structurally valid programmes
  with a real CPM pass and tunable densities, so launch stock could in principle be
  *generated* rather than built by hand in P6. That is a worse programme — no domain
  judgement in the logic — but it is available at zero marginal cost, and the honest
  comparison is between a handful of hand-built templates and a larger set of plausible
  synthetic ones. Whether a generated programme may be presented as launch stock at all
  is the first question, not the last. **015 has now had its say and refused the dependency
  in this direction**: the sector list is designed for the corpus, not for launch-day
  tidiness, so there is **no quota of one template per code** — an uncovered sector greys out
  under 009's zero-count rule and reads as *nothing here yet*, which is true. So the question
  *which sectors get authored* is free rather than forced to eight, and the eight codes are
  a menu rather than a checklist. What stays foggy is unchanged, minus that constraint.
  **018 sharpens the generated option from available to demonstrated**: its dev catalogue is
  ~40 deterministic sector-tagged programmes spanning every facet bucket, which is the launch
  catalogue's exact shape and size, built for free. So *can we generate plausible launch
  stock* is answered yes on evidence rather than in principle. It also draws the line the
  question now turns on: that catalogue is **dev-only and never published**, precisely because
  a generated programme carries no domain judgement — and under 013's no-warranty posture the
  site would be publishing files it cannot describe honestly as anything. **Whether generated
  programmes may be presented as launch stock at all** is therefore the whole of the remaining
  question, and it is a disclosure question rather than a capability one. **034 confirms 015's
  refusal and puts it out of reach**: the sector landing-page route ships on a trigger of four codes
  holding 25 published Programmes each — roughly 100 programmes — which is deliberately far above
  anything hand-authored stock could reach, so no future ticket can reintroduce a one-template-per-code
  quota by arguing that it unlocks `/sector/{code}`.

## Out of scope

<!-- ruled beyond the destination; never graduates -->

- **Private programmes, organisations, per-row access control.** Ruled out by the
  public-by-default decision.
- **Self-hosting and a portable stack.** Ruled out by the one-hosted-instance
  decision; no docker-compose, no vendor-neutral abstraction layers.
- **Billing, paid tiers, monetisation.** Free to start; nothing in v1 depends on
  a payment path.
- **Sanitising real commercial programmes on ingest.** Launch stock is authored
  templates, so no scrubber is needed and its considerable risk is avoided.
- **Verified badges, quality marks and any "reviewed"/"checked" state**, on
  programmes or contributors. Ruled out by the no-warranty standing decision — the
  maintainer guarantees nothing, and a badge is a guarantee wearing a different word.
  Distinct from raw counts and computed scores (upvotes, DCMA), which report rather
  than endorse and stay in scope.
- **Screening uploads for personal data**, whether by blocking detector or by
  stripping. Ruled out by [Personal data in published .xer files](tickets/013-personal-data-in-published-files.md)
  on measurement: the detectable fields are empty in all 143 real files and the
  populated ones are undetectable, so a screen would fire on nothing while creating a
  promise the site cannot keep. Disclosure replaces it.
- **Sourcing a corpus of real public `.xer` files** (tender packs, teaching sets).
  Superseded by the authored-templates decision. Note this is distinct from
  ticket 001, which gets a handful of real files as parser *fixtures* — that is
  in scope and necessary.
- **Notifications, an inbox, read state, and any feed.** Ruled out by
  [The signed-in user's own space](tickets/023-signed-in-users-own-space.md). The site cannot mail
  anyone (010), and the two things it could ever need to tell an owner — a failed upload and a
  Class B tombstone — already have reapers attached, so a notice can be a predicate over rows that
  delete themselves rather than a stored, acknowledged object. `alarm_state` is the operator's
  equivalent and exists only because *its* rules have no natural expiry. Distinct from the one-line
  header notice, which is in scope and costs no storage.
- **External synthetic monitoring and uptime services** (UptimeRobot, Checkly, Betterstack and
  similar). Ruled out by [Operating and observing ingest](tickets/019-ingest-observability.md),
  which priced and refused an external dead-man's switch at the cost of a fifth hosted account, and
  again by [Verifying the production-only edges](tickets/024-verifying-production-only-edges.md),
  which reached every production-only behaviour from instruments already in the estate — CI, the
  existing sweep, and the operator's CLI — for $0 and no new vendor. The two things nothing can
  assert are GitHub account settings, which no monitoring service could see either.
- **A marketing surface** — hero pages, feature tours, testimonials, customer logos, a blog, a
  changelog, a roadmap page, a `/status` page, a newsletter or social accounts. Ruled out by
  [The site's static pages](tickets/030-static-pages.md), on two existing decisions rather than a new
  preference: 009 made the shelf the homepage and refused a hero, and the no-warranty standing
  decision bans the register most of these are written in — a status page that is hand-edited is a
  guarantee wearing a different word, and testimonials and logos are traction claims. The site's
  whole self-description is one lede, one `/about` and a six-link footer, and `/about`'s longest
  section is a list of what the site does not do.
- **Generated Open Graph images**, and any image rendered from row data. Ruled out by
  [The site's own crawl surface](tickets/033-site-crawl-surface.md) on two existing decisions. It is
  the first thing in the effort that could genuinely move 010's Active CPU trigger — an
  unauthenticated, enumerable, rasterising endpoint fetched by every link unfurler, against a 4
  CPU-hour allowance shared with the sweep, the presign, ingest and every page regeneration, with
  Vercel's own pricing doc naming *"image processing"* as the expensive case. And it would be a new
  image surface with its own rule, against 027's structural *nothing renders `user.imageUrl`*. One
  committed static wordmark card is in scope; anything generated is not, and the ban is a CI grep for
  `next/og` and `ImageResponse`.

### Ruled out 2026-08-08, on reaching the destination

The spec was written and the map closed. Ten open tickets were ruled out of scope in one act, on
one test: **none of them is a decision the spec is waiting on.** All ten are collected as jobs in
[the build backlog](../build-backlog.md), which is where the effort's remaining momentum goes.

- **Provisioning the production estate** —
  [Register the domain and provision the production estate](tickets/026-register-domain-and-provision.md).
  Execution, not a decision: every choice in it was already made by 025 and 027. It gates the build
  rather than the spec, and it is carried in full as the day-one runbook in spec §4. The one item
  on this list that a v1 launch waits on.
- **The two P6-licence questions** —
  [Does P6's importer accept the fixtures?](tickets/041-p6-importer-acceptance.md) and
  [Is progress override what confines P6's Longest Path to remaining work?](tickets/061-progress-override-longest-path.md).
  Both say *nothing waits on it* in their own text. Filed rather than deleted, because a licence
  may appear and both questions are sharp.
- **The iOS scan measurement** —
  [Does mobile Safari survive the cap-sized scan?](tickets/046-ios-safari-scan.md). Same footing:
  029 moved the residual risk down rather than up, and nothing waits on it.
- **Six development-corpus corrections** —
  [051](tickets/051-unparsed-clndr-shapes.md), [052](tickets/052-end-of-day-shift-rule.md),
  [055](tickets/055-rerun-mpxj-read.md), [056](tickets/056-written-anchor-kind-floor.md),
  [059](tickets/059-undecodable-calendar-fixture.md), [060](tickets/060-exception-working-day-in-window.md).
  The generator, its goldens and `measure.mjs` are a **development instrument the product never
  reads**, and they already serve as CI's only test corpus. Raising their fidelity is real work and
  is not a spec decision — which is the whole reason this boundary needed drawing: from 038 onward
  each of these tickets closed by spawning two more, and the effort's default motion had become
  corpus forensics rather than route to the destination.

The boundary is scope, not quality. Out-of-scope work never graduates: if any of it should be
resumed it is a fresh effort against a redrawn destination, not a resumption of this map.
