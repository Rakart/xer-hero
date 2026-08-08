# What calendar `duration_working_days` is measured on

Resolution asset for
[What calendar is `duration_working_days` measured on?](../045-duration-working-days-calendar.md).

The stat is **the programme's span converted on the calendar the `.xer` names as the
programme's own** — `PROJECT.clndr_id` — reported with that calendar beside it and with the
share of activities actually sitting on it. This document is the evidence for choosing that
over the four shapes [045](../045-duration-working-days-calendar.md) listed, and the states
it can take.

Nothing here identifies either real set beyond the names the public docs already use
(**Fixture A**, **Fixture B**). Measurements only.

## 1. The obstacle was measured on the wrong field, and on a corpus artefact

[043](../043-calendar-golden-block.md) closed with *"the conversion needs one calendar and a
programme has several"*, evidenced by `CALENDAR` row counts and by `default_flag`. Both
halves fail against the real files.

**Fourteen real programme files — ten Fixture A revisions and all four Fixture B variants,
two distinct programmes — carry three to five `CALENDAR` rows and use exactly one.** The
number of distinct `TASK.clndr_id` values is **1 on 14 of 14**, and on **14 of 14** it is
the calendar `PROJECT.clndr_id` names.

| | files | `CALENDAR` rows | distinct `TASK.clndr_id` | == `PROJECT.clndr_id` | `default_flag = Y` |
|---|---|---|---|---|---|
| Fixture A (one revision series) | 10 | 4–5 | **1** on all 10 | **10 of 10** | on 2 of 10 |
| Fixture B (four tender variants) | 4 | 3 | **1** on all 4 | **4 of 4** | on **0 of 4** |

`default_flag` is not merely a weaker signal than `PROJECT.clndr_id`; it is **absent from 12
of the 14 files**, and on one of the two that carry it, it names a calendar carrying **0 of
1,746 activities** while every activity sits on a different one. It is a database-level
marker for what new activities inherit, exactly as 043 said — and the field that answers the
question was in `PROJECT` all along, unexamined.

The **37–41% spread** 043 measured is real arithmetic on a shape the corpus manufactures.
Every synthetic programme deliberately splits ten activities onto a five-day week and ten
onto a seven-day week; no real programme in either set splits at all. The spread is a
property of the generator's catalogue, not of programmes.

## 2. What the answer actually is, per file

Span here is `time.start_date`..`time.finish_date` inclusive, the window
`span_calendar_days` already measures, converted on the programme calendar.

**Real (n = 14, 2 programmes):**

| | span, calendar days | programme calendar | working days | ratio |
|---|---|---|---|---|
| Fixture A, 10 revisions | 2,351 – 2,742 | seven-day, eight-hour | **identical to the span** | 100% |
| Fixture B, 4 variants | 3,319 – 3,531 | seven-day, eight-hour | **identical to the span** | 100% |

**Corpus (n = 27):** a value on **25**, `unavailable` on the **2** with no `CALENDAR` table.
`PROJECT.clndr_id` names the five-day calendar on all 25, so the ratio runs **71.1–72.8%** —
`wbs-flat`, 460 calendar days, is **328** working days. The activity share on that calendar
is 50% on 24 files and 47.4% on `logic-external-driver`.

The real answer is worth stating plainly because it is unflattering: **on both real
programmes the stat reports the same number as the field beside it.** Both are seven-day
rail/civils jobs, and a seven-day calendar with no in-window exceptions converts a span to
itself. The register already records that the real set is one domain only; the corpus is
where the field earns its keep, and a five-day building or fitout programme is the ordinary
case it was written for.

That identity is not nothing, though. Rendered *with its calendar* the field says **"459
days, and this programme is planned on a seven-day week"**, which is a real fact about the
job and is currently invisible on the detail page — [008](../008-project-detail-page.md)
asked for a calendar summary above the fold and got `calendar_count`, a count of rows of
which three of four are unused on Fixture A.

## 3. The shape

`time.duration_working_days` keeps its name and its place, and follows `logic.longest_path`'s
established idiom — value fields when it computes, `{state, reason}` when it does not.

```jsonc
"duration_working_days": {
  "days": 328,
  "calendar": {
    "clndr_id": "6600",
    "name": "5 Day Working Week",
    "working_days_per_week": 5
  },
  "activity_share_pct": 50.0
}
```

Four things about that object:

- **`days` is a whole-day count over the same window as `span_calendar_days`**, so the two
  numbers subtract and the page can print them together. It is derived from the decoded
  `week` pattern plus the exceptions, and **never divides by a day length** — see §6, where
  that turns out to matter.
- **The calendar rides in the same object as the number**, which is the contract's own rule
  for `critical_count` / `critical_threshold_hr` applied one field along: a working-day count
  without its calendar is the same species of lie as a critical count without its threshold.
- **`activity_share_pct`** is the share of activities whose `clndr_id` is that calendar —
  100% on every real programme measured, 50% across the corpus. It is what stops the number
  quietly claiming to be true of the whole programme when it is not, and it is the one number
  that tells a reader whether the programme is single-calendar at all.
- **No hours.** No `hours_per_working_day`, no `hours_per_week`. §6 says why.

`shape.calendars_in_use` — the count of distinct `TASK.clndr_id` — joins it as a bare
scalar. It is the number that makes the detail page's `Calendars` tile honest: Fixture A
declares four and uses one. This half is severable from the rest.

## 4. The states, and what the page renders

| Condition | Field | `issues[]` | Detail page |
|---|---|---|---|
| `PROJECT.clndr_id` resolves and decodes | the object above | — | Window tile sub-line: `460 days · 328 working (5-day week)`. The calendar clause is **never** dropped, even at 100% |
| share below 100% | same, `activity_share_pct < 100` | — | as above, plus `· the calendar 50% of activities use` |
| **no `CALENDAR` table** | `{ state: "unavailable", reason: "no CALENDAR table, so there is no shift pattern to convert on" }` | — | Window tile sub-line is `460 days` and nothing else |
| no `PROJECT.clndr_id`, or it names a calendar absent from the file | `{ state: "unavailable", reason: "PROJECT.clndr_id 841 is not in the file's CALENDAR table" }` | — | as above |
| activities span more than one `proj_id` | `{ state: "unavailable", reason: "activities span 2 projects, so there is no single programme calendar" }` | — | unreachable in practice — [011](../011-upload-ingest-pipeline.md) rejects multi-project files |
| the named calendar's `clndr_data` does not decode | `{ state: "error", reason: "clndr_data for calendar 42 did not decode: …" }` | **warn** | as above, and the *partially analysed* banner fires |

Two deliberate choices in that table.

**`unavailable` is silent on the page.** The contract distinguishes *absent from source* from
*computation failed*, and a programme with no `CALENDAR` table is the first, not the second.
Printing "working days: unavailable" on a fact tile would read as breakage; the reason stays
in the JSON, where the prototype's `?fields=1` provenance overlay already shows it. This is
the one place the page diverges from `longest_path`, which prints its reason verbatim — and
it diverges because `longest_path` owns a callout with room for a sentence and this owns
half a tile.

**Only `error` raises an `issues[]` entry.** Anything else would make 25 of 27 corpus files
and every calendar-less programme render the *partially analysed* banner, which is for
failures. The contract already carries the exact worked example this makes reachable:
`{ "stat": "time.duration_working_days", "severity": "warn", "reason": "clndr_data parse
failed for clndr_id 42" }`.

**`missing-calendar` keeps its pin.** No `CALENDAR` table is the first `unavailable` row,
with 043's reason string unchanged, and `enc-zeroed-file` passes the same check for free.
The `--verify` assertion inverts from *an empty `calendars` block must come with
`unavailable`* to that **plus** *a non-empty one must come with a value matching the golden*
— which is a stronger test on 25 more files than the one it replaces.

## 5. Why not the four candidates

**(a) Delete the field.** The argument was that a stat which never reports is a promise the
card cannot keep. It never was a card promise — the browse row carries no working-day figure
([007](../007-storefront-card-and-grid.md)) and `derived.json` is the detail-page payload
alone — and it now reports on **25 of 27** corpus files and **14 of 14** real ones. Deleting
would also throw away the calendar summary the detail page asked for and never got.

**(b) The project's *default* calendar, as 045 framed it.** Right instinct, wrong field. On
`CALENDAR.default_flag` it is absent from 12 of 14 real files and wrong on one of the
remaining two. On `PROJECT.clndr_id` it is present and correct on 14 of 14. The decision is
(b) with the field corrected — and with the number never rendered without the calendar that
produced it, which is what makes "a number true of no activity in particular" impossible to
read off the page.

**(c) A per-calendar breakdown.** Honest, and it answers a question nobody asked: on the real
evidence three of a programme's four calendars are used by nothing, so most rows of the
breakdown would be spans converted on calendars no activity is on. The one row that matters
is the one this decision reports, and `activity_share_pct` already says when there is more
than one.

**(d) Summed working duration of the activities, each on its own calendar.** It is not a
duration of anything. On Fixture B it is **262,524 activity-working-days against a 3,319-day
span** — 79× — and on Fixture A **63,966 against 2,595**, 25×. A planner reading that beside
`span_calendar_days` would not recognise it as the same programme. It is a real stat (work
content, roughly) under a different name in a different group, and it is not what
`duration_working_days` means. It also has to divide by a day length, which §6 shows is the
one thing this arithmetic must avoid.

## 6. Why the field carries no hours

**A real, stock P6 calendar decodes to zero hours a day.** Ten of the fourteen real files
carry an elapsed-duration `CA_Project` calendar whose seven days each hold one shift written
`f|00:00|s|00:00` — 285 bytes, not one `0x7F`, finish-first, exactly the flat form
[038](../038-calendar-shapes-and-0x7f.md) fixtured. It declares `day_hr_cnt = 24` and
`week_hr_cnt = 168`. Under the corrected decoder it reads as **seven working days of zero
hours**, because `finish − start` is zero.

As a *working-day* calendar that decode is right: every day works, which is what an elapsed
calendar means, and it is exactly what this field needs. As an *hours* calendar it is a
division by zero, and the only field in the row that says 24 is `day_hr_cnt` — the field
038 established cannot be trusted. So the one calendar where `day_hr_cnt` is the sole source
of a day length is the one 038 forbade reading it from.

No activity in any of the 14 files is assigned to it, so nothing is wrong today. But a stat
that divides by `hours_per_working_day` is one uploaded programme away from dividing by zero,
and the working-day span never needs to. Keeping hours out of this field costs nothing and
removes the hazard; §8 files the format question.

One number the same sweep settles: **44 of the 54 real `CALENDAR` rows decode to an
eight-hour day and the other 10 are that elapsed calendar**, so every calendar any real
activity is assigned to is eight hours. The contract's footnote worry — *"a programme whose
calendar uses a different `day_hr_cnt` needs the conversion done per calendar"*, the second
stated reason for tagging this field — is unobserved in the real set, and DCMA 6 and 8's
44-days-at-8-hours conversion is correct on every calendar in it.

## 7. Cost, and what it gives up

- **`derived.json` goes to v3.** The shape of one field changes and one bare scalar joins
  `shape`. Under the contract's rule that is a version bump; under its blob-path convention
  a bump is a new object, no CDN purge, and rollback is changing a number.
- **No backfill, and `card` is untouched.** Neither a typed column nor a `card` key moves —
  the browse row has no working-day figure and no calendar figure — so the explicit-backfill
  rule does not fire. Stale rows recompute lazily on open, which is the cheap path the
  contract was built around.
- **Size: about +160 bytes.** Against a 40–60 KB typical and a 150 KB ceiling, nothing.
- **What it gives up** is the pretence that one number answers the question for every
  programme. On a genuinely mixed programme — none observed, but the corpus builds one 25
  times over — the field reports the project calendar and says in the same breath that only
  half the activities are on it. That is a weaker claim than a scalar and a stronger one than
  `unavailable`.
- **What it costs the reader** is one more clause on a tile. That is the price of the
  `critical_count` rule, already paid elsewhere on the same page.
- **It does not survive a programme with genuinely two working weeks and no dominant
  calendar** as a single headline number. Nothing does; the alternative there is (c), and
  `activity_share_pct` is the hook a later ticket would hang it on.

## 8. Residue

- **The day-versus-timestamp convention is arithmetic and is left to the implementing
  ticket.** The whole-day counter used here reproduces P6's own duration arithmetic exactly
  where activities sit on whole-day boundaries — **1,685 of 1,685** not-started activities on
  Fixture A's baseline and **3,110 of 3,111** on Fixture B — and disagrees on Fixture A's
  progressed revisions, whose activities carry part-day timestamps (`12:00`, `14:05`) that a
  day counter cannot see. 021's validated working-hour function can. At programme scale this
  is a ±1-day question on a 2,595-day number, and it is the arithmetic 045 explicitly did not
  decide.
- **`f|00:00|s|00:00` needs a rule.** Either it means a 24-hour day and the decoder's
  `finish − start` is wrong for the wrap case, or the calendar genuinely has no hours and
  `day_hr_cnt = 24` is decoration. `xer-format.md` says neither, the corpus carries neither,
  and `hours_per_working_day` guards against a first-day guess but not against a zero.
- **The corpus's calendar split is unrepresentative and its replacement is not obvious.**
  Ten-and-ten across two calendars is a shape no real programme produced; one calendar for
  everything is the shape both real sets have. The split is worth keeping — it is the only
  thing that exercises `activity_share_pct` — but the corpus should also carry the real
  shape, and a fixture where `default_flag` names a calendar no activity uses, which is
  Fixture A's baseline and which nothing today can reproduce.
- **The calendar's `name` is the first `CALENDAR` free text to reach `derived.json`.** On
  both real sets the programme calendar's name embeds the client or contract identifier. That
  is the uploader's own file and the same class of string as the activity names already in
  `quality.checks[].examples`, so it raises no new rule — but it is the first time a calendar
  string is rendered, and it is worth having said so once.
- **`shape.calendar_count` counts rows.** It stays, because how many calendars a file defines
  is a fact about the file, but it is not the number the page wants and on Fixture A it
  overstates by four to one. `calendars_in_use` is the fix and is severable.

## 9. Reproducing

Everything above comes from `measure.mjs`'s exported `tokenize` and `decodeClndrData` driven
by a throwaway script — the harness is not committed, per 021's and 038's practice. The
corpus half is reproducible from the repo alone:

```
for each corpus .xer:
  tables      <- tokenize(bytes)
  pc          <- PROJECT[proj_id of the activities].clndr_id
  cal         <- decodeClndrData(CALENDAR[clndr_id = pc].clndr_data)
  window      <- min/max of act|early|target dates over TASK
  days        <- count of d in window where cal says d works
                 (exceptions override the weekday pattern)
  share       <- TASK rows with clndr_id = pc, over all TASK rows
```

The real half needs the fixture sets and a machine that has them.
