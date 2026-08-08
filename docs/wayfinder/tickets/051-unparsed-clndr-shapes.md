---
id: 051
title: Three real `clndr_data` shapes nothing in the estate parses
type: task
status: out-of-scope
assignee:
blocked_by: []
---

## Question

[048](048-elapsed-calendar-semantics.md)'s sweep of all 139 real exports found three `clndr_data`
shapes beyond anything [038](038-calendar-shapes-and-0x7f.md) corrected. All three are live defects
in `measure.mjs`'s decoder today; **two of them are silent**.

1. **An anonymous root wrapper.** Two `CA_Project` calendars in two files are
   `(0||()( (0||CalendarData()()) (0||DaysOfWeek()(…)) (0||Exceptions()()) ))` — `CalendarData` is an
   **empty sibling marker**, not the parent of anything. `decodeClndrData` looks for `CalendarData`
   among the top-level nodes, finds the unnamed one, and throws `clndr_data: no CalendarData node`.
   These are the only **2 of 563** real rows that fail to decode.
2. **Twelve-hour clock times.** One calendar writes `s|8:00 AM|f|12:00 PM` and `s|1:00 PM|f|5:00 PM`.
   `hhmm()` splits on `:` and `Number('00 PM')` is `NaN`, which `m || 0` swallows — so `1:00 PM`
   silently reads as `01:00`. It happens to give the right answer for that file's morning/afternoon
   pair and would not for `s|8:00 AM|f|5:00 PM`. MPXJ discriminates on whether the string contains a
   space.
3. **Empty shift nodes.** `(0||2()())` — a shift node with an empty attribute group, eleven of them
   in one file, and in that file they are **how a non-working day is written**: days 1 and 7 of a
   five-day calendar carry three empty slots each. `shiftOf` throws, per
   [043](043-calendar-golden-block.md)'s deliberate *"a shift node carrying no `s`/`f` pair is an
   error rather than a silently empty day"* — a rule chosen against a shape nobody had seen, which
   exists and means exactly *empty day*.

Each needs the corpus treatment 038 and 043 established: the rule, a fixture that can fail a parser
that gets it wrong, and a `calendars`-block assertion. (3) additionally changes what `works` means —
*has at least one populated shift*, not *has children* — which touches the golden.

Sequence this after [052](052-end-of-day-shift-rule.md) or merge with it; both edit the same decoder
and the same `calendars` block, and 052 is the one 048 actually decided.
