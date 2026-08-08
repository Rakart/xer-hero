---
id: 023
title: The signed-in user's own space
type: grilling
status: closed
assignee: carlo
blocked_by: [019]
---

## Question

Everything designed so far is public by construction. What does a signed-in person's own
private area look like, and where is it reached from?

Graduated from the map's fog by
[What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md),
which put a fourth tenant on a patch that was too coarse to ticket while it was three tabs
hanging off a contributor page. It now has four demands from four closed tickets, and the
question is statable.

**What wants this surface, as given:**

- **Bookmarks** — [Credit, upvotes and the contributor leaderboard](016-credit-upvotes-leaderboard.md)
  made the bookmark private throughout: no count, never rendered to anyone else. It has a
  control on the row and nowhere to be read back.
- **The voting record** — same ticket. Votes are public in aggregate, private in
  attribution, so the only place a person sees what they voted for is their own space.
- **Pending and `failed` uploads** — [Upload and ingest pipeline](011-upload-ingest-pipeline.md)
  keeps a `failed` row for 24 h precisely so a user with a closed tab learns why, and 010
  removed email, so an in-app row is the only channel left. A `pending` programme is
  deliberately invisible to the shelf (null `current_revision_id`), so it is invisible
  everywhere.
- **Cascaded tombstone notices** — 017 built no operator correspondence into the Class B
  flow, so an owner whose fork was destroyed by someone else's complaint currently learns by
  visiting. 017 recorded that gap here rather than solving it with a mailbox.

**What is already fixed and must not be re-decided:**

- The **contributor page is public** (016), footer-linked, and reuses 007's row. This ticket
  is about the *private* surface, and the relationship between the two is part of the
  question, not a given.
- 009 rejected a left rail; 007's row rules (fixed slots, nothing flows) apply anywhere a
  programme is listed.
- Clerk holds identity; the app stores no email and cannot send mail.

Settle:

- **Is it one screen or several?** "My uploads", bookmarks and the voting record are three
  different reading tasks. Tabs on one route, separate routes, or folded into the public
  contributor page with owner-only sections revealed when you are looking at your own.
- **Where is it reached from.** A nav item, an avatar menu, the contributor page. Note the
  site has almost no chrome so far — the shelf is the homepage.
- **What "my uploads" shows that the shelf cannot.** Pending, `failed` with its
  `failure_reason`, tombstoned (both classes, with 017's three copy variants), and the
  ordinary published ones. This is the only surface where a Programme's non-published states
  are visible at all.
- **Does a destructive notice need acknowledging?** A cascaded tombstone is a thing that
  happened *to* someone. Whether it is a passive row in a list or something that persists
  until seen — and if the latter, what stores that.
- **Whether the bookmark list needs anything the row does not already give.** 016 gave
  bookmarks no counter and no public surface; a list of saved programmes may be exactly
  007's row and nothing more.
- **What happens to this surface when the account is deleted.** 003 hard-deletes the user
  row while uploads stay published under a snapshotted pseudonym; bookmarks cascade-delete
  and votes go `on delete set null` (005/016). Confirm nothing here contradicts that.

Depends on [Operating and observing ingest](019-ingest-observability.md), which owns the
prior question of *which channel* tells anyone anything — including its own open bullet on
whether the uploader sees their own ingest failure. That decision picks the channel; this
ticket designs the surface.

### Answered by [Operating and observing ingest](019-ingest-observability.md)

019 closed and picked the channel. Three things are now given rather than open:

- **The failure surface already exists and is not this ticket's to design.** A Programme and
  its immutable slug exist from the moment of intent, and 011's null `current_revision_id`
  makes a pending programme unlisted for free — so `/p/{slug}` renders `pending` or `failed`
  plus `failure_reason` **to the owner** and 404s to everyone else. The upload flow polls the
  same row. **What this ticket owes is findability, not explanation**: with no email, a user
  who closes the tab has no way back to a URL nobody sent them, so "my uploads" is an *index*
  of pages that already render themselves.
- **`revision.failure_detail` exists and is operator-only.** It carries the exception and the
  parse position for the dashboard. It must never be rendered here — that is a deliberate
  split, not an oversight.
- **The private/privileged distinction is now three-way, not two.** 019 added a read-only
  operator dashboard at `/ops`, gated by an env-var Clerk-id allowlist. So the site has
  public surfaces, owner-private surfaces (this ticket) and one operator surface — and this
  ticket should not absorb the third. Notably, 019 kept the dashboard **read-only** and put
  every operator write in 017's CLI; whether this ticket's owner-facing surface takes the same
  posture is worth deciding rather than inheriting.

Still open here, untouched by 019: whether the cascaded-tombstone notice needs acknowledging
(019 built alarm suppression state for the *operator's* channel, `alarm_state`, which is a
precedent for "persists until seen" but not a mechanism this ticket can reuse — it is keyed by
rule, not by person).

## Resolution

**Four plain pages under `/me`, one header line, and the only thing this ticket writes to the
schema is the removal of seven `not null` constraints — because the four demands turned out to
need no table, no column and no job.**

Detail — routes, queries, line grammar, every copy variant, the deletion sequence:
[`assets/own-space.md`](assets/own-space.md).

The ticket arrived unusually well-prepared and the preparation held: 019 had already picked the
channel, 017 had already written the tombstone copy, 016 had already made the bookmark a private
object with a control on the row, and 011 had already made `/p/{slug}` render itself to its
owner. What was left was an index. What was *not* expected is that assembling the index found
four defects in the closed set, three of them blocking, and that the largest of them is not
about this surface at all — **the most common signed-in user on this site cannot exist under
005 as written.**

### 1. It cannot live on the contributor page, and the reason is not layout

The ticket offered three shapes: tabs on one route, separate routes, or folded into the public
contributor page with owner-only sections. The third is the one 016 actually chose — decision
10 put "two **owner-only tabs**: bookmarks, and the contributor's own voting record" on the
contributor page — and it does not work.

**016 wrote the argument against itself two decisions earlier.** Decision 8 rejected an earned
franchise because it "disenfranchises exactly the audience the site is for — planners who
download programmes and never upload one — and their votes are the ones carrying information."
And 003 fixes the Handle as *chosen at first upload*, which 016 restates plainly: "an account
that has never uploaded has no public page." So the two owner-only tabs were mounted on a page
that does not exist for the exact person most likely to have bookmarks and votes and no uploads.
The download-only planner is not an edge case here; under 013 and 009 they are the modal signed-in
user.

Two further reasons, either of which would be sufficient on its own. `/u/{handle}` is public and
identical for everyone, and branching a public render on viewer identity is the shape of bug that
leaks private data into a shared render path. And the two pages have different visibility
regimes — the contributor page shows published Programmes, `/me` shows things that must 404 for
everyone else — so merging them means one page carrying a per-row conditional over two regimes.

**So: separate routes, and `/u/{handle}` gains exactly one owner-conditional element — a link
with no data in it.** That amends 016. The public page never learns anything about its viewer
beyond the pressed states 016 already put on every row site-wide.

### 2. The defect underneath it: there is no row to hang a bookmark on

Chasing the Handle argument down one level produces something worse than a misplaced tab.

`bookmark (user_id, …)` cascade-deletes with `app_user` (016/005), and `app_user.display_name`
is `citext not null unique` (005) — the Handle. The Handle is chosen at first upload (003).
Therefore **a signed-in person who has never uploaded cannot be given an `app_user` row, and
cannot bookmark or vote at all.** 016 specified both controls for exactly that person. The
schema refuses them.

Keying the private tables on `clerk_user_id` instead was considered and rejected in one line: it
throws away the `on delete cascade` and `on delete set null` behaviour 016 chose deliberately,
and puts a vendor's identifier in five foreign keys.

**`app_user` is created on the first authenticated *write* of any kind — vote, bookmark or
presign — with a generated Handle, and 003's "chosen at first upload" becomes "confirmed at
first upload."** One `ensureAppUser()` upsert, three call sites, zero schema. The generated
Handle is never rendered anywhere until the account publishes something, because votes are
private in attribution and bookmarks are private throughout — so a placeholder Handle is
invisible until the moment 011's metadata screen asks the user to look at it, which is the same
screen and the same rule that already forces them to look at the prefilled title.

Reads create nothing: `/me` for a signed-in user who has never written renders three empty
states rather than a row.

Deliberately *not* done: a webhook. Clerk's `user.created` would work and costs a public
endpoint, a signing secret, svix and retry semantics, to move a row creation off the path that
already needs it.

### 3. Four routes, and every one of them is a plain page

`/me` · `/me/bookmarks` · `/me/votes` · `/me/account`, one tab strip of four links, 009's
`?page=N` at 25, server-rendered, no client state and no tab component. *Overturnable taste:*
the `/me` prefix, `/u/{handle}` for the contributor page (which this ticket fixes because it
must not collide), and account controls being a fourth tab rather than a footer on the first.

Tabs-on-one-route lost on a mechanical detail rather than a preference: three lists that each
need pagination cannot share one `?page`, and stacking them means three paginations on one
screen. Separate routes get 009's existing mechanism for free and keep the back button honest.

### 4. Reached from one header control, and it is not Clerk's `<UserButton>`

009 fixed the header as wordmark plus a permanent one-line strap, and nothing has been added to
it since. The signed-in cluster on the right is `Upload · {Handle}`, the Handle linking to
`/me`; signed out it is `Sign in`. Sign-out lives on `/me/account` rather than behind a popover,
which costs one extra click on a two-item menu that would otherwise need focus management and a
client component. *Overturnable taste.*

The obvious drop-in is refused on evidence: **Clerk's `<UserButton>` renders the Google profile
image**, and 010 removed avatars in v1 specifically so there is "no personal data in an
`<img src>`". Using the vendor's component would quietly reintroduce the thing that decision
removed. `<SignedIn>`/`<SignedOut>` plus our own link is the whole implementation.

The second entry point is the contributor page's one owner link (§1). There is no third, and no
nav item — the shelf is the homepage and 009 has already refused a left rail.

### 5. "My uploads" is an index — and 005 cannot store the rows it indexes

019 ruled that this ticket owes findability, not explanation, and that ruling holds all the way
down. `/me` is one line per Programme: title, state chip, clause, rev, sector, age. It is
**not** 007's row, and that is the finding rather than a shortcut. 007's row exists to be
compared down a column — twelve facts in fixed slots, nothing allowed to flow. Nobody compares
their own uploads to each other; they are looking for one. And a `pending` Programme has no
float sliver, no S-curve, no DCMA strip and no activity count, so 007's row would render it as
nine empty slots, which that ticket explicitly established "reads as missing data" rather than
as a state.

**The bookmark and vote lists keep 007's row**, because those genuinely are comparison surfaces
— the bookmark's stated use case is scan-and-shortlist-five.

The blocking defect: under 005's DDL a `pending` Revision **cannot be inserted**.
`p6_version`, `activity_count`, `is_baseline`, `checks_passed`, `checks_applicable`, `card` and
`derived_version` are all `not null`, and all seven are written by ingest, which by 011 runs
*after* the row exists. 011's amendment list to 005 caught `content_hash` and the status enum
and missed these. **Seven `not null` constraints drop.** Nullable is the honest encoding — a
pending row claiming `activity_count = 0` is a lie waiting to be joined against — and it is
invisible everywhere else, because 011's null `current_revision_id` already keeps every
unpublished Revision out of the shelf's inner join.

**`failure_reason` renders inline on `/me`.** This is not a second failure surface: it is one
already-selected column, and 019 itself accepted the same string appearing in two places when it
put it at `/p/{slug}` and in the upload poll — "one truth rendered in two places rather than two
explanations of failure." An index that says `Failed` and makes you click for the only sentence
you wanted is worse than no index. **`revision.failure_detail` never renders here**; `/ops` is
its sole reader, per 019.

Tombstones reuse **017's copy verbatim for both Class B variants** and no fourth variant is
written, because a fourth wording is operator correspondence wearing a list item, which 017
refused on purpose. Class A alone shifts to second person — it restates the owner's own act and
explains nothing.

Two limits, stated rather than hidden. `/me` is Programme-granular, so a tombstoned revision
inside a live series shows on that Programme's own revision list (008) and not here. And `/me`
is not a history: 011 reaps a `failed` row at 24 h, after which the upload is gone from this page
with no trace, which is 011's decision inherited rather than re-opened.

### 6. The acknowledgement question dissolves, because every notice already has a clock

This is the one thing 019 left open, and the answer is that **"persists until seen" is the wrong
axis.** The right one is *persists until it stops mattering*, and both notices this site can
raise already have a reaper attached.

- A **Class B tombstone** matters for exactly **30 days**, because that is 017's quarantine —
  the window in which `takedown reverse` can still restore the bytes. After it the bytes are
  destroyed and there is nothing anyone can do, including the operator.
- A **`failed` upload** matters for exactly **24 hours**, because that is 011's reap.

So: **a one-line notice under the header, signed-in only, for as long as the condition holds.
Not dismissible, no storage, no table, no column.** It links to `/me`, where 017's wording is
waiting.

`alarm_state` is the precedent the ticket asked about, and inspecting it is what settles this
rather than merely excusing it. 019 needed stored suppression because **its four rules have no
natural expiry** — a stranded tombstone stays stranded until someone acts, so 96 identical mails
a day is the failure mode and mutable state is the only fix. The owner's two conditions expire
on their own, on schedules the sweep is already running. Storage buys nothing when the fact
deletes itself. The shape of `alarm_state` transfers exactly — mutable "have I said this yet"
kept apart from the append-only fact — and the need does not.

Not dismissible is deliberate and is *overturnable taste*: the notice is a clock, and a dismiss
button lets you delete the only warning that the clock is running. Flipping it costs one column,
`app_user.notices_seen_at`, and a global watermark would be the right granularity because a
cascade tombstones a whole subtree in one event.

Covering `failed` was not asked for and is the better half of the bargain. 011's entire
justification for keeping a `failed` row for 24 h was that "a user with a closed tab" learns why,
and 019 supplied the page — but neither supplied a reason to *go and look*. One predicate on a
query that only runs for signed-in viewers closes both gaps at once. **Signed-out rendering is
untouched**, so nothing about the public, cacheable path changes.

Honest cost, stated plainly rather than softened: **a person who does not sign in for 31 days
never learns from the site that their fork was destroyed.** With no email there is no channel
that reaches someone who does not visit, and 017's gap was never that they could not be told —
it was that there was nowhere for them to be told. There now is.

### 7. The bookmark list is 007's row and one ordering column

016 asked whether the list needs anything the row does not already give. **It does not.** No
notes, no folders, no collections — each is a column plus UI for something nobody has asked for,
and 016 kept the bookmark deliberately featureless to keep it outside the gaming surface.

Three details that are not features:

- **Ordered by `bookmark.created_at desc`**, not `programme.created_at` — you want them in the
  order you saved them, and the column already exists in 016's DDL.
- **Un-bookmarking leaves the row in place, greyed, until reload.** 009 already argued this for
  facet counts: "a control list that shrinks as you filter jumps under the cursor."
- **A bookmarked Programme that was later tombstoned degrades to the same one-line removed
  treatment `/me` uses**, rather than vanishing. A saved item silently disappearing reads as the
  site losing it. Zero new copy — 017's lines again.

No facets and no search on any of these lists. 009's live conjunctive counts earn their place
because a sparse catalogue dead-ends into an empty state; a list you assembled yourself has no
dead ends.

`/me/votes` carries the Programmes you upvoted as rows, then a short flat list of Handles from
`uploader_vote` — 016 made the uploader a second votable object, so the record has two halves.

### 8. Not read-only — but no Programme-scoped write lives here

The ticket was right to say the read-only posture cannot be inherited unexamined, and examining
it gives a sharper rule than either answer.

019's dashboard is read-only for reasons that are entirely about *what the operator writes*:
cascading, irreversible, better wrapped in a transaction `neon-http` cannot open. None of that
describes a bookmark toggle. And the site already has owner writes everywhere — 015 made sector
editable in place, 011 makes revisions and forks an upload, 017 made Class A a button on the
owner's own programme, 016 put two controls on every row.

**The rule is not read-only, it is: `/me` writes nothing about a Programme.** Every
Programme-scoped write stays on that Programme's page, where 015 and 017 already put it. So
there is no withdraw control here, no bulk action, no edit, and no delete — a list of your own
work with a row-level destructive control is one misclick from an irreversible byte deletion,
and 017 spent a whole section on guard rails for exactly that button.

The two writes `/me` does host are about the *account*: rename the Handle, and delete the
account. The bookmark toggle on a row is the apparent exception and is not one — it is a write
about you, not about the Programme, which is precisely why 016 could put it on a public row in
the first place.

This is the same division 019 drew and worth naming as a pattern rather than a coincidence:
**the index and the operation live on different pages.**

### 9. Account deletion: nothing contradicts 003, and two things would have broken it

The ticket asked for confirmation. Confirmed, and it holds cleanly: bookmarks cascade-delete
(016), both vote tables null their voter and keep the row so `count(*)` stays reconcilable
(016), `programme.owner_user_id` nulls while the snapshotted `uploader_display_name` keeps
rendering credit (003/005), and the Handle moves to `reserved_handle` and is never reassigned.
`/me` after deletion is not a question — there is no session.

Two things would have failed on the way, neither of them noticed by the tickets that created
them.

**`upload_intent.user_id` is `not null references app_user(id)` with no delete action** (011),
so deleting an account with one outstanding intent raises a foreign-key violation. It takes
`on delete cascade` — intents are private and transient, exactly like bookmarks, and the sweep
reaps them at 24 h anyway.

**Nobody owned the mechanism.** 010 wrote that deletion "collapses to two acts: delete the Clerk
user, write the Handle to `reserved_handle`" and left it there. Those two acts need an order, a
surface and a failure story. The surface is `/me/account`, using 017's Class A guard-rail
pattern unchanged — typed confirmation naming the thing, plus the facts nobody expects, plus a
pointer to withdrawing first, which is 003's own two-separate-acts position rendered as a
sentence instead of discovered at deletion time.

The order is **017's**: the reversible half commits first. Our rows in one `neon-http` batch
(reserve the Handle, delete `app_user`, cascades and null-sets follow), then Clerk's
`deleteUser`. A failure after step 1 means the user signs in again and gets a fresh account with
a fresh generated Handle, which is what they asked for. The reverse order strands a row pointing
at a dead `clerk_user_id` behind an account that can no longer sign in to retry.

**No webhook**, for the reason in §2.

### 10. What this asks of the schema

**No tables. No columns. No new job. No new index.**

```sql
-- seven constraints removed: ingest writes these, and by 011 ingest runs after the row exists
alter table revision alter column p6_version        drop not null;
alter table revision alter column activity_count    drop not null;
alter table revision alter column is_baseline       drop not null;
alter table revision alter column checks_passed     drop not null;
alter table revision alter column checks_applicable drop not null;
alter table revision alter column card              drop not null;
alter table revision alter column derived_version   drop not null;

-- one foreign-key action, or account deletion raises a violation
alter table upload_intent
  drop constraint upload_intent_user_id_fkey,
  add  constraint upload_intent_user_id_fkey
       foreign key (user_id) references app_user(id) on delete cascade;
```

**Backfill: none.** These are constraint corrections to a pre-launch schema with no rows behind
them; there is nothing to rewrite.

**Nothing enters `derived.json`, `activities.json` or `card`.** Every fact on these four pages
is Programme-level, Revision-level or account-level mutable state, and the derived contract is
Revision-level immutable content — the same division 016 landed on, for the same reason. **No
backfill obligation, ever**, and nothing here can be invalidated by a recompute.

No new indexes, on 009's own rule that a per-column index is speculative until something is
measured at the 10k-row ceiling. If any of these pages is ever measured slow, the first index to
add is `programme (owner_user_id)`.

### Consumed by / amends

- [Credit, upvotes and the contributor leaderboard](016-credit-upvotes-leaderboard.md) —
  **amended**: the two owner-only tabs move off the contributor page onto `/me`, because the
  Handle exists only from first upload and the download-only planner 016 defended has no
  contributor page. The contributor page keeps everything else and gains one owner-conditional
  link carrying no data; its URL is fixed at `/u/{handle}`. The bookmark list needs nothing 007's
  row does not give.
- [What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md) —
  **amended**: the gap it recorded here closes. A blameless fork owner gets a header notice for
  the length of the quarantine window and 017's own tombstone line at `/me`. There is still no
  operator correspondence and no fourth copy variant.
- [Upload and ingest pipeline](011-upload-ingest-pipeline.md) — **amended**: seven `not null`
  constraints its amendment list missed, `on delete cascade` on `upload_intent.user_id`, a Handle
  confirmation field on the metadata screen at first upload only, and `failure_reason` rendering
  in the `/me` index as well as at `/p/{slug}`.
- [Domain model and schema](005-domain-model-and-schema.md) — **amended**: the same two DDL
  corrections, plus the `app_user` lifecycle, which was never specified — created on first
  authenticated write, not at first upload.
- [Licensing, attribution and takedown](003-licensing-attribution-takedown.md) — **amended**:
  "Handle chosen at first upload" becomes generated at first authenticated write and confirmed at
  first upload; account deletion gains a self-service surface and an order; the privacy policy
  gains bookmarks and votes.
- [Stack, hosting and auth provider](010-stack-hosting-auth.md) — **amended**: Clerk's
  `<UserButton>` is ruled out because it renders the Google profile image, and 010's two acts of
  deletion gain a mechanism, an order and a failure story.
- [Browse, search, filter and ranking](009-browse-search-ranking.md) — **amended**: the header
  gains a signed-in cluster and a notice line; the left-rail rejection and the strap are
  untouched, and `?page=N` is reused unchanged.
- [The storefront card and browse grid](007-storefront-card-and-grid.md) — **amended**: the row
  is used on the bookmark and vote lists and deliberately **not** on the owner's upload index,
  which sharpens what the row is for; un-bookmarking leaves the row in place until reload.
- [Operating and observing ingest](019-ingest-observability.md) — no change. Its read-only
  property is examined and found specific to the operator, and `alarm_state` is examined and
  found unnecessary rather than merely unusable.
- Legal pages — build work under 003's rule: the privacy policy names bookmarks and votes, what
  happens to each on deletion, and the self-service deletion path.
- **No new ticket.** 016's test applies: 007 and 008 earned prototype tickets by having a
  measurable open question, and there is none here — four server-rendered lists, two of which
  reuse a row that already exists and two of which are text.

### Flagged

- **Six calls are the dev's taste rather than a technical trade**, marked in place and listed
  here so they can be flipped in one line each: the `/me` prefix; `/u/{handle}` for the
  contributor page; account controls as a fourth tab; sign-out on that tab rather than a header
  menu; the notice not being dismissible (one column to change); and the generated Handle's shape
  (`planner-a3f92c`).
- **The header notice reaches nobody who does not sign in.** With no email that is structural,
  not a gap to fix later. The 30-day and 24-hour windows are borrowed from 017 and 011 rather
  than invented, so they inherit 019's flag: every threshold in this estate is reasoned and
  unevidenced.
- **A never-published generated Handle is still written to `reserved_handle` on deletion**, per
  005's unconditional rule. It reserves a random string forever for no benefit; the alternative
  is a conditional, which is more code than a row.
