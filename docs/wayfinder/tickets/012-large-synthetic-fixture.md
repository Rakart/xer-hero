---
id: 012
title: Get a large synthetic fixture for perf work
type: task
status: closed
assignee: carlo
blocked_by: [002]
---

## Question

The fixture set from
[Get real .xer files to work against](001-get-real-xer-files.md) tops out at ~1,750
activities. [The project detail page](008-project-detail-page.md) is specified
against 20,000, because that is the size at which the activity table stops being a
`<table>` and starts being a virtualisation problem. Right now that number is a
guess with nothing to test it on.

Produce a large `.xer` to design and measure against. Blocked on the format
research because generating a file P6 and the parser both accept requires knowing
the record structure, the `%F` header contract per P6 version, and the referential
rules between `TASK`, `TASKPRED`, `PROJWBS` and `CALENDAR`.

Settle and then do:

- **Synthesise or source?** Generating one from the existing fixture — replicating
  the WBS subtree with fresh ids until the activity count is reached — is fast and
  contains no real data, so it can live in the public repo. Sourcing a genuinely
  large real programme is more faithful but reintroduces the confidentiality
  problem. Recommend synthesising.
- **Realism that matters.** Random activities produce an unrealistic logic graph
  and a meaningless critical path. The generator should preserve plausible
  relationship density (the real fixture runs ~1.6 relationships per activity),
  a comparable WBS depth, and a similar activity-code assignment ratio — recalling
  that `TASKACTV` was ~14 rows per activity in the real file and is the table that
  actually drives file size.
- **The sizes to produce.** At least a 20,000-activity file. A ~150-activity file
  is worth generating in the same pass, to check the storefront card and the
  charts do not look broken when there is barely any data.
- **Verify it is real enough.** The generated file should open in P6 without
  error. If it will not, it is not a valid perf fixture — it is only a parser
  fixture, and the resolution should say so plainly.

Record the generator and the resulting measurements (bytes, gzipped bytes, row
counts per table, parse time) so they can feed
[What does storage actually cost?](004-storage-cost-model.md) and the runtime
budget in [Stack, hosting and auth provider](010-stack-hosting-auth.md).

Synthetic fixtures contain no client data and **should** be committed — add an
exception to `.gitignore` for them.

## Scope widened 2026-08-07 by [Stack, hosting and auth provider](010-stack-hosting-auth.md)

The title undersells this ticket now. It is not only perf work: **synthetic fixtures
are the only test corpus CI will ever have.**

Real `.xer` files are gitignored permanently because they are commercial data, so
GitHub Actions can never run the parser against one — and the parser is the single
component where a silent regression corrupts every row it touches. The small
correctness corpus and the large perf file are the same generator, so they are the
same ticket.

Additional deliverable: **a small correctness corpus**, tens of rows per file,
each file deliberately exercising a known landmine rather than being realistic:

- **`0x81` bytes**, which make strict CP1252 decoding throw — 28,774 occurrences in
  Fixture A progressed, 31,485 in Fixture B, and **zero** in Fixture A baseline, so a
  test that only reads the baseline would miss it entirely.
- **`0x7F` layout runs** inside `clndr_data` — and, since 038, a second calendar carrying
  none at all.
- **Both P6 6.0 and 8.3 `%F` header field sets** for the same table, which is the
  case the map-by-name-never-by-position rule exists for.
- **A missing table** — a file with no `TASKPRED`, or no `CALENDAR`.
- **`PROJWBS = 1`**, Fixture B's no-WBS shape, which broke assumptions once already.
- **A 100% not-started file and a fully-progressed file**, the two poles the derived
  contract's stats have to survive.

These are golden-file tests: input `.xer` committed, expected parser output committed
beside it, run on every PR **including forks** (fork PRs get no secrets, so CI must
need none). Real fixtures remain a local-only check the maintainer runs by hand.

The ~150-activity file already named above is a third thing again — a *rendering*
fixture for the sparse-data case, not a correctness one. Worth keeping distinct so a
"does the chart look broken" file is not mistaken for a parser assertion.

## Added 2026-08-07 by [Upload and ingest pipeline](011-upload-ingest-pipeline.md)

**A synthetic two-project file joins the correctness corpus.** 011 rejects
multi-project exports in v1, with the discriminator being **distinct `TASK.proj_id` >
1**, deliberately *not* `PROJECT` row count — a P6 export carrying baselines has
several `PROJECT` rows and must stay legal. The corpus therefore needs two files to
pin that boundary: one with activities under two `proj_id`s (must reject) and one with
extra `PROJECT` rows but a single owning `proj_id` (must ingest).

**The 20,000-activity file also gains a second job.** 011 set the v1 caps at **20,000
activities / 50 MB raw**, and explicitly recorded them as floors to be raised on this
ticket's evidence rather than as settled numbers. So the measurements that matter are
now: parse wall-clock and CPU, peak browser heap during a client-side parse (011 put a
full parse in the tab before upload), `derived.json` size against 006's 150 KB ceiling,
and `activities.json` size against 004's ~1.2 MB extrapolation.

## Resolution

**Synthesised, and the generator is the deliverable** — everything is in
[`tools/fixture-gen`](../../../tools/fixture-gen/README.md), the fixtures in
[`fixtures/synthetic`](../../../fixtures/synthetic/README.md), the full numbers in
[the measurement asset](assets/synthetic-fixtures.md).

Sourcing a large real programme was rejected, but not on the confidentiality argument
this ticket expected: 010 established that real fixtures are gitignored **forever**, so
a sourced file could never be the CI corpus either. Only a generator can be both the
perf file and the test corpus, which is what makes the two halves of this ticket one
deliverable rather than two.

**Delivered:**

- **16-file correctness corpus**, ~20 activities each, one landmine per file, each with
  a `.expected.json` golden written from what the generator *intended* to emit — never
  from parsing the result, because a golden produced by our own parser asserts nothing.
  Covers every landmine this ticket named plus the multi-project pair 011 asked for,
  external relationships, and the multi-line free-text case the format research called
  the most likely place a naive parser silently corrupts data.
- **`sparse-150.xer`**, the rendering fixture, kept deliberately distinct from the
  correctness corpus.
- **`perf-2k` / `perf-20k` / `perf-20k-dense`**, generated on demand rather than
  committed: they are a pure function of a seed, and 30–35 MB of git objects is a bad
  trade against a 419 ms regeneration.
- A measurement harness (`measure.mjs`) which is **explicitly not the product parser**,
  and which also round-trips the corpus against its goldens — `--verify` passes 16/16.

**Realism came from a real CPM pass.** Early/late dates, total float, free float and
the critical path are computed by forward and backward passes over the logic network.
Random dates would have produced a meaningless float histogram and a DCMA score that
measures noise, which would have made the file useless for both the detail page and the
quality checks. Densities (relationships, code assignments, resources, WBS nodes per
activity) are catalogue knobs set from the two real programmes, because the register
showed they vary more than 2× between them.

**Findings, in the order they matter:**

1. **20,000 activities and 50 MB are different limits and they do not line up.** The
   synthetic 20,000-activity file is 30.7 MB (Fixture B code density) / 35.0 MB
   (Fixture A density). But synthetic files sit at the low end of real byte density, and
   extrapolating from Fixture A *progressed* (2,848 B/activity) puts a real
   20,000-activity programme at **57 MB** — over the cap, which bites first at about
   17,500 activities. Both checks have to run and the rejection has to name which one
   fired. Neither cap should rise.
2. **006's 150 KB `derived.json` ceiling holds, and the file is flat in activity
   count**: 15.9 KB at 20,000 activities against 17.5 KB at 3,344. The contract said
   "same order"; it is the same number. Capped exemplars are what do it, now
   demonstrated rather than argued.
3. **`activities.json` at 20,000 activities is 342 KB gzipped** for the lean cut and
   654–788 KB for 004's fuller "subset + codes" cut — a third below 004's ~1.2 MB linear
   extrapolation, because gzip does better on a bigger file of the same shape. 004's
   conclusion is unchanged and strengthened: still far too much to ship on every open.
4. **The client-side parse peaks at 12–13× the raw file size**, identically on real and
   synthetic files — ~358 MB for the 30.7 MB file, projecting to **~600 MB at the 50 MB
   cap**. 011's parse-in-the-tab ordering has a memory ceiling *below its own caps*, and
   mobile Safari kills the tab rather than throwing something catchable. This is the
   finding the ticket existed to produce and it opens
   [The client-side parse budget](020-client-parse-budget.md).
5. **Parse speed is a non-issue**: 560 ms CPU for the largest legal file, which against
   Hobby's 4 CPU-hour meter is ~24,000 maximum-size ingests a month. Ingest CPU will not
   be what triggers Pro.
6. **The version-drift rule is now a test, not a note.** `ver-60-fieldset.xer` and
   `ver-83-fieldset.xer` are the same programme under both `%F` contracts, whose field
   *order* differs; read by name they produce a **byte-identical `derived.json`**. Any
   parser indexing by position fails that comparison loudly.
7. **Gzip holds at 7.1–7.3 : 1** at 6× the activity count — the register's one stable
   figure is now stable across size as well as across programmes.
8. Strict CP1252 decoding **throws on our own corpus file**, exactly as it does on the
   real Fixture B. The decoder now has a file to make its choice against.

**Not done, and it is the ticket's own success criterion: the files have never been
opened in P6.** No licence was available and no free tool imports XER. Stating it as
this ticket asked — **for now these are parser fixtures, not proof of P6
compatibility**. That gap affects exactly two claims: whether the invented `clndr_data`
shapes (multi-shift days, exception *working* days, both marked `speculative: true` in
their goldens) match what P6 emits, and whether a generated file could be round-tripped
through P6 into a better fixture. It affects none of the measurements above, which
depend on structure transcribed from real exports.
[Verify the synthetic fixtures import into P6](021-verify-fixtures-in-p6.md) carries the
check for whoever has a licence.

`.gitignore` gained the exception this ticket asked for: `fixtures/synthetic/**/*.xer`
is committed, `fixtures/generated/` is not.

### Amendment 2026-08-08 — [Do we compute the critical path ourselves?](014-compute-critical-path.md)

**A defect in the delivered generator.** `lib/tables.mjs:322` emits

```js
driving_path_flag: o.longestPathFlag && !task.floatNull && task.tf <= 0 ? 'Y' : '',
```

— Longest Path written from float, which is the conflation this project's own format
research warns about and the rule 014 rejected when choosing the driving test. It was
invisible while nothing read the flag. 014 makes the flag a **validation oracle**, so
the corpus now asserts something false: it would **pass a float-based tracer and fail a
correct one**.

This lands harder here than it would in most repos, because 010 made real fixtures
gitignored forever — the synthetic corpus is not *a* test corpus, it is the only one
there will ever be. The generator's own defence applies unchanged: goldens come from the
generator's *intent*, so the fix is to record the driving set while generating (the CPM
in `lib/programme.mjs` already holds `preds`/`succs` and is calendar-free, so the chain
is exact), never to re-derive it by parsing the emitted file.

Five landmines join the corpus for the tracer — branching driving path, logic cycle,
external predecessor on the chain, 100%-complete programme, and a lagged FS spanning
non-working time — plus `float_path` / `float_path_order` on at least one file, which
014 uses as a second oracle and no fixture currently carries. The work is
[Fix the generator's Longest Path flag and add tracer landmines](022-generator-longest-path-and-landmines.md).

The perf and correctness findings above are untouched: none of them read
`driving_path_flag`.
