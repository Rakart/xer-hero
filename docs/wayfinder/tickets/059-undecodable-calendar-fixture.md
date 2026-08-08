---
id: 059
title: A `CALENDAR` row the corpus expects **not** to decode
type: task
status: out-of-scope
assignee:
blocked_by: [051]
---

## Question

[043](043-calendar-golden-block.md) wrote *"a blob this generator did not pack has no recorded intent
and the golden says so rather than inventing one"* and never fixtured it, and
[047](047-report-duration-working-days.md) has now built the state that depends on it:
`time.duration_working_days` reports `state: "error"` plus an `issues[]` **warn** when the named
calendar will not decode, which is the worked example [006](006-derived-json-contract.md) has carried
since v1 — and **no fixture produces it**, so `--verify` compares that branch on `state` alone and
nothing exercises the `issues[]` entry at all.

That is a golden nothing reads, which is the defect
[032](032-generator-free-float-by-type.md), [039](039-float-path-semantics.md),
[042](042-seed-divergence-unnamed.md) and [049](049-generator-milestone-instant.md) each found once.

What it needs is for the `calendars` block to state *this row does not decode* and for
`verifyCalendars` to assert the failure rather than report it — the same extension
[051](051-unparsed-clndr-shapes.md) needs for its **anonymous root wrapper**, which is the only real
shape in 563 rows that does not decode and is therefore the right blob to fixture rather than an
invented one.

Do it there or immediately after, and decide on the way whether a file with one unreadable calendar
among several readable ones is an `error` for the whole stat, or only where the *named* calendar is
the unreadable one.
