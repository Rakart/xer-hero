---
id: 061
title: Is progress override what confines P6's Longest Path to remaining work? (needs a P6 licence — nothing waits on it)
type: task
status: out-of-scope
assignee:
blocked_by: []
---

## Question

[053](053-longest-path-includes-complete.md) established that P6's Longest Path runs back through
completed work — on sixteen demonstrably recomputed revisions, 276 of the 494 rows the runs added
were already `TK_Complete`, and the chain terminates on a completed activity on 45 of 48 files.
**One export in 67 does the opposite**, and it is not one of the unprogressed ones: A09 is 11.6%
complete with 66 activities in progress, and its 70 flagged rows are every one `TK_NotStart`, none
starting before the data date. That is [014](014-compute-critical-path.md) decision 3's span exactly,
written by P6.

It is also the only file in 67 carrying **`SCHEDOPTIONS.sched_progress_override = Y`** and
**`sched_retained_logic = N`** — the two singleton values in the whole census, and the same file. Six
days later the same P6 project was exported with retained logic restored and the chain had extended
backwards through the completed predecessor of A09's own tail.

The mechanism is the obvious one: progress override tells P6 to schedule remaining work from the data
date without regard to logic running back through completed work. But **n = 1, the two settings move
together, and this set cannot separate them.**

**Do, for whoever has P6 in front of them:** take any progressed programme, schedule it twice — once
with *Retained Logic*, once with *Progress Override* — and export both. Record, for each, whether any
`TASK` row carries both `driving_path_flag = Y` and `status_code = TK_Complete`, and whether the
flagged set contains any row starting before the data date. Two exports answer it, and they need
**none of our fixtures**, so this can be split off and begged for exactly as
[041](041-p6-importer-acceptance.md)'s third item can.

**What turns on it.** Nothing in [050](050-ship-gate-flagged-set.md)'s gate — it scores against
remaining work under either answer. What it would buy is a rule for reading the oracle: if progress
override is the cause, then a file's flagged set means a different thing depending on one
`SCHEDOPTIONS` field, and decision 2's *"the flag is the only ground truth"* would gain a caveat that
is at least **checkable from the file**, which neither of its existing two is.
