---
id: 045
title: What calendar is `duration_working_days` measured on?
type: grilling
status: closed
assignee: carlo
blocked_by: []
---

## Question

[006](006-derived-json-contract.md)'s `time.duration_working_days` is one scalar, tagged
`unavailable` since it was written. [043](043-calendar-golden-block.md) removed the stated obstacle —
the measurement harness decodes `clndr_data` and reads all 50 calendars in the corpus — and found the
real one: **the conversion needs one calendar and a programme has several.**

Every synthetic programme puts ten activities on a five-day week and ten on a seven-day week, and
converting the same span on each gives answers **37–41% apart** — `wbs-flat`, 459 calendar days, is
**328** working days or **460**. `default_flag` does not settle it: it marks the calendar new
activities inherit, not the one a programme is measured on, and half the activities are on the other
one. Fixture A and Fixture B both carry multiple calendars, so this is not a synthetic artefact.

**Decide the shape, not the arithmetic.** Roughly:

- (a) keep it `unavailable` permanently and delete the field from the contract, since a stat that
  never reports is a promise the card cannot keep;
- (b) define it explicitly as the span on the project's default calendar and say so *in the field*,
  accepting a number true of no activity in particular;
- (c) replace the scalar with a per-calendar breakdown, which is honest and is a shape no card can
  render;
- (d) redefine the stat as something a calendar actually answers — the summed working duration of
  the activities, each on its own calendar — which is a different number from a span and may be the
  one a planner meant.

Whatever is chosen has to survive `missing-calendar`, which pins `unavailable` where there is no
`CALENDAR` table at all, and it should say what the detail page shows in each state. The corpus can
already test any of them: the `calendars` block states every calendar's meaning and `--verify`
decodes it.

Technical, so AFK under the map's delegation note — decide it and state it plainly.

## Resolution

**(b), on the field that answers it — and the obstacle was measured on the wrong one.** The
stat is the programme's span converted on the calendar the file names as the programme's own,
`PROJECT.clndr_id`, reported with that calendar inside the same object and with the share of
activities actually on it. Full working, with the states and the page's render of each, in
[`assets/duration-working-days.md`](assets/duration-working-days.md).

[043](043-calendar-golden-block.md) closed on *"the conversion needs one calendar and a
programme has several"*, evidenced by `CALENDAR` row counts and by `default_flag`. Measured
against **fourteen real files — ten Fixture A revisions and all four Fixture B variants, two
distinct programmes — both halves fail.** They carry three to five `CALENDAR` rows and use
**exactly one**: the number of distinct `TASK.clndr_id` values is **1 on 14 of 14**, and on
**14 of 14** it is the calendar `PROJECT.clndr_id` names. `default_flag` is **absent from 12
of the 14**, and on one of the two that carry it, it names a calendar holding **0 of 1,746
activities** while every activity sits elsewhere. 043 was right that `default_flag` marks what
new activities inherit rather than what a programme is measured on; the field that does mark
it was in `PROJECT` and nothing had looked.

The **37–41% spread** is real arithmetic on a shape the generator manufactures. Every corpus
programme deliberately splits ten activities onto a five-day week and ten onto a seven-day
one. **No real programme in either set splits at all.**

### The shape

```jsonc
"duration_working_days": {
  "days": 328,
  "calendar": { "clndr_id": "6600", "name": "5 Day Working Week", "working_days_per_week": 5 },
  "activity_share_pct": 50.0
}
```

— or `{ state, reason }`, following `logic.longest_path`'s idiom exactly. The calendar rides
in the same object as the number because that is the contract's own `critical_count` /
`critical_threshold_hr` rule one field along: a working-day count without its calendar is the
same species of lie as a critical count without its threshold. `activity_share_pct` is what
stops the number quietly claiming the whole programme — 100% on every real file, 50% across
the corpus. `shape.calendars_in_use` joins it as a bare scalar, because Fixture A declares
four calendars and uses one, and the detail page's `Calendars` tile currently prints the four.

**No hours in the field, and that is not fastidiousness.** Ten of the fourteen real files
carry a stock elapsed-duration `CA_Project` calendar whose seven days each hold one shift
written `f|00:00|s|00:00`, declaring `day_hr_cnt = 24` and `week_hr_cnt = 168`. It decodes to
**seven working days of zero hours** — correct as a working-day calendar, a division by zero
as an hours one, and the only field in the row that says 24 is the field
[038](038-calendar-shapes-and-0x7f.md) forbade trusting. The working-day span never divides by
a day length, so it is immune; anything that reports hours is one upload from dividing by
zero. The same sweep retires the contract's other stated worry: **44 of the 54 real `CALENDAR`
rows decode to an eight-hour day and the other 10 are that elapsed calendar**, so every
calendar a real activity is on is eight hours and DCMA 6/8's 44-days-at-8-hours holds.

### The states

A value on **25 of 27** corpus files and **14 of 14** real ones. `unavailable` where there is
no `CALENDAR` table — **043's reason string unchanged**, so `missing-calendar` keeps its pin
and `enc-zeroed-file` passes for free — and where `PROJECT.clndr_id` is absent or names a
calendar the file does not carry. `error` plus an `issues[]` **warn** where the named
calendar does not decode, which makes reachable the worked example the contract has carried
since v1. Only `error` raises an issue: `unavailable` on the banner would light *partially
analysed* on 25 corpus files and every calendar-less programme, and *absent from source* is
not *computation failed*.

On the page the Window tile's sub-line goes `460 days · 328 working (5-day week)`, the
calendar clause never dropped even at 100% share, with `· the calendar 50% of activities use`
appended below 100%. Where the state is `unavailable` the tile prints the calendar-day span
and nothing else — the one place this diverges from `longest_path`, which prints its reason
verbatim because it owns a callout and this owns half a tile.

`--verify`'s calendar assertion inverts from *an empty `calendars` block must come with
`unavailable`* to that **plus** *a non-empty one must come with a value matching the golden*,
which is a stronger test on 25 more files than the one it replaces.

### The cost, stated flatly

**On both real programmes the stat reports exactly the number beside it.** Both are seven-day
jobs — spans of 2,351–2,742 and 3,319–3,531 calendar days, all converting to themselves — so
the whole 37–41% of daylight this field was supposed to show up in lives on the corpus's
five-day calendar (ratios 71.1–72.8%; `wbs-flat`'s 460 days is **328**) and on a five-day
programme nobody has yet uploaded. The register already records the real set as one domain
only. Rendered *with its calendar* the identity is still worth printing: it says the
programme is planned on a seven-day week, which is a fact about the job and is the calendar
summary [008](008-project-detail-page.md) asked for above the fold and got `calendar_count`
instead.

**`derived.json` goes to v3, `card` is untouched, no backfill.** The browse row carries no
working-day and no calendar figure, so the explicit-backfill rule does not fire and stale
rows recompute lazily on open. About **+160 bytes** against a 40–60 KB typical.

### Why not the others

- **(a) delete** — it was never a card promise (the row has no such field, and `derived.json`
  is the detail-page payload alone), and it now reports on 25 of 27 and 14 of 14.
- **(c) per-calendar breakdown** — on the real evidence most rows would be spans converted on
  calendars no activity is on. `activity_share_pct` carries the only part that discriminates.
- **(d) summed activity working duration** — not a duration of anything: **262,524
  activity-days against a 3,319-day span** on Fixture B, 79×; 63,966 against 2,595 on Fixture
  A. A real stat under a different name in a different group, and it has to divide by the day
  length this decision spent §6 avoiding.

### Residue

- **The day-versus-timestamp convention is arithmetic and is left open**, per this ticket's
  own scope. A whole-day counter reproduces P6's duration arithmetic exactly where activities
  sit on whole-day boundaries — **1,685 of 1,685** not-started activities on Fixture A's
  baseline, **3,110 of 3,111** on Fixture B — and disagrees on Fixture A's progressed
  revisions, whose activities carry part-day timestamps (`12:00`, `14:05`). 021's validated
  working-hour function sees those; a day counter cannot. At programme scale it is ±1 day on
  a 2,595-day number.
- **`f|00:00|s|00:00` needs a rule** — 24-hour day, or genuinely no hours with `day_hr_cnt`
  as decoration. `xer-format.md` says neither and the corpus carries neither.
- **The corpus's ten-and-ten split is a shape no real programme produced.** Worth keeping —
  it is the only thing exercising `activity_share_pct` — but the corpus should also carry the
  real shape, and a file where `default_flag` names a calendar no activity uses, which is
  Fixture A's baseline and which nothing today can reproduce.
- **The calendar `name` is the first `CALENDAR` free text to reach `derived.json`**, and on
  both real sets it embeds the client or contract identifier. Same class as the activity names
  already in `quality.checks[].examples`, so no new rule — worth having said once.
- **Nothing here is built.** This ticket decides; the harness, the golden field and the
  README paragraph are a follow-on task.

> **Amended 2026-08-08** by [What does `f|00:00|s|00:00` mean?](048-elapsed-calendar-semantics.md).
> The residue *"`f|00:00|s|00:00` needs a rule"* is settled: **a shift finishing at `00:00` runs to
> the end of the day**, so the calendar is **24 hours a day, 168 a week**, not zero. The *no hours in
> the field* decision is unchanged and its reason gets **stronger rather than weaker**: the field
> never divided by a day length, and now there is no zero to divide by, because
> `hours_per_working_day` can no longer be `0` at all. What was called *a division by zero as an
> hours calendar* was the decoder, not the file. Two figures widen with the corpus: **44 of 54 rows
> eight-hour and 10 elapsed** over fourteen files becomes **426 of 563 eight-hour and 137 elapsed**
> over all 139, in **136 of 138** calendar-bearing files rather than ten of fourteen, and the elapsed
> shape appears in **three** serialisations rather than one — so this ticket's sample was
> unrepresentative in size while being right in kind. The claim that every calendar a real activity is
> on is eight hours **holds on the full set**: `TASK.clndr_id` names an elapsed calendar **0 times in
> 139 files**, as does `PROJECT.clndr_id`, and the only reference anywhere is one `RT_Mat` resource.
> So DCMA 6/8's 44-days-at-8-hours is still right today, and its **hard-coded 352 hours** is the thing
> to remove, since the same threshold on a 24-hour calendar is 1,056.

> **Amended 2026-08-08** by
> [Report `duration_working_days` on the programme calendar](047-report-duration-working-days.md).
> Built, and the decision holds with two counts corrected. **A value on 24 of 27, not 25** — this
> ticket's own third `unavailable` branch catches `multiproj-two-proj-id`, whose activities span two
> `proj_id`s, and the count above put it among the reporting files; post-047 the corpus is 29 files,
> **25 reporting and 4 `unavailable`**, and the ratio band is **71.1–72.7%**. And the arithmetic left
> open here settles in a way this ticket half-assumed: `days` counts the window's dates with **both
> ends in it**, which is P6's own duration arithmetic and is what makes **`wbs-flat` 328 working days
> over 460 calendar days** — the numbers 043 published and this ticket repeated. But
> `span_calendar_days` is a **difference**, so it is 459, and *"the two numbers subtract"* and the
> `460 days · 328 working` sub-line are **one apart from what `derived.json` carries**: the tile's
> calendar-day figure is `span_calendar_days + 1`, filed as
> [058](058-span-difference-versus-count.md). The residue *"the corpus should also carry the real
> shape, and a fixture where `default_flag` names a calendar no activity uses"* is **closed by one
> file**, `cal-default-unused`, and it is the file that makes `default_flag` fail: read as the
> programme calendar it reports 213 days at a share of 0 against a true 153 at 100.
