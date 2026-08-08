---
id: 028
title: Does the driving test need to distinguish relationship types?
type: grilling
status: closed
assignee: carlo
blocked_by: [014]
---

## Question

[Do we compute the critical path ourselves?](014-compute-critical-path.md) decision 4
fixes the driving test as "predecessors maximising `EF + lag`, ties kept". Building the
corpus for [022](022-generator-longest-path-and-landmines.md) showed that rule is exact
for FS and simply wrong for the other three types: an SS relationship constrains the
successor's *start* from the predecessor's *start*, and FF/SF constrain the successor's
*finish*. `EF + lag` is not the quantity that set the date in any of those cases.

It is not a rounding error, and it is hiding in the worst possible place:

| | non-FS relationships | lagged relationships (decision 4's named limitation) |
|---|---|---|
| Fixture A | 0.4% | 0.3% |
| Fixture B | 10.5% | 8.8% |

> **Corrected 2026-08-08** by
> [Recheck the lag and non-FS exposure figures against their source](036-recheck-lag-exposure-figures.md).
> The right-hand column read `8.8%` against Fixture A and `0.3%` against Fixture B, and the
> paragraph below opened *"The two approximations land on **opposite fixtures**"*. The lag
> row was read from the wrong column of the DCMA table in
> [the derived contract](assets/derived-json-contract.md), headed
> `| # | Check | Fixture B tender | Fixture A update |`. Both approximations sit on Fixture
> B. This ticket's filing argument survives — the operative half was always that non-FS
> logic is 0.4% of Fixture A, which was read correctly — and what it loses is the *opposite
> fixtures* framing and nothing else. See the ship-gate section below, which the correction
> does touch.

Both approximations land on **Fixture B**, and decision 9's ship gate —
recall >= 95%, precision >= 90%, chain continuous — runs on **Fixture A only**, where
non-FS logic is 0.4% of relationships. The gate will pass whether or not the tracer
handles relationship types at all. On the synthetic corpus, where the generator knows
the true driving relation, the same rule already costs a whole branch on
`text-multiline` and drops precision to 62.5% on `external-relationship`.

Settle:

- **Is a per-type comparison still calendar-free?** The whole reason decision 4 chose
  `EF + lag` was that ordering comparisons on timestamps need no working-time model.
  `pred.ES + lag` vs `succ.ES` for SS is the same kind of comparison, and P6 already
  wrote both timestamps — so this may cost nothing at all, which would make decision 4
  simply an under-specification rather than a trade.
- **What does FF/SF do to the walk's shape?** Those constrain the successor's *finish*,
  so a driving FF predecessor does not extend a chain of starts. Decision 3 says the
  output is a per-activity boolean set, which may absorb this for free — or may not.
- **Does `free_float_hr_cnt == 0` still corroborate?** Decision 4 leans on it, and free
  float is defined against successor starts. The corroboration may be silently
  FS-only.
- **Does the gate need a second fixture?** Fixture B has 1 flagged activity of 3,344, so
  it cannot measure recall — but it is the only real programme with meaningful non-FS
  logic. If the gate cannot see this class of error, either the gate changes or the
  synthetic corpus becomes the gate for it, which cuts against decision 8's split.

Cheap to answer and cheap to fix if the answer is yes; the corpus already contains the
files that fail, with the true answer recorded beside them.

## Resolution

**Yes, and it is free: the per-type comparison is exactly as calendar-free as
`EF + lag`, so decision 4 was an under-specification rather than a trade.** Measured
over the corpus against the generator's own driving relation, the per-type rule takes
recall from **95.1% to 96.3%** and precision from **96.3% to 98.1%**, and takes the
files reproduced exactly on all six fields from **17/24 to 19/24**. Full working, per
file, in [the measurement asset](assets/driving-test-relationship-types.md).

The corpus also could not answer the question as it stood, which is the first thing
that had to be fixed: it carried 38 non-FS relationships across 23 files and **not one
`FF` or `SF` among them drove anything**. One new fixture, `logic-nonfs-drivers`,
closes that.

And the ticket's own headline example is misattributed. **`text-multiline` does not
lose its branch to the relationship type** — the per-type rule loses it too. That one
inverts the ticket, and it is the most useful thing here.

### The rule

Walking back from the latest remaining finish, score each live resolvable predecessor
by the quantity its *type* constrains, measured against the successor timestamp it
constrains; driving predecessors are the argmax, ties all kept.

| `pred_type` | demand | measured against |
|---|---|---|
| `PR_FS` | `pred.early_end_date + lag` | `succ.early_start_date` |
| `PR_SS` | `pred.early_start_date + lag` | `succ.early_start_date` |
| `PR_FF` | `pred.early_end_date + lag` | `succ.early_end_date` |
| `PR_SF` | `pred.early_start_date + lag` | `succ.early_end_date` |

**It is still calendar-free, and the argument is arithmetic rather than empirical.**
Every quantity is a timestamp P6 already wrote or an hour count already in the row; the
comparison is a subtraction of two numbers in the file. Nothing here needs
`clndr_data`, working-day conversion, or the multi-shift and exception-working-day
shapes [the format research](assets/xer-format.md) marks unverified — which was the
whole of decision 4's reason for choosing ordering over equality. The cost is a
four-branch switch on `pred_type` and one subtraction, over columns the parser already
reads.

It is also a **strict generalisation, not a replacement**: on an all-FS successor the
reference is a constant that cancels, so the rule reduces to `EF + lag` argmax exactly.
Seventeen of the twenty-four corpus files do not move by a single activity. That is
what makes this cheap enough to simply do.

### One clause is added, and it is what decision 4 dropped for the right reason

Decision 4 rejected `pred.EF + lag == succ.ES` because a zero-gap FS across a weekend
is Friday 17:00 → Monday 08:00 and does not match. True — for **FS**. It is not true
for `SS` (start against start) or `FF` (finish against finish), where demand and
reference are the same kind of instant and the comparison is exact. So the floor
decision 4 could not afford is affordable for half the types:

> Drop a candidate whose demand is strictly earlier than its reference, where the two
> are the same kind of instant and the lag is zero. If the pool empties, the activity
> is a chain tail — held by a constraint or the project start, not by logic.

This can only ever remove a false positive: a candidate strictly below its own
reference cannot be the argmax unless the argmax is itself below the successor's date,
which is the case the generator's truth already reports as *no driving predecessor*.
It is worth **+0.6pp precision and one more exact file**, and it is what takes
`external-relationship` — the ticket's second named failure — from 62.5% precision to
100%. Of its three false positives, two are the type and one is the floor.

One guard, found by inspection and not by the corpus: **a milestone writes its finish
as a start instant** (`early_start_date == early_end_date` in the emitted row), so an
`FF` pair where exactly one side is a milestone is not like-for-like. The floor
declines to judge that pair rather than guessing. Measured with and without the guard,
the corpus result is identical — no fixture contains an FF into a milestone, which is
precisely why it needed to be reasoned about rather than tested.

### What inverted: `text-multiline` is a lag failure wearing a type costume

022 recorded that `EF + lag` costs a whole branch on `text-multiline` and filed it as
the relationship-type defect. It is not one. `A001040` is driven by `A001020` (FS,
finishing Friday 16:00) and `A001030` (SS, starting Monday 08:00) — a genuine tie in
working hours. In the file the FS demand is a **finish instant** and the reference is a
**start instant**, with a weekend between them, so two candidates that tie in working
time sit 64 elapsed hours apart and the SS wins alone. The per-type rule scores them
`−64h` and `0h` and loses the same branch.

This is decision 4's *named* limitation — elapsed hours standing in for working hours —
arriving on a **zero-lag** relationship, because a finish instant and the start instant
that follows it are the same working moment written two different ways. `FS` and `SF`
compare across the kinds; `SS` and `FF` compare like with like. **No definition that
reads only the file's timestamps can close it**, and the exposure is now counted rather
than feared: 32 activities in the corpus have live predecessors of mixed anchor kind,
11 of those are on a driving set, and exactly one gets a different answer.

The repair was built and measured before being rejected. Reconstructing the shift
boundary from the file's own dates — map a finish-anchored demand to the earliest
activity start instant at or after it — does recover the branch, and costs **five other
files**: precision 98.1% → 92.9%, exact files 19/24 → 16/24. It is a working-time model
inferred rather than read, and it breaks on a seven-day calendar and on any programme
sparse enough that nothing starts on the day the chain needs. That is the failure mode
decision 4 exists to avoid, so it stays rejected and the residue stays visible, in the
same way the lag residue does.

### FF and SF do nothing to the walk's shape — and one thing to the render

Decision 3's per-activity boolean absorbs them for free: the walk is unchanged, seeds
are unchanged, `truncated`, `cycle_count` and `path_continuous` are unchanged, and
`logic-nonfs-drivers` reproduces all six fields exactly under the per-type rule.

But the corpus surfaced something 014 did not know it was relying on. On
`logic-nonfs-drivers`, `A001140` is driven by two `SF` predecessors that **start and
finish after the activity they drive** — an SF says the successor may not finish before
the predecessor starts, so this is correct and not a defect. **A driving set is
therefore not time-ordered.** Decision 3 chose a set over a chain because a chain
cannot represent branching; it turns out to be load-bearing for a second reason, and
decision 10's client-side *path as a story* render must not assume that sorting the set
by date reconstructs the path. The generator's own `assignFloatPaths` makes exactly
that assumption and is safe today only because `logic-float-path` is an all-FS file.

### `free_float_hr_cnt == 0` is silently FS-shaped, and the corpus cannot say so

Three measurements. As the driving test on its own it scores **96.9% recall at 73.5%
precision** and reproduces 3 of 24 files — it is not a driving test. As a filter over
the per-type rule it changes **nothing on any of the 24 files**; all 148 driving
relationships have a predecessor carrying zero free float, including the FF and SF
ones. And that second result **cannot be trusted**, because the generator computes free
float with the FS formula for every relationship type and clamps the negative result to
zero (`programme.mjs:405`), which is wrong on 8 of 429 rows against a type-correct
computation. So the corpus cannot exercise the direction that matters — whether P6's
own free float would **veto** a correct non-FS driving relationship — and the zeros it
carries are an artefact of the clamp.

Decision: **the corroboration is kept, demoted to what it measurably is, and scoped.**
It never promotes a candidate and, until [021](021-verify-fixtures-in-p6.md) can say
how P6 computes free float on non-FS logic, it never demotes one either on a non-FS
relationship. A false veto punches a hole in the chain, and decision 9's gate is
asymmetric against exactly that. The generator's free-float formula is a real defect of
the same family as the `tf <= 0` flag 014 found — a value computed by the wrong rule
that has never been read — and it is filed rather than fixed here.

### The corpus gained the file that makes any of this measurable

Before this ticket: 38 non-FS relationships across 23 files, of which **three `SS`
relationships were the only non-FS logic ever on a driving chain, and no `FF` or `SF`
drove anything at all**. The per-type rule's `FF` and `SF` branches were unexecutable
by the only test corpus that will ever exist (010). Answering the ticket without a
fixture would have meant answering it by argument.

`logic-nonfs-drivers` — 20 activities, 60 relationships in an even four-way type mix,
**no lags and no leads** so relationship type is the only thing that can explain a
disagreement. Its chain runs `FF, FF, SS, FF, FS, FS, SF+SF, FS` over nine activities,
with a genuine branch where two `SF` predecessors tie. The FS-only rule fails it in
three ways at once: it **misses two activities**, **loses the SF branch**, and
**invents two branches that are not there**. Per-type is exact.

The corpus's non-FS density is now **9.3%** — a percentage point off Fixture B's 10.5%,
which is the real programme the ship gate cannot measure. `measure.mjs --verify` is
**24/24**, and every other committed fixture is byte-identical: the change is one
catalogue entry, no generator library code.

### The ship gate does not need a second fixture

The real question, and the answer is no — on three grounds, in order of weight.

1. **There is no second real fixture that could serve.** Fixture B has meaningful
   non-FS logic (10.5%) and an oracle of **one flagged activity in 3,344**. Recall
   against a one-element truth is noise, and precision against it is ~0 by
   construction. That absence is the reason 014 exists at all; it cannot also be the
   remedy.
2. **Promoting the synthetic corpus into the accuracy gate would break decision 8 for
   nothing.** The corpus's ground truth is the generator's own opinion of the driving
   relation, so a gate measured on it cannot fail for the reason a ship gate exists —
   it measures whether the tracer agrees with us, not whether we agree with P6.
   Decision 8's split — synthetic proves the *shapes* in CI forever, Fixture A proves
   the *approximation* by hand — stands, and this ticket is a clean instance of it
   working: the corpus found the shape defect, and Fixture A was never going to.
3. **The blindness was in the rule, not in the gate.** The gate could not see this
   class of error because the rule had a hole in it; the hole is now closed by
   construction rather than by measurement, and `logic-nonfs-drivers` fails any tracer
   that reverts to `EF + lag` — in CI, forever, at no cost.

What decision 9 gains is a **precondition it always implied and never stated**: a red
corpus blocks the ship regardless of what Fixture A scores. Recall ≥ 95%, precision
≥ 90% and a continuous chain on Fixture A are unchanged, and are still the only
statement anyone can make about agreement with P6.

> **Re-checked 2026-08-08** by
> [Recheck the lag and non-FS exposure figures against their source](036-recheck-lag-exposure-figures.md).
> With the lag figures corrected, Fixture A carries **0.4% non-FS logic and 0.3% lagged
> relationships** — neither of decision 4's two named approximations in quantity, where this
> section was written believing Fixture A carried the lag one at 8.8%. The **answer is
> unchanged and two of the three grounds are unaffected**; what changes is how strong the
> gate we are keeping actually is.
>
> 1. **Survives, and gets stronger.** The only real programme with meaningful non-FS logic
>    also turns out to be the only one with meaningful lags, and it is the one whose oracle
>    is a single flagged activity in 3,344. There is still no second real fixture, and the
>    fixture that would be worth measuring is precisely the one that cannot measure.
> 2. **Survives untouched.** It is an argument about the provenance of ground truth — the
>    corpus encodes the generator's opinion — and does not depend on which fixture carries
>    which exposure.
> 3. **Survives as written, but was never about lags.** The non-FS hole is closed by
>    construction and `logic-nonfs-drivers` holds it closed in CI. The lag residue is *not*
>    closed — this ticket built and rejected the shift-boundary repair at 98.1% → 92.9% — so
>    for that residue the blindness really is the gate's, and it is worse than stated here:
>    ~8 lagged relationships in 2,825. Ground 3 therefore covers one of the two approximations,
>    not both.
>
> The casualty is not one of the three grounds but a claim in **014 decision 4 itself** —
> *"it surfaces as oracle disagreement under decision 9 rather than hiding"* — which was true
> only under the transposed reading and is withdrawn there. The residue does still reach
> Fixture A, but by this ticket's own widening (a finish instant read against a start instant
> on a **zero-lag** relationship) rather than through lagged relationships, and that path is
> unquantified on Fixture A. This ticket's own **urgency** argument moves in the same
> direction: it was filed on the two approximations hiding on opposite fixtures, and they are
> in fact hiding in the same place.

### Consequences

- **014 decision 4 is amended**, not overturned: the compared quantity becomes
  type-specific, the same-kind zero-lag floor is added with its milestone guard, the
  free-float corroboration is scoped to FS, and a second residue is named — mixed
  anchor kinds on one successor, one branch on one corpus file.
- **014 decision 3 gains a reason**: a driving set is not time-ordered, because an SF
  predecessor can start after the activity it drives. Decision 10's client-side render
  is constrained by that.
- **014 decision 9 is unchanged**, and gains one sentence: the corpus must be green.
- **012/022's corpus grows to 24 files**; the aggregate figures 022 published move from
  96.1%/96.1% to 95.1%/96.3% for the rule as it was written, because the new file
  measures something the old 23 could not.
- **Two follow-ups filed** — one to bring the generator's `as_read_from_the_file` walk
  onto the amended definition (it still models decision 4 as written, deliberately: this
  ticket decides, it does not implement), and one for the FS-shaped free-float formula.
- **Zero schema demand, zero contract change, no backfill.** `derived.json` v2 and
  `activities.json` v2 carry the same fields either way, and 014 decision 6 already
  keeps this out of `card`.

> **Confirmed 2026-08-08** by [Does the tracer seed where P6 seeds?](044-tracer-seed-tie-break.md).
> This ticket's *mixed anchor kinds* residue — a finish instant scored against a start instant at
> zero lag — is real in the file set and gains a shape it did not have. The displacement runs one way
> only: a **task's** start is written at the next working period (54.1% of 77,853 zero-lag `PR_FS`
> references) and a **milestone's** finish is written at its driver's finish instant (96.4% of
> 28,695), so the two rows a tie compares are not symmetric on a real file the way they are in the
> corpus. Its refusal to reconstruct the shift boundary from the file's own instants is untouched,
> and this ticket's decision that FF/SF *"do nothing to the walk's shape — seeds are unchanged"* is
> now measured rather than reasoned: **0 seeds dropped and 0 activities lost on 48 real programmes**.

> **Amended 2026-08-08** by
> [The generator writes a finish milestone where P6 does not](049-generator-milestone-instant.md).
> The amendment's `PR_FF` carve-out was written against **this generator's** milestone instant rather
> than against P6's. With every row's finish now a finish, two finish instants order exactly as their
> working hours do whether or not either row is zero-duration, so the exclusion's premise is gone
> while the clause remains — unexercised, byte-neutral, and a decision this ticket did not take. It
> is [054](054-ff-milestone-guard.md).

> **Settled 2026-08-08** by
> [028's `FF` milestone guard has lost its reason](054-ff-milestone-guard.md). The guard is
> **withdrawn, not corrected** — and the reason is sharper than 049's. On 67 real exports, **124 of
> 420 `PR_FF` relationships carry a milestone on exactly one side and 124 of 124 are an `FF` into a
> `TT_FinMile`**, which is finish against finish and exactly like-for-like; **no `PR_FF` in either
> fixture touches a `TT_Mile`**, which is the one pair the clause would have been right about. So the
> exclusion declined the exact case and admitted the inexact one. What replaces it is this ticket's
> own argument stated exactly: the floor's same-kind test reads **what each column writes** — a
> `TT_FinMile` writes a finish instant into both date columns, a `TT_Mile` a start — rather than
> whether the row has zero span. That also closes a hole this ticket did not know it had: the floor
> applied to `PR_SS` with no guard at all, and an `SS` touching a `TT_FinMile` compares a start
> against a written finish (0 instances in 2,938, and Oracle Primavera Cloud forbids it outright).
