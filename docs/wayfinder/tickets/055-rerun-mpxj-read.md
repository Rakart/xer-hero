---
id: 055
title: Re-run the MPXJ read over the current corpus
type: task
status: out-of-scope
assignee:
blocked_by: [047, 051, 052]
---

## Question

`fixtures/synthetic/README.md` claims an independent third-party read: MPXJ over 24 corpus files,
`sparse-150` and three perf fixtures, zero failures, agreeing with the goldens exactly on 20 of 24.
Three fixtures added since were never in it (`cal-flat-no-0x7f`, `enc-zeroed-file`,
`enc-truncated-export`), and [049](049-generator-milestone-instant.md) has now moved **370 date
values across 23** of the files that were — no table, column, arity or field width changed, so the
run's structural finding holds and its byte-level one no longer has its bytes.

The corpus is the only test corpus CI will ever have ([010](010-stack-hosting-auth.md)), and an
independent reader is the only thing standing between it and a golden written from the same code
that wrote the file. [002](002-xer-file-structure.md) already established MPXJ is fine as a
dev-harness oracle precisely because the product parser is ours.

**Do:** re-run it over the whole current corpus once the byte-moving queue
([047](047-report-duration-working-days.md), [051](051-unparsed-clndr-shapes.md),
[052](052-end-of-day-shift-rule.md)) has drained, and restate the paragraph with the count it earns.
