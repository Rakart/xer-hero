# The driving test, per relationship type: what it costs and what it buys

Resolution asset for
[Does the driving test need to distinguish relationship types?](../028-driving-test-relationship-types.md).

Everything here is measured against the committed corpus, whose goldens carry the
generator's own driving relation (`members`) as ground truth. Figures taken
2026-08-08, Node 24.18, WSL2, after `node tools/fixture-gen/generate.mjs`.

> **Amended 2026-08-08** by
> [Bring the corpus's readable walk onto the per-type driving test](../031-readable-walk-per-type.md),
> which implemented the rule this asset measured. Every number below is **reproduced
> exactly by the implementation** — 95.1%/96.3% → 96.3%/97.5% → 96.3%/98.1%, exact
> files 17 → 18 → 19 of 24, the same three rows moving on the same three files — so
> the throwaway tracer measured here and the generator's own second walk agree
> line for line. Two things this asset says are now out of date and are corrected in
> place: the goldens no longer record the FS-only reading, so an FS-only tracer scores
> **22/24 against them rather than 24/24**; and `divergenceCauses` no longer
> mis-attributes, so the paragraph about the golden's `why` describes a bug that has
> been fixed. Nothing else moves, and no `.xer` byte moved.
>
> **Amended again 2026-08-08** by
> [The generator computes free float with the FS formula for every relationship type](../032-generator-free-float-by-type.md),
> which fixed the defect this asset's last section reports and re-ran that section's
> three measurements — see the amendment there. The driving-path figures in this asset
> are **untouched**: 96.3% / 98.1%, 19 of 24 exact, the same three moved files. Free
> float feeds neither walk, so the only bytes that moved are `free_float_hr_cnt` on
> four corpus files.

Method: a throwaway tracer reads a committed `.xer` with `measure.mjs`'s tokenizer,
walks back from the latest remaining finish exactly as
[014](../014-compute-critical-path.md) decisions 3/4/5 describe, and is scored against
the golden on **membership, `state`, `branches`, `truncated`, `cycle_count` and
`path_continuous`** — the same six fields
[022](../022-generator-longest-path-and-landmines.md) scored its two tracers on. The
only thing that varies between runs is the definition of *driving*.

## The two rules

**Decision 4 as written (FS-only).** Driving predecessors are those maximising
`EF + lag`, ties all kept. The successor's own timestamp never enters, because for an
all-FS successor it is a constant that cancels.

**Per-type.** The quantity compared is the one the relationship type constrains,
measured against the successor timestamp it constrains:

| `pred_type` | demand | measured against |
|---|---|---|
| `PR_FS` | `pred.early_end_date + lag` | `succ.early_start_date` |
| `PR_SS` | `pred.early_start_date + lag` | `succ.early_start_date` |
| `PR_FF` | `pred.early_end_date + lag` | `succ.early_end_date` |
| `PR_SF` | `pred.early_start_date + lag` | `succ.early_end_date` |

Score is `demand − reference` in elapsed time; driving is the argmax, ties all kept.
On an all-FS successor the reference is constant and cancels, so **this is decision 4
unchanged** — which is why most of the corpus does not move at all. *(Corrected by
[031](../031-readable-walk-per-type.md): this line originally said "17 of the 24 corpus
files do not move a byte", which conflated the claim with the 17/24 exact-file count
below. Regenerating the corpus under the amended rule moves **three** goldens —
`external-relationship`, `logic-nonfs-drivers` and `text-multiline`, the last only in
the label attached to a disagreement it still has — so **21 of 24 do not move an
activity**, and no `.xer` byte moves on any of them.)*

**The floor** (a separate, optional clause, measured separately below). Drop a
candidate whose demand is strictly earlier than the reference **when the two are the
same kind of instant and the lag is zero** — `PR_SS` (start against start) and
`PR_FF` (finish against finish). If the pool empties the activity is a chain tail,
held by a constraint or the project start rather than by logic, which is what the
generator's own truth does. Excluded: a **milestone** writes its finish as a *start*
instant (`early_start_date == early_end_date`), so an `FF` pair where exactly one row
is a milestone is not like-for-like and the floor declines to judge it.

**The guard, counted after 031 implemented it.** The corpus carries 25 `PR_FF`
relationships and exactly **one** with a milestone on one side — `A001110` (a
milestone) → `A001150` on `external-relationship` — and it is an `FF` *from* a
milestone rather than *into* one, on an activity no walk reaches under either rule.
So the guard is genuinely unexercised: generating the whole corpus with the milestone
clause removed produces the identical aggregate (96.3% / 98.1%, 19/24) and the
identical goldens. It stays because it is right, not because a fixture forced it, and
the honest statement is that **it has never been executed on a driving set**.

## Headline

| Rule | recall | precision | files exact on all six fields |
|---|---|---|---|
| decision 4 (FS-only) | 95.1% (155/163) | 96.3% (161 marked) | 17/24 |
| per-type | **96.3%** (157/163) | **97.5%** (161 marked) | **18/24** |
| per-type + floor | **96.3%** | **98.1%** (160 marked) | **19/24** |

All three rows were re-measured by [031](../031-readable-walk-per-type.md) from inside
the generator — the same three rules, run as the goldens' own second walk rather than as
a throwaway tracer — and came back **identical to the row, including which files move**.
The bottom row is what the committed goldens now assert.

On the 23 files that existed before this ticket — the set 022 measured — the same
tracer reproduces 022's figures exactly, which is the cross-check that it is a
faithful reading of decision 4:

| Rule | recall | precision | files exact |
|---|---|---|---|
| decision 4 (FS-only) | **96.1%** (148/154) | **96.1%** (154 marked) | 17/23 |
| per-type | 96.1% | 97.4% (152 marked) | 17/23 |
| per-type + floor | 96.1% | 98.0% (151 marked) | 18/23 |

The FS-only tracer also matched `as_read_from_the_file` on **24/24** files, including
the new one — 022's "correct tracer 23/23", re-run independently and extended. That
sentence was true only while the goldens recorded the FS-only reading: since
[031](../031-readable-walk-per-type.md) brought the second walk onto the per-type rule,
the same FS-only tracer scores **22/24** and the per-type one scores **24/24**, which is
the independent check that the amended rule is reachable from the emitted bytes and not
merely recorded beside them. It fails on `external-relationship` and
`logic-nonfs-drivers` — the two files this ticket was filed about, now failing the rule
they were filed against, in CI, forever.

## Per file

`driving` is the golden's `members`; `marked` is what the tracer returned; the last
three columns are the all-six-fields verdict.

| Fixture | state | driving | FS-only marked | rec | prec | per-type marked | rec | prec | FS-only | per-type | +floor |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `cal-clndr-data` | ok | 8 | 8 | 100.0 | 100.0 | 8 | 100.0 | 100.0 | pass | pass | pass |
| `enc-cp1252-currency` | ok | 5 | 5 | 100.0 | 100.0 | 5 | 100.0 | 100.0 | pass | pass | pass |
| `enc-mojibake-0x81` | ok | 5 | 5 | 100.0 | 100.0 | 5 | 100.0 | 100.0 | pass | pass | pass |
| `external-relationship` | ok | 5 | 8 | 100.0 | **62.5** | 6 | 100.0 | **83.3** | **fail** | **fail** | **pass** |
| `float-negative` | ok | 4 | 4 | 100.0 | 100.0 | 4 | 100.0 | 100.0 | pass | pass | pass |
| `logic-complete-no-remaining` | **skip** | 0 | 0 | – | – | 0 | – | – | pass | pass | pass |
| `logic-cycle` | **error** | 8 | 8 | 100.0 | 100.0 | 8 | 100.0 | 100.0 | pass | pass | pass |
| `logic-driving-branch` | ok | 13 | 13 | 100.0 | 100.0 | 13 | 100.0 | 100.0 | pass | pass | pass |
| `logic-external-driver` | ok | 6 | 6 | 100.0 | 100.0 | 6 | 100.0 | 100.0 | **fail** | **fail** | **fail** |
| `logic-float-path` | ok | 7 | 7 | 100.0 | 100.0 | 7 | 100.0 | 100.0 | pass | pass | pass |
| `logic-lag-nonworking` | ok | 8 | 9 | 100.0 | 88.9 | 9 | 100.0 | 88.9 | **fail** | **fail** | **fail** |
| `logic-no-longest-path` | ok | 4 | 4 | 100.0 | 100.0 | 4 | 100.0 | 100.0 | pass | pass | pass |
| **`logic-nonfs-drivers`** | ok | 9 | 7 | **77.8** | 100.0 | 9 | **100.0** | **100.0** | **fail** | **pass** | **pass** |
| `missing-calendar` | ok | 7 | 7 | 100.0 | 100.0 | 7 | 100.0 | 100.0 | pass | pass | pass |
| `missing-taskpred` | ok | 6 | 1 | 16.7 | 100.0 | 1 | 16.7 | 100.0 | **fail** | **fail** | **fail** |
| `multiproj-baseline-rows` | ok | 5 | 6 | 80.0 | 66.7 | 6 | 80.0 | 66.7 | **fail** | **fail** | **fail** |
| `multiproj-two-proj-id` | ok | 10 | 10 | 100.0 | 100.0 | 10 | 100.0 | 100.0 | pass | pass | pass |
| `progress-full` | **skip** | 0 | 0 | – | – | 0 | – | – | pass | pass | pass |
| `progress-none` | ok | 6 | 6 | 100.0 | 100.0 | 6 | 100.0 | 100.0 | pass | pass | pass |
| `text-multiline` | ok | 8 | 8 | 100.0 | 100.0 | 8 | 100.0 | 100.0 | **fail** | **fail** | **fail** |
| `unknown-table-and-enum` | ok | 6 | 6 | 100.0 | 100.0 | 6 | 100.0 | 100.0 | pass | pass | pass |
| `ver-60-fieldset` | ok | 7 | 7 | 100.0 | 100.0 | 7 | 100.0 | 100.0 | pass | pass | pass |
| `ver-83-fieldset` | ok | 7 | 7 | 100.0 | 100.0 | 7 | 100.0 | 100.0 | pass | pass | pass |
| `wbs-flat` | ok | 19 | 19 | 100.0 | 100.0 | 19 | 100.0 | 100.0 | pass | pass | pass |

`text-multiline` scores 100/100 on membership and still **fails**, because the field
it fails on is `branches`. That is the whole of the next section.

## The two files 028 was filed about

### `external-relationship` — 62.5% → 83.3% → 100%

Truth: `A001020 A001050 A001090 A001130 A001170`. The FS-only rule marks three extra
activities and invents a branch. Two causes, not one:

- **`A001050`** has four live predecessors — `A001010`(FS), `A001000`(FF),
  `A001020`(FS), `A001030`(SS) — and three of them finish at the same instant
  (`2026-01-09 16:00`), so `EF + lag` returns a **three-way tie**. Only `A001020` is
  driving. Per-type scores them `−160h`, `−672h`, `−64h`, `−168h` against their own
  references and returns `A001020` alone. **Fixed by the type rule.**
- **`A001020`** has one live predecessor, `A001010` via `FF`, demanding
  `2026-01-05 16:00` against the successor's own finish of `2026-01-09 16:00` — four
  working days of slack. The truth says `A001020` has *no* driving predecessor: its
  early start is the project start. A pure argmax with no floor marks the only
  candidate it has, whatever the candidate says. **Fixed by the floor**, and the
  comparison is exact: two finish instants, zero lag, neither row a milestone.

The golden's `why` attributed both to "non-FS relationship". The first attribution was
right, the second was not — the cause heuristic in `divergenceCauses` labelled a
disagreement non-FS whenever any relationship involved was non-FS, and on `A001020` the
type is incidental: the candidate loses to the floor, not to its type.
[031](../031-readable-walk-per-type.md) fixed the heuristic along with the rule, and
both entries have since left the golden entirely, because the amended rule gets both
activities right. `external-relationship` now reproduces all six fields exactly.

### `text-multiline` — the lost branch is not about relationship types at all

This is the finding that inverts the ticket. 022 recorded that `EF + lag` costs a
whole branch here and filed it as the type defect. The per-type rule **does not
recover the branch**:

```
A001040  ES 2026-04-13 08:00   EF 2026-05-08 16:00
   PR_FS lag 0  <- A001020  EF 2026-04-10 16:00 (Fri)   score  -64h
   PR_SS lag 0  <- A001030  ES 2026-04-13 08:00 (Mon)   score    0h
   PR_FS lag 0  <- A001000  EF 2026-01-16 16:00         score -2080h
```

In working hours both `A001020` and `A001030` demand exactly `A001040`'s early start,
so both are driving and the truth records the branch. In the file, the FS demand is a
**finish instant** (Friday 16:00) and the reference is a **start instant** (Monday
08:00): the weekend sits between them, so the two candidates that tie in working time
are 64 elapsed hours apart. The SS candidate wins and the branch is lost.

This is decision 4's *named* lag limitation — elapsed hours where working hours were
meant — arriving on a **zero-lag** relationship, because a finish instant and the
start instant that follows it are the same working moment written two different ways.
It is structural, not a rule choice: FS and SF compare across the kinds (finish
against start, start against finish), SS and FF compare like with like. No definition
that reads only the file's timestamps can close it.

Exposure, counted over the corpus: **32** activities have two or more live
predecessors of mixed anchor kind, **11** of them are on a driving set, and exactly
**one** of the 11 gets a different answer. It costs one branch on one file under both
rules — the per-type change neither helps nor hurts it.

## The repair that was measured and rejected

The gap can be closed without parsing `clndr_data`, by reconstructing the shift
boundary from the file's own dates: map a finish-anchored demand to the earliest
activity **start** instant at or after it (and the reverse for start-anchored demands
against a finish reference), so every comparison becomes like-for-like. On
`text-multiline` it works: the FS demand maps to Monday 08:00, ties with the SS
candidate, and the branch comes back.

Measured across the corpus it is a **net loss**:

| Rule | recall | precision | files exact |
|---|---|---|---|
| per-type + floor | 96.3% | 98.1% | 19/24 |
| instant-lattice + floor | 96.3% | **92.9%** | **16/24** |

It fixes `text-multiline` and breaks `cal-clndr-data`, `logic-float-path`,
`ver-60-fieldset`, `ver-83-fieldset` and `multiproj-baseline-rows`. The reason is the
one 014 decision 4 gives for staying out of calendars in the first place: this is a
working-time model, inferred rather than read, and it is wrong wherever the file's
observed instants do not enumerate the calendar — a seven-day calendar puts a start
instant on Saturday, and a sparse programme has no activity starting on the day the
chain needs. Rejected: it buys one branch and spends five files.

## Does `free_float_hr_cnt == 0` still corroborate?

Three measurements, one conclusion.

1. **As the driving test on its own**: 96.9% recall at **73.5% precision**, exact on
   **3 of 24** files. It marks 215 activities where the truth has 163. Free float is
   not a driving test and never was one.
2. **As a filter over the per-type rule**: it changes **nothing on any of the 24
   files**. All 148 driving relationships in the corpus have a predecessor carrying
   `free_float_hr_cnt = 0` — 139 FS, 4 SS, 3 FF, 2 SF.
3. **And measurement 2 cannot be trusted**, because the generator computes free float
   with the FS formula for *every* relationship type
   (`programme.mjs:405` — `succ.es − t.ef − rel.lag`, clamped at zero) and then clamps
   the negative result to zero. Against a type-correct computation it is wrong on
   **8 of 429** rows carrying float, five of them on the new fixture. So the corpus
   cannot answer the question that matters — whether P6's own free float vetoes a
   correct non-FS driving relationship — and the zeros it does carry are an artefact
   of the clamp rather than evidence.

> **Amended 2026-08-08** by
> [The generator computes free float with the FS formula for every relationship type](../032-generator-free-float-by-type.md),
> which fixed the formula and re-ran all three. **The 8 of 429 is confirmed to the row**
> — same eight rows, same four files — and measurements 1 and 2 come back
> **96.9% recall at 74.5% precision** (212 marked rather than 215, still exact on
> membership for a handful of files and still not a driving test) and **still inert: zero
> vetoes on all 24 files**, over 142 in-file driving relationships of which 8 are non-FS
> (3 SS, 3 FF, 2 SF). Two figures above are re-counted rather than contradicted: *exact
> on 3 of 24* was scored on all six fields and the re-run scores membership alone (5 of
> 24), and the *148 driving relationships, 139 FS / 4 SS / 3 FF / 2 SF* was counted over
> the FS-only read walk 031 has since replaced — the per-type walk marks **143: 135 FS,
> 3 SS, 3 FF, 2 SF**. Measurement 3 no longer stands as written — the value is now
> computed by the right rule — but its *conclusion* is unchanged and now has a mechanism
> rather than a suspicion. The clamp fired on **31 of 429 rows before and 1 after**, and
> the one is `logic-cycle`, whose dates are incoherent on purpose. On any acyclic file
> the type-correct slack of every relationship is ≥ 0 by construction, because the
> forward pass takes the max over exactly these quantities — so `free_float_hr_cnt == 0`
> holds for a driving predecessor **of any type, necessarily**, and the corroboration
> cannot fail here. That is a fact about this generator's CPM and not about P6, which is
> why the scoping below is unchanged.

Free float is defined against successor **starts**. Delaying an FF predecessor pushes
the successor's finish, which pushes its start, so a type-aware free float still lands
on zero for a driving predecessor of any type — but *whether P6 computes it per type*
is exactly the kind of fact that needs a file out of P6
([021](../021-verify-fixtures-in-p6.md)), and a false veto punches a hole in the chain,
which decision 9's gate is asymmetric against.

## What the corpus could not answer, and the file that fixes it

Before this ticket the corpus carried **38 non-FS relationships across 23 files** —
`PR_SS` 25, `PR_FF` 10, `PR_SF` 3 — and **not one `FF` or `SF` among them drove
anything**. Only three `SS` relationships were ever on a driving chain. So the per-type
rule's `FF` and `SF` branches could not be executed by any corpus file, in either
direction, and the question could only have been answered by argument.

`logic-nonfs-drivers` is the file that makes it measurable: 20 activities, 60
relationships in an even four-way type mix, **no lags and no leads** so relationship
type is the only thing that can explain a disagreement. Its driving chain is

```
A001000 --FF--> A001010 --FF--> A001030 --SS--> A001060 --FF--> A001100 --SF--,
A001000 --FS--> A001110 --FS--> A001130 --SF--> A001140 <-------------------- '
A001140 --FS--> A001180
```

— nine activities, driven by 3 FS, 1 SS, 3 FF and 2 SF relationships, with a genuine
branch at `A001140` where **two SF predecessors tie**. The FS-only rule fails it in
three distinct ways at once: it **misses two activities** (`A001110`, `A001130`),
**loses the SF branch**, and **invents two branches** that are not in the truth
(`A001030`, `A001060`). Per-type reproduces all six fields exactly.

The corpus's non-FS density is now **85 of 915 relationships, 9.3%** — within a
percentage point of Fixture B's 10.5%, which is the real programme the ship gate
cannot measure.

### A driving predecessor can start after the activity it drives

Worth stating on its own, because nothing else in the effort has hit it. On
`logic-nonfs-drivers`, `A001140` (ES hour 160, EF 320) is driven by `A001100`
(ES 320, EF 360) and `A001130` (ES 320, EF 328) — both `SF`, both **starting and
finishing after their successor**. An SF relationship says the successor may not
finish before the predecessor starts, so the driving set is genuinely not
time-ordered.

014 decision 3 chose a **set, not a chain**, on the grounds that a chain cannot
represent branching. It turns out to be load-bearing for a second reason nobody had:
sorting the set by date does not reconstruct the path, so decision 10's client-side
"path as a story" render must not assume it does, and `assignFloatPaths` in the
generator — which walks drivers and reverses, assuming monotone order — is only safe
today because `logic-float-path` is an all-FS file.

## What the change costs

A four-branch switch on `pred_type` and one subtraction. Every quantity is a timestamp
or an hour count the parser already reads: `TASKPRED.pred_type`, `TASKPRED.lag_hr_cnt`,
`TASK.early_start_date`, `TASK.early_end_date`. No `clndr_data`, no working-time
arithmetic, no second pass, no schema, no contract change, no backfill —
`derived.json` v2 and `activities.json` v2 carry the same fields either way, and 014
decision 6 already keeps this out of `card`.

## Reproducing

The tracer and the scoring harness are throwaway scripts, in the same class as 022's
two tracers: not committed, described here rather than shipped. The durable checks in
the repo are

```bash
node tools/fixture-gen/generate.mjs      # 24 corpus fixtures + sparse-150
node tools/fixture-gen/measure.mjs --verify
# 24/24 corpus fixtures round-trip
```

and the goldens themselves, whose `driving_path.members` is the ground truth every
number above is scored against.

Since [031](../031-readable-walk-per-type.md) the goldens also carry the **winning
rule** rather than the rule it replaced: `driving_path.as_read_from_the_file` is the
per-type comparison plus the floor, `.why` names the four surviving causes, and the
aggregate is recomputable from the committed goldens alone — sum `members` and
`as_read_from_the_file.members` across `fixtures/synthetic/corpus/*.expected.json` and
the answer is 163 / 160 / 157 in common. No throwaway script is needed to check the
headline any more; only to check a *tracer*.

> **Corrected 2026-08-08** by [049](../049-generator-milestone-instant.md). The floor section states
> *"a milestone writes its finish as a start instant"* as a fact about the **format**. It was a fact
> about **this generator**, wrong since [022](../022-generator-longest-path-and-landmines.md), and it
> is fixed: a zero-duration row now writes its finish at the end of the working hour it occupies,
> like every other row. P6 does the same on **96.4% of 28,695 real milestone rows**
> ([044](../044-tracer-seed-tie-break.md)). The `PR_FF` milestone carve-out this section justifies
> therefore rests on a premise that no longer holds — the clause is unchanged and inert, and whether
> it should survive is [054](../054-ff-milestone-guard.md).

> **Settled 2026-08-08** by [054](../054-ff-milestone-guard.md). The carve-out this section justifies
> is removed. Its *"Excluded"* sentence is replaced by: the floor applies where demand and reference
> are the same **written** kind, which a `TT_Mile` breaks on a `PR_FF` and a `TT_FinMile` breaks on a
> `PR_SS` — neither occurring in 565 real `PR_FF` or 2,938 real `PR_SS` relationships, and both
> forbidden by Oracle Primavera Cloud's own validation. The *"guard, counted after 031"* paragraph's
> honest statement stands for the corpus and is false of the file set: the clause fires **117 times
> across 62 of 67 real exports** and changes no answer on any of them.
