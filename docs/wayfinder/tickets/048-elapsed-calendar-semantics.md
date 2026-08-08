---
id: 048
title: What does `f|00:00|s|00:00` mean?
type: grilling
status: closed
assignee: carlo
blocked_by: []
---

## Question

Ten of fourteen real files carry a stock elapsed-duration `CA_Project` calendar: seven days, one
shift each, written `f|00:00|s|00:00`, 285 bytes, no `0x7F`, finish-first, unpadded — the exact flat
form [038](038-calendar-shapes-and-0x7f.md) fixtured. It declares `day_hr_cnt = 24` and
`week_hr_cnt = 168`. Under the corrected decoder it reads as **seven working days of zero hours**,
because `finish − start` is zero.

Two readings. Either the shift wraps and the day is 24 hours, in which case `decodeClndrData`'s
subtraction is wrong for `f == s` and `hours_per_working_day` should be 24; or the calendar genuinely
has no working hours and `day_hr_cnt = 24` is decoration, in which case `hours_per_working_day: 0` is
right and every consumer must guard a division. 038 established that `day_hr_cnt` cannot be trusted —
and this is the one calendar where it is the only thing that says anything.

`xer-format.md` states neither rule and the corpus carries neither shape. No activity in any real
file is assigned to one, so nothing is wrong today;
[045](045-duration-working-days-calendar.md) sidestepped it by keeping hours out of
`duration_working_days` entirely. Whatever is decided needs a fixture, because 038's lesson is that a
rule with no file behind it is prose.

Technical, so AFK under the map's delegation note.

## Resolution

**It is 24 hours — and the rule is written on the *finish*, not on `f == s`.** A shift
whose finish is `00:00` runs to the end of the day, so `s|00:00|f|00:00` is 24 hours,
`s|08:00|f|00:00` is 16, and `s|08:00|f|08:00` is **zero and not a day**. That last row is
the reason the rule the ticket proposed is the wrong shape of rule, and it is not my
invention: it is what **MPXJ** has done since 2017, in a release whose changelog names the
cause — *"Fix `00:00` calendar finish times to parse as end of day when reading from P6."*
`hours_per_working_day` for this calendar is **24**, `hours_per_week` **168**, and
`decodeClndrData` needs one ternary. Full working, with the sweep, Oracle's docs and the
fixture spec, in [`assets/elapsed-calendar.md`](assets/elapsed-calendar.md).

The ticket's premise is right and its scope was too small. Across **all 139 real exports**
rather than fourteen, the shape is in **137 `CALENDAR` rows in 136 files — 98.6% of every
file carrying a calendar table** — and it is written **three ways**, not one: the 285-byte
flat `CA_Project` form 135 times, an indented `CA_Project` form once, and an indented
`CA_Base` form once. So the zero-length shift is a property of the calendar and not an
artefact of the flat writer [038](038-calendar-shapes-and-0x7f.md) fixtured.

### The empirical settlement the ticket asked for does not exist, and the sweep says so exhaustively

`TASK.clndr_id` names one of these calendars **0 times in 139 files**. `PROJECT.clndr_id`
names one **0 times**. The only reference from anywhere in any table is **one `RT_Mat`
resource**. Every one of the 136 files carrying an elapsed calendar puts every activity on
some other calendar, which makes the ticket's *"nothing is wrong today"* structural rather
than lucky — and makes it one upload from being wrong, since the programme that uses it
will be a 24×7 job.

The near miss is worth recording. One exception entry of **10,584** carries a zero-length
shift, and it sits on an ordinary seven-day eight-hour `CA_Base` calendar holding **865 of
its file's 918 activities** — so P6's own published arithmetic on that file turns on the
reading. It is dated **2008-07-29**; the programme runs **2014-06-01 to 2020-12-30**. Six
years out of range, and the two readings agree on all 865. The exercise still paid: rebuilt
to 021's method, the working-hour model used throughout reproduces P6's published
`total_float_hr_cnt` on **861 of 861** and `target_drtn_hr_cnt` on **865 of 865** on that
file, so every number below is P6's arithmetic rather than ours.

### What decides it instead

Five things, none of which needs an activity.

1. **`day_hr_cnt` agrees with the decoded pattern on 561 of 561 populated rows under this
   reading, and on 424 under the other — and the 137 disagreements are *exactly* the 137
   zero-length calendars.** There is no other class of `day_hr_cnt` disagreement anywhere in
   139 exports across four P6 versions. This is not circular, because Oracle documents the
   column as a **units-conversion factor** that is never validated against the shifts, and
   *(secondary)* Ron Winter records that **"all new calendars default to 8.0 hours per day,
   even 24-hour calendars"**. The field does not track the pattern and defaults to 8. On
   these 137 rows somebody set it to 24 anyway, with `168 / 744 / 8784` beside it —
   `24 × 7 / 24 × 31 / 24 × 366`, coherent to four relationships.
2. **P6 already has two cheaper ways to write "no working time" and uses neither here.**
   A non-working day is written **182 times** as a day node with no shift children and
   **twice** as a day node carrying empty shift slots. It is written `00:00`→`00:00`
   **zero times** — and in one file the two forms sit in the same `CALENDAR` table, from the
   same exporter in the same run.
3. **The exception in §3.4 of the asset is a thing nobody does under the other reading**: an
   exception added to a *working* day to make it work zero hours, which is what the 10,278
   childless exceptions already mean, written the long way.
4. **`24:00` is not representable.** Every clock value in 563 real calendars tops out at
   `19:00`; `23:59` and `24:00` never occur. `00:00` is the only spelling of end-of-day P6
   has, which is exactly the `LocalTime` constraint MPXJ's changelog describes.
5. **One of the 137 is a user-created `CA_Base` calendar whose name ends `-24x7`**, carries
   `default_flag = Y`, and holds a resource. Under the other reading, a planner's own 24×7
   calendar has no working time in it.

Oracle itself defines the concept and not this calendar: *"24 hour Calendar: Specifies work
time 7 days/week and 24 hours/day"* is Oracle's, though as a scheduling-option enum rather
than a shipped calendar. **"Elapsed Duration Calendar" appears in no Oracle source at all** —
five PDFs, the HTML help and a code search return nothing — so nothing may branch on the
name, and the asset says which of its claims are Oracle's and which are deductions.

### Why not zero hours

It requires four unrelated coincidences at once: that a conversion factor which defaults to
8 was set to 24 on exactly and only the calendars whose shifts are supposedly empty; that
its week, month and year siblings were set consistently with it; that P6 chose its most
verbose encoding to say what it says tersely 184 times elsewhere; and that an independent
implementation which reads real P6 exports for a living shipped the opposite rule as a
**bug fix against P6** and has kept it for nine years. And it buys nothing — it is the
reading that costs every consumer a division guard, and 045 had already had to route
around it.

### What consumers must guard: nothing new

`hours_per_working_day` can no longer be `0` — a day that works has a shift, and a shift now
has positive length or the decode fails. Where no day works at all `decodeClndrData` already
returns **`null`**, through the same ternary as a ragged week. So the guard is the `null`
check [043](043-calendar-golden-block.md) already specified, now covering both cases, and
the division-by-zero hazard [045](045-duration-working-days-calendar.md) §6 sidestepped
stops existing. `duration_working_days` does not move: it counts working days and was immune
either way, so 045's decision to keep hours out of the field was right on its own merits
rather than as a dodge. The one live constant to remove is **DCMA 6 and 8's 44 days
converted at 8 hours to 352** — on a 24-hour calendar the same threshold is **1,056**, and a
hard-coded 352 would fail every activity over a fortnight.

**Nothing in the corpus changes.** None of its five distinct shift strings finishes at
midnight, so the fix is additive and cannot move a byte or a golden of the 27 files that
exist.

### The fixture

**`cal-elapsed-24h`**, three `CALENDAR` rows, one landmine. Row 1 is the elapsed calendar in
the exact real shape — flat, no `0x7F`, `f|00:00|s|00:00`, **no `VIEW` node, no `Exceptions`
node**, `day_hr_cnt = 24`, `week_hr_cnt = 168`, 285 bytes. Row 2 is the same calendar written
the `CA_Base` way — indented, `s|00:00|f|00:00`, `VIEW(ShowTotal|Y)` — with
`same_meaning_as` row 1 and `identical_bytes: false`, so the 24 is shown to be a property of
the calendar rather than of the writer. Row 3 carries **`s|08:00|f|00:00`**, which is *not*
observed in the real set and is there because it is the **only** thing that separates the
adopted rule from `finish == start ⇒ 24`: the two are indistinguishable on every real file
and on rows 1 and 2. Without it the corpus would carry a rule it could not fail, which is
the defect 038 diagnosed in `cal-clndr-data` and 043 closed. Its landmine must say the shape
is implied rather than observed and cite MPXJ 6.0.0 as what implies it.

Row 3 pays a second time: a calendar with one 16-hour day and four 8-hour ones is the
**corpus's first ragged week**, which closes 043's standing residue that
`hours_per_working_day`'s `null` branch *"is asserted by nothing"* — for free.

The activities split ten and ten across rows 1 and 2, so `duration_working_days` is the span
itself with `activity_share_pct: 50` and the same answer either way — the only place the
corpus shows one calendar written twice giving one answer to a *derived stat* rather than to
a decode. Six `--verify` assertions, listed in the asset. A naive subtracter fails three of
them; a `finish == start` decoder fails only the ragged-week one, which is the measure of
how much row 3 is worth.

### Residue

- **Three real `clndr_data` shapes found by this sweep that nothing in the estate parses**,
  all outside this question and all live in `measure.mjs` today: an **anonymous root
  wrapper** where `CalendarData` is an empty sibling of `DaysOfWeek` rather than its parent
  (the only 2 of 563 rows that fail to decode); **twelve-hour clock times**,
  `s|8:00 AM|f|12:00 PM`, which `hhmm()` silently reads as `08:00` and `12:00`; and **empty
  shift nodes**, `(0||2()())`, which are how one real file writes a **non-working day** and
  which 043 deliberately made an error against a shape nobody had then seen. Filed as a
  ticket.
- **`Exceptions` is optional** — 271 of 563 real calendars have no such node — and **`VIEW`
  carries `ShowTotal|Y`** as well as `N`. Both already tolerated; neither documented.
- **The hour-count columns can be absent from `%F` entirely**, not merely empty: one P6 6.2
  export omits all four from its `CALENDAR` field list.
- **`f < s` after the end-of-day transform is left an error**, not a wrap to the next day.
  Unobserved in 563 calendars, and a negative day length is the signature of a positional
  read rather than a night shift. This is the one judgement call here and is **overturnable**
  — a wrap is defensible and would cost a diagnostic rather than a number.
- **Nothing here is built.** The decoder change, the generator change (`hoursOf` and
  `WorkCalendar.hoursPerDay`, which must not share an expression with the decoder) and
  `cal-elapsed-24h` are a follow-on task.
