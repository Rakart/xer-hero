---
id: 047
title: Report `duration_working_days` on the programme calendar
type: task
status: closed
assignee: carlo
blocked_by: []
---

## Question

[045](045-duration-working-days-calendar.md) fixed the shape and built nothing. This is the
mechanical follow-through, in the shape [038](038-calendar-shapes-and-0x7f.md) and
[043](043-calendar-golden-block.md) already used.

**Do:**

1. Rewrite `durationWorkingDays` in `tools/fixture-gen/measure.mjs` to 045's state table — programme
   calendar from the `PROJECT` row matching the activities' `proj_id`, span converted on its decoded
   week plus exceptions, `{ days, calendar, activity_share_pct }` or one of the four
   `unavailable`/`error` branches. Add `shape.calendars_in_use`. Note `multiproj-baseline-rows` has
   3 `PROJECT` rows and one `TASK.proj_id`, and `multiproj-two-proj-id` has 2 of each and is
   rejected upstream anyway. `HR = 8` and `HIGH_FLOAT_HR` stay as they are — nothing here changes
   DCMA 6/8.
2. Write the expected value into the golden **from the generator's model**, not from the emitted
   bytes — 043's rule. The corpus's own activity dates and `target_drtn_hr_cnt` are not
   calendar-consistent (6 of 19 disagree on `wbs-flat`), so the expected `days` must come from a
   calendar walk over the model's own window.
3. Invert `verifyCorpus`'s calendar assertion: empty `calendars` block ⇒ `unavailable` (unchanged),
   non-empty ⇒ a value matching the golden. That takes the check from 2 files to 27.
4. Add a fixture whose `PROJECT.clndr_id` names a calendar the file does not carry, so the second
   `unavailable` branch is tested rather than asserted.
5. Add a fixture in the **real** shape — every activity on one calendar, several calendars declared,
   one of them flagged `default_flag` and used by nothing. That is Fixture A's baseline and nothing
   in the corpus can reproduce it today. Keep the existing ten-and-ten split; it is the only thing
   exercising `activity_share_pct`.
6. Update `fixtures/synthetic/README.md`'s *The `calendars` block* closing paragraph, which is now
   false on 25 of 27 files, and the generator README beside 032's free-float paragraph.

Decide the day-versus-timestamp convention while you are here: a whole-day counter reproduces P6's
own duration arithmetic on **1,685 of 1,685** not-started activities in Fixture A's baseline and
**3,110 of 3,111** in Fixture B, and cannot see the part-day timestamps (`12:00`, `14:05`) Fixture
A's progressed revisions carry. At programme scale that is ±1 day on 2,595.

`catalogue.mjs`'s `missing-calendar` landmine still owes 038's correction — `day_hr_cnt` was never
the answer — and after this ticket that file is the *only* corpus file reporting `unavailable` for a
calendar reason, so the text is worth getting right here.

**Rebase note, added 2026-08-08 by the integrating session.** This ticket was written before
[049](049-generator-milestone-instant.md) landed and must take its span numbers from the
**post-049** goldens. 049 moved 370 date values across 23 files, and on every fixture ending in a
milestone the latest finish — which is what `time.finish_date` is taken from — moved **earlier by
one non-working gap**. Anything measured against the pre-049 corpus is off by up to a weekend.

## Resolution

**The field reports, on 25 of 29 files, and the corpus can now fail four separate ways of getting
it wrong — none of which it could fail this morning.** Read the programme calendar off
`default_flag` and two files fail; fall back to the first `CALENDAR` row when the named one is
absent and one fails; count the window exclusive of its finish and **25** fail; assume
`activity_share_pct` is 100 and **24** fail. `--verify` is **29/29** and **not one `.xer` byte
moved** — this ticket writes goldens, a reader and two new fixtures.

The mechanical half went as [043](043-calendar-golden-block.md) and
[038](038-calendar-shapes-and-0x7f.md) went. `durationWorkingDays` in `measure.mjs` is
[045](045-duration-working-days-calendar.md)'s state table: the calendar the `PROJECT` row
matching the activities' `proj_id` names, the window `time.start_date`..`time.finish_date` walked
over its decoded week plus exceptions, `{ days, calendar, activity_share_pct }` or one of four
`unavailable`/`error` branches. `shape.calendars_in_use` joins it as a bare scalar.
`HR = 8` and `HIGH_FLOAT_HR` are untouched and DCMA 6/8 does not move.

### The convention: whole days, both ends counted

Two questions were open and only one of them was the one the ticket named.

**Days, not timestamps.** The window is `time.start_date`..`time.finish_date` as *dates*, and a
day either works or it does not. The alternative — working-hour arithmetic between the earliest
start instant and the latest finish instant — has to divide by a day length to report days, and
that is the one operation [045](045-duration-working-days-calendar.md) §6 and
[048](048-elapsed-calendar-semantics.md) between them spent a ticket each keeping out of this
field. It also buys nothing available: this measurement is over `start_date` and `finish_date`,
which the contract has already truncated to dates before the field sees them, so the part-day
timestamps a day counter cannot see are not in scope for a *programme* span even where they are
for an activity duration. The cost is the one the ticket priced — ±1 day on a 2,595-day number on
a progressed revision — and it buys immunity from a division this estate has now twice decided it
does not want.

**Both ends counted, which is the question nobody asked and the one that turned out to matter.**
`days` counts the calendar dates in `[start_date, finish_date]` **inclusive**. That is P6's own
duration arithmetic — an activity that starts and finishes on one working day is one day, not
zero, which is what makes the whole-day counter reproduce `target_drtn_hr_cnt` on 1,685 of 1,685
rows in the first place — and it is the convention 043 and 045 both used without saying so:
`wbs-flat`'s seven-day answer is **460**, which is the inclusive count and is exactly the number
043 published. Reproduced here three ways that share no code — the generator's `Date` walk over
the packed week, `measure.mjs`'s day-serial walk over the decoded one, and a throwaway
`datetime` script — all three agreeing on **328 / 460** for `wbs-flat` and **80 / 110** for
`enc-cp1252-currency`, which are 043's two published rows unchanged by 049.

**So `span_calendar_days` and `duration_working_days` count the same window differently, and the
tile prints both.** `span_calendar_days` is a **difference** (`finish − start`); `days` is a
**count**. On a calendar that works every day the second is the first **plus one**, so 045's *"the
two numbers subtract"* and its `460 days · 328 working` sub-line are one apart from what
`derived.json` actually carries: the tile's calendar-day figure is `span_calendar_days + 1`.
Nothing here changes `span_calendar_days` — it is 006's field, it is shipped, and moving it is a
contract change rather than a build — but the page cannot print the two side by side until one of
them is chosen. Filed.

### What the corpus asserts now, and what it can fail

`verifyCorpus`'s calendar assertion inverted as asked. 043's rule was *an empty `calendars` block
must come with `unavailable`*, which is true of 2 files and says nothing about the other 25 — a
harness reporting `unavailable` everywhere passed it. The check is now the **value itself on every
file**: day count, calendar, and share, compared field by field against the golden. The negative
case keeps its own line rather than being folded in, because *assume eight hours where there is no
calendar* is the failure `missing-calendar` exists to catch whatever a golden happens to say.

Each rule was then removed in turn and the whole corpus re-verified, which is 043's own method:

| Wrong rule | corpus | which files, and what they report |
|---|---|---|
| corrected | **29/29** | — |
| programme calendar read off **`default_flag`** | **27/29** | `cal-default-unused` converts on a seven-day week and reports **213 days at `activity_share_pct: 0`** against a true **153 at 100** — a span converted on a calendar no activity is on, which is the exact failure 045 measured on a real file; `cal-project-clndr-absent` reports a value where there is none to report |
| absent `clndr_id` **falls back to the first `CALENDAR` row** | **28/29** | `cal-project-clndr-absent` reports **162 days** off a calendar the file never named |
| window counted **exclusive** of its finish | **4/29** | every one of the 25 files that report a value, each low by one working day |
| `activity_share_pct` **assumed 100** | **5/29** | 24 files. The only survivor is `cal-default-unused`, where 100 is the truth |

The first two fail on the two files this ticket adds, and that is the point rather than a
weakness — it is 038's `cal-flat-no-0x7f` finding for the third time. Before today
`PROJECT.clndr_id`, `default_flag` and *the first `CALENDAR` row* named calendar 6600 on **all 27**
corpus files, so no file could have told the three apart and any of them would have scored 27/27.

### The two fixtures

**`cal-default-unused`** (34,462 bytes) is item 5, and it is the first file here shaped like a
real programme: three calendars declared, all 20 activities on the five-day one `PROJECT.clndr_id`
names, and `default_flag = Y` on a seven-day calendar carrying **nothing**. That is Fixture A's
baseline — 3–5 `CALENDAR` rows, distinct `TASK.clndr_id` of 1, `default_flag` on a calendar
holding 0 of 1,746 activities — and nothing in the catalogue could reproduce it, because
`default_flag` was hard-wired to calendar 0 and the activities round-robinned. Two model options
sever it: `defaultFlagIdx` and `oneCalendar`. The corpus's ten-and-ten split stays everywhere else
exactly as the ticket instructed, and the mutation table above is why: it is the only thing that
catches an assumed share, on 24 files.

It pays once more without being asked. Its third `CALENDAR` row is a byte-identical project copy
of its first, so the corpus gets a **second `same_meaning_as` pair — and the only one with
`identical_bytes: true`**, where `cal-flat-no-0x7f`'s is the same meaning in *different* bytes.
Two rows that are the same calendar because they are the same string is the trivial half of that
claim and the corpus had never stated it.

**`cal-project-clndr-absent`** (33,400 bytes) is item 4: one mutated field, `PROJECT.clndr_id =
841`, which is the id 006's own worked example uses. The landmine is that **all three plausible
fallbacks are present and all three would produce a believable number** — `default_flag` names
6600, the first `CALENDAR` row is 6600, and half the activities are on 6600 — so the file fails a
harness that substitutes any of them and passes one that reports the id it could not find. Nothing
else about the file is wrong, which is the second half of the point: 011 does not reject on it and
006 does not fail ingest for it, so this is a shape that reaches the detail page. It also brought
the corpus a **third seed-tie shape** unasked: `A001160` and `A001190`, two ordinary
positive-duration tasks finishing at the same `2026-08-18 16:00`, where the corpus's other two
ties are a finish milestone against the task it finishes with. Both walks tie on it identically,
like the other two, and it is the tie no milestone rule can explain away.

### Corrections of fact

- **045's *"a value on 25 of 27"* was 24 of 27**, and the missing file is one 045's own state table
  sends away: `multiproj-two-proj-id` has two distinct `TASK.proj_id` values, so the
  *activities span more than one project* branch catches it before any calendar is looked at. 045
  counted it among the reporting files. The corrected figures are **24 of 27 before this ticket,
  25 of 29 after**, with four `unavailable` and no `error`.
- **The ratio band is 71.1–72.7%, not 71.1–72.8%**, post-049, over 25 files.
- **`catalogue.mjs`'s `missing-calendar` landmine did not owe 038's correction** — the text 038
  suggested had already landed. What it owed was the rest of the sentence, and it has it now:
  Oracle documents `day_hr_cnt` as a units-*conversion* factor that is never validated against the
  shifts and defaults to 8 on every new calendar including 24-hour ones (048), so it is not a
  fallback that was rejected, it is not a fallback at all. The entry also now records the thing
  nobody had noticed about it: **`calendars_in_use` is 2 against a `calendar_count` of 0**, because
  the `TASK` rows still name the calendars the deleted table used to hold. That is what a
  table-level deletion leaves behind and it is why the count is taken off `TASK.clndr_id`.

### Cost, and what did not move

Not one pre-existing `.xer` byte, verified by sha256 over all 28 committed files before and after;
the only two hashes in the diff are the two new fixtures. Regenerating twice is byte-identical.

The 27 existing goldens grow **646,563 → 653,582 bytes, +1.1%**, which is two assertion fields;
the corpus total is **709,331** across 29. In `derived.json` the two fields cost **141 bytes**
against 045's estimate of 160.

The corpus aggregate moves, and it moves because the corpus grew rather than because anything
regressed: **181 / 178 / 175 becomes 197 / 195 / 191 — 96.7% → 97.0% recall, 98.3% → 97.9%
precision, 21 of 26 → 22 of 28 exact, and `why` 9 entries across 5 files → 10 across 6**. The one
new entry is on `cal-default-unused` and its cause is *lag treated as elapsed hours*, which is one
of 014 decision 4's own two, named in `why` like every other. It was left there rather than
zeroed out of the catalogue: tuning a fixture's lag to protect a headline number is what
[050](050-ship-gate-flagged-set.md) declined to do with `oosPairs`, for the same reason.
`cal-project-clndr-absent` reproduces exactly, 100% at 100%.

049's own properties hold on the grown corpus and were re-measured rather than assumed: the two
seed argmaxes still coincide, **0 disagreements over 7,768 ordered pairs across 29 programme
fixtures** (7,388 over 27 before), `seed_agreement.agree` is true on 29 of 29, and
`early_start_date == early_end_date` on **35 of 35** non-completed zero-duration rows and no other
row. The counterfactual scores in both READMEs were re-run rather than rescaled: reverting the
milestone instant scores **6/29**, the FS free-float formula **24/29** (**9 of 529** float-carrying
rows wrong, eight of them a spurious zero), reading shift attributes positionally **28/29**,
matching the time `\d\d:\d\d` **28/29**, and treating `0x7F` as a record separator **2/29**.

Both READMEs are written here rather than left as a delta. `fixtures/synthetic/README.md` gains
*What the calendars are for: `duration_working_days`* below the `calendars` block — the closing
paragraph the ticket named claimed a permanent `unavailable` and is now false on the 25 files that
report a value; it is replaced by the state table above, with a file pinning each row — plus the two landmine rows and every count the two new files moved. The
generator README gains the paragraph beside 032's free-float one, and the reason it needs to exist
at all: **the golden's `days` cannot come from the corpus's own dates.** This generator lays every
activity out on one five-day `WorkCalendar` whatever `TASK.clndr_id` says, so `target_drtn_hr_cnt`
disagrees with the assigned calendar on **6 of 19** rows of `wbs-flat` — measured, not quoted — and
a golden read off those dates would assert the inconsistency instead of the conversion. So
`generate.mjs` walks `Date`s against the week `buildClndrData` packed and `measure.mjs` walks
1899-12-30 day serials against the week it decoded: two implementations sharing no line, which is
043's decoder rule applied to the arithmetic standing on top of the decoder.

### Residue

- **The `error` branch is the only state no fixture produces**, and `--verify` compares it on
  `state` alone because its reason is a decoder diagnostic rather than an intent. That is a golden
  nothing reads, one size smaller than the defect 032, 039, 042 and 049 each found once. Closing it
  needs the `calendars` block to be able to say *this row does not decode*, which is the same
  extension [051](051-unparsed-clndr-shapes.md) needs for its anonymous root wrapper — so it should
  be built there rather than here. Filed as a ticket.
- **`span_calendar_days` is a difference and `duration_working_days` is a count**, so the Window
  tile's two numbers are one apart. Filed as a ticket; it is 006's field.
- **`calendars_in_use` counts `TASK.clndr_id` including ids the file does not carry** —
  `missing-calendar` reports 2 against 0 declared. Taken literally from 045, and it is the honest
  reading, but a page rendering *"1 of 3 calendars in use"* has to decide what *"2 of 0"* says.
- **The exception override is exercised in one direction only, on three files.** An exception
  falls inside the programme window on **3 of the 25** — `wbs-flat` and `logic-lag-nonworking`
  (`2026-12-25` and `2027-01-01`) and `missing-taskpred` (`2026-12-25`) — and all five are
  **closures on days the week says work**, each removing one day. **No fixture has an exception
  *working* day inside its own window**, so the branch that adds a day back is asserted by the
  `calendars` block and by nothing that spends it: `cal-clndr-data`'s bought-back half day is
  `2026-01-03`, two days before that file's window opens. A corpus programme starting on
  `2026-01-05` cannot contain a `2026-01-01`, so the fixture that would close this needs a
  working exception inside its own dates rather than a longer window.
- **The five-day/seven-day answers are never both taken on one file.** 043's 37–41% spread was the
  interesting number and it is now unreportable, because the field reports one calendar by
  construction. What replaces it is `activity_share_pct`, which says how much of the programme the
  one number is true of and nothing about what the other answer would have been. That is 045's
  decision working as designed, recorded here because it is the thing a reader of 043 will look
  for and not find.
