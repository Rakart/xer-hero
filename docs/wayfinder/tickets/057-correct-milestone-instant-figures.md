---
id: 057
title: 044's milestone-instant figures are measured over a selector that is not a milestone test
type: task
status: closed
assignee: carlo
blocked_by: []
---

## Question

**96.4% of 28,695 milestone rows at gap 0, against 54.1% of 77,853 non-milestone rows one shift
later** appears in [044](044-tracer-seed-tie-break.md), its
[asset](assets/seed-tie-break.md), [049](049-generator-milestone-instant.md),
[014](014-compute-critical-path.md) decision 3's amendment, and the map — five places.

[054](054-ff-milestone-guard.md) found the population is selected by
`early_start_date == early_end_date` with no status restriction, and that **26,325 of Fixture A's
105,028 `TT_Task` rows** satisfy it — 26,307 of them `TK_Complete`, because a completed activity has
no remaining span. So roughly 26,000 of the 28,695 are completed tasks and the figure is **not a
milestone-versus-task comparison**.

Restricted to rows P6 types as milestones, live, with live predecessors, it is **55.9% of 2,279 at
gap 0 against 9.3% one shift later**. Split by kind it is **`TT_FinMile` 98.3%** against **`TT_Mile`
46.4%** and `TT_Task` 44.6% (Fixture A; Fixture B 100% / 1.3% / 0.0%).

**The conclusion and 049's change both survive** — `TT_FinMile` is the row the asymmetry was always
about, and it is the outlier under either measurement. So this is
[036](036-recheck-lag-exposure-figures.md)'s exercise exactly: one number read one way, propagated to
five places, corrected in place with a dated note beside each, **no code and no regeneration**.

**Do:**

1. Correct the figure in all five places, each with a dated note rather than a silent edit — 036's
   own pattern, and 003's rule that repo history is the audit trail.
2. Settle whether the map's 044 entry should carry the **split** figure (`TT_FinMile` against
   `TT_Mile` against `TT_Task`) rather than the pooled one. The split is the finding; the pooled
   number now says less than it appears to.
3. State the selector rule where it will be seen again: **`early_start_date == early_end_date` is not
   a milestone test on a progressed programme**, `task_type` is. It disagrees with `task_type` on 18
   of the 81,848 live rows a walk can reach, and on 26,325 rows overall — so it is safe where 031 and
   049 use it and unsafe as a population filter.

## Resolution

**Corrected in four files, and the map's three occurrences are returned as data for the
integrating session. The figure the map carries is the split — `TT_FinMile` 98.3% against
`TT_Mile` 46.4% against `TT_Task` 44.6% — and the pooled number is not carried forward at
all.** No code, no regeneration, no `.xer` byte moved, as filed.

**Every figure was re-measured from the source rather than copied from
[054](054-ff-milestone-guard.md).** `tools/` has nothing that can do this — `fixture-gen` reads
the synthetic corpus, not the real exports — so the check was a throwaway reader written for
this ticket, the **fourth** independently written one in this effort, run read-only over the
same file set. It reproduces both the wrong figures and the right ones exactly:

| | measured here | as recorded |
|---|---|---|
| 044's selector, gap 0 | 27,655 of 28,695 = **96.4%** | 96.4% ✓ |
| 044's selector, other rows at (8, 16] | 42,141 of 77,853 = **54.1%** | 54.1% ✓ |
| `TT_FinMile` at gap 0 of the two | 1,107 / (1,107 + 19) = **98.3%**, n = 1,879 | 98.3% ✓ |
| `TT_Mile` | 166 / (166 + 192) = **46.4%**, n = 400 | 46.4% ✓ |
| `TT_Task` | 33,457 / (33,457 + 41,596) = **44.6%**, n = 75,518 | 44.6% ✓ |
| Fixture B | **100% / 1.3% / 0.0%** | 100% / 1.3% / 0.0% ✓ |
| `ES == EF` `TT_Task` rows | **26,325** of 105,028 (25.1%), **26,307** `TK_Complete` | 26,325 / 26,307 ✓ |
| live disagreement with `task_type` | **18** of **81,848**, 0 the other way | 18 / 81,848 ✓ |
| pooled typed live milestones | 1,273 of 2,279 = **55.9%** at gap 0, **9.3%** one shift later | 55.9% / 9.3% ✓ |

67 distinct Fixture A files by SHA-256 and 4 Fixture B, 109,584 / 175,524 and 13,353 / 23,581 —
which reproduces 044's and 054's file-set counts to the row before any of the above is read. So
the correction is a **relabelling of a correct measurement**, proved to be one, and not a
different measurement.

### Item 1 — the four files, and what changed in each

Each correction is a dated note beside the wrong figure quoting the old text verbatim, which is
[036](036-recheck-lag-exposure-figures.md)'s pattern and
[003](003-licensing-attribution-takedown.md)'s rule that repo history is the audit trail.

- **[044](044-tracer-seed-tie-break.md)** — the Resolution headline now states the split, with a
  note that governs every occurrence in the ticket, including the one inside 049's *Spent* note.
- **[the asset](assets/seed-tie-break.md)** — §4's two column headers were the load-bearing
  error (*"milestone rows"* / *"non-milestone rows"*) and are relabelled to what they select.
  The table's counts are untouched, because they are right. A **§4a** carries the `task_type`
  measurement in full for both fixtures, and the *found on the way* generator paragraph gets its
  own short note.
- **[049](049-generator-milestone-instant.md)** — Resolution headline restated on
  `TT_FinMile`, with a note governing the Question too.
- **[014](014-compute-critical-path.md)** — decision 3's *Measured by 044* amendment corrected;
  decision 4 gains the selector rule (item 3).

### Item 2 — the map carries the split, not the pooled figure

**Decided: the split.** Three reasons, in order of weight.

1. **The pooled figure repeats the error at a smaller scale.** 044's bucket was inhomogeneous
   in *status* — mostly completed tasks. The typed-live bucket is still inhomogeneous in
   *kind*: it pools a row at 98.3% with a row at 46.4%. Correcting the population and keeping
   the pool would fix the number and keep the mistake, and the resulting 55.9% would be
   quoted as *"milestones sit at their driver's finish about half the time"*, which is false of
   both kinds separately and true of neither.
2. **The split is what carries the argument, and the pooled number never did.** 044's
   no-tie-break decision and 049's change both rest on the `TT_FinMile` row alone. 98.3%
   against a task's 44.6% is the whole claim; 55.9% against 9.3% is a fact about a mixture.
3. **The split is the finding.** *A `TT_Mile` behaves like a task* is the thing this effort did
   not know before [054](054-ff-milestone-guard.md), it is why 028's floor is now keyed on
   `task_type`, and a map entry that pools it deletes it.

The pooled figure is recorded once in 044 and once in the asset, each time with the sentence
saying why it is not used. The map does not carry it.

### Item 3 — the selector rule lives on 014 decision 4

**Written as a standing rule under [014](014-compute-critical-path.md) decision 4**, beside the
floor whose precondition is the only place in the tracer's rule that asks whether a row is a
milestone. Three durable locations were candidates and two lose:

- **044 / 054 / 057 themselves** — a closed investigation is read once, when someone follows a
  link to check a number. A rule filed there is a rule that gets rediscovered rather than
  applied. That this is the *third* ticket to trip over the same selector is the evidence.
- **The map's Notes** — the map is an index and the skill's own rule is that a decision lives in
  exactly one place, its ticket. A rule in Notes would be a decision the map stores rather than
  points at, and this session may not write the map anyway.
- **014 decision 4** — wins. It is the decision that *uses* the property; it is what an
  implementer of the product tracer reads, and the tracer is not written yet, so the rule
  arrives before the code rather than after it; and it already carried half the statement from
  054's amendment, so the rule completes a paragraph instead of opening a new one.

The rule as written states both verdicts rather than one: **safe as a discriminator inside the
walk** (18 disagreements in 81,848 live rows, 0 in the other direction, because decision 3's
span has already dropped the contaminating population), and **unsafe as a population filter**
(26,325 of 105,028 `TT_Task` rows, 26,307 of them complete). A rule that only said *"do not use
it"* would be wrong — 031 and 049 use it correctly and neither moves.

### What is not corrected here, and why it is a new ticket

**The figure is in eleven documents, not five.** A sweep of `docs/`, `tools/` and `fixtures/`
for `96.4`, `28,695`, `54.1` and `77,853` in this sense finds **seven further occurrences
across six documents**, three of those documents outside `docs/wayfinder/` entirely:

- **`tools/fixture-gen/lib/calendar.mjs`**, the doc comment on `rowFinish` / `rowStart`. This
  is the sharpest one: it is the only place the figure is cited **as the reason for the code**,
  so the rule 049 implemented is annotated with a population that is mostly completed tasks.
  The code is right and its stated warrant is mis-scoped.
- **`fixtures/synthetic/README.md`** (twice) and **`tools/fixture-gen/README.md`** (once) — the
  corpus's own account of why a zero-duration row writes its finish where it does.
- **[028](028-driving-test-relationship-types.md)**'s *Confirmed by 044* note, which states the
  asymmetry as *task* against *milestone* in the ticket that owns the floor, and its
  **[asset](assets/driving-test-relationship-types.md)**'s equivalent line.
- **[052](052-end-of-day-shift-rule.md)**'s sequencing note, which cites *"044's 96.4% /
  54.1%"* as the evidence base forbidding a change to `finishAt`. The rule it protects is
  unaffected — a `TT_FinMile` at 98.3% forbids it just as firmly — but 052 is **open**.

[031](031-readable-walk-per-type.md) was checked and needs nothing: its milestone-guard note
already carries 054's corrected framing (18 of 81,848 live, 26,325 overall) rather than the
pooled figure.

**Surfaced for the integrating session to ticket** rather than swept in or numbered here: four
of the seven are comments beside code, which is a different review from a ticket correction and
touches `tools/` where this ticket is explicitly *no code*; and
[052](052-end-of-day-shift-rule.md) is **open** — correcting a figure inside a live ticket's
premise while another session may be resolving it is exactly the contention the map's
parallel-ticket note exists to avoid. A number is deliberately not allocated: this session was
scoped to five places, and ticket ids are allocated by the integrating session so concurrent
sessions never collide on one.

**One small thing found on the way**, filed nowhere because it changes nothing: 054's §6 table
and §4a here both omit **30 live `TT_Rsrc` rows** in Fixture A's gap population. They take the
column's own kind under 054's `writtenKind` rule, so the rule is complete and only the
descriptive tables are three-valued where `task_type` is not. §4a says so.
