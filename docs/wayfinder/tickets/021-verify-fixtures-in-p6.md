---
id: 021
title: Verify the synthetic fixtures import into P6
type: task
status: closed
assignee: carlo
blocked_by: [012]
---

## Question

The synthetic fixtures from
[Get a large synthetic fixture for perf work](012-large-synthetic-fixture.md) have
**never been opened in P6**. No licence was available in the session that generated
them, and no free tool imports XER — it is a P6-to-P6 exchange format, and the third
party tools that exist parse it rather than import it, which our own harness already
does.

This is a HITL task for whoever has P6 in front of them. It is not a decision.

**Do:**

1. Import `fixtures/synthetic/corpus/ver-83-fieldset.xer` into P6. Record whether it
   imports, and verbatim what P6 says if it does not.
2. Import `fixtures/generated/perf-20k.xer` (generate it first:
   `node tools/fixture-gen/generate.mjs --only perf-20k`). Record import time as well
   as the verdict — a 30 MB import is a useful number in its own right.
3. If either fails, record the exact complaint. The likely candidates are a missing
   table P6 requires but the fixtures omit, a referential rule the generator does not
   honour, or a field P6 will not accept empty.
4. **Export a calendar out of P6 with a multi-shift day and an exception *working*
   day**, and compare its `clndr_data` against what `lib/calendar.mjs` invents. Those
   two shapes are the ones the format research could not settle by reading, and the
   corpus flags them `speculative: true`. This step is worth doing even if the imports
   all pass — it is the only way to confirm them.
5. If a newer P6 is available, export any programme from it and record the `%F` field
   sets. The fixtures cover 6.0 and 8.3; current P6 is version 25 and its drift has
   never been observed in a file.
6. **Added 2026-08-08 by [028](028-driving-test-relationship-types.md):** export a
   programme containing **SS, FF and SF logic** and record whether P6's
   `free_float_hr_cnt` is computed per relationship type or with the FS formula
   throughout. 014 decision 4 uses `free_float_hr_cnt == 0` as corroboration for the
   driving test, and 028 had to scope that corroboration to FS-only until this is known —
   it never demotes a non-FS candidate today, purely because nobody can say what P6 means
   by the number on a non-FS relationship.

**Then:** update `fixtures/synthetic/README.md` and the resolution of 012 with what was
found, and drop `speculative: true` from any golden the calendar export confirms.

**What this does not block.** The measurements in
[the fixture asset](assets/synthetic-fixtures.md) depend on file structure transcribed
from real exports, not on P6's willingness to import. The corpus works as a parser
regression net regardless. What fails without this is only the claim that a generated
file is a faithful *P6* artifact.

## Resolution

**Resolved 2026-08-08 without a licence, because the ticket's premise was wrong.** It
assumed P6 is the only instrument that can answer any of this. Three substitutes reach
most of it ([working notes](assets/p6-substitute-validation.md)): **MPXJ 16.6.0** as an
independent 20-year-old third-party reader; the **143 real exports**, which are P6
artifacts already and did not need making; and a **calendar-accurate working-hour
function** validated against P6's own `total_float_hr_cnt` — it reproduced every activity
in all seven files sampled, zero mismatches, which is what licenses the arithmetic below.

**Steps 1–3 — the imports.** All 24 corpus files, `sparse-150` and all three perf
fixtures read cleanly under MPXJ, including every hostile one (cycle, `0x81` mojibake,
unknown table and enum, missing `CALENDAR`, missing `TASKPRED`, external relationship,
multi-project, 21,800 activities). Against the goldens, **20 of 24 agree exactly**; all
four differences are the fixture's own landmine firing. The sharpest is
`multiproj-two-proj-id`: MPXJ's default read returns **one project — 16 of 27 tasks —
silently**, which is third-party evidence for
[011](011-upload-ingest-pipeline.md)'s decision to reject multi-project files rather than
degrade them. This is not proof P6's importer accepts the files; see *What is left* below.

**Step 4 — the calendar shapes. Both confirmed, and the rule around them corrected.**
Multi-shift days are real (the lunch break, `08:00–12:00` + `13:00–17:00`; three-shift
days occur too), exception *working* days are real and heavily used (80 in one Fixture B
calendar), and the `VIEW` node is real. The generator's guesses were right. What was wrong
is [002](002-xer-file-structure.md)'s gotcha 4: **`0x7F` is not structural.** Real
`CA_Project` calendars carry **zero** of them and parse fine — only the parentheses carry
structure. Two more real shapes the generator never emits: **shift attributes are
order-free** (`f|12:00|s|8:00` occurs) and **hours are not zero-padded** (`s|8:00`).
`day_hr_cnt`/`week_hr_cnt` are sometimes empty and can contradict the day pattern.

**Step 6 — free float. Per relationship type, not the FS formula.** On activities whose
successors are exclusively one non-FS type: `PR_SS` **280 of 281** match per-type and
**none** match FS-throughout; `PR_FF` 41 of 48 per-type, none FS-only. The gap is 600
hours on a typical case, not a rounding difference. P6 also **floors free float at zero**.
`PR_SF` stays unmeasured — the whole 143-file corpus contains one SF relationship and it
cannot be isolated. This retires [028](028-driving-test-relationship-types.md)'s FS-only
scope on [014](014-compute-critical-path.md) decision 4.

**Step 5 — not answered.** The real corpus is 6.0 and 8.3 only; no v24/v25 file exists to
read.

**Two findings the ticket did not ask for.** `float_path` is real (1,570 of 1,751 rows in
one revision) and `logic-float-path` is **half wrong**: order is contiguous 1..n as
assumed, but path 1 is the *lowest-total-float* chain and shares **no members at all**
with the 75 `driving_path_flag = Y` activities — 014's central claim turning up unprompted
in real data. And **one real file in 139 is 397,781 bytes of pure `NUL`**, which MPXJ reads
as `null` with no error at all.

**Goldens and README are deliberately untouched here.** Correcting them is mechanical work
on the generator, in the shape 028 already used for
[031](031-readable-walk-per-type.md)/[032](032-generator-free-float-by-type.md), and is
filed as [038](038-calendar-shapes-and-0x7f.md), [039](039-float-path-semantics.md) and
[040](040-zeroed-xer-file.md).

**What is left, and it does need a licence.** Whether Oracle's *importer* accepts these
files and what it says if not; the ~30 MB import time; and the v24/v25 field sets. A
reader accepting a file is not the importer accepting it. Filed as
[041](041-p6-importer-acceptance.md), which nothing else waits on.

> **Corrected 2026-08-08** by [Does the tracer seed where P6 seeds?](044-tracer-seed-tie-break.md).
> Step 5's *"the real corpus is 6.0 and 8.3 only"* is wrong: **6.2 and 7.0 are both present**, on 6
> files. It remains true that no v24/v25 file exists to read, so what the step actually owed is
> unchanged — but the drift this effort has been reasoning about is **four versions wide rather than
> two**, which makes the never-by-position rule better evidenced than it was.
