# The ship gate, named and run to a verdict

Resolution asset for
[Which flagged set does the ship gate score against?](../050-ship-gate-flagged-set.md).

Measured 2026-08-08 against the real exports [001](../001-get-real-xer-files.md) secured —
**Fixture A**, 139 files — read in place, read-only. Node 24.18, WSL2. Client, contract and
file paths live only in the gitignored register; **everything here is a measurement**.

The rule under measurement is [014](../014-compute-critical-path.md) decision 3's span and
decision 4's driving test **as amended by [028](../028-driving-test-relationship-types.md)**,
transcribed from `traceReadable` / `makeReadableDrivers` onto the columns a real export
writes. It is transcribed rather than called: [049](../049-generator-milestone-instant.md) is
changing `lib/tables.mjs` and `lib/programme.mjs`, and every number below is read from the
**real files, which are stable**. The transcription is proved by reproducing
[044](../044-tracer-seed-tie-break.md)'s per-file table to the decimal on every shared column
— §7 beside [seed-tie-break.md §8](seed-tie-break.md) — from an independently written reader.

---

## The headline

**The gate scores against the flagged rows that are not `TK_Complete`, it runs over the
corpus rather than a file, and it passes: 98.6% recall at 99.9% precision, 47 missed rows in
3,447, 2 false positives in 3,402 marked, and no chain broken that P6 keeps whole on 48 of
48 files.** `logic.longest_path` ships as a computed value.

Three things fell out of running it that change what the gate is.

1. **The ambiguity was one-sided.** Precision is **99.9% under both readings**, because the
   walk marks no completed row by construction. Only the recall denominator ever moved.
2. **Staleness is not the failure mode.** 22 of the 48 oracle files carry a flag written at
   an earlier data date, and **16 of those 22 score exactly 100%**. What costs recall is a
   flagged chain that has gone **out of sequence**, and that is a three-column test on the
   file: `oosPairs == 0` ⟺ `recall == 100%`, on **48 of 48**.
3. **The population is not 48 programmes.** It is **46 revisions of one programme plus two
   single-shot programmes**, which is the first honest count of what decision 9's
   *"one fixture, one contractor"* is actually worth.

---

## 1. What was read

| | Fixture A |
|---|---|
| `.xer` files on disk | 139 |
| unreadable | 1 — the all-`NUL` file, [021](../021-verify-fixtures-in-p6.md)'s finding |
| **distinct by SHA-256** | **67** |
| P6 export versions | 6.0 × 127, 6.2 × 2, 7.0 × 4, 8.3 × 5 (all 138 readable) |
| multi-project (distinct `TASK.proj_id` > 1) | 0 |
| activities / relationships (distinct files) | 109,584 / 175,524 |
| relationship types | `PR_FS` 174,458, `PR_SS` 641, `PR_FF` 420, `PR_SF` 5 — **0.6% non-FS** |
| lagged relationships | 845 — **0.5%** |
| external relationships (predecessor not in the file) | 0 |
| **`driving_path_flag` on > 1 row — the oracle set** | **48** |
| `driving_path_flag` on exactly 1 row | 19 |
| `driving_path_flag` on 0 rows | 0 |
| flagged rows on the 48 | **5,180**, of which **1,733 `TK_Complete` (33.5%)** |

Every figure reproduces [044](../044-tracer-seed-tie-break.md) exactly, from a reader written
from [002](../002-xer-file-structure.md) rather than shared with it — name→index per table per
file, records running to the next `%T`/`%F`/`%R`/`%E`, CP1252.

## 2. Which set — and the ambiguity is one-sided

The two readings of *"recall ≥ 95% of P6's flagged set"*, pooled over the 48 oracle files:

| oracle | marked | correct | recall | precision | files clearing 95/90 |
|---|---|---|---|---|---|
| every flagged row (5,180) | 3,402 | 3,400 | **65.6%** | **99.9%** | 10 / 48 |
| flagged rows that are not `TK_Complete` (3,447) | 3,402 | 3,400 | **98.6%** | **99.9%** | 46 / 48 |
| *diagnostic:* span removed entirely | 5,249 | 5,152 | 99.5% | 98.2% | — |

**The two readings give the same precision, to the decimal, and the same correct count.**
`traceReadable` filters `TK_Complete` out of the candidate pool before it scores anything, so
the walk cannot mark a completed row; all 3,400 correct marks are remaining rows under either
reading. What decision 9 left unsaid was never a choice between two gates. It was a choice of
**recall denominator**, and 1,733 rows of it.

**Decided: the span-consistent reading — the flagged rows that are not `TK_Complete`.**

Decision 3 fixes the span at *remaining work as of the data date*, and everything downstream
already spends it: `logic.longest_path` reports *share of remaining activities*
([006](../006-derived-json-contract.md)), decision 3's boolean array is a statement about
remaining work, and decision 5's `state: "skip"` case is *"programme 100% complete, no
remaining work"*. A gate scored against a set the product does not claim to produce would fail
a tracer that is doing exactly what the contract says.

**What that costs, stated rather than assumed.** Scoring against the restricted set means the
gate **grades us against the part of P6's answer decision 3 elected to reproduce, and can
never argue against that election.** It is not a weaker version of the same test; it is a
different denominator, and a tracer that reproduced P6's whole answer would fail it in the
other direction. The counterfactual is measured rather than feared: run with the span removed,
**the same walk from the same seeds recovers 99.5% of every flagged row at 98.2% precision**.
So the 33.9-point gap is the span and nothing else, and there is no third explanation — a
broken tracer would fail both. That is what licenses the choice: the unrestricted score is
evidence about the *span*, which is a settled product decision, not evidence about the tracer.

The honest one-line summary the gate should carry: **the gate says we agree with P6 about
remaining work. It does not say P6's Longest Path and our longest path are the same object.**

## 3. Continuity, run for the first time — and it must be an agreement clause

Decision 9's third clause is *"the traced chain is continuous"*, and nothing had ever scored
it. `traceReadable`'s test is the one decision 7 defined: no cycles, not truncated, and every
chain tail **grounded** — `TK_Active`, or starting at or before the data date, or carrying a
completed predecessor.

| | all 67 distinct files | 48 oracle files |
|---|---|---|
| our traced chain continuous | 47 | **46** |
| P6's own flagged chain continuous, same test | 43 | 43 |
| the two verdicts agree | 63 | 45 |
| **our chain broken where P6's is whole** | **0** | **0** |

Read absolutely, the clause **fails two of the 48 oracle files**. Read as agreement, it passes
**48 of 48**. The two files it fails absolutely are both 100%-not-started programmes whose walk
terminates on activities with no predecessors starting 2,258 and 2,321 days after the data
date — and on both, our marked set is **identical to P6's flagged set, 100% recall at 100%
precision**. P6's own answer stops in exactly the same place.

So the absolute reading fails us for a hole in **someone else's schedule**, which is the
category error decision 7 already avoided by shipping `path_continuous` as a stat *about the
programme* rather than a check. Decision 9's stated intent was the other thing —
*"a false negative punches a hole in the chain and poisons `logic.path_continuous`"* — and
that is a claim about a hole **we** introduce.

**Decided: the clause becomes an agreement clause.** *On no file is our traced chain
discontinuous where P6's flagged chain is continuous.* It is measured on the oracle set, it is
the false-negative detector decision 9 asked for, and it passes 48 of 48 today. It also stays
the clause that bites: it is the only one of the three that a hole-punching tracer fails
without a compensating gain anywhere else.

## 4. Staleness — what is in the set, and the test that reads only the file

### 4.1 It is eight runs, not one

A file whose flagged set is byte-identical to an earlier revision's at an **earlier data date**
is carrying a Longest Path that some previous schedule run wrote. Over the 67 distinct files
there are eight such runs:

| flagged rows | files | data dates | months | activities completed across the run | `oosPairs` across the run | recall_rem across the run |
|---|---|---|---|---|---|---|
| 75 | 2 | 2 | 1 | 17 | 0 / 0 | 100 · 100 |
| 118 | 2 | 2 | 1 | 57 | 0 / 0 | 100 · 100 |
| 138 | 5 | 3 | 3 | 141 | 0 × 5 | 100 × 5 |
| 144 | 4 | 2 | 1 | 26 | 0 × 4 | 100 × 4 |
| 86 | 3 | 2 | 1 | 29 | 0 × 3 | 100 × 3 |
| 108 | 3 | 3 | 2 | 57 | 1 / 1 / 1 | 98.7 · 98.7 · 98.7 |
| **92** | **9** | **9** | **8** | **236** | **0 × 9** | **100 × 9** |
| 156 | 5 | 5 | 4 | 180 | 1 / 1 / 1 / 2 / 2 | 98.5 · 98.4 · 98.3 · 96.4 · 96.2 |

**22 of the 67 distinct files — 22 of the 48 oracle files — demonstrably carry a flag written
at an earlier data date.** 044 found one run of five; there are eight, and the longest is
**nine consecutive revisions over eight months while 236 activities complete without one
member of the flagged set changing**.

**And 16 of those 22 stale files score exactly 100%.** Staleness on its own costs nothing.

### 4.2 The set's one real failure is not the stale file

The 156-row run is five files, 2017-12-01 to 2018-04-01. The sixth file in that series — A48,
the set's only real failure at **40.4%** — carries a **different** 156 rows: **5 added and 5
removed**. Its flag was recomputed, or edited, and it is the one that fails.

So 044's *"the set's only real failure is the sixth file of that run"* is right about which
file and wrong about why. **Staleness is not the failure mode.** The failure mode is what
staleness eventually produces and what a fresh recomputation can produce on its own.

### 4.3 The test: out-of-sequence progress on the flagged chain

Count the relationships where **a `TK_Complete` flagged row has a flagged predecessor that is
not complete** — an activity on P6's Longest Path that finished before the activity driving it
did. Call it `oosPairs`. It reads `driving_path_flag`, `status_code` and `TASKPRED`: three
columns, no dates, no `clndr_data`, no second file.

| `oosPairs` | files | recall_rem | rows missed |
|---|---|---|---|
| **0** | **37** | **100% on every one** | **0** |
| 1 | 7 | 97.2 – 98.7% | 1–2 each |
| 2 | 3 | 94.3 – 96.4% | 2–4 each |
| 3 | 1 | **40.4%** | 31 |

**`oosPairs == 0` ⟺ `recall_rem == 100%`, on 48 of 48 files.** All **47** missed rows in the
whole set — 47 of 3,447 — sit on the 11 files with at least one. The equivalent binary is
connectivity: the flagged-and-remaining subgraph is one component on exactly those 37 files
and two or three on the other 11, which is the same fact said structurally. An out-of-sequence
pair is a **fracture**: a remaining flagged activity whose only route to the seed runs back
through a completed one, so decision 3's span cannot reach it, by construction rather than by
defect.

**Nothing else in the file dates or licenses the flag.** Every `PROJECT` and `SCHEDOPTIONS`
timestamp field was enumerated: `last_recalc_date` is the data date, `add_date` is when the
project was created, and `last_tasksum_date`, `sum_data_date`, `last_baseline_update_date`,
`apply_actuals_date` and `next_data_date` are **empty on all 67 files**. The one field that
looked like it might license the flag does the opposite: **`SCHEDOPTIONS.sched_float_type` is
`FT_FF` on 67 of 67** — critical defined by total float against the project finish, never
Longest Path — on the files where the flag is fresh and on the files where it is four months
stale alike. And `enable_multiple_longest_path_calc` is `N` on 65 of 67 while
[039](../039-float-path-semantics.md) found `float_path` populated. **The scheduler settings a
file carries do not describe the run that wrote its marks.**

**Decided: detected, not excluded and not silently accepted.** `oosPairs` is computed per file,
reported beside the score, and buys exactly one thing — see §5. It is **not** an exclusion, and
the reason is the strongest sentence here: **it predicts every recall loss in the set
perfectly, so a gate that excluded on it would score 100% at 100% and could not fail.** That is
the one property a ship gate may not have.

## 5. Population — the gate runs over the corpus, and the corpus is three programmes

Clustering the 67 distinct files by task-code overlap (Jaccard ≥ 0.5) gives **six programmes**,
and the oracle is not spread across them:

| programme | distinct files | with an oracle | activity counts | flagged rem | recall_rem | precision |
|---|---|---|---|---|---|---|
| the monthly series | 58 | **46** | 1,344 / 1,746 / 1,751 | 3,389 | 98.6% | 99.9% |
| a second programme | 5 | 1 | 853 – 1,186 | 28 | 100% | 100% |
| a third programme | 1 | 1 | 1,047 | 30 | 100% | 100% |
| three more | 3 | 0 | 543 / 835 / 918 | — | — | — |

**98.3% of the oracle is one programme sampled 46 times.** Decision 9's *"one fixture, one
contractor"* undercounts the files by 47 and is almost exactly right about the evidence: the
effective n for an accuracy claim is **three programmes**, not 48 files, and 044's correction —
*the 139 files are 67 distinct and several distinct programmes* — must not be read as widening
what the gate proves.

**Decided: corpus, pooled over flagged rows, with two floors.**

- **Corpus rather than file**, because a single file is now an arbitrary choice among 48 and
  the two obvious ones would give opposite answers.
- **Pooled (micro-averaged over flagged rows) rather than every-file**, because every-file
  hands the veto to the worst oracle in the set, and the worst oracle is demonstrably the file
  whose flag no longer orders its own progress. Every-file at 95/90 gives **46 of 48**; at
  90/90 it gives 47 of 48.
- **Not a median.** 37 of 48 files sit at exactly 100%, so a median over them is 100% by
  construction and cannot fail. It is not a threshold, it is a formality.
- **Two floors, because pooling can hide one file.** A 105-row file collapsing to zero costs
  the pooled recall three points and would still pass. So: no file below 90% precision,
  unconditionally; and no file below 90% recall **unless it carries an out-of-sequence flagged
  pair**. The carve-out is not an exclusion — the file stays in the pooled numerator and
  denominator, where A48 costs **0.9 points** of pooled recall — it only loses its individual
  veto, and the predicate that grants it is measured before the score and does not depend on
  our answer.

## 6. The gate, as it now reads, scored

| # | clause | today | |
|---|---|---|---|
| 1 | pooled **recall ≥ 95%** of the flagged rows that are not `TK_Complete` | **98.6%** — 3,400 of 3,447 | ✅ |
| 2 | pooled **precision ≥ 90%** against every flagged row | **99.9%** — 3,400 of 3,402 | ✅ |
| 3 | no file below **90% precision** | min **97.1%**; 47 of 48 at 100% | ✅ |
| 4 | no file below **90% recall** unless it carries an out-of-sequence flagged pair | 47 of 48 ≥ 94.3%; the 48th carries 3 | ✅ |
| 5 | our chain **discontinuous on no file where P6's is continuous** | **0 of 48** | ✅ |
| 6 | the synthetic corpus is green ([028](../028-driving-test-relationship-types.md)'s precondition) | `--verify` 27/27 as 044 left it; [049](../049-generator-milestone-instant.md) in flight | ⏳ |

**Verdict: pass.** `logic.longest_path` ships as a computed value with provenance `computed`,
and stops being usually-`unavailable` — which is the question
[006](../006-derived-json-contract.md) opened and 014 was filed to answer.

Two conditions on that verdict, neither of which is a hedge:

- **What passed is the rule, not the implementation.** The product tracer is not written. This
  is the same transcription discipline [031](../031-readable-walk-per-type.md) and 044 used —
  the rule reached independently from the bytes — and the gate must be re-run against the real
  tracer before ship, on this asset's numbers, with no re-litigating of the thresholds.
- **Clause 6 is not this ticket's to close.** 049 is changing the generator's milestone
  instant; if `measure.mjs --verify` is not clean when it lands, clause 6 fails and nothing
  above rescues it.

## 7. Per-file numbers

48 distinct Fixture A files carrying an oracle, ordered by remaining activities descending —
the same ordering and the same labels as
[seed-tie-break.md §8](seed-tie-break.md), so the two tables read side by side. `oos` is §4.3's
out-of-sequence flagged pairs; `comps rem` is the components of the flagged-remaining subgraph;
`hole` is clause 5 — our chain broken where P6's is whole.

| # | P6 | acts | remaining | flagged | complete | flagged rem | oos | comps rem | marked | missed | false pos | recall_all | recall_rem | precision | ours cont | P6 cont | hole |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A01 | 6.0 | 1746 | 1605 | 77 | 1 | 76 | 0 | 1 | 76 | 0 | 0 | 98.7 | 100 | 100 | yes | yes | no |
| A02 | 6.0 | 1746 | 1604 | 77 | 1 | 76 | 0 | 1 | 76 | 0 | 0 | 98.7 | 100 | 100 | yes | yes | no |
| A03 | 6.0 | 1751 | 1592 | 75 | 1 | 74 | 0 | 1 | 74 | 0 | 0 | 98.7 | 100 | 100 | yes | yes | no |
| A04 | 6.0 | 1751 | 1575 | 75 | 1 | 74 | 0 | 1 | 74 | 0 | 0 | 98.7 | 100 | 100 | yes | yes | no |
| A05 | 6.0 | 1751 | 1568 | 89 | 15 | 74 | 0 | 1 | 74 | 0 | 0 | 83.1 | 100 | 100 | yes | yes | no |
| A06 | 6.0 | 1751 | 1559 | 75 | 3 | 72 | 0 | 1 | 72 | 0 | 0 | 96.0 | 100 | 100 | yes | yes | no |
| A07 | 8.3 | 1751 | 1559 | 75 | 3 | 72 | 0 | 1 | 72 | 0 | 0 | 96.0 | 100 | 100 | yes | no | no |
| A08 | 8.3 | 1751 | 1559 | 75 | 3 | 72 | 0 | 1 | 72 | 0 | 0 | 96.0 | 100 | 100 | yes | yes | no |
| A09 | 6.0 | 1751 | 1548 | 70 | 0 | 70 | 0 | 1 | 70 | 0 | 0 | 100.0 | 100 | 100 | yes | yes | no |
| A10 | 6.0 | 1751 | 1547 | 82 | 10 | 72 | 1 | 2 | 70 | 2 | 0 | 85.4 | 97.2 | 100 | yes | yes | no |
| A11 | 6.0 | 1751 | 1514 | 87 | 17 | 70 | 2 | 3 | 68 | 4 | 2 | 75.9 | 94.3 | 97.1 | yes | yes | no |
| A12 | 6.0 | 1751 | 1490 | 118 | 13 | 105 | 0 | 1 | 105 | 0 | 0 | 89.0 | 100 | 100 | yes | yes | no |
| A13 | 6.0 | 1751 | 1433 | 118 | 13 | 105 | 0 | 1 | 105 | 0 | 0 | 89.0 | 100 | 100 | yes | yes | no |
| A14 | 6.0 | 1751 | 1406 | 138 | 60 | 78 | 0 | 1 | 78 | 0 | 0 | 56.5 | 100 | 100 | yes | yes | no |
| A15 | 6.0 | 1751 | 1406 | 138 | 60 | 78 | 0 | 1 | 78 | 0 | 0 | 56.5 | 100 | 100 | yes | no | no |
| A16 | 8.3 | 1751 | 1406 | 138 | 60 | 78 | 0 | 1 | 78 | 0 | 0 | 56.5 | 100 | 100 | yes | no | no |
| A17 | 6.0 | 1751 | 1378 | 137 | 60 | 77 | 0 | 1 | 77 | 0 | 0 | 56.2 | 100 | 100 | yes | yes | no |
| A18 | 6.0 | 1751 | 1378 | 137 | 60 | 77 | 0 | 1 | 77 | 0 | 0 | 56.2 | 100 | 100 | yes | yes | no |
| A19 | 6.0 | 1751 | 1290 | 138 | 60 | 78 | 0 | 1 | 78 | 0 | 0 | 56.5 | 100 | 100 | yes | yes | no |
| A20 | 6.0 | 1751 | 1265 | 138 | 60 | 78 | 0 | 1 | 78 | 0 | 0 | 56.5 | 100 | 100 | yes | yes | no |
| A21 | 6.0 | 1751 | 1229 | 144 | 67 | 77 | 0 | 1 | 77 | 0 | 0 | 53.5 | 100 | 100 | yes | yes | no |
| A22 | 6.0 | 1751 | 1203 | 144 | 67 | 77 | 0 | 1 | 77 | 0 | 0 | 53.5 | 100 | 100 | yes | yes | no |
| A23 | 6.0 | 1751 | 1197 | 144 | 67 | 77 | 0 | 1 | 77 | 0 | 0 | 53.5 | 100 | 100 | yes | yes | no |
| A24 | 6.0 | 1751 | 1197 | 144 | 67 | 77 | 0 | 1 | 77 | 0 | 0 | 53.5 | 100 | 100 | yes | yes | no |
| A25 | 6.0 | 1751 | 1147 | 86 | 11 | 75 | 0 | 1 | 75 | 0 | 0 | 87.2 | 100 | 100 | yes | yes | no |
| A26 | 6.0 | 1751 | 1132 | 86 | 11 | 75 | 0 | 1 | 75 | 0 | 0 | 87.2 | 100 | 100 | yes | yes | no |
| A27 | 6.0 | 1751 | 1118 | 86 | 11 | 75 | 0 | 1 | 75 | 0 | 0 | 87.2 | 100 | 100 | yes | yes | no |
| A28 | 6.0 | 1751 | 1084 | 143 | 69 | 74 | 0 | 1 | 74 | 0 | 0 | 51.7 | 100 | 100 | yes | yes | no |
| A29 | 7.0 | 1047 | 1047 | 30 | 0 | 30 | 0 | 1 | 30 | 0 | 0 | 100.0 | 100 | 100 | **no** | no | no |
| A30 | 6.0 | 1751 | 1047 | 108 | 30 | 78 | 1 | 2 | 77 | 1 | 0 | 71.3 | 98.7 | 100 | yes | yes | no |
| A31 | 6.0 | 1751 | 1029 | 108 | 31 | 77 | 1 | 2 | 76 | 1 | 0 | 70.4 | 98.7 | 100 | yes | yes | no |
| A32 | 6.0 | 1751 | 990 | 108 | 31 | 77 | 1 | 2 | 76 | 1 | 0 | 70.4 | 98.7 | 100 | yes | yes | no |
| A33 | 6.0 | 1751 | 959 | 92 | 19 | 73 | 0 | 1 | 73 | 0 | 0 | 79.3 | 100 | 100 | yes | yes | no |
| A34 | 6.0 | 1751 | 945 | 92 | 19 | 73 | 0 | 1 | 73 | 0 | 0 | 79.3 | 100 | 100 | yes | yes | no |
| A35 | 6.0 | 1751 | 923 | 92 | 19 | 73 | 0 | 1 | 73 | 0 | 0 | 79.3 | 100 | 100 | yes | yes | no |
| A36 | 6.0 | 1751 | 895 | 92 | 19 | 73 | 0 | 1 | 73 | 0 | 0 | 79.3 | 100 | 100 | yes | yes | no |
| A37 | 6.0 | 1751 | 854 | 92 | 20 | 72 | 0 | 1 | 72 | 0 | 0 | 78.3 | 100 | 100 | yes | yes | no |
| A38 | 6.0 | 853 | 853 | 28 | 0 | 28 | 0 | 1 | 28 | 0 | 0 | 100.0 | 100 | 100 | **no** | no | no |
| A39 | 6.0 | 1751 | 819 | 92 | 20 | 72 | 0 | 1 | 72 | 0 | 0 | 78.3 | 100 | 100 | yes | yes | no |
| A40 | 6.0 | 1751 | 792 | 92 | 20 | 72 | 0 | 1 | 72 | 0 | 0 | 78.3 | 100 | 100 | yes | yes | no |
| A41 | 6.0 | 1751 | 761 | 92 | 20 | 72 | 0 | 1 | 72 | 0 | 0 | 78.3 | 100 | 100 | yes | yes | no |
| A42 | 6.0 | 1751 | 723 | 92 | 24 | 68 | 0 | 1 | 68 | 0 | 0 | 73.9 | 100 | 100 | yes | yes | no |
| A43 | 6.0 | 1751 | 693 | 156 | 91 | 65 | 1 | 2 | 64 | 1 | 0 | 41.0 | 98.5 | 100 | yes | yes | no |
| A44 | 6.0 | 1751 | 650 | 156 | 94 | 62 | 1 | 2 | 61 | 1 | 0 | 39.1 | 98.4 | 100 | yes | yes | no |
| A45 | 6.0 | 1751 | 603 | 156 | 98 | 58 | 1 | 2 | 57 | 1 | 0 | 36.5 | 98.3 | 100 | yes | yes | no |
| A46 | 6.0 | 1751 | 552 | 156 | 100 | 56 | 2 | 3 | 54 | 2 | 0 | 34.6 | 96.4 | 100 | yes | yes | no |
| A47 | 6.0 | 1751 | 513 | 156 | 103 | 53 | 2 | 3 | 51 | 2 | 0 | 32.7 | 96.2 | 100 | yes | yes | no |
| A48 | 6.0 | 1751 | 471 | 156 | 104 | 52 | **3** | 3 | 21 | **31** | 0 | 13.5 | **40.4** | 100 | yes | yes | no |

`flagged`, `complete`, `flagged rem`, `marked`, `recall_all`, `recall_rem` and `precision`
reproduce [seed-tie-break.md §8](seed-tie-break.md) row for row. The `hole` column is `no` on
all 48, which is clause 5. The two `ours cont = no` rows are §3's not-started programmes, and
both agree with P6.

**Where the two false positives are.** Both are on A11, both are `TK_Active` rows, and they
are the whole of the set's precision loss — 2 marks in 3,402. Precision is exactly 100% on 47
of the 48 files.

---

## What this does not measure

- **Three programmes, one job.** §5 counts six programmes in the tree and three in the oracle.
  They are revisions and neighbours of one contract. The gate says we are not broken on this
  contract; it still does not say we are right, and 014 decision 9's caveat survives with a
  smaller number attached to it than its author expected.
- **Neither of decision 4's residues, in quantity.** 0.6% non-FS logic and 0.5% lagged
  relationships across the 67 distinct files — the same shape
  [036](../036-recheck-lag-exposure-figures.md) fixed per revision, now measured over the whole
  set. Both are Fixture-B-shaped, Fixture B's oracle is one flagged activity in 3,344, and
  [028](../028-driving-test-relationship-types.md) established there is no remedy. Unchanged
  and unimproved by anything here.
- **The oracle's provenance.** Every recall figure is agreement with a mark whose age the file
  does not state, on a set where 22 of 48 files demonstrably carry an old one. §4.3 detects the
  consequence, not the cause.
- **The product tracer.** What is proved is that the rule, transcribed onto the emitted
  columns, reproduces 044's table to the decimal and clears every clause in §6.
- **Zero external relationships in the whole set**, so `truncated` — decision 5's
  `state: "ok", truncated: true` case and half of the continuity test — is **never exercised
  by a real file**. It is a corpus-only shape.
