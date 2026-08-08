# What `f|00:00|s|00:00` means

Working notes for [What does `f|00:00|s|00:00` mean?](../048-elapsed-calendar-semantics.md).

Measurements only. The real set is named **Fixture A**; no client, contract or file path
appears here, per [001](../001-get-real-xer-files.md). The calendar name
`Elapsed Duration Calendar` is quoted because it is a generic P6 string carrying no
identifier; every other calendar name in the set is withheld, because
[045](../045-duration-working-days-calendar.md) recorded that they embed the client or
contract.

## 0. The answer in one line

**A shift whose finish is `00:00` runs to the end of the day.** So
`s|00:00|f|00:00` is **24 hours**, `hours_per_working_day` for this shape is **24**,
`hours_per_week` is **168**, and `decodeClndrData`'s subtraction needs one ternary, not a
`finish == start` special case. The rule is not mine — it is **MPXJ**'s, implemented
against P6 in 2017 (§5), and it is strictly better than the `f == s` rule the ticket
proposed.

## 1. What was swept

Every `.xer` in the read-only Fixture A set: **139 exports**, P6 **6.0** (127), **8.3** (5),
**7.0** (4), **6.2** (2), and one file with no readable header — [040](../040-zeroed-xer-file.md)'s
zeroed artefact, which also has no `CALENDAR` table. That leaves **138 files carrying 563
`CALENDAR` rows**. Fixture B's four variants are not in this path; per 045's own count —
the elapsed shape in *ten* of the fourteen files it sampled, which were ten Fixture A
revisions and all four Fixture B variants — **Fixture B carries none**, and that is an
inference from 045's arithmetic rather than a measurement made here.

Decoded with a reader implementing exactly what [038](../038-calendar-shapes-and-0x7f.md)
corrected, extended only where the real files forced it (§6). **All 563 rows decode.**

| Decoded shape | rows |
|---|---|
| 8 hours × 7 days | 266 |
| **24 hours × 7 days** | **137** |
| 8 hours × 6 days | 136 |
| 8 hours × 5 days | 24 |

Not one calendar has a ragged week — every worked day in every real calendar is the same
length as every other, so `hours_per_working_day`'s `null` branch is still asserted by
nothing (043's residue, unchanged). And **no calendar mixes zero-length shifts with real
ones**: 0 of 563. The question is per-calendar and all-or-nothing.

## 2. The shape is broader than 048 thought, and it is written three ways

048 records *ten of fourteen files*, one serialisation. Across all 139 the count is
**137 rows in 136 files — 98.6% of the files that carry a `CALENDAR` table at all** — and
the shape appears in **three** distinct serialisations, which matters because it means the
zero-length shift is not an artefact of the flat `CA_Project` writer that 038 fixtured.

| | n | type | bytes | `0x7F` | attrs | `VIEW` | `Exceptions` node | day/week/month/year |
|---|---|---|---|---|---|---|---|---|
| flat | **135** | `CA_Project` | 285 | 0 | `f\|00:00\|s\|00:00` | absent | **absent** | 24 / 168 / 744 / 8784 |
| indented, wrapped | 1 | `CA_Project` | 400 | 32 | `s\|00:00\|f\|00:00` | absent | absent | 24 / 168 / 744 / 8784 |
| indented | 1 | `CA_Base` | 438 | 34 | `s\|00:00\|f\|00:00` | `ShowTotal\|Y` | present, empty | 24 / 168 / **720** / **8760** |

The flat 285-byte blob, verbatim and complete — this is the exact string to fixture:

```
(0||CalendarData()((0||DaysOfWeek()((0||1()((0||0(f|00:00|s|00:00)())))(0||2()((0||0(f|00:00
|s|00:00)())))(0||3()((0||0(f|00:00|s|00:00)())))(0||4()((0||0(f|00:00|s|00:00)())))(0||5()(
(0||0(f|00:00|s|00:00)())))(0||6()((0||0(f|00:00|s|00:00)())))(0||7()((0||0(f|00:00|s|00:00)
())))))))
```

Wrapped for the page; the field contains no break of any kind and no `Exceptions` node at
all.

**136 of the 137 are named `Elapsed Duration Calendar`.** The 137th is a
**user-created `CA_Base` calendar whose name ends `-24x7`**, carrying `default_flag = Y` —
the global default — and one `RT_Mat` resource. A planner sat down, made a calendar, called
it 24×7, and P6 wrote seven days of `s|00:00|f|00:00` with `day_hr_cnt = 24` and
`week_hr_cnt = 168`. Under reading A that calendar has **no working time in it**.

## 3. What the two readings cost, scored

Reading **A** — the calendar genuinely has no hours, `day_hr_cnt = 24` is decoration.
Reading **B** — the shift spans the day and it is 24 hours.

### 3.1 The declared hour counts, 561 rows

`day_hr_cnt` is populated on **561** of 563 rows; the other two sit in a P6 **6.2** export
whose `CALENDAR` `%F` list **omits all four hour-count columns entirely** — which is a
stronger statement than xer-format.md's *"empty on some real calendars"* and is worth
correcting on its own account.

| | `day_hr_cnt` agrees | disagrees |
|---|---|---|
| Reading A | 424 | **137** |
| Reading B | **561** | **0** |

**The 137 disagreements under A are exactly, and only, the 137 zero-length calendars.**
There is no other class of `day_hr_cnt` disagreement anywhere in 139 exports across four P6
versions. Flip one rule and a field that is not derived from the shift pattern, and is not
validated by P6 against it, agrees with it on every row in the set.

`week_hr_cnt` behaves nothing like this and is the reason the two fields must be separated:

| | `week_hr_cnt` agrees | disagrees |
|---|---|---|
| Reading A | 134 | 427 |
| Reading B | 271 | **290** |

The surviving 290 are ordinary planner sloppiness — 154 seven-day eight-hour base calendars
declaring a 40-hour week over a pattern working 56, 135 six-day calendars declaring 40 over
48. That is 038's *"a seven-day calendar working eight hours a day declares
`week_hr_cnt = 40`"*, and it is real. It is a `week_hr_cnt` fact. Gotcha 18 attributes it to
both columns; on measurement `day_hr_cnt` never once does it.

### 3.2 The hour counts are internally coherent as 24-hour arithmetic

Not one number but four, and all four are `24 ×` a count of **calendar** days:

- `24 / 168 / 744 / 8784` = 24 × **1 / 7 / 31 / 366**
- `24 / 168 / 720 / 8760` = 24 × **1 / 7 / 30 / 365**

Decoration is not usually consistent to four significant relationships in two independent
variants. And Oracle's default for a new calendar is **8** hours a day (§4), so 24 is not
what the field falls back to — somebody set it, and set the other three with it.

### 3.3 P6 already has a cheaper way to write "no working time", and does not use it

Across the set a genuinely non-working day is written **182 times** as a day node with no
shift children, `(0||1()())`, and **twice** as a day node carrying shift nodes with empty
attribute groups, `(0||0()())`. It is written as `00:00`→`00:00` **zero times**.

The contrast lands inside a single blob pair in a single file, from one exporter in one
run: that file's ordinary calendar writes its Sunday and Saturday as day nodes carrying
three *empty* shift slots, and the `Elapsed Duration Calendar` sitting beside it in the same
`CALENDAR` table writes all seven days with a *populated* `00:00`→`00:00` shift. P6 had two
established ways to say "nothing" and chose neither.

### 3.4 The exception nobody would ever write under reading A

One exception entry in the whole set — of **10,584**, of which 306 are worked — carries a
zero-length shift:

```
(0||0(d|39658)((0||0(s|00:00|f|00:00)())))
```

It sits on a `CA_Base` calendar working **08:00–16:00 seven days a week** which carries
**865 of that file's 918 activities**, and it is that calendar's *only* exception.

Under reading A a planner opened the calendar, added an exception to a working day, and
made it work **zero hours** — which is what the 10,278 childless exceptions in the set
already mean, written the long way, and which would make the day *shorter* than an ordinary
day rather than different from one. Under reading B they bought one day back as a
**round-the-clock 24-hour shift**. Only one of those is a thing anybody does.

### 3.5 `24:00` is not representable, so `00:00` is the only spelling available

Every clock value in every shift and every exception across 563 calendars:

```
00:00  07:00  08:00  09:00  12:00  13:00  15:00  16:00  17:00  19:00
```

Nothing above `19:00`. `23:59` never occurs, `24:00` never occurs. P6 has no observed way of
writing "the end of the day" other than `00:00`, which is exactly the constraint a
`LocalTime` field imposes and exactly what MPXJ's changelog says it fixed (§5).

## 4. Oracle documents the concept and not this calendar

Read rather than assumed, via `/research`. Two of the five things asked are properly
sourced to Oracle and three are **not documented at all**, which is stated here so nothing
downstream cites Oracle for a rule Oracle never wrote.

**Oracle defines what a 24-hour calendar is** — as a value of the *Relationship Lag
Calendar* scheduling option rather than as a shipped calendar, but in its own words
(P6 EPPM Help v25, `https://docs.oracle.com/cd/G18294_01/p6help/en/99348.htm`):

> "**24 hour Calendar**: Specifies work time 7 days/week and 24 hours/day"

and, in P6 Professional's Schedule Options help
(`https://docs.oracle.com/cd/F37128_01/client_help/en_US/general_tab_-_schedule_options_dialog_box.htm`):

> "…calculate lag based on the **24 Hour Calendar that uses continuous work periods**…"

**Oracle defines `day_hr_cnt` and its three siblings, and it is not what this project has
been assuming.** The XER Import/Export Data Map Guide (Project) v24 maps
`day_hr_cnt` → *Work Hours Per Day*, `week_hr_cnt` → *Work Hours Per Week*, `month_hr_cnt` →
*Work Hours Per Month*, `year_hr_cnt` → *Work Hours Per Year*; and the Calendar dialog help
(`https://docs.oracle.com/cd/F88968_01/client_help/en_US/calendar_dialog_box.htm`) says what
those columns are:

> "**Time Periods:** …enables you to define the calendar's default number of hours per
> timeperiod. For activities and resources to which the calendar is assigned, **these values
> are used as conversion factors when users enter or display units and durations in time
> increments other than hours**."

The REST Calendar schema repeats it per field — *"This conversion factor is used for
displaying time units and durations in the user's selected display formats"* — and Oracle's
own Time Periods worked example shows the mismatch as a normal configuration: Admin
preference 8 h/d against an *"Activity calendar, Work hours per day = 10h/d"*.

**So gotcha 18's rule is right and its reason improves.** These columns are a
units-conversion setting, not a statement of worked time, and they must never feed a
computed day length — Oracle says so directly, and *(secondary)* Ron Winter's *The Inner
Workings of Oracle/Primavera P6* adds the sharpest form of it: **"All new calendars default
to 8.0 hours per day, even 24-hour calendars."** That last sentence is why §3.1 is evidence
rather than circularity. The field does not track the pattern; it defaults to 8 and is never
validated. On 137 rows it says 24 anyway, and it says 24 on precisely the rows whose shifts
reading A calls empty.

**Three things Oracle does not document, and which nothing here claims it does:**

- **"Elapsed Duration Calendar" appears in no Oracle source.** Five Oracle PDFs, Oracle's
  HTML help, and a GitHub code search return zero occurrences of the phrase. Its origin is
  unknown; the nearest documented fact is that MS Project working-time calendars import as
  **project-level** calendars, which is consistent with the `CA_Project` type but
  establishes nothing. **Do not key behaviour off the name** — take the meaning from
  `clndr_data`, which is this document's own rule for everything else.
- **P6's calendar editor has no start/finish time fields at all** — it is an hour-by-hour
  Work/Nonwork toggle — so Oracle has no occasion to document what a 24-hour day's times
  look like, and *"midnight"*, *"00:00"* and *"12:00 AM"* appear **zero times** in both the
  P6 Professional v23 and P6 EPPM v25 user guides.
- **Oracle nowhere writes that a 24-hour-calendar activity's duration is continuous elapsed
  time.** It writes that duration is *"the total working time… calculated using the
  activity's calendar"* (Data Dictionary, `.../46503.htm`), which together with the
  24-hour-calendar definition above makes it a deduction and not a quotation.

## 5. MPXJ implemented this against P6 in 2017 — and the rule is not `f == s`

[002](../002-xer-file-structure.md) settled that MPXJ is a legitimate dev-harness oracle
because the decision was to write our own parser; [021](../021-verify-fixtures-in-p6.md)
used it as one. Its rule for this exact byte sequence is explicit, and **it is narrower and
better than the one 048 proposed.**

MPXJ's `clndr_data` shift reader does no start/finish comparison at all. The behaviour lives
in `LocalTimeHelper.getMillisecondsInRange`:

```java
return rangeEnd == LocalTime.MIDNIGHT
   ? MS_PER_DAY - (rangeStart.toSecondOfDay() * 1000L)
   : (rangeEnd.toSecondOfDay() - rangeStart.toSecondOfDay()) * 1000L;
```

| shift | MPXJ |
|---|---|
| `s\|00:00\|f\|00:00` | **24 h** |
| `s\|08:00\|f\|00:00` | **16 h** |
| `s\|08:00\|f\|08:00` | **0 h** |

The discriminator is **finish == midnight**, not **start == finish**. A `08:00`→`08:00`
shift is zero, not a day. Corroborated four ways inside the project: its own
`createTwentyFourHourCalendar()` builds a 24-hour calendar as
`new LocalTimeRange(LocalTime.MIDNIGHT, LocalTime.MIDNIGHT)`; its how-to documents
`00:00-00:00` → `24.0h` in as many words; its writer round-trips a midnight-to-midnight range
back out as `s|00:00|f|00:00`; and its changelog names the source of the rule —

> "Fix `"00:00"` calendar finish times to parse as end of day **when reading from P6**."
> — MPXJ 6.0.0, 2017-07-22

That is an independent implementation, built by reading real P6 exports, which hit this
exact defect nine years ago and fixed it in the direction of reading B. It is the strongest
single piece of evidence here and it is why the adopted rule is MPXJ's and not the ticket's.

**One adjacent trap recorded while we are here, for whoever meets PMXML:** in **PMXML** — a
different format, not `.xer` — a lone work-time of `00:00–23:59` is P6's sentinel for a
**non-working** day, while `00:00–00:00` still means 24 hours worked. A one-minute
difference inverts the meaning. Nothing in this project reads PMXML today.

## 6. The arithmetic settlement that was available, and why it did not fire

048 asks for the empirical test: an activity on one of these calendars, its
`target_drtn_hr_cnt` against its own dates. **There is none, and the sweep is exhaustive** —
across 139 files, `TASK.clndr_id` names a zero-length calendar **0 times**, `PROJECT.clndr_id`
names one **0 times**, and the only reference from anywhere is **one `RT_Mat` resource** on
the `-24x7` base calendar. Every one of the 136 files carrying an elapsed calendar puts all
of its activities on some other calendar.

The near miss is §3.4's exception, and it is worth recording because it came within six
years of settling the ticket outright. That calendar carries 865 activities, so P6's own
published arithmetic on that file depends on the reading — but the exception is dated
**2008-07-29** and the programme runs **2014-06-01 → 2020-12-30**. No activity window
contains it, and the two readings give identical answers on all 865.

The exercise was still worth running, because it validated the instrument. Reproducing
021's method — total float as `workhours(early_start → late_start)` on the activity's own
calendar — the working-hour model used throughout this document reproduces P6's published
figures on that file exactly:

| | n | reproduced |
|---|---|---|
| `total_float_hr_cnt` | 861 | **861** |
| `target_drtn_hr_cnt` | 865 | **865** |

So the arithmetic here is P6's arithmetic. It simply has nothing to say about `00:00`,
because P6 never scheduled anything across a day where the two readings differ.

**This is the ticket's own point made sharper.** 048 says *"no activity in any real file is
assigned to one, so nothing is wrong today"*. Over ten times as many files: still nothing,
and the reason is structural rather than lucky — the calendar exists in 136 of 138 files and
is used by none of them, which is what a stock or import-created artefact looks like. It is
one upload away from being used, and the upload that uses it will be a 24×7 job, which is
exactly the kind of programme this site wants.

## 7. The rule

**A shift's finish of `00:00` means the end of the day.**

```js
const shiftHours = (s, f) => (f === 0 ? 24 - s : f - s);   // hours, s and f as decimal hours
```

- `s|00:00|f|00:00` → **24**. 137 real calendars, three serialisations, four P6 versions.
- `s|08:00|f|00:00` → **16**. Unobserved in the real set; free, and MPXJ's.
- `s|08:00|f|08:00` → **0**. A degenerate shift, and *not* a day. This is the case a
  `finish == start` rule gets wrong, and it is the whole reason the rule is written on the
  finish.
- **`f < s` after that transform stays an error.** A shift finishing before it starts is
  unobserved in 563 real calendars and a negative day length is never a calendar — it is the
  signature of a parser reading the attributes positionally, which is what
  `cal-flat-no-0x7f` exists to catch. Throwing turns 043's *"minus eight-hour working day"*
  into a decode error naming the offending shift, and the contract already has somewhere for
  a calendar that does not decode to go: 045's `error` plus an `issues[]` **warn**. This half
  is the only judgement call in the section and is marked overturnable in the resolution.

Consequently, for this shape: `hours_per_working_day: 24`, `working_days_per_week: 7`,
`hours_per_week: 168`, `exceptions: []`, `view_node: false`.

## 8. What every consumer must guard — which is less than 048 feared

048's second reading required *"every consumer must guard a division"*. Under the rule
adopted, **no new guard is needed anywhere**, and the hazard 045 sidestepped stops existing:

- **`hours_per_working_day` can no longer be `0`.** A day that works has at least one shift;
  a shift now has a positive length or the decode fails. Where no day works at all,
  `decodeClndrData` already returns **`null`** rather than `0`, because `lengths.size === 0`
  falls through the same ternary as a ragged week. So the guard consumers need is the
  `null` check 043 already introduced for the ragged case — one guard, already specified,
  now covering both.
- **`duration_working_days` does not move.** [045](../045-duration-working-days-calendar.md)
  counts working days and never divides by a day length, so it was immune under either
  reading. Its §6 reasoning was right and the reason improves: keeping hours out of the field
  was correct on its own merits rather than as a dodge around this calendar.
- **Anything that converts hours to days must take the day length from the calendar, not
  from 8.** This is already gotcha 18's rule; what changes is that it now has teeth. The
  contract's DCMA 6 and 8 thresholds are *44 days*, converted at 8 hours to 352 — on a 24-hour
  calendar the same threshold is **1,056**, and a hard-coded 352 would report every activity
  over a fortnight as a DCMA-8 failure. 045 measured that every calendar a real activity is
  on is eight hours, which is still true and is why nothing is wrong today; the constant is
  the thing to remove before it is.
- **Nothing in the corpus changes.** No synthetic fixture emits a zero-length shift — the
  corpus's five distinct shift strings are all `08:00–16:00`, `08:00–12:00`, `13:00–17:00` and
  the two finish-first forms of the last two. The fix is additive and cannot move a byte or a
  golden of the 27 files that exist.

## 9. The fixture

**`cal-elapsed-24h`**, sitting with `cal-clndr-data` and `cal-flat-no-0x7f` so the three
calendar fixtures read together. Three `CALENDAR` rows, one landmine — *a shift finishing at
midnight runs to the end of the day* — asserted from three directions.

| row | what it is | why |
|---|---|---|
| 1 | The elapsed calendar in the **exact real shape**: flat, zero `0x7F`, `f\|00:00\|s\|00:00`, **no `VIEW` node**, **no `Exceptions` node**, `day_hr_cnt = 24`, `week_hr_cnt = 168`, 285 bytes | 135 real instances. The shape a parser will actually meet |
| 2 | The **same calendar** written the other way: indented, `0x7F` runs, `s\|00:00\|f\|00:00`, `VIEW(ShowTotal\|Y)`, an empty `Exceptions` node, `day_hr_cnt = 24`, `week_hr_cnt = 168` | 1 real instance, a `CA_Base`. `same_meaning_as` row 1, `identical_bytes: false` — the 24 is a property of the calendar and not of the flat writer |
| 3 | An ordinary five-day calendar carrying one day whose single shift is **`s\|08:00\|f\|00:00`** | **Not observed in the real set**, and there on purpose: it is the only thing that separates the adopted rule from `finish == start ⇒ 24`, which is otherwise indistinguishable on every real file and on rows 1 and 2 |

Row 3 is the `cal-flat-no-0x7f` lesson applied to this rule before it is written rather than
after: without it the corpus would carry a rule it could not fail, which is the defect 038
diagnosed and 043 closed. Its landmine must say plainly that the shape is implied rather
than observed, and cite MPXJ 6.0.0 as what implies it.

**The programme's activities sit on rows 1 and 2**, ten and ten, which is the corpus's
standing split. Both halves convert to the same number, so `duration_working_days` is the
span itself — a 24-hour calendar works every day — with `activity_share_pct` at 50 and the
answer identical either way. That is the one place the corpus can show that a calendar
written two ways gives one answer to a *derived stat*, not just to a decode.

`--verify` then asserts, over the `calendars` block 043 built:

1. Rows 1 and 2: `hours_per_working_day: 24`, `working_days_per_week: 7`, `hours_per_week: 168`,
   all seven days `works: true` with shifts `["00:00-00:00"]` and `hours: 24`, `exceptions: []`.
2. Row 1 `serialisation`: `layout: flat`, `shift_attrs: finish-first`, `view_node: false`,
   `has_0x7f: false`. Row 2: `indented`, `start-first`, `view_node: true`, `has_0x7f: true`.
3. `declared: { day_hr_cnt: 24, week_hr_cnt: 168 }` on both — the **only** golden in the
   corpus where the declared counts and the decoded meaning agree, which is the point:
   `cal-flat-no-0x7f` pins the contradiction, this pins the agreement, and neither is a
   licence to read the column.
4. Row 2 `same_meaning_as: <row 1 clndr_id>`, `identical_bytes: false` — decode against
   decode, the corpus's second such check.
5. Row 3: that one day is `hours: 16`, and the week's `hours_per_working_day` is therefore
   `null`, because its days are no longer all the same length. **That is the corpus's first
   ragged week**, which closes 043's standing residue *"`hours_per_working_day` is `null`
   where a calendar's worked days are not all the same length… that branch is asserted by
   nothing"* — for free, as a side effect of the row that had to exist anyway.
6. `duration_working_days` reports a value equal to the calendar-day span, with
   `activity_share_pct: 50`.

A decoder that subtracts naively fails 1, 5 and 6. A decoder written to
`finish == start ⇒ 24` passes 1–4 and 6 and fails **only 5** — which is precisely why row 3
is not optional.

## 10. The code change

Four edits, and **the first two must not share an expression**, per 043's rule that the
decoder shares not one line with the generator that wrote the bytes — otherwise the fixture
asserts the same mistake twice with a straight face.

| file | what |
|---|---|
| `tools/fixture-gen/measure.mjs`, `shiftHours` | the decoder. `hhmm(finish) - hhmm(start)` becomes end-of-day-aware; a result `<= 0` throws, naming the shift |
| `tools/fixture-gen/lib/calendar.mjs`, `recordMeaning`'s `hoursOf` **and** `WorkCalendar`'s `hoursPerDay` | the generator's own record of what it packed, and the scheduler that lays activities out on it. Both compute `hhmm(f) - hhmm(s)` today and both return 0 for this calendar |
| `tools/fixture-gen/catalogue.mjs` | the `cal-elapsed-24h` entry and its landmine |
| `tools/fixture-gen/lib/calendar.mjs`, `buildClndrData` | one option, `exceptions: 'omit'`, so row 1 can carry **no `Exceptions` node** — today the emitter always writes `(0||Exceptions()())`. 271 of 563 real calendars have no such node, so this is a real shape and not a fixture convenience |

`buildClndrData` needs nothing else: `shifts: [['00:00','00:00']]` with `workDays: [1..7]`,
`view: false`, `layout: 'flat'`, `shiftAttrs: 'finish-first'` already produces row 1's bytes
once `hoursOf` is fixed.

## 11. Residue

- **Three real `clndr_data` shapes this sweep found that nothing in the estate parses**, all
  outside 048's question and all live defects in `measure.mjs` today. Filed as a ticket
  rather than fixed here.
  - **An anonymous root wrapper.** Two `CA_Project` calendars in two files are
    `(0||()( (0||CalendarData()()) (0||DaysOfWeek()(…)) (0||Exceptions()()) ))` — `CalendarData`
    is an **empty sibling marker**, not the parent of anything. `decodeClndrData` looks for
    `CalendarData` among the top-level nodes, finds the unnamed one, and throws
    `clndr_data: no CalendarData node`. These are the only 2 of 563 rows that do not decode.
  - **Twelve-hour clock times.** One calendar writes `s|8:00 AM|f|12:00 PM` and
    `s|1:00 PM|f|5:00 PM`. `hhmm()` splits on `:` and `Number('00 PM')` is `NaN`, which
    `m || 0` swallows — so `1:00 PM` silently reads as `01:00`. It happens to give the right
    answer for that file's morning/afternoon pair and would not for `s|8:00 AM|f|5:00 PM`.
    MPXJ discriminates the two formats on whether the string contains a space, which is
    cheap and is presumably what P6 does.
  - **Empty shift nodes.** `(0||2()())` — a shift node with an empty attribute group. Eleven
    of them in one file, and in that file they are **how a non-working day is written**: days
    1 and 7 of a five-day calendar carry three empty slots each. `shiftOf` throws on them
    today, per 043's deliberate *"a shift node carrying no `s`/`f` pair is an error rather
    than a silently empty day"* — a rule chosen against a shape nobody had seen, which turns
    out to exist and to mean exactly *empty day*. It must become a skip, and a day's
    `works` must be *has at least one populated shift*, not *has children*.
- **`Exceptions` is optional and `VIEW` carries `Y`.** 271 of 563 calendars have no
  `Exceptions` node at all and 273 have no `VIEW`; xer-format.md documents neither absence,
  and shows `VIEW(ShowTotal|N)` where `ShowTotal|Y` also occurs. `decodeClndrData` already
  tolerates both through `?.`, so this is documentation rather than code.
- **The hour-count columns can be absent from `%F` entirely**, not merely empty — one P6 6.2
  export omits all four from its `CALENDAR` field list. Gotcha 18 says "empty on some real
  calendars"; "absent from the table on some real exports" is the stronger and correct form,
  and it is 002's never-index-by-position rule paying for itself again.
- **The elapsed calendar's provenance is unknown and should stay that way in code.** No
  Oracle source names it; do not branch on `clndr_name`.
- **Nothing here is built.** This ticket decides. The decoder change, the generator change
  and `cal-elapsed-24h` are a follow-on task.
