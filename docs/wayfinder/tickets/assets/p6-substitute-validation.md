# Validating the fixtures without a P6 licence

Working notes for [Verify the synthetic fixtures import into P6](../021-verify-fixtures-in-p6.md).

No P6 licence is available to this effort, and the ticket was written on the assumption
that a licence is the only instrument that can answer it. That assumption is **half
right**. This note records what three substitute instruments could answer, what they
answered, and the residue that genuinely needs P6 and nothing else.

Nothing here identifies either fixture set beyond the names the public docs already use
(**Fixture A**, **Fixture B**). Activity codes are elided.

## The three instruments

| Instrument | What it is | What it can prove |
|---|---|---|
| **MPXJ 16.6.0** | An independent third-party implementation of the `.xer` format, ~20 years old, built by reading real P6 exports. Run headless on Temurin JDK 21, dev-harness only, never linked into the product | That a reader which has never seen our generator can recover our files, and that it recovers what the generator *intended* rather than what our own parser happens to read |
| **The 143 real exports** | The Fixture A and Fixture B sets — files P6 itself wrote | What P6 actually emits and what P6 actually computes. A real export **is** a P6 artifact; the ticket asked for one to be made, and 143 already exist |
| **A calendar-accurate working-hour function** | Written for this ticket from `clndr_data`, then validated against P6's own `total_float_hr_cnt` | That any arithmetic conclusion below is P6's arithmetic and not ours |

The third one matters most, and is why the free-float finding can be stated as a fact.
Total float is `workhours(early_start → late_start)` on the activity's own calendar, so
reproducing P6's published total float exactly is a test of the calendar model, the
exception handling, the shift maths and the epoch all at once. It reproduced
**every activity in all seven files sampled** — 1,559 / 1,029 / 1,406 / 3,344 / 3,343 /
3,332 / 3,334, zero mismatches. Only after that were the free-float formulas compared.

## 1. Every fixture reads cleanly under an independent implementation

All 24 corpus files, `sparse-150`, and all three perf fixtures — 28 files — read without
error. That includes every file built to be hostile: the logic cycle, the `0x81` mojibake,
the unknown table and unknown enum, the missing `CALENDAR` table, the missing `TASKPRED`
table, the external relationship, the multi-project file, and the 21,800-activity perf
file.

Against the **goldens** — what the generator intended, never what our parser reads —
20 of 24 corpus files agree exactly on `TASK+PROJWBS`, `TASKPRED`, `CALENDAR` and `RSRC`
row counts. All four disagreements are the fixture's own landmine firing:

| Fixture | Disagreement | Why it is the right answer |
|---|---|---|
| `external-relationship` | 31 relationships against 34 rows | Three point outside the file. MPXJ drops the unresolvable ones — independently the rule the corpus already asserts |
| `logic-external-driver` | 28 against 34 | Same cause, six relationships |
| `missing-calendar` | 1 calendar against 0 rows | MPXJ **invents** a default calendar where the file has no `CALENDAR` table. A difference in contract, not a defect: our rule is to report what was seen |
| `multiproj-two-proj-id` | 16 tasks against 27, 13 relationships against 34 | See below — the most useful result in this section |

### The multi-project result corroborates an existing decision

MPXJ's default `read()` on the two-project fixture returns **one project — 16 of 27
tasks — silently**, with no warning and no error. `readAll()` on the same bytes returns
both projects. So a mature, widely-used reader quietly discards half a multi-project file
by default.

[Upload and ingest pipeline](../011-upload-ingest-pipeline.md) **rejects** multi-project
files rather than degrading them, with the discriminator being distinct `TASK.proj_id`.
That decision was taken on our own reasoning; it now has third-party evidence that the
alternative — read it and hope — loses data without saying so.

### The real files as a control

Read of one Fixture A revision: 1,915 tasks (= 1,751 `TASK` + 164 `PROJWBS`), 2,825
relationships, 5 calendars, 15 resources, 3,061 assignments. Every figure matches the
register's name-mapped profile of the same file. The harness is measuring files, not
flattering itself.

## 2. Both "speculative" calendar shapes are real — and the golden's rule about them is wrong

The corpus flags three calendar shapes `speculative: true` because no real fixture was
thought to exercise them. Two of the three are in the real files, and were all along:

- **Multi-shift days — confirmed.** The common real shape is the lunch break:
  `s|08:00|f|12:00` and `s|13:00|f|17:00` as two shift children of one weekday. Present in
  Fixture A and Fixture B base calendars. Across the full 139-file set, **three-shift days
  also occur**, so the shape is not limited to two.
- **Exception *working* days — confirmed, and heavily used.** An exception node carrying
  shift children, exactly the shape the generator guessed:
  `(0||33(d|39633)((0||0(s|08:00|f|16:00)())))`. One Fixture A calendar carries a single
  one; a Fixture B six-day-week calendar carries **80**, on a weekly cadence — Sundays
  bought back as working days.
- **The `VIEW` node — confirmed.** `(0||VIEW(ShowTotal|N)())` appears in real base
  calendars.

So the generator's guesses were right. The rule written around them was not:

> **`0x7F` is structural inside `clndr_data`, not text** — [xer-format.md](xer-format.md)
> gotcha 4, repeated in the `cal-clndr-data` golden.

**This is false.** Real project calendars (`CA_Project`) contain **zero `0x7F` bytes** and
are still valid — the whole blob is one flat unindented string. Base calendars
(`CA_Base`) in the same file carry 34–352 of them, with indentation. Both parse to the
same tree. `0x7F` is **formatting, and only the parentheses carry structure.** A parser
that treats `0x7F` as a required separator reads real project calendars as a single
unparseable record.

Two further shapes the generator does not emit, found in the same place:

- **Shift attribute order is not fixed.** Base calendars emit `s|08:00|f|16:00`; project
  calendars in the same file emit `f|12:00|s|8:00` — **finish first**. Attributes must be
  read as a key-value bag, never by position. This is the `%F` header lesson one level
  down.
- **The hour is not zero-padded.** `s|8:00`, not `s|08:00`, on those same project
  calendars. Six of 24 time values in one real calendar are unpadded.

And one metadata trap: `day_hr_cnt` and `week_hr_cnt` are **empty on some real
calendars**, and where populated they can contradict the day pattern — a seven-day
eight-hour calendar declaring `week_hr_cnt=40`. Neither field can be trusted, and neither
can be derived from the other.

## 3. Free float is computed per relationship type, not with the FS formula throughout

The question [028](../028-driving-test-relationship-types.md) had to defer, because
nobody could say what P6 means by `free_float_hr_cnt` on a non-FS relationship.

Method: take activities whose successors are **exclusively one non-FS type**, so the two
candidate formulas give different answers, and compare both against what P6 published.

| Successor type | n | Matches per-type only | Matches FS-formula only | Both | Neither |
|---|---|---|---|---|---|
| `PR_SS` | 281 | **280** | **0** | 0 | 1 |
| `PR_FF` | 48 | **41** | **0** | 7 | 0 |

The FS formula matches **nothing** it does not trivially tie on. The gap is not marginal:
on a typical SS-linked activity P6 publishes a free float of 0 where the FS formula
demands −600 hours. P6 measures the successor's constrained end against the
predecessor's *corresponding* end — start against start for SS, finish against finish
for FF.

Two riders:

- **P6 floors free float at zero.** The single `neither` case computes −560 hours per-type
  and P6 publishes 0. So the rule is `max(0, per-type)`, and free float — unlike total
  float, which is heavily negative across Fixture A — is never negative.
- **`PR_SF` is untestable here.** The entire 143-file corpus contains **one** SF
  relationship, and its predecessor has other successors, so it cannot be isolated. SF
  remains unconfirmed by measurement, though by symmetry it is the start-against-finish
  case.

This retires the scope 028 put on 014 decision 4: `free_float_hr_cnt == 0` corroborates a
driving candidate **on every relationship type**, not FS only — provided the comparison is
made per type. Nothing in the corroboration needs to stay FS-scoped.

## 4. `float_path` exists in the wild, and the fixture's reading of it is half wrong

`logic-float-path` is speculative because no fixture carried P6's Multiple Float Paths
output. One Fixture A revision carries it: **1,570 of 1,751 activities**, 384 distinct
paths; 3,321 rows across the 139-file set.

- **Order semantics: confirmed.** Path 1's members carry `float_path_order` **1..79,
  contiguous**, exactly as the fixture assumes.
- **Membership semantics: refuted.** The fixture calls path 1 *"the driving chain"*. It is
  not. Path 1 is the **lowest-total-float** chain: its 79 members are 79 of the 86
  activities sitting at the file's minimum total float. The activities P6 flagged
  `driving_path_flag = Y` are a **disjoint set of 75**, whose total float runs −862 to
  −502 — nowhere near the minimum.

Path 1 and the Longest Path do not overlap by a single activity in this file. That is
[014](../014-compute-critical-path.md)'s central claim — a float-based mark is not the
driving path — appearing unprompted in real data, and it is a much stronger example than
the corpus's own `float_based_tracer` block, because here the two marks are not merely
different sizes but **share no members at all**.

## 5. Two robustness facts the corpus does not carry

- **Multi-line free text stays unobserved.** Zero data rows across all 139 real files
  contain an embedded newline, and zero rows have wrong `%F` arity. `text-multiline`
  remains a defensive fixture against a shape no real file has produced — which is worth
  keeping and worth labelling honestly.
- **One real file in 139 is 397,781 bytes of pure `NUL`.** A `.xer` in a tender folder,
  100% zero bytes, plausible sync corruption. It has the right extension, a wholly
  ordinary size, and would pass a size check. MPXJ's `read()` returns **`null`** for it —
  no exception, no message. A file that reads as "no error and no project" is a worse
  failure mode than a throw, and it is now named by both: `enc-zeroed-file` carries the
  shape and 011's reject 1 carries the rule ([040](../040-zeroed-xer-file.md)).

## What still needs P6 and nothing else

Everything above is evidence about **the format and P6's arithmetic**. None of it is
evidence about **P6's importer**, which enforces its own referential rules and can reject
a file every reader here accepts. The residue:

1. **Does P6's import wizard accept the fixtures**, and what does it say if not. MPXJ
   reading a file proves a competent reader can; it cannot prove Oracle's importer will.
2. **Import time for the ~30 MB perf fixture** — a number worth having in its own right.
3. **The v24/v25 `%F` field sets.** The real corpus is P6 6.0 and 8.3 only. Current P6 is
   version 25 and its drift has never been observed in a file, only read about in Oracle's
   guides.

Items 1 and 2 need a licence. Item 3 needs a licence *or* one modern export from anybody
who has one.

## Reproducing

Harness lives in the session scratchpad, not the repo — it needs a JDK, MPXJ and the real
files, none of which CI can ever have. The parts worth keeping are the working-hour
function and the free-float comparison; if they are wanted as a permanent instrument they
should be rebuilt against the corpus rather than the real files.

> **Amended 2026-08-08** by [045](../045-duration-working-days-calendar.md). The sweep that confirmed
> the three calendar shapes in §2 also passed over a **fourth real serialisation nobody catalogued**:
> a stock elapsed-duration `CA_Project` calendar, present in 10 of the 14 files measured, seven days
> of one shift each written `f|00:00|s|00:00`, declaring `day_hr_cnt = 24` and `week_hr_cnt = 168`.
> No activity in any real file is assigned to one. What it means is
> [048](../048-elapsed-calendar-semantics.md).
