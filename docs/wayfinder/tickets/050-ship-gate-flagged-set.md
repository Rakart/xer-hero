---
id: 050
title: Which flagged set does the ship gate score against?
type: grilling
status: closed
assignee: carlo
blocked_by: []
---

## Question

[014](014-compute-critical-path.md) decision 9 reads *"recall ≥ 95% of P6's flagged set"*.
[044](044-tracer-seed-tie-break.md) ran it for the first time and the sentence has two readings that
disagree about the verdict: **65.6% recall, 10 of 48 files passing** against every flagged row, and
**98.6% at 99.9%, 46 of 48** against the flagged rows that are not `TK_Complete`. **33.5% of the
oracle is completed work**, because P6's Longest Path runs back through it and decision 3's span
stops at the data date. A diagnostic run with the span removed recovers 99.5% of every flagged row,
so nothing else is in the gap.

Settle which set the gate means, and say it in the sentence. The span-consistent reading is the one
decision 3 implies, but it is the reading under which we grade ourselves against the part of P6's
answer we chose to reproduce, which is worth stating rather than assuming.

Two things ride on it.

**The flag can be stale.** Five consecutive real revisions carry a byte-identical 156-row flagged set
while the data date advances five months and 180 more activities complete. The flag records the
schedule run that wrote it, not the schedule the file describes, and nothing in the file dates it —
so a gate run over a whole set silently averages fresh and stale oracles, and the set's one real
failure (40.4% recall) is the sixth file of that run.

**The population changed.** Decision 9 says *"one fixture, one contractor"*; 044 found the 139 files
are **67 distinct and several distinct programmes**, so the gate could be run over a population
rather than a file, which changes what *we are not broken* means.

Technical, so AFK under the map's delegation note.

## Resolution

**The flagged rows that are not `TK_Complete`, pooled over the corpus rather than one file — and
the gate passes. `logic.longest_path` ships as a computed value.** 98.6% recall at 99.9%
precision, 47 missed rows in 3,447, 2 false positives in 3,402 marked, and **no chain broken
that P6 keeps whole on 48 of 48 files**. Full working, per file, in
[the measurement asset](assets/ship-gate.md), re-derived from the real exports by an
independently written reader that reproduces [044](044-tracer-seed-tie-break.md)'s per-file
table to the decimal on every shared column.

Measured off the **real files**, not off `tools/fixture-gen` —
[049](049-generator-milestone-instant.md) is changing `lib/tables.mjs` and `lib/programme.mjs`,
so the rule was transcribed rather than called, which is the same device
[031](031-readable-walk-per-type.md) and 044 used and the reason none of this is superseded by
what 049 lands.

The ticket asked which of two gates was meant. It turns out **there were never two gates.**

### The sentence

> **9. The ship gate, and it is asymmetric.** Ship only if, pooled over every real export
> carrying `driving_path_flag` on more than one row — 48 files today — the tracer reaches
> **≥ 95% of the flagged activities that are not `TK_Complete`**, which is decision 3's span
> and not P6's whole flagged set, at **≥ 90% precision** against every flagged row, **breaking
> no chain P6 keeps whole**. Two floors keep the pooling honest: no file below **90%
> precision**, and no file below **90% recall** unless it carries an **out-of-sequence flagged
> pair**. The synthetic corpus must be green (028). Below any of that,
> `logic.longest_path` stays `unavailable`, the tracer is v2 work, and the map's current
> position is unchanged.

### The five decisions

1. **The span-consistent set, and the ambiguity was one-sided.** Precision is **99.9% under
   both readings**, to the decimal, and the correct count is **3,400 under both** —
   `traceReadable` drops `TK_Complete` from the candidate pool before it scores anything, so
   the walk cannot mark a completed row. What decision 9 left unsaid was never a choice between
   two gates; it was a choice of **recall denominator**, and 1,733 rows of it. Everything
   downstream already spends decision 3's span: `logic.longest_path` reports *share of
   remaining activities* ([006](006-derived-json-contract.md)), decision 3's boolean is a
   statement about remaining work, and decision 5's `skip` case is *"100% complete, no
   remaining work"*. A gate scored against a set the product does not claim to produce would
   fail a tracer for obeying the contract.

   **Stated rather than assumed, because the ticket asked for it:** this is the reading under
   which **we grade ourselves against the part of P6's answer decision 3 elected to reproduce,
   and the gate can never argue against that election.** The counterfactual is measured, not
   feared — run with the span removed, the same walk from the same seeds recovers **99.5% of
   every flagged row at 98.2% precision**, so the 33.9-point gap is the span and nothing else,
   and a broken tracer would fail both readings. That is what licenses the choice: the
   unrestricted score is evidence about the *span*, which is a settled product decision, not
   evidence about the tracer. The one-line honest summary the gate now carries is **the gate
   says we agree with P6 about remaining work; it does not say P6's Longest Path and our
   longest path are the same object.**

2. **Continuity becomes an agreement clause, and it is run for the first time.** Nobody had
   ever scored decision 9's third clause. Read absolutely it **fails 2 of the 48 oracle
   files**; read as agreement it passes **48 of 48**. The two it fails absolutely are
   100%-not-started programmes whose walk ends on activities with no predecessors starting
   2,258 and 2,321 days after the data date — and on both our marked set is **identical to
   P6's, 100% recall at 100% precision**, because P6's own chain stops in exactly the same
   place. The absolute reading refuses to ship the tracer because someone else's schedule has
   a dangling end, which is the category error decision 7 already avoided by shipping
   `path_continuous` as a stat *about the programme*. Decision 9's stated intent was the other
   thing — *"a false negative punches a hole in the chain"* — and that is a claim about a hole
   **we** introduce. So the clause reads *our traced chain is discontinuous on no file where
   P6's flagged chain is continuous*, and it stays the clause that bites: it is the only one a
   hole-punching tracer fails without a compensating gain anywhere else. Ours is continuous on
   47 of 67 files, P6's on 43, the two verdicts agree on 63, and **our-broken-where-P6-whole is
   0**.

3. **Staleness is detected, not excluded and not silently accepted — and it is not the failure
   mode.** There are **eight** stale runs in the set, not one: **22 of the 67 distinct files —
   22 of the 48 oracle files — carry a flagged set byte-identical to an earlier revision's at
   an earlier data date**, and the longest run is **nine consecutive revisions over eight
   months while 236 activities complete without one member changing**. **16 of those 22 score
   exactly 100%.** Staleness on its own costs nothing.

   And the set's one real failure is **not** the stale file. The 156-row run is five files
   (2017-12-01 to 2018-04-01, four months, 180 activities completed); the sixth file — A48, at
   **40.4%** — carries a **different** 156 rows, **5 added and 5 removed**. Its flag was
   recomputed, and it is the one that fails. This ticket's own framing and 044's are right
   about which file and wrong about why.

   **The test that reads only the file is out-of-sequence progress on the flagged chain:**
   count the relationships where a `TK_Complete` flagged row has a flagged predecessor that is
   **not** complete — an activity on P6's Longest Path that finished before the activity
   driving it did. Three columns (`driving_path_flag`, `status_code`, `TASKPRED`), no dates, no
   `clndr_data`, no second file. **`oosPairs == 0` ⟺ `recall == 100%`, on 48 of 48**: 37 files
   at zero all score 100%, and **all 47 missed rows in the set** sit on the 11 files with at
   least one (1 → 97.2–98.7%, 2 → 94.3–96.4%, 3 → 40.4%). The equivalent binary is
   connectivity — the flagged-and-remaining subgraph is one component on exactly those 37 files
   — which is the same fact said structurally. An out-of-sequence pair is a **fracture**: a
   remaining flagged activity whose only route back to the seed runs through a completed one,
   so decision 3's span cannot reach it by construction rather than by defect.

   **Nothing else in the file dates or licenses the flag**, and this is now enumerated rather
   than assumed. `PROJECT.last_tasksum_date`, `sum_data_date`, `last_baseline_update_date`,
   `apply_actuals_date` and `next_data_date` are **empty on all 67 files**; `last_recalc_date`
   is the data date and `add_date` is when the project was created. The one field that looked
   like it might license the flag does the opposite: **`SCHEDOPTIONS.sched_float_type` is
   `FT_FF` on 67 of 67** — critical defined by total float, never Longest Path — identically on
   the fresh files and the four-months-stale ones, while `enable_multiple_longest_path_calc` is
   `N` on 65 of 67 and [039](039-float-path-semantics.md) found `float_path` populated anyway.
   **A file's scheduler settings do not describe the run that wrote its marks.**

   `oosPairs` is reported per file beside the score and buys exactly one thing — the recall
   floor's carve-out in decision 5. It is deliberately **not** an exclusion, and the reason is
   the sharpest sentence in this ticket: **it predicts every recall loss in the set perfectly,
   so a gate that excluded on it would score 100% at 100% and could not fail.** That is the one
   property a ship gate may not have.

4. **A corpus, pooled over flagged rows — and the population is three programmes, not 48.**
   Clustering the 67 distinct files by task-code overlap gives **six programmes**, and the
   oracle is **46 revisions of one of them plus two single-shot programmes**. **98.3% of the
   oracle is one programme sampled 46 times.** So decision 9's *"one fixture, one contractor"*
   undercounts the files by 47 and is very nearly right about the evidence, and 044's
   correction — *67 distinct and several distinct programmes* — must not be read as widening
   what the gate proves. The effective n is **three**.

   Corpus rather than file, because one file is now an arbitrary choice among 48 and the two
   obvious picks give opposite answers. **Pooled rather than every-file**, because every-file
   hands the veto to the worst oracle in the set and the worst oracle is demonstrably the file
   whose flag no longer orders its own progress — every-file at 95/90 gives 46 of 48, at 90/90
   it gives 47 of 48. **Not a median**: 37 of 48 files sit at exactly 100%, so a median over
   them is 100% by construction and cannot fail — it is a formality, not a threshold. Two
   floors because pooling *can* hide one file: a 105-row file collapsing to zero costs the
   pooled recall three points and would still pass. The recall floor's carve-out leaves the
   file in the pooled numerator and denominator, where A48 costs **0.9 points**; it removes
   only its individual veto, and the predicate granting it is measured before the score and
   does not depend on our answer.

5. **The verdict, today.** Every clause, scored:

   | # | clause | today | |
   |---|---|---|---|
   | 1 | pooled **recall ≥ 95%** of the flagged rows that are not `TK_Complete` | **98.6%** — 3,400 of 3,447 | ✅ |
   | 2 | pooled **precision ≥ 90%** against every flagged row | **99.9%** — 3,400 of 3,402 | ✅ |
   | 3 | no file below **90% precision** | min **97.1%**; 47 of 48 at exactly 100% | ✅ |
   | 4 | no file below **90% recall** unless it carries an out-of-sequence flagged pair | 47 of 48 ≥ 94.3%; the 48th carries 3 | ✅ |
   | 5 | our chain **discontinuous on no file where P6's is continuous** | **0 of 48** | ✅ |
   | 6 | the synthetic corpus is green ([028](028-driving-test-relationship-types.md)'s precondition) | `--verify` 27/27 as 044 left it; [049](049-generator-milestone-instant.md) in flight | ⏳ |

   **Pass. `logic.longest_path` ships as a computed value with provenance `computed`** — which
   is the question [006](006-derived-json-contract.md) opened when it had to ship
   `state: "unavailable"` on a real file, and the thing 014 was filed to settle. The whole of
   decision 3's consequence list is now live: `activities.json`'s 14th field, `derived.json`'s
   `logic.longest_path`, decision 10's callout and filter chip.

   Two conditions on that verdict, neither a hedge. **What passed is the rule, not the
   implementation** — the product tracer is not written, and the gate must be re-run against it
   before ship, on this asset's numbers, with no re-litigating of the thresholds. And **clause
   6 is not this ticket's to close**: if `measure.mjs --verify` is not clean when 049 lands,
   clause 6 fails and nothing above rescues it.

### What this costs, stated plainly

- **The gate cannot argue against decision 3's span**, by construction — decision 1 above.
- **It is three programmes of one contract**, and pooling by file must never be quoted as
  though it were pooling by evidence.
- **Neither of decision 4's residues is measured in quantity**: 0.6% non-FS logic and 0.5%
  lagged relationships across the 67 distinct files, the same shape
  [036](036-recheck-lag-exposure-figures.md) fixed per revision. Both are Fixture-B-shaped,
  Fixture B's oracle is one flagged activity in 3,344, and 028 established there is no remedy.
  Unchanged and unimproved by anything here.
- **`truncated` is never exercised by a real file.** The 67 distinct files carry **zero**
  external relationships, so decision 5's `state: "ok", truncated: true` row and half of the
  continuity test are corpus-only shapes.

Decided AFK against numbers rather than taste under the map's delegation note. The thresholds
are unchanged from decision 9 and were not touched; what moved is which set the recall
denominator is, what continuity means, and whether the gate scores a file or a corpus. What
would reopen it is evidence rather than preference: **a real export from a second contract
whose flagged set is fresh and whose recall lands under 95%** — that would say the 98.6% is a
property of this contract rather than of the rule.

> **Answered 2026-08-08** by
> [Does a freshly-run Longest Path include completed activities?](053-longest-path-includes-complete.md).
> The fork this ticket declined to close is closed, from these same files and **without a licence** —
> the instrument was this ticket's own count, that the oracle is **46 revisions of one in-progress
> programme**. **P6's Longest Path runs back through completed work.** This ticket's stated cost is
> upgraded from concession to measurement: *"the gate says we agree with P6 about remaining work; it
> does not say P6's Longest Path and our longest path are the same object"* is now a fact about two
> **live** answers, and the 33.9-point gap between 65.6% and 98.6% is **span rather than staleness**.
> The staleness finding splits. Its measurements all reproduce — 22 of 48, eight runs cell for cell,
> `oosPairs == 0` ⟺ `recall == 100%` — and `oosPairs` gains an independent reading: the **whole**
> flagged set is one component on 48 of 48 while the flagged-remaining set is one on 37, so the
> completed rows are the connective tissue of the current chain on exactly those eleven files, which
> is a fact about P6's answer rather than a defect of ours. But the *inference* from byte-identity to
> a flag *written at an earlier data date* **loses its warrant**, because a chain that retains its
> completed members yields the same set at every data date and **the nine-revision run adds and
> removes not one activity and not one relationship while 236 activities complete**. The honest form
> is *byte-identical to an earlier revision's, and nothing in the file says whether that is an old
> mark or an unchanged answer* — which this ticket's own *16 of the 22 score exactly 100%* already
> leaned towards. Nothing decided here moves, and the `SCHEDOPTIONS` enumeration gains four fields
> (`sched_calendar_on_relationship_lag`, `sched_setplantoforecast`, `sched_open_critical_flag`,
> `sched_outer_depend_type`, all single-valued across 67) plus the two singletons that turned out to
> matter: `sched_progress_override = Y` and `sched_retained_logic = N`, both on the one file whose
> flagged set holds no completed row.
