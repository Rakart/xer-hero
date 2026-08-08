---
id: 037
title: Does a late-arriving pressed state read as a bug?
type: prototype
status: closed
assignee: carlo
blocked_by: []
---

## Question

[035](035-caching-per-viewer-state.md) put the whole signed-out render in the cache and moved
the per-viewer state onto a second request, `GET /api/viewer`, which fires after paint for
signed-in viewers only. Everything about that decision is defensible except one thing nobody
can argue about from a document: **for a few hundred milliseconds, a signed-in planner's own
votes and bookmarks read as unset.**

035 established that this is not a *layout* problem — 009 §11 already draws the upvote pill
unpressed in the signed-out render, 016 gave the bookmark identical behaviour, and 007's
fixed-slot rule means both controls occupy the same box in both states, so nothing moves. The
open question is narrower and is about *reading*, not reflow: on a shelf of 25 rows where the
viewer has bookmarked five of them, does watching five pills fill in after paint read as the
page correcting itself, or as the site having lost the bookmarks?

It matters beyond taste because it is the only user-visible cost of 035's decision, and
because the fix that removes it is expensive. 035 refused **Cache Components** on cost — under
`cacheComponents: true` a crawler renders the whole page dynamically, so every fetch of 10,300
sitemap URLs becomes an invocation plus a Neon query plus an R2 GET — and that refusal is
correct only while the flash is tolerable. If it is not, the refusal has to be re-costed rather
than reasoned around.

This is cheap to answer because the surface already exists: 007 shipped a real clickable
prototype at `assets/prototypes/007-storefront-grid.html` with 40 programmes and both fixture
shapes pinned to the top. What is needed is a delay knob and a seeded viewer state, not a new
build.

**This is HITL.** The build is agent work; the judgement is the dev's, because the whole
question is what it looks like to a person.

Settle:

- **Build it.** Add a `?viewer=<ms>` parameter to 007's existing prototype that seeds a
  plausible signed-in state (say five bookmarks and three votes across the visible page) and
  applies it after a simulated delay. Judge at a realistic delay and at a bad one — a Neon
  round trip from a browser on a poor connection is not 50 ms.
- **Decide whether the plain version ships**, or one of 035's two recorded cheaper fixes
  does: rendering both controls with `visibility: hidden` until the response lands, for
  signed-in viewers only (one class, no extra request, a blank slot rather than a wrong one);
  or putting the Handle in a Clerk session token claim so at least the header never flashes.
  Both are in [035's asset §10](assets/caching-and-viewer-state.md).
- **Say what the answer would have to be to reopen Cache Components**, since 035 dated its
  refusal rather than making it permanent. If the plain version is unshippable and both cheap
  fixes are worse, that is the trigger, and it should be stated as a number rather than a
  feeling.
- **Check the detail page separately.** 008's action cluster is one control group above the
  fold rather than 25 down a column, so it may fail or pass differently, and 035 assumed
  without evidence that the shelf is the harder case.

Expected to be zero schema, zero backfill, and no change to any contract — this decides one
CSS rule and possibly one Clerk claim.

## Prototype built

[`assets/prototypes/037-viewer-state-delay.html`](assets/prototypes/037-viewer-state-delay.html)
— 007's row list, extended with the bookmark slot 016 added to it, 023's header cluster, and a
simulated `GET /api/viewer` that lands after a delay you control. Written as a new file so 007's
prototype stays the artefact 007's resolution points at. Open it in a wide window (≥1400px, as 007
assumes) and drive it from the bar at the bottom of the page.

**How to drive it.** The bar has five groups. **viewer** switches between *signed out* — the cached
artefact, which issues no request and is the control you compare against — and *signed in*, which
fires the simulated request after paint. **variant** switches the three candidate treatments back to
back on the same page: `plain` (035's decision as it stands — both controls drawn unpressed, then
filled in), `hidden` (035 asset §10 — `visibility: hidden` on the controls for signed-in viewers
until the response lands), and `header-only` (§10's other fix — the Handle arrives from a Clerk
session claim so the header never swaps, while the row controls flash exactly as in `plain`, which
isolates whether the header or the rows are what reads wrong). **delay** gives the five presets
0 / 150 / 400 / 1200 / 3000 ms plus a slider, and **page** switches between the shelf (25 control
clusters down a column) and the detail page (one cluster above the fold). `↻ re-run`, or the `R`
key, replays the same configuration so two variants can be compared in quick succession. Every
control writes to the URL, so `?viewer=<ms>&variant=…&page=…&signed=…` is deep-linkable. The seeded
state is five bookmarks (rows 2, 7, 11, 18, 24) and three votes (rows 4, 13, 21) spread down the
visible page of 25 — two bookmarks and one vote land above the fold at a 950px-tall window, the rest
are found by scrolling. What to look at is the moment of landing: whether it reads as the page
completing itself or as the site having just lost five bookmarks.

**Four things the build turned up, which the judgement should take into account.**

- **The geometry claim holds, and the page proves it to you.** Every run measures the left edge,
  width and document-absolute top of ~300 probes (every cell of every row, plus the header) on the
  first painted frame and again after the response lands, and prints the result in the bar. It is
  `Δx 0.00 · Δw 0.00 · Δy 0.00` in all three variants, on both pages, in both themes. The one
  measured movement is 035 §4.4's known residue — the header label's own left edge moves 115px as
  `Sign in` becomes `Upload · {handle}` inside a right-aligned box that does not move — and it is
  reported separately rather than hidden.
- **`hidden` costs more than a blank slot.** Implemented exactly as §10 words it, the upvote pill
  goes blank — and the *public* upvote count lives inside that pill, so for the whole delay a
  signed-in viewer sees no vote counts anywhere on the shelf, while the magnitude bar underneath,
  which is not a control, stays drawn. Judge that against the flash rather than against nothing.
- **A click during the wait is a real hazard and 035 does not mention it.** The controls are live
  before the response lands; the page counts clicks made during the window and tells you how many
  the arriving response snapped back. The response is a snapshot taken *before* the click, so the
  screen and the server disagree afterwards — which is a different failure from "briefly a wrong
  picture", and it gets worse as the delay grows.
- **3000 ms is not a strawman, and the detail page has a hazard the shelf does not.** 035's own
  asset (§6.4) records that Neon was chosen on a free tier that *autosuspends*, so the tail is a
  property of the database rather than of a bad connection. And on the detail page 008's cluster is
  a flex row of labelled buttons, so a bookmark whose label goes `Save` → `Saved` would push `Fork`
  and `Download` sideways; the prototype pins it with a `min-width`, which is a decision the shelf's
  icon-only control never had to make.

**The judgement is still open.** This ticket builds the surface and answers nothing: which variant
ships, what the Cache Components reopen trigger is as a number, and whether the detail page fails
differently from the shelf are all still to be decided by a person looking at it.

## Resolution

Judged 2026-08-08 against the prototype, signed-out control first, `plain` at 400 ms and at
1200 ms, then the detail page. **035's decision ships as it stands, and the ticket's one
surprise is not the flash at all — it is that the controls are live while the response is in
flight, which 035 examined and got wrong.**

### 1. `plain` ships. The flash is accepted, and the accepting is dated by a number

At **400 ms the fill-in reads as the page completing itself**; at **1200 ms it does not**. So
the flash is not a defect at the delay the design expects, and 035 §4.4's *"nothing appears,
nothing disappears, nothing reflows"* is confirmed by measurement rather than argument — the
prototype probes ~300 cells on the first painted frame and again after landing and reports
`Δx 0.00 · Δw 0.00 · Δy 0.00` in all three variants, on both pages, in both themes.

**`hidden` is rejected, and the prototype is why.** 035 asset §10 words it as *"a blank slot
rather than a wrong one"*, which is true of the bookmark and false of the upvote pill: the
**public vote count lives inside that pill**, so `visibility: hidden` costs a signed-in viewer
every vote count on the shelf for the whole delay, while the magnitude bar beneath it — not a
control, so not hidden — stays drawn. That is a worse picture than the one it fixes, and it is
worse in the direction 009 cared about, since the count is a fact about the catalogue rather
than about the viewer. **`header-only` is not needed** on its own terms — the header was never
what read wrong — and the Clerk session claim it depends on is left unspent.

### 2. 400 ms is a target and can never be a guarantee, and the cause is the database

Nothing in the estate holds 400 ms. `/api/viewer` is ~3 ms of Active CPU (035 §6.1), but the
viewer's wall time is browser → Function → Neon, and 004 chose Neon on a free tier that
**autosuspends** — so the tail is a property of the database rather than of a bad connection,
and it is longest on exactly the pages a returning visitor opens first after a quiet hour.
Two consequences, both accepted rather than engineered away:

- The >400 ms frame is a **known bad frame nobody will ever report**, because 030 chose no
  analytics and Hobby keeps runtime logs for one hour.
- Because it cannot be held, it cannot be a requirement. It becomes the input to §4's trigger
  instead, which is the only form a number can take here and still mean something.

### 3. The click during the wait — 035's *"cannot cause a wrong write"* is half wrong

035's Flagged section says the flash *"cannot cause a wrong write — the controls toggle against
the server"*. The first half of that is right and the second half is what makes it wrong. The
controls are **live before the response lands**; a click during the window does write, and then
the arriving response — a snapshot taken *before* the click — **overwrites the control back to
unset**. The write is not lost. What the viewer sees is their own action being undone, and the
obvious response to that is to click again, which toggles the true state **off**. So the path to
a wrong write is one user reaction long, and it lengthens with the delay.

**The fix: merge, don't overwrite.** The client keeps a dirty set of controls the viewer has
touched since paint, and the viewer response fills only untouched ones. No extra request, no
schema, no change to 035 §4.1's contract — the response is unchanged and the client stops
treating it as authoritative over its own optimistic state. Roughly ten lines, and it is the
rule that makes §1's acceptance safe rather than merely tolerable.

This generalises past this ticket: **any late-arriving snapshot must merge against local
intent**, and every owner-conditional element in 035 §4.3 is driven by the same one response.
The controls are the only elements a viewer can touch mid-flight, so today the rule binds on
two of them.

### 4. The Cache Components reopen trigger: 800 ms, three consecutive sweeps

035 dated its refusal rather than making it permanent, and this ticket was asked for a number.
The number is **800 ms** — the honest midpoint of the judged bracket, and roughly where a fill-in
stops reading as completion and starts reading as correction.

A trigger nobody can observe is a feeling, so it gets an instrument, and the instrument is one
already in the estate: **024's daily sweep times its own first Neon statement** and records the
duration. Breach is **>800 ms on three consecutive runs**, at which point Cache Components is
**re-costed rather than adopted** — the refusal was a ratio between a crawl surface and a
signed-in surface, and a slow viewer response changes only one side of it.

**Correcting the shape proposed while grilling:** this is *not* an authenticated `/api/viewer`
canary. That would need a Clerk session inside GitHub Actions — a secret, a token lifecycle and
a fifth thing to rotate — to measure a leg that is not where the variance is. The sweep runs
daily on 010's GitHub Actions schedule, so it reaches Neon after a long idle and hits the
autosuspend resume case by construction, which is the tail this trigger exists to catch.

**The honest residue, stated rather than discovered:** the sweep measures the **server leg
only** — no client network, no TLS handshake, no Function cold start from a cold region. So the
instrument **floors** the number. A breach is certainly real; a non-breach proves nothing about
what a planner on a train sees. It is the cheapest measurement that is not a fiction, and 024's
refusal to buy a credential to read what a vendor already knows is why there is no better one.

### 5. The detail page passes, and 008's `min-width` is load-bearing

035 assumed without evidence that the shelf is the harder case and the assumption holds: one
cluster above the fold reads **no worse** than 25 down a column, at the same delay and the same
treatment. It ships `plain` like the shelf, with no second rule.

What makes that true is a detail 008 chose for looks: its action cluster is a flex row of
**labelled** buttons, so a bookmark going `Save` → `Saved` would push `Fork` and `Download`
sideways. The prototype pins it with a `min-width`, and that pin is now **the reason the detail
page has no layout question**, not a cosmetic nicety — 007's fixed-slot rule covers the shelf's
icon-only control for free and has nothing to say about a labelled one.

### 6. Cost

- **Schema: one seeded `alarm_state` row** (`viewer_latency`), which is exactly what 024 spent
  for `edge_drift`. No table, no column: `sweep_run.breaches` is jsonb so a sixth rule key is
  free, and the consecutive-run counter is mutable current state, which is the reason 019 kept
  `alarm_state` separate from `sweep_run` in the first place.
- **Backfill: none. Contracts: unchanged** — `derived.json` stays v2, `activities.json` stays
  v1, `card` gains nothing.
- **Build work, not a decision:** the dirty set, the `min-width`, the sweep's timer, the seeded
  row.
