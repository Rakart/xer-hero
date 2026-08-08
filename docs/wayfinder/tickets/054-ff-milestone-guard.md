---
id: 054
title: 028's `FF` milestone guard has lost its reason
type: grilling
status: closed
assignee: carlo
blocked_by: []
---

## Question

[028](028-driving-test-relationship-types.md)'s floor drops a candidate demanding strictly less than
its reference where the two are the same kind of instant and the lag is zero, **excluding a `PR_FF`
pair in which exactly one row is a milestone**. The stated reason is that *a milestone writes its
finish as a start instant*, so the pair is not like-for-like.

[049](049-generator-milestone-instant.md) removed that. A milestone's finish is now a finish like
every other row's, and the emitted finish is strictly increasing in the working hour, so **two finish
instants order exactly as their working hours do whether or not either row is zero-duration**. The
exclusion therefore declines a floor that is valid, and the rule the map holds carries a clause whose
justification is gone.

It costs nothing today: 25 `PR_FF` relationships in the corpus, exactly one with a milestone on a
side, on an activity no walk reaches, and removing the clause regenerates a byte-identical corpus
(measured by 049, and by [031](031-readable-walk-per-type.md) before it). So this is a question about
what the **product tracer** should implement, not about the fixtures.

**Decide** whether [014](014-compute-critical-path.md) decision 4's amended rule keeps the `PR_FF`
milestone exclusion. Keeping it needs a reason that survives 049 — one candidate is P6's own
`FF`-into-a-milestone semantics, which nothing in this effort has read. Dropping it needs a fixture
that executes the branch, which the corpus does not currently have. Doing nothing is legitimate and
is the status quo, but it should be **chosen rather than inherited**.

Technical, so AFK under the map's delegation note.

## Resolution

**The exclusion goes, and it goes because it is inverted rather than merely unjustified: it
declines the one `FF`/milestone shape whose comparison is exact and admits the one whose
comparison is not.** Across the 67 distinct real exports, **124 of the 420 `PR_FF`
relationships have a milestone on exactly one side and 124 of 124 are an `FF` into a
`TT_FinMile`** — finish instant against finish instant, like-for-like by
[049](049-generator-milestone-instant.md)'s own correction. **Not one `PR_FF` in either fixture
touches a `TT_Mile`**, which is the only shape the clause would have been right about. Full
working, with the Oracle citations, in
[the measurement asset](assets/ff-milestone-guard.md).

It is replaced rather than deleted. 014 decision 4's amended rule keeps a same-kind precondition
on the floor, and states it against **what each column writes** instead of against zero span:

```
writtenKind(row, column)
  task_type == 'TT_FinMile'  ->  'finish'   (both columns)
  task_type == 'TT_Mile'     ->  'start'    (both columns)
  otherwise                  ->  the column's own kind
```

The floor applies where `writtenKind(pred, demandColumn) == writtenKind(succ, referenceColumn)`
— so to `PR_SS` and `PR_FF` as before, **minus** `PR_FF` touching a `TT_Mile` and `PR_SS`
touching a `TT_FinMile`, and **plus** every `PR_FF` milestone pair that occurs in reality. Cost:
one enum lookup on a column the parser already reads, which leaves 028's *"no `clndr_data`, no
working-time arithmetic, no schema, no backfill"* intact.

### The clause is live on real files, and it is dead weight

The corpus said 25 `PR_FF`, one milestone pair, byte-neutral. The real set says something the
corpus could not: the clause is **not inert**. It rescues **117** candidates the floor had
already judged, across **62 of 67 Fixture A files** (10 more across 4 of 4 Fixture B files).

What it rescues never wins. The nearest rescued candidate in Fixture A demands a finish
**170.4 hours** — seven working days — below the finish it is supposed to have set; the median
is **936 hours**. The 117 land on 62 successors, each carrying **11 to 46** live predecessors,
and on **0** of them is a rescued candidate the argmax and on **0** does the pool empty without
it. Scored end to end on the 48 oracle files, with the clause and without:

| | seeds | marked | correct | recall | precision | files differing |
|---|---|---|---|---|---|---|
| clause kept | 102 | 3,402 | 3,400 | 98.6% | 99.9% | — |
| clause dropped | 102 | 3,402 | 3,400 | 98.6% | 99.9% | **0 / 48** |

Identical to the decimal — which reproduces
[044](044-tracer-seed-tie-break.md)'s figures exactly, and is the cross-check that the
transcription is faithful before it is the answer to anything. **The score cannot decide this**,
at 175,524 relationships any more than at 915.

### The reason the ticket named does not exist, and its nearest relative acquits the clause

Oracle documents **no** `FF`-into-a-milestone semantics for P6. Milestones are zero-duration and
the text stops there; `early_start_date` and `early_end_date` are documented as unconditional
`TASK` columns with no milestone note; there is **no published forward-pass formula at all**,
hence nothing type-specific or zero-duration-specific; and P6 documents that it *flags*
*"milestones with invalid relationships"* while **never publishing the criterion**. Stated as a
non-finding rather than a gap: thirteen searches and sixteen fetches returned nothing on the
point, and the asset lists them so the absence is checkable.

The rule does exist in Oracle text — in the **Oracle Primavera Cloud** error-message reference, a
different product. PRM-003015125 forbids an `FF` successor that is a **Start** Milestone;
PRM-003015126 forbids an `SS` predecessor that is a **Finish** Milestone. Neither forbids `FF`
into a Finish Milestone. **Oracle's own validation encodes the anchor-kind argument and
exonerates all 124 real relationships this clause declines to judge** — and it names the two
pairs the replacement excludes, which is where the replacement comes from rather than from
taste.

### The property it keys on is not a milestone test

`early_start_date == early_end_date` matches **26,325 `TT_Task` rows** in Fixture A — 25.1% of
all task rows — of which **26,307 are `TK_Complete`**: a completed activity has no remaining
span, so P6 collapses its early dates to a point. 031 chose the test as *"a reader-visible
property of the emitted row, not a model fact"*, and on the corpus it is exactly that; on a
progressed programme it is a zero-remaining-span test wearing a milestone's name. Where the rule
uses it this is nearly harmless — over the 81,848 live Fixture A rows the walk can reach, it
disagrees with `task_type` on **18** and never in the other direction — but it is the fourth
value in this effort written by one rule and read by another.

`task_type` separates what zero span conflates, and the file set says so. For live rows with
live zero-lag `PR_FS` predecessors, the share whose written instant sits at the predecessor's
finish rather than one shift later: **`TT_FinMile` 98.3%** (n = 1,879), **`TT_Mile` 46.4%**
(n = 400), `TT_Task` 44.6% (n = 75,518). Fixture B: **100%**, **1.3%**, 0.0%. A Start Milestone
writes where a task's *start* writes; a Finish Milestone is the outlier.

### The oracle is silent, at n = 143

On the 48 files carrying a usable `driving_path_flag`, **not one of the 143 `PR_FF`
relationships touches a flagged row on either side** — nor does one of the 386 `PR_SS`. P6's
Longest Path across these programmes is `FS` logic end to end. 044's *"non-FS logic is invisible
here"* sharpens from *rare* to **absent**: the flag has never once been asked about an `FF`.
The two `FF` relationships in the whole set that touch a flagged row are a degenerate one (a
file where P6 flagged a single row, its `FF` predecessor unflagged with 4,080 hours of slack)
and a lagged one (−56 h, where the floor never applies). So the question *does the excluded
pair's behaviour agree with P6?* has no answer in this file set, and not for want of files.

### The fixture, specified

Neither branch is executable by the corpus **or by the 139 real exports**, and the missing
ingredient is not the relationship — it is the topology. A floored candidate only changes an
answer when it wins the argmax of the surviving pool, which in practice means being the sole
live resolvable predecessor: **0 of 72** real successors carrying a rescued `FF` have one.

`logic-ff-milestone-floor`, one file, two activities under test, one landmine, no `speculative`:

- **`M`**, a `TT_FinMile` on the driving chain but not at the seed, held later than its logic by
  a constraint, whose **only** live resolvable predecessor is a task `T` via zero-lag `PR_FF`
  finishing four working days below `M`'s finish — every other predecessor `TK_Complete`, which
  is how a real programme arrives at a one-candidate pool. Clause dropped: the pool empties and
  `M` is the chain tail the truth records. Clause kept: `T` is marked and the walk invents `T`'s
  whole chain.
- **`S`**, a **`TT_Mile`** on the driving chain whose only live resolvable predecessor is a task
  `U` via zero-lag `PR_FF`, with `U`'s finish at the working-period boundary immediately before
  `S`'s written instant — the same working moment written the two ways. Without the replacement
  clause the floor drops `U` and `S` becomes a **false chain tail**, which is the false negative
  014 decision 9 is asymmetric against, and the more valuable half.

Honest about the footing: half one's relationship shape is evidenced at **n = 117 across 62 real
files** and only its sole-predecessor topology is engineered — the same engineering 022 applied
to `cal-flat-no-0x7f`. Half two is engineered outright, since **0 of 565** real `PR_FF`
relationships touch a `TT_Mile`; it stands on Oracle's validation grammar and on the P6 24.12
lead that milestone relationship restrictions were later removed. `TT_Mile` needs no new
generator machinery — `logic-no-longest-path` already carries one.

### Consequences

- **014 decision 4's amended rule loses the `PR_FF` milestone exclusion and gains a written-kind
  same-kind test.** The floor's precondition becomes true rather than approximately true, and it
  is stated on `task_type` rather than on zero span.
- **028's guard paragraph is withdrawn, not corrected.** *"A milestone writes its finish as a
  start instant"* was already withdrawn by 049 for the format; what this ticket withdraws is the
  clause it justified, and the finding that replaces it is that the sentence is true of exactly
  one of the two milestone types.
- **A second hole is closed on the way**, which nobody had looked at: the floor applied to
  `PR_SS` with no guard at all, and an `SS` touching a `TT_FinMile` compares a start against a
  written finish. Zero instances in 2,938 real `PR_SS` relationships, and Oracle forbids it —
  closed by construction, like 028's own non-FS hole.
- **031's implementation changes in one expression** (`sameKind`), and the corpus does not move:
  its single milestone `FF` is on an activity no walk reaches, and both 031 and 049 measured
  removal as byte-identical.
- **044's 96.4% is re-scoped, not withdrawn** — its selector was `early_start_date ==
  early_end_date` with no status restriction, so its 28,695-row *milestone* bucket is mostly
  completed tasks. Restricted to typed, live milestones the asymmetry holds in direction and not
  in magnitude. Detail in the asset; it does not touch 044's decision or 049's change, both of
  which are about the finish instant and are confirmed by the `TT_FinMile` row of the same table.
- **Zero schema demand, zero contract change, no backfill**, and one fixture filed rather than
  built — a `grilling` ticket decides, it does not write the generator.
- **Overturnable:** the *replacement*, not the removal. Deleting the clause and writing nothing
  is defensible and simpler, and on this file set it is the identical rule — 139 of 139
  reclassifications go one way and the two clauses the replacement adds have zero instances. The
  removal is decided against numbers and is not flagged.
