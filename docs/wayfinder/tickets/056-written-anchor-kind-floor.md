---
id: 056
title: Bring the readable walk's floor onto the written-anchor-kind test
type: task
status: out-of-scope
assignee:
blocked_by: [047]
---

## Question

`makeReadableDrivers`' `sameKind` in `tools/fixture-gen/lib/programme.mjs` still reads
`milestoneRow(pred) === milestoneRow(succ)` on `early_start_date == early_end_date`.
[054](054-ff-milestone-guard.md) replaced that with a written-anchor-kind test on `task_type`, and
deliberately did not implement it — a grilling ticket decides, it does not write the walk.

**Do:**

1. Replace `milestoneRow` with `writtenKind(row, column)` — `TT_FinMile` → finish in both columns,
   `TT_Mile` → start in both, otherwise the column's own kind — and make `sameKind` compare the two.
2. Extend `comparisonKind` the same way, since `divergenceCauses`' mixed-anchor label is exact only
   if it does.
3. Build **`logic-ff-milestone-floor`** to 054's spec, **both halves**, so the branch is executed in
   CI rather than reasoned about a third time. Neither half is executable by the corpus *or* by the
   139 real exports — the missing ingredient is topology, not the relationship: **0 of 72** real
   successors carrying a rescued `FF` have one live predecessor.
   - **`M`**, `TT_FinMile`, on the driving chain but not the seed, finish held later by a constraint,
     whose **only** live resolvable predecessor is task `T` via zero-lag `PR_FF` finishing four
     working days below `M` — every other predecessor `TK_Complete`. Clause dropped → pool empties,
     `M` is the chain tail the truth records. Clause kept → `T` marked, walk invents `T`'s whole
     chain.
   - **`S`**, **`TT_Mile`**, on the driving chain, only live resolvable predecessor task `U` via
     zero-lag `PR_FF`, `U`'s finish at the working-period boundary immediately before `S`'s written
     instant. Without the replacement clause the floor drops `U` and `S` becomes a **false chain
     tail** — a false negative, which decision 9 is asymmetric against, so this is the more valuable
     half.
4. Regenerate and report the aggregate against [049](049-generator-milestone-instant.md)'s
   **181 / 178 / 175 — 96.7% recall at 98.3% precision, 21 of 26 exact, 9 `why` entries across 5
   files** — and confirm `--verify`.

Expect every existing golden byte-identical except the new file: 031 and 049 both measured clause
removal as byte-neutral, and the corpus's one milestone `FF` is on an activity no walk reaches.

Footing, stated so the fixture's landmine can be honest: half one's relationship shape is evidenced
at **n=117 across 62 real files** and only its sole-predecessor topology is engineered, as
[022](022-generator-longest-path-and-landmines.md) engineered `cal-flat-no-0x7f`. Half two is
engineered outright (**0 of 565**), standing on Oracle's Primavera Cloud validation grammar plus an
unverified P6 24.12 lead. `TT_Mile` needs no new machinery — `logic-no-longest-path` carries one.

Done when the branch can fail.
