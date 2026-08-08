---
id: 049
title: The generator writes a finish milestone where P6 does not
type: task
status: closed
assignee: carlo
blocked_by: []
---

## Question

`lib/tables.mjs:31` is `inst(t, h) = t.dur === 0 ? start(h) : finish(h)` and `makeReadableDrivers`'s
`finishInstant` mirrors it, so a zero-duration row's finish is emitted as a **start** instant — one
working-hour boundary after a task finishing at the same working hour.
[044](044-tracer-seed-tie-break.md) measured 28,695 real milestone rows and found P6 doing the
opposite in **96.4%** of them: a finish milestone is written at its driver's `early_end_date`, and it
is the *task's start* that a non-working gap displaces (54.1% of 77,853 non-milestone rows).

This is the sole cause of the corpus's seed divergence, and it is the family of defect
[022](022-generator-longest-path-and-landmines.md),
[028](028-driving-test-relationship-types.md),
[032](032-generator-free-float-by-type.md) and
[039](039-float-path-semantics.md) each found once — a value written by a rule nobody had checked
against a real file.

**Do:**

1. Emit a zero-duration row's `early_end_date` / `reend_date` / `late_end_date` / `target_end_date`
   at the finish instant of the working hour it occupies, and move `finishInstant` with it.
2. Re-measure. `cal-flat-no-0x7f` and `multiproj-two-proj-id` are the two files that seed
   differently, and both should stop.
3. Restate [042](042-seed-divergence-unnamed.md)'s fifth `why` cause and the `seed_agreement` block
   against what remains. The cause is correct machinery and may end up with **no corpus instance**,
   which is itself a decision: keep it unexercised the way [031](031-readable-walk-per-type.md)'s
   milestone guard is, or engineer a fixture that keeps it live.
4. `.xer` bytes will move — the first ticket since 038 where they do. Report which files and by how
   much, confirm `--verify`, and report the corpus aggregate against 042's
   **181 truth / 174 read / 171 common, 94.5% recall at 98.3% precision, 12 `why` entries across 7
   files**.

Note what this does **not** reopen: [028](028-driving-test-relationship-types.md)'s refusal to
reconstruct the shift boundary from the file's own instants, and
[014](014-compute-critical-path.md) decision 4's timestamp-only stance. This is the generator being
wrong about what P6 writes, not the tracer being wrong about how to read it.

## Resolution

**Both divergences stop, and the readable rule was never touched to make them.** A
zero-duration row's finish is now the end of the working hour it occupies, exactly like
every other row's, so a finish milestone and the tasks that finish with it write the
**same** `early_end_date` and the tie between them is exact — which is what
[044](044-tracer-seed-tie-break.md) measured P6 doing on **98.3% of 1,879 live `TT_FinMile`
rows** (Fixture B: 100% of 541). The corpus aggregate goes from **181 truth / 174 read / 171 common — 94.5% recall at
98.3% precision, 20 of 26 exact, 12 `why` entries across 7 files** to **181 / 178 / 175 —
96.7% recall at 98.3% precision, 21 of 26 exact, 9 `why` entries across 5 files**, which is
the `why` list [031](031-readable-walk-per-type.md) left, cause for cause. `measure.mjs
--verify` is **27/27**. `cal-flat-no-0x7f` goes from four missed activities to **100% recall
at 100% precision**; `multiproj-two-proj-id` keeps all ten members and loses its lone seed
entry.

Not one line of `makeReadableDrivers`' driving test changed. What changed is the bytes it
reads.

> **Corrected 2026-08-08** by
> [044's milestone-instant figures are measured over a selector that is not a milestone test](057-correct-milestone-instant-figures.md),
> and this note governs **every** occurrence of the figure in this ticket, the Question above
> included. The paragraph above read *"which is what [044] measured P6 doing on 96.4% of 28,695
> real milestone rows"*, and the Question opens on the same number against 54.1% of 77,853.
> [044](044-tracer-seed-tie-break.md)'s population was `early_start_date == early_end_date`
> with **no status restriction**, which admits **26,325 of Fixture A's 105,028 `TT_Task` rows**
> — 26,307 of them `TK_Complete`, a completed activity having no remaining span — so about
> 26,000 of the 28,695 are completed tasks and the figure is not a milestone-versus-task
> comparison. Restricted to live rows P6 types as milestones, with live predecessors: a
> **`TT_FinMile` sits at gap 0 on 98.3%** (n = 1,879) against a **`TT_Mile`'s 46.4%** (n = 400)
> and a `TT_Task`'s 44.6% (n = 75,518); Fixture B is **100% / 1.3% / 0.0%**.
>
> **This ticket's change is untouched and its warrant is now narrower and stronger.** What it
> repaired is the *finish milestone's* instant, and `TT_FinMile` is the one row type that is an
> outlier under either measurement — the corrected figure is 98.3% against a task's 44.6%,
> where the pooled one was 96.4% against a bucket that shared its own contamination. What the
> pooled number hid is that a **`TT_Mile` writes where a task's start writes**, which is
> [054](054-ff-milestone-guard.md)'s finding.
>
> One sentence below is worth reading again rather than correcting: *"it is the discriminator
> 044's own measurement selected its 28,695 rows by"*. This ticket **named the selector
> correctly and still treated it as a milestone test** — which is where the defect was visible
> and went past, and is why 057 exists. The claim that sentence actually needs is unaffected:
> `early_start_date == early_end_date` is what P6 writes for a milestone and what the corpus
> must keep emitting, and **33 of 33 non-completed zero-duration rows in the committed set
> carry it while no other row does**. That is a statement about the corpus, where nothing is
> progressed; it does not generalise to a real programme, and 014 decision 4 now says so.

### The rule, and the half the ticket did not name

`lib/tables.mjs`'s `inst` and `makeReadableDrivers`' `finishInstant` are gone as separate
statements of the rule. Both now call **`rowStart` / `rowFinish` in `lib/calendar.mjs`**,
which is the point rather than tidiness: the rule was written out twice, had to be edited in
both places, and was wrong in both from
[022](022-generator-longest-path-and-landmines.md) to here.

```
rowFinish(cal, dur, h)   dur === 0 ? instantOf(cal, h) : cal.finishAt(h)
rowStart (cal, dur, h)   dur === 0 ? instantOf(cal, h) : cal.startAt(h)
instantOf(cal, h)        h === 0 ? cal.startAt(0) : cal.finishAt(h)
```

**The start dates had to move with the end dates, and item 1 does not say so.** Moving only
`early_end_date` / `reend_date` / `late_end_date` / `target_end_date` would emit a milestone
row whose finish is 16:00 and whose start is the next morning's 08:00 — a row finishing
before it starts. It would also destroy the only reader-visible signal a milestone row
carries: `early_start_date == early_end_date` is what P6 writes, it is the discriminator
044's own measurement selected its 28,695 rows by, and it is what the readable walk's
milestone guard keys on. So a zero-duration row writes **one** instant for every moment it
records — 33 of 33 non-completed zero-duration rows in the committed set carry
`early_start_date == early_end_date`, and no other row does.

The `h === 0` clause is not decoration. It fires **26 times** across the committed set and is
load-bearing on two files: without it `enc-truncated-export A001010` and
`unknown-table-and-enum A001000` would be dated **2026-01-02 16:00** — the working day before
the 2026-01-05 project start, and before the data date — because there is no preceding
working hour for a milestone held by the project start to end. A row held by the project
start is written at the project start.

Left alone deliberately: `TASKPRED.aref` (`start(pred.ef)`) and `UDFVALUE.udf_date`. `aref`
is not a row's own date — it is the moment the relationship lets the successor begin, which
is a start instant for a task predecessor and a milestone one alike, so it is uniform and
unaffected. `udf_date` is a value a planner typed, and 044 measures nothing about either.

### The bytes

`YYYY-MM-DD HH:MM` is fixed width, so **not one file changed length** while 23 of 28 changed
content: **370 date values on 41 rows**, all of them `TASK`, and every one a zero-duration
row.

| Column | values moved | | Column | values moved |
|---|---|---|---|---|
| `late_start_date` / `late_end_date` | 41 each | | `early_start_date` / `early_end_date` | 31 each |
| `target_start_date` / `target_end_date` | 40 each | | `restart_date` / `reend_date` | 31 each |
| `rem_late_start_date` / `rem_late_end_date` | 32 each | | `act_start_date` / `act_end_date` | 9 each |
| | | | `cstr_date` | 2 |

The committed set holds **42 zero-duration rows and 41 of them moved**. The one that did not
is `unknown-table-and-enum A001000`, which sits at working hour 0 in every one of its dates,
where the two forms already agree.

**Five files are byte-identical**: `enc-zeroed-file` (no programme in it), and
`logic-external-driver`, `logic-nonfs-drivers`, `missing-calendar` and `text-multiline` —
which is not luck, it is that all four carry **zero milestone rows**. `logic-nonfs-drivers`
staying still matters most: it is the file 028 and 031 are scored on, and every claim either
made about it is untouched.

`perf-20k` (generated, not committed) is **30,657,200 bytes**, unchanged for the same
fixed-width reason, with 1,407 zero-duration rows of 20,000; its `derived.json` moves by
**one byte**, 15,911 → 15,910, as those 1,407 finishes redistribute across the s-curve's 40
monthly buckets. Regenerating the whole set twice gives byte-identical output.

### Item 3: the fifth cause is kept, unexercised, and it is now unreachable rather than merely absent

[042](042-seed-divergence-unnamed.md)'s fifth `why` cause has **no corpus instance**, and
`seed_agreement.agree` is **true on all 27 files**. Disabling `seedDisagreement` entirely and
regenerating produces **byte-identical goldens** and `--verify` **27/27** — the same
with-and-without measurement 031 ran on its milestone guard, with the same answer.

It is kept. The argument is not the precedent, it is that the alternative cannot be built
honestly.

**It is unreachable, not unlucky.** Every row's emitted finish is `rowFinish`, which is
strictly increasing in the working hour, and every date in a fixture is written off one
calendar — so *argmax over `ef` in working hours* and *argmax over the emitted instant* are
the same set by construction. Measured rather than argued: **0 disagreements over 7,388
ordered pairs of remaining rows across the 27 programme fixtures.** The two ties 042 found
are still there, still mixed, and they now tie exactly, which is 044's 47 of 47.

So keeping the cause live needs one of two things, and both are worse than leaving it.

- **Per-activity calendars** would restore the ambiguity honestly, and they are not a
  fixture — they are a rebuild of the CPM. This generator schedules in working hours off one
  calendar; give two activities different day patterns and `ef` stops being comparable
  between them at all, which is the quantity the truth walk seeds on. That is a larger change
  than this whole ticket and it lands on
  [045](045-duration-working-days-calendar.md)/[047](047-report-duration-working-days.md)'s
  ground, not here.
- **Re-emitting the wrong instant on one fixture** fails the corpus's own rules twice. 022's
  discipline is one landmine per file and a landmine is *a thing a parser can get wrong*; a
  seed divergence is not — the readable seed rule is correct and unchanged, and the
  divergence is against a truth the file does not contain, so the fixture would assert a gap
  rather than a behaviour. And it would assert a **shape whose existence in real exports is
  unproven**. 044's 0.8% at (8, 16] hours is an upper bound with an innocent explanation
  built into the measurement — the gap is the minimum over *zero-lag `PR_FS`* predecessors,
  so a milestone whose date was set by a lagged or non-FS relationship lands in that bucket
  without P6 having displaced anything. 044 named the exact evidence that would reopen this:
  *a real programme whose finish milestone is written a working gap after the tasks that
  drive it, where one of those tasks is not a driving predecessor of the milestone.* Building
  the fixture now prejudges that measurement, and 038 spent a ticket removing the last
  `speculative: true` from this corpus rather than adding one.

What that costs, stated plainly: **042's demonstration is gone.** A corpus reverted to the
four causes scored 26/27 and now scores **27/27**, so the fifth cause is unfalsifiable by
this corpus. What is not gone is its partner — `verifyCorpus`'s *non-empty `misses` beside
empty `why` is a failure* invariant is still exercised by the four causes that do have
instances (6 misses and 3 marks in error across three files), so the tripwire is live even
where the cause it was written for is silent.

### The reader nobody had, which is why this survived six tickets

The sharpest thing found on the way. Reverting `lib/calendar.mjs` to the old milestone
instant, regenerating only the `.xer` bytes and running `--verify` against the **corrected**
goldens:

```
27/27 corpus fixtures round-trip
```

The golden carries `early_start_date` and `early_end_date` on every corpus file and
**nothing read either back**. That is the fourth time this corpus has written a value it does
not read — `driving_path_flag` (022), `free_float_hr_cnt`
([032](032-generator-free-float-by-type.md)), `float_path`
([039](039-float-path-semantics.md)) — and it is the whole reason a wrong rule sat through
six tickets that regenerated this corpus.

So the fixture this ticket adds is **no fixture at all**, on 032's argument exactly: the
files that fail are already here with the true answer beside them, and what was missing was a
reader. `verifyCorpus` now reads `early_start_date`, `early_end_date`, `act_start_date` and
`act_end_date` back off the emitted bytes by name and compares them to the golden's dump. The
same revert now scores:

```
FAIL cal-clndr-data.xer   early_start_date on 2 row(s), first A001020 [2026-01-12 08:00] != golden [2026-01-09 16:00]
FAIL progress-full.xer    act_start_date on 2 row(s), first A001080 [2026-03-26 08:00] != golden [2026-03-25 16:00]
...
6/27 corpus fixtures round-trip
```

`progress-full`'s pair is 042's own worked example, arriving as a test failure.

### What did not move

The CPM, both walks' rules, `members`, `driving_path_flag`, `float_path`,
`free_float_hr_cnt`, every float count, every table and row count, every calendar, every
`readability` verdict, every `ingest` verdict. `enc-truncated-export` still reads correctly
for 33,422 bytes with 3,442 zero bytes on the end. All 24 `landmine` strings were re-swept
under 032's rule and every number still agrees with the golden it ships in —
`logic-no-longest-path`'s 19 and 4, `logic-float-path`'s 9 members at −160 hours against a
10-member path 3 at zero float sharing nothing with it.

### Two things found and filed rather than fixed

**028's `PR_FF` milestone guard has lost its reason.** The floor declines to judge an `FF`
pair where exactly one row is a milestone *because a milestone writes its finish as a start
instant*. It does not any more: two finish instants now order exactly as their working hours
do whether or not either row is zero-duration, so the clause declines a floor that is valid.
It is left standing — the rule is 028's to change, not this ticket's — and it is still inert:
25 `PR_FF` relationships in the corpus, one with a milestone on a side, on an activity no walk
reaches, and removing the clause regenerates a byte-identical corpus. Filed rather than swept
in, exactly as 031 filed the stale landmine string it found.

**The MPXJ run predates every byte in this corpus.** `fixtures/synthetic/README.md` claims an
independent third-party read of 24 corpus files on 2026-08-08; 21 of those files have now
moved. Nothing structural changed — no table, column, arity or field width — so what the run
proved about the *shape* of these files holds, and the README now says which half of the
claim still has its bytes.

> **Answered 2026-08-08** by
> [028's `FF` milestone guard has lost its reason](054-ff-milestone-guard.md). The clause does not
> stand. This ticket judged it inert on the corpus's 25 `PR_FF`; on 565 real ones it fires **127
> times across 66 files** and rescues only candidates carrying 170–16,992 hours of slack, none of
> which ever wins an argmax. The premise this ticket removed turns out to have been **half right
> about the wrong half**: *a milestone writes its finish as a start instant* is true of a `TT_Mile`
> and false of a `TT_FinMile`, measured at 46.4% against 98.3% on live real rows, so the rule keeps a
> same-kind precondition and keys it on `task_type`. This ticket's own headline figures are also
> re-scoped — see [057](057-correct-milestone-instant-figures.md) — though its change follows from
> the `TT_FinMile` share either way.
