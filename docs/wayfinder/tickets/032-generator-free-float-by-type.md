---
id: 032
title: The generator computes free float with the FS formula for every relationship type
type: task
status: closed
assignee: carlo
blocked_by: [028, 031]
---

## Question

`tools/fixture-gen/lib/programme.mjs:405` computes free float as
`min(succ.es − t.ef − rel.lag)` clamped at zero, for **every** relationship type. That is
the FS formula. For SS the slack is `succ.es − t.es − lag`, for FF `succ.ef − t.ef − lag`,
for SF `succ.ef − t.es − lag`. Measured against a type-correct computation the emitted
`free_float_hr_cnt` is wrong on **8 of 429** corpus rows carrying float — five of them on
`logic-nonfs-drivers`, plus `enc-mojibake-0x81`, `multiproj-baseline-rows` and
`external-relationship`.

This is the same family of defect as the `tf <= 0` Longest Path flag
[022](022-generator-longest-path-and-landmines.md) fixed: a value computed by the wrong
rule, invisible because nothing read it. It is now read —
[014](014-compute-critical-path.md) decision 4 uses `free_float_hr_cnt == 0` as
corroboration, and [028](028-driving-test-relationship-types.md) had to record that the
corroboration is **untestable on this corpus** precisely because the clamp hides the error.

The work: compute the per-successor slack in the relationship's own frame, keep the clamp,
regenerate, and confirm which files change bytes (goldens carry `float_hr` counts, so
several assertions will move). Then re-run 028's third measurement — whether
`free_float_hr_cnt == 0` ever vetoes a correct non-FS driving relationship — which the
corpus currently cannot answer.

Note this cannot settle whether **P6** computes free float per type; that needs a file out
of P6 and belongs to [021](021-verify-fixtures-in-p6.md).

**Blocked on [031](031-readable-walk-per-type.md) for a mechanical reason rather than a
logical one:** both tickets edit `lib/programme.mjs` and regenerate the whole corpus, so
running them concurrently would have each overwrite the other's goldens.

### Folded in from 031 (2026-08-08): the landmine strings

031 found a stale sentence of the same species. `tools/fixture-gen/catalogue.mjs` describes
`logic-no-longest-path`'s landmine as *"25 activities have total float <= 0 and 7 are on the
Longest Path"*. The file's own golden says **19 and 4**, as do
[the corpus asset](assets/driving-path-corpus.md) and `fixtures/synthetic/README.md`. Because
`landmine` is copied into `<fixture>.expected.json`, the corpus ships a golden that
misdescribes itself — a statement nothing reads and therefore nothing checks, exactly like
the `tf <= 0` flag and the `mutate(tables)` goldens before it.

It is folded in here rather than given its own ticket because it regenerates the same corpus
and would otherwise have to be serialised behind this one anyway.

**Also do:** correct that string to the measured 19 and 4, and **sweep the other 23 landmine
strings for numbers that have drifted the same way** — this one was found by reading an asset
against a golden, not by any test, so there is no reason to think it is unique. Done when
every landmine string agrees with the golden it is written into.

## Resolution

**8 of 429, confirmed to the row before the fix and zero after — and the interesting
number is the other one: the clamp fired on 31 of 429 rows before and on 1 after.**
028's count reproduces exactly, same eight rows on the same four files
(`logic-nonfs-drivers` 5, `enc-mojibake-0x81`, `multiproj-baseline-rows`,
`external-relationship`). Free float is now the slack each successor leaves measured in
the frame its relationship constrains, clamped at zero as before. `measure.mjs --verify`
is **24/24**; the corpus driving-path aggregate does not move
(**163 / 160 / 157 — 96.3% recall at 98.1% precision, 19 of 24 exact**); `perf-20k` is
30,657,200 bytes and its `derived.json` is **15,854, byte-for-byte unchanged for the
fourth ticket running**.

Job 2's number is the one worth keeping: sweeping all 24 landmine strings against the
goldens they are written into, **exactly one was wrong — the one 031 had already found
by reading**. Twenty-three were right, including every figure that came from outside the
corpus.

### Job 1: the formula

```
PR_FS  succ.es − t.ef − lag      PR_FF  succ.ef − t.ef − lag
PR_SS  succ.es − t.es − lag      PR_SF  succ.ef − t.es − lag
```

minimised over successors, clamped at zero, `total_float` where there are none —
`lib/programme.mjs`, in `backwardPass` beside the existing per-type late-date
candidates, which had been type-correct all along. Free float was the one quantity in
that function still computed with one type's rule.

| | before | after |
|---|---|---|
| rows carrying float | 429 | 429 |
| wrong against a type-correct computation | **8** | **0** |
| clamp fires (min slack < 0) | **31** | **1** |
| rows emitting `free_float_hr_cnt = 0` | 296 | **289** |

Seven of the eight wrong rows were **spurious zeros** — the FS formula produced a
negative and the clamp made it look like the tightest possible float. The eighth,
`enc-mojibake-0x81 A001180`, was wrong without the clamp's help: 352 against a correct
360, an `SS` successor read as though it were `FS`. That split is the whole reason this
mattered: 014 decision 4 reads `free_float_hr_cnt == 0` as corroboration that a
relationship is driving, so seven of the eight errors were wrong **in the direction that
looks right**.

The one row still clamped is `logic-cycle A001190` at −672h, which is correct and
expected — that file's dates are deliberately incoherent because a cyclic network was
never successfully scheduled.

### The bytes that moved, and the twenty that did not

Unlike 031, this ticket writes an emitted column, so `.xer` bytes move — on exactly the
four files, and nowhere else.

| File | rows moved | bytes |
|---|---|---|
| `logic-nonfs-drivers` | 5 | 35,958 → 35,965 |
| `external-relationship` | 1 | 34,207 → 34,209 |
| `multiproj-baseline-rows` | 1 | 35,043 → 35,044 |
| `enc-mojibake-0x81` | 1 | 33,229 → 33,229 (`352` → `360`) |
| `sparse-150` (rendering, not corpus) | 1 of 69 | 246,647 → 246,648 |
| `perf-20k` (generated, not committed) | 44 of 7,171 | 30,657,187 → 30,657,200 |

**The other twenty corpus `.xer` files are byte-identical**, and every byte delta is
accounted for exactly by the digits of the changed numbers. Five goldens changed: four
for `free_float_hr_cnt` plus `logic-no-longest-path`, whose `.xer` is byte-identical and
whose golden moved only in the `landmine` string. No `driving_path` block moved on any
file, no `float_hr` assertion moved on any file — the ticket expected the latter, but
`float_hr` counts **total** float, which this does not touch.

### 028's third measurement, re-run

The question 028 could not answer — *does `free_float_hr_cnt == 0` ever veto a correct
non-FS driving relationship?* — is now answerable on this corpus, and the answer is
**no, on 142 in-file driving relationships of which 8 are non-FS (3 SS, 3 FF, 2 SF):
zero vetoes**.

| | 028 (FS formula) | now (per type) |
|---|---|---|
| as the driving test on its own | 96.9% recall, **73.5%** precision, 215 marked | 96.9% recall, **74.5%** precision, **212** marked |
| as a filter over the per-type walk | inert on all 24 files | **inert on all 24 files** |
| driving relationships whose predecessor carries free float 0 | all | **all** |

Row 1's headline reproduces **to the activity** when the harness is run against the
pre-fix formula — 163 truth, 215 marked, 158 in common — which is the check that it is
reading what 028 read. Two figures do not line up and neither is a disagreement: 028's
*exact on 3 of 24* scored all six fields where this scores membership alone (5 of 24),
and its *148 driving relationships, 139 FS / 4 SS / 3 FF / 2 SF* was counted over the
FS-only read walk that 031 has since replaced — the per-type walk marks **143: 135 FS,
3 SS, 3 FF, 2 SF**. What changed is that the second row now means something. But the
honest reading is stronger and less useful than "the corroboration works":

**On any acyclic file it cannot fail, by construction.** The forward pass sets each
activity's dates to the max over exactly these four per-type quantities, so every
relationship's type-correct slack is ≥ 0, the clamp never fires, and the minimum is zero
precisely when this activity's own dates set at least one successor's constraining date.
`free_float_hr_cnt == 0` and *drives something* are therefore the same predicate inside
this generator. That is a fact about our CPM, not about P6's.

**So 014 decision 4's scoping does not move, and this ticket does not ask it to.** 028
scoped the corroboration to FS — never promoting, and never demoting a non-FS candidate
— until [021](021-verify-fixtures-in-p6.md) can say how P6 computes free float on non-FS
logic. That scoping was never about our generator's arithmetic; it was about not
punching a hole in the chain on the strength of a number P6 wrote by a rule nobody in
this repo has read. Fixing our own formula removes an artefact from the *evidence* and
supplies none of the missing evidence. **The product rule is unchanged.** What has
changed is that the corpus no longer carries a reason to distrust its own zeros.

### The corpus now reads the value it was writing

028's defect was invisible for a reason worth stating plainly: `free_float_hr_cnt` was
written into every golden's activity dump and **`measure.mjs --verify` never read it
back**. It checks `driving_path_flag` and `float_path` by name against the golden, and
it checks the float *null* count, and it walked straight past the column.

So the fixture this ticket adds is **no fixture at all** — one assertion in
`verifyCorpus`, reading `free_float_hr_cnt` back out of the emitted bytes by name and
comparing it to the golden. It earns its place on the same argument the flag check does,
and a new corpus file would not have: the corpus already contains the files that fail,
with the true answer beside them, and what was missing was a reader. Demonstrated by
running `--verify` with the pre-fix bytes against the corrected goldens:

```
FAIL enc-mojibake-0x81.xer        free_float_hr_cnt on 1 row(s), first A001180 [352] != golden [360]
FAIL external-relationship.xer    free_float_hr_cnt on 1 row(s), first A001110 [0] != golden [152]
FAIL logic-nonfs-drivers.xer      free_float_hr_cnt on 5 row(s), first A001050 [0] != golden [80]
FAIL multiproj-baseline-rows.xer  free_float_hr_cnt on 1 row(s), first A001020 [0] != golden [96]
20/24 corpus fixtures round-trip
```

A generator reverting to the FS formula now scores **20/24**, which is the free-float
counterpart of 031's *FS-only tracer 22/24* and completes the same pattern: the corpus
can fail the rule it was written against.

### Job 2: the landmine sweep

`logic-no-longest-path` said *"25 activities have total float <= 0 and 7 are on the
Longest Path"* against a golden saying **19 and 4**. Corrected.

Then all 24 strings were swept — every numeral in every `landmine` and `description`
extracted mechanically, so the sweep is exhaustive rather than impressionistic, and each
one settled against the golden it ships in or the asset it came from:

| Claim | Where | Verdict |
|---|---|---|
| 19 float-negative, 4 driving | `logic-no-longest-path` | **was 25 and 7 — fixed** |
| `0x81` present; Fixture B carries 31,485, Fixture A's baseline none | `enc-mojibake-0x81` | ok (2 in file; [storage-cost-model](assets/storage-cost-model.md)) |
| `0xA3` `0xA5` `0xD8` and the `0x80-0x9F` block | `enc-cp1252-currency` | ok (1, 1, 2, and 0x97/0x93/0x94 in the file) |
| `0x7F` layout, not structure; three calendar shapes | `cal-clndr-data` | ok (82 occurrences; multi-shift, working exception, VIEW) |
| seven tables differ in field order and membership | `ver-60-fieldset` | ok — exactly those seven, checked against `schema.mjs` |
| Oracle's 73-table list, `POBS` not in it | `unknown-table-and-enum` | ok ([xer-format](assets/xer-format.md)) |
| Fixture A runs 69% negative float | `float-negative` | ok ([derived-json-contract](assets/derived-json-contract.md)) |
| 1 of 3,344 flagged on Fixture B | `logic-no-longest-path` | ok |
| 38 non-FS relationships before this file; chain `FF FF SS FF FS FS SF+SF FS` | `logic-nonfs-drivers` | ok — 38 recomputed from the goldens, chain matches `members` and `branches` |
| `TASKPRED` rows pointing at 999001 / 90099 | `logic-external-driver` | ok — 6 rows, and `999001` is the only absent `pred_task_id` |
| decision numbers, `wbs_depth` 1, three `PROJECT` rows, `proj_id > 1`, 100% complete, DCMA 11/13/14 | eight files | ok |
| 1,751 / 3,344 / 20,000 / ~6 / ~14 | `perf-2k`, `perf-20k`, `perf-20k-dense` | ok |
| "the dense variant tests the **50 MB** cap" | `perf-20k-dense` | **wrong twice — fixed** |

**One wrong string in the 24**, and it is the one already found by reading. That is the
result: the species of defect is real but not endemic, and 031's discovery was not the
tip of anything.

The twenty-fifth is outside the brief and fixed anyway, because it is the same defect:
`perf-20k-dense` claims to test *"the 50 MB cap"*, which
[020](020-client-parse-budget.md) raised to **60 MB** and which the file does not reach
in any case — generated, it is **35,009,838 bytes** at 14.0 codes per activity against
`perf-20k`'s 6.0. Restated as what it actually measures. It ships in no golden, having
`dir: 'generated'`, so no test could have caught it either.

The generator README gains the rule this produced, in the same place and the same shape
as 022's *a `mutate` hook may bend rows, never logic*: **a number in a `landmine` string
must be a number its golden carries**, because the string is copied verbatim into the
golden and nothing compares the two.

### One thing found and filed rather than fixed

The lag/non-FS exposure table that 022's asset, 028's body and 014 decision 4 all carry
— *"lag limitation 8.8% of Fixture A, 0.3% of Fixture B"* — **reads its source's columns
the wrong way round.**
[The derived contract's DCMA table](assets/derived-json-contract.md) is headed
`| Fixture B tender | Fixture A update |` and its row 3 is `Lags | 8.8% | 0.3%`, so lags
are **8.8% of Fixture B and 0.3% of Fixture A**. The non-FS column in the same table is
read correctly (99.6% FS on A, 89.5% on B), and 022's own relationship counts confirm
it, so exactly one row is transposed.

It matters because it inverts an argument: 028 was filed on the two approximations
sitting on **opposite fixtures**, and if the lag figures swap they sit on the *same*
fixture — Fixture B carrying both 10.5% non-FS and 8.8% lags, Fixture A neither. That
does not change what 028 decided (the per-type rule is free and correct regardless) but
it does change the reason it was urgent, and it touches 014 decision 4's stated
limitation. Repairing it means amending closed reasoning in three places, which is a
ticket rather than a side-effect of a free-float fix. Filed as
[Recheck the lag and non-FS exposure figures against their source](036-recheck-lag-exposure-figures.md).

> **Confirmed 2026-08-08** by that ticket, which read the source table and found this
> reading of it right in every particular. The correction is applied in 014 decision 4,
> 022's body and asset, and 028's body. One thing this section did not anticipate: 014
> decision 4's closing claim that the lag limitation *"surfaces as oracle disagreement under
> decision 9 rather than hiding"* was load-bearing on the transposed figure and is withdrawn.

### What did not move

`driving_path`, `members`, `float_path`, `driving_path_flag`, every `float_hr` count,
every `why` entry, every recall and precision figure. The corpus aggregate recomputed
from the committed goldens is **163 driving / 160 read / 157 in common — 96.3% recall at
98.1% precision, 19 of 24 exact, 9 `why` entries across 5 files**, identical to 031.
`perf-20k`'s `derived.json` is 15,854 bytes, which is now the fourth ticket to leave
that figure untouched — free float is not one of the stats 006 carries.

Working recorded in place rather than in a new asset: the
[022 corpus asset](assets/driving-path-corpus.md) and the
[028 measurement asset](assets/driving-test-relationship-types.md) are both amended,
along with `fixtures/synthetic/README.md` and the generator README.
