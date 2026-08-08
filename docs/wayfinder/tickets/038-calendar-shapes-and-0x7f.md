---
id: 038
title: Correct the clndr_data rules and calendar goldens against real P6 evidence
type: task
status: closed
assignee: carlo
blocked_by: [021]
---

## Question

[021](021-verify-fixtures-in-p6.md) confirmed the three calendar shapes the corpus flagged
`speculative: true` — multi-shift days, exception *working* days, the `VIEW` node — and in
doing so found that **the rule written around them is wrong**, plus two real shapes nothing
in the estate emits ([evidence](assets/p6-substitute-validation.md) §2).

Nothing decides here. This is the mechanical follow-through.

**Do:**

1. **Correct [xer-format.md](assets/xer-format.md) gotcha 4.** It says *"`0x7F` is
   structural inside `clndr_data`, not text"*. Real `CA_Project` calendars contain **zero**
   `0x7F` bytes and parse fine; `CA_Base` calendars in the same file carry 34–352 with
   indentation. Both yield the same tree. The correct rule: **only the parentheses carry
   structure; `0x7F` and whitespace are insignificant.** Fix the surrounding prose at
   lines ~340 and ~507 too, which state the separator claim twice.
2. **Add the two unemitted shapes to the parse rules.** Shift attributes are
   **order-free** — real files emit both `s|08:00|f|16:00` and `f|12:00|s|8:00` — so they
   must be read as a key-value bag, never positionally. And **the hour is not
   zero-padded**: `s|8:00` occurs. This is the `%F` header lesson one level down and
   deserves the same emphasis.
3. **Record that `day_hr_cnt` and `week_hr_cnt` are untrustworthy.** Empty on some real
   calendars, and where populated they can contradict the day pattern (a seven-day
   eight-hour calendar declaring `week_hr_cnt = 40`). Neither is derivable from the other
   and neither should feed a computed stat.
4. **Extend the generator** (`tools/fixture-gen/lib/calendar.mjs`) so the corpus carries a
   calendar in the **flat, `0x7F`-free, `f`-first, unpadded** form alongside the current
   one. Today `buildClndrData` can only emit one serialisation, and it is the one that
   would still parse if the wrong rule were implemented — so the corpus cannot currently
   fail a parser that gets this wrong. That is the whole point of adding it.
5. **Drop `speculative: true` from `cal-clndr-data.expected.json`** and rewrite its
   `landmine` text, which currently asserts the false `0x7F` rule and says the expectation
   is only that *"the parser survives and reports what it saw"*. Both halves are now
   stronger: the shapes are confirmed real, so the golden can assert meaning.
6. Update `fixtures/synthetic/README.md` — the *Three fixtures are speculative* section and
   the *Not verified against P6* section are both stale.

Regenerating fixtures changes bytes, so the `file.sha256` and `file.bytes` in every golden
touched must be rewritten from the generator, and `node tools/fixture-gen/measure.mjs
--verify` must pass across the corpus.

## Resolution

**The rule was wrong in the one direction that costs a parser data.** `0x7F` was charted
off base calendars, which carry it in quantity, and promoted from what it looked like to
what it was assumed to do: *"`0x7F` is structural inside `clndr_data`, not text"*.
[021](021-verify-fixtures-in-p6.md) read the **project** calendars sitting beside them in
the same files and found **zero** `0x7F` bytes, one flat unindented string apiece,
decoding to the same tree as the indented base calendars they were copied from.

The corrected rule, in one sentence: **inside `clndr_data` only the parentheses carry
structure, and `0x7F` and whitespace are insignificant.**

Two shapes travel with the flat form, and both are the same mistake one level further
down. **Shift attributes are order-free** — `f|12:00|s|8:00` occurs beside
`s|08:00|f|16:00` in one file — so the attribute group is a key-value bag and must never
be read by position; and **the hour is not zero-padded**, `s|8:00`, so a `\d\d:\d\d` time
pattern drops most of a day's shifts and reports a shorter working day without erroring.
This is 002's own never-index-by-position rule, which was written about the `%F` header
and turns out to govern the innermost node of the calendar blob as well. Alongside them
sits a metadata trap: `day_hr_cnt` and `week_hr_cnt` are empty on some real calendars and
contradict the day pattern on others, neither is derivable from the other, and the shift
pattern in `clndr_data` is the only trustworthy statement of a calendar's day length.

### What changed

[`xer-format.md`](assets/xer-format.md) carried the separator claim three times and now
carries the corrected rule in all three places. *Encoding* said `0x7F` "is **not text**";
it now says it is layout — neither text nor structure, and possibly absent. The
*Calendars* opening no longer leads with the separator: it leads with the parentheses,
then states the base/project split with the measured figures (34–352 DEL bytes on a base
calendar, zero on a project calendar), and shows the flat form beside the rendered
indented one so the contrast is on the page rather than in the prose. The day and
exception bullets gained the multi-shift day (the lunch break, and three-shift days
across the wider set), the order-free attribute bag, the unpadded hour, the exception
*working* day with its real frequency, and the `VIEW` node. A new subsection,
*`day_hr_cnt` and `week_hr_cnt` cannot be trusted*, states the metadata trap and sends any
computed day length to the shifts. The old *Caveat* is kept and marked superseded rather
than deleted — it is the record of what was open, and of the fact that the shapes were
guessed correctly while the rule around them was not. Gotcha 4 is rewritten; gotchas 16,
17 and 18 are new (order-free attributes, unpadded hours, the untrustworthy hour counts);
*What remains unverified* strikes the calendar-edge-cases entry and says what settled it.
Two smaller corrections follow from the same finding: the `CALENDAR` key-table entry now
warns about the hour counts, and *Dates and durations* no longer tells a reader to convert
hours to days with `day_hr_cnt`.

[`lib/calendar.mjs`](../../../tools/fixture-gen/lib/calendar.mjs) — `buildClndrData` gains
three options, `layout` (`indented` | `flat`), `shiftAttrs` (`start-first` |
`finish-first`) and `padHours`. The first five options describe what a calendar **means**;
these three describe how it is written down, and every combination must decode to the same
tree. That property is cheap to hold because both forms come off the same node emitter:
the indented form joins the emitted lines on a `0x7F` pair, the flat form strips the
indents and joins on nothing. The file's header comment, which stated the wrong rule and
called the three shapes speculative, is replaced by the corrected rule with its evidence
cited.

[`catalogue.mjs`](../../../tools/fixture-gen/catalogue.mjs) — `cal-clndr-data` loses
`speculative: true` and its landmine is rewritten. It no longer asserts the false rule and
no longer says the expectation is that "the parser survives and reports what it saw": the
shapes are confirmed, so the text states what the two calendars **mean** — a five-day week
worked in two shifts either side of a lunch break, closed on 2026-01-01 and 2026-12-25 and
bought back as a half day on 2026-01-03, and a seven-day week with no exceptions and no
`VIEW` node. Its `.xer` is byte-identical (32,837 bytes, sha256 `6666a787…`); only the
golden's metadata moved.

The new fixture is **`cal-flat-no-0x7f`** (33,919 bytes), placed next to `cal-clndr-data`
rather than at the end of the catalogue so the two calendar fixtures read together. It
carries **one calendar written twice**: the first `CALENDAR` row is the indented `CA_Base`
serialisation, the second is the `CA_Project` copy in the form real exports use — one flat
line, not one `0x7F` byte, `f|12:00|s|8:00`, `s|8:00`. Both rows must decode to the same
working calendar, and that identity is the assertion; anything differing between them is
layout. The second row additionally declares an empty `day_hr_cnt` and a 56-hour week over
a pattern that works 40, which is the metadata trap in the only place it can be caught by
a file rather than by a document.

`measure.mjs --verify` passed **25/25** when this landed. A later run over a corpus two
sessions had grown to 27 files reported 26/27, the single failure being another session's
in-flight `enc-zeroed-file`; both calendar fixtures pass in either run, and regenerating
them twice gives byte-identical output. The clean full verify belongs to the integrating
session.

### What the new fixture proves that the old corpus could not

Verified rather than assumed, with three readers run over both fixtures — **A** the old
rule (split on `0x7F 0x7F`, one node per record, shifts matched positionally as
`s|HH:MM|f|HH:MM`), **B** the separator claim corrected but the attributes still read
positionally with a padded hour, and **C** the corrected rule throughout. A had to parse
the indented form, or the exercise would have measured a bug in the reader rather than a
defect in the rule.

| Reader | `cal-clndr-data`, both calendars | `cal-flat-no-0x7f` row 1 (`CA_Base`) | `cal-flat-no-0x7f` row 2 (`CA_Project`) |
|---|---|---|---|
| **A** old rule | agrees with C | agrees with C | **throws** — one record carrying 25 nodes where the separator promises one |
| **B** parentheses structural, attributes positional | agrees with C | agrees with C | **silently wrong** — recovers days 2–6 and **no shifts at all**, so the day length comes back `NaN` |
| **C** corrected | — | — | days 2–6, 8 hours a day in two shifts, `VIEW` present, exceptions 46023, 46381 and 46025 the last of them worked |

Under C the two rows of `cal-flat-no-0x7f` decode to **the same calendar**, which is the
fixture's whole point.

The first column is the finding the ticket predicted: **reader A reproduces the correct
answer on every calendar in `cal-clndr-data`**, so the corpus as it stood could not fail a
parser implementing the rule that was wrong. That is not a weakness of the fixture — it is
what happens when a generator can emit only one serialisation and it happens to be the
forgiving one.

Reader B is the more instructive failure and the reason gotchas 16 and 17 are separate
entries rather than a rider on gotcha 4. It does not throw. It reports a five-day working
week with zero working hours in it, which reaches a user as a duration or a working-day
count and not as an error — precisely the silent-corruption shape 002 named for positional
`%F` reads.

The harness is throwaway and lives in the session scratchpad, not the repo, following
021's own practice: it is a parser, and the product parser is deliberately not written
yet. Anything permanent here belongs in the golden, not in a second reader — see the
residue.

### Residue

The golden asserts the calendars' meaning **in prose only**. `describe()` in
`generate.mjs` writes no calendar block, so `measure.mjs --verify` still checks
`calendar_count` and nothing else, and `generate.mjs` was out of scope for this ticket. A
`calendars: [...]` block — worked days, shifts, hours per working day, and exceptions with
their decoded dates and whether each is worked — would let the corpus compare a *decoded*
calendar against intent, and would turn `cal-flat-no-0x7f`'s "both rows mean the same
thing" from an argument into a test. Both calendar fixtures are shaped for it. Worth a
ticket; it is the natural companion to the free-float read-back 032 added.

> **Amended 2026-08-08** by
> [The goldens assert calendar meaning in prose only](043-calendar-golden-block.md). The residue is
> closed, and this ticket's own measurement becomes the corpus's. The golden carries a `calendars`
> block written from the working-time model the generator packs, `--verify` decodes the emitted blob
> and compares, and `cal-flat-no-0x7f`'s "both rows mean the same thing" is an assertion rather than
> an argument — the only decode-against-decode check in the corpus. The wrong-reader scores this
> ticket took with a throwaway harness are now reproducible from the committed goldens: reading the
> shift attributes positionally scores **26/27**, matching `\d\d:\d\d` scores **26/27**, and treating
> `0x7F 0x7F` as a record separator scores **2/27**. The `measure.mjs` amendment below — *the reason
> should read `'no calendar decoder in the measurement harness'`* — was applied and is now **itself
> false**, because there is a decoder. It reads `'N calendars in the file and no rule for which one a
> programme's span is measured on'`, with `'no CALENDAR table, so there is no shift pattern to
> convert on'` where there is none. The `state` never moved.

Three-shift days occur in the real set and the corpus emits at most two.
`buildClndrData` takes any number of shifts, so this is a catalogue change whenever a
fixture wants it, not a generator limitation. `CA_Rsrc` calendars remain unobserved
anywhere.

### README delta

`fixtures/synthetic/README.md` is untouched here by instruction. Four changes, quoted
against the current text.

**1 — the file count in *What is here*.** Replace

> `| corpus/*.xer | correctness | 24 files, ~20 activities each, one known landmine per file |`

with

> `| corpus/*.xer | correctness | 25 files, ~20 activities each, one known landmine per file |`

25 counts this ticket's addition only; 039 and 040 may move it again.

**2 — *The landmines* table.** Replace the row

> `| cal-clndr-data | 0x7F separator runs, multi-shift days, exception **working** days, the VIEW node |`

with these two:

> `| cal-clndr-data | The indented CA_Base serialisation: 0x7F runs, multi-shift days, exception **working** days, the VIEW node. All four confirmed against real exports by [021](../../docs/wayfinder/tickets/021-verify-fixtures-in-p6.md), so the golden asserts what they mean rather than that the parser survived them |`
>
> `| cal-flat-no-0x7f | One calendar written **twice** — the indented CA_Base form and the flat CA_Project form real files carry beside it. The second row has no 0x7F at all, writes shift attributes **finish first** (f\|12:00\|s\|8:00) and does not pad the hour (s\|8:00); both rows must decode to the same calendar. It also carries an empty day_hr_cnt and a week_hr_cnt contradicting its own pattern, because neither column can be trusted |`

**3 — *Three fixtures are speculative*.** `cal-clndr-data` leaves this section: its
`speculative` flag is gone from the catalogue and from the golden. The section's remaining
subject is 039's and 040's to settle, so the heading and the surviving sentences should be
rewritten once all three land. My half, verbatim, for whoever writes it:

> `cal-clndr-data` was speculative because the format research could not settle multi-shift
> days, exception working days or the `VIEW` node by reading. All three are real, all three
> were guessed correctly, and what was wrong was the *rule* written around them — `0x7F` was
> charted as a structural separator and is layout. Both are corrected, and the corpus now
> carries `cal-flat-no-0x7f` to enforce the correction, because the old fixture parses
> identically under the wrong rule and could never have failed it.

The block-quote beginning **"Stale as of 2026-08-08, and left in place until the fixtures
are corrected"** should be **deleted only once 038 and 039 have both landed** — it names
both. Its claim about `cal-clndr-data` is discharged by this ticket.

**4 — *Not verified against P6*.** The MPXJ figures predate the fixtures the three
correction tickets are adding, and saying "all 24 corpus files" while the corpus has more
than 24 quietly extends a measurement over files it never covered. Replace

> They have, however, been read end to end by **MPXJ** — an independent third-party
> implementation of the format — with zero failures across all 24 corpus files, `sparse-150`
> and all three perf fixtures, agreeing with the goldens exactly on 20 of 24 and differing
> only where a fixture's landmine says it should.

with

> They have, however, been read end to end by **MPXJ** — an independent third-party
> implementation of the format — with zero failures across the 24 corpus files that existed
> on 2026-08-08, `sparse-150` and all three perf fixtures, agreeing with the goldens exactly
> on 20 of 24 and differing only where a fixture's landmine says it should. The fixtures
> added by the corrections that followed — `cal-flat-no-0x7f` among them — were **not** in
> that run.

### Amendments for the integrating session

**[002](002-xer-file-structure.md), §*Calendars, decoded*.** The false rule's origin. Its
opening sentence — *"`clndr_data` is a nested paren structure using `0x7F 0x7F` as its
record separator"* — and its closing one — *"Multi-shift days and exception working days
remain unverified"* — are both retired. Append:

> **Amended 2026-08-08 by [038](038-calendar-shapes-and-0x7f.md).** `0x7F 0x7F` is **not** a
> record separator; it is layout. Base calendars are indented and carry runs of it, the
> project calendars in the same files carry none at all and sit on one flat line, and both
> decode to the same tree — only the parentheses carry structure. The shift grammar above is
> also narrower than the format: attributes are an **order-free key-value bag**
> (`f|12:00|s|8:00` occurs beside `s|08:00|f|16:00`) and the **hour is not zero-padded**
> (`s|8:00`), which is this ticket's own never-by-position rule one level further down than
> anybody looked. Multi-shift days and exception *working* days no longer "remain unverified"
> — [021](021-verify-fixtures-in-p6.md) found both in real exports, heavily used, along with
> the `VIEW` node. And `day_hr_cnt` / `week_hr_cnt` join the fields that cannot be trusted:
> empty on some real calendars, contradicting the day pattern on others, and never the source
> of a day length.

**[002](002-xer-file-structure.md), §*Still unverified*.** Replace

> Multi-project exports (no fixture — behaviour genuinely unknown), escaping, calendar edge
> cases, full enum sets, baselines, notebook topics, and any P6 newer than 8.3 against
> current v25.

with

> Multi-project exports (no fixture — behaviour genuinely unknown), escaping, full enum sets,
> baselines, notebook topics, and any P6 newer than 8.3 against current v25. Calendar edge
> cases left this list on 2026-08-08 — see the amendment above.

**[map.md](../map.md), the 002 entry.** Its amendment paragraph is already correct; the
one-line summary above it still says *"`clndr_data` decoded (`0x7F` separators, epoch
1899-12-30)"*, which is the retired claim in the sentence a reader skims. Replace that
clause with *"`clndr_data` decoded (parenthesised nodes, `0x7F` layout only, epoch
1899-12-30)"*.

**[map.md](../map.md), *Decisions so far*.** This ticket's pointer, to append:

> - [Correct the clndr_data rules and calendar goldens against real P6 evidence](tickets/038-calendar-shapes-and-0x7f.md)
>   — the mechanical half of 021. `xer-format.md` gotcha 4 is corrected in all three places
>   it was stated: **only the parentheses carry structure inside `clndr_data`; `0x7F` and
>   whitespace are insignificant**. Two shapes nothing emitted are now written down and
>   fixtured — **order-free shift attributes** and the **unpadded hour** — as is the trap that
>   `day_hr_cnt`/`week_hr_cnt` cannot supply a day length. `buildClndrData` learned to emit
>   either serialisation, and the new fixture **`cal-flat-no-0x7f`** carries one calendar
>   written twice, `CA_Base` indented and `CA_Project` flat, which must decode identically.
>   That fixture was needed because the old one was not enough: a reader built to the wrong
>   rule reproduces the right answer on **every** calendar in `cal-clndr-data`, throws on the
>   flat row of the new one, and — with only the separator claim fixed and the attributes
>   still positional — returns a five-day week with **no working hours in it**, silently.
>   `cal-clndr-data` drops `speculative: true`; corpus verifies 25/25.

**[012](012-large-synthetic-fixture.md).** The corpus wish-list bullet *"**`0x7F`
separator runs** inside `clndr_data`"* should read *"**`0x7F` layout runs** inside
`clndr_data` — and, since 038, a second calendar carrying none at all"*.

**[010](010-stack-hosting-auth.md).** The phrase *"the `0x7F` calendar separators"* in the
synthetic-corpus paragraph should read *"the `0x7F` calendar layout runs"*.

**[032](032-generator-free-float-by-type.md).** Its landmine-verification table row reads
*"`0x7F` structural; three calendar shapes"*. The verdict and the count are both still
right — `cal-clndr-data`'s bytes did not move, so 82 occurrences stands — but the claim
being verified has been corrected. Retitle the row *"`0x7F` layout, not structure; three
calendar shapes"* and leave the verdict cell alone.

**`tools/fixture-gen/measure.mjs`.** Line 313 reports `duration_working_days` as
`{ state: 'unavailable', reason: 'calendar decode unverified' }`. The decode is no longer
unverified; what is missing is a decoder, not evidence. The reason should read
`'no calendar decoder in the measurement harness'`. Out of scope here because the file is
shared, and it is cosmetic — the state is right either way.

**`tools/fixture-gen/catalogue.mjs`, the `missing-calendar` entry.** Its landmine says
*"Without a calendar there is no `day_hr_cnt`, so working-day conversion has no basis."*
The conclusion holds but the reason is now the wrong field: without a calendar there is no
**shift pattern**, and `day_hr_cnt` would not have supplied a day length anyway. Suggested:
*"Without a calendar there is no shift pattern, so working-day conversion has no basis —
and `day_hr_cnt` was never the answer either (xer-format.md gotcha 18)."* Left alone here
because the entry is not mine under this ticket's split.

**`docs/wayfinder/tickets/assets/xer-fixtures.local.md`.** Local-only, so noted rather than
edited: it still carries *"The `0x7F` runs inside calendar data need identifying before the
calendar"* as an open item. They are identified.

> **Amended 2026-08-08** by
> [What calendar is `duration_working_days` measured on?](045-duration-working-days-calendar.md). The
> `day_hr_cnt`/`week_hr_cnt` trap has a case this ticket did not name — a stock elapsed-duration
> `CA_Project` calendar, in **10 of 14 real files**, whose seven days each carry `f|00:00|s|00:00`
> and which declares `day_hr_cnt = 24`, `week_hr_cnt = 168`. It is the flat, `0x7F`-free,
> finish-first form this ticket fixtured — so that shape is **real rather than merely legal** — and
> it decodes to **seven working days of zero hours**. The one calendar where `day_hr_cnt` is the only
> statement of a day length is therefore exactly the one this ticket forbade reading it from. The
> corpus carries no such calendar, and what the shape means is
> [048](048-elapsed-calendar-semantics.md).

> **Amended 2026-08-08** by [What does `f|00:00|s|00:00` mean?](048-elapsed-calendar-semantics.md).
> This ticket recorded `day_hr_cnt` and `week_hr_cnt` together as *"empty on some real calendars, and
> contradicting the day pattern on others"*. Measured across all **139** exports and **563 `CALENDAR`
> rows** the two behave nothing alike, and the difference is what settled 048. **`week_hr_cnt`
> contradicts the pattern on 290 of 561 rows** — the seven-day eight-hour calendar declaring 40 is
> real and there are 154 of it. **`day_hr_cnt` contradicts it on none**: it agrees on **561 of 561**
> once a shift finishing at `00:00` is read as running to the end of the day, and its only apparent
> disagreements were the 137 elapsed calendars this ticket's decoder read as zero-hour. The parsing
> rule is unchanged and now has Oracle behind it — the four columns are documented **conversion
> factors** for entering and displaying durations, not a statement of worked time, and a new calendar
> defaults to 8 hours a day whatever its shifts say — so nothing may still read a day length from
> them. Two smaller corrections: the columns are not merely *empty* on some exports but **absent from
> `CALENDAR`'s `%F` list entirely** on one P6 6.2 file, and the flat `CA_Project` form this ticket
> fixtured **carries no `Exceptions` node at all** on 271 of 563 real rows, with `VIEW(ShowTotal|Y)`
> occurring beside the documented `N`. The three-shift-day residue is unchanged; `CA_Rsrc` calendars
> remain unobserved.
