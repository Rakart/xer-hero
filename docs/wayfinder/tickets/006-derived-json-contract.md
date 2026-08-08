---
id: 006
title: The derived.json contract
type: grilling
status: closed
assignee: carlo
blocked_by: [002]
---

## Question

Which computed statistics earn their place?

`derived.json` is the whole hybrid-ingest bet: it is what makes a programme
legible without opening it, and it is computed once at upload and never again.
Everything on the storefront card and most of the detail page reads from it. Get
it wrong and either the shelf is thin, or every upload recomputes the world.

The test for each candidate stat: **does it change a browsing decision, or is it
merely true?** Activity count changes a decision. Mean activity id length does not.

Work through candidates by what they reveal:

- **Shape and size** — activity count, relationship count, WBS depth and breadth,
  calendar count, resource count, milestone count.
- **Time** — start, finish, overall duration, data date, working-days-versus-
  calendar-days ratio.
- **Quality signals** — open ends, dangling logic, negative lag, constraint count
  by type, out-of-sequence progress, activities with no predecessor or successor.
  These are what a planner judges another planner's programme by, and they are a
  genuine differentiator for the storefront: nobody else surfaces them at a
  glance.
- **Distribution** — an S-curve of activity starts or resource units over time,
  float histogram, activity-type mix, duration histogram.
- **Logic** — longest path length, critical activity count, relationship type mix
  (FS/SS/FF/SF).
- **Progress** — percent complete, actual versus remaining split, whether the
  programme is a baseline or a progressed update.

Then settle the contract itself:

- **Size budget.** What is the ceiling on `derived.json`? It is fetched on the
  storefront, so it competes with page speed.
- **Versioning.** The set will change. How does a stat added in v2 get backfilled
  onto programmes ingested under v1 — recompute from the blob, or accept nulls?
- **The card subset.** Which handful is small enough to live on the Postgres row
  so the grid renders without touching blob storage at all?
- **Failure.** What happens when a stat cannot be computed — a malformed calendar,
  a cyclic logic graph. Null, omit, or fail the ingest?

Consult `/dataviz` before committing to any stat that exists to be charted; if it
does not survive as a chart, it may not be worth computing.

## Resolution

Full contract in [derived-json-contract.md](assets/derived-json-contract.md).

Settled against two real programmes chosen because they fail in opposite directions:
**Fixture A** (41% complete, 69% negative float, 99.6% FS logic) and **Fixture B**
(0% progress, no negative float, but 6.2% leads and 89.5% FS). A contract validated
against either alone would have been wrong.

### The eight decisions

1. **`derived.json` is the detail-page payload, not the grid payload.** It is
   fetched once when a programme is opened. The browse grid renders entirely from
   Postgres and does **zero** blob reads — a 24-card page is one query. This is what
   buys the size budget: had the grid fetched it per card, the ceiling would have
   been ~5 KB of scalars.

2. **Quality surfaces as checks passed / applicable**, never a composite score. The
   incumbents — Primavera Risk Analysis Schedule Check, DCMA 14-point — all publish
   named checks with counts and explanations, and a score we invented would be both
   contestable and uncomparable between a baseline and a progressed update.

3. **DCMA 14-point adopted by name.** Checks 1–10 compute from a standalone `.xer`;
   11, 13 and 14 need baseline tables and skip without them; 12 needs a scheduling
   engine and is **permanently** skipped. Skipped checks leave both numerator and
   denominator, so a tender baseline runs 10 applicable checks rather than being
   penalised as "5/14".

4. **Postgres row = ~11 typed columns + one JSONB `card`.** Split by access
   pattern: typed for anything sorted, ranged or faceted; JSONB for anything merely
   printed. Adding a printed stat costs nothing; promoting a JSONB key to a facet
   costs an `ALTER TABLE` plus backfill, and that price is paid only when
   [Browse, search, filter and ranking](009-browse-search-ranking.md) asks.

5. **Failing checks carry exact counts plus 50 worst-first exemplars**, truncation
   flagged. Bounds the file at ~25 KB of exemplars regardless of programme size.
   Uncapped lists would make the *worst* programmes produce the *biggest* files.

6. **Version-stamped blob path plus lazy recompute on open.** `derived.v<N>.json` is
   a new object, so no CDN purge and rollback is changing a number. A stale
   programme recomputes from the retained `.xer` on first open — one slow open, then
   hot forever, with cost spread over real traffic. Card columns are the exception
   and need an explicit backfill job, because the grid reads them for programmes
   nobody opens.

7. **Bare scalars where a stat always computes; tagged `{state, reason}` where it
   can fail**, plus a top-level `issues[]`. A bare `null` would conflate four
   distinct cases that all occur in the fixtures — degenerate-but-real,
   inapplicable, absent-from-source, and computation-failed. **Ingest never fails on
   a stat error**; only tokenizer failure rejects an upload.

8. **Six stat groups**, ~40–60 KB typical, **150 KB hard ceiling** — ~15× smaller
   than the gzipped `.xer` it summarises. Cut as merely true: mean/median duration,
   UDF inventory, resource cost totals, activity-id length stats, raw `TASKACTV`
   count. Cut to fog: the resource-units S-curve.

### Three findings that changed the design

**`longest_path` is usually unavailable.** `driving_path_flag` is set on **1 of
3,344** activities in Fixture B against 138 in Fixture A — P6 only populates Longest Path
when the scheduler ran with that option on. It cannot be a promised stat. Raised
[Do we compute the critical path ourselves?](014-compute-critical-path.md).

**`critical_count` is meaningless without its threshold.**
`PROJECT.critical_drtn_hr_cnt` is **0 on Fixture B and 168 on Fixture A**. The two files use
the same word for different things, so the threshold ships in the same object as the
count, always.

**Empty float is not zero float.** Fixture A has 345 null-float activities and exactly
345 completed ones. Coercing to zero would report 345 spurious critical activities,
so `float_histogram` carries `null_count` as its own field.

Also confirmed: **WBS is not guaranteed.** Fixture B is a real tender programme with
`PROJWBS = 1` — 3,344 activities under a single node, no breakdown at all. Depth 1
is a correct answer, not an error, and nothing may promise a WBS treemap.

### Consequences

- Unblocks [The storefront card and browse grid](007-storefront-card-and-grid.md),
  [The project detail page](008-project-detail-page.md) and
  [Browse, search, filter and ranking](009-browse-search-ranking.md).
- Feeds [Upload and ingest pipeline](011-upload-ingest-pipeline.md): ingest rejects
  only on tokenizer failure, and the recompute path requires the raw `.xer` be
  retained.
- Every size figure is extrapolated from a 3,344-activity file. The 150 KB ceiling
  is not honestly tested until
  [Get a large synthetic fixture for perf work](012-large-synthetic-fixture.md)
  produces a 20,000-activity programme.

### Amendment 2026-08-07 — [Domain model and schema](005-domain-model-and-schema.md)

Decision 4's Tier 1 table was drafted before Programme and Revision were separate
nouns. It carried `series_id` *and* `parent_id` on one row, so that row was in fact a
revision. Three changes, none touching the tiering itself:

- **The typed columns live on `revision`, not on a flat `programmes` table.** Identity
  moves to a `programme` row carrying `current_revision_id`. The grid stays **one
  query** — the one-query rule was never a zero-join rule — and the derived contract's
  facet-promotion protocol is unchanged, except that a promotion now targets `revision`
  for parsed facts and `programme` for declared ones.
- **`sector` moves to `programme`.** It is declared metadata, not a parsed fact.
  Its source is still [ticket 015](015-sector-classification.md).
- **`xer_url` and `activities_url` are dropped.** Blob keys are id-addressed
  (`p/{programme_id}/r/{revision_id}/…`), so the paths are derivable from ids plus
  `derived_version`, which is retained as the staleness marker.

One addition to `derived.json` itself: a **WBS top-level summary** — name and activity
count per first-level node, capped at 20 with truncation flagged, the same discipline
as the 50-exemplar cap. It lets the detail page render a breakdown on first paint
without fetching `activities.json`, which is where the full tree lives. Depth 1 stays
a correct answer: Fixture B's summary is a single entry. Cost is well inside the
40–60 KB typical figure.

### Amendment 2026-08-08 — [Do we compute the critical path ourselves?](014-compute-critical-path.md)

**`derived.json` goes to v2.** This contract shipped `logic.longest_path` as
`state: "unavailable"` on the honest grounds that P6 usually does not populate
`driving_path_flag`. 014 answers that gap with a **tracer over P6's own dates** — no
scheduling engine — so the field gains a value, and two stats join it.

- **`logic.longest_path` becomes a computed value.** Count, duration in days, share of
  remaining activities, and `provenance: "computed"` — **always computed, even when the
  file carries the flag**, because a stat whose method flips per file cannot be compared
  across programmes. `driving_path_flag` is retained as a *validation oracle*, and
  disagreement is an `info` entry in `issues[]`.
- **`logic.cycle_count`** — a bare stat with members under the existing 50-exemplar cap.
  A cyclic file was never successfully scheduled by P6, which is a fact about the
  programme, not only about our failure. Deliberately **not** a 15th DCMA check: 009
  sorts on `checks_passed / checks_applicable` and a non-standard check makes that ratio
  incomparable.
- **`logic.path_continuous`** — whether the driving chain runs unbroken from the data
  date to the finish. DCMA **12 stays `skip`** (no re-schedule, so the 600-day test
  cannot be run), and this stat carries what 12 was for, outside the ratio.

The state vocabulary is unchanged and absorbs every failure mode: `skip` for a
100%-complete programme, `unavailable` for a never-scheduled one, `ok` with
`truncated: true` where the chain reaches an external predecessor, `error` plus an
`issues[]` entry on a cycle — **ingest still never fails on a stat error**.

Two things this amendment deliberately does *not* do. It adds nothing to `card`, so the
grid is untouched and no backfill obligation arises — 014 declined to put an
acknowledged approximation into the one payload this contract forbids from lazy
recompute. And it leaves `time.duration_working_days` `unavailable`: the tracer compares
dates rather than doing working-time arithmetic, so it never decodes `clndr_data` and
buys nothing here.

> **Amended 2026-08-08** by
> [The goldens assert calendar meaning in prose only](043-calendar-golden-block.md). The tag stands
> and **the reason under it has expired in both halves**. The stated reason — deriving it requires
> decoding `clndr_data`, and multi-shift days and exception *working* days are flagged unverified —
> is answered on both counts: the shapes are verified
> ([021](021-verify-fixtures-in-p6.md)), and `clndr_data` decodes, all 50 calendars in the corpus.
> **Decoding cleanly is not sufficient**, which is what *"reports a value when the calendar decodes
> cleanly"* got wrong: the conversion needs *one* calendar and a programme has several. Every
> synthetic programme splits its activities evenly across a five-day and a seven-day calendar, and
> the same span converts **37–41% apart** depending which is asked (`wbs-flat`, 459 calendar days:
> **328** working days or **460**); `default_flag` marks the calendar new activities inherit, not the
> one a programme is measured on. Fixture A and Fixture B both carry multiple calendars, so this is
> not a synthetic artefact. The tag therefore stands on **calendar ambiguity** rather than on the
> decode, and what shape the stat should have is [045](045-duration-working-days-calendar.md).

> **Amended 2026-08-08** by
> [What calendar is `duration_working_days` measured on?](045-duration-working-days-calendar.md). The
> tag comes off and **`derived.json` goes to v3**. 043's obstacle was measured on the wrong field:
> across 14 real files — ten Fixture A revisions and all four Fixture B variants — the number of
> distinct `TASK.clndr_id` values is **1 on 14 of 14** and equals `PROJECT.clndr_id` on **14 of 14**,
> while `default_flag` is absent from **12 of the 14** and on one of the other two names a calendar
> holding **0 of 1,746 activities**. The 37–41% spread is the corpus's own ten-and-ten split and no
> real programme splits at all. `time.duration_working_days` becomes
> `{ days, calendar: { clndr_id, name, working_days_per_week }, activity_share_pct }` — the calendar
> inside the object with the number, which is this contract's `critical_count` /
> `critical_threshold_hr` rule applied one field along — or `{state, reason}`, following
> `logic.longest_path` exactly. It carries **no hours**: a stock elapsed calendar in 10 of the 14
> files decodes to seven working days of **zero** hours, and a working-day span never divides by a
> day length. `unavailable` keeps 043's reason where there is no `CALENDAR` table; `error` plus an
> `issues[]` warn where the named calendar will not decode, which makes this contract's own worked
> example reachable for the first time. **`card` and the typed columns are untouched, so no
> backfill**, and the field grows by ~160 bytes.

> **Discharged 2026-08-08** by
> [Which flagged set does the ship gate score against?](050-ship-gate-flagged-set.md). The gate
> [014](014-compute-critical-path.md) decision 9 set has been run to a verdict for the first time and
> **passes** — 98.6% recall at 99.9% precision against P6's flagged rows inside decision 3's span,
> pooled over 48 real exports — so `logic.longest_path` becomes a **real value with provenance
> `computed`** and this contract's headline shrug is retired. Its two supporting cases are
> unaffected: `state: "skip"` for a 100%-complete programme and `state: "unavailable"` where
> remaining dates are absent both survive as written. One shape the contract describes turns out to
> be **corpus-only**: the 67 distinct real files carry **zero** external relationships, so
> `state: "ok", truncated: true` is never exercised by a real export.

> **Amended 2026-08-08** by [047](047-report-duration-working-days.md), which builds 045's v3 shape.
> Two things this contract does not yet say. **`duration_working_days.days` counts the window's dates
> with both ends in it and `span_calendar_days` is a difference**, so the two fields measure one
> window on two conventions and differ by one on a calendar that works every day — the Window tile
> prints both and cannot until one is chosen ([058](058-span-difference-versus-count.md)). And the
> `issues[]` worked example this contract has carried since v1 —
> `{ "stat": "time.duration_working_days", "severity": "warn", "reason": "clndr_data parse failed for
> clndr_id 42" }` — is now **emitted code rather than an illustration**, though still the one state no
> fixture produces ([059](059-undecodable-calendar-fixture.md)).
