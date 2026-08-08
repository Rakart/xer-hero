---
id: 022
title: Fix the generator's Longest Path flag and add tracer landmines
type: task
status: closed
assignee: carlo
blocked_by: [014]
---

## Question

Nothing to decide — [Do we compute the critical path ourselves?](014-compute-critical-path.md)
decided it. This is the tooling work that makes that decision testable, and it exists as
a ticket because the corpus is currently **wrong in a way that would pass a broken
tracer**.

### The defect

`tools/fixture-gen/lib/tables.mjs:322`:

```js
driving_path_flag: o.longestPathFlag && !task.floatNull && task.tf <= 0 ? 'Y' : '',
```

Longest Path emitted from float. That is the conflation
[the format research](assets/xer-format.md) warns about at line 224 and the rule 014
decision 4 explicitly rejected — so the synthetic corpus would **validate a float-based
tracer and fail a correct one**. Since 010 made real fixtures gitignored forever, this
corpus is the only CI corpus that will ever exist, which is what turns a fixture bug
into a blocking one.

The fix is available: `lib/programme.mjs` already holds `preds`/`succs` and its CPM is
calendar-free, so the true driving chain can be walked exactly and the flag written from
it. Goldens are written from the generator's **intent** — 012's rule — which here means
recording the driving set during generation, never re-deriving it by parsing the emitted
file.

### The work

1. Emit `driving_path_flag` from a real backward walk over the generated logic, not from
   `tf <= 0`. Keep `longestPathFlag: false` working — a file where P6 did not run
   Longest Path is still a case the tracer must handle.
2. Record the driving set (and its branches) in the `.expected.json` goldens.
3. Add five corpus landmines for the tracer:
   - a **branching** driving path — two predecessors both driving one activity
   - a **logic cycle** (`state: "error"` + `logic.cycle_count`)
   - an **external predecessor** on the driving chain (`truncated: true`)
   - a **100%-complete** programme, so the walk has no remaining work (`state: "skip"`)
   - a **lagged FS spanning non-working time** — the case 014 decision 4 knowingly
     approximates, so the corpus states the limitation rather than hiding it
4. Consider emitting `float_path` / `float_path_order` on at least one file, since 014
   decision 11 makes it a validation input and no fixture currently carries it.

Done when the corpus can distinguish a correct tracer from a float-based one, and the
goldens say which case each file is for.

## Resolution

**Fixed, and the corpus goes from 16 files to 23 — but the finding worth keeping is
*why the defect was invisible*: inside this generator `tf <= 0` and the Longest Path
coincide by construction, and still do on 19 of the 23 files.**

`driving_path_flag` is now written from a backward walk over the generated logic and
from nothing else. The walk spans remaining work as of the data date, walks back from
the latest remaining finish, keeps ties because paths branch, terminates on a cyclic
network and reports where it leaves the file — [014](014-compute-critical-path.md)
decisions 3, 4 and 5, implemented against the model rather than against dates. Full
working, per-file numbers and the acceptance run are in
[the corpus asset](assets/driving-path-corpus.md).

### The defect was accidentally right

The backward pass runs with `projectFinish = deadline`, and `deadlineSlipDays` defaults
to 0, so `deadline == computedFinish`. Under that condition `tf == 0` holds exactly when
an activity lies on *some* chain achieving the project finish, which is exactly what a
backward walk from the latest finish recovers. The old flag was not obviously wrong on
inspection; it was **right on every file that could not tell the difference**, which is
the worst state a corpus whose job is to fail can be in. Discrimination had to be built
on purpose, and the lever is a deadline pulled in behind the computed finish — Fixture
A's shape, 69% negative float against a small driving set, now reproduced by
`logic-no-longest-path`: **19 activities carry float <= 0 and 4 are actually driving.**

### The goldens record the walk twice

`members` is the truth — the generator's own driving relation over its own logic — and
`driving_path_flag` is written from it, so the corpus reproduces the oracle relationship
014 decision 2 depends on rather than merely describing it. `as_read_from_the_file` is
what a tracer built to decision 4 can reach **from the emitted bytes alone**: `EF + lag`
on timestamps, lag as elapsed hours, absent relationships absent, unresolvable
predecessors truncating. `float_based_tracer` records what `tf <= 0` would mark instead.
Both walks come from the model; neither parses the `.xer` back in, which is 012's rule
and the only thing that makes a golden an assertion rather than a transcript.

The gap between the two is the approximation 014 accepted, and it is now a **measured
number rather than an argument**: across the corpus a conformant read recovers 148 of
154 driving activities — **96.1% recall at 96.1% precision** — with every one of the ten
activities where the two walks pick a different driving predecessor named in
`as_read_from_the_file.why` together with its cause. That is
the same figure 014's ship gate wants from Fixture A, available in CI forever, on shapes
Fixture A does not contain.

### The acceptance proof

Two throwaway tracers over the committed bytes, scored on membership, `state`,
`branches`, `truncated`, `cycle_count` and `path_continuous`:

```
correct tracer (014): 23/23 files pass
float tracer (tf<=0): 12/23 files pass
float tracer marks 23 activities in error and misses 6 across the corpus
```

The float tracer fails on eleven files and fails in five distinct ways, not one: it
marks 15 activities in error on `logic-no-longest-path`, reports `state: ok` where
`skip` and `error` are required, never reports a branch, never reports truncation, and
gets `path_continuous` wrong. **The twelve files it passes are exactly the ones where
the two rules genuinely coincide** — a corpus of only those would ship a broken tracer,
which is what the corpus was before this ticket.

`measure.mjs --verify` now checks the emitted flag set and `float_path` membership
against the golden on every file: **23/23 round-trip.**

### The seven new files

Five the ticket asked for, plus two the ticket's own body demanded without counting:

| File | For |
|---|---|
| `logic-driving-branch` | Three activities with two driving predecessors each — a path is a set, not a chain |
| `logic-cycle` | A back edge planted *on* the driving chain. `state: "error"`, `cycle_count: 1`, ingest still succeeds; the dates are deliberately incoherent because a cyclic file was never successfully scheduled |
| `logic-external-driver` | The chain's tail lives in another project and is absent from `TASK`. `truncated: true`, not a broken chain |
| `logic-complete-no-remaining` | 100% complete, so the walk has nothing to span. `state: "skip"` |
| `logic-lag-nonworking` | Multi-day FS lags on a five-day calendar, with the divergent activity **named** in the golden rather than tuned away |
| `logic-no-longest-path` | `longestPathFlag: false` — the case 014 exists for, since P6 populates the flag on 1 of 3,344 activities in Fixture B. No oracle in the file, so the golden is the oracle |
| `logic-float-path` | `float_path` / `float_path_order`, 014 decision 11's second oracle |

Item 4 is **acted on, not deferred**: `logic-float-path` emits path 1 as the driving
chain in sequence with `float_path_order` counting from the earliest activity, and it
carries `speculative: true` in the same class as the invented `clndr_data` shapes —
Oracle documents the two field names and nothing about their contents. What it asserts
is that a parser reads both columns by name and reports what it saw.
[021](021-verify-fixtures-in-p6.md) still owns confirming the convention.

### Two surprises

**014 decision 4 has a second approximation it did not name.** The rule is "driving
predecessors are those maximising `EF + lag`" for every relationship type. That is true
for FS and false for SS, FF and SF, where the constraining quantity is the predecessor's
*start* or the successor's *finish*. It costs a whole branch on `text-multiline` — the
truth has two driving predecessors and `EF + lag` sees one. Worse, it lands on the
fixture the gate does not run against: counting the two real programmes recorded in this
repo, non-FS logic is **0.4% of Fixture A's relationships and 10.5% of Fixture B's**,
while decision 4's *lag* limitation is 8.8% of B and 0.3% of A. Both approximations sit
on Fixture B, and 014's gate measures **Fixture A only**, so it will pass whether or not
the tracer handles relationship types at all. This needs its own ticket —
*Does the driving test need to distinguish relationship types?* — and is not decided
here.

> **Corrected 2026-08-08** by
> [Recheck the lag and non-FS exposure figures against their source](036-recheck-lag-exposure-figures.md).
> This paragraph read *"8.8% of A and 0.3% of B. The two approximations sit on opposite
> fixtures"*. The lag figures were read from the wrong column of the DCMA table in
> [the derived contract](assets/derived-json-contract.md) — headed
> `| # | Check | Fixture B tender | Fixture A update |`, row 3
> `| 3 | Lags | **8.8%** ❌ | 0.3% ✅ |`. The non-FS half was read correctly and is
> unchanged. The paragraph's conclusion is untouched and slightly strengthened: the gate
> is blind to non-FS logic either way, and it turns out to be blind to the lag residue
> too. Only the *opposite fixtures* framing dies.

**`mutate(tables)` was quietly producing goldens that lie.** Two committed fixtures
rewrote `TASKPRED` after the model had run — `missing-taskpred` deleted the table,
`external-relationship` re-pointed three rows at another project — so the model believed
in logic the file did not carry. Harmless while nothing read the logic, exactly like the
flag itself. Both moved onto model options (`hideRelationships`, `externalRels`), their
emitted bytes unchanged; what changed is that the generator now knows. The generator
README gains the rule: **a `mutate` hook may bend rows, never logic.**

### What did not move

`derived.json` at 20,000 activities is **15,854 bytes**, byte-identical to
[012's measurement](assets/synthetic-fixtures.md); `perf-20k` is 17 bytes smaller,
because there are 17 fewer `Y`s where the walk marks 10 driving activities against the
old rule's 27. Every perf, gzip, parse and memory figure 012 recorded stands. The walk
is O(V+E) and **iterative rather than recursive** — a driving chain through 20,000
activities is deep enough to blow a recursive walk's stack, which is the one thing about
this that is a scale problem. Generation is 336 ms for `perf-20k` and under 40 ms for
the whole committed corpus, so "regenerate and diff" remains a viable CI check.

`measure.mjs` still models `derived.json` **v1** and reports
`logic.longest_path: unavailable` where the flag is sparse. It is a sizing harness, not
the product parser, and 014's v2 shape is product work this map does not write.

> **Amended 2026-08-08** by
> [The generator writes a finish milestone where P6 does not](049-generator-milestone-instant.md).
> The engineered branch this ticket built into `cal-flat-no-0x7f` — `A001190` a predecessor of the
> finish milestone but not a driving one — is **intact and still discriminates**; what changed is
> that it no longer costs a chain, because the readable walk now seeds on it. And the defect family
> this ticket opened with `tf <= 0` closes its **fourth** instance: a value written by a rule nobody
> checked, invisible because the golden carried it and nothing read it back. Here it was
> `lib/tables.mjs`'s zero-duration instant, wrong since this ticket wrote it.
