---
id: 016
title: Credit, upvotes and the contributor leaderboard
type: grilling
status: closed
assignee: carlo
blocked_by: []
---

## Question

Contributors should be able to see who is contributing the most — upvotes on
programmes, and a leaderboard built from them. Surfaced while resolving
[Licensing, attribution and takedown](003-licensing-attribution-takedown.md),
which settled the identity this rests on but not the reputation model itself.

Already fixed by that ticket, and not up for re-decision here:

- Uploader identity is **public, durable and pseudonymous** — a `display_name`
  chosen by the user, snapshotted onto each programme row, never the Google real
  name.
- **No anonymous uploads**, so every programme has someone to credit.
- A **tombstoned programme stops contributing to contributor standing** in both
  removal classes; a Class B removal additionally **voids its votes**.
- **Exact-hash re-upload cannot become a new root**, which closes the laziest way
  to farm standing by republishing someone else's work.

Settle:

- **What is votable?** The programme, a specific revision, or the uploader? Voting
  a revision is precise but splits a series' score across a dozen rows; voting the
  programme means a two-year revision series and a one-off template compete on the
  same counter.
- **Who can vote, and how often?** Signed-in only is the obvious answer, but it
  means votes are as cheap as Google accounts. One vote per user per programme, or
  something weightier?
- **Is a vote an endorsement or a bookmark?** "Upvote" and "save for later" pull
  in different directions and are frequently the same button in practice. If they
  are separate, that is two counters and two pieces of UI.
- **How is contributor standing computed?** Sum of votes, number of programmes,
  forks-of-your-work, downloads, or a blend. Each rewards a different behaviour —
  a sum-of-votes board rewards one viral upload, a count-of-programmes board
  rewards bulk.
- **Does being forked count?** It is arguably the strongest quality signal on this
  site — someone took your programme and built on it — and the lineage data is
  already there.
- **What stops gaming?** Sockpuppet Google accounts, vote rings, bulk uploads of
  near-duplicate templates (exact-hash blocking does not catch a re-export). Decide
  what is actually defended against in v1 versus what is accepted.
- **Where does the leaderboard live in the product?** A page of its own, a rail on
  the storefront, or just a badge on the profile. This decides how much it shapes
  behaviour.

**Added 2026-08-07 by [The storefront card and browse grid](007-storefront-card-and-grid.md).**
The browse row now renders an upvote pill with a pressed state, so whatever this ticket
decides has to arrive in the grid's single query. Two constraints fall out, and they
narrow the "what is votable" question above:

- **A denormalised upvote total on `programme`**, not a `count(*)` over a votes table.
  Deciding to vote *revisions* is still allowed, but the grid renders the Programme, so a
  revision-granular vote has to roll up to a programme-level counter maintained on write.
- **Whether the signed-in viewer has already voted**, since the pill is pressed or not.
  One join against the viewer's own votes for the visible page, or the pill loses its
  state on the grid and only works on the detail page.

The grid deliberately does **not** show a fork count — 007 cut it — so "does being forked
count?" stays a leaderboard question, not a browse-row one.

**Coupled to [Browse, search, filter and ranking](009-browse-search-ranking.md)**,
deliberately without a blocking edge in either direction. Votes are an obvious
ranking input, and that ticket can proceed knowing an upvote count exists; this one
does not need the ranking model to decide what a vote means. If the two are worked
concurrently they need to agree on whether vote count feeds the default sort.

### Constrained by [Personal data in published .xer files](013-personal-data-in-published-files.md)

013 escalated a **no-warranty** standing decision onto the map: the maintainer
guarantees nothing, and nothing on the site may be worded as a guarantee. That rules
one branch of this ticket out before it is opened — **no verified badge, no quality
mark, no "checked" or "reviewed" state** attached to a contributor or a programme. A
badge is a guarantee wearing a different word.

Votes themselves are unaffected: an upvote count is a report of what visitors did, not
a claim by the site. The line to hold is that the leaderboard may rank, and may never
endorse — so any derived label above a raw count ("trusted contributor", "verified
planner") is out of scope rather than undecided.

## Resolution

**Two votable objects, two counters, two boards — and therefore no standing formula.**

The ticket's hardest-looking question was how to compute contributor standing: sum of
votes, count of programmes, forks-of-your-work, downloads, or a blend, each rewarding a
different behaviour. That question is **dissolved rather than answered**. A Programme is
votable and an uploader is votable, *separately*, and the leaderboard reads the uploader
counter alone. Nothing is summed, weighted or tuned. People vote for a person; the board
reports it.

This is the decision the rest of the ticket hangs off, and it is worth naming what it
buys. A blend would have the site asserting a quality model, which is precisely what
013's no-warranty standing decision forbids — a raw count reports, a weighted score
endorses. It would also need weights, and weights need a corpus to tune against, which
at launch is a handful of authored templates. The split board needs neither.

### 1. What is votable

**The Programme and the uploader, as two independent objects.**

The Revision is not votable. 005 had already put vote counters on Programme; a
revision-granular vote would smear a two-year monthly series (Fixture A is ~24
revisions) across rows nobody reads, and it would still need a rollup counter for 007's
grid — paying the rollup cost for worse semantics. The per-revision question "which
revision did people actually rate" is real, and it belongs to the revision-diff fog
patch, not to v1.

Fork behaviour is unchanged from 005: votes reset on fork, because a fork is a new
Programme.

### 2. The leaderboard reads one column

Programme votes rank Programmes — that is 009's opt-in `sort=votes`, and 009's frozen
newest-first default is untouched. Uploader votes rank contributors. The board is
`order by uploader vote count desc`, tiebroken by published programme count then Handle,
so it is deterministic.

**No blend, and no second sort key.** Adding one would be a formula wearing a table.

### 3. The eligibility gate

Decision 1 opens a hole 003 assumed shut. 003 fixed that *a tombstoned programme stops
contributing to contributor standing*, which works only while standing flows **through**
programmes. Under a direct uploader vote it does not: Class B every programme someone
owns and their rank is untouched. The operator's enforcement lever would stop at
programmes while the board — the thing 003 flagged as newly worth gaming — became
unreachable.

**An uploader whose published, non-tombstoned Programme count is zero is delisted from
the board.** Votes are retained on the row, simply not ranked; publishing again relists.
Partial takedown deliberately does nothing — 1-of-5 tombstoned changes no rank. Only
total removal delists.

This is the operative expression of 003's rule from now on. The tombstone-stops-standing
sentence in 003 is not wrong, it is **superseded by a mechanism**: standing no longer
flows through programmes, so the gate is what makes takedown reach the board.

The gate is narrow by construction rather than by choice. A Handle is chosen at first
upload (003), so an account that has never uploaded has no public page and is
unreachable for votes at all. The gate therefore only ever fires on the takedown case.

### 4. Endorsement and bookmark are separate objects

A vote is an **endorsement**. Saving for later is a **bookmark**, and it is a second,
distinct object rather than the same button doing double duty.

Conflating them corrupts the counter the boards read: people save what they have not
judged, and the number becomes a measure of intent-to-read. Keeping them separate costs
one control and one table, and it is what allows the vote to stay a clean public signal.

### 5. The bookmark is private throughout

**No count, no public rendering, owner-only.** A public "saved by 42" would be a second
popularity number sitting beside upvotes with nothing to distinguish it — visitors read
whichever is higher. Private also keeps bookmarks entirely outside the gaming surface:
nothing to farm, no takedown interaction, no board input, no contact with 003's rules at
all.

It has a **zero demand on 007's one-query grid** in data terms — there is no counter to
denormalise — and it gives the site a clean division that later decisions lean on:
**a vote is a public act, a bookmark is a private one.**

The cost taken knowingly: "most-bookmarked" is a decent quality signal, and one people
generate honestly because they are saving for their own use. It stays available as a
`count(*)` if there is ever a reason.

### 6. Where the controls live

**The bookmark control is on the browse row and the detail page**, which amends 007 and
008. A bookmark's use case is scan-and-shortlist — open the shelf, mark five candidates,
read them later — so detail-page-only would put the control at the moment it is least
needed.

This survives 007's rules rather than bending them. 007 banned facts landing at a
different x on every row; a control in a **fixed slot at a fixed x** is what that rule
asks for. The row already carries one control, the upvote pill, and 009 already fixed
signed-out behaviour for it (unpressed, click routes to sign-in) — the bookmark behaves
identically, so no new interaction pattern is introduced. **The one-query rule holds**:
vote-flag and bookmark-flag come back from the same per-viewer join over the visible
page's programme ids.

**The uploader vote is castable only from the contributor page.** Not from the row's
title cell, not from the detail page's attribution. Two upvote buttons on one screen
meaning different things is the most confusable UI this ticket could have shipped, and
the row has just spent its new slot on the bookmark. The consequence is accepted:
uploader votes will be far rarer than programme votes, so the board is built on the
scarcer signal — which is consistent with a board that lives in the footer.

### 7. Vote mechanics

- **Signed-in only**, inherited from 009's signed-out routing.
- **One vote per user per target, toggleable** — 007's pressed state is meaningless
  otherwise.
- **Self-votes are allowed.** This was initially recommended against and the objection
  was wrong: under the split board a self-vote on your own Handle is *one vote, once,
  ever* — a constant offset that reorders nothing — and a self-vote on your own
  Programme lifts that Programme's `sort=votes` position by 1 while touching contributor
  standing **not at all**. 200 generated uploads buy 200 programmes with one vote each
  and zero board movement. The bulk-upload attack was an artifact of assuming a blend.
- **A voter's account deletion keeps the vote rows** and nulls the voter reference
  (`on delete set null`, the pattern 005 uses for `owner_user_id`). Because the rows
  survive, `count(*)` still reconciles with the denormalised total and nothing becomes
  underivable. The only loss is that a nulled row no longer blocks a re-vote from a fresh
  account — one vote, and no defence for it exists anyway.
- **Bookmarks cascade-delete** with the account. Private rows, no public counter, nobody's
  credit depends on them.

### 8. What is defended against: nothing algorithmic

Decision 1 rewrote the threat model. Bulk uploads no longer move the board, so the single
live attack is **sockpuppet accounts voting a Handle up**, and Google accounts are free.

**v1 defends against it by hand, not by algorithm.** The operator voids votes on
complaint; the vote-voiding machinery already exists because 003's Class B voids a
programme's votes regardless. No rate limits, no minimum account age, no vote decay.

This is a position, not an omission:

- 003 already settled the enforcement posture — one operator, best effort, **no SLA
  promised**, stated honestly rather than pretending there is a process. Rate limits and
  decay windows are that same process wearing an algorithm.
- 013's no-warranty line means the board **may rank and may never endorse**. A defended
  board implies a defensible number.
- An earned franchise (only contributors may vote) was rejected as the expensive mistake:
  it disenfranchises exactly the audience the site is for — planners who download
  programmes and never upload one — and their votes are the ones carrying information.

**The real defence is structural: keep the prize small** (decision 9). Stated plainly so
nobody is surprised: someone with 20 Gmail accounts can top the contributor board on day
one, and the honest response is a manual void. If that ever becomes intolerable, the
cheapest escalation is a **rolling window** on the board — one `where voted_at > now() -
90d`, no new UI — and it is named here so it does not have to be rediscovered.

### 9. Where the leaderboard lives

**Its own page, linked from the footer**, with a rank line on each contributor page. A
rail on the shelf was never available: 009 chose a top filter bar precisely because a
left rail compresses the drawn columns 007 called a relief rule.

Footer placement is the structural half of decision 8 — farming 20 accounts to top a
footer-linked page is a bad trade, and no algorithm was needed to make it one. It also
matches what the site is: a shelf of programmes where credit is a property of the work.
Putting the board in the main nav would invert that, and every upload decision would
start routing through "does this help my rank" — the behaviour 003 flagged.

The cost is that the board motivates less, because most visitors never see it. That is
the intent.

### 10. The contributor page

009 already demanded this page (the Handle in the title cell links to it), so it exists by
inheritance; this ticket fills it. It carries the Handle, its upvote pill and count, the
rank line, the contributor's published Programmes rendered as 007 rows, a programme count,
a joined date, and a **fork-count fact** — and, under 013, **no badges of any kind**.

**Being forked shows up here and nowhere else, as a plain fact, never ranked on.** 007 cut
the fork count from the browse row, but its reason does not reach this page: 007 rejected
it because *the grid* needs every number denormalised to hold its one-query rule, which
meant a counter maintained on write. A contributor page is one page, one contributor, so
`count(*)` over programmes whose parent Revision belongs to this user is a **live join
nobody keeps in sync** — the cost 007 refused is not the cost this pays. It is not a board
column, because decision 2 admits no second sort key.

Two **owner-only tabs**: bookmarks, and the contributor's own voting record.

**The voting record is private.** This was recommended public — a public record is the only
thing that would make a vote ring visible to anyone but the operator, which matters when
decision 8 chose manual adjudication. Private was chosen instead, and the lever survives
because the sole adjudicator (003) has database access: **ring evidence stays with the
operator rather than being crowdsourced.** The division that results is clean and load-
bearing elsewhere in this ticket: **votes are public in aggregate and private in
attribution; bookmarks are private throughout.**

Renaming is unchanged from 003: uploader votes attach to the account, so the board follows
a renamed Handle, while each Programme keeps the snapshotted `uploader_display_name` it was
uploaded under.

### 11. What this asks of the schema

Additive, and it **amends 005's note that no columns were added here**.

- `programme.vote_count` — denormalised, maintained on write. This is 007's requirement,
  not an optimisation.
- A per-account uploader vote counter, denormalised on the same terms.
- `programme_vote (voter_user_id, programme_id, created_at)`, unique on the pair,
  `voter_user_id on delete set null`.
- `uploader_vote (voter_user_id, subject_user_id, created_at)`, unique on the pair, same
  null-on-delete.
- `bookmark (user_id, programme_id, created_at)`, unique on the pair, `on delete cascade`.
  **No counter column anywhere.**

The gate (decision 3) needs a published, non-tombstoned Programme count per contributor.
On a footer-linked board that is a live subquery, not a maintained column.

**Nothing enters `derived.json`, `activities.json` or `card`.** Votes are Programme-level
mutable state and the derived contract is Revision-level immutable content — so this
feature incurs **no backfill, ever**, and nothing here can be invalidated by a recompute.

### Consumed by / amends

- [The storefront card and browse grid](007-storefront-card-and-grid.md) — **amended**:
  the row gains a fixed bookmark control slot beside the upvote pill, and the per-viewer
  join returns vote-flag and bookmark-flag together. The denormalised total and voted flag
  this ticket owed are delivered. 007's fork-counter withdrawal **stands for the grid**.
- [The project detail page](008-project-detail-page.md) — **amended**: the action cluster
  becomes upvote · bookmark · Fork · Download.
- [Browse, search, filter and ranking](009-browse-search-ranking.md) — **amended**:
  `sort=votes` reads `programme.vote_count`; the contributor page it demanded is specified
  here. The frozen newest-first default is confirmed untouched, and the two tickets agree
  that vote count never feeds it.
- [Domain model and schema](005-domain-model-and-schema.md) — **amended**: three tables
  and two counter columns, against its "no columns added here for it".
- [Licensing, attribution and takedown](003-licensing-attribution-takedown.md) —
  **amended**: standing no longer flows through Programmes, so the eligibility gate, not
  the tombstone rule, is what makes takedown reach the board. Class B still voids a
  Programme's votes.
- **Near-duplicate detection** (map fog) — its stated motivation is now false. Bulk uploads
  of near-identical templates do not move the leaderboard under a split board, so
  near-duplicate detection is a shelf-tidiness and takedown-evasion question only.
- No new surfaces ticket. The contributor and leaderboard pages are a manifest of facts
  fixed above plus reuse of 007's row; 007 and 008 earned prototype tickets by having a
  measurable open question, and there is none here. The one thing nobody has thought about
  is noted rather than ticketed: these owner-only tabs are the product's first authed-
  private surface.
