---
id: 042
title: The two walks can disagree about the seed, and `why` cannot say so
type: task
status: closed
assignee: carlo
blocked_by: []
---

## Question

The corpus's central honesty claim is that where the truth walk and the readable walk
disagree, **every disagreeing activity is named in `why` with its cause**. That claim is
false, and it was false before [038](038-calendar-shapes-and-0x7f.md) — 038 merely added
the first fixture where it costs members.

`divergenceCauses` in `tools/fixture-gen/lib/programme.mjs` walks the union of the two
walks' members and, for each activity, compares the *driving predecessor set* the truth
found against the set the readable rule finds. It emits an entry only where those sets
differ. So it can only ever explain a disagreement about **which predecessor drives**.

The two walks also choose their **seeds** differently, and nothing compares them. The
truth seeds on remaining work measured over working time; the readable walk seeds on the
latest `finishInstant` in the emitted timestamps. When those pick different activities the
readable walk starts somewhere else entirely — and every activity both walks reach can
still agree on its drivers, so the entry list comes back **empty** while the membership
sets differ.

Measured across the corpus, two fixtures seed differently:

| Fixture | truth seeds | readable seeds | cost |
|---|---|---|---|
| `cal-flat-no-0x7f` | `A001130`, `A001170`, `A001190` | `A001170` | **4 misses, `why: []`** |
| `multiproj-two-proj-id` | `A001170`, `A001190` | `A001190` | none — both walks reach the same set |

The second is why this went unseen: it has been in the corpus throughout, it seeds
differently, and it costs nothing, so no golden ever showed a bare `misses` list. The
first is a *reject* fixture nobody scores a tracer against anyway.

**Do:**

1. Add **seed disagreement as a fifth cause** in `divergenceCauses`, reported per
   activity like the other four, so a bare `misses` list can no longer occur. The natural
   statement is the physics: the truth seeds on remaining work over working time and the
   readable rule seeds on the latest emitted finish instant, which is 014 decision 4's
   elapsed-hours residue arriving at the *start* of the walk rather than inside it.
2. Record the truth and readable **seed sets** in the `driving_path` block, since the
   golden currently carries `seeds` for each walk but nothing asserts them against each
   other.
3. Add the assertion to `verifyCorpus`: a non-empty `misses` or `marks_in_error` with an
   empty `why` is a **failure**. That invariant is what the corpus claims and nothing
   currently enforces it — the same shape of defect
   [032](032-generator-free-float-by-type.md) found in `free_float_hr_cnt` and
   [039](039-float-path-semantics.md) found in `float_path`, for the third time.
4. Restate the claim in `fixtures/synthetic/README.md`'s `driving_path` section once the
   cause is named; the section currently carries an interim note pointing here.

Nothing decides here beyond the wording of the cause. This does **not** reopen
[028](028-driving-test-relationship-types.md)'s refusal to close the approximation — the
seed divergence is the same knowingly-accepted residue, and naming it is all this ticket
asks for.

## Resolution

**The divergence is not incidental, it is determined: it happens exactly where the truth's
seed set ties across rows that write their finish differently, and the corpus contains two
such ties and two divergences — 2 of 2.** Of the 26 goldens with a readable walk, 22 seed
on a single activity and cannot diverge, two have no seeds at all (100% complete, `state:
skip`), and two tie. Both ties are a finish milestone against the task it finishes with,
and both pick different seeds. So the shape the ticket found by reading two goldens is the
only shape that produces it, and it was one fixture away from happening again.

`why` goes from **9 entries across 5 files to 12 across 7**. No corpus file now carries a
non-empty `misses` or `marks_in_error` beside `why: []`, `measure.mjs --verify` **fails**
one that does, and a corpus reverted to the four causes scores **26/27**. Not one byte of
any `.xer` moves.

### The physics, measured

`finishInstant` is `dur === 0 ? cal.startAt(ef) : cal.finishAt(ef)`. `finishAt(H)` is the
end of working hour `H − 1` and `startAt(H)` is the beginning of working hour `H`, so on
the same day they differ by an hour and a tie cannot cross. At a **day boundary** — which
is precisely where a finish milestone sits, because it follows the activity that finishes
the day — they are `2026-03-25 16:00` and `2026-03-26 08:00`: one working moment written
two ways, and the milestone wins by 16 elapsed hours it does not own. The truth compares
`ef` in working hours and calls it a tie.

| Fixture | truth seeds | readable seeds | cost |
|---|---|---|---|
| `cal-flat-no-0x7f` | `A001130`, `A001170` (`TT_FinMile`), `A001190` | `A001170` | **4 misses** — `A001190` and the three activities behind it |
| `multiproj-two-proj-id` | `A001170`, `A001190` (`TT_FinMile`) | `A001190` | none |

The ticket's table reproduces exactly, and the reason the second costs nothing is now
visible rather than lucky: `A001170` is `A001190`'s driving predecessor, so dropping it as
a seed only makes the walk arrive one step later. On `cal-flat-no-0x7f`, `A001190` is a
predecessor of the milestone but **not a driving one** under the readable rule, so nothing
else reaches it and its whole chain goes with it.

### The fifth cause, and where it ranks

`seedDisagreement(dp)` in `lib/programme.mjs` returns the symmetric difference of the two
seed sets with its cause; `divergenceCauses` folds those indices into the union it already
walks and lets the seed cause **outrank** the four driver causes, because it decides
whether the walk reaches the activity at all rather than which predecessor put it there.
No corpus activity is currently both, so the precedence is a rule rather than an
observation.

An entry is emitted for **every** activity in the symmetric difference, including where it
costs nothing. That is the deliberate half: `multiproj-two-proj-id` has seeded differently
since the day it was written, cost nothing, and is the whole reason this went unseen. It
now carries one `why` entry beside `differs: false` — the corpus's only file where the two
walks disagree about the *route* and agree about the *answer*.

On a seed entry `driving` and `read_as_driving` are **equal**, and they are printed rather
than blanked. Two identical driver lists beside a seed cause is the shortest statement of
what the defect was: the two walks agreeing about everything they compare, and still
disagreeing.

### The seed sets, stated against each other

`as_read_from_the_file.seed_agreement` — `agree`, `truth`, `as_read`, `only_in_truth`,
`only_in_read`. Both lists were already in the golden, one per walk, forty lines apart,
which is the finding rather than a detail: a field per walk and no comparison. That is the
same repair [032](032-generator-free-float-by-type.md) made on `free_float_hr_cnt` and
[039](039-float-path-semantics.md) asked for on `float_path` against `driving_path_flag`,
for the third time — **a golden nothing reads is not an assertion**.

`differs` is deliberately **not** extended to cover the seeds. It answers a scoring
question — does a tracer built to decision 4 get a different answer on this file — and on
`multiproj-two-proj-id` the honest answer is no: same ten members, same branches, same
structure, 100% recall at 100% precision. The route difference is `seed_agreement`'s to
state and `why`'s to explain, and fusing them would move a scoring flag on a file where
the score is perfect.

### The assertion, and how strong it actually is

`verifyCorpus` fails a fixture whose `misses` or `marks_in_error` is non-empty while `why`
is empty. It is a **golden-internal invariant, not a byte comparison** — `misses` is the
difference between two walks and only one of them is recoverable from the file — and the
comment says so, so the next reader does not mistake it for a round-trip check. Run
against the corpus's pre-042 goldens:

```
FAIL cal-flat-no-0x7f.xer   4 miss(es) and 0 mark(s) in error with why: [] — a disagreement the golden cannot explain
26/27 corpus fixtures round-trip
```

The invariant is the weak one the ticket specified, and the strong one is not available:
**5 of the 13** activities named in a `misses` or `marks_in_error` list appear in `why` by
name, and the other eight are *downstream* — missed because the only route to them ran
through a divergence named on a different row. `multiproj-baseline-rows` names one
activity and lists three. So *every disagreeing activity is named* is false as literally
written and true as meant — every **disagreement** is named — and
`fixtures/synthetic/README.md` now says it in those words rather than the stronger ones.

### What this does not repair

The readable rule's seed is not wrong and is not changed. A reader can see which rows are
milestones — `early_start_date == early_end_date`, the same signal the walk already uses
for its zero-lag floor — but seeing it does not order `16:00` against the next morning's
`08:00` without knowing that no working time separates them, and that is `clndr_data`
arithmetic, which is the thing [014](014-compute-critical-path.md) decision 4 exists to
avoid. This is 028's residue in a new place, handled on 028's terms: stated, measured, not
tuned away. Nothing here reopens it.

### What did not move

**Not one `.xer` byte**, on any of the 27 corpus files or `sparse-150` — checked file by
file against the pre-change tree rather than inferred, since the cause strings and the seed
block live only in the goldens. The corpus aggregate is **181 truth / 174 read / 171 common
— 94.5% recall at 98.3% precision, 20 of 26 exact**, identical to before, as are every
`members`, `flagged`, `misses`, `marks_in_error`, `float_paths` and `free_float_hr_cnt`
figure. 26 corpus goldens and `sparse-150.expected.json` gain the `seed_agreement` block;
`enc-zeroed-file` has no readable walk and gains nothing. `measure.mjs --verify` is
**27/27**.

### One thing found and left for a ticket

**The product inherits this, and 014 never named it.** Decision 3 fixes the span as
*"remaining work as of the data date, walked back from the latest remaining finish"* and
names no approximation in it; decision 4 names one (lag as elapsed hours) and 028 added the
second (mixed anchor kinds). The seed is a **third**, and it is the only one that can move
the whole answer rather than one activity's drivers — and it fires on the commonest shape
in the domain, a programme that ends in a finish milestone. Wherever P6 seeds on a
milestone *and* the tasks that finish with it, our tracer seeds on the milestone alone, and
every chain reaching the finish only through one of those tasks is lost. It is measurable
rather than arguable: [021](021-verify-fixtures-in-p6.md)'s 139 real exports carry
`driving_path_flag`, so the tail of the flagged set can be compared with the seed our rule
would pick. Recorded here and filed by the integrating session; the amendment it implies
sits on 014 decision 3, which currently reads as though the span were free of
approximation.

> **Answered 2026-08-08** by [Does the tracer seed where P6 seeds?](044-tracer-seed-tie-break.md).
> The answer inverts this ticket's expectation: the seed rule loses nothing on any real file, because
> the tie it feared is **exact** — P6 writes a finish milestone at its driver's finish instant, and
> 47 of 47 real ties are mixed and fully seeded. What survives entirely is the corpus work: the fifth
> `why` cause, the `seed_agreement` block and the `verifyCorpus` invariant are all correct **about the
> corpus**, and the corpus is the thing they describe. What is now known is that the divergence they
> explain is `lib/tables.mjs`'s milestone instant rather than a property of a P6 export, which is
> [049](049-generator-milestone-instant.md) — and after that fix this ticket's fifth cause may have
> no corpus instance at all.

> **Amended 2026-08-08** by
> [The generator writes a finish milestone where P6 does not](049-generator-milestone-instant.md).
> Everything this ticket *built* survives and everything it *found* was ours. The fifth `why` cause,
> the `seed_agreement` block and the `verifyCorpus` invariant are all still here and still correct;
> what has gone is the divergence they explain, because the thing writing one working moment as two
> wall-clock instants was `lib/tables.mjs` rather than the format. This ticket's own worked example —
> `2026-03-25 16:00` against `2026-03-26 08:00` — now arrives as a test failure on `progress-full`
> rather than as physics. Three figures move with it: `agree` is **true on all 27 files**, *"a corpus
> reverted to the four causes scores 26/27"* becomes **27/27** so the cause is now unfalsifiable
> here, and *"not one byte of any `.xer` moves"* is superseded by 23 files and 370 date values. The
> `5 of 13` naming ratio becomes **4 of 9**. The decision this leaves standing is that the cause is
> **kept**, unexercised, on the terms 031 kept its milestone guard.
