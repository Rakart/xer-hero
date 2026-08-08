# The `PR_FF` milestone exclusion, measured and sourced

Resolution asset for
[028's `FF` milestone guard has lost its reason](../054-ff-milestone-guard.md).

Measured 2026-08-08 against the real exports [001](../001-get-real-xer-files.md) secured —
**Fixture A** (139 files) and **Fixture B** (4 files) — read in place, read-only, and against the
committed corpus as [049](../049-generator-milestone-instant.md) left it. Node 24.18, WSL2.
Client, contract and file paths live only in the gitignored register; **everything here is a
measurement**. Oracle documentation is cited by title and URL.

The rule under measurement is the floor
[028](../028-driving-test-relationship-types.md) added to
[014](../014-compute-critical-path.md) decision 4, as
[031](../031-readable-walk-per-type.md) implemented it in `makeReadableDrivers`:

> Drop a candidate whose demand is strictly earlier than its reference, where the two are the
> same kind of instant and the lag is zero — excluding a `PR_FF` pair in which exactly one row
> is a milestone (`early_start_date == early_end_date`), because *a milestone writes its finish
> as a start instant*.

---

## The headline

**The exclusion is not merely unjustified, it is inverted.** It excludes the one `FF`/milestone
shape whose comparison is exact and lets through the one whose comparison is not, and the
property it keys on is not a milestone test on a real programme.

Three findings, in order of weight:

1. **Every real instance is the exact case.** Across Fixture A's 67 distinct files, **124** of
   the 420 `PR_FF` relationships have a milestone on exactly one side, and **124 of 124 are an
   `FF` into a `TT_FinMile`** — a finish instant against a finish instant, which is like-for-like
   by 049's own correction. The exclusion declines to judge all of them. **Not one** `PR_FF` in
   either set touches a `TT_Mile` — the case where the successor's written finish really is a
   start instant, and the only shape the clause would have been right about.

2. **`early_start_date == early_end_date` is not a milestone test.** It matches **26,325
   `TT_Task` rows** in Fixture A — 25.1% of all task rows — of which 26,307 are `TK_Complete`.
   A completed activity has no remaining span, so P6 collapses its early dates to a point. The
   discriminator is a *zero-remaining-span* test wearing a milestone's name.

3. **The oracle cannot adjudicate, and says so at n = 143.** On the 48 Fixture A files carrying
   a usable `driving_path_flag`, **not one of the 143 `PR_FF` relationships touches a flagged
   row on either side** — nor does one of the 386 `PR_SS`. P6's Longest Path in this file set is
   100% `FS` logic.

And the reason the ticket named as the only candidate that could survive 049 — P6's own
`FF`-into-a-milestone semantics — **is not documented by Oracle for P6 at all**. The nearest
Oracle text is a validation rule for a *different product*, and it points the other way.

---

## 1. What was read

| | Fixture A | Fixture B |
|---|---|---|
| `.xer` files on disk | 139 | 4 |
| unreadable | 1 — the all-`NUL` file ([021](../021-verify-fixtures-in-p6.md)) | 0 |
| **distinct by SHA-256** | **67** | 4 |
| activities / relationships | 109,584 / 175,524 | 13,353 / 23,581 |
| `PR_FS` / `PR_SS` / `PR_FF` / `PR_SF` | 174,458 / 641 / **420** / 5 | 21,135 / 2,297 / **145** / 4 |
| `driving_path_flag` on > 1 row | 48 | 1 |

Fields were read by mapping each table's `%F` names to indices per table per file
([002](../002-xer-file-structure.md)); a record runs to the next line beginning
`%T`/`%F`/`%R`/`%E`, because a text value may contain newlines
([044](../044-tracer-seed-tie-break.md)).

**The transcription is proved rather than asserted.** The relationship counts reproduce
[044](../044-tracer-seed-tie-break.md)'s to the row (174,458 / 641 / 420 / 5 in 175,524), and
running the walk — 014 decision 3's seed rule and decision 4's rule as 028 amended it — over
the 48 oracle files reproduces 044's scoring **to the decimal**: 102 seeds, 3,402 marked,
3,400 correct, **98.6% recall at 99.9% precision**. Anything below that disagrees with 044 on
purpose, not by accident.

---

## 2. Where the exclusion fires on real programmes — and what it does

`PR_FF` is **0.24%** of Fixture A's relationships and **0.62%** of Fixture B's, but it is not
confined to a corner: 66 of Fixture A's 67 files carry at least one.

| | Fixture A | Fixture B |
|---|---|---|
| `PR_FF` | 420 (329 zero-lag, 91 lagged) | 145 (58 zero-lag, 87 lagged) |
| files carrying one | 66 / 67 | 4 / 4 |
| exactly one `ES == EF` side | **124** | 15 |
| — of those, **into** a milestone | **124** | 8 |
| — of those, **out of** a milestone | **0** | 7 |
| both sides `ES == EF` | 13 | 0 |
| zero-lag, so the floor could reach them | 123 | 14 |
| **the floor would drop, and the clause rescues** | **117**, on **62 files** | **10**, on **4 files** |

So the clause is emphatically **not inert on real data**. It is live on 62 of 67 Fixture A
files and rescues 117 candidates the floor had already judged.

**What it rescues is dead weight.** The slack on a rescued candidate — how far its demand sits
below the successor's own finish:

| | min | median | max |
|---|---|---|---|
| Fixture A (117) | **170.4 h** | **936 h** | 5,376 h |
| Fixture B (10) | 360 h | 3,336 h | 16,992 h |

The nearest rescued candidate anywhere in Fixture A demands a finish **seven working days**
below the finish it is supposed to have set. The median is thirty-nine.

**And it changes no answer.** The 117 rescues land on **62 successors**, every one of which
carries between **11 and 46** live predecessors — a section-completion milestone with a wide
predecessor fan. On none of them is a rescued candidate the argmax, and on none does the pool
empty without it:

| | successors touched | sole live predecessor | rescued candidate is the argmax |
|---|---|---|---|
| Fixture A | 62 | **0** | **0** |
| Fixture B | 10 | **0** | **0** |

Scored end to end on the 48 oracle files, with the clause and without it:

| | seeds | marked | correct | recall | precision | files differing |
|---|---|---|---|---|---|---|
| clause kept (status quo) | 102 | 3,402 | 3,400 | 98.6% | 99.9% | — |
| clause dropped | 102 | 3,402 | 3,400 | 98.6% | 99.9% | **0 / 48** |

Identical to the decimal, which is the corpus result
([031](../031-readable-walk-per-type.md), [049](../049-generator-milestone-instant.md))
reproduced at 175,524-relationship scale. **This decision cannot be made on the score.**

---

## 3. The oracle is silent, and that is the finding

`driving_path_flag` is P6's Longest Path — an activity-level flag, per Oracle's own XER map
(§5). It adjudicates a relationship only by implication: if a successor is flagged and a
predecessor is not, that predecessor is not driving the flagged chain.

Over the 48 Fixture A files with a usable oracle:

| `pred_type` | n | successor flagged | both endpoints flagged |
|---|---|---|---|
| `PR_FS` | 132,043 | 8,437 | 6,150 |
| `PR_SS` | 386 | **0** | 0 |
| `PR_FF` | **143** | **0** | **0** |
| `PR_SF` | 0 | — | — |

**Not one `PR_FF` relationship on an oracle file touches a flagged row on either side.**
P6's Longest Path across these 48 programmes is `FS` logic end to end. 044 recorded that
*"non-FS logic is invisible here"* at 0.6% of relationships; this sharpens it from *rare* to
**absent**: the flag has never once been asked about an `FF`.

Across all 71 distinct files in both sets, exactly **two** `PR_FF` relationships touch a flagged
row at all, and neither can be read as evidence:

- one on a Fixture A file where **P6 flagged a single row** — which 044 established is the seed
  finish milestone on all 19 such files. Its `FF` predecessor carries **4,080 hours** of slack
  and no flag, which points the floor's way, but on a file where P6 flagged nothing else it
  carries no weight;
- one on Fixture B with a **−56 hour lead**, where the floor never applies at all, and on a file
  whose oracle is three flagged rows in 3,344.

**Stated as a non-finding:** the question *"does the excluded pair's behaviour agree with P6?"*
has no answer in this file set, and the reason is not sample size but structure — P6's own
answer never runs through an `FF`.

---

## 4. The property the clause keys on

031 chose `early_start_date == early_end_date` deliberately, as *"a reader-visible property of
the emitted row, not a model fact"*. On the corpus it is exactly that. On a progressed real
programme it is something else.

| Fixture A | rows |
|---|---|
| rows with both early dates and `ES == EF` | 30,169 |
| — typed `TT_FinMile` | 2,329 |
| — typed `TT_Mile` | 1,515 |
| — typed **`TT_Task`** | **26,325** |
| — of those `TT_Task` rows, `TK_Complete` | **26,307** |
| `TT_Task` rows with both early dates | 105,028 — so **25.1%** of them read as milestones |

A completed activity has zero remaining duration, so P6 writes its early start and early finish
at one instant. The discriminator is a zero-remaining-span test.

**Where the rule actually uses it, this is nearly harmless**, because the walk never evaluates a
completed row on either side — 014 decision 3's span drops them, and `driversOf` filters live
predecessors. Restricted to the live universe:

| | live rows with both early dates | `ES == EF` but not typed a milestone | typed a milestone but `ES != EF` |
|---|---|---|---|
| Fixture A | 81,848 | **18** | **0** |
| Fixture B | 13,353 | **0** | **0** |

Eighteen rows in eighty-two thousand, and never a miss in the other direction. So the
discriminator is sound where it is used and unsound as a general statement — which is worth
recording, because it is the fourth time this effort has found a value used one way and read
another.

---

## 5. What P6's own `FF`-into-a-milestone semantics turn out to be

The ticket named this as the one candidate reason that would survive 049. It does not survive,
and the way it fails is more useful than a plain absence.

### What Oracle documents about P6

**Milestones are zero-duration, and that is where the P6 text stops.** *"Start milestone
activity"*, Oracle Primavera P6 Professional Help v26 —
<https://docs.oracle.com/cd/G48902_01/client_help/en_US/start_milestone_activity.htm>:

> "A start milestone activity marks the beginning of a major stage in the project. Since a start
> milestone activity does not have a duration, it is sometimes referred to as a 'zero duration
> activity.' … When you create relationships to milestones, the default relationship type is
> finish-to-start."

`finish_milestone_activity.htm` is word-for-word parallel. That closing sentence is a **UI
default**, not a constraint.

**Both date columns are unconditional.** *"TASK - (Activities)"*, P6 EPPM XER Import/Export Data
Map Guide —
<https://docs.oracle.com/cd/E90748_01/English/Mapping_and_Schema/xer_import_export_data_map_project/97906.htm>
maps `early_start_date` → Early Start, `early_end_date` → Early Finish, `task_type` → Activity
Type, `driving_path_flag` → **Longest Path**, with no milestone note. *"Activity dates"*, P6
Professional Help —
<https://docs.oracle.com/cd/F51303_01/client_help/en_US/activity_dates.htm> — defines Early
Start and Early Finish for *"the activity"* with no carve-out.

**What Oracle never says, for P6:** that a Start Milestone has only a start date or a Finish
Milestone only a finish date; that a milestone's early start and early finish are equal; any
forward-pass formula at all, hence no `FF`-specific or zero-duration-specific arithmetic; any
silent coercion of a relationship type based on an endpoint's activity type; and any milestone
or `FF` special case in driving relationships or Longest Path. P6 does document that it *flags*
the problem — *"Milestones with invalid relationships … found to have invalid relationships
during the scheduling or leveling process"*
(<https://docs.oracle.com/cd/F74773_01/p6help/en/99350.htm>) — **and never publishes the
criterion**. The `About Relationships` page
(<https://docs.oracle.com/cd/F88966_01/English/User_Guides/p6_eppm_user/6616.htm>) does not
contain the word *milestone*.

The one Longest Path sentence that does bear on the floor is not about milestones at all —
*"About Critical Path Activities"*, P6 EPPM User Guide v26,
<https://docs.oracle.com/cd/G48897_01/English/User_Guides/p6_eppm_user/6623.htm>:

> "Longest path defines the sequence of driving activities that determine the project end date.
> … The longest path is broken when activities are no longer driven by relationships; that is,
> when activity dates are driven by constraints or resource leveling."

That is 028's *chain tail* in Oracle's own words, and it is the floor's warrant: an activity
whose pool empties is one P6 would also stop at.

### The rule that does exist, and which product it belongs to

Oracle publishes the exact restriction — in the **Oracle Primavera Cloud** error-message
reference, a *different product* from P6. PRM-003015125,
<https://docs.oracle.com/cd/E80480_01/English/admin/error_message_reference/PRM-003015125.htm>:

> "You cannot set a successor relationship to a Relationship Type of Start to Finish or Finish
> to Finish if the successor activity has a Type of **Start Milestone**."

and PRM-003015126,
<https://docs.oracle.com/cd/E80480_01/English/admin/error_message_reference/PRM-003015126.htm>:

> "You cannot set a predecessor relationship to a Relationship Type of Start to Finish or Start
> to Start if the predecessor activity has a Type of **Finish Milestone**."

**Read the shape of it.** Oracle bans `FF` into a *Start* Milestone and `SS` out of a *Finish*
Milestone. It does **not** ban `FF` into a Finish Milestone, and it does not ban `FF` out of a
Start Milestone. Those are precisely the pairs where the successor's `early_end_date` would
carry a **start** instant and the predecessor's `early_start_date` a **finish** one — the
cross-kind comparison. Oracle's own validation encodes the anchor-kind argument, and it
**exonerates every one of the 124 real relationships this clause declines to judge**.

Two Oracle Support notes are login-walled, so only their titles are evidence: Doc 2785386.1,
*"P6 Does Not Allow Creation of Invalid Relationships for Start and Finish Milestone Activities
in Versions 20.12.4 and 21.5 through 24.11"*, and Doc 2825376.1, *"Default Relationship Type to
Finish Milestone Successor is SF not FF in P6 Professional"*. A P6 24.12 What's New section
titled *"Milestone Activities Support All Relationship Types"* is search-indexed but every
direct fetch of the Oracle URL returned **404**, so it is recorded as an unverified lead and
nothing is quoted from it.

**What that means for us:** the 139 real exports are P6 6.0, 6.2, 7.0 and 8.3 — all *before* the
enforcement window — so their zero `FF`-into-a-`TT_Mile` count is planner behaviour rather than
tool enforcement, which makes the empirical result stronger, not weaker. It also means a future
upload from a 24.12+ producer could legitimately contain the shape.

### The non-finding, made checkable

A non-finding is only a finding if someone can re-run it. Thirteen searches returned no Oracle
P6 source for the point, among them: *"start milestone" "has only a start date"* (secondary
sources only — OnePager, Planning Planet, Eastwood Harris — no Oracle page carries the phrasing);
*P6 "zero duration" early start early finish same date* (no Oracle page states the two are equal);
*P6 "forward pass" "backward pass" "early finish" calculate CPM* (prose only, no formula);
*P6 milestone relationship restriction "cannot" successor predecessor "start milestone"*
(surfaces only the Primavera Cloud error pages and the login-walled support notes);
*primavera "driving relationship" definition P6 professional help* (**zero** Oracle results —
P6 has no help topic defining a driving relationship); and *P6 "what's new" 21.5 OR 20.12.4
milestone relationship validation* (no reachable release note).

Sixteen Oracle URLs were fetched and returned nothing usable: both support notes (login wall,
empty body); the 24.12 What's New page at five paths and four PDF paths (**all HTTP 404**,
despite being search-indexed) and its `web.archive.org` mirror (blocked); the P6 Professional
`activity_types.htm` index (no milestone detail); the XER data map's **`TASKPRED`** page, which
carries `pred_type` and `lag_hr_cnt` and no date or milestone content; two Web Services pages
that turn out to be Resource and ResourceAssignment rather than Activity fields; and the P6 Data
Dictionary, one enormous page that repeated fetches could not surface a milestone
relationship-type entry from.

Two named traps for anyone re-running this. Doc set `docs.oracle.com/cd/E80480_01/…` is **Oracle
Primavera Cloud, not P6** — it says so itself — and OPC contradicts its own error reference
elsewhere (*"Milestones Overview"*, <https://primavera.oraclecloud.com/help/en/user/283884.htm>:
*"Any activity can be designated as a milestone, or connected to a milestone, no matter its
relationship type"*). And the P6 Web Services `Relationship` view collapses both milestone types
into a single `'Milestone'` value
(<https://docs.oracle.com/cd/F12057_01/English/Integration_Documentation/p6_eppm_web_services_reference/42348.htm>),
which is the same conflation `early_start_date == early_end_date` makes and would hide the
distinction §6 measures.

---

## 6. The anchor kind each row actually writes, measured

The Oracle argument above says a `TT_FinMile` writes a **finish** instant into both date columns
and a `TT_Mile` writes a **start** instant into both. That is checkable against the file set,
using 044's device: for a row with at least one zero-lag `PR_FS` predecessor, take the minimum
`succ.early_start_date − pred.early_end_date`. A row whose written instant is a *finish* lands
at gap 0; a row whose written instant is a *start* is displaced by the non-working gap to
(8, 16] hours.

Restricted to live rows with live predecessors, so no completed row contaminates either side:

**Fixture A**

| row type | n | gap 0 | (8, 16] h | other | **at gap 0, of the two** |
|---|---|---|---|---|---|
| `TT_FinMile` | 1,879 | 1,107 (58.9%) | **19 (1.0%)** | 753 | **98.3%** |
| `TT_Mile` | 400 | 166 (41.5%) | **192 (48.0%)** | 42 | 46.4% |
| `TT_Task` | 75,518 | 33,457 (44.3%) | 41,596 (55.1%) | 465 | 44.6% |

**Fixture B**

| row type | n | gap 0 | (8, 16] h | other | **at gap 0, of the two** |
|---|---|---|---|---|---|
| `TT_FinMile` | 541 | 207 (38.3%) | **0 (0.0%)** | 334 | **100%** |
| `TT_Mile` | 80 | 1 (1.3%) | **79 (98.8%)** | 0 | 1.3% |
| `TT_Task` | 10,308 | 4 (0.0%) | 9,123 (88.5%) | 1,181 | 0.0% |

**A Start Milestone tracks the task distribution and a Finish Milestone is the outlier**, in both
programmes and by a wide margin: 46.4% against 44.6% in Fixture A, 1.3% against 0.0% in Fixture
B, while the `TT_FinMile` row sits at 98.3% and 100%. The *"other"* column is milestones whose
date is set by something that is not a zero-lag `FS` predecessor — a constraint, a lag, non-`FS`
logic — which is Oracle's *"longest path is broken … when activity dates are driven by
constraints"* showing up as a residual.

So the property that matters is `task_type`, not zero span, and it separates the two milestone
kinds that `early_start_date == early_end_date` conflates.

---

## 7. What replaces the clause, and what it costs

The floor's precondition is *"demand and reference are the same kind of instant"*. 028 evaluated
that from the relationship type alone and patched the milestone case with a row property. The
exact statement reads the **kind each column writes**:

```
writtenKind(row, column)
  task_type == 'TT_FinMile'  ->  'finish'    (both columns)
  task_type == 'TT_Mile'     ->  'start'     (both columns)
  otherwise                  ->  the column's own kind
```

and the floor's same-kind test becomes `writtenKind(pred, demandColumn) == writtenKind(succ,
referenceColumn)`. Spelled out, the floor applies to:

| | applies | because |
|---|---|---|
| `PR_SS`, neither row a `TT_FinMile` | yes | start against start |
| `PR_SS`, a `TT_FinMile` on one side | **no** | that row's `early_start_date` is a finish instant |
| `PR_FF`, neither row a `TT_Mile` | **yes** | finish against finish — including every milestone pair in both real sets |
| `PR_FF`, a `TT_Mile` on one side | **no** | that row's `early_end_date` is a start instant |
| `PR_FS`, `PR_SF` | no | cross-kind by construction, unchanged |

**On the real set this is identical to deleting the clause.** Every relationship the two rules
classify differently moves the same way:

| | `PR_FF` cross-kind → same-kind | `PR_FF` same-kind → cross-kind | `PR_SS` same-kind → cross-kind |
|---|---|---|---|
| Fixture A | **124** | **0** | **0** |
| Fixture B | **15** | **0** | **0** |

139 of 139 reclassifications go one way, and the two clauses the replacement adds — `FF` touching
a `TT_Mile`, `SS` touching a `TT_FinMile` — have **zero instances in 565 `PR_FF` and 2,938
`PR_SS` relationships**, which is exactly what Oracle's validation predicts.

**Cost.** One column lookup. `TASK.task_type` is already emitted and already parsed
([002](../002-xer-file-structure.md)'s `%F`-name mapping reads it; the generator writes it at
`lib/tables.mjs:301`), so 028's cost argument is unchanged: *"every quantity is a timestamp or an
hour count the parser already reads"*, plus one enum. No `clndr_data`, no working-time
arithmetic, no schema, no contract change, no backfill.

**What it buys on the score: nothing, today.** 48 oracle files, 3,402 marked, 3,400 correct,
98.6% / 99.9%, identical under all three rules. What it buys is that the floor's own
precondition becomes true, and that the effort stops carrying a sentence about the format that
is not one.

**What it costs elsewhere:**

- The committed corpus's single instance is the orientation that does not occur in real files.
  `external-relationship` carries `A001110` (`TT_FinMile`) `--FF-->` `A001150` (`TT_Task`), zero
  lag, 720 hours of slack — an `FF` **out of** a milestone, where Fixture A's 124 are all **into**
  one. Under the replacement the pair is finish-against-finish, the floor drops the candidate,
  and the goldens do not move: 031 and 049 both measured removing the clause and got
  byte-identical output, on an activity no walk reaches.
- 031's *"it stays because it is right"* and 049's *"the rule is 028's to change"* are both
  discharged. Nothing else in either ticket depends on it.

---

## 8. The fixture that would execute the branch

Neither branch is executable by the corpus as it stands, and — this is the point the corpus
could not have made on its own — **neither is executable by the 139 real exports either**. The
relationship shape is common; the *topology* that makes it decide anything is absent from both.

A rescued candidate only changes an answer when it wins the argmax of the surviving pool. Its
score is negative by construction, so it wins only when every other candidate is dropped or
worse — in practice, when it is the **sole live resolvable predecessor**. Measured: **0 of 72**
real successors carrying a rescued `FF` have one live predecessor; the counts run 11–46 in
Fixture A and 2–111 in Fixture B. That is why 117 live rescues across 62 files produce zero
disagreement, and it is why a fixture is required rather than a re-measurement.

### `logic-ff-milestone-floor` — one file, two activities under test

Following [022](../022-generator-longest-path-and-landmines.md)'s discipline: one landmine, no
`speculative`, and a shape a parser can get wrong.

**Half one — the floor must fire on an `FF` into a finish milestone.** An activity `M`, typed
`TT_FinMile`, sitting **on the driving chain and not at the seed**, whose finish is held later
than its logic by a constraint. `M` has exactly **one** live resolvable predecessor: a task `T`
via `PR_FF` at **zero lag**, with `T.early_end_date` strictly earlier than `M.early_end_date` —
four working days is enough and matches the real median's order of magnitude. Every other
predecessor of `M` is `TK_Complete`, which is the natural way a real programme arrives at a
one-candidate pool and keeps the fixture honest. Then:

- **clause dropped** — the pool empties, `M` is a chain tail held by its constraint, which is
  what the truth records and what Oracle's *"the longest path is broken … when activity dates are
  driven by constraints"* describes;
- **clause kept** — `T` is marked driving, and the walk continues back through `T`'s whole chain,
  inventing N members and a `why` entry.

The assertion is a **precision** difference in `members`, visible in `driving_path.members`
against `as_read_from_the_file.members`, and it fails any tracer that keeps the exclusion.

**Half two — the floor must decline on an `FF` touching a start milestone.** An activity `S`,
typed **`TT_Mile`**, on the driving chain, whose only live resolvable predecessor is a task `U`
via `PR_FF` at zero lag, positioned so that `U.early_end_date` is the **finish instant of the
working period immediately before** `S`'s written instant — the same working moment, written the
two different ways §6 measures. In elapsed time `U`'s demand is strictly below `S`'s reference,
so a floor that treats the pair as same-kind drops `U` and `S` becomes a **false chain tail**,
losing `U`'s branch. That is a false negative, the direction
[014](../014-compute-critical-path.md) decision 9's gate is asymmetric against, which makes this
the more valuable half.

**Its landmine string** is the one sentence the file is for: *a `TT_FinMile` writes a finish
instant into both of its date columns and a `TT_Mile` writes a start instant into both, so
`early_start_date == early_end_date` does not tell a tracer which comparison it is making.*

**What is engineered and what is evidenced, stated plainly.** The relationship shape of half one
is evidenced at **n = 117 across 62 real files** — a zero-lag `PR_FF` into a `TT_FinMile` whose
predecessor's finish sits strictly below. What is engineered is the *sole live predecessor*, the
same engineering [022](../022-generator-longest-path-and-landmines.md) applied to
`cal-flat-no-0x7f`'s dropped-seed branch and for the same reason: without it the fixture cannot
discriminate. Half two is engineered outright — **0 of 565** real `PR_FF` relationships touch a
`TT_Mile`, and the shape's admissibility rests on Oracle's own validation grammar (§5) rather
than on an observed row, with the P6 24.12 lead as the reason it may yet appear. That is a
weaker footing than half one and the fixture should say so where 049 would want it said.

`TT_Mile` needs no new generator machinery: the committed corpus already carries one, on
`logic-no-longest-path`.

---

## 9. What this asset does not measure

- **The tracer, as opposed to the walk.** The rule measured here is the corpus's readable walk
  transcribed onto the emitted columns, exactly as 044 did it. The product tracer is not written.
- **Whether P6 would agree.** §3 is the answer: on this file set the oracle never runs through an
  `FF`, so agreement with P6 on the `FF` branch is unmeasured and unmeasurable here, under either
  rule. Everything in §6 is about which *instant* a column carries, not about which predecessor
  P6 thinks is driving.
- **A second contract.** 014 decision 9's *"one contract, two real programmes"* caveat, as
  [050](../050-ship-gate-flagged-set.md) sharpened it to an effective n of three, applies to every
  number here.
- **Producer versions after 8.3.** All 139 files are P6 6.0/6.2/7.0/8.3. The one shape that would
  decide half two of the fixture is one that later P6 versions first forbade and then, on an
  unverified lead, permitted again.
