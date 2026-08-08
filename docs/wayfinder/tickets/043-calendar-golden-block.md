---
id: 043
title: The goldens assert calendar meaning in prose only
type: task
status: closed
assignee: carlo
blocked_by: []
---

## Question

[038](038-calendar-shapes-and-0x7f.md) built `cal-flat-no-0x7f` around a single assertion:
the file's two `CALENDAR` rows carry **identical meaning and different bytes**, so a parser
must decode them to the same working calendar. Nothing checks it.

`describe()` in `tools/fixture-gen/generate.mjs` writes no calendar block, so a golden
records `calendar_count` and nothing else, and `measure.mjs --verify` compares that number.
The claim that makes the fixture worth having lives in its `landmine` string — prose, read
by people, asserted by nothing. That is the defect
[032](032-generator-free-float-by-type.md) found in `free_float_hr_cnt` and
[039](039-float-path-semantics.md) found in `float_path`: a value written into every golden
and never read back.

**Do:**

1. Add a **`calendars: [...]` block** to the golden — per calendar, the worked days, the
   shifts on each, hours per working day, and the exceptions with their decoded dates and
   whether each is worked. Written from the generator's intent, per the corpus's standing
   rule that a golden is never produced by parsing the result.
2. Give `verifyCorpus` a `clndr_data` decoder good enough to read that block back, and
   assert it. It needs only what 038 corrected: parentheses carry structure, `0x7F` and
   whitespace are insignificant, shift attributes are an order-free key-value bag, hours
   are not zero-padded.
3. Assert `cal-flat-no-0x7f`'s own claim directly — **its two rows decode to the same
   calendar** — which is the one assertion no per-row comparison against intent produces.
4. Drop `measure.mjs`'s `duration_working_days: { state: 'unavailable', reason: 'no
   calendar decoder in the measurement harness' }` if the decoder makes the conversion
   available, or leave it and say why.

Both calendar fixtures are already shaped for this. `missing-calendar` is the negative
case and must keep reporting `unavailable` rather than assuming eight hours.

Note the scope line this inherits from [012](012-large-synthetic-fixture.md): `measure.mjs`
is a measurement harness and **not the product parser**. A decoder here is for asserting the
corpus against itself, and the product's isomorphic TS parser is still written elsewhere.

## Resolution

**50 calendars now assert what they mean rather than that there are two of them, and the
corpus can fail all three of 038's corrected rules for the first time.** Read the shift
attributes positionally and `cal-flat-no-0x7f` comes back with a **minus eight-hour**
working day; match the time with `\d\d` and the same day works **four hours** with its
exception working day gone; give `0x7F` any meaning at all and **25 of 27** fixtures stop
decoding. `measure.mjs --verify` is **27/27**, and not one `.xer` byte moved — this ticket
writes goldens and a reader, never a fixture.

The `calendars` block is written from intent like every other one. The mechanism worth
recording is *how*, because the obvious route was closed: the meaning of a calendar lives
in the model `synthesise()` built, and both calendar fixtures reach past it — a `mutate`
hook hands `tables.CALENDAR` a finished blob, and the model beside it is then stale. So
`buildClndrData` **records what it packed as it packs it**, keyed by the blob it returns
(`meaningOf` in `lib/calendar.mjs`), and `describe()` looks the emitted string up. Same
bytes, same meaning — packing is injective — so the lookup is the generator's own record
and not a parse of its own output. A blob this generator did not pack has no recorded
intent and the golden says so rather than inventing one.

### What the block asserts

Per calendar: all seven days with `works` and the shifts on each written `HH:MM-HH:MM`,
the hours those shifts come to, `hours_per_working_day` / `working_days_per_week` /
`hours_per_week`, and the exceptions with their decoded date, their `1899-12-30` day
serial, whether each is **worked**, and its shifts. Across the corpus that is **50
calendars, 350 day entries of which 298 are worked, and 561 exceptions of which 3 are
worked days** — the three shapes 021 confirmed real are now three assertions rather than a
sentence about them.

Two fields beside the meaning, both of which exist because 038 measured them:

- **`declared`** — `day_hr_cnt` and `week_hr_cnt` as the row states them, recorded so the
  contradiction is a fixed comparison rather than prose. `cal-flat-no-0x7f` row 2 declares
  `null` and **56** against a decoded **40**, in one golden, side by side.
- **`serialisation`** — `layout`, `shift_attrs`, `pad_hours`, `view_node`, `has_0x7f`.
  None of it is meaning; all of it is what a parser trips over. Recording it beside the
  meaning is what lets the golden say *these two rows differ here, here and here, and mean
  the same thing*.

Exceptions are compared **in emission order, which is not date order** — `cal-clndr-data`
lists 46023, 46381, 46025 — deliberately, because that is the order 038's reader C found
and nothing may assume the `Exceptions` node is sorted.

### The decoder, and what it can fail

`verifyCorpus` gained one line and `measure.mjs` gained a `clndr_data` decoder that shares
**not one line** with the generator that wrote the bytes, which is the only reason the
comparison means anything. It implements exactly what 038 corrected and nothing else:
whitespace and `0x7F` skipped wherever they fall, attributes read as an order-free bag
keyed on `s` and `f`, the hour unpadded, and a shift node carrying no `s`/`f` pair is an
error rather than a silently empty day.

Each rule was then removed from the decoder in turn, one minimal mutation at a time, and
the whole corpus re-verified:

| Decoder | corpus | what it reports |
|---|---|---|
| corrected | **27/27** | — |
| shift attributes read **positionally** | **26/27** | `cal-flat-no-0x7f` calendar 6601: `12:00-08:00`, **−8 hours** a day, −40 a week, and the two rows no longer decode alike |
| time matched `\d\d:\d\d`, unpadded hour dropped | **26/27** | the same calendar works **4 hours** a day, 20 a week, and the exception working day comes back **not worked** |
| `0x7F 0x7F` treated as a **record separator** | **2/27** | every calendar in the corpus fails to decode; the only survivors are the two files with no `CALENDAR` table |

The first two fail on **one file**, and that is the point rather than a weakness: 038
built `cal-flat-no-0x7f` precisely because `cal-clndr-data` parses identically under the
wrong rule and could never have failed it. What was missing was not a fixture but a
reader — the same conclusion 032 reached about `free_float_hr_cnt`, now for the third
time.

The third row is a measurement of this decoder with one rule reversed, not a rerun of
038's reader A (an indent-aware tree builder, which read the indented form fine). It says
something narrower and still worth having: **give `0x7F` any structural meaning and there
is no calendar in this corpus you can read.**

### `cal-flat-no-0x7f`'s own claim, asserted directly

`same_meaning_as: 6600` on the second calendar, with `identical_bytes: false`. The check
decodes **both** rows and compares them to each other — the one assertion no per-row
comparison against intent produces, because two rows can each match their own golden
while a parser still reads different calendars out of them. It fails under both silent
mutations above, and it is the only place in the corpus where a decode is scored against
another decode rather than against the generator.

### Item 4: `duration_working_days` stays `unavailable`, and the reason was wrong

Dropping the tag was tempting and would have been the eight-hour guess with a decoder
standing in front of it. The harness can now convert a span to working days; what it
cannot do is choose *which calendar to convert it on*, and the corpus makes the size of
that choice explicit. Every corpus programme puts **ten activities on a five-day week and
ten on a seven-day week**, and the same span converted on each gives answers **37–41%
apart** on **24 of the 25** calendar-bearing files:

| File | span | on the 5-day calendar | on the 7-day calendar |
|---|---|---|---|
| `wbs-flat` | 459 calendar days | **328** working days | **460** |
| `multiproj-two-proj-id` | 443 | 316 | 444 |
| `cal-clndr-data` | 214 | 155 | 215 |
| `enc-cp1252-currency` | 109 | 80 | 110 |
| `cal-flat-no-0x7f` | 80 | 59 | **59** |

The last row is the exception and confirms the rule: it is the only file whose two
calendars are the same calendar. `default_flag` does not settle it either — it marks the
calendar new activities inherit, not the one a programme is measured on, and half the
activities are on the other one.

So the state is unchanged and the **reason string is corrected**, which is the honest
half: 038 already noted it said `'calendar decode unverified'` when the decode was
verified, and `'no calendar decoder in the measurement harness'` is now false in the same
way. It reads, per file, `'N calendars in the file and no rule for which one a
programme's span is measured on'`. **`missing-calendar` keeps its own reason** — `'no
CALENDAR table, so there is no shift pattern to convert on'` — because that is a
different fact and the one the fixture exists to pin, and `verifyCorpus` now asserts it:
an empty `calendars` block **must** come with `duration_working_days: unavailable`, so
the negative case is a test rather than a promise. `enc-zeroed-file` passes the same
check for free.

What is left is a contract question rather than a harness one — **which calendar
`duration_working_days` is measured on**, or whether
[006](006-derived-json-contract.md)'s single scalar is the wrong shape for a programme
that has several. Proposed as a ticket for the integrating session to file rather than
decided here, because it moves a closed contract.

> **Amended 2026-08-08** by
> [What calendar is `duration_working_days` measured on?](045-duration-working-days-calendar.md). The
> measurement stands and the conclusion drawn from it does not. Both instruments this section used
> were the wrong ones: `default_flag` is absent from **12 of 14 real files** and names a
> **0-activity** calendar on one of the two that carry it, and the field that *does* name a
> programme's calendar — `PROJECT.clndr_id` — is right on **14 of 14**. The 37–41% spread is
> arithmetic on a shape the catalogue manufactures: every corpus programme splits ten and ten, and
> **no real programme in either set splits at all** — distinct `TASK.clndr_id` is 1 on all 14 files,
> against 3–5 `CALENDAR` rows. So *"the conversion needs one calendar and a programme has several"*
> holds for `CALENDAR` rows and fails for programmes. The state moves to a value on **25 of 27**
> corpus files; `missing-calendar` keeps this ticket's reason string and its pin unchanged, and the
> `--verify` assertion strengthens from *empty block ⇒ unavailable* to that plus *non-empty block ⇒ a
> value matching the golden*. Built by [047](047-report-duration-working-days.md).

### Cost, and what did not move

The goldens grow **453,769 → 628,689 bytes across the 27 corpus files, +38.5%**. That is
the price of 561 decoded exceptions and it is worth paying, but it is worth stating: most
of the growth is the twelve years of `2026-01-01`/`2026-12-25` holidays every ordinary
fixture's default calendar carries, which nothing but this block reads.

No `.xer` moved. `cal-clndr-data` is 32,837 bytes and `cal-flat-no-0x7f` 33,919 —
identical to what 038 recorded — and 032's four moved files still measure 35,965 /
34,209 / 35,044 / 33,229. Regenerating twice gives byte-identical output.

One property the integrating session should know: a golden **without** a `calendars`
block now fails rather than skipping — remove it from one file and `--verify` reports
`CALENDAR rows 2 != golden calendars 0`, 26/27. The corpus must be regenerated after the
merge, and if it is not, it will say so on all 25 files.

Both READMEs are written here rather than left as a delta, because neither section was
contested: `fixtures/synthetic/README.md` gains *The `calendars` block* beside *The
`driving_path` block* it is modelled on, and the generator README gains the paragraph that
sits with 032's free-float one. The two landmine strings needed no correction, and every
claim they make **about the file** is now a number its golden carries — the two shifts
either side of the lunch break, the two closures, the half day bought back, the empty
`day_hr_cnt`, the 56-hour week over a pattern working 40. 032's rule is satisfied by the
block rather than by a sweep.

### Residue

- The block is now the **specification the product's TS parser must satisfy for
  calendars**, and it is the first part of the corpus that states working-time meaning at
  all. Nothing here writes that parser; 012's scope line holds.
- **Three-shift days remain unemitted** — 038's residue, unchanged. `buildClndrData`
  takes any number of shifts and the golden and the decoder both handle them, so this is
  a one-line catalogue change whenever a fixture wants it. `CA_Rsrc` calendars are still
  unobserved anywhere.
- `hours_per_working_day` is `null` in the decoder where a calendar's worked days are not
  all the same length. No fixture produces one, so that branch is asserted by nothing —
  which is exactly the defect this ticket was filed about, one level smaller. It is a
  guard against a first-day guess rather than a value anything reads, and a fixture with
  a short Friday would close it.

> **Amended 2026-08-08** by [What does `f|00:00|s|00:00` mean?](048-elapsed-calendar-semantics.md).
> The decoder is right about everything it was built to be right about, and is **missing one rule and
> wrong about one**. Missing: **a shift finishing at `00:00` runs to the end of the day**, so
> `shiftHours`'s subtraction returns 0 where P6 means 24, on the calendar that appears in **136 of
> 138** real calendar-bearing files. Wrong: *"a shift node carrying no `s`/`f` pair is an error rather
> than a silently empty day"* was chosen against a shape nobody had seen, and the shape exists — one
> real export writes `(0||2()())`, an empty shift slot, **eleven times**, and in that file empty slots
> are how a **non-working day** is written, three per day on Sunday and Saturday. It must become a
> skip, with a day's `works` meaning *has at least one populated shift* rather than *has children*.
> Both are live defects: the same file is one of only **2 of 563** real rows the decoder cannot read
> at all. The residue *"`hours_per_working_day` is `null` where a calendar's worked days are not all
> the same length… that branch is asserted by nothing"* is **closed by 048's fixture**, whose third
> row carries one 16-hour day beside four 8-hour ones and is the corpus's first ragged week — and it
> is there for an unrelated reason, which is the cheapest way that residue could have gone. Every
> measurement in this ticket stands; **not one number moves**, because no corpus shift finishes at
> midnight. Filed as [051](051-unparsed-clndr-shapes.md) and [052](052-end-of-day-shift-rule.md).

> **Amended 2026-08-08** by [047](047-report-duration-working-days.md). Item 4's `unavailable` comes
> off on 25 of 29 files, and this ticket's reason string survives **unchanged where it was right** —
> `missing-calendar` and `enc-zeroed-file` keep *no `CALENDAR` table, so there is no shift pattern to
> convert on* — while the per-file *"N calendars in the file and no rule for which one"* is gone,
> there being a rule. The `--verify` assertion this ticket added is replaced by a stronger one on 27
> more files. This ticket's own arithmetic is **reproduced exactly, post-049**: `wbs-flat` 328
> working days and `enc-cp1252-currency` 80, and the 460 and 110 in the seven-day column turn out to
> be the **inclusive** day count, which is the convention 047 adopted and which this ticket used
> without naming. The decoder is unchanged and now has a second reader standing on it: `measure.mjs`
> walks 1899-12-30 day serials while `generate.mjs` walks `Date`s against the packed week, sharing no
> line, for this ticket's own reason.
