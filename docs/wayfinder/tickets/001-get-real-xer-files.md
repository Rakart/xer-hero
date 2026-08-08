---
id: 001
title: Get real .xer files to work against
type: task
status: closed
assignee: carlo
blocked_by: []
---

## Question

Nothing here can be decided against a guess at the file format. Before the format
can be researched, the schema designed, or the derived stats chosen, there must be
real `.xer` files on disk to open, measure and break parsers against.

Gather a small but *varied* fixture set and record what is in it. Variety matters
more than volume — the failure modes live in the edges:

- A large programme (10k+ activities) and a small one (<200), so size and shape
  effects are both visible.
- Files exported from **different P6 versions** if at all possible — the `.xer`
  header carries a version and the table set drifts between them.
- At least one with resources and cost loading, and one without.
- At least one multi-calendar programme.
- At least one exported with a baseline attached, and one exported as a
  multi-project `.xer` if P6 will produce one.

Sources: your own exports from P6, Oracle's sample/demo projects, anything a
vendor ships as a sample schedule.

Resolve by recording, for each file: where it came from, P6 version, uncompressed
size, activity count, and anything odd noticed on opening it. Note the raw byte
size distribution explicitly — [What does storage actually cost?](004-storage-cost-model.md)
depends on it.

Store the files under `docs/wayfinder/tickets/assets/xer-fixtures/` if they are
small and publishable, or record their location if they are not. **Do not commit
anything commercially sensitive** — if a file cannot be published, keep it local
and record only its measurements here.

## Resolution

**139 `.xer` files**, all revisions of a single live infrastructure contract
programme (**Fixture A**; the client and contract are named only in the local
register),
submitted monthly from 2015 to at least 2017 across four revision lines (R-B
baseline, R-B1, R-B2, R-B3). Held on a Windows drive, read via WSL. Full register,
measurements and profiling method:
[`assets/xer-fixtures.local.md`](assets/xer-fixtures.local.md).

The files are **commercially sensitive and gitignored**; only measurements travel.
`.gitignore` now excludes `*.xer` and `*.local.md` repo-wide.

Five findings carry into other tickets:

1. **Positional field access is unsafe.** Exports alternate between P6 **6.0** and
   **8.3** *within the same revision series*, and `TASK` column order differs
   between them. A fixed-column parser read correct statuses from the 6.0 file and
   activity codes from the 8.3 file, silently — this actually happened while
   profiling. Parsers must build a name→index map from each table's `%F` line, per
   file. → [How is a .xer file structured?](002-xer-file-structure.md)
2. **Encoding is CP1252, not UTF-8**, with `0x7F` runs inside `CALENDAR`, `TASK`
   and `SCHEDOPTIONS`. Line endings CRLF. Decoding as UTF-8 will throw or mangle.
   → [How is a .xer file structured?](002-xer-file-structure.md)
3. **Compression is ~7:1** — 2.87 MB → 420 KB, 4.99 MB → 650 KB. At ~500 KB per
   revision, 10,000 revisions is ~5 GB. Blob storage is unlikely to be the binding
   cost; serve gzipped.
   → [What does storage actually cost?](004-storage-cost-model.md)
4. **`TASKACTV` dominates, not `TASK`** — 23k–28k activity-code assignments against
   ~1,750 activities, ~14 per activity. Anything sized on activity count is wrong
   by an order of magnitude, and activity codes are clearly load-bearing in real
   practice.
   → [The derived.json contract](006-derived-json-contract.md),
   [Browse, search, filter and ranking](009-browse-search-ranking.md)
5. **Exact-duplicate files are normal**, appearing at identical byte size in two
   folder trees, plus P6 export-suffix variants of identical content. Deduplication
   is a mainline case, not an edge case.
   → [Upload and ingest pipeline](011-upload-ingest-pipeline.md)

**Gaps, accepted:** no programme above ~1,750 activities, none below 200, no
multi-project export, no notebook topics, no baselines, no LOE activities, and one
domain only. The size gap is the one that blocks work, so it is now
[Get a large synthetic fixture for perf work](012-large-synthetic-fixture.md).

**Unplanned bonus:** the set is a *revision series of one real programme over two
years*. That is exactly the data the deferred diff feature would need, and it
means fork/revision modelling can be designed against real successive exports
rather than invented ones.

> **Extended 2026-08-08** by [Does the tracer seed where P6 seeds?](044-tracer-seed-tie-break.md).
> Three corrections of fact from reading all 139 files at once. The set is **four export versions,
> not two** — 6.0 × 127, 6.2 × 2, 7.0 × 4, 8.3 × 5 — so *"P6 6.0 and 8.3"* undercounts the version
> drift this ticket's headline rule exists for. It is **67 distinct files by SHA-256 of 138
> readable**, which puts a number on this ticket's *duplicate uploads are normal*. And it is **not one
> programme's revision series**: eleven distinct activity counts (543 to 1,751) say several distinct
> programmes sit in the tree beside the monthly revisions. Every measurement in this repo scored on
> "Fixture A" to date has been one revision of one of them.

> **Counted 2026-08-08** by
> [Which flagged set does the ship gate score against?](050-ship-gate-flagged-set.md). 044's
> *"several distinct programmes sit in the tree"* now has a number: clustering the 67 distinct files
> by task-code overlap gives **six programmes** — one of 58 files, one of 5, and four singletons —
> and only **three** carry a usable `driving_path_flag`. This ticket's *unplanned bonus*, the
> two-year revision series, is 58 of the 67 files.
