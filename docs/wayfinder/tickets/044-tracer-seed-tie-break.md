---
id: 044
title: Does the tracer seed where P6 seeds?
type: task
status: closed
assignee: carlo
blocked_by: []
---

## Question

[042](042-seed-divergence-unnamed.md) found that the corpus's two walks can start in different
places, and that the cause is not a generator artefact: it is a property of
[014](014-compute-critical-path.md) decision 3's seed rule read through decision 4's timestamp-only
lens. *Latest remaining finish* is a working-time quantity; a file-reader has only instants. A
`TT_FinMile` writes its finish **as** a start instant, so a finish milestone and the tasks that
finish with it are one working moment written two ways and the reader ranks the milestone strictly
later. On the corpus, **both** files whose truth seed set ties are a milestone against a task, and
**both** seed differently — on one of them four activities are lost.

The corpus cannot say how often this matters on a real programme, and it is the commonest shape in
the domain: a programme that ends in a finish milestone. [021](021-verify-fixtures-in-p6.md)'s 139
real exports carry `driving_path_flag`, which makes this measurable rather than arguable.

**Measure, on the real files:**

1. Of the activities with remaining work, how many tie on the latest `early_end_date` — and of those
   ties, how many are mixed (a row where `early_start_date == early_end_date` beside one where it
   does not)?
2. Where a tie is mixed, does the activity our rule would seed on lie inside P6's
   `driving_path_flag = Y` set, and do the activities it drops?
3. How many flagged activities are reachable **only** through a dropped seed — the cost, in P6's own
   answer, of seeding on the milestone alone.

**Then decide** whether the tracer needs a seed tie-break, and whether one exists that reads only
the file. Candidates to price rather than assume: seeding on every remaining activity with no
successor in the file (a different rule from decision 3's, so it needs decision 3's oracle argument
re-run), or admitting every activity whose `early_end_date` falls within one shift of the latest as
a seed, which trades precision for recall in a direction 014 decision 9's gate can score. Doing
nothing is a legitimate outcome — but it should be chosen against a number, and today there is none.

Nothing in [028](028-driving-test-relationship-types.md) or 042 is reopened by asking this: both
refused to spend `clndr_data` arithmetic, and a tie-break that reads only the file spends none.

The real files are gitignored and local-only, so this runs AFK on the dev's machine and its public
record is measurements only — client, contract and file paths stay in the gitignored register, per
[001](001-get-real-xer-files.md).

## Resolution

**No tie-break. The tracer seeds exactly where P6 seeds on every real file that can say —
67 of 67 — and the divergence [042](042-seed-divergence-unnamed.md) found is a property of
the generator rather than of P6.** Full working, per file, in
[the measurement asset](assets/seed-tie-break.md).

The mechanism 042 reasoned out is right and its premise is false. A finish milestone and the
tasks that finish with it *are* one working moment written two ways — but P6 writes the
milestone at **its driver's finish instant**, not at the next working period's start, so the
two ways are the same way and the tie is **exact**. Measured on live rows with live zero-lag
`PR_FS` predecessors and split by `task_type` — the share landing at the predecessor's finish
rather than one shift later — a **`TT_FinMile` is at gap 0 on 98.3%** (n = 1,879), against
**`TT_Mile` 46.4%** (n = 400) and **`TT_Task` 44.6%** (n = 75,518); Fixture B is **100% /
1.3% / 0.0%**. The row that gets displaced by a non-working gap is the **task's start**, and a
Start Milestone's with it — which is the opposite asymmetry to the one `lib/tables.mjs` emits.

> **Corrected 2026-08-08** by
> [044's milestone-instant figures are measured over a selector that is not a milestone test](057-correct-milestone-instant-figures.md),
> and this note governs **every** occurrence of the figure in this ticket. The paragraph above
> read *"Measured over 28,695 real milestone rows: **96.4% sit at gap 0** from their latest
> zero-lag `PR_FS` predecessor's `early_end_date`, against 0.8% at (8, 16] hours. The row that
> gets displaced by a non-working gap is the **task's start** — 54.1% of 77,853 non-milestone
> rows"*. Both numbers are correct measurements of the population the selector picked and
> **neither is a milestone-versus-task comparison**. The population was
> `early_start_date == early_end_date` with no status restriction, which admits **26,325 of
> Fixture A's 105,028 `TT_Task` rows** — 25.1% of them, **26,307 `TK_Complete`**, because a
> completed activity has no remaining span and P6 collapses its early dates to a point. So
> roughly 26,000 of the 28,695 are completed tasks, and the 77,853 "non-milestone" bucket is
> the task population with those same completed rows taken *out* of it. The two buckets differ
> by status far more than by kind. `task_type` is the test —
> [014](014-compute-critical-path.md) decision 4 carries the standing rule, and §4 of
> [the asset](assets/seed-tie-break.md) carries the working.
>
> **This ticket's decision is untouched, and so is 049's change.** `TT_FinMile` is the row the
> asymmetry was always about and it is the outlier under either measurement — 98.3% against a
> task's 44.6%, and 100% against 0.0% on Fixture B — so the tie is exact for exactly the reason
> stated, and the seed answer (67 of 67, 102 seeds all flagged, 0 dropped, 0 lost) never rested
> on this figure at all. What the pooled number hid is that a **`TT_Mile` behaves like a task
> rather than like a milestone** (46.4% against 44.6%), which is
> [054](054-ff-milestone-guard.md)'s finding and the reason 028's floor is now keyed on
> `task_type`. Pooled over both typed kinds the corrected figure is 55.9% of 2,279 live
> milestone rows at gap 0 against 9.3% one shift later — recorded here for completeness and
> **not** carried forward, because pooling a 98.3% row with a 46.4% row repeats in miniature the
> error this note corrects. Every figure in this note reproduces from a fourth independently
> written reader, run against the same 67 distinct Fixture A files and 4 Fixture B files.

Nothing in `tools/fixture-gen/` changed. `measure.mjs --verify` is **27/27**, and the corpus
aggregate is **181 truth / 174 read / 171 common — 94.5% recall at 98.3% precision, 20 of 26
exact, 12 `why` entries across 7 files** — every figure exactly as
[042](042-seed-divergence-unnamed.md) left it, because not one line was touched.

### The three measurements

The set: 139 files, one unreadable (021's all-`NUL` file), **67 distinct by SHA-256**, of
which **48 carry `driving_path_flag` on more than one row**. Fixture B adds four.

1. **The tie exists and is always mixed.** 47 of the 67 files tie on the latest
   `early_end_date`, and **47 of 47 ties are mixed** — a row where
   `early_start_date == early_end_date` beside one where it does not. There is not one
   all-milestone tie and not one all-task tie. Every file in the set has **exactly one
   milestone row in its seed set** (66 `TT_FinMile`, one `TT_Mile`) and **no file seeds on a
   task alone**. A programme ending in a finish milestone is not the commonest shape in the
   domain, it is the only one.

2. **Every seed we pick is inside P6's answer, and we drop nothing.** All **102** seeds across
   the 48 oracle files carry `driving_path_flag = Y`. P6's own seed set — the sinks of the
   flagged subgraph, the rows it must have started from — is exactly one per file, **48 of
   48 inside our seed set, 0 dropped**. On the 19 files where P6 flagged a single row, that
   row is one of our seeds in all 19.

3. **Zero flagged activities are reachable only through a dropped seed**, because the set of
   dropped seeds is empty. The cost of seeding on the milestone alone is not small on a real
   programme; there is none.

### The one file where 042's shape is real, and it still costs nothing

One file seeds on its `TT_FinMile` alone with **12 remaining activities sitting exactly 16
hours below it, 10 of them flagged** — the shape 042 described, in a real export. The tracer
scores **100% recall at 100% precision** on it, because those ten are the milestone's own
**driving** predecessors and the walk reaches every one from the single seed.

That is the difference from `cal-flat-no-0x7f`, and it is the whole finding. There the
dropped seed `A001190` is a predecessor of the milestone but *not* a driving one, so nothing
else reaches it and four activities go. That branch was engineered by
[022](022-generator-longest-path-and-landmines.md) to make the fixture discriminate. The real
set contains no instance of it.

### Both candidates, priced

Against `driving_path_flag` on the 48 oracle files, oracle restricted to rows that are not
`TK_Complete`:

| seed rule | seeds | marked | correct | recall | precision |
|---|---|---|---|---|---|
| **argmax `early_end_date` — unchanged** | **102** | **3,402** | **3,400** | **98.6%** | **99.9%** |
| + P6's own dropped seeds — the ceiling | 102 | 3,402 | 3,400 | 98.6% | 99.9% |
| within one shift (8 h) of the latest | 102 | 3,402 | 3,400 | 98.6% | 99.9% |
| within 16 / 24 / 64 / 72 h | 114 | 3,405 | 3,400 | 98.6% | 99.9% |
| every remaining activity with no live successor | 2,113 | 21,408 | 3,415 | 99.1% | **16.0%** |

**The window rule buys nothing and is not free.** Every width from 16 to 72 hours admits the
same 12 extra seeds — all on the one file above — and they add **3 marked activities and 0
correct ones**, taking that file from 100% precision to 90.9%. The ceiling row settles it
independently: handing the walk P6's own seeds moves not one activity, because there are none
to hand it. The trade 014 decision 9's gate was asked to score turns out to have nothing on
the recall side of it.

**Seeding on every remaining activity with no successor in the file fails on its own number**
before decision 3's oracle argument needs re-running: **+15 activities of recall for +18,006
marked**, precision 99.9% → **16.0%**, which is 74 points below decision 9's floor. A
"longest path" of 21,408 activities across 48 programmes is a list of everything with a
dangling end.

### What this costs, stated plainly

The corpus keeps a divergence that no real file exhibits. 042's fifth `why` cause is
therefore explaining an artefact of the generator's milestone instant rather than a property
of P6 exports — it is correctly stated *about the corpus*, and a reader may take it as a
statement about the format. Naming that is this ticket's price for changing nothing, and the
repair belongs to the generator rather than to the tracer.

This decision is technical and was taken AFK under the map's delegation note, decided against
numbers rather than taste, so nothing in it is flagged overturnable. What would reopen it is
evidence rather than preference: **a real programme whose finish milestone is written a
working gap after the tasks that drive it, where one of those tasks is not a driving
predecessor of the milestone.** That is one measurement on a new file, and it is the only
thing that would make a tie-break buy an activity.

### Three things found on the way, all filed rather than fixed

- **A third of the oracle is outside the span.** 1,733 of 5,180 flagged rows (33.5%) are
  `TK_Complete`, and only 3 of 48 files flag none. Scored against every flagged row the
  tracer gets **65.6% recall** and 10 of 48 files clear decision 9's gate; scored against the
  flagged rows that are not complete — decision 3's actual span — it gets **98.6% recall at
  99.9% precision** and 46 of 48 clear it. Run with the span removed as a diagnostic, the same
  walk from the same seeds recovers **99.5% of every flagged row**, so the missing 33.9 points
  are the span and nothing else. **Decision 9 says "recall ≥ 95% of P6's flagged set" and does
  not say which set** — and the ambiguity decides its verdict.
- **`driving_path_flag` can be stale.** Five consecutive revisions carry a byte-identical
  flagged set of 156 rows while the data date advances five months and 180 more activities
  complete. The set's only real failure (40.4% recall against the remaining-flagged oracle)
  is the sixth file of that run, where the flagged chain runs back through three completed
  activities inside the remaining network and 28 more sit behind them.
- **Four P6 export versions are in the set, not two** — 6.0 × 127, 6.2 × 2, 7.0 × 4, 8.3 × 5
  — and the eleven distinct activity counts say the 139 files are several programmes rather
  than one revision series. 001 and 021 record 6.0 and 8.3 only.

### How the measurement knows it is measuring the tracer

The rule was transcribed onto the emitted columns and then run against the **committed corpus
bytes**, comparing both `seeds` and `members` to each golden's `as_read_from_the_file`:
**24 pass, 0 fail, 3 skipped** — the three being the fixtures with no readable walk. It is
the same device [031](031-readable-walk-per-type.md) used, for the same reason: a golden
written from the model only proves the rule is *reachable from the file* when something reads
the file.

It caught a real defect in the reader on the way. Splitting records line-wise truncates any
row whose text value contains a newline, which changed `text-multiline`'s answer and nothing
else's — a record must run to the next `%T`/`%F`/`%R`/`%E`. That fixture earns its place
against a measurement harness, which is not what it was written for.

> **Settled 2026-08-08** by
> [Which flagged set does the ship gate score against?](050-ship-gate-flagged-set.md). The first of
> this ticket's *found on the way* bullets is discharged — the gate scores against **the flagged rows
> that are not `TK_Complete`**, and every figure here reproduces to the decimal from an
> independently written reader. The second is refined and partly inverted: staleness is **eight runs
> and 22 of 48 oracle files**, not one run of five (this ticket's run is five files across **four**
> months of data-date advance, not five), **16 of the 22 stale files score exactly 100%**, and the
> set's one real failure is **not** the stale file — its 156 rows differ from the run's by **5 added
> and 5 removed**, so its flag was recomputed. What predicts the loss is out-of-sequence progress on
> the flagged chain: `oosPairs == 0` ⟺ `recall == 100%` on 48 of 48. The third bullet gains a count:
> the 67 distinct files are **six programmes** by task-code overlap, of which **three carry an
> oracle — 46 revisions of one, plus two single files**.

> **Spent 2026-08-08** by
> [The generator writes a finish milestone where P6 does not](049-generator-milestone-instant.md).
> The repair this ticket declined to make, and filed instead, is done. Its no-tie-break decision is
> untouched — nothing in the tracer changed — and its closing price is paid: *"the corpus keeps a
> divergence that no real file exhibits"* is no longer true, and the two mixed ties it predicted
> would tie exactly now do, **2 of 2**, which is 47 of 47 reproduced at corpus scale. Its
> 96.4% / 54.1% asymmetry is the rule `lib/calendar.mjs` now implements and cites.

> **Re-scoped 2026-08-08** by
> [028's `FF` milestone guard has lost its reason](054-ff-milestone-guard.md). This ticket's
> milestone population is selected by `early_start_date == early_end_date` with no status
> restriction, and **that selector is not a milestone test on a progressed programme**: **26,325 of
> Fixture A's 105,028 `TT_Task` rows** carry equal early dates because they are complete. So the
> *"28,695 real milestone rows"* bucket is mostly completed tasks, and **96.4% / 54.1% must not be
> quoted as a milestone-versus-task figure**. Restricted to rows P6 types as milestones, with live
> rows and live predecessors: milestones sit at gap 0 on **55.9% of 2,279** against **9.3%** one
> shift later — and **98.3% of `TT_FinMile` rows** land at gap 0 rather than one shift, against 44.6%
> of tasks. **The direction is confirmed and this ticket's decision is untouched**: `TT_FinMile` is
> the outlier the asymmetry was about, and 049's change follows from it. What moves is the magnitude,
> and the fact that a `TT_Mile` behaves like a task rather than like a milestone (46.4%). This
> ticket's *"non-FS logic is invisible here"* also sharpens from rare to **absent**: **0 of 143
> `PR_FF`** and **0 of 386 `PR_SS`** on the 48 oracle files touch a flagged row. Corrections filed as
> [057](057-correct-milestone-instant-figures.md).

> **Confirmed and refined 2026-08-08** by
> [Does a freshly-run Longest Path include completed activities?](053-longest-path-includes-complete.md).
> This ticket's first *found on the way* bullet asserted that P6's Longest Path runs back through
> completed work while our walk stops at the data date, from the 33.5% figure and the span-removed
> diagnostic. It is now **measured**: sixteen revisions whose flagged set is new to the corpus added
> 494 rows of which **276 were already `TK_Complete` in the revision exported before the run**, and
> **1,669 of all 1,733 flagged completed rows (96.3%) were already complete when their flag was
> written**. The second bullet's *"the flag can be stale"* is the half that weakens — 050 already
> corrected the run's shape, and byte-identity now turns out **not to license the word at all**.
> Every figure in this ticket's own table reproduces from a third independently written reader.
