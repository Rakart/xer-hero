---
id: 060
title: No corpus programme contains an exception **working** day
type: task
status: out-of-scope
assignee:
blocked_by: []
---

## Question

[021](021-verify-fixtures-in-p6.md) confirmed exception *working* days are real and heavily used, and
[043](043-calendar-golden-block.md)'s `calendars` block asserts three of them. But
[047](047-report-duration-working-days.md) measured which exceptions actually land inside a
programme's own window: **3 of 25 files**, five exception days, and **all five are closures on days
the week says work**.

`cal-clndr-data`'s bought-back half day is `2026-01-03`, two days before that file's window opens, so
the branch that **adds** a working day back is asserted by the calendar block and spent by nothing.

Every corpus programme starts `2026-01-05` and the default holidays are `01-01` and `12-25`, so no
window can contain a New Year's Day. The fix is a fixture with a working exception inside its own
dates — a Saturday worked in the first month — not a longer window.

One catalogue entry and one golden number.
