# Personal data in real `.xer` files — corpus audit

Working notes for
[Personal data in published .xer files](../013-personal-data-in-published-files.md).

Measured 2026-08-08 against **143 real `.xer` files** — the 139 of Fixture A (one
live contract, monthly revisions over two years, P6 6.0 and 8.3) and the 4 of
Fixture B (tender variants, P6 8.3).

**Counts and classifications only.** No field value from a real file appears in
this document, and no file path or client identity does either. The fixtures are
gitignored forever ([Stack, hosting and auth provider](../010-stack-hosting-auth.md));
this file is the durable record of what was in them.

---

## 1. Method

Name-mapped, never positional — the rule fixed by
[How is a .xer file structured?](../002-xer-file-structure.md). Each file is
decoded `LATIN1 → UTF-8` and stripped of `\r` before parsing.

> `iconv -f CP1252` **fails** on this corpus — `illegal input sequence` at the
> first byte in CP1252's undefined set (`0x81`, `0x8D`, `0x8F`, `0x90`, `0x9D`).
> `LATIN1` maps all 256 byte values and is correct for a byte-census like this
> one. A real parser needs `CP1252` with a replacement policy, not `-c`.

```awk
# pi-profile.awk — per-file PI census. Emits counts and shapes, never values.
BEGIN { FS = "\t"
  ROLE = "engineer|foreman|labour|labor|crew|gang|team|supervisor|manager|operator|driver|worker|mason|carpenter|steel|fitter|welder|electrician|plumber|surveyor|technician|clerk|admin|contractor|subcon|excavat|crane|truck|plant|equipment|material|concrete|rebar|formwork|scaffold|site|qa|qc|safety|design|architect|consultant|resource"
}
/^ERMHDR/ { hdr_is_admin = ($5 ~ /^(admin|Admin|ADMIN)$/); next }
$1 == "%T" { tbl = $2; delete idx; next }
$1 == "%F" { for (i = 2; i <= NF; i++) idx[tbl "." $i] = i; next }
$1 == "%R" {
  rows[tbl]++
  if (tbl == "TASK") {
    cu = $(idx["TASK.create_user"]); if (cu != "") task_cu[cu]++
    uu = $(idx["TASK.update_user"]); if (uu != "") task_uu[uu]++
  }
  if (tbl == "RSRC") {
    rn = $(idx["RSRC.rsrc_name"]); lc = tolower(rn)
    if (rn != "") { if (lc ~ ROLE) role_like++; else if (rn ~ /^[A-Z][A-Za-z.'-]+ +[A-Z]/) person_like++; else other_like++ }
    if (idx["RSRC.email_addr"]    && $(idx["RSRC.email_addr"])    != "") email++
    if (idx["RSRC.office_phone"]  && $(idx["RSRC.office_phone"])  != "") ophone++
    if (idx["RSRC.other_phone"]   && $(idx["RSRC.other_phone"])   != "") tphone++
    if (idx["RSRC.employee_code"] && $(idx["RSRC.employee_code"]) != "") emp++
    if (idx["RSRC.user_id"]       && $(idx["RSRC.user_id"])       != "") uid++
  }
  next
}
END { n = 0; for (k in task_cu) n++          # distinct creators
      m = 0; for (k in task_uu) m++          # distinct updaters
      printf "%s\thdr_admin=%d\ttask=%d\tdcu=%d\tduu=%d\trsrc=%d\t...\n", NAME, hdr_is_admin, rows["TASK"], n, m, rows["RSRC"] }
```

Run per file with `-v NAME=A1`, `A2` … and aggregated across the 143 outputs. A
second pass grouped `RSRC.rsrc_type` and `UDFVALUE.udf_text` by
`UDFTYPE.udf_type_label` to classify the resource and free-text surfaces.

---

## 2. What is actually in the files

143 files · 243,225 `TASK` rows · 2,051 `RSRC` rows.

| Field Oracle's PI caution names | Rows populated | Files |
|---|---|---|
| `RSRC.email_addr` | **0** | 0 / 143 |
| `RSRC.office_phone` | **0** | 0 / 143 |
| `RSRC.other_phone` | **0** | 0 / 143 |
| `RSRC.employee_code` | **0** | 0 / 143 |
| `RSRC.user_id` | **0** | 0 / 143 |
| `TASKUSER` (whole table) | **absent** | 0 / 143 |
| `DOCUMENT` (whole table) | **absent** | 0 / 143 |
| `TASK.create_user` | 243,225 (**100%**) | 143 / 143 |
| `TASK.update_user` | 243,225 (**100%**) | 143 / 143 |
| `PROJECT.add_by_name` | 1 per file | 143 / 143 |
| `PROJWBS.create_user` / `update_user` | 100% of WBS rows | 143 / 143 |
| `RSRC.rsrc_name` | 2,051 (100% of rows) | 143 / 143 |
| `RSRC.rsrc_notes` | 133 | ~133 (max 1/file) |
| `TASKMEMO.task_memo` | 813 / 105,867 bytes | 55 / 143 |
| `UDFVALUE.udf_text` | 1,020,501 / 12,523,806 bytes | 143 / 143 |
| `ERMHDR` field 5 (export login) | present | `admin` in **142 / 143** |

### The audit fields are one name, not many

Across all 143 files the count of **distinct** `TASK.create_user` values is
**1**, and of `TASK.update_user` also **1**. Not one per file on average — one,
in every file, with zero files carrying more than one. A P6 export flattens the
whole activity table's authorship to a single login.

This is the surface that is 100% populated and simultaneously the cheapest to
report and the emptiest of meaning.

### The resource dictionary is the real surface

| `rsrc_type` | rows |
|---|---|
| `RT_Labor` | 1,639 (80%) |
| `RT_Mat` | 279 |
| `RT_Equip` | 133 |

Names run 1–4 whitespace tokens. A crude classifier (role-word dictionary, else
`Capitalised Capitalised` → person-like) splits the 2,051 as 286 role-like,
1,088 person-like, 677 other — but the classifier is **not trustworthy**, because
`RT_Mat` names like `Concrete Grade` match the person-like pattern. What survives
the doubt: 80% of resource rows are labour, Fixture A's labour names are
overwhelmingly 1–2 tokens, and **no automatable rule separates a crew member's
name from a trade**. That is the finding, not the percentages.

Per-file sizing, which is what the disclosure panel has to render:

| | min | median | p90 | max |
|---|---|---|---|---|
| `RSRC` rows per file | 0 | **15** | 15 | **37** |
| `TASKMEMO` rows per file | 0 | 0 | 20 | **27** |
| `RSRC.rsrc_notes` per file | 0 | 1 | 1 | 1 |

The entire named-entity surface of the worst real file is 37 resources plus 27
memos. It fits on one screen.

### Free text is enormous and is not prose

`udf_text` is 12.5 MB across the corpus — larger than any other PI-suspect
surface by two orders of magnitude. Grouped by `UDFTYPE.udf_type_label` it turns
out to be engineering data:

| Label | values | bytes | avg length |
|---|---|---|---|
| `PROJ_AREA` | 112,064 | 4,608,768 | 41 |
| `user_text2` | 179,988 | 1,232,590 | 7 |
| `PROJ_ZONE` | 112,064 | 1,968,000 | 18 |
| `PROJ_Quantities` | 52,327 | 872,661 | 17 |
| `Start Chainage` / `Finish Chainage` | 47,628 each | 238,140 each | 5 |
| `PROJ_BOQ Items`, `Qty`, `Units`, `Gang` | 3,796–12,126 | 4,283–50,218 | 1–4 |
| **`Remarks`** | **2,053** | **32,500** | **16** |
| **`Comments`** (PROJECT) | **4** | **188** | **47** |

The `PROJ_` prefix on four of those labels is a **redaction**: in the source files it is the
project's own code, which identifies the contract. Only the prefix was changed; the counts, byte
totals and lengths are as measured. The same redaction is applied wherever an example project code
appears in this repo.

Chainages, zones, quantities, BOQ references. Average value lengths of 1–41
characters. The only prose-shaped labels in the whole corpus are `Remarks`
(32 KB) and a `PROJECT.Comments` field with four values — together under 0.3% of
the free-text bytes.

So the free-text risk is **real but small and unscannable**, and it is nowhere
near proportional to the byte count. Excluding `UDFVALUE` from publication to
manage it would delete the corpus's densest engineering payload to remove 32 KB
of prose.

---

## 3. Where PI can reach a reader

Cross-checked against the two served contracts:

| Object | Carries PI? | Why |
|---|---|---|
| Postgres row (~11 columns + `card`) | **no** | [Domain model and schema](../005-domain-model-and-schema.md) — no author, no resource fields |
| `derived.v{N}.json` | **no** | [The derived.json contract](../006-derived-json-contract.md) — `resource_count` is an integer; UDF inventory was cut as *merely true* |
| `activities.json` | **no** | [The project detail page](../008-project-detail-page.md) fixed v1 at 13 `TASK` columns + the WBS tree. `TASKRSRC`, `TASKACTV` and `TASKPRED` are all cut, so no resource ever reaches the client |
| Server-rendered programme page | **no** | renders from `derived.json` only |
| **`original.xer.gz`** | **yes — all of it** | served byte-identical on download |

Every PI field in the format is confined to **one object**, fetched only when a
visitor explicitly downloads. This was not designed for — it falls out of cuts
made for payload size in 006 and 008 — but it is the single most important fact
in this audit, because it means the exposure question is a question about one
URL rather than about the site.

---

## 4. What this supports

Verbatim publication is defensible on this evidence and stripping is not:

1. The fields a stripper could reliably detect (`email_addr`, phones,
   `employee_code`, `user_id`, `TASKUSER`, `DOCUMENT`) are **empty in every real
   file**. A detector would fire on nothing.
2. The fields that are populated are either meaningless (one `admin`-shaped
   audit name) or **undetectable** (`rsrc_name`, `rsrc_notes`, `task_memo`,
   `Remarks`).
3. Therefore any stripper ships a file that is *changed* — no longer a clean P6
   round-trip — while still carrying the personal data it claims to have removed.

The uncomfortable residue, recorded plainly: 1,639 labour resource rows and
32 KB of `Remarks` are published as-is, and some of them name real people who
never agreed to it. No measurement makes that go away; the position is that it
is disclosed, not screened.
