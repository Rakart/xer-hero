# The project detail page

Resolution asset for [The project detail page](../008-project-detail-page.md).

Prototype: [`prototypes/008-detail-page.html`](prototypes/008-detail-page.html) —
four structurally different arrangements of one programme,
`?variant=A|B|C|D`, `?p=20k|tender`, `?float=bands|hist|table`, `?fields=1`,
`?theme=dark`.

Everything below was judged against **real data at the v1 ceiling**: the charts,
stats and DCMA verdicts in the prototype are the genuine `derived.json` computed
from `fixtures/generated/perf-20k.xer` — 20,000 activities, 34,000 relationships,
1,800 WBS nodes, a real CPM pass — and the degenerate case is Fixture B's published
measurements (3,344 activities, no WBS, no progress).

---

## 1. The layout: A, with C's sentence and D's fetch discipline

| | What it is | Verdict |
|---|---|---|
| **A — Dossier** | one scrolling document: identity → facts → charts → quality → WBS + table | **wins** |
| B — Workbench | viewport-filling activity table, WBS rail, stats in a drawer | rejected |
| C — Verdict | DCMA scorecard as the hero, charts as its evidence | rejected, one element adopted |
| D — Tabbed | Overview · Quality · Activities · Structure · Lineage | rejected, one rule adopted |

**B fails because the activity table is the least differentiated thing here.** P6
renders tables better than a web page will, and anyone who wants rows can download the
file. B spends the whole viewport on 20,000 rows nobody reads top to bottom, and demotes
every judgement fact to a drawer. Its compact header also drops sector, licence and
lineage — the three things that make the page linkable and legally correct.

**D fails on the overview being thin** — with the charts split across Overview and
Quality, and the WBS tree on Structure while the table is on Activities, the one
interaction this ticket asked about (select a node, filter the table) spans two tabs.

**C is the closest rival and contributes the best single element**: the verdict
sentence — *"This programme fails 4 of the 10 checks that apply to it: leads at 2.1%,
high float at 35.6%, negative float at 0.1%, high duration at 5.8%."* That belongs above
the fold. But C's ordering is wrong for this product:
[Browse, search, filter and ranking](../009-browse-search-ranking.md) established that
**DCMA inverts** — the real live contract fails it, the template built to pass passes it
— so making quality the page's hero teaches visitors to prefer templates. Quality is a
section, not the page.

**Adopted from D as a rule rather than a layout**: a visitor who never reaches the
activity table never fetches `activities.json`.

### The page, top to bottom

1. Breadcrumb `shelf / {sector} / {title}`
2. `h1` + degenerate badges (`no WBS`, `⚠ partially analysed`)
3. Byline: handle · sector · CC BY 4.0 · P6 version · age
4. **Lineage line**: forked from *X* at r*N* by *handle* · N revisions · N forks · N in the family
5. Actions: upvote pill · Fork · **Download .xer** with the **gzipped** size (that is what the user waits for)
6. Revision selector `r23 — current` + an inert `Compare…`
7. `issues[]` banner when the programme is partially analysed
8. Eight fact tiles, last one DCMA `6/10` + the 14-cell strip
9. The verdict sentence
10. **Charts** — S-curve full width, then float and duration side by side
11. **Quality** — hero ratio, FS meter, the 14 checks, exemplars on expand
12. The critical / longest-path callout
13. **Activities** — WBS tree (270px) beside the virtualised table
14. Activity codes

---

## 2. The activity table reads the blob. One blob, not shards.

The ticket called this "the largest remaining variable in the cost model, swinging
per-open egress 16×", and said to decide it on feel rather than cost. It was decided on
measurement instead — the numbers are lopsided enough that feel does not have to arbitrate.

Measured in Chrome against the real 20,000-activity cut, served gzipped over HTTP:

| Step | Cost |
|---|---|
| transfer | **340 KB** gzipped (212 KB brotli) |
| fetch | 8 ms (localhost — network latency is on top) |
| `JSON.parse` | 15–19 ms |
| build 20,000 row objects | 2 ms |
| **request → sortable table** | **25 ms** |
| sort 20,000 rows | 1.8 ms |
| substring search over 20,000 names | 1.1 ms (1,222 hits) |
| virtualised scroll frame | 0.35 ms (23 DOM rows for 20,000) |
| tab heap held | under 10 MB |

An API alternative pays a round trip **per sort and per keystroke** — 50–150 ms each on a
real connection, forever — against one 340 KB fetch. There is no version of "how the
table should feel" where that loses.

Consequences:

- **`activities.json` is a single object.** Sharding was only ever justified by paging,
  and there is no paging.
- **No request is issued after the two fetches.** Sort, filter, search, WBS selection and
  the exemplar deep-links are all local.
- Per-open egress is 340 KB, not 15 KB. [What does storage actually cost?](../004-storage-cost-model.md)
  already priced this branch at ~24 GB/month at busy traffic — under $1 on R2.
- **Serve brotli.** 212 KB against 340 KB is a 38% cut on the largest object the site
  serves per programme open, for a config flag.
- This is nowhere near [The client-side parse budget](../020-client-parse-budget.md)'s
  ceiling. That ticket's 600 MB projection is about parsing a **30 MB `.xer`** in the
  upload tab; the detail page holds a 3 MB lean cut and costs single-digit MB. The two
  paths do not share a memory problem.

---

## 3. `activities.json` v1 — the column list, fixed here

```jsonc
{
  "version": 1,
  "activities": {          // columnar: 13 parallel arrays, one entry per activity
    "task_id": [], "task_code": [], "task_name": [], "wbs_id": [],
    "task_type": [], "status_code": [],
    "target_drtn_hr_cnt": [], "remain_drtn_hr_cnt": [], "total_float_hr_cnt": [],
    "early_start_date": [], "early_end_date": [], "act_start_date": [], "act_end_date": []
  },
  "wbs": [ ["wbs_id", "parent_wbs_id", "wbs_short_name", "wbs_name"] ]
}
```

Measured at 20,000 activities:

| Cut | raw | gzip | brotli |
|---|---|---|---|
| **lean — v1** | 2.98 MB | **340 KB** | 212 KB |
| lean + relationships | 4.01 MB | 521 KB | 305 KB |
| lean + codes | 5.74 MB | 469 KB | 300 KB |
| lean + both (004's original cut) | 6.77 MB | 652 KB | 395 KB |

**`TASKPRED` and `TASKACTV` are excluded from v1.** Including both doubles the file, and
the v1 page has no relationship view and no code-value filter — the codes panel renders
from `derived.json`'s counts, which is why that block enumerates types but not values.

### The Gantt sanity check the ticket required

A virtualised, time-scaled Gantt needs bars (start/finish), rows (the WBS tree), and
colour (status, float) — **all already in the lean cut** — plus exactly one thing it does
not have: `TASKPRED`, for dependency lines.

So the cut is **Gantt-compatible but not Gantt-complete, and the gap is one named table
priced at +181 KB gzipped** (340 → 521 KB) at the 20,000-activity cap. That is the whole
answer to "check it before freezing", and it is a better one than deferring: adding a
Gantt later is an additive block on the same object, not a re-cut.

---

## 4. Charts

Palette and marks from `/dataviz`, validated with its script in both modes. The mark
specs used throughout: 2px lines, ≤24px columns with 4px rounded caps, 2px surface gaps,
10% area washes, solid hairline grids, axis ticks on round numbers, proportional figures
on hero and tile values and `tabular-nums` only in columns.

### The S-curve — one line, and it stays one line

Cumulative activities finished by month (40 buckets at 20k, 45 at Fixture B), area wash,
a 2px data-date rule with the elapsed portion weighted heavier, hover crosshair with
started / finished / cumulative.

Planners expect planned-versus-actual. It is not available — the same missing baseline
tables that skip DCMA 11, 13 and 14 — so the page says so in a callout rather than
drawing a second line the data cannot support. This is the same constraint
[the shelf](../007-storefront-card-and-grid.md) hit, stated once more where there is room
to explain it.

### Float is not a histogram — the sharpest finding of this ticket

`derived.json` stores a 9-bucket fixed-edge float histogram. Drawn as columns it is a
single spike on **every programme available**, and always a different spike:

| | negative | 0–44d | over 44d |
|---|---|---|---|
| `perf-20k` (progressed, synthetic) | 0.4% | 0.4% | **99.2%** |
| Fixture B (tender, real) | 0% | 24.3% | **75.7%** |
| Fixture A (progressed, real) | **69.0%** | 26.8% | 4.2% |

Float concentrates. The bucket a reader most needs to see — negative — is 27 activities
next to 7,117, which is a sub-pixel segment. Three forms were built and switched between
in the prototype (`?float=bands|hist|table`):

- **`hist`** — the contract's histogram as columns. One spike, eight empty bands.
- **`bands`** — the shelf's three-band sliver, enlarged, with printed counts. Better,
  but on `perf-20k` two of three segments are still invisible.
- **`table`** — nine rows, exact counts, percentages, band colour as a *secondary*
  channel. **Wins.** Everything is legible on every programme, including the
  programme where one band holds 99% of the mass.

**Ship band bar + table.** The band bar keeps continuity with the shelf's sliver (the
same three fills, the same thresholds) and gives the shape at a glance; the table
carries the values. `float_histogram` stays in `derived.json` unchanged — it is what
makes revision diff a subtraction — but it is **a stat, not a chart**.

This also satisfies `/dataviz`'s rule that a tooltip may never be the only way to read a
value, and its "past ~7 bins, use a table" heuristic, which turns out to be exactly right
here.

`float_histogram.null_count` gets its own callout: **12,829 of 20,000 activities have no
float at all** because they are complete. An empty float is not a zero float, and a page
that silently dropped them would imply a programme two-thirds smaller than it is.

### Duration is a histogram, and it works

The same 8-bucket form on the same file spreads properly across every bucket. Worth
recording that the two histograms in the same contract, drawn identically, land on
opposite verdicts — the form failure is float's distribution, not the histogram.

### The rest

- **Status mix** — an ordered scale, so one hue in three steps, direct-labelled with counts.
- **Finish-to-start ratio** — a single ratio against a limit, so a **meter** with the
  DCMA-4 90% threshold marked on the track. Fixture B's 89.5% renders as a red bar
  stopping just short of the mark, which is the most legible thing on that page.
- **No resource-units S-curve in v1.** A second time series in different units, beside
  the first, is the dual-axis mistake waiting to happen. It needs its own decision about
  units and cost semantics that no ticket owns.
- **No treemap, no WBS chart.** `wbs_depth: 1` is a real shape.

### The charts do not respond to the table's filters, and that is deliberate

`derived.json` is precomputed over the whole programme. When a WBS node is selected, the
histograms above do not change. They could — the client holds all 20,000 rows and
re-bucketing costs ~2 ms — but that would make the client a second source of truth for a
published statistic, which is exactly what
[Stack, hosting and auth provider](../010-stack-hosting-auth.md) ("a client parse is
advisory only") and [Upload and ingest pipeline](../011-upload-ingest-pipeline.md)
("nothing the client computes is persisted") rule out everywhere else.

So the charts are **programme-level and labelled as such**, and the filter row sits with
the table it scopes rather than above the page. Client-side recomputation is the obvious
v2 upgrade and is noted, not built.

---

## 5. The DCMA scorecard: the shelf's colour strip does not survive being enlarged

`/dataviz`'s validator, run on the palette this project already uses:

```
[FAIL] CVD separation   worst all-pairs #0ca30c ↔ #d03b3b  ΔE 4.1 (deutan) · 6.2 (tritan)
[WARN] Contrast         #eda100 at 2.11:1 in light mode — relief required
```

Pass-green against fail-red is **ΔE 4.1 under deuteranopia**. On the shelf that survives
because the printed `6/10` rides beside the strip — 007's own relief rule. Blown up into a
14-row scorecard it is unreadable for a deutan reader, and the scorecard is the page's
differentiator.

So every check row carries **mark + word + value + threshold**:

```
✓  1  Logic — open ends            PASS               5%    target <=5%
✗  2  Leads — negative lag         FAIL             2.1%    target 0        ▸
–  11 Missed tasks                 NOT APPLICABLE      —    target ≤5%
```

Colour is the third channel, never the first. The compact 14-cell strip is still used —
in the fact tile and in B's header — but **only next to its printed ratio**.

Each row also carries a plain-English line saying what the check measures, because "DCMA
4" means nothing to a planner who has not been audited recently, and the whole reason for
adopting the standard was that it is explicable.

### Exemplars are the seam between the panel and the table

The ticket asked: callout panel, or only columns? Both, joined. A failing check expands to
the 50 worst exemplars `derived.json` carries, and `Open all 2,530 in the activity table →`
applies that check's predicate to the table below.

That is what makes the 50-exemplar cap acceptable: the full list is one **client-side
filter** away, because the client already holds all 20,000 rows. The cap bounds the file
without hiding anything.

### The critical-path callout

`critical_count` is rendered **only** with `critical_threshold_hr` beside it and a
sentence saying the threshold is per-programme and the counts are not comparable across
programmes. `longest_path` prints its `unavailable` reason verbatim when P6 did not
compute it, and the page states that longest path is not the same thing as critical.
Both were traps flagged by the contract; the page is where they would have been sprung.

---

## 6. The WBS tree

Selecting a node filters the table to its whole subtree — measured at 72 rows out of
20,000, instant, no request. Counts on each node are **rolled up from the subtree**, or
every branch node reads 0 and the tree looks broken.

Two findings from the real tree:

- **1,800 nodes, but 450 of them are siblings at depth 2.** A flat 450-child level cannot
  be navigated by scrolling, so the tree opens with the root expanded and everything else
  collapsed, and node labels are `text-overflow: ellipsis` in a fixed 270px rail — the one
  place on the page where a variable-length string is allowed to be cut.
- **At `wbs_depth: 1` the panel is replaced, not emptied.** Fixture B gets
  *"No work breakdown structure. All 3,344 activities sit under a single node. This is a
  real shape, not a parse failure"* plus its activity code types as grouping buttons — the
  fallback axis a tender programme actually has.

---

## 7. Rendering strategy

| Layer | Where | Cost |
|---|---|---|
| Postgres row | already loaded by the shelf | free |
| `derived.json` | **server-side fetch, server-rendered** | 16 KB, one blob read |
| `activities.json` | **client-side, lazy**, when the activities section nears the viewport | 340 KB gz |

First paint carries every number, every chart and every check — no skeletons above the
table. The table is virtualised and hydrates on approach.

`derived_version < CURRENT_VERSION` triggers the contract's lazy recompute on the
server-side fetch, so the "one slow open, then hot forever" path is on the page's own
critical path and nowhere else.

010's *no charting library* holds: every chart on this page is hand-rolled SVG, about 120
lines in total, and the largest single reason is that all of them needed behaviour a
library would have fought — a data-date rule, a threshold mark, fixed contract buckets,
and a form switch from chart to table.

---

## 8. Revisions, and the seam a diff view mounts into

- Revision selector in the header; `Compare…` present and **deliberately inert**.
- A Lineage surface lists the fork family and the revision history — one row per
  revision with activity count, % complete and age.
- URLs are already `/p/{slug}` and `/p/{slug}/r/{rev_no}`
  ([Domain model and schema](../005-domain-model-and-schema.md)); a diff mounts as a
  third shape over the same data.

**The diff needs nothing added to either contract.** It reads two `derived.json` files —
whose histogram buckets are fixed precisely so they subtract — and, for per-activity
comparison, two `activities.json` files keyed on `task_code`, which is in the lean cut.
That closes the question 006 left open about whether `derived.json` needs per-activity
fingerprints: **it does not**, because the diff has the activity rows themselves.

Two `activities.json` fetches is 680 KB gzipped, which is acceptable for an explicit
compare action and unacceptable as a default — another reason `Compare…` is a button
rather than a tab.

### Tombstoned revisions

No new decision needed, but stating the page's behaviour so it is not rediscovered:
`/p/{slug}` follows `current_revision_id`, which
[Domain model and schema](../005-domain-model-and-schema.md) already repoints past a
tombstone; `/p/{slug}/r/{n}` for a tombstoned revision renders
[003](../003-licensing-attribution-takedown.md)'s tombstone at its own URL; and the
revision selector lists tombstoned revisions as disabled entries carrying their removal
class, because a gap in a numbered series is more alarming than a labelled one.

---

## 9. Fork family — closing 007's handover

[The storefront card and browse grid](../007-storefront-card-and-grid.md) took the fork
counter off the row and handed the fork *family* to this page. It lands as a one-line
lineage strip above the fold (`forked from X at r4, by northline · 23 revisions · 3 forks
of this · 4 in the family`) and a Lineage surface listing the family.

**This re-opens no schema demand.** `root_programme_id` already makes "the family" one
query and `parent_id` + the fork edge's revision pointer already name the exact fork
point — both from 005, both for other reasons.

---

## 10. Measurement appendix

All figures from `fixtures/generated/perf-20k.xer` (20,000 activities, 30.7 MB) unless
marked, taken 2026-08-07, Chrome 1500×1200 headless, Node 24.18, WSL2.

| | |
|---|---|
| `derived.json` | 15,854 bytes (3,659 gzipped) |
| `activities.json` lean | 2,984,785 bytes (340,081 gzipped · 212,436 brotli) |
| activities fetch → sortable table | 25 ms |
| sort 20,000 rows | 1.8 ms |
| search 20,000 names | 1.1 ms |
| virtualised scroll frame | 0.35 ms · 23 DOM rows |
| tab heap, 20,000 rows held | < 10 MB |
| WBS | 1,800 nodes, depth 4, 450 siblings at depth 2 |
| float | 12,829 null · 27 at or below zero · 7,117 over 44 days |
| DCMA | 6 passed / 10 applicable / 4 skipped |

Reproduce with `node tools/fixture-gen/generate.mjs --only perf-20k`, then open the
prototype.
