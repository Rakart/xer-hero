---
id: 005
title: Domain model and schema
type: grilling
status: closed
assignee: carlo
blocked_by: [002]
---

## Question

What are the nouns, and what does the database look like?

Fork lineage and revisions are already settled as day-one requirements, so this
ticket has to get them right — they are the parts that cannot be retrofitted
cheaply. Work it with `/domain-modeling` and write the result to
`docs/domain-model.md`.

Settle:

- **The core nouns and their boundaries.** A *programme* versus a *revision*
  versus an *upload* versus a *file*. Is a revision immutable? Does the programme
  own the identity and the revision own the content, or something else?
- **Fork semantics.** Does a fork point at a programme or at a specific revision?
  Can a fork be re-forked, and does lineage stay a tree or become a graph? What
  does the fork inherit — metadata, description, tags, licence — and what does it
  reset? Can a fork exist of a programme whose parent was later removed (see
  [Licensing, attribution and takedown](003-licensing-attribution-takedown.md))?
- **Ownership and identity.** Google sign-in gives a user. Does a programme belong
  to a user, and what happens when that user deletes their account? Is there a
  displayed author distinct from the account?
- **What lives in Postgres.** The columns of the programme row and the revision
  row. Which parsed facts are promoted to real indexed columns because the
  storefront filters on them, and which stay inside `derived.json`. That split is
  the crux — [The derived.json contract](006-derived-json-contract.md) settles the
  other side of it and [Browse, search, filter and ranking](009-browse-search-ranking.md)
  is the consumer.
- **Whether WBS is relational.** The WBS tree is small (hundreds of nodes, not
  thousands) and useful for navigation and filtering. Rows, or JSON?
- **Blob keys.** How a revision addresses its `.xer`, `parsed.json` and
  `derived.json`. Content-addressed or id-addressed — the choice decides whether
  re-uploading an identical file is deduplicated.
- **Tags and sector.** Launch stock is sector templates, so sector is load-bearing
  for browsing. Fixed taxonomy or free tags? Derived from the file or declared by
  the uploader?
- **Soft delete.** Takedown and account deletion both need it. Decide it here, not
  later.

### Already fixed by Licensing, attribution and takedown

[That ticket](003-licensing-attribution-takedown.md) closed with schema
consequences — take these as given rather than re-deciding them:

- Row fields `licence`, `terms_version`, `asserted_at`, `uploader_display_name`,
  `status`, `removal_class`, `removed_at`, `content_hash`.
- `uploader_display_name` is a **snapshot**, deliberately duplicated from the user
  record, not a live join. The user record carries a `display_name` separate from
  the Google profile name, which is never public.
- **Soft delete is settled in one direction:** bytes hard-delete, rows never do.
  A tombstoned row survives so the ancestry chain has no holes.
- **Account deletion does not delete uploads** — the account record goes, the
  snapshotted pseudonym stays.
- Fork lineage must support **subtree** queries, not just a parent pointer, because
  a Class B takedown cascades down the whole fork subtree and pages render the full
  ancestry chain.

## Resolution

Glossary in [docs/domain-model.md](../../domain-model.md). Everything below follows
from one split: **Programme is identity, Revision is content.**

The collision that opened the ticket: [The derived.json contract](006-derived-json-contract.md)
drafted a table named `programmes` carrying *both* `series_id` and `parent_id` on the
same row — so that row was really a revision, and the word "programme" already meant
two things in the docs. Splitting it is what every decision below hangs on, and it is
the one that cannot be retrofitted.

### The two nouns

**Programme** owns the URL, title, description, sector, owner, licence and its place
in the fork tree. **Revision** owns the bytes, the derived statistics, the rights
assertion and the tombstone state. One Programme, N Revisions, numbered from 1.

Why not one flat table with a `series_id`: a Class A tombstone leaves the page at its
URL showing "withdrawn by uploader" (003), and there is no row to hang that URL on if
the only rows are deletable revisions. Why not a third `upload` entity: 003 already
snapshots `terms_version` and `asserted_at` per upload, and every accepted upload
becomes a Revision, so the two tables would be 1:1.

### Fork lineage

**The fork edge points at a Revision, with the parent Programme denormalised beside
it.** The revision pointer is the truth and the programme pointer can never disagree,
because Revisions are immutable and each belongs to exactly one Programme.

The revision pointer is not decoration — it is what makes 003's revision-granular
Class B cascade correct. Fixture A is a two-year monthly series; if revision 17 is
tainted and someone forked revision 3, a programme-only pointer would tombstone a fork
that never contained the tainted content. It is also what lets attribution read
"forked from *Riverside Depot*, rev 3" rather than naming a moving target.

**Cascade closure is operator-scoped.** Default is broad — the whole parent Programme
and every descendant — because the real Class B complaint is "that is my confidential
programme", not "revision 17 specifically", and 24 monthly revisions of one contract
all contain the same job. The adjudicator may narrow to named Revisions; that
narrowing is the only reason the revision pointer exists. **Below a tainted Fork the
cascade is unconditional**: a Fork's first Revision *is* a copy of tainted bytes and
its later Revisions are edits of that copy, and deciding one purged the content needs
a content diff nobody has specified.

**Strictly a tree, not a DAG.** No merge in v1. A merge node has two ancestries, so
Class B taint arrives from either side and the subtree rule stops being a subtree;
CC-BY attribution becomes a lattice; and merging two `.xer` files is schedule
integration, not a button. Re-forking is unbounded — Fixture B's four tender variants
are fork siblings today, and a variant spawning its own variants is the same act one
level down. Forking *from* a tombstoned Revision is impossible, its bytes being gone,
but a Fork whose ancestor was later tombstoned keeps existing and renders "withdrawn
by uploader" in its chain.

**Lineage is a parent pointer plus a recursive CTE**, not a materialised path or a
closure table. At the cost model's 10k-programme ceiling with realistic depth ≤5, an
ancestry chain is ~5 uuid PK lookups and a cascade is rare. Worth recording that Forks
**never re-parent**, so a materialised path would be write-once and is therefore a
safe pure cache to add later if lineage ever gets hot — unlike the Programme/Revision
split, this one is cheap to retrofit.

`root_programme_id` is denormalised anyway, set at insert and self-referencing on
roots. One indexed equality gives the whole fork family, which is what "the other 3
variants of this tender" needs — and a CTE for a family listing on a *grid* would
break the derived contract's one-query rule.

### What a Fork inherits

A Fork is created **by uploading a file**, never by a clone button — planners edit in
P6, and 003's rule that an exact content-hash match becomes a fork only makes sense if
forking is an upload path. Nothing is copied server-side.

Title, description and sector are **prefilled from the parent as form defaults, then
owned outright**. Slug, uploader display name, terms snapshot, votes and revision
numbering all reset. Licence is re-stated rather than inherited — site-fixed CC-BY-4.0,
written onto the new row so a future licence change is never retroactive. Live
references are ruled out by the same argument 003 used for `uploader_display_name`:
editing the parent would silently rewrite the child, and a tombstoned parent would
blank it.

**New field: `change_note` on Revision.** CC-BY 4.0 requires indicating changes; 003
fixed that the site renders "modified from" but nothing captured *what* changed.
Required on a Fork's first Revision, optional on later Revisions of a series, and it
gives the revision list something to show besides dates.

### Ownership

**Only the Owner adds Revisions; everyone else Forks.** Collaborators are per-row
access control wearing a friendly name, ruled out by the public-by-default decision.
A wiki-style series would show a different snapshotted name per revision with nobody
owning the whole, which the leaderboard cannot credit.

`owner_user_id` is `on delete set null` — the schema expression of 003's position that
account deletion erases the personal data while the snapshotted pseudonym keeps
rendering credit. **No ownership transfer** in v1; nothing needs it and it would break
the snapshot story.

The Handle is **unique, case-insensitively** — it is the public identity, and two
contributors both rendering "uploaded by dave_planner" corrupts credit without anyone
intending harm. That opens one hole and closes it: since names are mutable and account
deletion hard-deletes the user row, a published Handle would become free to claim and
would retroactively credit a stranger on old Revisions. **`reserved_handle` is written
on rename and on deletion and never reassigned** — consistent with 003's own position
that the handle left behind is not personal data.

### The Postgres split

**Derived statistics live on Revision only; Programme carries `current_revision_id`.**
The derived contract's constraint was *one query*, not *zero joins*, and a PK join
satisfies it. The honest counter — Postgres cannot index across two tables, so
filtering on `sector` while sorting on `checks_passed` uses no composite index — is a
sub-millisecond scan at a 10k-row ceiling, and not worth duplicating twelve columns
and running every backfill twice.

The invariant that buys: **`current_revision_id` is the newest non-tombstoned
Revision**, repointed when a Revision is added and when the current one is
tombstoned; when every Revision is tombstoned the Programme is tombstoned too.

`sector` moved from the derived contract's draft onto **Programme** — it is declared
metadata, not a parsed fact. `p6_version` stays on Revision, being a fact about a file.

```sql
-- identity -------------------------------------------------------------
create table programme (
  id                   uuid primary key,
  slug                 text not null unique,          -- immutable, public handle
  title                text not null,
  description          text,
  sector               text references sector(code),  -- source: ticket 015
  owner_user_id        uuid references app_user(id) on delete set null,
  licence              text not null default 'CC-BY-4.0',

  parent_revision_id   uuid references revision(id),  -- authoritative fork edge
  parent_programme_id  uuid references programme(id), -- denormalised from it
  root_programme_id    uuid not null references programme(id),  -- self, if root

  current_revision_id  uuid references revision(id),  -- newest non-tombstoned
  status               text not null,                 -- published | tombstoned
  created_at           timestamptz not null
);

-- content --------------------------------------------------------------
create table revision (
  id                      uuid primary key,
  programme_id            uuid not null references programme(id),
  rev_no                  integer not null,
  uploaded_at             timestamptz not null,

  uploader_display_name   citext not null,   -- snapshot, not a join
  change_note             text,              -- required on a fork's rev 1
  content_hash            text not null,     -- indexed, deliberately not unique
  terms_version           text not null,
  asserted_at             timestamptz not null,

  status                  text not null,     -- pending | published | tombstoned
  removal_class           char(1),           -- A | B
  removed_at              timestamptz,

  p6_version              text not null,     -- facet
  activity_count          integer not null,  -- sort, range
  start_date              date,
  finish_date             date,
  data_date               date,
  pct_complete            numeric(5,2),
  is_baseline             boolean not null,
  checks_passed           smallint not null,
  checks_applicable       smallint not null,
  card                    jsonb not null,    -- display-only, GIN
  derived_version         smallint not null, -- staleness marker

  unique (programme_id, rev_no)
);

create table app_user (
  id            uuid primary key,
  google_sub    text not null unique,   -- auth identity, never shown
  email         citext not null,        -- identity + takedown correspondence only
  display_name  citext not null unique, -- the Handle
  created_at    timestamptz not null
);

create table reserved_handle ( name citext primary key, released_at timestamptz not null );
create table sector ( code text primary key, label text not null, sort_order int not null );
```

Three notes on the DDL:

- **`programme` ↔ `revision` FKs are circular.** Insert the Programme with a null
  `current_revision_id`, insert the Revision, update. Deferrable constraints if it
  ever needs to be one statement.
- **`root_programme_id` self-references on roots**, so family queries need no null
  branch.
- **`content_hash` is deliberately non-unique.** 003 turns a byte-match into a Fork,
  so two Programmes legitimately hold identical bytes.

Single auth provider, so `google_sub` sits on the user row; a `user_identity` table is
what you add the day a second provider lands.

### Blob keys

**Id-addressed, not content-addressed.**

```
p/{programme_id}/r/{revision_id}/original.xer.gz
p/{programme_id}/r/{revision_id}/activities.json.gz
p/{programme_id}/r/{revision_id}/derived.v{N}.json
```

Two settled facts kill content addressing. 004 already measured the blob bill at under
$1/month at 10k programmes and landed on *store forks as full copies*, so dedup buys
pennies. And 003's exact-hash rule means two Programmes legitimately share identical
bytes, while Class A withdrawal hard-deletes the parent's bytes and leaves the fork
intact — under content addressing that delete destroys the fork's file, and fixing it
means refcounting a store whose entire job is "these bytes are gone now".

`content_hash` remains a Revision column doing its 003 job. It is an index, not an
address.

Falls out of the layout: **a tombstone is one prefix delete**, and a Class B cascade is
N prefix deletes with no cross-referencing first. `derived.v<N>.json` version-stamping
is unchanged from the derived contract's decision 6.

**Stored URLs are dropped.** `xer_url` and `activities_url` from the draft table are
derivable from two uuids and a version integer, and stored URLs rot when the bucket or
CDN host changes. `derived_version` is kept, because it is the staleness marker.

### WBS is not relational

The full tree goes in **`activities.json`**; a **top-level-children summary** — name
plus activity count per first-level node, capped at 20 and flagged when truncated —
goes in `derived.json` so a breakdown chart renders on first paint without the big
fetch. This amends the derived contract; recorded there rather than silently.

Rows were the tempting answer and are wrong: ~10k programmes × ~3 revisions × ~200
nodes is ~6M rows for a tree only ever read one programme at a time. That is the first
step of the full relational ingest 004 priced at ~1.9 billion rows and ~$66/month, and
cross-programme WBS querying is out of v1 by the hybrid-ingest decision anyway. Putting
the tree in `derived.json` alone was the other tempting answer: it would spend 20–40 KB
of a 40–60 KB budget on navigation chrome, for a payoff Fixture B proves is not
guaranteed.

### Sector and tags

`sector` is a **single-valued, nullable, Programme-scoped** column constrained by a
lookup table rather than a Postgres `enum` — adding a sector should be an insert, not a
migration. Nullable because 015 may land on "derived, and sometimes underivable", and
because an upload must not be blocked on a dropdown the uploader cannot answer.
Single-valued because multi-value facets make counts and ranking ambiguous before
[Browse, search, filter and ranking](009-browse-search-ranking.md) has chosen a model.

**No free tags in v1.** Free tags need a crowd to converge, and a shelf of authored
sector templates curated by one operator converges on `highway` / `highways` /
`Highway`. `tags text[]` with a GIN index is a pure addition under the derived
contract's own escape-hatch protocol, paid when 009 asks for the facet.

**Amended 2026-08-07** by [Browse, search, filter and ranking](009-browse-search-ranking.md):
009 declined the facet, so **tags do not exist in v1** — sector is the only classification
axis and free-text search absorbs the rest. The fork-inheritance paragraph above said
tags were prefilled from the parent, contradicting this ticket's own DDL; that word is
now deleted.

### Status and what actually hard-deletes

`status` lives on **both** tables — Revision runs `pending → published → tombstoned`,
Programme is `published | tombstoned` and maintained by the same write that repoints
`current_revision_id`. A per-row "has at least one live Revision" subquery on every
browse page is the one join the one-query rule cannot absorb.

**`pending` earns its slot now** even though nothing uses it yet: Fixture B files are
6.8 MB and parse is not instant, and if the enum lacks the value then
[Upload and ingest pipeline](011-upload-ingest-pipeline.md) cannot choose an async
queue without a migration. One enum value is a cheap option to hold open.

**A failed parse writes no Revision row.** 006 fixed that ingest rejects only on
tokenizer failure; a rejected upload is a transient error to the uploader, nothing
links to it, so nothing needs a tombstone.

003's "bytes hard-delete, rows never" and its "the account record is deleted" are both
true and apply to different tables. Stated once:

| Thing | On takedown | On account deletion |
| --- | --- | --- |
| Blob bytes | hard-deleted | untouched |
| Revision row | tombstoned, never deleted | untouched |
| Programme row | tombstoned, never deleted | `owner_user_id` → null |
| `uploader_display_name` | retained | **retained** — the pseudonym is what makes this work |
| Handle | retained | moved to `reserved_handle`, never reassigned |
| User row | untouched | **hard-deleted** |

### URLs

**`slug` is unique and immutable**, generated from the title at creation with a numeric
suffix on collision. `/p/riverside-depot-3`. Immutable is the load-bearing word: titles
are editable and owners rename, so a frozen slug means no redirect table, no link rot
and no alias history. A slug drifting from a renamed title is cosmetic.

Collision suffixes are the normal case rather than a failure — Forks prefill their
title from the parent, so a shelf reading `riverside-depot`, `riverside-depot-2` is
honest about what those are. A `/p/{id}/{slug}` shape was rejected because its slug can
never be linked to alone, making the pretty half inert; a bare uuid was rejected because
**Discoverability outside the app** is sitting in the map's fog waiting on exactly this.

Revisions are `/p/{slug}/r/{rev_no}`, unique on `(programme_id, rev_no)` — a planner
says "rev 12", not a uuid. A Programme's bare URL renders its Current Revision. The uuid
stays the PK and never appears in a link.

### What this hands to other tickets

- [Browse, search, filter and ranking](009-browse-search-ranking.md) — the grid is
  `programme join revision on current_revision_id`, one query. New facets are an
  `ALTER TABLE` on **Revision** for parsed facts and on **Programme** for declared
  ones; `tags text[]` is deferred to this ticket's call. **Answered 2026-08-07**: four
  facets (sector, activity-count band, `p6_version`, `pct_complete > 0`), **all already
  columns — no facet was added**. What it does add to `programme` is search:
  ```sql
  alter table programme add column search_tsv tsvector
    generated always as (
      setweight(to_tsvector('english', coalesce(title, '')),       'A') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'B')
    ) stored;
  create index on programme using gin (search_tsv);
  create extension if not exists pg_trgm;
  create index on programme using gin (title gin_trgm_ops);
  create index on programme (created_at desc, id desc);   -- the default sort
  ```
  No `tags`, no `checks_ratio`, no denormalised fork counter, and no per-column indexes
  on the Revision facets — this ticket's sub-millisecond-scan argument was accepted
  rather than pre-optimised around.
- [Where does a programme's sector come from?](015-sector-classification.md) — the
  column exists, single-valued, Programme-scoped, nullable, lookup-table constrained.
  Only its source is open.
- [Upload and ingest pipeline](011-upload-ingest-pipeline.md) — fork creation is an
  upload path, `pending` exists so async is available, a failed parse writes no row,
  and blob paths need the Revision id before the bytes are written.
- [Credit, upvotes and the contributor leaderboard](016-credit-upvotes-leaderboard.md) —
  Handles are unique and never reassigned; vote counters land on **Programme**. No
  columns added here for it.
- [The storefront card and browse grid](007-storefront-card-and-grid.md) and
  [The project detail page](008-project-detail-page.md) — Programme-level chrome
  (title, sector, fork family, ancestry) is separate from Revision-level stats, and the
  detail page has a revision list to render.
- [The derived.json contract](006-derived-json-contract.md) — amended: WBS top-level
  summary added, `sector` moved to Programme, stored blob URLs dropped.
- **Operator tooling** — a Class B cascade executed by hand against this schema is
  several correlated writes plus N prefix deletes. Raised as
  [What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md).

### Amendment 2026-08-07 — [Upload and ingest pipeline](011-upload-ingest-pipeline.md)

Five changes, none touching the Programme/Revision split. Four of them exist because
this ticket's `pending` reservation is now spent: ingest is async, so a Revision row
exists before its bytes have been parsed, and the schema has to describe that interval.

1. **`is_root_rev boolean not null default false` on `revision`**, set at insert (true
   when the programme is a root and `rev_no = 1`), with
   `create unique index on revision (content_hash) where is_root_rev`. This is the
   enforcement for 003's hash-blocks-a-new-root rule against the race 010 identified.
   An advisory lock was rejected because it needs an interactive transaction and 010
   chose `neon-http`, which is batched non-interactive only. **"`content_hash` is
   deliberately non-unique" above stays true for the general column** — two Programmes
   still legitimately hold identical bytes — and now carries this one carve-out.
2. **`content_hash` becomes nullable.** Null on the `pending` row; written once by
   ingest from decompressed bytes. A client-computed hash is never persisted, so
   enforcement lands on the write that carries trusted bytes.
3. **The Revision status enum becomes `pending | failed | published | tombstoned`**,
   with `ingest_attempts smallint not null default 0` and `failure_reason text`. This
   qualifies "a failed parse writes no Revision row" above: the *end state* is still no
   row, but a `failed` row lives for 24 h so the uploader gets an explanation. 010
   removed email from the system entirely, so an in-app row is the only channel left
   for a user whose tab was closed.
4. **New table `upload_intent`** — `revision_id` (PK), `programme_id`, `user_id`,
   `created_at` — written at presign. Without it, an R2 object whose upload form was
   abandoned has no row and is findable only by listing the bucket, which is
   O(objects) forever. It also hosts presign rate limiting.
5. **The circular insert defers its update.** `current_revision_id` stays null until
   ingest publishes, rather than being set immediately after the Revision insert. This
   is a small gift to 009: the grid is `programme join revision on current_revision_id`
   and an inner join drops nulls, so **a pending programme is invisible to the shelf
   for free**, with no status predicate anywhere.

### Amendment 2026-08-08 — [Credit, upvotes and the contributor leaderboard](016-credit-upvotes-leaderboard.md)

**"No columns added here for it" no longer holds.** This ticket recorded that vote counters
land on Programme and that 016 would add nothing. 016 kept the first half and spent the
second: the uploader became a **second votable object**, and a private bookmark became a
third table.

Additive, five items:

- `programme.vote_count` — denormalised, maintained on write, because 007's grid requires a
  stored total rather than a `count(*)`.
- A per-account **uploader vote counter**, on the same terms, for the leaderboard.
- `programme_vote (voter_user_id, programme_id, created_at)`, unique on the pair.
- `uploader_vote (voter_user_id, subject_user_id, created_at)`, unique on the pair.
- `bookmark (user_id, programme_id, created_at)`, unique on the pair, **no counter column**.

Both vote tables take `voter_user_id on delete set null` — the pattern this ticket already
uses for `owner_user_id`, and for a related reason: the rows are kept so the denormalised
totals stay reconcilable by `count(*)`, while the personal reference is erased. **Bookmarks
cascade-delete** instead, because they are private rows carrying nobody's credit.

The Revision stays unvotable, which is this ticket's Programme-is-identity split doing its
job: a vote is mutable Programme-level state, and putting it on immutable Revision content
would have smeared a two-year series across ~24 rows and still needed a rollup for the grid.

Nothing enters `derived.json`, `activities.json` or `card`, so this feature carries **no
backfill obligation ever**.

### Amendment 2026-08-08 — [What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md)

The ticket this one raised has come back with **one new table and two columns**, and with a
vindication of two choices made here.

```sql
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

alter table revision add column bytes_deleted_at      timestamptz;
alter table revision add column quarantine_purged_at  timestamptz;
```

`bytes_deleted_at` means *public bytes destroyed and CDN purge confirmed*. It exists so the
sweep's reconciler is a pure SQL predicate — `status = 'tombstoned' and bytes_deleted_at is
null` — rather than an R2 listing. **Quarantine expiry needs no column**: it is
`removed_at + interval '30 days'` where `removal_class = 'B'`, and `removed_at` is already
here from 003.

`takedown_report` puts an email address back into Postgres, which 010 had removed entirely.
017 accepted that on a distinction rather than a shrug: 010's argument was about *user*
email surviving an erasure right in a Neon PITR snapshot, and a complainant's contact is
retained correspondence evidencing an adjudication. Hence the 90-day purge of that one
field, with the rest of the row kept forever.

**Two choices here are load-bearing for the tooling.** Id-addressed blob keys make the CDN
purge list computable exactly — three deterministic URLs per Revision, no bucket listing —
where content addressing would have made it a search. And *rows never delete* is what makes
a half-applied cascade resumable: the fork tree stays structurally intact, so re-deriving
the affected set returns the same **membership** with some of it already tombstoned.

**A `pending_takedown` flag was considered and rejected** — a column plus an upload-path
predicate to freeze the subtree during the plan→apply window, which 017's diff-and-refuse
already covers.

Unchanged: the Programme/Revision split, cascade scoping, and the status enums. Class A
self-service withdrawal at both granularities is exactly this ticket's
`current_revision_id` invariant doing its job, with no new machinery.
