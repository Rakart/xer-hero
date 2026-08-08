---
id: 058
title: "`span_calendar_days` is a difference and `duration_working_days` is a count"
type: grilling
status: closed
assignee: carlo
blocked_by: []
---

## Question

[006](006-derived-json-contract.md)'s `time.span_calendar_days` is `finish − start`;
[045](045-duration-working-days-calendar.md)'s `time.duration_working_days.days`, built by
[047](047-report-duration-working-days.md), counts the dates in `[start, finish]` with **both ends in
it**. So on a seven-day calendar the working-day count is the calendar-day span **plus one**, and
045's page design prints them side by side: `460 days · 328 working (5-day week)`, where
`derived.json` says 459.

On both real programmes — seven-day jobs, where 045's headline is that the stat *"reports exactly the
number beside it"* — the two differ by exactly 1, which is the one place the identity is meant to be
visible.

Three ways out:

- make `span_calendar_days` **inclusive**, which moves a shipped v2 number on every row and needs a
  version bump it would otherwise not need;
- leave it and have the tile print `span_calendar_days + 1`, which is a number no field carries;
- keep both and say **in the field names** which is which.

The inclusive count is P6's own duration arithmetic and is what makes the whole-day counter reproduce
`target_drtn_hr_cnt` on 1,685 of 1,685 rows, so **the stat is not the thing to change**.

Whichever is chosen, the corpus can assert it: 047's goldens carry the working-day count on 25 of 29
files and `measure.mjs` computes both from one window.

Technical, so AFK under the map's delegation note.

## Resolution

**Both fields become counts of one window, and the calendar one is renamed to say so:
`time.span_calendar_days` becomes `time.duration_calendar_days`, the number of dates in
`[start_date, finish_date]` with both ends in it. `derived.json` goes to v4.**

That is the ticket's option (a), taken together with the naming half of (c) — because the JSON
shape does not move and an integer that changes by one while staying an integer is exactly the
change a version stamp announces to a machine and to nobody else. The stat is untouched, as the
ticket instructed: `duration_working_days` keeps 047's convention, its object and its four states,
and the two fields now differ only in **which** dates count rather than in **how** dates are
counted.

### The difference convention is not merely awkward — it is false on every real file

Measured over the 29-file corpus with today's harness, post-047 and post-049. 28 files carry a
window; `enc-zeroed-file` carries none.

| | today, as a difference | after, as a count | `duration_working_days.days` |
|---|---|---|---|
| `wbs-flat` | 459 | **460** | 328 |
| `logic-lag-nonworking` | 435 | **436** | 310 |
| `enc-cp1252-currency` | 109 | **110** | 80 |
| `cal-flat-no-0x7f` | 79 | **80** | 58 |
| `cal-project-clndr-absent` | 225 | **226** | `unavailable` |
| `enc-zeroed-file` | `null` | `null` | `unavailable` |
| Fixture A, 10 revisions | 2,350 – 2,741 | **2,351 – 2,742** | equal to the count |
| Fixture B, 4 variants | 3,318 – 3,530 | **3,319 – 3,531** | equal to the count |

Three things fall out of that table, and each decides the ticket on its own.

**On 14 of 14 real files `derived.json` today reports more working days than calendar days.** Both
real programmes are seven-day jobs, so every date in the window is a working date and `days` is the
inclusive count of them, while `span_calendar_days` is that same count minus one. There is no
reading of *calendar days* under which a subset of them exceeds them. The corpus hides it because
its programme calendar is five-day and 71% keeps the count safely under the difference — so the
field is wrong in precisely the place [045](045-duration-working-days-calendar.md) said the identity
was the entire point.

**Every span figure this effort has published for the real set is already the inclusive count.**
045's asset §2 says so outright — *"Span here is `time.start_date`..`time.finish_date` inclusive,
the window `span_calendar_days` already measures"* — and its real-set table's 2,351–2,742 and
3,319–3,531 are counts, against a field emitting one less. 047's ratio band is the same fact
measured rather than asserted: **71.1–72.7% is `days / (span_calendar_days + 1)`** across all 25
reporting files, and `days / span_calendar_days` is **71.3–73.4%**, a band that appears nowhere in
the effort. So (a) is the option under which four already-published figures become true; (b) and (c)
both leave the shipped field contradicting all of them.

**[043](043-calendar-golden-block.md)'s own table carries the contradiction inside one row.**
`wbs-flat`: *span 459 calendar days · on the five-day calendar 328 · on the seven-day calendar 460.*
A seven-day calendar makes every date in the window a working date, so its answer **is** the
calendar-day span by construction — and it comes out one higher than the column beside it. 043 wrote
a difference in column one and a count in column four; that row has been quoted by 045, by 006's
amendment and by this ticket without anyone catching it. Which is the strongest available evidence
against (c).

### Why not the other two

- **(b), print `span_calendar_days + 1` in the tile.** [006](006-derived-json-contract.md) decision 1
  makes `derived.json` the detail-page payload and [008](008-project-detail-page.md) §8
  server-renders every number above the table straight out of it. A tile doing arithmetic makes the
  page a second source of truth for a published statistic — which 008 §6 refused for chart
  re-bucketing, and which [010](010-stack-hosting-auth.md) (*"a client parse is advisory only"*) and
  [011](011-upload-ingest-pipeline.md) (*"nothing the client computes is persisted"*) refuse
  everywhere else. It is also unassertable: `--verify` scores `derived.json` and has no view of a
  tile, so the one calendar-day number a reader ever sees would be the only number in the estate no
  golden can fail.
- **(c), keep both conventions and name them.** The names already say it — *span* against *duration*
  is the distinction, and it is this ticket's own title — and saying it did not stop 043, 045 or the
  contract's worked example from mixing them. Naming a discrepancy is not removing it, and the tile
  still cannot print the pair: `328 · 459` divides to a ratio matching nothing published, and on a
  seven-day job the sub-line reads `2,350 days · 2,351 working`, which renders 045's headline
  identity as an off-by-one bug on the page that identity exists to occupy.

### Why the rename, when a version bump would do

Every previous move of this contract changed a **shape**: v2 replaced `logic.longest_path`'s
`{state, reason}` with a value, v3 replaced `time.duration_working_days`'s tag with an object. A
reader holding two blobs can tell those apart by looking. This is the first change in the effort
where old and new deserialise identically and differ by one, so nothing but the key distinguishes
them — and `derived_version` is a `smallint` on a Postgres row, which tells the recompute path and
tells no human reading two revisions of the contract side by side.

`duration_calendar_days` also pairs with `duration_working_days` the way the two numbers pair on the
page, and *duration* is the word the domain uses for an inclusive count: P6's own duration arithmetic
makes an activity that starts and finishes on one working day **one** day, which is what makes the
whole-day counter reproduce `target_drtn_hr_cnt` on 1,685 of 1,685 rows. A field on a P6 programme
counting the other way was the anomaly. Prose is free to keep saying *the programme span* — the
window is still a span; the field reports its duration in calendar days.

### The cost, stated flatly

**Zero backfill and one smallint.** `span_calendar_days` is neither a typed column nor a `card` key —
Tier 1 carries `start_date` and `finish_date` and nothing derived from them — so 006 decision 6's
explicit-backfill rule does not fire and a stale row recomputes lazily on first open. This is the
first amendment in the effort to **move a number an earlier version already emitted**, which is
exactly the case lazy recompute was designed for and has never once been made to run.

In the harness it is the expression at `measure.mjs:463` plus a key rename. Not one `.xer` byte
moves, no fixture is added, and no golden that exists today carries the field at all — which is the
other half of this decision.

### The corpus has never been able to fail this

`span_calendar_days` appears in **no golden**. 047's mutation table pulls four rules and scores
27/29, 28/29, 4/29 and 5/29; a fifth wrong rule — *the calendar span counted exclusive of its
finish* — scores **29/29 today**, because nothing asserts it. So `duration_calendar_days` joins
`duration_working_days` in each `assertions` block, where that mutation would fail **28 of 29** —
every file with a window. The two numbers are then asserted on one convention from one window, which
is what `measure.mjs:277`'s own comment (*"computed once so they cannot drift apart"*) has claimed
since 047 and has not been true of the values derived from it.

### The contract after this decision

```jsonc
"time": {
  "start_date": "2017-04-24",              // date | null   — earliest activity start
  "finish_date": "2023-08-11",             // date | null   — latest activity finish
  "data_date": "2017-09-29T16:00",         // PROJECT.last_recalc_date, naive local
  "duration_calendar_days": 2301,          // integer | null — v4, replaces span_calendar_days
  "duration_working_days": {               // v3 per 045, unchanged — or {state, reason}
    "days": 328,
    "calendar": { "clndr_id": 42, "name": "5-Day Week", "working_days_per_week": 5 },
    "activity_share_pct": 50.0
  }
}
```

- **`duration_calendar_days`** — integer, the count of calendar dates in
  `[start_date, finish_date]` **inclusive**; `(finish − start) / 86400000 + 1` over the two naive
  local dates. A programme starting and finishing on one date is `1`, never `0`. `null` where either
  date is absent, and only then.
- **`duration_working_days.days`** — the count of **working** dates in that same window, on the
  same both-ends-in-it convention, walked over the programme calendar's decoded week plus its
  exceptions. Never divides by a day length; carries no hours.
- **The invariant**, true on every programme and now assertable:
  `duration_calendar_days ≥ 1` wherever it is not null, and `0 ≤ days ≤ duration_calendar_days`
  wherever `duration_working_days` reports. Equality holds exactly when the programme calendar has
  no non-working date inside the window — the seven-day case, and the whole of what the identity
  says. `days = 0` is reachable and correct: a window falling entirely on non-working dates.

Everything else is untouched: `start_date`, `finish_date` and `data_date` keep their meaning and
their typed columns; `duration_working_days`'s object, its `unavailable`/`error` branches and 043's
reason string are 045's and 047's unchanged; `card` and the Postgres row gain and lose nothing.

### What the page prints

Unchanged from 045 and 008 — and literally true for the first time. The Window tile's sub-line is
`460 days · 328 working (5-day week)`, both numbers read straight from `derived.json` with no
arithmetic in the view; `· the calendar 50% of activities use` appends below 100% share; where
`duration_working_days` is `unavailable` the tile prints `duration_calendar_days` and nothing else.
On a seven-day programme the two numbers are now equal, which is 045's headline — *the stat reports
exactly the number beside it* — and is the calendar summary 008 asked for above the fold and got
`calendar_count` instead.

### Residue

- **One published number moves in the whole effort**: `wbs-flat`'s calendar-day span, `459 → 460`,
  wherever 043's table row is quoted (043 item 4, 045's body, 006's 043 amendment, and the same
  amendment in `assets/derived-json-contract.md`). The contract asset's worked example moves with the
  rename, `"span_calendar_days": 2300` → `"duration_calendar_days": 2301`. Every other published
  figure — 045's real-set table, its 100% ratio column, 047's 71.1–72.7% band, its 328/460 and 80/110,
  008's sub-line — becomes true rather than needing restatement.
- **The null branch stays a bare `null`** rather than becoming `{state, reason}`. 006 decision 7 tags
  what can *fail*, and this cannot: the two fields it is derived from are bare-nullable in the same
  object and are typed columns, so a tag here would be the only tagged thing in a block whose own
  inputs are untagged, and the reason it would carry is legible from `start_date: null` one line
  above. `enc-zeroed-file` is the file that exercises it.
- **No ratio field.** 006's candidate list named a working-versus-calendar-days ratio and never
  shipped one; after this decision the two fields finally divide correctly, so a consumer that wants
  71.3% can compute it from two adjacent numbers. Adding a third field to publish a division of the
  first two is the kind of merely-true stat decision 8 cut.
- **The real-set rows in the table above are arithmetic on 045's published inclusive figures**, not a
  fresh read — the real `.xer` files are gitignored and absent from this checkout. The corpus rows
  and both ratio bands are measured.
- **Nothing here is built.** The rename in `measure.mjs` and `generate.mjs`, the new golden
  assertion on 29 files, the mutation row, and the six documents carrying the old name are a
  follow-on task in 047's shape.
