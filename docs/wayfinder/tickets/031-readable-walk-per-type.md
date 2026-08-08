---
id: 031
title: Bring the corpus's readable walk onto the per-type driving test
type: task
status: closed
assignee: carlo
blocked_by: [028]
---

## Question

Nothing to decide — [028](028-driving-test-relationship-types.md) decided it.
`makeReadableDrivers` in `tools/fixture-gen/lib/programme.mjs` still models
[014](014-compute-critical-path.md) decision 4 **as originally written**: `EF + lag` for
every relationship type. 028 amended that rule (compare per type; add the same-kind
zero-lag floor with its milestone guard), and deliberately did not implement it — a
grilling ticket decides, it does not write the tracer.

So every golden's `as_read_from_the_file` block now records a reading the map no longer
endorses, and `logic-nonfs-drivers` — the file 028 added — carries the largest gap in the
corpus (77.8% recall against a truth the amended rule reproduces exactly).

The work:

1. Move `makeReadableDrivers` onto the per-type comparison: FS `pred.EF + lag` vs
   `succ.ES`, SS `pred.ES + lag` vs `succ.ES`, FF `pred.EF + lag` vs `succ.EF`, SF
   `pred.ES + lag` vs `succ.EF`; score = demand − reference; argmax, ties kept.
2. Add the floor: drop a candidate whose demand is strictly earlier than its reference
   where the two are the same kind of instant and the lag is zero, excluding an FF pair in
   which exactly one row is a milestone (`early_start_date == early_end_date`). Empty pool
   means chain tail.
3. Fix `divergenceCauses`: it labels a disagreement "non-FS" whenever any relationship
   involved is non-FS, which mis-attributes both `external-relationship`'s floor case and
   `text-multiline`'s instant-kind case. The mixed-anchor residue needs a cause of its own.
4. Regenerate, re-measure the corpus recall/precision, and update
   `fixtures/synthetic/README.md` and the 022/028 assets with the new aggregate.

Expected: 96.3% recall at 98.1% precision, 19 of 24 files reproduced exactly, and
`measure.mjs --verify` still 24/24. Done when the golden asserts the rule the map actually
holds.

## Resolution

**96.3% recall at 98.1% precision, 19 of 24 files reproduced exactly on all six fields,
`measure.mjs --verify` 24/24, and not one `.xer` byte moved.** Every figure 028
predicted came back to the decimal, including which files move and which do not — the
throwaway tracer 028 measured with and the generator's own second walk agree line for
line. Working, per file, in [the 022 corpus asset](assets/driving-path-corpus.md) and
[the 028 measurement asset](assets/driving-test-relationship-types.md), both updated
in place.

| Rule | recall | precision | files exact |
|---|---|---|---|
| decision 4 as written (`EF + lag`, every type) | 95.1% (155/163) | 96.3% (161 marked) | 17/24 |
| per relationship type | 96.3% (157/163) | 97.5% (161 marked) | 18/24 |
| **per type + the same-kind zero-lag floor** | **96.3%** | **98.1%** (160 marked) | **19/24** |

`logic-nonfs-drivers` goes from 77.8% recall to **100%** and reproduces all six fields;
`external-relationship` goes from 62.5% precision to **100%**; and `text-multiline`
**still loses its branch**, which is the point of it.

### The three files that moved, and the twenty-one that did not

Only three goldens changed in substance. That is the arithmetic claim 028 made —
the rule is a generalisation, not a replacement — measured rather than asserted: on an
all-FS successor the reference cancels and the two rules are the same rule, so
twenty-one of the twenty-four goldens do not move an activity. (028's asset said
"seventeen files do not move a byte", conflating this with its own 17/24 exact count;
the right number for *unmoved goldens* is 21.)

- **`external-relationship`** — 8 marked → 5, an invented branch at `A001050` gone,
  `why` now empty, exact on all six fields. Two causes, exactly as 028 predicted: the
  three-way `EF + lag` tie at `A001050` resolves to `A001020` alone under the type
  comparison, and `A001020`'s lone `FF` candidate — four working days below the
  successor's own finish, zero lag, neither row a milestone — is dropped by the floor,
  leaving the chain tail the truth already reported.
- **`logic-nonfs-drivers`** — 7 marked → 9, `A001110` and `A001130` recovered, the two
  invented branches at `A001030`/`A001060` gone, and the genuine `SF` branch at
  `A001140` back.
- **`text-multiline`** — membership, branches and every other number **unchanged**. Only
  the cause label moved, which is the whole of item 3.

### `divergenceCauses` no longer mis-attributes, and the fourth cause is a residue not a type

The old heuristic labelled a disagreement "non-FS" whenever *any* relationship involved
was non-FS. That was wrong twice over: it named the type on `external-relationship`'s
`A001020`, where the candidate loses to the floor and its type is incidental, and on
`text-multiline`, where 028 established the type is not the cause at all.

Relationship type is now not a cause at all — a rule that compares per type cannot be
defeated by a type it handles. What survives of it is the **anchor kind**, and it gets
its own label:

> mixed anchor kinds on one successor: a finish instant scored against a start instant,
> which is 014 decision 4's elapsed-hours residue on a zero-lag relationship (028)

The test is exact rather than a heuristic: each type makes one of four comparisons
(`finish-vs-start`, `start-vs-start`, `finish-vs-finish`, `start-vs-finish`), and two
candidates on one successor order the same way in elapsed time as in working time
**only when they make the same comparison**. Where the involved pool mixes them, that is
the residue; where it does not, a lag is doing it. So the four causes the corpus now
carries are: the relationship is not in the file (5, `missing-taskpred`), the driving
predecessor is outside the file (1, `logic-external-driver`), lag as elapsed hours (2,
`logic-lag-nonworking` and `multiproj-baseline-rows`), and mixed anchor kinds (1,
`text-multiline`). Nine `why` entries across five files, six activities missed and three
marked in error.

`text-multiline` keeping its lost branch is the load-bearing negative result here. The
repair 028 built and rejected — inferring shift boundaries from the file's own instants
— was **not** implemented, and a version of this ticket that recovered that branch would
have shipped the rejected instant lattice by accident and would show 92.9% precision at
16/24 rather than 98.1% at 19/24.

### The corpus can now fail a reverting tracer, and could not before

The sharpest thing found on the way through. 028 wrote that `logic-nonfs-drivers`
*"fails any tracer that reverts to `EF + lag` — in CI, forever, at no cost"*. That was
true of `members` and **false of the golden anyone actually scores against**: until this
ticket, `as_read_from_the_file` *was* the `EF + lag` rule, so a reverting tracer matched
it on 24/24 files. A third throwaway tracer — tokenizes a committed `.xer`, walks back
from the latest remaining finish over `TASK` and `TASKPRED` alone, reads the model not
at all — was written and run under both rules against the goldens as they now stand:

```
per-type + floor (014 as amended by 028): 24/24 files pass
FS-only          (EF + lag, every type):  22/24 files pass
FS-only marks 3 activities in error and misses 2 across the corpus
```

The first row is the check this ticket owed and the second is the one it bought. The
goldens are written from the generator's model, so **24/24 from an independent read of
the bytes is what says the amended rule is reachable from the file** rather than merely
recorded beside it; and the two files the FS-only rule fails are precisely the two 028
was filed about.

### The milestone guard is implemented, correct, and has never executed

Built as specified: the floor declines an `FF` pair where exactly one row is a milestone,
tested as `early_start_date == early_end_date` — a reader-visible property of the emitted
row, not a model fact. Counted afterwards, the corpus carries 25 `PR_FF` relationships
and exactly **one** with a milestone on one side, `A001110 → A001150` on
`external-relationship` — an `FF` *from* a milestone rather than into one, on an
activity no walk reaches under either rule. Regenerating the whole corpus with the
milestone clause removed produces **byte-identical goldens**, which is 028's
with-and-without measurement reproduced against the implementation. It stays because it
is right, not because a fixture forced it, and the honest statement is that it has never
been executed on a driving set.

### What did not move

`driving_path_flag` and `float_path` are written from `members`, which this ticket does
not touch, so the emitted bytes cannot move and did not: all 24 committed `.xer` files
and `sparse-150.xer` are byte-identical, `perf-20k` re-generates at 30,657,187 bytes and
its `derived.json` at 15,854. 25 `.expected.json` files changed, 22 of them only in the
two strings that *describe* the rule (`driving_path.definition` and
`as_read_from_the_file.note`). `measure.mjs --verify` is **24/24**.

### One thing filed rather than fixed

`logic-no-longest-path`'s `landmine` string in `catalogue.mjs` says *"25 activities have
total float <= 0 and 7 are on the Longest Path"*. The file's own golden says **19 and
4**, and `fixtures/synthetic/README.md` says 19 and 4. It is a stale sentence from before
022 settled that fixture, it is carried into the committed golden, and it is the same
species of defect 022 and 028 kept finding — a fixture describing itself wrongly. One
line, no behaviour, and not one of this ticket's four items, so it is named here rather
than swept in.

> **Amended 2026-08-08** by
> [The generator writes a finish milestone where P6 does not](049-generator-milestone-instant.md).
> This ticket's milestone-guard reasoning is followed exactly for 042's fifth cause — kept, inert,
> rather than deleted or engineered around — and the guard itself has **lost its stated reason**. The
> `PR_FF` exclusion exists *because a milestone writes its finish as a start instant*; it does not
> any more, so the clause declines a floor that is now valid. It remains inert on the same
> measurement this ticket ran — 25 `PR_FF` relationships, one with a milestone on a side, removing
> the clause regenerates byte-identical — and stands unchanged, because the rule belongs to 028.
> Whether it should is [054](054-ff-milestone-guard.md).

> **Resolved 2026-08-08** by
> [028's `FF` milestone guard has lost its reason](054-ff-milestone-guard.md). *"It stays because it
> is right"* does not survive the real files. The guard is **live rather than inert** off the
> corpus — it rescues **117** floored candidates across **62 of 67** real exports — and every one of
> those rescues is an `FF` into a `TT_FinMile`, the pair whose comparison is exact. This ticket's
> `sameKind` expression changes in one place: `milestoneRow` gives way to a written-anchor-kind test
> on `task_type`. The reader-visible discriminator this ticket chose is **vindicated where it is used
> and wrong as a general claim** — over the 81,848 live rows a walk can reach it disagrees with
> `task_type` on **18**, and over all rows on **26,325**. Built by
> [056](056-written-anchor-kind-floor.md).
