---
id: 039
title: Correct logic-float-path to what P6's Multiple Float Paths output actually is
type: task
status: closed
assignee: carlo
blocked_by: [021]
---

## Question

[021](021-verify-fixtures-in-p6.md) found `float_path` populated in real exports — 1,570 of
1,751 activities in one revision, 384 distinct paths, 3,321 rows across the 139-file set —
and found the `logic-float-path` fixture **half wrong**
([evidence](assets/p6-substitute-validation.md) §4).

- **Order semantics were right.** Path 1's members carry `float_path_order` 1..79,
  contiguous, exactly as the fixture assumes.
- **Membership semantics were wrong.** The fixture calls path 1 *"the driving chain as one
  sequence"*. It is not. Path 1 is the **lowest-total-float** chain — its 79 members are 79
  of the 86 activities at the file's minimum total float — and it shares **no members at
  all** with the 75 activities P6 flagged `driving_path_flag = Y`, whose total float runs
  −862 to −502.

**Do:**

1. Rebuild the fixture so path 1 is the **lowest-total-float chain and disjoint from the
   driving set**, which is what a real file looks like. The current fixture builds them as
   the same chain, so a tracer that conflated the two marks would pass it.
2. Rewrite the `landmine` text and drop `speculative: true`.
3. Restate [014](014-compute-critical-path.md) decision 11's use of `float_path` as an
   oracle: **it validates order, and it must not be read as membership of the driving
   path.** The decision already says "validation-time only, never an output, never a
   fallback source" — that survives untouched. What changes is that a second oracle
   agreeing on *membership* would now be evidence of a **bug**, not of correctness.
4. Note in `fixtures/synthetic/README.md` that this file is the corpus's strongest
   statement of 014's central claim — stronger than the `float_based_tracer` block, because
   here the two marks do not merely differ in size, they share nothing.

`file.sha256`/`file.bytes` must be rewritten from the generator and
`node tools/fixture-gen/measure.mjs --verify` must pass.

## Resolution

**Rebuilt, and the two marks now share nothing: path 1 is nine activities at −160 hours of
total float, `driving_path_flag = Y` is a disjoint ten at zero, and the intersection read
back out of the emitted bytes is empty.** The file the corpus shipped would have scored a
conflating tracer 100% on both marks, because path 1 *was* the flagged set, activity for
activity. It now scores it **0% recall at 0% precision** — the strongest failure the corpus
can produce, and the shape 021 found unprompted in a real export.

The correction needed a mechanism, not just a relabelling. Total float is measured against
the nearest **binding** late date; the Longest Path is the logic driving the project
**finish**. Those are the same chain only while the project finish is the only thing
setting late dates, which is exactly the condition the old fixture was built under — no
deadline slip, no honoured constraint, so minimum float and the driving chain were forced
to coincide and no wording could have separated them. The file now carries a **Finish On or
Before constraint 20 working days inside a non-driving chain's own finish**: an interim
contractual deadline in delay, which is the ordinary way a real programme ends up with its
lowest-float chain somewhere other than its driving chain. That is the only reading of
Fixture A's numbers that works — its flagged set runs −862 to −502 while its minimum sits
below −862, so something other than the project finish is setting late dates on the chain
P6 called path 1.

### What the fixture asserts now

40 activities, 40 relationships, all `PR_FS`, no lags, no leads, no progress, one
constraint. Six float paths calculated; 30 activities carry one and **10 carry none**,
because P6's Multiple Float Paths is asked for a *number* of paths and stops there.

| `float_path` | members | total float | |
|---|---|---|---|
| 1 | **9** — `A001010 A001050 A001090 A001130 A001170 A001210 A001250 A001290 A001330` | **−160 h** | the lowest-total-float chain, held by `A001330`'s `CS_MEOB` at 2026-06-12 16:00 |
| 2 | 4 | −72 h | a second negative-float chain, still not the driving one |
| 3 | **10** — `A001030 A001070 A001110 A001150 A001190 A001230 A001270 A001310 A001350 A001390` | **0 h** | **exactly the `driving_path_flag = Y` set** |
| 4 / 5 / 6 | 1 / 1 / 5 | +864 / +984 / +1080 h | |

- **Disjoint, verified off the bytes rather than the model.** Reading `float_path` and
  `driving_path_flag` back out of `logic-float-path.xer` by name gives a path-1 set of 9
  and a flagged set of 10 with an intersection of **0**. The golden states it in as many
  words: `float_paths.shared_with_driving_path: []`.
- **Order survives, and is the only thing that does.** `float_path_order` is contiguous
  1..n within every one of the six paths — 1..9 on path 1 — which is the half of the old
  reading 021 confirmed.
- **Path 1 is a float ranking, not a rank of driving-ness.** The flagged set is **path 3**,
  behind two negative-float chains. A reader who assumes the driving path is "path 1, or
  failing that the first one" is wrong twice over.
- **Path 1 is exactly the minimum-float set.** The file's minimum total float is −160 and
  precisely those nine activities carry it. (The real file was 79 of 86 — ours is 9 of 9,
  because a 40-activity network gives the chain nothing to branch into. The claim the
  fixture makes is the disjointness, not the shortfall.)
- **The `float_based_tracer` block is still there and is now the weaker statement.** A
  `tf <= 0` tracer marks **23** activities against a truth of 10 — 13 in error, none
  missed. That is the conflation differing in *size*. Path 1 against the flagged set is the
  same conflation sharing *nothing*, in the same file.
- **`as_read_from_the_file` is untouched at 100% recall and 100% precision**, `why` empty.
  The file is about the two marks and carries no approximation residue to confuse them
  with.

### What a conflating tracer now fails on

Reading `float_path = 1` as membership of the Longest Path marks nine activities, not one
of which is driving: **recall 0/10, precision 0/9**, and 014 decision 9's gate fails on
both clauses at once rather than on a margin. `measure.mjs --verify` already read path-1
membership off the emitted bytes and compared it to the golden, so no new reader was
needed — what was missing was a golden worth comparing against. This is the same species
of defect as the `tf <= 0` Longest Path flag 014 found and
[022](022-generator-longest-path-and-landmines.md) fixed, and the FS free-float formula
[032](032-generator-free-float-by-type.md) fixed: **a corpus that would validate the wrong
rule**. It is the third instance, and the first where the wrong rule would have scored
perfectly rather than merely well.

**One residue, and it is a reader rather than a fixture.** `verifyCorpus` reads
`float_path` back off the bytes for **membership of path 1 only** — it does not read
`float_path_order`, and it does not check path 1 against `driving_path_flag` even though it
reads both columns a dozen lines apart. The golden states the order and the disjointness;
nothing compares them, which is precisely the shape of defect
[032](032-generator-free-float-by-type.md) found in `free_float_hr_cnt`. Two assertions in
`verifyCorpus` would close it, and it is left for the integrating session because
`measure.mjs` was out of bounds to this one.

### The generator work

- **`lib/programme.mjs`** — `assignFloatPaths` rewritten from *"path 1 = the driving chain
  as one sequence"* to a total-float ranking: seed on the lowest-float unassigned activity,
  walk back through the predecessors that set its early start, number the members 1..n from
  the earliest, repeat for the next path. Walking the drivers is what keeps a path at its
  seed's float — a driving predecessor's late finish is capped by its successor's late
  start, so it cannot carry more float than a successor already at the minimum.
- **`lib/programme.mjs`** — new `setInterimDeadline`, a `CS_MEOB` on a chain that does not
  drive the finish, planted between the passes beside `forceDrivingBranches` and
  `injectCycles` for the reason those live there: it changes the logic the CPM reads, so
  doing it by mutating emitted rows would desync the golden from the model. The target is
  chosen so the tightening **cannot reach the Longest Path**. A late constraint propagates
  backwards and only along driving logic — a predecessor with slack in front of it keeps
  strictly more float than its successor, since
  `tf(pred) <= succ.ls − pred.ef = succ.tf + (succ.es − pred.ef)` and the bracket is
  positive precisely when the relationship is not driving — so it is the target's
  **driving** ancestry, not its whole ancestry, that must avoid the driving chain. Ranking
  candidates by full ancestry first produced a path 1 of two activities, which states
  nothing about order; ranking by chain length gives nine.
- **`lib/programme.mjs`** — `backwardPass` seeds `lf` from `t.lateLimit ?? projectFinish`.
  This is the only constraint the backward pass honours; the randomly sprinkled `cstr_type`
  values have always been decorative, and making them bite would move every other fixture's
  dates for no reason this ticket owns.
- **`generate.mjs`** — one line, emitting a `float_paths` block into the golden where a
  fixture asked for the paths. It is built in `programme.mjs` beside the walk that produces
  it, because it is a statement about how the two marks *relate* and needs both of them.
- **`catalogue.mjs`** — the `logic-float-path` entry only: `speculative: true` dropped, the
  landmine text rewritten onto 021's measurement, and `activities: 40`,
  `predPerActivity: 1.0`, `interimDeadlineDays: 20`, `floatPaths: 6`. The density matters
  and is commented in place: at the corpus default of 1.7 predecessors per activity the
  cross-links fuse every long chain into the one driving the finish, and the file can then
  only restate what it exists to refute.

### What did not move

The other **25** corpus fixtures regenerate **byte-identical** to their committed goldens
— checked by running the whole pipeline into a scratch directory and comparing `sha256`
and `bytes`, not by trusting that the new options default to off. `logic-float-path.xer`
is **34,471 → 52,966 bytes**, `sha256` `457100076e6788b5…`, and `measure.mjs --verify`
reports it `ok`. The only failing fixture in the run is `enc-zeroed-file`, which belongs
to a concurrent session and is not this ticket's.

Every numeral in the new `landmine` string is a numeral its golden carries — 9, −160, 10,
path 3, zero float — per the rule 032 wrote into the generator README. The figures quoted
from outside the corpus (1,570 of 1,751, 384 paths, 1..79, 75 flagged, −862 to −502) come
from [the validation asset](assets/p6-substitute-validation.md) §4 and are quoted as its
findings.

### README delta

For the integrating session to apply to `fixtures/synthetic/README.md`. Three places.

**1. The landmines** — replace the `logic-float-path` row, currently:

> | `logic-float-path` | `float_path` / `float_path_order` populated — 014's second oracle, the only one that validates order. **Speculative** |

with:

> | `logic-float-path` | `float_path` / `float_path_order` populated — 014's second oracle, and the corpus's strongest statement of 014's central claim. Path 1 is the **lowest-total-float chain**, 9 activities at −160 h; the 10 activities carrying `driving_path_flag = Y` are **path 3**, at zero float; the two sets **share nothing**. `float_path_order` is contiguous 1..n within every path, which is all this oracle validates. Measured against a real export by [021](../../docs/wayfinder/tickets/021-verify-fixtures-in-p6.md), rebuilt by [039](../../docs/wayfinder/tickets/039-float-path-semantics.md) |

**2. Three fixtures are speculative** — `logic-float-path` leaves the list; its golden now
carries `"speculative": false`. The section is shared with
[038](038-calendar-shapes-and-0x7f.md), so only the `logic-float-path` clauses are named
here: strike it from *"`cal-clndr-data`, `text-multiline` and `logic-float-path` encode
shapes **no real file in hand exercises**"* and from the list of shapes
(*"and P6's Multiple Float Paths output"*), and drop the sentence *"Oracle documents field
names for `float_path` / `float_path_order` and nothing about their contents"* — Oracle
still documents nothing, but the corpus is no longer relying on Oracle. The standing
warning block that ends *"do not trust the two sections above or the goldens' `speculative`
flags until those close"* can lose its `logic-float-path` clause once 038 also closes.

**3. The `driving_path` block** — this is where the claim belongs, because it is the
section that already teaches *a float-based mark is not the Longest Path*. Append after the
`float_based_tracer` paragraph:

> **`logic-float-path` carries a `float_paths` block too, and it is the sharpest form of
> the same claim.** `float_based_tracer` says a `tf <= 0` mark differs from the Longest
> Path — on that file, 23 activities against a truth of 10, so the two sets differ in
> *size* and one contains the other. P6's own Multiple Float Paths output goes further:
> path 1 is the **lowest-total-float chain**, and on the file the block describes it shares
> **not one activity** with `driving_path_flag = Y` — `shared_with_driving_path: []`. Two
> marks P6 wrote into the same table, disagreeing completely.
> [021](../../docs/wayfinder/tickets/021-verify-fixtures-in-p6.md) found exactly this in a
> real export: path 1's 79 members were 79 of the 86 activities at that file's minimum
> total float, and the 75 activities it flagged as driving were a disjoint set running −862
> to −502. What `float_path` validates is **order** — `float_path_order` is contiguous
> 1..n along a path — and never membership.

### Amendments for the integrating session

**014 decision 11 is restated, not overturned.** Do not edit
[014](014-compute-critical-path.md) from this ticket; the block below is drop-in prose for
the integrating session, in the shape 036's corrections already use. It attaches to
decision 11, whose current text reads *"path 1 is the longest path **in sequence**"* and
closes *"Whether Fixture A populates it is **unmeasured** — a check to run, not a
promise."*

> **Restated 2026-08-08** by
> [Correct logic-float-path to what P6's Multiple Float Paths output actually is](039-float-path-semantics.md).
> The check is run. Fixture A **does** populate it — 1,570 of 1,751 activities on one
> revision, 384 distinct paths, 3,321 rows across the 139-file set
> ([the validation asset](assets/p6-substitute-validation.md) §4) — so *"unmeasured, a
> check to run"* is discharged. What it populates is half of what this decision assumed.
>
> **What survives untouched.** *Validation-time only: never an output, never a fallback
> source, never in the contract.* That position is unchanged and is if anything better
> founded, since a mark that disagrees with the Longest Path completely is not a thing to
> fall back on.
>
> **What is corrected.** *"Path 1 is the longest path in sequence"* is wrong. Path 1 is the
> **lowest-total-float chain**, and in the measured file it shared **no member at all**
> with the 75 activities P6 flagged `driving_path_flag = Y`. So this oracle validates
> **order and nothing else** — `float_path_order` runs 1..n contiguously along a path, 1..79
> there — and `float_path` **must not be read as membership of the driving path**. It is
> the second oracle for ordering, which nothing else can supply, and it is no oracle at all
> for membership.
>
> **What inverts.** This decision was written expecting a second oracle to *agree*. It does
> not, and it should not: the two marks answer different questions, so **agreement on
> membership is now evidence of a bug rather than of correctness.** A tracer whose driving
> set matches `float_path = 1` has almost certainly reached for minimum float — the
> conflation decision 4 rejected and `xer-format.md:224` exists to warn about — and the
> corpus enforces it: `logic-float-path` was rebuilt so its path 1 and its flagged set are
> **disjoint**, and a tracer that conflates them scores 0% recall at 0% precision on that
> file.

Nothing else in 014 moves. Decision 2 (`driving_path_flag` as the oracle for membership),
decision 3 (a set, not a chain) and decision 9's gate are all unaffected — decision 11 was
never load-bearing for any of them, which is why this is a restatement and not a
re-opening.
