# Where the tracer seeds, and where P6 seeds

Resolution asset for
[Does the tracer seed where P6 seeds?](../044-tracer-seed-tie-break.md).

Measured 2026-08-08 against the real exports [001](../001-get-real-xer-files.md) secured —
**Fixture A** (139 files) and **Fixture B** (4 files) — read in place, read-only. Node 24.18,
WSL2. Client, contract and file paths live only in the gitignored register; **everything here
is a measurement**.

The rule under measurement is the readable walk as
[`tools/fixture-gen`](../../../../tools/fixture-gen/README.md) implements it
(`makeReadableDrivers` / `traceReadable` in `lib/programme.mjs`), not a fresh reading of
[014](../014-compute-critical-path.md) decision 3.

---

## The headline

**The divergence [042](../042-seed-divergence-unnamed.md) found is a property of the
generator, not of P6.** On real exports the seed set ties **exactly** — a finish milestone and
the tasks that finish with it write the *same* `early_end_date` — so the rule already seeds on
the whole tie. Where P6 does write the milestone a working gap later, the tasks it leaves
behind are the milestone's own driving predecessors and the walk reaches them anyway.

Across the **48 files carrying a usable oracle**: our seed set contains **every** row P6
seeded on, **0 seeds dropped**, and **0 flagged activities reachable only through a dropped
seed**. Extended to the 19 files where P6 flagged exactly one row, the score is **67 of 67**.

Both candidate tie-breaks were priced. Neither buys a single activity.

---

## 1. What was read

| | Fixture A | Fixture B |
|---|---|---|
| `.xer` files on disk | 139 | 4 |
| unreadable | 1 — 397,781 bytes of `NUL`, [021](../021-verify-fixtures-in-p6.md)'s finding | 0 |
| read | 138 | 4 |
| **distinct by SHA-256** | **67** | 4 |
| multi-project (distinct `TASK.proj_id` > 1) | 0 | 0 |
| activities / relationships (distinct files) | 109,584 / 175,524 | 13,353 / 23,581 |
| `driving_path_flag` on > 1 row | **48** | 1 (3 rows) |
| `driving_path_flag` on exactly 1 row | 19 | 3 |

Fields were read by mapping each table's `%F` names to indices **per table per file**
([002](../002-xer-file-structure.md)), never by position. A record runs to the next line
beginning `%T`/`%F`/`%R`/`%E`, because a text value may contain newlines — reading line-wise
truncates the row and silently changes the answer, which is how the transcription check below
first failed.

**Four export versions are present in Fixture A, not two:** 6.0 × 127, 6.2 × 2, 7.0 × 4,
8.3 × 5, plus the zeroed file. 001 and 021 record 6.0 and 8.3 only. The eleven distinct
activity counts (543, 835, 853, 918, 978, 1,047, 1,125, 1,186, 1,344, 1,746, 1,751) also say
the 139 files are **not one programme's revision series**; there are several distinct
programmes in the tree.

## 2. The method

The measurement reads the emitted columns and runs `makeReadableDrivers`' rule —
[014](../014-compute-critical-path.md) decision 4 **as amended by
[028](../028-driving-test-relationship-types.md)**: per-type demand against the successor
timestamp the type constrains, argmax with ties kept, plus the same-kind zero-lag floor with
its milestone guard. The seed rule is `traceReadable`'s verbatim:

```
remaining = rows where status_code != 'TK_Complete' and early_end_date is non-empty
latest    = max(early_end_date) over remaining
seeds     = every remaining row whose early_end_date == latest
```

**The transcription is proved, not asserted.** Run against the committed corpus `.xer` bytes
and compared to each golden's `as_read_from_the_file`, on both `seeds` and `members`:

```
24 pass, 0 fail, 3 skipped, of 27 corpus files
```

The three skipped are the ones with no readable walk — `enc-zeroed-file`, and
`logic-complete-no-remaining` / `progress-full`, which are `state: skip`. So the rule measured
below is the rule the corpus asserts, reached independently from the bytes.

**Where P6 seeded is not written in the file, so it is taken from the oracle.** A backward
walk starts at the **sinks of the flagged subgraph**: a `driving_path_flag = Y` row that
drives no other flagged row is a row P6 must have started from. On all 48 oracle files that
set has exactly **one** member.

## 3. Measurement 1 — the tie on the latest `early_end_date`

Over the 67 distinct Fixture A files:

| seed-set size | files | composition |
|---|---|---|
| 1 | 20 | the milestone row alone |
| 2 | 46 | **1 milestone row + 1 non-milestone row**, at the same instant |
| 9 | 1 | **1 milestone row + 8 non-milestone rows**, at the same instant |

- **47 of 67 files tie** (seed set larger than one).
- **47 of 47 ties are mixed** — a row where `early_start_date == early_end_date` beside one
  where it does not. There is not one all-milestone tie and not one all-task tie.
- **All 67 files have exactly one milestone row in the seed set** — 66 typed `TT_FinMile`,
  one `TT_Mile`. A programme ending in a finish milestone is not the common shape here; it is
  the only shape.
- **No file seeds on a task alone.**

Fixture B agrees: three files seed on a single `TT_FinMile`, one on three `TT_FinMile` rows
tying exactly. No mixed tie, because nothing is progressed and the milestones stand alone.

The gap from the latest instant down to the next distinct one:

| gap | files (of 67) |
|---|---|
| ≤ 16 h | 2 |
| (16, 24] h | 1 |
| (24, 72] h | 0 |
| (72, 168] h | 33 |
| > 168 h | 31 |

The minimum gap anywhere in the set is **14 hours**. Nothing sits at 1–8 hours below the
latest, so no rule that admits a *near* instant is ever choosing between fine distinctions —
and 64 of the 67 files have nothing within three days of their latest finish at all.

## 4. Why the tie is exact — where P6 puts a finish milestone

042 predicted a strict ordering: a milestone writes its finish as a start instant, so it lands
at the next morning's `08:00` while the tasks that finish with it sit at the previous
afternoon's `16:00`, and the reader ranks the milestone strictly later. **That is what the
generator does. It is not what P6 does.**

For every row with at least one zero-lag `PR_FS` predecessor, the *minimum*
`succ.early_start_date − pred.early_end_date` — the gap left by the latest-finishing
predecessor, the one that plausibly set the date:

| gap | rows with `early_start_date == early_end_date` | all other rows |
|---|---|---|
| **0** | **27,655 (96.4%)** | 35,221 (45.2%) |
| (0, 8] h | 1 (0.0%) | 140 (0.2%) |
| (8, 16] h | 237 (0.8%) | **42,141 (54.1%)** |
| (16, 24] h | 2 (0.0%) | 1 (0.0%) |
| (24, 72] h | 10 (0.0%) | 89 (0.1%) |
| > 72 h | 789 (2.7%) | 233 (0.3%) |
| negative | 1 (0.0%) | 28 (0.0%) |
| **n** | **28,695** | **77,853** |

Fixture B, 4 files: 33.5% at gap 0 and 12.7% at (8, 16] in the left column, against 88.5% at
(8, 16] and 0.0% at gap 0 in the right. Smaller and all-unprogressed, and it points the same
way.

> **Corrected 2026-08-08** by
> [044's milestone-instant figures are measured over a selector that is not a milestone test](../057-correct-milestone-instant-figures.md).
> **The two columns above were headed *"milestone rows (`early_start_date == early_end_date`)"*
> and *"non-milestone rows"*, and the paragraph below them read *"96.4% against 0.8% is not a
> tendency, it is the rule with exceptions."*** Every count in the table is right and the
> labels are not: the selector carries no status restriction, and on a progressed programme
> **26,325 of Fixture A's 105,028 `TT_Task` rows** satisfy it — 25.1%, of which **26,307 are
> `TK_Complete`** — because a completed activity has no remaining span, so P6 collapses its
> early dates to a point. Roughly 26,000 of the 28,695 are therefore completed tasks, and the
> 77,853 on the right are the same task population with those rows removed. **The table
> compares progressed rows against live ones far more than it compares milestones against
> tasks**, and 96.4% / 54.1% must not be quoted as a milestone-versus-task figure. The
> replacement is §4a below; the finding is [054](../054-ff-milestone-guard.md)'s, the selector
> rule is stated on [014](../014-compute-critical-path.md) decision 4, and **nothing in §§1–3
> or 5–8 of this asset is derived from this table** — the seed answer, the tie counts, the
> oracle scores and both priced candidates all stand.

### §4a — the same question asked of `task_type` (added 2026-08-08 by 057)

Same device, same files, but the population is **live rows with at least one live zero-lag
`PR_FS` predecessor**, so no completed row contaminates either side, and the split is by
`TASK.task_type` rather than by zero span. The right-hand column is the share landing at the
predecessor's finish rather than one shift later — the only two buckets the question is
actually about:

| Fixture A | n | gap 0 | (8, 16] h | other | **at gap 0, of the two** |
|---|---|---|---|---|---|
| `TT_FinMile` | 1,879 | 1,107 (58.9%) | **19 (1.0%)** | 753 | **98.3%** |
| `TT_Mile` | 400 | 166 (41.5%) | **192 (48.0%)** | 42 | 46.4% |
| `TT_Task` | 75,518 | 33,457 (44.3%) | 41,596 (55.1%) | 465 | 44.6% |

| Fixture B | n | gap 0 | (8, 16] h | other | **at gap 0, of the two** |
|---|---|---|---|---|---|
| `TT_FinMile` | 541 | 207 (38.3%) | **0 (0.0%)** | 334 | **100%** |
| `TT_Mile` | 80 | 1 (1.3%) | **79 (98.8%)** | 0 | 1.3% |
| `TT_Task` | 10,308 | 4 (0.0%) | 9,123 (88.5%) | 1,181 | 0.0% |

**P6 writes a Finish Milestone at its driver's finish instant. It writes a task's start — and
a Start Milestone's — at the next working period.** The asymmetry is real and runs the opposite
way to the generator's, exactly as §4 concluded; what moves is that it belongs to
**`TT_FinMile` alone**. A `TT_Mile` tracks the task distribution (46.4% against 44.6%; 1.3%
against 0.0%), so *"a milestone writes its finish as a start instant"* is true of one milestone
type and false of the other, and a selector that cannot tell them apart cannot state the rule.
The *other* column is rows whose date is set by something that is not their nearest zero-lag
`FS` predecessor — a constraint, a lag, non-`FS` logic — and it is why the raw gap-0
percentages (58.9%, 41.5%) sit below the two-bucket shares. It is 40.1% of `TT_FinMile` rows
and 0.6% of `TT_Task` rows, which is Oracle's *"the longest path is broken … when activity
dates are driven by constraints"* showing up as a residual on exactly the row type a programme
constrains.

Pooled over both typed kinds the live figure is **55.9% of 2,279 at gap 0 against 9.3% one
shift later**. It is recorded once and not used: pooling 98.3% with 46.4% reproduces in
miniature the conflation this section exists to undo.

Reproduced 2026-08-08 by an independently written reader over the same 67 distinct Fixture A
files and 4 Fixture B files; §4's own table reproduces to the row from it, which is the
cross-check that the correction is a relabelling and not a different measurement. One row type
§4a's table omits for the same reason 054's did: **30 live `TT_Rsrc` rows** in Fixture A fall in
this population, resource-dependent activities that take the column's own kind like any task.

That is the whole of why the tie is exact, and why the corpus divergence cannot occur here.

## 5. Measurement 2 — does our seed lie inside P6's flagged set?

| | oracle files (48) |
|---|---|
| seeds our rule picks, total | **102** |
| of those, carrying `driving_path_flag = Y` | **102 (100%)** |
| files where every seed is flagged | **48 / 48** |
| P6 seed sinks (flagged rows driving no flagged row) | **48** — exactly 1 per file |
| sinks **not** in our seed set — dropped seeds | **0** |
| files with ≥ 1 dropped seed | **0** |

On the 19 files where P6 flagged exactly one row, **that row is one of our seeds in all 19**.
Nothing in the set contradicts it: across all 67 distinct files, every row P6 marked as an end
of the driving path is a row this rule seeds on.

## 6. Measurement 3 — flagged activities reachable only through a dropped seed

**Zero, on all 48 oracle files.** The set of dropped seeds is empty, so the cost of seeding on
the milestone alone is not small on real programmes; it is nothing.

### The one file where 042's shape is real, and it still costs nothing

One file — P6 7.0, 1,047 activities, 100% not started, 30 flagged — seeds on its
`TT_FinMile` **alone**, and **12 remaining activities sit exactly 16 hours below it, 10 of
them flagged**. This is precisely the shape 042 described: one working moment, the milestone
written at the next morning's start and the tasks at the previous afternoon's finish.

Our rule scores **100% recall at 100% precision** on it. The ten flagged activities 16 hours
below are the milestone's own **driving** predecessors, so the walk reaches every one of them
from the single seed.

That is the difference between this and `cal-flat-no-0x7f`, where the same shape costs four
activities. There the dropped seed `A001190` is a predecessor of the milestone but *not* a
driving one under the readable rule, so nothing else reaches it. That is an engineered branch
— [022](../022-generator-longest-path-and-landmines.md) built the fixture to have one — and
the real set contains no instance of it.

## 7. The candidates, priced

Scored against `driving_path_flag` on the 48 oracle files, with the oracle restricted to rows
that are not `TK_Complete` (see §8 — P6 flags completed activities, and decision 3's span
excludes them):

| seed rule | seeds | marked | correct | recall | precision |
|---|---|---|---|---|---|
| **status quo — argmax `early_end_date`** | **102** | **3,402** | **3,400** | **98.6%** | **99.9%** |
| + P6's own dropped seeds (the ceiling this could buy) | 102 | 3,402 | 3,400 | 98.6% | 99.9% |
| within one shift of the latest (8 h) | 102 | 3,402 | 3,400 | 98.6% | 99.9% |
| within 16 h | 114 | 3,405 | 3,400 | 98.6% | 99.9% |
| within 24 h | 114 | 3,405 | 3,400 | 98.6% | 99.9% |
| within 64 h | 114 | 3,405 | 3,400 | 98.6% | 99.9% |
| within 72 h | 114 | 3,405 | 3,400 | 98.6% | 99.9% |
| every remaining activity with no live successor | **2,113** | **21,408** | 3,415 | 99.1% | **16.0%** |

Oracle total: **3,447** flagged remaining activities.

**The window rule buys nothing and is not free.** Every width from 16 h to 72 h admits the
same 12 extra seeds — all of them on the single file in §6 — and those 12 seeds add **3 marked
activities and 0 correct ones**. On that file alone precision goes 100% → 90.9%. The ceiling
row proves the point independently: handing the walk P6's own seeds changes not one activity,
because there are none to hand it.

**Seeding on every remaining activity with no successor in the file is a different rule and it
fails.** It buys **+15 activities of recall (98.6% → 99.1%)** for **+18,006 marked
activities**, taking precision from 99.9% to **16.0%**. Under
[014](../014-compute-critical-path.md) decision 9's deliberately asymmetric gate — recall ≥
95%, precision ≥ 90% — it fails outright, by 74 points, and it would fail on decision 2's
comparability grounds long before that: a "longest path" of 21,408 activities across 48
programmes is a list of everything with a dangling end. Decision 3's oracle argument does not
need re-running; the number kills it first.

## 8. Per-file numbers

48 distinct Fixture A files carrying an oracle, ordered by remaining activities descending.
`flagged` is rows carrying `driving_path_flag = Y`; `sinks` is flagged rows driving no flagged
row — where P6 started; `dropped` is sinks our seed set misses; `lost` is measurement 3.
`recall_all` scores against every flagged row, `recall_rem` against the flagged rows that are
not `TK_Complete`.

| # | P6 | acts | remaining | flagged | complete | flagged rem | seeds | tie mixed | sinks | dropped | lost | marked | recall_all | recall_rem | precision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A01 | 6.0 | 1746 | 1605 | 77 | 1 | 76 | 2 | yes | 1 | 0 | 0 | 76 | 98.7 | 100 | 100 |
| A02 | 6.0 | 1746 | 1604 | 77 | 1 | 76 | 2 | yes | 1 | 0 | 0 | 76 | 98.7 | 100 | 100 |
| A03 | 6.0 | 1751 | 1592 | 75 | 1 | 74 | 2 | yes | 1 | 0 | 0 | 74 | 98.7 | 100 | 100 |
| A04 | 6.0 | 1751 | 1575 | 75 | 1 | 74 | 2 | yes | 1 | 0 | 0 | 74 | 98.7 | 100 | 100 |
| A05 | 6.0 | 1751 | 1568 | 89 | 15 | 74 | 2 | yes | 1 | 0 | 0 | 74 | 83.1 | 100 | 100 |
| A06 | 6.0 | 1751 | 1559 | 75 | 3 | 72 | 2 | yes | 1 | 0 | 0 | 72 | 96.0 | 100 | 100 |
| A07 | 8.3 | 1751 | 1559 | 75 | 3 | 72 | 2 | yes | 1 | 0 | 0 | 72 | 96.0 | 100 | 100 |
| A08 | 8.3 | 1751 | 1559 | 75 | 3 | 72 | 2 | yes | 1 | 0 | 0 | 72 | 96.0 | 100 | 100 |
| A09 | 6.0 | 1751 | 1548 | 70 | 0 | 70 | 2 | yes | 1 | 0 | 0 | 70 | 100 | 100 | 100 |
| A10 | 6.0 | 1751 | 1547 | 82 | 10 | 72 | 2 | yes | 1 | 0 | 0 | 70 | 85.4 | 97.2 | 100 |
| A11 | 6.0 | 1751 | 1514 | 87 | 17 | 70 | 2 | yes | 1 | 0 | 0 | 68 | 75.9 | 94.3 | 97.1 |
| A12 | 6.0 | 1751 | 1490 | 118 | 13 | 105 | 2 | yes | 1 | 0 | 0 | 105 | 89.0 | 100 | 100 |
| A13 | 6.0 | 1751 | 1433 | 118 | 13 | 105 | 2 | yes | 1 | 0 | 0 | 105 | 89.0 | 100 | 100 |
| A14 | 6.0 | 1751 | 1406 | 138 | 60 | 78 | 2 | yes | 1 | 0 | 0 | 78 | 56.5 | 100 | 100 |
| A15 | 6.0 | 1751 | 1406 | 138 | 60 | 78 | 2 | yes | 1 | 0 | 0 | 78 | 56.5 | 100 | 100 |
| A16 | 8.3 | 1751 | 1406 | 138 | 60 | 78 | 2 | yes | 1 | 0 | 0 | 78 | 56.5 | 100 | 100 |
| A17 | 6.0 | 1751 | 1378 | 137 | 60 | 77 | 2 | yes | 1 | 0 | 0 | 77 | 56.2 | 100 | 100 |
| A18 | 6.0 | 1751 | 1378 | 137 | 60 | 77 | 2 | yes | 1 | 0 | 0 | 77 | 56.2 | 100 | 100 |
| A19 | 6.0 | 1751 | 1290 | 138 | 60 | 78 | 2 | yes | 1 | 0 | 0 | 78 | 56.5 | 100 | 100 |
| A20 | 6.0 | 1751 | 1265 | 138 | 60 | 78 | 2 | yes | 1 | 0 | 0 | 78 | 56.5 | 100 | 100 |
| A21 | 6.0 | 1751 | 1229 | 144 | 67 | 77 | 2 | yes | 1 | 0 | 0 | 77 | 53.5 | 100 | 100 |
| A22 | 6.0 | 1751 | 1203 | 144 | 67 | 77 | 2 | yes | 1 | 0 | 0 | 77 | 53.5 | 100 | 100 |
| A23 | 6.0 | 1751 | 1197 | 144 | 67 | 77 | 2 | yes | 1 | 0 | 0 | 77 | 53.5 | 100 | 100 |
| A24 | 6.0 | 1751 | 1197 | 144 | 67 | 77 | 2 | yes | 1 | 0 | 0 | 77 | 53.5 | 100 | 100 |
| A25 | 6.0 | 1751 | 1147 | 86 | 11 | 75 | 2 | yes | 1 | 0 | 0 | 75 | 87.2 | 100 | 100 |
| A26 | 6.0 | 1751 | 1132 | 86 | 11 | 75 | 2 | yes | 1 | 0 | 0 | 75 | 87.2 | 100 | 100 |
| A27 | 6.0 | 1751 | 1118 | 86 | 11 | 75 | 2 | yes | 1 | 0 | 0 | 75 | 87.2 | 100 | 100 |
| A28 | 6.0 | 1751 | 1084 | 143 | 69 | 74 | 2 | yes | 1 | 0 | 0 | 74 | 51.7 | 100 | 100 |
| A29 | 7.0 | 1047 | 1047 | 30 | 0 | 30 | 1 | no | 1 | 0 | 0 | 30 | 100 | 100 | 100 |
| A30 | 6.0 | 1751 | 1047 | 108 | 30 | 78 | 2 | yes | 1 | 0 | 0 | 77 | 71.3 | 98.7 | 100 |
| A31 | 6.0 | 1751 | 1029 | 108 | 31 | 77 | 2 | yes | 1 | 0 | 0 | 76 | 70.4 | 98.7 | 100 |
| A32 | 6.0 | 1751 | 990 | 108 | 31 | 77 | 2 | yes | 1 | 0 | 0 | 76 | 70.4 | 98.7 | 100 |
| A33 | 6.0 | 1751 | 959 | 92 | 19 | 73 | 2 | yes | 1 | 0 | 0 | 73 | 79.3 | 100 | 100 |
| A34 | 6.0 | 1751 | 945 | 92 | 19 | 73 | 2 | yes | 1 | 0 | 0 | 73 | 79.3 | 100 | 100 |
| A35 | 6.0 | 1751 | 923 | 92 | 19 | 73 | 2 | yes | 1 | 0 | 0 | 73 | 79.3 | 100 | 100 |
| A36 | 6.0 | 1751 | 895 | 92 | 19 | 73 | 2 | yes | 1 | 0 | 0 | 73 | 79.3 | 100 | 100 |
| A37 | 6.0 | 1751 | 854 | 92 | 20 | 72 | 2 | yes | 1 | 0 | 0 | 72 | 78.3 | 100 | 100 |
| A38 | 6.0 | 853 | 853 | 28 | 0 | 28 | **9** | yes | 1 | 0 | 0 | 28 | 100 | 100 | 100 |
| A39 | 6.0 | 1751 | 819 | 92 | 20 | 72 | 2 | yes | 1 | 0 | 0 | 72 | 78.3 | 100 | 100 |
| A40 | 6.0 | 1751 | 792 | 92 | 20 | 72 | 2 | yes | 1 | 0 | 0 | 72 | 78.3 | 100 | 100 |
| A41 | 6.0 | 1751 | 761 | 92 | 20 | 72 | 2 | yes | 1 | 0 | 0 | 72 | 78.3 | 100 | 100 |
| A42 | 6.0 | 1751 | 723 | 92 | 24 | 68 | 2 | yes | 1 | 0 | 0 | 68 | 73.9 | 100 | 100 |
| A43 | 6.0 | 1751 | 693 | 156 | 91 | 65 | 2 | yes | 1 | 0 | 0 | 64 | 41.0 | 98.5 | 100 |
| A44 | 6.0 | 1751 | 650 | 156 | 94 | 62 | 2 | yes | 1 | 0 | 0 | 61 | 39.1 | 98.4 | 100 |
| A45 | 6.0 | 1751 | 603 | 156 | 98 | 58 | 2 | yes | 1 | 0 | 0 | 57 | 36.5 | 98.3 | 100 |
| A46 | 6.0 | 1751 | 552 | 156 | 100 | 56 | 2 | yes | 1 | 0 | 0 | 54 | 34.6 | 96.4 | 100 |
| A47 | 6.0 | 1751 | 513 | 156 | 103 | 53 | 2 | yes | 1 | 0 | 0 | 51 | 32.7 | 96.2 | 100 |
| A48 | 6.0 | 1751 | 471 | 156 | 104 | 52 | 2 | yes | 1 | 0 | 0 | 21 | **13.5** | **40.4** | 100 |

The `dropped` and `lost` columns are zero on every row, which is the answer to the ticket.
A38 is the nine-way tie: one `TT_FinMile` and eight `TT_Task` rows at one instant, all nine
flagged, 100% / 100%.

---

## Three things found on the way, none of which is this ticket's decision

### The oracle is not confined to remaining work — a third of it is complete

**1,733 of the 5,180 flagged rows on the 48 oracle files (33.5%) carry
`status_code = TK_Complete`.** Only 3 of 48 files flag no completed activity at all.

014 decision 3 spans *remaining work as of the data date*, so those rows are outside the
answer by construction — and decision 2 accepted that the tracer may publish a different
answer from the flag. But nothing had noticed that the flag's own set is a **different span**,
and it moves the headline number enormously:

| oracle | seeds | marked | correct | recall | precision | files clearing decision 9's gate |
|---|---|---|---|---|---|---|
| every flagged row | 102 | 3,402 | 3,400 | **65.6%** | 99.9% | **10 / 48** |
| flagged rows that are not complete | 102 | 3,402 | 3,400 | **98.6%** | 99.9% | **46 / 48** |

Run as a diagnostic with the span removed entirely — complete predecessors followed rather
than filtered out — the same walk from the same seeds recovers **99.5% of every flagged row at
98.2% precision**. So the missing 33.9 points are the span and nothing else: P6's Longest Path
runs back through completed work, our walk stops at the data date, and both are behaving as
specified.

This matters because 014 decision 9 reads *"recall ≥ 95% of P6's flagged set"* and does not
say which set. Taken literally the tracer scores 65.6% and the gate fails; taken consistently
with the span decision 3 fixed, it scores 98.6% and passes with room. **The gate has never
been run, and it is ambiguous in exactly the place that decides its verdict.**

### `driving_path_flag` can be stale, and the set contains a run of it

Five consecutive revisions of one programme carry a **byte-identical** flagged set of 156
rows while the data date advances five months and 180 more activities complete. The completed
share of the flag climbs 91 → 103 across them without a single member changing. That is a
Longest Path computed once and exported five more times without being recomputed.

The sixth file in that run (A48) is the set's only real failure at **40.4% recall against the
remaining-flagged oracle**. Its cause is the same one: the flagged chain runs back through
three completed activities sitting *inside* the remaining network, and everything behind them
— 28 of the 31 misses — is unreachable once the walk stops at a completed predecessor.

So 014 decision 2's *"the flag is the only ground truth this project will ever have"* is true
and needs a caveat it has never carried: **the flag records the schedule run that wrote it,
not the schedule the file describes**, and nothing in the file dates it.

### The generator writes a finish milestone where P6 does not

`lib/tables.mjs:31` is `inst(t, h) = t.dur === 0 ? start(h) : finish(h)`, and
`makeReadableDrivers`'s `finishInstant` mirrors it: a zero-duration row's finish is emitted as
a **start** instant. §4a finds P6 doing the opposite on **98.3% of 1,879 live `TT_FinMile`
rows** (Fixture B: 100% of 541).

> **Corrected 2026-08-08** by
> [044's milestone-instant figures are measured over a selector that is not a milestone test](../057-correct-milestone-instant-figures.md).
> This paragraph read *"§4 measures 28,695 real milestone rows and finds P6 doing the opposite
> in 96.4% of them."* See §4's correction note: the 28,695 are rows with
> `early_start_date == early_end_date` and about 26,000 of them are completed tasks. The
> generator defect named here is **unchanged** — a zero-duration row's finish is emitted as a
> start instant, P6 writes a `TT_FinMile`'s at the finish, and that is what
> [049](../049-generator-milestone-instant.md) repaired.

This is the sole cause of the corpus's seed divergence. It is a real defect of the family
[022](../022-generator-longest-path-and-landmines.md),
[028](../028-driving-test-relationship-types.md),
[032](../032-generator-free-float-by-type.md) and
[039](../039-float-path-semantics.md) kept finding — a value written by a rule nobody had
checked against a real file — and correcting it would move `.xer` bytes, change what 042's
fifth `why` cause explains, and change `cal-flat-no-0x7f`'s and `multiproj-two-proj-id`'s
goldens. That is not this ticket's decision to take, and it is filed rather than swept in.

---

## What this does not measure

- **One contract, two real programmes.** 014 decision 9's *"one fixture, one contractor, one
  calendar lineage"* caveat applies here unchanged. Fixture A's 67 distinct files are several
  programmes but one job; Fixture B is four variants of another.
- **The oracle is P6's, and it is sometimes stale.** Every recall figure above is agreement
  with a mark whose provenance the file does not state.
- **Non-FS logic is invisible here.** Over the 67 distinct Fixture A files: 174,458 `PR_FS`
  against 641 `PR_SS`, 420 `PR_FF` and 5 `PR_SF` — **0.6% non-FS** — and **845 lagged
  relationships in 175,524 (0.5%)**. Fixture B's four files are 21,135 / 2,297 / 145 / 4,
  **10.4% non-FS**. Both are consistent with the per-revision figures
  [036](../036-recheck-lag-exposure-figures.md) fixed (0.4% and 10.5%), measured over the
  whole set rather than one revision each. The seed question turns on neither, and no figure
  in this asset is evidence about
  [028](../028-driving-test-relationship-types.md)'s residue.
- **The walk is the corpus's readable walk, not the product tracer**, which is not written.
  What is proved is that this transcription reproduces the corpus goldens on 24 of 24 files
  with a readable walk.
