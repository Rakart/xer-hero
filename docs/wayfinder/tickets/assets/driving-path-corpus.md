# The driving-path corpus: what it asserts and what it proves

Resolution asset for
[Fix the generator's Longest Path flag and add tracer landmines](../022-generator-longest-path-and-landmines.md).

Generator: [`tools/fixture-gen`](../../../../tools/fixture-gen/README.md).
Fixtures: [`fixtures/synthetic`](../../../../fixtures/synthetic/README.md).
Figures taken 2026-08-08, Node 24.18, WSL2, after
`node tools/fixture-gen/generate.mjs`.

> **Amended 2026-08-08** by
> [Bring the corpus's readable walk onto the per-type driving test](../031-readable-walk-per-type.md).
> The corpus is **24 files** (028 added `logic-nonfs-drivers`) and
> `as_read_from_the_file` now implements 014 decision 4 **as amended by 028** — the
> demand each relationship *type* makes, against the successor timestamp it
> constrains, plus the same-kind zero-lag floor. The per-file table, the corpus
> totals and the divergence causes below are re-measured against that walk;
> **96.1% / 96.1% over 23 files becomes 96.3% / 98.1% over 24**. The acceptance
> proof further down is left as it was run, against 23 files and the old walk, and
> is marked where it is historical. No `.xer` byte moved.
>
> **Amended again 2026-08-08** by
> [The generator computes free float with the FS formula for every relationship type](../032-generator-free-float-by-type.md).
> Every driving-path figure in this asset stands untouched for the second time —
> 163 / 160 / 157, **96.3% recall at 98.1% precision, 19 of 24 exact**, nine `why`
> entries on five files — because free float feeds neither walk. What moved is
> `free_float_hr_cnt` on **8 rows across 4 files**, which is the first `.xer` byte
> change since this ticket, and one number in `logic-no-longest-path`'s `landmine`
> string. See "What did not change" at the end.
>
> **Corrected 2026-08-08** by
> [Recheck the lag and non-FS exposure figures against their source](../036-recheck-lag-exposure-figures.md).
> One cell pair, in the relationship-type exposure table at the end of "Where a correct
> tracer still disagrees with the oracle": the *lagged relationships* column was transposed
> between the fixtures. No measurement in this asset is derived from it.

## The defect, and why it was invisible

`lib/tables.mjs:322` wrote

```js
driving_path_flag: o.longestPathFlag && !task.floatNull && task.tf <= 0 ? 'Y' : '',
```

Longest Path from total float — the conflation
[the format research](xer-format.md) warns about and
[014](../014-compute-critical-path.md) decision 4 rejects.

The interesting part is **why nobody noticed by inspection**: inside this generator the
two rules very nearly coincide. The backward pass runs with `projectFinish = deadline`,
and `deadlineSlipDays` defaults to 0, so `deadline == computedFinish`. Under that
condition an activity has `tf == 0` exactly when it lies on *some* chain achieving the
project finish — which is exactly the set a backward walk from the latest finish
recovers. On 21 of the 24 corpus files the float rule and the walk still return the same
members today (19 of 23 when this was first measured; `logic-nonfs-drivers` is a file
the float rule also happens to get right, since its deadline is the computed finish).
The old flag was not obviously wrong; it was accidentally right on files
that could not tell the difference, which is the worst possible state for a corpus whose
job is to fail.

Making the corpus discriminate therefore had to be **deliberate**. The lever is a
deadline pulled in behind the computed finish: float then marks everything within the
slip of critical, while the walk still marks one chain. That is Fixture A's shape — 69%
negative float, 138 of 1,751 flagged — and `logic-no-longest-path` reproduces it.

## What the goldens now carry

Every `.expected.json` gained a `driving_path` block holding **two** walks over the same
programme:

| | Rule | Role |
|---|---|---|
| `members` | The generator's own driving relation over its own logic network, in working hours | The truth. `driving_path_flag` is written from this and nothing else, so the corpus reproduces the oracle relationship 014 decision 2 depends on |
| `as_read_from_the_file` | 014 decision 4 **as amended by 028** applied to the emitted bytes: the demand the relationship *type* makes (`FS` finish, `SS`/`SF` start, `+ lag`) scored against the successor timestamp it constrains (`FS`/`SS` start, `FF`/`SF` finish), argmax with ties kept, plus the same-kind zero-lag floor; lag as elapsed hours, absent relationships absent, unresolvable predecessors truncating | What a correct product tracer can actually reach |
| `float_based_tracer` | `total_float_hr_cnt <= 0` | What the defect marked. Recorded so the corpus states the difference rather than merely avoiding it |

Plus `seeds`, `branch_count` / `branches`, `truncated`, `external_predecessors`,
`cycle_count` / `cycles`, `path_continuous`, `open_chain_tails`, and
`as_read_from_the_file.why` — a per-activity list of every disagreement with its cause.

Both walks are computed **from the model**, never by parsing the emitted `.xer`. That is
012's rule and it is what makes the golden an assertion rather than a transcript.

## Per-file numbers

`acts` is the emitted activity count; `driving` is `members`; `flagged` is rows carrying
`driving_path_flag = 'Y'`; `tf<=0` is what the float rule marks; `read` is
`as_read_from_the_file.member_count`.

| Fixture | state | acts | driving | flagged | tf<=0 | float FP | read | recall | prec |
|---|---|---|---|---|---|---|---|---|---|
| `cal-clndr-data` | ok | 20 | 8 | 8 | 8 | 0 | 8 | 100 | 100 |
| `enc-cp1252-currency` | ok | 20 | 5 | 5 | 5 | 0 | 5 | 100 | 100 |
| `enc-mojibake-0x81` | ok | 20 | 5 | 5 | 5 | 0 | 5 | 100 | 100 |
| `external-relationship` | ok | 20 | 5 | 5 | 5 | 0 | 5 | 100 | 100 |
| `float-negative` | ok | 20 | 4 | 4 | 5 | 1 | 4 | 100 | 100 |
| `logic-complete-no-remaining` | **skip** | 20 | 0 | 0 | 0 | 0 | 0 | – | – |
| `logic-cycle` | **error** | 20 | 8 | 8 | 9 | 1 | 8 | 100 | 100 |
| `logic-driving-branch` | ok | 20 | 13 | 13 | 13 | 0 | 13 | 100 | 100 |
| `logic-external-driver` | ok | 19 | 6 | 6 | 6 | 0 | 6 | 100 | 100 |
| `logic-float-path` | ok | 20 | 7 | 7 | 7 | 0 | 7 | 100 | 100 |
| `logic-lag-nonworking` | ok | 20 | 8 | 8 | 8 | 0 | 9 | 100 | 88.9 |
| `logic-no-longest-path` | ok | 40 | 4 | **0** | 19 | **15** | 4 | 100 | 100 |
| **`logic-nonfs-drivers`** | ok | 20 | 9 | 9 | 9 | 0 | 9 | 100 | 100 |
| `missing-calendar` | ok | 20 | 7 | 7 | 7 | 0 | 7 | 100 | 100 |
| `missing-taskpred` | ok | 20 | 6 | 6 | 6 | 0 | 1 | **16.7** | 100 |
| `multiproj-baseline-rows` | ok | 20 | 5 | 5 | 5 | 0 | 6 | 80 | 66.7 |
| `multiproj-two-proj-id` | ok | 20 | 10 | 10 | 10 | 0 | 10 | 100 | 100 |
| `progress-full` | **skip** | 20 | 0 | 0 | 0 | 0 | 0 | – | – |
| `progress-none` | ok | 20 | 6 | 6 | 6 | 0 | 6 | 100 | 100 |
| `text-multiline` | ok | 20 | 8 | 8 | 8 | 0 | 8 | 100 | 100 |
| `unknown-table-and-enum` | ok | 20 | 6 | 6 | 6 | 0 | 6 | 100 | 100 |
| `ver-60-fieldset` | ok | 20 | 7 | 7 | 7 | 0 | 7 | 100 | 100 |
| `ver-83-fieldset` | ok | 20 | 7 | 7 | 7 | 0 | 7 | 100 | 100 |
| `wbs-flat` | ok | 20 | 19 | 19 | 19 | 0 | 19 | 100 | 100 |

Corpus totals over 24 files: **163 driving activities**, of which a read of the bytes
recovers **157 — 96.3% recall at 98.1% precision** (160 marked). Nineteen of the
twenty-four files reproduce all six scored fields exactly.

Under the pre-031 walk — decision 4 as originally written, `EF + lag` for every type —
the same 24 files scored **155 of 163, 95.1% recall at 96.3% precision, 17/24 exact**.
The three rows that moved are `external-relationship` (8 marked → 5, precision 62.5 →
100), `logic-nonfs-drivers` (7 marked → 9, recall 77.8 → 100) and `text-multiline`,
whose numbers are unchanged and whose *cause* was relabelled. **Twenty-one of the
twenty-four goldens do not move an activity**, which is the arithmetic claim that the
rule is a generalisation rather than a replacement, measured rather than asserted.

`perf-20k` (generated, not committed) carries 20,000 activities, 7,171 of them
remaining: **10 driving, 27 with `tf <= 0`**. Under the old rule the flag was on all 27.

## The acceptance proof

*Historical: run against the 23-file corpus and the pre-031 walk. The float tracer's
failures below are structural and none of them turns on relationship type, so the
verdict is unaffected by the amended rule; 031 adds a second reverting tracer the
corpus now catches, recorded at the end of this section.*

Two throwaway tracers were written against the committed bytes — a correct one
implementing 014 decisions 3/4/5, and a naive one returning `total_float_hr_cnt <= 0` —
and scored against `as_read_from_the_file` on membership, `state`, `branches`,
`truncated`, `cycle_count` and `path_continuous`.

```
correct tracer (014): 23/23 files pass
float tracer (tf<=0): 12/23 files pass
float tracer marks 23 activities in error and misses 6 across the corpus
```

Where the float tracer fails, and on what:

| Fixture | How the float rule fails |
|---|---|
| `logic-no-longest-path` | 15 activities marked in error — negative float is not the Longest Path |
| `missing-taskpred` | 5 marked in error, `path_continuous` wrong |
| `external-relationship` | misses 3, reports no branch |
| `multiproj-baseline-rows` | misses 2, marks 1 in error |
| `logic-cycle` | `state` `ok` where it must be `error`; no `cycle_count`; 1 marked in error |
| `logic-driving-branch` | no branches at all — it has no notion of a driving predecessor |
| `logic-external-driver` | `truncated` false — it never walks, so it never leaves the file |
| `logic-complete-no-remaining`, `progress-full` | `state` `ok` where it must be `skip` |
| `float-negative` | 1 marked in error |
| `logic-lag-nonworking` | misses 1 |

The remaining 12 files are ones where the two rules genuinely coincide — the structural
property described at the top. **A corpus of only those 12 would ship a broken tracer.**

### The second reverting tracer, added 2026-08-08 by 031

The float tracer is not the only rule the corpus has to be able to fail. A tracer that
implements decision 4 **as originally written** — `EF + lag` for every relationship
type — is the other one, and until 031 the goldens could not catch it, because
`as_read_from_the_file` *was* that rule. A third throwaway tracer was written in the
same class as the two above — it tokenizes a committed `.xer`, walks back from the
latest remaining finish over `TASK` and `TASKPRED` alone, and reads the model not at
all — and run under both rules against the goldens as they now stand:

```
per-type + floor (014 as amended by 028): 24/24 files pass
FS-only          (EF + lag, every type):  22/24 files pass
FS-only marks 3 activities in error and misses 2 across the corpus
```

The first row is the more important of the two, and it is the check this ticket owed:
the golden is written from the generator's own model, so **24/24 from an independent
read of the bytes is what says the amended rule is actually reachable from the file**
rather than merely recorded beside it.

It fails on `external-relationship` (marks `A001000`, `A001010`, `A001030` in error and
invents a branch at `A001050`) and on `logic-nonfs-drivers` (misses `A001110` and
`A001130`, loses the `A001140` branch, invents two at `A001030` and `A001060`). Both
files were in the corpus before; what changed is that the assertion now disagrees with
the wrong rule. 028's claim that `logic-nonfs-drivers` *"fails any tracer that reverts
to `EF + lag` — in CI, forever"* is true of `members` and became true of the scored
golden here.

## Where a correct tracer still disagrees with the oracle, and why

Nine activities across the corpus pick a different driving predecessor in the two walks,
which moves **three activities into the set and six out of it** (163 truth, 160 read,
157 in common). Every one is named in the golden's `as_read_from_the_file.why` with its
cause, and none is engineered away.

| Cause | Where | Activities |
|---|---|---|
| The relationship is not in the file | `missing-taskpred` | 5 |
| The driving predecessor is outside the file | `logic-external-driver` | 1 |
| Lag treated as elapsed hours across non-working time | `logic-lag-nonworking`, `multiproj-baseline-rows` | 2 |
| Mixed anchor kinds on one successor — a finish instant scored against a start instant, at zero lag | `text-multiline` | 1 |

Two files differ in *structure* rather than membership, and both are worth knowing
about: on `logic-external-driver` the truth knows the chain reaches the data date
through an activity in another project, so `path_continuous` is `true` while a reader of
the file can only say `false`; and on `text-multiline` a branch present in the truth is
invisible to any rule reading only timestamps. `as_read_from_the_file.differs` is set on
all five files that differ at all.

The first cause is unavoidable and correct — a file with no `TASKPRED` cannot support a
chain, and 16.7% recall there is the *right* answer rather than a failure. The second is
correct too, and is what `truncated` exists to say.

The third is the limitation 014 decision 4 named and accepted.

**The fourth is the same limitation without a lag to carry it, and it is what replaced
this asset's original third cause.** As first written this table attributed
`external-relationship` (2) and `text-multiline` (1) to *non-FS relationship: `EF + lag`
is not the quantity that set the successor's date*. 028 measured that and found it right
about `external-relationship` and **wrong about `text-multiline`**: there the FS demand
is a *finish* instant read against a *start* instant with a weekend between them, so two
candidates that tie in working hours sit 64 elapsed hours apart. Comparing per type does
not recover the branch, and no rule reading only the file's timestamps can. The
attribution now names the anchor kinds rather than the relationship type, and
`external-relationship`'s two disappear because the amended rule gets them right — one
by the type comparison, one by the floor.

The relationship-type exposure that opened
[028](../028-driving-test-relationship-types.md) is unchanged and is recorded here
because it is what made the fix worth doing. Counting non-FS relationships in the two
real programmes recorded elsewhere in this repo — `PR_FS` 2,813 / `PR_SS` 9 / `PR_FF` 3
in [the format research](xer-format.md), and `PR_FS` 5,267 / `PR_SS` 576 / `PR_FF` 39 /
`PR_SF` 1 in [the derived contract](derived-json-contract.md) —

| | non-FS relationships | lagged relationships (014 decision 4) |
|---|---|---|
| Fixture A | **0.4%** | 0.3% |
| Fixture B | **10.5%** | 8.8% |

so both approximations land on Fixture B. 014's ship gate measures recall and
precision on **Fixture A only**, where non-FS logic is 0.4% of relationships and would
therefore have passed whether or not the tracer handled it. That is what 028 settled and
031 implemented; the corpus is now **9.3% non-FS**, within a point of Fixture B.

> **Corrected 2026-08-08** by
> [Recheck the lag and non-FS exposure figures against their source](../036-recheck-lag-exposure-figures.md).
> The right-hand column of this table read `8.8%` against Fixture A and `0.3%` against
> Fixture B, and the sentence below it read *"so the two approximations land on opposite
> fixtures"*. The lag row was read from the wrong column of the DCMA table in
> [the derived contract](derived-json-contract.md), which is headed
> `| # | Check | Fixture B tender | Fixture A update |` — Fixture B first — and whose row 3
> is `| 3 | Lags | **8.8%** ❌ | 0.3% ✅ |`. The non-FS column above was read correctly, as
> the `PR_FS` counts quoted immediately before the table independently confirm
> (2,813 / 2,825 = 0.4% non-FS on A; 5,267 / 5,883 = 10.5% on B). Nothing else in this
> asset moves: no `.xer` byte, no golden, no recall or precision figure.

## The corpus additions

Seven files, all `logic-*`, added under the existing catalogue conventions (name, one
`landmine` string saying what breaks without it, a golden, `speculative: true` where the
shape is invented):

| File | For |
|---|---|
| `logic-driving-branch` | Three activities with two driving predecessors each. A path is a set, not a chain |
| `logic-cycle` | A back edge planted on the driving chain. `state: "error"`, `cycle_count: 1`, ingest still succeeds |
| `logic-external-driver` | The chain's tail is an activity in another project, absent from `TASK`. `truncated: true` |
| `logic-complete-no-remaining` | 100% complete, so the walk has nothing to span. `state: "skip"` |
| `logic-lag-nonworking` | Multi-day FS lags on a five-day calendar — 014's accepted approximation, with the divergent activity named |
| `logic-no-longest-path` | `longestPathFlag: false`, progressed, behind deadline. No oracle in the file; 19 float-negative, 4 driving |
| `logic-float-path` | `float_path` / `float_path_order` populated. Speculative |

Two pre-existing fixtures moved from `mutate(tables)` onto model options, because a hook
that rewrites logic after the model has run makes the golden assert a chain the file
cannot show:

- `missing-taskpred` → `hideRelationships: true` (scheduled with logic, exported without
  `TASKPRED`, which is what a real activity-list export is)
- `external-relationship` → `externalRels: 3`

Their emitted bytes are unchanged; what changed is that the generator now knows.

## `float_path` / `float_path_order`

014 decision 11 makes P6's Multiple Float Paths a second oracle — the only one that
validates *order* — and noted that no fixture carried it. `logic-float-path` now does:
path 1 is the driving chain taken as one sequence, `float_path_order` counting up from
the earliest activity, everything else empty. `SCHEDOPTIONS.enable_multiple_longest_path_calc`
is `Y` on that file, as it is wherever `longestPathFlag` is set.

It is marked **`speculative: true`**, in the same class as the invented `clndr_data`
shapes. Oracle documents the two field names and nothing about their contents; the
convention emitted here is a guess, and what the fixture asserts is that a parser reads
the two columns by name and reports what it saw. `measure.mjs --verify` checks the path-1
membership against the golden, so the convention cannot drift silently — but confirming
it is P6's convention needs a file out of P6, which is
[021](../021-verify-fixtures-in-p6.md)'s job.

## What did not change

- `derived.json` at 20,000 activities is **15,854 bytes**, byte-identical to the figure
  in [the 012 measurements](synthetic-fixtures.md). The flag is one column of mostly
  empty strings.
- `perf-20k` is 30,657,187 bytes against 30,657,204 before — 17 bytes smaller, because
  there are 17 fewer `Y`s. Every perf, gzip and parse figure 012 recorded stands.
- Generation time: 336 ms for `perf-20k`, under 40 ms for the whole committed corpus.
  The walk is O(V+E) and iterative rather than recursive, because a driving chain
  through 20,000 activities is deep enough to blow a recursive walk's stack.
- `measure.mjs` still models `derived.json` **v1**, so it reports
  `logic.longest_path: unavailable` where the flag is sparse. It is a sizing harness, not
  the product parser, and 014's v2 shape is product work.
- **031 moved no bytes at all.** It changes only the second walk, which is a golden
  block; `driving_path_flag` and `float_path` are written from `members`, which the
  amended rule does not touch. All 24 committed `.xer` files are byte-identical after
  the change, `perf-20k` re-generates at 30,657,187 bytes and its `derived.json` at
  15,854, and the three figures above stand a second time.
- **032 moved bytes, and only in one column.** Correcting free float to the
  relationship's own frame changes `free_float_hr_cnt` on **8 of the corpus's 429
  float-carrying rows** — `enc-mojibake-0x81` (1), `external-relationship` (1),
  `multiproj-baseline-rows` (1) and `logic-nonfs-drivers` (5) — so **20 of the 24
  committed `.xer` files are byte-identical** and those four grow by 1 to 7 bytes each.
  `sparse-150` moves one row and one byte. **`perf-20k` is 30,657,200 bytes**, 13 more
  than above on 44 of its 7,171 float-carrying rows, and its `derived.json` is still
  **15,854 bytes byte-for-byte** — the fourth ticket to leave that number alone, because
  free float is not one of the stats 006 carries. Every driving-path number in this
  asset is unchanged, and `logic-no-longest-path`'s golden moved only in the `landmine`
  string, whose "25 and 7" is corrected to the **19 and 4** this asset has always said.

> **Stale as of 2026-08-08 — figures superseded twice.** This asset's aggregate
> (**163 / 160 / 157, 96.3% recall at 98.1% precision, 19 of 24 exact**) was current at
> [031](../031-readable-walk-per-type.md) and was not amended by
> [042](../042-seed-divergence-unnamed.md), which added the fifth `why` cause and a `seed_agreement`
> block, or by [049](../049-generator-milestone-instant.md), which corrected the generator's
> zero-duration instant and moved 370 date values across 23 files. The current aggregate, recomputed
> from the committed goldens, is **181 truth / 178 read / 175 common — 96.7% recall at 98.3%
> precision, 21 of 26 exact on all six fields, 9 `why` entries across 5 files**, with **0 seed
> disagreements**. The method described here is unchanged and still the method; only the counts moved.
