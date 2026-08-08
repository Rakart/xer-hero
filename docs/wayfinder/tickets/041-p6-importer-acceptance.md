---
id: 041
title: Does P6's importer accept the fixtures? (needs a P6 licence — nothing waits on it)
type: task
status: out-of-scope
assignee:
blocked_by: [021]
---

## Question

The residue of [021](021-verify-fixtures-in-p6.md) after three substitute instruments were
exhausted ([working notes](assets/p6-substitute-validation.md)). Everything answerable
about **the format** and **P6's arithmetic** has been answered from real exports and an
independent reader. What none of that touches is **Oracle's importer**, which enforces its
own referential rules and can reject a file every reader tested happily accepts.

**This is HITL and needs a P6 licence.** The dev has none. It is filed rather than ruled
out of scope because a licence may appear, and because the question is sharp. **Nothing in
the map waits on it** — 021's own closing note stands: what fails without this is only the
claim that a generated file is a faithful *P6* artifact, and the corpus works as a parser
regression net either way.

**Do, for whoever has P6 in front of them:**

1. Import `fixtures/synthetic/corpus/ver-83-fieldset.xer`. Record whether it imports and
   **verbatim** what P6 says if it does not. The likely complaints are a table P6 requires
   that the fixtures omit, a referential rule the generator does not honour, or a field P6
   will not accept empty — none of which a *reader* would object to.
2. Import `fixtures/generated/perf-20k.xer` (generate first:
   `node tools/fixture-gen/generate.mjs --only perf-20k`). Record the **import time** as
   well as the verdict; a ~30 MB import is a useful number in its own right.
3. If a newer P6 is available, export any programme and record the `%F` field sets. The
   fixtures and all 143 real files cover **6.0 and 8.3 only**; current P6 is version 25 and
   its drift has never been observed in a file, only read about in Oracle's guides. This
   third item is the one that does **not** need our fixtures — one modern export from
   anybody who has a licence answers it, so it can be split off and begged for.

**Do not re-do** the calendar export (step 4 of 021) or the relationship-type free-float
export (step 6). Both were settled from real exports, at n=329 relationships for the free
float, and a fresh export would be a weaker sample than what already exists.

**Note, added 2026-08-08 by the integrating session.** The suggestion to attack this with the real
in-progress programme was taken, and it splits the licence-bound work cleanly in two.

**What the real set can answer, and is being answered without a licence:** whether a freshly-run
Longest Path includes completed activities. The set is a **monthly revision series of one in-progress
programme** with the data date advancing and work completing between revisions, and
[050](050-ship-gate-flagged-set.md) established that the flagged set is byte-identical across some
consecutive revisions and demonstrably **recomputed** across others. That makes P6's own behaviour
observable over time rather than reproducible once, which is a better instrument than a single fresh
export. Moved to [053](053-longest-path-includes-complete.md), which no longer needs P6.

**What it cannot answer, and is what is left here:** steps 1 and 2, whether Oracle's **importer**
accepts a file *we generated*. The real exports are files P6 wrote and we read; the untested thing is
Oracle's software refusing a file we wrote, and no amount of reading its output tests that. Step 3 is
likewise untouched — the set is P6 6.0, 6.2, 7.0 and 8.3, so no v24/v25 `%F` field set exists in it
to read.

**Followed up 2026-08-08.** [053](053-longest-path-includes-complete.md) closed **without a licence**
and argues against folding anything of its kind in here: this ticket's subject is Oracle's *importer*
and version drift, and a scheduler-behaviour question is a different animal. Its one residue — whether
`sched_progress_override` is what confines the Longest Path to remaining work — is
[061](061-progress-override-longest-path.md), and like step 3 it needs **none of our fixtures**, so it
is beggable from anyone with a licence and their own data rather than blocked on ours.
