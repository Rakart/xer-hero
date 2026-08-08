# The `derived.json` contract

Resolution asset for [The derived.json contract](../006-derived-json-contract.md).

`derived.json` is computed once at ingest and is the **detail-page payload**. The
browse grid never reads it — the grid renders entirely from Postgres. This document
fixes what it contains, how big it may be, how it versions, and how it represents
what it could not compute.

Version: **v1**.

## Evidence base

Every threshold and shape below was checked against two real programmes, chosen
because they fail in opposite directions:

| | Fixture A | Fixture B |
|---|---|---|
| what it is | monthly update, live contract | tender submission |
| P6 version | 6.0 | 8.3 |
| activities | 1,751 | 3,344 |
| relationships | 2,824 | 5,883 |
| progress | 41% complete (345 done, 66 active) | **0% — every activity `TK_NotStart`** |
| WBS nodes | 164 | **1 (no breakdown at all)** |
| `TASKACTV` per activity | ~14 | ~6.1 |
| bytes / gzip | 4.81 MB / — | 6.81 MB / 911 KB |

Details in `xer-fixtures.local.md` (local only). The pair matters: one is a
progressed update with negative float everywhere, the other a pristine-looking
tender that fails logic checks. A contract validated against only one of them
would be wrong.

## The three tiers

| Tier | Read when | Size | Holds |
|---|---|---|---|
| Postgres row | every grid render | ~1 KB | sort/filter keys + card display fields |
| `derived.json` | programme opened | **40–60 KB typical, 150 KB ceiling** | everything on the detail page |
| `parsed.json` / raw `.xer` | activity table, full lists, recompute | MBs | the programme itself |

The grid does **zero** blob reads. This is the load-bearing constraint: a 24-card
page must be one Postgres query.

## Tier 1 — the Postgres row

Typed columns are for values that are **sorted, ranged or faceted**. Everything the
card merely prints lives in one JSONB column, so adding a printed stat is not a
migration.

```sql
create table programmes (
  id                  uuid primary key,
  slug                text not null unique,
  title               text not null,
  uploaded_at         timestamptz not null,
  parent_id           uuid references programmes(id),   -- fork lineage
  series_id           uuid not null,                    -- revision series

  activity_count      integer not null,      -- sort, range
  start_date          date,                  -- sort, range
  finish_date         date,                  -- sort, range
  data_date           date,                  -- sort
  pct_complete        numeric(5,2),          -- sort, range
  is_baseline         boolean not null,      -- facet
  checks_passed       smallint not null,     -- sort  \  ranking key
  checks_applicable   smallint not null,     -- sort  /
  p6_version          text not null,         -- facet
  sector              text,                  -- facet  (source undecided, ticket 015)

  card                jsonb not null,        -- display-only, GIN indexed

  xer_url             text not null,
  parsed_url          text not null,
  derived_url         text not null,
  derived_version     smallint not null      -- staleness marker
);
```

`checks_passed` and `checks_applicable` are two columns rather than a ratio because
sorting by "8/11" and sorting by "8/10" are different questions, and
[Browse, search, filter and ranking](../009-browse-search-ranking.md) will need to
choose. Storing a computed ratio would foreclose that.

**Promoting a JSONB key to a typed column is the escape hatch**, and it costs an
`ALTER TABLE` plus a backfill. That is the price of the design and it is paid only
when 009 wants a new facet.

## Tier 2 — `derived.json`

### Top-level shape

```jsonc
{
  "version": 1,
  "programme_id": "…",
  "computed_at": "2026-08-07T09:14:00Z",
  "parser_version": "0.1.0",

  "shape":   { … },
  "time":    { … },
  "progress":{ … },
  "logic":   { … },
  "quality": { … },
  "distributions": { … },
  "codes":   { … },

  "issues": [ … ]
}
```

### `shape`

```jsonc
{
  "activity_count": 3344,
  "relationship_count": 5883,
  "milestone_count": 233,          // TT_Mile + TT_FinMile
  "wbs_depth": 1,                  // Fixture B really is 1 — degenerate, not an error
  "wbs_node_count": 1,
  "calendar_count": 3,
  "resource_count": 37,
  "resource_assignment_count": 6256,
  "activity_code_type_count": 12
}
```

`wbs_depth: 1` is the case that killed the naive design. Fixture B is a real,
professionally produced tender programme with **no WBS breakdown whatsoever** —
3,344 activities under a single node. Any card or chart keyed on WBS must render
sensibly at depth 1, and a WBS treemap is not a stat the contract can promise.

Cut from this group as *merely true*: `TASKACTV` raw row count, UDF inventory,
activity-id length statistics.

### `time`

```jsonc
{
  "start_date": "2017-04-24",
  "finish_date": "2023-08-11",
  "data_date": "2017-09-29T16:00",       // PROJECT.last_recalc_date, naive local
  "span_calendar_days": 2300,
  "duration_working_days": {             // v3, per 045 — or {state, reason}
    "days": 328,
    "calendar": { "clndr_id": 42, "name": "5-Day Week", "working_days_per_week": 5 },
    "activity_share_pct": 50.0
  }
}
```

Dates are **naive local time**. The `.xer` records no timezone anywhere; converting
to UTC invents information. Store and render as wall-clock.

`duration_working_days` is tagged rather than bare because deriving it requires
decoding `clndr_data`, and the format research flags multi-shift days and exception
*working* days as unverified. It reports a value when the calendar decodes cleanly
and `unavailable` when it does not — it never guesses at 8 hours a day.

> **Amended 2026-08-08** by
> [043](../043-calendar-golden-block.md). Both halves of that reason have expired: the shapes are
> verified ([021](../021-verify-fixtures-in-p6.md)) and `clndr_data` decodes — the measurement
> harness decodes all 50 calendars in the corpus. **Decoding cleanly is not sufficient**, which is
> what "reports a value when the calendar decodes cleanly" got wrong: the conversion needs *one*
> calendar and a programme has several. The same span converts **37–41% apart** depending which is
> asked (`wbs-flat`, 459 calendar days: **328** working days or **460**), and `default_flag` marks
> the calendar new activities inherit rather than the one a programme is measured on. The tag stands
> on calendar ambiguity instead, and the shape is [045](../045-duration-working-days-calendar.md).

> **Amended 2026-08-08** by [045](../045-duration-working-days-calendar.md), which **supersedes both
> paragraphs above**. The tag comes off and this file goes to **v3**. 043 measured the ambiguity on
> `default_flag`, which is absent from **12 of 14 real files** and on one of the other two names a
> calendar holding **0 of 1,746 activities**; the field that does name a programme's calendar is
> `PROJECT.clndr_id`, right on **14 of 14**, and distinct `TASK.clndr_id` is **1 on 14 of 14**. The
> 37–41% spread is the corpus's ten-and-ten split, which no real programme reproduces. The field is
> the span on the programme calendar, carrying that calendar and `activity_share_pct` in the same
> object, and **no hours** — a stock elapsed calendar in 10 of 14 files decodes to seven working days
> of zero hours. `unavailable` where there is no `CALENDAR` table or `PROJECT.clndr_id` is
> absent/dangling; `error` plus an `issues[]` warn where the named calendar will not decode. `card`
> untouched, no backfill, +160 bytes.

### `progress`

```jsonc
{
  "pct_complete": 0.0,
  "is_baseline": true,                   // no activity has an actual start
  "status_mix": { "TK_NotStart": 3344, "TK_Active": 0, "TK_Complete": 0 }
}
```

`is_baseline` is not cosmetic — it **decides which quality checks apply**. It is
derived from the data (no actual dates present), not from a label the uploader
chose.

### `logic`

```jsonc
{
  "relationship_type_mix": { "PR_FS": 5267, "PR_SS": 576, "PR_FF": 39, "PR_SF": 1 },
  "open_ends": { "no_predecessor": 42, "no_successor": 110 },
  "external_relationship_count": 0,
  "critical_count": 131,
  "critical_threshold_hr": 0,
  "longest_path": { "state": "unavailable",
                    "reason": "driving_path_flag set on 1 of 3344 activities — P6 did not compute Longest Path on export" }
}
```

Three traps, all confirmed against the fixtures:

**`critical_count` must never ship without `critical_threshold_hr`.** The threshold
is `PROJECT.critical_drtn_hr_cnt` and it is **0 on Fixture B and 168 (21 days) on
Fixture A**. "131 critical activities" and "1,265 critical activities" are answers to
different questions. Rendering either number without its threshold is a lie, and
comparing them across programmes without normalising is a worse one.

**`longest_path` is usually unavailable.** `driving_path_flag` maps to P6's Longest
Path, and P6 only populates it when the scheduler was run with that option enabled.
Fixture B has it on **1 activity out of 3,344**; Fixture A has 138. It cannot be a promised
stat. Whether we compute the critical path ourselves is
[Do we compute the critical path ourselves?](../014-compute-critical-path.md).

**Longest Path is not Critical.** They are different concepts and conflating them is
the classic P6 reporting error. The contract keeps them in separate fields with
separate provenance.

### `quality`

The differentiator. Nobody else surfaces schedule quality at a glance.

```jsonc
{
  "standard": "DCMA-14",
  "passed": 5,
  "applicable": 10,
  "skipped": 4,
  "checks": [
    { "id": "logic", "num": 1, "state": "pass",
      "no_predecessor": 42, "no_successor": 110, "pct": 3.3, "threshold": "<=5%" },

    { "id": "leads", "num": 2, "state": "fail",
      "count": 362, "pct": 6.2, "threshold": "0",
      "truncated": true, "shown": 50,
      "examples": [ { "code": "…", "name": "…", "value_hr": -240 } ] },

    { "id": "out_of_sequence", "num": 11, "state": "skip",
      "reason": "programme has no progress" }
  ]
}
```

#### The check set

Adopting DCMA 14-point by name rather than inventing one: planners are already
audited against it, the thresholds are external and defensible, and it costs us no
credibility to say "this fails DCMA check 4."

| # | Check | Threshold | Computable from a lone `.xer`? |
|---|---|---|---|
| 1 | Logic (open ends) | ≤5% | yes |
| 2 | Leads (negative lag) | 0 | yes |
| 3 | Lags | ≤5% | yes |
| 4 | Relationship types (FS) | ≥90% | yes |
| 5 | Hard constraints | ≤5% | yes |
| 6 | High float (>44d) | ≤5% | yes |
| 7 | Negative float | 0 | yes |
| 8 | High duration (>44d) | ≤5% | yes |
| 9 | Invalid dates | 0 | yes |
| 10 | Resources assigned | — | yes |
| 11 | Missed tasks | ≤5% | **needs baseline** |
| 12 | Critical path test | — | **needs a scheduling engine — permanently skipped** |
| 13 | CPLI | ≥0.95 | **needs baseline** |
| 14 | BEI | ≥0.95 | **needs baseline** |

No fixture contains baseline tables, so 11, 13 and 14 skip in practice today. Check
12 requires inserting a 600-day delay and re-scheduling; without a CPM engine it is
permanently `skip`, and it is stated as such rather than quietly omitted.

#### Measured against both fixtures

This is what makes the check set worth shipping — it **discriminates**, and it
discriminates in opposite directions on two programmes that both look respectable:

| # | Check | Fixture B tender | Fixture A update |
|---|---|---|---|
| 1 | Logic | 1.3% / 3.3% ✅ | 1.1% / 2.1% ✅ |
| 2 | Leads | **6.2%** ❌ | 0% ✅ |
| 3 | Lags | **8.8%** ❌ | 0.3% ✅ |
| 4 | Relationship types | **89.5% FS** ❌ | 99.6% ✅ |
| 5 | Hard constraints | 4.2% ✅ | 3.1% ✅ |
| 6 | High float | **75.7%** ❌ | 4.2% ✅ |
| 7 | Negative float | 0% ✅ | **69.0%** ❌ |
| 8 | High duration | **42.2%** ❌ | **18.8%** ❌ |
| 10 | Resourced | 86.4% | 83.4% |

Fixture B misses DCMA-4 by half a percentage point — 89.5% against a 90% floor. A
threshold that fine is exactly why the check ships with its raw value and its
threshold visible, never as a naked verdict.

#### Skip is not fail

A skipped check is excluded from both numerator and denominator. A tender baseline
runs **10 applicable checks**; a progressed update with a baseline attached runs 14.
Reporting a baseline as "5/14" would penalise it for being a baseline.

#### Exemplars

Each failing check carries its **exact count** plus up to **50 examples**, worst
first, with `truncated: true` when there are more. This bounds the file: the worst
programme in the corpus produces the same ~25 KB of exemplars as a mediocre one.
Uncapped lists would mean the worst programmes generate the biggest files, which is
backwards.

The detail page shows "2,530 activities — here are the 50 worst" and links to the
full list, which is a `parsed.json` fetch.

### `distributions`

**Fixed buckets, never adaptive.** Two histograms are only comparable if they share
bucket edges, and revision-diff — which the map names as probably the feature
planners care most about — is a histogram comparison. Adaptive buckets would make it
impossible and the damage would not surface until v2.

```jsonc
{
  "s_curve": {
    "bucket": "month",
    "from": "2017-04", "to": "2023-08",
    "starts":     [12, 47, 91, …],
    "finishes":   [0, 3, 22, …],
    "cumulative": [12, 59, 150, …]
  },
  "float_histogram": {
    "unit": "days",
    "edges": [null, -20, 0, 5, 10, 20, 44, 100, 200, null],
    "counts": [0, 0, 131, 96, 210, 377, 2530, …],
    "null_count": 0
  },
  "duration_histogram": {
    "unit": "days",
    "edges": [0, 1, 5, 10, 20, 44, 100, 200, null],
    "counts": [233, 412, 601, …]
  },
  "activity_type_mix": { "TT_Task": 3111, "TT_FinMile": 213, "TT_Mile": 20 }
}
```

Monthly S-curve buckets: Fixture A spans 6.4 years → 77 points. Weekly would be 334 and
buys nothing at detail-page scale.

`float_histogram.null_count` is its own field because **empty float is not zero
float**. Fixture A has 345 null-float activities and exactly 345 completed activities —
float is absent precisely because the work is done. Coercing those to zero would
report 345 spurious critical activities.

Cut and moved to the map's fog: the **resource-units S-curve**. It would compute
(86% of Fixture B is resourced) but it carries units and cost semantics of its own and
belongs with the detail-page design.

### `codes`

Activity codes are how planners actually slice a programme. The fixtures make the
case: `TASKACTV` is the largest table in both files, at ~14 assignments per activity
in Fixture A and ~6.1 in Fixture B.

```jsonc
{
  "types": [
    { "name": "Discipline", "value_count": 14, "assigned_pct": 99.1 },
    { "name": "Area",       "value_count": 31, "assigned_pct": 97.4 }
  ],
  "truncated": false
}
```

Values themselves are not enumerated here — a code type with hundreds of values
would dominate the file. Whether codes become a browse facet belongs to
[Browse, search, filter and ranking](../009-browse-search-ranking.md).

### `issues`

```jsonc
[
  { "stat": "logic.longest_path", "severity": "info",
    "reason": "driving_path_flag set on 1 of 3344 activities" },
  { "stat": "time.duration_working_days", "severity": "warn",
    "reason": "clndr_data parse failed for clndr_id 42" }
]
```

Lets the detail page banner "partially analysed" without walking the whole tree.

## Representing what could not be computed

A bare `null` conflates four genuinely different situations, all four of which occur
in the fixtures:

| Situation | Example | Representation |
|---|---|---|
| **Degenerate but real** | Fixture B `wbs_depth` genuinely is 1 | bare value `1` |
| **Inapplicable** | out-of-sequence on a 0%-progress tender | `state: "skip"` + reason |
| **Absent from source** | `driving_path_flag` unpopulated by P6 | `state: "unavailable"` + reason |
| **Computation failed** | undecodable `clndr_data`, cyclic logic | `state: "error"` + reason, plus `issues[]` |

The rule: **stats that always compute stay bare scalars; only stats that can fail
are tagged.** Wrapping `activity_count` in `{value, state}` would triple the file
and force every consumer to unwrap a value that never fails.

### Ingest never fails on a stat error

Only **tokenizer failure rejects an upload** — if `%T`/`%F`/`%R` cannot be read,
there is nothing to publish. Every stat-level failure is recorded in `issues[]` and
the programme publishes anyway.

A half-analysed programme is still worth having on the shelf, and silent upload
rejection is the worst failure mode for a warehouse: the uploader has no idea what
went wrong and no way to fix it. Consumed by
[Upload and ingest pipeline](../011-upload-ingest-pipeline.md).

## Size budget

| Component | Typical | Worst realistic |
|---|---|---|
| scalars (shape/time/progress/logic) | 2 KB | 3 KB |
| quality verdicts | 4 KB | 6 KB |
| quality exemplars (10 × 50 capped) | 25 KB | 25 KB |
| distributions | 5 KB | 12 KB |
| codes | 2 KB | 8 KB |
| **total** | **~40–60 KB** | **~55 KB** |

**Hard ceiling: 150 KB.** Ingest logs a warning above 100 KB and fails the *stat
computation* (not the upload) above 150 KB, emitting a minimal `derived.json` plus
an `issues[]` entry.

For scale: the Fixture B `.xer` is 6.81 MB raw, 911 KB gzipped. A 60 KB `derived.json`
is ~15× smaller than the gzipped file it summarises and ~115× smaller than raw.
Every capped list in the contract exists to keep this number flat as programme size
grows — a 20,000-activity file should produce a `derived.json` of the same order as
a 3,000-activity one.

## Versioning and backfill

The blob path carries the version:

```
/p/<programme_id>/derived.v1.json
```

A new version writes a **new object**. Nothing is overwritten, so there is no CDN
purge, old versions age out naturally, and rollback is changing a number.

The Postgres row carries `derived_version` as a staleness marker. On programme open:

```
row.derived_version < CURRENT_VERSION
  -> fetch the archived .xer
  -> reparse under the current parser
  -> write derived.v<N>.json
  -> update the row and its derived_version
```

One slow open, then hot forever. Recompute cost is spread across real traffic and
programmes nobody opens cost nothing — which matters because "cheap" is a founding
constraint and a corpus-wide reprocess would re-read every blob.

**Card columns are the exception.** The grid reads them for programmes that are
never opened, so laziness would leave them permanently stale. A version bump that
touches a typed column or a `card` JSONB key requires an **explicit backfill job**
over rows below the current version. Bumps that only touch `derived.json` do not.

This is why the tiering matters: card-column changes are expensive and rare,
`derived.json` changes are cheap and expected.

Recompute is always possible because the original `.xer` is retained — consistent
with the format research's finding that re-parsing the archived blob is the only
recovery path for fields an older parser dropped.

## Open dependencies

- **Sector** is a typed facet column with no decided source —
  [Where does a programme's sector come from?](../015-sector-classification.md).
- **Critical path** computation, if `longest_path` is to be more than usually
  unavailable — [Do we compute the critical path ourselves?](../014-compute-critical-path.md).
- **Charts** for the distributions are the detail page's problem —
  [The project detail page](../008-project-detail-page.md), which should consult
  `/dataviz` before committing to a form.
- **Which card fields render** is [The storefront card and browse grid](../007-storefront-card-and-grid.md);
  this contract fixes what is *available*, not what is shown.
- **20,000-activity validation.** Every size figure here is extrapolated from a
  3,344-activity file. [Get a large synthetic fixture for perf work](../012-large-synthetic-fixture.md)
  is what tests the 150 KB ceiling honestly.

## Reproducing the check measurements

The profiler used for the DCMA table above, run against both fixtures. Name-mapped,
never positional — per the format research's rule.

```awk
BEGIN{FS="\t"}
{ sub(/\r$/,"") }
/^%T/{ tbl=$2; delete ix; next }
/^%F/{ for(i=2;i<=NF;i++) ix[$i]=i; next }
/^%R/{
  if(tbl=="PROJECT"){ dd=$(ix["last_recalc_date"]); crit=$(ix["critical_drtn_hr_cnt"]) }
  if(tbl=="TASK"){
    n++; id=$(ix["task_id"]); tsk[id]=1
    tf=$(ix["total_float_hr_cnt"]); ct=$(ix["cstr_type"]); d=$(ix["target_drtn_hr_cnt"])
    if(tf=="") tfnull++
    else { if(tf+0<0) negfloat++; if(tf+0>352) highfloat++ }   # 44d @ 8h
    if(ct!="") ncstr++
    if(d+0>352) highdur++
    if($(ix["driving_path_flag"])=="Y") lp++
    if(tf!="" && crit!="" && tf+0<=crit+0) critn++
  }
  if(tbl=="TASKPRED"){
    np++; hassucc[$(ix["pred_task_id"])]=1; haspred[$(ix["task_id"])]=1
    ptype[$(ix["pred_type"])]++
    lg=$(ix["lag_hr_cnt"])+0
    if(lg<0) neglag++; if(lg>0) poslag++
    if($(ix["pred_proj_id"])!=$(ix["proj_id"])) ext++
  }
  if(tbl=="TASKRSRC"){ resd[$(ix["task_id"])]=1 }
}
END{
  for(t in tsk){ if(!(t in haspred)) nopred++; if(!(t in hassucc)) nosucc++ }
  # ... print counts and percentages
}
```

The 44-day thresholds for DCMA 6 and 8 are converted at 8 hours per day. A programme
whose calendar uses a different `day_hr_cnt` needs the conversion done per calendar —
another reason `duration_working_days` is tagged rather than assumed.

> **Amended 2026-08-08** by [045](../045-duration-working-days-calendar.md). The worry is retired on
> measurement: of **54 real `CALENDAR` rows**, **44 decode to an eight-hour day** and the other 10
> are a stock elapsed calendar no activity is assigned to, so the 44-days-at-8-hours conversion is
> safe on the real evidence. And `day_hr_cnt` was never the reason for tagging in the first place —
> 038 established it cannot be trusted, and 045 keeps hours out of the field entirely.
