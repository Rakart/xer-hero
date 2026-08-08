# Synthetic fixtures: what was built and what it measures

Resolution asset for
[Get a large synthetic fixture for perf work](../012-large-synthetic-fixture.md).

Generator: [`tools/fixture-gen`](../../../../tools/fixture-gen/README.md).
Fixtures: [`fixtures/synthetic`](../../../../fixtures/synthetic/README.md).
All figures below were taken on 2026-08-07, Node 24.18, WSL2, with
`tools/fixture-gen/measure.mjs`, one file per process.

## Synthesise, not source — and the reason is not only confidentiality

Sourcing a genuinely large real programme was rejected, as the ticket recommended.
The decisive argument turned out not to be the confidentiality problem but
[Stack, hosting and auth provider](../010-stack-hosting-auth.md)'s finding that real
fixtures are gitignored **forever**: a sourced file could not be committed either, so
it could never be the CI corpus. A generator is the only artifact that can be both
the perf file and the test corpus, which is why the two halves of this ticket are one
deliverable.

## What was built

| Kind | Files | Committed? |
|---|---|---|
| Correctness corpus | 16 × ~20 activities, ~33 KB each, one landmine per file, each with a golden | yes (981 KB total) |
| Rendering fixture | `sparse-150.xer`, 150 activities | yes |
| Perf fixtures | `perf-2k`, `perf-20k`, `perf-20k-dense` | **no** — reproducible from a seed |

The perf files are 3–35 MB. They are a pure function of a seed, so committing them
would trade tens of MB of git objects for a `node generate.mjs --only perf-20k` that
takes 419 ms. The corpus is committed because CI needs it without a generation step
and because a golden file is only useful next to the bytes it describes.

### Realism, and where it comes from

The generator runs a real **CPM forward and backward pass**. Early and late dates,
total float, free float and the critical path are computed from the logic network,
not sprinkled on. Random dates would produce a meaningless float histogram, a
critical path of nothing, and a DCMA score that measures noise — useless for the
detail page and worse than useless for the quality checks.

Densities are taken from the two real programmes and are catalogue knobs, because
[the fixture register](xer-fixtures.local.md) showed they vary more than 2× between
two real files:

| | Fixture A | Fixture B | `perf-20k` | `perf-20k-dense` |
|---|---|---|---|---|
| `TASKPRED` per activity | 1.6 | 1.76 | 1.7 | 1.7 |
| `TASKACTV` per activity | ~14 | ~6.1 | 6 | 14 |
| `TASKRSRC` per activity | 1.6 | 1.87 | 2.6 | 2.6 |
| WBS nodes per 1,000 activities | 94 | 0.3 | 90 | 90 |

## Measurements

### Files

| Fixture | Activities | Bytes | gzip | Ratio | B / activity |
|---|---|---|---|---|---|
| `sparse-150` | 150 | 246,647 | 38,657 | 6.4 : 1 | 1,644 |
| `perf-2k` | 2,000 | 3,285,815 | 464,769 | 7.1 : 1 | 1,643 |
| `perf-20k` | 20,000 | 30,657,204 | 4,334,704 | 7.1 : 1 | 1,533 |
| `perf-20k-dense` | 20,000 | 35,009,843 | 4,781,196 | 7.3 : 1 | 1,750 |
| *Fixture A baseline (real)* | 1,746 | 2,874,706 | 416,370 | 6.9 : 1 | 1,646 |
| *Fixture A progressed (real)* | 1,751 | 4,987,677 | 649,661 | 7.7 : 1 | 2,848 |
| *Fixture B (real)* | 3,344 | 6,810,660 | 898,019 | 7.6 : 1 | 2,036 |

Row counts, `perf-20k`: `TASKACTV` 120,000 · `UDFVALUE` 80,000 · `TASKRSRC` 51,934 ·
`TASKPRED` 34,000 · `TASK` 20,000 · `PROJWBS` 1,800 · `ACTVCODE` 59 · `CALENDAR` 4.
The dense variant differs only in `TASKACTV` (280,000).

**Gzip ratio holds at 6× the activity count** — 7.1–7.3 : 1 synthetic against
6.9–7.7 : 1 real. The register called this the one stable figure across programmes;
it is now also stable across size.

### Parse, CPU and memory

| Fixture | Bytes | Parse | Derive | CPU | Peak RSS |
|---|---|---|---|---|---|
| `sparse-150` | 0.25 MB | 3.1 ms | 1.7 ms | 8 ms | 58.9 MB |
| `perf-2k` | 3.29 MB | 31.5 ms | 10.2 ms | 58.5 ms | 95.2 MB |
| `perf-20k` | 30.66 MB | 287 ms | 89.6 ms | 560 ms | 398.4 MB |
| `perf-20k-dense` | 35.01 MB | 304.5 ms | 135.3 ms | 679 ms | 481.7 MB |
| *Fixture A baseline* | 2.87 MB | 29 ms | 10.5 ms | 55.4 ms | 94.5 MB |
| *Fixture B* | 6.81 MB | 59.6 ms | 28.1 ms | 130.1 ms | 130.7 MB |

Node's own floor is ~40 MB of RSS. Net of it, **peak memory runs about 12–13× the
raw file size**, and the multiplier is the same on real files as on synthetic ones.

### Derived artifacts

| Fixture | `derived.json` | gzip | `activities.json` lean | gzip | + codes + logic | gzip |
|---|---|---|---|---|---|---|
| `sparse-150` | 8,514 | 2,131 | 23,079 | 3,510 | 51,589 | 6,003 |
| `perf-2k` | 14,392 | 3,240 | 305,259 | 36,310 | 867,718 | 72,072 |
| `perf-20k` | 15,854 | 3,659 | 3,080,185 | 342,461 | 6,863,545 | 654,305 |
| `perf-20k-dense` | 15,589 | 3,646 | 3,083,775 | 341,019 | 10,546,958 | 787,933 |
| *Fixture A baseline* | 15,558 | 3,839 | 332,262 | 40,381 | 1,034,783 | 66,064 |
| *Fixture B* | 17,499 | 4,620 | 587,873 | 74,810 | 1,246,621 | 123,288 |

"Lean" is activities + the WBS tree. "+ codes + logic" adds columnar `TASKACTV` and
`TASKPRED`, which is closer to what
[What does storage actually cost?](../004-storage-cost-model.md) measured as
`activities.json`. Both are reported because the difference is 2× and the detail
page's needs are not settled.

## Findings

### 1. 20,000 activities and 50 MB are not the same limit

[Upload and ingest pipeline](../011-upload-ingest-pipeline.md) set the v1 caps at
20,000 activities **and** 50 MB raw, and recorded them as floors to be checked here.
They do not line up.

A 20,000-activity file measures **30.7 MB** at Fixture B's code density and **35.0 MB**
at Fixture A's. But the synthetic files sit at the low end of real byte density
(1,533–1,750 B/activity against 1,646–2,848 real) because a synthetic programme
populates fewer optional fields and carries no `POBS` bloat — Fixture B has 13,876
`POBS` rows, a table nothing in the product reads.

Extrapolating from **real** density instead:

| Density basis | B / activity | 20,000 activities |
|---|---|---|
| Fixture A baseline | 1,646 | 32.9 MB |
| Fixture B tender | 2,036 | 40.7 MB |
| Fixture A progressed | 2,848 | **57.0 MB** |

So a real, progressed, 20,000-activity programme **can exceed the 50 MB cap** — the
byte cap bites first at roughly 17,500 activities at that density. The caps are
therefore not redundant and neither is decorative: whichever binds first depends on
progress and code density, both of which vary 2×. Both checks must run, and the
rejection message has to name which one fired, or an uploader who trims activities to
get under 20,000 will still be rejected at 50 MB with no idea why.

Nothing here argues for raising either cap. 30–57 MB is already an unreasonable
upload, and everything downstream of it (below) gets worse faster than linearly.

### 2. The 150 KB `derived.json` ceiling holds, and it is flat

| Activities | 150 | 1,746 | 2,000 | 3,344 | 20,000 |
|---|---|---|---|---|---|
| `derived.json` | 8.5 KB | 15.6 KB | 14.4 KB | 17.5 KB | 15.9 KB |

[The derived.json contract](../006-derived-json-contract.md) promised "a
20,000-activity file should produce a `derived.json` of the same order as a
3,000-activity one". Measured: 15.9 KB against 17.5 KB — not the same order, the
**same number**. Capping exemplars at 50 per check is what does it, and it is now
demonstrated rather than argued.

The measured figures are *below* the contract's own 40–60 KB estimate because this
harness fills exemplars for four checks rather than ten. Even at ten checks × 50
exemplars the file lands near 42 KB, which is inside the contract's estimate and
3.5× under the 150 KB ceiling.

The ceiling is not at risk from activity count. If it is ever at risk it will be from
`codes` — a code type with hundreds of values — which the contract already caps.

### 3. `activities.json` at 20,000 activities: 0.34–0.79 MB gzipped

004 flagged the open question as "whether `activities.json` stays ~250 KB at 6× the
activity count", with a linear extrapolation of ~1.2 MB gzipped.

Measured at 20,000 activities: **342 KB** gzipped for the lean cut, **654 KB** for the
fuller cut, **788 KB** for the fuller cut at Fixture A code density. Below the 1.2 MB
extrapolation by roughly a third, and it scales sub-linearly because gzip does better
on a bigger file of the same repetitive shape.

This does not change 004's conclusion — it strengthens it. Even 342 KB is far too much
to ship to a browser on every open, so "don't send the whole thing" survives, and
[The project detail page](../008-project-detail-page.md) still owns whether the page
fetches `activities.json` at all or pages the activity table through an API.

### 4. The client-side parse has a memory ceiling below its own caps — new decision

011's central design is that **the file is parsed in the browser before a byte is
uploaded**. Measured, that parse peaks at about **12–13× the raw file size**:

| File | Peak RSS | Net of Node's ~40 MB floor |
|---|---|---|
| Fixture B, 6.8 MB | 131 MB | ~91 MB |
| `perf-20k`, 30.7 MB | 398 MB | ~358 MB |
| `perf-20k-dense`, 35.0 MB | 482 MB | ~442 MB |

At the 50 MB cap that projects to **~600 MB of heap in the tab**. Desktop Chrome will
usually survive it; mobile Safari's per-tab budget is a fraction of that and it does
not throw a catchable error — the tab is killed.

This is not a flaw in 011's reasoning, which was made without a large file to measure.
It is the thing 012 existed to find, and it needs a decision:
[The client-side parse budget](../020-client-parse-budget.md).

Node is an imperfect proxy for a browser — different string representation, different
GC — so the ticket should confirm the multiplier in a real tab before choosing a
remedy.

### 5. Parse speed is not a constraint at any plausible scale

560 ms of CPU for a 20,000-activity file, 130 ms for Fixture B. Against Hobby's
4 CPU-hour monthly meter — 010's binding limit — a server-side parse of the largest
legal upload costs ~0.6 CPU-seconds, so the meter buys roughly **24,000 maximum-size
ingests a month**. Ingest CPU will not be what moves this to Pro.

### 6. The version-drift rule, demonstrated rather than asserted

`ver-60-fieldset.xer` and `ver-83-fieldset.xer` are the same programme emitted under
both `%F` contracts, whose field **order** differs. Read by name, they produce a
**byte-identical `derived.json`** — 3,780 bytes each.

That is the strongest form the rule can take in a test: not "the parser must map by
name" but "these two files must produce the same answer", which fails loudly for any
parser that indexes by position.

### 7. Strict CP1252 decoding throws on the corpus, as it does on the real file

`enc-mojibake-0x81.xer` reproduces Fixture B's `POBS` mangling — `0x81`, which is
undefined in CP1252, plus UTF-8 bytes sitting inside a CP1252 file. Python's `cp1252`
codec throws on it, exactly as it does on the real file. The decoder the parser ships
has to make a deliberate choice here (replace, passthrough, or per-byte fallback) and
now it has a file to make it against.

### 8. The generator is fast enough to be a CI step

419 ms for the 20,000-activity file, ~1 ms per corpus file. Regenerating the whole
committed corpus takes under 30 ms, so "regenerate and diff" is a viable CI check
against accidental golden drift.

## Not verified: P6 import

**These files have never been opened in P6, and nothing here claims they would
import.** No P6 licence was available in this session, and no free reader accepts XER
import (the format is a P6-to-P6 exchange; the readers that exist parse it, which is
what our own harness already does).

The ticket asked for this to be said plainly, so: **for now these are parser fixtures,
not proof of P6 compatibility.** The gap matters for exactly two claims and no others:

- whether the invented `clndr_data` shapes (multi-shift, exception working days) match
  what P6 emits — flagged `speculative: true` in those goldens;
- whether a `.xer` this generator writes could be round-tripped through P6 to produce a
  *better* fixture.

It does **not** affect the measurements above, the corpus's value as a CI regression
net, or the perf conclusions: those depend on the file's structure, which was
transcribed from real exports, not on P6's willingness to import it.
[Verify the synthetic fixtures import into P6](../021-verify-fixtures-in-p6.md)
carries the check for whoever has a licence in front of them.
