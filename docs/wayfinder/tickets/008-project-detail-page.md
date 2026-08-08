---
id: 008
title: The project detail page
type: prototype
status: closed
assignee: carlo
blocked_by: [006, 007, 012]
---

## Question

What does opening a programme give you, laid out concretely?

Scope is already fixed: charts and tables, no time-scaled Gantt. This ticket
decides the arrangement, the interactions, and where the data comes from — and
therefore what `parsed.json` has to contain, which is the last piece the ingest
pipeline needs.

Build it with `/prototype` against realistic data volumes: a 20,000-activity
programme, not a toy.

Work through:

- **Above the fold.** What a planner needs before scrolling: dates, duration,
  activity count, data date, calendar summary, licence, author, revision selector.
- **The charts.** S-curve, float histogram, activity-type mix. Which, at what
  size, in what order. `/dataviz` first.
- **The WBS tree.** Collapsible navigation, and whether selecting a node filters
  the activity table below it.
- **The activity table.** The hard part. 20k rows needs virtualisation, and sort,
  filter and search have to stay fast. Decide: which columns, client-side or
  server-side paging, and whether it reads `parsed.json` in the browser or hits an
  API. That choice decides whether `parsed.json` is one blob or a set of shards.
- **Quality signals.** Open ends, constraints, negative lag — surfaced as a
  callout panel, or only as columns? These may be the most interesting thing on
  the page.
- **Revisions.** How switching revisions behaves, and where the seam is for a
  future diff view (see the map's **Not yet specified**) — this page should not
  have to be rebuilt to add one.
- **The actions.** Download, fork, star. Where they sit and what they say.
- **Rendering strategy.** Which parts are server-rendered for a fast first paint
  and which hydrate. The page must feel instant even though the real data is in a
  blob.

Before freezing the `parsed.json` shape, sanity-check it against what a
virtualised Gantt would need — the Gantt is deferred, not abandoned.

> **Note added 2026-08-07** by
> [What does storage actually cost?](004-storage-cost-model.md). `parsed.json`
> above should now be read as **`activities.json`**: a full parse of the `.xer`
> gzips to the same size as the `.xer` itself, so nothing stores one. What is
> stored is a columnar cut — `PROJECT`, `PROJWBS`, `CALENDAR`, `TASKPRED` and 24
> `TASK` fields — measuring **185–277 KB gzipped** on the fixtures against the whole
> file's 400–870 KB. Two consequences for this ticket: the column list above is now
> *this ticket's* to fix, not an inherited one; and the "reads the blob in the
> browser or hits an API" choice is the largest remaining variable in the cost model,
> swinging per-open egress 16× (245 KB vs 15 KB). It is not a cost-blocked choice —
> even the expensive branch is 24 GB/month at busy traffic — so decide it on how the
> table should feel, not on the bill.

## Resolution

**The page is one scrolling document, and the activity table reads the whole blob.**

Full spec: [`assets/detail-page.md`](assets/detail-page.md).
Prototype: [`assets/prototypes/008-detail-page.html`](assets/prototypes/008-detail-page.html)
— four arrangements, `?variant=A|B|C|D`, plus `?p=20k|tender`,
`?float=bands|hist|table`, `?fields=1` (provenance overlay), `?theme=dark`.

Judged against **real data at the v1 ceiling**: every chart, stat and DCMA verdict in the
prototype is the genuine `derived.json` from `fixtures/generated/perf-20k.xer` — 20,000
activities, 34,000 relationships, 1,800 WBS nodes — with Fixture B's published
measurements as the degenerate case.

### 1. A — Dossier wins, and takes one thing from each loser

**B (Workbench)** made the table the page. Rejected: the activity table is the *least*
differentiated thing here — P6 renders tables better and anyone wanting rows can download
the file — and B's compact header drops sector, licence and lineage. **D (Tabbed)**
split the WBS tree onto Structure and the table onto Activities, so the one interaction
this ticket asked about spans two tabs. **C (Verdict)** led with the scorecard; rejected
because [009](009-browse-search-ranking.md) established that **DCMA inverts** — the live
contract fails, the template passes — so a quality-first page teaches visitors to prefer
templates.

Adopted anyway: **C's verdict sentence** ("fails 4 of the 10 checks that apply to it:
leads at 2.1%, high float at 35.6%…") goes above the fold, and **D's fetch rule** — a
visitor who never reaches the table never fetches `activities.json`.

### 2. The blob-versus-API question was decided by measurement, not feel

The note above called this the largest remaining variable and said to decide it on how
the table should feel. Measured in Chrome against the real 20,000-activity cut: **340 KB
gzipped, 25 ms from request to a sortable in-memory table**, then sort 1.8 ms, search over
20,000 names 1.1 ms, virtualised scroll frame 0.35 ms, under 10 MB of tab heap. An API
pays a round trip per sort and per keystroke, forever. **Blob, and one object — sharding
was only ever justified by paging, and there is no paging.** After the two fetches the
page issues no further requests.

Two side findings: **brotli cuts the largest per-open object 38%** (212 KB vs 340 KB), and
this path is **nowhere near [020](020-client-parse-budget.md)'s ceiling** — that ticket's
600 MB is a 30 MB `.xer` parsed in the upload tab; the detail page holds a 3 MB lean cut.

### 3. `activities.json` v1 is fixed, and the Gantt check has a number

Thirteen columnar `TASK` fields plus the WBS tree. **`TASKPRED` and `TASKACTV` are out** —
including both doubles the file to 652 KB gz and v1 has no relationship view and no
code-value filter.

The Gantt sanity check the ticket demanded: a virtualised Gantt needs bars, rows and
colour — **all already in the lean cut** — plus exactly one missing table, `TASKPRED`,
**priced at +181 KB gzipped** (340 → 521 KB). The cut is Gantt-compatible, one named
block short, and adding it later is additive rather than a re-cut.

### 4. Float is not a histogram — the sharpest finding here

The contract's 9-bucket float histogram draws as a single spike on **every programme that
exists**, and a different spike each time: `perf-20k` is 99.2% over-44-days, Fixture B
75.7% over-44-days, Fixture A 69% negative. The bucket a reader most needs — negative — is
27 activities beside 7,117, a sub-pixel segment.

Three forms were built and switched between in the prototype. **The table won**: nine
rows, exact counts, band colour as a secondary channel. Ship **band bar + table** — the
bar keeps continuity with the shelf's sliver, the table carries the values.
`float_histogram` stays in `derived.json` unchanged, because it is what makes revision
diff a subtraction, but it is **a stat, not a chart**. The duration histogram on the same
file spreads properly across all eight buckets and stays a chart, which is how we know the
failure is float's distribution rather than the form.

`null_count` earns its own callout: **12,829 of 20,000 activities have no float at all**
because they are complete.

### 5. The shelf's colour-only DCMA strip does not survive being enlarged

`/dataviz`'s validator: pass-green ↔ fail-red is **ΔE 4.1 under deuteranopia** (all-pairs
FAIL). The shelf survives it because the printed `6/10` rides alongside — 007's relief
rule. A 14-row scorecard does not. Every check row therefore carries **mark + word + value
+ threshold**, with colour third; the compact strip is still used, but **only next to its
printed ratio**.

Exemplars are the seam between the panel and the table: a failing check expands to the 50
worst, and *Open all 2,530 →* applies that check's predicate to the table. **That is what
makes the 50-cap acceptable** — the full list is one client-side filter away, because the
client holds every row.

### 6. Charts are programme-level and may not respond to the table's filters

They could — re-bucketing 20,000 rows costs ~2 ms — but that makes the client a second
source of truth for a published statistic, which
[010](010-stack-hosting-auth.md) ("a client parse is advisory only") and
[011](011-upload-ingest-pipeline.md) ("nothing the client computes is persisted") rule out
everywhere else. So the filter row sits with the table it scopes, not above the page.
Noted as the obvious v2 upgrade.

Also settled: **one S-curve line, never two** (no baseline, same absence that skips DCMA
11/13/14); **no resource-units S-curve in v1**, because a second series in different units
beside the first is the dual-axis mistake waiting to happen; `critical_count` renders only
with `critical_threshold_hr` beside it; `longest_path` prints its `unavailable` reason.

### 7. The WBS tree, at its real shape

Selecting a node filters to its subtree — 72 rows out of 20,000, instant, no request.
Counts roll up from the subtree or every branch reads 0. Two findings from the real tree:
**1,800 nodes but 450 siblings at depth 2**, so it opens root-expanded and nothing else;
and at `wbs_depth: 1` the panel is **replaced, not emptied** — Fixture B gets "this is a
real shape, not a parse failure" plus its code types as the grouping axis it actually has.

### 8. Rendering, revisions, lineage

`derived.json` is fetched **server-side** and everything above the table is
server-rendered — first paint carries every number. `activities.json` loads **lazily** on
approach. 010's *no charting library* holds: ~120 lines of hand-rolled SVG, and every
chart needed behaviour a library would have fought.

`Compare…` is present and deliberately inert. **The diff needs nothing added to either
contract** — it reads two `derived.json` files (fixed buckets subtract) and two
`activities.json` files keyed on `task_code`, which closes 006's open question about
per-activity fingerprints: it does not need them.

Finally, **007's fork-family handover is closed here** — a lineage line above the fold and
a Lineage surface — and it re-opens no schema demand, because `root_programme_id` and the
fork edge already exist for other reasons.

### Consumed by

- [Do we compute the critical path ourselves?](014-compute-critical-path.md) — the page
  now shows exactly what its absence looks like: `longest_path` prints an `unavailable`
  reason in the most prominent callout on the page.
- [Where does a programme's sector come from?](015-sector-classification.md) — sector is
  in the breadcrumb and the byline, so an absent one is visible on every open.
- [Credit, upvotes and the contributor leaderboard](016-credit-upvotes-leaderboard.md) —
  the detail page wants the same denormalised total and per-viewer voted flag the grid
  does; no new demand.
- [What does storage actually cost?](004-storage-cost-model.md) — per-open egress is
  confirmed at 340 KB, and brotli is worth a config flag.

### Amendment 2026-08-08 — [Do we compute the critical path ourselves?](014-compute-critical-path.md)

The handover above said this page "shows exactly what its absence looks like". It no
longer does: 014 fills the gap with a tracer over P6's own dates, and three things on
this page change.

- **`activities.json` goes to v2** — a 14th field, a per-activity boolean marking the
  driving path. A boolean array over 20,000 rows is noise against the measured 340 KB
  gzipped, so the fetch budget, the 25 ms parse and the one-object-not-shards decision
  all stand.
- **The critical-path callout gains a value and a provenance line** — *"computed by this
  site from the file's own dates — P6 did not export a Longest Path"*. The
  longest-path-is-not-critical warning stays; it is now more load-bearing, not less. The
  method and its known lag limitation live in the tracer's doc in the repo, **not on the
  page** — one sentence discharges the no-warranty obligation, and a paragraph of
  scheduling theory in a callout is the noise 007 and this ticket both kept out.
- **A `Longest path (N)` chip on the activity table**, using the predicate mechanism the
  DCMA rows already use. This is the substantive addition: rather than explaining why our
  answer should be trusted, the page lets a planner filter to it and check it against
  their own file. The same argument that made the 50-exemplar cap acceptable — the client
  holds every row — makes this free.

Charts are unaffected, and the rule that they stay programme-level and do not answer the
table's filters holds: the chip filters the table only.

### Amendment 2026-08-08 — [Credit, upvotes and the contributor leaderboard](016-credit-upvotes-leaderboard.md)

**The action cluster becomes upvote pill · bookmark · Fork · Download .xer.** 016 separated
saving-for-later from endorsement, and the bookmark control lands on both the browse row and
this page. It is private, uncounted and rendered only to its owner, so it adds a control and
no data — the download's gzipped-size line and everything else in the cluster is unchanged.

**No uploader vote pill on this page.** 016 made the uploader separately votable but
castable only from the contributor page, on the grounds that a person-pill beside a
programme-pill is two upvote buttons on one screen meaning different things. The
"uploaded by" attribution stays a link.

The denormalised total and per-viewer voted flag this page asked for are delivered as
`programme.vote_count` plus one lookup. Nothing enters `derived.json` or `activities.json`,
so neither contract moves and no backfill arises.

### Amendment 2026-08-08 — [What calendar is `duration_working_days` measured on?](045-duration-working-days-calendar.md)

This ticket asked for a **calendar summary above the fold** and shipped `calendar_count` — a count of
`CALENDAR` rows, of which three of four go unused on Fixture A. 045 supplies the summary properly and
it lands in one place: the **Window tile's sub-line** becomes `460 days · 328 working (5-day week)`,
with the calendar clause never dropped even where the working count equals the span, because on a
seven-day programme that identity *is* the summary. Below 100% activity share it appends
`· the calendar 50% of activities use`. Where the state is `unavailable` the tile prints the
calendar-day span and nothing else — this is the one stat that does **not** follow `longest_path`'s
print-the-reason-verbatim rule, and it diverges because `longest_path` owns a callout with room for a
sentence and this owns half a tile. Only the `error` state reaches the *partially analysed* banner.
The `Calendars` tile keeps `calendar_count` as a fact about the file and gains
`shape.calendars_in_use` beside it. No new fetch, no chart, no change to `activities.json`.

### Amendment 2026-08-08 — [Which flagged set does the ship gate score against?](050-ship-gate-flagged-set.md)

[014](014-compute-critical-path.md) decision 9's gate has been run and **passes**, so the
critical-path callout, its one provenance sentence and the **`Longest path (N)` chip** over
`activities.json`'s boolean array all go live rather than waiting on a measurement. The page's
existing longest-path-is-not-critical warning is unchanged and is if anything better founded: the
gate proves agreement with P6 **about remaining work only**, and 33.5% of P6's own flagged set is
completed work our answer deliberately excludes.

> **Delivered 2026-08-08** by [047](047-report-duration-working-days.md): `shape.calendars_in_use`
> ships, which is the number the `Calendars` tile wanted — Fixture A declares four and uses one, and
> the new `cal-default-unused` fixture declares three and uses one. Nothing in this ticket's decision
> changes; the field now exists.
