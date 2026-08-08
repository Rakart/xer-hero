# The signed-in user's own space — routes, queries and copy

Working detail for [ticket 023](../023-signed-in-users-own-space.md). The decisions and
their reasoning are in the ticket; this file is the mechanical half.

## 1. Route map

| Route | Auth | Renders | Order |
| --- | --- | --- | --- |
| `/me` | signed-in | every Programme you own, one line each, published and not | `programme.created_at desc` |
| `/me/bookmarks` | signed-in | 007 rows | `bookmark.created_at desc` |
| `/me/votes` | signed-in | 007 rows, then a short list of Handles | `programme_vote.created_at desc` / `uploader_vote.created_at desc` |
| `/me/account` | signed-in | Handle, rename, sign out, delete account | — |
| `/u/{handle}` | public | 016's contributor page, identical for every viewer | 009's shelf order |

All four `/me` routes are server-rendered, share one tab strip of four plain links, and
paginate with 009's `?page=N` at 25 per page. No facets, no search, no sort control, no
client state, no tab component. Bare `/me` is the default tab; there is no redirect.

Signed-out requests to `/me*` are handled by Clerk middleware and never render, so no
`noindex` header is needed and no crawler ever sees a private list.

## 2. The queries

**`/me` — two queries, deliberately not one.** The shelf's one-query rule is a property of
the grid at 25 rows × 12 fixed slots; this page renders neither.

```sql
-- 1. the Programmes
select p.id, p.slug, p.title, p.sector, p.status, p.created_at,
       r.rev_no, r.uploaded_at, r.removal_class          -- r = current_revision_id, may be null
from programme p
left join revision r on r.id = p.current_revision_id
where p.owner_user_id = $me
order by p.created_at desc, p.id desc
limit 25 offset $n;

-- 2. the newest Revision of each, where it is not published
select distinct on (programme_id)
       programme_id, rev_no, status, failure_reason, removal_class, removed_at
from revision
where programme_id = any($ids) and status <> 'published'
order by programme_id, rev_no desc;
```

Query 2 is what makes a failed *rev 8* visible on a Programme still published at rev 7.

**`/me/bookmarks`** is the shelf's row query with `join bookmark b on b.programme_id = p.id
and b.user_id = $me`, ordered by `b.created_at desc`. **`/me/votes`** is the same shape over
`programme_vote`, plus one flat select over `uploader_vote join app_user`.

**The header notice** is one `exists` per signed-in page render, and runs only when there is
a session — signed-out rendering is untouched:

```sql
select
  exists (select 1 from revision r join programme p on p.id = r.programme_id
          where p.owner_user_id = $me and r.status = 'failed')                     as has_failed,
  exists (select 1 from revision r join programme p on p.id = r.programme_id
          where p.owner_user_id = $me and r.removal_class = 'B'
            and r.removed_at > now() - interval '30 days')                         as has_removal;
```

Both windows are enforced elsewhere: 011's sweep reaps `failed` rows at 24 h, and 017's
sweep destroys the Class B quarantine at 30 days. Neither predicate needs a stored
acknowledgement, because the fact deletes itself.

**No new indexes.** 009 declined speculative per-column indexes at the 10k-row ceiling and
the same argument holds here. If anything on these pages is ever measured slow, the first
index to add is `programme (owner_user_id)`.

## 3. Line grammar on `/me`

One line per Programme. Fixed left-to-right, per 007's no-flow rule applied to a narrower
object: **title · state chip · clause · rev · sector · age**. The clause slot is empty for
an ordinary published Programme, which is the common case.

| State | Chip | Clause | Trailing link |
| --- | --- | --- | --- |
| published | — | — | — |
| pending (newest rev) | `Processing` | *Usually a few seconds.* | — |
| failed (newest rev) | `Failed` | `{failure_reason}`, verbatim | *Upload again →* |
| tombstoned, Class A | `Withdrawn` | *Withdrawn by you.* | — |
| tombstoned, Class B, complained-about | `Removed` | *Removed following a rights or personal-data complaint.* | — |
| tombstoned, Class B, cascaded fork | `Removed` | *Removed because a programme it was forked from was removed following a complaint.* | — |

The two Class B clauses are **017's public tombstone copy, verbatim**. Class A is
second-person because it restates the owner's own act and explains nothing. `failure_reason`
is 011's planner-readable sentence, already selected by query 2.

**`revision.failure_detail` never appears on any of these pages.** It is 019's
operator-only column, carrying an exception and a parse position, and `/ops` is its only
reader.

Every title links to `/p/{slug}`, which under 011's null `current_revision_id` already
renders `pending` and `failed` to the owner and 404s to everyone else.

## 4. Copy

**Header notice** — one line under the header, signed-in only, two variants. When both
conditions hold, the removal line wins.

- `A programme you uploaded has been removed. See your uploads →`
- `An upload didn't finish. See your uploads →`

Not dismissible; each expires with the clock behind it.

**Empty states**, following 007 §10 — name the reason, offer the one action.

- `/me` — *You haven't uploaded a programme yet.* → **Upload a programme**
- `/me/bookmarks` — *Nothing saved yet. The bookmark control on any programme saves it here.* → **Browse the shelf**
- `/me/votes` — *You haven't upvoted anything yet.* → **Browse the shelf**

**Rename**, on `/me/account`:

> Changing your Handle retires the old one permanently. Nobody can claim it afterwards,
> including you. Programmes you have already published keep the Handle they were uploaded
> under.

**Delete account**, on `/me/account` — 017's Class A guard-rail pattern reused: typed
confirmation naming the thing, plus the facts nobody expects, stated plainly.

> Type **{handle}** to confirm.
>
> - Your uploaded programmes **stay published**, credited to `{handle}`.
> - `{handle}` is retired and can never be claimed by anyone else.
> - Your bookmarks are deleted. Your upvotes stay counted but stop being linked to you.
> - This cannot be undone.
>
> To remove your programmes as well, **withdraw them first** — then delete your account.

That last line points at 017's existing Class A self-service button and adds no mechanism.

## 5. Account deletion sequence

010 fixed that deletion "collapses to two acts". The order is the one 017 chose for
takedown — **the reversible half commits first**.

1. One `neon-http` batch: `insert into reserved_handle`, then `delete from app_user`.
   `bookmark` and `upload_intent` cascade; `programme.owner_user_id`,
   `programme_vote.voter_user_id` and `uploader_vote.voter_user_id` go null.
2. Clerk Backend API `deleteUser`.

If step 2 fails, the user can still sign in and gets a fresh account with a fresh generated
Handle — which is what they asked for anyway. The reverse order would leave a row pointing
at a dead `clerk_user_id` with no way for the user to sign in and retry.

## 6. The `app_user` lifecycle

```
first authenticated write (vote | bookmark | presign)
  → ensureAppUser(clerkUserId)
      → insert app_user (clerk_user_id, display_name = generated)
         generated = 'planner-' || 6 hex chars
         checked against app_user.display_name and reserved_handle, regenerated on collision
first upload
  → 011's metadata screen carries a Handle field, first upload only,
    prefilled with the generated Handle, required like the title
```

Reads never create a row. `/me` for a signed-in user who has never written renders three
empty states.

## 7. Deliberately absent

- **No notification table, no read state, no inbox, no feed.** Section 2 explains why.
- **No facets, search or sort on any `/me` list.** 009's conjunctive counts exist because a
  sparse catalogue dead-ends; a list you assembled yourself has no dead ends.
- **No bookmark notes, folders or collections.**
- **No Programme-scoped write.** No withdraw button, no bulk action, no title or sector edit
  — those live at `/p/{slug}` where 015 and 017 put them.
- **No owner-only section on `/u/{handle}`.** One link, carrying no data.
- **No Clerk `<UserButton>`.** It renders the Google profile image, which is the
  `<img src>` personal data 010 removed on purpose.
