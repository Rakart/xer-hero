# xer-hero domain model

A public shelf of Oracle Primavera P6 programmes, exchanged as `.xer` files. The
users are construction and infrastructure planners, and most terms of art below are
theirs — programme, activity, WBS, logic, float, data date. Where this project has
to coin a word, it is defined here.

This file is a glossary. Schema, storage and UI decisions live in the tickets under
`docs/wayfinder/` and in `docs/spec.md`.

## Language

### The published unit

**Programme**:
One P6 schedule as published on the site — the thing that has a URL, a title, an
Owner and a place in the fork tree. It holds identity, not content.
_Avoid_: project (means a P6 `PROJECT` row), schedule, plan, series.

**Revision**:
One immutable published state of a Programme, created by a single upload. Holds the
content: the `.xer` bytes, the computed statistics, and the rights assertion made
when it was uploaded. A Programme is a series of Revisions, numbered from 1.
_Avoid_: version (reserved for the `derived.json` contract version and the P6
version), update, snapshot.

**Current Revision**:
The newest Revision of a Programme that has not been Tombstoned. What the browse
grid renders and what a Programme's page shows by default.

**Fork**:
A Programme created from another Programme's Revision, keeping a visible link to it.
Distinct from a Revision: a Revision continues the same Programme, a Fork starts a
new one. Created by uploading a file, never by a server-side copy — planners edit in
P6, not on the site.

**Root**:
The Programme at the top of a fork tree — one that was never forked from anything.
Every Programme names its Root, so "the other variants of this job" is one query.

**Change note**:
The uploader's own sentence describing what a Revision changed. Required on a Fork's
first Revision, where it is what satisfies CC-BY's obligation to indicate changes.

**Sector**:
The **asset class** a Programme belongs to — what is being built or maintained. One per
Programme, **declared by the uploader** (never inferred) from a fixed list of eight:
`rail`, `highways`, `aviation`, `marine`, `building`, `water`, `power`, `process`.
Optional; a Programme without one is **unsectored**, which is a rendering, not a sector —
there is no such code and no such facet chip. Owner-editable in place like the title, and
never a Revision. Method and phase words — tunnelling, fitout, shutdown, design stage —
are **not** sectors; they belong in the title or description.
See [ticket 015](wayfinder/tickets/015-sector-classification.md).
_Avoid_: category, tag, discipline.

### People

**Owner**:
The account a Programme belongs to. Only the Owner adds Revisions to it; everyone
else Forks.

**Handle**:
A contributor's public pseudonym, unique across the site and chosen at first upload.
Google sign-in is the authentication mechanism, never the public identity — the
Google name and email are never shown. A Handle that has been published is never
reassigned, even after the account behind it is deleted.
_Avoid_: username, display name (that is the column; the concept is the Handle),
author, real name.

**Uploader display name**:
The Handle as it stood at the moment a Revision was uploaded, frozen onto that
Revision. Deliberately duplicated rather than joined, so renaming an account never
rewrites past credit and deleting one never blanks it.

### Credit

**Upvote**:
A signed-in visitor's endorsement of a **Programme** — one per person per Programme,
toggleable, self-votes permitted. Public in aggregate (a count on the row and the page)
and private in attribution (who voted is never rendered). Ranks Programmes under the
opt-in `sort=votes`; it never affects the shelf's frozen default order.
_Avoid_: like, star, favourite, rating (a five-star rating was prototyped and rejected).

**Uploader vote**:
The same act aimed at a **Handle** rather than a Programme, and a wholly separate counter.
Castable only from that contributor's page. This is the one and only input to the
Leaderboard.
_Avoid_: follow, subscribe (neither is what this is — there is no feed).

**Bookmark**:
A private mark on a Programme, visible only to the person who made it. No count, never
rendered to anyone else, no bearing on any ranking. Deliberately a different object from
an Upvote: a vote is a public act, a bookmark is a private one.
_Avoid_: save, favourite, watchlist, like.

**Leaderboard**:
Contributors ordered by Uploader votes, on a page reached from the footer. It ranks and
never endorses — there is **no computed standing**, no blend of votes, uploads, forks or
downloads, and no badge, quality mark or "verified" state anywhere on it. A contributor
whose published, non-Tombstoned Programme count reaches zero is **delisted**; their votes
are kept, and publishing again relists them.
_Avoid_: score, reputation, rating, ranking algorithm.

### Removal

**Tombstone**:
A Revision whose bytes have been deleted but whose row survives, so the fork tree has
no holes. Two classes, behaving differently downstream: **Class A** is the uploader
withdrawing their own work and leaves Forks untouched; **Class B** is a rights,
confidentiality or personal-data complaint and cascades down the Fork subtree. Set by
[Licensing, attribution and takedown](wayfinder/tickets/003-licensing-attribution-takedown.md).
_Avoid_: delete, remove, unpublish.

## Terms inherited from P6

Defined by Oracle, not by this project; listed so the codebase spells them one way.
See [the format research](wayfinder/tickets/assets/xer-format.md) for the table and
field detail.

**Data date**:
The as-of date of a progressed programme — `PROJECT.last_recalc_date`. Everything
before it is actual, everything after it is planned.

**Longest path**:
P6's `driving_path_flag`. **Not** the same as critical, and only populated when the
scheduler was run with that option on.
_Avoid_: using "critical path" as a synonym.

**WBS**:
The work breakdown structure — the tree activities hang from. Not guaranteed to
exist: a real tender programme can carry a single node and 3,344 activities under it,
so depth 1 is a correct answer rather than an error.
