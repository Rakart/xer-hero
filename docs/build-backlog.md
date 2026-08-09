# Build backlog

Work that is **real but not spec**. Every item here was ruled out of scope of the
[wayfinder map](wayfinder/map.md) whose destination is the specification, not because it is
unimportant, but because none of it is a *decision the spec is waiting on*. The map is an index of
decisions; this is an index of jobs.

Nothing here blocks starting the build. Each item is either a job for the day the build starts, a
job that needs a human holding something the agent cannot hold, or a correction to the development
corpus that the product does not read.

Ruled out of scope 2026-08-08, when the map reached its destination.

---

## A. Needs a human holding something

The agent physically cannot do these — they need a card, a licence, or a handset.

| Ticket | What it needs | Blocks |
|---|---|---|
| [Register the domain and provision the production estate](wayfinder/tickets/026-register-domain-and-provision.md) | a card, a browser session, an account holder | **Everything.** Sixteen ordered steps; five closed decisions are unimplementable until it lands, including Clerk production and therefore sign-in, presign, upload, votes, bookmarks and `/me`. Carried in full as the day-one runbook in spec §4. |
| [Does P6's importer accept the fixtures?](wayfinder/tickets/041-p6-importer-acceptance.md) | a P6 licence | Nothing. The corpus works as a parser regression net either way; what is untested is the claim that a *generated* file is a faithful P6 artifact. |
| [Is progress override what confines P6's Longest Path to remaining work?](wayfinder/tickets/061-progress-override-longest-path.md) | a P6 licence (two exports) | Nothing. Would buy a file-checkable caveat on "the flag is the only ground truth". n = 1 today. |
| [Does mobile Safari survive the cap-sized scan?](wayfinder/tickets/046-ios-safari-scan.md) | ten minutes on a borrowed iPhone | Nothing. Residual risk only: if the tab dies, the blind-upload fallback that 020 declined reopens. Every paid alternative is worse value — a real-device cloud needs a public URL that does not exist until 026 lands, and the iOS Simulator runs the real engine without the real memory ceiling. |

026 is the only one of these that gates the build. The other three are marked *nothing waits on it*
in their own text.

---

## B. Development corpus and parser engineering

The fixture generator, its goldens and `measure.mjs` are a **development instrument**, not product
code — the product never reads them. They are already good enough to serve as CI's only test
corpus. These are corrections and extensions that raise their fidelity.

This is also where the map's momentum went: each of these tickets closed by spawning two more. They
are collected here so that stops being the effort's default motion.

| Ticket | The job |
|---|---|
| [Three real `clndr_data` shapes nothing in the estate parses](wayfinder/tickets/051-unparsed-clndr-shapes.md) | Three live decoder defects, **two of them silent**: an anonymous root wrapper (the only 2 of 563 real rows that fail to decode), twelve-hour clock times that `Number('00 PM')` swallows into a wrong answer, and empty shift nodes that are how one file writes a non-working day. |
| [Implement the end-of-day shift rule and build `cal-elapsed-24h`](wayfinder/tickets/052-end-of-day-shift-rule.md) | 048 decided; nothing is built. Four edits and one fixture, specified to the byte in its asset. Sequence after 051 so it rebases once. |
| [A `CALENDAR` row the corpus expects **not** to decode](wayfinder/tickets/059-undecodable-calendar-fixture.md) | The `issues[]` warn branch that the contract has carried since v1 is now emitted code that **no fixture produces**. Do it inside 051, whose anonymous root wrapper is the right real blob to fixture rather than an invented one. |
| [No corpus programme contains an exception **working** day](wayfinder/tickets/060-exception-working-day-in-window.md) | The branch that adds a working day back is asserted by the calendar block and spent by nothing. One catalogue entry, one golden number. |
| [Bring the readable walk's floor onto the written-anchor-kind test](wayfinder/tickets/056-written-anchor-kind-floor.md) | 054 decided the written-anchor-kind test and deliberately did not implement it. Neither half of the fixture is executable by the corpus *or* the 139 real exports — **0 of 72** real successors carrying a rescued `FF` have one live predecessor — so the branch is reasoned about rather than run. |
| [Re-run the MPXJ read over the current corpus](wayfinder/tickets/055-rerun-mpxj-read.md) | An independent third-party read is the only thing standing between the corpus and a golden written by the same code that wrote the file. 049 moved 370 date values across 23 files, so the run's byte-level finding no longer has its bytes. Run once the byte-moving queue drains. |

### Code that is behind its own decisions

Writing spec §8 compared the decided rules against `tools/` line by line and found four places where
the code has not caught up. None of them is a product defect — the product does not read this code —
but each is a rule the corpus is currently unable to fail.

- **`sameKind` still keys on date-equality**, not on `writtenKind`/`task_type` — the replacement
  054 decided and 056 was to implement.
- **`shiftHours` has no end-of-day rule**, which is 052.
- **The three undecodable `clndr_data` shapes are unimplemented and unfixtured**, which is 051.
- **`makeReadableDrivers` has no free-float filter at all.** This one is worth stating plainly: the
  ship gate's headline — 98.6% recall at 99.9% precision — was measured by a tracer with the
  free-float corroboration **switched off**. The gate passed anyway, which is a stronger result than
  the one claimed rather than a weaker one, but the figure does not describe the algorithm the spec
  specifies. Re-measure with the filter wired before quoting it as the specified tracer's score.

### Decided but unbuilt

Two tickets closed in the final session leaving work behind them:

- **Rename `span_calendar_days` → `duration_calendar_days` and assert it.** From
  [058](wayfinder/tickets/058-span-difference-versus-count.md). `measure.mjs` emits the inclusive
  count, each golden's `assertions` block gains the field, and the mutation row — *span counted
  exclusive of its finish* — must go from scoring 29/29 today to failing 28 of 29. Plus the
  `459 → 460` correction in 043's table, 045's body, and the 043 amendment in 006 and its asset.
  No `.xer` byte should move.
- **The milestone-instant figure outside the map.** From
  [057](wayfinder/tickets/057-correct-milestone-instant-figures.md). The corrected `96.4% / 28,695`
  survives in **seven occurrences across six documents**, four of them beside code — including the
  `rowFinish`/`rowStart` doc comment in `lib/calendar.mjs`, the only place it is cited *as the
  reason for the code*. Every rule they justify survives at 98.3%, so this is relabelling, not
  reopening.

---

## C. Deferred product work

Held in the map's **Not yet specified** section rather than here, because these are still questions
rather than jobs: revision diff, the Gantt viewer, the resource-units S-curve, near-duplicate
detection, curation, a public read API, cross-project querying, analytics, and how authored sector
templates get made. Each carries the constraints already fixed for it, so none starts cold.

---

## D. Left open by the first build

Added 2026-08-09, when the application was built against this spec in one session. Everything
below was **found by the two-axis review and deliberately not fixed**, either because it needs the
production estate that 026 gates, or because it is a tidy rather than a defect. Nothing here is
known to be wrong at runtime; the defects the same review found *were* fixed.

**Waiting on the production estate (026).**

- **§10.5's canary is unbuilt.** The spec reserves *"a programme uuid alongside the reserved
  revision uuid"* as committed constants so the sweep can assert the blob key without reading it
  back from configuration. Neither uuid is minted and no `edge.canary.*` assertion exists. It
  asserts production-only edges, so it cannot be written honestly before there is a production.
- **No production `robots.txt` monitor.** §7.16 wants the bucket-root assertion re-run every
  fifteen minutes against the live blob host. The local `edge-contract` job covers the CORS and
  presign half; the CDN half has no origin to point at yet.

**Real but not urgent.**

- **The minimal `derived.json` can still exceed the 150 KB ceiling.** §3.11's degraded object drops
  the exemplars, the S-curve and the codes but keeps three mixes keyed on **open** enumerations
  (§2.4). A file with pathological enum churn would leave even the minimal object over the ceiling,
  and the programme page reads it with a hard byte cap, so the page would throw rather than
  degrade. Cap the mixes, or make the reader tolerate the overflow.
- **One helper, three spellings.** A one-decimal percentage is written out as `pct` in
  `derive/dcma.ts` and `derive/index.ts` and as `onePlace` in `derive/tracer.ts`. `MONTHS` and the
  naive-date regex are restated across `programme/format.ts`, `shelf/shelf-format.ts` and
  `derive/distributions.ts`, while `derive/dates.ts` already holds the canonical isomorphic
  parser. `linePath` exists twice, in `programme/chart.ts` and `shelf/RowGraphics.tsx`, with
  divergent rounding. The `assert` + failure-counter pair is verbatim in both CI scripts.
- **A calendar and its exceptions travel as two parameters** through five functions in
  `derive/dates.ts`, and the exception index is rebuilt on each call with a linear scan inside the
  working-day walk. One pre-indexed calendar type would be faster and would stop the pair drifting
  apart.
- **`me-index.ts` switches on `MeState` twice**, once for the chip and once for the clause. One
  `Record<MeState, …>` says it once.
- **The `/api/viewer` payload carries no uploader votes**, so the vote pill on `/u/{handle}` cannot
  render pressed for someone who has already voted. It cannot inflate the count — the key is
  unique and the endpoint returns the authoritative number — but a returning viewer sees an
  unpressed control. §6.13 defines the payload without them.
- **Toolchain pins deviate from §10.2**, deliberately and visibly: `pnpm@11.10.0` rather than
  pnpm 9, and `node >=22` rather than a pin. Both were matched to the machine the build ran on.
  §10.2 marks itself overturnable.
- **§6.3's empty-state copy is paraphrased** rather than quoted, and the sort control puts
  Relevance first where §6.3 tables it last.

---

## What this list is not

It is not a quality ranking and not a launch checklist. The only item that gates a v1 launch is
**026**. Everything else can be picked up when it becomes the most useful thing to do, or left
alone.
