---
id: 013
title: Personal data in published .xer files
type: grilling
status: closed
assignee: carlo
blocked_by: []
---

## Question

Oracle prints this at the top of its own data map guide:

> **Caution:** Personal information (PI) may be at risk of exposure. Depending on
> local data protection laws organizations may be responsible for mitigating any
> risk of exposure.

That warning is aimed at organisations exchanging XER files privately. This app
republishes them **to the public internet** and serves the original bytes on
download. The warning applies with considerably more force.

Named-person and internal-identifier fields present in the format, from
[How is a .xer file structured?](002-xer-file-structure.md):

- `ERMHDR` fields 5–6 — the exporting user's login and display name
- `TASK.create_user`, `TASK.update_user` — who added and last touched each activity
- `PROJECT.add_by_name`
- `RSRC.email_addr`, `RSRC.office_phone`, `RSRC.other_phone`, `RSRC.employee_code`,
  `RSRC.user_id`, `RSRC.rsrc_name`
- `TASKUSER.user_id`, `DOCUMENT.author_name`
- Free text: `rsrc_notes`, `task_memo`, `comments`, UDF text values

The launch stock is authored templates, so day-one exposure is low. The risk is
structural, not hypothetical: the upload path accepts arbitrary files from anyone
signed in with Google, and a planner exporting from a live P6 database will not
know these fields are in there. Most have never opened a `.xer` in a text editor.

Settle:

- **Does the app strip anything on ingest, or publish the file verbatim?** Verbatim
  is honest and simple — what you uploaded is what people download — but it means
  the app knowingly republishes personal data. Stripping means the downloaded file
  differs from the uploaded one, which has its own integrity problem: it will no
  longer round-trip byte-identically, and a planner comparing it against their own
  copy will see a mismatch.
- **If stripping: strip on ingest, or on download?** Storing the original and
  filtering at serve time keeps provenance and allows the policy to change later.
  Storing only the stripped version is safer and cheaper but irreversible.
- **Which fields?** The audit fields (`create_user`, `update_user`, `add_by_name`,
  header user) are near-costless to remove and carry no scheduling meaning. The
  resource fields are different — `rsrc_name` is often a trade or crew name rather
  than a person, and stripping it damages the programme's usefulness.
- **Does the uploader get told?** A pre-publish screen showing "this file contains
  3 named users and 15 resources with email addresses" would let planners make
  their own call, and is far more honest than silent stripping. It is also real
  build work.
- **What about the free-text fields?** They cannot be machine-checked for personal
  data. Warn, ignore, or exclude those tables from publication entirely?
- **Deletion.** If someone asks for their name to be removed from a file uploaded
  by someone else, what happens — and does that answer differ from the takedown
  path in [Licensing, attribution and takedown](003-licensing-attribution-takedown.md)?

The output is a stated position plus the fields it implies on the schema and the
steps it implies in the upload flow. Coordinate with
[Licensing, attribution and takedown](003-licensing-attribution-takedown.md) —
that ticket settles the rights, this one settles the personal data, and they share
the pre-publish screen.

### Already fixed by [Upload and ingest pipeline](011-upload-ingest-pipeline.md)

**The pre-publish screen exists and its cost is already paid** — the question "is it
real build work?" above is answered, and the answer is *cheaper than it looked*.

011 put a **full client-side parse at the front of the upload funnel**: the file is
parsed in the browser before a single byte is uploaded, to drive validation, limits,
dedup and metadata prefill. So a panel reading *"this file names 3 users and 15
resources with email addresses"* costs one render and zero server work — the data is
already in the tab.

Take as given:

- **The panel's position is fixed**: on the metadata screen, directly above 003's
  rights checkbox. This ticket decides its *content*, not its placement.
- **Its data source is the client parse**, which is advisory by design. Anything
  013 decides to *enforce* (rejecting a file, stripping a field) must also run
  server-side at ingest, because 010 fixed that nothing a client computes is trusted.
- **Ingest never rewrites the `.xer`** and downloads serve original bytes, unchanged
  from 003. If 013 lands on stripping, it is therefore a serve-time or
  second-object decision, not an ingest mutation — 011 writes exactly three objects
  per revision (`original.xer.gz`, `activities.json.gz`, `derived.v{N}.json`) and a
  stripped variant would be a fourth.

## Resolution

**Publish verbatim, disclose before publishing, strip nothing, screen nothing, and
promise nothing.** No stripper is built, no server-side detector is built, and the
ticket closes with **zero schema demand** — the rare one that adds no column.

The corpus audit is the whole argument
([measurements](assets/pi-audit.md), 143 real files, 243,225 `TASK` rows, 2,051
`RSRC` rows), and it inverted the ticket's own premise.

### 1. The fields Oracle warns loudest about are empty

`RSRC.email_addr`, `office_phone`, `other_phone`, `employee_code` and `user_id` are
populated in **0 rows of 0 files**. `TASKUSER` and `DOCUMENT` are not merely empty —
they are **absent from every export**. Those are precisely the fields a machine can
detect with a regex.

What is populated is the opposite kind of thing:

- `TASK.create_user` / `update_user` — **100% of 243,225 rows**, and **exactly one
  distinct value per file**, in all 143. Not one per file on average; one, always,
  with no file carrying two. Header login is `admin` in **142/143**.
- `RSRC.rsrc_name` — 100% of 2,051 rows, **80% of them `RT_Labor`**, names 1–4
  tokens, and **no automatable rule separates a crew member from a trade** (a
  `Concrete Grade` material name matches any person-name heuristic you write).
- `task_memo` (813 rows, 55 files), `rsrc_notes` (133), and `Remarks` free text.

So a stripper would fire on nothing and stay silent on everything. Worse, it would
ship a file that is **no longer a clean P6 round-trip** while still carrying the
personal data it claims to have removed — false assurance, which is a weaker legal
position than honest publication. **Verbatim.**

### 2. PI is confined to exactly one object — and that was already true

Cross-checked against the served contracts rather than assumed:

| Object | PI |
|---|---|
| Postgres row (~11 cols + `card`) | none |
| `derived.v{N}.json` | none — `resource_count` is an integer |
| `activities.json` | none — 008 fixed v1 at 13 `TASK` columns + WBS tree; `TASKRSRC` cut |
| Server-rendered programme page | none — renders from `derived.json` |
| **`original.xer.gz`** | **all of it** |

Nobody designed this; it falls out of payload cuts made in 006 and 008 for size.
But it converts the exposure question from *"is the site safe"* into *"what is the
posture of one URL"*, and that is answerable.

**That URL is now `noindex`.** The blob stays public, unsigned and CDN-cached —
004's economics are untouched, no auth, no app-server proxy, zero egress — but
carries `X-Robots-Tag: noindex, noarchive` set at PUT, with `Disallow: /` in the
blob host's `robots.txt` and `rel="nofollow"` on the download link. A `.xer` is
plain text and Google indexes text files; the gap between *"a planner who
downloaded a programme sees a name"* and *"a labourer's name is the top hit for
their name"* is search indexing, and it closes for the price of one header.
Programme pages stay fully crawlable for 008/009 — now **provably**, since the
column list shows they carry no PI. Stated as what it is: mitigation against
well-behaved crawlers, not protection against a scraper.

### 3. The panel is advisory, and that is a deliberate refusal to screen

011 already parses the file in the browser before a byte is uploaded, so the panel
costs one render and zero server work. Its **content** is fixed here; its position
(above 003's rights checkbox) was fixed by 011.

**Nothing blocks. There is no server-side PI detector anywhere in the ingest path.**
Because a blocker would fire only on the measured-empty fields and never on the
populated ones, and — decisive — it would constitute a **screening promise** the
site then fails on every free-text field. Advisory-only claims nothing, so it
cannot fail. This also keeps 010's rule intact by making it moot: nothing 013
enforces, so nothing needs recomputing server-side.

The panel enumerates **values, not counts**, for the closed sets. A count is
unactionable — nobody acts on "15 resources"; they act on recognising a colleague's
name. Measurement makes this cheap: worst real file is **37 resources + 27 memos**,
one screen.

```
This file names people. It will be published exactly as uploaded.

Exported by            admin — Primavera Admin              [ERMHDR 5–6]
Activities created by  <one name>  (1,751 activities)       [TASK.create_user]
Activities updated by  <one name>  (1,751 activities)       [TASK.update_user]
Project added by       <one name>                           [PROJECT.add_by_name]
Resources (15)         8 labour, 6 material, 1 equipment
                       <every rsrc_name listed, with type>  [RSRC.rsrc_name]
Resource notes (1)     <preview>                            [RSRC.rsrc_notes]
Activity notes (0)                                          [TASKMEMO.task_memo]
Free text              5,805 values across: Remarks, Gang, Quantities,
                       Start Chainage, …  — published as-is, not reviewed
                                                            [UDFVALUE.udf_text]
— sections with nothing in them do not render —
```

Rules the spec encodes:

- **`create_user`/`update_user` render as one line with a count**, never a list —
  the distinct-value measurement says a list would always have length 1.
- **The measured-empty fields are still scanned** (`email_addr`, both phones,
  `employee_code`, `user_id`, `TASKUSER`, `DOCUMENT.author_name`). Free when empty,
  and the fixtures are two clients, not the world — a P6 database wired to HR fills
  exactly those columns, and that upload is the one where the panel earns itself.
- **`UDFVALUE` is not excluded from publication.** It is 12.5 MB corpus-wide, but by
  label it is chainages, zones, quantities and BOQ references at 1–41 chars average;
  the only prose-shaped labels are `Remarks` (32 KB) and `PROJECT.Comments` (4
  values) — **under 0.3% of the free-text bytes**. Excluding the table would delete
  the densest engineering payload in the corpus to remove 32 KB of prose. It is
  reported as a count plus its labels, and explicitly marked *not reviewed*.

### 4. Third-party erasure is 003 Class B, unchanged

Someone who finds their name in a file **another person uploaded** goes down the
existing path: no new class, no new field, no new operator route.
`removal_class`, `status`, `removed_at` and the subtree query already exist.

Forced, not chosen: verbatim plus never-rewrite leaves **no partial remedy**. There
is no way to remove one name and keep the file, so the only lever is removal of the
revision.

The consequence is recorded rather than softened: **revision granularity buys almost
nothing here.** A resource dictionary is stable across a series — median 15 rows per
file, near-identical across Fixture A's two-year monthly run — so a name in revision
5 is in revisions 1–20. One crew member's request tombstones **the whole series and
every fork of it**. That is the price of verbatim, and the operator pays it on
request rather than arguing.

One softener exists at zero build cost, using 005's Programme/Revision split as-is:
the owner may upload a **cleaned revision** (rename resources in P6, re-export) and
the operator tombstones only the tainted revisions. Programme identity, slug and
fork lineage survive.

### 5. Legal pages — two versioned edits, no new machinery

Both ride 003's existing `terms_version` snapshot:

1. **Upload terms.** The "no confidential data" checkbox gains explicit words: *the
   file may name people; publication is verbatim; nothing is stripped*. This makes
   the warranty and the panel **the same claim**, so `terms_version` pins what the
   uploader was actually shown. No second checkbox — friction without a detector was
   considered and rejected.
2. **Privacy policy.** New section: uploaded programmes are published as uploaded;
   people named in a file they did not upload may request removal; the remedy is
   **removal of the revision, not editing of the file**; blobs are excluded from
   search indexing.

**A third lawyer question** joins 003's two, and blocks nothing: *does an uploader
warranty plus an advisory panel constitute a lawful basis for publishing
third-party personal data under UK GDPR, and at publication is the site controller
or joint controller?*

### 6. Escalated to a map-level standing decision — no warranty

The maintainer guarantees nothing. This is a free, open-source platform for sharing
data; use is opt-in and at the user's own risk. Placed in the map's Notes rather
than here, because its reach is the whole effort:

- **Terms carry a service-level as-is disclaimer**, not only Apache-2.0's. Apache
  §7/§8 disclaims the *source*; the hosted instance needs its own — no warranty of
  accuracy, availability, fitness, or that any file is safe to rely on.
- **Nothing on the site is ever worded as a guarantee.** The panel warns, it does
  not certify. DCMA is computed, not endorsed. `noindex` is mitigation, not
  protection.
- It **pre-settles a family of open questions** in the direction 013 went: no
  screening promise, no verification badge, no "checked" state. This constrains
  [Credit, upvotes and the contributor leaderboard](016-credit-upvotes-leaderboard.md)
  and narrows the **Curation** fog patch, which was already floored by 009.
- It does **not** waive statutory duties. An erasure request still gets Class B; UK
  GDPR is not disclaimable in terms.

### 7. Answers to the ticket's own list

| Question | Answer |
|---|---|
| Strip or verbatim? | **Verbatim.** Detectable fields are empty; populated ones are undetectable |
| If stripping, ingest or download? | Moot — nothing is stripped, so no fourth object |
| Which fields? | None removed. All named ones **reported** in the panel |
| Uploader told? | **Yes**, values enumerated, above 003's checkbox, zero server cost |
| Free text? | **Warned, not excluded.** Counts + labels, marked not reviewed |
| Deletion? | **003 Class B unchanged**, with the cleaned-revision softener |

### 8. Cost paid elsewhere

- 004's standing note "blobs are public and CDN-cacheable" gains **and non-indexable**.
- 011 gains one PUT-time header (`X-Robots-Tag`) and one panel section; no logic.
- 003 gains a privacy-policy section, a sharper upload-terms sentence, and a third
  lawyer question.
- Everything else: unchanged.

### Amendment 2026-08-08 — [What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md)

017 owns the operating mechanism this ticket handed it, and answers both of its open
demands.

**Finding the revisions from a name is an on-demand corpus scan with no index.** This
ticket's best finding — PI is confined to `original.xer.gz` by construction, because 006 and
008 had already cut every resource, memo and UDF field from the derived objects — is exactly
what makes the search hard: Postgres holds no name and no derived object does either. The
obvious fix was **refused outright**: indexing `rsrc_name` into Postgres would build a
searchable index of every person named across the whole corpus, a far larger liability than
the files themselves and the standing PI apparatus this ticket refused when it refused
screening. The absence of that index is a privacy property, not a gap.

So the operator greps decompressed blobs on demand, case-insensitively, over the whole plain
text — catching a name wherever it lands, including the free text this ticket warned about
and could not screen. Nothing is persisted. R2 egress is free, so a full scan costs only
minutes.

**The softener is operator correspondence, not a product flow**, costing one status value
(`awaiting_owner`). 005 already lets the operator narrow a cascade to named Revisions, so
the tooling existed; the corpus scan scoped to one programme is how the operator verifies a
cleaned revision is actually clean before tombstoning the tainted ones. Owner contact is
003/010's Clerk lookup, used at the operator's discretion. An in-app "your programme has a
complaint" notice was **deliberately not built** — it automatically discloses an
*unadjudicated* complaint to the person complained about, and whether to tip off an owner is
a per-case judgement.

**The `noindex` header gains a companion.** 017 drops `original.xer.gz` to a 1-hour TTL,
because 004's year-long immutable cache meant deleting the object left it downloadable for
twelve months — so this ticket's one PI-bearing object now carries three special
properties (`noindex, noarchive`, short TTL, and 30-day quarantine on Class B), which is one
coherent rule rather than three exceptions.

Class B remains the removal path, unchanged, and this ticket's blunt consequence stands: one
crew member's request tombstones the whole series and its forks.
