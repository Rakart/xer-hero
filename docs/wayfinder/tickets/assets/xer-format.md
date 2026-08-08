# The .xer file format

Research asset for [How is a .xer file structured?](../002-xer-file-structure.md).

Two kinds of claim appear below and they are kept separate on purpose:

- **Documented** — stated by Oracle in the official data map guide.
- **Observed** — measured from the fixture set. Oracle does not publish a physical
  format specification, so much of what a parser actually needs is only knowable
  by reading real files.

Where a third party is the only source, it is named and marked as unverified.

## Sources

- Oracle, *Primavera P6 EPPM XER Import/Export Data Map Guide (Project)*, Version 24,
  January 2024 —
  [HTML](https://docs.oracle.com/cd/F88968_01/English/Mapping_and_Schema/xer_import_export_data_map_project/97896.htm) ·
  [PDF](https://docs.oracle.com/cd/F88968_01/English/Mapping_and_Schema/xer_import_export_data_map_project/xer_import_export_data_map_project.pdf).
  49 pages, 73 tables. This is the authoritative field-name → P6-label mapping.
- Oracle, *P6 EPPM Importing and Exporting Guide*, Version 25 —
  [HTML](https://docs.oracle.com/cd/G18294_01/English/Admin/p6_eppm_importing_exporting/101760.htm).
  Version-compatibility and XER-vs-XML behaviour.
- Oracle, *XER Import/Export Data Map Guide (Resource Only)*, Version 24 —
  [HTML](https://docs.oracle.com/cd/F88968_01/English/Mapping_and_Schema/xer_import_export_data_map_resource_only/97851.htm).
  Not used below; relevant only if resource-only exports are ever supported.
- The fixture set — see `xer-fixtures.local.md` (local only).

**Oracle documents the field mappings, not the file grammar.** There is no
official statement of the `%T`/`%F`/`%R` record structure, no encoding
declaration, no escaping rules, and no enumeration of the coded values that fill
`task_type`, `status_code`, `pred_type` and friends. Everything in
*Physical format*, *Enumerations* and *Calendars* below is observed.

## Physical format

Observed. A `.xer` is line-oriented plain text, tab-delimited, CRLF-terminated.

```
<file>    ::= <header> <table>+ "%E"
<header>  ::= "ERMHDR" TAB <version> TAB <date> TAB "Project" TAB <user_login>
                     TAB <user_name> TAB <db_name> TAB <module> TAB <currency>
<table>   ::= "%T" TAB <table_name>
              "%F" TAB <field_name> (TAB <field_name>)*
              ("%R" TAB <value> (TAB <value>)*)*
```

Record markers, all in column 1:

| Marker | Meaning |
|---|---|
| `ERMHDR` | File header. First line only. **Does not start with `%`** — a parser matching `^%` will miss it |
| `%T` | Begins a table. One field: the table name |
| `%F` | Field-name header for the current table |
| `%R` | One data row |
| `%E` | End of file |

The header line is the trap: it is the only record that is not `%`-prefixed.

### Field arity

Observed, and stronger than expected: across both fixtures **every `%R` row has
exactly the arity of its table's `%F` line**. No ragged rows, no trailing-tab
weirdness. A parser can zip `%F` names to `%R` values positionally *within a
table* and trust it.

### Nulls

Observed. A null is the empty string between two tabs. There is no sentinel. In
the first `TASK` row of the progressed fixture, 20 of 60 fields are empty — sparse
rows are the norm, not an anomaly.

Consequence: a parser cannot distinguish "null" from "empty string" from the file
alone, and must decide per field by type. For dates and numerics, empty means
null.

### Encoding

Observed. **Windows-1252 (CP1252), not UTF-8.** `file -bi` reports
`charset=binary`. High bytes appear in `CURRTYPE` — `0xA3` (`£`), `0xA5` (`¥`),
`0xD8` (`Ø`) — as currency symbols. UTF-8 decoding throws or mangles.

`0x7F` (DEL) also appears in quantity, inside `CALENDAR`, `TASK` and
`SCHEDOPTIONS`. Inside `clndr_data` it is **layout — insignificant whitespace**,
neither text nor structure, and it may be absent altogether. It is what makes
`file` call the document binary and nothing more; see *Calendars* below, where
getting this wrong costs a parser every project calendar in the file.

Line endings are CRLF throughout. Strip `\r` before splitting on tabs, or the last
field of every row carries a trailing carriage return.

### Escaping

Observed, and the happy surprise: **there is no escaping mechanism, and these
fixtures never need one.** No field value contains a literal tab or an embedded
newline; every line in both files begins with a record marker (`ERMHDR`, `%T`,
`%F`, `%R` or `%E`).

Treat this as *observed, not guaranteed*. Free-text fields exist in the format
(`task_name`, `wbs_name`, `task_memo`, `rsrc_notes`, `comments`, UDF text values)
and nothing in the format prevents a user typing a newline into one. Neither
fixture exercises those fields with multi-line content — this set has no
`TASKMEMO` at all.

**A parser must therefore be defensive**: if a line does not start with a known
marker, treat it as a continuation of the previous `%R` rather than discarding it,
and log it. If the continuation theory is right, the joined row will match the
`%F` arity — which gives a cheap self-check. This is the single most likely place
a naive parser silently corrupts real-world data, and it is untested here.

## The header

```
ERMHDR	8.3	2015-10-28	Project	admin	Primavera Admin	dbxDatabaseNoName	Project Management	USD
```

| Position | Meaning | Observed values |
|---|---|---|
| 1 | Marker | `ERMHDR` |
| 2 | **P6 version** | `6.0`, `8.3` |
| 3 | Export date | `2015-04-22` (date only, no time) |
| 4 | Export type | `Project` |
| 5 | User login | `admin` |
| 6 | User display name | `Adminstrator` *(Oracle's own misspelling, verbatim in the data)*, `Primavera Admin` |
| 7 | Database name | `dbxDatabaseNoName` |
| 8 | Module | `Project Management` |
| 9 | Base currency | `USD` |

Field 2 is the version key that drives everything else. Field 5/6 carry a real
person's name in the general case — see *Privacy* below.

## Table set

Oracle's Version 24 guide documents **73 tables**. The full list, with Oracle's
own descriptions:

`ACCOUNT` (Cost Accounts), `ACTVCODE` (Activity Code Values), `ACTVTYPE` (Activity
Codes), `APPLYACTOPTIONS` (Apply Actual Options), `ASGNMNTACAT` (Assignment Code
Assignments), `ASGNMNTCATTYPE` (Assignment Codes), `ASGNMNTCATVAL` (Assignment
Code Values), `BUDGCHNG` (Budget Changes), `CALENDAR` (Calendars), `COSTTYPE`
(Expense Categories), `CURRTYPE` (Currency Types), `DOCCATG` (Document
Categories), `DOCSTAT` (Document Statuses), `DOCUMENT` (Work Products and
Documents), `FINDATES` (Financial Periods), `FUNDSRC` (Funding Sources),
`ISSUHIST` (Notification History), `MEMOTYPE` (Notebook Topics), `OBS`,
`PCATTYPE` (Project Codes), `PCATVAL` (Project Code Values), `PHASE`, `PROJCOST`
(Project Expenses), `PROJECT` (Projects), `PROJEST` (Estimate History), `PROJFUND`
(Project Funding Assignments), `PROJISSU` (Issues), `PROJPCAT` (Project Code
Assignments), `PROJTHRS` (Thresholds), `PROJWBS` (WBS), `PRORISK` (Risks),
`RCATTYPE` (Resource Codes), `RCATVAL` (Resource Code Values), `RISKTYPE` (Risk
Types), `ROLECATTYPE` (Role Codes), `ROLECATVAL` (Role Code Values), `ROLELIMIT`
(Role Limits), `ROLERATE` (Role Prices), `ROLERCAT` (Role Code Assignments),
`ROLES`, `RSRC` (Resources), `RSRCCURV` (Resource Curves), `RSRCCURVDATA`
(Resource Curve Data), `RSRCLEVELLIST` (Resource Level List), `RSRCRATE` (Resource
Prices), `RSRCRCAT` (Resource Code Assignments), `RSRCROLE` (Resource Role
Assignments), `SCHEDOPTIONS` (Schedule Options), `SHIFT` (Shift Names), `SHIFTPER`
(Shifts), `TASK` (Activities), `TASKACTV` (Activity Code Assignments), `TASKDOC`
(Document Assignments), `TASKFDBK` (Activity Feedback), `TASKFIN` (Activity Past
Period Actuals), `TASKMEMO` (Activity Notebook), `TASKNOTE` (Activity Notes to
Resources), `TASKPRED` (Activity Relationships), `TASKPROC` (Activity Steps),
`TASKRSRC` (Activity Resource Assignments), `TASKUSER` (Activity Owners),
`THRSPARM` (Threshold Parameters), `TRSRCFIN` (Activity Resource Assignment Past
Period Actuals), `UDFTYPE` (User Defined Fields), `UDFVALUE` (User Defined Field
Values), `UMEASURE` (Units of Measure), `WBSBUDG` (Spending and Benefit Plans),
`WBSMEMO` (EPS, Project and WBS Notebook), `WBSRSRC_QTY`, `WBSSTEP` (WBS
Milestones).

**Only a fraction appear in any given file.** The fixtures carry 17–20 tables. A
parser must treat every table as optional and must tolerate tables it has never
heard of — Oracle adds them between versions.

Tables observed in the fixtures, largest first:

| Table | 6.0 rows | 8.3 rows | Note |
|---|---|---|---|
| `TASKACTV` | 25,779 | 28,291 | **Largest table.** ~14 per activity |
| `UDFVALUE` | 10,725 | 14,234 | |
| `TASKPRED` | 2,789 | 2,825 | ~1.6 per activity |
| `TASKRSRC` | 2,674 | 3,061 | |
| `TASK` | 1,746 | 1,751 | |
| `ACTVCODE` | 395 | — | |
| `PROJWBS` | 164 | 164 | |
| `POBS`, `ACTVTYPE`, `UDFTYPE`, `CURRTYPE`, `RSRC`, `RSRCRATE`, `CALENDAR`, `SCHEDOPTIONS`, `PROJECT`, `OBS` | small | small | |
| `PCATTYPE`, `PCATVAL`, `PROJPCAT` | absent | present | 8.3 only in this set |

`POBS` appears in the files but is **not** in Oracle's Version 24 table list —
direct evidence that the documented set and the emitted set differ.

## Key tables

Field names below are Oracle's; the labels are Oracle's P6 UI names. Only the
load-bearing fields are reproduced — the guide has the complete lists.

### TASK (Activities)

| Field | P6 label |
|---|---|
| `task_id` | Unique ID |
| `proj_id` | Project |
| `wbs_id` | WBS |
| `clndr_id` | Calendar |
| `task_code` | Activity ID |
| `task_name` | Activity Name |
| `task_type` | Activity Type |
| `status_code` | Activity Status |
| `duration_type` | Duration Type |
| `complete_pct_type` | Percent Complete Type |
| `phys_complete_pct` | *(no label given in Oracle's table)* |
| `target_drtn_hr_cnt` | Planned Duration (EPPM) / Original or Planned Duration (Professional) |
| `remain_drtn_hr_cnt` | Remaining Duration |
| `target_start_date` / `target_end_date` | Planned Start / Planned Finish |
| `early_start_date` / `early_end_date` | Early Start / Early Finish |
| `late_start_date` / `late_end_date` | Late Start / Late Finish |
| `act_start_date` / `act_end_date` | Actual Start / Actual Finish |
| `restart_date` / `reend_date` | Remaining Early Start / Remaining Early Finish |
| `rem_late_start_date` / `rem_late_end_date` | Remaining Late Start / Remaining Late Finish |
| `total_float_hr_cnt` | Total Float |
| `free_float_hr_cnt` | Free Float |
| `cstr_type` / `cstr_date` | Primary Constraint / Primary Constraint Date |
| `cstr_type2` / `cstr_date2` | Secondary Constraint / Secondary Constraint Date |
| `driving_path_flag` | **Longest Path** |
| `float_path` / `float_path_order` | Float Path / Float Path Order |
| `suspend_date` / `resume_date` | Suspend Date / Resume Date |
| `expect_end_date` | Expected Finish |
| `rsrc_id` | Primary Resource |
| `create_date` / `create_user` / `update_date` / `update_user` | Added Date / Added By / Last Modified Date / Last Modified By |

Note `driving_path_flag` maps to **Longest Path**, not "critical". Critical is
derived by comparing `total_float_hr_cnt` against the project's
`critical_drtn_hr_cnt` threshold, or by `critical_path_type` — not the same thing.
Getting this wrong is the classic P6 reporting error and it should be settled
explicitly in the derived contract.

### TASKPRED (Activity Relationships)

Complete — Oracle documents 8 fields:

| Field | P6 label |
|---|---|
| `task_pred_id` | Unique ID |
| `task_id` | Successor |
| `pred_task_id` | Predecessor |
| `proj_id` | Successor Project |
| `pred_proj_id` | **Predecessor Project** |
| `pred_type` | Relationship Type |
| `lag_hr_cnt` | Lag |
| `comments` | Comments |

`pred_proj_id` differing from `proj_id` marks an **external relationship** —
logic pointing at an activity in another project, which may not be in the file at
all. Dangling references are legitimate, not corruption.

### PROJECT

71 fields in 6.0, 66 in 8.3. The ones that matter:

| Field | P6 label |
|---|---|
| `proj_id` | Unique ID |
| `proj_short_name` | Project ID |
| `last_recalc_date` | **Last Recalc Date — the data date** |
| `plan_start_date` | Planned Start |
| `plan_end_date` | Must Finish By |
| `scd_end_date` | Schedule Finish |
| `clndr_id` | Default Calendar |
| `critical_drtn_hr_cnt` | Critical activities have float less than or equal to |
| `critical_path_type` | `critical_path_type` |
| `sum_base_proj_id` | Project Baseline |
| `guid` | Global Unique ID |
| `add_date` / `add_by_name` | Date Added / Added By |

The data date is `last_recalc_date`. There is no field literally named
`data_date`, and several plausible-looking date fields (`scd_end_date`,
`sum_data_date`) are not it — this was mis-read once already during fixture
profiling.

### PROJWBS (WBS)

`wbs_id`, `parent_wbs_id`, `proj_id`, `wbs_short_name` (WBS Code), `wbs_name`
(WBS Name), `seq_num` (Sort Order), `proj_node_flag` (Project Node),
`status_code` (Project Status), plus earned-value fields.

`parent_wbs_id` gives the tree. `proj_node_flag` marks the root. 164 nodes for
1,750 activities in the fixtures — small enough to be relational without concern.

### TASKACTV (Activity Code Assignments)

Four fields — `task_id`, `actv_code_id`, `actv_code_type_id`, `proj_id` — and it
is the **biggest table in the file**. Resolves against `ACTVTYPE` (the code
definitions) and `ACTVCODE` (the values, which are hierarchical via
`parent_actv_code_id`).

### CALENDAR

`clndr_id`, `clndr_name`, `clndr_type`, `proj_id`, `base_clndr_id` (Parent
Calendar), `default_flag`, `day_hr_cnt` / `week_hr_cnt` / `month_hr_cnt` /
`year_hr_cnt` (Work Hours Per Day/Week/Month/Year), `last_chng_date`, and
`clndr_data` — the packed working-time blob, decoded below.

`day_hr_cnt` and `week_hr_cnt` are **not** a reliable statement of the calendar's
day length: both are empty on some real calendars and can contradict the day
pattern where populated. See *Calendars* below.

`rsrc_private` (Personal Calendar) exists in 8.3 and not in 6.0.

## Enumerations

Oracle documents none of these. All observed, with fixture frequencies:

| Field | Values seen |
|---|---|
| `task_type` | `TT_Task` (1690), `TT_FinMile` (35), `TT_Mile` (26). Format implies `TT_LOE`, `TT_WBS`, `TT_Rsrc` exist but are absent here |
| `status_code` (TASK) | `TK_NotStart` (1493), `TK_Complete` (192), `TK_Active` (66) |
| `pred_type` | `PR_FS` (2813), `PR_SS` (9), `PR_FF` (3). `PR_SF` absent but certainly exists |
| `duration_type` | `DT_FixedDUR2` (1690), `DT_FixedDrtn` (61) |
| `complete_pct_type` | `CP_Drtn` (1750), `CP_Units` (1). `CP_Phys` expected |
| `cstr_type` | empty (1696), `TT_FinMile`-era codes: `CS_MEO` (35), `CS_MSO` (14), `CS_MSOA` (6). Many more exist in P6 |
| `clndr_type` | `CA_Base` (3), `CA_Project` (2). `CA_Rsrc` expected |
| `rsrc_type` | `RT_Labor` (13), `RT_Equip` (1), `RT_Mat` (1) |
| `status_code` (PROJWBS) | `WS_Open` (164) |

**These lists are incomplete by construction** — one programme cannot exhibit
every code. A parser must not treat an unknown code as an error. Store the raw
string; map to a display label where known; fall back to the raw code otherwise.

## Dates and durations

Observed.

- **Date format**: `YYYY-MM-DD HH:MM` — no seconds, no timezone, no offset.
  Local wall-clock time in whatever timezone the exporting database used, which
  the file does not record. Treat as naive local time; do **not** parse to UTC.
- Header export date is date-only: `YYYY-MM-DD`.
- **Durations and float are in hours**, as integers, in fields suffixed
  `_hr_cnt`. `target_drtn_hr_cnt=224` is 28 working days at an 8-hour day.
- **Float may be negative**: `total_float_hr_cnt=-800` observed — 100 days behind.
- **Float may be empty** on some activities. Do not coerce empty to zero; zero
  float means critical and is a materially different claim.
- Converting hours to working days requires the day length of the activity's own
  calendar, not a global assumption. Different calendars in one file will have
  different day lengths — and the day length comes from the shift pattern inside
  `clndr_data`, not from the `day_hr_cnt` column, which is empty on some real
  calendars and wrong on others. See *Calendars* below.

## Calendars

The `clndr_data` field is a packed structure, and decoding it is the hardest part
of the format. Observed; Oracle documents nothing beyond "Data".

The structure is nested parenthesised nodes of the form
`(0||<name>(<attributes>)(<children>))`, and **only the parentheses carry
structure**. `0x7F` and whitespace are layout: they can be stripped before parsing
without changing the meaning, and they may be absent entirely.

That last clause is the one that matters, and this document stated it backwards
until [021](../021-verify-fixtures-in-p6.md) measured it
([evidence](p6-substitute-validation.md) §2). Base calendars
(`clndr_type = CA_Base`) are written indented with runs of `0x7F 0x7F` between
nodes — 34 to 352 DEL bytes apiece in the real files, and the source of the DEL
runs that make `file` report the whole document as binary. The **project**
calendars (`CA_Project`) sitting in the same file carry **zero** `0x7F` bytes: the
whole blob is one flat unindented string. Both decode to the same tree. A parser
that treats `0x7F 0x7F` as a required record separator reads every real project
calendar as one unparseable record.

Rendering `0x7F` as a newline reveals the base-calendar form:

```
(0||CalendarData()(
  (0||DaysOfWeek()(
    (0||1()(
      (0||0(s|08:00|f|16:00)())))
    (0||2()(
      (0||0(s|08:00|f|16:00)())))
    ...
    (0||7()(
      (0||0(s|08:00|f|16:00)())))))
  (0||Exceptions()(
    (0||0(d|36525)())
    (0||1(d|36675)())
    ...))))
```

Nothing renders the project-calendar form, because there is nothing in it to
render — the same tree arrives as one line, and the three differences beyond the
missing `0x7F` are all in the shift nodes. From the corpus fixture built to that
shape (`cal-flat-no-0x7f`, second `CALENDAR` row):

```
(0||CalendarData()((0||DaysOfWeek()((0||1()())(0||2()((0||0(f|12:00|s|8:00)())
(0||1(f|17:00|s|13:00)())))(0||3()(...
```

Wrapped for the page; the field itself contains no break of any kind.

- `DaysOfWeek` holds seven children keyed `1`–`7`. Day 1 is Sunday.
- Each day holds zero or more work shifts. A day with no shift children is a
  non-working day. **Days routinely hold more than one shift**: the common real
  shape is the lunch break, `s|08:00|f|12:00` and `s|13:00|f|17:00` as two shift
  children of one weekday, and three-shift days occur across the wider file set.
- **Shift attributes are a key-value bag, not a tuple.** Base calendars emit
  `s|08:00|f|16:00`; project calendars in the same file emit `f|12:00|s|8:00` —
  finish first. Read them by key, never by position. This is the `%F` header lesson
  of *Version drift* below, one level down and in the same file rather than between
  two files.
- **The hour is not zero-padded.** `s|8:00`, not `s|08:00`, on those same project
  calendars — six of 24 time values in one real calendar. A `\d\d:\d\d` time pattern
  silently drops every shift starting before 10:00, which is most of them.
- `Exceptions` holds entries keyed `d|<serial>`. An exception with **no** children
  is a non-working date. An exception **with** shift children is a working day
  bought back — `(0||33(d|39633)((0||0(s|08:00|f|16:00)())))` — and it is not
  exotic: one real six-day-week calendar carries 80 of them, Sundays worked on a
  weekly cadence.
- `(0||VIEW(ShowTotal|N)())` is a display setting, not working time, and appears in
  real base calendars. Ignore it, but do not choke on it.

### The exception date serial

`d|36525` is a **day serial with epoch 1899-12-30** — the Excel / OLE automation
date serial. Verified by decoding all 94 distinct exception serials in the fixture
and checking the month-day distribution:

| Epoch | Top month-days |
|---|---|
| **1899-12-30** | `07-04` ×11, `12-25` ×10, `01-01` ×9, `11-23`/`11-24`/`11-25`/`11-28` ×13 combined |
| 1899-12-31 | `07-05`, `12-26`, `01-02` — off by one, meaningless |

Independence Day, Christmas, New Year and a floating late-November Thanksgiving.
Unambiguous.

That result carries an incidental finding worth keeping: the base calendar in this
**non-US** rail contract is P6's stock **US** holiday calendar, shipped
unmodified. Real programmes routinely carry unlocalised default calendars, which
is a plausible quality signal for the derived contract — and a caution against
inferring a project's geography from its calendar.

### `day_hr_cnt` and `week_hr_cnt` cannot be trusted

The `CALENDAR` row declares the working-hour counts as scalars — `day_hr_cnt`,
`week_hr_cnt`, `month_hr_cnt`, `year_hr_cnt` — and it is tempting to read a day
length out of the row rather than out of the blob. Both of the first two are
**empty on some real calendars**, and where they are populated they can contradict
the day pattern beside them: a seven-day calendar working eight hours a day
declares `week_hr_cnt = 40`. Neither is derivable from the other, neither is
derivable from the pattern, and the pattern does not follow from either.

**The day pattern in `clndr_data` is the only trustworthy statement of what a
calendar means.** Where a computed figure needs a day length, take it from the
shifts. Where the shifts are unavailable, report unavailable — the same contract a
file carrying no `CALENDAR` table forces. Neither hour count should feed a derived
statistic, and neither should be used to sanity-check the other.

### Caveat

Superseded, and kept as a record of what was open. Multi-shift days, exception
*working* days and the `VIEW` node were all unverified when this was written; all
three were confirmed against real exports by
[021](../021-verify-fixtures-in-p6.md), which found the generator's guesses at
their shapes correct and the rule written around them — the `0x7F` separator claim
— wrong. What remains true is the advice: calendar parsing should be built
defensively and validated against a purpose-built fixture. The corpus now carries
two — `cal-clndr-data` for the indented base-calendar form, and `cal-flat-no-0x7f`,
which holds **one calendar written twice**, indented and flat, so that a parser
reading the layout instead of the structure fails a test rather than a user.

## Version drift

Documented compatibility, from the Version 25 Importing and Exporting Guide:

> "If the XER file was generated from a version earlier than release 20.4, when it
> is imported into release 20.4 or later rates for roles will be the same for all
> effective dates. If an XER file generated from release 20.4 or later is imported
> into a database with a version of 20.3 or earlier, only the rates which were
> effective at the time of export will be imported."

Observed drift between the 6.0 and 8.3 fixtures — the same programme, ten months
apart:

| Table | 6.0 | 8.3 | Delta |
|---|---|---|---|
| `TASK` | 61 fields | 60 fields | 8.3 **adds** `location_id`; 6.0 has `review_end_date`, `review_type` (Professional-only fields) |
| `PROJECT` | 71 fields | 66 fields | 8.3 adds `location_id`, `sum_refresh_date`; drops `chng_eff_cmp_pct_flag`, `intg_proj_type`, `risk_level`, `sum_data_date`, `sum_only_flag`, `ts_rsrc_mark_act_finish_flag`, `ts_rsrc_vw_inact_actv_flag` |
| `CALENDAR` | 12 fields | 13 fields | 8.3 adds `rsrc_private` |
| `TASKPRED` | 10 | 10 | identical, same order |
| `PROJWBS` | 26 | 26 | identical, same order |
| tables | — | +3 | 8.3 adds `PCATTYPE`, `PCATVAL`, `PROJPCAT` |

**Field order differs, not merely the field set** — `TASK`, `PROJECT` and
`CALENDAR` all changed order. A parser that hardcodes column positions reads
correct data from one file and wrong data from the other, *silently*, with no
error and no arity mismatch. This happened during fixture profiling: a fixed index
returned `status_code` from the 6.0 file and an activity-code string from the 8.3
file.

**The rule: build a `Map<fieldName, index>` from each table's `%F` line, per
table, per file. Never index by position.**

The corollary for storage: because the field set is version-dependent, a parser
should preserve unknown fields rather than dropping them, or re-parsing an
archived blob under a newer parser will be the only way to recover data that was
present all along.

## Multi-project files

Not exercised. Every fixture is a single-project export. `PROJECT` has one row and
every `proj_id` matches it.

The format plainly supports multiple projects — `proj_id` is carried on nearly
every table precisely so rows can be attributed — and `TASKPRED.pred_proj_id`
exists to express cross-project logic. What is unknown is how P6 exports them in
practice and whether `PROJWBS` gains additional root nodes.

**Unresolved.** The ingest pipeline ticket must decide whether to reject, split or
ingest-whole, and that decision needs a real multi-project fixture first.

## Privacy

Oracle prints this caution at the top of the data map guide:

> "**Caution:** Personal information (PI) may be at risk of exposure. Depending on
> local data protection laws organizations may be responsible for mitigating any
> risk of exposure."

It is well founded. Named-person and internal-identifier fields present in the
format include `ERMHDR` fields 5–6 (export user login and display name),
`TASK.create_user` / `update_user`, `PROJECT.add_by_name`, `RSRC.email_addr`,
`RSRC.office_phone`, `RSRC.other_phone`, `RSRC.employee_code`, `RSRC.user_id`,
`RSRC.rsrc_name`, `TASKUSER.user_id`, `DOCUMENT.author_name`, and free-text
`rsrc_notes` / `task_memo` / `comments`.

This matters more here than in a normal P6 workflow: **this app republishes whole
`.xer` files to the public internet.** Even with authored templates as launch
stock, the upload path accepts arbitrary files and the download button serves the
original bytes. At minimum, the licensing ticket needs to decide whether the
uploader is warned, and the ingest ticket whether the header and audit fields are
stripped or surfaced. Neither should be discovered after the first upload.

## Existing parsers

Surveyed for adoption. Licence verified from the package index or project site in
each case, because this repo is public.

| Project | Language | Licence | Verdict |
|---|---|---|---|
| [xerparser](https://pypi.org/project/xerparser/) | Python 3.11+ | **GPL-3.0-only** (verified) | Actively maintained — 0.13.9, Nov 2025. Copyleft; unusable in a permissively licensed codebase |
| [MPXJ](https://www.mpxj.org/) | Java, with .NET/Python/Ruby bindings | **LGPL** (verified) | The most complete implementation by far — reads XER, PMXML, P6 Web Services. No JS/TS binding. Wrong runtime |
| [PyP6XER](https://pypi.org/project/PyP6XER/) | Python | not verified | Object-oriented full-model parser |
| [xer-reader](https://pypi.org/project/xer-reader/) | Python | not verified | Table-level reader, lighter than a full model |
| [7coder/xer-parser](https://github.com/7coder/xer-parser) | JavaScript | not verified | XER → MongoDB. Small, single-purpose |

**Recommendation: write our own, in TypeScript.**

The reasoning is not "not invented here":

1. **Nothing usable exists in the target runtime.** The mature options are Python
   and Java. The stack is heading to TypeScript on Vercel, and standing up a
   second runtime purely to parse a tab-delimited file is a poor trade.
2. **The licences are wrong.** The best-maintained option is GPL-3.0-only and MPXJ
   is LGPL. A public repo intended to be permissively licensed cannot take the
   first, and the second is unavailable in-runtime anyway.
3. **The tokenizer is genuinely trivial** — five record types, one delimiter, no
   escaping. It is perhaps 150 lines including the defensive continuation
   handling.
4. **The hard parts are not parsing.** Calendar decoding, working-day conversion,
   float and longest-path semantics, and the derived statistics are where the real
   work is, and no library hands those over in TypeScript regardless.

MPXJ remains worth keeping in view as a **cross-check oracle**: if a computed
figure is ever in doubt, running the same file through MPXJ offline is a cheap way
to check our answer, without taking a runtime dependency.

## Gotchas — the checklist

1. `ERMHDR` does not start with `%`. Matching `^%` skips the header.
2. Strip `\r` before splitting, or every row's last field is polluted.
3. Decode as CP1252. UTF-8 will throw on `£`, `¥`, `Ø` in `CURRTYPE`.
4. Inside `clndr_data`, **only the parentheses carry structure**; `0x7F` and
   whitespace are insignificant. Real `CA_Project` calendars contain **no** `0x7F`
   at all and are one flat string, while the `CA_Base` calendars beside them are
   indented and full of it — both mean the same thing. Splitting on `0x7F` as a
   record separator loses every project calendar.
5. **Never index fields by position.** Map `%F` names → indices per table per file.
6. Unknown tables and unknown enum values are normal. Do not error.
7. Empty string is null. Empty float ≠ zero float.
8. Durations and float are integer **hours**, and float can be negative.
9. Dates are naive local time, `YYYY-MM-DD HH:MM`. No timezone is recorded anywhere.
10. The data date is `PROJECT.last_recalc_date`, not `scd_end_date` or
    `sum_data_date`.
11. `driving_path_flag` is Longest Path, not Critical. They differ.
12. `TASKPRED.pred_proj_id != proj_id` means external logic; the referenced
    activity may be absent from the file.
13. `TASKACTV` is the largest table. Size ingest on it, not on `TASK`.
14. Calendar exception serials use epoch **1899-12-30**.
15. Treat multi-line free-text fields as possible even though the fixtures show
    none — recover by joining continuation lines until `%F` arity is satisfied.
16. **Shift attributes are order-free.** `s|08:00|f|16:00` and `f|12:00|s|8:00`
    both occur, in the same file. Read them as a key-value bag; gotcha 5 one level
    down.
17. **Calendar times are not zero-padded.** `s|8:00` occurs. A `\d\d:\d\d` pattern
    drops most of a day's shifts and reports a shorter working day, silently.
18. `CALENDAR.day_hr_cnt` and `week_hr_cnt` are empty on some real calendars and
    contradict the day pattern on others. The shifts in `clndr_data` are the only
    trustworthy day length; neither column should feed a computed figure.

## What remains unverified

Honest list of what this research could not settle:

- **Escaping and multi-line values.** No fixture exercises them. The defensive
  strategy above is untested.
- **Multi-project exports.** No fixture. Behaviour genuinely unknown.
- ~~**Calendar edge cases.** Multi-shift days, exception *working* days, and the
  `VIEW` node are all unverified.~~ **Settled** by
  [021](../021-verify-fixtures-in-p6.md): all three are real and all three were
  guessed correctly. What that exercise also found is that the *rule* written
  around them here was wrong — see *Calendars* — and that two further shapes exist
  which no fixture emitted at all: order-free shift attributes and the unpadded
  hour.
- **The full enum sets.** Only the values one programme happens to use are known.
- **Baselines.** No baseline tables in any fixture.
- **`TASKMEMO` / notebook topics.** Absent entirely — and the most likely home for
  multi-line text.
- **Newer P6 versions.** The fixtures are 6.0 and 8.3, both a decade old. Current
  P6 is version 25. Drift between 8.3 and 25 is documented at the field-mapping
  level but has not been observed in a file.

The first two are the ones that will bite. Both need fixtures, not more reading.

> **Amended 2026-08-08** by [What does `f|00:00|s|00:00` mean?](../048-elapsed-calendar-semantics.md).
> Five corrections, all in *Calendars* and the gotcha list.
>
> 1. The shift bullets gain the rule this document never stated: **a shift whose finish is `00:00`
>    runs to the end of the day**, so `s|00:00|f|00:00` is a 24-hour day and `s|08:00|f|00:00` is 16 —
>    keyed on the **finish**, never on `finish == start`, because `s|08:00|f|08:00` is zero. 137 of
>    563 real `CALENDAR` rows carry it, in three serialisations, and MPXJ has implemented it against
>    P6 since 2017. `24:00` and `23:59` never occur in any real calendar; `00:00` is the only spelling
>    of end-of-day the format has.
> 2. A new gotcha for it.
> 3. **Gotcha 18 keeps its rule and loses half its evidence.** `day_hr_cnt` **never** contradicts the
>    day pattern — 561 of 561 agree under the corrected reading — while `week_hr_cnt` does so on **290
>    of 561**. The rule stands because Oracle documents all four columns as **conversion factors** for
>    entering and displaying durations, defaulting to 8 hours a day whatever the shifts say.
> 4. The hour-count columns can be **absent from `CALENDAR`'s `%F` list entirely**, not merely empty.
> 5. The `Exceptions` node is **optional** — 271 of 563 real calendars carry none — and `VIEW` carries
>    `ShowTotal|Y` as well as the `N` shown here.
>
> Three further real shapes this document does not describe, all live decoder defects, are
> [051](../051-unparsed-clndr-shapes.md).
