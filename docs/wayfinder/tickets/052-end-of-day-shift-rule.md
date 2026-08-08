---
id: 052
title: Implement the end-of-day shift rule and build `cal-elapsed-24h`
type: task
status: out-of-scope
assignee:
blocked_by: []
---

## Question

[048](048-elapsed-calendar-semantics.md) decided; nothing is built. Four edits and one fixture,
specified precisely in [`assets/elapsed-calendar.md`](assets/elapsed-calendar.md) §§9–10.

| file | change |
|---|---|
| `measure.mjs`, `shiftHours` | `hhmm(finish) - hhmm(start)` becomes end-of-day-aware; a result `<= 0` throws naming the shift |
| `lib/calendar.mjs`, `recordMeaning`'s `hoursOf` **and** `WorkCalendar`'s `hoursPerDay` | both return 0 for this calendar today; the golden would otherwise assert the bug with a straight face |
| `lib/calendar.mjs`, `buildClndrData` | one option, `exceptions: 'omit'` — the emitter always writes `(0||Exceptions()())`, and 271 of 563 real calendars have none |
| `catalogue.mjs` | the `cal-elapsed-24h` entry and its landmine |

The load-bearing constraint is [043](043-calendar-golden-block.md)'s: `measure.mjs`'s decoder and
`lib/calendar.mjs`'s `hoursOf` must be written **independently**, or the golden asserts the same
mistake twice.

**`cal-elapsed-24h`** — three `CALENDAR` rows, one landmine, placed with the other two calendar
fixtures. Row 1 is the exact real shape (flat, no `0x7F`, `f|00:00|s|00:00`, **no `VIEW` node, no
`Exceptions` node**, `day_hr_cnt = 24`, `week_hr_cnt = 168`, 285 bytes — the verbatim blob is in the
asset). Row 2 is the same calendar written the `CA_Base` way (indented, `s|00:00|f|00:00`,
`VIEW(ShowTotal|Y)`), with `same_meaning_as` row 1 and `identical_bytes: false`, so the 24 is shown
to belong to the calendar and not the writer. **Row 3 carries `s|08:00|f|00:00`** — *not* observed in
the real set, and there because it is the **only** thing separating the adopted rule from
`finish == start ⇒ 24`; the two are indistinguishable on every real file and on rows 1 and 2, so
without it the corpus would carry a rule it could not fail, which is precisely the defect 038
diagnosed in `cal-clndr-data`. Its landmine must say the shape is implied rather than observed and
cite MPXJ 6.0.0. Activities split ten and ten across rows 1 and 2, so `duration_working_days` is the
span itself with `activity_share_pct: 50` and the same answer either way.

`--verify` asserts six things (enumerated in the asset): the decoded meaning on rows 1 and 2; their
differing `serialisation` blocks; `declared: { day_hr_cnt: 24, week_hr_cnt: 168 }` on both — the
corpus's only golden where declared and decoded **agree**, the mirror of `cal-flat-no-0x7f`'s
contradiction; `same_meaning_as`; row 3's 16-hour day and consequent `hours_per_working_day: null`;
and `duration_working_days` equal to the span. Row 3 pays twice: a calendar with one 16-hour day and
four 8-hour ones is the **corpus's first ragged week**, closing 043's standing residue that the
`null` branch *"is asserted by nothing"* — for free.

Nothing in the existing corpus moves — no corpus shift finishes at midnight — so `--verify` must go
from 27/27 to 28/28 with 27 files byte-identical.

One judgement call is flagged overturnable by 048 and inherited here: **`f < s` after the
end-of-day transform stays a decode error rather than a wrap to the next day.** A blanket wrap would
turn 043's *"minus eight-hour working day"* signal into a plausible-looking 20 hours.

**Sequencing note, added 2026-08-08 by the integrating session, from
[049](049-generator-milestone-instant.md).** Run this **after** 047 and 051 so it rebases once. Two
things it now inherits. The `finishAt(h)` / `startAt(h)` boundary is a **stated rule with an evidence
base** for zero-duration rows (044's 96.4% / 54.1%), so this ticket cannot change `finishAt` without
moving 41 rows of milestone dates and the corpus aggregate a second time. And a 24-hour calendar has
no non-working gap, so `startAt(h)` and `finishAt(h)` differ by exactly one hour everywhere and never
by a gap — **the milestone-instant distinction is invisible on `cal-elapsed-24h`**, which therefore
cannot exercise or contradict 049's rule and must not be designed as though it could.
