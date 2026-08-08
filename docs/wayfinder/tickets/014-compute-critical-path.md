---
id: 014
title: Do we compute the critical path ourselves?
type: grilling
status: closed
assignee: carlo
blocked_by: [006]
---

## Question

[The derived.json contract](006-derived-json-contract.md) had to ship `longest_path`
as `state: "unavailable"` on a real file, because `driving_path_flag` is set on **1
of 3,344 activities** in the Fixture B tender export against 138 in Fixture A. P6 only
populates Longest Path when the scheduler was run with that option enabled, and
planners routinely export without it.

So the single most interesting thing about a programme — what is actually driving
the end date — is absent from the file more often than not, and the contract
currently shrugs.

The alternative is to compute it: a forward and backward pass over the logic graph,
honouring calendars, producing early and late dates, total float and a driving path.
That is a CPM engine. It is not enormous, but it is the largest single piece of
computation in the ingest path and it has real failure modes.

Settle:

- **Do we compute at all, or accept the gap?** Accepting means the detail page
  sometimes says "this programme does not tell us its critical path", which is
  honest but weak on exactly the question planners care most about. Computing means
  owning a scheduling engine and every argument about whether our answer matches P6.
- **If we compute, do we trust our own numbers over the file's?** The file already
  carries `total_float_hr_cnt`, `early_start_date` and friends, computed by P6
  itself. Recomputing may disagree — because of calendar edge cases, retained-logic
  versus progress-override settings in `SCHEDOPTIONS`, or constraints we model
  differently. Which one is shown, and is the disagreement itself worth surfacing?
- **Calendars are the hard part.** Working-day arithmetic needs `clndr_data` decoded,
  and the format research flags multi-shift days and exception *working* days as
  unverified. A CPM pass that gets calendars wrong produces confidently wrong dates,
  which is worse than an honest gap.
- **Cycles.** A cyclic logic graph has no critical path. Detect, report as an
  `issues[]` entry, and degrade — but decide whether cycle detection becomes a
  quality check in its own right, since P6 itself will not export one that schedules.
- **Cost and placement.** Ingest-time (slows upload, cached forever) or lazily on
  first open (fast upload, one slow read). The lazy-recompute machinery from the
  derived contract already exists to support the second.
- **Does it unlock DCMA 12?** The critical path test — insert a 600-day delay,
  re-schedule, check the end date moves — is permanently skipped today precisely
  because we have no engine. An engine would make it computable, which is a real
  argument in favour.

If the answer is yes, this becomes schema-affecting: `derived.json` gains a computed
logic block with its own provenance flag, and the contract goes to v2.

## Resolution

**We compute, but we do not schedule.** A driving-path *tracer* reads the dates P6
already wrote and walks back from the project finish; there is no forward pass, no
backward pass, no calendar arithmetic and no scheduling engine. `longest_path` stops
being usually-unavailable, and the CPM engine this ticket was really asking about is
ruled out of scope.

The ticket framed the choice as compute-or-accept. Both horns were wrong, because the
gap was mis-stated: **we were never missing the critical path.** `critical_count`
already ships from `total_float_hr_cnt` against `PROJECT.critical_drtn_hr_cnt` — P6's
own numbers, no engine involved. What is missing when `driving_path_flag` is empty is
the **chain**: which activities are actually driving the finish, in what order. A chain
is reachable from dates that are already in the file. A re-schedule is not needed to
read it, only to second-guess it.

### The eleven decisions

1. **Trace, not re-schedule.** Walk P6's own dates. The CPM engine — forward/backward
   passes honouring calendars, constraints, retained-logic vs progress-override — is
   **out of scope for this effort**, not merely deferred. Its two strongest arguments
   both fail below: the accuracy argument (2) and DCMA 12 (7).

2. **The trace always runs; `driving_path_flag` is an oracle, not an output.** Where
   P6 populated the flag we do *not* defer to it — we compare against it. Two reasons.
   Comparability: 007's row and 009's facets exist to compare programmes, and a stat
   whose method flips depending on how the planner happened to export is not a
   comparison. And the harder one — **the flag is the only ground truth this project
   will ever have.** No P6 licence (see
   [Verify the synthetic fixtures import into P6](021-verify-fixtures-in-p6.md)), so
   Fixture A's 138 flagged activities are the sole way to test the tracer at all.
   Making the flag an output spends that; making it an oracle keeps it forever.
   Divergence lands as an `info` entry in `issues[]`. Provenance is always `computed`.

   Accepted cost, stated plainly: on a file where P6 gave an answer, we may publish a
   different one.

   > **Amended 2026-08-08** by [Does the tracer seed where P6 seeds?](044-tracer-seed-tie-break.md).
   > *"The flag is the only ground truth this project will ever have"* stands and needs two caveats
   > it has never carried. **It spans different work.** 1,733 of 5,180 flagged rows across 48 real
   > files (33.5%) are `TK_Complete`, and only 3 of the 48 flag none — so P6's Longest Path runs back
   > through completed work while decision 3's span stops at the data date, and the two sets are not
   > comparable without saying which is meant. **And it can be stale.** Five consecutive revisions of
   > one programme carry a byte-identical flagged set of 156 rows while the data date advances five
   > months and 180 more activities complete; the flag records the schedule run that wrote it, not
   > the schedule the file describes, and nothing in the file dates it. Making the flag an oracle
   > rather than an output is unaffected — an output would have inherited both problems silently.

   > **Settled 2026-08-08** by
   > [Does a freshly-run Longest Path include completed activities?](053-longest-path-includes-complete.md).
   > Of the two caveats 044 added, the first is **confirmed with a mechanism** and the second **loses
   > its evidence**, so this decision carries two caveats rather than the third
   > [050](050-ship-gate-flagged-set.md) anticipated. *It spans different work* stops being an
   > inference from 33.5%: **1,669 of the 1,733 flagged `TK_Complete` rows (96.3%) were already
   > complete when the run that wrote their flag ran**, only 62 (3.6%) are residue, and the flagged
   > set is one connected component on 48 of 48 files whose completed members are the sole route
   > between its remaining members on eleven. *It can be stale* is the half that weakens:
   > byte-identity across revisions was read as proof of an unrecomputed flag on the premise that a
   > fresh run's set must move as work completes, and **it need not** — a retained chain yields the
   > same set at every data date, and across the longest run **236 activities complete while not one
   > activity and not one relationship is added or removed**. Making the flag an oracle rather than an
   > output is unaffected either way.

3. **A set, not a chain — and the span is forced.** Decision 2 forces the definition to
   be *P6's* definition or the oracle test fails by construction, so the trace spans
   **remaining work as of the data date**, walked back from the latest remaining finish
   — which is what P6's Longest Path is. Shape follows: a **per-activity boolean**, the
   same shape as the flag it is validated against. An ordered chain was rejected on its
   own oracle — driving paths **branch**, P6's flag marks every branch, and an array of
   `task_code` cannot represent that. So the path-as-a-story is a client-side render
   from the set plus dates the client already holds, never a stored artifact.

   - `activities.json` gains a 14th field: a boolean array.
   - `derived.json` gains `logic.longest_path` as a real value — count, duration in
     days, share of remaining activities, provenance.

   > **Amended 2026-08-08** by
   > [The two walks can disagree about the seed, and `why` cannot say so](042-seed-divergence-unnamed.md).
   > This decision calls the span *forced* and names no approximation inside it. There is one, and it
   > is the **third** named residue of decision 4's timestamp-only stance — after lag as elapsed
   > hours and 028's mixed anchor kinds — and the only one that can move the whole answer rather than
   > one activity's drivers. *Latest remaining finish* is a working-time quantity and a file-reader
   > has only wall-clock instants. A zero-duration milestone writes its finish **as** a start instant
   > (`early_start_date == early_end_date`), so a finish milestone and the tasks that finish with it
   > are one working moment written two ways, and the reader ranks the milestone strictly later.
   > Where P6 seeds on the tie, we seed on the milestone alone, and every chain that reaches the
   > finish only through one of the tied tasks is lost — not approximated, **absent**. Measured on
   > the corpus: two of the 26 walkable fixtures have a tied seed set, both ties are
   > milestone-against-task, **both diverge**, and on one of them it costs four activities. The
   > repair is not available at this decision's price — telling the two apart needs to know that no
   > working time separates 16:00 and the next 08:00, which is the `clndr_data` arithmetic decision 4
   > exists to avoid — so it is stated rather than closed, exactly as 028 left its own residue. What
   > this changes here is only that the span was being read as exact and is not; decisions 2, 4 and 9
   > are untouched, and the corpus now names the seed as a fifth `why` cause so a disagreement about
   > it can never again present as a clean bill. Whether a tie-break exists that reads only the file
   > is [044](044-tracer-seed-tie-break.md).

   > **Measured 2026-08-08** by [Does the tracer seed where P6 seeds?](044-tracer-seed-tie-break.md).
   > The residue named above is real in the corpus and **absent from real exports**. Its physics
   > holds and its premise does not: P6 writes a finish milestone at **its driver's finish instant**,
   > not at the next working period's start — a `TT_FinMile` sits at gap 0 from its latest zero-lag
   > `PR_FS` predecessor's `early_end_date` on **98.3%** of the live rows that land at one of the two
   > instants (n = 1,879; Fixture B 100% of 541), against a `TT_Task`'s **44.6%** — and it is the
   > *task's start* that a non-working gap displaces. So the
   > milestone and the tasks that finish with it write the **same** `early_end_date` and the seed set
   > ties exactly: 47 of 67 distinct real files tie, **47 of 47 ties are mixed**, and the rule
   > already seeds on the whole tie. This decision's shape claim is confirmed and strengthened —
   > **all 67 files carry exactly one milestone row in their seed set and none seeds on a task
   > alone** — while its cost claim is withdrawn: P6's own seed is inside our seed set on **48 of 48
   > files with a usable oracle**, 0 seeds dropped, **0 activities lost**. The span is exact on every
   > real file measured, and the divergence the corpus carries is `lib/tables.mjs`'s milestone
   > instant rather than a property of the format — [049](049-generator-milestone-instant.md).

   > **Corrected 2026-08-08** by
   > [044's milestone-instant figures are measured over a selector that is not a milestone test](057-correct-milestone-instant-figures.md).
   > The amendment above read *"96.4% of 28,695 real milestone rows sit at gap 0 … against 0.8% one
   > shift later — and it is the task's start that a non-working gap displaces, 54.1% of 77,853
   > rows"*. Those are correct counts over the wrong population: 044 selected on
   > `early_start_date == early_end_date` with **no status restriction**, which admits **26,325 of
   > Fixture A's 105,028 `TT_Task` rows**, 26,307 of them `TK_Complete`. Restricted to rows P6
   > *types* as milestones, live, with live predecessors, the figure is **`TT_FinMile` 98.3%**
   > (n = 1,879) against **`TT_Mile` 46.4%** (n = 400) and `TT_Task` 44.6% (n = 75,518) — Fixture B
   > 100% / 1.3% / 0.0%. **Nothing else in this amendment moves**: the seed set still ties exactly,
   > 47 of 67 files still tie with 47 of 47 mixed, P6's own seed is still inside ours on 48 of 48,
   > and 0 activities are still lost. The direction of the asymmetry is confirmed and it is now
   > attributed to the one row type that carries it. The selector itself is ruled on under decision
   > 4 below.

   > **Closed 2026-08-08** by
   > [The generator writes a finish milestone where P6 does not](049-generator-milestone-instant.md).
   > The third residue 042 added to this decision, and 044 then found absent from every real export,
   > is now absent from **the corpus too** — so the seed is no longer a named approximation anywhere,
   > in the file or in the fixture, and the span is exact on both sides of the comparison. Decisions
   > 4 and 9 are untouched, and 042's amendment stays on the page as the record of what was believed.

   > **Corrected 2026-08-08** by
   > [Does a freshly-run Longest Path include completed activities?](053-longest-path-includes-complete.md).
   > This decision's closing clause — *"which is what P6's Longest Path is"* — is measured **false**.
   > P6's Longest Path runs back through completed work and terminates at the start of the programme:
   > across sixteen revisions whose flagged set is new to the corpus, the runs added **494 rows and
   > removed 416**, and **276 of the added (55.9%) were already `TK_Complete` in the revision exported
   > before the run**; the chain's tails are `TK_Complete` on **45 of 48 files** with the oldest
   > flagged finish **1,376 days** before the data date. The span itself is **untouched and better
   > founded** — it is a deliberate *restriction* of P6's answer rather than a reproduction of it, and
   > that is the right restriction: everything downstream spends remaining work
   > ([006](006-derived-json-contract.md)'s *share of remaining activities*, decision 5's `skip`
   > case), and a span reaching 3.8 years behind the data date would report a critical path most of
   > which is built. What changes is only that decision 2's oracle argument does not license the span;
   > the product contract does. [Working](assets/longest-path-completed.md).

4. **Ordering, not equality — this is what keeps calendars out.** The obvious driving
   test is `pred.EF + lag == succ.ES`, and it is the one that breaks: a zero-gap FS
   across a weekend is Fri 17:00 → Mon 08:00, which is not a date match. Deciding it
   needs `clndr_data` working-time arithmetic, and multi-shift days and exception
   *working* days are precisely the part
   [the format research](assets/xer-format.md) marks unverified. A tracer that gets
   that wrong produces confidently wrong dates — the failure mode this ticket named as
   worse than an honest gap.

   So the test compares rather than computes. Walking back from the latest remaining
   finish, the driving predecessors of an activity are those **maximising `EF + lag`**,
   ties all kept (branching, per decision 3), **corroborated by
   `free_float_hr_cnt == 0`** — free float that P6 computed *with* the right calendar.
   Ordering comparisons on timestamps need no working-time model; we borrow P6's
   calendar work instead of redoing it.

   Minimum-float — "the critical set is the longest path" — was rejected outright. It
   is the conflation `xer-format.md:224` exists to warn about.

   **Known limitation, deliberately kept visible:** lag is an hour count, and which
   calendar converts it is a `SCHEDOPTIONS` setting. The tracer treats it as elapsed
   hours, which is wrong across non-working time on a *lagged* relationship — 8.8% of
   Fixture B's relationships, 0.3% of Fixture A's.

   > **Corrected 2026-08-08** by
   > [Recheck the lag and non-FS exposure figures against their source](036-recheck-lag-exposure-figures.md).
   > This paragraph read *"8.8% of Fixture A's relationships, 0.3% of Fixture B's"* and
   > closed *"it surfaces as oracle disagreement under decision 9 rather than hiding."*
   > Both halves were wrong, and for one reason. The source is the DCMA table in
   > [the derived contract](assets/derived-json-contract.md), headed
   > `| # | Check | Fixture B tender | Fixture A update |`, whose row 3 is
   > `| 3 | Lags | **8.8%** ❌ | 0.3% ✅ |` — the columns were read transposed. Lagged
   > relationships are **8.8% of Fixture B and 0.3% of Fixture A**, which is about **eight
   > relationships in Fixture A's 2,825**. Decision 9's gate runs on Fixture A only, so this
   > residue does **not** surface there in measurable quantity; the closing sentence is
   > withdrawn rather than reworded. What does reach the gate is the wider form 028 found —
   > the same elapsed-vs-working error arriving on *zero-lag* mixed-anchor relationships,
   > which this percentage never counted.

   > **Amended 2026-08-08** by
   > [028's `FF` milestone guard has lost its reason](054-ff-milestone-guard.md). The same-kind
   > zero-lag floor 028 added keeps its `PR_SS` and `PR_FF` scope and **loses the `PR_FF` milestone
   > exclusion**, which was keyed on `early_start_date == early_end_date` — a property that matches
   > **26,325 `TT_Task` rows in Fixture A**, 26,307 of them `TK_Complete`, because a completed
   > activity has no remaining span. The precondition is now stated on `task_type`: a `TT_FinMile`
   > writes a **finish** instant into both date columns (98.3% of live rows land at their driver's
   > finish rather than one shift later, against 44.6% for tasks), a `TT_Mile` writes a **start**
   > (46.4%), and the floor applies only where demand and reference are the same written kind. One
   > enum lookup on a column already parsed, so this decision's calendar-free stance is untouched. It
   > changes no answer on the real set — 102 seeds, 3,402 marked, **98.6% recall at 99.9% precision,
   > identical to the decimal with the clause and without** — and it is taken on the rule rather than
   > on the number.

   **The selector rule (fixed 2026-08-08 by
   [057](057-correct-milestone-instant-figures.md), which is the third ticket to trip over it).**

   > **`early_start_date == early_end_date` is not a milestone test on a progressed programme.
   > `task_type` is.** It is a *zero-remaining-span* test, and on a real file most of what it
   > catches is completed work. Two uses, two verdicts:
   >
   > - **Safe as a discriminator inside the walk**, which is where 031 and 049 use it. Over the
   >   **81,848** live Fixture A rows a walk can reach it disagrees with `task_type` on **18**, and
   >   never in the other direction — 0 typed milestones with unequal early dates, in either fixture.
   >   Decision 3's span drops completed rows and `driversOf` filters live predecessors, so the
   >   contaminating population is gone before the test is ever evaluated.
   > - **Unsafe as a population filter**, which is what 044 used it for. Unrestricted it matches
   >   **26,325 of Fixture A's 105,028 `TT_Task` rows** — 25.1% — of which **26,307 are
   >   `TK_Complete`**, because a completed activity has no remaining span and P6 collapses its early
   >   dates to a point. Any measurement that *selects* a population with it is measuring completed
   >   tasks and calling them milestones.
   > - **And it conflates the two milestone kinds even where it is safe.** A `TT_FinMile` writes a
   >   **finish** instant into both date columns and a `TT_Mile` writes a **start** into both, so the
   >   selector cannot tell a tracer which comparison it is making. That is 054's finding, it is why
   >   the floor's precondition above is stated on `task_type`, and it is why the corrected
   >   milestone-instant figure has to be reported split (98.3% / 46.4% / 44.6%) rather than pooled.
   >
   > **Stated here rather than on 044, 054 or 057** because this is the decision that *uses* the
   > property — the floor's precondition is the only place in the rule that asks whether a row is a
   > milestone — and because a rule filed on a closed investigation is read once, while a rule on the
   > decision it constrains is read by everyone who implements the tracer. The product tracer is not
   > written yet; when it is, this is the paragraph that tells it which column to ask.

5. **Cycles are a finding, not just a failure.** P6 will not schedule a cyclic network,
   so a cyclic file is one that was never successfully scheduled — a fact about the
   programme, and on a broken file the most interesting thing on the page. The visited
   set needed for cycle detection is required by the walk anyway, so the count is free.
   `logic.cycle_count` ships as a bare stat with its members under 006's 50-exemplar
   cap. It is **not** a 15th DCMA check: 009 sorts on
   `checks_passed / checks_applicable`, and a check outside the 14-point standard makes
   that ratio incomparable with every published DCMA number.

   Degradation maps onto 006's existing vocabulary — no new states:

   | Case | `logic.longest_path` |
   |---|---|
   | Programme 100% complete, no remaining work | `state: "skip"` |
   | Never scheduled, remaining dates absent | `state: "unavailable"` + reason |
   | Chain reaches an external predecessor not in the file | `state: "ok"`, `truncated: true`, `info` issue |
   | Chain hits a logic loop | `state: "error"` + issue, **ingest still succeeds** |

6. **Ingest-time, and the shelf is untouched.** The tracer is an O(V+E) walk over
   ~20,000 activities and ~35,000 relationships, negligible beside the parse that just
   happened and against Hobby's 4 CPU-hr/mo Active-CPU meter; lazy-on-open would mean
   re-fetching and re-parsing `original.xer.gz` to save microseconds. **`card` gains
   nothing** — 007 fixed twelve facts in fixed slots and found that nothing in a row
   may flow, and more decisively: a `card` field is the one thing 006 forbids from
   being lazily recomputed, so putting decision 4's approximation there would freeze
   v1's accuracy into the shelf. Keeping it out means this feature **never incurs a
   backfill**.

7. **DCMA 12 stays `skip`, and it stops being an argument for the engine.** The 600-day
   delay test cannot be run without a scheduler. But what check 12 is *for* — whether a
   driving chain runs unbroken from the data date to the finish, rather than the finish
   being set by a constraint or a dangling end — is exactly what the trace answers. So
   `logic.path_continuous` ships as its own stat beside the scorecard, outside
   `checks_applicable`, on the same rule that kept `cycle_count` out. The engine's best
   remaining argument dies here: the informative part of 12 is reachable without one.

8. **Synthetic is the regression suite; Fixture A is the accuracy measurement.** 010
   made real fixtures gitignored **forever**, so the two halves cannot be merged:
   synthetic proves we handle the *shapes* and runs in CI forever; Fixture A proves the
   decision-4 approximation is *tolerable* and can only ever be run by hand. Neither
   substitutes for the other.

   **This surfaced a defect in the committed corpus.**
   `tools/fixture-gen/lib/tables.mjs:322` emits
   `driving_path_flag: … task.tf <= 0 ? 'Y' : ''` — Longest Path derived from float,
   the conflation decision 4 rejected. As it stands the corpus would **validate a
   float-based tracer and fail a correct one**. Carried by
   [Fix the generator's Longest Path flag and add tracer landmines](022-generator-longest-path-and-landmines.md).

9. **The ship gate, and it is asymmetric.** Ship only if, on Fixture A:
   **recall ≥ 95%** of P6's flagged set, **precision ≥ 90%**, and the traced chain is
   **continuous**. Below that, `logic.longest_path` stays `unavailable`, the tracer is
   v2 work, and the map's current position is unchanged.

   Asymmetric on purpose: a false negative punches a hole in the chain and poisons
   `logic.path_continuous`, while a false positive over-marks a near-critical activity
   on a file that already has 1,265 activities inside its 168-hour critical threshold.
   Continuity is the clause that actually bites — a path with a hole is not a path.

   **What the gate does not measure.** One fixture, one contractor, one calendar
   lineage, and — per the incidental finding in the format research — a stock US
   holiday calendar on a non-US contract. It tells us whether we are *broken*. It
   does not tell us we are *right*.

   > **Extended 2026-08-08** by
   > [Recheck the lag and non-FS exposure figures against their source](036-recheck-lag-exposure-figures.md).
   > The list is one item longer than it looks: with decision 4's lag figures corrected,
   > Fixture A carries **0.4% non-FS logic and 0.3% lagged relationships**, so it measures
   > neither of decision 4's two named approximations in quantity. Both are Fixture-B-shaped,
   > and Fixture B's oracle is one flagged activity in 3,344. The gate is unchanged — 028
   > examined the remedies and there are none — but it is a weaker instrument than 028
   > believed when it decided so.

   > **Run for the first time 2026-08-08** by
   > [Does the tracer seed where P6 seeds?](044-tracer-seed-tie-break.md), and it **does not say
   > which set it scores against**. *"Recall ≥ 95% of P6's flagged set"* read literally gives
   > **65.6% recall at 99.9% precision, 10 of 48 files clearing the gate**; read consistently with
   > decision 3's span — the flagged rows that are not `TK_Complete` — it gives **98.6% at 99.9%, 46
   > of 48**. The difference is 33.5% of the oracle being complete work, and a diagnostic run with
   > the span removed recovers **99.5% of every flagged row**, so the gap is the span and nothing
   > else. The thresholds are unchanged and the asymmetry is vindicated in passing: it is the clause
   > that kills the no-successor seed rule at 16.0% precision. Two of this decision's own stated
   > limits also move — the flag can be **stale** (five consecutive revisions carry a byte-identical
   > 156-row flagged set while 180 more activities complete), and *"one fixture, one contractor"* is
   > wrong about the set: the 139 files are **67 distinct and several distinct programmes**, so the
   > gate could run over a population rather than a file. Naming the set is
   > [050](050-ship-gate-flagged-set.md).

   > **Named and run to a verdict 2026-08-08** by
   > [Which flagged set does the ship gate score against?](050-ship-gate-flagged-set.md). The set is
   > **the flagged rows that are not `TK_Complete`** — decision 3's span — and this decision's
   > sentence is rewritten to say so:
   >
   > > **9. The ship gate, and it is asymmetric.** Ship only if, pooled over every real export
   > > carrying `driving_path_flag` on more than one row — 48 files today — the tracer reaches
   > > **≥ 95% of the flagged activities that are not `TK_Complete`**, which is decision 3's span and
   > > not P6's whole flagged set, at **≥ 90% precision** against every flagged row, **breaking no
   > > chain P6 keeps whole**. Two floors keep the pooling honest: no file below **90% precision**,
   > > and no file below **90% recall** unless it carries an **out-of-sequence flagged pair**. The
   > > synthetic corpus must be green (028). Below any of that, `logic.longest_path` stays
   > > `unavailable`, the tracer is v2 work, and the map's current position is unchanged.
   >
   > Three things running it revealed. **There were never two gates:** precision is **99.9% under
   > both readings, to the decimal**, because the walk drops `TK_Complete` from its candidate pool
   > and so cannot mark a completed row; the ambiguity was a recall denominator and 1,733 rows of it.
   > **The gate runs over a corpus and is pooled over flagged rows**, because every-file hands the
   > veto to the worst oracle and a median over 37 files at exactly 100% cannot fail. **Continuity
   > becomes an agreement clause**: read absolutely it fails 2 of 48 files on which our marked set is
   > *identical to P6's* and P6's own chain stops in the same place — decision 7's own category
   > error, a hole in someone else's schedule. Read as *our chain is discontinuous on no file where
   > P6's is continuous* it passes **48 of 48**, and it remains the clause that bites.
   >
   > **Verdict: pass** — 98.6% recall at 99.9% precision, 47 missed rows in 3,447, 2 false
   > positives — so **`logic.longest_path` ships as a computed value** and stops being
   > usually-`unavailable`, subject to the corpus being green when
   > [049](049-generator-milestone-instant.md) lands and to the product tracer re-running these
   > numbers. This decision's *"what the gate does not measure"* survives with a sharper number: the
   > 67 distinct files are **six programmes**, the oracle is **46 revisions of one plus two others**,
   > so *"one fixture, one contractor"* undercounts the files by 47 and is very nearly right about
   > the evidence — effective n is **three**.

10. **One provenance line, plus a filter chip.** The detail page's critical-path callout
    prints the value and the sentence *"computed by this site from the file's own dates
    — P6 did not export a Longest Path"*, keeping 008's existing longest-path-is-not-
    critical warning. The method — the ordering test, the lag limitation, the agreement
    figure — lives in the tracer's own doc in the repo, not on the page. What the page
    gains instead is a **`Longest path (N)` chip** on the activity table, using the same
    predicate mechanism every DCMA row click already uses, over the boolean decision 3
    put in `activities.json`. Under the no-warranty standing decision the obligation is
    to not overclaim; one sentence discharges it, and letting a sceptical planner filter
    to our answer and check it against their own file is worth more than a paragraph
    explaining why they should trust us.

11. **`float_path` / `float_path_order` is a second oracle.** P6's Multiple Float Paths
    output, found on `TASK` while charting this ticket. When populated, path 1 is the
    longest path *in sequence* — so unlike `driving_path_flag` it validates **ordering**,
    which nothing else can. Validation-time only: never an output, never a fallback
    source (that would reintroduce the per-file method flip decision 2 rejected), and
    never in the contract. Whether Fixture A populates it is **unmeasured** — a check to
    run, not a promise.

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
    > **What is corrected.** *"Path 1 is the longest path in sequence"* is wrong. Path 1 is
    > the **lowest-total-float chain**, and in the measured file it shared **no member at
    > all** with the 75 activities P6 flagged `driving_path_flag = Y`. So this oracle
    > validates **order and nothing else** — `float_path_order` runs 1..n contiguously along
    > a path, 1..79 there — and `float_path` **must not be read as membership of the driving
    > path**. It is the second oracle for ordering, which nothing else can supply, and it is
    > no oracle at all for membership.
    >
    > **What inverts.** This decision was written expecting a second oracle to *agree*. It
    > does not, and it should not: the two marks answer different questions, so **agreement
    > on membership is now evidence of a bug rather than of correctness.** A tracer whose
    > driving set matches `float_path = 1` has almost certainly reached for minimum float —
    > the conflation decision 4 rejected and `xer-format.md:224` exists to warn about — and
    > the corpus enforces it: `logic-float-path` was rebuilt so its path 1 and its flagged
    > set are **disjoint**, and a tracer that conflates them scores 0% recall at 0% precision
    > on that file.
    >
    > Nothing else in this ticket moves. Decision 2 (`driving_path_flag` as the oracle for
    > membership), decision 3 (a set, not a chain) and decision 9's gate are all unaffected —
    > decision 11 was never load-bearing for any of them, which is why this is a restatement
    > and not a re-opening.

### Consequences

- **`derived.json` → v2.** `logic.longest_path` becomes a value with provenance;
  `logic.cycle_count` and `logic.path_continuous` are added. Amendment on
  [The derived.json contract](006-derived-json-contract.md).
- **`activities.json` → v2.** One boolean array; the callout and the filter chip.
  Amendment on [The project detail page](008-project-detail-page.md).
- **Generator defect + five new landmines.** Amendment on
  [Get a large synthetic fixture for perf work](012-large-synthetic-fixture.md), work
  carried by [ticket 022](022-generator-longest-path-and-landmines.md).
- **007 is explicitly untouched.** No thirteenth fact, no `card` change, no backfill.
- **Zero schema demand.** `derived_version` already drives lazy recompute; nothing new
  in Postgres.
