---
id: 053
title: Does a freshly-run Longest Path include completed activities?
type: task
status: closed
assignee: carlo
blocked_by: []
---

## Question

[050](050-ship-gate-flagged-set.md) settled that the ship gate scores against the flagged rows that
are not `TK_Complete`, and rested it on a fork the file cannot resolve. **33.5% of P6's flagged set
is completed work.** Either P6's Longest Path genuinely runs back through completed activities — in
which case our span and P6's differ by design, exactly as
[014](014-compute-critical-path.md) decision 3 assumed — or a fresh Longest Path contains only
remaining work, in which case **every flagged completed row in the set is residue from an older
schedule run**, and 45 of the 48 oracle files are stale rather than 22.

The 67 real files cannot say. The three that flag no completed activity are precisely the three with
no progress at all, so they are consistent with both readings, and 050 enumerated every `PROJECT` and
`SCHEDOPTIONS` field that could date the mark: five are empty on all 67 files and `sched_float_type`
is `FT_FF` on 67 of 67.

**This is HITL and needs a P6 licence.** The dev has none. It folds naturally into
[041](041-p6-importer-acceptance.md) as a fifth step for whoever has P6 in front of them.

**Do, with P6 in front of you:** open any progressed programme, schedule it with *Define critical
activities as: Longest Path*, export, and record whether any `TASK` row carries both
`driving_path_flag = Y` and `status_code = TK_Complete`. One export answers it.

**What turns on it.** Nothing in 050's verdict — the gate passes on either reading, and the
*"span removed"* diagnostic already recovers 99.5% of every flagged row. What moves is what the 65.6%
figure *means*, whether [014](014-compute-critical-path.md) decision 2's *"the flag is the only
ground truth"* needs a third caveat, and whether the completed third of the oracle is a different
span or simply old.

## Resolution

**Yes. P6's Longest Path runs back through completed work, and it does not stop at the data
date — it stops at the start of the programme.** The completed third of the oracle is P6's
*current* answer, not residue. Full working, per file, in
[the measurement asset](assets/longest-path-completed.md).

**And it needed no licence.** The ticket asked for one export of one fresh run; the set already
contains **46 monthly revisions of one in-progress programme**, which observes P6 doing this
seventeen times over three years, on the very files the gate scores against. The instrument was
[050](050-ship-gate-flagged-set.md)'s own finding, one section away from the fork it could not
close. Retitled accordingly, and **[041](041-p6-importer-acceptance.md) should not gain this as
a step.**

### The test, and why it discriminates

Call a revision a **change point** if its flagged set differs from the previous revision's, and
**demonstrably recomputed** if that set had never appeared anywhere in the corpus. At such a
revision a Longest Path was computed after the previous revision was exported — nothing else
produces a set nobody has seen — so the programme as the previous revision left it is the state
that run saw. The question is then exact and spends no dates at all: **of the rows the run wrote
into the flagged set, how many were already `TK_Complete` in the revision exported before it?**
Residue predicts **zero**, on every recomputed revision.

### The four measurements

1. **The runs, caught in the act — n = 16 recomputed revisions.** They **added 494 rows to the
   flagged set and removed 416**, so the flag is rewritten rather than accumulated. **276 of
   the 494 added rows — 55.9% — were already `TK_Complete` in the revision before the run**, on
   11 of the 16 files. Pooled over every flagged row those runs wrote, **563 of 1,756 (32.1%)
   were already complete when the run ran.** The two cleanest are A28 and A21: both removed
   **nothing** and added **only** completed activities, 57 of 57 and 6 of 6 — a Longest Path
   being extended backwards through finished work with no other change to the answer.

2. **One pair with no degrees of freedom left — n = 1, airtight.** A09 and A10 are two exports
   of the **same P6 project** (identical `proj_id` and `add_date`), at the **same data date**,
   six days apart, one activity of progress between them. A10's flagged set is A09's **+14 −2**,
   and **10 of the 14 added rows were already `TK_Complete` in A09**, with actual finishes up to
   **fifteen months** before the data date they were flagged at. There is no copy, no unseen
   project and no interval in which those ten could have been remaining.

3. **Back-tracing every flagged completed row in the set — n = 1,733.** Trace each one to the
   revision exported before the run that wrote its flag: **1,669 (96.3%) were already complete
   then**, on 43 of the 46 revisions. Exactly **62 (3.6%)** were remaining when the flag was
   written and completed afterwards — the residue effect is real, it is what a frozen set does
   inside a staleness run, and it accounts for one row in twenty-eight.

4. **Two properties of a single file, so they need no series — n = 48.** The **whole** flagged
   set is one weakly-connected component on **48 of 48 files**; drop the completed rows and it
   falls into two or three on 11 — [050](050-ship-gate-flagged-set.md)'s `oosPairs` files, which
   is that finding read from the other side. **A flagged set whose completed members are the
   only route between its remaining members was computed as one object.** And the chain's tails
   — flagged rows with no flagged predecessor — are `TK_Complete` on **45 of 48 files, 99 of 105
   tails**; on the recomputed revisions the oldest flagged finish sits **341 to 1,376 days
   before the data date**, 3.8 years on A48. A path made of live remaining work does not
   terminate on an activity that finished before the programme was a year old.

### The one file that behaves the other way, and it names its own cause

This ticket's own premise was that *"the three that flag no completed activity are precisely the
three with no progress at all"*. **That is wrong, and checking it produced the sharpest fact
here.** A29 and A38 are the not-started programmes. **A09 is 203 of 1,751 activities complete —
11.6%, 66 in progress — and its 70 flagged rows are every one `TK_NotStart`, none starting
before the data date.** That is decision 3's span exactly, written by P6.

A09 is also **the one export in 67 with `sched_progress_override = Y` and
`sched_retained_logic = N`** — the two singleton values in the whole `SCHEDOPTIONS` census, and
they are the same file. Six days later the same project was exported with the settings back to
retained logic and the chain had extended backwards through the completed predecessor of A09's
own tail.

**Stated as what it is: a correlation at n = 1, on two settings that move together and cannot be
separated by this set.** The mechanism is the obvious one — progress override tells P6 to
schedule remaining work from the data date without regard to logic running back through
completed work — but one file is one file, and the reading it supports would have to explain
1,669 rows it does not touch. It is named, not adopted, and it is the only residue here that a
P6 licence would still settle. Nothing turns on it.

### What moves, and what does not

- **[014](014-compute-critical-path.md) decision 3's span is unchanged; the clause justifying
  it is false.** *"The trace spans remaining work as of the data date … which is what P6's
  Longest Path is"* — the last clause is now measured wrong. Decision 3 is a deliberate
  **restriction** of P6's answer, not a reproduction of it, and it is the better decision for
  being called that: everything downstream spends remaining work
  ([006](006-derived-json-contract.md)'s *share of remaining activities*, decision 5's `skip`
  case), and a span that reached 3.8 years behind the data date would report a critical path
  most of which is built.
- **Decision 2's *"the flag is the only ground truth"* keeps two caveats, not three.**
  [044](044-tracer-seed-tie-break.md)'s first — *it spans different work* — is upgraded from
  inference to measurement, with a mechanism and a terminus. Its second — *it can be stale* —
  loses its evidence, below. No third caveat is needed.
- **[050](050-ship-gate-flagged-set.md)'s 65.6%-versus-98.6% framing is vindicated and
  hardened.** Its concession — *"the gate says we agree with P6 about remaining work; it does
  not say P6's Longest Path and our longest path are the same object"* — was a statement of
  taste and is now a statement of fact. The 33.9-point gap is a difference of span between
  **two live answers**. Under the other reading the same fork would have collapsed the other
  way: 45 of 48 oracle files carrying stale marks, and the 65.6% measuring staleness rather
  than span.
- **050's staleness reading is weakened, and in the reassuring direction.** Its measurement
  reproduces exactly — 22 of 48 files byte-identical to an earlier revision's at an earlier
  data date, all eight runs cell for cell — but the inference from identity to *stale* rested
  on the premise that a fresh run's set must move as work completes. It need not: P6's chain
  retains its completed members, so a driving chain being executed as planned yields the same
  set at every data date. And the network under those runs is inert — **across the nine-revision,
  eight-month run, 236 activities complete and not one activity and not one relationship is
  added or removed**. So the honest form is *byte-identical to an earlier revision's, and
  nothing in the file says whether that is an old mark or an unchanged answer*, which 050's own
  *16 of the 22 score exactly 100%* already leaned towards. **Nothing 050 decided moves**:
  `oosPairs` is a measurement rather than an inference, the recall floor's carve-out is
  unchanged, and the gate's verdict never touched staleness.
- **No score anywhere moves.** No rule was changed, nothing under `tools/` or `fixtures/` was
  touched, and every figure in [044](044-tracer-seed-tie-break.md) and 050 reproduces from a
  reader written again for this ticket — including the A01–A48 labelling, `oosPairs`,
  `comps rem` and the whole staleness table.

Decided AFK against numbers rather than taste under the map's delegation note. What would
reopen it is evidence rather than preference: **a real export, scheduled with retained logic on
a progressed programme, whose flagged set holds no completed row** — or a second file carrying
`sched_progress_override = Y`, which would turn the asset's §7 correlation into a rule.
