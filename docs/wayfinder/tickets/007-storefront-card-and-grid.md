---
id: 007
title: The storefront card and browse grid
type: prototype
status: closed
assignee: carlo
blocked_by: [006]
---

## Question

What does a programme look like on the shelf?

This is the selling point, stated plainly: *browse other users' projects and .xer
data at a glance without opening the project*. If the card does not carry that,
nothing else in the app matters. Build it with `/prototype` — a real, clickable,
rough grid of fake programmes to react to, not a description of one.

The design question is what a planner can judge in two seconds. A card is small;
every element on it displaces another.

Explore at least:

- **The signature graphic.** Something small, dense and glanceable that says
  "this is a programme" — a mini S-curve sparkline, a WBS density strip, a
  duration bar, a float distribution sliver. Try several. This is what makes the
  grid look like a store rather than a table of filenames.
- **The facts.** Which six-to-eight from
  [The derived.json contract](006-derived-json-contract.md) actually make the
  card, and their visual hierarchy.
- **Identity.** Author, sector, licence, fork count, revision count, upload date.
  What is a badge and what is text.
- **Lineage on the card.** "Forked from X" is a strong browsing signal. Where does
  it go without dominating?
- **Grid versus list.** Dense grid, or a wider row that fits more facts? Try both
  at a realistic count — 40 cards, not 4. Also design the empty and single-result
  states.
- **Loading.** Cards must render from the Postgres row alone if possible; if a
  card needs `derived.json`, the skeleton state is part of the design.

Consult `/dataviz` before drawing any sparkline or chart — the card graphics are
the highest-leverage visualisation in the app and they must read at thumbnail
size and in both light and dark.

Link the prototype from the resolution and record which card layout won and why.

## Resolution

**There is no card. The shelf is a row list.**

Prototype: [`assets/prototypes/007-storefront-grid.html`](assets/prototypes/007-storefront-grid.html)
— 40 fake programmes, deterministic seed, with the two real fixture shapes pinned to
the top and four degenerate cases seeded in (unsectored, partially analysed, dateless,
310 activities). `?state=full|one|empty` and `?fields=1` for a provenance overlay.

### 1. The row beat the card, at both jobs

Four structurally different layouts were built and judged against 40 rows: poster grid
(S-curve as hero art), row list, verdict-first card (DCMA as a hero number), and a
time-rail grid on one shared calendar axis. The row list won **both** questions asked of
it — the one you scan and the one you click from — so the grid never needed two
densities.

The poster grid's failure is instructive: a card that leads with a picture spends its
best real estate on the fact planners judge *last*. Every fact on a row is worth more
than the same fact on a card because the row can carry twelve of them without
crowding, and vertical alignment lets the eye compare down a column rather than
re-reading each tile.

### 2. Shared calendar axis, rejected

The time-rail variant placed every programme on one 2016–2033 axis, so the grid itself
read as a calendar. Rejected: *when* a template ran is not a browsing signal — a shelf of
sector templates is judged on shape and quality, not on vintage — and a 14-month job
renders as a ~6% smear against a 17-year axis. Each row now gets a **local axis**: the
window is normalised to the column, so the reader compares programme *shape*, and the
absolute dates are printed as text at the ends.

### 3. The final row, left to right

| Slot | Contents | Source |
|---|---|---|
| float | 30px distribution sliver + three fixed numeric slots | `card` |
| programme | title, warning badges, handle, `forked from X` | columns |
| sector | badge, or `unsectored` | `programme.sector` |
| P6 | version, own column | `revision.p6_version` |
| upvotes | votable pill + √-scaled magnitude bar | **new — see 5** |
| rev | `r23`, one right-aligned slot | `revision.rev_no` |
| activities | count + fixed 10-slot track, 1,000 per slot | `revision.activity_count` |
| window & data date | S-curve on a local axis, elapsed/remaining split, marked data date | `card` |
| complete | `41%` over a progress bar | `revision.pct_complete` |
| DCMA | 14 cells (pass / fail / dashed skip) + `6/10` | `checks_passed`, `checks_applicable` |
| age | `3mo` | `revision.uploaded_at` |

Twelve facts, not the six-to-eight the ticket guessed at — the row affords it, the card
did not. **Nothing in a row is allowed to flow.** Rev, forks, P6 and the float percentages
were originally a prose sub-line and read as noise, because the same fact landed at a
different x on every row. They are now fixed slots with the header labelling each one.
Only two variable-length strings remain, both in the title cell: the handle and the
fork parent.

Magnitude encodings were prototyped three ways (√-scaled bar, free blocks, log rail).
The **fixed 10-slot track** won, with the fix that empty slots stay drawn — free-floating
blocks of 1,000 render a 310-activity programme as blank, and a blank cell reads as
missing data rather than "small".

### 4. Baseline is not a browse concept

Every `is_baseline` badge and "baseline · not started" caption was cut. It is load-bearing
*inside* the derived contract — it decides which DCMA checks apply — but on the shelf it
answers a question nobody browsing is asking. An unprogressed tender now simply reads
`0%`, and the DCMA cell strip carries its own denominator, so a 10-check programme is
never mistaken for a failing 14-check one.

### 5. Upvotes are a grid field, and the grid needs one number 016 has not defined

The row shows an upvote pill with a magnitude bar. A five-star rating was prototyped
first and **rejected as out of scope for this ticket to decide**: it would have rewritten
[Credit, upvotes and the contributor leaderboard](016-credit-upvotes-leaderboard.md),
which is scoped around upvotes. This ticket only fixes the *display*.

What 016 must now deliver for the grid to render in one query:

- **a denormalised upvote total on `programme`**, not a `count(*)` over a votes table —
  the grid's one-query rule cannot afford an aggregate per row;
- **whether the signed-in viewer has already voted**, since the pill has a pressed
  state. One join against the viewer's own votes, or it comes off the grid.

### 6. Fork count came off the row

The first draft carried `⑂3` beside the revision number. It is cut, which **withdraws a
schema demand**: nothing needs a denormalised fork counter on `programme`. Lineage still
appears where it is useful — `forked from X` under the title, which is a browsing signal
because it names a programme you may already know — and the fork *family* is a
detail-page and single-result-state concern.

### 7. What this puts in `card` JSONB

The grid reads zero blobs, so every graphic's data is a `card` key:

```jsonc
{ "s_curve": [16 floats, 0→1],        // the window curve, normalised
  "float_mix": { "neg": 69, "ok": 27, "high": 4 },   // percentages, sum 100
  "wbs_depth": 4,                     // renders the "no WBS" badge at 1
  "issues_count": 2 }                 // renders the "partial" badge
```

~200 bytes. This makes `card` a **payload rather than a bag of display strings**, and it
lands squarely on the derived contract's own backfill rule: these are card columns, so a
version bump that changes them needs an **explicit backfill**, not lazy recompute.

The curve is normalised 0→1 rather than stored as absolute counts, so it renders without
knowing the activity count and stays comparable between revisions — consistent with the
contract's fixed-bucket decision.

### 8. One honesty constraint the drawing exposed

Planners expect an S-curve to be **planned versus actual, two lines**. That is not
available: `derived.json` v1 carries one curve derived from dates, and actual-versus-planned
needs baseline tables neither fixture has — the same absence that skips DCMA 11, 13 and 14.
So the curve is *the shape of the programme*, and progress can only be a marker on it: the
elapsed portion is a heavier fill, the data date is a 2px rule with a marker and a printed
label. Drawing a second line would have been a lie the data cannot support.

### 9. Colour

Palette taken from `/dataviz` and run through its validator in both modes. The sliver's
three fills (`#d03b3b` negative, `#2a78d6` 0–44d, `#eda100` >44d) pass every gate; light-mode
amber sits at 2.11:1 against the surface, below the 3:1 floor, so the **relief rule
applies** — the three fixed numeric slots under the sliver are not decoration, they are what
makes that band legible, and they may not be dropped for density.

### 10. Empty and single-result states

**Empty** names the filters that produced it and explains the *reason* the combination is
empty when the data model makes it inevitable ("negative float can only appear on a
programme with progress"), offers the one filter worth clearing, and falls back to
"upload a programme". **Single result** keeps the row and adds a line pointing at the fork
family, since one result usually means you have found a variant of something.

### Consumed by

- [The project detail page](008-project-detail-page.md) — unblocked by this.
- [Browse, search, filter and ranking](009-browse-search-ranking.md) — the sortable columns
  are now fixed: activities, window, % complete, `checks_passed`/`checks_applicable`,
  upvotes, age. Anything else it wants to sort on is a JSONB→column promotion.
- [Credit, upvotes and the contributor leaderboard](016-credit-upvotes-leaderboard.md) —
  owes the grid a denormalised total and a per-viewer voted flag.

### Amendment 2026-08-08 — [Credit, upvotes and the contributor leaderboard](016-credit-upvotes-leaderboard.md)

**The row gains a second control: a bookmark, in a fixed slot beside the upvote pill.**

016 made the bookmark a separate object from the upvote rather than the same button doing
double duty, and put it on the shelf because its use case *is* the shelf — scan, shortlist
five candidates, read them later. Detail-page-only would have placed the control at the
moment it is least needed.

This does not breach the rules this ticket set. **The flow rule is not violated**: what was
banned was a fact landing at a different x on every row, and a control in a fixed slot at a
fixed x is what that rule asks for. **Precedent already existed** — the row carries the
upvote pill, and 009 fixed signed-out behaviour for it (unpressed, click routes to
sign-in); the bookmark behaves identically, so no new interaction pattern arrives.
**The one-query rule holds**: the per-viewer join this ticket already demanded now returns
vote-flag *and* bookmark-flag for the visible page's programme ids in the same query.

The bookmark adds **nothing to render for anyone but its owner** — it is private, uncounted
and never shown as a total — so it makes no demand on the denormalised row payload.

The two debts this ticket recorded are paid: the **denormalised total** is
`programme.vote_count`, maintained on write, and the **per-viewer voted flag** is that same
join. **The fork-counter withdrawal stands for the grid** — 016 puts a fork count only on
the contributor page, as a live join on a single-contributor query, explicitly because the
denormalisation this ticket refused is not a cost that page pays.
