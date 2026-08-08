# What P6's Longest Path spans, read off a revision series

Resolution asset for
[Does a freshly-run Longest Path include completed activities?](../053-longest-path-includes-complete.md).

Measured 2026-08-08 against the real exports [001](../001-get-real-xer-files.md) secured —
**Fixture A**, 139 files — read in place, read-only. Node 24.18, WSL2. Client, contract and
file paths live only in the gitignored register; **everything here is a measurement**.

The ticket was filed as needing a P6 licence: open a progressed programme, schedule it with
*Define critical activities as: Longest Path*, export, and look. **It does not need one.**
[050](../050-ship-gate-flagged-set.md) established that the oracle is **46 revisions of one
in-progress programme**, submitted monthly while the data date advances and work completes.
That is a better instrument than a fresh run, because it observes P6 doing this over three
years rather than once, and it observes it on the very files the ship gate scores against.

File labels, the six-programme clustering and the reader method are
[050](../050-ship-gate-flagged-set.md)'s, reused unchanged so
[ship-gate.md §7](ship-gate.md) and §10 below read side by side.

---

## The headline

**P6's Longest Path runs back through completed work, and it does not stop at the data date —
it stops at the start of the programme.** The completed third of the oracle is P6's *current*
answer, not residue from an older schedule run.

Three independent measurements, none of which needs a licence:

1. **The runs are caught in the act.** Sixteen revisions carry a flagged set that had never
   appeared in the corpus before, so a Longest Path was computed at or near each one's data
   date. Those sixteen runs **added 494 rows to the flagged set, and 276 of them — 55.9% —
   were already `TK_Complete` in the revision exported before the run.**
2. **Almost none of it is residue.** Back-tracing every one of the **1,733** flagged
   `TK_Complete` rows to the revision exported before the run that wrote its flag:
   **1,669 (96.3%) were already complete then.** Only **62 (3.6%)** were remaining when the
   flag was written and completed afterwards, which is the whole of the residue effect.
3. **The completed rows are structurally load-bearing.** The full flagged set is **one
   weakly-connected component on 48 of 48 files**; drop the completed rows and it falls into
   two or three on 11. And the chain's own tails — flagged rows with no flagged predecessor —
   are `TK_Complete` on **45 of the 48 files**, 99 of 105 tails. A path made of live remaining
   work does not terminate on a completed activity 3.8 years behind the data date.

**One file in 67 behaves the other way, and it names its own cause.** A09's flagged set is 70
rows, every one `TK_NotStart`, in a programme that is 203 activities complete. It is the only
file in the set with **`SCHEDOPTIONS.sched_progress_override = Y` and
`sched_retained_logic = N`**. Six days later the same P6 project was exported again with the
settings back to retained logic, and the Longest Path had extended backwards through the
completed predecessor of its own tail.

---

## 1. What was read, and the reader proved

Every figure in this table is [050 §1](ship-gate.md)'s, reproduced from a reader written again
for this ticket — `%F` name→index **per table per file** ([002](../002-xer-file-structure.md)),
records running to the next `%T`/`%F`/`%R`/`%E`, CP1252.

| | Fixture A |
|---|---|
| `.xer` files on disk | 139 |
| unreadable | 1 — the all-`NUL` file, [021](../021-verify-fixtures-in-p6.md)'s finding |
| **distinct by SHA-256** | **67** |
| P6 export versions | 6.0 × 127, 6.2 × 2, 7.0 × 4, 8.3 × 5 |
| multi-project / external relationships | 0 / 0 |
| activities / relationships (distinct files) | 109,584 / 175,524 |
| relationship types | `PR_FS` 174,458, `PR_SS` 641, `PR_FF` 420, `PR_SF` 5 |
| lagged relationships | 845 — 0.5% |
| **`driving_path_flag` on > 1 row — the oracle set** | **48** |
| flagged rows on the 48 | **5,180**, of which **1,733 `TK_Complete` (33.5%)** |
| programmes by task-code overlap (Jaccard ≥ 0.5) | **6** — 58 / 5 / 1 / 1 / 1 / 1 files |
| the oracle's programmes | **46 revisions of one, plus two single files** |

The A01–A48 labelling — oracle files ordered by remaining activities descending — reproduces
[ship-gate.md §7](ship-gate.md) row for row on `P6`, `acts`, `remaining`, `flagged`,
`complete` and `flagged rem`, and reproduces its `oosPairs` and `comps rem` columns exactly.
**The label order is also chronological**: within the 46-revision series, remaining activities
descending is data date ascending, 2015-06-01 to 2018-05-01, with the two single-shot
programmes (A29, A38) falling where their sizes put them.

## 2. The test, stated before the numbers

Two readings were on the table, and they make opposite predictions about a revision series.

> **Reading 1.** P6's Longest Path spans completed work. Then a *freshly computed* flagged set
> contains completed activities, and the completed share of the oracle is a genuine difference
> of span between P6's answer and [014](../014-compute-critical-path.md) decision 3's.
>
> **Reading 2.** A fresh Longest Path contains only remaining work. Then every flagged
> completed row is **residue** — a mark written when the activity was still remaining, carried
> forward by exports that never recomputed it — and 45 of the 48 oracle files are stale rather
> than 22.

**What separates them is a revision where the flag was demonstrably rewritten.** Call revision
*N* a **change point** if its flagged set differs from the previous revision's, and
**demonstrably recomputed** if that set had never appeared anywhere in the corpus before. At
such a revision a Longest Path was computed after revision *N−1* was exported — nothing else
produces a set nobody has seen — so the state of the programme at *N−1* is the state the run
saw. The discriminating question is then exact and needs no dates at all:

> **Of the rows the run wrote into the flagged set, how many were already `TK_Complete` in the
> revision exported before it?**

Reading 2 predicts **zero**, on every recomputed revision. Reading 1 predicts a number that
tracks how much of the driving chain has been executed. Two refinements make it sharper:

- **The added rows are the airtight subset.** A row *added* at a change point was not flagged
  before, so its mark cannot have survived from anything; the run put it there. If it was
  already complete at *N−1*, the run marked an activity that had already finished.
- **A same-project pair removes the last degree of freedom.** Each monthly submission is a
  separate P6 project — 39 distinct `(proj_id, add_date)` pairs across the 48 oracle files —
  so in general a revision could in principle have been copied from a project we hold no
  export of. Exactly one change point is **two exports of the same P6 project**, and there the
  run demonstrably happened on that project, between those two exports.

Two further tests were run because neither depends on the revision series at all, so they
check the same conclusion from a different direction: **connectivity** (is the completed part
of the flagged set structurally part of the same chain?) and **termination** (what kind of
activity does the chain stop at going backwards?).

## 3. Result 1 — the runs, caught in the act

The 46-revision series, revision by revision. 17 change points; 16 of them carry a flagged set
that had never been seen in the corpus; the 17th (A19) reverts exactly to A14's set and is
excluded from every figure below.

| | files | flagged rows | of which `TK_Complete` | already `TK_Complete` at *N−1* |
|---|---|---|---|---|
| **demonstrably recomputed** | **16** | **1,756** | 570 (32.5%) | **563 — 32.1% of every flagged row they carry** |
| of those, rows **added** by the run | — | **494 added, 416 removed** | — | **276 — 55.9% of the added rows** |

- **15 of the 16** recomputed revisions carry at least one flagged row that was already
  complete in the revision before the run. **11 of the 16** had the run *add* one.
- The one that does not is **A09**, and §7 is about it.

The individual runs are not marginal:

| revision | data date | + | − | of the added, already complete at *N−1* |
|---|---|---|---|---|
| A28 | 2016-11-01 | **57** | 0 | **57 of 57** |
| A43 | 2017-12-01 | 77 | 13 | **76 of 77** |
| A14 | 2016-03-01 | 133 | 113 | 56 of 133 |
| A30 | 2016-12-01 | 31 | 66 | 18 of 31 |
| A33 | 2017-03-01 | 25 | 41 | 18 of 25 |
| A05 | 2015-09-01 | 15 | 1 | 14 of 15 |
| A10 | 2015-11-01 | 14 | 2 | **10 of 14** — the same-project pair, §4 |
| A12 | 2016-01-01 | 105 | 74 | 12 of 105 |
| A11 | 2015-12-01 | 8 | 3 | 7 of 8 |
| A21 | 2016-07-01 | 6 | 0 | **6 of 6** |
| A06 | 2015-10-01 | 6 | 20 | 2 of 6 |
| A03, A17, A25, A48 | — | 4 / 2 / 2 / 5 | 6 / 3 / 60 / 5 | 0 |
| A09 | 2015-11-01 | 4 | 9 | 0 — §7 |

**A28 and A21 are the cleanest single observations in the set.** Both runs removed nothing and
added only completed activities — 57 and 6 — which is a Longest Path being *extended backwards
through work that had already finished*, with no other change to the answer at all.

**The removals matter too.** 416 rows were dropped across the 16 runs, so the flag is
genuinely rewritten rather than accumulated; a mark that only ever grew would explain completed
rows without P6 ever having chosen them.

## 4. The same-project pair — the observation with no degrees of freedom left

**A09 and A10 are two exports of the same P6 project** — identical `PROJECT.proj_id` and
`add_date` — at the **same data date, 2015-11-01**, exported six days apart (2015-10-28 and
2015-11-04). Between them the programme moved by one activity: 1,548 remaining to 1,547.

| | A09 | A10 |
|---|---|---|
| flagged rows | 70 | 82 |
| `TK_NotStart` / `TK_Active` / `TK_Complete` | 70 / 0 / **0** | 69 / 3 / **10** |
| `sched_progress_override` | **`Y`** | `N` |
| `sched_retained_logic` | **`N`** | `Y` |

A10's set is A09's **+14 −2**, and **10 of the 14 added rows were already `TK_Complete` in
A09** — actual finishes running from **2014-07-25 to 2015-10-21**, up to fifteen months before
the data date they were flagged at. There is no copy, no unseen project and no interval in
which those activities could have been remaining: they were complete in a file exported from
that project six days earlier.

**And it is the chain extending, not a new chain.** A09's flagged set has exactly one tail —
one flagged row with no flagged predecessor — and that tail has an unflagged **completed**
predecessor. In A10 that exact activity is flagged.

## 5. Result 2 — back-tracing every flagged completed row

The ticket asked for the sharpened form: *where a flagged row is `TK_Complete` at revision N,
was it remaining at the revision where the flagged set last changed?* Run over all 46
revisions. For each file, the flag was last written at its **origin** — the most recent change
point at or before it — so the state the run saw is the revision exported before that origin.

| all 1,733 flagged `TK_Complete` rows across the 46 revisions | rows | share |
|---|---|---|
| **already complete when the flag was written** — not explicable as residue | **1,669** | **96.3%** |
| remaining then, completed since — genuine residue | 62 | 3.6% |
| undetermined — no revision precedes the run | 2 | 0.1% |

**43 of the 46 revisions carry at least one row that cannot be residue.** The residue effect is
real and it is small: it is the 62 rows, and it is exactly what the staleness runs produce —
inside the nine-revision run A33–A42 the completed share of a frozen 92-row set climbs 19 → 24,
and inside A43–A47 it climbs 91 → 103 by the same mechanism. **That mechanism accounts for
3.6% of the completed flagged rows in the set. It cannot account for the other 96.3%.**

## 6. Results 3 and 4 — the shape of the flagged set, with no revision series involved

Two properties of a single file, which is why they are worth having: they hold on the two
single-shot programmes and on any future export as well.

**Connectivity.** Build the subgraph `TASKPRED` induces on the flagged rows.

| | files (of 48) |
|---|---|
| the **whole** flagged set is one weakly-connected component | **48 / 48** |
| the flagged **remaining** rows alone are one component | 37 / 48 |
| the completed flagged rows are **load-bearing** — removing them splits the set | **11** |

The 11 are exactly [050 §4.3](ship-gate.md)'s files with `oosPairs ≥ 1`, and this is that
finding said from the other side. 050 read the fracture as a cost to our walk; read as evidence
about P6 it is decisive in the opposite direction — **a flagged set whose completed members are
the only route between its remaining members was computed as one object.** Residue from a
superseded path would be a disjoint older chain, not the connective tissue of the current one.

**Termination.** A backward walk stops where it stops. Count the *tails* — flagged rows with no
flagged predecessor — and ask what they are.

| | count |
|---|---|
| tails across the 48 files | **105** (1–5 per file) |
| tails that are `TK_Complete` | **99** |
| files where **every** tail is `TK_Complete` | **45 / 48** |
| the three exceptions | A29, A38 — the two 100%-not-started programmes — and **A09** |

**P6's chain does not stop at the data date; it stops when it runs out of driving
predecessors, and on 45 of 48 files that terminal activity is itself complete.** On the 15
recomputed revisions that carry a completed flagged row at all, the oldest flagged actual
finish sits **341 to 1,376 days before the data date** — 3.8 years on A48 — and the chain's
earliest flagged actual start is the programme's own earliest actual start (2014-01-25) on
three of them.

## 7. The one exception, and it names its own cause

The ticket's premise was that *"the three that flag no completed activity are precisely the
three with no progress at all, so they are consistent with both readings."* **That is wrong,
and checking it is what produced the sharpest single fact here.** The three are A09, A29 and
A38. A29 and A38 are 100% not started. **A09 is 203 of 1,751 activities complete — 11.6% — with
66 in progress**, and its flagged set contains not one completed row and not one active row
either: 70 rows, all `TK_NotStart`, **none of which starts before the data date**. That is
precisely decision 3's span, written by P6.

Every `SCHEDOPTIONS` field that could plausibly bear on it, over all 67 distinct files —
extending [050 §4.3](ship-gate.md)'s enumeration with four more:

| field | value across the 67 |
|---|---|
| `sched_float_type` | `FT_FF` × 67 |
| `sched_calendar_on_relationship_lag` | `rcal_Predecessor` × 67 |
| `sched_setplantoforecast` | `N` × 67 |
| `sched_open_critical_flag` | `N` × 67 |
| `sched_outer_depend_type` | `SD_Both` × 67 |
| `enable_multiple_longest_path_calc` | `N` × 65, `Y` × 2 |
| `sched_use_expect_end_flag` | `N` × 64, `Y` × 3 |
| **`sched_retained_logic`** | **`Y` × 66, `N` × 1** |
| **`sched_progress_override`** | **`N` × 66, `Y` × 1** |

**The two singletons are the same file, and that file is A09.** The one export in 67 scheduled
with progress override rather than retained logic is the one export in 67 whose Longest Path
holds no completed work — and §4 has it flipping back six days later, same project, settings
restored, chain extended.

**Stated as what it is: a correlation at n = 1, on two settings that move together and cannot
be separated by this set.** Progress override is the setting that tells P6 to schedule
remaining work from the data date without regard to logic running back through completed work,
so the mechanism is the obvious one — but one file is one file. What it is *not* is a
counter-example to §3–§6: A09 is a single revision, the other 15 recomputed revisions run the
other way, and the reading it supports would have to explain 1,669 rows it does not touch.

**A second `FT_FF` fact falls out and is worth recording.** All 16 demonstrably recomputed
revisions carry `sched_float_type = FT_FF` — critical defined by total float, never by Longest
Path — and they wrote a Longest Path anyway. So 050's *"a file's scheduler settings do not
describe the run that wrote its marks"* is right for a sharper reason than it gave:
`driving_path_flag` is written by an ordinary schedule run under `FT_FF`, so that field was
never going to license it.

## 8. What this does to 050's staleness reading

**050's measurement is untouched and its inference is not.** 22 of the 48 oracle files carry a
flagged set byte-identical to an earlier revision's at an earlier data date — reproduced here
exactly, 22 of 48, and all eight runs reproduce
[ship-gate.md §4.1](ship-gate.md)'s table cell for cell, including the 92-row run at
9 files / 9 data dates / 8 months / 236 completions and the 138-row run at 5 files across 3
data dates. What that byte-identity *means* has changed.

050 read identity as proof the flag was not recomputed, and the premise was that a fresh run's
set must move as work completes. **It need not.** P6's Longest Path retains completed
activities, so a driving chain that is being executed as planned yields the *same* flagged set
at every data date — the members change status, not membership. And the network underneath
those runs is inert:

| run | files | data dates | activities completed | activities +/− | relationships +/− |
|---|---|---|---|---|---|
| 92 rows | 9 | 2017-03-01 .. 2017-11-01 | 236 | **0 / 0** | **0 / 0** |
| 156 rows | 5 | 2017-12-01 .. 2018-04-01 | 180 | **0 / 0** | **0 / 0** |
| all 12 adjacency runs | 40 | — | — | 0 / 0 on every one | 1 / 1 on one run, 0 / 0 on the other 11 |

**Across the longest run — nine revisions, eight months, 236 activities completed — not one
activity and not one relationship is added or removed.** Only progress moves. An unchanged
Longest Path is what a fresh run on that programme would produce, and 050's own numbers already
lean that way: **16 of the 22 files it called stale score exactly 100%** against a walk over
their *own current dates*.

So the honest form of the finding is **the flagged set is byte-identical to an earlier
revision's on 22 of 48 files, and nothing in the file says whether that is an old mark or an
unchanged answer.** Nothing 050 decided moves: `oosPairs` is a measurement rather than an
inference, the recall floor's carve-out is unchanged, and the gate's verdict does not touch
staleness. What moves is one word — *demonstrably* — and the direction of the ticket's fear.
The set is less stale than 050 believed, not more.

## 9. What it does to the 65.6% / 98.6% fork

[050](../050-ship-gate-flagged-set.md) chose the flagged rows that are not `TK_Complete` as the
recall denominator and priced the choice: *"the gate says we agree with P6 about remaining work;
it does not say P6's Longest Path and our longest path are the same object."* **That sentence
was a concession. It is now a measurement.** The 33.9-point gap between 65.6% and 98.6% is a
difference of span between **two live answers**, and P6's spans the executed chain back to the
programme's first activity.

Had the other reading won, the same fork would have collapsed the other way: 45 of the 48 oracle
files would have been carrying stale marks, the 65.6% would have measured staleness rather than
span, and the excluded third would have been an artefact to discard rather than an answer to
decline. It is worth naming that the gate would still have passed — 050's verdict never
depended on this — but *what it certifies* would have been a different claim.

## 10. Per-file numbers

The 48 oracle files, in [ship-gate.md §7](ship-gate.md)'s order and labels. `NS`/`Act`/`Cmp`
are the flagged set's own status mix. `+`/`−` are rows added and removed against the previous
revision of the same programme. **`added already complete`** is §3's airtight subset;
**`Cmp rows already complete then`** is §5's back-trace. `tails` are flagged rows with no
flagged predecessor and `Cmp tails` how many of those are complete; `comps all` and `comps rem`
are §6's components, the latter reproducing 050's column.

| # | P6 | data date | flagged | NS | Act | Cmp | the flagged set | + | − | added already complete | flag written at | Cmp rows already complete then | tails | Cmp tails | comps all | comps rem |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A01 | 6.0 | 2015-06-01 | 77 | 72 | 4 | 1 | unchanged | 0 | 0 | 0 | A02 | 0 | 1 | 1 | 1 | 1 |
| A02 | 6.0 | 2015-06-01 | 77 | 72 | 4 | 1 | first revision | — | — | — | A02 | 0 | 1 | 1 | 1 | 1 |
| A03 | 6.0 | 2015-07-01 | 75 | 70 | 4 | 1 | **recomputed** | 4 | 6 | 0 | A03 | 1 | 1 | 1 | 1 | 1 |
| A04 | 6.0 | 2015-08-01 | 75 | 70 | 4 | 1 | unchanged | 0 | 0 | 0 | A03 | 1 | 1 | 1 | 1 | 1 |
| A05 | 6.0 | 2015-09-01 | 89 | 70 | 4 | 15 | **recomputed** | 15 | 1 | 14 | A05 | 15 | 2 | 2 | 1 | 1 |
| A06 | 6.0 | 2015-10-01 | 75 | 70 | 2 | 3 | **recomputed** | 6 | 20 | 2 | A06 | 3 | 1 | 1 | 1 | 1 |
| A07 | 8.3 | 2015-10-01 | 75 | 70 | 2 | 3 | unchanged | 0 | 0 | 0 | A06 | 3 | 1 | 1 | 1 | 1 |
| A08 | 8.3 | 2015-10-01 | 75 | 70 | 2 | 3 | unchanged | 0 | 0 | 0 | A06 | 3 | 1 | 1 | 1 | 1 |
| A09 | 6.0 | 2015-11-01 | 70 | **70** | 0 | **0** | **recomputed** | 4 | 9 | 0 | A09 | 0 | 1 | **0** | 1 | 1 |
| A10 | 6.0 | 2015-11-01 | 82 | 69 | 3 | 10 | **recomputed** | 14 | 2 | **10** | A10 | 10 | 2 | 2 | 1 | 2 |
| A11 | 6.0 | 2015-12-01 | 87 | 68 | 2 | 17 | **recomputed** | 8 | 3 | 7 | A11 | 16 | 2 | 2 | 1 | 3 |
| A12 | 6.0 | 2016-01-01 | 118 | 103 | 2 | 13 | **recomputed** | 105 | 74 | 12 | A12 | 13 | 1 | 1 | 1 | 1 |
| A13 | 6.0 | 2016-02-01 | 118 | 103 | 2 | 13 | unchanged | 0 | 0 | 0 | A12 | 13 | 1 | 1 | 1 | 1 |
| A14 | 6.0 | 2016-03-01 | 138 | 76 | 2 | 60 | **recomputed** | 133 | 113 | 56 | A14 | 60 | 3 | 3 | 1 | 1 |
| A15 | 6.0 | 2016-03-01 | 138 | 76 | 2 | 60 | unchanged | 0 | 0 | 0 | A14 | 60 | 3 | 3 | 1 | 1 |
| A16 | 8.3 | 2016-03-01 | 138 | 76 | 2 | 60 | unchanged | 0 | 0 | 0 | A14 | 60 | 3 | 3 | 1 | 1 |
| A17 | 6.0 | 2016-04-01 | 137 | 76 | 1 | 60 | **recomputed** | 2 | 3 | 0 | A17 | 60 | 3 | 3 | 1 | 1 |
| A18 | 6.0 | 2016-04-01 | 137 | 76 | 1 | 60 | unchanged | 0 | 0 | 0 | A17 | 60 | 3 | 3 | 1 | 1 |
| A19 | 6.0 | 2016-05-01 | 138 | 75 | 3 | 60 | repeat of A14/A15/A16 | 3 | 2 | 0 | A19 | 60 | 3 | 3 | 1 | 1 |
| A20 | 6.0 | 2016-06-01 | 138 | 75 | 3 | 60 | unchanged | 0 | 0 | 0 | A19 | 60 | 3 | 3 | 1 | 1 |
| A21 | 6.0 | 2016-07-01 | 144 | 75 | 2 | 67 | **recomputed** | 6 | 0 | **6** | A21 | 66 | 3 | 3 | 1 | 1 |
| A22 | 6.0 | 2016-08-01 | 144 | 75 | 2 | 67 | unchanged | 0 | 0 | 0 | A21 | 66 | 3 | 3 | 1 | 1 |
| A23 | 6.0 | 2016-08-01 | 144 | 75 | 2 | 67 | unchanged | 0 | 0 | 0 | A21 | 66 | 3 | 3 | 1 | 1 |
| A24 | 6.0 | 2016-08-01 | 144 | 75 | 2 | 67 | unchanged | 0 | 0 | 0 | A21 | 66 | 3 | 3 | 1 | 1 |
| A25 | 6.0 | 2016-09-01 | 86 | 74 | 1 | 11 | **recomputed** | 2 | 60 | 0 | A25 | 11 | 1 | 1 | 1 | 1 |
| A26 | 6.0 | 2016-09-01 | 86 | 74 | 1 | 11 | unchanged | 0 | 0 | 0 | A25 | 11 | 1 | 1 | 1 | 1 |
| A27 | 6.0 | 2016-10-01 | 86 | 74 | 1 | 11 | unchanged | 0 | 0 | 0 | A25 | 11 | 1 | 1 | 1 | 1 |
| A28 | 6.0 | 2016-11-01 | 143 | 72 | 2 | 69 | **recomputed** | 57 | 0 | **57** | A28 | 68 | 3 | 3 | 1 | 1 |
| A29 | 7.0 | 2014-01-08 | 30 | 30 | 0 | 0 | single-shot programme | — | — | — | — | — | 2 | 0 | 1 | 1 |
| A30 | 6.0 | 2016-12-01 | 108 | 76 | 2 | 30 | **recomputed** | 31 | 66 | 18 | A30 | 29 | 2 | 2 | 1 | 2 |
| A31 | 6.0 | 2017-01-01 | 108 | 76 | 1 | 31 | unchanged | 0 | 0 | 0 | A30 | 29 | 2 | 2 | 1 | 2 |
| A32 | 6.0 | 2017-02-01 | 108 | 76 | 1 | 31 | unchanged | 0 | 0 | 0 | A30 | 29 | 2 | 2 | 1 | 2 |
| A33 | 6.0 | 2017-03-01 | 92 | 73 | 0 | 19 | **recomputed** | 25 | 41 | 18 | A33 | 19 | 1 | 1 | 1 | 1 |
| A34 | 6.0 | 2017-04-01 | 92 | 73 | 0 | 19 | unchanged | 0 | 0 | 0 | A33 | 19 | 1 | 1 | 1 | 1 |
| A35 | 6.0 | 2017-05-01 | 92 | 73 | 0 | 19 | unchanged | 0 | 0 | 0 | A33 | 19 | 1 | 1 | 1 | 1 |
| A36 | 6.0 | 2017-06-01 | 92 | 73 | 0 | 19 | unchanged | 0 | 0 | 0 | A33 | 19 | 1 | 1 | 1 | 1 |
| A37 | 6.0 | 2017-07-01 | 92 | 72 | 0 | 20 | unchanged | 0 | 0 | 0 | A33 | 19 | 1 | 1 | 1 | 1 |
| A38 | 6.0 | 2014-05-24 | 28 | 28 | 0 | 0 | single-shot programme | — | — | — | — | — | 3 | 0 | 1 | 1 |
| A39 | 6.0 | 2017-08-01 | 92 | 72 | 0 | 20 | unchanged | 0 | 0 | 0 | A33 | 19 | 1 | 1 | 1 | 1 |
| A40 | 6.0 | 2017-09-01 | 92 | 71 | 1 | 20 | unchanged | 0 | 0 | 0 | A33 | 19 | 1 | 1 | 1 | 1 |
| A41 | 6.0 | 2017-10-01 | 92 | 70 | 2 | 20 | unchanged | 0 | 0 | 0 | A33 | 19 | 1 | 1 | 1 | 1 |
| A42 | 6.0 | 2017-11-01 | 92 | 66 | 2 | 24 | unchanged | 0 | 0 | 0 | A33 | 19 | 1 | 1 | 1 | 1 |
| A43 | 6.0 | 2017-12-01 | 156 | 64 | 1 | 91 | **recomputed** | 77 | 13 | **76** | A43 | 89 | 5 | 5 | 1 | 2 |
| A44 | 6.0 | 2018-01-01 | 156 | 61 | 1 | 94 | unchanged | 0 | 0 | 0 | A43 | 89 | 5 | 5 | 1 | 2 |
| A45 | 6.0 | 2018-02-01 | 156 | 57 | 1 | 98 | unchanged | 0 | 0 | 0 | A43 | 89 | 5 | 5 | 1 | 2 |
| A46 | 6.0 | 2018-03-01 | 156 | 55 | 1 | 100 | unchanged | 0 | 0 | 0 | A43 | 89 | 5 | 5 | 1 | 3 |
| A47 | 6.0 | 2018-04-01 | 156 | 51 | 2 | 103 | unchanged | 0 | 0 | 0 | A43 | 89 | 5 | 5 | 1 | 3 |
| A48 | 6.0 | 2018-05-01 | 156 | 46 | 6 | 104 | **recomputed** | 5 | 5 | 0 | A48 | 103 | 5 | 5 | 1 | 3 |

Reading down the `Cmp` column against `the flagged set`: the completed share does not reset at
a recomputation. It falls when the run picks a different chain (A06, A25, A30, A33) and rises
when the run extends the chain backwards (A05, A14, A21, A28, A43), and it is never zero on a
recomputed progressed file except on A09.

---

## What this does not measure

- **One contract, and inside it one programme sampled 46 times.** [050 §5](ship-gate.md)'s
  count is unchanged: six programmes in the tree, three carrying an oracle, 98.3% of the oracle
  one programme. Every figure above is about how **this** P6 estate behaves. And **all 16
  demonstrably recomputed revisions are P6 6.0** — the 8.3, 7.0 and 6.2 exports in the set are
  all either re-exports of an unchanged set or single-shot files, so nothing here is evidence
  about how a later P6 writes the flag.
- **Whether progress override is the cause of A09.** n = 1, two settings moving together, one
  export. §7 states it as a correlation and it must not be quoted as a rule. This is the one
  residue that would still be worth a P6 licence, and nothing turns on it.
- **What P6 does with a Longest Path option this set never carries.** `sched_float_type` is
  `FT_FF` on 67 of 67, so nothing here says how the flag behaves under
  *Define critical activities as: Longest Path* — only that it is written without it.
- **Whether the 22 byte-identical files were recomputed.** §8 removes the warrant for calling
  them stale; it does not supply a warrant for calling them fresh. The file still does not date
  its flag, and 050's `oosPairs` remains the only thing that reads the consequence.
- **Nothing in the tracer.** No rule changed, no file under `tools/` or `fixtures/` was
  touched, and no score in [050](../050-ship-gate-flagged-set.md) or
  [044](../044-tracer-seed-tie-break.md) moves. This asset is about what the **oracle** is.
