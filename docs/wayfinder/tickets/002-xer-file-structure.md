---
id: 002
title: How is a .xer file structured?
type: research
status: closed
assignee: carlo
blocked_by: [001]
---

## Question

What is actually inside a `.xer`, and what can be relied on?

This is the foundational ticket — the schema, the derived contract, the storefront
card and the ingest pipeline all wait on it. Read the format against the real
fixtures from [Get real .xer files to work against](001-get-real-xer-files.md);
documentation alone will not surface the things that break parsers.

Answer at least:

- **Physical format.** Record types (`ERMHDR`, `%T`, `%F`, `%R`, `%E`), the
  delimiter, encoding (and whether it varies), line endings, escaping rules for
  values containing tabs or newlines, and how nulls are represented.
- **The header.** What `ERMHDR` carries — P6 version, export date, database id,
  user, currency — and how far back that format is stable.
- **The table set.** Which tables appear, which are always present, and which are
  optional. At minimum characterise: `PROJECT`, `PROJWBS`, `TASK`, `TASKPRED`,
  `CALENDAR`, `PROJECTCALENDAR`, `RSRC`, `TASKRSRC`, `UDFTYPE`/`UDFVALUE`,
  `ACTVTYPE`/`ACTVCODE`/`TASKACTV`, `MEMOTYPE`/`TASKMEMO`.
- **The fields that matter.** For `TASK` and `TASKPRED` specifically: which
  columns carry the dates (early/late/actual/planned), durations, float, activity
  type, status, constraint type and date, relationship type and lag. Which are
  computed by P6 versus stored.
- **Calendars.** How working time is encoded, how exceptions are represented, and
  what it takes to convert a duration in hours to a duration in working days.
- **Version drift.** Which of the above changed between P6 versions present in the
  fixture set, and how a parser should detect and tolerate that.
- **Multi-project files.** What changes when one `.xer` contains several projects,
  and whether v1 should reject, split, or ingest them whole.
- **Gotchas.** Anything found in the fixtures that a naive tab-split parser would
  get wrong.
- **Existing parsers.** Survey what already exists in JS/TS and Python, their
  licences, and whether adopting one beats writing one. Note the licence
  explicitly — this repo is public.

Produce `docs/wayfinder/tickets/assets/xer-format.md` as the citable long form and
summarise the load-bearing conclusions in the resolution.

## Resolution

Long form: [`assets/xer-format.md`](assets/xer-format.md). Sources are Oracle's
*XER Import/Export Data Map Guide (Project)* v24 (49pp, 73 tables) and *Importing
and Exporting Guide* v25, cross-read against both fixture P6 versions.

**Oracle documents field mappings, not the file grammar.** There is no official
spec for the `%T`/`%F`/`%R` structure, no encoding declaration, no escaping rules,
and no enumeration of coded values. Those are all observed from the fixtures and
marked as such in the asset.

### Format

Line-oriented, tab-delimited, CRLF. `ERMHDR` header (P6 version in field 2), then
repeating `%T` table / `%F` field-names / `%R` rows, terminated by `%E`. Every
`%R` row matched its table's `%F` arity exactly across both fixtures. Nulls are
empty strings. Dates are `YYYY-MM-DD HH:MM`, naive local time — **no timezone is
recorded anywhere in the format**. Durations and float are integer hours and float
can be negative.

### The decision this ticket exists to make

**Never index fields by position; build a name→index map from `%F` per table, per
file.** Between the 6.0 and 8.3 fixtures — the same programme ten months apart —
`TASK`, `PROJECT` and `CALENDAR` all changed both field *set* and field *order*,
and `TASKPRED`/`PROJWBS` did not. Positional access fails silently with no arity
error. Corollary for storage: preserve unknown fields rather than dropping them,
or the archived blob becomes the only way to recover data a later parser wants.

### Calendars, decoded

`clndr_data` is a nested paren structure using `0x7F 0x7F` as its record
separator — the source of the DEL bytes that make `file` call the document binary.
`DaysOfWeek` holds days 1–7 (1 = Sunday) with shifts as `s|HH:MM|f|HH:MM`; a day
with no shifts is non-working. `Exceptions` holds `d|<serial>` entries, and the
serial epoch is **1899-12-30** (Excel/OLE) — established by decoding all 94
serials and finding 4 July ×11, 25 Dec ×10, 1 Jan ×9 and a floating late-November
Thanksgiving. Multi-shift days and exception *working* days remain unverified.

**Amended 2026-08-08 by [038](038-calendar-shapes-and-0x7f.md).** `0x7F 0x7F` is **not** a
record separator; it is layout. Base calendars are indented and carry runs of it, the
project calendars in the same files carry none at all and sit on one flat line, and both
decode to the same tree — only the parentheses carry structure. The shift grammar above is
also narrower than the format: attributes are an **order-free key-value bag**
(`f|12:00|s|8:00` occurs beside `s|08:00|f|16:00`) and the **hour is not zero-padded**
(`s|8:00`), which is this ticket's own never-by-position rule one level further down than
anybody looked. Multi-shift days and exception *working* days no longer "remain unverified"
— [021](021-verify-fixtures-in-p6.md) found both in real exports, heavily used, along with
the `VIEW` node. And `day_hr_cnt` / `week_hr_cnt` join the fields that cannot be trusted:
empty on some real calendars, contradicting the day pattern on others, and never the source
of a day length.

Incidental: that same result shows a non-US contract runs P6's stock **US**
holiday calendar unmodified. A candidate quality signal for
[The derived.json contract](006-derived-json-contract.md), and a caution against
inferring geography from calendars.

### Parser: build our own, in TypeScript

Licences verified, not assumed. [xerparser](https://pypi.org/project/xerparser/)
is **GPL-3.0-only** — unusable in a permissive public repo. [MPXJ](https://www.mpxj.org/)
is **LGPL**, by far the most complete implementation, but Java with no JS/TS
binding. The JS ecosystem has nothing mature. The tokenizer is ~150 lines; the
real work is calendar decoding, working-day conversion and float/longest-path
semantics, which no library provides in TypeScript anyway. Keep MPXJ as an offline
cross-check oracle rather than a dependency.

### Two traps worth naming

- `driving_path_flag` maps to **Longest Path**, not Critical. Critical derives from
  `total_float_hr_cnt` against `PROJECT.critical_drtn_hr_cnt`. Conflating them is
  the classic P6 reporting error. → [The derived.json contract](006-derived-json-contract.md)
- The data date is `PROJECT.last_recalc_date`. Not `scd_end_date`, not
  `sum_data_date` — both were mis-read during fixture profiling before the
  mapping was confirmed.

### Escaping — unresolved, and the likeliest source of silent corruption

Neither fixture contains a field with an embedded tab or newline; every line
begins with a record marker. But free-text fields exist (`task_name`, `task_memo`,
`comments`, UDF text) and nothing in the format prevents a newline in one. This set
has no `TASKMEMO` at all, so the case is untested. Parser must join continuation
lines until `%F` arity is satisfied, and log when it does.

### New ticket

Oracle prints an explicit caution that "Personal information (PI) may be at risk
of exposure" in XER files, and the format carries export-user names, `create_user`
/ `update_user`, resource emails, phone numbers and employee codes. This app
republishes whole `.xer` files publicly and serves the original bytes on download.
Raised as [Personal data in published .xer files](013-personal-data-in-published-files.md).

### Still unverified

Multi-project exports (no fixture — behaviour genuinely unknown), escaping, full enum
sets, baselines, notebook topics, and any P6 newer than 8.3 against current v25. Calendar
edge cases left this list on 2026-08-08 — see the amendment above. The first two need
fixtures, not more reading.
