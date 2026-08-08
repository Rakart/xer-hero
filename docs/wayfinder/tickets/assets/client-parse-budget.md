# The client-side parse budget — measurements

Working notes for [The client-side parse budget](../020-client-parse-budget.md).

Measured **2026-08-08** on WSL2 / Linux x64, Node 24.18, against
**Google Chrome for Testing 149.0.7827.55** (headless, the Playwright-cached
Chromium already on the machine). Harness in the session scratchpad, not committed:
a dependency-free Node HTTP server serving the fixture and the bench page under
`Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy:
require-corp`, so `performance.measureUserAgentSpecificMemory()` is available;
Chrome launched with `--enable-precise-memory-info` so `performance.memory` is
exact rather than quantised.

Three independent memory readings are taken for every run, because no single one
is trustworthy on its own:

| Reading | What it is | Why it is here |
|---|---|---|
| `performance.memory.usedJSHeapSize`, sampled inside the loop | V8 heap, **peak** | catches the high-water mark during a synchronous parse |
| `performance.measureUserAgentSpecificMemory()` after settling | whole-tab bytes, **retained** | the honest "what does this still cost when it is done" |
| `/proc/<renderer>/status` `VmHWM` | OS peak RSS of the renderer process | directly comparable with the Node `maxRSS` figure 012 published, and it is what an OOM killer sees |

Renderer floor, measured with a `noop` run: **107–120 MiB** peak RSS for the page's
own renderer, 71–92 MiB for Chrome's spare renderers. Every "net" figure below
subtracts the largest spare-renderer peak from the same run.

## What could not be measured, stated plainly

- **Firefox: not measured.** No Firefox on this machine and none on the Windows
  host. Gecko's string representation and GC differ from V8's and no number here
  transfers to it.
- **Safari, desktop or mobile: not measured, and not measurable here.** WebKit is
  not in the Playwright cache and there is no Apple hardware in reach. **No figure
  in this document is a Safari figure**, and the ticket's central worry — mobile
  Safari killing the tab uncatchably — is *not* confirmed or refuted by measurement.
- **No real phone.** The device proxy used instead is a **capped V8 old space**
  (`--js-flags=--max-old-space-size=N`), which is engine behaviour rather than
  device behaviour, but it is the part of the failure that is actually about memory.

Fixtures: the committed corpus, `perf-2k` / `perf-20k` / `perf-20k-dense`
regenerated from their seeds, plus **`cap-33k`** — 33,000 activities, 50,545,957
bytes — generated in the scratchpad from the same `tools/fixture-gen` library
without touching the committed catalogue, to put a file *at the byte cap* under the
harness.

One measurement condition worth recording: the fixture corpus was being **changed
concurrently** by
[Fix the generator's Longest Path flag and add tracer landmines](../022-generator-longest-path-and-landmines.md),
which grew the corpus from 16 files to 23 and moved `perf-20k` by 17 bytes
(30,657,204 → 30,657,187) partway through the session. Every headline figure was
re-run against the later file and reproduces to the reported precision — full parse
149.3 MiB peak heap / 316.5 MiB renderer RSS, scan 46.7 MiB, parse still dead at a
64 MB cap, scan still alive at 16 MB. The corpus check below ran against the
23-file corpus.

---

## 1. The 12–13× multiplier is not what a browser does, and it was not measuring the parse

Two separate corrections, in opposite halves of the number.

**First: 012's figure is the whole measurement harness, not the tokenizer.**
`measure.mjs` reports `process.resourceUsage().maxRSS`, which is a *process* peak —
and by the time it is read the process has also run `deriveStats`, built
`activities.json` and the fuller cut, called `JSON.stringify` three times and
`gzipSync` four. The browser never does any of that; 010 fixed that nothing a client
computes is persisted, so the client's job stops at the tokenizer. Splitting the
Node run by stage, on `perf-20k` (30.66 MB):

| Stage, cumulative | Peak RSS (MiB) | Net of the 47.8 MiB floor | × raw file |
|---|---|---|---|
| process floor | 47.8 | — | — |
| + `readFileSync` | 77.1 | 29.3 | 1.0× |
| + `toString('latin1')` | 106.3 | 58.5 | 2.0× |
| **+ `tokenize`** | **351.1** | **303.3** | **10.4×** |
| + derive + activities.json + 3 × stringify + 4 × gzip | 408.5 | 360.7 | **12.3×** |

So the client's actual share of 012's number is **10.4×**, not 12–13×. The last
1.9× is server work.

**Second: Chrome is cheaper than Node at the same work.** Same tokenizer, same
files, ported to the browser and fed the same bytes:

| Fixture | Raw | Wall | Peak JS heap | × raw | Renderer peak RSS | Floor | Net RSS | × raw |
|---|---|---|---|---|---|---|---|---|
| `sparse-150` | 0.25 MB | 13 ms | 1.5 MiB | 6.0× | 117.6 MiB | 89.7 | 27.9 | — |
| `perf-2k` | 3.29 MB | 41 ms | 17.1 MiB | 5.5× | 142.5 MiB | 90.0 | 52.5 | 16.7× |
| `perf-20k` | 30.66 MB | 279 ms | 149.3 MiB | **5.1×** | 315.1 MiB | 89.9 | 225.2 | **7.7×** |
| `perf-20k-dense` | 35.01 MB | 332 ms | 184.6 MiB | 5.5× | 347.8 MiB | 90.3 | 257.5 | 7.7× |
| **`cap-33k`** | **50.55 MB** | 456 ms | **244.0 MiB** | **5.1×** | **418.6 MiB** | 90.2 | **328.4** | **6.8×** |

**At the byte cap the full parse costs ~256 MB of JS heap and ~344 MB of renderer
RSS — not the ~600 MB the ticket projected.** The projection was roughly 1.7–2.3×
pessimistic, and both halves of the error pointed the same way.

The multiplier is **linear and stable at ~5.1× heap**, so it extrapolates safely in
either direction. Parse time is confirmed as a non-issue in a browser too: 456 ms
of wall clock for a 50 MB file.

None of this rescues the design. 344 MB of renderer RSS to look at a file the user
has not yet decided to upload is still the wrong shape, and it is still unbounded in
exactly the direction the caps allow.

---

## 2. The scan: what has to be retained, and what can be thrown away

011 needs the content hash, the activity count, the multi-project check and the
metadata prefill. 013 needs the PI panel, and 013 is explicit that the panel
enumerates **values, not counts** — which is the constraint that decides whether a
counting-only scan is enough. It is not; but the values it needs are all in
*small* tables.

The scan reads the file as a byte stream, splits lines, and for each `%R` record
either (a) increments a counter and moves on **without splitting the row at all**,
or (b) walks the row once, slicing only the named columns the `%F` header says it
wants. Field indices are resolved per table per file from `%F` — 002's rule,
unchanged.

**Retained**, all of it bounded:

| Table | What is kept | Bound |
|---|---|---|
| `ERMHDR` | the whole line | 1 line |
| every `%T` | table name + row counter | ~20 counters |
| `PROJECT` | `proj_id`, `proj_short_name`, `last_recalc_date`, `add_by_name` | ≤ 8 rows (baseline exports carry several) |
| `PROJWBS` | `wbs_id`, `parent_wbs_id`, `wbs_name`, `proj_node_flag` | all rows — 1,800 at 20k activities, 2,970 at 33k |
| `TASK` | count; `Set(proj_id)`; `Set(create_user)`, `Set(update_user)` capped at 64; status and type mix; min start; max finish | **O(1)** — nothing per row |
| `RSRC` | `rsrc_name`, `rsrc_type`, `rsrc_notes` (120 chars), and the five measured-empty probes | ≤ 500 rows |
| `TASKMEMO` | `task_memo` (200 chars) | ≤ 500 rows |
| `UDFTYPE` | id, `udf_type_label`, `table_name` | tens |
| `UDFVALUE` | a count **per `udf_type_id`** — column 0 only | O(number of UDF types) |
| `TASKUSER`, `DOCUMENT` | row count; `author_name` if present | ≤ 500 |

**Streamed and discarded**, never split into fields: `TASKPRED`, `TASKRSRC`,
`TASKACTV`, `ACTVCODE`, `RSRCRATE`, `POBS`, `OBS`, `CALENDAR` (so **`clndr_data`,
the single largest string in a `.xer`, is never materialised on the client**),
`SCHEDOPTIONS`, `CURRTYPE`, `UMEASURE`.

On `perf-20k`'s 307,902 records: **286,044 (92.9%) have no field extracted at
all**, 80,000 of the remainder have exactly one, and only 21,858 rows (7.1%) have
more than one field read. That ratio is the whole finding — the tables that make a
`.xer` big are precisely the tables the pre-upload screen has no use for.

The `PROJWBS` retention is the one genuinely unbounded item, because 011 wants WBS
shape and the title prefill comes from the root node's `wbs_name`. At 012's density
(90 nodes per 1,000 activities) it is ~3,000 rows at the activity cap, well under a
megabyte. Fixture B's `PROJWBS = 1` is the other pole and costs nothing.

### The scan measured

Streaming scan with a pure-JS SHA-256, no gzip:

| Fixture | Raw | Wall | Peak JS heap | **Retained** | Renderer RSS | Floor |
|---|---|---|---|---|---|---|
| `sparse-150` | 0.25 MB | 13 ms | 1.6 MiB | **0.8 MiB** | 120.6 | 91.1 |
| `perf-2k` | 3.29 MB | 87 ms | 8.3 MiB | **1.3 MiB** | 129.5 | 89.8 |
| `perf-20k` | 30.66 MB | 619 ms | 43.6 MiB | **3.0 MiB** | 211.6 | 91.8 |
| `perf-20k-dense` | 35.01 MB | 682 ms | 40.1 MiB | **2.9 MiB** | 212.6 | 90.2 |
| `cap-33k` | 50.55 MB | 992 ms | 47.9 MiB | **3.0 MiB** | 258.0 | 91.9 |

**Retained memory is flat at ~3 MB across a 200× range of file size.** The peak
heap still tracks the file, but that is transient garbage V8 has not bothered to
collect, not a requirement — section 3 proves it.

---

## 3. The device proxy: cap the heap and see what dies

`--js-flags=--max-old-space-size=N`. A renderer that exceeds it is killed by the
browser with no catchable error — the same failure shape the ticket describes for
mobile Safari, produced deliberately.

| Run | File | 512 | 256 | 192 | 128 | 96 | 64 | 32 | 24 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|
| **full parse** | `perf-20k` (30.66 MB) | ok | ok | ok | ok | ok | **died** | — | — | — |
| **scan + hash + gzip** | `perf-20k` (30.66 MB) | ok | ok | ok | ok | ok | ok | ok | ok | **ok** |
| **scan + hash + gzip** | `cap-33k` (50.55 MB) | ok | ok | ok | ok | ok | ok | ok | ok | **ok** |

At a **16 MB** old-space cap the whole client step — hash, scan and gzip in one
pass — completes on a **50.55 MB** file, with a peak heap of 15.8–18.4 MiB and
3.1 MiB retained, in 0.84–1.35 s. The full parse of a file two thirds that size
dies at four times that budget.

The constrained runs also settle what the peak heap in section 2 was: under
pressure V8 collects, and the scan's peak drops from 43.6 MiB to 15.8 MiB with no
change in output. The scan is genuinely O(1); the earlier figure was lazy GC.

---

## 4. Hashing: two options, both priced

WebCrypto has no streaming digest, so the content hash is the one part of the scan
that cannot obviously stream. Both options measured end to end, `cap-33k`:

| | Peak heap | Retained | Renderer RSS | Wall | Code to own |
|---|---|---|---|---|---|
| `crypto.subtle.digest` over `file.arrayBuffer()`, then streaming scan + gzip | 73.8 MiB | 3.1 MiB | 214.5 (floor 89.4) | **661 ms** (hash 155 ms, scan+gzip 506 ms) | none |
| Pure-JS streaming SHA-256, tee'd with the scan and gzip in one pass | **49.0 MiB** | 3.1 MiB | 256.2 (floor 89.9) | 1,427 ms | ~120 lines of hand-written crypto |

Both survive a 64 MB heap cap. The WebCrypto variant's extra cost is **one
file-sized `ArrayBuffer`** — external memory, one allocation, 1.0× the file — where
the parse's cost was 5× the file in short strings. It is also 2.2× faster and, at
~60 MB/s, the pure-JS hash is what makes the streaming variant the slower of the
two overall.

Hash agreement was cross-checked three ways: the pure-JS implementation,
`crypto.subtle.digest` in the browser, and Node's `crypto` all produce the same
digest on every fixture.

**Verdict: WebCrypto.** Cheaper in code and in time, and the memory it costs is the
friendliest kind.

---

## 5. The scan gives the same answers as the parse

Run over the whole committed correctness corpus in the browser, with the scan's
output diffed against the `.expected.json` goldens — which 012 wrote from the
generator's *intent*, never from parsing its own output:

```
23/23 corpus fixtures scan correctly
```

Including the two that matter most to 011:

| Fixture | `distinct_task_proj_id` | `PROJECT` rows | Verdict |
|---|---|---|---|
| `multiproj-two-proj-id` | **2** | 2 | reject — multi-project |
| `multiproj-baseline-rows` | **1** | **3** | accept |

011's discriminator survives the move to a scan intact: counting distinct
`TASK.proj_id` needs one `Set` of cardinality 1, and the baseline-bearing export
with three `PROJECT` rows still ingests.

012's finding 6 also survives: `ver-60-fieldset` and `ver-83-fieldset` produce
**byte-identical scan output except for `p6_version` itself**, which is the value
that is genuinely different. Any scanner indexing by position fails that comparison
as loudly as a parser would.

`text-multiline` scans correctly too. The scan ignores continuation lines rather
than reassembling them, which is safe for every count and every field it reads, and
is a known limitation for one thing only: a `TASKMEMO` whose text wraps is shown to
the uploader truncated at the first newline. The panel already truncates memos to a
preview, so this changes a preview's length and nothing else.

---

## 6. The server still does the full parse, and still fits

The multiplier does not go away; it moves to the side of the wire that has memory.
Node 24.18, `cap-33k` (50.55 MB), which is the largest file the new cap admits:

| Stage | Peak RSS | Wall |
|---|---|---|
| tokenize only | 474.0 MiB | 368 ms |
| full ingest pipeline (tokenize + derive + both JSON cuts + gzip) | **562.1 MiB** | 1,223 ms |

Against a Vercel Function's **2 GB / 1 vCPU**, that is 3.6× headroom, and against
Hobby's 4 CPU-hour meter it is ~1.2 CPU-seconds — 012's ~24,000 maximum-size
ingests a month, recomputed at the higher cap and still not the binding meter.

## 7. The cap arithmetic

012's misalignment, restated with the numbers that fix it:

| Density basis | B / activity | × 20,000 activities |
|---|---|---|
| synthetic `perf-20k` | 1,533 | 30.7 MB |
| Fixture A baseline (real) | 1,646 | 32.9 MB |
| Fixture B tender (real) | 2,036 | 40.7 MB |
| **Fixture A progressed (real, worst of 143 files)** | **2,848** | **56.96 MB** |

**56.96 MB is why the byte cap goes to 60 MB** — the smallest round number above
the worst byte density measured across the whole real corpus. Above that number the
two guards can no longer contradict each other: any file inside 20,000 activities
at any density ever observed is inside 60 MB, so the byte guard only fires on a file
that is *not mostly activities* — activity codes, resource assignments or
user-defined text — which is a true and different thing to tell the uploader.

Gzipped, a 60 MB `.xer` is **7.8–9.4 MB** at the 6.4–7.7 : 1 range measured across
real and synthetic files.
