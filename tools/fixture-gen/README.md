# fixture-gen

Generates the synthetic `.xer` fixtures in [`fixtures/`](../../fixtures/synthetic/README.md).
Node ≥ 18, no dependencies.

```bash
node tools/fixture-gen/generate.mjs              # corpus + sparse-150 (committed)
node tools/fixture-gen/generate.mjs --only perf-20k
node tools/fixture-gen/generate.mjs --all        # perf files too (~70 MB on disk)
node tools/fixture-gen/generate.mjs --list

node tools/fixture-gen/measure.mjs <file.xer>    # bytes, gzip, parse time, heap, json sizes
node tools/fixture-gen/measure.mjs --verify      # round-trip the corpus against its goldens
```

Every fixture is a pure function of its catalogue entry and a seed derived from its
name, so regenerating gives byte-identical output and adding a fixture never
reshuffles another.

## Layout

| File | What it holds |
|---|---|
| `catalogue.mjs` | The fixture list — what exists and why each one exists |
| `generate.mjs` | CLI; writes the `.xer` and its `.expected.json` golden |
| `measure.mjs` | Measurement harness and corpus round-trip. **Not the product parser** |
| `lib/schema.mjs` | The `%F` field-name contracts for P6 6.0 and 8.3, transcribed from real exports |
| `lib/programme.mjs` | Synthesises WBS, activities, logic, progress, codes, resources; runs the CPM and the driving-path walk |
| `lib/tables.mjs` | Model → `%R` rows |
| `lib/emit.mjs` | Streaming writer: `ERMHDR`, `%T`/`%F`/`%R`, `%E`, CRLF, CP1252 |
| `lib/calendar.mjs` | Working-time model, the packed `clndr_data` blob, and the one statement of how a row writes a working hour as an instant (`rowStart`/`rowFinish`) |
| `lib/cp1252.mjs` | Output encoding, including deliberately invalid bytes |
| `lib/rng.mjs` | Seeded PRNG |

## What is real and what is invented

`lib/schema.mjs` carries **field names and their order**, transcribed verbatim from
real P6 exports. Those are format facts. **No values** from the source programmes are
reproduced anywhere in this repo — every id, name, date and quantity below is
generated.

The generator runs a genuine **CPM forward and backward pass** (`lib/programme.mjs`),
so early/late dates, total float, free float and the critical path mean something.
Random dates would give a meaningless float histogram and a DCMA score that measures
nothing, which would make the fixtures useless for both the detail page and the
quality checks.

It then runs a **backward walk for the Longest Path**, and `driving_path_flag` is
written from that walk and from nothing else. It used to be written from `tf <= 0`,
which is the float/Longest-Path conflation
[the format research](../../docs/wayfinder/tickets/assets/xer-format.md) warns about;
that made the corpus assert something false, and
[022](../../docs/wayfinder/tickets/022-generator-longest-path-and-landmines.md) fixed
it. The walk spans remaining work as of the data date, keeps ties because driving
paths **branch**, terminates on a cyclic network, and reports where it leaves the file.

Each golden records the walk twice — the truth, and what a tracer reading only the
emitted bytes can arrive at — so the approximation
[014](../../docs/wayfinder/tickets/014-compute-critical-path.md) accepted is measured
rather than argued. The second walk implements decision 4 **as amended by
[028](../../docs/wayfinder/tickets/028-driving-test-relationship-types.md)**: the
demand compared is the one the relationship type constrains, measured against the
successor timestamp it constrains, plus a floor that drops a candidate demanding
strictly less than its reference where the two are the same kind of instant and the
lag is zero. See [`fixtures/synthetic/README.md`](../../fixtures/synthetic/README.md).

**Where the two walks differ, every difference must be explained.** `why` names the
disagreeing activities and their causes, and `measure.mjs --verify` fails a fixture whose
`misses` or `marks_in_error` is non-empty while `why` is empty
([042](../../docs/wayfinder/tickets/042-seed-divergence-unnamed.md)). The cause that shape
was hiding is the **seed**: the two walks compare driving predecessors activity by
activity, but they also choose where to *start* by different rules — the truth on the
latest remaining finish in working hours, the readable rule on the latest emitted finish
instant — so they can start in different places while agreeing about everything they both
reach. The goldens carry both seed sets side by side in
`as_read_from_the_file.seed_agreement`, and since
[049](../../docs/wayfinder/tickets/049-generator-milestone-instant.md) they **agree on every
file**: the thing that used to write one working moment as two instants was this generator's
own milestone rule, not the format.

**A zero-duration row writes one instant, and it is a finish.** `lib/calendar.mjs`'s
`rowStart`/`rowFinish` are the single statement of it, called by the emitter *and* by the
readable walk — the rule used to be written out twice, in `lib/tables.mjs`'s `inst` and in
`makeReadableDrivers`, and it was wrong in both copies from 022 to 049. A finish is the end
of working hour `h − 1` on every row; a zero-duration row's start is that same instant, so
`early_start_date == early_end_date`, which is what a finish milestone carries in a real
export and what 044 measured 28,695 of. `measure.mjs --verify` reads `early_start_date`,
`early_end_date`, `act_start_date` and `act_end_date` back out of the emitted file by name
and compares them to the golden; nothing did before, which is why a wrong rule survived six
tickets that regenerated this corpus.

**Free float is computed per relationship type too**, and for the same reason one
ticket later
([032](../../docs/wayfinder/tickets/032-generator-free-float-by-type.md)): the slack a
successor leaves is `succ.ES − pred.EF − lag` only for `FS`, and using it for `SS`,
`FF` and `SF` was wrong on 9 of the corpus's 529 float-carrying rows — eight of them
turned into a spurious **zero** by the clamp, which is the value 014 decision 4 reads
as corroboration that a relationship is driving. `measure.mjs --verify` now reads
`free_float_hr_cnt` back out of the emitted file and compares it to the golden;
nothing did before, which is why a value written into every golden stayed wrong
through two tickets that edited this file. A generator reverting to the FS formula
scores **24/29**.

**The working-day span is converted on `PROJECT.clndr_id`**, and the expected value comes
from the working week `buildClndrData` packed rather than from the file's own dates
([045](../../docs/wayfinder/tickets/045-duration-working-days-calendar.md), built by
[047](../../docs/wayfinder/tickets/047-report-duration-working-days.md)). Those are not the
same thing here and the difference is the generator's: every activity is laid out on **one**
five-day `WorkCalendar` whatever `TASK.clndr_id` says, so on `wbs-flat` **6 of 19** rows'
`target_drtn_hr_cnt` disagrees with the seven-day calendar they are assigned to. A golden
read off those dates would assert the inconsistency instead of the conversion, so
`durationWorkingDays` in `generate.mjs` walks `Date`s against the packed week while
`measure.mjs` walks 1899-12-30 day serials against the decoded one — two implementations
that share no line, for the same reason the decoder shares none with `buildClndrData`.
`days` counts **both ends of the window**, which is P6's own duration arithmetic and needs
no day length; `activity_share_pct` and `shape.calendars_in_use` say how much of the
programme the number is true of.

**Calendars are asserted by meaning, not by count.** Every golden carries a
`calendars` block — worked days, the shifts on each, hours per working day, and the
exceptions with their decoded dates and whether each is worked — written from the
working-time model `lib/calendar.mjs` packed into `clndr_data` and recorded as it packed
it (`meaningOf`), so a `mutate` hook that swaps a calendar's blob is followed without
anything ever parsing our own output. `measure.mjs --verify` decodes the emitted blob and
compares. Before
[043](../../docs/wayfinder/tickets/043-calendar-golden-block.md) the golden recorded
`calendar_count` and the meaning lived in the `landmine` prose, which is the same defect
free float had one ticket earlier. Beside the meaning sits `declared` — `day_hr_cnt` and
`week_hr_cnt` as the row states them — because neither is ever the source of a day length
and `cal-flat-no-0x7f` ships a row declaring a 56-hour week over a pattern working 40.

The knobs that matter are in the catalogue entry: activity count, WBS shape,
relationship density, `TASKACTV` density (the biggest lever on file size — ~6 per
activity on one real programme, ~14 on another), progress mode, and
`deadlineSlipDays`, which pulls the project deadline in to manufacture negative
float.

## Adding a fixture

Add an entry to `catalogue.mjs` with a `landmine` string saying what would break
without it, run `generate.mjs`, then `measure.mjs --verify`. A `mutate(tables)` hook
lets a fixture bend the emitted rows — delete a table, corrupt a value, add a table
Oracle never documented.

**`mutate` must not change the logic.** The golden is written from the model, so a
hook that rewrites `TASKPRED` behind the model's back makes the golden assert a
driving path the file cannot show. Anything the trace has to know about is a model
option instead: `externalRels`, `hideRelationships`, `externalDrivingPred`,
`injectCycle`, `forceDrivingBranch`, `relTypes`, `floatPaths`. Two fixtures that
predate the walk (`missing-taskpred`, `external-relationship`) were moved onto those
options for exactly this reason.

**A number in a `landmine` string must be a number its golden carries.** The string is
copied verbatim into `<fixture>.expected.json`, so a stale figure ships as part of the
assertion and nothing compares the two — `logic-no-longest-path` claimed "25 activities
have total float <= 0 and 7 are on the Longest Path" against a golden saying 19 and 4,
for two tickets, and it was found by reading rather than by any test. Swept in full by
[032](../../docs/wayfinder/tickets/032-generator-free-float-by-type.md): it was the only
wrong one of the 24. Prefer a claim the golden can settle, and check it after
regenerating.

## measure.mjs is throwaway

It exists to answer the sizing questions ticket 012 owes tickets 004, 006 and 011,
and to prove the generated files survive a name-mapped read. The real parser is
isomorphic TypeScript, is product code, and is deliberately not written yet. Anything
`measure.mjs` computes is approximate — DCMA check 9 in particular is stubbed to
pass, and CP1252's `0x80-0x9F` block is read as Latin-1 because byte-preservation is
all a size measurement needs.
